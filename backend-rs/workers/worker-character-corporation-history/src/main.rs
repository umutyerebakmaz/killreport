//! Character corporation history worker binary. Run from `backend/` so it
//! reads the same `.env` as the Node worker:
//! `yarn worker:character-corporation-history:rs`.

use worker_character_corporation_history::CorporationHistoryWorker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| CorporationHistoryWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
