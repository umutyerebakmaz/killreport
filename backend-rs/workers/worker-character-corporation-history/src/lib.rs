//! Character corporation history worker: fetches a character's employment
//! history from ESI, saves it, and queues the corporations that are not in
//! the database yet so their names get resolved. The Rust counterpart of
//! `backend/src/workers/worker-character-corporation-history.ts`, same
//! queues, same messages, same log lines.

use chrono::{DateTime, NaiveDateTime, Utc};
use esi::EsiClient;
use mq::EntityMessage;
use runner::{Context, Outcome, Processed, Totals, Worker};
use serde::Deserialize;
use sqlx::PgPool;

/// The queue the missing corporation IDs are published to.
pub const OUTPUT_QUEUE_NAME: &str = "esi_corporation_info_queue";
/// The `source` of every corporation message, the Node worker's name.
pub const SOURCE: &str = "worker-character-corporation-history";

/// One entry of `GET /characters/{id}/corporationhistory/`.
#[derive(Debug, Clone, Deserialize)]
pub struct HistoryRecord {
    pub corporation_id: i32,
    pub record_id: i64,
    pub start_date: DateTime<Utc>,
    /// ESI sends this only when the corporation has been closed.
    #[serde(default)]
    pub is_deleted: bool,
}

pub struct CorporationHistoryWorker {
    pub pool: PgPool,
    pub esi: EsiClient,
}

impl Worker for CorporationHistoryWorker {
    const QUEUE_NAME: &'static str = "esi_character_corporation_history_queue";
    const OUTPUT_QUEUE: Option<&'static str> = Some(OUTPUT_QUEUE_NAME);
    const CONSUMER_TAG: &'static str = "worker-character-corporation-history-rs";
    const STARTED: &'static str = "🏢 character corporation history worker started";
    const WAITING_FOR: &'static str = "characters";
    const ENTITY: &'static str = "character";

    async fn handle(&self, id: i32, ctx: &Context<'_>) -> anyhow::Result<Processed> {
        // The trailing slash matches the Node service (`character.service.ts:68-70`).
        let records: Vec<HistoryRecord> = self
            .esi
            .get(&format!("/characters/{id}/corporationhistory/"))
            .await?;
        save_history(&self.pool, id, &records, Utc::now()).await?;

        let ids: Vec<i32> = records.iter().map(|r| r.corporation_id).collect();
        let missing = missing_corporation_ids(&self.pool, &ids).await?;
        let queued = if missing.is_empty() {
            0
        } else {
            let messages: Vec<EntityMessage> = missing
                .iter()
                .map(|&corp_id| EntityMessage::new(corp_id, SOURCE))
                .collect();
            ctx.publisher()
                .publish(OUTPUT_QUEUE_NAME, &messages, None)
                .await?
        };

        Ok(Processed {
            outcome: Outcome::Saved { queued },
            detail: format!(
                " character {id}: {} records, {queued} corporations queued",
                records.len()
            ),
        })
    }

    fn summary(totals: &Totals) -> String {
        format!(
            "📊 final: {} processed ({} errors)",
            totals.processed(),
            totals.errors()
        )
    }
}

/// Upserts every record and stamps `fetched_at` on all of the character's
/// rows, so `MAX(fetched_at)` is when the history was last fetched. The same
/// single statement as `character-corporation-history-writer.ts:32-57`. The
/// UPDATE skips the incoming records: the CTE already writes those, and a
/// statement may not modify the same row twice. Timestamps are UTC.
pub async fn save_history(
    pool: &PgPool,
    character_id: i32,
    records: &[HistoryRecord],
    fetched_at: DateTime<Utc>,
) -> sqlx::Result<()> {
    let record_ids: Vec<i64> = records.iter().map(|r| r.record_id).collect();
    let corporation_ids: Vec<i32> = records.iter().map(|r| r.corporation_id).collect();
    let start_dates: Vec<NaiveDateTime> =
        records.iter().map(|r| r.start_date.naive_utc()).collect();
    let deleted: Vec<bool> = records.iter().map(|r| r.is_deleted).collect();

    sqlx::query(
        "WITH incoming AS (
           SELECT *
           FROM unnest(
             $1::bigint[],
             $2::int[],
             $3::timestamp(3)[],
             $4::bool[]
           ) AS v(record_id, corporation_id, start_date, is_deleted)
         ), upserted AS (
           INSERT INTO character_corporation_history
             (record_id, character_id, corporation_id, start_date, is_deleted, fetched_at)
           SELECT record_id, $5, corporation_id, start_date, is_deleted, $6::timestamp(3)
           FROM incoming
           ON CONFLICT (record_id) DO UPDATE SET
             character_id = EXCLUDED.character_id,
             corporation_id = EXCLUDED.corporation_id,
             start_date = EXCLUDED.start_date,
             is_deleted = EXCLUDED.is_deleted,
             fetched_at = EXCLUDED.fetched_at
         )
         UPDATE character_corporation_history
         SET fetched_at = $6::timestamp(3)
         WHERE character_id = $5
           AND record_id NOT IN (SELECT record_id FROM incoming)",
    )
    .bind(record_ids)
    .bind(corporation_ids)
    .bind(start_dates)
    .bind(deleted)
    .bind(character_id)
    .bind(fetched_at.naive_utc())
    .execute(pool)
    .await?;
    Ok(())
}

/// The distinct IDs among `ids` that have no row in `corporations` yet, in ID
/// order. An empty list does not query.
pub async fn missing_corporation_ids(pool: &PgPool, ids: &[i32]) -> sqlx::Result<Vec<i32>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    sqlx::query_scalar(
        "SELECT DISTINCT id FROM unnest($1::int[]) AS t(id)
         WHERE NOT EXISTS (SELECT 1 FROM corporations c WHERE c.id = t.id)
         ORDER BY id",
    )
    .bind(ids)
    .fetch_all(pool)
    .await
}
