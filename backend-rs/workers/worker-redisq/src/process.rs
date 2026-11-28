//! One killmail, from R2Z2's package to a settled outcome (spec §3–§5).
//!
//! "Settled" means the stream may move past it: saved, already stored, or
//! recorded in `killmail_refs` for the detail pipeline to retry. Only a
//! failed ref write is an `Err` — then the killmail is written nowhere, and
//! the caller keeps the sequence where it is.

use anyhow::Context as _;
use chrono::NaiveDateTime;
use esi::EsiClient;
use killmail_refs::Ref;
use killmail_writer::{save, KillmailDetail, Saved};
use pubsub::RedisPubSub;
use serde_json::json;
use sqlx::PgPool;
use tracing::{info, warn};

use crate::enrich::enrich;
use crate::outbox::{Outbox, DISCORD_WEBHOOK_QUEUE};
use crate::r2z2::Package;

/// The API subscription channel for new killmails (`pubsub.ts`).
pub const NEW_KILLMAIL: &str = "NEW_KILLMAIL";
/// `killmail_refs.source` for a killmail this worker could not write.
pub const REF_SOURCE: &str = "redisq";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settled {
    /// Written; `announced` Discord messages were confirmed.
    Saved {
        announced: u64,
    },
    AlreadyStored,
    /// Recorded in `killmail_refs`.
    Deferred,
}

pub struct Processor {
    pub pool: PgPool,
    /// Made [`live`](EsiClient::live) by the binary.
    pub esi: EsiClient,
    pub pubsub: RedisPubSub,
    /// `REDISQ_ENABLE_ENRICHMENT` is not `false`.
    pub enrichment: bool,
}

impl Processor {
    /// `now` is UTC: the attackers' `updated_at` and the ref's
    /// `discovered_at`.
    pub async fn process(
        &self,
        outbox: &dyn Outbox,
        pkg: &Package,
        now: NaiveDateTime,
    ) -> anyhow::Result<Settled> {
        let id = pkg.killmail_id;
        let detail = match &pkg.esi {
            Some(detail) => {
                info!("📥 from payload: {id}");
                detail.clone()
            }
            None => {
                info!("📥 fetching from ESI: {id}");
                let path = format!("/killmails/{id}/{}/", pkg.hash);
                match self.esi.get::<KillmailDetail>(&path).await {
                    Ok(detail) => detail,
                    Err(e) => return self.defer(pkg, now, &e.into()).await,
                }
            }
        };

        if self.enrichment {
            match enrich(&self.pool, &self.esi, outbox, &detail).await {
                Ok(tally) if tally.written + tally.failed > 0 => {
                    info!("   🔧 enriched {} ({} failed)", tally.written, tally.failed)
                }
                Ok(_) => {}
                // The save below meets the same database and settles it.
                Err(e) => warn!("   ⚠️  killmail {id}: enrichment lookup failed: {e:#}"),
            }
        }

        match save(&self.pool, &detail, &pkg.hash, now).await {
            Ok(Saved::Written) => {
                let announced = self.announce(outbox, id).await;
                info!("✅ saved: {id}");
                Ok(Settled::Saved { announced })
            }
            Ok(Saved::AlreadyStored) => {
                info!("⏭️  skipped: {id} (already stored)");
                Ok(Settled::AlreadyStored)
            }
            Err(e) => self.defer(pkg, now, &e).await,
        }
    }

    /// Hand the killmail to the detail pipeline. The error is why it could
    /// not be written here, for the log line.
    async fn defer(
        &self,
        pkg: &Package,
        now: NaiveDateTime,
        why: &anyhow::Error,
    ) -> anyhow::Result<Settled> {
        let id = pkg.killmail_id;
        warn!("   ⚠️  killmail {id} not written ({why:#}); recorded in killmail_refs");
        let reference = Ref {
            killmail_id: id,
            killmail_hash: pkg.hash.clone(),
        };
        killmail_refs::record(&self.pool, &[reference], REF_SOURCE, now)
            .await
            .with_context(|| format!("killmail {id}: not written, and no killmail_refs row"))?;
        Ok(Settled::Deferred)
    }

    /// After the commit: the API's subscribers and the Discord worker. A
    /// failure is logged and swallowed; the killmail is stored either way.
    async fn announce(&self, outbox: &dyn Outbox, id: i32) -> u64 {
        if let Err(e) = self
            .pubsub
            .publish(NEW_KILLMAIL, &json!({ "killmailId": id }))
            .await
        {
            warn!("   ⚠️  killmail {id}: NEW_KILLMAIL not published: {e:#}");
        }
        match outbox.publish_killmails(DISCORD_WEBHOOK_QUEUE, &[id]).await {
            Ok(confirmed) => confirmed,
            Err(e) => {
                warn!("   ⚠️  killmail {id}: not queued for Discord: {e:#}");
                0
            }
        }
    }
}
