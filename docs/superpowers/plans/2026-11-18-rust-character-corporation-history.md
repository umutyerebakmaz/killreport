# Rust `character-corporation-history` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `queue:character-corporation-history` ile
`worker:character-corporation-history`'nin Rust karşılıklarını eklemek. Node
tarafında ack'in onaydan önce gelmesini ve queue script'in confirm'siz
çıkmasını düzeltmek.

**Architecture:** `runner`'a `Outcome::Saved { queued }` eklenir; worker crate'i
`worker-alliance-corporations`, queue crate'i `queue-characters` desenini izler.
Node worker'ı ömür boyu açık bir confirm channel üzerinden, mesaj başına
callback ile basar ve ack'i hepsinin onayından sonra yapar.

**Tech Stack:** Rust (sqlx 0.8, lapin 2, wiremock, `runner`/`mq`/`esi`/`db`),
TypeScript (amqplib, vitest).

**Spec:** `docs/superpowers/specs/2026-11-18-rust-character-corporation-history-design.md`

## Global Constraints

- Kuyruklar: girdi `esi_character_corporation_history_queue`, çıktı
  `esi_corporation_info_queue`. Hiçbir yayında öncelik yok.
- `source` değerleri: queue `queue-character-corporation-history`, worker
  `worker-character-corporation-history`.
- SQL'ler Node'dakiyle birebir: stale sorgusu
  (`queue-character-corporation-history.ts:39-50`), kayıt ifadesi
  (`character-corporation-history-writer.ts:32-57`).
- Rust'ta `sqlx::query!` makrosu değil, `sqlx::query` / `query_scalar`
  fonksiyonları: `.sqlx` cache'i gerekmez, CI `SQLX_OFFLINE=true` derler.
- `fetched_at` ve `start_date` UTC olarak yazılır.
- systemd unit'leri, timer'lar ve SQL'in anlamı değişmez. Yarn, asla npm.
  Commit mesajları İngilizce, Claude atfı yok.

## Review Focus

1. **Confirm channel, onaylar gelmeden kapanıyor** → bekleyen yayın reddedilir,
   karakter mesajı ack'lenmez. Task 4 `rejects pending sends when the channel closes`.
2. **Bir corp mesajı nack'leniyor, diğerleri ack** → bütün yayın reddedilir,
   karakter ack'lenmez. Task 4 `rejects when one send is nacked`.
3. **ESI boş geçmiş döndürüyor** → hiç kayıt yok, karakterin mevcut satırlarına
   yine damga basılır, publisher çağrılmaz, satır `✅`.
   Task 2 `an_empty_history_still_stamps_and_queues_nothing`.
4. **Aynı corp geçmişte birden çok kez** → bir kez kuyruğa girer.
   Task 2 `a_repeated_corporation_is_queued_once`.
5. **Silinmiş karakter (ESI 404)** → `handle` hata döner, hiçbir şey yazılmaz.
   Task 2 `an_esi_404_writes_nothing`.

---

### Task 1: `runner`'a `Outcome::Saved`

**Files:**

- Modify: `backend-rs/crates/runner/src/lib.rs:24-32` (enum), `:79-87` (`success_line`)
- Modify: `backend-rs/crates/runner/src/process.rs:55-59` (match)
- Test: `backend-rs/crates/runner/tests/process.rs`

**Interfaces:**

- Produces: `Outcome::Saved { queued: u64 }`. `success_line` için her zaman
  `"  ✅ [{n}]{detail}"`. `process_one` bunu `totals.count_queued(queued)` ile sayar.

- [ ] **Step 1: Failing testler** — `tests/process.rs`'e:
  - `a_saved_line_never_warns`: `Outcome::Saved { queued: 0 }`, detail
    `" character 90000001: 3 records, 0 corporations queued"` →
    `success_line(7, …) == "  ✅ [7] character 90000001: 3 records, 0 corporations queued"`.
  - `a_saved_line_with_queued_corporations`: `queued: 2`, aynı biçim, `✅`.
  - Aynı dosyada `process_one`'ı çağıran mevcut bir test varsa onun deseniyle
    `saved_counts_into_queued`: `Saved { queued: 2 }` dönen sahte worker →
    `totals.queued() == 2`, `processed() == 1`. Yoksa bu test `Totals` doğrudan
    test edilemediği için atlanır ve ledger'a not düşülür.
