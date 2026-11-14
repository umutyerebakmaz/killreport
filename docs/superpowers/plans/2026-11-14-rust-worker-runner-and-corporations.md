# Rust worker çalıştırıcısı ve `worker-info-corporations` — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `worker-info-alliances/src/main.rs`'teki ortak döngüyü
`crates/runner` kütüphanesine taşımak, alliance worker'ını davranışı
değişmeden onun üzerine kurmak ve ikinci worker'ı (`worker-info-corporations`)
aynı çalıştırıcıyla yazmak.

**Mimari:** `runner` bir kütüphane: `Worker` trait'i + `run()`. Her worker
ayrı bin crate, ayrı binary, ayrı süreç olarak kalır; `main.rs` yalnızca
`runner::run(...)` çağırır. Mesaj başına işleme (`process_one`) `mq::Settle`
üzerinden yazılır ki RabbitMQ olmadan test edilebilsin.

**Teknoloji:** Rust 1.97.0 (`rust-toolchain.toml`), tokio, lapin, sqlx
(`query!`, `SQLX_OFFLINE`), reqwest (rustls), serde, chrono, tracing.
Testler: `#[tokio::test(start_paused = true)]`, `sqlx::test`.

**Spec:** `docs/superpowers/specs/2026-11-14-rust-worker-runner-and-corporations-design.md`

## Genel kısıtlar

- Branch: `feat/backend-rs-worker-runner`. Commit mesajları İngilizce, Claude attribution satırı yok.
- Çalışma anında paylaşılan hiçbir şey yok: her worker kendi bağlantısını, kanalını ve havuzunu `run()` içinde kendisi açar. Tek süreçte birden çok worker yok.
- `runner` hangi worker'ı çalıştırdığını bilmez: kuyruk adına ya da worker türüne göre dal yok.
- Kuyruk tanımı yalnızca `mq::declare_worker_queue` ile (`x-max-priority: 10`). ESI yalnızca `esi::EsiClient` ile; kendi retry'ı, sleep'i ya da rate limit'i yok.
- Havuz `db::worker_pool` (en fazla 2 bağlantı).
- Alliance worker'ının log satırları, sayaçları ve kapanışı bugünküyle aynı; mevcut testlerinin bütün assertion'ları korunur.
- Node worker'larına, `.env`'e, Prisma şemasına, migration'lara, `ecosystem.config.js`'e dokunulmaz. Node tarafındaki tek değişiklik `backend/package.json`'a bir script satırı.
- Yeni `sqlx::query!` eklendiğinde `.sqlx/` `cargo sqlx prepare --workspace` ile yenilenip commit edilir; CI `SQLX_OFFLINE=true` ile derler.
- Her görevin sonunda (`backend-rs/` içinde): `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`. Düzenlenen her `.md` / `.json` için `npx prettier --check <dosya>`.
- Hiçbir adımda satır silinmez (`CLAUDE.md`, _Never lose rows_).

## İnceleme odağı

1. **Parse edilemeyen mesaj.** Gövde JSON değilse ya da `entityId` yoksa `handle` çağrılmaz, hata sayacı artar ve mesaj ortak hata yoluna gider (ilk denemede `nack(false)`); worker çökmez. Test: Task 1.
2. **Kapanışta eldeki mesajlar.** Ctrl+C / SIGTERM sonrası yeni mesaj alınmaz, işlenmekte olanlar ack'lenir, `worker stopped` basılır, havuz kapanır. Test: Task 2, Adım 5 (elle).
3. **`shares` 2³¹'den büyük.** Gerçek corporation'larda `shares` milyarları aşar; `i32` ile parse hata verir ve her mesaj parking'e düşer. Test: Task 3.
4. **`date_founded` yok.** NPC corporation'larında ESI `date_founded` göndermeyebilir; `NULL` yazılmalı, parse hatası olmamalı. Test: Task 3.
5. **Update'te korunan kolonlar.** `date_founded`, `creator_id`, `home_station_id`, `shares` update'te eski değerini korur (Node eşitliği). Yanlışlıkla `SET`'e eklenirse CSV karşılaştırması bunu yakalamaz (ilk koşunun değeri zaten aynı). Test: Task 3.

