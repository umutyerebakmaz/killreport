# Rust sovereignty işleri (campaigns, map, structures) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `worker:sov:campaigns`, `worker:sov:map` ve `worker:sov:structures`'ın
Rust karşılıklarını eklemek, alert kodunu ortak bir `sov` crate'ine koymak ve
spec'teki dört düzeltmeyi Node tarafına da uygulamak.

**Architecture:** `backend-rs/crates/sov` alert olayını, zenginleştirmeyi (tek
SQL) ve Redis yayınını taşır. Üç tek seferlik worker crate'i
(`worker-system-activity` kalıbı) her biri `lib.rs`'te bir `sync` fonksiyonu
sunar: ESI'yi çeker, tek transaction'da yazar ve yayınlanacak alert'leri
döndürür; `main.rs` yalnızca kaynakları kurar, `sync`'i çağırır, alert'leri
yayınlar ve loglar. Node tarafında üç worker test edilebilir hale getirilip
düzeltilir.

**Tech Stack:** Rust (sqlx 0.8, chrono, serde, redis 1.8, tokio, wiremock;
`esi`, `db`, `runner`), TypeScript (Prisma, vitest 5).

**Spec:** `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`

## Global Constraints

- ESI yolları `/sovereignty/campaigns`, `/sovereignty/map`,
  `/sovereignty/structures`, `EsiClient::get` (varsayılan uyumluluk tarihi).
- Zaman sütunları `timestamp(3) without time zone`, UTC. "Şimdi" SQL'de
  `now()` ile **yazılmaz**; çalışmanın `Utc::now().naive_utc()` değeri
  parametre olarak bağlanır (oturum saat dilimi UTC değilse `now()` kayar).
  Prisma `@updatedAt` sütunları (`updated_at`, `last_updated`, `last_seen`)
  ham SQL'de bu değerle elle yazılır.
- Alert JSON'u: alanlar sırasıyla `type, message, solarSystemId,
solarSystemName, regionName, allianceId, allianceName, allianceTicker,
outcome, changeType, timestamp`; `timestamp` `%Y-%m-%dT%H:%M:%S%.3fZ`.
  Kanal `SOVEREIGNTY_ALERT`, mesaj `serde_json::to_string(&alert)`.
- Yayın yalnızca `USE_REDIS_PUBSUB == "true"` iken; `REDIS_URL`, yoksa
  `esi::DEFAULT_REDIS_URL`. Yayın hatası `error!`, çıkış kodunu değiştirmez.
- Alert sınırı: çalışma başına 25 (campaigns'te başlayan + biten toplamı,
  önce başlayanlar; map'te değişikliklerin ilk 25'i). Alert'ler commit'ten
  sonra.
- Boş feed: campaigns bitirmeyi atlar (mevcut); structures ve map hiçbir şey
  yazmaz, uyarı metinleri iki tarafta aynı:
  `⚠️  ESI returned 0 sovereignty structures — skipping this run` ve
  `⚠️  ESI returned no owned systems — skipping this run`.
- `sqlx::query!` makrosu değil `sqlx::query` / `query_as` / `query_scalar`
  (CI `SQLX_OFFLINE=true`).
- Fixture'lar `pg_dump --schema-only` ile üretilir, el yazımı değil;
  `worker-alliance-snapshots/tests/fixtures/alliance_snapshots.sql`
  başındaki yorum komutuyla birlikte kopyalanır.
- systemd unit ve timer'ları değişmez. Yarn, asla npm. Commit mesajları
  İngilizce, Claude atfı yok.
- CI: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test`, `yarn test`, `yarn workspace backend build`,
  `npx prettier --check`.

## Review Focus

1. **Kampanyada `participants` ya da `defender_id` alanı yok** → satır
   yazılır, katılımcı yok, `defender_id` NULL. Task 3
   `a_campaign_without_participants_or_defender`.
2. **Veritabanı oturumu UTC değil** → yazılan `end_time` / `destroyed_at`
   bağlanan `now` ile birebir aynı. Task 2 ve 3'te
   `SET TIME ZONE 'Europe/Istanbul'` ile çalışan bir test.
