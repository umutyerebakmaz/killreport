//! The [`Outbox`] the binary uses: one RabbitMQ channel in confirm mode,
//! opened on the first publish and opened again after a failed one, so a
//! broker restart costs announcements, never the stream.

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

pub struct RabbitOutbox {
    url: String,
    /// The connection is kept with its channel: dropping it closes both.
    open: Mutex<Option<(Connection, Channel)>>,
}

impl RabbitOutbox {
    pub fn new(url: String) -> Self {
        Self {
            url,
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

    /// Forget the channel after a failed publish, so the next one reopens.
    async fn settle(&self, result: anyhow::Result<u64>) -> anyhow::Result<u64> {
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
        Box::pin(async move {
            let channel = self.channel().await?;
            let result = mq::publish_killmails(&channel, queue, SOURCE, ids).await;
            self.settle(result).await
        })
    }

    fn publish_entities<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move {
            let channel = self.channel().await?;
            let messages: Vec<EntityMessage> = ids
                .iter()
                .map(|&id| EntityMessage::new(id, SOURCE))
                .collect();
            let result = mq::publish_messages(&channel, queue, &messages, None).await;
            self.settle(result).await
        })
    }
}
