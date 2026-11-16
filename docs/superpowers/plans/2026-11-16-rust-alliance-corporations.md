# Rust alliance–corporation worker'ı ve kuyruğu — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `runner`'ı kuyruğa basan worker'ları da taşıyacak şekilde
genişletmek, sonra `worker-alliance-corporations.ts` ve
`queue-alliance-corporations.ts`'in Rust karşılıklarını yazmak.

**Mimari:** `mq` çalışma anında üretilen `source`'u ve isteğe bağlı AMQP
önceliğini öğrenir. `runner`'da `Worker::handle` bir `Context` alır;
içindeki `Publisher`, bağlantı başına açılan, confirm modundaki ayrı bir
kanaldır. `Processed`'in sonucu `Outcome` enum'u olur
(`Created | Updated | Queued(n)`). Yeni worker ESI'den corporation listesini
çeker ve yayıncıyla basar; kuyruk alliance listesini ESI'den alır.

**Teknoloji:** Rust (`rust-toolchain.toml`), tokio, lapin, reqwest, sqlx
(postgres), serde, tracing, wiremock, futures-util.

**Spec:** `docs/superpowers/specs/2026-11-16-rust-alliance-corporations-design.md`

## Genel kısıtlar

- Branch `feat/rust-alliance-corporations`, ana checkout'ta. Spec ve bu plan ilk commit'te.
- Commit mesajları İngilizce, Claude attribution satırı yok.
- Testler ve `cargo sqlx prepare` için `DATABASE_URL`, `backend-rs/` içinden:
  `export DATABASE_URL=$(grep -m1 '^DATABASE_URL' ../backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')`
