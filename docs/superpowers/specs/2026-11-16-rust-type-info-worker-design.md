# Rust type worker'ı ve kuyruğu (`worker-info-types`, `queue-types`) — tasarım

Tarih: 2026-11-16
Önceki adımlar: [karakter worker'ı](2026-11-15-rust-character-info-worker-design.md),
[kuyruk yayıncıları](2026-11-15-rust-queue-publishers-design.md), #315

## Amaç ve neden

#315'teki sıranın bir sonraki adımı: Node'u yavaş yavaş emekliye ayırmak.
`worker:info:types` ve `queue:types`'ın Rust karşılıkları yazılır:

| Node                                       | Rust                                   | Kuyruk                |
| ------------------------------------------ | -------------------------------------- | --------------------- |
| `backend/src/workers/worker-info-types.ts` | `backend-rs/workers/worker-info-types` | `esi_type_info_queue` |
| `backend/src/queues/queue-types.ts`        | `backend-rs/queues/queue-types`        | `esi_type_info_queue` |

Port sırasında Node kuyruğunda gerçek bir açık bulundu ve Rust kuyruğu onu
kapatır:

- `TypeService.getTypeIds()` (`type.service.ts:12-49`) type ID'lerini
  `/universe/groups/` listesinden, her grubu tek tek çekerek topluyor. Liste
  **sayfalı** ve Node yalnızca 1. sayfayı okuyor. 2026-11-16'da ESI
  `X-Pages: 2` döndü: 1. sayfada 1.000, 2. sayfada 633 grup.
- Sonuç olarak 2. sayfadaki grupların type'ları bu kuyruktan hiç gelmiyor.
  Veritabanındaki 9.451 tanesi (436 grup) yalnızca killmail'lerde geçtikleri
  için, `scan:entities` yoluyla gelmiş. `types` tablosunda 33.623 satır var;
  `/universe/types/` ise `X-Pages: 54` dönüyor, yani yaklaşık 53 bin type.

## Hedefler

- **`queue-types`**: root scan. `GET /universe/types/?page=N`, 1. sayfadan
  `X-Pages` değerine kadar; dönen bütün ID'ler filtresiz kuyruğa gider
  (CLAUDE.md, "Root scan"). Grup listesi ve gruplar tek tek çekilmez, bu da
  yaklaşık 1.635 isteği yaklaşık 54 isteğe indirir.
- **`worker-info-types`**: Node'la aynı davranış.
  - Type tabloda varsa ESI'ye gidilmez; mesaj ack edilir ve "atlandı"
    sayılır.
  - Yoksa `GET /universe/types/{id}/` çekilir ve satır **yalnızca eklenir**.
    Var olan satır hiçbir zaman güncellenmez (Node'daki `update: {}`).
  - `PREFETCH_COUNT = 10`, kuyruk `esi_type_info_queue`.
- **`esi`** crate'ine sayfalı listeler için `get_paged` eklenir.
- **`runner`**'a üçüncü bir sonuç eklenir: "skipped".
- Mesaj biçimi Node ile birebir aynı: `source: "queue-types"`, biçim
  `mq::publish_entities`'in ürettiği biçim.
- `backend/package.json`'a `queue:types:rs` ve `worker:info:types:rs`,
  ötekilerle aynı biçimde eklenir.

## Hedef olmayanlar

- Node'un `worker-info-types.ts`, `queue-types.ts` dosyalarına ve
  `TypeService`'e dokunulmaz. Node kuyruğundaki sayfalama açığı Node'da
  düzeltilmez; Node sürümü emekliye ayrıldığında açık da kendiliğinden
  kapanır.
- Var olan type'ları güncellemek (CCP'nin dengeleme değişiklikleri). Bu
  bilinçli bir karar: type'lar statik veri sayılıyor.
- `meta_group_id`. Bu sütunu `yarn sde:meta-groups` doldurur; worker ona
  dokunmaz, yeni satırda NULL kalır.
- Dogma özellikleri ve etkileri, `market_group_id`, `packaged_volume` ve ESI
  yanıtındaki öbür alanlar. Node bunları kaydetmiyor.
- Zamanlama. `queue:types` statik veridir, elle çalıştırılır; PM2'ye ve
  crontab'a eklenmez.
- Bu kuyruğa basan öbür Node kodu (`scan:entities`) Node'da kalır. Mesaj
  biçiminin aynı olması bu yüzden şart.

## Anti-hedefler

- Var olan bir type'ı ESI'ye yeniden sordurmak. Her kuyruk koşusu yaklaşık
  53 bin istek olur.
- Sayfalardan biri alınamadığı halde kısmi bir listeyi kuyruğa basmak.
- Öbür üç worker'ın log satırlarını değiştirmek.
- ESI'ye `esi::EsiClient` dışından gitmek.

## Yaklaşımlar (kuyruk)

1. **Node'un birebir kopyası.** Grup listesinin 1. sayfası, ardından her grup
   tek tek. Davranış aynı kalır, açık da taşınır.
2. **Gruplar, tüm sayfalarıyla.** Açık kapanır ama yaklaşık 1.635 istek
   harcanır.
3. **`/universe/types/`, tüm sayfalarıyla (seçilen).** Aynı ID listesini
   yaklaşık 54 istekle verir ve `queue-alliances` gibi düz bir taramadır.

Kullanıcı 3'ü seçti. Var olan type'lar için de Node gibi atlamayı seçti; öteki
seçenek her koşuda bütün tabloyu ESI'den yeniden çekmekti.

## Tasarım

### esi: `get_paged`

```rust
/// GET every page of a paged list route (`X-Pages`) and concatenate them in
/// page order.
pub async fn get_paged<T: DeserializeOwned>(&self, path: &str) -> Result<Vec<T>, EsiError>
```

- `path` sorgu parametresi içermez (`/universe/types/`). 1. sayfa
  `{path}?page=1` olarak istenir. `X-Pages` başlığı okunur; başlık yoksa ya da
  sayı değilse tek sayfa kabul edilir. 2'den `X-Pages`'e kadar olan sayfalar
  sırayla istenir.
- Her sayfa ayrı bir istektir ve `get_with_compatibility_date` ile aynı yoldan
  geçer: limiter slotu, `observe`, 420/429'da `EsiThrottled`, öbür hatalar.
  `route_template` sorgu kısmını zaten atıyor (`route.rs:19`), yani bütün
  sayfalar tek rota sayılır.
- Bunun için mevcut istek gövdesi, başlıkları da döndüren içe dönük bir
  yardımcıya taşınır. `get` ve `get_with_compatibility_date`'in imzası ve
  davranışı değişmez.
- Herhangi bir sayfadaki hata bütün çağrıyı başarısız kılar; kısmi sonuç
  dönmez.

### runner: "skipped" sonucu

`Processed.inserted: bool` alanı bir enum'a çevrilir:

```rust
pub enum Outcome { Created, Updated, Skipped }
pub struct Processed { pub outcome: Outcome, pub detail: String }
```

- `success_line`: `Created`/`Updated` için bugünkü satır değişmez
  (`  ✅ [n]<detail> (created|updated)`). `Skipped` için Node'un satırı:
  `  - [n]<detail> (exists)`; types worker'ında `detail` ` type {id}` olur,
  yani `  - [12] type 587 (exists)`.
- `Totals`'a `skipped` sayacı eklenir. Final satırı skipped sıfırken bugünkü
  gibi kalır. Sıfırdan büyükse
  `📊 final: N processed (X created, Y updated, S skipped, Z errors)`.
- Var olan üç worker'ın `main.rs`'i yalnızca mekanik olarak güncellenir
  (`inserted` yerine `Outcome`). Davranışları ve logları değişmez.

### worker-info-types

Crate düzeni ötekilerle aynı: `src/type_info.rs` (ESI tipi, var-mı sorgusu,
insert), `src/lib.rs`, `src/main.rs`, `tests/parse.rs`, `tests/insert.rs`,
`tests/fixtures/types.sql`. Modülün adı `type` olamaz (anahtar kelime), bu
yüzden `type_info`.

**`TypeInfo`** (`GET /universe/types/{id}/`): ESI'nin zorunlu alanları
`name: String`, `group_id: i32`, `published: bool`. `description`
`#[serde(default)] Option<String>`: ESI onu zorunlu sayıyor ama sütun boş
olabiliyor, eksik gelirse mesajın düşmesi gerekmez. `volume`, `capacity`,
`mass` `Option<f64>`, `icon_id` `Option<i32>`. Öbür alanlar yok sayılır.

**`handle(id)`**:

1. `SELECT EXISTS (SELECT 1 FROM types WHERE id = $1)`. Satır varsa
   `Outcome::Skipped`, ESI isteği yok.
2. Yoksa `GET /universe/types/{id}/`: sonda `/` var, Node'la aynı
   (`type.service.ts:57`). Varsayılan uyumluluk tarihi kullanılır.
3. Insert:

   ```sql
   INSERT INTO types (id, name, description, group_id, published,
                      volume, capacity, mass, icon_id, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
   ON CONFLICT (id) DO NOTHING
   RETURNING id
   ```

   Satır dönerse `Outcome::Created` olur ve `detail` ` {name}` olur. Dönmezse,
   yani 1. adımla insert arasında başka bir süreç aynı type'ı eklemişse,
   `Outcome::Skipped` olur. Bu durumda yeni satır yazılmadığı için Node'un
   `upsert`'üyle aynı sonuç çıkar.

   `updated_at`'in veritabanında varsayılanı yok (`@updatedAt` Prisma'nın),
   o yüzden açıkça yazılır. `created_at` veritabanı varsayılanıdır.
   `meta_group_id` yazılmaz.