---

### Task 0: Ön koşullar

**Dosyalar:** yok.

- [ ] **Adım 1:** `cargo sqlx --version` çalışıyor. Çalışmıyorsa: `cargo install sqlx-cli --no-default-features --features rustls,postgres`.
- [ ] **Adım 2:** Yerel PostgreSQL ve RabbitMQ açık, `backend/.env`'deki `DATABASE_URL` / `RABBITMQ_URL` onları gösteriyor. Göstermiyorsa dur ve kullanıcıya söyle; `.env` düzenlenmez.
- [ ] **Adım 3:** `cd backend-rs && cargo test` temiz geçiyor: başlangıç noktası yeşil.

### Task 1: `runner` crate'i, mesaj başına işleme

**Dosyalar:**

- Oluştur: `backend-rs/crates/runner/Cargo.toml`, `src/lib.rs`, `src/message.rs`, `src/totals.rs`, `src/process.rs`
- Taşı: `backend-rs/workers/worker-info-alliances/src/message.rs` → `backend-rs/crates/runner/src/message.rs` (içerik aynı, doc yorumundaki "`queue-alliances.ts` publishes" ifadesi "every info queue publisher" olur)
- Test: `backend-rs/crates/runner/tests/message.rs`, `backend-rs/crates/runner/tests/process.rs`, `totals.rs` içinde `#[cfg(test)]`
- Değiştir: `backend-rs/Cargo.toml` (`[workspace.dependencies]`'e `runner = { path = "crates/runner" }`)

**Arayüzler:**

- Üretir:
  - `pub use message::EntityQueueMessage;` (`entity_id: i32`, `parse(&[u8]) -> Result<Self, serde_json::Error>`)
  - `pub struct Processed { pub inserted: bool, pub detail: String }`
  - `pub trait Worker: Send + Sync + 'static` — `const QUEUE_NAME: &'static str; const PREFETCH_COUNT: u16; const CONSUMER_TAG: &'static str; const STARTED: &'static str; const WAITING_FOR: &'static str; const ENTITY: &'static str; fn handle(&self, id: i32) -> impl Future<Output = anyhow::Result<Processed>> + Send;`
  - `pub fn success_line(n: u64, processed: &Processed) -> String`
  - `pub struct Totals` — `pub fn new() -> Self`, `pub fn processed() / created() / updated() / errors() -> u64`, `pub(crate) fn summary_due(&self) -> bool`
  - `pub async fn process_one<W: Worker>(worker: &W, settle: &impl mq::Settle, totals: &Totals)`
- Tüketir: `mq::{Settle, WorkerLog, handle_worker_error}`.

- [ ] **Adım 1: Mesaj testlerini taşı.** `worker-info-alliances/tests/parse.rs`'teki `reads_the_entity_id_and_ignores_the_other_fields` ve `a_body_without_a_numeric_entity_id_does_not_parse` `crates/runner/tests/message.rs`'e aynen taşınır (`use runner::EntityQueueMessage;`). Kaynak dosyadan silinir; ESI vakaları orada kalır.
- [ ] **Adım 2: `success_line` testleri** (`tests/process.rs`):

```rust
#[test]
fn success_line_keeps_each_workers_own_shape() {
    let alliance = Processed { inserted: true, detail: " Foo [FOO] ID:99000001".into() };
    assert_eq!(success_line(12, &alliance), "  ✅ [12] Foo [FOO] ID:99000001 (created)");
    let corp = Processed { inserted: false, detail: "[98000001] Foo [FOO]".into() };
    assert_eq!(success_line(12, &corp), "  ✅ [12][98000001] Foo [FOO] (updated)");
}
```

- [ ] **Adım 3: `process_one` testleri** (`tests/process.rs`). Test içinde `Settle`'ı uygulayan küçük bir `Fake { body, headers: None, calls: Mutex<Vec<Call>> }` (`mq/tests/failure.rs:28-60`'taki gibi; `Call::{Ack, Nack { requeue }, Park}`) ve `handle`'ı sabit bir sonuç döndüren, çağrıldığı ID'leri kaydeden bir `FakeWorker`. Vakalar:
  - `a_new_row_is_acked_and_counted_as_created`: gövde `{"entityId":1}`, `handle` → `Ok(Processed { inserted: true, .. })` ⇒ `calls == [Ack]`, `processed == 1`, `created == 1`, `updated == 0`, `errors == 0`, `handle` 1 ile çağrıldı.
  - `an_existing_row_is_counted_as_updated`: `inserted: false` ⇒ `[Ack]`, `updated == 1`.
  - `a_failed_handle_goes_down_the_shared_failure_path`: `handle` → `Err(anyhow!("boom"))` ⇒ `calls == [Nack { requeue: false }]`, `errors == 1`, `processed == 1`.
  - `an_unparseable_body_never_reaches_handle`: gövde `b"not json"` ⇒ `handle` hiç çağrılmadı, `calls == [Nack { requeue: false }]`, `errors == 1`.
  - `a_404_is_acked_and_counted_as_an_error`: `Err(anyhow!("ESI request failed: 404 Not Found"))` ⇒ `[Ack]`, `errors == 1` (Node'da da 404 hata sayacını artırır, `worker-info-corporations.ts:154-156`).
- [ ] **Adım 4: Testleri çalıştır, derlenmediğini gör.** `cargo test -p runner` → `runner` crate'i yok / semboller tanımsız.
- [ ] **Adım 5: Uygula.** `lib.rs`: `Processed`, `Worker`, `success_line`, modüllerin `pub use`'u. `process.rs`: `process_one` bugünkü `main.rs:189-240`'deki `Worker::process`'in gövdesi; tek fark ESI + upsert yerine `worker.handle(id)`, bağlam `format!("{} {id}", W::ENTITY)` ya da `"unparseable message"`, `WorkerLog` uygulaması `main.rs:59-68`'daki `AllianceLog`'un aynısı (ad: `ContextLog`). Başarı satırı `info!("{}", success_line(n, &p))`. `totals.rs`: `main.rs:37-56`'teki `Totals` + `report_when_drained`'in koşulu `summary_due` olarak (`last_message` 5 s'den eski **ve** `processed > 0`).
- [ ] **Adım 6: `summary_due` birim testi** (`totals.rs`, `#[tokio::test(start_paused = true)]`): yeni `Totals` → `false`; bir mesaj sayılıp 4 s ilerletilince `false`; 6 s'de `true`; hiç mesaj yokken 10 s'de `false`.
- [ ] **Adım 7: `cargo test -p runner` geçer;** fmt ve clippy temiz.
- [ ] **Adım 8: Commit.** `feat(backend-rs): add the runner crate with per-message processing`

