//! Killmail detail worker: fetches a killmail from ESI's public
//! `/killmails/{id}/{hash}/` and writes it through `crates/killmail-writer`.
//! The Rust counterpart of `backend/src/workers/worker-killmail-detail.ts`:
//! same queue, same messages, same rows. See the spec,
//! `docs/superpowers/specs/2026-11-28-rust-killmail-detail-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:killmail-detail:rs`.

use pubsub::RedisPubSub;
use worker_killmail_detail::DetailWorker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // `runner::run` loads `.env` too, but the publisher reads
    // USE_REDIS_PUBSUB before it is called.
    let _ = dotenvy::dotenv();
    let pubsub = RedisPubSub::from_env("new killmails");
    runner::run(|r| DetailWorker {
        pool: r.pool,
        esi: r.esi,
        pubsub,
    })
    .await
}