- Kuyruklar: giriş `esi_alliance_corporations_queue`, çıkış `esi_corporation_info_queue`.
- Corporation mesajı: `source` `alliance_<allianceId>`, öncelik **3**, kalıcı.
- Alliance mesajı (kuyruk script'i): `source` `esi_alliance_corporations_queue`, öncelik **5**, kalıcı.
- ESI yolları: `/alliances/{id}/corporations` ve `/alliances`. İkisinin de sonunda `/` **yok**.
- Consumer tag `worker-alliance-corporations-rs`, başlangıç satırı `🤝 alliance corporation worker started`.
- Mesaj gövdesi her yerde `{"entityId":…,"queuedAt":"…","source":"…"}`, alanlar bu sırada. Öncelik verilmeyen yayında AMQP `priority` özelliği hiç yazılmaz.
- Bilgi worker'larının (`worker-info-*`) log satırları ve davranışı değişmez; mevcut dört Rust yayıncısının bastığı mesajlar değişmez.
- Node dosyalarına, `deploy/`'a ve `.env`'e dokunulmaz.
- Yeni `query!` eklendiğinde `.sqlx/`, `backend-rs/` içinde `cargo sqlx prepare --workspace` ile yenilenip commit edilir. CI `SQLX_OFFLINE=true` ile derler.
- Her task sonunda `cargo fmt --check` ve `cargo clippy --workspace --all-targets -- -D warnings` temiz.

## Review Focus

1. **Çıkış kuyruğu hiç declare edilmemişse** broker yayını düşürür ama `Ack` döner. Worker bağlanırken çıkış kuyruğunu da declare etmeli. → Task 2: `a_fan_out_worker_declares_its_output_queue`.
2. **Yayın kanalı mesaj işlenirken kapanırsa** mesaj settle edilmemeli (deneme harcanmaz), runner yeniden bağlanmalı. → Task 2: `a_lost_publisher_leaves_the_message_unsettled`.
3. **Yayın hata verirse** (broker nack, kanal hatası) alliance mesajı ack'lenmemeli, ortak hata yoluna gitmeli. → Task 3: `a_failed_publish_is_an_error`.
4. **Alliance tabloda yoksa** log satırı `Unknown` / `???` ile çıkmalı, mesaj yine işlenmeli. → Task 3: `an_unknown_alliance_is_labelled_unknown`.
5. **Boş corporation listesi:** hiç yayın yok, mesaj ack'lenir, `⚠️` satırı. → Task 2: `a_queued_nothing_line_warns`, Task 3: `an_empty_list_publishes_nothing`.

---

### Task 0: Branch ve dokümanlar

- [ ] **Step 1:** `git checkout -b feat/rust-alliance-corporations` (main'den, temiz ağaç).
- [ ] **Step 2:** Commit:

```bash
git add docs/superpowers/specs/2026-11-16-rust-alliance-corporations-design.md docs/superpowers/plans/2026-11-16-rust-alliance-corporations.md
git commit -m "docs: spec and plan for the Rust alliance-corporations worker and queue"
```

---

### Task 1: mq — üretilen `source` ve öncelik

**Files:**

- Modify: `backend-rs/crates/mq/src/message.rs`
- Modify: `backend-rs/crates/mq/src/publish.rs`
- Modify: `backend-rs/crates/mq/src/lib.rs`
- Modify (çağıranlar, `priority: None`): `backend-rs/queues/queue-alliances/src/main.rs`, `queue-corporations/src/main.rs`, `queue-characters/src/main.rs`, `queue-types/src/main.rs`
- Test: `backend-rs/crates/mq/tests/message.rs` (yoksa oluştur; varsa mevcut testlere ekle), `backend-rs/crates/mq/tests/publish.rs`

**Interfaces:**

- Produces:
  - `EntityMessage { pub entity_id: i32, pub queued_at: String, pub source: Cow<'static, str> }`
  - `EntityMessage::new(entity_id: i32, source: impl Into<Cow<'static, str>>) -> Self`, `EntityMessage::at(entity_id, source: impl Into<Cow<'static, str>>, now: DateTime<Utc>) -> Self`, `to_body(&self) -> Vec<u8>` (değişmez)
  - `pub fn message_properties(priority: Option<u8>) -> BasicProperties`: delivery mode 2, boş headers tablosu, `priority` yalnızca `Some` ise.
  - `pub async fn publish_entities(channel: &Channel, queue: &str, source: &'static str, ids: &[i32], priority: Option<u8>, on_batch: impl Fn(usize, usize, usize)) -> anyhow::Result<u64>`: yeni parametre `priority`, gerisi aynı.
  - `pub async fn publish_messages(channel: &Channel, queue: &str, messages: &[EntityMessage], priority: Option<u8>) -> anyhow::Result<u64>`: kanal **zaten confirm modunda** olmalı (`confirm_select` çağırmaz). Hepsini basar, hepsinin onayını bekler, `Nack` hata. Döndürdüğü sayı onaylanan mesaj sayısı.

- [ ] **Step 1: Failing testler**

```rust
#[test]
fn a_runtime_source_serializes_like_a_static_one() {
    let now = Utc.with_ymd_and_hms(2026, 11, 16, 10, 0, 0).unwrap();
    let body = EntityMessage::at(98000001, format!("alliance_{}", 99000001), now).to_body();
    assert_eq!(
        String::from_utf8(body).unwrap(),
        r#"{"entityId":98000001,"queuedAt":"2026-11-16T10:00:00.000Z","source":"alliance_99000001"}"#
    );
}

#[test]
fn priority_is_set_only_when_given() {
    assert_eq!(*message_properties(Some(3)).priority(), Some(3));
    assert_eq!(*message_properties(None).priority(), None);
    assert_eq!(*message_properties(None).delivery_mode(), Some(2));
    assert_eq!(*message_properties(None).headers(), Some(FieldTable::default()));
}
```

Mevcut `EntityMessage` testleri (sabit `source` ile bayt bayt JSON) aynen geçmeli.

- [ ] **Step 2:** `cargo test -p mq` → yeni testler derleme hatasıyla FAIL.
- [ ] **Step 3:** Yukarıdaki imzaları uygula. `publish_entities` ve `publish_messages` aynı `message_properties`'i kullanır; `publish_entities` ilk satırda `confirm_select`'i çağırmaya devam eder. Dört yayıncı `None` geçer.
- [ ] **Step 4:** `cargo test -p mq` ve `cargo build --workspace` → PASS.
- [ ] **Step 5:** Commit: `feat(backend-rs): mq messages with a runtime source and an optional priority`

---

### Task 2: runner — `Context`, `Publisher`, `Outcome`

**Files:**

- Create: `backend-rs/crates/runner/src/publisher.rs`
- Modify: `backend-rs/crates/runner/src/lib.rs`, `process.rs`, `run.rs`, `totals.rs`
- Modify (imza, `_ctx`): `backend-rs/workers/worker-info-{alliances,corporations,characters,types}/src/main.rs` ve bunların `Processed { inserted, .. }` kullanan yerleri
- Test: `backend-rs/crates/runner/tests/process.rs`, `crates/runner/src/totals.rs` testleri

**Interfaces:**

- Consumes: Task 1'in `EntityMessage`, `publish_messages`.
- Produces:
  - `pub enum Outcome { Created, Updated, Queued(u64) }`
  - `pub struct Processed { pub outcome: Outcome, pub detail: String }`
  - `pub trait Publisher: Send + Sync { fn publish<'a>(&'a self, queue: &'a str, messages: &'a [EntityMessage], priority: Option<u8>) -> BoxFuture<'a, anyhow::Result<u64>>; }` (`futures_util::future::BoxFuture`)
  - `pub struct Context<'a>`; `Context::new(publisher: &'a dyn Publisher) -> Self`; `fn publisher(&self) -> &dyn Publisher`
  - `#[derive(Debug)] pub struct PublisherLost;`, elle yazılmış `Display` ("publisher channel lost") ve `std::error::Error` impl'leriyle (workspace'te `thiserror` yok). Yayıncı kanalı kapalıyken `publish`'in döndürdüğü hata.
  - `Worker` trait'inde:
    - `fn handle(&self, id: i32, ctx: &Context<'_>) -> impl Future<Output = anyhow::Result<Processed>> + Send;`
    - `const OUTPUT_QUEUE: Option<&'static str> = None;`
    - `fn summary(totals: &Totals) -> String`, varsayılanı bugünkü metin: `📊 final: {p} processed ({c} created, {u} updated, {e} errors)`
  - `pub async fn process_one<W: Worker>(worker: &W, settle: &impl Settle, totals: &Totals, ctx: &Context<'_>) -> Settled` — `pub enum Settled { Settled, PublisherLost }`
  - `Totals::count_queued(&self, n: u64)`, `Totals::queued(&self) -> u64`
  - `success_line(n: u64, p: &Processed) -> String`:
    - `Created` → `  ✅ [n]{detail} (created)`, `Updated` → `  ✅ [n]{detail} (updated)` (bugünkü)
    - `Queued(0)` → `  ⚠️  [n]{detail}` (emoji'den sonra **iki** boşluk, Node'daki gibi)
    - `Queued(_)` → `  ✅ [n]{detail}`
  - `pub fn queues_to_declare<W: Worker>() -> Vec<&'static str>`: `[QUEUE_NAME]`, `OUTPUT_QUEUE` varsa ikinci eleman.

- [ ] **Step 1: Failing testler** (`tests/process.rs`; mevcut `FakeWorker`, `Fake` yeni imzaya uyarlanır, bir `FakePublisher` eklenir: basılanları kaydeder, sonucu ayarlanabilir: `Ok(n)`, `Err(anyhow)`, `Err(PublisherLost)`)

```rust
#[test]
fn success_line_keeps_each_workers_own_shape() {
    // bugünkü iki assert, `outcome: Outcome::Created` / `Outcome::Updated` ile aynı çıktı
}

#[test]
fn a_queued_line_shows_the_workers_detail() {
    let p = Processed { outcome: Outcome::Queued(12), detail: "[99000001] Foo [FOO] - queued 12 corps".into() };
    assert_eq!(success_line(7, &p), "  ✅ [7][99000001] Foo [FOO] - queued 12 corps");
}

#[test]
fn a_queued_nothing_line_warns() {
    let p = Processed { outcome: Outcome::Queued(0), detail: "[99000001] Foo [FOO] - no corporations".into() };
    assert_eq!(success_line(7, &p), "  ⚠️  [7][99000001] Foo [FOO] - no corporations");
}

#[tokio::test]
async fn a_queued_outcome_is_counted_and_acked() {
    // handle → Ok(Processed { outcome: Queued(3), .. })
    // calls() == [Ack]; totals.queued() == 3; processed() == 1; created() == 0; updated() == 0
}

#[tokio::test]
async fn a_lost_publisher_leaves_the_message_unsettled() {
    // handle → Err(anyhow::Error::new(PublisherLost))
    // process_one döner Settled::PublisherLost; calls() boş; errors() == 0
}

#[test]
fn a_fan_out_worker_declares_its_output_queue() {
    // OUTPUT_QUEUE = Some("esi_corporation_info_queue") olan sahte worker:
    assert_eq!(queues_to_declare::<FanOut>(), ["esi_fake_queue", "esi_corporation_info_queue"]);
    assert_eq!(queues_to_declare::<FakeWorker>(), ["esi_fake_queue"]);
}

#[test]
fn the_default_summary_is_unchanged() {
    // 4 processed, 1 created, 2 updated, 1 error:
    assert_eq!(FakeWorker::summary(&totals), "📊 final: 4 processed (1 created, 2 updated, 1 errors)");
}
```

Mevcut `process.rs` testleri (404 ack, parse hatası, hata yolu, created/updated sayımı) yeni imzayla aynen geçmeli.

- [ ] **Step 2:** `cargo test -p runner` → FAIL (derleme).
- [ ] **Step 3: Uygula.**
  - `publisher.rs`: `Publisher`, `Context`, `PublisherLost` ve lapin uygulaması `ChannelPublisher { channel: Channel }`. `publish`, kanal bağlı değilse (`!channel.status().connected()`) ya da lapin bir kanal/bağlantı hatası verirse `PublisherLost` döner; aksi halde `mq::publish_messages`.
  - `process.rs`: `handle(id, ctx)`. Hata `PublisherLost` ise (`e.downcast_ref::<PublisherLost>()`) settle yok, sayaç yok, `warn!("  ⚠️  publisher channel lost, leaving the message for redelivery ({context})")`, `Settled::PublisherLost` döner. `Queued(n)` → `count_queued(n)`.
  - `run.rs`, `run_connection`:
    - `queues_to_declare::<W>()` içindeki her kuyruk için `declare_worker_queue`.
    - Aynı bağlantıda ikinci kanal, `confirm_select`, bundan `ChannelPublisher`.
    - Bir `process_one` `Settled::PublisherLost` dönerse tüketici iptal edilir (`basic_cancel`), stream biter, `run_connection` `Err(anyhow!("publisher channel lost"))` döner → mevcut yeniden bağlanma döngüsü. Settle edilmemiş mesajlar kanal kapanınca broker'a döner.
  - `run`, başlangıç satırları: `OUTPUT_QUEUE` varsa `📦 queue: X` yerine `📦 input queue: X` ve `📦 output queue: Y`; yoksa bugünkü satır.
  - `report_when_drained`, özet satırı için `W::summary(&totals)`.
  - Dört bilgi worker'ı: `handle(&self, id: i32, _ctx: &Context<'_>)`, `inserted` → `if inserted { Outcome::Created } else { Outcome::Updated }`.
- [ ] **Step 4:** `cargo test --workspace` (DATABASE_URL ile) → PASS; dört worker'ın testleri değişmeden geçer.
- [ ] **Step 5:** Commit: `feat(backend-rs): runner context with a publisher and a queued outcome`

---

### Task 3: `worker-alliance-corporations`

**Files:**

- Create: `backend-rs/workers/worker-alliance-corporations/Cargo.toml` (worker-info-alliances'ınki gibi, artı `mq`, `futures-util` dev-dep gerekiyorsa, `wiremock` dev-dep)
- Create: `src/lib.rs` (worker'ın kendisi, test edilebilsin diye), `src/main.rs` (yalnızca `runner::run`)
- Test: `tests/handle.rs`, `tests/fixtures/alliances.sql`
- Modify: `backend-rs/.sqlx/` (prepare)

**Interfaces:**

- Consumes: Task 1 `EntityMessage::new`; Task 2 `Worker`, `Context`, `Publisher`, `Processed`, `Outcome`, `Totals`.
- Produces (`worker_alliance_corporations`):
  - `pub const OUTPUT_PRIORITY: u8 = 3;`
  - `pub struct AllianceCorporationWorker { pub pool: PgPool, pub esi: EsiClient }`, `impl Worker`:
    `QUEUE_NAME = "esi_alliance_corporations_queue"`, `OUTPUT_QUEUE = Some("esi_corporation_info_queue")`, `CONSUMER_TAG = "worker-alliance-corporations-rs"`, `STARTED = "🤝 alliance corporation worker started"`, `WAITING_FOR = "alliances"`, `ENTITY = "alliance"`.
    `summary` → `📊 final: {processed} alliances processed, {queued} corporations queued, {errors} errors`
  - `pub async fn alliance_label(pool: &PgPool, id: i32) -> Result<(String, String), sqlx::Error>`: `SELECT name, ticker FROM alliances WHERE id = $1`; satır yoksa `("Unknown", "???")`.

**`handle(id, ctx)`:**

1. `alliance_label`
2. `esi.get::<Vec<i32>>(&format!("/alliances/{id}/corporations"))`
3. Boşsa yayın yok; `Processed { outcome: Queued(0), detail: format!("[{id}] {name} [{ticker}] - no corporations") }`
4. Değilse her corp için `EntityMessage::new(corp_id, format!("alliance_{id}"))`, `ctx.publisher().publish("esi_corporation_info_queue", &messages, Some(OUTPUT_PRIORITY))`; `Processed { outcome: Queued(n), detail: format!("[{id}] {name} [{ticker}] - queued {n} corps") }`, `n` = mesaj sayısı.

- [ ] **Step 1: Failing testler** (`tests/handle.rs`; `#[sqlx::test(migrations = false, fixtures("alliances"))]`, ESI için `wiremock`, `EsiClient::with_base_url(RateLimiter::new(50), server.uri())`, sahte yayıncı kaydeder)

