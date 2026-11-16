//! Recomputes `alliances.member_count` and `corporation_count` from the
//! `corporations` table. The Rust counterpart of
//! `backend/src/workers/update-alliance-counts.ts`, which runs the same SQL.
//!
//! This job is the only writer of those two columns: the alliance snapshot
//! job reads `corporations` itself and writes only `alliance_snapshots`, so
//! the two never wait for each other.

use sqlx::PgPool;

/// Sets both counts on every alliance in one statement. An alliance with no
/// corporation gets 0; a corporation whose alliance is not in the table is
/// ignored. `updated_at` is left alone: it tracks the ESI data, not this
/// recount. Returns the number of alliances updated.
pub async fn update_alliance_counts(pool: &PgPool) -> sqlx::Result<u64> {
    let result = sqlx::query!(
        r#"
        UPDATE alliances a
        SET member_count = COALESCE(s.members, 0),
            corporation_count = COALESCE(s.corps, 0)
        FROM alliances a2
        LEFT JOIN (
          SELECT alliance_id, COUNT(*)::int AS corps, SUM(member_count)::int AS members
          FROM corporations
          WHERE alliance_id IS NOT NULL
          GROUP BY alliance_id
        ) s ON s.alliance_id = a2.id
        WHERE a.id = a2.id
        "#
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}
