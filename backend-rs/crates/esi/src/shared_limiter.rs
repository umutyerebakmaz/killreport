//! The in-process side of the shared ESI limiter: the Rust port of
//! `backend/src/services/esi-limiter/shared-rate-limiter.ts`.
//!
//! The shared Redis budget (`shared::SharedStore`) decides; this module keeps
//! what has to stay in the process: the queue of waiting callers, the
//! `max_wait` rejection, the in-flight ceiling and the log lines. The head
//! waiter asks the store for a slot; a `group` answer parks it on its own
//! timer so it never holds up other routes, a `brake` or `rate` answer sleeps
//! at most `MAX_SLEEP_MS` (plus jitter) and asks again, so a brake set by
//! another process is seen within one sleep.
//!
//! Every store call, connection setup included, has `STORE_TIMEOUT_MS` to
//! answer. An error or a timeout switches the process to local mode: every
//! acquire and observe goes to the per-process limiter, as before the shared
//! limiter, and one acquire every `REDIS_RETRY_MS` tries Redis again.
//!
//! Rust workers never set a priority: every acquire asks as `Priority::Bulk`.

use std::collections::hash_map::RandomState;
use std::collections::{HashMap, VecDeque};
use std::future::Future;
use std::hash::{BuildHasher, Hasher};
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use tokio::sync::oneshot;
use tokio::task::AbortHandle;
use tokio::time::Instant;

use crate::limiter::{EsiRoute, Permit, RateLimiter};
use crate::route::{parse_limit, route_template, seconds};
use crate::shared::{
    AcquireOutcome, ObserveInput, ObserveOutcome, Priority, SharedStore, WaitReason,
};
use crate::throttled::{EsiThrottled, ThrottleKind};

/// How long a store call may take before the process goes local.
pub const STORE_TIMEOUT_MS: u64 = 200;
/// In local mode, how often one acquire tries Redis again.
pub const REDIS_RETRY_MS: u64 = 10_000;
/// Longest single sleep on a `brake` or `rate` answer before asking again.
pub const MAX_SLEEP_MS: f64 = 1_000.0;
/// Random 0..MAX_JITTER_MS ms added to that sleep, so waiters spread out.
pub const MAX_JITTER_MS: f64 = 50.0;

/// warn, once per switch: `{LOG_REDIS_UNREACHABLE} (<error>); retrying every 10 s`
pub const LOG_REDIS_UNREACHABLE: &str =
    "⚠️  ESI limiter: Redis unreachable, using the per-process limiter";
/// info, once per switch back.
pub const LOG_REDIS_BACK: &str = "✅ ESI limiter: Redis is back, using the shared limiter";

/// What a store call returns; the error is its message.
pub type StoreFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, String>> + Send + 'a>>;

/// The two calls the limiter makes on the shared store. `SharedStore` is the
/// real one; tests use a fake (`LimiterStore` in the Node spec).
pub trait LimiterStore: Send + Sync + 'static {
    fn acquire<'a>(
        &'a self,
        priority: Priority,
        template: &'a str,
        bucket_key: &'a str,
    ) -> StoreFuture<'a, AcquireOutcome>;

    fn observe<'a>(&'a self, input: &'a ObserveInput) -> StoreFuture<'a, ObserveOutcome>;
}

impl LimiterStore for SharedStore {
    fn acquire<'a>(
        &'a self,
        priority: Priority,
        template: &'a str,
        bucket_key: &'a str,
    ) -> StoreFuture<'a, AcquireOutcome> {
        Box::pin(async move {
            SharedStore::acquire(self, priority, template, bucket_key, None)
                .await
                .map_err(|e| e.to_string())
        })
    }

    fn observe<'a>(&'a self, input: &'a ObserveInput) -> StoreFuture<'a, ObserveOutcome> {
        Box::pin(async move {
            SharedStore::observe(self, input, None)
                .await
                .map_err(|e| e.to_string())
        })
    }
}

