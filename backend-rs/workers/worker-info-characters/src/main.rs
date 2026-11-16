//! Character info worker: fetches character information from ESI and saves
//! it to the database. The Rust counterpart of
//! `backend/src/workers/worker-info-characters.ts`: same queue, same
//! messages, same rows. Its log lines follow the shared runner rather than
//! Node's (no `↻` for an update, no every-50 summary); see the spec,
//! `docs/superpowers/specs/2026-11-15-rust-character-info-worker-design.md`,
//! "Log satırları".
//!
//! Run from `backend/` so it reads the same `.env` as the Node worker:
//! `yarn worker:info:characters:rs`.

use esi::EsiClient;
use runner::{Processed, Worker};
use sqlx::PgPool;
use worker_info_characters::character::{
    upsert_character, CharacterInfo, CHARACTER_COMPATIBILITY_DATE,
};

struct CharacterWorker {
    pool: PgPool,
    esi: EsiClient,
}

impl Worker for CharacterWorker {
    const QUEUE_NAME: &'static str = "esi_character_info_queue";
    const CONSUMER_TAG: &'static str = "worker-info-characters-rs";
    const STARTED: &'static str = "👤 character info worker started";
    const WAITING_FOR: &'static str = "characters";
    const ENTITY: &'static str = "character";

    async fn handle(&self, id: i32) -> anyhow::Result<Processed> {
        // Always take the latest info from ESI, at the date that carries the
        // achievement fields. The trailing slash matches the Node service
        // (`character.service.ts:53-56`).
        let info: CharacterInfo = self
            .esi
            .get_with_compatibility_date(
                &format!("/characters/{id}/"),
                CHARACTER_COMPATIBILITY_DATE,
            )
            .await?;
        let inserted = upsert_character(&self.pool, id, &info).await?;
        Ok(Processed {
            inserted,
            detail: format!(" {}", info.name),
        })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| CharacterWorker {
        pool: r.pool,
        esi: r.esi,
    })
    .await
}
