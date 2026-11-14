//! The corporation queue publisher's testable parts: where the IDs come from.

use sqlx::PgPool;

/// The queue `worker-info-corporations` consumes.
pub const QUEUE_NAME: &str = "esi_corporation_info_queue";
/// The `source` field of every message, the Node script's name.
pub const SOURCE: &str = "queue-corporations";

/// The IDs given on the command line. One that is not a whole `i32` is
/// skipped; unlike `parseInt`, `"12abc"` is not 12.
pub fn parse_ids(args: &[String]) -> Vec<i32> {
    args.iter().filter_map(|arg| arg.parse().ok()).collect()
}

/// Every corporation in the database, in ID order (`queue-corporations.ts:38-42`).
pub async fn all_corporation_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar("SELECT id FROM corporations ORDER BY id")
        .fetch_all(pool)
        .await
}
