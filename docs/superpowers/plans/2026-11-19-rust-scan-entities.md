# Rust `scan:entities` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scan:entities`'in Rust karşılığını dört küçük queue crate'i ve bir
zincir olarak eklemek; Node sürümünü bellekte taramadan aynı dört SQL'e ve
onaylı yayına geçirmek.

**Architecture:** Her Rust crate `backend-rs/queues/queue-character-corporations`
kopyası: `lib.rs`'te `QUEUE_NAME`, `SOURCE` ve tek bir anti-join,
`main.rs`'te sorgu → bağlan → `declare_worker_queue` →
`mq::publish_entities(…, Some(5), …)`. `scan:entities:rs` dördünü `&&` ile
zincirler. Node script'i aynı dört SQL'i `$queryRaw` ile çalıştırıp
`publishEntitiesConfirmed` ile yayınlar.

**Tech Stack:** Rust (sqlx 0.8, lapin 2, `mq`/`db`/`runner` crate'leri),
TypeScript (Prisma `$queryRaw`, amqplib).

**Spec:** `docs/superpowers/specs/2026-11-19-rust-scan-entities-design.md`

## Global Constraints

- `source` her yerde `killmail_scan`, öncelik `5`, mesaj
  `{ entityId, queuedAt, source }`, `persistent`.
- Kuyruklar: `esi_character_info_queue`, `esi_corporation_info_queue`,
  `esi_alliance_info_queue`, `esi_type_info_queue`.
- NPC filtresi yok.
- Rust'ta `sqlx::query!` makrosu değil `sqlx::query_scalar` fonksiyonu: CI
  `SQLX_OFFLINE=true` ile derliyor.
- Liste boşsa `✅ no missing <domain> to queue!` yazıp RabbitMQ'ya
  bağlanmadan exit 0; zincir sürmeli.
- systemd unit'i eklenmez. Node script silinmez, bölünmez, taşınmaz.
- Yarn, asla npm. Commit'lerde Claude atfı yok. Commit mesajları İngilizce.

## Review Focus

1. **NULL kaynak sütunlar** (yapı victim'inde `character_id`, NPC attacker'da
   `corporation_id`/`weapon_type_id`) → kuyruğa girmemeli, sorgu NULL
   döndürmemeli. Her crate'te `nulls_are_skipped` testi.
2. **Aynı ID hem victim'de hem attacker'da** (ya da type için ship, weapon ve
   item'da) → bir kez. Her crate'te `duplicates_are_queued_once`.
3. **Hiç eksik yok** → RabbitMQ'ya bağlanmadan exit 0, böylece `&&` zinciri
   kırılmaz. Task 5 Step 3'teki elle çalıştırma.
4. **Hedef tabloda olan ID** → düşmeli. Her crate'te `known_ids_are_dropped`.
5. **Node'da bir domain boş, sonrakiler dolu** → boş olan atlanır, diğerleri
   yine yayınlanır, script exit 0. Task 5 Step 3.

---

### Task 1: `queue-killmail-characters` crate'i

**Files:**

- Create: `backend-rs/queues/queue-killmail-characters/Cargo.toml` (
  `queue-character-corporations`'ınkiyle aynı bağımlılıklar)
- Create: `backend-rs/queues/queue-killmail-characters/src/lib.rs`
- Create: `backend-rs/queues/queue-killmail-characters/src/main.rs`
- Create: `backend-rs/queues/queue-killmail-characters/tests/ids.rs`
- Create: `backend-rs/queues/queue-killmail-characters/tests/fixtures/{killmails,victims,attackers,characters}.sql`
- Modify: `backend/package.json` (script), `backend-rs/Cargo.lock` (cargo
  yazar)

**Interfaces:**

- Produces: `pub const QUEUE_NAME: &str = "esi_character_info_queue";`,
  `pub const SOURCE: &str = "killmail_scan";`,
  `pub async fn missing_character_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>>`.
  Task 2–4 aynı yapıyı izler.

- [ ] **Step 1: Fixture'ları üret.** `queue-character-corporations/tests/fixtures/corporations.sql`
      başındaki `pg_dump` komutu ve yorum bloğuyla, tablo başına bir dosya.
      `characters.sql` o crate'ten kopyalanabilir. `victims` ve `attackers`
      `killmails`'e FK taşıdığı için testlerde `fixtures("killmails", …)`
      önce gelir. `attackers.id` bir sequence'a bağlıysa testte `id`
      açıkça verilir ve fixture'a sequence eklenmez.

- [ ] **Step 2: Başarısız testleri yaz** (`tests/ids.rs`). Yardımcılar:
      `killmail(pool, id)`, `victim(pool, km, character_id: Option<i32>)`,
      `attacker(pool, km, id: i64, character_id: Option<i32>)`,
      `character(pool, id)`.
  - `victim_characters_are_queued`: victim 90000002 → `[90000002]`
  - `attacker_characters_are_queued`: attacker 90000003 → `[90000003]`
  - `duplicates_are_queued_once`: 90000001 hem victim hem iki attacker →
    `[90000001]`
  - `nulls_are_skipped`: victim `None`, attacker `None` → `[]`
  - `known_ids_are_dropped`: victim 90000001, `characters`'ta 90000001 → `[]`
  - `ids_are_ascending`: 90000009 ve 90000004 → `[90000004, 90000009]`

- [ ] **Step 3: Testin başarısız olduğunu gör.**
      Run: `cd backend && DATABASE_URL="$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')" cargo test --manifest-path ../backend-rs/Cargo.toml -p queue-killmail-characters`
      Expected: derleme hatası, `missing_character_ids` yok.

- [ ] **Step 4: `lib.rs` ve `main.rs`'i yaz.** SQL spec'in Hedefler 2'deki
      characters sorgusu. `main.rs` `queue-character-corporations/src/main.rs`'in
      aynısı; farklar: sorgu, `Some(5)` öncelik, log metinleri
      (`scanning killmails for missing characters...`,
      `found N missing characters`, `✅ no missing characters to queue!`,
      `queued batch i/n (k characters)` debug, `✅ all N missing characters
queued successfully!`, `now run the worker: yarn worker:info:characters:rs`),
      hata mesajı `failed to queue killmail characters`.
      `package.json`: `"queue:killmail-characters:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-killmail-characters"`.

- [ ] **Step 5: Testlerin geçtiğini gör.**
      Run: Step 3'teki komut, sonra `cd ../backend-rs && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
      Expected: 6 PASS, uyarısız.

- [ ] **Step 6: Commit**

```bash
git add backend-rs/queues/queue-killmail-characters backend-rs/Cargo.lock backend/package.json
git commit -m "feat(backend-rs): queue missing killmail characters"
```

### Task 2: `queue-killmail-corporations` crate'i

Task 1'in aynısı; farklar:

- `QUEUE_NAME = "esi_corporation_info_queue"`,
  `missing_corporation_ids(pool) -> sqlx::Result<Vec<i32>>`.
- Kaynak `victims.corporation_id` (NOT NULL) ∪ `attackers.corporation_id`.
  Hedef `corporations`; fixture `queue-character-corporations`'tan kopyalanır.
- `nulls_are_skipped` yalnızca attacker tarafında `None` dener (victim'de
  sütun NOT NULL).
- Script `queue:killmail-corporations:rs`, worker adı
  `yarn worker:info:corporations:rs`, log'da `corporations`.
- Commit: `feat(backend-rs): queue missing killmail corporations`.

### Task 3: `queue-killmail-alliances` crate'i

Task 1'in aynısı; farklar:

- `QUEUE_NAME = "esi_alliance_info_queue"`,
  `missing_alliance_ids(pool) -> sqlx::Result<Vec<i32>>`.
- Kaynak `victims.alliance_id` ∪ `attackers.alliance_id`, ikisi de nullable.
  Hedef `alliances`; fixture `worker-info-alliances/tests/fixtures/alliances.sql`'den.
- Script `queue:killmail-alliances:rs`, worker adı
  `yarn worker:info:alliances:rs`, log'da `alliances`.
- Commit: `feat(backend-rs): queue missing killmail alliances`.

### Task 4: `queue-killmail-types` crate'i ve zincir

Task 1'in aynısı; farklar:

- `QUEUE_NAME = "esi_type_info_queue"`,
  `missing_type_ids(pool) -> sqlx::Result<Vec<i32>>`.
- Kaynak dört sütunun `UNION`'ı: `victims.ship_type_id`,
  `attackers.ship_type_id`, `attackers.weapon_type_id`,
  `killmail_items.item_type_id`. Hedef `types`; fixture
  `queue-types/tests/fixtures/types.sql`'den, ayrıca `killmail_items.sql`.
- Testlerde `victim_characters_are_queued` / `attacker_…` yerine her kaynak
  için bir test: `victim_ships_are_queued`, `attacker_ships_are_queued`,
  `attacker_weapons_are_queued`, `items_are_queued`.
  `duplicates_are_queued_once`: aynı type ship, weapon ve item olarak →
  bir kez. `nulls_are_skipped`: attacker `ship_type_id` ve
  `weapon_type_id` `None`.
- Script `queue:killmail-types:rs`, worker adı `yarn worker:info:types:rs`,
  log'da `types`. Ayrıca zincir:
  `"scan:entities:rs": "yarn queue:killmail-characters:rs && yarn queue:killmail-corporations:rs && yarn queue:killmail-alliances:rs && yarn queue:killmail-types:rs"`.
- Commit: `feat(backend-rs): queue missing killmail types; scan:entities:rs chain`.

### Task 5: Node `scan-killmail-entities.ts`

**Files:**

- Modify: `backend/src/workers/scan-killmail-entities.ts` (baştan yazılır)

**Interfaces:**

- Consumes: `publishEntitiesConfirmed(queue, source, ids, { priority, onBatch })`
  (`backend/src/queues/publish-entities.ts`), `ensureAllQueuesExist()`.

- [ ] **Step 1: Script'i yeniden yaz.** `queue-character-corporations.ts`
      biçiminde, `logger` ile. Dört domain için bir tablo
      (`{ label, queue, worker, sql }`); her biri için `$queryRaw` (Task 1–4'teki
      SQL'in birebir aynısı) → `found N missing <label>` → N = 0 ise
      `✅ no missing <label> to queue!` ve sonraki domain → değilse
      `publishEntitiesConfirmed(queue, 'killmail_scan', ids, { priority: 5, onBatch })`
      → `✅ all N missing <label> queued successfully!`. Domain'ler sırayla
      çalışır. `ensureAllQueuesExist()` ilk yayından önce bir kez. Sonda
      hiçbir şey kuyruğa girmediyse bile exit 0; çalıştırılacak worker'lar
      yalnızca kuyruğa bir şey giren domain'ler için yazılır. Hata yolunda
      `logger.error('scanner failed', { error })` ve exit 1. `isNPC*`
      fonksiyonları, `BATCH_SIZE` ve `EntityQueueMessage` gider.

- [ ] **Step 2: Typecheck.**
      Run: `yarn workspace backend build`
      Expected: `tsc` hatasız.

- [ ] **Step 3: Elle çalıştır (Review Focus 3 ve 5).** RabbitMQ açıkken
      `yarn scan:entities`, ardından `yarn scan:entities:rs`.
      Expected: Node'da types için `✅ no missing types to queue!`, diğer üçü
      `found N` (bugün 140 / 1 / 1 civarı) ve `✅ all N …`, exit 0. Rust
      zinciri dört parçayı da çalıştırır (types parçası RabbitMQ'ya
      bağlanmadan çıkar), aynı N'leri yazar. Kuyruklarda iki çalıştırmanın
      mesajları birikir; info worker'lar upsert ettiği için zararsız.

- [ ] **Step 4: Commit**

```bash
git add backend/src/workers/scan-killmail-entities.ts
git commit -m "fix: scan:entities finds missing entities with four anti-joins and waits for confirms"
```

### Task 6: Dokümanlar

**Files:**

- Modify: `backend/docs/ops/daily.md` (satır 7, 199–210, 268, worker tablosu)
- Modify: `backend/docs/workers/enrichment.md` (16, 35, 83)
- Modify: `backend/docs/workers/worker-documentation.md` (146–153, 421, 434, 587)
- Modify: `CLAUDE.md` (348, "Entity enrichment")
- Modify: `README.md` (110)

- [ ] **Step 1: Düzenle.** `daily.md`: giriş artık "every step has a Rust
      version" der, Node-only cümlesi ve "Scenario 2"deki not kalkar, komut
      `scan:entities:rs` (Node: `scan:entities`) olur ve zinciri açıklayan bir
      satır eklenir; dört `queue:killmail-*:rs` "What Each Command Does"
      bölümüne tek bir madde olarak girer. Diğer dosyalarda "scans all
      killmails / walks killmails" anlatımı "four SQL anti-joins over victims,
      attackers and killmail items" olur ve `:rs` komutu anılır. `CLAUDE.md`'de
      NPC cümlesi `scan:entities`'in NPC filtrelemediğini açıkça söyler
      (predicate'in `queue-alliance-corporation-characters.ts`'te olduğu
      kalır).

- [ ] **Step 2: Kontrol.**
      Run: `npx prettier --check <değişen md dosyaları>` ve CLAUDE.md'deki link
      `grep` komutu.
      Expected: prettier temiz, yeni link yok ya da hepsi göreli.

- [ ] **Step 3: Commit**

```bash
git add backend/docs CLAUDE.md README.md
git commit -m "docs: scan:entities runs in Rust; daily.md has no Node-only step left"
```

### Task 7: Tam doğrulama

- [ ] **Step 1:** `qa` agent'ına arka planda tam seti çalıştır (`yarn test`,
      `yarn workspace backend build`, frontend lint sayısı main ile, prettier,
      `cargo test`/`fmt`/`clippy` workspace genelinde). Expected: hepsi PASS,
      lint sayısı main ile aynı ve değişen dosyaların hiçbiri lint listesinde
      yok.
