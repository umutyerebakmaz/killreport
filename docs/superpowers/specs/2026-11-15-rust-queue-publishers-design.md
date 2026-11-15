# Rust kuyruk yayıncıları: `queue-alliances` ve `queue-corporations`

Tarih: 2026-11-15
Önceki adımlar: [Rust worker spike](2026-11-12-rust-worker-spike-design.md),
[runner ve corporation worker](2026-11-14-rust-worker-runner-and-corporations-design.md)

## Amaç ve neden

Node'u yavaş yavaş emekliye ayırmak. Rust'a geçen iki worker'ın
(`worker-info-alliances`, `worker-info-corporations`) kuyruklarını dolduran iki
Node script'inin Rust karşılıkları yazılır:

| Node                                       | Rust                                   | Kuyruk                       |
| ------------------------------------------ | -------------------------------------- | ---------------------------- |
| `backend/src/queues/queue-alliances.ts`    | `backend-rs/queues/queue-alliances`    | `esi_alliance_info_queue`    |
| `backend/src/queues/queue-corporations.ts` | `backend-rs/queues/queue-corporations` | `esi_corporation_info_queue` |

Bu adımdan sonra bu iki domain'de kuyruk → worker zincirinin tamamı Rust'ta
çalıştırılabilir.

## Hedefler

- İki ayrı binary crate, Node'daki `queues/` – `workers/` ayrımını koruyarak
  `backend-rs/queues/` altında. Workspace `members` listesine `queues/*` eklenir.
- Bastıkları mesaj Node'unkiyle biçim olarak birebir aynı:
  `{"entityId":99000001,"queuedAt":"2026-11-15T10:00:00.000Z","source":"queue-alliances"}`.
  Alan sırası `entityId`, `queuedAt`, `source`; `queuedAt` milisaniyeli ve `Z`
  ile biten `toISOString` biçimi (chrono `SecondsFormat::Millis`, `use_z = true`);
  `source` Node script'inin adı (`queue-alliances`, `queue-corporations`).
  Mesaj `persistent` (delivery mode 2), öncelik verilmez — Node da vermiyor.
- Davranış Node script'leriyle aynı:
  - **queue-alliances** (root scan): `GET /alliances` (sonda `/` yok,
    `alliance.service.ts:12`), dönen bütün ID'ler filtresiz kuyruğa.
  - **queue-corporations**: argüman yoksa `SELECT id FROM corporations ORDER BY id`;
    argüman varsa yalnızca o ID'ler.
- Log satırları Node'unkilerle aynı metin (`found N alliances`,
  `adding to queue: …`, 100'lük batch başına debug satırı, bitiş satırı,
  `now run the worker: yarn worker:info:…`). Son satır Rust worker'ı gösterir:
  `yarn worker:info:alliances:rs`. İki Node script'i arasındaki küçük farklar
  korunur: corporations batch debug satırını yalnızca 100'den fazla ID varken
  yazar, bitiş satırında ✅ vardır ve argüman / veritabanı yolları için kendi
  satırları vardır. Her Rust script'i kendi Node karşılığını kopyalar.
- `backend/package.json`'a `queue:alliances:rs` ve `queue:corporations:rs`,
  worker'lardakiyle aynı biçimde
  (`cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-alliances`).
  `backend/` içinden çalışır, aynı `.env`'i okur.
- Çıkış kodu: başarıda 0, herhangi bir hatada 1.

## Hedef olmayanlar

- Node script'leri bu PR'da **silinmez**. İkisinin bastığı mesajlar aynı
  çıktıktan sonra ayrı bir adımda kaldırılır.
- `ecosystem.config.js` ve crontab'a dokunulmaz.
- Bu kuyruklara basan öbür Node kodu (`scan-killmail-entities`,
  `worker-alliance-corporations`, `queue-character-corporations`, alliance
  mutation'ı, worker resolver helper'ı) Node'da kalır. Mesaj biçiminin birebir
  aynı olması bu yüzden şart: worker iki kaynaktan da aynı şeyi alır.
- Genel bir "her kuyruk script'i" çerçevesi yazılmaz; yalnızca iki script'in
  gerçekten paylaştığı parça ortaklaşır.

## Anti-hedefler

- Mesaj biçiminde en küçük fark (alan adı, tarih biçimi, `source` değeri).
- Kuyruğu Node'un `ensureAllQueuesExist()`'inden farklı argümanla tanımlamak
  (406 ve kapanan kanal).
- ESI'ye `esi::EsiClient` dışından gitmek.

## Yaklaşımlar

- **A. Her script ayrı binary crate (seçilen).** `backend-rs/queues/<ad>`.
  Node'daki düzeni ve "her domain bir kuyruk, bir worker" kalıbını korur; bir
  sonraki kuyruk script'i de aynı kalıbı izler. Bedeli iki crate'lik iskelet.
- **B. Mevcut worker crate'ine ikinci binary.** Daha az crate, ama kuyrukla
  worker'ı tek pakette birleştirir; kalıp bulanıklaşır.