3. **`USE_REDIS_PUBSUB=true` ama Redis erişilemez** → `publish` `Err` döner,
   panik yok; veri zaten commit'lenmiş. Task 1
   `publish_to_an_unreachable_redis_errors`.
4. **Alert'teki sistem `solar_systems`'ta yok** → `solarSystemName: null`,
   mesaj `#<id>` ile. Task 1 `unknown_system_falls_back_to_its_id`.
5. **Biten kampanya feed'e geri döner** → `end_time` ve `outcome` temizlenir,
   `campaign_started` alert'i çıkmaz. Task 3 `a_reappearing_campaign_reopens`.

---

### Task 1: `sov` kütüphanesi

**Files:**

- Create: `backend-rs/crates/sov/{Cargo.toml,src/lib.rs}`
- Modify: `backend-rs/Cargo.toml` (`[workspace.dependencies]`'e `sov = { path = "crates/sov" }`)
- Create: `backend-rs/crates/sov/tests/fixtures/{regions,constellations,solar_systems,alliances,rows}.sql`
- Test: `backend-rs/crates/sov/tests/{message,build,publish}.rs`

**Interfaces:**

- Produces:
  - `pub const MAX_ALERTS: usize = 25;`
  - `#[derive(Debug, Clone, PartialEq)] pub enum AlertEvent { CampaignStarted { system_id: i32, defender_id: Option<i32> }, CampaignEnded { system_id: i32, defender_id: Option<i32>, outcome: Option<String> }, TerritoryChange { system_id: i32, previous_owner_id: Option<i32>, new_owner_id: Option<i32>, change_type: Option<String> } }`
  - `#[derive(Debug, Clone, PartialEq, Serialize)] #[serde(rename_all = "camelCase")] pub struct SovereigntyAlert { pub r#type: String, pub message: String, pub solar_system_id: i32, pub solar_system_name: Option<String>, pub region_name: Option<String>, pub alliance_id: Option<i32>, pub alliance_name: Option<String>, pub alliance_ticker: Option<String>, pub outcome: Option<String>, pub change_type: Option<String>, pub timestamp: String }` (`r#type` → JSON `type`)
  - `impl AlertEvent { pub fn system_id(&self) -> i32; pub fn alliance_id(&self) -> Option<i32> }`
  - `pub fn alert_message(event: &AlertEvent, system_name: Option<&str>, region_name: Option<&str>) -> String`
  - `pub async fn build_alert(pool: &PgPool, event: &AlertEvent, now: DateTime<Utc>) -> sqlx::Result<SovereigntyAlert>`
  - `pub struct AlertPublisher` ; `impl AlertPublisher { pub fn from_env() -> Self; pub fn new(redis_url: Option<String>) -> Self; pub fn is_enabled(&self) -> bool; pub async fn publish(&self, alert: &SovereigntyAlert) -> anyhow::Result<()>; pub async fn publish_all(&self, pool: &PgPool, events: &[AlertEvent], now: DateTime<Utc>) -> usize }`
    — `new(None)` kapalı; `publish` kapalıyken `Ok(())`. `publish_all`
    her olayı kurar ve yayınlar, hatayı `error!` ile loglar ve devam eder;
    yayınlanan sayısını döndürür. Bağlantı ilk `publish`'te açılır (tek
    `redis::aio::MultiplexedConnection`, `tokio::sync::OnceCell`).

- [ ] **Step 1: `Cargo.toml` ve fixture'lar**

Bağımlılıklar: `anyhow, chrono, redis, serde, serde_json, sqlx, tokio,
tracing` (workspace), `esi` (`DEFAULT_REDIS_URL` için). Dev: `sqlx` +
`migrate` (`worker-system-activity/Cargo.toml` gibi). Fixture'lar
`regions → constellations → solar_systems` zinciri ve `alliances`;
`rows.sql`: region 10000001 `Delve`, constellation 20000001, sistem
30000001 `1DQ1-A`, constellation'ı NULL olan sistem 30000002 `Orphan`,
alliance 99000001 `Goonswarm` / `CONDI`.

- [ ] **Step 2: Başarısız testleri yaz**

