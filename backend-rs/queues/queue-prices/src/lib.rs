//! The price queue publisher's testable parts: which types get a price.

use sqlx::PgPool;

/// The queue `worker-prices` consumes.
pub const QUEUE_NAME: &str = "esi_type_price_queue";
/// The `source` field of every message, the same as the Node `queue:prices`.
pub const SOURCE: &str = "queue-prices";

/// Every type a killmail values, the victim's ship and every item, that
/// `types` has, in ID order. The UNION de-duplicates. A type `types` does not
/// have yet would fail the `market_prices` foreign key, so it waits until
/// `scan:entities` has added it and is priced on the next run.
pub async fn priced_type_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(
        "SELECT ids.id
         FROM (
           SELECT item_type_id AS id FROM killmail_items
           UNION
           SELECT ship_type_id FROM victims
         ) ids
         WHERE EXISTS (SELECT 1 FROM types t WHERE t.id = ids.id)
         ORDER BY ids.id",
    )
    .fetch_all(pool)
    .await
}
