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
    let mut tx = pool.begin().await?;
    let total = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM corporations"#)
        .fetch_one(&mut *tx)
        .await?;
    let created = sqlx::query!(
        r#"
        INSERT INTO corporation_snapshots (corporation_id, member_count, snapshot_date)
        SELECT id, member_count, $1 FROM corporations
        ON CONFLICT (corporation_id, snapshot_date) DO NOTHING
        "#,
        day
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;
    Ok(SnapshotTotals { total, created })
}
