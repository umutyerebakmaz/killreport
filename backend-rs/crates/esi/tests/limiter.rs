//! Port of `backend/src/services/rate-limiter.spec.ts`.
//!
//! Every case keeps its name and carries the line it came from. The three
//! `routeTemplate` cases live next to the function, in `src/route.rs`.
//!
//! Time is tokio's paused clock. `settled_after(ms)` sleeps the test for `ms`
//! of virtual time — tokio then advances the clock from one pending timer to
//! the next, in order, the way vitest's `advanceTimersByTimeAsync` does — and
//! yields so whatever those timers woke gets to run before the check.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::Duration;

use esi::{EsiRoute, EsiThrottled, Permit, RateLimiter, ThrottleKind};
use futures_util::task::noop_waker_ref;
use tokio::time::Instant;

type Acquire = Pin<Box<dyn Future<Output = Result<Permit, EsiThrottled>> + Send>>;

/// One acquire, polled by hand so the test can ask whether it has settled
/// without waiting for it.
struct Slot {
    future: Option<Acquire>,
    outcome: Option<Result<Permit, EsiThrottled>>,
}

impl Slot {
    fn new(limiter: &RateLimiter, route: &EsiRoute, max_wait: Option<Duration>) -> Self {
        Self {
            // `unconstrained`: tokio gives a task a budget of 128 operations
            // per turn, and a test that polls 151 acquires in one turn would
            // see the rest as pending only because the budget ran out.
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

    /// Give the slot back (`release()`).
    fn release(&mut self) {
        assert!(self.granted(), "only a granted slot can be released");
        self.outcome = None;
    }
}

/// `limiterAt`: a fresh limiter with this ceiling.
fn limiter_at(max_requests_per_second: u32) -> RateLimiter {
    RateLimiter::new(max_requests_per_second)
}

fn route() -> EsiRoute {
    EsiRoute::new("/characters/365974960/")
}

const HASH: &str = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

fn killmail() -> EsiRoute {
    EsiRoute::new(format!("/killmails/123/{HASH}/"))
}

fn status_route() -> EsiRoute {
    EsiRoute::new("/status/")
}

fn headers(pairs: &[(&str, &str)]) -> HashMap<String, String> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

/// Headers of a response from a grouped route.
fn grouped(group: &str, limit: &str, remaining: u32) -> HashMap<String, String> {
    headers(&[
        ("x-ratelimit-group", group),
        ("x-ratelimit-limit", limit),
        ("x-ratelimit-remaining", &remaining.to_string()),
    ])
}

/// Let `ms` of virtual time pass, then let everything that woke run.
async fn advance(ms: u64) {
    tokio::time::sleep(Duration::from_millis(ms)).await;
    for _ in 0..20 {
        tokio::task::yield_now().await;
    }
}

/// `settledAfter`: whether the acquire has settled after `ms` more.
async fn settled_after(slot: &mut Slot, ms: u64) -> bool {
    advance(ms).await;
    slot.settled()
}

fn granted_count(slots: &mut [Slot]) -> usize {
    slots
        .iter_mut()
        .map(Slot::granted)
        .filter(|granted| *granted)
        .count()
}

/// `occupy`: n acquires that keep their slot until the test releases it.
fn occupy(limiter: &RateLimiter, n: usize) -> Vec<Slot> {
    (0..n).map(|_| Slot::new(limiter, &route(), None)).collect()
}

/// Collects every WARN the limiter logs, for as long as the guard lives.
fn capture_warnings() -> (tracing::subscriber::DefaultGuard, Arc<Mutex<Vec<String>>>) {
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
        .with_max_level(tracing::Level::WARN)
        .with_ansi(false)
        .without_time()
        .with_writer(move || sink.clone())
        .finish();
    (tracing::subscriber::set_default(subscriber), lines)
}

mod dispatch {
    use super::*;

    // rate-limiter.spec.ts:58
    #[tokio::test(start_paused = true)]
    async fn grants_the_first_slot_at_once_and_the_rest_1000_over_rps_ms_apart() {
        let limiter = limiter_at(50); // 20 ms spacing
        let mut slots = occupy(&limiter, 3);

        advance(0).await;
        assert_eq!(granted_count(&mut slots), 1);
        advance(19).await;
        assert_eq!(granted_count(&mut slots), 1);
        advance(1).await;
        assert_eq!(granted_count(&mut slots), 2);
        advance(20).await;
        assert_eq!(granted_count(&mut slots), 3);
    }

    // rate-limiter.spec.ts:72
    #[tokio::test(start_paused = true)]
    async fn holds_the_per_second_ceiling_until_the_window_rolls_over() {
        // 3/sec => 333 ms spacing, so the fourth would fall at 999 ms, one ms
        // inside the window. The ceiling has to push it to 1000 ms.
        let limiter = limiter_at(3);
        let mut slots = occupy(&limiter, 4);

        advance(999).await;
        assert_eq!(granted_count(&mut slots), 3);
        advance(1).await;
        assert_eq!(granted_count(&mut slots), 4);
    }

    // rate-limiter.spec.ts:84
    #[tokio::test(start_paused = true)]
    async fn raises_the_in_flight_cap_with_the_rate_so_it_never_becomes_the_ceiling() {
        let limiter = limiter_at(150); // 6 ms spacing, cap 150
        let mut slots = occupy(&limiter, 151);

        advance(3000).await;
        assert_eq!(granted_count(&mut slots), 150);
        slots[0].release();
        advance(6).await;
        // vitest counts 151 because its released slot still reads as granted;
        // here a released slot is gone, so 150 remain and the last is among
        // them.
        assert_eq!(granted_count(&mut slots), 150);
        assert!(slots[150].granted());
    }
}

mod stats {
    use super::*;

    // rate-limiter.spec.ts:97
    #[tokio::test(start_paused = true)]
    async fn reports_the_queue_depth_the_current_and_configured_rate_and_the_brake() {
        let limiter = limiter_at(50);
        let _slots = occupy(&limiter, 3);

        let stats = limiter.stats();
        assert_eq!(stats.queue_length, 2);
        assert_eq!(stats.current_rate, 50);
        assert_eq!(stats.paused_until, None);
        assert_eq!(stats.max_requests_per_second, 50);

        advance(40).await;
        assert_eq!(limiter.stats().queue_length, 0);
    }
}

mod acquire {
    use super::*;

    // rate-limiter.spec.ts:114
    #[tokio::test(start_paused = true)]
    async fn grants_a_slot_that_is_held_until_release() {
        let limiter = limiter_at(50);
        let mut tasks = occupy(&limiter, 50);
        advance(3000).await;

        // The in-flight cap is full, so an acquire waits for a release.
        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 1000).await);
        tasks[0].release();
        assert!(settled_after(&mut next, 20).await);
    }
}

