//! The reusable half of an info worker: what happens to one message.
//!
//! A worker implements [`Worker`] (its constants and `handle`); the runner
//! parses the body, counts, logs and settles. It never branches on queue name
//! or worker type, and the failure path is only `mq::handle_worker_error`.

use std::future::Future;

mod message;
mod process;
mod totals;

pub use message::EntityQueueMessage;
pub use process::process_one;
pub use totals::Totals;

/// What one successful `handle` reports back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Processed {
    /// True when the row was created, false when an existing one was updated.
    pub inserted: bool,
    /// The worker's own part of the success line, after the counter.
    pub detail: String,
}

/// One info worker: a queue, and what to do with one entity ID from it.
pub trait Worker: Send + Sync + 'static {
    const QUEUE_NAME: &'static str;
    const PREFETCH_COUNT: u16;
    const CONSUMER_TAG: &'static str;
    /// Logged once at startup.
    const STARTED: &'static str;
    /// The plural in "waiting for ...".
    const WAITING_FOR: &'static str;
    /// The singular in the failure context ("alliance 99000001").
    const ENTITY: &'static str;

    /// Fetch the entity from ESI and save it. Errors go down the shared
    /// failure path.
    fn handle(&self, id: i32) -> impl Future<Output = anyhow::Result<Processed>> + Send;
}

/// `  ✅ [n]<detail> (created|updated)`.
pub fn success_line(n: u64, processed: &Processed) -> String {
    format!(
        "  ✅ [{n}]{} ({})",
        processed.detail,
        if processed.inserted {
            "created"
        } else {
            "updated"
        }
    )
}
