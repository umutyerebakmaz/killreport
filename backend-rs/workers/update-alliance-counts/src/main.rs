//! Alliance count job: recomputes every alliance's member and corporation
//! counts. Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn update:alliance-counts:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use tracing::{error, info};
use update_alliance_counts::update_alliance_counts;

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("💥 script error: {e:#}");
        std::process::exit(1);
    }
    info!("👋 script finished");
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    info!("🔄 updating alliance counts...");
    let started = Instant::now();

    let pool = db::worker_pool(&database_url)?;
    let updated = update_alliance_counts(&pool).await;
    pool.close().await;
    let updated = updated?;

    info!("✅ update completed!");
    info!("   • total updated: {updated}");
    info!(
        "   • duration: {:.2} seconds",
        started.elapsed().as_secs_f64()
    );
    Ok(())
}
