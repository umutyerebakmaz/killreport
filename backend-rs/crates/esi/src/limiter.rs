//! The ESI rate limiter: a port of `backend/src/services/rate-limiter.ts`.
//!
//! ESI runs two separate limit systems, and both speak through response
//! headers:
//! - Error limit: at most 100 non-2xx/3xx responses a minute on routes that
//!   have not moved to the new system. Past that, EVERY route answers 420.
//!   Reported in X-ESI-Error-Limit-Remain / X-ESI-Error-Limit-Reset.
//! - Token buckets per route group (X-Ratelimit-Group and friends). Handled by
//!   the group buckets; a grouped 429 never stops the whole process.
//!
//! Some routes also sit behind a deeper server limiter that answers 429 with
//! no group header and an unpublished threshold.
//!
//! `observe` reads every response. A 420, a low error budget or a header-less
//! 429 sets a process-wide brake (`paused_until`), and a header-less 429 also
//! cuts the dispatch rate by a quarter, which climbs back +1 req/s per 10 s
//! (AIMD).
//!
//! A response that carries X-Ratelimit-Group teaches the limiter which group
//! its route template belongs to, and records that bucket's limit and
//! remaining tokens. Below 20% remaining the group's requests go at the pace
//! the bucket refills; below one 2xx's worth they wait for a token to come
//! back; a grouped 429 pauses only that group (and bucket key) for
//! Retry-After. A request waiting on its bucket leaves the queue and re-enters
//! on its own timer, so it never holds up other routes.
//!
//! The base ceiling is per PROCESS and comes from ESI_MAX_RPS (default 50).
//!
//! # How the port maps the JavaScript
//!
//! Time is kept as `f64` milliseconds since the limiter was created, so the
//! arithmetic reads line for line like the original, `NaN` ("no value yet")
//! and `-Infinity` ("never") included: both behave the same in Rust's `f64`
//! comparisons. The one place the two differ is `max` with a NaN operand, and
//! no `max` below ever sees one.
//!
//! In JavaScript `acquire` enqueues synchronously and `processQueue` runs
//! synchronously up to its first `await`, so the first slot is granted inside
//! `acquire`. Here `acquire` and `observe` do the same: they run the queue
//! under the lock until it has to wait, and only the waiting is handed to a
//! spawned task.

use std::collections::{HashMap, VecDeque};
use std::future::Future;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use tokio::sync::oneshot;
use tokio::task::AbortHandle;
use tokio::time::Instant;

use crate::route::{parse_limit, route_template, seconds};
use crate::throttled::{EsiThrottled, ThrottleKind};

const ERROR_LIMIT_FLOOR: f64 = 20.0;
const DEFAULT_PAUSE_MS: f64 = 60_000.0;
/// Brake for a header-less 429 that sends no Retry-After.
const DEEP_LIMIT_PAUSE_MS: f64 = 15_000.0;
/// Share of the rate kept after a header-less 429.
const RATE_DECREASE: f64 = 0.75;
const MAX_PAUSE_MS: f64 = 15.0 * 60_000.0;
const RATE_CLIMB_INTERVAL_MS: f64 = 10_000.0;
/// Below this share of the limit, a group's requests are spaced out.
const LOW_TOKEN_SHARE: f64 = 0.2;
/// Tokens a 2xx costs; the unit the spacing is measured in.
const SUCCESS_TOKEN_COST: f64 = 2.0;

/// A request path and, for authenticated grouped routes, whose bucket it draws on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EsiRoute {
    /// e.g. `/killmails/123/abc.../`; a query string is allowed.
    pub path: String,
    /// Separates per-character buckets; `None` for public routes.
    pub bucket_key: Option<String>,
}

impl EsiRoute {
    pub fn new(path: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            bucket_key: None,
        }
    }

    pub fn with_bucket_key(path: impl Into<String>, bucket_key: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            bucket_key: Some(bucket_key.into()),
        }
    }
}

/// What `stats` reports (`getStats`).
#[derive(Debug, Clone, PartialEq)]
pub struct LimiterStats {
    /// Waiting acquires, including grouped ones waiting out their bucket.
    pub queue_length: usize,
    pub current_rate: u32,
    /// When the process-wide brake ends; `None` if it was never set.
    pub paused_until: Option<Instant>,
    pub max_requests_per_second: u32,
}

