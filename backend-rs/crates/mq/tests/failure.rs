//! Port of `backend/src/workers/worker-error.spec.ts`.
//!
//! Every case keeps its name and carries the line it came from. The Node
//! errors are duck-typed objects; here each becomes the Rust error that a
//! caller would actually return for it:
//!
//! | Node                                        | Rust                                  |
//! | ------------------------------------------- | ------------------------------------- |
//! | `new EsiThrottledError(...)`                | `EsiThrottled`                        |
//! | `{ response: { status } }` (+ `message`)    | `HttpStatusError { status, message }` |
//! | `new Error('...')`                          | `anyhow!("...")`                      |

use std::future::Future;
use std::sync::Mutex;
use std::time::Duration;

use anyhow::anyhow;
use esi::{EsiThrottled, ThrottleKind};
use lapin::types::{AMQPValue, FieldArray, FieldTable, LongString, ShortString};
use mq::{
    death_count, handle_worker_error, is_forbidden, HttpStatusError, Settle, WorkerLog,
    MAX_ATTEMPTS,
};
use tokio::time::Instant;

#[derive(Debug, Clone, PartialEq)]
enum Call {
    Ack,
    Nack { requeue: bool },
    Park { headers: Option<FieldTable> },
}

/// A delivery, with however many dead-letter hops RabbitMQ has recorded.
struct Fake {
    headers: Option<FieldTable>,
    calls: Mutex<Vec<Call>>,
}

fn message(deaths: Option<i64>) -> Fake {
    let mut headers = FieldTable::default();
    if let Some(count) = deaths {
        let mut death = FieldTable::default();
        death.insert(ShortString::from("count"), AMQPValue::LongLongInt(count));
        death.insert(
            ShortString::from("queue"),
            AMQPValue::LongString(LongString::from("esi_type_info_queue")),
        );
        headers.insert(
            ShortString::from("x-death"),
            AMQPValue::FieldArray(FieldArray::from(vec![AMQPValue::FieldTable(death)])),
        );
    }
    Fake {
        headers: Some(headers),
        calls: Mutex::new(Vec::new()),
    }
}

impl Fake {
    fn calls(&self) -> Vec<Call> {
        self.calls.lock().unwrap().clone()
    }
    fn record(&self, call: Call) {
        self.calls.lock().unwrap().push(call);
    }
    fn acks(&self) -> usize {
        self.calls().iter().filter(|c| **c == Call::Ack).count()
    }
    fn nacks(&self) -> Vec<bool> {
        self.calls()
            .iter()
            .filter_map(|c| match c {
                Call::Nack { requeue } => Some(*requeue),
                _ => None,
            })
            .collect()
    }
    fn parks(&self) -> Vec<Option<FieldTable>> {
        self.calls()
            .iter()
            .filter_map(|c| match c {
                Call::Park { headers } => Some(headers.clone()),
                _ => None,
            })
            .collect()
    }
}

impl Settle for Fake {
    fn headers(&self) -> Option<&FieldTable> {
        self.headers.as_ref()
    }
    fn body(&self) -> &[u8] {
        b"4321"
    }
    fn ack(&self) -> impl Future<Output = Result<(), lapin::Error>> + Send {
        self.record(Call::Ack);
        async { Ok(()) }
    }
    fn nack(&self, requeue: bool) -> impl Future<Output = Result<(), lapin::Error>> + Send {
        self.record(Call::Nack { requeue });
        async { Ok(()) }
    }
    fn park(&self) -> impl Future<Output = Result<(), lapin::Error>> + Send {
        self.record(Call::Park {
            headers: self.headers.clone(),
        });
        async { Ok(()) }
    }
}

#[derive(Default)]
struct Log {
    warnings: Mutex<Vec<String>>,
    errors: Mutex<Vec<String>>,
}

impl WorkerLog for Log {
    fn warn(&self, message: &str) {
        self.warnings.lock().unwrap().push(message.to_owned());
    }
    fn error(&self, message: &str, _error: &anyhow::Error) {
        self.errors.lock().unwrap().push(message.to_owned());
    }
}

impl Log {
    fn warned(&self, message: &str) -> bool {
        self.warnings.lock().unwrap().iter().any(|m| m == message)
    }
}

fn http(status: u16, message: &str) -> anyhow::Error {
    anyhow::Error::new(HttpStatusError {
        status,
        message: message.to_owned(),
    })
}

