# Rust `system-activity` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `worker:system-activity`'nin Rust karşılığını, Node davranışını
birebir taşıyan tek seferlik bir binary olarak eklemek.

**Architecture:** `backend-rs/workers/worker-system-activity`,
`worker-alliance-snapshots` gibi kuyruksuz bir iş. `lib.rs` saf birleştirme
fonksiyonlarını, tek ifadelik `UNNEST` insert'ünü ve ikisini ESI ile bağlayan
`take_snapshot`'ı taşır; `main.rs` yalnızca kaynakları kurar ve loglar.

**Tech Stack:** Rust (sqlx 0.8, chrono, serde, tokio, wiremock; `esi`, `db`,
`runner` crate'leri).

**Spec:** `docs/superpowers/specs/2026-11-19-rust-system-activity-design.md`

## Global Constraints

- ESI yolları `/universe/system_kills` ve `/universe/system_jumps`, ikisi de
  `CompatibilityDate::new("2025-12-16")` ile
  `EsiClient::get_with_compatibility_date` üzerinden.
- Eksik kill sayısı `0`, eksik jump sayısı `NULL`. Satır sırası: önce kills
  listesinin sırası, sonra yalnızca jumps'ta olanlar; tekrarlanan sistemde
  sonuncu kazanır, ilk görüldüğü yer korunur.
- Snapshot saati: çalışma anı, UTC saate aşağı yuvarlanmış. Sütun
  `timestamp(3) without time zone`, değer `NaiveDateTime` (UTC) olarak bağlanır.
- Biri başarısız olursa hiçbir şey yazılmaz; iki liste de boşsa yazılmaz,
  çıkış kodu 0.
- Yazma tek ifade: `INSERT … SELECT * FROM UNNEST(…) ON CONFLICT (system_id,
"timestamp") DO NOTHING`.
- `sqlx::query!` makrosu değil `sqlx::query` / `query_scalar` fonksiyonları
  (CI `SQLX_OFFLINE=true` derliyor).
- Node dosyaları, systemd unit'i ve timer'ı değişmez.
- Yarn, asla npm. Commit mesajları İngilizce, Claude atfı yok.
- CI: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test`, ve `npx prettier --check` (package.json, Markdown).

## Review Focus

1. **Aynı saat ikinci kez çalışır** (timer `Persistent=true`, elle yeniden
   çalıştırma) → 0 satır yazılır, ilk satırlar değişmez. Task 2
   `rerun_of_the_same_hour_writes_nothing`.
2. **Jumps isteği 5xx döner, kills başarılı** → hata döner, tablo boş kalır
   (yarım snapshot yok). Task 3 `a_failed_request_writes_nothing`.
3. **ESI iki boş liste döner** → `Ok(None)`, tablo boş. Task 3
   `two_empty_lists_write_nothing`.
4. **Saatin son milisaniyesinde çalışma** (`13:59:59.999`) → `13:00:00`, bir
   sonraki saate taşmaz. Task 1 `floors_the_last_millisecond`.
5. **Gerçek boyutta liste** (~5.000 sistem) → tek ifadede yazılır, parametre
   sınırına takılmaz. Task 2 `writes_a_full_size_snapshot` (6.000 satır).

---

### Task 1: Crate ve saf birleştirme

**Files:**

- Create: `backend-rs/workers/worker-system-activity/Cargo.toml`
- Create: `backend-rs/workers/worker-system-activity/src/lib.rs`
- Create: `backend-rs/workers/worker-system-activity/src/main.rs` (geçici:
  `fn main() {}`; Task 3 doldurur)
- Test: `backend-rs/workers/worker-system-activity/tests/merge.rs`

**Interfaces:**

- Produces:
  - `#[derive(Debug, Clone, Deserialize)] pub struct EsiSystemKills { pub system_id: i32, pub npc_kills: i32, pub pod_kills: i32, pub ship_kills: i32 }`
  - `#[derive(Debug, Clone, Deserialize)] pub struct EsiSystemJumps { pub system_id: i32, pub ship_jumps: i32 }`
  - `#[derive(Debug, Clone, PartialEq, Eq)] pub struct SystemActivityRow { pub system_id: i32, pub npc_kills: i32, pub pod_kills: i32, pub ship_kills: i32, pub ship_jumps: Option<i32>, pub timestamp: NaiveDateTime }`
  - `pub fn hour_snapshot_time(now: DateTime<Utc>) -> NaiveDateTime`
  - `pub fn merge_system_activity(kills: &[EsiSystemKills], jumps: &[EsiSystemJumps], timestamp: NaiveDateTime) -> Vec<SystemActivityRow>`

- [ ] **Step 1: `Cargo.toml`**

`worker-alliance-snapshots/Cargo.toml`'un kopyası, `name =
"worker-system-activity"`; bağımlılıklara `esi`, `serde`, ek olarak dev'e
`wiremock`, `serde_json` (Task 3). Workspace `workers/*` glob'u crate'i
otomatik alır.

- [ ] **Step 2: Başarısız testleri yaz** (`tests/merge.rs`; Node
      `system-activity.spec.ts`'nin karşılıkları)

```rust
fn at(s: &str) -> DateTime<Utc> { s.parse().unwrap() }
fn hour(s: &str) -> NaiveDateTime { at(s).naive_utc() }
fn k(id: i32, n: i32) -> EsiSystemKills { EsiSystemKills { system_id: id, npc_kills: n, pod_kills: n, ship_kills: n } }
fn j(id: i32, n: i32) -> EsiSystemJumps { EsiSystemJumps { system_id: id, ship_jumps: n } }

#[test] fn floors_to_the_hour() {
    assert_eq!(hour_snapshot_time(at("2026-11-19T13:42:17.123Z")), hour("2026-11-19T13:00:00Z"));
}
#[test] fn leaves_an_exact_hour_alone() {
    assert_eq!(hour_snapshot_time(at("2026-11-19T13:00:00Z")), hour("2026-11-19T13:00:00Z"));
}
#[test] fn floors_the_last_millisecond() {
    assert_eq!(hour_snapshot_time(at("2026-11-19T13:59:59.999Z")), hour("2026-11-19T13:00:00Z"));
}
#[test] fn merges_a_system_both_endpoints_report() {
    // kills (1, 3) + jumps (1, 7) → one row, kills 3/3/3, ship_jumps Some(7)
}
#[test] fn kills_only_system_has_null_jumps() {
    // [k(1, 3)], [] → ship_jumps None
}
#[test] fn jumps_only_system_has_zero_kills() {
    // [], [j(2, 9)] → npc/pod/ship 0, ship_jumps Some(9)
}
#[test] fn one_row_per_system_across_both_lists() {
    // [k(1,1), k(2,1)], [j(2,5), j(3,5)] → 3 rows
}
#[test] fn kills_order_first_then_jumps_only() {
    // [k(5,1), k(3,1)], [j(4,1), j(3,1)] → system_ids [5, 3, 4]
}
#[test] fn two_empty_lists_give_nothing() {
    // [], [] → empty
}
#[test] fn the_last_repeat_wins_in_the_first_place() {
    // [k(5,1), k(6,1), k(5,2)], [] → ids [5, 6], row 5 ship_kills 2
}
```

Her testte `timestamp` alanı verilen saate eşit olmalı (bir testte
assert edilmesi yeterli).

- [ ] **Step 3: Çalıştır, başarısız olduğunu gör**

Run: `cargo test -p worker-system-activity --test merge`
Expected: FAIL, derleme hatası (`hour_snapshot_time` tanımlı değil).

- [ ] **Step 4: `lib.rs`'e tipleri ve iki fonksiyonu yaz**

`hour_snapshot_time`: `now.naive_utc()` üzerinde dakika/saniye/nanosaniye
sıfırlama (`with_minute(0)` vb. ya da `duration_trunc(TimeDelta::hours(1))`).
`merge_system_activity`: `Vec<SystemActivityRow>` + `HashMap<i32, usize>`
(sistem → vektördeki indeks); tekrar gelen kills satırı yerinde
değiştirilir, jumps var olan satırın `ship_jumps`'ını günceller ya da yeni
satır ekler. Modül başına `//!` yorumu: spec'teki asimetri gerekçesi.

- [ ] **Step 5: Çalıştır, geçtiğini gör**

Run: `cargo test -p worker-system-activity --test merge`
Expected: 10 test PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-rs/workers/worker-system-activity backend-rs/Cargo.lock
git commit -m "feat(rust): system activity merge and hour snapshot"
```

### Task 2: `insert_snapshot`

**Files:**

- Modify: `backend-rs/workers/worker-system-activity/src/lib.rs`
- Create: `backend-rs/workers/worker-system-activity/tests/fixtures/{regions,constellations,solar_systems,system_activity,rows}.sql`
- Test: `backend-rs/workers/worker-system-activity/tests/insert.rs`

**Interfaces:**

- Consumes: `SystemActivityRow` (Task 1).
- Produces: `pub async fn insert_snapshot(pool: &PgPool, rows: &[SystemActivityRow]) -> sqlx::Result<u64>` (yazılan satır sayısı).

- [ ] **Step 1: Fixture'lar**

Dört tablo, `system_activity → solar_systems → constellations → regions`
foreign key zinciri. Her biri `worker-alliance-snapshots/tests/fixtures/alliance_snapshots.sql`
başındaki yorumdaki `pg_dump --schema-only --table=<tablo> …` komutuyla
üretilir; o yorum her dosyanın başına kopyalanır. `rows.sql`: bir region,
bir constellation, `solar_systems` `system_id` 30000001…30006000 ve
`name` (`generate_series` ile). Fixture sırası:
`fixtures("regions", "constellations", "solar_systems", "system_activity", "rows")`.

- [ ] **Step 2: Başarısız testleri yaz** (`tests/insert.rs`,
      `#[sqlx::test(migrations = false, fixtures(...))]`)

```rust
// writes_every_row_and_null_jumps
//   rows: (30000001, kills 3/2/1, Some(7)), (30000002, 0/0/0, None) at 13:00
//   → returns 2; SELECT ship_jumps … ORDER BY system_id == [Some(7), None]
// rerun_of_the_same_hour_writes_nothing
//   insert rows, then insert the same ids at the same hour with ship_kills 99
//   → second call returns 0; ship_kills still the first values
// another_hour_is_a_new_snapshot
//   same ids at 13:00 then 14:00 → 2 + 2, COUNT(*) == 4
// writes_a_full_size_snapshot
//   6000 rows, system_id 30000001..=30006000 → returns 6000
// empty_rows_write_nothing
//   &[] → returns 0
```

- [ ] **Step 3: Çalıştır, başarısız olduğunu gör**

Run: `cargo test -p worker-system-activity --test insert`
Expected: FAIL, `insert_snapshot` tanımlı değil.

- [ ] **Step 4: `insert_snapshot`'ı yaz**

Satırlar altı vektöre ayrılır (`Vec<i32>` ×4, `Vec<Option<i32>>`,
`Vec<NaiveDateTime>`), tek `sqlx::query`:

```sql
INSERT INTO system_activity
  (system_id, npc_kills, pod_kills, ship_kills, ship_jumps, "timestamp")
SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[], $5::int[], $6::timestamp[])
ON CONFLICT (system_id, "timestamp") DO NOTHING
```

Dönüş `rows_affected()`. `rows` boşsa veritabanına gitmeden `Ok(0)`.

- [ ] **Step 5: Çalıştır, geçtiğini gör**

Run: `cargo test -p worker-system-activity --test insert`
Expected: 5 test PASS. (`DATABASE_URL` yerel sunucuyu göstermeli; `sqlx::test`
geçici veritabanları açar, asıl veritabanına dokunmaz.)

- [ ] **Step 6: Commit**

```bash
git add backend-rs/workers/worker-system-activity
git commit -m "feat(rust): write a system activity snapshot in one statement"
```

### Task 3: `take_snapshot`, `main.rs` ve script

**Files:**

- Modify: `backend-rs/workers/worker-system-activity/src/lib.rs`
- Modify: `backend-rs/workers/worker-system-activity/src/main.rs`
- Modify: `backend/package.json` (`worker:system-activity` satırının altına)
- Test: `backend-rs/workers/worker-system-activity/tests/snapshot.rs`

**Interfaces:**

- Consumes: Task 1'in tipleri ve fonksiyonları, `insert_snapshot` (Task 2),
  `esi::{EsiClient, RateLimiter, CompatibilityDate}`.
- Produces:
  - `pub const COMPATIBILITY_DATE: CompatibilityDate = CompatibilityDate::new("2025-12-16");`
  - `#[derive(Debug)] pub struct Snapshot { pub timestamp: NaiveDateTime, pub kill_systems: usize, pub jump_systems: usize, pub ship_kills: i64, pub pod_kills: i64, pub npc_kills: i64, pub ship_jumps: i64, pub rows: usize, pub inserted: u64 }`
  - `pub async fn take_snapshot(esi: &EsiClient, pool: &PgPool, now: DateTime<Utc>) -> anyhow::Result<Option<Snapshot>>` (`None`: iki liste de boş)

- [ ] **Step 1: Başarısız testleri yaz** (`tests/snapshot.rs`; wiremock +
      Task 2 fixture'ları; istemci
      `EsiClient::with_base_url(RateLimiter::new(50), server.uri())`, örnek
      `worker-prices/tests/handle.rs:33`)

```rust
// writes_the_merged_snapshot
//   kills [{30000001, 1,2,3}], jumps [{30000001, 7}, {30000002, 4}],
//   now 2026-11-19T13:42:00Z
//   → Some(s): s.rows == 2, s.inserted == 2, s.ship_jumps == 11,
//     s.timestamp == 13:00; table has 2 rows at 13:00
// sends_the_compatibility_date
//   both mocks match header("x-compatibility-date", "2025-12-16")
//   (.expect(1)); a request without it would 404 and fail the test
// a_failed_request_writes_nothing
//   kills 200 with one row, jumps 500 → Err; COUNT(*) == 0
// two_empty_lists_write_nothing
//   both [] → Ok(None); COUNT(*) == 0
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `cargo test -p worker-system-activity --test snapshot`
Expected: FAIL, `take_snapshot` tanımlı değil.

- [ ] **Step 3: `take_snapshot`'ı yaz**

`tokio::try_join!` ile iki `get_with_compatibility_date::<Vec<_>>` çağrısı;
hata `?` ile yukarı (hiçbir şey yazılmadan). İki liste de boşsa `Ok(None)`.
Toplamlar `i64` ile toplanır (`i32` taşmasın), sonra merge ve
`insert_snapshot`.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: `cargo test -p worker-system-activity`
Expected: Task 1–3'ün bütün testleri PASS.

- [ ] **Step 5: `main.rs`**

`worker-alliance-snapshots/src/main.rs` kalıbı: `runner::init()`,
`DATABASE_URL`, `RateLimiter::from_env().map_err(anyhow::Error::msg)?`,
`EsiClient::new`, `db::worker_pool`, `take_snapshot(&esi, &pool, Utc::now())`,
`pool.close()`. Log satırları Node'daki sırayla ve emojilerle
(`worker-system-activity.ts:35-105`): başlangıç ve snapshot saati, `📡`,
`✓ received kills for N systems, jumps for M`, `📊` toplamları, `💾`, `✅` ve
özet, `👋`. `None` → `warn!("⚠️  no activity data returned from ESI")`, çıkış 0. Hata → `error!("💥 snapshot worker error: {e:#}")`, `exit(1)`. Sayı
biçimi Node'daki `toLocaleString` değil, düz `{}`; diğer Rust işleri de
öyle. Dosya başı `//!` yorumu: Node karşılığı, spec yolu,
`yarn worker:system-activity:rs`.

- [ ] **Step 6: `backend/package.json`**

```json
"worker:system-activity:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-system-activity",
```

- [ ] **Step 7: Bütün CI kontrolleri**

Run (`backend-rs/`): `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
Run (kök): `npx prettier --check backend/package.json docs/superpowers/plans/2026-11-19-rust-system-activity.md`
Expected: hepsi temiz.

- [ ] **Step 8: Yerel elle çalıştırma**

Run (`backend/`): `yarn worker:system-activity:rs`
Expected: `✓ received kills for ~5000 systems`, `✅`, çıkış 0; ikinci
çalıştırmada `snapshots saved: 0`. `psql` ile o saatin satır sayısı log'daki
`rows to write` ile eşit.

- [ ] **Step 9: Commit**

```bash
git add backend-rs/workers/worker-system-activity backend/package.json
git commit -m "feat(rust): system activity job and worker:system-activity:rs"
```
