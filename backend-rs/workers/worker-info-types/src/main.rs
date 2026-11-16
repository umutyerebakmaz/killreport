//! Type info worker: fetches type information from ESI and saves it to the
//! database. The Rust counterpart of `backend/src/workers/worker-info-types.ts`:
//! same queue, same messages, same columns.
//!
//! One difference, by design: Node skips a type that is already in the table,
//! while this worker upserts it with ESI's current values. The skip moved to
//! the queue, which publishes only the missing types, so the update path runs
//! only in a race or for an ID queued by hand; see the spec,
//! `docs/superpowers/specs/2026-11-16-rust-type-info-worker-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:types:rs`.

use esi::EsiClient;
use runner::{Processed, Worker};
use sqlx::PgPool;
use worker_info_types::type_info::{upsert_type, TypeInfo};

struct TypeWorker {
    pool: PgPool,
    esi: EsiClient,
}

impl Worker for TypeWorker {
    const QUEUE_NAME: &'static str = "esi_type_info_queue";
    const CONSUMER_TAG: &'static str = "worker-info-types-rs";
    const STARTED: &'static str = "📦 type info worker started";
    const WAITING_FOR: &'static str = "types";
    const ENTITY: &'static str = "type";

    async fn handle(&self, id: i32) -> anyhow::Result<Processed> {
        // The trailing slash matches the Node service (`type.service.ts:57`).
        let info: TypeInfo = self.esi.get(&format!("/universe/types/{id}/")).await?;
        let inserted = upsert_type(&self.pool, id, &info).await?;
        Ok(Processed {
            inserted,
            detail: format!(" {}", info.name),
        })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| TypeWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
