//! The killmail alliance queue publisher's testable parts: where the IDs
//! come from.

use sqlx::PgPool;

/// The queue `worker-info-alliances` consumes.
pub const QUEUE_NAME: &str = "esi_alliance_info_queue";
/// The `source` field of every message, the same as the Node `scan:entities`.
pub const SOURCE: &str = "killmail_scan";

/// Every alliance a killmail's victim or attackers name that `alliances`
/// does not have yet, in ID order. The UNION de-duplicates, the anti-join
/// leaves only the unknown ones; NPCs are not filtered out.
pub async fn missing_alliance_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT ids.id
         FROM (
           SELECT alliance_id AS id FROM victims WHERE alliance_id IS NOT NULL
           UNION
           SELECT alliance_id FROM attackers WHERE alliance_id IS NOT NULL
         ) ids
         WHERE NOT EXISTS (SELECT 1 FROM alliances a WHERE a.id = ids.id)
         ORDER BY ids.id",
    )
    .fetch_all(pool)
    .await
}
