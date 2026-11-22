//! Sovereignty killmail correlation job. Run from `backend/` so it reads the
//! same `.env` as the Node script:
//!
//! ```text
//! yarn worker:sov:correlate:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use tracing::{error, info};
use worker_sovereignty_correlate::correlate;

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("❌ sovereignty correlation failed: {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let started = Instant::now();
    info!("⚔️  starting sovereignty killmail correlation...");

    let pool = db::worker_pool(&database_url)?;
    let outcome = correlate(&pool, Utc::now().naive_utc()).await;
    pool.close().await;
    let outcome = outcome?;

    info!("📡 correlating against {} campaigns", outcome.campaigns);
    info!(
        "✅ correlation complete: {} new killmails tagged, {}/{} campaigns have war kills ({:.2}s)",
        outcome.tagged,
        outcome.with_kills,
        outcome.campaigns,
        started.elapsed().as_secs_f64()
    );
    Ok(())
}