/// The same text the local limiter logs for a brake it sets.
pub fn brake_log(status: u16, kind: ThrottleKind, ms: f64, rate: f64) -> String {
    format!(
        "⏸️  ESI {status} ({kind}): pausing all requests for {} s, rate {rate} req/s",
        (ms / 1000.0).round()
    )
}

/// The same text the local limiter logs for a group pause it sets.
pub fn group_pause_log(key: &str, ms: f64) -> String {
    format!(
        "⏸️  ESI 429 (rate-limit): pausing group {key} for {} s",
        (ms / 1000.0).round()
    )
}

/// A response's throttling headers as the store wants them: numbers, and a
/// field left out when its header is absent, blank or not a number. Keys are
/// lowercase.
pub fn observe_input(
    route: &EsiRoute,
    status: u16,
    headers: &HashMap<String, String>,
) -> ObserveInput {
    let header = |name: &str| headers.get(name).map(String::as_str);
    let number = |name: &str| {
        let value = header(name)?.trim();
        if value.is_empty() {
            return None;
        }
        value.parse::<f64>().ok().filter(|n| n.is_finite())
    };
    let limit = parse_limit(header("x-ratelimit-limit"));
    ObserveInput {
        template: route_template(&route.path),
        bucket_key: route.bucket_key.clone().unwrap_or_default(),
        status,
        group: header("x-ratelimit-group")
            .filter(|group| !group.is_empty())
            .map(str::to_owned),
        limit: limit.map(|(limit, _)| f64::from(limit)),
        window_ms: limit.map(|(_, window)| window.as_millis() as f64),
        remaining: number("x-ratelimit-remaining"),
        error_remain: number("x-esi-error-limit-remain"),
        error_reset_ms: seconds(header("x-esi-error-limit-reset")),
        retry_after_ms: seconds(header("retry-after")),
    }
}

type Grant = Result<Permit, EsiThrottled>;

struct Waiter {
    id: u64,
    route: EsiRoute,
    tx: oneshot::Sender<Grant>,
    /// The caller's max wait, and the absolute time it runs out.
    max_wait_ms: Option<f64>,
    deadline: Option<f64>,
    /// `<group>:<bucketKey>` while parked on a group wait.
    group_key: Option<String>,
}

struct State {
    shared: bool,
    /// In local mode, when an acquire may next try Redis.
    retry_at: f64,
    queue: VecDeque<Waiter>,
    parked: HashMap<u64, (Waiter, AbortHandle)>,
    next_id: u64,
    processing: bool,
}

pub(crate) struct SharedLimiter {
    store: Arc<dyn LimiterStore>,
    local: RateLimiter,
    redis_url: Option<String>,
    epoch: Instant,
    // The process's own socket ceiling, not an ESI rule; as in the local limiter.
    max_concurrent: usize,
    spacing_ms: f64,
    /// Slots the store granted and not yet dropped. Local slots count on the
    /// local limiter, so each permit goes back where it came from.
    in_flight: Arc<AtomicUsize>,
    state: Mutex<State>,
}

impl std::fmt::Debug for SharedLimiter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SharedLimiter")
            .field("redis_url", &self.redis_url.as_ref().map(|_| "<set>"))
            .finish_non_exhaustive()
    }
}

fn throttled_message(wait_ms: f64, kind: ThrottleKind, max_wait_ms: f64) -> String {
    format!(
        "ESI is throttled for another {} s ({kind}), longer than the {max_wait_ms} ms this caller waits",
        (wait_ms / 1000.0).ceil()
    )
}

fn brake_error(status: u16, kind: ThrottleKind, wait_ms: f64, max_wait_ms: f64) -> EsiThrottled {
    EsiThrottled::new(status, kind, throttled_message(wait_ms, kind, max_wait_ms))
}

fn group_error(key: &str, wait_ms: f64, max_wait_ms: f64) -> EsiThrottled {
    EsiThrottled::new(
        429,
        ThrottleKind::RateLimit,
        format!(
            "ESI group {key} is throttled for another {} s, longer than the {max_wait_ms} ms this caller waits",
            (wait_ms / 1000.0).ceil()
        ),
    )
}

