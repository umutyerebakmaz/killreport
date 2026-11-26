# Rust backfill values — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `queue:backfill-values` ve `worker:backfill-values`'un Rust
karşılıkları (`:rs`), değer formülü ayrı bir lib crate'inde; spec'teki dört
kusur iki tarafta da düzeltilmiş.

**Architecture:** `crates/killmail-value` saf hesap + tek SQL'lik tip
okuması. `runner` mesajdan `killmailId`'yi de okur, `mq` killmail mesajı
yayınlar. `workers/worker-backfill-values` runner üstünde, iki güncelleme tek
transaction'da. `queues/queue-backfill-values` keyset sayfalama ve publisher
confirm ile. Node kuyruk ve worker aynı düzeltmeleri alır.

**Tech Stack:** Rust 1.97 (sqlx 0.8, lapin 2, tokio), TypeScript (Prisma,
amqplib, vitest).

**Spec:** `docs/superpowers/specs/2026-11-26-rust-backfill-values-design.md`

## Global Constraints

- Kuyruk adı `backfill_killmail_values_queue`; `assertQueue` / declare
  `x-max-priority: 10` (Rust'ta `mq::declare_worker_queue` bunu yapar).
- Mesaj `{"killmailId":<i32>,"queuedAt":"<toISOString, ms, Z>","source":"queue-backfill-values"}`,
  alanlar bu sırada.
- Kapsül grubu 29, kapsül fiyatı 10 ISK, BPC (kategori adı `blueprint`,
  büyük/küçük harf duyarsız, `singleton = 2`) 0,01 ISK; fiyatı ya da tipi
  olmayan 0; yuvarlama `(x * 100).round() / 100`, toplama sırası önce gemi
  sonra item'lar sırayla, `total` ayrı biriktirilir (`destroyed + dropped`
  değil).
- Sayfa boyu 500, sıra `killmail_id DESC`.
- `now` uygulamadan UTC bağlanır (`Utc::now().naive_utc()`); SQL'de
  `CURRENT_TIMESTAMP` / `now()` yok.
- Workers `prisma-worker` / `db::worker_pool` kullanır.
- Commit mesajları İngilizce, Claude attribution yok.
- `.env`, generated dosyalar ve `prisma/schema` değişmez.
- Fixture'lar `pg_dump --schema-only` ile üretilir, başlıktaki komut
  `backend-rs/queues/queue-prices/tests/fixtures/types.sql`'deki gibi; elle
  yazılmaz.

## Review Focus

1. **Kuyruk çalışırken yeni killmail eklenmesi** — ilk sayfa da başlangıçtaki
   `MAX(killmail_id)` ile sınırlı olmalı; yoksa sayımdan sonra gelen yeni
   killmail'ler ilk sayfaya girip en eskileri `--limit` dışına iter.
   Test: Task 4 `new_rows_after_the_count_are_not_queued`.
2. **Grubu ya da kategorisi henüz olmayan tip** — `types` satırı var ama
   `item_groups` / `categories` satırı eksik (enrichment bitmemiş); tip
   haritadan düşmemeli, fiyatı okunmalı, `is_blueprint` false olmalı. Inner
   join bunu sessizce 0'a çevirirdi.
   Test: Task 1 `type_info_without_group_row`.
3. **`killmail_filters` satırı olmayan killmail** — eski killmail'lerin filtre
   satırı olmayabilir; worker hata vermemeli, `killmails` güncellenmeli.
   Test: Task 3 `updates_without_a_filters_row`.
4. **Bozuk ya da `entityId` taşıyan mesaj** — mevcut info worker'lar
   `entityId` ile çalışmaya devam etmeli; `killmailId` alias'ı onları
   değiştirmemeli. Test: Task 2 `parses_entity_id_and_killmail_id`.
5. **Geçersiz bayrak değeri** (`--limit=abc`, `--id=`) — Node sessizce NaN
   alıyordu; Rust başlarken hata verip 1 ile çıkmalı.
   Test: Task 4 `rejects_a_bad_limit`.

---

### Task 1: `crates/killmail-value`

**Files:**

- Create: `backend-rs/crates/killmail-value/Cargo.toml`, `src/lib.rs`
- Create: `backend-rs/crates/killmail-value/tests/compute.rs`,
  `tests/type_info.rs`, `tests/fixtures/{types,item_groups,categories,market_prices}.sql`
- Modify: `backend-rs/Cargo.toml` (`[workspace.dependencies]` sonuna
  `killmail-value = { path = "crates/killmail-value" }`)

**Interfaces:**

