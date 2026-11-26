//! One delivery, from parse to settle, with the entity-specific part behind
//! [`Worker::handle`].

use mq::{handle_worker_error, Settle, WorkerLog};
use tracing::{error, info, warn};

use crate::{success_line, Context, EntityQueueMessage, Outcome, PublisherLost, Totals, Worker};

/// How [`process_one`] left the message.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settled {
    /// Exactly one settle call was made.
    Settled,
    /// The publisher's channel was lost: no settle call, no counter moved.
    /// The connection has to go so that the broker redelivers the message.
    PublisherLost,
}

/// The failure path's log, with which entity it was
struct ContextLog(String);

impl WorkerLog for ContextLog {
    fn warn(&self, message: &str) {
        warn!("  {message} ({})", self.0);
    }
    fn error(&self, message: &str, error: &anyhow::Error) {
        error!("  {message} ({}): {error:#}", self.0);
    }
}

/// Parse, handle, count, log and settle one message. Exactly one settle call
/// happens on every path but a lost publisher.
pub async fn process_one<W: Worker>(
    worker: &W,
    settle: &impl Settle,
    totals: &Totals,
    ctx: &Context<'_>,
) -> Settled {
    totals.touch();

    let parsed = EntityQueueMessage::parse(settle.body());
    let context = match &parsed {
        Ok(message) => format!("{} {}", W::ENTITY, message.entity_id),
        Err(_) => "unparseable message".to_owned(),
    };

    let outcome = async {
        let message = parsed?;
        worker.handle_message(&message, ctx).await
    }
    .await;

    match outcome {
        Ok(processed) => {
            let n = totals.processed() + 1;
            match processed.outcome {
                Outcome::Created => totals.count_created(),
                Outcome::Updated => totals.count_updated(),
                Outcome::Queued(queued) | Outcome::Saved { queued } => totals.count_queued(queued),
                Outcome::Unchanged => totals.count_unchanged(),
            }
            info!("{}", success_line(n, &processed));
            if let Err(e) = settle.ack().await {
                error!("❌ ack failed ({context}): {e}");
            }
            totals.count_processed();
        }
        Err(e) if e.downcast_ref::<PublisherLost>().is_some() => {
            warn!("  ⚠️  publisher channel lost, leaving the message for redelivery ({context})");
            return Settled::PublisherLost;
        }
        Err(e) => {
            totals.count_error();
            totals.count_processed();
            // 404, throttles and the attempt count all live in the shared
            // path; this only says which message it was.
            if let Err(settle_error) =
                handle_worker_error(settle, W::QUEUE_NAME, &e, &ContextLog(context.clone())).await
            {
                error!("❌ could not settle the message ({context}): {settle_error}");
            }
        }
    }
    Settled::Settled
}