/// A dispatch slot. It counts as in flight until it is dropped, which is what
/// `release()` did in JavaScript; a slot cannot be leaked by forgetting it.
#[derive(Debug)]
pub struct Permit {
    inner: Arc<Inner>,
}

impl Drop for Permit {
    fn drop(&mut self) {
        self.inner.in_flight.fetch_sub(1, Ordering::SeqCst);
    }
}

/// The last known state of one route group's token bucket.
#[derive(Debug, Clone)]
struct Bucket {
    /// NaN until a response has carried X-Ratelimit-Limit.
    limit: f64,
    window_ms: f64,
    /// NaN until a response has carried X-Ratelimit-Remaining.
    remaining: f64,
    /// When `remaining` was last read from a response.
    updated_at: f64,
    /// When this bucket last had a request dispatched.
    sent_at: f64,
    /// Earliest dispatch the spacing allows; kept by `respace`.
    next_allowed_at: f64,
    /// Set by a grouped 429.
    paused_until: f64,
}

struct Waiter {
    tx: oneshot::Sender<Result<Permit, EsiThrottled>>,
    /// Absolute time past which an acquire with a maximum wait gives up.
    deadline: Option<f64>,
    route: EsiRoute,
}

struct State {
    queue: VecDeque<Waiter>,
    processing: bool,
    request_count: u32,
    window_start: f64,

    // Process-wide brake, and what set it, for the max-wait rejection.
    paused_until: f64,
    pause_status: u16,
    pause_kind: ThrottleKind,

    // AIMD: the rate right after the last decrease, and when that happened.
    rate_base: f64,
    lowered_at: f64,

    // Route template → group, learnt from responses; group:bucketKey → bucket.
    groups: HashMap<String, String>,
    buckets: HashMap<String, Bucket>,
    // Grouped acquires waiting out their bucket, off the queue, with the
    // timer that puts them back on it.
    parked: HashMap<u64, (Waiter, AbortHandle)>,
    next_parked_id: u64,
}

struct Inner {
    epoch: Instant,
    max_requests_per_second: f64,
    // In-flight cap has to scale with the rate, or it becomes the real ceiling.
    max_concurrent: usize,
    // Outside the lock so a `Permit` can be dropped while the lock is held.
    in_flight: AtomicUsize,
    state: Mutex<State>,
}

impl std::fmt::Debug for Inner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Inner")
            .field("max_requests_per_second", &self.max_requests_per_second)
            .finish_non_exhaustive()
    }
}

/// What the queue needs next once it has done everything it can right now.
enum Next {
    Idle,
    SleepMs(f64),
}

/// The ESI rate limiter. Cheap to clone; clones share one limiter.
#[derive(Clone, Debug)]
pub struct RateLimiter {
    inner: Arc<Inner>,
}

impl RateLimiter {
    pub fn new(max_requests_per_second: u32) -> Self {
        assert!(max_requests_per_second > 0, "ESI_MAX_RPS must be positive");
        let max = f64::from(max_requests_per_second);
        Self {
            inner: Arc::new(Inner {
                epoch: Instant::now(),
                max_requests_per_second: max,
                max_concurrent: 50.max(max_requests_per_second as usize),
                in_flight: AtomicUsize::new(0),
                state: Mutex::new(State {
                    queue: VecDeque::new(),
                    processing: false,
                    request_count: 0,
                    window_start: 0.0,
                    paused_until: 0.0,
                    pause_status: 429,
                    pause_kind: ThrottleKind::DeepLimit,
                    rate_base: max,
                    lowered_at: f64::NEG_INFINITY,
                    groups: HashMap::new(),
                    buckets: HashMap::new(),
                    parked: HashMap::new(),
                    next_parked_id: 0,
                }),
            }),
        }
    }

    /// `ESI_MAX_RPS`, default 50. Unlike the Node config, which turns a bad
    /// value into NaN without a word, a value that is not a positive integer
    /// is an error at startup.
    pub fn from_env() -> Result<Self, String> {
        match std::env::var("ESI_MAX_RPS") {
            Err(_) => Ok(Self::new(50)),
            Ok(raw) => match raw.trim().parse::<u32>() {
                Ok(n) if n > 0 => Ok(Self::new(n)),
                _ => Err(format!(
                    "ESI_MAX_RPS must be a positive integer, got {raw:?}"
                )),
            },
        }
    }