- Produces:

  ```rust
  pub const CAPSULE_GROUP_ID: i32 = 29;
  pub struct Item { pub type_id: i32, pub quantity_destroyed: Option<i32>,
                    pub quantity_dropped: Option<i32>, pub singleton: i32 }
  #[derive(Debug, Clone, Copy, PartialEq, Default)]
  pub struct TypeInfo { pub sell: f64, pub group_id: Option<i32>, pub is_blueprint: bool }
  #[derive(Debug, Clone, Copy, PartialEq)]
  pub struct Values { pub total: f64, pub destroyed: f64, pub dropped: f64 }
  impl Values { pub fn is_zero(&self) -> bool }  // üçü de == 0.0
  pub fn compute(ship_type_id: i32, items: &[Item], types: &HashMap<i32, TypeInfo>) -> Values;
  pub async fn type_info<'e>(executor: impl sqlx::PgExecutor<'e>, type_ids: &[i32])
      -> sqlx::Result<HashMap<i32, TypeInfo>>;
  ```

  Haritada olmayan tip `TypeInfo::default()` sayılır.

- [ ] **Step 1: `compute` testlerini yaz** (`tests/compute.rs`), Node
      `calculate-killmail-values.spec.ts`'teki değerlerle: RIFTER 587 sell
      500000 grup 25; AMMO 178 sell 10 grup 83; BPC tipi 999 sell 1000000,
      blueprint; CAPSULE 670 grup 29; GENOLUTION 33328 grup 29, sell 5000000.
  - `ship_only`: RIFTER, item yok → `{500000, 500000, 0}`.
  - `destroyed_and_dropped`: RIFTER + AMMO destroyed 100, dropped 50 →
    `{501500, 501000, 500}`.
  - `capsule_by_group`: 670 → `{10,10,0}`; 33328 → `{10,10,0}` (fiyatı
    5000000 olsa da).
  - `bpc_and_bpo`: 999 singleton 2 destroyed 1 → item 0,01; singleton 1 → 1000000.
  - `unknown_type_is_zero`: haritada olmayan gemi ve item → `{0,0,0}`,
    `is_zero()` true.
  - `none_quantities_are_zero`: iki quantity de `None` → yalnızca gemi.
  - `rounds_to_two_places`: AMMO sell 0.333, destroyed 3 + RIFTER sell 0 →
    destroyed `1.0` (0.999 → 1.0); sell 1.234, destroyed 1 → `1.23`.
- [ ] **Step 2: Çalıştır, derlenmediğini gör.**
      `cargo test -p killmail-value --test compute` → FAIL (crate yok).
- [ ] **Step 3: `compute`'u yaz.** Node'daki döngünün aynısı; `is_blueprint`
      ve `singleton == 2` → `BPC_VALUE = 0.01`, gemi grubu 29 → `CAPSULE_VALUE = 10.0`.