**Sabitler.** `QUEUE_NAME = "esi_type_info_queue"`, `PREFETCH_COUNT = 10`,
`CONSUMER_TAG = "worker-info-types-rs"`,
`STARTED = "📦 type info worker started"`, `WAITING_FOR = "types"`,
`ENTITY = "type"`.

### queue-types

`queue-alliances`'ın kalıbı. Argüman almaz.

- `lib.rs`: `QUEUE_NAME`, `SOURCE = "queue-types"` ve
  `fetch_type_ids(&EsiClient) -> Result<Vec<i32>, EsiError>`, yani
  `esi.get_paged("/universe/types/")`.
- `main.rs`: `runner::init()`, ardından
  - `fetching all type IDs from ESI...`
  - `fetch_type_ids`
  - `found N types`, `adding to queue: esi_type_info_queue`
  - `connect` ve `declare_worker_queue`
  - `publish_entities`, 100'lük batch'ler debug log'da (Node gibi:
    `queued batch i/total`)
  - `all N types queued successfully!`,
    `run worker with: yarn worker:info:types:rs`
- ID listesinin tamamı alınmadan hiçbir şey basılmaz. Hata olursa
  `failed to queue types: …` ve çıkış 1.

## Doğrulama

- **esi** (`wiremock`):
  - `X-Pages: 3` için üç sayfanın sırayla istendiğini ve birleştirildiğini
    gösteren test.
  - Başlık yoksa tek istek atıldığını gösteren test.
  - 2. sayfa 500 dönünce hatanın döndüğünü ve kısmi sonuç olmadığını
       gösteren test.
  - Her sayfa için limiter'ın gözlem yaptığını gösteren test (mevcut
    testlerdeki kalıpla).
