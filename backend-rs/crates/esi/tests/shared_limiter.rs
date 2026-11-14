//! Port of `backend/src/services/esi-limiter/shared-rate-limiter.spec.ts`: the
//! in-process side of the shared limiter, against a fake store.
//!
//! Time is tokio's paused clock, as in `tests/limiter.rs`. The last cases run
//! on real time: one through `EsiClient` against a mock server, and two
//! against a real Redis store (skipped when `REDIS_URL` is unset) or a port
//! nothing listens on.

use std::collections::{HashMap, VecDeque};
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use esi::shared::{
    AcquireOutcome, ObserveInput, ObserveOutcome, Priority, SharedStore, WaitReason,
};
use esi::shared_limiter::{LimiterStore, StoreFuture, LOG_REDIS_BACK, LOG_REDIS_UNREACHABLE};
use esi::{EsiClient, EsiRoute, EsiThrottled, Permit, RateLimiter, ThrottleKind};
use futures_util::task::noop_waker_ref;

type Acquire = Pin<Box<dyn Future<Output = Result<Permit, EsiThrottled>> + Send>>;

/// One acquire, polled by hand (as in `tests/limiter.rs`).
struct Slot {
    future: Option<Acquire>,
    outcome: Option<Result<Permit, EsiThrottled>>,
}

impl Slot {
    fn new(limiter: &RateLimiter, route: &EsiRoute, max_wait: Option<Duration>) -> Self {
        Self {
            future: Some(Box::pin(tokio::task::unconstrained(
                limiter.acquire(route, max_wait),
            ))),
            outcome: None,
        }
    }

    fn settled(&mut self) -> bool {
        if let Some(future) = self.future.as_mut() {
            let mut cx = Context::from_waker(noop_waker_ref());
            if let Poll::Ready(outcome) = future.as_mut().poll(&mut cx) {
                self.outcome = Some(outcome);
                self.future = None;
            }
        }
        self.outcome.is_some()
    }

    fn granted(&mut self) -> bool {
        self.settled() && matches!(self.outcome, Some(Ok(_)))
    }

    fn error(&mut self) -> EsiThrottled {
        assert!(self.settled(), "the acquire has not settled");
        match self.outcome.as_ref() {
            Some(Err(error)) => error.clone(),
            _ => panic!("the acquire was granted, not rejected"),
        }
    }

    fn release(&mut self) {
        assert!(self.granted(), "only a granted slot can be released");
        self.outcome = None;
    }
}

async fn advance(ms: u64) {
    tokio::time::sleep(Duration::from_millis(ms)).await;
    for _ in 0..50 {
        tokio::task::yield_now().await;
    }
}

async fn settled_after(slot: &mut Slot, ms: u64) -> bool {
    advance(ms).await;
    slot.settled()
}

type AcquireFn = dyn Fn(Priority, &str, &str) -> StoreFuture<'static, AcquireOutcome> + Send + Sync;
type ObserveFn = dyn Fn(&ObserveInput) -> StoreFuture<'static, ObserveOutcome> + Send + Sync;

/// `fakeStore`: records every call and answers with the given functions.
struct FakeStore {
    acquire_fn: Box<AcquireFn>,
    observe_fn: Box<ObserveFn>,
    acquires: Mutex<Vec<(Priority, String, String)>>,
    observes: Mutex<Vec<ObserveInput>>,
}

impl FakeStore {
    fn new(
        acquire: impl Fn(Priority, &str, &str) -> StoreFuture<'static, AcquireOutcome>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Self {
            acquire_fn: Box::new(acquire),
            observe_fn: Box::new(|_| answer(no_news())),
            acquires: Mutex::new(Vec::new()),
            observes: Mutex::new(Vec::new()),
        }
    }

    fn observing(
        mut self,
        observe: impl Fn(&ObserveInput) -> StoreFuture<'static, ObserveOutcome> + Send + Sync + 'static,
    ) -> Self {
        self.observe_fn = Box::new(observe);
        self
    }

    fn acquire_count(&self) -> usize {
        self.acquires.lock().unwrap().len()
    }

    fn last_acquire(&self) -> (Priority, String, String) {
        self.acquires.lock().unwrap().last().unwrap().clone()
    }

    fn observe_count(&self) -> usize {
        self.observes.lock().unwrap().len()
    }
}