/// A Prisma failure carries the call site and a numbered code frame in its
/// message. Matching a status anywhere in that text means an unrelated edit
/// that shifts a worker's line numbers can reclassify a database error as an
/// HTTP one (#235). (worker-error.spec.ts:374)
fn prisma_error(line: u32) -> anyhow::Error {
    anyhow!(
        "{}",
        [
            "Invalid `prismaWorker.user.update()` invocation in".to_owned(),
            format!("/root/killreport/backend/src/workers/worker-esi-user-killmails.ts:{line}:35"),
            String::new(),
            format!("  {} }});", line - 2),
            format!("  {}", line - 1),
            format!("→ {line} await prismaWorker.user.update({{"),
            "An operation failed because it depends on one or more records that were required but not found.".to_owned(),
        ]
        .join("\n")
    )
}

/// Run a branch that sleeps: it must not have settled after 59 999 ms and
/// must have requeued at 60 000 ms.
async fn assert_waits_60_s_then_requeues(
    fake: &Fake,
    queue: &str,
    error: anyhow::Error,
    log: &Log,
) {
    let mut done = std::pin::pin!(handle_worker_error(fake, queue, &error, log));
    // The timer is the behaviour in this branch: without the sleep, the
    // function would fall straight through to nack, and the assertions below
    // would pass whether or not the wait happened.
    assert!(
        tokio::time::timeout(Duration::from_millis(59_999), done.as_mut())
            .await
            .is_err(),
        "settled before 60 s"
    );
    assert!(fake.nacks().is_empty());
    done.await.unwrap();
    assert_eq!(fake.nacks(), vec![true]);
}

mod death_count_ {
    use super::*;

    // worker-error.spec.ts:43
    #[test]
    fn is_0_on_a_first_delivery_which_carries_no_x_death() {
        assert_eq!(death_count(message(None).headers.as_ref()), 0);
    }

    // worker-error.spec.ts:47
    #[test]
    fn reads_the_brokers_own_counter() {
        assert_eq!(death_count(message(Some(3)).headers.as_ref()), 3);
    }
}

mod handle_worker_error_ {
    use super::*;

    // worker-error.spec.ts:53
    #[tokio::test(start_paused = true)]
    async fn requeues_an_esi_throttled_at_once_without_sleeping_or_burning_an_attempt() {
        let (fake, log) = (message(Some(2)), Log::default());
        let before = Instant::now();
        handle_worker_error(
            &fake,
            "esi_type_info_queue",
            &anyhow::Error::new(EsiThrottled::new(429, ThrottleKind::DeepLimit, "x")),
            &log,
        )
        .await
        .unwrap();
        // The brake is in the limiter, so the worker has nothing to wait for.
        assert_eq!(Instant::now(), before);

        assert_eq!(fake.calls(), vec![Call::Nack { requeue: true }]);
        assert!(log.warned("⏸ esi throttled (deep-limit), requeueing"));
    }

    // worker-error.spec.ts:78
    #[tokio::test(start_paused = true)]
    async fn still_sleeps_60_s_for_a_429_that_did_not_come_from_the_esi_client() {
        let (fake, log) = (message(Some(2)), Log::default());
        assert_waits_60_s_then_requeues(&fake, "zkillboard_character_queue", http(429, ""), &log)
            .await;
        assert!(log.warned("🛑 rate limited (429)! waiting 60 seconds..."));
    }

    // worker-error.spec.ts:98
    #[tokio::test(start_paused = true)]
    async fn waits_and_requeues_on_420_without_burning_an_attempt() {
        let (fake, log) = (message(Some(4)), Log::default());
        assert_waits_60_s_then_requeues(&fake, "esi_type_info_queue", http(420, ""), &log).await;
        // requeue: true — back to the head of its own queue, no DLX hop, so
        // the attempt counter does not move.
        assert!(log.warned("🛑 error limited (420)! waiting 60 seconds..."));
        assert!(fake.parks().is_empty());
    }

    // worker-error.spec.ts:128
    #[tokio::test(start_paused = true)]
    async fn waits_and_requeues_on_429_without_burning_an_attempt() {
        let (fake, log) = (message(Some(4)), Log::default());
        assert_waits_60_s_then_requeues(&fake, "esi_type_info_queue", http(429, ""), &log).await;
        assert!(log.warned("🛑 rate limited (429)! waiting 60 seconds..."));
        assert!(fake.parks().is_empty());
    }