- **runner**:
  - `Skipped` için `success_line`.
  - skipped sıfırken final satırının bugünküyle aynı, sıfırdan büyükken
    skipped'li olduğunu gösteren test.
  - `process_one`'ın `Skipped`'i ack edip sayması.
- **worker-info-types**:
  - `parse.rs`: gerçek bir ESI yanıt örneğinin decode'u, opsiyonel alanlar
    eksikken decode.
  - `insert.rs` (`#[sqlx::test(migrations = false, fixtures(...))]`):
    - yeni type insert edilir ve `Created` döner;
    - var olan type'ın satırı hiç değişmez (`updated_at` dahil) ve `Skipped`
      döner;
    - `meta_group_id` NULL kalır.
- **queue-types**: `wiremock` ile `fetch_type_ids`'in sayfaları gezmesi.
- **Yerelde bir kez:** worker'lar durdurulmuşken `yarn queue:types:rs`.
  Kuyruktaki mesaj sayısı ESI'nin toplamına (yaklaşık 53 bin) eşit olmalı.
  Ardından `yarn worker:info:types:rs` kuyruğu boşaltır:
  - yaklaşık 33,6 bin satır skipped, yaklaşık 20 bin satır created çıkmalı;
  - `errors` sıfır ya da yalnızca 404'ler olmalı;
  - `types` satır sayısı yalnızca artmalı.
- `cargo test`, `cargo clippy`, `cargo fmt --check`, `.sqlx` güncel olmalı;
  `npx prettier --check backend/package.json`.

## Kararlarım (kullanıcı onayı değil, düzeltilebilir)

- **Atlama logu Node'un metniyle.** `  - [n] type {id} (exists)`. Eklenen
  type'ın satırı ise runner'ın biçiminde: `  ✅ [n] {name} (created)`, Node'un
  `  ✓ [n] {name}` satırı değil. Öbür Rust worker'larında da böyle.
- **Final satırında "skipped" yalnızca sıfırdan büyükken.** Böylece öbür üç
  worker'ın logu değişmez. Node'un her 100 mesajlık ara özeti yok; runner
  ötekilerde de yazmıyor.
- **Yarışta kalan insert `Skipped` sayılır**, hata sayılmaz.
- **Sayfalar sırayla istenir, paralel değil.** 54 istek için paralellik
  kazandırmıyor; limiter zaten hızı belirliyor.
- **ID listesinde tekilleştirme yok.** Sayfalar arasında kayma olursa aynı ID
  iki kez gelebilir; worker ikincisini atlar.
- **`description` opsiyonel okunur**, ESI onu zorunlu saysa da.
- **Yayıncının son satırı Node'un metniyle** (`run worker with: …`), öbür
  Rust yayıncılarındaki `now run the worker: …` değil. Önceki spec'teki kural
  bu: her Rust script'i kendi Node karşılığını kopyalar.
- `group_id`'nin `item_groups`'a foreign key'i yok (migration
  `20251209194827` kaldırdı). Bu yüzden grubu veritabanında olmayan bir type
  da sorunsuz eklenir; ayrıca bir kontrol yapılmaz.
- Dokümantasyon: CLAUDE.md'deki tabloya dokunulmaz (kuyruk adı aynı).
  `backend/docs/workers/` altında types'tan söz eden bir yer varsa ona
  sayfalama notu eklenir.

## Kurucuya kalanlar

- `esi` içindeki yardımcının adı ve tam imzası.
- `X-Pages` okuması için `route.rs`'te mevcut bir ayrıştırıcı varsa onu
  kullanmak.
- Test dosyalarının ve fixture'ın ayrıntısı, öbür crate'lerdeki düzene
  bakarak.