- [ ] **Step 2: Çalıştır** — `cd backend-rs && cargo test -p runner` → derleme hatası, `Saved` yok.
- [ ] **Step 3: Uygula** — enum'a varyant, `success_line`'a kol, `process_one` match'ine kol.
- [ ] **Step 4: Çalıştır** — aynı komut, hepsi PASS; `cargo clippy --all-targets -- -D warnings` temiz.
- [ ] **Step 5: Commit** — `feat(runner): Outcome::Saved for workers that write and also queue`

### Task 2: Rust `worker-character-corporation-history`

**Files:**

- Create: `backend-rs/workers/worker-character-corporation-history/{Cargo.toml,src/lib.rs,src/main.rs}`
- Create: `.../tests/handle.rs`, `.../tests/fixtures/{corporations,character_corporation_history}.sql`
  (`queues/queue-character-corporations/tests/fixtures/`'dan kopya)
- Modify: `backend/package.json` (`worker:character-corporation-history:rs`), `backend-rs/Cargo.lock`

**Interfaces:**

- Consumes: Task 1'deki `Outcome::Saved { queued }`; `runner::{Context, Processed, Totals, Worker}`,
  `esi::EsiClient`, `mq::EntityMessage` — `worker-alliance-corporations/src/lib.rs`'teki kullanımla aynı.
- Produces (`lib.rs`):
  - `pub struct HistoryRecord { pub corporation_id: i32, pub record_id: i64, pub start_date: DateTime<Utc>, #[serde(default)] pub is_deleted: bool }` (`Deserialize`)
  - `pub async fn save_history(pool: &PgPool, character_id: i32, records: &[HistoryRecord], fetched_at: DateTime<Utc>) -> sqlx::Result<()>` — Node ifadesi, `unnest` dizileri `bind` ile, damgalar `naive_utc()`.
  - `pub async fn missing_corporation_ids(pool: &PgPool, ids: &[i32]) -> sqlx::Result<Vec<i32>>` — farklı ID'ler, `corporations`'ta olmayanlar, artan sırada; boş girdide sorgu yok.
  - `pub struct CorporationHistoryWorker { pub pool: PgPool, pub esi: EsiClient }` ve `Worker` impl: spec'teki sabitler, `summary` → `"📊 final: {processed} processed ({errors} errors)"`.

- [ ] **Step 1: Fixture'lar ve failing testler** — `tests/handle.rs`, `worker-alliance-corporations/tests/handle.rs`'teki `Recorder` ve `worker(pool, &server)` desenleriyle. Hepsi `#[sqlx::test(migrations = false, fixtures("corporations", "character_corporation_history"))]`:
  - `saves_history_and_queues_missing_corporations` — ESI iki kayıt (`98000001`, `98000002`), `corporations`'ta `98000001` var → tabloda 2 satır, `fetched_at` dolu; publisher 1 çağrı, kuyruk `esi_corporation_info_queue`, priority `None`, ids `[98000002]`, sources `worker-character-corporation-history`; outcome `Saved { queued: 1 }`; detail `" character 90000001: 2 records, 1 corporations queued"`.
  - `known_corporations_queue_nothing` — hepsi bilinen → publisher çağrılmaz, `Saved { queued: 0 }`.
  - `a_repeated_corporation_is_queued_once` — iki kayıt aynı corp → ids `[98000002]`.
  - `existing_records_are_updated` — önceden `record_id` 1 farklı corp ile var → yeni corp'a güncellenir.
  - `an_empty_history_still_stamps_and_queues_nothing` — önceden eski `fetched_at`'li bir satır, ESI `[]` → satırın `fetched_at`'i yenilenir, `0 records, 0 corporations queued`.
  - `is_deleted_defaults_to_false` — kayıtta alan yok → `false`; `true` gelen kayıt `true`.
  - `an_esi_404_writes_nothing` — ESI 404 → `handle` `Err`, tabloda satır yok, publisher çağrılmaz.
  - `a_nack_fails_the_message` — `Recorder { fail: true }` → `handle` `Err`.
- [ ] **Step 2: Çalıştır** — `cd backend && DATABASE_URL="$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')" cargo test --manifest-path ../backend-rs/Cargo.toml -p worker-character-corporation-history` → derleme hatası.
- [ ] **Step 3: `lib.rs`'i yaz.** ESI yolu `/characters/{id}/corporationhistory/` (sonda `/`). `fetched_at` için `Utc::now()`.
- [ ] **Step 4: Çalıştır** — aynı komut, 8 PASS.
- [ ] **Step 5: `main.rs`** — `worker-info-corporations/src/main.rs` gibi `runner::run(|r| CorporationHistoryWorker { pool: r.pool, esi: r.esi })`. package.json:
      `"worker:character-corporation-history:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-character-corporation-history"`, Node satırının altına.
- [ ] **Step 6: Doğrula** — `cd backend-rs && cargo fmt --check && cargo clippy --all-targets -- -D warnings`, temiz.
- [ ] **Step 7: Commit** — `feat(rust): worker-character-corporation-history`

### Task 3: Rust `queue-character-corporation-history`

**Files:**

- Create: `backend-rs/queues/queue-character-corporation-history/{Cargo.toml,src/lib.rs,src/main.rs,tests/ids.rs}`
- Create: `.../tests/fixtures/{characters,character_corporation_history}.sql` (`queue-character-corporations` fixture'larından kopya)
- Modify: `backend/package.json` (`queue:character-corporation-history:rs`), `backend-rs/Cargo.lock`

**Interfaces:**

- Produces: `QUEUE_NAME = "esi_character_corporation_history_queue"`, `SOURCE = "queue-character-corporation-history"`,
  `pub fn parse_ids(args: &[String]) -> Vec<i32>` (`queue-characters`'takiyle aynı),
  `pub async fn stale_character_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>>` (Node SQL'i).

- [ ] **Step 1: Failing testler** — `tests/ids.rs`, satırlar test içinde `sqlx::query` ile; `#[sqlx::test(migrations = false, fixtures("characters", "character_corporation_history"))]`:
  - `never_fetched_is_stale` — geçmişi olmayan karakter → listede.
  - `older_than_six_days_is_stale` — `MAX(fetched_at)` 7 gün önce → listede.
  - `fetched_recently_is_not_stale` — 1 gün önce → listede değil.
  - `the_newest_fetch_decides` — bir satır 10 gün, bir satır 1 gün önce → listede değil.
  - `ids_come_in_order` — `[90000001, 90000002, 90000003]`.
  - `parse_ids_rejects_partial_numbers` — `["12abc"]` → boş.
    Damgalar `(NOW() AT TIME ZONE 'UTC') - INTERVAL 'n days'` ile yazılır.
- [ ] **Step 2: Çalıştır** — Task 2 Step 2 komutu, `-p queue-character-corporation-history` → derleme hatası.
- [ ] **Step 3: `lib.rs`'i yaz**, Step 2 komutuyla 6 PASS.
- [ ] **Step 4: `main.rs`** — `queue-characters/src/main.rs` yapısı. Log metinleri Node'un:
      `fetching stale character IDs from database...`, `found {n} stale characters`,
      argümanla `queueing {n} specific character(s): {list}`, geçersiz argüman
      `invalid character IDs provided` + çıkış 1, `adding to queue: {QUEUE_NAME}`,
      batch `debug!` yalnızca `ids.len() > BATCH_SIZE`, `✅ all {n} character(s) queued successfully!`,
      `now run the worker: yarn worker:character-corporation-history:rs`, hata
      `failed to queue character corporation history: {e:#}` + çıkış 1.
      package.json: `"queue:character-corporation-history:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-character-corporation-history"`.
- [ ] **Step 5: Doğrula** — fmt, clippy temiz.
- [ ] **Step 6: Commit** — `feat(rust): queue-character-corporation-history publisher`

### Task 4: Node confirm'li yayın, worker ve queue script

**Files:**

- Modify: `backend/src/queues/publish-entities.ts` (yeni export)
- Modify: `backend/src/queues/publish-entities.spec.ts`
- Modify: `backend/src/workers/worker-character-corporation-history.ts`
- Modify: `backend/src/workers/worker-character-corporation-history.spec.ts`
- Modify: `backend/src/queues/queue-character-corporation-history.ts`

**Interfaces:**

- Consumes: `getRabbitMQConfirmChannel()` (`rabbitmq.ts`), `publishEntitiesConfirmed` (mevcut).
- Produces:
  - `sendEntitiesConfirmed(channel: amqp.ConfirmChannel, queue: string, source: string, ids: number[]): Promise<number>` — her ID için `sendToQueue(queue, body, { persistent: true }, callback)`; her callback bir promise; kanal `'close'` ya da `'error'` yayarsa bekleyenlerin hepsi reddedilir (dinleyiciler iş bitince kaldırılır). Kanalı **kapatmaz**. `ids.length` döner; boş listede hiçbir şey göndermeden `0`.
  - `processCharacter(channel: amqp.ConfirmChannel, characterId: number): Promise<{ records: number; missingCorporations: number }>` — yayını `sendEntitiesConfirmed` ile yapar ve bekler.

- [ ] **Step 1: Failing testler — `publish-entities.spec.ts`**, `sendEntitiesConfirmed` için `EventEmitter` tabanlı sahte kanal (`sendToQueue` callback'i testin kontrolünde):
  - `resolves once every send is acked` — iki ID, iki callback `null` → `2`.
  - `rejects when one send is nacked` — ikinci callback `new Error('nack')` → reddeder.
  - `rejects pending sends when the channel closes` — callback çağrılmadan `emit('close')` → reddeder.
  - `sends nothing for an empty list` — `0`, `sendToQueue` çağrılmaz.
  - `does not close the channel` — `close` çağrılmaz.
- [ ] **Step 2: Failing testler — worker spec**, mevcut `vi.mock` düzeniyle:
  - mevcut üç test `sendEntitiesConfirmed` mock'una göre güncellenir (kuyruk, source, ids aynı beklentiler).
  - `does not resolve before the corporation messages are confirmed` — mock bekleyen bir promise döner; `processCharacter` henüz çözülmemiş; mock çözülünce çözülür.
  - `rejects when publishing fails, so the character is not acked` — mock reddeder → `processCharacter` reddeder.
- [ ] **Step 3: Çalıştır** — `yarn workspace backend vitest run src/queues/publish-entities.spec.ts src/workers/worker-character-corporation-history.spec.ts` → yeni testler FAIL.
- [ ] **Step 4: Uygula** — `sendEntitiesConfirmed` yazılır, `processCharacter` ona geçer. Worker döngüsünde her turda `getRabbitMQChannel()`'dan sonra `const confirmChannel = await getRabbitMQConfirmChannel()`; consume callback'i `processCharacter(confirmChannel, …)` çağırır. Confirm kanalı `'error'` / `'close'` yayarsa tüketim kanalıyla aynı şekilde döngü yeniden bağlanır; tur sonunda kanal `close().catch(() => {})` ile kapatılır. `channel.ack(msg)` yeri değişmez: `processCharacter` çözüldükten sonra.
- [ ] **Step 5: Queue script** — `queue-character-corporation-history.ts`'teki elle döngü ve `channel.close()` yerine `publishEntitiesConfirmed(QUEUE_NAME, 'queue-character-corporation-history', characterIds, { onBatch })`; `onBatch` yalnızca `characterIds.length > 100` iken bugünkü `debug` satırını yazar. `BATCH_SIZE` ve `getRabbitMQChannel` importu kalkar.
- [ ] **Step 6: Çalıştır** — Step 3 komutu PASS; ardından `yarn workspace backend test` ve `yarn workspace backend build` PASS.
- [ ] **Step 7: Commit** — `fix: character corporation history acks only after its corporation messages are confirmed`

### Task 5: Dokümanlar ve elle doğrulama

**Files:**

- Modify: `backend/docs/workers/character-corporation-history.md` (komut tablosu)
- Modify: `backend/docs/ops/daily.md` (yalnızca bu komutlar geçiyorsa)

- [ ] **Step 1:** Komut tablosunda `queue:character-corporation-history` (iki satır) ve `worker:character-corporation-history` satırları `:rs` komutuna, Node adı parantezde: `` `yarn worker:character-corporation-history:rs` (Node: `worker:character-corporation-history`) ``. Tablo altındaki "queue script exits…" paragrafı değişmez.
- [ ] **Step 2:** `grep -n "character-corporation-history" backend/docs/ops/daily.md`; geçiyorsa aynı biçimde.
- [ ] **Step 3: Elle çalıştırma** (lokal RabbitMQ): `cd backend && yarn queue:character-corporation-history:rs 365974960`, sonra `yarn worker:character-corporation-history:rs`. Expected: `✅ all 1 character(s) queued successfully!`; worker'da `  ✅ [1] character 365974960: N records, M corporations queued`, `0` olsa da `✅`; `psql`'de o karakterin `MAX(fetched_at)`'i birkaç saniye önce.
- [ ] **Step 4: Doğrula** — `npx prettier --check` değişen md dosyaları.
- [ ] **Step 5: Commit** — `docs: character corporation history has Rust versions`
