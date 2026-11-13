//! The failure path every worker shares: the port of
//! `backend/src/workers/worker-error.ts`.

use std::future::Future;
use std::sync::LazyLock;
use std::time::Duration;

use esi::{EsiError, EsiThrottled};
use lapin::types::{AMQPValue, FieldTable};
use regex::Regex;

/// How many times a message may be delivered before it is parked: deliveries
/// 1 through 4 retry, delivery 5 parks (`worker-error.ts:6-15`).
pub const MAX_ATTEMPTS: u32 = 5;

/// What a non-ESI throttle waits before requeueing (`worker-error.ts:181`).
const NON_ESI_THROTTLE_WAIT: Duration = Duration::from_secs(60);

// `[0-9]` is not needed here; `\b` and the literal digits are ASCII already.
static THROTTLE_STATUS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\b(420|429)\b").unwrap());
static NOT_FOUND: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\b404\b").unwrap());
static FORBIDDEN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\b403\b").unwrap());

/// A failed HTTP call that did not go through the ESI client, for callers
/// such as zKillboard that have a status but no `EsiError`. The Node path
/// reads `error.response.status`; this is that shape.
#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct HttpStatusError {
    pub status: u16,
    pub message: String,
}

/// One delivery, and the three ways to settle it. The real one is a lapin
/// channel and delivery; the tests' one records what it was asked to do.
pub trait Settle {
    fn headers(&self) -> Option<&FieldTable>;
    fn body(&self) -> &[u8];
    fn ack(&self) -> impl Future<Output = Result<(), lapin::Error>> + Send;
    fn nack(&self, requeue: bool) -> impl Future<Output = Result<(), lapin::Error>> + Send;
    /// Publish this body and these headers to the parking queue.
    fn park(&self) -> impl Future<Output = Result<(), lapin::Error>> + Send;
}

/// Where the failure path writes; the worker adds which message it was
/// (`worker-info-alliances.ts:146-149`).
pub trait WorkerLog {
    fn warn(&self, message: &str);
    fn error(&self, message: &str, error: &anyhow::Error);
}

/// How many times the broker has already dead-lettered this message.
///
/// RabbitMQ writes `x-death` on every dead-letter hop, so the counter comes
/// for free and the message body never has to carry one. A first delivery has
/// no `x-death` at all, which is 0 (`worker-error.ts:27-42`).
pub fn death_count(headers: Option<&FieldTable>) -> u32 {
    let Some(AMQPValue::FieldArray(deaths)) = headers.and_then(|h| h.inner().get("x-death")) else {
        return 0;
    };
    let Some(AMQPValue::FieldTable(first)) = deaths.as_slice().first() else {
        return 0;
    };
    match first.inner().get("count") {
        Some(AMQPValue::LongLongInt(n)) => u32::try_from(*n).unwrap_or(0),
        Some(AMQPValue::LongInt(n)) => u32::try_from(*n).unwrap_or(0),
        Some(AMQPValue::LongUInt(n)) => *n,
        Some(AMQPValue::ShortInt(n)) => u32::try_from(*n).unwrap_or(0),
        Some(AMQPValue::ShortUInt(n)) => u32::from(*n),
        Some(AMQPValue::ShortShortInt(n)) => u32::try_from(*n).unwrap_or(0),
        Some(AMQPValue::ShortShortUInt(n)) => u32::from(*n),
        _ => 0,
    }
}

/// The ESI client's throttle, wherever it sits in the error.
fn esi_throttled(error: &anyhow::Error) -> Option<&EsiThrottled> {
    error
        .downcast_ref::<EsiThrottled>()
        .or_else(|| match error.downcast_ref::<EsiError>() {
            Some(EsiError::Throttled(throttled)) => Some(throttled),
            _ => None,
        })
}

/// A status carried as a field, the way `error.response.status` is in Node.
fn status_of(error: &anyhow::Error) -> Option<u16> {
    if let Some(esi) = error.downcast_ref::<EsiError>() {
        return esi.status();
    }
    error.downcast_ref::<HttpStatusError>().map(|e| e.status)
}

/// The first line of the error's message, which is where a status belongs.
///
/// A database error can carry a code frame with line numbers below its first
/// line; matching the whole text would read "line 404" as a missing record or
/// "line 429" as a rate limit, and an unrelated edit that shifts line numbers
/// would be enough to trigger it (#235).
fn message_head(error: &anyhow::Error) -> String {
    error
        .to_string()
        .lines()
        .next()
        .unwrap_or_default()
        .to_owned()
}

/// 420 or 429 from anything but the ESI client, else `None`.
fn throttle_status(error: &anyhow::Error) -> Option<u16> {
    if let Some(status @ (420 | 429)) = status_of(error) {
        return Some(status);
    }
    THROTTLE_STATUS
        .captures(&message_head(error))
        .and_then(|caps| caps[1].parse().ok())
}

fn is_not_found(error: &anyhow::Error) -> bool {
    status_of(error) == Some(404) || NOT_FOUND.is_match(&message_head(error))
}

/// True for a 403. Only recognises it: whether a 403 is permanent depends on
/// the caller, so `handle_worker_error` routes it like any other failure
/// (`worker-error.ts:100-118`).
pub fn is_forbidden(error: &anyhow::Error) -> bool {
    status_of(error) == Some(403) || FORBIDDEN.is_match(&message_head(error))
}

/// Settle a failed delivery: exactly one ack or nack on every path
/// (`worker-error.ts:130-216`).
pub async fn handle_worker_error(
    settle: &impl Settle,
    queue: &str,
    error: &anyhow::Error,
    log: &impl WorkerLog,
) -> Result<(), lapin::Error> {
    // The ESI client already put the brake in the limiter when it returned
    // this, so there is nothing to sleep for here: requeue at once, untouched,
    // and the message waits in the limiter's brake when it comes back. Being
    // throttled is not a defect in the message, so no attempt is burnt.
    if let Some(throttled) = esi_throttled(error) {
        log.warn(&format!("⏸ esi throttled ({}), requeueing", throttled.kind));
        return settle.nack(true).await;
    }

    // 420/429 from anything else: wait, requeue untouched, burn no attempt.
    if let Some(status) = throttle_status(error) {
        log.warn(if status == 420 {
            "🛑 error limited (420)! waiting 60 seconds..."
        } else {
            "🛑 rate limited (429)! waiting 60 seconds..."
        });
        tokio::time::sleep(NON_ESI_THROTTLE_WAIT).await;
        return settle.nack(true).await;
    }

    // 404: the id names nothing. Retrying cannot make it exist.
    if is_not_found(error) {
        log.warn(&format!("  ! {queue}: not found (404), skipping"));
        return settle.ack().await;
    }

    let attempt_number = death_count(settle.headers()) + 1;
    if attempt_number >= MAX_ATTEMPTS {
        log.error(
            &format!("☠️  {queue}: giving up after {MAX_ATTEMPTS} attempts, parking"),
            error,
        );
        // The origin stays readable in the parked message's own x-death
        // header, which is why the headers ride along.
        settle.park().await?;
        return settle.ack().await;
    }

    log.error(
        &format!("❌ {queue}: attempt {attempt_number}/{MAX_ATTEMPTS} failed"),
        error,
    );
    // requeue: false is the whole mechanism: the message goes to
    // killreport.dlx, which fans it into killreport.wait, whose TTL returns it
    // here through killreport.retry with x-death incremented.
    settle.nack(false).await
}
