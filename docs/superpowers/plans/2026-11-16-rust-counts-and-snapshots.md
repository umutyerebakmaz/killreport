# Alliance sayıları ve snapshot'lar: Rust portu — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `update:alliance-counts`, `snapshot:alliances` ve
`snapshot:corporations`'ı Rust'a taşımak ve üç Node script'ini aynı tek
ifadelik SQL'e geçirmek.

**Mimari:** Her komut tek bir tabloya yazar: sayılar `alliances`'a, alliance
snapshot'ı `alliance_snapshots`'a, corporation snapshot'ı
`corporation_snapshots`'a. Hepsi değerleri doğrudan `corporations`'tan
hesaplar. Snapshot tarihi UTC bugünüdür. Rust crate'leri RabbitMQ'ya ve
ESI'ye dokunmaz; yalnızca `db::worker_pool` kullanır.

**Teknoloji:** Rust (tokio, sqlx postgres, chrono, tracing), TypeScript
(Prisma `$executeRaw`/`$queryRaw`, vitest).

**Spec:** `docs/superpowers/specs/2026-11-16-rust-counts-and-snapshots-design.md`

## Genel kısıtlar

- Branch `feat/rust-counts-and-snapshots`, ana checkout'ta. Spec zaten commit edildi (`3ddf9d70`); bu plan ilk task'tan önce commit edilir.
- Commit mesajları İngilizce, Claude attribution satırı yok. Yarn, asla npm.
- Testler ve `cargo sqlx prepare` için `DATABASE_URL`, `backend-rs/` içinden:
  `export DATABASE_URL=$(grep -m1 '^DATABASE_URL' ../backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')`
- Yeni `query!` eklendiğinde `.sqlx/`, `backend-rs/` içinde `cargo sqlx prepare --workspace` ile yenilenir ve commit edilir. CI `SQLX_OFFLINE=true` ile derler.
- Her Rust task'ı sonunda: `cargo test -p <crate>`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`.
- Crate'ler `backend-rs/workers/` altında (workspace `members` glob'u `workers/*` onları zaten alır): `update-alliance-counts`, `worker-alliance-snapshots`, `worker-corporation-snapshots`.
- `main.rs` iskeleti `backend-rs/queues/queue-corporations/src/main.rs` gibi: `runner::init()`, `DATABASE_URL` yoksa `context("DATABASE_URL is not set")`, `db::worker_pool`, iş, `pool.close().await`, hata olursa `error!` ve `exit(1)`.
- Fixture'lar `queue-corporations/tests/fixtures/corporations.sql`'deki başlık yorumuyla ve aynı `pg_dump --schema-only --table=<t>` komutuyla **üretilir**, elle yazılmaz. Satır verisi ayrı fixture dosyasında.
- `updated_at`'e sayım dokunmaz (spec'teki karar).
- Snapshot'lar `ON CONFLICT (..., snapshot_date) DO NOTHING`: günde tek snapshot, ikinci çalıştırma hiçbir satırı değiştirmez.
- Alliance alt sorgusu (iki crate'te ve TS'de aynı metin):
  `SELECT alliance_id, COUNT(*)::int AS corps, SUM(member_count)::int AS members FROM corporations WHERE alliance_id IS NOT NULL GROUP BY alliance_id`
- package.json script'leri: `update:alliance-counts:rs`, `snapshot:alliances:rs`, `snapshot:corporations:rs`, değeri `cargo run --release --manifest-path ../backend-rs/Cargo.toml -p <crate>`. Node script'lerinin hemen altına.

## Review Focus

1. Gece yarısına yakın yerel saat (Europe/Istanbul 00:30 = UTC 21:30, önceki gün): snapshot tarihi UTC günü olmalı. Task 2 ve Task 4'teki gün testleri sabitler.
2. `alliances`'ta olmayan bir alliance'a bağlı corp: sayımda da snapshot'ta da yok sayılmalı, hata vermemeli. Task 1 ve Task 2 testi.
3. Boş tablolar: sayım 0 satır günceller, snapshot `total 0, created 0` döner, hata yok. Task 1, 2, 3 testi.
4. Aynı gün ikinci çalıştırma, arada corp sayıları değişmiş olsa bile: snapshot satırı değişmemeli. Task 2 ve 3 testi.
5. Alliance'ını değiştiren corp: eski alliance'ın sayısı düşmeli, yenisininki artmalı. Task 1 testi.

