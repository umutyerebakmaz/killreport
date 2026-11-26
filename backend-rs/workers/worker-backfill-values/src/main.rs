//! Killmail value backfill worker: recalculates a killmail's total,
//! destroyed and dropped value and saves them. The Rust counterpart of
//! `backend/src/workers/worker-backfill-values.ts`: same queue, same
//! messages, same columns, same formula (`crates/killmail-value`).
//!
//! Unlike the old Node worker, `killmails` and `killmail_filters` are
//! written in one transaction; the Node worker was fixed the same way. See
//! the spec, `docs/superpowers/specs/2026-11-26-rust-backfill-values-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:backfill-values:rs`.

use worker_backfill_values::BackfillWorker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| BackfillWorker { pool: r.pool }).await
}
