//! Daily alliance snapshot: one `alliance_snapshots` row per alliance per UTC
//! day. The Rust counterpart of `backend/src/workers/worker-alliance-snapshots.ts`,
//! which runs the same SQL.
//!
//! The counts come straight from `corporations`, not from the `alliances`
//! columns, and this job writes nothing but `alliance_snapshots`:
//! `update-alliance-counts` owns those columns, and both run at the same
//! time without waiting for each other.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;

/// The snapshot date: the UTC calendar day of `now`, whatever the machine's
/// time zone.
pub fn utc_day(now: DateTime<Utc>) -> NaiveDate {
    now.date_naive()
}

/// What one run did: `total` alliances, of which `created` got a new row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SnapshotTotals {
    pub total: i64,
    pub created: u64,
}

impl SnapshotTotals {
    /// Alliances that already had a snapshot for the day.
    pub fn existing(&self) -> i64 {
        self.total - self.created as i64
    }
}

/// Inserts `day`'s snapshot for every alliance that has none yet. An alliance
/// with no corporation is recorded with zeros; one that already has a row for
/// `day` keeps it unchanged, so there is one snapshot per alliance per day.
pub async fn take_alliance_snapshots(
    pool: &PgPool,
    day: NaiveDate,
) -> sqlx::Result<SnapshotTotals> {
    // One statement: the total and the insert see the same snapshot of the
    // data, so `created` never exceeds `total`, and no transaction is held
    // open between round trips.
    let row = sqlx::query!(
        r#"
        WITH inserted AS (
          INSERT INTO alliance_snapshots
            (alliance_id, member_count, corporation_count, snapshot_date)
          SELECT a.id, COALESCE(s.members, 0), COALESCE(s.corps, 0), $1
          FROM alliances a
          LEFT JOIN (
            SELECT alliance_id, COUNT(*)::int AS corps, SUM(member_count)::int AS members
            FROM corporations
            WHERE alliance_id IS NOT NULL
            GROUP BY alliance_id
          ) s ON s.alliance_id = a.id
          ON CONFLICT (alliance_id, snapshot_date) DO NOTHING
          RETURNING 1
        )
        SELECT (SELECT COUNT(*) FROM alliances) AS "total!",
               (SELECT COUNT(*) FROM inserted) AS "created!"
        "#,
        day
    )
    .fetch_one(pool)
    .await?;
    Ok(SnapshotTotals {
        total: row.total,
        created: row.created as u64,
    })
}
