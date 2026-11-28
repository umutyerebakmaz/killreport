# Rust `worker:redisq` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** zKillboard R2Z2 akışını okuyan Rust `worker-redisq`; kalıcı sıra
numarası, kayıptan `killmail_refs`'e düşüş, kayıttan önce ortak kodla enrichment.

**Architecture:** Kuyruk tüketmeyen tek bir binary. Akış mantığı (`r2z2`,
`cursor`, `stream`) ve killmail işleme (`process`) `worker-redisq` lib'inde.
Enrichment dört info worker'dan taşınan `crates/entity-info`'yu, yazma
`crates/killmail-writer`'ı kullanır. ESI istemcisi `live` öncelik ve 10 sn
bekleme sınırı alır; `RedisPubSub` yeniden bağlanır.

**Tech Stack:** Rust 1.97, sqlx 0.8, lapin 2, redis 1.8 (`ConnectionManager`),
reqwest 0.12 (rustls), wiremock; Node: Prisma, vitest.

**Spec:** `docs/superpowers/specs/2026-11-28-rust-redisq-design.md`

## Global Constraints

- Veritabanı asla sıfırlanmaz; `prisma migrate dev` çalıştırılmaz. Migration
  `backend/prisma/CLAUDE.md`'deki diff-and-deploy yöntemiyle, `database` agent'ı
  ile.
- `.env` düzenlenmez. Testler `DATABASE_URL`'i
  `export DATABASE_URL=$(grep '^DATABASE_URL=' ../backend/.env | cut -d= -f2- | tr -d '"\r')`
  ile alır (backend-rs'den); değer asla yazdırılmaz.
- Tüm zamanlar UTC; `now` parametre olarak geçilir (`Utc::now().naive_utc()`).
- TLS yalnızca rustls; yeni crate OpenSSL çekemez.
- Her `assertQueue`/declare `x-max-priority: 10` ile (`mq::declare_worker_queue`
  bunu yapar).
- Her ESI isteği `esi::EsiClient` üzerinden; R2Z2 istekleri ESI limiter'ından
  geçmez.
- R2Z2 sabitleri: taban `https://r2z2.zkillboard.com/ephemeral`, dolu cevaptan
  sonra 100 ms, 404'te 6000 ms, 403/429'da 5000 ms, hata sonrası 100 ms, her 5.
  ardışık hatada 5000 ms.
- 404 kuralı: baş > numara iken aynı numara **3** kez 404 → bir atla; art arda
  **10** atlama → başa geç; bir 200 sayacı sıfırlar.
- Enrichment: alliance → corporation → character → type, grup içinde en fazla
  **10** paralel; `REDISQ_ENABLE_ENRICHMENT=false` kapatır.
- `killmail_refs` kaynağı `"redisq"`; yayın kaynağı `"worker-redisq"`.
- ESI: `live(Duration::from_secs(10))`.
- Fixture'lar pg_dump + sed filtresi
  (`/^--/d; /^.restrict /d; /^.unrestrict /d; /^SET /d; /^SELECT pg_catalog.set_config/d; /^$/d`),
  mevcut fixture başlığıyla.
- Commit/PR İngilizce, Claude imzası yok. Branch: `feat/rust-redisq`.

## Review Focus

1. Ağ hatası, 5xx ya da veritabanı kesintisinde sıra numarasının **ilerlemediği**
   (killmail hiçbir yere yazılmadan geride kalmaz).
2. Bir killmail sonuçlandıktan sonra çalışma kesilirse (SIGINT) sıranın yazılmış
   olduğu; yeniden başlatma aynı killmail'i ikinci kez duyurmaz (`AlreadyStored`).
3. Taşınan info worker'ların davranışının değişmediği (aynı ESI yolu, aynı
   compatibility date, aynı upsert).
4. `live` önceliğinin yalnızca redisq istemcisinde olduğu; diğer tüm worker'lar
   `Bulk` ve sınırsız beklemede.
5. RabbitMQ ya da Redis koptuğunda akışın durmadığı; duyuru kaybı loglanır.

Her biri aşağıda sahibi olan görevde bir testle sabitlenir.

---

### Task 1: `stream_cursors` tablosu

**Files:**