- [ ] **Step 4: Fixture'ları üret, `type_info` testlerini yaz**
      (`tests/type_info.rs`, `#[sqlx::test(migrations = false, fixtures("types",
"item_groups", "categories", "market_prices"))]`):
  - `type_info_joins_group_and_category`: tip 999 grup 700 kategori
    "Blueprint" → `is_blueprint` true; tip 587 kategori "Ship" → false,
    `group_id == Some(25)`, `sell` market_prices'tan.
  - `type_info_without_group_row`: tip 1234 grup 9999, `item_groups`'ta 9999
    yok, sell 7 → `sell == 7.0`, `group_id == Some(9999)`, `is_blueprint`
    false.
  - `type_info_unknown_type_is_absent`: hiçbir tabloda olmayan tip → haritada
    yok. (`market_prices.type_id` → `types.id` FK'lı, tipsiz fiyat olamaz.)
  - `type_info_empty_input`: `&[]` → boş harita, sorgu hatası yok.
- [ ] **Step 5: `type_info`'yu yaz.** Tek sorgu:
      `types` → `LEFT JOIN market_prices`, `LEFT JOIN item_groups`,
      `LEFT JOIN categories`, `WHERE t.id = ANY($1)`, `COALESCE(mp.sell, 0)`,
      `COALESCE(lower(c.name) = 'blueprint', false)`.
- [ ] **Step 6: Doğrula.** `cargo test -p killmail-value` PASS;
      `cargo clippy -p killmail-value --all-targets -- -D warnings` temiz;
      `cargo fmt --check`.
- [ ] **Step 7: Commit** — `feat(rust): killmail value formula crate`.

### Task 2: `runner` ve `mq`'da killmail mesajı

**Files:**

- Modify: `backend-rs/crates/runner/src/message.rs` (alana
  `#[serde(alias = "killmailId")]`, doc yorumu)
- Modify: `backend-rs/crates/mq/src/message.rs`, `src/publish.rs`, `src/lib.rs`
  (re-export)
- Test: mevcut test modülleri bu dosyalarda / `crates/mq/tests/`

**Interfaces:**

- Produces:

  ```rust
  // mq
  #[derive(Debug, Clone, PartialEq, Eq, Serialize)] #[serde(rename_all = "camelCase")]
  pub struct KillmailMessage { pub killmail_id: i32, pub queued_at: String, pub source: Cow<'static, str> }
  impl KillmailMessage { pub fn new(id, source) -> Self; pub fn at(id, source, now: DateTime<Utc>) -> Self; pub fn to_body(&self) -> Vec<u8> }
  /// Kanal zaten confirm modunda olmalı (publish_messages gibi).
  pub async fn publish_killmails(channel: &Channel, queue: &str, source: &'static str, ids: &[i32]) -> anyhow::Result<u64>;
  ```

  `runner::EntityQueueMessage::parse` hem `entityId` hem `killmailId`
  gövdesini kabul eder; `entity_id` alanı adı değişmez.
  `publish` / `await_confirms` iç yardımcıları gövde (`Vec<u8>`) alacak
  şekilde genelleştirilir; `publish_entities` / `publish_messages`
  davranışı değişmez.

- [ ] **Step 1: Testler.**
  - runner `parses_entity_id_and_killmail_id`: `{"entityId":1,...}` → 1;
    `{"killmailId":133900250,"queuedAt":"…","source":"queue-backfill-values"}`
    → 133900250; `{}` → hata.
  - mq `killmail_message_body_matches_node`:
    `KillmailMessage::at(133900250, "queue-backfill-values", 2026-11-26T10:00:00Z)`
    → tam olarak
    `{"killmailId":133900250,"queuedAt":"2026-11-26T10:00:00.000Z","source":"queue-backfill-values"}`.
- [ ] **Step 2: Çalıştır, FAIL gör.** `cargo test -p runner -p mq`.
- [ ] **Step 3: Uygula.**
- [ ] **Step 4: Doğrula.** `cargo test` (tüm workspace — info worker'lar
      etkilenmemeli), clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): read and publish killmailId queue messages`.

### Task 3: `workers/worker-backfill-values`

**Files:**

- Create: `backend-rs/workers/worker-backfill-values/{Cargo.toml,src/lib.rs,src/main.rs}`
- Create: `tests/handle.rs`, `tests/fixtures/{killmails,victims,killmail_items,killmail_filters,types,item_groups,categories,market_prices}.sql`
- Modify: `backend/package.json` (`worker:backfill-values:rs`, `worker:backfill-values`'ın altına,
  `cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-backfill-values`)

**Interfaces:**

- Consumes: `killmail_value::{compute, type_info, Item, Values}` (Task 1);
  `killmailId` parse (Task 2).
- Produces:

  ```rust
  pub struct BackfillWorker { pub pool: PgPool }
  impl Worker for BackfillWorker {
      QUEUE_NAME = "backfill_killmail_values_queue"; CONSUMER_TAG = "worker-backfill-values-rs";
      STARTED = "💰 backfill killmail values worker started"; WAITING_FOR = "killmails"; ENTITY = "killmail";
  }
  pub async fn backfill(pool: &PgPool, killmail_id: i32, now: NaiveDateTime) -> anyhow::Result<Backfilled>;
  pub enum Backfilled { NoKillmail, NoVictim, Zero, Saved(Values) }
  ```

  `handle` `backfill(.., Utc::now().naive_utc())` çağırır ve eşler:
  `NoKillmail` → `Unchanged`, detail `" {id} (not found)"`; `NoVictim` →
  `" {id} (no victim)"`; `Zero` → `" {id} (zero values)"`; `Saved(v)` →
  `Updated`, detail `" KM {id}: total={:.2}, destroyed={:.2}, dropped={:.2}"`.
  `summary` runner varsayılanı. main: `runner::run(|r| BackfillWorker { pool: r.pool })`.

- [ ] **Step 1: Testler** (`tests/handle.rs`, `#[sqlx::test(migrations = false, fixtures(...))]`,
      `backfill`'i doğrudan çağır, `now` sabit 2026-11-26 10:00:00):
  - `saves_both_tables`: RIFTER + AMMO killmail, filtre satırı var →
    `Saved`; `killmails` üç kolon `{501500, 501000, 500}`, `updated_at == now`;
    `killmail_filters.total_value == 501500`.
  - `updates_without_a_filters_row`: filtre satırı yok → `Saved`, `killmails`
    güncel.
  - `zero_values_leave_the_row`: fiyatsız gemi, önceden `total_value = 42` →
    `Zero`, `total_value` hâlâ 42, `updated_at` değişmemiş.
  - `missing_killmail` → `NoKillmail`; `killmail_without_victim` → `NoVictim`.
  - `rerun_is_the_same`: iki kez çalıştır, değerler aynı.
