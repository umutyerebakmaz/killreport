//! The killmail character queue publisher's testable parts: where the IDs
//! come from.

use sqlx::PgPool;

/// The queue `worker-info-characters` consumes.
pub const QUEUE_NAME: &str = "esi_character_info_queue";
/// The `source` field of every message, the same as the Node `scan:entities`.
pub const SOURCE: &str = "killmail_scan";

/// Every character a killmail's victim or attackers name that `characters`
/// does not have yet, in ID order. The UNION de-duplicates, the anti-join
/// leaves only the unknown ones; NPCs are not filtered out.
pub async fn missing_character_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT ids.id
         FROM (
           SELECT character_id AS id FROM victims WHERE character_id IS NOT NULL
           UNION
           SELECT character_id FROM attackers WHERE character_id IS NOT NULL
         ) ids
         WHERE NOT EXISTS (SELECT 1 FROM characters c WHERE c.id = ids.id)
         ORDER BY ids.id",
    )
    .fetch_all(pool)
    .await
}