- Create: `backend/prisma/schema/streamCursor.prisma`
- Create: `backend/prisma/migrations/<timestamp>_stream_cursors/migration.sql`
- Create: `backend-rs/workers/worker-redisq/tests/fixtures/stream_cursors.sql`

**Interfaces:**

- Produces: tablo `stream_cursors(stream TEXT PK, sequence BIGINT NOT NULL, updated_at TIMESTAMP(3) NOT NULL)`; Prisma modeli `StreamCursor` (`@@map("stream_cursors")`).

- [ ] **Step 1:** `database` agent'ına modeli ve migration'ı yazdır: row count kaydı, `prisma migrate diff`, beş el yazımı tablonun `DROP`'larını temizleme, `migrate deploy`. Migration yalnızca `CREATE TABLE "stream_cursors"` içerir.
- [ ] **Step 2:** Doğrula. Run: `cd backend && yarn prisma migrate status && yarn prisma generate`. Expected: "Database schema is up to date!"; row count'lar öncekiyle aynı.
- [ ] **Step 3:** Fixture'ı pg_dump ile üret (`--schema-only -t stream_cursors`), sed filtresinden geçir.
- [ ] **Step 4:** Commit: `feat(db): stream_cursors table for durable stream positions`.

### Task 2: `crates/entity-info`

**Files:**

- Create: `backend-rs/crates/entity-info/{Cargo.toml,src/lib.rs}`
- Move: `workers/worker-info-characters/src/character.rs` → `crates/entity-info/src/character.rs`; aynı şekilde `corporation.rs`, `alliance.rs`, `type_info.rs`
- Move: dört worker'ın `tests/{parse,upsert,title_fields,warnings}.rs` ve `tests/fixtures/*` → `crates/entity-info/tests/` (çakışan dosya adları `character_parse.rs` vb. olarak)
- Modify: dört info worker'ın `main.rs`, `Cargo.toml`; `lib.rs`'leri silinir
- Modify: `backend-rs/Cargo.toml` (`entity-info = { path = "crates/entity-info" }`)
- Test: `crates/entity-info/tests/fetch.rs`

**Interfaces:**

