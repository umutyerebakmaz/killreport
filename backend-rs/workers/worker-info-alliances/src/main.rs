//! Alliance info worker: fetches alliance information from ESI and saves it
//! to the database. The Rust counterpart of
//! `backend/src/workers/worker-info-alliances.ts`, same queue, same messages,
//! same log lines.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:alliances:rs`.

use esi::EsiClient;
use runner::{Context, Outcome, Processed, Worker};
use sqlx::PgPool;
use entity_info::alliance;

struct AllianceWorker {
    pool: PgPool,
    esi: EsiClient,
}

impl Worker for AllianceWorker {
    const QUEUE_NAME: &'static str = "esi_alliance_info_queue";
    const CONSUMER_TAG: &'static str = "worker-info-alliances-rs";
    const STARTED: &'static str = "🤝 alliance info worker started";
    const WAITING_FOR: &'static str = "alliances";
    const ENTITY: &'static str = "alliance";

    async fn handle(&self, id: i32, _ctx: &Context<'_>) -> anyhow::Result<Processed> {
        // Always take the latest info from ESI.
        let fetched = alliance::fetch_and_upsert(&self.pool, &self.esi, id).await?;
        Ok(Processed {
            outcome: if fetched.inserted {
                Outcome::Created
            } else {
                Outcome::Updated
            },
            detail: format!(
                " {} [{}] ID:{id}",
                fetched.name,
                fetched.ticker.unwrap_or_default()
            ),
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
