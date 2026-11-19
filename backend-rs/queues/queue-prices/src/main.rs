//! Price queue publisher: queues every type a killmail values, the victim's
//! ship and every item, for `worker-prices`. The Rust counterpart of
//! `backend/src/queues/queue-prices.ts`: same query, same queue, same
//! messages. Unlike the old Node script it publishes with confirms and skips
//! types `types` does not have; see the spec,
//! `docs/superpowers/specs/2026-11-19-rust-prices-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn queue:prices:rs
//! ```

use anyhow::Context as _;
use mq::{connect, declare_worker_queue, publish_entities};
use queue_prices::{priced_type_ids, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_prices().await {
        error!("failed to queue prices: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_prices() -> anyhow::Result<()> {
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;

    info!("fetching unique type IDs from killmail_items and victims...");
    let pool = db::worker_pool(&database_url)?;
    let ids = priced_type_ids(&pool).await;
    pool.close().await;
    let ids = ids?;
    info!("found {} types to price", ids.len());

    if ids.is_empty() {
        info!("✅ no types to price!");
        return Ok(());
    }

    info!("adding to queue: {QUEUE_NAME}");

    let (connection, channel) = connect(&rabbitmq_url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    let queued = publish_entities(
        &channel,
        QUEUE_NAME,
        SOURCE,
        &ids,
        None,
        |batch, total, len| {
            debug!("queued batch {batch}/{total} ({len} types)");
        },
    )
    .await?;

    info!("✅ all {queued} types queued successfully!");
    info!("now run the worker: yarn worker:prices:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