mod brake {
    use super::*;

    // rate-limiter.spec.ts:128
    #[tokio::test(start_paused = true)]
    async fn a_420_holds_every_acquire_until_x_esi_error_limit_reset_elapses() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            420,
            &headers(&[("x-esi-error-limit-reset", "30")]),
        );

        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 29_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:137
    #[tokio::test(start_paused = true)]
    async fn a_420_without_a_reset_header_pauses_60_s() {
        let limiter = limiter_at(50);
        limiter.observe(&route(), 420, &headers(&[]));

        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 59_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:146
    #[tokio::test(start_paused = true)]
    async fn error_limit_remain_19_pauses_for_the_reset_20_does_not() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            200,
            &headers(&[
                ("x-esi-error-limit-remain", "20"),
                ("x-esi-error-limit-reset", "30"),
            ]),
        );
        let mut free = Slot::new(&limiter, &route(), None);
        assert!(settled_after(&mut free, 0).await);

        limiter.observe(
            &route(),
            404,
            &headers(&[
                ("x-esi-error-limit-remain", "19"),
                ("x-esi-error-limit-reset", "30"),
            ]),
        );
        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 29_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:163
    #[tokio::test(start_paused = true)]
    async fn a_blank_error_limit_remain_is_no_value_so_it_never_brakes() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            200,
            &headers(&[
                ("x-esi-error-limit-remain", ""),
                ("x-esi-error-limit-reset", "30"),
            ]),
        );

        let mut next = Slot::new(&limiter, &route(), None);
        assert!(settled_after(&mut next, 0).await);
    }

    // rate-limiter.spec.ts:173
    #[tokio::test(start_paused = true)]
    async fn error_limit_reset_0_or_negative_never_pauses() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            200,
            &headers(&[
                ("x-esi-error-limit-remain", "5"),
                ("x-esi-error-limit-reset", "0"),
            ]),
        );
        limiter.observe(
            &route(),
            420,
            &headers(&[("x-esi-error-limit-reset", "-3")]),
        );

        assert!(limiter
            .stats()
            .paused_until
            .is_none_or(|until| until <= Instant::now()));
        let mut next = Slot::new(&limiter, &route(), None);
        assert!(settled_after(&mut next, 0).await);
    }

    // rate-limiter.spec.ts:185
    #[tokio::test(start_paused = true)]
    async fn a_header_less_429_pauses_for_retry_after_15_s_if_missing_or_not_a_number() {
        let limiter = limiter_at(50);
        limiter.observe(&route(), 429, &headers(&[("retry-after", "5")]));
        let mut first = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut first, 4_999).await);
        assert!(settled_after(&mut first, 1).await);

        limiter.observe(&route(), 429, &headers(&[("retry-after", "abc")]));
        let mut second = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut second, 14_999).await);
        assert!(settled_after(&mut second, 1).await);

        limiter.observe(&route(), 429, &headers(&[]));
        let mut third = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut third, 14_999).await);
        assert!(settled_after(&mut third, 1).await);
    }

    // rate-limiter.spec.ts:203
    #[tokio::test(start_paused = true)]
    async fn caps_any_pause_at_15_minutes() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            420,
            &headers(&[("x-esi-error-limit-reset", "99999")]),
        );

        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 899_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:212
    #[tokio::test(start_paused = true)]
    async fn a_shorter_pause_never_shortens_a_longer_one_already_in_force() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            420,
            &headers(&[("x-esi-error-limit-reset", "60")]),
        );
        limiter.observe(&route(), 429, &headers(&[("retry-after", "5")]));

        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 59_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:222
    #[tokio::test(start_paused = true)]
    async fn a_429_that_carries_x_ratelimit_group_does_not_set_the_process_brake() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            429,
            &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "30")]),
        );

        let stats = limiter.stats();
        assert_eq!(stats.paused_until, None);
        assert_eq!(stats.current_rate, 50);
        // The 429 taught the limiter that this route is in 'killmail'; any
        // other route is still free to go.
        let mut other = Slot::new(&limiter, &EsiRoute::new("/universe/types/587/"), None);
        assert!(settled_after(&mut other, 0).await);
    }

    // rate-limiter.spec.ts:239
    #[tokio::test(start_paused = true)]
    async fn logs_a_pause_once_not_once_per_throttled_response() {
        let (_guard, warnings) = capture_warnings();
        let limiter = limiter_at(50);
        for _ in 0..25 {
            limiter.observe(&route(), 429, &headers(&[]));
        }

        let warnings = warnings.lock().unwrap();
        assert_eq!(warnings.len(), 1, "{warnings:?}");
        assert!(regex_match(r"429.*15 s", &warnings[0]), "{}", warnings[0]);
    }
}

