//! What a worker may do beyond its own message: publish to another queue,
//! through a channel that belongs to the current connection.

use std::fmt;

use futures_util::future::BoxFuture;
use lapin::Channel;
use mq::EntityMessage;

/// Publishes messages and waits for the broker to confirm them.
pub trait Publisher: Send + Sync {
    /// Publish `messages` onto `queue` and wait until every one is
    /// confirmed. Returns how many were confirmed; a broker nack is an
    /// ordinary error, a lost channel is [`PublisherLost`].
    fn publish<'a>(
        &'a self,
        queue: &'a str,
        messages: &'a [EntityMessage],
        priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>>;

    /// Publish one `{"killmailId","queuedAt","source"}` message per ID onto
    /// `queue` ([`mq::KillmailMessage`]) and wait until every one is
    /// confirmed. Errors as [`Publisher::publish`].
    fn publish_killmails<'a>(
        &'a self,
        queue: &'a str,
        source: &'static str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>>;
}

/// What `Worker::handle` gets besides the ID. The publisher belongs to the
/// connection the message came in on; a worker takes it from here on every
/// call rather than keeping it, because a reconnect replaces it.
pub struct Context<'a> {
    publisher: &'a dyn Publisher,
}

impl<'a> Context<'a> {
    pub fn new(publisher: &'a dyn Publisher) -> Self {
        Self { publisher }
    }

    pub fn publisher(&self) -> &dyn Publisher {
        self.publisher
    }
}

/// The publisher's channel is gone. The message being handled is left
/// unsettled for the broker to redeliver, and the runner reconnects.
///
/// Trade-off: a publish-side failure that repeats on every reconnect (say the
/// broker refusing publishes to the output queue) loops every 5 s and never
/// burns an attempt. It is loud in the log by design.
#[derive(Debug)]
pub struct PublisherLost;

impl fmt::Display for PublisherLost {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("publisher channel lost")
    }
}

impl std::error::Error for PublisherLost {}

/// The real publisher: a second channel on the worker's connection, already
/// in confirm mode, so its confirms never mix with the consumer's deliveries.
pub(crate) struct ChannelPublisher {
    pub(crate) channel: Channel,
}

impl Publisher for ChannelPublisher {
    fn publish<'a>(
        &'a self,
        queue: &'a str,
        messages: &'a [EntityMessage],
        priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move {
            if !self.channel.status().connected() {
                return Err(PublisherLost.into());
            }
            mq::publish_messages(&self.channel, queue, messages, priority)
                .await
                .map_err(lost_on_lapin_error)
        })
    }

    fn publish_killmails<'a>(
        &'a self,
        queue: &'a str,
        source: &'static str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move {
            if !self.channel.status().connected() {
                return Err(PublisherLost.into());
            }
            mq::publish_killmails(&self.channel, queue, source, ids)
                .await
                .map_err(lost_on_lapin_error)
        })
    }
}

/// Any lapin error is the channel or the connection failing; a broker nack
/// is not a lapin error and stays an ordinary one.
fn lost_on_lapin_error(e: anyhow::Error) -> anyhow::Error {
    if e.downcast_ref::<lapin::Error>().is_some() {
        PublisherLost.into()
    } else {
        e
    }
}

/// Against a real RabbitMQ; ignored by default:
/// `RABBITMQ_URL=amqp://localhost cargo test -p runner publisher -- --ignored`
#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use lapin::options::{ConfirmSelectOptions, QueueDeclareOptions, QueueDeleteOptions};
    use lapin::types::FieldTable;

    use super::*;

    async fn publisher() -> (lapin::Connection, ChannelPublisher, String) {
        let url = std::env::var("RABBITMQ_URL").expect("RABBITMQ_URL is not set");
        let (connection, channel) = mq::connect(&url).await.unwrap();
        channel
            .confirm_select(ConfirmSelectOptions::default())
            .await
            .unwrap();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let queue = format!("runner_publisher_test_{nanos}");
        channel
            .queue_declare(
                &queue,
                QueueDeclareOptions {
                    exclusive: true,
                    ..QueueDeclareOptions::default()
                },
                FieldTable::default(),
            )
            .await
            .unwrap();
        (connection, ChannelPublisher { channel }, queue)
    }

    #[tokio::test]
    #[ignore = "needs RabbitMQ in RABBITMQ_URL"]
    async fn a_publish_is_confirmed_by_the_broker() {
        let (connection, publisher, queue) = publisher().await;
        let messages = [EntityMessage::new(1, "test"), EntityMessage::new(2, "test")];
        let confirmed = publisher.publish(&queue, &messages, Some(3)).await.unwrap();
        assert_eq!(confirmed, 2);
        let _ = publisher
            .channel
            .queue_delete(&queue, QueueDeleteOptions::default())
            .await;
        let _ = connection.close(200, "test done").await;
    }

    #[tokio::test]
    #[ignore = "needs RabbitMQ in RABBITMQ_URL"]
    async fn a_killmail_publish_is_confirmed_by_the_broker() {
        let (connection, publisher, queue) = publisher().await;
        let confirmed = publisher
            .publish_killmails(&queue, "test", &[7, 8])
            .await
            .unwrap();
        assert_eq!(confirmed, 2);
        let got = publisher
            .channel
            .basic_get(&queue, lapin::options::BasicGetOptions::default())
            .await
            .unwrap()
            .expect("a message on the queue");
        let body: serde_json::Value = serde_json::from_slice(&got.delivery.data).unwrap();
        assert_eq!(body["killmailId"], 7);
        let _ = publisher
            .channel
            .queue_delete(&queue, QueueDeleteOptions::default())
            .await;
        let _ = connection.close(200, "test done").await;
    }

    #[tokio::test]
    #[ignore = "needs RabbitMQ in RABBITMQ_URL"]
    async fn a_closed_channel_is_a_lost_publisher() {
        let (connection, publisher, queue) = publisher().await;
        let _ = publisher
            .channel
            .queue_delete(&queue, QueueDeleteOptions::default())
            .await;
        publisher.channel.close(200, "test").await.unwrap();
        let error = publisher
            .publish(&queue, &[EntityMessage::new(1, "test")], None)
            .await
            .unwrap_err();
        assert!(error.downcast_ref::<PublisherLost>().is_some(), "{error:#}");
        let _ = connection.close(200, "test done").await;
    }
}
