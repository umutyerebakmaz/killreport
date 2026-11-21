# Rust sovereignty snapshot Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `worker:sov:snapshot`'ın Rust karşılığı (`worker:sov:snapshot:rs`) ve
Node işinin aynı düzeltmeyle (satır = dünün kapanışı, tek transaction, tek SQL)
yeniden yazılması.

**Mimari:** İş ESI'ye gitmez. Dört SQL ifadesi tek transaction'da çalışır:
`D` gününün harita snapshot'ını ve alliance stat'larını siler, sonra
`INSERT ... SELECT` ile yeniden yazar. Rust ve Node aynı SQL'i çalıştırır.

**Teknoloji:** Rust (sqlx 0.8, chrono, tokio), TypeScript (Prisma `$executeRaw`,
Vitest).

**Spec:** `docs/superpowers/specs/2026-11-21-rust-sovereignty-snapshot-design.md`

## Genel Kısıtlar

- `D = (şimdi, UTC).date() - 1`. UTC açıkça bağlanır, oturum saat dilimine güvenilmez.
- gained/lost penceresi: `detected_at >= D AND detected_at < D + 1`.
- IHub type ID `32458`, TCU type ID `32226`.
- `sovereignty_map_current` boşsa: uyarı yaz, hiçbir şeyi silme, başarıyla çık.
- Dört ifade tek transaction'da.
- Rust tarafı yalnızca `db::worker_pool` kullanır; Node tarafı `@services/prisma-worker`.
- Commit mesajları İngilizce, Claude attribution yok.
- `yarn` kullanılır, `npm` asla. Generated dosyalara dokunulmaz.

## İnceleme Odağı

