//! Jita price worker: fetches a type's market orders from ESI and saves its
//! Jita 4-4 price. The Rust counterpart of
//! `backend/src/workers/worker-prices.ts`: same queue, same messages, same
//! columns.
//!
//! Differences from the old Node worker, fixed on both sides: every page of
//! orders is read, only Jita 4-4 orders count, a side's price is the
//! volume-weighted mean of its best 5 %, a type with no Jita orders keeps its
//! row, and ESI and database errors are no longer swallowed. See the spec,
//! `docs/superpowers/specs/2026-11-19-rust-prices-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:prices:rs`.

use worker_prices::PriceWorker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| PriceWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
