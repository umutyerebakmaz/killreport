//! Sovereignty campaigns job: `sovereignty_campaigns` and
//! `campaign_participants` from `/sovereignty/campaigns`, with
//! `SOVEREIGNTY_ALERT`s for started and ended campaigns. The Rust
//! counterpart of `backend/src/workers/worker-sovereignty-campaigns.ts`: same
//! request, same rows, same logs. See the spec,
//! `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn worker:sov:campaigns:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use esi::{EsiClient, RateLimiter};
use sov::AlertPublisher;
use tracing::{error, info, warn};
use worker_sovereignty_campaigns::sync;

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("❌ sovereignty campaigns sync failed: {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let esi = EsiClient::new(limiter);
    let publisher = AlertPublisher::from_env();
    let started = Instant::now();

    info!("🏰 starting sovereignty campaigns sync...");
    let pool = db::worker_pool(&database_url)?;
    let result = sync(&esi, &pool, Utc::now().naive_utc()).await;
    let outcome = match result {
        Ok(o) => o,
        Err(e) => {
            pool.close().await;
            return Err(e);
        }
    };

    info!("📡 received {} active campaigns from ESI", outcome.active);
    if outcome.skipped_end_marking {
        warn!("⚠️  ESI returned 0 active campaigns — skipping end-marking this run");
    }
    publisher
        .publish_all(&pool, &outcome.alerts, Utc::now())
        .await;
    pool.close().await;

    info!(
        "✅ campaigns sync complete: {} active, {} participants, {} marked ended ({:.2}s)",
        outcome.active,
        outcome.participants,
        outcome.ended,
        started.elapsed().as_secs_f64()
    );
    Ok(())
}
