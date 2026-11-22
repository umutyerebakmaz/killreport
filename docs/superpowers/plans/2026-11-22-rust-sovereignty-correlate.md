# Rust sovereignty correlate Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `worker:sov:correlate`'in Rust karşılığı (`worker:sov:correlate:rs`) ve
Node işinin aynı düzeltmeyle (biten kampanyalar 24 saat daha işlenir, tek
transaction, küme tabanlı SQL) yeniden yazılması.

**Mimari:** ESI ve Redis yok. Tek transaction'da üç ifade: uygun kampanya
sayısı, killmail bağlama `UPDATE`'i, `campaign_combat_stats` upsert'i. Rust ve
Node aynı SQL'i çalıştırır; `now` uygulamadan UTC olarak bağlanır.

**Teknoloji:** Rust (sqlx 0.8, chrono, tokio), TypeScript (Prisma `$executeRaw`,
Vitest).

**Spec:** `docs/superpowers/specs/2026-11-22-rust-sovereignty-correlate-design.md`

## Genel Kısıtlar

- Uygun kampanya: `end_time IS NULL OR end_time >= now − 24 saat`.
- Pencere: `[start_time − 24 saat, COALESCE(end_time, now)]`, iki uç dahil.
- Çakışmada önce başlayan kampanya, eşitlikte küçük `campaign_id`.
- `now` uygulamadan bağlanır; SQL'de `now()` / `CURRENT_TIMESTAMP` yok.
  `killmails.updated_at` ve `campaign_combat_stats.last_correlated` = `now`.
- Rust yalnızca `db::worker_pool`; Node `@services/prisma-worker`.
- Commit mesajları İngilizce, Claude attribution yok. `yarn`, `npm` asla.

## İnceleme Odağı

1. **Node'da `now` saat dilimine kayar.** JS `Date` `timestamptz` olarak
   gider; `timestamp`'e cast oturum saat diliminde (`Europe/Istanbul`) yapılır
   ve 3 saat kayar. Node `now`'ı `'YYYY-MM-DD HH:MM:SS.mmm'` string'i olarak
   bağlar (Task 2 testi).
2. **Bitişte tam sınır.** `killmail_time = end_time` bağlanır, bir ms sonrası
   bağlanmaz (Task 1 `ended_campaign_is_processed_for_24_hours`).
3. **Gelecek zamanlı killmail.** Aktif kampanyada `now`'dan sonraki killmail
   bağlanmaz (Task 1 `window_bounds_for_active_campaign`).
4. **Victim satırı olmayan / değeri NULL killmail.** Sayılır, ISK'ya 0 katar,
   defender sayılmaz (Task 1 `defender_attacker_split`).
5. **Başka kampanyaya bağlı killmail.** Hiç değişmez (Task 1
   `tagged_killmail_is_not_retagged`).

## Ortak SQL

`$1` = `now` (`timestamp`, saat dilimsiz, UTC).