/// A brake's detail is `<status>:<kind>`, e.g. `420:error-limit`. One that
/// does not name a known kind is read as the deep limit, 429.
fn brake_detail(detail: &str) -> (u16, ThrottleKind) {
    let mut parts = detail.split(':');
    let status = parts.next().unwrap_or_default();
    let kind = match parts.next() {
        Some("error-limit") => ThrottleKind::ErrorLimit,
        Some("rate-limit") => ThrottleKind::RateLimit,
        Some("deep-limit") => ThrottleKind::DeepLimit,
        _ => return (429, ThrottleKind::DeepLimit),
    };
    (if status == "420" { 420 } else { 429 }, kind)
}

fn wait_error(wait_ms: f64, reason: WaitReason, detail: &str, max_wait_ms: f64) -> EsiThrottled {
    match reason {
        WaitReason::Group => group_error(detail, wait_ms, max_wait_ms),
        WaitReason::Brake => {
            let (status, kind) = brake_detail(detail);
            brake_error(status, kind, wait_ms, max_wait_ms)
        }
        // The shared bucket refills at the rate a header-less 429 lowered.
        WaitReason::Rate => EsiThrottled::new(
            429,
            ThrottleKind::DeepLimit,
            format!(
                "ESI shared rate has no slot for another {wait_ms} ms, longer than the {max_wait_ms} ms this caller waits"
            ),
        ),
    }
}

/// 0..MAX_JITTER_MS. Each `RandomState` is freshly keyed, which is random
/// enough to spread sleepers out and needs no dependency.
fn jitter_ms() -> f64 {
    let bits = RandomState::new().build_hasher().finish() >> 11;
    bits as f64 / (1u64 << 53) as f64 * MAX_JITTER_MS
}

fn sleep_ms(ms: f64) -> tokio::time::Sleep {
    tokio::time::sleep(Duration::from_secs_f64(ms.max(0.0) / 1000.0))
}

/// Race a store call against `STORE_TIMEOUT_MS`.
async fn with_timeout<T>(call: StoreFuture<'_, T>) -> Result<T, String> {
    match tokio::time::timeout(Duration::from_millis(STORE_TIMEOUT_MS), call).await {
        Ok(result) => result,
        Err(_) => Err(format!("no answer in {STORE_TIMEOUT_MS} ms")),
    }
}

impl SharedLimiter {
    pub(crate) fn new(
        store: Arc<dyn LimiterStore>,
        local: RateLimiter,
        max_requests_per_second: f64,
        redis_url: Option<String>,
    ) -> Self {
        Self {
            store,
            local,
            redis_url,
            epoch: Instant::now(),
            max_concurrent: 50.max(max_requests_per_second as usize),
            spacing_ms: 1f64.max((1000.0 / max_requests_per_second).floor()),
            in_flight: Arc::new(AtomicUsize::new(0)),
            state: Mutex::new(State {
                shared: true,
                retry_at: 0.0,
                queue: VecDeque::new(),
                parked: HashMap::new(),
                next_id: 0,
                processing: false,
            }),
        }
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().expect("shared limiter state poisoned")
    }

    fn now(&self) -> f64 {
        self.epoch.elapsed().as_millis() as f64
    }

    pub(crate) fn is_shared(&self) -> bool {
        self.lock().shared
    }

    pub(crate) fn redis_url(&self) -> Option<&str> {
        self.redis_url.as_deref()
    }

    /// Waiting acquires, parked ones included.
    pub(crate) fn waiting(&self) -> usize {
        let state = self.lock();
        state.queue.len() + state.parked.len()
    }

