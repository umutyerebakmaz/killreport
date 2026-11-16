//! Counters for one connection, reset on reconnect.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tokio::time::Instant;

/// Quiet time after which the queue counts as drained.
pub(crate) const QUIET: Duration = Duration::from_secs(5);

pub struct Totals {
    processed: AtomicU64,
    created: AtomicU64,
    updated: AtomicU64,
    errors: AtomicU64,
    queued: AtomicU64,
    last_message: Mutex<Instant>,
}

impl Default for Totals {
    fn default() -> Self {
        Self::new()
    }
}

impl Totals {
    pub fn new() -> Self {
        Self {
            processed: AtomicU64::new(0),
            created: AtomicU64::new(0),
            updated: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            queued: AtomicU64::new(0),
            last_message: Mutex::new(Instant::now()),
        }
    }

    pub fn processed(&self) -> u64 {
        self.processed.load(Ordering::SeqCst)
    }
    pub fn created(&self) -> u64 {
        self.created.load(Ordering::SeqCst)
    }
    pub fn updated(&self) -> u64 {
        self.updated.load(Ordering::SeqCst)
    }
    pub fn errors(&self) -> u64 {
        self.errors.load(Ordering::SeqCst)
    }
    /// Messages a fan-out worker published.
    pub fn queued(&self) -> u64 {
        self.queued.load(Ordering::SeqCst)
    }

    pub(crate) fn touch(&self) {
        *self.last_message.lock().unwrap() = Instant::now();
    }
    pub(crate) fn count_processed(&self) {
        self.processed.fetch_add(1, Ordering::SeqCst);
    }
    pub(crate) fn count_created(&self) {
        self.created.fetch_add(1, Ordering::SeqCst);
    }
    pub(crate) fn count_updated(&self) {
        self.updated.fetch_add(1, Ordering::SeqCst);
    }
    pub(crate) fn count_error(&self) {
        self.errors.fetch_add(1, Ordering::SeqCst);
    }
    pub(crate) fn count_queued(&self, n: u64) {
        self.queued.fetch_add(n, Ordering::SeqCst);
    }

    /// Once 5 s have passed since the last message and at least one was
    /// processed, the summary is due.
    pub(crate) fn summary_due(&self) -> bool {
        let quiet = self.last_message.lock().unwrap().elapsed() > QUIET;
        quiet && self.processed() > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn a_summary_is_due_only_after_quiet_time_with_work_done() {
        let totals = Totals::new();
        assert!(!totals.summary_due());

        totals.touch();
        totals.count_processed();
        tokio::time::advance(Duration::from_secs(4)).await;
        assert!(!totals.summary_due());
        tokio::time::advance(Duration::from_secs(2)).await;
        assert!(totals.summary_due());
    }

    #[test]
    fn queued_messages_add_up() {
        let totals = Totals::new();
        assert_eq!(totals.queued(), 0);
        totals.count_queued(12);
        totals.count_queued(0);
        totals.count_queued(3);
        assert_eq!(totals.queued(), 15);
    }

    #[tokio::test(start_paused = true)]
    async fn no_summary_is_due_when_nothing_was_processed() {
        let totals = Totals::new();
        tokio::time::advance(Duration::from_secs(10)).await;
        assert!(!totals.summary_due());
    }
}