mod adaptive_rate {
    use super::*;

    // rate-limiter.spec.ts:249
    #[tokio::test(start_paused = true)]
    async fn a_header_less_429_cuts_the_rate_by_a_quarter() {
        let limiter = limiter_at(50);
        limiter.observe(&route(), 429, &headers(&[]));

        assert_eq!(limiter.stats().current_rate, 37);
    }

    // rate-limiter.spec.ts:256
    #[tokio::test(start_paused = true)]
    async fn never_goes_below_1_req_per_s() {
        let limiter = limiter_at(50);
        // 10 s apart, so each 429 is a new event rather than an echo.
        // 50 → 37 → 27 → 20 → 15 → 11 → 8 → 6 → 4 → 3 → 2 → 1
        for _ in 0..14 {
            limiter.observe(&route(), 429, &headers(&[("retry-after", "1")]));
            advance(10_000).await;
        }

        assert_eq!(limiter.stats().current_rate, 1);
    }

    // rate-limiter.spec.ts:268
    #[tokio::test(start_paused = true)]
    async fn _429s_that_arrive_while_a_pause_is_in_force_lower_the_rate_only_once() {
        let limiter = limiter_at(50);
        for _ in 0..25 {
            limiter.observe(&route(), 429, &headers(&[]));
        }

        assert_eq!(limiter.stats().current_rate, 37);
    }