    // worker-error.spec.ts:158
    #[tokio::test(start_paused = true)]
    async fn waits_and_requeues_on_a_420_detected_from_the_error_message() {
        // The shape a fetch() caller throws: no status field, the code only
        // in the message text.
        let (fake, log) = (message(Some(4)), Log::default());
        assert_waits_60_s_then_requeues(
            &fake,
            "esi_type_info_queue",
            anyhow!("zKillboard API error: 420"),
            &log,
        )
        .await;
        assert!(log.warned("🛑 error limited (420)! waiting 60 seconds..."));
        assert!(fake.parks().is_empty());
    }

    // worker-error.spec.ts:188
    #[tokio::test(start_paused = true)]
    async fn waits_and_requeues_on_a_429_detected_from_the_error_message() {
        let (fake, log) = (message(Some(4)), Log::default());
        assert_waits_60_s_then_requeues(
            &fake,
            "esi_type_info_queue",
            anyhow!("Failed to fetch character killmails: 429 - Too Many Requests"),
            &log,
        )
        .await;
        assert!(log.warned("🛑 rate limited (429)! waiting 60 seconds..."));
        assert!(fake.parks().is_empty());
    }

    // worker-error.spec.ts:214
    #[tokio::test(start_paused = true)]
    async fn does_not_treat_a_status_like_substring_as_a_rate_limit_word_boundary() {
        // "1420" or "4291" must not match \b(420|429)\b.
        let (fake, log) = (message(Some(1)), Log::default());
        handle_worker_error(
            &fake,
            "esi_type_info_queue",
            &anyhow!("ESI error 1420 while fetching type"),
            &log,
        )
        .await
        .unwrap();

        // Falls through to the ordinary failure path: nack without requeue.
        assert_eq!(fake.nacks(), vec![false]);
    }

    // worker-error.spec.ts:228
    #[tokio::test(start_paused = true)]
    async fn acks_a_404_detected_from_the_error_message() {
        let (fake, log) = (message(None), Log::default());
        handle_worker_error(
            &fake,
            "esi_type_info_queue",
            &anyhow!("Request failed with status code 404"),
            &log,
        )
        .await
        .unwrap();

        assert_eq!(fake.calls(), vec![Call::Ack]);
    }

    // worker-error.spec.ts:242
    #[tokio::test(start_paused = true)]
    async fn acks_a_404_detected_from_the_status_regardless_of_the_message_text() {
        let (fake, log) = (message(None), Log::default());
        handle_worker_error(&fake, "esi_type_info_queue", &http(404, "Not Found"), &log)
            .await
            .unwrap();

        assert_eq!(fake.calls(), vec![Call::Ack]);
    }

    // worker-error.spec.ts:256
    #[tokio::test(start_paused = true)]
    async fn nacks_without_requeue_so_the_message_takes_the_dlx_path() {
        let (fake, log) = (message(Some(1)), Log::default());
        handle_worker_error(&fake, "esi_type_info_queue", &anyhow!("ESI 500"), &log)
            .await
            .unwrap();

        // requeue: false is what sends it to killreport.dlx -> wait -> back.
        assert_eq!(fake.calls(), vec![Call::Nack { requeue: false }]);
    }

    // worker-error.spec.ts:270
    #[tokio::test(start_paused = true)]
    async fn parks_on_exactly_the_max_attempts_th_delivery_not_the_one_before_it() {
        // deathCount MAX_ATTEMPTS - 2 is the (MAX_ATTEMPTS - 1)th delivery:
        // still under the limit, so it retries rather than parking.
        let (fake, log) = (message(Some(i64::from(MAX_ATTEMPTS) - 2)), Log::default());
        handle_worker_error(&fake, "esi_type_info_queue", &anyhow!("ESI 500"), &log)
            .await
            .unwrap();
        assert_eq!(fake.calls(), vec![Call::Nack { requeue: false }]);

        // deathCount MAX_ATTEMPTS - 1 is the MAX_ATTEMPTS-th delivery: this is
        // the one that parks.
        let fake = message(Some(i64::from(MAX_ATTEMPTS) - 1));
        handle_worker_error(&fake, "esi_type_info_queue", &anyhow!("ESI 500"), &log)
            .await
            .unwrap();
        assert_eq!(fake.parks().len(), 1);
        assert_eq!(fake.acks(), 1);
        assert!(fake.nacks().is_empty());
    }

    // worker-error.spec.ts:304
    #[tokio::test(start_paused = true)]
    async fn forwards_x_death_on_the_parked_message_so_an_operator_can_read_its_origin() {
        let (fake, log) = (message(Some(i64::from(MAX_ATTEMPTS) - 1)), Log::default());
        handle_worker_error(&fake, "esi_type_info_queue", &anyhow!("ESI 500"), &log)
            .await
            .unwrap();

        assert_eq!(fake.parks(), vec![fake.headers.clone()]);
    }

