//! Type queue publisher: fetches every type ID from ESI and queues the ones
//! missing from the database for `worker-info-types`. The Rust counterpart of
//! `backend/src/queues/queue-types.ts`: same queue, same messages. Unlike
//! Node it reads every page of the list and publishes only what is missing;
//! see the spec, `docs/superpowers/specs/2026-11-16-rust-type-info-worker-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//! `yarn queue:types:rs`.

use anyhow::Context as _;
use esi::{EsiClient, RateLimiter};
use mq::{connect, declare_worker_queue, publish_entities};
use queue_types::{existing_type_ids, fetch_type_ids, missing, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_types().await {
        error!("failed to queue types: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_types() -> anyhow::Result<()> {
    info!("fetching all type IDs from ESI...");

    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let esi_ids = fetch_type_ids(&EsiClient::new(limiter)).await?;
    info!("found {} types", esi_ids.len());

    let pool = db::worker_pool(&database_url)?;
    let existing = existing_type_ids(&pool).await;
    pool.close().await;
    let existing = existing?;

    let ids = missing(&esi_ids, &existing);
    info!(
        "{} already in database, {} to queue",
        esi_ids.len() - ids.len(),
        ids.len()
    );
    if ids.is_empty() {
        info!("nothing to queue");
        return Ok(());
    }

    info!("adding to queue: {QUEUE_NAME}");

    let (connection, channel) = connect(&rabbitmq_url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    let queued = publish_entities(&channel, QUEUE_NAME, SOURCE, &ids, |batch, total, _| {
        debug!("queued batch {batch}/{total}");
    })
    .await?;

    info!("all {queued} types queued successfully!");
    info!("run worker with: yarn worker:info:types:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
