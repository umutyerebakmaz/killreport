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

- **`queue-types`**: aday listesi ESI'den gelir, filtre veritabanından.
  - `GET /universe/types/?page=N`, 1. sayfadan `X-Pages` değerine kadar.
    Grup listesi ve gruplar tek tek çekilmez, bu da yaklaşık 1.635 isteği
    yaklaşık 54 isteğe indirir.
  - `SELECT id FROM types` ile var olan ID'ler okunur. Yalnızca ESI'de olup
    tabloda olmayanlar kuyruğa gider. Bugün bu yaklaşık 20 bin, 53 bin değil.
  - "Zaten veritabanında mı?" filtresi böylece CLAUDE.md'nin istediği gibi
    kuyrukta durur, worker'da değil. Kuyruk yeniden çalıştırılabilir:
    eksik kalmayınca hiçbir şey basmaz.
- **`worker-info-types`**: öbür üç Rust worker'ının kalıbı.
  - Her mesajda `GET /universe/types/{id}/` çekilir ve satır upsert edilir.
    Sonuç `created` ya da `updated` olur.
  - Güncelleme yolu yalnızca yarışta (aynı ID iki kaynaktan gelmişse) ya da
    elle kuyruğa konan bir ID'de çalışır. Kuyruklar yalnızca eksik ID'leri
    basar.
  - `PREFETCH_COUNT = 10`, kuyruk `esi_type_info_queue`.
- **`esi`** crate'ine sayfalı listeler için `get_paged` eklenir.
- **`runner`**'a dokunulmaz.
- Mesaj biçimi Node ile birebir aynı: `source: "queue-types"`, biçim
  `mq::publish_entities`'in ürettiği biçim.
- `backend/package.json`'a `queue:types:rs` ve `worker:info:types:rs`,
  ötekilerle aynı biçimde eklenir.

## Hedef olmayanlar

- Node'un `worker-info-types.ts`, `queue-types.ts` dosyalarına ve
  `TypeService`'e dokunulmaz. Node kuyruğundaki sayfalama açığı Node'da
  düzeltilmez; Node sürümü emekliye ayrıldığında açık da kendiliğinden
  kapanır.
- Var olan bütün type'ları düzenli olarak tazelemek (CCP'nin dengeleme
  değişiklikleri). Type'lar statik veri sayılıyor; kuyruk var olanları
  basmaz.
- `meta_group_id`. Bu sütunu `yarn sde:meta-groups` doldurur; worker ona ne
  insert'te ne update'te dokunur.
- Dogma özellikleri ve etkileri, `market_group_id`, `packaged_volume` ve ESI
  yanıtındaki öbür alanlar. Node bunları kaydetmiyor.
- Zamanlama. `queue:types` statik veridir ve elle çalıştırılır; hiçbir
  zamanlayıcıya eklenmez.
- Bu kuyruğa basan öbür Node kodu (`scan:entities`) Node'da kalır. Mesaj
  biçiminin aynı olması bu yüzden şart.

## Anti-hedefler

- Var olan type'ları kuyruğa basmak. Her kuyruk koşusu yaklaşık 53 bin
  mesaj ve istek olur.
- Sayfalardan biri alınamadığı halde kısmi bir listeyi kuyruğa basmak.
- `runner`'ı ve öbür üç worker'ı değiştirmek.
- ESI'ye `esi::EsiClient` dışından gitmek.

## Yaklaşımlar (kuyruk)

1. **Node'un birebir kopyası.** Grup listesinin 1. sayfası, ardından her grup
   tek tek. Davranış aynı kalır, açık da taşınır.
2. **Gruplar, tüm sayfalarıyla.** Açık kapanır ama yaklaşık 1.635 istek
   harcanır.
3. **`/universe/types/`, tüm sayfalarıyla (seçilen).** Aynı ID listesini
   yaklaşık 54 istekle verir ve `queue-alliances` gibi düz bir taramadır.

Kullanıcı 3'ü seçti.

