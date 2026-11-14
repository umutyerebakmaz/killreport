//! The connection life of an info worker: setup, the reconnect loop, one
//! connection's consume, the drained-queue summary and the shutdown. Moved
//! out of the alliance `main.rs` unchanged; the worker-specific parts are
//! the [`Worker`] constants.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::Context as _;
use futures_util::StreamExt;
use lapin::options::{BasicCancelOptions, BasicConsumeOptions, BasicQosOptions};
use lapin::types::FieldTable;
use sqlx::PgPool;
use tracing::{error, info, warn};

use esi::{EsiClient, RateLimiter};
use mq::{connect, declare_worker_queue, LapinDelivery};

use crate::shutdown::shutdown_signal;
use crate::{process_one, Totals, Worker};

const RECONNECT_DELAY: Duration = Duration::from_secs(5);
/// How often the drained-queue check runs.
const QUIET: Duration = Duration::from_secs(5);

/// What `run` hands the worker's constructor: its own pool and ESI client.
pub struct Resources {
    pub pool: PgPool,
    pub esi: EsiClient,
}

/// Run one info worker until a shutdown signal: load `.env`, set up logging,
/// build the resources, then connect, consume and reconnect.
pub async fn run<W: Worker>(build: impl FnOnce(Resources) -> W) -> anyhow::Result<()> {
    // The .env in the working directory: backend/.env when run as intended.
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_target(false)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;

    let pool = db::worker_pool(&database_url)?;
    let worker = Arc::new(build(Resources {
        pool: pool.clone(),
        esi: EsiClient::new(limiter),
    }));
    let shutting_down = Arc::new(AtomicBool::new(false));

    info!("{}", W::STARTED);
    info!("📦 queue: {}", W::QUEUE_NAME);
    info!("⚡ prefetch: {} concurrent\n", W::PREFETCH_COUNT);

    while !shutting_down.load(Ordering::SeqCst) {
        match run_connection(&worker, &shutting_down, &rabbitmq_url).await {
            Ok(()) if shutting_down.load(Ordering::SeqCst) => break,
            Ok(()) => error!("💥 worker error: the consumer stopped"),
            Err(e) => {
                if shutting_down.load(Ordering::SeqCst) {
                    info!("worker stopped during shutdown");
                    break;
                }
                error!("💥 worker error: {e:#}");
            }
        }
        info!("🔄 reconnecting in 5 seconds...");
        tokio::select! {
            _ = tokio::time::sleep(RECONNECT_DELAY) => {}
            _ = shutdown_signal() => {
                shutting_down.store(true, Ordering::SeqCst);
            }
        }
    }

    info!("worker stopped");
    pool.close().await;
    Ok(())
}

/// One connection's life: declare, consume until the channel closes or a
/// shutdown signal cancels the consumer, then let the in-flight messages
/// finish.
async fn run_connection<W: Worker>(
    worker: &Arc<W>,
    shutting_down: &Arc<AtomicBool>,
    url: &str,
) -> anyhow::Result<()> {
    let (connection, channel) = connect(url).await?;
    declare_worker_queue(&channel, W::QUEUE_NAME).await?;
    channel
        .basic_qos(W::PREFETCH_COUNT, BasicQosOptions::default())
        .await?;

    info!("✅ connected to RabbitMQ");
    info!("⏳ waiting for {}...\n", W::WAITING_FOR);

    let consumer = channel
        .basic_consume(
            W::QUEUE_NAME,
            W::CONSUMER_TAG,
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    let totals = Arc::new(Totals::new());
    let summary = tokio::spawn(report_when_drained(Arc::clone(&totals)));

    // On Ctrl+C or SIGTERM, stop taking new messages; the stream then ends
    // once the broker confirms, and the ones in hand still finish.
    let cancel = {
        let shutting_down = Arc::clone(shutting_down);
        let channel = channel.clone();
        tokio::spawn(async move {
            shutdown_signal().await;
            warn!("\n\n⚠️  shutting down...");
            shutting_down.store(true, Ordering::SeqCst);
            let _ = channel
                .basic_cancel(W::CONSUMER_TAG, BasicCancelOptions::default())
                .await;
        })
    };

    consumer
        .for_each_concurrent(usize::from(W::PREFETCH_COUNT), |delivery| {
            let worker = Arc::clone(worker);
            let totals = Arc::clone(&totals);
            let channel = channel.clone();
            async move {
                match delivery {
                    Ok(delivery) => {
                        let settle = LapinDelivery {
                            channel: &channel,
                            delivery: &delivery,
                        };
                        process_one(&*worker, &settle, &totals).await;
                    }
                    Err(e) => error!("❌ channel error: {e}"),
                }
            }
        })
        .await;

    summary.abort();
    cancel.abort();
    let _ = channel.close(200, "worker stopping").await;
    let _ = connection.close(200, "worker stopping").await;
    Ok(())
}

/// Every 5 s, once 5 s have passed since the last message and at least one
/// was processed, print the summary (`worker-info-alliances.ts:48-58`).
async fn report_when_drained(totals: Arc<Totals>) {
    let mut tick = tokio::time::interval(QUIET);
    tick.tick().await;
    loop {
        tick.tick().await;
        if totals.summary_due() {
            let line = "━".repeat(60);
            info!("\n{line}");
            info!("✅ queue completed!");
            info!(
                "📊 final: {} processed ({} created, {} updated, {} errors)",
                totals.processed(),
                totals.created(),
                totals.updated(),
                totals.errors()
            );
            info!("{line}\n");
            info!("⏳ waiting for new messages...\n");
        }
    }
}