```rust
// tests/message.rs
// campaign_started_with_region:  "New sovereignty campaign in 1DQ1-A (Delve)"
// campaign_started_without_region: "New sovereignty campaign in 1DQ1-A"
// campaign_ended_unresolved:     outcome None → "Campaign in 1DQ1-A (Delve) ended — unresolved"
// campaign_ended_with_outcome:   "… ended — defender_won"
// territory_change_with_region:  "1DQ1-A sovereignty captured (Delve)"
// territory_change_unnamed:      change_type None, no region → "1DQ1-A sovereignty changed"
// unknown_system_uses_its_id:    system_name None, id 31 → "New sovereignty campaign in #31"
// alliance_id_prefers_new_owner: TerritoryChange{prev Some(1), new Some(2)} → Some(2); {prev Some(1), new None} → Some(1)
// json_field_order_and_names: serde_json::to_string of one fixed alert ==
//   r#"{"type":"campaign_ended","message":"Campaign in 1DQ1-A (Delve) ended — defender_won","solarSystemId":30000001,"solarSystemName":"1DQ1-A","regionName":"Delve","allianceId":99000001,"allianceName":"Goonswarm","allianceTicker":"CONDI","outcome":"defender_won","changeType":null,"timestamp":"2026-11-20T12:00:00.000Z"}"#

// tests/build.rs  (#[sqlx::test(migrations = false, fixtures(...))])
// builds_system_region_and_alliance: CampaignStarted{30000001, Some(99000001)}
//   now 2026-11-20T12:00:00Z → name 1DQ1-A, region Delve, Goonswarm/CONDI,
//   timestamp "2026-11-20T12:00:00.000Z", outcome None, change_type None
// system_without_constellation_has_no_region: 30000002 → region None, message "… in Orphan"
// unknown_system_falls_back_to_its_id: 31 → solar_system_name None, message "… in #31"
// unknown_alliance_is_null: defender Some(1) → alliance_name None, alliance_id Some(1)
// ended_and_change_carry_their_fields: outcome / change_type copied into the alert

// tests/publish.rs
// disabled_publisher_is_a_no_op: AlertPublisher::new(None).publish(&a) → Ok, !is_enabled()
// publish_to_an_unreachable_redis_errors: new(Some("redis://127.0.0.1:1")) → Err, no panic
```

- [ ] **Step 3: Çalıştır, başarısız olduğunu gör**

Run (`backend-rs/`): `cargo test -p sov`
Expected: FAIL, derleme hatası.

- [ ] **Step 4: `lib.rs`'i yaz**

`build_alert` tek sorgu:

```sql
SELECT s.name, r.name, a.name, a.ticker
FROM (SELECT $1::int AS system_id, $2::int AS alliance_id) q
LEFT JOIN solar_systems s ON s.system_id = q.system_id
LEFT JOIN constellations c ON c.constellation_id = s.constellation_id
LEFT JOIN regions r ON r.region_id = c.region_id
LEFT JOIN alliances a ON a.id = q.alliance_id
```

`from_env`: `USE_REDIS_PUBSUB` tam olarak `"true"` ise `REDIS_URL` (yoksa
`esi::DEFAULT_REDIS_URL`) ile açık. Kapalıysa bir kez
`info!("📡 USE_REDIS_PUBSUB is not true — sovereignty alerts are not published")`.
Modül başı `//!`: Node karşılıkları (`alert-builder.ts`, `pubsub.ts`), Yoga
event target'ının tel biçimi, spec yolu.

- [ ] **Step 5: Çalıştır, geçtiğini gör**

