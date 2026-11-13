//! Alliance info worker: fetches alliance information from ESI and saves it
//! to the database. The Rust counterpart of
//! `backend/src/workers/worker-info-alliances.ts`, same queue, same messages,
//! same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:alliances:rs`.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::Context as _;
use futures_util::StreamExt;
use lapin::message::Delivery;
use lapin::options::{BasicCancelOptions, BasicConsumeOptions, BasicQosOptions};
use lapin::types::FieldTable;
use lapin::Channel;
use sqlx::PgPool;
use tokio::time::Instant;
use tracing::{error, info, warn};

use esi::{EsiClient, RateLimiter};
use mq::{connect, declare_worker_queue, handle_worker_error, LapinDelivery, Settle, WorkerLog};
use worker_info_alliances::alliance::{upsert_alliance, AllianceInfo};
use worker_info_alliances::message::EntityQueueMessage;

const QUEUE_NAME: &str = "esi_alliance_info_queue";
/// Process 3 alliances concurrently (`worker-info-alliances.ts:12`).
const PREFETCH_COUNT: u16 = 3;
const CONSUMER_TAG: &str = "worker-info-alliances-rs";
const RECONNECT_DELAY: Duration = Duration::from_secs(5);
/// Quiet time after which the queue counts as drained.
const QUIET: Duration = Duration::from_secs(5);

/// Counters for one connection, reset on reconnect as in the Node worker.
struct Totals {
    processed: AtomicU64,
    created: AtomicU64,
    updated: AtomicU64,
    errors: AtomicU64,
    last_message: Mutex<Instant>,
}

impl Totals {
    fn new() -> Self {
        Self {
            processed: AtomicU64::new(0),
            created: AtomicU64::new(0),
            updated: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            last_message: Mutex::new(Instant::now()),
        }
    }
}

/// The failure path's log, with which alliance it was
/// (`worker-info-alliances.ts:146-149`).
struct AllianceLog(String);

impl WorkerLog for AllianceLog {
    fn warn(&self, message: &str) {
        warn!("  {message} ({})", self.0);
    }
    fn error(&self, message: &str, error: &anyhow::Error) {
        error!("  {message} ({}): {error:#}", self.0);
    }
}

struct Worker {
    pool: PgPool,
    esi: EsiClient,
    shutting_down: AtomicBool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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

    let worker = Arc::new(Worker {
        pool: db::worker_pool(&database_url)?,
        esi: EsiClient::new(limiter),
        shutting_down: AtomicBool::new(false),
    });

    info!("🤝 alliance info worker started");
    info!("📦 queue: {QUEUE_NAME}");
    info!("⚡ prefetch: {PREFETCH_COUNT} concurrent\n");