impl LimiterStore for FakeStore {
    fn acquire<'a>(
        &'a self,
        priority: Priority,
        template: &'a str,
        bucket_key: &'a str,
    ) -> StoreFuture<'a, AcquireOutcome> {
        self.acquires
            .lock()
            .unwrap()
            .push((priority, template.to_owned(), bucket_key.to_owned()));
        (self.acquire_fn)(priority, template, bucket_key)
    }

    fn observe<'a>(&'a self, input: &'a ObserveInput) -> StoreFuture<'a, ObserveOutcome> {
        self.observes.lock().unwrap().push(input.clone());
        (self.observe_fn)(input)
    }
}

fn answer<T: Send + 'static>(value: T) -> StoreFuture<'static, T> {
    Box::pin(async move { Ok(value) })
}

fn fail<T: Send + 'static>(message: &str) -> StoreFuture<'static, T> {
    let message = message.to_owned();
    Box::pin(async move { Err(message) })
}

fn never<T: Send + 'static>() -> StoreFuture<'static, T> {
    Box::pin(std::future::pending())
}

fn no_news() -> ObserveOutcome {
    ObserveOutcome {
        brake: None,
        group_pause: None,
        rate: 50.0,
    }
}

fn wait(reason: WaitReason, wait_ms: f64, detail: &str) -> AcquireOutcome {
    AcquireOutcome::Wait {
        wait_ms,
        reason,
        detail: detail.to_owned(),
    }
}

/// Answers in order, then keeps repeating the last one.
fn replies(
    list: Vec<AcquireOutcome>,
) -> impl Fn(Priority, &str, &str) -> StoreFuture<'static, AcquireOutcome> + Send + Sync {
    let list = Mutex::new(VecDeque::from(list));
    move |_, _, _| {
        let mut list = list.lock().unwrap();
        let next = if list.len() > 1 {
            list.pop_front().unwrap()
        } else {
            list.front().unwrap().clone()
        };
        answer(next)
    }
}

fn granted() -> impl Fn(Priority, &str, &str) -> StoreFuture<'static, AcquireOutcome> + Send + Sync
{
    |_, _, _| answer(AcquireOutcome::Granted)
}

fn limiter_with(store: &Arc<FakeStore>) -> RateLimiter {
    RateLimiter::new(50).with_store(Arc::clone(store) as Arc<dyn LimiterStore>)
}

fn route() -> EsiRoute {
    EsiRoute::new("/characters/365974960/")
}

fn other() -> EsiRoute {
    EsiRoute::new("/universe/types/34/")
}

fn headers(pairs: &[(&str, &str)]) -> HashMap<String, String> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

const TEN_S: Option<Duration> = Some(Duration::from_secs(10));