- [ ] **Step 2: FAIL gör.** `cargo test -p worker-backfill-values`.
- [ ] **Step 3: Uygula.** Okuma: killmail var mı, victim'ın `ship_type_id`'si,
      item'lar (`item_type_id, quantity_destroyed, quantity_dropped, singleton`,
      `ORDER BY id` — toplama sırası belirli olsun). Hesap Task 1. Yazma:
      `pool.begin()`, `UPDATE killmails SET total_value, destroyed_value,
dropped_value, updated_at = $now WHERE killmail_id = $1` (etkilenen satır
      1 değilse `bail!`), `UPDATE killmail_filters SET total_value WHERE
killmail_id`, commit.
- [ ] **Step 4: Doğrula.** `cargo test -p worker-backfill-values`, clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): backfill-values worker (worker:backfill-values:rs)`.

### Task 4: `queues/queue-backfill-values`

**Files:**

- Create: `backend-rs/queues/queue-backfill-values/{Cargo.toml,src/lib.rs,src/main.rs}`
- Create: `tests/args.rs`, `tests/pages.rs`, `tests/fixtures/{killmails,victims,types}.sql`
- Modify: `backend/package.json` (`queue:backfill-values:rs`)

**Interfaces:**

- Consumes: `mq::publish_killmails`, `mq::declare_worker_queue`, `mq::connect` (Task 2).
- Produces:

  ```rust
  pub const QUEUE_NAME: &str = "backfill_killmail_values_queue";
  pub const SOURCE: &str = "queue-backfill-values";
  pub const PAGE_SIZE: i64 = 500;
  #[derive(Debug, PartialEq, Default)]
  pub struct Args { pub limit: Option<i64>, pub id: Option<i32>, pub capsules_only: bool }
  pub fn parse_args(args: &[String]) -> Result<Args, String>;
  pub struct Target { pub count: i64, pub max_id: Option<i32> }
  pub async fn target(pool: &PgPool, args: &Args) -> sqlx::Result<Target>;
  /// `below` hariç, `killmail_id DESC`, en fazla `take`.
  pub async fn page(pool: &PgPool, args: &Args, below: i32, take: i64) -> sqlx::Result<Vec<i32>>;
  ```

  Filtre: `--id` → `killmail_id = $id`; `--capsules-only` →
  `EXISTS (victims v JOIN types t ON t.id = v.ship_type_id WHERE v.killmail_id = k.killmail_id AND t.group_id = 29)`
  (`killmail_value::CAPSULE_GROUP_ID`). main: `target` → 0 ise Node'daki
  mesajlar ve çıkış 0; değilse `channel.confirm_select` bir kez, imleç
  `max_id + 1`'den başlar, her sayfa `publish_killmails` ile onaylanır,
  `min(limit, count)`'a ulaşınca ya da boş sayfada durur. Loglar spec'teki
  gibi (`  📤 queued batch b (n/total - p%)`).

- [ ] **Step 1: Testler.**
  - `args.rs`: `[]` → default; `--limit=10000 --capsules-only --id=133900250`
    → hepsi dolu; `rejects_a_bad_limit`: `--limit=abc`, `--limit=0`,
    `--id=` → `Err`; bilinmeyen bayrak → `Err`.
  - `pages.rs` (`#[sqlx::test]`):
    - `pages_are_keyset_descending`: id 1..=1201 → `page(.., below=1202, 500)`
      1201..702; sonraki `below=702` 701..202; sonra 201..1.
    - `new_rows_after_the_count_are_not_queued`: 1..=10 için `target` →
      `max_id 10`; sonra 11 eklenir; `page(.., below=11, 500)` 11'i içermez.
    - `capsules_only_by_group`: victim gemileri 670, 33328 (ikisi grup 29) ve
      587 (grup 25) → yalnızca ilk iki killmail; `target.count == 2`.
    - `single_id`: var olan id → count 1; olmayan → count 0, `max_id None`.