    // rate-limiter.spec.ts:275
    #[tokio::test(start_paused = true)]
    async fn _429s_within_10_s_of_a_decrease_lower_the_rate_only_once_even_with_no_brake() {
        let limiter = limiter_at(50);
        for _ in 0..25 {
            limiter.observe(&route(), 429, &headers(&[("retry-after", "0")]));
            advance(300).await;
        }

        assert_eq!(limiter.stats().current_rate, 37);
    }

    // rate-limiter.spec.ts:285
    #[tokio::test(start_paused = true)]
    async fn climbs_1_req_per_s_per_10_s_once_requests_resume_up_to_esi_max_rps() {
        let limiter = limiter_at(50);
        limiter.observe(&route(), 429, &headers(&[])); // 15 s brake

        advance(15_000).await;
        assert_eq!(limiter.stats().current_rate, 37);
        advance(9_999).await;
        assert_eq!(limiter.stats().current_rate, 37);
        advance(1).await;
        assert_eq!(limiter.stats().current_rate, 38);
        advance(120_000).await;
        assert_eq!(limiter.stats().current_rate, 50);
        advance(3_600_000).await;
        assert_eq!(limiter.stats().current_rate, 50);
    }

    // rate-limiter.spec.ts:301
    #[tokio::test(start_paused = true)]
    async fn dispatches_at_the_lowered_rate() {
        let limiter = limiter_at(8); // 125 ms spacing
        limiter.observe(&route(), 429, &headers(&[("retry-after", "1")])); // rate 6, 166 ms
        advance(1000).await;
        let mut tasks = occupy(&limiter, 5);

        advance(497).await;
        assert_eq!(granted_count(&mut tasks), 3);
        advance(1).await;
        assert_eq!(granted_count(&mut tasks), 4);
    }
}

mod max_wait {
    use super::*;

    const TEN_S: Option<Duration> = Some(Duration::from_millis(10_000));

    // rate-limiter.spec.ts:316
    #[tokio::test(start_paused = true)]
    async fn rejects_with_esi_throttled_when_the_brake_outlasts_max_wait() {
        let limiter = limiter_at(50);

        limiter.observe(&route(), 429, &headers(&[]));
        let mut deep = Slot::new(&limiter, &route(), TEN_S);
        let error = deep.error();
        assert_eq!((error.status, error.kind), (429, ThrottleKind::DeepLimit));

        limiter.observe(
            &route(),
            420,
            &headers(&[("x-esi-error-limit-reset", "120")]),
        );
        let mut error_limit = Slot::new(&limiter, &route(), TEN_S);
        let error = error_limit.error();
        assert_eq!((error.status, error.kind), (420, ThrottleKind::ErrorLimit));
    }