1. **Node'da tarih parametresi saat dilimine kayar.** JS `Date` Prisma'dan
   `timestamptz` olarak gider; `::date` cast'i oturum saat diliminde yapılırsa
   bir gün kayar. Node `D`'yi `'YYYY-MM-DD'` string'i olarak bağlar
   (Task 2'deki test bunu sabitler).
2. **Gece yarısında çalıştırma.** 00:00:00 UTC'de `D` dündür, bugün değil
   (Task 1 `snapshot_date` testi).
3. **Faction sahibi sistemler.** `alliance_id` NULL olan harita satırları
   snapshot'a girer ama stat satırı üretmez (Task 1 `counts_systems_and_live_structures`).
4. **Defender'ı NULL kampanya.** Bütün katılımcılar attacking sayılır
   (Task 1 `null_defender_counts_every_participant`).
5. **Başka günler.** Sil-yaz yalnızca `D`'ye dokunur (Task 1 `other_days_are_untouched`).

Kabul edilen davranış farkı: Node yalnızca IHub/TCU dışı canlı yapısı olan bir
alliance için de bütün sayıları 0 olan bir satır yazıyordu. Yeni SQL bu
satırı yazmaz; okuyan resolver eksik satırı zaten 0 kabul ediyor
(`backend/src/resolvers/sovereignty/queries.ts:466-471`).

## Ortak SQL

İki task da bu dört ifadeyi kelimesi kelimesine kullanır; `$1` = `D` (`date`).

```sql
DELETE FROM sovereignty_map_snapshots WHERE snapshot_date = $1::date;

INSERT INTO sovereignty_map_snapshots
  (solar_system_id, alliance_id, corporation_id, faction_id, snapshot_date)
SELECT solar_system_id, alliance_id, corporation_id, faction_id, $1::date
FROM sovereignty_map_current;

DELETE FROM alliance_territory_stats WHERE date = $1::date;

WITH
  systems AS (
    SELECT alliance_id, COUNT(*)::int AS n FROM sovereignty_map_current
    WHERE alliance_id IS NOT NULL GROUP BY alliance_id),
  ihubs AS (
    SELECT alliance_id, COUNT(*)::int AS n FROM sovereignty_structures
    WHERE destroyed_at IS NULL AND structure_type_id = 32458 GROUP BY alliance_id),
  tcus AS (
    SELECT alliance_id, COUNT(*)::int AS n FROM sovereignty_structures
    WHERE destroyed_at IS NULL AND structure_type_id = 32226 GROUP BY alliance_id),
  defending AS (
    SELECT defender_id AS alliance_id, COUNT(*)::int AS n FROM sovereignty_campaigns
    WHERE end_time IS NULL AND defender_id IS NOT NULL GROUP BY defender_id),
  attacking AS (
    SELECT p.alliance_id, COUNT(*)::int AS n
    FROM sovereignty_campaigns c
    JOIN campaign_participants p ON p.campaign_id = c.campaign_id
    WHERE c.end_time IS NULL AND p.alliance_id IS DISTINCT FROM c.defender_id
    GROUP BY p.alliance_id),
  gained AS (
    SELECT new_owner_id AS alliance_id, COUNT(*)::int AS n FROM territory_changes
    WHERE new_owner_id IS NOT NULL
      AND detected_at >= $1::date AND detected_at < $1::date + 1
    GROUP BY new_owner_id),
  lost AS (
    SELECT previous_owner_id AS alliance_id, COUNT(*)::int AS n FROM territory_changes
    WHERE previous_owner_id IS NOT NULL
      AND detected_at >= $1::date AND detected_at < $1::date + 1
    GROUP BY previous_owner_id),
  ids AS (
    SELECT alliance_id FROM systems UNION SELECT alliance_id FROM ihubs
    UNION SELECT alliance_id FROM tcus UNION SELECT alliance_id FROM defending
    UNION SELECT alliance_id FROM attacking UNION SELECT alliance_id FROM gained
    UNION SELECT alliance_id FROM lost)
INSERT INTO alliance_territory_stats
  (alliance_id, date, systems_controlled, ihub_count, tcu_count,
   campaigns_attacking, campaigns_defending, systems_gained, systems_lost)
SELECT ids.alliance_id, $1::date,
  COALESCE(systems.n, 0), COALESCE(ihubs.n, 0), COALESCE(tcus.n, 0),
  COALESCE(attacking.n, 0), COALESCE(defending.n, 0),
  COALESCE(gained.n, 0), COALESCE(lost.n, 0)
FROM ids
LEFT JOIN systems USING (alliance_id) LEFT JOIN ihubs USING (alliance_id)
LEFT JOIN tcus USING (alliance_id) LEFT JOIN defending USING (alliance_id)
LEFT JOIN attacking USING (alliance_id) LEFT JOIN gained USING (alliance_id)
LEFT JOIN lost USING (alliance_id);
```

Boş harita kontrolü, aynı transaction'ın başında:
`SELECT EXISTS (SELECT 1 FROM sovereignty_map_current)`.

---

### Task 1: Rust crate `worker-sovereignty-snapshot`

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-sovereignty-snapshot/Cargo.toml`
  (`update-alliance-counts` gibi; ek olarak `chrono`)
- Oluştur: `backend-rs/workers/worker-sovereignty-snapshot/src/lib.rs`
- Oluştur: `backend-rs/workers/worker-sovereignty-snapshot/src/main.rs`
- Oluştur: `backend-rs/workers/worker-sovereignty-snapshot/tests/snapshot.rs`
- Oluştur: `tests/fixtures/` altında `sovereignty_map_current.sql`,
  `sovereignty_map_snapshots.sql`, `sovereignty_structures.sql`,
  `sovereignty_campaigns.sql`, `campaign_participants.sql`,
  `territory_changes.sql`, `alliance_territory_stats.sql`. Var olanlar
  `worker-sovereignty-{map,structures,campaigns}/tests/fixtures/`'tan
  kopyalanır; `sovereignty_map_snapshots` ve `alliance_territory_stats`,
  `update-alliance-counts/tests/fixtures/alliances.sql` başındaki `pg_dump`
  komutuyla üretilir (yorum başlığı aynen).
- Değiştir: `backend/package.json`, `worker:sov:snapshot` satırının altına
  `"worker:sov:snapshot:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-sovereignty-snapshot"`
- Değiştir: `backend-rs/Cargo.lock` (cargo üretir). Workspace `workers/*`
  glob'u yeni crate'i kendisi alır.

**Arayüzler:**

- Üretir (`lib.rs`):
  - `pub fn snapshot_date(now: DateTime<Utc>) -> NaiveDate`
  - `pub enum SnapshotOutcome { EmptyMap, Written { map_rows: u64, stat_rows: u64 } }`
    (`Debug, PartialEq, Eq`)
  - `pub async fn snapshot(pool: &PgPool, date: NaiveDate) -> Result<SnapshotOutcome, sqlx::Error>`:
    tek transaction, _Ortak SQL_. `EmptyMap` dalında transaction hiçbir şey
    yazmadan biter. `map_rows` ve `stat_rows` iki `INSERT`'in `rows_affected()`'ı.

- [ ] **Adım 1: Fixture'ları yerleştir**, `ls tests/fixtures` yedi dosyayı göstermeli.

- [ ] **Adım 2: Başarısız testleri yaz** (`tests/snapshot.rs`). Her test
      `#[sqlx::test(migrations = false, fixtures(<yedi fixture>))]`; satırlar
      test içinde `sqlx::query` ile eklenir. `D = 2026-11-20`.

  - `snapshot_date_is_previous_utc_day` (düz `#[test]`):
    `2026-11-21T01:00:00Z → 2026-11-20`, `2026-11-21T00:00:00Z → 2026-11-20`,
    `2026-11-20T23:59:59Z → 2026-11-19`.
  - `empty_map_writes_nothing`: `D` için bir snapshot satırı ve bir stat
    satırı önceden var, harita boş → `EmptyMap`, iki satır da yerinde.
  - `counts_systems_and_live_structures`: harita: alliance 1 için iki sistem,
    `alliance_id` NULL + `faction_id` 500001 bir sistem. Yapılar: alliance 1'e
    canlı IHub, yıkılmış IHub (`destroyed_at` dolu), canlı TCU →
    `Written { map_rows: 3, stat_rows: 1 }`; alliance 1 satırı
    `systems_controlled 2, ihub_count 1, tcu_count 1`; snapshot'ta 3 satır,
    hepsi `snapshot_date = D`.
  - `gained_lost_cover_the_full_utc_day`: `territory_changes`
    (`previous_owner_id 2 → new_owner_id 1`) `2026-11-19 23:59:59.999`,
    `2026-11-20 00:00:00`, `2026-11-20 23:59:59.999`, `2026-11-21 00:00:00`
    → alliance 1 `systems_gained 2`, alliance 2 `systems_lost 2`.
  - `defender_is_not_counted_as_attacker`: aktif kampanya 10 (defender 1,
    katılımcılar 1 ve 2), bitmiş kampanya 11 (`end_time` dolu, defender 3,
    katılımcı 2) → alliance 1 `campaigns_defending 1, campaigns_attacking 0`;
    alliance 2 `campaigns_attacking 1`; alliance 3 için satır yok.
  - `null_defender_counts_every_participant`: aktif kampanya, `defender_id`
    NULL, katılımcılar 1 ve 2 → ikisi de `campaigns_attacking 1`.
  - `rerun_replaces_the_day`: alliance 1 ve 3 haritada → çalıştır; alliance 3'ün
    sistemini haritadan sil → tekrar çalıştır → alliance 3'ün `D` satırı yok,
    snapshot satır sayısı haritanınkine eşit.
  - `other_days_are_untouched`: `2026-11-19` tarihli bir snapshot ve bir stat
    satırı → çalıştırdıktan sonra ikisi de değişmeden duruyor.

- [ ] **Adım 3: Testin başarısız olduğunu gör**
      Çalıştır: `cargo test -p worker-sovereignty-snapshot` (`backend-rs/` içinde)
      Beklenen: `snapshot`/`snapshot_date` tanımlı olmadığı için derleme hatası.

- [ ] **Adım 4: `lib.rs`'i yaz**, _Ortak SQL_ dört `const` olarak; `$1`'e
      `NaiveDate` bağlanır. Modül başı yorum, Node dosyasına ve spec'e atıf
      yapar (`worker-sovereignty-map/src/lib.rs` gibi).

- [ ] **Adım 5: `main.rs`'i yaz**, `update-alliance-counts/src/main.rs` düzeninde.
      Log'lar:
      `📸 starting sovereignty daily snapshot for {D}...`;
      `EmptyMap` → `warn!("⚠️  sovereignty_map_current is empty — skipping this run")`;
      `Written` → `✅ snapshot complete: {map_rows} map rows snapshotted, {stat_rows} alliance stat rows written ({s:.2}s)`;
      hata → `❌ sovereignty snapshot failed: {e:#}`, çıkış kodu 1.
      `D = snapshot_date(Utc::now())`.

- [ ] **Adım 6: Testlerin geçtiğini gör**
      Çalıştır: `cargo test -p worker-sovereignty-snapshot`
      Beklenen: 8 test PASS.
      Çalıştır: `cargo clippy -p worker-sovereignty-snapshot --all-targets -- -D warnings` ve `cargo fmt --check`
      Beklenen: uyarı yok.

- [ ] **Adım 7: Commit**
      `git add backend-rs/workers/worker-sovereignty-snapshot backend-rs/Cargo.lock backend/package.json docs/superpowers/specs/2026-11-21-rust-sovereignty-snapshot-design.md docs/superpowers/plans/2026-11-21-rust-sovereignty-snapshot.md`
      `git commit -m "feat(rust): sovereignty daily snapshot job (worker:sov:snapshot:rs)"`

### Task 2: Node `worker-sovereignty-snapshot.ts` düzeltmesi

**Dosyalar:**

- Değiştir: `backend/src/workers/worker-sovereignty-snapshot.ts` (bütün gövde)
- Oluştur: `backend/src/workers/worker-sovereignty-snapshot.spec.ts`
  (`worker-sovereignty-map.spec.ts`'teki `vi.hoisted` mock düzeni)

**Arayüzler:**

- Üretir:
  - `export function snapshotDateFor(now: Date): string`: `'YYYY-MM-DD'`,
    `now`'ın UTC gününden bir önceki gün.
  - `export async function snapshotSovereignty(now: Date = new Date()): Promise<void>`:
    `prismaWorker.$transaction(async (tx) => …)` içinde önce
    `tx.$queryRaw` ile boş harita kontrolü, sonra dört `tx.$executeRaw`.
    Tarih, SQL'de `${date}::date` olarak string bağlanır.
  - `require.main === module` koruması (`worker-sovereignty-map.ts:206`
    gibi), böylece spec dosyayı import edebilir.

- [ ] **Adım 1: Başarısız spec'i yaz**

  - `snapshotDateFor`: `2026-11-21T01:00:00Z → '2026-11-20'`,
    `2026-11-21T00:00:00Z → '2026-11-20'`, `2026-11-01T00:30:00Z → '2026-10-31'`.
  - `skips when the current map is empty`: `tx.$queryRaw` →
    `[{ exists: false }]` → `tx.$executeRaw` hiç çağrılmaz,
    `logger.warn` çağrılır.
  - `writes the day inside one transaction`: `tx.$queryRaw` →
    `[{ exists: true }]`, `now = 2026-11-21T01:00:00Z` →
    `prisma.$transaction` 1 kez, `tx.$executeRaw` 4 kez, her çağrının
    değerleri `'2026-11-20'` içerir (string, `Date` değil).

- [ ] **Adım 2: Spec'in başarısız olduğunu gör**
      Çalıştır: `yarn workspace backend vitest run src/workers/worker-sovereignty-snapshot.spec.ts`
      Beklenen: FAIL, `snapshotDateFor` export edilmemiş.

- [ ] **Adım 3: Worker'ı yeniden yaz.** _Ortak SQL_ tagged template olarak.
      Log metinleri Task 1 Adım 5 ile aynı. Dosya başı yorum: satır = dünün
      kapanışı, systemd timer 01:00 UTC.

- [ ] **Adım 4: Spec'in geçtiğini gör**
      Çalıştır: aynı komut. Beklenen: PASS.
      Çalıştır: `yarn workspace backend build`. Beklenen: hata yok.

- [ ] **Adım 5: Commit**
      `git commit -m "fix(sov): daily snapshot counts the full previous UTC day in one transaction"`

### Task 3: Doküman

**Dosyalar:**

- Değiştir: `backend/docs/workers/sovereignty-workers.md:62`: açıklama
  "previous UTC day's close: map snapshot + per-alliance territory stats,
  gained/lost over the full day" olur; `:106` ve `:131` civarına
  `yarn worker:sov:snapshot:rs` eklenir.

- [ ] **Adım 1: Düzenle**, sonra `npx prettier --check backend/docs/workers/sovereignty-workers.md docs/superpowers` → temiz.
- [ ] **Adım 2: Commit** `git commit -m "docs(sov): snapshot row is the previous UTC day"`

### Son doğrulama

- [ ] `qa` agent'ı arka planda: `yarn test`, `yarn workspace backend build`,
      `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`,
      değişen dosyalarda `npx prettier --check`.
- [ ] Elle çalıştırma kullanıcıda, `backend/` içinde iki iş de (timer Node'u
      çalıştırıyor, onun yazma ifadeleri gerçek veritabanında hiç çalışmadı):
      `yarn worker:sov:snapshot`, sonra `yarn worker:sov:snapshot:rs`; ikisinin de
      sonunda `SELECT date, COUNT(*) FROM alliance_territory_stats GROUP BY date ORDER BY date DESC LIMIT 3`.