/// Collects every INFO and WARN line, for as long as the guard lives.
fn capture_logs() -> (tracing::subscriber::DefaultGuard, Arc<Mutex<Vec<String>>>) {
    #[derive(Clone)]
    struct Sink(Arc<Mutex<Vec<String>>>);
    impl std::io::Write for Sink {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            let line = String::from_utf8_lossy(buf).trim().to_owned();
            if !line.is_empty() {
                self.0.lock().unwrap().push(line);
            }
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let lines = Arc::new(Mutex::new(Vec::new()));
    let sink = Sink(Arc::clone(&lines));
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_ansi(false)
        .without_time()
        .with_target(false)
        .with_writer(move || sink.clone())
        .finish();
    (tracing::subscriber::set_default(subscriber), lines)
}

fn logged(lines: &Arc<Mutex<Vec<String>>>, level: &str, text: &str) -> usize {
    lines
        .lock()
        .unwrap()
        .iter()
        .filter(|line| line.starts_with(level) && line.contains(text))
        .count()
}

mod acquire {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn asks_the_store_again_after_a_rate_wait_and_resolves_once_granted() {
        let store = Arc::new(FakeStore::new(replies(vec![
            wait(WaitReason::Rate, 50.0, ""),
            AcquireOutcome::Granted,
        ])));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut slot, 10).await);
        assert_eq!(store.acquire_count(), 1);

        // 50 ms wait plus at most 50 ms jitter.
        assert!(settled_after(&mut slot, 100).await);
        assert!(slot.granted());
        assert_eq!(store.acquire_count(), 2);
        assert_eq!(
            store.last_acquire(),
            (
                Priority::Bulk,
                "/characters/{id}/".to_owned(),
                String::new()
            )
        );
    }

    #[tokio::test(start_paused = true)]
    async fn rejects_at_once_when_the_brake_outlasts_max_wait() {
        let store = Arc::new(FakeStore::new(replies(vec![wait(
            WaitReason::Brake,
            30_000.0,
            "420:error-limit",
        )])));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), TEN_S);
        assert!(settled_after(&mut slot, 0).await);
        let error = slot.error();
        assert_eq!(error.status, 420);
        assert_eq!(error.kind, ThrottleKind::ErrorLimit);
        assert_eq!(
            error.message,
            "ESI is throttled for another 30 s (error-limit), longer than the 10000 ms this caller waits"
        );
        assert_eq!(store.acquire_count(), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn a_malformed_brake_detail_rejects_as_a_deep_limit() {
        let store = Arc::new(FakeStore::new(replies(vec![wait(
            WaitReason::Brake,
            30_000.0,
            "garbage",
        )])));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), TEN_S);
        assert!(settled_after(&mut slot, 0).await);
        let error = slot.error();
        assert_eq!(error.status, 429);
        assert_eq!(error.kind, ThrottleKind::DeepLimit);
    }

    #[tokio::test(start_paused = true)]
    async fn waits_out_a_brake_shorter_than_max_wait() {
        let store = Arc::new(FakeStore::new(replies(vec![
            wait(WaitReason::Brake, 500.0, "420:x"),
            AcquireOutcome::Granted,
        ])));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), TEN_S);
        assert!(!settled_after(&mut slot, 400).await);
        assert!(settled_after(&mut slot, 200).await);
        assert!(slot.granted());
    }

    #[tokio::test(start_paused = true)]
    async fn caps_one_sleep_at_1_s_so_a_brake_set_elsewhere_is_seen_again_soon() {
        let store = Arc::new(FakeStore::new(replies(vec![wait(
            WaitReason::Brake,
            60_000.0,
            "420:error-limit",
        )])));
        let limiter = limiter_with(&store);

        let _slot = Slot::new(&limiter, &route(), None);
        advance(1100).await;
        assert_eq!(store.acquire_count(), 2);
    }

    #[tokio::test(start_paused = true)]
    async fn parks_a_route_waiting_on_its_group_so_another_route_goes_at_once() {
        let store = Arc::new(FakeStore::new(|_, template, _| {
            answer(if template == "/characters/{id}/" {
                wait(WaitReason::Group, 5_000.0, "char-detail:")
            } else {
                AcquireOutcome::Granted
            })
        }));
        let limiter = limiter_with(&store);

        let mut grouped = Slot::new(&limiter, &route(), None);
        let mut free = Slot::new(&limiter, &other(), None);
        assert!(settled_after(&mut free, 0).await);
        assert!(free.granted());
        assert!(!settled_after(&mut grouped, 1_000).await);
    }

    #[tokio::test(start_paused = true)]
    async fn asks_again_for_a_parked_route_when_its_group_wait_is_over() {
        let store = Arc::new(FakeStore::new(replies(vec![
            wait(WaitReason::Group, 2_000.0, "char-detail:"),
            AcquireOutcome::Granted,
        ])));
        let limiter = limiter_with(&store);

        let mut grouped = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut grouped, 1_900).await);
        assert!(settled_after(&mut grouped, 200).await);
        assert!(grouped.granted());
        assert_eq!(store.acquire_count(), 2);
    }

    #[tokio::test(start_paused = true)]
    async fn rejects_a_group_wait_longer_than_max_wait_as_a_rate_limit() {
        let store = Arc::new(FakeStore::new(replies(vec![wait(
            WaitReason::Group,
            30_000.0,
            "char-detail:",
        )])));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), TEN_S);
        assert!(settled_after(&mut slot, 0).await);
        let error = slot.error();
        assert_eq!(error.status, 429);
        assert_eq!(error.kind, ThrottleKind::RateLimit);
        assert_eq!(
            error.message,
            "ESI group char-detail: is throttled for another 30 s, longer than the 10000 ms this caller waits"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn rejects_a_rate_wait_longer_than_max_wait_as_a_deep_limit() {
        let store = Arc::new(FakeStore::new(replies(vec![wait(
            WaitReason::Rate,
            12_000.0,
            "",
        )])));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), TEN_S);
        assert!(settled_after(&mut slot, 0).await);
        let error = slot.error();
        assert_eq!(error.status, 429);
        assert_eq!(error.kind, ThrottleKind::DeepLimit);
        assert_eq!(
            error.message,
            "ESI shared rate has no slot for another 12000 ms, longer than the 10000 ms this caller waits"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn always_asks_as_bulk_and_passes_the_bucket_key_through() {
        let store = Arc::new(FakeStore::new(granted()));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(
            &limiter,
            &EsiRoute::with_bucket_key("/characters/9/", "9"),
            None,
        );
        assert!(settled_after(&mut slot, 0).await);
        assert_eq!(
            store.last_acquire(),
            (
                Priority::Bulk,
                "/characters/{id}/".to_owned(),
                "9".to_owned()
            )
        );
    }

    #[tokio::test(start_paused = true)]
    async fn never_holds_more_than_max_50_max_rps_slots_in_flight() {
        let store = Arc::new(FakeStore::new(granted()));
        let limiter = limiter_with(&store);

        let mut slots: Vec<Slot> = (0..60)
            .map(|_| Slot::new(&limiter, &route(), None))
            .collect();
        advance(1_000).await;
        let count = |slots: &mut [Slot]| slots.iter_mut().map(Slot::granted).filter(|g| *g).count();
        assert_eq!(count(&mut slots), 50);
        assert_eq!(count(&mut slots[50..]), 0);

        slots[0].release();
        slots[1].release();
        advance(100).await;
        // 48 still held plus the two the released slots made room for.
        assert_eq!(count(&mut slots), 50);
        assert_eq!(count(&mut slots[50..]), 2);
    }
}

