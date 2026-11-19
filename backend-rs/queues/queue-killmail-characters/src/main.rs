//! Killmail character queue publisher: queues every character a killmail's
//! victim or attackers name that is not in the database yet, for
//! `worker-info-characters`. One of the four parts of `scan:entities:rs`,
//! the Rust counterpart of `backend/src/workers/scan-killmail-entities.ts`:
//! same query, same queue, same messages.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn queue:killmail-characters:rs
//! ```

use anyhow::Context as _;
use mq::{connect, declare_worker_queue, publish_entities};
use queue_killmail_characters::{missing_character_ids, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

/// The priority the Node scanner has always sent.
const PRIORITY: u8 = 5;

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_killmail_characters().await {
        error!("failed to queue killmail characters: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_killmail_characters() -> anyhow::Result<()> {
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;

    info!("scanning killmails for missing characters...");
    let pool = db::worker_pool(&database_url)?;
    let ids = missing_character_ids(&pool).await;
    pool.close().await;
    let ids = ids?;
    info!("found {} missing characters", ids.len());

    if ids.is_empty() {
        // Exits successfully without touching RabbitMQ, so the
        // `scan:entities:rs` chain goes on to the next part.
        info!("✅ no missing characters to queue!");
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
        Some(PRIORITY),
        |batch, total, len| {
            debug!("queued batch {batch}/{total} ({len} characters)");
        },
    )
    .await?;

    info!("✅ all {queued} missing characters queued successfully!");
    info!("now run the worker: yarn worker:info:characters:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
