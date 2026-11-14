//! One delivery, from parse to settle: `worker-info-alliances.ts` message
//! handler, with the entity-specific part behind [`Worker::handle`].

use mq::{handle_worker_error, Settle, WorkerLog};
use tracing::{error, info, warn};

use crate::{success_line, EntityQueueMessage, Totals, Worker};

/// The failure path's log, with which entity it was
/// (`worker-info-alliances.ts:146-149`).
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
/// happens on every path.
pub async fn process_one<W: Worker>(worker: &W, settle: &impl Settle, totals: &Totals) {
    totals.touch();

    let parsed = EntityQueueMessage::parse(settle.body());
    let context = match &parsed {
        Ok(message) => format!("{} {}", W::ENTITY, message.entity_id),
        Err(_) => "unparseable message".to_owned(),
    };

    let outcome = async {
        let id = parsed?.entity_id;
        worker.handle(id).await
    }
    .await;

    match outcome {
        Ok(processed) => {
            let n = totals.processed() + 1;
            if processed.inserted {
                totals.count_created();
            } else {
                totals.count_updated();
            }
            info!("{}", success_line(n, &processed));
            if let Err(e) = settle.ack().await {
                error!("❌ ack failed ({context}): {e}");
            }
            totals.count_processed();
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
}
