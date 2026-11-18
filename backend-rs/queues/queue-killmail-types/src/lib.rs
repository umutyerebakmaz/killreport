//! The killmail type queue publisher's testable parts: where the IDs
//! come from.

use sqlx::PgPool;

/// The queue `worker-info-types` consumes.
pub const QUEUE_NAME: &str = "esi_type_info_queue";
/// The `source` field of every message, the same as the Node `scan:entities`.
pub const SOURCE: &str = "killmail_scan";

/// Every type a killmail names, the victim's ship, the attackers' ships and
/// weapons and every item, that `types` does not have yet, in ID order. The
/// UNION de-duplicates, the anti-join leaves only the unknown ones.
pub async fn missing_type_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT ids.id
         FROM (
           SELECT ship_type_id AS id FROM victims WHERE ship_type_id IS NOT NULL
           UNION
           SELECT ship_type_id FROM attackers WHERE ship_type_id IS NOT NULL
           UNION
           SELECT weapon_type_id FROM attackers WHERE weapon_type_id IS NOT NULL
           UNION
           SELECT item_type_id FROM killmail_items WHERE item_type_id IS NOT NULL
         ) ids
         WHERE NOT EXISTS (SELECT 1 FROM types t WHERE t.id = ids.id)
         ORDER BY ids.id",
    )
    .fetch_all(pool)
    .await
}