---

### Task 1: `update-alliance-counts` crate'i

**Files:**

- Create: `backend-rs/workers/update-alliance-counts/{Cargo.toml,src/lib.rs,src/main.rs,tests/counts.rs,tests/fixtures/alliances.sql,tests/fixtures/corporations.sql,tests/fixtures/rows.sql}`
- Modify: `backend/package.json`, `backend-rs/.sqlx/`

**Interfaces:**

- Produces: `pub async fn update_alliance_counts(pool: &PgPool) -> sqlx::Result<u64>`: etkilenen satır sayısı.

- [ ] **Step 1: Fixture'lar.** `alliances.sql` ve `corporations.sql` pg_dump ile. `rows.sql`: alliance 99000001 (iki corp: 10 ve 5 üye), 99000002 (corp yok, başlangıçta `member_count = 7, corporation_count = 1` gibi bayat değerler), 99000003 (bir corp, 3 üye); ayrıca `alliance_id = 99999999` olan (alliances'ta yok) bir corp; `alliance_id` NULL bir corp. Alliance satırlarının `updated_at`'i sabit bir değer, ör. `'2026-01-01 00:00:00'`.

- [ ] **Step 2: Failing testler** (`tests/counts.rs`, `#[sqlx::test(migrations = false, fixtures("alliances", "corporations", "rows"))]`):
  - `counts_members_and_corporations`: 99000001 → `(15, 2)`, 99000003 → `(3, 1)`.
  - `alliance_without_corporations_gets_zero`: 99000002 → `(0, 0)`.
  - `returns_every_alliance_updated`: dönüş `3`.
  - `corporation_moving_alliance_moves_its_count`: 99000001'in 5 üyeli corp'u `UPDATE` ile 99000003'e geçirilir, fonksiyon tekrar çağrılır → 99000001 `(10, 1)`, 99000003 `(8, 2)`.
  - `updated_at_is_untouched`: üç alliance'ın `updated_at`'i hâlâ `2026-01-01 00:00:00`.
  - `empty_tables_update_nothing` (yalnız `alliances`, `corporations` fixture): dönüş `0`.

- [ ] **Step 3:** `cargo test -p update-alliance-counts` → derleme hatasıyla FAIL.

- [ ] **Step 4: Uygula.** Spec'teki `UPDATE alliances a ... FROM alliances a2 LEFT JOIN (alt sorgu) s ... WHERE a.id = a2.id`, `query!` ile, `rows_affected()`. `main.rs` logları: `🔄 updating alliance counts...`, ardından `✅ update completed!`, `   • total updated: {n}`, `   • duration: {s:.2} seconds`, `👋 script finished`. Hata: `💥 script error: {e:#}`, exit 1. `package.json`'a `update:alliance-counts:rs`. `cargo sqlx prepare --workspace`.

- [ ] **Step 5:** `cargo test -p update-alliance-counts` PASS, clippy ve fmt temiz.

- [ ] **Step 6: Commit** `feat(backend-rs): Rust alliance counts job, one UPDATE for every alliance`

### Task 2: `worker-alliance-snapshots` crate'i

**Files:**

- Create: `backend-rs/workers/worker-alliance-snapshots/{Cargo.toml,src/lib.rs,src/main.rs,tests/snapshots.rs,tests/fixtures/alliances.sql,tests/fixtures/corporations.sql,tests/fixtures/alliance_snapshots.sql,tests/fixtures/rows.sql}`
- Modify: `backend/package.json`, `backend-rs/.sqlx/`

**Interfaces:**

- Produces:
  - `pub fn utc_day(now: chrono::DateTime<chrono::Utc>) -> chrono::NaiveDate`
  - `pub struct SnapshotTotals { pub total: i64, pub created: u64 }` + `pub fn existing(&self) -> i64` (`total - created`)
  - `pub async fn take_alliance_snapshots(pool: &PgPool, day: NaiveDate) -> sqlx::Result<SnapshotTotals>`
- Task 3 aynı `SnapshotTotals` ve `utc_day` şeklini kendi crate'inde tekrar tanımlar (crate'ler birbirine bağımlı olmaz).

