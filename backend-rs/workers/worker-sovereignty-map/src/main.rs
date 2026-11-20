//! Sovereignty map job: `sovereignty_map_current` and `territory_changes`
//! from `/sovereignty/map`, with a `SOVEREIGNTY_ALERT` for each of the first
//! changes. The Rust counterpart of
//! `backend/src/workers/worker-sovereignty-map.ts`: same request, same rows,
//! same logs. See the spec,
//! `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn worker:sov:map:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use esi::{EsiClient, RateLimiter};
use sov::AlertPublisher;
use tracing::{error, info, warn};
use worker_sovereignty_map::{sync, MapOutcome};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("❌ sovereignty map sync failed: {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let esi = EsiClient::new(limiter);
    let publisher = AlertPublisher::from_env();
    let started = Instant::now();

    info!("🗺️  starting sovereignty map sync...");
    let pool = db::worker_pool(&database_url)?;
    let (received, outcome) = match sync(&esi, &pool, Utc::now().naive_utc()).await {
        Ok(r) => r,
        Err(e) => {
            pool.close().await;
            return Err(e);
        }
    };
    info!("📡 received {received} systems from ESI");

    match outcome {
        MapOutcome::NoOwnedSystems => {
            warn!("⚠️  ESI returned no owned systems — skipping this run");
        }
        MapOutcome::Synced {
            owned,
            updated,
            lost,
            changes,
            initial,
            alerts,
        } => {
            publisher.publish_all(&pool, &alerts, Utc::now()).await;
            info!(
                "✅ map sync complete: {owned} owned systems, {updated} updated, {lost} lost, \
                 {changes} territory changes logged{} ({:.2}s)",
                if initial {
                    " (initial baseline — changes not logged)"
                } else {
                    ""
                },
                started.elapsed().as_secs_f64()
            );
        }
    }
    pool.close().await;
    Ok(())
}