```rust
async fn publishes_one_message_per_corporation(pool: PgPool) {
    // ESI /alliances/99000001/corporations → [98000001, 98000002]
    // publisher kayıtları: queue == "esi_corporation_info_queue", priority == Some(3),
    //   entity_id'ler [98000001, 98000002], her source == "alliance_99000001"
    // outcome == Queued(2), detail == "[99000001] Test Alliance [TEST] - queued 2 corps"
}

async fn an_empty_list_publishes_nothing(pool: PgPool) {
    // ESI → []; publisher hiç çağrılmaz; outcome == Queued(0);
    // detail == "[99000001] Test Alliance [TEST] - no corporations"
}

async fn an_unknown_alliance_is_labelled_unknown(pool: PgPool) {
    // fixture'da olmayan 99000999; ESI → [98000001]
    // detail == "[99000999] Unknown [???] - queued 1 corps"
}

async fn a_failed_publish_is_an_error(pool: PgPool) {
    // publisher Err(anyhow!("nack")) döner → handle Err
}

async fn the_esi_path_has_no_trailing_slash(pool: PgPool) {
    // mock path("/alliances/99000001/corporations") .expect(1)
}
```

Fixture: `alliances` tablosuna tek satır, `id = 99000001`, `name = 'Test Alliance'`, `ticker = 'TEST'`, tablonun zorunlu öbür sütunları worker-info-alliances fixture'ındaki gibi.

