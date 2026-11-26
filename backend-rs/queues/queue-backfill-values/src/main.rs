//! Backfill queue publisher: queues killmails for `worker-backfill-values`
//! to recalculate their value. The Rust counterpart of
//! `backend/src/queues/queue-backfill-values.ts`: same flags, same queue,
//! same messages. Unlike the old Node script it pages by `killmail_id`
//! instead of an offset, picks capsules by group, and waits for publisher
//! confirms; the Node script was fixed the same way. See the spec,
//! `docs/superpowers/specs/2026-11-26-rust-backfill-values-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn queue:backfill-values:rs [--limit=10000] [--capsules-only] [--id=133900250]
//! ```

use anyhow::Context as _;
use lapin::options::ConfirmSelectOptions;
use mq::{connect, declare_worker_queue, publish_killmails};
use queue_backfill_values::{
    next_take, page, parse_args, target, Args, PAGE_SIZE, QUEUE_NAME, SOURCE,
};
use tracing::{error, info};

#[tokio::main]
async fn main() {
    runner::init();
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args = match parse_args(&args) {
        Ok(args) => args,
        Err(e) => {
            error!("{e}");
            std::process::exit(1);
        }
    };
    if let Err(e) = queue_backfill_values(&args).await {
        error!("failed to queue backfill values: {e:#}");
        std::process::exit(1);
    }
}

async fn queue_backfill_values(args: &Args) -> anyhow::Result<()> {
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;

    let target_desc = if args.id.is_some() {
        "killmail"
    } else if args.capsules_only {
        "capsule killmails"
    } else {
        "killmails"
    };
    match (args.id, args.capsules_only) {
        (Some(id), _) => {
            info!("🎯 backfill single killmail value - queue script, killmail ID: {id}")
        }
        (None, true) => {
            info!("🚀 backfill capsule killmail values - queue script (victim ship group 29)")
        }
        (None, false) => info!("🔄 backfill killmail values - queue script"),
    }

    let pool = db::worker_pool(&database_url)?;
    let result = queue_pages(&pool, args, &rabbitmq_url, target_desc).await;
    pool.close().await;
    result
}

async fn queue_pages(
    pool: &sqlx::PgPool,
    args: &Args,
    rabbitmq_url: &str,
    target_desc: &str,
) -> anyhow::Result<()> {
    let target = target(pool, args).await?;
    let Some(max_id) = target.max_id else {
        match args.id {
            Some(id) => info!("❌ killmail {id} not found!"),
            None => info!("✅ no {target_desc} found matching the criteria, nothing to backfill."),
        }
        return Ok(());
    };

    let to_process = args.limit.map_or(target.count, |l| l.min(target.count));
    info!("📊 found {} {target_desc} matching criteria", target.count);
    if args.limit.is_some() {
        info!("🎯 processing limit: {to_process} killmails");
    }
    info!("📦 queue: {QUEUE_NAME}");
    info!("⚙️  batch size: {PAGE_SIZE}");

    let (connection, channel) = connect(rabbitmq_url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    channel
        .confirm_select(ConfirmSelectOptions::default())
        .await?;

    let mut queued: i64 = 0;
    let mut batch = 0;
    let mut below = max_id.saturating_add(1);
    // The count is for the progress line; see `next_take` for when to stop.
    while let Some(take) = next_take(args.limit, queued) {
        let ids = page(pool, args, below, take).await?;
        let Some(&last) = ids.last() else { break };
        let confirmed = publish_killmails(&channel, QUEUE_NAME, SOURCE, &ids).await?;
        queued += i64::try_from(confirmed)?;
        below = last;
        batch += 1;
        let progress = (queued as f64 / to_process as f64 * 100.0).min(100.0);
        info!("  📤 queued batch {batch} ({queued}/{to_process} - {progress:.1}%)");
    }

    info!("✅ successfully queued {queued} {target_desc}");
    info!("now run the worker: yarn worker:backfill-values:rs");

    channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    Ok(())
}