- [ ] **Step 1: Fixture'lar.** `alliance_snapshots.sql` pg_dump ile (FK `alliances`'a; fixture sırası `alliances`, `corporations`, `alliance_snapshots`, `rows`). `rows.sql` Task 1'deki alliance ve corp satırları; alliance'ların `member_count`/`corporation_count` kolonları bayat değerlerle (ör. 999).

- [ ] **Step 2: Failing testler:**
  - `utc_day_uses_the_utc_date`: `2026-11-16T21:30:00Z` → `2026-11-16`; `2026-11-16T23:59:59Z` → `2026-11-16`; `2026-11-17T00:00:00Z` → `2026-11-17`.
  - `snapshots_every_alliance_from_corporations` (gün `2026-11-16`): 3 satır; 99000001 `(15, 2)`, 99000002 `(0, 0)`, 99000003 `(3, 1)`; `snapshot_date = 2026-11-16`; dönüş `total 3, created 3`.
  - `second_run_same_day_changes_nothing`: ilk çağrıdan sonra bir corp'un `member_count`'u 100 yapılır, ikinci çağrı → `total 3, created 0`, `existing() == 3`, 99000001 satırı hâlâ `(15, 2)`.
  - `next_day_adds_new_rows`: `2026-11-17` ile çağrı → `created 3`, tabloda 6 satır.
  - `alliances_table_is_untouched`: çağrıdan sonra alliance kolonları hâlâ 999.
  - `empty_tables` (satır fixture'sız): `total 0, created 0`.

- [ ] **Step 3:** `cargo test -p worker-alliance-snapshots` → FAIL.

- [ ] **Step 4: Uygula.** Tek transaction: `SELECT COUNT(*) FROM alliances`, sonra spec'teki `INSERT INTO alliance_snapshots (...) SELECT a.id, COALESCE(s.members, 0), COALESCE(s.corps, 0), $1 FROM alliances a LEFT JOIN (alt sorgu) s ON s.alliance_id = a.id ON CONFLICT (alliance_id, snapshot_date) DO NOTHING`, commit. `main.rs`: `utc_day(Utc::now())`, loglar `📸 alliance snapshot worker started...`, `✅ snapshot creation completed!`, `   • total alliances: {total}`, `   • new snapshots: {created}`, `   • already existing: {existing}`, `   • duration: {s:.2} seconds`, `   • date: {day}`, `👋 worker terminated`. Hata: `💥 worker error: {e:#}`, exit 1. `package.json`'a `snapshot:alliances:rs`. `cargo sqlx prepare --workspace`.

- [ ] **Step 5:** PASS, clippy ve fmt temiz.

- [ ] **Step 6: Commit** `feat(backend-rs): Rust alliance snapshot job, counts straight from corporations`

### Task 3: `worker-corporation-snapshots` crate'i

**Files:**

- Create: `backend-rs/workers/worker-corporation-snapshots/{Cargo.toml,src/lib.rs,src/main.rs,tests/snapshots.rs,tests/fixtures/corporations.sql,tests/fixtures/corporation_snapshots.sql,tests/fixtures/rows.sql}`
- Modify: `backend/package.json`, `backend-rs/.sqlx/`

**Interfaces:**

- Produces: `utc_day`, `SnapshotTotals` (Task 2 ile aynı şekil), `pub async fn take_corporation_snapshots(pool: &PgPool, day: NaiveDate) -> sqlx::Result<SnapshotTotals>`

- [ ] **Step 1: Fixture'lar** pg_dump ile; `rows.sql` üç corp (10, 5, 3 üye).

- [ ] **Step 2: Failing testler:** `utc_day_uses_the_utc_date` (Task 2 ile aynı değerler); `snapshots_every_corporation` (3 satır, üye sayıları 10/5/3, `total 3, created 3`); `second_run_same_day_changes_nothing` (arada üye sayısı değişir, `created 0`, satır eski değerde); `empty_table` (`total 0, created 0`).

- [ ] **Step 3:** FAIL.

- [ ] **Step 4: Uygula.** Tek transaction: `SELECT COUNT(*) FROM corporations`, `INSERT INTO corporation_snapshots (corporation_id, member_count, snapshot_date) SELECT id, member_count, $1 FROM corporations ON CONFLICT (corporation_id, snapshot_date) DO NOTHING`. Loglar Task 2 ile aynı, `alliance` yerine `corporation` (`📸 corporation snapshot worker started...`, `   • total corporations: {total}`). `package.json`'a `snapshot:corporations:rs`. `cargo sqlx prepare --workspace`.

- [ ] **Step 5:** PASS, clippy ve fmt temiz.

- [ ] **Step 6: Commit** `feat(backend-rs): Rust corporation snapshot job`

### Task 4: TypeScript script'leri aynı SQL'e

**Files:**

- Create: `backend/src/utils/utc-day.ts`, `backend/src/utils/utc-day.spec.ts`
- Modify: `backend/src/workers/update-alliance-counts.ts`, `backend/src/workers/worker-alliance-snapshots.ts`, `backend/src/workers/worker-corporation-snapshots.ts`

**Interfaces:**

- Produces: `export function utcDay(now: Date): Date`: `now`'ın UTC tarihinin 00:00:00.000Z anı.

- [ ] **Step 1: Failing test** (`utc-day.spec.ts`): `utcDay(new Date('2026-11-17T00:30:00+03:00')).toISOString() === '2026-11-16T00:00:00.000Z'`; `utcDay(new Date('2026-11-16T23:59:59Z'))` → `'2026-11-16T00:00:00.000Z'`; `utcDay(new Date('2026-11-17T00:00:00Z'))` → `'2026-11-17T00:00:00.000Z'`.

- [ ] **Step 2:** `yarn workspace backend test src/utils/utc-day.spec.ts` → FAIL.

- [ ] **Step 3: Uygula.** `utcDay` ve üç script:
  - `update-alliance-counts.ts`: döngü yerine tek `prismaWorker.$executeRaw` (Task 1'deki SQL); dönen sayı "total updated".
  - `worker-alliance-snapshots.ts`: `prismaWorker.$transaction(async (tx) => …)` içinde `COUNT(*)` ve Task 2'deki `INSERT ... ON CONFLICT DO NOTHING`; tarih parametresi `${today}::date`. `alliances`'a yazan bölüm ve "alliance records updated" satırı kalkar; `findMany`, `Map`, parti döngüsü kalkar.
  - `worker-corporation-snapshots.ts`: aynı şekil, Task 3'teki SQL.
  - Üçünde log satırları Rust karşılıklarıyla aynı, çıkış kodları değişmez, `today` = `utcDay(new Date())`, `date:` satırı `today.toISOString().split('T')[0]`.

- [ ] **Step 4:** `yarn workspace backend test` PASS, `yarn workspace backend build` temiz, değişen dosyalarda `npx prettier --check`.

- [ ] **Step 5: Commit** `fix: alliance counts and snapshots in one SQL statement each, UTC snapshot date`

### Task 5: Dokümanlar ve yerel doğrulama

**Files:**

- Modify: `backend/docs/ops/daily.md`, `backend/docs/workers/alliance-snapshots.md`, `backend/docs/workers/worker-documentation.md`

- [ ] **Step 1:** `daily.md`: üç komutun `:rs` sürümü varsayılan olur, Node karşılığı parantezde (diğer komutlardaki gibi); "(Node only)" etiketleri kalkar. `alliance-snapshots.md`: snapshot'ın artık `alliances` sayılarını yazmadığı, sayıların tek sahibinin `update:alliance-counts` olduğu, tarihin UTC olduğu. `worker-documentation.md`: üç Rust karşılığı notu, mevcut Rust notlarının biçiminde.

- [ ] **Step 2:** Değişen Markdown'da `npx prettier --check`; link kontrolü (CLAUDE.md "Markdown links" komutu).

- [ ] **Step 3: Yerel çalıştırma (kullanıcının veritabanı, satır kaybı yok, yalnızca ekleme/güncelleme):** `backend/` içinden önce satır sayıları kaydedilir (`alliances`, `alliance_snapshots`, `corporation_snapshots`), sonra `yarn update:alliance-counts:rs`, `yarn snapshot:alliances:rs`, `yarn snapshot:corporations:rs`. Beklenen: hata yok, snapshot'lar bugünün UTC tarihiyle; tekrar çalıştırınca `new snapshots: 0`. Satır sayıları düşmemiş olmalı. Bu adım kullanıcının onayıyla çalıştırılır.

- [ ] **Step 4: Commit** `docs: Rust alliance counts and snapshot jobs`