    /// Wait for a dispatch slot; the slot counts as in flight until the
    /// returned `Permit` is dropped.
    ///
    /// The acquire is queued when this is called, not when the future is
    /// first polled, so the order of calls is the order of grants. With
    /// `max_wait`, a brake or a group wait that ends later than that rejects
    /// with `EsiThrottled` instead of waiting: at once if it is already known,
    /// or when it is discovered if the acquire is still waiting.
    pub fn acquire(
        &self,
        route: &EsiRoute,
        max_wait: Option<Duration>,
    ) -> impl Future<Output = Result<Permit, EsiThrottled>> + Send + 'static {
        let (tx, rx) = oneshot::channel();
        let mut state = self.inner.lock();
        let deadline = max_wait.map(|wait| self.inner.now() + wait.as_millis() as f64);

        if let (Some(deadline), Some(max_wait)) = (deadline, max_wait) {
            let max_wait_ms = max_wait.as_millis() as f64;
            let early = if state.paused_until > deadline {
                Some(self.inner.throttled_error(&state, max_wait_ms))
            } else {
                state.bucket_key_of(route).and_then(|key| {
                    let bucket = state.buckets.get(&key)?;
                    (ready_at(bucket) > deadline)
                        .then(|| self.inner.group_throttled_error(&state, &key, max_wait_ms))
                })
            };
            if let Some(error) = early {
                let _ = tx.send(Err(error));
            } else {
                self.inner.enqueue(
                    &mut state,
                    Waiter {
                        tx,
                        deadline: Some(deadline),
                        route: route.clone(),
                    },
                );
            }
        } else {
            self.inner.enqueue(
                &mut state,
                Waiter {
                    tx,
                    deadline: None,
                    route: route.clone(),
                },
            );
        }
        drop(state);

        async move {
            rx.await
                .expect("the limiter settles every waiter before dropping it")
        }
    }

    /// Read a response's throttling headers. Keys must be lowercase.
    pub fn observe(&self, route: &EsiRoute, status: u16, headers: &HashMap<String, String>) {
        let inner = &self.inner;
        let mut state = inner.lock();
        let header = |name: &str| headers.get(name).map(String::as_str);

        if let Some(group) = header("x-ratelimit-group") {
            inner.observe_group(&mut state, route, group, status, headers);
            // A grouped 429 throttles only its group, never the whole process.
            if status == 429 {
                return;
            }
        }

        // Blank or absent is no value: parsing '' as 0 would brake.
        let remain = match header("x-esi-error-limit-remain") {
            Some(raw) if !raw.trim().is_empty() => raw.trim().parse::<f64>().unwrap_or(f64::NAN),
            _ => f64::NAN,
        };
        let reset = seconds(header("x-esi-error-limit-reset"));
        if status == 420 {
            inner.pause(
                &mut state,
                reset.unwrap_or(DEFAULT_PAUSE_MS),
                420,
                ThrottleKind::ErrorLimit,
            );
        } else if let (true, Some(reset)) = (remain < ERROR_LIMIT_FLOOR, reset) {
            inner.pause(&mut state, reset, 420, ThrottleKind::ErrorLimit);
        }

        if status == 429 {
            // 429s that land during a pause, or within 10 s of a decrease,
            // were sent before the rate dropped: one event, one decrease.
            let now = inner.now();
            if now >= state.paused_until && now - state.lowered_at >= RATE_CLIMB_INTERVAL_MS {
                inner.lower_rate(&mut state);
            }
            let retry_after = seconds(header("retry-after"));
            inner.pause(
                &mut state,
                retry_after.unwrap_or(DEEP_LIMIT_PAUSE_MS),
                429,
                ThrottleKind::DeepLimit,
            );
        }
    }

    /// Current limiter stats (`getStats`).
    pub fn stats(&self) -> LimiterStats {
        let state = self.inner.lock();
        let now = self.inner.now();
        LimiterStats {
            queue_length: state.queue.len() + state.parked.len(),
            current_rate: self.inner.current_rate(&state, now) as u32,
            paused_until: (state.paused_until > 0.0)
                .then(|| self.inner.epoch + Duration::from_millis(state.paused_until as u64)),
            max_requests_per_second: self.inner.max_requests_per_second as u32,
        }
    }
}

fn ready_at(bucket: &Bucket) -> f64 {
    bucket.paused_until.max(bucket.next_allowed_at)
}

