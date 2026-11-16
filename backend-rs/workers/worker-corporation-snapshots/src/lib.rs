//! Daily corporation snapshot: one `corporation_snapshots` row per
//! corporation per UTC day. The Rust counterpart of
//! `backend/src/workers/worker-corporation-snapshots.ts`, which runs the same
//! SQL.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;

/// The snapshot date: the UTC calendar day of `now`, whatever the machine's
/// time zone.
pub fn utc_day(now: DateTime<Utc>) -> NaiveDate {
    now.date_naive()
}

/// What one run did: `total` corporations, of which `created` got a new row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SnapshotTotals {
    pub total: i64,
    pub created: u64,
}

impl SnapshotTotals {
    /// Corporations that already had a snapshot for the day.
    pub fn existing(&self) -> i64 {
        self.total - self.created as i64
    }
}

/// Inserts `day`'s snapshot for every corporation that has none yet. One
/// that already has a row for `day` keeps it unchanged, so there is one
/// snapshot per corporation per day.
pub async fn take_corporation_snapshots(
    pool: &PgPool,
    day: NaiveDate,
) -> sqlx::Result<SnapshotTotals> {
    // One statement: the total and the insert see the same snapshot of the
    // data, so `created` never exceeds `total`, and no transaction is held
    // open between round trips.
    let row = sqlx::query!(
        r#"
        WITH inserted AS (
          INSERT INTO corporation_snapshots (corporation_id, member_count, snapshot_date)
          SELECT id, member_count, $1 FROM corporations
          ON CONFLICT (corporation_id, snapshot_date) DO NOTHING
          RETURNING 1
        )
        SELECT (SELECT COUNT(*) FROM corporations) AS "total!",
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
