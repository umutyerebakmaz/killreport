//! The character corporation queue publisher's testable parts: where the IDs
//! come from.

use sqlx::PgPool;

/// The queue `worker-info-corporations` consumes.
pub const QUEUE_NAME: &str = "esi_corporation_info_queue";
/// The `source` field of every message, the Node script's name.
pub const SOURCE: &str = "queue-character-corporations";

/// Every corporation a character points at, now or anywhere in its
/// employment history, that `corporations` does not have yet, in ID order.
/// The same statement as `queue-character-corporations.ts:24-35`: the UNION
/// de-duplicates, the anti-join leaves only the unknown ones.
pub async fn missing_corporation_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT ids.corporation_id
         FROM (
           SELECT corporation_id FROM characters
           UNION
           SELECT corporation_id FROM character_corporation_history
         ) ids
         WHERE NOT EXISTS (
           SELECT 1 FROM corporations c WHERE c.id = ids.corporation_id
         )
         ORDER BY ids.corporation_id",
    )
    .fetch_all(pool)
    .await
}
