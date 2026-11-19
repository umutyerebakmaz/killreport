//! The price worker's parts, split from the binary so the tests can reach
//! them: the ESI shape, the Jita price, the upsert, and `handle`.

pub mod market;

use esi::EsiClient;
use market::{jita_price, orders_path, upsert_price, Order};
use runner::{Context, Outcome, Processed, Worker};
use sqlx::PgPool;

pub struct PriceWorker {
    pub pool: PgPool,
    pub esi: EsiClient,
}

impl Worker for PriceWorker {
    const QUEUE_NAME: &'static str = "esi_type_price_queue";
    const CONSUMER_TAG: &'static str = "worker-prices-rs";
    const STARTED: &'static str = "🏪 Jita price worker started";
    const WAITING_FOR: &'static str = "type IDs";
    const ENTITY: &'static str = "type";

    /// Every page of the type's orders in The Forge, priced at Jita 4-4. No
    /// Jita orders leaves the row alone; an ESI or database error goes down
    /// the shared failure path instead of being logged and acked.
    async fn handle(&self, id: i32, _ctx: &Context<'_>) -> anyhow::Result<Processed> {
        let orders: Vec<Order> = self.esi.get_paged(&orders_path(id)).await?;
        let Some(price) = jita_price(&orders) else {
            return Ok(Processed {
                outcome: Outcome::Unchanged,
                detail: format!(" {id} (no Jita orders)"),
            });
        };
        let inserted = upsert_price(&self.pool, id, &price).await?;
        Ok(Processed {
            outcome: if inserted {
                Outcome::Created
            } else {
                Outcome::Updated
            },
            detail: format!(" {id} buy={:.2} sell={:.2}", price.buy, price.sell),
        })
    }
}