## Yaklaşımlar (var olan type'lar)

1. **Worker atlar** (Node'un bugünkü davranışı). Kuyruk filtresiz 53 bin
   mesaj basar, worker var olanları "var mı?" sorgusuyla geçer. `runner`'a
   üçüncü bir sonuç ("skipped") gerekir. CLAUDE.md'nin "root scan'de worker
   da atlamaz" kuralına aykırı; bir istisna notu ister.
2. **Filtre kuyrukta (seçilen).** Kuyruk yalnızca eksik ID'leri basar, worker
   düz upsert yapar. Kurala uyar, `runner` değişmez, kuyruğa yaklaşık 20 bin
   mesaj girer. Bedeli: kuyruk script'i veritabanına bağlanır.
3. **Her seferinde güncelle.** Filtre yok, worker her type'ı ESI'den tazeler.
   Her koşu yaklaşık 53 bin istek; elendi.

Kullanıcı önce 1'i seçti; CLAUDE.md kuralı ortaya çıkınca 2'ye geçti.

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

### worker-info-types

Crate düzeni ötekilerle aynı: `src/type_info.rs` (ESI tipi ve upsert),
`src/lib.rs`, `src/main.rs`, `tests/parse.rs`, `tests/upsert.rs`,
`tests/fixtures/types.sql`. Modülün adı `type` olamaz (anahtar kelime), bu
yüzden `type_info`.

**`TypeInfo`** (`GET /universe/types/{id}/`): ESI'nin zorunlu alanları
`name: String`, `group_id: i32`, `published: bool`. `description`
`#[serde(default)] Option<String>`: ESI onu zorunlu sayıyor ama sütun boş
olabiliyor, eksik gelirse mesajın düşmesi gerekmez. `volume`, `capacity`,
`mass` `Option<f64>`, `icon_id` `Option<i32>`. Öbür alanlar yok sayılır.

**`handle(id)`**:

1. `GET /universe/types/{id}/`: sonda `/` var, Node'la aynı
   (`type.service.ts:57`). Varsayılan uyumluluk tarihi kullanılır.
2. Upsert, öbür worker'lardaki `xmax = 0` kalıbıyla:

   ```sql
   INSERT INTO types (id, name, description, group_id, published,
                      volume, capacity, mass, icon_id, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
   ON CONFLICT (id) DO UPDATE SET
     name = EXCLUDED.name, description = EXCLUDED.description,
     group_id = EXCLUDED.group_id, published = EXCLUDED.published,
     volume = EXCLUDED.volume, capacity = EXCLUDED.capacity,
     mass = EXCLUDED.mass, icon_id = EXCLUDED.icon_id,
     updated_at = now()
   RETURNING (xmax = 0) AS "inserted!"
   ```

   `Processed { inserted, detail: " {name}" }`, yani
   `  ✅ [12] Rifter (created)`.

   `updated_at`'in veritabanında varsayılanı yok (`@updatedAt` Prisma'nın),
   o yüzden açıkça yazılır. `created_at` veritabanı varsayılanıdır.
   `meta_group_id` ne insert'te ne update'te yazılır.

   **Node'dan fark:** Node var olan bir type'ı ESI'ye sormadan geçiyor; Rust
   onu ESI'den tazeler. Her iki kuyruk da (`queue-types` ve
   `scan:entities`) yalnızca eksik ID basar, bu yüzden fark yalnızca yarışta
   ya da elle konan bir ID'de görünür.

**Sabitler.** `QUEUE_NAME = "esi_type_info_queue"`, `PREFETCH_COUNT = 10`,
`CONSUMER_TAG = "worker-info-types-rs"`,
`STARTED = "📦 type info worker started"`, `WAITING_FOR = "types"`,
`ENTITY = "type"`.

### queue-types

`queue-alliances`'ın ESI kalıbı ile `queue-characters`'ın veritabanı kalıbı
bir arada. Argüman almaz.