```sql
-- CAMPAIGNS
SELECT COUNT(*) FROM sovereignty_campaigns
WHERE end_time IS NULL OR end_time >= $1::timestamp - interval '24 hours';

-- TAG
WITH
  eligible AS (
    SELECT campaign_id, solar_system_id, start_time,
           start_time - interval '24 hours' AS window_start,
           COALESCE(end_time, $1::timestamp) AS window_end
    FROM sovereignty_campaigns
    WHERE end_time IS NULL OR end_time >= $1::timestamp - interval '24 hours'),
  picks AS (
    SELECT DISTINCT ON (k.killmail_id) k.killmail_id, e.campaign_id
    FROM killmails k
    JOIN eligible e ON e.solar_system_id = k.solar_system_id
     AND k.killmail_time >= e.window_start AND k.killmail_time <= e.window_end
    WHERE k.related_campaign_id IS NULL
    ORDER BY k.killmail_id, e.start_time, e.campaign_id)
UPDATE killmails k
SET related_campaign_id = p.campaign_id, is_war_related = true, updated_at = $1::timestamp
FROM picks p
WHERE k.killmail_id = p.killmail_id;

-- STATS
WITH
  eligible AS (
    SELECT campaign_id, defender_id FROM sovereignty_campaigns
    WHERE end_time IS NULL OR end_time >= $1::timestamp - interval '24 hours'),
  totals AS (
    SELECT e.campaign_id,
           COUNT(*)::int AS war_kills,
           COALESCE(SUM(k.total_value), 0) AS isk,
           (COUNT(*) FILTER (WHERE v.alliance_id = e.defender_id))::int AS def_ships,
           COALESCE(SUM(k.total_value) FILTER (WHERE v.alliance_id = e.defender_id), 0) AS def_isk
    FROM eligible e
    JOIN killmails k ON k.related_campaign_id = e.campaign_id
    LEFT JOIN victims v ON v.killmail_id = k.killmail_id
    GROUP BY e.campaign_id)
INSERT INTO campaign_combat_stats
  (campaign_id, war_kills, isk_destroyed, ships_destroyed, defender_isk_lost,
   attacker_isk_lost, defender_ships_lost, attacker_ships_lost, last_correlated)
SELECT campaign_id, war_kills, isk, war_kills, def_isk, isk - def_isk,
       def_ships, war_kills - def_ships, $1::timestamp
FROM totals
ON CONFLICT (campaign_id) DO UPDATE SET
  war_kills = EXCLUDED.war_kills, isk_destroyed = EXCLUDED.isk_destroyed,
  ships_destroyed = EXCLUDED.ships_destroyed,
  defender_isk_lost = EXCLUDED.defender_isk_lost,
  attacker_isk_lost = EXCLUDED.attacker_isk_lost,
  defender_ships_lost = EXCLUDED.defender_ships_lost,
  attacker_ships_lost = EXCLUDED.attacker_ships_lost,
  last_correlated = EXCLUDED.last_correlated;
```

`JOIN killmails` iç birleşim olduğu için kill'i olmayan kampanyaya satır
yazılmaz (bugünkü `if (warKills === 0) continue` ile aynı).

---

