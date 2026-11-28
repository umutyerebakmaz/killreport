//! zKillboard R2Z2 stream worker: reads every new killmail from R2Z2, fills
//! in the names the database lacks, writes it through
//! `crates/killmail-writer` and announces it. The Rust counterpart of
//! `backend/src/workers/worker-redisq-stream.ts`; see the spec,
//! `docs/superpowers/specs/2026-11-28-rust-redisq-design.md`.
//!
//! It consumes no queue, so it is not a `runner::Worker`: it builds its own
//! pool, ESI client and publishers. Run from `backend/` so it reads the same
//! `.env` as the Node worker: `yarn worker:redisq:rs`. Never run it beside
//! the Node worker: both keep the same `stream_cursors` row.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::Context as _;
use chrono::Utc;
use esi::{EsiClient, RateLimiter};
use pubsub::RedisPubSub;
use tokio::sync::Notify;
use tracing::info;
use worker_redisq::process::Processor;
use worker_redisq::r2z2::{R2z2, BASE_URL};
use worker_redisq::rabbit::RabbitOutbox;
use worker_redisq::run::{run_forever, Stream, BACKLOG_DELAY, EMPTY_DELAY};

/// A killmail must not stall behind a long ESI brake, as in Node.
const ESI_MAX_WAIT: Duration = Duration::from_secs(10);
/// How long to wait before trying to start again when R2Z2 or the database
/// cannot be reached at startup.
const START_RETRY: Duration = Duration::from_secs(5);

/// Ctrl+C everywhere; SIGTERM as well on Unix, where systemd sends it.
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let enrichment = std::env::var("REDISQ_ENABLE_ENRICHMENT").map_or(true, |v| v != "false");
    let pool = db::worker_pool(&database_url)?;

    info!("🌊 R2Z2 stream worker started");
    info!("📡 endpoint: {BASE_URL}/{{sequence}}.json");
    info!(
        "⏱️  poll rate: {} ms while draining, {} s on 404",
        BACKLOG_DELAY.as_millis(),
        EMPTY_DELAY.as_secs()
    );
    info!(
        "🔧 enrichment: {}",
        if enrichment { "enabled" } else { "disabled" }
    );

    let stop = Arc::new(AtomicBool::new(false));
    let stopped = Arc::new(Notify::new());
    {
        let (stop, stopped) = (Arc::clone(&stop), Arc::clone(&stopped));
        tokio::spawn(async move {
            shutdown_signal().await;
            info!("🛑 shutdown requested; finishing the current killmail");
            stop.store(true, Ordering::SeqCst);
            stopped.notify_waiters();
        });
    }

    let outbox = RabbitOutbox::new(rabbitmq_url);
    let mut stream = loop {
        let processor = Processor {
            pool: pool.clone(),
            esi: EsiClient::new(limiter.clone()).live(ESI_MAX_WAIT),
            pubsub: RedisPubSub::from_env("new killmails"),
            enrichment,
        };
        match Stream::start(R2z2::new(BASE_URL), processor, Utc::now().naive_utc()).await {
            Ok(stream) => break stream,
            Err(e) => {
                tracing::error!("❌ cannot start: {e:#}; retrying in 5 s");
                tokio::select! {
                    _ = tokio::time::sleep(START_RETRY) => {}
                    _ = stopped.notified() => {}
                }
                if stop.load(Ordering::SeqCst) {
                    pool.close().await;
                    return Ok(());
                }
            }
        }
    };

    run_forever(&mut stream, &outbox, &stop, &stopped).await;
    pool.close().await;
    Ok(())
}
