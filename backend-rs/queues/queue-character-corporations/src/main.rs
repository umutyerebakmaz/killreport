//! Character corporation queue publisher: queues every corporation a
//! character points at, now or in its employment history, that is not in the
//! database yet, for `worker-info-corporations`. The Rust counterpart of
//! `backend/src/queues/queue-character-corporations.ts`, same query, same
//! queue, same messages, same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn queue:character-corporations:rs
//! ```

use anyhow::Context as _;
use mq::{connect, declare_worker_queue, publish_entities};
use queue_character_corporations::{missing_corporation_ids, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_character_corporations().await {
        error!("failed to queue character corporations: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_character_corporations() -> anyhow::Result<()> {
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;

    info!("scanning characters and their corporation history for missing corporations...");
    let pool = db::worker_pool(&database_url)?;
    let ids = missing_corporation_ids(&pool).await;
    pool.close().await;
    let ids = ids?;
    info!("found {} missing corporations", ids.len());

    if ids.is_empty() {
        // Node exits here too, before it ever connects to RabbitMQ.
        info!("✅ no missing corporations to queue!");
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
            debug!("queued batch {batch}/{total} ({len} corporations)");
        },
    )
    .await?;

    info!("✅ all {queued} missing corporations queued successfully!");
    info!("now run the worker: yarn worker:info:corporations:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
