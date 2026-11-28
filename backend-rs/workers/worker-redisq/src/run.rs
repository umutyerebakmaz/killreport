//! The stream loop (spec §1–§3, §7): read the file at our sequence, settle
//! it, move on and save the new position — or wait, skip or back off.
//!
//! The sequence moves only when R2Z2 answered and the answer is settled. A
//! transport error, a 5xx, or a killmail that could be written nowhere is an
//! `Err` from [`Stream::step`]: the position stays, and the same number is
//! read again after [`error_delay`].

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use chrono::{NaiveDateTime, Utc};
use tokio::sync::Notify;
use tracing::{error, info, warn};

use crate::cursor;
use crate::outbox::Outbox;
use crate::process::{Processor, Settled};
use crate::r2z2::{Poll, R2z2};
use crate::stream::{on_found, on_not_found, Gap, Step};

/// After a file was there: drain a backlog at ~10 requests a second, under
/// R2Z2's 15.
pub const BACKLOG_DELAY: Duration = Duration::from_millis(100);
/// After a 404: R2Z2 asks for at least 6 s.
pub const EMPTY_DELAY: Duration = Duration::from_secs(6);
/// After a 403 or 429, and after every fifth error in a row.
pub const RETRY_DELAY: Duration = Duration::from_secs(5);

/// What one step did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tick {
    Settled(Settled),
    /// A 200 with no killmail ID or hash: logged and passed.
    Unreadable,
    /// Nothing new yet.
    Empty,
    /// A missing file given up on.
    Skipped,
    /// The saved number was out of R2Z2's range; now at the head.
    Jumped,
    RateLimited,
}

impl Tick {
    /// How long to wait before the next step.
    pub fn delay(&self) -> Duration {
        match self {
            Self::Empty => EMPTY_DELAY,
            Self::RateLimited => RETRY_DELAY,
            _ => BACKLOG_DELAY,
        }
    }
}

/// The wait after the `consecutive`-th error in a row (counting from 1), as
/// the Node worker waits.
pub fn error_delay(consecutive: u32) -> Duration {
    if consecutive.is_multiple_of(5) {
        RETRY_DELAY
    } else {
        BACKLOG_DELAY
    }
}

pub struct Stream {
    r2z2: R2z2,
    processor: Processor,
    sequence: i64,
    gap: Gap,
}

impl Stream {
    /// From the saved position, or from R2Z2's head when there is none (the
    /// head is saved at once, so a restart before the first killmail does
    /// not start over from a later head).
    pub async fn start(
        r2z2: R2z2,
        processor: Processor,
        now: NaiveDateTime,
    ) -> anyhow::Result<Self> {
        let sequence = match cursor::load(&processor.pool).await? {
            Some(sequence) => {
                info!("📍 resuming at sequence {sequence}");
                sequence
            }
            None => {
                let head = r2z2.head().await?;
                cursor::save(&processor.pool, head, now).await?;
                info!("📍 no saved position: starting at the head, {head}");
                head
            }
        };
        Ok(Self {
            r2z2,
            processor,
            sequence,
            gap: Gap::default(),
        })
    }

    /// The next sequence to read.
    pub fn sequence(&self) -> i64 {
        self.sequence
    }

    async fn move_to(&mut self, sequence: i64, now: NaiveDateTime) -> anyhow::Result<()> {
        cursor::save(&self.processor.pool, sequence, now).await?;
        self.sequence = sequence;
        Ok(())
    }

    pub async fn step(&mut self, outbox: &dyn Outbox, now: NaiveDateTime) -> anyhow::Result<Tick> {
        let current = self.sequence;
        match self.r2z2.get(current).await? {
            Poll::Found(pkg) => {
                let settled = self.processor.process(outbox, &pkg, now).await?;
                on_found(&mut self.gap);
                self.move_to(current + 1, now).await?;
                Ok(Tick::Settled(settled))
            }
            Poll::Unreadable(why) => {
                error!("❌ sequence {current}: unreadable ({why}); skipped");
                on_found(&mut self.gap);
                self.move_to(current + 1, now).await?;
                Ok(Tick::Unreadable)
            }
            Poll::RateLimited => {
                warn!("⚠️  rate limited by R2Z2, backing off");
                Ok(Tick::RateLimited)
            }
            Poll::NotFound => {
                let head = self.r2z2.head().await?;
                match on_not_found(&mut self.gap, current, head) {
                    Step::Wait => Ok(Tick::Empty),
                    Step::Skip(next) => {
                        warn!("⚠️  sequence {current} missing with the head at {head}; skipped");
                        self.move_to(next, now).await?;
                        Ok(Tick::Skipped)
                    }
                    Step::JumpTo(next) => {
                        warn!(
                            "⚠️  sequence {current} is out of R2Z2's range; jumping to the head, {next}"
                        );
                        self.move_to(next, now).await?;
                        Ok(Tick::Jumped)
                    }
                }
            }
        }
    }
}

/// Step until `stop` is set. A step always finishes: the signal is looked at
/// between steps and cuts only the wait.
pub async fn run_forever(
    stream: &mut Stream,
    outbox: &dyn Outbox,
    stop: &AtomicBool,
    stopped: &Notify,
) {
    let mut errors = 0;
    while !stop.load(Ordering::SeqCst) {
        let delay = match stream.step(outbox, Utc::now().naive_utc()).await {
            Ok(tick) => {
                errors = 0;
                tick.delay()
            }
            Err(e) => {
                errors += 1;
                error!(
                    "❌ sequence {} ({errors} in a row): {e:#}",
                    stream.sequence()
                );
                error_delay(errors)
            }
        };
        // A signal that came during the step has no waiter to wake.
        if stop.load(Ordering::SeqCst) {
            break;
        }
        tokio::select! {
            _ = tokio::time::sleep(delay) => {}
            _ = stopped.notified() => {}
        }
    }
    info!("🛑 stopped at sequence {}", stream.sequence());
}
