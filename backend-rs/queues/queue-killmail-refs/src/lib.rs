//! The killmail refs publisher's testable parts: the message, and one run
//! against a broker behind [`Broker`], so the tests need no RabbitMQ.

use std::future::Future;

use chrono::NaiveDateTime;
use killmail_refs::{mark_queued, pending, Ref};
use serde::Serialize;
use sqlx::PgPool;
use tracing::info;

/// The queue `worker:killmail-detail` consumes.
pub const QUEUE_NAME: &str = "esi_killmail_detail_queue";
/// Below the live feed: these are kills that already happened.
pub const PRIORITY: u8 = 5;

/// `{"killmailId":…,"killmailHash":"…","announce":false}`, field for field
/// what `buildDetailMessage` in `killmail-detail-message.ts` builds.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DetailMessage<'a> {
    killmail_id: i32,
    killmail_hash: &'a str,
    announce: bool,
}

/// The detail message for one ref. `announce` is always false: these are
/// kills the live feed missed or old ones from a user's history.
pub fn detail_body(r: &Ref) -> Vec<u8> {
    serde_json::to_vec(&DetailMessage {
        killmail_id: r.killmail_id,
        killmail_hash: &r.killmail_hash,
        announce: false,
    })
    .expect("an integer, a string and a bool always serialize")
}

/// Messages waiting in, and consumers on, the detail queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QueueDepth {
    pub messages: u32,
    pub consumers: u32,
}

/// What the publisher needs from RabbitMQ.
pub trait Broker {
    /// The detail queue's depth.
    fn depth(&self) -> impl Future<Output = anyhow::Result<QueueDepth>> + Send;
    /// Publish every body and return once the broker confirmed all of them;
    /// a nack is an error.
    fn publish_confirmed(
        &self,
        bodies: &[Vec<u8>],
    ) -> impl Future<Output = anyhow::Result<()>> + Send;
}

/// One run: skip while the detail queue has no consumer or still holds
/// messages (`skipReason` in `queue-health.ts`), otherwise publish
/// the pending batch and count the round once the broker confirmed it.
/// Returns how many refs went out. `now` is UTC.
pub async fn publish_pending(
    pool: &PgPool,
    broker: &impl Broker,
    now: NaiveDateTime,
) -> anyhow::Result<usize> {
    let depth = broker.depth().await?;
    if depth.consumers == 0 {
        info!("⏭️  {QUEUE_NAME}: no worker is consuming the queue, nothing published this run");
        return Ok(0);
    }
    if depth.messages > 0 {
        info!(
            "⏭️  {QUEUE_NAME}: {} message(s) still pending, nothing published this run",
            depth.messages
        );
        return Ok(0);
    }

    let refs = pending(pool, now).await?;
    if refs.is_empty() {
        info!("✅ no pending killmail refs");
        return Ok(0);
    }

    let bodies: Vec<Vec<u8>> = refs.iter().map(detail_body).collect();
    broker.publish_confirmed(&bodies).await?;

    let ids: Vec<i32> = refs.iter().map(|r| r.killmail_id).collect();
    mark_queued(pool, &ids, now).await?;
    info!(
        "📤 queued {} pending killmail ref(s) for detail fetch",
        refs.len()
    );
    Ok(refs.len())
}