- **C. Alt komutlu tek `queues` binary'si.** Her domain'in kendi süreci
  ilkesine ters; elendi.

Kullanıcı A'yı seçti.

## Tasarım

### Paylaşılan parçalar

- **`mq`**: yayıncı tarafı eklenir.
  - `EntityMessage { entity_id, queued_at, source }`, `Serialize`,
    `#[serde(rename_all = "camelCase")]`; `EntityMessage::new(id, source)`
    `queued_at`'i o anki UTC zamanından yukarıdaki biçimde doldurur.
  - `publish_entities(channel, queue, source, ids) -> Result<u64>`: kanalda
    publisher confirm açar (`confirm_select`), her ID için bir persistent mesaj
    basar, 100'lük batch başına debug log yazar, sonunda bütün confirm'leri
    bekler. Bir `nack` gelirse hata döner.
  - Kuyruk tanımlama mevcut `declare_worker_queue` ile yapılır: yalnızca hedef
    kuyruk ve retry topolojisi, argümanlar Node ile aynı.
- **`runner`**: `.env` yükleme ve tracing kurulumu `run()` içinden
  `pub fn init()` olarak dışarı açılır; worker'lar da yayıncılar da onu çağırır.
  `run()`'ın davranışı değişmez.
- Mevcut `runner::EntityQueueMessage` olduğu gibi kalır (yalnızca `entityId`
  okur). Bir test, `mq::EntityMessage`'ın ürettiği gövdenin onunla parse
  edildiğini doğrular.

### queue-alliances

`init()` → `RateLimiter::from_env()` ile `EsiClient` (bulk sınıfı, worker'lar
gibi) → `esi.get::<Vec<i32>>("/alliances")` → `connect(RABBITMQ_URL)` →
`declare_worker_queue` → `publish_entities` → kanal ve bağlantı kapatılır.

### queue-corporations

`init()` → argümanlar. Argüman varsa her biri `i32` olarak parse edilir,
parse edilemeyen atlanır; hiçbiri geçerli değilse `invalid corporation IDs
provided` ve çıkış 1. Argüman yoksa `db::worker_pool` ile
`SELECT id FROM corporations ORDER BY id`. Sonrası alliances ile aynı.
`DATABASE_URL` yalnızca argümansız yolda gerekir.

## Kararlarım (kullanıcı onayı değil, düzeltilebilir)

- **Publisher confirm.** Node basıp kanalı kapatıyor, broker'ın aldığını
  doğrulamıyor. Rust confirm bekler; hepsi onaylanmadan "queued successfully"
  yazmaz. Mesajın kendisi değişmez, yalnızca güvence artar.
- **Sıkı argüman parse'ı.** Node `parseInt("12abc")` → 12 kabul eder; Rust
  `"12abc"`'yi atlar. Gerçek kullanımda fark yaratmaz.
- **Yalnızca hedef kuyruk tanımlanır**, Node gibi bütün kuyruklar değil:
  yayıncının ihtiyacı o, argümanlar aynı olduğu için çakışma yok.
- Batch log'u debug seviyesinde, Node gibi; `RUST_LOG=debug` ile görünür.

## Doğrulama

- Birim: mesajın JSON'u alan alan ve sırasıyla beklenen metne eşit; tarih
  biçimi; `runner::EntityQueueMessage` ile parse.
- `wiremock` ile `/alliances` listesinin çekilip `Vec<i32>`'ye dönmesi.
- `#[sqlx::test(migrations = false, fixtures(...))]` ile corporation ID sorgusu
  (sıra dahil), `worker-info-corporations/tests/upsert.rs`'deki kalıpla. CI
  `SQLX_OFFLINE=true` ile derlediği için sorgu ya runtime `sqlx::query` olur ya
  da `.sqlx` güncellenir.
- `EntityMessage` → `EntityQueueMessage` parse testi `runner`'da durur
  (`runner` zaten `mq`'ya bağımlı).
- Argüman parse'ı için birim testler.
- Yerelde bir kez, worker'lar durdurulmuşken: önce Node, sonra Rust script'i
  aynı kuyruğa basar. `queue-corporations` birkaç ID argümanıyla karşılaştırılır;
  argümansız koşu bütün tabloyu ESI'ye yeniden çektirir ve eşit sayı dışında
  bir şey göstermez. Mesaj sayıları eşit olmalı; RabbitMQ yönetim
  arayüzünden (Get messages, requeue açık) ikişer örnek mesajın yalnızca
  `queuedAt` değeri farklı olmalı. Ardından Rust worker kuyruğu boşaltır ve
  `final: … errors` sıfır olmalı.
- `cargo test`, `cargo clippy`, `cargo fmt --check`; `package.json` değiştiği
  için `npx prettier --check backend/package.json`.

## Builder'a kalan

- Crate içi modül bölümü (`lib.rs` / `main.rs`) ve test dosyalarının adları,
  worker crate'lerindeki düzene bakarak.
- `publish_entities`'in imzasının ayrıntısı (ID tipi, iterator mı slice mı).
