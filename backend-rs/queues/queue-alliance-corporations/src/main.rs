//! Alliance-corporations queue publisher: fetches every alliance ID from ESI
//! and queues it for `worker-alliance-corporations`. The Rust counterpart of
//! `backend/src/queues/queue-alliance-corporations.ts`, same queue, same
//! messages, same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//! `yarn queue:alliance-corporations:rs`.

use anyhow::Context as _;
use esi::{EsiClient, RateLimiter};
use mq::{connect, declare_worker_queue, publish_entities};
use queue_alliance_corporations::{fetch_alliance_ids, PRIORITY, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_alliance_corporations().await {
        error!("failed to queue alliance corporations: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_alliance_corporations() -> anyhow::Result<()> {
    info!("fetching all alliance IDs from ESI...");

    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let ids = fetch_alliance_ids(&EsiClient::new(limiter)).await?;

    info!("found {} alliances", ids.len());
    info!("adding alliances to queue...");

    let (connection, channel) = connect(&rabbitmq_url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    publish_entities(
        &channel,
        QUEUE_NAME,
        SOURCE,
        &ids,
        Some(PRIORITY),
        |batch, total, len| {
            debug!("batch {batch}/{total}: {len} alliances queued");
        },
    )
    .await?;

    info!("successfully queued {} alliances!", ids.len());
    info!("next steps:");
    info!("  1. start worker: yarn worker:alliance-corporations:rs");
    info!("  2. start enrichment: yarn worker:info:corporations:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