    while !worker.shutting_down.load(Ordering::SeqCst) {
        match run_connection(&worker, &rabbitmq_url).await {
            Ok(()) if worker.shutting_down.load(Ordering::SeqCst) => break,
            Ok(()) => error!("💥 worker error: the consumer stopped"),
            Err(e) => {
                if worker.shutting_down.load(Ordering::SeqCst) {
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
                worker.shutting_down.store(true, Ordering::SeqCst);
            }
        }
    }

    info!("worker stopped");
    worker.pool.close().await;
    Ok(())
}

/// One connection's life: declare, consume until the channel closes or a
/// shutdown signal cancels the consumer, then let the in-flight messages
/// finish.
async fn run_connection(worker: &Arc<Worker>, url: &str) -> anyhow::Result<()> {
    let (connection, channel) = connect(url).await?;
    declare_worker_queue(&channel, QUEUE_NAME).await?;
    channel
        .basic_qos(PREFETCH_COUNT, BasicQosOptions::default())
        .await?;

    info!("✅ connected to RabbitMQ");
    info!("⏳ waiting for alliances...\n");

    let consumer = channel
        .basic_consume(
            QUEUE_NAME,
            CONSUMER_TAG,
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    let totals = Arc::new(Totals::new());
    let summary = tokio::spawn(report_when_drained(Arc::clone(&totals)));

    // On Ctrl+C or SIGTERM, stop taking new messages; the stream then ends
    // once the broker confirms, and the ones in hand still finish.
    let cancel = {
        let worker = Arc::clone(worker);
        let channel = channel.clone();
        tokio::spawn(async move {
            shutdown_signal().await;
            warn!("\n\n⚠️  shutting down...");
            worker.shutting_down.store(true, Ordering::SeqCst);
            let _ = channel
                .basic_cancel(CONSUMER_TAG, BasicCancelOptions::default())
                .await;
        })
    };

    consumer
        .for_each_concurrent(usize::from(PREFETCH_COUNT), |delivery| {
            let worker = Arc::clone(worker);
            let totals = Arc::clone(&totals);
            let channel = channel.clone();
            async move {
                match delivery {
                    Ok(delivery) => worker.process(&channel, &delivery, &totals).await,
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

impl Worker {
    async fn process(&self, channel: &Channel, delivery: &Delivery, totals: &Totals) {
        *totals.last_message.lock().unwrap() = Instant::now();
        let settle = LapinDelivery { channel, delivery };

        let parsed = EntityQueueMessage::parse(&delivery.data);
        let context = match &parsed {
            Ok(message) => format!("alliance {}", message.entity_id),
            Err(_) => "unparseable message".to_owned(),
        };

        let outcome: anyhow::Result<(AllianceInfo, i32, bool)> = async {
            let id = parsed?.entity_id;
            // Always take the latest info from ESI.
            let info: AllianceInfo = self.esi.get(&format!("/alliances/{id}")).await?;
            let inserted = upsert_alliance(&self.pool, id, &info).await?;
            Ok((info, id, inserted))
        }
        .await;

        match outcome {
            Ok((info, id, inserted)) => {
                let n = totals.processed.load(Ordering::SeqCst) + 1;
                if inserted {
                    totals.created.fetch_add(1, Ordering::SeqCst);
                } else {
                    totals.updated.fetch_add(1, Ordering::SeqCst);
                }
                info!(
                    "  ✅ [{n}] {} [{}] ID:{id} ({})",
                    info.name,
                    info.ticker,
                    if inserted { "created" } else { "updated" }
                );
                if let Err(e) = settle.ack().await {
                    error!("❌ ack failed ({context}): {e}");
                }
                totals.processed.fetch_add(1, Ordering::SeqCst);
            }
            Err(e) => {
                totals.errors.fetch_add(1, Ordering::SeqCst);
                totals.processed.fetch_add(1, Ordering::SeqCst);
                // 404, throttles and the attempt count all live in the shared
                // path; this worker only says which message it was.
                if let Err(settle_error) =
                    handle_worker_error(&settle, QUEUE_NAME, &e, &AllianceLog(context.clone()))
                        .await
                {
                    error!("❌ could not settle the message ({context}): {settle_error}");
                }
            }
        }
    }
}

/// Every 5 s, once 5 s have passed since the last message and at least one
/// was processed, print the summary (`worker-info-alliances.ts:48-58`).
async fn report_when_drained(totals: Arc<Totals>) {
    let mut tick = tokio::time::interval(QUIET);
    tick.tick().await;
    loop {
        tick.tick().await;
        let quiet = totals.last_message.lock().unwrap().elapsed() > QUIET;
        let processed = totals.processed.load(Ordering::SeqCst);
        if quiet && processed > 0 {
            let line = "━".repeat(60);
            info!("\n{line}");
            info!("✅ queue completed!");
            info!(
                "📊 final: {processed} processed ({} created, {} updated, {} errors)",
                totals.created.load(Ordering::SeqCst),
                totals.updated.load(Ordering::SeqCst),
                totals.errors.load(Ordering::SeqCst)
            );
            info!("{line}\n");
            info!("⏳ waiting for new messages...\n");
        }
    }
}

/// Ctrl+C everywhere; SIGTERM as well on Unix, where PM2 and systemd send it.
/// PM2 stops with SIGINT by default, which `ctrl_c` covers.
async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = terminate.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
