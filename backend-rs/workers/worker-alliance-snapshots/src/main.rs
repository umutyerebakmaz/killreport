//! Alliance snapshot job: records today's (UTC) member and corporation count
//! of every alliance. Run from `backend/` so it reads the same `.env` as the
//! Node script:
//!
//! ```text
//! yarn snapshot:alliances:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use tracing::{error, info};
use worker_alliance_snapshots::{take_alliance_snapshots, utc_day};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("💥 worker error: {e:#}");
        std::process::exit(1);
    }
    info!("👋 worker terminated");
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    info!("📸 alliance snapshot worker started...");
    let started = Instant::now();
    let day = utc_day(Utc::now());

    let pool = db::worker_pool(&database_url)?;
    let totals = take_alliance_snapshots(&pool, day).await;
    pool.close().await;
    let totals = totals?;

    info!("✅ snapshot creation completed!");
    info!("   • total alliances: {}", totals.total);
    info!("   • new snapshots: {}", totals.created);
    info!("   • already existing: {}", totals.existing());
    info!(
        "   • duration: {:.2} seconds",
        started.elapsed().as_secs_f64()
    );
    info!("   • date: {day}");
    Ok(())
}