    // worker-error.spec.ts:326
    #[tokio::test(start_paused = true)]
    async fn settles_the_message_exactly_once_on_every_path() {
        for deaths in [0, 1, i64::from(MAX_ATTEMPTS) - 1] {
            let (fake, log) = (message(Some(deaths)), Log::default());
            handle_worker_error(&fake, "esi_type_info_queue", &anyhow!("boom"), &log)
                .await
                .unwrap();
            // Settled twice is a channel error; settled zero times is a
            // worker that stops consuming once prefetch fills.
            assert_eq!(fake.acks() + fake.nacks().len(), 1, "deaths {deaths}");
        }
    }
}

mod is_forbidden_ {
    use super::*;

    // worker-error.spec.ts:347
    #[test]
    fn is_true_for_a_403_on_the_error_status() {
        assert!(is_forbidden(&http(403, "")));
    }

    // worker-error.spec.ts:351
    #[test]
    fn is_true_for_a_403_that_only_appears_in_the_message_text() {
        assert!(is_forbidden(&anyhow!("ESI returned 403 Forbidden")));
    }

    // worker-error.spec.ts:355
    #[test]
    fn does_not_treat_a_status_like_substring_as_a_403_word_boundary() {
        assert!(!is_forbidden(&anyhow!("corporation 4030 has no killmails")));
    }

    // worker-error.spec.ts:361
    #[test]
    fn is_false_for_the_other_statuses_this_module_already_routes() {
        assert!(!is_forbidden(&http(404, "")));
        assert!(!is_forbidden(&http(420, "")));
        assert!(!is_forbidden(&anyhow!("boom")));
    }
}

mod a_status_that_only_appears_past_the_first_line {
    use super::*;

    // worker-error.spec.ts:389
    #[tokio::test(start_paused = true)]
    async fn does_not_read_a_code_frame_at_line_420_as_a_rate_limit() {
        let (fake, log) = (message(None), Log::default());
        handle_worker_error(&fake, "esi_user_killmails_queue", &prisma_error(420), &log)
            .await
            .unwrap();

        // The rate limit branch requeues without burning an attempt, so a
        // false positive here loops the message forever.
        assert_eq!(fake.calls(), vec![Call::Nack { requeue: false }]);
    }

    // worker-error.spec.ts:403
    #[tokio::test(start_paused = true)]
    async fn does_not_read_a_code_frame_at_line_429_as_a_rate_limit() {
        let (fake, log) = (message(None), Log::default());
        handle_worker_error(&fake, "esi_user_killmails_queue", &prisma_error(429), &log)
            .await
            .unwrap();

        assert_eq!(fake.calls(), vec![Call::Nack { requeue: false }]);
    }

    // worker-error.spec.ts:415
    #[tokio::test(start_paused = true)]
    async fn does_not_read_a_code_frame_at_line_404_as_a_missing_record() {
        let (fake, log) = (message(None), Log::default());
        handle_worker_error(&fake, "esi_user_killmails_queue", &prisma_error(404), &log)
            .await
            .unwrap();

        // The 404 branch acks: a false positive drops the work silently.
        assert_eq!(fake.calls(), vec![Call::Nack { requeue: false }]);
    }

    // worker-error.spec.ts:429
    #[test]
    fn does_not_read_a_code_frame_at_line_403_as_forbidden() {
        assert!(!is_forbidden(&prisma_error(403)));
    }

    // worker-error.spec.ts:433
    #[tokio::test(start_paused = true)]
    async fn still_reads_the_status_line_these_services_actually_throw() {
        let (fake, log) = (message(None), Log::default());
        assert_waits_60_s_then_requeues(
            &fake,
            "zkillboard_character_queue",
            anyhow!("zKillboard request failed: 429 Too Many Requests"),
            &log,
        )
        .await;
    }
}

mod a_status_embedded_in_a_longer_number {
    use super::*;

    // worker-error.spec.ts:454
    #[tokio::test(start_paused = true)]
    async fn does_not_treat_4040_as_a_404() {
        let (fake, log) = (message(None), Log::default());
        handle_worker_error(
            &fake,
            "esi_type_info_queue",
            &anyhow!("type 4040 could not be saved"),
            &log,
        )
        .await
        .unwrap();

        assert_eq!(fake.acks(), 0);
    }
}
