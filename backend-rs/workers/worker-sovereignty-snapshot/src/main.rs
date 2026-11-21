//! Sovereignty daily snapshot job. Run from `backend/` so it reads the same
//! `.env` as the Node script:
//!
//! ```text
//! yarn worker:sov:snapshot:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use tracing::{error, info, warn};
use worker_sovereignty_snapshot::{snapshot, snapshot_date, SnapshotOutcome};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("❌ sovereignty snapshot failed: {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let started = Instant::now();
    let date = snapshot_date(Utc::now());
    info!("📸 starting sovereignty daily snapshot for {date}...");

    let pool = db::worker_pool(&database_url)?;
    let outcome = snapshot(&pool, date).await;
    pool.close().await;

    match outcome? {
        SnapshotOutcome::EmptyMap => {
            warn!("⚠️  sovereignty_map_current is empty — skipping this run");
        }
        SnapshotOutcome::Written {
            map_rows,
            stat_rows,
        } => {
            info!(
                "✅ snapshot complete: {map_rows} map rows snapshotted, \
                 {stat_rows} alliance stat rows written ({:.2}s)",
                started.elapsed().as_secs_f64()
            );
        }
    }
    Ok(())
}
