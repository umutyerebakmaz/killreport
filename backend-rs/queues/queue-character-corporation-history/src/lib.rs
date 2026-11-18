//! The character corporation history queue publisher's testable parts: where
//! the IDs come from.

use sqlx::PgPool;

/// The queue `worker-character-corporation-history` consumes.
pub const QUEUE_NAME: &str = "esi_character_corporation_history_queue";
/// The `source` field of every message, the Node script's name.
pub const SOURCE: &str = "queue-character-corporation-history";

/// The IDs given on the command line. One that is not a whole `i32` is
/// skipped; unlike `parseInt`, `"12abc"` is not 12.
pub fn parse_ids(args: &[String]) -> Vec<i32> {
    args.iter().filter_map(|arg| arg.parse().ok()).collect()
}

/// Every character whose history was never fetched, or last fetched more
/// than 6 days ago, in ID order (`queue-character-corporation-history.ts:39-50`).
/// The threshold is shorter than the weekly schedule on purpose: at 7 days a
/// character fetched just after the previous run started would be skipped.
pub async fn stale_character_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT c.id FROM characters c
         LEFT JOIN (
           SELECT character_id, MAX(fetched_at) AS fetched_at
           FROM character_corporation_history
           GROUP BY character_id
         ) h ON h.character_id = c.id
         -- fetched_at is a UTC timestamp without time zone
         WHERE h.fetched_at IS NULL
            OR h.fetched_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '6 days'
         ORDER BY c.id",
    )
    .fetch_all(pool)
    .await
}
