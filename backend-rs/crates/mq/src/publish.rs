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
    on_batch: impl Fn(usize, usize, usize),
) -> anyhow::Result<u64> {
    channel
        .confirm_select(ConfirmSelectOptions::default())
        .await?;

    let total_batches = ids.len().div_ceil(BATCH_SIZE);
    let mut pending = Vec::with_capacity(ids.len());
    for (index, batch) in ids.chunks(BATCH_SIZE).enumerate() {
        for &id in batch {
            // The default exchange with the queue's name as the routing key;
            // delivery mode 2 is `persistent: true`. No priority, and an empty
            // headers table, which amqplib sends when none are given.
            let confirm = channel
                .basic_publish(
                    "",
                    queue,
                    BasicPublishOptions::default(),
                    &EntityMessage::new(id, source).to_body(),
                    BasicProperties::default()
                        .with_delivery_mode(2)
                        .with_headers(FieldTable::default()),
                )
                .await?;
            pending.push((id, confirm));
        }
        on_batch(index + 1, total_batches, batch.len());
    }

    let mut confirmed = 0;
    for (id, confirm) in pending {
        match confirm.await? {
            Confirmation::Nack(_) => bail!("the broker refused the message for {id}"),
            Confirmation::Ack(_) | Confirmation::NotRequested => confirmed += 1,
        }
    }
    Ok(confirmed)
}