    pub(crate) fn acquire(
        self: &Arc<Self>,
        route: &EsiRoute,
        max_wait: Option<Duration>,
    ) -> Pin<Box<dyn Future<Output = Grant> + Send>> {
        let now = self.now();
        let mut state = self.lock();
        if !state.shared {
            if now < state.retry_at {
                drop(state);
                return Box::pin(self.local.acquire_local(route, max_wait));
            }
            // This acquire tries Redis; the others keep going local meanwhile.
            state.retry_at = now + REDIS_RETRY_MS as f64;
        }

        let (tx, rx) = oneshot::channel();
        let max_wait_ms = max_wait.map(|wait| wait.as_millis() as f64);
        let id = state.next_id;
        state.next_id += 1;
        state.queue.push_back(Waiter {
            id,
            route: route.clone(),
            tx,
            max_wait_ms,
            deadline: max_wait_ms.map(|ms| now + ms),
            group_key: None,
        });
        self.start(&mut state);
        drop(state);

        Box::pin(async move {
            rx.await
                .expect("the shared limiter settles every waiter before dropping it")
        })
    }

    /// Start the queue task if it is not already running.
    fn start(self: &Arc<Self>, state: &mut State) {
        if state.processing || state.queue.is_empty() {
            return;
        }
        state.processing = true;
        let this = Arc::clone(self);
        tokio::spawn(async move { this.process_queue().await });
    }

    /// `processQueue`: ask the store for the head waiter until the queue is
    /// empty.
    async fn process_queue(self: Arc<Self>) {
        loop {
            let (id, template, bucket_key) = {
                let mut state = self.lock();
                let Some(head) = state.queue.front() else {
                    state.processing = false;
                    return;
                };
                if self.in_flight.load(Ordering::SeqCst) < self.max_concurrent {
                    (
                        Some(head.id),
                        route_template(&head.route.path),
                        head.route.bucket_key.clone().unwrap_or_default(),
                    )
                } else {
                    (None, String::new(), String::new())
                }
            };
            let Some(id) = id else {
                sleep_ms(self.spacing_ms).await;
                continue;
            };

            let reply =
                with_timeout(self.store.acquire(Priority::Bulk, &template, &bucket_key)).await;

            let sleep_for = {
                let mut state = self.lock();
                let reply = match reply {
                    Ok(reply) => reply,
                    Err(reason) => {
                        self.enter_local(&mut state, &reason);
                        continue;
                    }
                };
                // Handed to the local limiter, or rejected by an observe,
                // while the store was answering.
                if state.queue.front().map(|waiter| waiter.id) != Some(id) {
                    continue;
                }
                if !state.shared {
                    state.shared = true;
                    tracing::info!("{LOG_REDIS_BACK}");
                }

                let (wait_ms, reason, detail) = match reply {
                    AcquireOutcome::Granted => {
                        let waiter = state.queue.pop_front().expect("head checked above");
                        // If the caller has gone, the permit comes back and is
                        // dropped here, which gives the slot back.
                        let _ = waiter.tx.send(Ok(Permit::take(&self.in_flight)));
                        continue;
                    }
                    AcquireOutcome::Wait {
                        wait_ms,
                        reason,
                        detail,
                    } => (wait_ms, reason, detail),
                };

                let now = self.now();
                let head = state.queue.front().expect("head checked above");
                if head
                    .deadline
                    .is_some_and(|deadline| now + wait_ms > deadline)
                {
                    let waiter = state.queue.pop_front().expect("head checked above");
                    let max_wait_ms = waiter.max_wait_ms.expect("a deadline has a max wait");
                    let _ = waiter
                        .tx
                        .send(Err(wait_error(wait_ms, reason, &detail, max_wait_ms)));
                    continue;
                }
                if reason == WaitReason::Group {
                    let waiter = state.queue.pop_front().expect("head checked above");
                    self.park(&mut state, waiter, wait_ms, detail);
                    continue;
                }
                wait_ms.min(MAX_SLEEP_MS) + jitter_ms()
            };
            sleep_ms(sleep_for).await;
        }
    }

