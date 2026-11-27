//! The killmail detail worker's parts, split from the binary so the tests can
//! reach them.

use anyhow::bail;
use chrono::Utc;
use esi::EsiClient;
use killmail_writer::{save, KillmailDetail, Saved};
use pubsub::RedisPubSub;
use runner::{Context, EntityQueueMessage, Outcome, Processed, Worker};
use serde_json::json;
use sqlx::PgPool;
use tracing::warn;

/// The queue `announce`d killmails go to for the Discord worker.
pub const DISCORD_WEBHOOK_QUEUE: &str = "discord_webhook_queue";
/// The API subscription channel for new killmails (`pubsub.ts`).
pub const NEW_KILLMAIL: &str = "NEW_KILLMAIL";

pub struct DetailWorker {
    pub pool: PgPool,
    pub esi: EsiClient,
    pub pubsub: RedisPubSub,
}

impl Worker for DetailWorker {
    const QUEUE_NAME: &'static str = "esi_killmail_detail_queue";
    const OUTPUT_QUEUE: Option<&'static str> = Some(DISCORD_WEBHOOK_QUEUE);
    const CONSUMER_TAG: &'static str = "worker-killmail-detail-rs";
    const STARTED: &'static str = "🔄 killmail detail worker started";
    const WAITING_FOR: &'static str = "killmails";
    const ENTITY: &'static str = "killmail";

    /// The detail queue's messages always carry a hash, which an ID alone
    /// does not; [`Worker::handle_message`] is the way in.
    async fn handle(&self, id: i32, _ctx: &Context<'_>) -> anyhow::Result<Processed> {
        bail!("killmail {id}: message has no killmailHash")
    }

    async fn handle_message(
        &self,
        message: &EntityQueueMessage,
        ctx: &Context<'_>,
    ) -> anyhow::Result<Processed> {
        let id = message.entity_id;
        let Some(hash) = message.killmail_hash.as_deref() else {
            bail!("killmail {id}: message has no killmailHash");
        };

        let detail: KillmailDetail = self.esi.get(&format!("/killmails/{id}/{hash}/")).await?;
        match save(&self.pool, &detail, hash, Utc::now().naive_utc()).await? {
            Saved::AlreadyStored => Ok(Processed {
                outcome: Outcome::Unchanged,
                detail: format!(" killmail {id} (already stored)"),
            }),
            Saved::Written => {
                let queued = if message.announce {
                    self.announce(id, ctx).await
                } else {
                    0
                };
                Ok(Processed {
                    outcome: Outcome::Saved { queued },
                    detail: format!(" killmail {id} saved"),
                })
            }
        }
    }
}

impl DetailWorker {
    /// Tell the API's subscribers and the Discord worker, after the commit.
    /// A failure is logged and swallowed: the killmail is written, an
    /// announcement is a courtesy rather than a record, and retrying the
    /// message would only find it already stored. Returns how many Discord
    /// messages the broker confirmed.
    async fn announce(&self, id: i32, ctx: &Context<'_>) -> u64 {
        if let Err(e) = self
            .pubsub
            .publish(NEW_KILLMAIL, &json!({ "killmailId": id }))
            .await
        {
            warn!("   ⚠️  killmail {id}: NEW_KILLMAIL not published: {e:#}");
        }
        match ctx
            .publisher()
            .publish_killmails(DISCORD_WEBHOOK_QUEUE, "worker-killmail-detail", &[id])
            .await
        {
            Ok(confirmed) => confirmed,
            Err(e) => {
                warn!("   ⚠️  killmail {id}: not queued for Discord: {e:#}");
                0
            }
        }
    }
}