- `lib.rs`:
  - `QUEUE_NAME`, `SOURCE = "queue-types"`.
  - `fetch_type_ids(&EsiClient) -> Result<Vec<i32>, EsiError>`, yani
    `esi.get_paged("/universe/types/")`.
  - `existing_type_ids(&PgPool) -> Result<HashSet<i32>, sqlx::Error>`:
    `SELECT id FROM types`.
  - `missing(esi_ids, existing) -> Vec<i32>`: ESI sırasını koruyarak
    tabloda olmayanlar, tekrarlar bir kez.
- `main.rs`: `runner::init()`, ardından
  - `fetching all type IDs from ESI...`, `fetch_type_ids`, `found N types`
  - `db::worker_pool`, `existing_type_ids`, havuz kapatılır
  - `N already in database, M to queue`
  - M sıfırsa `nothing to queue` ve çıkış 0, RabbitMQ'ya bağlanılmaz
  - `adding to queue: esi_type_info_queue`, `connect`,
    `declare_worker_queue`
  - `publish_entities`, 100'lük batch'ler debug log'da (Node gibi:
    `queued batch i/total`)
  - `all M types queued successfully!`,
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
- **worker-info-types**:
  - `parse.rs`: gerçek bir ESI yanıt örneğinin decode'u, opsiyonel alanlar
    eksikken decode.
  - `upsert.rs` (`#[sqlx::test(migrations = false, fixtures(...))]`):
    - yeni type eklenir, `true` döner, iki zaman damgası dolu;
    - var olan type güncellenir, `false` döner, `created_at` değişmez;
    - `meta_group_id` dolu bir satır güncellenince değeri korunur, yeni
      satırda NULL kalır.
- **queue-types**:
  - `wiremock` ile `fetch_type_ids`'in sayfaları gezmesi;
  - `missing`: sıra korunur, var olanlar ve tekrarlar düşer;
  - `existing_type_ids` fixture'lı veritabanına karşı.
- **Yerelde bir kez:**
  - Satır sayısı kaydedilir.
  - Worker'lar durdurulmuşken `yarn queue:types:rs`. Kuyruğa basılan sayı
    `ESI toplamı − tablodaki satır` ile tutarlı olmalı (yaklaşık 20 bin).
  - `yarn worker:info:types:rs` kuyruğu boşaltır: neredeyse hepsi created,
    `errors` sıfır ya da yalnızca 404'ler.
  - `types` satır sayısı yalnızca artmış olmalı.
  - `yarn queue:types:rs` ikinci kez çalıştırılınca `nothing to queue`
    (ya da yalnızca 404 alan birkaç ID) demeli.
- `cargo test`, `cargo clippy`, `cargo fmt --check`, `.sqlx` güncel olmalı;
  `npx prettier --check backend/package.json`.

## Kararlarım (kullanıcı onayı değil, düzeltilebilir)

- **Worker log satırı runner'ın biçiminde:** `  ✅ [n] {name} (created)`,
  Node'un `  ✓ [n] {name}` satırı değil. Öbür Rust worker'larında da böyle;
  Node'un her 100 mesajlık ara özeti de yok.
- **Sayfalar sırayla istenir, paralel değil.** 54 istek için paralellik
  kazandırmıyor; limiter zaten hızı belirliyor.
- **Tekrarlar kuyrukta tekilleştirilir.** Sayfalar arasında kayma olursa aynı
  ID iki kez gelebilir; `missing` onu bir kez basar.
- **Hiçbir eksik yoksa RabbitMQ'ya bağlanılmaz.** `nothing to queue`, çıkış 0.
- **ESI'nin 404 verdiği bir ID** worker'da Node'daki gibi uyarıyla geçilir;
  tabloya girmediği için sonraki kuyruk koşularında yeniden basılır. Bu
  bugün de olan bir durum, ayrıca çözülmez.
- **CLAUDE.md'ye bir satır:** "Root scan" / "Enrichment" ayrımına,
  `queue-types`'ın ikisinin arası olduğu (aday ESI'den, filtre
  veritabanından) not edilir.
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