### Task 1: Rust crate `worker-sovereignty-correlate`

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-sovereignty-correlate/{Cargo.toml,src/lib.rs,src/main.rs,tests/correlate.rs}`
  (`worker-sovereignty-snapshot` düzeni ve bağımlılıkları)
- Oluştur: `tests/fixtures/`: `sovereignty_campaigns.sql`
  (`worker-sovereignty-snapshot`'tan), `killmails.sql`, `victims.sql`
  (`queues/queue-prices/tests/fixtures/`'tan), `campaign_combat_stats.sql`
  (`pg_dump` ile, `alliance_territory_stats.sql`'in başlığıyla). Sıra:
  `sovereignty_campaigns`, `killmails`, `victims`, `campaign_combat_stats`.
- Değiştir: `backend/package.json`, `worker:sov:correlate` altına
  `"worker:sov:correlate:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-sovereignty-correlate"`
- Değiştir: `backend-rs/Cargo.lock`

**Arayüzler:**

- Üretir (`lib.rs`):
  - `pub struct CorrelateOutcome { pub campaigns: i64, pub tagged: u64, pub with_kills: u64 }`
    (`Debug, PartialEq, Eq`)
  - `pub async fn correlate(pool: &PgPool, now: NaiveDateTime) -> Result<CorrelateOutcome, sqlx::Error>`:
    tek transaction, _Ortak SQL_ sırasıyla; `tagged` = TAG'in, `with_kills` =
    STATS'ın `rows_affected()`'ı.

- [ ] **Adım 1: Fixture'ları yerleştir**, dört dosya.

- [ ] **Adım 2: Başarısız testleri yaz** (`tests/correlate.rs`). `NOW = 2026-11-22 12:00:00`.
      Yardımcılar: `campaign(id, system, start, end: Option, defender: Option)`,
      `killmail(id, system, time, total_value: Option<f64>, victim_alliance: Option<Option<i32>>)`
      (dış `None` = victim satırı yok), `tag_of(id) -> (Option<i32>, bool)`,
      `stats(campaign) -> Option<(i32, f64, i32, f64, f64, i32, i32)>`.

  - `window_bounds_for_active_campaign`: kampanya 1, sistem S, start
    `2026-11-22 10:00`, aktif. Kill'ler S'de `2026-11-21 09:59:59.999` (dışarıda),
    `2026-11-21 10:00:00` (içeride), `2026-11-22 11:59:00` (içeride),
    `2026-11-22 12:00:00.001` (dışarıda), başka sistemde `11:00` (dışarıda) →
    `tagged 2`, içerideki ikisi `(Some(1), true)`, diğerleri `(None, false)`.
  - `ended_campaign_is_processed_for_24_hours`: start `2026-11-21 08:00`,
    end `2026-11-21 13:00`. Kill'ler `2026-11-21 13:00:00` → bağlı,
    `2026-11-21 13:00:00.001` → bağlı değil; stats satırı `war_kills 1`.
  - `campaign_ended_over_24_hours_ago_is_ignored`: end `2026-11-21 11:59:59.999`,
    pencerede bir kill → bağlı değil, `campaigns 0`, stats satırı yok.
  - `overlapping_campaigns_earliest_start_wins`: aynı sistemde kampanya 20
    (start `10:00`) ve 21 (start `09:00`) → kill 21'e. Ayrı test
    `equal_starts_lowest_id_wins`: 30 ve 31 aynı start → 30'a.
  - `tagged_killmail_is_not_retagged`: kill önceden `related_campaign_id 99`,
    `is_war_related false`, `updated_at 2026-01-01` → üçü de aynı kalır.
  - `defender_attacker_split`: defender 1; kill'ler: victim alliance 1 / 100.0,
    victim alliance 2 / 50.0, victim alliance NULL / `total_value` NULL, victim
    satırı yok / 25.0 → `(war_kills 4, isk 175.0, ships 4, def_isk 100.0,
att_isk 75.0, def_ships 1, att_ships 3)`.
  - `null_defender_puts_everything_on_attackers`: defender NULL, iki kill
    10.0 ve 20.0 → `def_ships 0, def_isk 0.0, att_ships 2, att_isk 30.0`.
  - `rerun_is_stable`: iki kez çalıştır (ikincisi `NOW + 10 dk`) → ikinci
    `tagged 0`, stats aynı, `last_correlated` ikinci `now`.
  - `campaign_without_kills_gets_no_row`: kill'siz aktif kampanya →
    `with_kills 0`, stats satırı yok.
  - `updated_at_is_the_bound_now`: bağlanan kill'in `updated_at`'i `NOW`.

- [ ] **Adım 3: Başarısız olduğunu gör**
      `cargo test -p worker-sovereignty-correlate` (`DATABASE_URL`, `backend/.env`'den
      tırnaksız ve `?` sonrası atılmış). Beklenen: `correlate` tanımsız, derleme hatası.

- [ ] **Adım 4: `lib.rs`'i yaz**, _Ortak SQL_ üç `const`; `$1`'e `NaiveDateTime`.

- [ ] **Adım 5: `main.rs`'i yaz**, `worker-sovereignty-snapshot/src/main.rs` düzeninde,
      `now = Utc::now().naive_utc()`. Log'lar:
      `⚔️  starting sovereignty killmail correlation...`,
      `📡 correlating against {campaigns} campaigns`,
      `✅ correlation complete: {tagged} new killmails tagged, {with_kills}/{campaigns} campaigns have war kills ({s:.2}s)`,
      hata → `❌ sovereignty correlation failed: {e:#}`, çıkış kodu 1.

- [ ] **Adım 6: Geçtiğini gör ve testlerin yakaladığını kanıtla**
      `cargo test -p worker-sovereignty-correlate` → 11 test PASS.
      Geçici bozma: `<= e.window_end` → `< e.window_end`, `ORDER BY ... e.start_time` →
      `e.start_time DESC`, `24 hours` (eligible WHERE'lerinde) → `1 hours`; ilgili
      testler FAIL, sonra geri al ve tekrar PASS.
      `cargo clippy -p worker-sovereignty-correlate --all-targets -- -D warnings`, `cargo fmt --check` → temiz.

- [ ] **Adım 7: Commit**, spec ve planla birlikte:
      `feat(rust): sovereignty killmail correlation job (worker:sov:correlate:rs)`

### Task 2: Node `worker-sovereignty-correlate.ts` düzeltmesi

**Dosyalar:**

- Değiştir: `backend/src/workers/worker-sovereignty-correlate.ts` (bütün gövde)
- Oluştur: `backend/src/workers/worker-sovereignty-correlate.spec.ts`
  (`worker-sovereignty-snapshot.spec.ts` mock düzeni)

**Arayüzler:**

- Üretir:
  - `export function timestampFor(now: Date): string`: `'YYYY-MM-DD HH:MM:SS.mmm'`, UTC.
  - `export async function correlateSovereigntyKillmails(now: Date = new Date()): Promise<void>`:
    `prismaWorker.$transaction` içinde CAMPAIGNS (`tx.$queryRaw`, `COUNT(*)::int AS n`),
    TAG ve STATS (`tx.$executeRaw`). `${ts}::timestamp`.
  - `require.main === module` koruması.

- [ ] **Adım 1: Başarısız spec'i yaz**

  - `timestampFor`: `2026-11-22T12:00:00.123Z → '2026-11-22 12:00:00.123'`,
    `2026-11-22T00:00:00.000Z → '2026-11-22 00:00:00.000'`.
  - `runs the three statements in one transaction`: `tx.$queryRaw` →
    `[{ n: 3 }]`, `tx.$executeRaw` → `5` ve `2` → `$transaction` 1 kez,
    `$executeRaw` 2 kez, bütün bağlı değerler `'2026-11-22 12:00:00.000'`
    (string), `logger.info` `5 new killmails tagged, 2/3 campaigns` içerir.

- [ ] **Adım 2: Başarısız olduğunu gör**
      `yarn workspace backend vitest run src/workers/worker-sovereignty-correlate.spec.ts` → FAIL, export yok.

- [ ] **Adım 3: Worker'ı yeniden yaz.** Log metinleri Task 1 Adım 5 ile aynı.
      Dosya başı yorum: uygun kampanyalar, pencere, çakışma kuralı, Rust karşılığı.

- [ ] **Adım 4: Geçtiğini gör**, aynı komut → PASS. `yarn workspace backend build` → temiz.
      TAG ve STATS metni Rust'takiyle boşluk normalize edilerek `diff`'lenir → aynı.

- [ ] **Adım 5: Commit**
      `fix(sov): correlate keeps ended campaigns for 24 hours in one transaction`

### Task 3: Doküman

- Değiştir: `backend/docs/workers/sovereignty-workers.md`, `worker:sov:correlate`
  satırı: "tags war kills of active campaigns and those ended in the last 24 h
  (window start − 24 h … end) + rolls up combat stats incl. attacker/defender ISK split".

- [ ] **Adım 1: Düzenle**, `npx prettier --check` → temiz.
- [ ] **Adım 2: Commit** `docs(sov): correlate covers campaigns ended in the last 24 hours`

### Son doğrulama

- [ ] `qa` agent'ı arka planda: `yarn test`, `yarn workspace backend build`,
      `cargo test --workspace`, clippy, fmt, değişen dosyalarda prettier.
- [ ] Final reviewer (en yetenekli model), İnceleme Odağı ile.
- [ ] Elle çalıştırma kullanıcıda, `backend/` içinde: `yarn worker:sov:correlate`, sonra
      `yarn worker:sov:correlate:rs`. İkincisi `0 new killmails tagged` ve aynı
      `Y/N` demeli. Kontrol: `SELECT COUNT(*) FROM killmails WHERE is_war_related`.
