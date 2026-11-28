//! The stream's durable position: one row of `stream_cursors`, holding the
//! next sequence to read (spec §1).

use chrono::NaiveDateTime;
use sqlx::PgPool;

/// This worker's row.
pub const STREAM: &str = "r2z2";

pub async fn load(pool: &PgPool) -> sqlx::Result<Option<i64>> {
    sqlx::query_scalar("SELECT sequence FROM stream_cursors WHERE stream = $1")
        .bind(STREAM)
        .fetch_optional(pool)
        .await
}

/// `now` is UTC.
pub async fn save(pool: &PgPool, sequence: i64, now: NaiveDateTime) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO stream_cursors (stream, sequence, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (stream) DO UPDATE
         SET sequence = EXCLUDED.sequence, updated_at = EXCLUDED.updated_at",
    )
    .bind(STREAM)
    .bind(sequence)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}