/// Below 20% remaining, send no faster than the bucket refills: the sliding
/// window returns `limit` tokens per window and a 2xx costs 2, so one request
/// per window / limit × 2 is the pace the group can sustain. Below one 2xx's
/// worth, the same gap is counted from the last response too, so the request
/// waits for a token to come back — ESI does not say when, and the next
/// response corrects the guess. One model for both, so the gap never grows as
/// the tokens shrink.
fn respace(bucket: &mut Bucket) {
    let Bucket {
        limit,
        window_ms,
        remaining,
        ..
    } = *bucket;
    // Written as the original's negations so a NaN limit or remaining reads
    // the same way: every comparison with NaN is false.
    #[allow(clippy::neg_cmp_op_on_partial_ord)]
    if !(limit > 0.0) || !(remaining < limit * LOW_TOKEN_SHARE) {
        bucket.next_allowed_at = 0.0;
        return;
    }
    let pace = (window_ms / limit) * SUCCESS_TOKEN_COST;
    let from = if remaining < SUCCESS_TOKEN_COST {
        bucket.sent_at.max(bucket.updated_at)
    } else {
        bucket.sent_at
    };
    bucket.next_allowed_at = from + pace;
}

fn to_sleep(ms: f64) -> Duration {
    // Never wake early; a timer shorter than 1 ms is 1 ms, as in Node.
    Duration::from_millis(ms.ceil().max(1.0) as u64)
}

impl State {
    /// The bucket a route draws on, once its group has been learnt.
    fn bucket_key_of(&self, route: &EsiRoute) -> Option<String> {
        let group = self.groups.get(&route_template(&route.path))?;
        Some(format!(
            "{group}:{}",
            route.bucket_key.as_deref().unwrap_or("")
        ))
    }
}