    // rate-limiter.spec.ts:339
    #[tokio::test(start_paused = true)]
    async fn rejects_a_queued_acquire_when_a_brake_set_after_it_outlasts_its_max_wait() {
        let limiter = limiter_at(50);
        let mut tasks = occupy(&limiter, 50);
        advance(3000).await;

        // Both wait behind the full in-flight cap when the brake starts.
        let mut bounded = Slot::new(&limiter, &route(), TEN_S);
        let mut unbounded = Slot::new(&limiter, &route(), None);
        assert!(!bounded.settled());
        limiter.observe(&route(), 429, &headers(&[])); // 15 s brake

        let error = bounded.error();
        assert_eq!((error.status, error.kind), (429, ThrottleKind::DeepLimit));
        tasks[0].release();
        assert!(!settled_after(&mut unbounded, 14_999).await);
        assert!(settled_after(&mut unbounded, 1).await);
    }

    // rate-limiter.spec.ts:362
    #[tokio::test(start_paused = true)]
    async fn waits_when_the_brake_ends_within_max_wait() {
        let limiter = limiter_at(50);
        limiter.observe(&route(), 429, &headers(&[("retry-after", "5")]));

        let mut next = Slot::new(&limiter, &route(), TEN_S);
        assert!(!settled_after(&mut next, 4_999).await);
        assert!(settled_after(&mut next, 1).await);
        assert!(next.granted());
    }

    // rate-limiter.spec.ts:372
    #[tokio::test(start_paused = true)]
    async fn without_max_wait_waits_out_the_whole_brake() {
        let limiter = limiter_at(50);
        limiter.observe(
            &route(),
            420,
            &headers(&[("x-esi-error-limit-reset", "600")]),
        );

        let mut next = Slot::new(&limiter, &route(), None);
        assert!(!settled_after(&mut next, 599_999).await);
        assert!(settled_after(&mut next, 1).await);
        assert!(next.granted());
    }
}

mod group_buckets {
    use super::*;

