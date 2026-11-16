//! Alliance corporations worker: fetches each alliance's corporation IDs from
//! ESI and queues them for the corporation info worker. The Rust counterpart
//! of `backend/src/workers/worker-alliance-corporations.ts`, same queues,
//! same messages, same log lines.

use esi::EsiClient;
use mq::EntityMessage;
use runner::{Context, Outcome, Processed, Totals, Worker};
use sqlx::PgPool;

/// Lower than direct enrichment requests.
pub const OUTPUT_PRIORITY: u8 = 3;

/// The queue the corporation IDs are published to.
pub const OUTPUT_QUEUE_NAME: &str = "esi_corporation_info_queue";

pub struct AllianceCorporationWorker {
    pub pool: PgPool,
    pub esi: EsiClient,
}

impl Worker for AllianceCorporationWorker {
    const QUEUE_NAME: &'static str = "esi_alliance_corporations_queue";
    const OUTPUT_QUEUE: Option<&'static str> = Some(OUTPUT_QUEUE_NAME);
    const CONSUMER_TAG: &'static str = "worker-alliance-corporations-rs";
    const STARTED: &'static str = "🤝 alliance corporation worker started";
    const WAITING_FOR: &'static str = "alliances";
    const ENTITY: &'static str = "alliance";

    async fn handle(&self, id: i32, ctx: &Context<'_>) -> anyhow::Result<Processed> {
        let (name, ticker) = alliance_label(&self.pool, id).await?;
        let corporation_ids: Vec<i32> = self
            .esi
            .get(&format!("/alliances/{id}/corporations"))
            .await?;

        if corporation_ids.is_empty() {
            return Ok(Processed {
                outcome: Outcome::Queued(0),
                detail: format!("[{id}] {name} [{ticker}] - no corporations"),
            });
        }

        let source = format!("alliance_{id}");
        let messages: Vec<EntityMessage> = corporation_ids
            .iter()
            .map(|&corp_id| EntityMessage::new(corp_id, source.clone()))
            .collect();
        let queued = ctx
            .publisher()
            .publish(OUTPUT_QUEUE_NAME, &messages, Some(OUTPUT_PRIORITY))
            .await?;

        Ok(Processed {
            outcome: Outcome::Queued(queued),
            detail: format!("[{id}] {name} [{ticker}] - queued {queued} corps"),
        })
    }

    fn summary(totals: &Totals) -> String {
        format!(
            "📊 final: {} alliances processed, {} corporations queued, {} errors",
            totals.processed(),
            totals.queued(),
            totals.errors()
        )
    }
}

/// The alliance's name and ticker for the log line; `("Unknown", "???")` when
/// the alliance is not in the database yet.
pub async fn alliance_label(pool: &PgPool, id: i32) -> Result<(String, String), sqlx::Error> {
    let row = sqlx::query!("SELECT name, ticker FROM alliances WHERE id = $1", id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map_or_else(
        || ("Unknown".to_string(), "???".to_string()),
        |r| (r.name, r.ticker),
    ))
}
