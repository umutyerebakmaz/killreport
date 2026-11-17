# Rust `queue:character-corporations` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `queue:character-corporations`'ın Rust karşılığını eklemek ve Node
sürümünün mesajları broker onayı beklemeden kaybedebilmesini düzeltmek.

**Architecture:** Rust tarafı `backend-rs/queues/queue-corporations`'ın
kopyası; yalnızca ID sorgusu Node'daki anti-join. Node tarafına
`publishEntitiesConfirmed` adlı, confirm channel üzerinden yayınlayıp
`waitForConfirms()` bekleyen bir yardımcı gelir; `scan:entities` sonraki PR'da
aynısını kullanacak.

**Tech Stack:** Rust (sqlx 0.8, lapin 2, `mq`/`db`/`runner` crate'leri),
TypeScript (amqplib, vitest).

**Spec:** `docs/superpowers/specs/2026-11-17-rust-character-corporations-queue-design.md`

## Global Constraints

- Kuyruk `esi_corporation_info_queue`, `source` `queue-character-corporations`,
  mesaj `{ entityId, queuedAt, source }`, `persistent`, öncelik yok.
- SQL Node'dakiyle birebir (`queue-character-corporations.ts:24-35`).
- Rust'ta `sqlx::query!` makrosu değil `sqlx::query_scalar` fonksiyonu: CI
  `SQLX_OFFLINE=true` ile derliyor, makro `.sqlx` cache'i ister.
- systemd unit'leri, diğer Node queue script'leri ve Node script'in varlığı
  değişmez.
- Yarn, asla npm. Commit'lerde Claude atfı yok. Commit mesajları İngilizce.

## Review Focus

1. **Aynı corporation hem `characters`'ta hem geçmişte** → bir kez kuyruğa
   girmeli. Task 2'deki `union_is_deduplicated` testi.
2. **Hiç eksik yok** → RabbitMQ'ya bağlanmadan `✅ no missing corporations to
queue!` ve çıkış 0. Task 2'de `nothing_missing_is_empty` sorgu tarafını
   sabitler; bağlanmama `main.rs`'teki erken dönüş, review'da bakılır.
3. **Broker nack** → Node'da `waitForConfirms()` reddeder, script `failed to
queue character corporations` loglayıp 1 ile çıkar. Task 1'deki
   `rejects when the broker nacks` testi.
4. **Confirm channel kapanmadan çıkış** → yardımcı kanalı `finally` içinde
   kapatır; Task 1'deki `closes the confirm channel even on nack` testi.
5. **`corporations`'ta olan ID** → kuyruğa girmez. Task 2'deki
   `known_corporations_are_dropped`.

---

### Task 1: Node onaylı yayın yardımcısı ve Node script'i

**Files:**

- Modify: `backend/src/services/rabbitmq.ts` (yeni export, `getRabbitMQChannel`'ın altına)
- Create: `backend/src/services/publish-entities.ts`
- Create: `backend/src/services/publish-entities.spec.ts`
- Modify: `backend/src/queues/queue-character-corporations.ts:46-79`

**Interfaces:**

- Produces:
  - `getRabbitMQConfirmChannel(): Promise<amqp.ConfirmChannel>` — rabbitmq.ts'te;
    `getRabbitMQChannel()` ile bağlantının açık olmasını sağlar, sonra
    paylaşılan `connection` üzerinde `createConfirmChannel()` döner. Her çağrı
    yeni kanal; önbelleklenmez.
  - `publishEntitiesConfirmed(queue: string, source: string, ids: number[], options?: { priority?: number; onBatch?: (batch: number, totalBatches: number, size: number) => void }): Promise<number>`
    — publish-entities.ts'te. `BATCH_SIZE = 100`. Her ID için
    `sendToQueue(queue, JSON {entityId, queuedAt: new Date().toISOString(), source}, { persistent: true, priority? })`;
    `priority` yalnızca verildiyse yazılır. Her 100'lük grubun sonunda
    `onBatch(i, n, len)` (1'den sayar). Sonra `await waitForConfirms()`, `finally`
    içinde `await channel.close()`. `ids.length` döner.

- [ ] **Step 1: Failing test yaz** — `publish-entities.spec.ts`,
      `publish-killmail-details.spec.ts`'teki `vi.hoisted` + `vi.mock('@services/rabbitmq', () => ({ getRabbitMQConfirmChannel }))` deseniyle;
      sahte kanal `{ sendToQueue: vi.fn(), waitForConfirms: vi.fn(async () => {}), close: vi.fn(async () => {}) }`.
      Testler:
  - `publishes one persistent message per id, in order` — `[7, 8]` ile:
    dönüş `2`; `sendToQueue` 2 kez; ilk çağrı kuyruğu `esi_corporation_info_queue`,
    gövde `{ entityId: 7, source: 'queue-character-corporations', queuedAt: expect.any(String) }`,
    seçenekler `{ persistent: true }` (`priority` anahtarı yok).
  - `passes priority when given` — `{ priority: 5 }` → seçenekler `{ persistent: true, priority: 5 }`.
  - `reports batches of 100` — 250 ID, `onBatch` çağrıları `[1,3,100]`, `[2,3,100]`, `[3,3,50]`.
  - `waits for confirms before resolving` — `waitForConfirms` 1 kez çağrılmış.
  - `rejects when the broker nacks` — `waitForConfirms` reddeder → `publishEntitiesConfirmed` aynı hatayla reddeder.
  - `closes the confirm channel even on nack` — aynı senaryoda `close` 1 kez.

- [ ] **Step 2: Çalıştır, fail ettiğini gör**
      Run: `yarn workspace backend vitest run src/services/publish-entities.spec.ts`
      Expected: FAIL, `./publish-entities` bulunamıyor.

- [ ] **Step 3: `getRabbitMQConfirmChannel` ve `publishEntitiesConfirmed`'ı yaz** (Interfaces'teki imzalar).

- [ ] **Step 4: Testi geçir**
      Run: aynı komut. Expected: 6 test PASS.

- [ ] **Step 5: Node script'ini yardımcıya geçir** — `queue-character-corporations.ts`'teki
      elle döngü ve `channel.close()` yerine `await ensureAllQueuesExist()` +
      `await publishEntitiesConfirmed(QUEUE_NAME, 'queue-character-corporations', missingCorporationIds, { onBatch })`.
      `onBatch` bugünkü metni `info` ile yazar:
      `` `queued batch ${batch}/${total} (${size} corporations)` ``. Başarı satırı
      dönüş değerini kullanır. `BATCH_SIZE` sabiti ve `getRabbitMQChannel` importu kalkar.
      Boş liste dalı ve `catch` → `process.exit(1)` aynen kalır.

- [ ] **Step 6: Doğrula**
      Run: `yarn workspace backend test` ve `yarn workspace backend build`
      Expected: hepsi PASS, `tsc` hatasız.

- [ ] **Step 7: Commit**
  ```bash
  git add backend/src/services/rabbitmq.ts backend/src/services/publish-entities.ts backend/src/services/publish-entities.spec.ts backend/src/queues/queue-character-corporations.ts
  git commit -m "fix: queue:character-corporations waits for publisher confirms"
  ```

### Task 2: Rust `queue-character-corporations` crate'i

**Files:**

- Create: `backend-rs/queues/queue-character-corporations/Cargo.toml` (`queue-corporations/Cargo.toml`'un aynısı, `name` farklı)
- Create: `backend-rs/queues/queue-character-corporations/src/lib.rs`
- Create: `backend-rs/queues/queue-character-corporations/src/main.rs`
- Create: `backend-rs/queues/queue-character-corporations/tests/ids.rs`
- Create: `backend-rs/queues/queue-character-corporations/tests/fixtures/{corporations,characters,character_corporation_history}.sql`
- Modify: `backend/package.json` (script), `backend-rs/Cargo.lock` (cargo yazar)

**Interfaces:**

- Consumes: `mq::{connect, declare_worker_queue, publish_entities, BATCH_SIZE}`, `db::worker_pool`, `runner::init` — `queue-corporations/src/main.rs`'teki kullanımla aynı.
- Produces: `pub const QUEUE_NAME: &str = "esi_corporation_info_queue";`,
  `pub const SOURCE: &str = "queue-character-corporations";`,
  `pub async fn missing_corporation_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>>`
  (Node SQL'i, `sqlx::query_scalar`).

- [ ] **Step 1: Fixture'ları üret** — `corporations.sql` şablonu
      `queue-corporations/tests/fixtures/corporations.sql`'den kopyalanır; `characters`
      ve `character_corporation_history` için aynı dosyanın başındaki
      `pg_dump --schema-only --table=<tablo> ...` komutu çalıştırılır, aynı başlık
      yorumu eklenir. Satır fixture'ları her testin içinde `sqlx::query` ile
      eklenir, ayrı dosya yok.

- [ ] **Step 2: Failing testleri yaz** — `tests/ids.rs`, hepsi
      `#[sqlx::test(migrations = false, fixtures("corporations", "characters", "character_corporation_history"))]`:
  - `current_corporations_are_queued` — iki karakter, corp `98000002` ve `98000001`, `corporations` boş → `[98000001, 98000002]`.
  - `history_corporations_are_queued` — karakter corp `98000001`, geçmişte `98000003` → `[98000001, 98000003]`.
  - `union_is_deduplicated` — karakter ve geçmiş ikisi de `98000001` → `[98000001]`.
  - `known_corporations_are_dropped` — karakter corp `98000001` ve `98000002`, `corporations`'ta `98000001` var → `[98000002]`.
  - `nothing_missing_is_empty` — tablolar boş → boş.

- [ ] **Step 3: Çalıştır, fail ettiğini gör**
      Run: `cd backend && DATABASE_URL="$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')" cargo test --manifest-path ../backend-rs/Cargo.toml -p queue-character-corporations`
      Expected: derleme hatası, `missing_corporation_ids` yok.

- [ ] **Step 4: `lib.rs`'i yaz**, testleri geçir (aynı komut, 5 PASS).

- [ ] **Step 5: `main.rs`'i yaz** — `queue-corporations/src/main.rs` yapısı, komut satırı
      argümanı yok. Log satırları Node'la aynı metin:
      `scanning characters and their corporation history for missing corporations...`,
      `found {n} missing corporations`; boşsa `✅ no missing corporations to queue!`
      ve bağlanmadan `Ok(())`; `adding to queue: {QUEUE_NAME}`; batch satırı
      `debug!("queued batch {batch}/{total} ({len} corporations)")`;
      `✅ all {queued} missing corporations queued successfully!`;
      `now run the worker: yarn worker:info:corporations:rs`. Hata:
      `failed to queue character corporations: {e:#}`, çıkış 1.

- [ ] **Step 6: package.json script'i** — `queue:character-corporations`'ın altına:
      `"queue:character-corporations:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-character-corporations"`.

- [ ] **Step 7: Doğrula** (`backend-rs/` içinde)
      Run: `cargo fmt --check && cargo clippy --all-targets -- -D warnings` ve Step 3'teki test komutu.
      Expected: uyarısız, 5 PASS.

- [ ] **Step 8: Elle bir çalıştırma** (RabbitMQ lokal açık): `cd backend && yarn queue:character-corporations:rs`
      Expected: `found N missing corporations` ve N > 0 ise `✅ all N ...`; N, Node
      script'inin aynı anda bulduğu sayıyla aynı.

- [ ] **Step 9: Commit**
  ```bash
  git add backend-rs/queues/queue-character-corporations backend-rs/Cargo.lock backend/package.json
  git commit -m "feat(rust): queue-character-corporations publisher"
  ```

### Task 3: Dokümanlar

**Files:**

- Modify: `backend/docs/ops/daily.md` (giriş paragrafı, "Detect and Update Missing Corporations", Scenario 1 adım 4, Scenario 2)
- Modify: `backend/docs/workers/character-corporation-history.md:46`

- [ ] **Step 1:** `daily.md` — giriş: "One command is still Node only: `scan:entities`."
      "Detect and Update Missing Corporations" bloğu `yarn queue:character-corporations:rs`,
      "The queue script has no Rust version yet:" cümlesi kalkar. Scenario 1 adım 4
      `:rs`. Scenario 2'de "Both commands are Node only for now." → "`scan:entities`
      is Node only for now." ve ikinci komut `:rs`. Node adı her yerde
      `(Node: queue:character-corporations)` biçiminde parantezde anılır, dosyadaki
      diğer komutlar gibi.
- [ ] **Step 2:** `character-corporation-history.md:46` — tablo satırına Rust
      komutu da yazılır: `` `yarn queue:character-corporations:rs` (Node: `queue:character-corporations`) ``.
- [ ] **Step 3: Doğrula** — `npx prettier --check backend/docs/ops/daily.md backend/docs/workers/character-corporation-history.md` ve CLAUDE.md'deki link grep'i; yeni link eklenmediği için kırık link çıkmamalı.
- [ ] **Step 4: Commit**
  ```bash
  git add backend/docs/ops/daily.md backend/docs/workers/character-corporation-history.md
  git commit -m "docs: queue:character-corporations has a Rust version"
  ```

## Notlar

- Spec yardımcıyı `rabbitmq.ts` içinde tarif ediyordu; burada ayrı dosyada
  (`publish-entities.ts`), çünkü `rabbitmq.ts` amqplib'e doğrudan bağlı ve
  mevcut spec deseni (`@services/rabbitmq`'yu mock'lamak) ancak böyle test
  edilebiliyor. Kanalı açan kısım `rabbitmq.ts`'te kalıyor.
- Spec `enrichment.md`'yi de anıyordu; dosyada bu komut geçmiyor, değişmez.