- [ ] **Step 2: FAIL gör.** `cargo test -p queue-backfill-values`.
- [ ] **Step 3: Uygula.**
- [ ] **Step 4: Doğrula.** test, clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): backfill-values queue (queue:backfill-values:rs)`.

### Task 5: Node tarafı

**Files:**

- Modify: `backend/src/queues/publish-entities.ts` (option `idField?: 'entityId' | 'killmailId'`, varsayılan `'entityId'`)
- Modify: `backend/src/queues/queue-backfill-values.ts`
- Modify: `backend/src/workers/worker-backfill-values.ts`
- Test: `backend/src/queues/publish-entities.spec.ts`,
  Create `backend/src/queues/queue-backfill-values.spec.ts`,
  `backend/src/workers/worker-backfill-values.spec.ts`

**Interfaces:**

- Produces (Node):

  ```ts
  // queue-backfill-values.ts — modül sonunda `if (require.main === module)` ile çalışır
  export function parseArgs(argv: string[]): {
    limit?: number;
    id?: number;
    capsulesOnly: boolean;
  }; // geçersizde throw
  export async function backfillWhere(args): Promise<Prisma.KillmailWhereInput>; // kapsül: types group_id ∈ CAPSULE_GROUP_IDS → victim.ship_type_id in
  export async function queueBackfillValues(args): Promise<number>; // kuyruğa konan sayı
  // worker-backfill-values.ts
  export async function saveValues(killmailId: number, values): Promise<void>; // $transaction içinde update + $executeRaw
  ```

- [ ] **Step 1: Testler** (vitest, `vi.hoisted` + `vi.mock('@services/prisma-worker')`
      düzeni, `worker-sovereignty-correlate.spec.ts` gibi):
  - publish-entities: `idField: 'killmailId'` → gövde
    `{killmailId, queuedAt, source}` bu sırada; varsayılan `entityId`
    değişmemiş.
  - queue: `parseArgs` (Task 4'teki durumlar); keyset — ikinci
    `findMany` çağrısı `killmail_id: { lt: <ilk sayfanın son id'si>, lte: max }`
    ve `orderBy: { killmail_id: 'desc' }`, `skip` yok; ilk sorgu
    `killmail_id: { lte: max }`; kapsül filtresi grup 29'dan gelen tip
    listesini kullanıyor; her sayfa `publishEntitiesConfirmed(QUEUE, 'queue-backfill-values', ids, { idField: 'killmailId' })`.
  - worker: `saveValues` `$transaction` içinde hem `killmail.update` hem
    `killmail_filters` `$executeRaw`'ını çağırır; `$executeRaw` reddederse
    hata dışarı çıkar.
- [ ] **Step 2: FAIL gör.** `yarn workspace backend test -- queue-backfill-values worker-backfill-values publish-entities`.
- [ ] **Step 3: Uygula.** Kuyruk: `count` + `aggregate _max killmail_id`
      aynı `where`'le; imleç; `CAPSULE_TYPE_ID` kalkar. Worker: iki yazma
      `prismaWorker.$transaction(async (tx) => …)`; doğrulama satırı
      (`updated.total_value !==`) kalır ya da kalkar — kalkması tercih, Rust'la
      aynı. Boşta log gürültüsüne dokunulmaz.
- [ ] **Step 4: Doğrula.** `yarn workspace backend test` ve
      `yarn workspace backend build` — `qa` agent'ına arka planda.
- [ ] **Step 5: Commit** — `fix(backfill-values): keyset paging, capsule group filter, confirmed publish, one transaction`.

### Task 6: Dokümanlar

**Files:**

- Modify: `backend/docs/workers/backfill-values-guide.md`, `backend/docs/workers/capsule-value-calculation.md`,
  `backend/docs/workers/enrichment.md:271`

- [ ] **Step 1:** `--mode=…` geçen her örneği gerçek bayraklarla (`--limit`,
      `--capsules-only`, `--id`) değiştir; kapsül filtresinin grup 29 olduğunu,
      sayfalamanın `killmail_id DESC` keyset olduğunu yaz; `:rs` script'lerini
      ekle. `grep -rn -- "--mode=" backend/docs` boş dönmeli.
- [ ] **Step 2:** `npx prettier --check` değişen tüm dosyalarda; link kontrolü
      (CLAUDE.md'deki grep).
- [ ] **Step 3: Commit** — `docs(backfill-values): document the real flags and the Rust scripts`.

### Bitiş

- Tüm set (`qa` agent, arka planda): `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test` (backend-rs), `yarn workspace backend test`, `yarn workspace backend build`.
- Tek final reviewer, tüm branch.
- Kullanıcı elle dener (`queue:backfill-values:rs --limit=…`, sonra
  `worker:backfill-values:rs`); "merge" deyince push → PR → CI → squash →
  #315'te iki satır işaretlenir.
