//! Daily sovereignty snapshot: one `sovereignty_map_snapshots` row per owned
//! system and one `alliance_territory_stats` row per alliance, both dated the
//! previous UTC day. The Rust counterpart of
//! `backend/src/workers/worker-sovereignty-snapshot.ts`, which runs the same
//! four statements; see the spec,
//! `docs/superpowers/specs/2026-11-21-rust-sovereignty-snapshot-design.md`.
//!
//! A row is the day's close: the timer fires at 01:00 UTC, so the map,
//! structure and campaign counts are those of 01:00, and gained / lost count
//! the whole previous day, `[D 00:00, D+1 00:00)`. The day is deleted and
//! rewritten in one transaction, so a re-run leaves exactly the latest state.

use chrono::{DateTime, Days, NaiveDate, Utc};
use sqlx::PgPool;

/// The day a run writes: the UTC day before `now`.
pub fn snapshot_date(now: DateTime<Utc>) -> NaiveDate {
    now.date_naive()
        .checked_sub_days(Days::new(1))
        .expect("a calendar day before a real date exists")
}

#[derive(Debug, PartialEq, Eq)]
pub enum SnapshotOutcome {
    /// `sovereignty_map_current` is empty; nothing was deleted or written.
    EmptyMap,
    Written {
        map_rows: u64,
        stat_rows: u64,
    },
}

const MAP_IS_EMPTY: &str = "SELECT NOT EXISTS (SELECT 1 FROM sovereignty_map_current)";

const DELETE_MAP: &str = "DELETE FROM sovereignty_map_snapshots WHERE snapshot_date = $1::date";

const INSERT_MAP: &str = "
INSERT INTO sovereignty_map_snapshots
  (solar_system_id, alliance_id, corporation_id, faction_id, snapshot_date)
SELECT solar_system_id, alliance_id, corporation_id, faction_id, $1::date
FROM sovereignty_map_current";

const DELETE_STATS: &str = "DELETE FROM alliance_territory_stats WHERE date = $1::date";

/// IHub 32458, TCU 32226. An attacker is every participant of an open
/// campaign other than its defender; `IS DISTINCT FROM` counts them all when
/// the defender is NULL, as the Node `!==` always did.
const INSERT_STATS: &str = "
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
LEFT JOIN lost USING (alliance_id)";

/// Replaces day `date` of both tables in one transaction. An empty current
/// map writes nothing: the delete would otherwise blank a day that may hold
/// a good earlier run.
pub async fn snapshot(pool: &PgPool, date: NaiveDate) -> Result<SnapshotOutcome, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let empty: bool = sqlx::query_scalar(MAP_IS_EMPTY).fetch_one(&mut *tx).await?;
    if empty {
        tx.rollback().await?;
        return Ok(SnapshotOutcome::EmptyMap);
    }

    sqlx::query(DELETE_MAP).bind(date).execute(&mut *tx).await?;
    let map_rows = sqlx::query(INSERT_MAP)
        .bind(date)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    sqlx::query(DELETE_STATS)
        .bind(date)
        .execute(&mut *tx)
        .await?;
    let stat_rows = sqlx::query(INSERT_STATS)
        .bind(date)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    tx.commit().await?;

    Ok(SnapshotOutcome::Written {
        map_rows,
        stat_rows,
    })
}
