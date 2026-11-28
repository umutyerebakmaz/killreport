//! The [`Outbox`] the binary uses: one RabbitMQ channel in confirm mode,
//! opened on the first publish and opened again after a failed one, every
//! publish bounded by [`PUBLISH_TIMEOUT`], so a broker restart or a blocked
//! broker costs announcements, never the stream.

use std::time::Duration;

use futures_util::future::BoxFuture;
use lapin::options::ConfirmSelectOptions;
use lapin::{Channel, Connection};
use mq::EntityMessage;
use tokio::sync::Mutex;
use tracing::info;

use crate::outbox::{Outbox, DISCORD_WEBHOOK_QUEUE, SOURCE};

/// Every queue this worker publishes to, declared before the first publish.
pub const QUEUES: [&str; 5] = [
    DISCORD_WEBHOOK_QUEUE,
    "esi_alliance_info_queue",
    "esi_corporation_info_queue",
    "esi_character_info_queue",
    "esi_type_info_queue",
];

/// How long one publish may take, connect and confirms included, before it
/// fails: a broker that blocks publishers (a disk or memory alarm) would
/// otherwise hold the stream forever.
pub const PUBLISH_TIMEOUT: Duration = Duration::from_secs(5);

pub struct RabbitOutbox {
    url: String,
    timeout: Duration,
    /// The connection is kept with its channel: dropping it closes both.
    open: Mutex<Option<(Connection, Channel)>>,
}

impl RabbitOutbox {
    pub fn new(url: String) -> Self {
        Self::with_timeout(url, PUBLISH_TIMEOUT)
    }

    /// [`new`](Self::new) with another timeout, for the tests.
    pub fn with_timeout(url: String, timeout: Duration) -> Self {
        Self {
            url,
            timeout,
            open: Mutex::new(None),
        }
    }

    async fn channel(&self) -> anyhow::Result<Channel> {
        let mut open = self.open.lock().await;
        if let Some((_, channel)) = open.as_ref() {
            if channel.status().connected() {
                return Ok(channel.clone());
            }
        }
        let (connection, channel) = mq::connect(&self.url).await?;
        for queue in QUEUES {
            mq::declare_worker_queue(&channel, queue).await?;
        }
        channel
            .confirm_select(ConfirmSelectOptions::default())
            .await?;
        info!("🐰 RabbitMQ channel open");
        *open = Some((connection, channel.clone()));
        Ok(channel)
    }

    /// Run one publish — connect, declare and confirms included — within the
    /// timeout. A failed or timed-out one forgets the channel, so the next
    /// publish opens a new one.
    async fn bounded(
        &self,
        publish: impl std::future::Future<Output = anyhow::Result<u64>>,
    ) -> anyhow::Result<u64> {
        let result = match tokio::time::timeout(self.timeout, publish).await {
            Ok(result) => result,
            Err(_) => Err(anyhow::anyhow!(
                "RabbitMQ did not answer within {} ms",
                self.timeout.as_millis()
            )),
        };
        if result.is_err() {
            *self.open.lock().await = None;
        }
        result
    }
}

impl Outbox for RabbitOutbox {
    fn publish_killmails<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(self.bounded(async move {
            let channel = self.channel().await?;
            mq::publish_killmails(&channel, queue, SOURCE, ids).await
        }))
    }

    fn publish_entities<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(self.bounded(async move {
            let channel = self.channel().await?;
            let messages: Vec<EntityMessage> = ids
                .iter()
                .map(|&id| EntityMessage::new(id, SOURCE))
                .collect();
            mq::publish_messages(&channel, queue, &messages, None).await
        }))
    }
}
