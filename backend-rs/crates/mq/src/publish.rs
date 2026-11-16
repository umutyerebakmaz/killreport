//! Publishing entity IDs onto an info queue: the loop the Node queue scripts
//! share (`queue-alliances.ts:27-46`, `queue-corporations.ts:52-74`), with
//! publisher confirms so "queued successfully" means the broker has them.

use anyhow::bail;
use lapin::options::{BasicPublishOptions, ConfirmSelectOptions};
use lapin::publisher_confirm::Confirmation;
use lapin::types::FieldTable;
use lapin::{BasicProperties, Channel};

use crate::EntityMessage;

/// IDs per progress report (`queue-alliances.ts:7`).
pub const BATCH_SIZE: usize = 100;

/// The properties every published message carries: delivery mode 2 is
/// `persistent: true`, and an empty headers table is what amqplib sends when
/// none are given. `priority` is written only when there is one.
pub fn message_properties(priority: Option<u8>) -> BasicProperties {
    let properties = BasicProperties::default()
        .with_delivery_mode(2)
        .with_headers(FieldTable::default());
    match priority {
        Some(priority) => properties.with_priority(priority),
        None => properties,
    }
}

/// Publish one persistent [`EntityMessage`] per ID onto `queue`, in order,
/// and wait until the broker has confirmed every one.
///
/// `on_batch(batch, total_batches, len)` runs after each batch of
/// [`BATCH_SIZE`] is sent; batches count from 1. The log line is the caller's,
/// because the two scripts word it differently. Returns how many messages
/// were confirmed; a broker nack is an error.
pub async fn publish_entities(
    channel: &Channel,
    queue: &str,
    source: &'static str,
    ids: &[i32],
    priority: Option<u8>,
    on_batch: impl Fn(usize, usize, usize),
) -> anyhow::Result<u64> {
    channel
        .confirm_select(ConfirmSelectOptions::default())
        .await?;

    let total_batches = ids.len().div_ceil(BATCH_SIZE);
    let mut pending = Vec::with_capacity(ids.len());
    for (index, batch) in ids.chunks(BATCH_SIZE).enumerate() {
        for &id in batch {
            pending.push((
                id,
                publish(channel, queue, &EntityMessage::new(id, source), priority).await?,
            ));
        }
        on_batch(index + 1, total_batches, batch.len());
    }

    await_confirms(pending).await
}

/// Publish ready-made messages onto `queue`, in order, and wait until the
/// broker has confirmed every one. Unlike [`publish_entities`] this does not
/// call `confirm_select`: the channel must already be in confirm mode.
/// Returns how many messages were confirmed; a broker nack is an error.
pub async fn publish_messages(
    channel: &Channel,
    queue: &str,
    messages: &[EntityMessage],
    priority: Option<u8>,
) -> anyhow::Result<u64> {
    let mut pending = Vec::with_capacity(messages.len());
    for message in messages {
        pending.push((
            message.entity_id,
            publish(channel, queue, message, priority).await?,
        ));
    }
    await_confirms(pending).await
}

/// One message to the default exchange, with the queue's name as the routing key.
async fn publish(
    channel: &Channel,
    queue: &str,
    message: &EntityMessage,
    priority: Option<u8>,
) -> anyhow::Result<lapin::publisher_confirm::PublisherConfirm> {
    Ok(channel
        .basic_publish(
            "",
            queue,
            BasicPublishOptions::default(),
            &message.to_body(),
            message_properties(priority),
        )
        .await?)
}

async fn await_confirms(
    pending: Vec<(i32, lapin::publisher_confirm::PublisherConfirm)>,
) -> anyhow::Result<u64> {
    let mut confirmed = 0;
    for (id, confirm) in pending {
        match confirm.await? {
            Confirmation::Nack(_) => bail!("the broker refused the message for {id}"),
            Confirmation::Ack(_) | Confirmation::NotRequested => confirmed += 1,
        }
    }
    Ok(confirmed)
}