Run: `cargo test -p sov`
Expected: 16 test PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-rs/crates/sov backend-rs/Cargo.toml backend-rs/Cargo.lock
git commit -m "feat(rust): sov crate builds and publishes sovereignty alerts"
```

### Task 2: `worker-sovereignty-structures`

**Files:**

- Create: `backend-rs/workers/worker-sovereignty-structures/{Cargo.toml,src/lib.rs,src/main.rs}`
- Create: `.../tests/fixtures/sovereignty_structures.sql`
- Test: `.../tests/sync.rs`
- Modify: `backend/package.json` (`worker:sov:structures` altına)

**Interfaces:**

- Consumes: yok (`sov` gerekmez).
- Produces:
  - `#[derive(Debug, Clone, Deserialize)] pub struct EsiStructure { pub structure_id: i64, pub solar_system_id: i32, pub structure_type_id: i32, pub alliance_id: i32, pub vulnerability_occupancy_level: Option<f64>, pub vulnerable_start_time: Option<DateTime<Utc>>, pub vulnerable_end_time: Option<DateTime<Utc>> }`
  - `#[derive(Debug, PartialEq)] pub enum StructuresOutcome { EmptyFeed, Synced { upserted: u64, destroyed: u64 } }`
  - `pub async fn write_structures(pool: &PgPool, structures: &[EsiStructure], now: NaiveDateTime) -> sqlx::Result<StructuresOutcome>`
  - `pub async fn sync(esi: &EsiClient, pool: &PgPool, now: NaiveDateTime) -> anyhow::Result<(usize, StructuresOutcome)>` (ilk değer ESI'den gelen sayı)

- [ ] **Step 1: Başarısız testleri yaz** (`tests/sync.rs`)

```rust
// inserts_new_structures: 2 structures → Synced{upserted 2, destroyed 0};
//   first_seen and last_seen == now, destroyed_at NULL
// updates_owner_and_window_keeps_system_and_type:
//   existing row (system 1, type 32226, alliance 1); feed same id with
//   system 2, type 99, alliance 2, vuln 1.5 → alliance 2, vuln 1.5,
//   system still 1, type still 32226
// marks_missing_structures_destroyed: existing A, B; feed [A] → destroyed 1, B.destroyed_at == now
// already_destroyed_is_not_touched_again: B destroyed_at t0; feed [A] → B still t0
// a_reappearing_structure_is_revived: B destroyed; feed [A, B] → B.destroyed_at NULL
// empty_feed_writes_nothing: existing A; feed [] → EmptyFeed, A.destroyed_at NULL
// now_is_bound_with_a_non_utc_session: the test takes
//   `(pool_opts: PgPoolOptions, conn_opts: PgConnectOptions)` from
//   #[sqlx::test] and connects with conn_opts.options([("TimeZone", "Europe/Istanbul")]);
//   existing A, B; feed [A] → B.destroyed_at == now exactly
// sync_reads_the_esi_list: wiremock GET /sovereignty/structures → (n, Synced{..})
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `cargo test -p worker-sovereignty-structures`
Expected: FAIL, derleme hatası.

- [ ] **Step 3: `lib.rs`**

Boş liste → `EmptyFeed`, veritabanına gidilmez. Değilse tek transaction:
UNNEST upsert (`ON CONFLICT (structure_id) DO UPDATE SET alliance_id,
vulnerability_occupancy_level, vulnerable_start_time, vulnerable_end_time,
destroyed_at = NULL, last_seen = $now`; yeni satırda `first_seen = last_seen
= $now`), ardından `UPDATE sovereignty_structures SET destroyed_at = $now
WHERE destroyed_at IS NULL AND structure_id <> ALL($ids::bigint[])`.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: `cargo test -p worker-sovereignty-structures`
Expected: 8 test PASS.

- [ ] **Step 5: `main.rs` ve script**

`worker-system-activity/src/main.rs` kalıbı. Loglar Node sırasıyla:
`🛰️  starting sovereignty structures sync...`,
`📡 received N structures from ESI`, `EmptyFeed` → Global Constraints'teki
uyarı, `✅ structures sync complete: U upserted, D marked destroyed (S.SSs)`;
hata → `❌ sovereignty structures sync failed: {e:#}`, `exit(1)`.

```json
"worker:sov:structures:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-sovereignty-structures",
```

- [ ] **Step 6: Commit**

```bash
git add backend-rs/workers/worker-sovereignty-structures backend-rs/Cargo.lock backend/package.json
git commit -m "feat(rust): sovereignty structures job (worker:sov:structures:rs)"
```

### Task 3: `worker-sovereignty-campaigns`

**Files:**

- Create: `backend-rs/workers/worker-sovereignty-campaigns/{Cargo.toml,src/lib.rs,src/main.rs}`
- Create: `.../tests/fixtures/{sovereignty_campaigns,campaign_participants}.sql`
- Test: `.../tests/{outcome,sync}.rs`
- Modify: `backend/package.json`

**Interfaces:**

- Consumes: `sov::{AlertEvent, AlertPublisher, MAX_ALERTS}` (Task 1).
- Produces:
  - `pub const OUTCOME_EPS: f64 = 0.05;`
  - `pub fn infer_outcome(defender: Option<f64>, attackers: Option<f64>) -> &'static str`
  - `#[derive(Debug, Clone, Deserialize)] pub struct EsiCampaign { pub campaign_id: i32, pub constellation_id: i32, pub solar_system_id: i32, pub structure_id: i64, pub event_type: String, pub defender_id: Option<i32>, pub defender_score: Option<f64>, pub attackers_score: Option<f64>, pub start_time: DateTime<Utc>, #[serde(default)] pub participants: Vec<EsiParticipant> }`, `pub struct EsiParticipant { pub alliance_id: i32, pub score: f64 }`
  - `#[derive(Debug)] pub struct CampaignsOutcome { pub active: usize, pub participants: usize, pub ended: u64, pub skipped_end_marking: bool, pub alerts: Vec<AlertEvent> }` (`alerts` en çok `MAX_ALERTS`, önce başlayanlar)
  - `pub async fn write_campaigns(pool: &PgPool, campaigns: &[EsiCampaign], now: NaiveDateTime) -> sqlx::Result<CampaignsOutcome>`
  - `pub async fn sync(esi: &EsiClient, pool: &PgPool, now: NaiveDateTime) -> anyhow::Result<CampaignsOutcome>`

- [ ] **Step 1: Başarısız testleri yaz**

```rust
// tests/outcome.rs
// both_null → "abandoned"; (Some(0.01), Some(0.04)) → "abandoned";
// (Some(0.6), Some(0.6)) → "defender_won"; (Some(0.2), Some(0.7)) → "attacker_won";
// (None, Some(0.3)) → "attacker_won"; (Some(0.3), None) → "defender_won"

// tests/sync.rs
// baseline_import_has_no_started_alerts: empty table, feed [A, B] → 2 rows, alerts []
// a_new_campaign_alerts: table has A; feed [A, B] → alerts == [CampaignStarted{B.system, B.defender}]
// updates_scores_keeps_identity: existing A; feed A with new scores and a
//   different event_type → scores updated, event_type / start_time unchanged
// a_reappearing_campaign_reopens: A end_time t0, outcome "abandoned"; feed [A]
//   → end_time NULL, outcome NULL, no CampaignStarted
// upserts_participants: feed A with [(1, 0.3), (2, 0.1)], then again with
//   [(1, 0.5)] → (1, 0.5), (2, 0.1) still present (not deleted)
// a_campaign_without_participants_or_defender: JSON without both fields
//   deserialises; row defender_id NULL, 0 participants
// ends_missing_campaigns_with_outcome: active A, B; feed [A] → ended 1,
//   B.end_time == now, B.outcome from infer_outcome(B scores),
//   alerts contains CampaignEnded{B.system, B.defender, Some(outcome)}
// empty_feed_skips_end_marking: active A; feed [] → skipped_end_marking,
//   A.end_time NULL, ended 0
// alerts_are_capped_in_total_started_first: table has 1 row; feed has 20 new
//   campaigns while 10 active ones disappear → alerts.len() == 25, first 20
//   are CampaignStarted, last 5 CampaignEnded; all 10 still ended in the db
// now_is_bound_with_a_non_utc_session: as in Task 2; active A, B; feed [A]
//   → B.end_time == now exactly
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `cargo test -p worker-sovereignty-campaigns`
Expected: FAIL, derleme hatası.

- [ ] **Step 3: `lib.rs`**

Tek transaction, spec'teki sıra: `count(*)` ile baseline, feed ID'lerinden
var olanlar; kampanyalar UNNEST upsert (`ON CONFLICT (campaign_id) DO UPDATE
SET defender_id, defender_score, attackers_score, end_time = NULL,
outcome = NULL, updated_at = $now`; yeni satırda `first_seen = updated_at =
$now`); katılımcılar düzleştirilip tek UNNEST upsert (`ON CONFLICT
(campaign_id, alliance_id) DO UPDATE SET score, updated_at`); feed boş
değilse `SELECT campaign_id, solar_system_id, defender_id, defender_score,
attackers_score FROM sovereignty_campaigns WHERE end_time IS NULL AND
campaign_id <> ALL($ids) FOR UPDATE`, outcome Rust'ta, tek UNNEST `UPDATE …
FROM UNNEST($ids, $outcomes)`. Alert listesi commit'ten sonra kesilip
döndürülür.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: `cargo test -p worker-sovereignty-campaigns`
Expected: 16 test PASS.

- [ ] **Step 5: `main.rs` ve script**

Loglar Node sırasıyla (`worker-sovereignty-campaigns.ts`): `🏰 starting …`,
`📡 received N active campaigns from ESI`, boş feed uyarısı (Node'daki metin),
`✅ campaigns sync complete: N active, P participants, E marked ended (S.SSs)`.
`sync`'ten sonra `AlertPublisher::from_env().publish_all(&pool, &o.alerts,
Utc::now())`. Script: `worker:sov:campaigns:rs`.

- [ ] **Step 6: Commit**

```bash
git add backend-rs/workers/worker-sovereignty-campaigns backend-rs/Cargo.lock backend/package.json
git commit -m "feat(rust): sovereignty campaigns job (worker:sov:campaigns:rs)"
```

### Task 4: `worker-sovereignty-map`

**Files:**

- Create: `backend-rs/workers/worker-sovereignty-map/{Cargo.toml,src/lib.rs,src/main.rs}`
- Create: `.../tests/fixtures/{sovereignty_map_current,territory_changes}.sql`
- Test: `.../tests/{diff,sync}.rs`
- Modify: `backend/package.json`

**Interfaces:**

- Consumes: `sov::{AlertEvent, AlertPublisher, MAX_ALERTS}`.
- Produces:
  - `#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)] pub struct Owner { pub alliance_id: Option<i32>, pub corporation_id: Option<i32>, pub faction_id: Option<i32> }` ; `impl Owner { pub fn is_owned(&self) -> bool }`
  - `#[derive(Debug, Clone, Deserialize)] pub struct EsiSovSystem { pub system_id: i32, pub alliance_id: Option<i32>, pub corporation_id: Option<i32>, pub faction_id: Option<i32> }`
  - `pub fn change_type(prev: Option<Owner>, next: Option<Owner>) -> &'static str`
  - `#[derive(Debug, Clone, PartialEq)] pub struct TerritoryChangeRow { pub solar_system_id: i32, pub previous_owner_id: Option<i32>, pub new_owner_id: Option<i32>, pub previous_faction_id: Option<i32>, pub new_faction_id: Option<i32>, pub change_type: &'static str }`
  - `#[derive(Debug, Default, PartialEq)] pub struct MapDiff { pub upserts: Vec<(i32, Owner)>, pub deletes: Vec<i32>, pub changes: Vec<TerritoryChangeRow> }`
  - `pub fn diff(existing: &HashMap<i32, Owner>, fetched: &[EsiSovSystem]) -> MapDiff` (sıra: fetched sırası, sonra silinenler `existing`'in system_id sırasıyla — deterministik olması için sıralanır)
  - `#[derive(Debug)] pub enum MapOutcome { NoOwnedSystems, Synced { owned: usize, updated: usize, lost: usize, changes: usize, initial: bool, alerts: Vec<AlertEvent> } }`
  - `pub async fn write_map(pool: &PgPool, fetched: &[EsiSovSystem], now: NaiveDateTime) -> sqlx::Result<MapOutcome>`
  - `pub async fn sync(esi: &EsiClient, pool: &PgPool, now: NaiveDateTime) -> anyhow::Result<(usize, MapOutcome)>`

- [ ] **Step 1: Başarısız testleri yaz**

```rust
// tests/diff.rs
// change_type: (None, A1) captured; (A1, None-alliance) lost; (A1, A2) transferred;
//   (faction 500001, faction 500002) faction_change; (A1 corp 1, A1 corp 2) faction_change
// unowned_entries_are_ignored: fetched {sys 1, all None} → no upsert, no change
// unchanged_system_is_skipped: existing {1: A1}, fetched {1: A1} → empty diff
// initial_population_logs_nothing: existing {}, fetched {1: A1, 2: A2} → 2 upserts, 0 changes
// owner_change_is_logged: existing {1: A1}, fetched {1: A2} → change transferred, prev 1 new 2
// lost_system_is_deleted_and_logged: existing {1: A1, 2: A2}, fetched {1: A1}
//   → deletes [2], change {2, prev A2, new None, lost}

// tests/sync.rs
// first_run_fills_the_baseline: empty table → Synced{initial true, changes 0}, rows == owned
// a_change_is_written_with_its_row: existing {1: A1}; fetched {1: A2} →
//   territory_changes 1 row, current row alliance 2, last_updated == now,
//   alerts [TerritoryChange{1, Some(1), Some(2), Some("transferred")}]
// no_owned_systems_writes_nothing: existing {1: A1}; fetched [] and
//   fetched [{1, all None}] → NoOwnedSystems, table unchanged, 0 changes
// writes_are_atomic: existing {1: A1, 2: A2}; the test first runs
//   ALTER TABLE sovereignty_map_current ADD CONSTRAINT ck CHECK (alliance_id <> 666);
//   fetched {1: A666} (system 2 lost) → Err from the upsert, which runs after
//   the territory_changes insert; territory_changes has 0 rows and
//   sovereignty_map_current still {1: A1, 2: A2}
// alerts_are_capped: 30 changes → alerts.len() == 25, all 30 rows written
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `cargo test -p worker-sovereignty-map`
Expected: FAIL, derleme hatası.

- [ ] **Step 3: `lib.rs`**

`write_map`: sahipli sistem yoksa `NoOwnedSystems`, hiçbir sorgu yazmaz.
Değilse `sovereignty_map_current` okunur, `diff`, tek transaction:
`territory_changes` UNNEST insert (`detected_at = $now`),
`sovereignty_map_current` UNNEST upsert (`last_updated = $now`),
`DELETE … WHERE solar_system_id = ANY($deletes)`. Commit'ten sonra ilk
`MAX_ALERTS` değişiklik `AlertEvent::TerritoryChange`'e çevrilir.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: `cargo test -p worker-sovereignty-map`
Expected: 11 test PASS.

- [ ] **Step 5: `main.rs` ve script**

Loglar Node sırasıyla (`worker-sovereignty-map.ts`): `🗺️  starting …`,
`📡 received N systems from ESI`, uyarı, `✅ map sync complete: O owned
systems, U updated, L lost, C territory changes logged[ (initial baseline —
changes not logged)] (S.SSs)`. Sonra `publish_all`. Script:
`worker:sov:map:rs`.

- [ ] **Step 6: Commit**

```bash
git add backend-rs/workers/worker-sovereignty-map backend-rs/Cargo.lock backend/package.json
git commit -m "feat(rust): sovereignty map job (worker:sov:map:rs)"
```

### Task 5: Node structures ve map düzeltmeleri

**Files:**

- Modify: `backend/src/workers/worker-sovereignty-structures.ts`
- Modify: `backend/src/workers/worker-sovereignty-map.ts`
- Test: `backend/src/workers/worker-sovereignty-structures.spec.ts`, `backend/src/workers/worker-sovereignty-map.spec.ts`

**Interfaces:**

- Produces: `export async function syncSovereigntyStructures(): Promise<void>`,
  `export async function syncSovereigntyMap(): Promise<void>`; çalıştırma
  `if (require.main === module)` arkasında
  (`worker-character-corporation-history.ts:247` kalıbı).

- [ ] **Step 1: Başarısız testleri yaz** (mock kalıbı
      `worker-character-corporation-history.spec.ts`: `vi.mock` ile
      `@services/prisma-worker`, `@services/sovereignty/sovereignty.service`,
      `@services/pubsub`, `@services/sovereignty/alert-builder`)

```ts
// structures: 'skips destroyed-marking when ESI returns no structures'
//   getSovereigntyStructures → [] ⇒ updateMany not called, upsert not called,
//   logger.warn called with '⚠️  ESI returned 0 sovereignty structures — skipping this run'
// map: 'writes nothing when ESI returns no owned systems'
//   existing [{1, alliance 1}], map [] and map [{system_id 1}] ⇒
//   $transaction, createMany, deleteMany not called; warn text from Global Constraints
// map: 'writes changes, upserts and deletes in one transaction'
//   existing {1: A1, 2: A2}, map {1: A2} ⇒ $transaction called once, and
//   territoryChange.createMany, $executeRaw (upsert), deleteMany are called on
//   the tx client, not on prismaWorker
// map: 'publishes alerts only after the transaction commits'
//   $transaction mock rejects ⇒ pubsub.publish not called
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend vitest run src/workers/worker-sovereignty-structures.spec.ts src/workers/worker-sovereignty-map.spec.ts`
Expected: FAIL (export yok).

- [ ] **Step 3: Düzeltmeleri yaz**

structures: fonksiyonu export et, boş feed koruması, `notIn: [-1]` hilesini
kaldır. map: fonksiyonu export et, sahipli sistem yoksa koruma, üç yazım
`prismaWorker.$transaction(async (tx) => …)` içinde; upsert tek
`tx.$executeRaw` UNNEST (`int[]` ×4, `last_updated` bağlı `now`), alert'ler
transaction'dan sonra.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: aynı komut. Expected: 4 test PASS. Ardından
`yarn workspace backend build` temiz.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workers/worker-sovereignty-structures.ts backend/src/workers/worker-sovereignty-structures.spec.ts backend/src/workers/worker-sovereignty-map.ts backend/src/workers/worker-sovereignty-map.spec.ts
git commit -m "fix(sov): structures and map skip an empty ESI feed; map writes in one transaction"
```

### Task 6: Node campaigns düzeltmesi, doğrulama, elle çalıştırma

**Files:**

- Modify: `backend/src/workers/worker-sovereignty-campaigns.ts`
- Test: `backend/src/workers/worker-sovereignty-campaigns.spec.ts`

**Interfaces:**

- Produces: `export async function syncSovereigntyCampaigns(): Promise<void>`,
  `require.main` koruması.

- [ ] **Step 1: Başarısız testleri yaz**

```ts
// 'publishes after every write, started alerts first'
//   1 existing, feed [existing, new]; one active campaign departs ⇒
//   pubsub.publish called twice, after the last upsert/update call
//   (compare mock invocationCallOrder), first alert type campaign_started
// 'caps started and ended alerts at 25 in total'
//   20 new campaigns, 10 departing ⇒ publish called 25 times, update called 10 times
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend vitest run src/workers/worker-sovereignty-campaigns.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Düzeltmeyi yaz**

Olaylar (`SovereigntyAlertEvent`) iki listede toplanır; bütün yazımlardan
sonra `[...started, ...ended].slice(0, MAX_ALERTS)` kurulup yayınlanır.
Satır başına `try/catch` kalır.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Expected: 2 test PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workers/worker-sovereignty-campaigns.ts backend/src/workers/worker-sovereignty-campaigns.spec.ts
git commit -m "fix(sov): campaigns publish alerts after writing, capped at 25 in total"
```

- [ ] **Step 6: Bütün kontroller** (`qa` agent'ına arka planda)

Run (`backend-rs/`): `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
Run (kök): `yarn test`, `yarn workspace backend build`,
`npx prettier --check backend/package.json backend/src/workers/worker-sovereignty-*.ts docs/superpowers/plans/2026-11-20-rust-sovereignty-jobs.md`
Expected: hepsi temiz.

- [ ] **Step 7: Yerel elle çalıştırma** (`backend/`)

`yarn worker:sov:structures:rs`, `yarn worker:sov:campaigns:rs`,
`yarn worker:sov:map:rs`, her biri iki kez. Expected: çıkış 0; ikinci
çalıştırmada campaigns `0 marked ended`, map `0 updated … 0 territory changes`,
structures `0 marked destroyed`. `psql` ile satır sayıları Node'un yazdığıyla
uyumlu. `USE_REDIS_PUBSUB=true` ise ayrı bir terminalde
`redis-cli SUBSCRIBE SOVEREIGNTY_ALERT` ile alert biçimi Node'unkiyle
karşılaştırılır (yeni olay yoksa alert çıkmaz; bu normal).

- [ ] **Step 8: Merge'den sonra #315**

Üç satır işaretlenir (crate adı ve PR numarası), "Done" sayısı güncellenir ve
"Shared code lives only in the library crates" cümlesine `sov` eklenir.
