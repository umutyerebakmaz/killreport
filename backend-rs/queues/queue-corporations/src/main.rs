//! Corporation queue publisher: queues corporation IDs for
//! `worker-info-corporations`. The Rust counterpart of
//! `backend/src/queues/queue-corporations.ts`, same queue, same messages,
//! same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn queue:corporations:rs              # every corporation in the database
//! yarn queue:corporations:rs 123 456 789  # only these
//! ```

use anyhow::Context as _;
use mq::{connect, declare_worker_queue, publish_entities, BATCH_SIZE};
use queue_corporations::{all_corporation_ids, parse_ids, QUEUE_NAME, SOURCE};
use tracing::{debug, error, info};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = queue_corporations().await {
        error!("failed to queue corporations: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_corporations() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;

    let ids = if args.is_empty() {
        info!("fetching all corporation IDs from database...");
        let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
        let pool = db::worker_pool(&database_url)?;
        let ids = all_corporation_ids(&pool).await;
        pool.close().await;
        let ids = ids?;
        info!("found {} corporations in database", ids.len());
        ids
    } else {
        let ids = parse_ids(&args);
        if ids.is_empty() {
            // Logged bare, as Node does, not as a "failed to queue" error.
            error!("invalid corporation IDs provided");
            std::process::exit(1);
        }
        let list: Vec<String> = ids.iter().map(i32::to_string).collect();
        info!(
            "queueing {} specific corporation(s): {}",
            ids.len(),
            list.join(", ")
        );
        ids
    };

    info!("adding to queue: {QUEUE_NAME}");

    let (connection, channel) = connect(&rabbitmq_url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    // Node reports batches only for more than one batch's worth
    // (`queue-corporations.ts:67`).
    let report = ids.len() > BATCH_SIZE;
    let queued = publish_entities(&channel, QUEUE_NAME, SOURCE, &ids, |batch, total, len| {
        if report {
            debug!("queued batch {batch}/{total} ({len} corporations)");
        }
    })
    .await?;

    info!("✅ all {queued} corporation(s) queued successfully!");
    info!("now run the worker: yarn worker:info:corporations:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