    // rate-limiter.spec.ts:418
    #[tokio::test(start_paused = true)]
    async fn above_20_percent_remaining_a_grouped_route_is_not_spaced() {
        let limiter = limiter_at(50);
        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 720));

        let mut first = Slot::new(&limiter, &killmail(), None);
        let mut second = Slot::new(&limiter, &killmail(), None);
        assert!(settled_after(&mut first, 0).await);
        // Only the base 20 ms dispatch spacing applies.
        assert!(settled_after(&mut second, 20).await);
    }

    // rate-limiter.spec.ts:429
    #[tokio::test(start_paused = true)]
    async fn below_20_percent_remaining_spaces_requests_window_over_limit_times_2_apart() {
        let limiter = limiter_at(50);
        // 900_000 / 3600 * 2 = 500 ms, the pace the bucket refills at
        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 600));

        let mut first = Slot::new(&limiter, &killmail(), None);
        let mut second = Slot::new(&limiter, &killmail(), None);
        assert!(settled_after(&mut first, 0).await);
        assert!(!settled_after(&mut second, 499).await);
        assert!(settled_after(&mut second, 1).await);
    }

    // rate-limiter.spec.ts:441
    #[tokio::test(start_paused = true)]
    async fn the_gap_does_not_grow_as_the_remaining_tokens_shrink() {
        for remaining in [2, 3] {
            let limiter = limiter_at(50);
            limiter.observe(
                &killmail(),
                200,
                &grouped("killmail", "3600/15m", remaining),
            );

            let mut first = Slot::new(&limiter, &killmail(), None);
            let mut second = Slot::new(&limiter, &killmail(), None);
            assert!(settled_after(&mut first, 0).await);
            assert!(!settled_after(&mut second, 499).await);
            assert!(settled_after(&mut second, 1).await);
        }
    }

    // rate-limiter.spec.ts:458
    #[tokio::test(start_paused = true)]
    async fn spaces_char_killmail_60_s_apart_below_20_percent_remaining() {
        let limiter = limiter_at(50);
        let recent = EsiRoute::with_bucket_key("/characters/9/killmails/recent/", "9");
        // 900_000 / 30 * 2 = 60_000 ms
        limiter.observe(&recent, 200, &grouped("char-killmail", "30/15m", 5));

        let mut first = Slot::new(&limiter, &recent, None);
        let mut second = Slot::new(&limiter, &recent, None);
        assert!(settled_after(&mut first, 0).await);
        assert!(!settled_after(&mut second, 59_999).await);
        assert!(settled_after(&mut second, 1).await);
    }

    // rate-limiter.spec.ts:471
    #[tokio::test(start_paused = true)]
    async fn remaining_below_2_holds_the_request_until_a_token_is_due_back() {
        let limiter = limiter_at(50);
        // window / limit * 2 = 900_000 / 3600 * 2 = 500 ms
        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 1));

        let mut next = Slot::new(&limiter, &killmail(), None);
        assert!(!settled_after(&mut next, 0).await);
        assert!(!settled_after(&mut next, 499).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:482
    #[tokio::test(start_paused = true)]
    async fn a_grouped_429_pauses_only_that_group_for_retry_after() {
        let limiter = limiter_at(50);
        limiter.observe(&status_route(), 200, &grouped("status", "600/15m", 600));
        let mut paused_headers = grouped("killmail", "3600/15m", 0);
        paused_headers.insert("retry-after".into(), "30".into());
        limiter.observe(&killmail(), 429, &paused_headers);

        // Queued first, yet it does not hold up the two behind it.
        let mut paused = Slot::new(&limiter, &killmail(), None);
        let mut other_group = Slot::new(&limiter, &status_route(), None);
        let mut ungrouped = Slot::new(&limiter, &route(), None);
        assert!(settled_after(&mut other_group, 20).await);
        assert!(settled_after(&mut ungrouped, 20).await);
        assert!(!settled_after(&mut paused, 29_959).await);
        assert!(settled_after(&mut paused, 1).await);
        let stats = limiter.stats();
        assert_eq!(stats.paused_until, None);
        assert_eq!(stats.current_rate, 50);
    }

    // rate-limiter.spec.ts:504
    #[tokio::test(start_paused = true)]
    async fn a_grouped_429_without_retry_after_pauses_the_group_60_s_capped_at_15_min() {
        let limiter = limiter_at(50);
        limiter.observe(
            &killmail(),
            429,
            &headers(&[("x-ratelimit-group", "killmail")]),
        );
        let mut first = Slot::new(&limiter, &killmail(), None);
        assert!(!settled_after(&mut first, 59_999).await);
        assert!(settled_after(&mut first, 1).await);

        limiter.observe(
            &killmail(),
            429,
            &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "99999")]),
        );
        let mut second = Slot::new(&limiter, &killmail(), None);
        assert!(!settled_after(&mut second, 899_999).await);
        assert!(settled_after(&mut second, 1).await);
    }

    // rate-limiter.spec.ts:520
    #[tokio::test(start_paused = true)]
    async fn a_shorter_group_pause_never_shortens_a_longer_one() {
        let limiter = limiter_at(50);
        limiter.observe(
            &killmail(),
            429,
            &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "60")]),
        );
        limiter.observe(
            &killmail(),
            429,
            &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "5")]),
        );

        let mut next = Slot::new(&limiter, &killmail(), None);
        assert!(!settled_after(&mut next, 59_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:531
    #[tokio::test(start_paused = true)]
    async fn logs_a_group_pause_once_naming_the_group() {
        let (_guard, warnings) = capture_warnings();
        let limiter = limiter_at(50);
        for _ in 0..10 {
            limiter.observe(
                &killmail(),
                429,
                &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "30")]),
            );
        }

        let warnings = warnings.lock().unwrap();
        assert_eq!(warnings.len(), 1, "{warnings:?}");
        assert!(
            regex_match(r"429.*killmail.*30 s", &warnings[0]),
            "{}",
            warnings[0]
        );
    }

    // rate-limiter.spec.ts:544
    #[tokio::test(start_paused = true)]
    async fn a_fresh_response_replaces_the_remembered_remaining() {
        let limiter = limiter_at(50);
        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 0));
        let mut held = Slot::new(&limiter, &killmail(), None);
        assert!(!settled_after(&mut held, 100).await);

        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 3000));
        assert!(settled_after(&mut held, 0).await);
        let mut next = Slot::new(&limiter, &killmail(), None);
        assert!(settled_after(&mut next, 20).await);
    }

    // rate-limiter.spec.ts:555
    #[tokio::test(start_paused = true)]
    async fn separates_buckets_by_bucket_key() {
        let limiter = limiter_at(50);
        let recent = "/characters/365974960/killmails/recent/";
        limiter.observe(
            &EsiRoute::with_bucket_key(recent, "1"),
            200,
            &grouped("char-killmail", "30/15m", 0),
        );

        let mut one = Slot::new(&limiter, &EsiRoute::with_bucket_key(recent, "1"), None);
        let mut two = Slot::new(&limiter, &EsiRoute::with_bucket_key(recent, "2"), None);
        assert!(settled_after(&mut two, 20).await);
        assert!(!settled_after(&mut one, 0).await);
    }

    // rate-limiter.spec.ts:570
    #[tokio::test(start_paused = true)]
    async fn an_unseen_route_template_is_not_spaced() {
        let limiter = limiter_at(50);
        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 0));

        let mut other = Slot::new(
            &limiter,
            &EsiRoute::new("/characters/9/killmails/recent/"),
            None,
        );
        assert!(settled_after(&mut other, 0).await);
    }

    // rate-limiter.spec.ts:578
    #[tokio::test(start_paused = true)]
    async fn parses_limits_in_hours_as_well_as_minutes() {
        let limiter = limiter_at(50);
        // window 3_600_000 → 3_600_000 / 150 * 2 = 48_000 ms
        limiter.observe(&status_route(), 200, &grouped("status", "150/1h", 0));

        let mut next = Slot::new(&limiter, &status_route(), None);
        assert!(!settled_after(&mut next, 47_999).await);
        assert!(settled_after(&mut next, 1).await);
    }

    // rate-limiter.spec.ts:588
    #[tokio::test(start_paused = true)]
    async fn rejects_at_once_when_the_group_wait_outlasts_max_wait() {
        let limiter = limiter_at(50);
        limiter.observe(
            &killmail(),
            429,
            &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "30")]),
        );

        let mut bounded = Slot::new(&limiter, &killmail(), Some(Duration::from_millis(10_000)));
        let error = bounded.error();
        assert_eq!((error.status, error.kind), (429, ThrottleKind::RateLimit));
        let mut within = Slot::new(&limiter, &killmail(), Some(Duration::from_millis(40_000)));
        assert!(settled_after(&mut within, 30_000).await);
        assert!(within.granted());
    }

    // rate-limiter.spec.ts:608
    #[tokio::test(start_paused = true)]
    async fn rejects_a_waiting_acquire_when_a_group_pause_set_after_it_outlasts_max_wait() {
        let limiter = limiter_at(50);
        limiter.observe(&killmail(), 200, &grouped("killmail", "3600/15m", 1));

        // Held 500 ms for a token when the 429 arrives.
        let mut bounded = Slot::new(&limiter, &killmail(), Some(Duration::from_millis(10_000)));
        let mut unbounded = Slot::new(&limiter, &killmail(), None);
        advance(100).await;
        assert!(!bounded.settled());
        limiter.observe(
            &killmail(),
            429,
            &headers(&[("x-ratelimit-group", "killmail"), ("retry-after", "60")]),
        );

        assert_eq!(bounded.error().kind, ThrottleKind::RateLimit);
        assert!(!settled_after(&mut unbounded, 59_999).await);
        assert!(settled_after(&mut unbounded, 1).await);
    }
}

fn regex_match(pattern: &str, text: &str) -> bool {
    // A dependency for two assertions is not worth it: these patterns are
    // literal runs joined by `.*`, so match the runs in order.
    let mut rest = text;
    for part in pattern.split(".*") {
        match rest.find(part) {
            Some(at) => rest = &rest[at + part.len()..],
            None => return false,
        }
    }
    true
}
