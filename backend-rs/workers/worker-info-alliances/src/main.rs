//! Alliance info worker: fetches alliance information from ESI and saves it
//! to the database. The Rust counterpart of
//! `backend/src/workers/worker-info-alliances.ts`, same queue, same messages,
//! same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:alliances:rs`.

use esi::EsiClient;
use runner::{Processed, Worker};
use sqlx::PgPool;
use worker_info_alliances::alliance::{upsert_alliance, AllianceInfo};

struct AllianceWorker {
    pool: PgPool,
    esi: EsiClient,
}

impl Worker for AllianceWorker {
    const QUEUE_NAME: &'static str = "esi_alliance_info_queue";
    /// Process 3 alliances concurrently (`worker-info-alliances.ts:12`).
    const PREFETCH_COUNT: u16 = 3;
    const CONSUMER_TAG: &'static str = "worker-info-alliances-rs";
    const STARTED: &'static str = "🤝 alliance info worker started";
    const WAITING_FOR: &'static str = "alliances";
    const ENTITY: &'static str = "alliance";

    async fn handle(&self, id: i32) -> anyhow::Result<Processed> {
        // Always take the latest info from ESI.
        let info: AllianceInfo = self.esi.get(&format!("/alliances/{id}")).await?;
        let inserted = upsert_alliance(&self.pool, id, &info).await?;
        Ok(Processed {
            inserted,
            detail: format!(" {} [{}] ID:{id}", info.name, info.ticker),
        })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| AllianceWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
