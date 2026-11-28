//! Where the worker's RabbitMQ messages go: the Discord queue for a new
//! killmail, and an entity's info queue when enrichment could not fetch it.
//! A trait so the tests can record what would have been sent.

use futures_util::future::BoxFuture;

/// The queue a new killmail goes to for the Discord worker.
pub const DISCORD_WEBHOOK_QUEUE: &str = "discord_webhook_queue";
/// Every message's `source`.
pub const SOURCE: &str = "worker-redisq";

pub trait Outbox: Send + Sync {
    /// One killmail message per ID; returns how many the broker confirmed.
    fn publish_killmails<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>>;

    /// One entity message per ID; returns how many the broker confirmed.
    fn publish_entities<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>>;
}