mod without_redis {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn falls_back_to_the_local_limiter_when_the_store_does_not_answer_in_200_ms() {
        let (_guard, lines) = capture_logs();
        let store = Arc::new(FakeStore::new(|_, _, _| never()));
        let limiter = limiter_with(&store);

        let mut first = Slot::new(&limiter, &route(), TEN_S);
        assert!(!settled_after(&mut first, 150).await);
        assert!(settled_after(&mut first, 100).await);
        assert!(first.granted());
        assert!(!limiter.is_shared());

        let mut second = Slot::new(&limiter, &other(), None);
        assert!(settled_after(&mut second, 0).await);
        assert!(second.granted());
        assert_eq!(store.acquire_count(), 1);
        assert_eq!(logged(&lines, "WARN", LOG_REDIS_UNREACHABLE), 1);
        assert_eq!(
            logged(
                &lines,
                "WARN",
                &format!("{LOG_REDIS_UNREACHABLE} (no answer in 200 ms); retrying every 10 s")
            ),
            1
        );
    }

    #[tokio::test(start_paused = true)]
    async fn falls_back_when_the_store_fails_and_the_local_limiter_grants() {
        let store = Arc::new(FakeStore::new(|_, _, _| fail("Connection is closed.")));
        let limiter = limiter_with(&store);

        let mut slot = Slot::new(&limiter, &route(), None);
        assert!(settled_after(&mut slot, 0).await);
        assert!(slot.granted());
        assert!(!limiter.is_shared());
        slot.release();
    }

    #[tokio::test(start_paused = true)]
    async fn does_not_ask_the_store_again_for_10_s_then_returns_to_shared_mode_once() {
        let (_guard, lines) = capture_logs();
        let up = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&up);
        let store = Arc::new(FakeStore::new(move |_, _, _| {
            if flag.load(Ordering::SeqCst) {
                answer(AcquireOutcome::Granted)
            } else {
                fail("ECONNREFUSED")
            }
        }));
        let limiter = limiter_with(&store);

        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 0).await);
        assert_eq!(store.acquire_count(), 1);

        advance(9_000).await;
        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 0).await);
        limiter.observe_async(&route(), 200, &headers(&[])).await;
        assert_eq!(store.acquire_count(), 1);
        assert_eq!(store.observe_count(), 0);

        up.store(true, Ordering::SeqCst);
        advance(1_000).await;
        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 0).await);
        assert_eq!(store.acquire_count(), 2);
        assert!(limiter.is_shared());
        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 30).await);
        assert_eq!(store.acquire_count(), 3);
        assert_eq!(logged(&lines, "INFO", LOG_REDIS_BACK), 1);
        assert_eq!(logged(&lines, "WARN", LOG_REDIS_UNREACHABLE), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn a_failed_retry_stays_local_logs_nothing_new_and_waits_another_10_s() {
        let (_guard, lines) = capture_logs();
        let store = Arc::new(FakeStore::new(|_, _, _| fail("ECONNREFUSED")));
        let limiter = limiter_with(&store);

        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 0).await);
        advance(10_000).await;
        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 0).await);
        assert_eq!(store.acquire_count(), 2);
        assert!(settled_after(&mut Slot::new(&limiter, &route(), None), 30).await);
        assert_eq!(store.acquire_count(), 2);
        assert_eq!(logged(&lines, "WARN", LOG_REDIS_UNREACHABLE), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn falls_back_to_the_local_observe_when_the_store_observe_fails() {
        let store = Arc::new(FakeStore::new(granted()).observing(|_| fail("ECONNREFUSED")));
        let limiter = limiter_with(&store);

        limiter.observe_async(&route(), 420, &headers(&[])).await;
        assert!(!limiter.is_shared());
        // The local limiter saw the 420 and braked.
        assert!(limiter.stats().paused_until.is_some());
    }
}

