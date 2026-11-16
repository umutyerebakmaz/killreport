//! Alliance corporations worker binary. Run from `backend/` so it reads the
//! same `.env` as the Node worker.

use worker_alliance_corporations::AllianceCorporationWorker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| AllianceCorporationWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
