//! Character killmail sync: reads a logged-in user's killmail list from ESI
//! with their token and records every killmail it lists in `killmail_refs`;
//! `queue-killmail-refs` feeds the detail queue from there. The Rust
//! counterpart of `backend/src/workers/worker-esi-user-killmails.ts`: same
//! queue, same messages, same rules. See the spec,
//! `docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:user-killmails:rs`.

use sso::SsoClient;
use worker_user_killmails::UserKillmailWorker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // `runner::run` loads `.env` too, but the SSO client is built first, so
    // that a missing EVE_CLIENT_ID fails at startup rather than on a user.
    let _ = dotenvy::dotenv();
    let sso = SsoClient::from_env()?;
    runner::run(|r| UserKillmailWorker {
        pool: r.pool,
        esi: r.esi,
        sso,
    })
    .await
}