mod observe {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn parses_the_headers_into_numbers_for_the_store() {
        let store = Arc::new(FakeStore::new(granted()));
        let limiter = limiter_with(&store);

        limiter
            .observe_async(
                &EsiRoute::with_bucket_key("/characters/9/", "9"),
                429,
                &headers(&[
                    ("x-ratelimit-group", "char-detail"),
                    ("x-ratelimit-limit", "150/15m"),
                    ("x-ratelimit-remaining", "12"),
                    ("x-esi-error-limit-remain", ""),
                    ("x-esi-error-limit-reset", "30"),
                    ("retry-after", "20"),
                ]),
            )
            .await;
        let observes = store.observes.lock().unwrap();
        assert_eq!(observes.len(), 1);
        assert_eq!(
            observes[0],
            ObserveInput {
                template: "/characters/{id}/".to_owned(),
                bucket_key: "9".to_owned(),
                status: 429,
                group: Some("char-detail".to_owned()),
                limit: Some(150.0),
                window_ms: Some(900_000.0),
                remaining: Some(12.0),
                error_remain: None,
                error_reset_ms: Some(30_000.0),
                retry_after_ms: Some(20_000.0),
            }
        );
    }

    #[tokio::test(start_paused = true)]
    async fn leaves_out_every_header_that_is_absent() {
        let store = Arc::new(FakeStore::new(granted()));
        let limiter = limiter_with(&store);

        limiter
            .observe_async(&other(), 200, &headers(&[("x-ratelimit-remaining", " ")]))
            .await;
        assert_eq!(
            store.observes.lock().unwrap()[0],
            ObserveInput {
                template: "/universe/types/{id}/".to_owned(),
                bucket_key: String::new(),
                status: 200,
                ..ObserveInput::default()
            }
        );
    }

    #[tokio::test(start_paused = true)]
    async fn logs_a_brake_this_process_set_and_nothing_without_one() {
        let (_guard, lines) = capture_logs();
        let results = Mutex::new(VecDeque::from(vec![
            no_news(),
            ObserveOutcome {
                brake: Some((30_000.0, 420, ThrottleKind::ErrorLimit)),
                group_pause: None,
                rate: 50.0,
            },
        ]));
        let store = Arc::new(
            FakeStore::new(granted())
                .observing(move |_| answer(results.lock().unwrap().pop_front().unwrap())),
        );
        let limiter = limiter_with(&store);

        limiter.observe_async(&route(), 200, &headers(&[])).await;
        assert_eq!(logged(&lines, "WARN", ""), 0);

        limiter.observe_async(&route(), 420, &headers(&[])).await;
        assert_eq!(logged(&lines, "WARN", ""), 1);
        assert_eq!(
            logged(
                &lines,
                "WARN",
                "⏸️  ESI 420 (error-limit): pausing all requests for 30 s, rate 50 req/s"
            ),
            1
        );
    }

