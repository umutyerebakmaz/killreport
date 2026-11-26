//! The reusable half of a worker: what happens to one message.
//!
//! A worker implements [`Worker`] (its constants and `handle`); the runner
//! parses the body, counts, logs and settles. It never branches on queue name
//! or worker type, and the failure path is only `mq::handle_worker_error`.

use std::future::Future;

mod message;
mod prefetch;
mod process;
mod publisher;
mod run;
mod shutdown;
mod totals;

pub use message::EntityQueueMessage;
pub use process::{process_one, Settled};
pub use publisher::{Context, Publisher, PublisherLost};
pub use run::{init, run, Resources};
pub use totals::Totals;

/// What one message came to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    /// An info worker inserted a new row.
    Created,
    /// An info worker updated an existing row.
    Updated,
    /// A fan-out worker published this many messages; 0 is allowed.
    Queued(u64),
    /// A worker wrote the database and also published this many messages.
    /// Unlike `Queued(0)`, publishing nothing is the normal case, not a
    /// warning.
    Saved { queued: u64 },
    /// The worker looked and left the row as it was, e.g. a type with no
    /// Jita orders keeps its last price. Counted apart, never a warning.
    Unchanged,
}

/// What one successful `handle` reports back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Processed {
    pub outcome: Outcome,
    /// The worker's own part of the success line, after the counter.
    pub detail: String,
}

/// One worker: a queue, and what to do with one entity ID from it.
pub trait Worker: Send + Sync + 'static {
    const QUEUE_NAME: &'static str;
    /// The queue a fan-out worker publishes to, declared at connect and
    /// logged at startup. `None` for a worker that only writes the database.
    const OUTPUT_QUEUE: Option<&'static str> = None;
    const CONSUMER_TAG: &'static str;
    /// Logged once at startup.
    const STARTED: &'static str;
    /// The plural in "waiting for ...".
    const WAITING_FOR: &'static str;
    /// The singular in the failure context ("alliance 99000001").
    const ENTITY: &'static str;

    /// Handle one entity: fetch it from ESI, then save it or publish what it
    /// leads to through `ctx`. Errors go down the shared failure path,
    /// except [`PublisherLost`], which leaves the message for redelivery.
    fn handle(
        &self,
        id: i32,
        ctx: &Context<'_>,
    ) -> impl Future<Output = anyhow::Result<Processed>> + Send;

    /// Handle a whole message. The default hands [`Worker::handle`] its ID;
    /// a worker that needs another field of the message (the killmail syncs
    /// read `fullSync`) overrides this instead.
    fn handle_message(
        &self,
        message: &EntityQueueMessage,
        ctx: &Context<'_>,
    ) -> impl Future<Output = anyhow::Result<Processed>> + Send {
        self.handle(message.entity_id, ctx)
    }

    /// The drained-queue summary line.
    /// The unchanged count appears only when there is one, so a worker that
    /// never reports [`Outcome::Unchanged`] keeps its line as it was.
    fn summary(totals: &Totals) -> String {
        let unchanged = match totals.unchanged() {
            0 => String::new(),
            n => format!(", {n} unchanged"),
        };
        format!(
            "📊 final: {} processed ({} created, {} updated{unchanged}, {} errors)",
            totals.processed(),
            totals.created(),
            totals.updated(),
            totals.errors()
        )
    }
}

/// `  ✅ [n]<detail> (created|updated)` for an info worker; for a fan-out
/// worker `  ✅ [n]<detail>`, or `  ⚠️  [n]<detail>` when nothing was queued;
/// for a worker that saves, `  ✅ [n]<detail>` whatever it queued; for one
/// that left the row alone, `  - [n]<detail>`.
pub fn success_line(n: u64, processed: &Processed) -> String {
    let detail = &processed.detail;
    match processed.outcome {
        Outcome::Created => format!("  ✅ [{n}]{detail} (created)"),
        Outcome::Updated => format!("  ✅ [{n}]{detail} (updated)"),
        Outcome::Queued(0) => format!("  ⚠️  [{n}]{detail}"),
        Outcome::Queued(_) | Outcome::Saved { .. } => format!("  ✅ [{n}]{detail}"),
        Outcome::Unchanged => format!("  - [{n}]{detail}"),
    }
}

/// The worker's own queue, then its output queue if it has one.
pub fn queues_to_declare<W: Worker>() -> Vec<&'static str> {
    std::iter::once(W::QUEUE_NAME)
        .chain(W::OUTPUT_QUEUE)
        .collect()
}