impl Inner {
    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().expect("rate limiter state poisoned")
    }

    fn now(&self) -> f64 {
        self.epoch.elapsed().as_millis() as f64
    }

    /// The adapted dispatch rate: +1 req/s per full 10 s since requests
    /// resumed, so the time spent braked never counts towards the climb.
    fn current_rate(&self, state: &State, now: f64) -> f64 {
        let climb_from = state.lowered_at.max(state.paused_until);
        let climbed = ((now - climb_from) / RATE_CLIMB_INTERVAL_MS)
            .floor()
            .max(0.0);
        self.max_requests_per_second.min(state.rate_base + climbed)
    }

    fn throttled_error(&self, state: &State, max_wait_ms: f64) -> EsiThrottled {
        let wait_s = ((state.paused_until - self.now()) / 1000.0).ceil();
        EsiThrottled::new(
            state.pause_status,
            state.pause_kind,
            format!(
                "ESI is throttled for another {wait_s} s ({}), longer than the {max_wait_ms} ms this caller waits",
                state.pause_kind
            ),
        )
    }

    fn group_throttled_error(&self, state: &State, key: &str, max_wait_ms: f64) -> EsiThrottled {
        let wait_s = state.buckets.get(key).map_or(0.0, |bucket| {
            ((ready_at(bucket) - self.now()) / 1000.0).ceil()
        });
        EsiThrottled::new(
            429,
            ThrottleKind::RateLimit,
            format!(
                "ESI group {key} is throttled for another {wait_s} s, longer than the {max_wait_ms} ms this caller waits"
            ),
        )
    }

    fn observe_group(
        self: &Arc<Self>,
        state: &mut State,
        route: &EsiRoute,
        group: &str,
        status: u16,
        headers: &HashMap<String, String>,
    ) {
        let now = self.now();
        state
            .groups
            .insert(route_template(&route.path), group.to_owned());
        let key = format!("{group}:{}", route.bucket_key.as_deref().unwrap_or(""));
        let bucket = state.buckets.entry(key.clone()).or_insert(Bucket {
            limit: f64::NAN,
            window_ms: f64::NAN,
            remaining: f64::NAN,
            updated_at: now,
            sent_at: f64::NEG_INFINITY,
            next_allowed_at: 0.0,
            paused_until: 0.0,
        });

        if let Some((limit, window)) =
            parse_limit(headers.get("x-ratelimit-limit").map(String::as_str))
        {
            bucket.limit = f64::from(limit);
            bucket.window_ms = window.as_millis() as f64;
        }
        if let Some(raw) = headers.get("x-ratelimit-remaining") {
            if let Ok(remaining) = raw.trim().parse::<f64>() {
                if !raw.trim().is_empty() && remaining.is_finite() {
                    bucket.remaining = remaining;
                    bucket.updated_at = now;
                }
            }
        }
        respace(bucket);

        if status == 429 {
            let retry_after =
                seconds(headers.get("retry-after").map(String::as_str)).unwrap_or(DEFAULT_PAUSE_MS);
            if retry_after > 0.0 {
                let until = now + retry_after.min(MAX_PAUSE_MS);
                if until > bucket.paused_until {
                    // Same once-per-event logging as the process brake.
                    let is_new = until - bucket.paused_until.max(now) >= 1000.0;
                    bucket.paused_until = until;
                    if is_new {
                        tracing::warn!(
                            "⏸️  ESI 429 (rate-limit): pausing group {key} for {} s",
                            ((until - now) / 1000.0).round()
                        );
                    }
                }
            }
        }
        let bucket_ready_at = ready_at(bucket);

        // The bucket changed, so every acquire waiting on it looks again: one
        // that can no longer make its deadline rejects, the rest wait the new
        // time.
        self.reject_waiters_before(state, bucket_ready_at, Some(&key));
        let back: Vec<u64> = state
            .parked
            .iter()
            .filter(|(_, (waiter, _))| state.bucket_key_of(&waiter.route).as_deref() == Some(&key))
            .map(|(id, _)| *id)
            .collect();
        for id in back {
            if let Some((waiter, timer)) = state.parked.remove(&id) {
                timer.abort();
                state.queue.push_back(waiter);
            }
        }
        self.process_queue(state);
    }

    fn lower_rate(&self, state: &mut State) {
        let now = self.now();
        state.rate_base = 1f64.max((self.current_rate(state, now) * RATE_DECREASE).floor());
        state.lowered_at = now;
    }

    fn pause(&self, state: &mut State, ms: f64, status: u16, kind: ThrottleKind) {
        // `!(ms > 0)` rather than `ms <= 0`: never brake on a NaN either.
        #[allow(clippy::neg_cmp_op_on_partial_ord)]
        if !(ms > 0.0) {
            return;
        }
        let now = self.now();
        let until = now + ms.min(MAX_PAUSE_MS);
        if until <= state.paused_until {
            return;
        }

        // An extension under a second is the same pause seen again by a
        // request that was already in flight; log only a new or a materially
        // longer one.
        let is_new = until - state.paused_until.max(now) >= 1000.0;
        state.paused_until = until;
        state.pause_status = status;
        state.pause_kind = kind;
        if is_new {
            tracing::warn!(
                "⏸️  ESI {status} ({kind}): pausing all requests for {} s, rate {} req/s",
                ((until - now) / 1000.0).round(),
                self.current_rate(state, now)
            );
        }
        self.reject_waiters_before(state, until, None);
    }

    /// Give up on every waiting acquire whose deadline falls before `until`:
    /// all of them for the process brake, or only those drawing on bucket
    /// `key` for a group wait.
    fn reject_waiters_before(&self, state: &mut State, until: f64, key: Option<&str>) {
        let now = self.now();
        let expires = |state: &State, waiter: &Waiter| {
            waiter.deadline.is_some_and(|deadline| deadline < until)
                && key.is_none_or(|key| state.bucket_key_of(&waiter.route).as_deref() == Some(key))
        };
        let reject = |state: &State, waiter: Waiter| {
            let max_wait_ms = waiter
                .deadline
                .expect("only waiters with a deadline expire")
                - now;
            let error = match key {
                None => self.throttled_error(state, max_wait_ms),
                Some(key) => self.group_throttled_error(state, key, max_wait_ms),
            };
            let _ = waiter.tx.send(Err(error));
        };

        let queue = std::mem::take(&mut state.queue);
        for waiter in queue {
            if expires(state, &waiter) {
                reject(state, waiter);
            } else {
                state.queue.push_back(waiter);
            }
        }
        let expired: Vec<u64> = state
            .parked
            .iter()
            .filter(|(_, (waiter, _))| expires(state, waiter))
            .map(|(id, _)| *id)
            .collect();
        for id in expired {
            if let Some((waiter, timer)) = state.parked.remove(&id) {
                timer.abort();
                reject(state, waiter);
            }
        }
    }

    fn enqueue(self: &Arc<Self>, state: &mut State, waiter: Waiter) {
        state.queue.push_back(waiter);
        self.process_queue(state);
    }

    /// Start the queue if it is not already running (`processQueue`).
    fn process_queue(self: &Arc<Self>, state: &mut State) {
        if state.processing || state.queue.is_empty() {
            return;
        }
        state.processing = true;
        if let Next::SleepMs(ms) = self.run(state) {
            let inner = Arc::clone(self);
            tokio::spawn(async move { inner.keep_processing(ms).await });
        }
    }

    /// The rest of `processQueue`, after its first `await`.
    async fn keep_processing(self: Arc<Self>, mut sleep_ms: f64) {
        loop {
            tokio::time::sleep(to_sleep(sleep_ms)).await;
            let mut state = self.lock();
            match self.run(&mut state) {
                Next::Idle => return,
                Next::SleepMs(ms) => sleep_ms = ms,
            }
        }
    }

    /// Dispatch until the queue is empty or something has to be waited for.
    fn run(self: &Arc<Self>, state: &mut State) -> Next {
        while !state.queue.is_empty() {
            // Nothing is dispatched while the brake is on.
            let now = self.now();
            if state.paused_until > now {
                return Next::SleepMs(state.paused_until - now);
            }

            // Check if we need to reset the rate window.
            let elapsed = now - state.window_start;
            if elapsed >= 1000.0 {
                state.request_count = 0;
                state.window_start = now;
            }

            // A grouped request whose bucket says wait steps aside.
            if self.park_head_if_waiting(state, now) {
                continue;
            }

            // Respect the per-second dispatch ceiling.
            let rate = self.current_rate(state, now);
            // Dispatch spacing that produces the rate: 50/sec => 20 ms apart.
            let spacing = 1f64.max((1000.0 / rate).floor());
            if f64::from(state.request_count) >= rate {
                return Next::SleepMs(1000.0 - elapsed);
            }

            // Respect the max concurrent in-flight ceiling.
            if self.in_flight.load(Ordering::SeqCst) >= self.max_concurrent {
                return Next::SleepMs(spacing);
            }

            // Dispatch the next waiter without waiting for its request, so
            // requests overlap.
            let Some(waiter) = state.queue.pop_front() else {
                break;
            };
            state.request_count += 1;
            self.in_flight.fetch_add(1, Ordering::SeqCst);
            if let Some(key) = state.bucket_key_of(&waiter.route) {
                if let Some(bucket) = state.buckets.get_mut(&key) {
                    bucket.sent_at = now;
                    respace(bucket);
                }
            }
            // If the caller has gone, the permit comes back and is dropped
            // here, which gives the slot back.
            let _ = waiter.tx.send(Ok(Permit {
                inner: Arc::clone(self),
            }));

            // Space out dispatches at the current rate.
            return Next::SleepMs(spacing);
        }
        state.processing = false;
        Next::Idle
    }

    /// Take the head waiter off the queue if its bucket is not ready, and put
    /// it back when it is, so it never holds up other routes. Returns whether
    /// it did.
    fn park_head_if_waiting(self: &Arc<Self>, state: &mut State, now: f64) -> bool {
        let Some(head) = state.queue.front() else {
            return false;
        };
        let Some(key) = state.bucket_key_of(&head.route) else {
            return false;
        };
        let Some(bucket) = state.buckets.get(&key) else {
            return false;
        };
        let ready = ready_at(bucket);
        if ready <= now {
            return false;
        }

        let waiter = state.queue.pop_front().expect("head checked above");
        if let Some(deadline) = waiter.deadline.filter(|deadline| *deadline < ready) {
            let error = self.group_throttled_error(state, &key, deadline - now);
            let _ = waiter.tx.send(Err(error));
            return true;
        }
        let id = state.next_parked_id;
        state.next_parked_id += 1;
        let inner = Arc::clone(self);
        let delay = Duration::from_millis((ready - now).ceil() as u64);
        let timer = tokio::spawn(async move {
            tokio::time::sleep(delay).await;
            let mut state = inner.lock();
            if let Some((waiter, _)) = state.parked.remove(&id) {
                inner.enqueue(&mut state, waiter);
            }
        });
        state.parked.insert(id, (waiter, timer.abort_handle()));
        true
    }
}
