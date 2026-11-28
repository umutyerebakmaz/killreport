//! Corporation info worker: fetches corporation information from ESI and
//! saves it to the database. The Rust counterpart of
//! `backend/src/workers/worker-info-corporations.ts`, same queue, same
//! messages, same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:corporations:rs`.

use entity_info::corporation;
use esi::EsiClient;
use runner::{Context, Outcome, Processed, Worker};
use sqlx::PgPool;

struct CorporationWorker {
    pool: PgPool,
    esi: EsiClient,
}

impl Worker for CorporationWorker {
    const QUEUE_NAME: &'static str = "esi_corporation_info_queue";
    const CONSUMER_TAG: &'static str = "worker-info-corporations-rs";
    const STARTED: &'static str = "🏢 corporation info worker started";
    const WAITING_FOR: &'static str = "corporations";
    const ENTITY: &'static str = "corporation";

    async fn handle(&self, id: i32, _ctx: &Context<'_>) -> anyhow::Result<Processed> {
        // Always take the latest info from ESI.
        let fetched = corporation::fetch_and_upsert(&self.pool, &self.esi, id).await?;
        Ok(Processed {
            outcome: if fetched.inserted {
                Outcome::Created
            } else {
                Outcome::Updated
            },
            detail: format!(
                "[{id}] {} [{}]",
                fetched.name,
                fetched.ticker.unwrap_or_default()
            ),
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