- [ ] **Step 2:** `cargo test -p worker-alliance-corporations` → FAIL.
- [ ] **Step 3:** Uygula. `main.rs`: `runner::run(|r| AllianceCorporationWorker { pool: r.pool, esi: r.esi })`. `cargo sqlx prepare --workspace`.
- [ ] **Step 4:** `cargo test -p worker-alliance-corporations` → PASS; clippy, fmt temiz.
- [ ] **Step 5:** Commit: `feat(backend-rs): Rust alliance corporations worker` (`.sqlx/` dahil)

---

### Task 4: `queue-alliance-corporations`

**Files:**

- Create: `backend-rs/queues/queue-alliance-corporations/{Cargo.toml,src/lib.rs,src/main.rs,tests/fetch.rs}` (`queue-alliances`'ın kopyası, farklar aşağıda)

**Interfaces:**

- Consumes: Task 1 `publish_entities(…, priority, …)`.
- Produces: `QUEUE_NAME = "esi_alliance_corporations_queue"`, `SOURCE = "esi_alliance_corporations_queue"`, `PRIORITY: u8 = 5`, `pub async fn fetch_alliance_ids(esi: &EsiClient) -> Result<Vec<i32>, EsiError>` (`esi.get("/alliances")`).

Log satırları (`main.rs`), sırayla:
`fetching all alliance IDs from ESI...` → `found {n} alliances` → `adding alliances to queue...` → debug `batch {i}/{total}: {len} alliances queued` → `successfully queued {n} alliances!` → `next steps:` → `  1. start worker: yarn worker:alliance-corporations:rs` → `  2. start enrichment: yarn worker:info:corporations:rs`. Hata: `failed to queue alliance corporations: {e:#}`, çıkış 1.

- [ ] **Step 1: Failing testler** (`tests/fetch.rs`): `queue-alliances`'ın iki testi (`fetches_the_alliance_list`, `server_error_is_an_error`) bu crate'in `fetch_alliance_ids`'ine karşı.
- [ ] **Step 2:** `cargo test -p queue-alliance-corporations` → FAIL.
- [ ] **Step 3:** Uygula; `publish_entities(&channel, QUEUE_NAME, SOURCE, &ids, Some(PRIORITY), …)`.
- [ ] **Step 4:** PASS; clippy, fmt temiz.
- [ ] **Step 5:** Commit: `feat(backend-rs): Rust alliance corporations queue, alliance list from ESI`

---

### Task 5: Script'ler, dokümanlar, yerel koşu, PR

**Files:**

- Modify: `backend/package.json`
- Modify: `CLAUDE.md` (_The ingest pattern_)

- [ ] **Step 1:** `backend/package.json`, ötekilerin yanına:
  - `"queue:alliance-corporations:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-alliance-corporations"`
  - `"worker:alliance-corporations:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-alliance-corporations"`
  - `"queue:alliance-chain:rs": "yarn queue:alliances:rs && yarn queue:alliance-corporations:rs"`
- [ ] **Step 2:** CLAUDE.md, _The ingest pattern_ altındaki `queue-types` paragrafının yanına bir cümle: Rust `queue-alliance-corporations` bir root scan'dir, alliance listesini ESI'den okur; Node sürümü veritabanından okur.
- [ ] **Step 3:** `npx prettier --check backend/package.json CLAUDE.md` → temiz.
- [ ] **Step 4: Yerel koşu** (kullanıcının worker'ları açık; çalıştırma kullanıcıya sorulur):
  - `corporations` satır sayısı kaydedilir.
  - `yarn worker:alliance-corporations:rs` başlar; log'da `📦 input queue: esi_alliance_corporations_queue` ve `📦 output queue: esi_corporation_info_queue`.
  - `yarn queue:alliance-chain:rs`: iki script de aynı alliance sayısını basar.
  - Kuyruk boşalınca özet: `N alliances processed, M corporations queued, E errors`; `E` sıfır ya da 404'ler.
  - RabbitMQ'da `esi_corporation_info_queue`'ya M mesaj girmiş olmalı; `corporations` satır sayısı yalnızca artmış olmalı.
- [ ] **Step 5:** Tam set `qa` agent'ına: `cargo test --workspace`, `cargo clippy`, `cargo fmt --check`, `yarn workspace backend build`, prettier.
- [ ] **Step 6:** Commit, push, PR (İngilizce, attribution yok). Merge'den sonra #315'te `worker:alliance-corporations` ve `queue:alliance-corporations` satırları işaretlenir.