### Task 2: `run()` ve alliance worker'ının taşınması

**Dosyalar:**

- Oluştur: `backend-rs/crates/runner/src/run.rs`, `backend-rs/crates/runner/src/shutdown.rs`
- Değiştir: `backend-rs/workers/worker-info-alliances/src/main.rs` (baştan yazılır), `src/lib.rs` (`pub mod message;` çıkar), `Cargo.toml`
- Sil: `backend-rs/workers/worker-info-alliances/src/message.rs` (Task 1'de taşındı)

**Arayüzler:**

- Üretir: `pub struct Resources { pub pool: sqlx::PgPool, pub esi: esi::EsiClient }`, `pub async fn run<W: Worker>(build: impl FnOnce(Resources) -> W) -> anyhow::Result<()>`.
- Tüketir: Task 1'in `Worker`, `Totals`, `process_one`, `success_line`'ı.

- [ ] **Adım 1: `shutdown.rs`.** `main.rs:269-289`'daki `shutdown_signal()` aynen (`pub(crate) async fn shutdown_signal()`).
- [ ] **Adım 2: `run.rs`.** `main.rs:76-187`'in ve `report_when_drained`'in (`main.rs:244-267`) taşınmış hali; sabitler `W::QUEUE_NAME`, `W::PREFETCH_COUNT`, `W::CONSUMER_TAG`'den. Log metinleri: ilk satır `W::STARTED`, `"📦 queue: {}"`, `"⚡ prefetch: {} concurrent\n"`, bağlantıda `"⏳ waiting for {}...\n"` (`W::WAITING_FOR`); geri kalan her satır karakteri karakterine bugünkü gibi. `RECONNECT_DELAY` ve `QUIET` 5 s, `run.rs`'te sabit.
- [ ] **Adım 3: Alliance `main.rs`.** `struct AllianceWorker { pool: PgPool, esi: EsiClient }`, `impl runner::Worker`: `QUEUE_NAME = "esi_alliance_info_queue"`, `PREFETCH_COUNT = 3`, `CONSUMER_TAG = "worker-info-alliances-rs"`, `STARTED = "🤝 alliance info worker started"`, `WAITING_FOR = "alliances"`, `ENTITY = "alliance"`. `handle`: `self.esi.get::<AllianceInfo>(&format!("/alliances/{id}"))` → `upsert_alliance` → `Processed { inserted, detail: format!(" {} [{}] ID:{id}", info.name, info.ticker) }`. `main`: `runner::run(|r| AllianceWorker { pool: r.pool, esi: r.esi }).await`. Dosyanın başındaki doc yorumu korunur. `Cargo.toml`'dan artık kullanılmayan bağımlılıklar (`dotenvy`, `futures-util`, `lapin`, `tracing-subscriber`, `mq`) çıkar; `runner` eklenir.
- [ ] **Adım 4: `cargo test` (bütün workspace) geçer.** Alliance'ın `tests/upsert.rs` ve kalan `tests/parse.rs` vakaları değişmeden geçer.
- [ ] **Adım 5: Yerel koşu, elle.** `backend/` içinden `yarn queue:alliances`, sonra `yarn worker:info:alliances:rs`. Beklenen: başlangıç satırları, `  ✅ [n] <name> [<ticker>] ID:<id> (updated|created)` satırları, 5 s sessizlikten sonra `✅ queue completed!` + `📊 final: ... 0 errors`. İşlerken Ctrl+C: `⚠️  shutting down...`, `worker stopped`, süreç çıkar. Çıktının ilk ~20 satırını ve özet satırını not et; Task 5'te sonuçlara girer.
- [ ] **Adım 6: Satır sayısı.** `wc -l workers/worker-info-alliances/src/*.rs crates/runner/src/*.rs`; `main.rs` ~20 satır civarında olmalı. Not et.
- [ ] **Adım 7: Commit.** `refactor(backend-rs): run the alliance info worker on the shared runner`

### Task 3: `worker-info-corporations`, saf parçalar ve upsert

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-info-corporations/Cargo.toml` (alliance'ınkiyle aynı yapı, `[dev-dependencies]` dahil), `src/lib.rs` (`pub mod corporation;`), `src/corporation.rs`
- Test: `tests/parse.rs`, `tests/upsert.rs`, `tests/fixtures/corporations.sql`
- Değiştir: `backend-rs/.sqlx/` (yeni sorgu dosyası)

**Arayüzler:**

- Üretir: `pub struct CorporationInfo` (alanlar ve tipler spec'te, _`worker-info-corporations`_; `#[derive(Debug, Clone, Deserialize, PartialEq)]`, `tax_rate: f64` yüzünden `Eq` yok), `pub async fn upsert_corporation(pool: &PgPool, id: i32, info: &CorporationInfo) -> Result<bool, sqlx::Error>` (`true` = yeni satır).

- [ ] **Adım 1: Fixture.** `tests/fixtures/corporations.sql`, alliance fixture'ının başlığındaki komutla (`--table=corporations`) üretilir, başlık yorumu aynı biçimde. Task 0'daki yerel veritabanı bütün migration'ları uygulamış olmalı.
- [ ] **Adım 2: Parse testleri** (`tests/parse.rs`), alliance'taki `esi(extra)` yardımcısı biçiminde, zorunlu alanlar `name, ticker, member_count, ceo_id, creator_id, tax_rate`:
  - `only_the_required_fields_parse_with_every_optional_as_none`: yedi isteğe bağlı alanın hepsi `None`.
  - `every_optional_field_is_read`: hepsi verilmiş, değerleri eşit.
  - `shares_beyond_i32_is_read`: `"shares":5000000000` → `Some(5_000_000_000)`.
  - `date_founded_reads_with_and_without_milliseconds`: alliance'taki vakanın aynısı, `Option` içinde.
  - `unknown_fields_are_ignored`: `"war_eligible":true` eklenince parse başarılı.
- [ ] **Adım 3: Upsert testleri** (`tests/upsert.rs`, `#[sqlx::test(migrations = false, fixtures("corporations"))]`, alliance'ınki gibi `SELECT *` ile bir `Row` struct'ı):
  - `a_new_corporation_is_inserted`: dönüş `true`; 14 kolonun hepsi verilen değerde; `created_at` ve `updated_at` dolu.
  - `an_existing_corporation_is_updated`: ikinci çağrı `name`, `ticker`, `member_count`, `ceo_id`, `alliance_id`, `faction_id`, `tax_rate`, `description`, `url` değiştirilmiş bilgiyle ⇒ dönüş `false`, dokuz kolon yeni değerde, `updated_at` ilkinden büyük (arada `tokio::time::sleep(10ms)`).
  - `columns_written_only_on_insert_keep_their_value`: ikinci çağrıda `date_founded`, `creator_id`, `home_station_id`, `shares` farklı ⇒ dördü de ilk değerinde; `created_at` değişmedi.
  - `missing_optional_fields_clear_the_old_value`: ilk çağrıda `alliance_id`, `faction_id`, `description`, `url` dolu; ikincide `None` ⇒ dördü de `NULL`.
  - `a_missing_date_founded_is_null`: insert'te `date_founded: None` ⇒ kolon `NULL`.
- [ ] **Adım 4: Çalıştır, derlenmediğini gör.** `cargo test -p worker-info-corporations`.
- [ ] **Adım 5: Uygula.** `corporation.rs`: `CorporationInfo` ve `upsert_corporation`; SQL spec'teki metnin aynısı (`sqlx::query_scalar!`, `RETURNING (xmax = 0) AS "inserted!"`), `date_founded` `.map(|d| d.naive_utc())` ile bağlanır. Doc yorumu alliance'taki gibi Node'dan farkları ve `home_station_id` / `shares`'ın neden update'e girmediğini (`worker-info-corporations.ts:123-136`, Node eşitliği) söyler.
- [ ] **Adım 6: `.sqlx/` yenile.** `backend-rs/` içinde, `DATABASE_URL` yerel veritabanını gösterirken `cargo sqlx prepare --workspace`; sonra `SQLX_OFFLINE=true cargo build --workspace` başarılı.
- [ ] **Adım 7: `cargo test` geçer;** fmt, clippy temiz.
- [ ] **Adım 8: Commit.** `feat(backend-rs): add the corporation info parse and upsert`

### Task 4: `worker-info-corporations` binary'si

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-info-corporations/src/main.rs`
- Değiştir: `backend/package.json` (bir satır)

**Arayüzler:**

- Tüketir: Task 2'nin `runner::{run, Worker, Processed}`'ı, Task 3'ün `CorporationInfo`, `upsert_corporation`'ı.

- [ ] **Adım 1: `main.rs`.** Alliance'taki biçimde `CorporationWorker`: `QUEUE_NAME = "esi_corporation_info_queue"`, `PREFETCH_COUNT = 25`, `CONSUMER_TAG = "worker-info-corporations-rs"`, `STARTED = "🏢 corporation info worker started"`, `WAITING_FOR = "corporations"`, `ENTITY = "corporation"`. ESI yolu `format!("/corporations/{id}/")` (Node'daki gibi sonda `/`, `corporation.service.ts:20-22`). `detail = format!("[{id}] {} [{}]", info.name, info.ticker)`. Doc yorumu alliance `main.rs`'tekinin karşılığı, Node dosyasına işaret eder.
- [ ] **Adım 2: Script.** `backend/package.json`'da `worker:info:corporations` satırının altına: `"worker:info:corporations:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-info-corporations"`. `npx prettier --check backend/package.json`.
- [ ] **Adım 3: Duman testi.** `backend/` içinden `yarn worker:info:corporations:rs`; başlangıç satırları ve `✅ connected to RabbitMQ`, `⏳ waiting for corporations...` görünür; Ctrl+C ile temiz çıkar.
- [ ] **Adım 4: `cargo test`, fmt, clippy temiz.**
- [ ] **Adım 5: Commit.** `feat(backend-rs): add the corporation info worker`

### Task 5: Node ile eşitlik koşusu, kural ve sonuçlar

**Dosyalar:**

- Değiştir: `CLAUDE.md:439`, `docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md` (Tasarım kararları madde 1'in altına not), `docs/superpowers/specs/2026-11-14-rust-worker-runner-and-corporations-design.md` (sonuna _Sonuçlar_)

- [ ] **Adım 1: ID kümesi.** Yerel `corporations` tablosundan 500 ID: `SELECT id FROM corporations ORDER BY id LIMIT 500` (`psql`). Tek seferlik yayın, commit edilmez: her ID için `{"entityId": <id>, "source": "parity-check"}` gövdesi `esi_corporation_info_queue`'ya, `persistent`. Yöntem builder'ın (spec, _Builder'a kalanlar_); kalıcı script eklenmez.
- [ ] **Adım 2: Node→Rust çifti.** Kümeyi yayınla, `yarn worker:info:corporations` kuyruğu bitirsin (özet satırı), durdur; CSV al:

```sql
\copy (SELECT id, name, ticker, member_count, ceo_id, creator_id, date_founded,
       description, alliance_id, faction_id, home_station_id, shares, tax_rate, url
       FROM corporations WHERE id IN (<küme>) ORDER BY id)
  TO 'corporations-node-1.csv' WITH CSV HEADER
```

Aynı kümeyi hemen tekrar yayınla, `yarn worker:info:corporations:rs` ile işle, `corporations-rs-1.csv` al. Dosyalar repo dışında bir ölçüm klasöründe.

- [ ] **Adım 3: Rust→Node çifti.** Aynısı ters sırayla: `corporations-rs-2.csv`, `corporations-node-2.csv`.
- [ ] **Adım 4: Karşılaştır.** `git diff --no-index` her çiftte boş. Fark varsa: o ID'yi tekrar kuyruğa koyup Rust ile işlet; yeni değer ESI'deki gerçek bir değişiklikse not et, değilse dur ve hatayı ara (spec, _Doğrulama_ 3). İki worker da her koşuda `0 errors`.
- [ ] **Adım 5: Kural.** `CLAUDE.md:439`'daki cümle spec'teki _Kural değişikliği_ metniyle değiştirilir. Spike spec'inde madde 1'in altına: `**Güncelleme (2026-11-14):** Paylaşılan çalıştırıcı artık bir kütüphane olarak var; süreç izolasyonu korunuyor. Bkz. 2026-11-14-rust-worker-runner-and-corporations-design.md.`
- [ ] **Adım 6: Sonuçlar.** Tasarım dokümanının sonuna `## Sonuçlar (2026-11-..)`: satır sayıları (`crates/runner` kaynak/test, `worker-info-alliances` öncesi/sonrası, `worker-info-corporations` kaynak/test; Node karşılığı 216 satır), Task 2 Adım 5'teki alliance koşusu, iki koşu çiftinin özet satırları ve diff sonucu, bulunan farklar.
- [ ] **Adım 7: Format.** `npx prettier --check CLAUDE.md docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md docs/superpowers/specs/2026-11-14-rust-worker-runner-and-corporations-design.md`; markdown linkleri `CLAUDE.md`'deki `grep` komutuyla kontrol.
- [ ] **Adım 8: Commit.** `docs: record the shared runner rule and the corporation worker results`
