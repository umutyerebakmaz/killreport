//! Corporation info worker: fetches corporation information from ESI and
//! saves it to the database. The Rust counterpart of
//! `backend/src/workers/worker-info-corporations.ts`, same queue, same
//! messages, same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:corporations:rs`.

use esi::EsiClient;
use runner::{Processed, Worker};
use sqlx::PgPool;
use worker_info_corporations::corporation::{upsert_corporation, CorporationInfo};

struct CorporationWorker {
    pool: PgPool,
    esi: EsiClient,
}

impl Worker for CorporationWorker {
    const QUEUE_NAME: &'static str = "esi_corporation_info_queue";
    /// Process 25 corporations concurrently (`worker-info-corporations.ts`).
    const PREFETCH_COUNT: u16 = 25;
    const CONSUMER_TAG: &'static str = "worker-info-corporations-rs";
    const STARTED: &'static str = "🏢 corporation info worker started";
    const WAITING_FOR: &'static str = "corporations";
    const ENTITY: &'static str = "corporation";

    async fn handle(&self, id: i32) -> anyhow::Result<Processed> {
        // Always take the latest info from ESI. The trailing slash matches
        // the Node service (`corporation.service.ts:20-22`).
        let info: CorporationInfo = self.esi.get(&format!("/corporations/{id}/")).await?;
        let inserted = upsert_corporation(&self.pool, id, &info).await?;
        Ok(Processed {
            inserted,
            detail: format!("[{id}] {} [{}]", info.name, info.ticker),
        })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| CorporationWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
