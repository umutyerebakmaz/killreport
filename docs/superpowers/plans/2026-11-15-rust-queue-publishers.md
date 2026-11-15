# Rust kuyruk yayıncıları (`queue-alliances`, `queue-corporations`) — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `backend/src/queues/queue-alliances.ts` ve `queue-corporations.ts`'in
Rust karşılıklarını, bastıkları mesaj Node'unkiyle birebir aynı olacak şekilde
yazmak.

**Mimari:** `backend-rs/queues/<ad>` altında iki ayrı bin crate. Paylaşılan
yayıncı parçası (`EntityMessage`, `publish_entities`) `mq`'da, `.env` + log
kurulumu `runner::init()`'te. Her yayıncı kendi bağlantısını açar, yalnızca
kendi kuyruğunu `declare_worker_queue` ile tanımlar, publisher confirm bekler.

**Teknoloji:** Rust (`rust-toolchain.toml`), tokio, lapin (confirm_select),
sqlx, serde/serde_json, chrono, tracing, wiremock.

**Spec:** `docs/superpowers/specs/2026-11-15-rust-queue-publishers-design.md`

## Genel kısıtlar

- Branch: `feat/rust-queue-publishers`. Commit mesajları İngilizce, Claude attribution satırı yok.
- Mesaj: `{"entityId":<id>,"queuedAt":"YYYY-MM-DDTHH:MM:SS.mmmZ","source":"<script adı>"}`; alan sırası bu; persistent (delivery mode 2); öncelik yok.
- `source` değerleri: `queue-alliances`, `queue-corporations`.
- Kuyruklar: `esi_alliance_info_queue`, `esi_corporation_info_queue`. Tanım yalnızca `mq::declare_worker_queue` ile.
- ESI yalnızca `esi::EsiClient` ile (`RateLimiter::from_env()`), `GET /alliances` (sonda `/` yok).
- Havuz `db::worker_pool`. Yeni `sqlx::query!` eklenirse `.sqlx/` `cargo sqlx prepare --workspace` ile yenilenir; tercihen runtime `sqlx::query_scalar` kullan, `.sqlx/`'e gerek kalmasın.
- Log metinleri kendi Node script'inden birebir (bkz. Task 4 ve 5); bitişteki komut `:rs` biçimi.
- Çıkış kodu: başarı 0, her hata 1 (`main` `anyhow::Result<()>` döner; hata log'lanır).
- Node script'lerine, `ecosystem.config.js`'e, `.env`'e dokunulmaz. Node tarafındaki tek değişiklik `backend/package.json`'a iki script satırı.
- Her task sonunda `cargo fmt --check` ve `cargo clippy --all-targets -- -D warnings` temiz.

## Review Focus

1. **Boş liste** (ESI `[]` döner ya da `corporations` tablosu boş): yayıncı hiç mesaj basmadan, hata vermeden `all 0 … queued` yazıp 0 ile çıkmalı. → Task 2'de `publishes_nothing_for_no_ids`.
2. **Broker bir mesajı nack'ler / bağlantı confirm'lerden önce kopar:** "queued successfully" yazılmamalı, çıkış 1. → Task 2'de `publish_entities` confirm sonucunu `Err`'e çevirir; Task 2 testi onaylanan sayıyı kontrol eder.
3. **Kuyruk Node tarafından zaten tanımlanmışken** Rust tanımı 406 vermemeli. → Mevcut `agrees_with_the_queue_the_node_workers_declared` (mq/tests/topology.rs) kapsıyor; Task 2'nin ignored testi aynı kuyruğa ikinci kez declare edip basar.
4. **Geçersiz ve geçerli karışık argümanlar** (`123 abc 456`): yalnızca 123 ve 456 kuyruğa girer. → Task 5'te `parse_ids` testleri.
5. **ESI 5xx / throttle** `/alliances`'ta: yayıncı yeniden denemez (Node da denemez), hatayı log'layıp 1 ile çıkar; hiçbir mesaj basılmaz. → Task 4'te ESI çağrısı bağlantı açılmadan önce yapılır; wiremock 500 testi `fetch_alliance_ids`'in `Err` döndüğünü doğrular.

---

### Task 1: `mq::EntityMessage`

**Files:**

- Create: `crates/mq/src/message.rs`
- Modify: `crates/mq/src/lib.rs`, `crates/mq/Cargo.toml` (chrono, serde, serde_json workspace bağımlılıkları)
- Test: `crates/mq/src/message.rs` içinde `#[cfg(test)]`, ve `crates/runner/src/message.rs` testlerine bir ek

**Interfaces:**

- Produces:
  - `pub struct EntityMessage { pub entity_id: i32, pub queued_at: String, pub source: &'static str }`, `#[derive(Serialize)]`, `#[serde(rename_all = "camelCase")]`.
  - `EntityMessage::new(entity_id: i32, source: &'static str) -> Self` — `queued_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)`.
  - `EntityMessage::at(entity_id, source, now: DateTime<Utc>) -> Self` — test için saat enjekte eder; `new` bunu çağırır.
  - `EntityMessage::to_body(&self) -> Vec<u8>` (`serde_json::to_vec`, unwrap: serileştirme başarısız olamaz).
  - `lib.rs`: `pub use message::EntityMessage;`

- [ ] **Step 1: Failing test** — `body_matches_the_node_publisher`:
  ```rust
  let now = Utc.with_ymd_and_hms(2026, 11, 15, 10, 0, 0).unwrap() + Duration::milliseconds(7);
  let body = EntityMessage::at(99000001, "queue-alliances", now).to_body();
  assert_eq!(std::str::from_utf8(&body).unwrap(),
      r#"{"entityId":99000001,"queuedAt":"2026-11-15T10:00:00.007Z","source":"queue-alliances"}"#);
  ```
  ve `whole_seconds_keep_three_digits`: saniyesi tam bir zaman `…T10:00:00.000Z` vermeli.
- [ ] **Step 2:** `cargo test -p mq message` → derleme hatası (tip yok).
- [ ] **Step 3:** `message.rs`'i yaz.
- [ ] **Step 4:** `cargo test -p mq message` → PASS.
- [ ] **Step 5: Runner tarafı testi** — `crates/runner/src/message.rs` testlerine `parses_what_mq_publishes`: `EntityQueueMessage::parse(&EntityMessage::new(98000001, "queue-corporations").to_body())` → `entity_id == 98000001`. `cargo test -p runner message` → PASS.
- [ ] **Step 6: Commit** — `feat(mq): the entity message the info queue publishers send`

### Task 2: `mq::publish_entities`

**Files:**

- Create: `crates/mq/src/publish.rs`
- Modify: `crates/mq/src/lib.rs`
- Test: `crates/mq/tests/publish.rs` (ignored, gerçek RabbitMQ; `tests/topology.rs`'in yardımcılarını ve başlık yorumunu örnek al)

**Interfaces:**

- Consumes: `EntityMessage` (Task 1), `declare_worker_queue`, `connect`.
- Produces:
  - `pub const BATCH_SIZE: usize = 100;`
  - `pub async fn publish_entities(channel: &Channel, queue: &str, source: &'static str, ids: &[i32], on_batch: impl Fn(usize, usize, usize)) -> anyhow::Result<u64>` — `on_batch(batch_no /*1'den*/, total_batches, len)`; dönüş değeri onaylanan mesaj sayısı. Log metni çağıranın (Task 4, 5).
  - `lib.rs`: `pub use publish::{publish_entities, BATCH_SIZE};`

Davranış:

- Önce `channel.confirm_select(ConfirmSelectOptions::default())`.
- `ids.chunks(BATCH_SIZE)`; her ID için `basic_publish("", queue, default, &EntityMessage::new(id, source).to_body(), BasicProperties::default().with_delivery_mode(2))`, dönen `PublisherConfirm`'ü bir `Vec`'te topla; her chunk sonunda `on_batch`.
- Hepsi basıldıktan sonra confirm'leri sırayla `await` et. `Confirmation::Nack(_)` görülürse `anyhow::bail!("broker refused message for {id}")`.

- [ ] **Step 1: Failing test (ignored)** — `publishes_every_id_persistently`: geçici bir kuyruk adı (`test_publish_<pid>`) için `declare_worker_queue`, `publish_entities(&ch, q, "queue-test", &[1,2,3], |_,_,_| {})` → `Ok(3)`; ardından `basic_get` ile üç mesaj: gövdeler sırasıyla `entityId` 1,2,3, `source` `"queue-test"`, `delivery_mode == Some(2)`, `priority == None`. Sonda kuyruğu sil.
- [ ] **Step 2: Failing test (ignored)** — `publishes_nothing_for_no_ids`: `&[]` → `Ok(0)`, kuyruk boş, `on_batch` hiç çağrılmadı.
- [ ] **Step 3: Failing test (ignored)** — `reports_batches_of_100`: 250 ID → `on_batch` çağrıları `[(1,3,100),(2,3,100),(3,3,50)]`.
- [ ] **Step 4:** `publish.rs`'i yaz.
- [ ] **Step 5:** `RABBITMQ_URL=amqp://guest:guest@localhost:5672 cargo test -p mq --test publish -- --ignored` → 3 PASS. Broker yoksa kullanıcıya söyle, "not verified yet" yaz.
- [ ] **Step 6:** `cargo test -p mq` (ignored'lar hariç) → PASS; clippy temiz.
- [ ] **Step 7: Commit** — `feat(mq): publish entity IDs with publisher confirms`

### Task 3: `runner::init()`

**Files:**

- Modify: `crates/runner/src/run.rs`, `crates/runner/src/lib.rs`

**Interfaces:**

- Produces: `pub fn init()` — `dotenvy::dotenv()` + mevcut `tracing_subscriber` kurulumu (aynı filtre, `with_target(false)`). `run()` ilk iş olarak `init()` çağırır. `lib.rs`: `pub use run::{init, run, Resources};`

- [ ] **Step 1:** Kodu `run()`'dan `init()`'e taşı; davranış değişmez.
- [ ] **Step 2:** `cargo test --workspace` → mevcut bütün testler PASS (yeni test yok; saf taşıma).
- [ ] **Step 3: Commit** — `refactor(runner): expose env and logging setup as init()`

### Task 4: `queue-alliances` crate

**Files:**

- Modify: `backend-rs/Cargo.toml` — `members = ["crates/*", "queues/*", "workers/*"]`
- Create: `queues/queue-alliances/Cargo.toml` (anyhow, esi, lapin, mq, runner, tokio, tracing; dev: wiremock, tokio test-util), `src/lib.rs`, `src/main.rs`
- Test: `queues/queue-alliances/tests/fetch.rs`

**Interfaces:**

- Consumes: `runner::init`, `mq::{connect, declare_worker_queue, publish_entities}`, `esi::{EsiClient, RateLimiter}`.
- Produces (`lib.rs`): `pub const QUEUE_NAME: &str = "esi_alliance_info_queue"; pub const SOURCE: &str = "queue-alliances";` ve `pub async fn fetch_alliance_ids(esi: &EsiClient) -> Result<Vec<i32>, esi::EsiError>` (`esi.get("/alliances")`).

`main.rs` sırası ve log metinleri (Node `queue-alliances.ts` ile birebir):

1. `init()`; `info!("fetching all alliance IDs from ESI...")`
2. `fetch_alliance_ids` → `info!("found {n} alliances")`, `info!("adding to queue: {QUEUE_NAME}")`
3. `connect(RABBITMQ_URL)`, `declare_worker_queue(&ch, QUEUE_NAME)`
4. `publish_entities(..., |b, t, len| debug!("queued batch {b}/{t} ({len} alliances)"))`
5. `info!("all {n} alliances queued successfully!")`, `info!("now run the worker: yarn worker:info:alliances:rs")`
6. kanal ve bağlantıyı kapat.
   Her hata: `error!("failed to queue alliances: {e:#}")`, `std::process::exit(1)`.

- [ ] **Step 1: Failing tests** (`tests/fetch.rs`, wiremock + `EsiClient::with_base_url`; limiter'ı mevcut worker/esi testlerindeki gibi Redis'siz yerel kur):
  - `fetches_the_alliance_list`: `GET /alliances` → `[99000001, 99000002]` → `Ok(vec![99000001, 99000002])`; mock path tam `/alliances` (sonda `/` yok) ile eşleşmeli.
  - `server_error_is_an_error`: 500 → `Err(_)`.
- [ ] **Step 2:** `cargo test -p queue-alliances` → derleme hatası.
- [ ] **Step 3:** `lib.rs` ve `main.rs`'i yaz.
- [ ] **Step 4:** `cargo test -p queue-alliances` → PASS; clippy temiz.
- [ ] **Step 5:** `backend/package.json`'a `"queue:alliances:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-alliances"` (`queue:alliances`'ın hemen altına). `npx prettier --check backend/package.json`.
- [ ] **Step 6: Commit** — `feat(backend-rs): queue-alliances publisher`

### Task 5: `queue-corporations` crate

**Files:**

- Create: `queues/queue-corporations/Cargo.toml` (anyhow, db, lapin, mq, runner, sqlx, tokio, tracing; dev: sqlx `migrate` feature, tokio test-util), `src/lib.rs`, `src/main.rs`
- Test: `queues/queue-corporations/tests/ids.rs`, `tests/fixtures/corporations.sql` (`workers/worker-info-corporations/tests/fixtures/corporations.sql`'deki tabloyu kopyala, birkaç satır ekle, ID'ler sırasız)

**Interfaces:**

- Produces (`lib.rs`): `QUEUE_NAME = "esi_corporation_info_queue"`, `SOURCE = "queue-corporations"`,
  `pub fn parse_ids(args: &[String]) -> Vec<i32>` (her biri `str::parse::<i32>`, başarısız olan atlanır),
  `pub async fn all_corporation_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>>` (`sqlx::query_scalar("SELECT id FROM corporations ORDER BY id")`, runtime sorgu).

`main.rs` sırası ve log metinleri (Node `queue-corporations.ts` ile birebir):

- Argüman varsa: `parse_ids`; boşsa `error!("invalid corporation IDs provided")`, exit 1; değilse `info!("queueing {n} specific corporation(s): {ids joined ", "}")`. Veritabanına bağlanılmaz.
- Argüman yoksa: `info!("fetching all corporation IDs from database...")`, `db::worker_pool(DATABASE_URL)`, `all_corporation_ids`, `info!("found {n} corporations in database")`, havuzu kapat.
- `info!("adding to queue: {QUEUE_NAME}")`; connect + declare.
- `publish_entities(..., on_batch)` — on_batch yalnızca toplam ID > 100 iken `debug!("queued batch {b}/{t} ({len} corporations)")`.
- `info!("✅ all {n} corporation(s) queued successfully!")`, `info!("now run the worker: yarn worker:info:corporations:rs")`.
- Hata: `error!("failed to queue corporations: {e:#}")`, exit 1.

- [ ] **Step 1: Failing tests**:
  - `parse_ids_keeps_valid_numbers`: `["123","abc","456"]` → `[123, 456]`.
  - `parse_ids_rejects_partial_numbers`: `["12abc"]` → `[]`.
  - `#[sqlx::test(migrations = false, fixtures("corporations"))] all_ids_in_order`: fixture'daki ID'ler artan sırada döner.
  - `#[sqlx::test(migrations = false)]` + yalnızca tabloyu oluşturan bir fixture ile `empty_table_is_empty`: `Ok(vec![])`. (Fixture'ı `corporations_empty.sql` olarak ayır ya da tabloyu testte `CREATE TABLE` ile kur.)
- [ ] **Step 2:** `cargo test -p queue-corporations` → derleme hatası.
- [ ] **Step 3:** `lib.rs` ve `main.rs`'i yaz.
- [ ] **Step 4:** `cargo test -p queue-corporations` → PASS (sqlx testleri `DATABASE_URL` sunucusunu ister; yoksa "not verified yet"). `SQLX_OFFLINE=true cargo build -p queue-corporations` → derlenir (runtime sorgu, `.sqlx/` değişmez).
- [ ] **Step 5:** `backend/package.json`'a `"queue:corporations:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-corporations"` (`queue:corporations`'ın altına). `npx prettier --check backend/package.json`.
- [ ] **Step 6: Commit** — `feat(backend-rs): queue-corporations publisher`

### Task 6: Yerel karşılaştırma ve tam doğrulama

Kod yok; spec'teki "Doğrulama" bölümünün elle yapılan kısmı. Ana oturum yapar, kullanıcıya rapor eder.

- [ ] **Step 1:** `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` (workspace kökünde) → hepsi temiz.
- [ ] **Step 2: Alliances.** İlgili worker'lar durdurulmuşken (Node ve Rust), `backend/` içinde `yarn queue:alliances`, kuyruk derinliğini not et (`workerStatus` sorgusu ya da yönetim arayüzü); sonra `yarn queue:alliances:rs`, derinlik tam iki katı olmalı. Yönetim arayüzünden (Get messages, requeue açık) birer Node ve Rust mesajı: yalnızca `queuedAt` farklı, properties'te ikisinde de `delivery_mode: 2`. Ardından `yarn worker:info:alliances:rs` kuyruğu boşaltır, `final: … 0 errors`.
- [ ] **Step 3: Corporations.** Aynısı, birkaç ID argümanıyla: `yarn queue:corporations <id1> <id2> <id3>` ve `yarn queue:corporations:rs <id1> <id2> <id3>`; sonra `yarn worker:info:corporations:rs`.
- [ ] **Step 4:** Sonuçları (sayılar, örnek mesajlar) kullanıcıya bildir; çalıştırılamayan adım varsa "not verified yet" de.