    #[tokio::test(start_paused = true)]
    async fn logs_a_group_pause_this_process_set() {
        let (_guard, lines) = capture_logs();
        let store = Arc::new(FakeStore::new(granted()).observing(|_| {
            answer(ObserveOutcome {
                brake: None,
                group_pause: Some(("char-detail:9".to_owned(), 20_000.0)),
                rate: 50.0,
            })
        }));
        let limiter = limiter_with(&store);

        limiter
            .observe_async(
                &route(),
                429,
                &headers(&[("x-ratelimit-group", "char-detail")]),
            )
            .await;
        assert_eq!(logged(&lines, "WARN", ""), 1);
        assert_eq!(
            lines.lock().unwrap()[0],
            "WARN ⏸️  ESI 429 (rate-limit): pausing group char-detail:9 for 20 s"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn a_brake_it_learns_rejects_waiters_that_cannot_make_their_deadline() {
        let store = Arc::new(
            FakeStore::new(|_, _, _| answer(wait(WaitReason::Rate, 900.0, ""))).observing(|_| {
                answer(ObserveOutcome {
                    brake: Some((30_000.0, 420, ThrottleKind::ErrorLimit)),
                    group_pause: None,
                    rate: 50.0,
                })
            }),
        );
        let limiter = limiter_with(&store);

        let mut waiting = Slot::new(&limiter, &route(), TEN_S);
        advance(10).await;
        assert!(!waiting.settled());
        limiter.observe_async(&other(), 420, &headers(&[])).await;
        assert!(settled_after(&mut waiting, 0).await);
        assert_eq!(waiting.error().status, 420);
    }

    #[tokio::test(start_paused = true)]
    async fn a_group_pause_it_learns_rejects_parked_waiters_on_that_group() {
        let store = Arc::new(
            FakeStore::new(|_, _, _| answer(wait(WaitReason::Group, 2_000.0, "char-detail:")))
                .observing(|_| {
                    answer(ObserveOutcome {
                        brake: None,
                        group_pause: Some(("char-detail:".to_owned(), 30_000.0)),
                        rate: 50.0,
                    })
                }),
        );
        let limiter = limiter_with(&store);

        let mut parked = Slot::new(&limiter, &route(), TEN_S);
        advance(10).await;
        assert!(!parked.settled());
        limiter.observe_async(&route(), 429, &headers(&[])).await;
        assert!(settled_after(&mut parked, 0).await);
        assert_eq!(parked.error().kind, ThrottleKind::RateLimit);
    }
}

mod wiring {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn the_client_asks_the_store_and_reports_the_response_to_it() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/status/"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("x-esi-error-limit-remain", "99")
                    .set_body_json(serde_json::json!({ "players": 1 })),
            )
            .mount(&server)
            .await;
        let store = Arc::new(FakeStore::new(granted()));
        let client = EsiClient::with_base_url(limiter_with(&store), server.uri());

        let body: serde_json::Value = client.get("/status/").await.unwrap();
        assert_eq!(body["players"], 1);
        assert_eq!(store.acquire_count(), 1);
        let observes = store.observes.lock().unwrap();
        assert_eq!(observes.len(), 1);
        assert_eq!(observes[0].error_remain, Some(99.0));
    }

    #[tokio::test]
    async fn a_redis_nobody_listens_on_never_stalls_an_acquire_past_the_timeout() {
        // Connection setup is inside the 200 ms bound: on Windows a refused
        // connect alone takes about 2 s.
        let store = SharedStore::new("redis://127.0.0.1:1", 50).unwrap();
        let limiter = RateLimiter::new(50).with_shared(store);

        let started = std::time::Instant::now();
        let _permit = limiter.acquire(&route(), None).await.unwrap();
        assert!(
            started.elapsed() < Duration::from_millis(600),
            "took {:?}",
            started.elapsed()
        );
        assert!(!limiter.is_shared());
    }

    #[tokio::test]
    async fn a_real_redis_grants_through_the_shared_store() {
        let Some(url) = std::env::var("REDIS_URL").ok().filter(|u| !u.is_empty()) else {
            eprintln!("REDIS_URL is not set: skipping the real Redis case");
            return;
        };
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let prefix = format!("esi-limiter:test-rs:wiring:{}:{nanos}:", std::process::id());
        let store = SharedStore::new(&url, 50)
            .unwrap()
            .with_prefix(prefix.clone());
        let limiter = RateLimiter::new(50).with_shared(store);

        for _ in 0..3 {
            let _permit = limiter.acquire(&other(), None).await.unwrap();
        }
        limiter.observe_async(&other(), 200, &headers(&[])).await;
        assert!(limiter.is_shared());

        // Delete only this run's keys.
        let client = redis::Client::open(url.as_str()).unwrap();
        let mut con = client.get_multiplexed_async_connection().await.unwrap();
        let mut cursor: u64 = 0;
        loop {
            let (next, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(format!("{prefix}*"))
                .arg("COUNT")
                .arg(100)
                .query_async(&mut con)
                .await
                .unwrap();
            if !keys.is_empty() {
                let _: () = redis::cmd("DEL")
                    .arg(&keys)
                    .query_async(&mut con)
                    .await
                    .unwrap();
            }
            cursor = next;
            if cursor == 0 {
                break;
            }
        }
    }
}