    /// Off the queue until its group wait is over, then back to ask again.
    fn park(self: &Arc<Self>, state: &mut State, mut waiter: Waiter, wait_ms: f64, key: String) {
        waiter.group_key = Some(key);
        let id = waiter.id;
        let this = Arc::clone(self);
        let delay = Duration::from_millis(wait_ms.max(0.0).ceil() as u64);
        let timer = tokio::spawn(async move {
            tokio::time::sleep(delay).await;
            let mut state = this.lock();
            if let Some((mut waiter, _)) = state.parked.remove(&id) {
                waiter.group_key = None;
                state.queue.push_back(waiter);
                this.start(&mut state);
            }
        });
        state.parked.insert(id, (waiter, timer.abort_handle()));
    }

    pub(crate) async fn observe(
        self: &Arc<Self>,
        route: &EsiRoute,
        status: u16,
        headers: &HashMap<String, String>,
    ) {
        if !self.is_shared() {
            self.local.observe_local(route, status, headers);
            return;
        }
        let input = observe_input(route, status, headers);
        let outcome = match with_timeout(self.store.observe(&input)).await {
            Ok(outcome) => outcome,
            Err(reason) => {
                self.enter_local(&mut self.lock(), &reason);
                self.local.observe_local(route, status, headers);
                return;
            }
        };

        // The store returns a brake or a group pause only to the process that
        // set it, so each is logged once across every process.
        let now = self.now();
        let mut state = self.lock();
        if let Some((ms, status, kind)) = outcome.brake {
            tracing::warn!("{}", brake_log(status, kind, ms, outcome.rate));
            reject_waiters_before(
                &mut state,
                now + ms,
                |_| true,
                |max_wait_ms| brake_error(status, kind, ms, max_wait_ms),
            );
        }
        if let Some((key, ms)) = &outcome.group_pause {
            tracing::warn!("{}", group_pause_log(key, *ms));
            reject_waiters_before(
                &mut state,
                now + ms,
                |waiter| waiter.group_key.as_deref() == Some(key.as_str()),
                |max_wait_ms| group_error(key, *ms, max_wait_ms),
            );
        }
    }

    /// Go local, or stay local after a failed retry; hand every waiter over.
    fn enter_local(&self, state: &mut State, reason: &str) {
        let now = self.now();
        state.retry_at = now + REDIS_RETRY_MS as f64;
        if state.shared {
            state.shared = false;
            tracing::warn!(
                "{LOG_REDIS_UNREACHABLE} ({reason}); retrying every {} s",
                REDIS_RETRY_MS / 1000
            );
        }

        let mut waiters: Vec<Waiter> = state.queue.drain(..).collect();
        for (_, (waiter, timer)) in state.parked.drain() {
            timer.abort();
            waiters.push(waiter);
        }
        for waiter in waiters {
            let remaining = waiter
                .deadline
                .map(|deadline| Duration::from_millis((deadline - now).max(0.0) as u64));
            let acquire = self.local.acquire_local(&waiter.route, remaining);
            tokio::spawn(async move {
                let _ = waiter.tx.send(acquire.await);
            });
        }
    }
}

/// Reject every waiter `applies` picks whose deadline falls before `until`.
fn reject_waiters_before(
    state: &mut State,
    until: f64,
    applies: impl Fn(&Waiter) -> bool,
    error: impl Fn(f64) -> EsiThrottled,
) {
    let expires = |waiter: &Waiter| {
        waiter.deadline.is_some_and(|deadline| deadline < until) && applies(waiter)
    };
    let reject = |waiter: Waiter| {
        let max_wait_ms = waiter.max_wait_ms.expect("a deadline has a max wait");
        let _ = waiter.tx.send(Err(error(max_wait_ms)));
    };

    let queue = std::mem::take(&mut state.queue);
    for waiter in queue {
        if expires(&waiter) {
            reject(waiter);
        } else {
            state.queue.push_back(waiter);
        }
    }
    let expired: Vec<u64> = state
        .parked
        .iter()
        .filter(|(_, (waiter, _))| expires(waiter))
        .map(|(id, _)| *id)
        .collect();
    for id in expired {
        if let Some((waiter, timer)) = state.parked.remove(&id) {
            timer.abort();
            reject(waiter);
        }
    }
}
