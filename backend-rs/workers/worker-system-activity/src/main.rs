//! System activity snapshot job: one `system_activity` row per system for
//! the current UTC hour, from `/universe/system_kills` and
//! `/universe/system_jumps`. The Rust counterpart of
//! `backend/src/workers/worker-system-activity.ts`: same requests, same rows,
//! same logs. See the spec,
//! `docs/superpowers/specs/2026-11-19-rust-system-activity-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn worker:system-activity:rs
//! ```

use std::time::Instant;

use anyhow::Context as _;
use chrono::Utc;
use esi::{EsiClient, RateLimiter};
use tracing::{error, info, warn};
use worker_system_activity::{hour_snapshot_time, take_snapshot};

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("💥 snapshot worker error: {e:#}");
        std::process::exit(1);
    }
    info!("👋 snapshot worker finished");
}

async fn run() -> anyhow::Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let limiter = RateLimiter::from_env().map_err(anyhow::Error::msg)?;
    let esi = EsiClient::new(limiter);
    let started = Instant::now();
    let now = Utc::now();

    info!("📸 starting system activity snapshot collection...");
    info!(
        "   • snapshot time: {}",
        hour_snapshot_time(now).and_utc().to_rfc3339()
    );
    info!("📡 fetching system kills and jumps from ESI...");

    let pool = db::worker_pool(&database_url)?;
    let snapshot = take_snapshot(&esi, &pool, now).await;
    pool.close().await;

    let Some(s) = snapshot? else {
        warn!("⚠️  no activity data returned from ESI");
        return Ok(());
    };

    info!(
        "✓ received kills for {} systems, jumps for {}",
        s.kill_systems, s.jump_systems
    );
    info!("📊 activity statistics:");
    info!("   • total ship kills: {}", s.ship_kills);
    info!("   • total pod kills: {}", s.pod_kills);
    info!("   • total NPC kills: {}", s.npc_kills);
    info!("   • total ship jumps: {}", s.ship_jumps);
    info!("   • rows to write: {}", s.rows);
    info!("✅ snapshot collection completed successfully!");
    info!("   • snapshots saved: {}", s.inserted);
    info!(
        "   • snapshot timestamp: {}",
        s.timestamp.and_utc().to_rfc3339()
    );
    info!(
        "   • duration: {:.2} seconds",
        started.elapsed().as_secs_f64()
    );
    info!("   • next snapshot: in 1 hour");
    Ok(())
}
