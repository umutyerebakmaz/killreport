//! Sovereignty structures job: one `sovereignty_structures` row per IHub or
//! TCU, from `/sovereignty/structures`. The Rust counterpart of
//! `backend/src/workers/worker-sovereignty-structures.ts`: same request, same
//! rows, same logs. See the spec,
//! `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn worker:sov:structures:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use esi::{EsiClient, RateLimiter};
use tracing::{error, info, warn};
use worker_sovereignty_structures::{sync, StructuresOutcome};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("❌ sovereignty structures sync failed: {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let esi = EsiClient::new(limiter);
    let started = Instant::now();

    info!("🛰️  starting sovereignty structures sync...");
    let pool = db::worker_pool(&database_url)?;
    let result = sync(&esi, &pool, Utc::now().naive_utc()).await;
    pool.close().await;
    let (received, outcome) = result?;

    info!("📡 received {received} structures from ESI");
    match outcome {
        StructuresOutcome::EmptyFeed => {
            warn!("⚠️  ESI returned 0 sovereignty structures — skipping this run");
        }
        StructuresOutcome::Synced {
            upserted,
            destroyed,
        } => info!(
            "✅ structures sync complete: {upserted} upserted, {destroyed} marked destroyed ({:.2}s)",
            started.elapsed().as_secs_f64()
        ),
    }
    Ok(())
}