- Produces: `entity_info::{character, corporation, alliance, type_info}` (mevcut public API'ler aynen) ve her modülde
  `pub async fn fetch_and_upsert(pool: &PgPool, esi: &EsiClient, id: i32) -> anyhow::Result<Fetched>`;
  `pub struct Fetched { pub inserted: bool, pub name: String }`
  (crate kökünde). ESI yolları info worker'lardakinin aynısı:
  `/characters/{id}/` (`CHARACTER_COMPATIBILITY_DATE`), `/corporations/{id}/`,
  `/alliances/{id}`, `/universe/types/{id}/`.

- [ ] **Step 1: Failing test** `fetch.rs`: dört `#[sqlx::test]` (wiremock ESI): `fetch_and_upsert_writes_a_character`, `…_corporation`, `…_alliance`, `…_type`. Her biri: mock yolun **tam** eşleştiğini (`path(...)`), `inserted == true`, satırın `name`'inin ESI'daki ad olduğunu; character testi ayrıca `x-compatibility-date` başlığının `CHARACTER_COMPATIBILITY_DATE` olduğunu doğrular.
- [ ] **Step 2:** Run: `cargo test -p entity-info --test fetch`. Expected: FAIL (crate yok).
- [ ] **Step 3:** Modülleri `git mv` ile taşı, `fetch_and_upsert`'leri ekle, info worker'ların `handle`'ını `fetch_and_upsert` + `Outcome::{Created,Updated}` + `detail: format!(" {}", f.name)` olacak şekilde değiştir.
- [ ] **Step 4:** Run: `cargo test -p entity-info && cargo test -p worker-info-characters -p worker-info-corporations -p worker-info-alliances -p worker-info-types && cargo clippy --workspace --all-targets -- -D warnings`. Expected: hepsi PASS, taşınan test sayısı taşımadan öncekiyle aynı (öncesini Step 0'da `cargo test -p worker-info-* 2>&1 | grep "test result"` ile kaydet).
- [ ] **Step 5:** Commit: `refactor(rust): move entity info fetch and upserts to a shared crate`.

### Task 3: ESI `live` istemcisi

**Files:**

- Modify: `backend-rs/crates/esi/src/{client.rs,limiter.rs,shared_limiter.rs}`
- Test: `backend-rs/crates/esi/tests/{shared_limiter.rs,client.rs}`

**Interfaces:**

- Produces: `EsiClient::live(self, max_wait: Duration) -> Self`. `RateLimiter::acquire(&self, route, max_wait, priority: Priority)`; shared limiter waiter'ı önceliği taşır ve `store.acquire(priority, …)`'a verir (`shared_limiter.rs:381`'deki sabit `Bulk` kalkar). Yerel kuyruk sırası değişmez. `EsiClient::new`/`with_base_url` `Bulk` + `None` ile kalır.

- [ ] **Step 1: Failing tests:** `shared_limiter.rs`: `a_live_acquire_asks_the_store_as_live` ve `the_default_acquire_still_asks_as_bulk` (fake store'un kaydettiği `(priority, …)` üzerinden). `client.rs`: `a_live_client_gives_up_past_its_max_wait` — yerel limiter 30 sn fren altındayken `live(Duration::from_secs(10))` istemcinin `get`'i `EsiError` (throttled) döner ve mock sunucuya istek gitmez; `a_default_client_waits_out_a_brake` mevcut davranışı sabitler (varsa mevcut testi referans al, yoksa ekle, `tokio::time::pause` ile).
- [ ] **Step 2:** Run: `cargo test -p esi`. Expected: yeni testler FAIL (derleme: `live` yok).
- [ ] **Step 3:** Uygula. Rust'ta diğer `acquire` çağıranlar `Priority::Bulk` geçer.
- [ ] **Step 4:** Run: `cargo test -p esi && cargo build --workspace`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(esi): live priority and a maximum wait per client`.

### Task 4: `RedisPubSub` yeniden bağlanır

**Files:**

- Modify: `backend-rs/crates/pubsub/src/lib.rs`
- Test: `backend-rs/crates/pubsub/tests/` (mevcut test dosyası)

**Interfaces:**

- Produces: public API aynı. İçeride `OnceCell<ConnectionManager>`; `ConnectionManager::new_with_config` ile bağlantı ve yanıt timeout'u (5 sn).

- [ ] **Step 1: Failing test** `#[ignore]` `publishes_again_after_the_connection_is_killed`: gerçek Redis'e (`REDIS_URL` ya da `esi::DEFAULT_REDIS_URL`) bir publish; testin kendi bağlantısıyla `CLIENT LIST`'te `name=killreport-pubsub` satırının `id`'sini bul ve `CLIENT KILL ID <id>`; ikinci publish `Ok`. (Publisher bağlantıyı kurarken `CLIENT SETNAME killreport-pubsub` gönderir; bugünkü kod göndermediği için test önce satırı bulamayarak düşer, bu da RED'dir.)
- [ ] **Step 2:** Run: `cargo test -p pubsub -- --ignored`. Expected: ikinci publish FAIL.
- [ ] **Step 3:** `ConnectionManager`'a geç, bağlantıya `killreport-pubsub` adını ver.
- [ ] **Step 4:** Run: `cargo test -p pubsub -- --include-ignored && cargo test -p sov -p worker-killmail-detail`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(pubsub): reconnect through a ConnectionManager`.

### Task 5: R2Z2 istemcisi, sıra ve 404 kuralı

**Files:**

- Create: `backend-rs/workers/worker-redisq/{Cargo.toml,src/lib.rs,src/r2z2.rs,src/cursor.rs,src/stream.rs}`
- Test: `backend-rs/workers/worker-redisq/tests/{r2z2.rs,cursor.rs,stream.rs}`

**Interfaces:**

- Produces:
  - `r2z2::R2z2 { … }`, `R2z2::new(base_url: &str) -> Self` (Node'daki `User-Agent`, 10 sn timeout); `async fn head(&self) -> anyhow::Result<i64>` (`sequence.json` → `sequence`); `async fn get(&self, seq: i64) -> anyhow::Result<Poll>`.
  - `pub enum Poll { Found(Package), Unreadable { killmail_id: Option<i32>, hash: Option<String> }, NotFound, RateLimited }`; ağ/5xx `Err`.
  - `pub struct Package { pub killmail_id: i32, pub hash: String, pub esi: Option<KillmailDetail> }` — hash `zkb.hash`, yoksa kök `hash`; `esi` yalnızca `KillmailDetail` olarak deserialize olur ve Node'daki `isUsableEsiKillmail` koşullarını sağlarsa (en az bir attacker) `Some`.
  - `cursor::STREAM: &str = "r2z2"`; `async fn load(pool) -> sqlx::Result<Option<i64>>`; `async fn save(pool, sequence: i64, now: NaiveDateTime) -> sqlx::Result<()>` (upsert).
  - `stream::Gap { tries: u32, skipped: u32 }` ve
    `pub fn on_not_found(gap: &mut Gap, current: i64, head: i64) -> Step`;
    `pub fn on_found(gap: &mut Gap)` (ikisini sıfırlar);
    `pub enum Step { Wait, Skip(i64), JumpTo(i64) }` (`Skip`/`JumpTo` yeni numarayı taşır).
    Kural: `head <= current` → `tries = 0`, `Wait`. Aksi hâlde `tries += 1`; `tries < 3` → `Wait`; `tries == 3` → `tries = 0`, `skipped += 1`; `skipped == 10` → `skipped = 0`, `JumpTo(head)`; değilse `Skip(current + 1)`.

- [ ] **Step 1: Failing tests:**
  - `stream.rs` (saf): `waits_while_the_head_is_not_ahead`, `waits_twice_then_skips_when_the_head_is_ahead`, `a_head_that_falls_back_resets_the_tries`, `ten_skips_jump_to_the_head`, `a_found_killmail_resets_the_skip_count`.
  - `r2z2.rs` (wiremock): `head_reads_sequence_json`, `a_200_with_a_usable_esi_copy_is_found`, `a_200_without_attackers_is_found_without_esi`, `a_body_with_an_id_but_no_killmail_shape_is_unreadable_with_its_id`, `a_non_json_body_is_unreadable_without_an_id`, `the_hash_falls_back_to_the_top_level_hash`, `404_is_not_found`, `403_and_429_are_rate_limited`, `500_is_an_error`, `requests_carry_the_user_agent`.
  - `cursor.rs` (`#[sqlx::test(migrations = false, fixtures("stream_cursors"))]`): `load_is_none_without_a_row`, `save_then_load_returns_the_sequence`, `save_overwrites_and_stamps_updated_at` (`now` 2026-11-28T12:00:00 UTC ile).
- [ ] **Step 2:** Run: `cargo test -p worker-redisq`. Expected: FAIL (derleme).
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Run: `cargo test -p worker-redisq && cargo clippy -p worker-redisq --all-targets -- -D warnings`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(rust): R2Z2 client, durable cursor and gap rule for worker-redisq`.

### Task 6: Killmail işleme

**Files:**

- Create: `backend-rs/workers/worker-redisq/src/{process.rs,enrich.rs,announce.rs}`
- Test: `backend-rs/workers/worker-redisq/tests/{process.rs,enrich.rs}`, fixtures (detail worker'ın fixture'larının kopyası + `characters`, `corporations`, `alliances` — `entity-info` fixture'larından)

**Interfaces:**

- Consumes: `Package` (Task 5), `entity_info::*::fetch_and_upsert` (Task 2), `killmail_writer::{save, Saved}`, `killmail_refs::{record, Ref}`, `RedisPubSub`.
- Produces:
  - `pub trait Outbox: Send + Sync { fn publish_killmails<'a>(&'a self, queue: &'a str, ids: &'a [i32]) -> BoxFuture<'a, anyhow::Result<u64>>; fn publish_entities<'a>(&'a self, queue: &'a str, ids: &'a [i32]) -> BoxFuture<'a, anyhow::Result<u64>>; }` — gerçeği Task 7'de, testlerde kaydeden bir fake.
  - `enrich::missing(pool, &KillmailDetail) -> sqlx::Result<Missing>`; `Missing { alliances, corporations, characters, types: Vec<i32> }` (sıralı, tekil).
  - `enrich::enrich(pool, esi, outbox, &KillmailDetail) -> sqlx::Result<Enriched>`; `Enriched { written: usize, failed: usize }`. Çekilemeyen ID'ler `esi_<entity>_info_queue`'ya; yayın hatası loglanır.
  - `pub struct Processor { pub pool, pub esi: EsiClient, pub pubsub: RedisPubSub, pub enrichment: bool }`;
    `async fn process(&self, outbox: &dyn Outbox, pkg: &Package, now: NaiveDateTime) -> anyhow::Result<Settled>`;
    `async fn settle_unreadable(&self, killmail_id: i32, hash: &str, now) -> anyhow::Result<Settled>`;
    `pub enum Settled { Saved { announced: u64 }, AlreadyStored, Deferred }` (`Deferred` = refs'e düştü).
    `Err` yalnızca refs yazılamadığında: çağıran sırayı ilerletmez.
  - Duyuru: `NEW_KILLMAIL {"killmailId": N}` + `discord_webhook_queue`; hatalar `warn!` ve yutulur.

- [ ] **Step 1: Failing tests:**
  - `enrich.rs`: `missing_lists_only_ids_not_in_the_database` (victim, attacker, weapon, item tipleri dahil; 0/None hariç), `missing_entities_are_written_before_the_killmail` (wiremock ESI, dört entity çekildi ve satırları var), `an_entity_esi_refuses_is_queued_to_its_info_queue` (ESI 404 → fake outbox'ta `esi_character_info_queue` + ID), `alliances_are_fetched_before_corporations` (wiremock istek sırası).
  - `process.rs`: `a_package_with_an_esi_copy_is_saved_without_calling_esi` (mock'a istek yok), `a_package_without_one_is_fetched_from_esi`, `esi_failing_records_a_killmail_ref` (`killmail_refs` satırı `source = 'redisq'`, `Settled::Deferred`), `a_save_error_records_a_killmail_ref` (attacker'sız ESI cevabı → `save` bail), `a_failing_ref_write_is_an_error` (pool kapatılmış: `pool.close()` sonra `process` → `Err`), `a_new_killmail_is_announced_to_discord` (fake outbox `discord_webhook_queue` [id]), `an_already_stored_killmail_is_not_announced`, `enrichment_off_calls_no_esi`, `an_unreadable_body_with_an_id_is_deferred`.
- [ ] **Step 2:** Run: `cargo test -p worker-redisq`. Expected: yeni testler FAIL.
- [ ] **Step 3:** Uygula. `missing` dört `SELECT id FROM <tablo> WHERE id = ANY($1)`; ESI `live` istemcisi çağıranın verdiğidir.
- [ ] **Step 4:** Run: `cargo test -p worker-redisq && cargo clippy -p worker-redisq --all-targets -- -D warnings`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(rust): worker-redisq enriches, saves and announces each killmail`.

### Task 7: Akış döngüsü ve binary

**Files:**

- Create: `backend-rs/workers/worker-redisq/src/{run.rs,main.rs,outbox.rs}`
- Modify: `backend/package.json` (`"worker:redisq:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-redisq"`)
- Test: `backend-rs/workers/worker-redisq/tests/run.rs`

**Interfaces:**

- Consumes: Task 5 ve 6'nın hepsi.
- Produces:
  - `outbox::RabbitOutbox` — `mq::connect`, `discord_webhook_queue` ve dört info kuyruğunu `mq::declare_worker_queue` ile declare eder, confirm modunda kanal; yayın hatasında kanal bir sonraki yayında yeniden kurulur. `Outbox` implementasyonu.
  - `run::Stream { r2z2, processor, cursor_pool }`; `async fn step(&mut self, outbox: &dyn Outbox, now) -> anyhow::Result<Tick>` tek bir okuma + sonuçlandırma yapar; `pub enum Tick { Settled, Waited(Duration), Skipped, Jumped }`. Bekleme süresini **döner**, uyumaz; döngü (`run_forever`) uyur ve SIGINT/SIGTERM'i `tokio::select!` ile bekler, elindeki `step` bitmeden çıkmaz.
  - Başlangıç: `cursor::load` → yoksa `r2z2.head()` ve `cursor::save`.
  - Hata: `step` `Err` → sıra değişmez; 100 ms, her 5. ardışık hatada 5000 ms.
  - `main.rs`: `runner::init()`, `DATABASE_URL`, `RABBITMQ_URL`, `RateLimiter::from_env()`, `EsiClient::new(limiter).live(Duration::from_secs(10))`, `RedisPubSub::from_env("new killmails")`, `REDISQ_ENABLE_ENRICHMENT`.

- [ ] **Step 1: Failing tests** (`run.rs`, wiremock R2Z2 + fake outbox, `#[sqlx::test]`):
  - `starts_from_the_head_without_a_cursor_row`, `resumes_from_the_saved_cursor`,
  - `a_settled_killmail_advances_and_saves_the_cursor`,
  - `a_network_error_does_not_advance` (R2Z2 500),
  - `a_failing_ref_write_does_not_advance` (ESI kopyası yok, ESI 500, pool'un `killmail_refs`'e yazamadığı durum: fixture'sız şema → tablo yok),
  - `a_restart_after_a_saved_killmail_does_not_announce_it_again` (aynı DB'de iki `Stream` arka arkaya kurulur: ilki N'yi yazar ve sırayı N+1 yapar; ikincisi N+1'den başlar, N'nin mock'u ikinci kez istenmez — `expect(1)`; outbox'ta tek duyuru),
  - `a_404_with_the_head_behind_waits_six_seconds`, `rate_limited_waits_five_seconds`, `a_found_killmail_waits_a_hundred_milliseconds`.
- [ ] **Step 2:** Run: `cargo test -p worker-redisq --test run`. Expected: FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Run: `cargo test -p worker-redisq && cargo clippy --workspace --all-targets -- -D warnings && cargo build --release -p worker-redisq`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(rust): worker-redisq binary and stream loop`.

### Task 8: Node redisq, worker durumu, belgeler

**Files:**

- Create: `backend/src/services/redisq/stream-cursor.ts` (+ `.spec.ts`)
- Modify: `backend/src/workers/worker-redisq-stream.ts`, `backend/src/services/killmail-refs.ts` (`RefSource` += `'redisq'`), `backend/src/resolvers/worker/helpers.ts` (+ `helpers.spec.ts`), `backend/docs/redis-cache/redisq-stream.md`, `backend/docs/workers/worker-status-monitoring.md` (varsa ilgili satır)

**Interfaces:**

- Produces (Node, Rust ile aynı kurallar):
  - `loadCursor(): Promise<number | null>`, `saveCursor(sequence: number, now: Date): Promise<void>` (`utcTimestamp`).
  - `onNotFound(gap: Gap, current: number, head: number): Step`, `onFound(gap: Gap): void`; `Step = { kind: 'wait' } | { kind: 'skip'; next: number } | { kind: 'jump'; next: number }`.
  - Worker: başlangıçta cursor; her sonuçlanmadan sonra `saveCursor`; işleme hatasında `recordRefs([...], 'redisq', now)`, o da başarısızsa ilerlemez; okunamayan 200 gövdesi Rust'taki gibi; `emptyCheckInterval` kaldırılır.
  - `checkWorkerProcess`: mevcut `node` taramasına ek olarak `ps aux | grep -E "target/[^/ ]+/${workerFileName}( |$)" | grep -v grep`.

- [ ] **Step 1: Failing tests:** `stream-cursor.spec.ts`: Task 5'teki beş `stream.rs` testinin aynısı (aynı adlar, camelCase değil İngilizce cümle olarak) + `saveCursor` bir `$executeRaw` upsert'ü çağırır (prisma-worker mock'u, mevcut spec'lerin kalıbıyla). `helpers.spec.ts`: `finds a Rust worker binary by its target path` (`execAsync` mock'u `…/backend-rs/target/release/worker-redisq` satırı döner → `running: true`).
- [ ] **Step 2:** Run: `yarn workspace backend vitest run src/services/redisq src/resolvers/worker`. Expected: FAIL.
- [ ] **Step 3:** Uygula; belgelerde sıra numarası, refs düşüşü, `worker:redisq:rs` ve enrichment'ın ortak crate'i anlatılır.
- [ ] **Step 4:** Run: `yarn workspace backend test && yarn workspace backend build && npx prettier --check docs backend/docs backend/src/services/redisq backend/src/workers/worker-redisq-stream.ts backend/src/resolvers/worker`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(redisq): Node worker keeps the same durable cursor and ref fallback`.
