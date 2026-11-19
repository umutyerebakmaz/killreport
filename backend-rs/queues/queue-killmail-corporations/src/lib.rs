//! The killmail corporation queue publisher's testable parts: where the IDs
//! come from.

use sqlx::PgPool;

/// The queue `worker-info-corporations` consumes.
pub const QUEUE_NAME: &str = "esi_corporation_info_queue";
/// The `source` field of every message, the same as the Node `scan:entities`.
pub const SOURCE: &str = "killmail_scan";

/// Every corporation a killmail's victim or attackers name that `corporations`
/// does not have yet, in ID order. The UNION de-duplicates, the anti-join
/// leaves only the unknown ones; NPCs are not filtered out.
pub async fn missing_corporation_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT ids.id
         FROM (
           SELECT corporation_id AS id FROM victims WHERE corporation_id IS NOT NULL
           UNION
           SELECT corporation_id FROM attackers WHERE corporation_id IS NOT NULL
         ) ids
         WHERE NOT EXISTS (SELECT 1 FROM corporations c WHERE c.id = ids.id)
         ORDER BY ids.id",
    )
    .fetch_all(pool)
    .await
}
