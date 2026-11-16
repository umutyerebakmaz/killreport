//! Alliance queue publisher: fetches every alliance ID from ESI and queues
//! it for `worker-info-alliances`. The Rust counterpart of
//! `backend/src/queues/queue-alliances.ts`, same queue, same messages, same
//! log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//! `yarn queue:alliances:rs`.

use anyhow::Context as _;
use esi::{EsiClient, RateLimiter};
use mq::{connect, declare_worker_queue, publish_entities};
use queue_alliances::{fetch_alliance_ids, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_alliances().await {
        error!("failed to queue alliances: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_alliances() -> anyhow::Result<()> {
    info!("fetching all alliance IDs from ESI...");

    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let ids = fetch_alliance_ids(&EsiClient::new(limiter)).await?;

    info!("found {} alliances", ids.len());
    info!("adding to queue: {QUEUE_NAME}");

    let (connection, channel) = connect(&rabbitmq_url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    publish_entities(
        &channel,
        QUEUE_NAME,
        SOURCE,
        &ids,
        None,
        |batch, total, len| {
            debug!("queued batch {batch}/{total} ({len} alliances)");
        },
    )
    .await?;

    info!("all {} alliances queued successfully!", ids.len());
    info!("now run the worker: yarn worker:info:alliances:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
