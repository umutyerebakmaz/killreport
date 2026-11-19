//! Per-message processing: what `process_one` settles and counts for each
//! outcome of `Worker::handle`.

use std::future::Future;
use std::sync::Mutex;

use anyhow::anyhow;
use futures_util::future::BoxFuture;
use lapin::types::FieldTable;
use mq::EntityMessage;
use mq::Settle;
use runner::{
    process_one, queues_to_declare, success_line, Context, Outcome, Processed, Publisher,
    PublisherLost, Settled, Totals, Worker,
};

#[test]
fn success_line_keeps_each_workers_own_shape() {
    let alliance = Processed {
        outcome: Outcome::Created,
        detail: " Foo [FOO] ID:99000001".into(),
    };
    assert_eq!(
        success_line(12, &alliance),
        "  ✅ [12] Foo [FOO] ID:99000001 (created)"
    );
    let corp = Processed {
        outcome: Outcome::Updated,
        detail: "[98000001] Foo [FOO]".into(),
    };
    assert_eq!(
        success_line(12, &corp),
        "  ✅ [12][98000001] Foo [FOO] (updated)"
    );
}

#[test]
fn a_queued_line_shows_the_workers_detail() {
    let p = Processed {
        outcome: Outcome::Queued(12),
        detail: "[99000001] Foo [FOO] - queued 12 corps".into(),
    };
    assert_eq!(
        success_line(7, &p),
        "  ✅ [7][99000001] Foo [FOO] - queued 12 corps"
    );
}

#[test]
fn a_queued_nothing_line_warns() {
    let p = Processed {
        outcome: Outcome::Queued(0),
        detail: "[99000001] Foo [FOO] - no corporations".into(),
    };
    assert_eq!(
        success_line(7, &p),
        "  ⚠️  [7][99000001] Foo [FOO] - no corporations"
    );
}

#[derive(Debug, Clone, PartialEq)]
enum Call {
    Ack,
    Nack { requeue: bool },
    Park,
}

struct Fake {
    body: Vec<u8>,
    headers: Option<FieldTable>,
    calls: Mutex<Vec<Call>>,
}

impl Fake {
    fn new(body: &[u8]) -> Self {
        Self {
            body: body.to_vec(),
            headers: None,
            calls: Mutex::new(Vec::new()),
        }
    }
    fn calls(&self) -> Vec<Call> {
        self.calls.lock().unwrap().clone()
    }
    fn record(&self, call: Call) {
        self.calls.lock().unwrap().push(call);
    }
}

impl Settle for Fake {
    fn headers(&self) -> Option<&FieldTable> {
        self.headers.as_ref()
    }
    fn body(&self) -> &[u8] {
        &self.body
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
        self.record(Call::Park);
        async { Ok(()) }
    }
}

struct FakeWorker {
    result: fn() -> anyhow::Result<Processed>,
    seen: Mutex<Vec<i32>>,
}

impl FakeWorker {
    fn new(result: fn() -> anyhow::Result<Processed>) -> Self {
        Self {
            result,
            seen: Mutex::new(Vec::new()),
        }
    }
    fn seen(&self) -> Vec<i32> {
        self.seen.lock().unwrap().clone()
    }
}

impl Worker for FakeWorker {
    const QUEUE_NAME: &'static str = "esi_fake_queue";
    const CONSUMER_TAG: &'static str = "fake";
    const STARTED: &'static str = "fake worker started";
    const WAITING_FOR: &'static str = "fakes";
    const ENTITY: &'static str = "fake";

    fn handle(
        &self,
        id: i32,
        _ctx: &Context<'_>,
    ) -> impl Future<Output = anyhow::Result<Processed>> + Send {
        self.seen.lock().unwrap().push(id);
        let result = (self.result)();
        async move { result }
    }
}

fn created() -> anyhow::Result<Processed> {
    Ok(Processed {
        outcome: Outcome::Created,
        detail: " Foo".into(),
    })
}

fn updated() -> anyhow::Result<Processed> {
    Ok(Processed {
        outcome: Outcome::Updated,
        detail: " Foo".into(),
    })
}

fn queued() -> anyhow::Result<Processed> {
    Ok(Processed {
        outcome: Outcome::Queued(3),
        detail: " Foo".into(),
    })
}

fn lost() -> anyhow::Result<Processed> {
    Err(anyhow::Error::new(PublisherLost))
}

/// One `publish` call: queue, entity IDs, priority.
type Published = (String, Vec<i32>, Option<u8>);

/// Records what was published; answers with `result`.
struct FakePublisher {
    result: fn() -> anyhow::Result<u64>,
    published: Mutex<Vec<Published>>,
}

impl FakePublisher {
    fn new(result: fn() -> anyhow::Result<u64>) -> Self {
        Self {
            result,
            published: Mutex::new(Vec::new()),
        }
    }
    fn published(&self) -> Vec<Published> {
        self.published.lock().unwrap().clone()
    }
}

impl Publisher for FakePublisher {
    fn publish<'a>(
        &'a self,
        queue: &'a str,
        messages: &'a [EntityMessage],
        priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        self.published.lock().unwrap().push((
            queue.to_owned(),
            messages.iter().map(|m| m.entity_id).collect(),
            priority,
        ));
        let result = (self.result)();
        Box::pin(async move { result })
    }
}

fn two() -> anyhow::Result<u64> {
    Ok(2)
}

fn nacked() -> anyhow::Result<u64> {
    Err(anyhow!("the broker refused the message for 70"))
}

fn publisher_lost() -> anyhow::Result<u64> {
    Err(PublisherLost.into())
}

/// A fan-out worker: publishes one message per ID and reports `Queued(n)`.
struct FanOut;

impl Worker for FanOut {
    const QUEUE_NAME: &'static str = "esi_fake_queue";
    const OUTPUT_QUEUE: Option<&'static str> = Some("esi_corporation_info_queue");
    const CONSUMER_TAG: &'static str = "fan-out";
    const STARTED: &'static str = "fan-out worker started";
    const WAITING_FOR: &'static str = "fakes";
    const ENTITY: &'static str = "fake";

    async fn handle(&self, id: i32, ctx: &Context<'_>) -> anyhow::Result<Processed> {
        let messages = [EntityMessage::new(id * 10, format!("fake_{id}"))];
        let n = ctx
            .publisher()
            .publish("esi_corporation_info_queue", &messages, Some(3))
            .await?;
        Ok(Processed {
            outcome: Outcome::Queued(n),
            detail: format!(" queued {n}"),
        })
    }
}

/// `process_one` for a worker that does not publish.
async fn process<W: Worker>(worker: &W, settle: &Fake, totals: &Totals) -> Settled {
    let publisher = FakePublisher::new(two);
    process_one(worker, settle, totals, &Context::new(&publisher)).await
}

fn boom() -> anyhow::Result<Processed> {
    Err(anyhow!("boom"))
}

fn not_found() -> anyhow::Result<Processed> {
    Err(anyhow!("ESI request failed: 404 Not Found"))
}

#[tokio::test]
async fn a_new_row_is_acked_and_counted_as_created() {
    let (worker, settle, totals) = (
        FakeWorker::new(created),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    process(&worker, &settle, &totals).await;
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.processed(), 1);
    assert_eq!(totals.created(), 1);
    assert_eq!(totals.updated(), 0);
    assert_eq!(totals.errors(), 0);
    assert_eq!(worker.seen(), vec![1]);
}

#[tokio::test]
async fn an_existing_row_is_counted_as_updated() {
    let (worker, settle, totals) = (
        FakeWorker::new(updated),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    process(&worker, &settle, &totals).await;
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.updated(), 1);
    assert_eq!(totals.created(), 0);
}

#[tokio::test]
async fn a_failed_handle_goes_down_the_shared_failure_path() {
    let (worker, settle, totals) = (
        FakeWorker::new(boom),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    process(&worker, &settle, &totals).await;
    assert_eq!(settle.calls(), vec![Call::Nack { requeue: false }]);
    assert_eq!(totals.errors(), 1);
    assert_eq!(totals.processed(), 1);
}

#[tokio::test]
async fn an_unparseable_body_never_reaches_handle() {
    let (worker, settle, totals) = (
        FakeWorker::new(created),
        Fake::new(b"not json"),
        Totals::new(),
    );
    process(&worker, &settle, &totals).await;
    assert!(worker.seen().is_empty());
    assert_eq!(settle.calls(), vec![Call::Nack { requeue: false }]);
    assert_eq!(totals.errors(), 1);
}

#[tokio::test]
async fn a_404_is_acked_and_counted_as_an_error() {
    let (worker, settle, totals) = (
        FakeWorker::new(not_found),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    process(&worker, &settle, &totals).await;
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.errors(), 1);
}

#[tokio::test]
async fn a_queued_outcome_is_counted_and_acked() {
    let (worker, settle, totals) = (
        FakeWorker::new(queued),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    let settled = process(&worker, &settle, &totals).await;
    assert_eq!(settled, Settled::Settled);
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.queued(), 3);
    assert_eq!(totals.processed(), 1);
    assert_eq!(totals.created(), 0);
    assert_eq!(totals.updated(), 0);
}

#[tokio::test]
async fn a_lost_publisher_leaves_the_message_unsettled() {
    let (worker, settle, totals) = (
        FakeWorker::new(lost),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    let settled = process(&worker, &settle, &totals).await;
    assert_eq!(settled, Settled::PublisherLost);
    assert!(settle.calls().is_empty());
    assert_eq!(totals.errors(), 0);
    assert_eq!(totals.processed(), 0);
}

#[tokio::test]
async fn the_worker_publishes_through_the_context() {
    let (settle, totals, publisher) = (
        Fake::new(br#"{"entityId":7}"#),
        Totals::new(),
        FakePublisher::new(two),
    );
    let settled = process_one(&FanOut, &settle, &totals, &Context::new(&publisher)).await;
    assert_eq!(settled, Settled::Settled);
    assert_eq!(
        publisher.published(),
        vec![("esi_corporation_info_queue".to_owned(), vec![70], Some(3))]
    );
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.queued(), 2);
}

#[tokio::test]
async fn a_lost_publisher_reached_through_the_context_leaves_the_message_unsettled() {
    let (settle, totals, publisher) = (
        Fake::new(br#"{"entityId":7}"#),
        Totals::new(),
        FakePublisher::new(publisher_lost),
    );
    let settled = process_one(&FanOut, &settle, &totals, &Context::new(&publisher)).await;
    assert_eq!(settled, Settled::PublisherLost);
    assert!(settle.calls().is_empty());
    assert_eq!(totals.errors(), 0);
}

#[tokio::test]
async fn a_nacked_publish_goes_down_the_shared_failure_path() {
    let (settle, totals, publisher) = (
        Fake::new(br#"{"entityId":7}"#),
        Totals::new(),
        FakePublisher::new(nacked),
    );
    let settled = process_one(&FanOut, &settle, &totals, &Context::new(&publisher)).await;
    assert_eq!(settled, Settled::Settled);
    assert_eq!(settle.calls(), vec![Call::Nack { requeue: false }]);
    assert_eq!(totals.errors(), 1);
    assert_eq!(totals.queued(), 0);
}

#[test]
fn a_fan_out_worker_declares_its_output_queue() {
    assert_eq!(
        queues_to_declare::<FanOut>(),
        ["esi_fake_queue", "esi_corporation_info_queue"]
    );
    assert_eq!(queues_to_declare::<FakeWorker>(), ["esi_fake_queue"]);
}

#[tokio::test]
async fn the_default_summary_is_unchanged() {
    let totals = Totals::new();
    for result in [created, updated, updated, boom] {
        let (worker, settle) = (FakeWorker::new(result), Fake::new(br#"{"entityId":1}"#));
        process(&worker, &settle, &totals).await;
    }
    assert_eq!(
        FakeWorker::summary(&totals),
        "📊 final: 4 processed (1 created, 2 updated, 1 errors)"
    );
}

#[test]
fn a_saved_line_never_warns() {
    let p = Processed {
        outcome: Outcome::Saved { queued: 0 },
        detail: " character 90000001: 3 records, 0 corporations queued".into(),
    };
    assert_eq!(
        success_line(7, &p),
        "  ✅ [7] character 90000001: 3 records, 0 corporations queued"
    );
}

#[test]
fn a_saved_line_with_queued_corporations() {
    let p = Processed {
        outcome: Outcome::Saved { queued: 2 },
        detail: " character 90000001: 3 records, 2 corporations queued".into(),
    };
    assert_eq!(
        success_line(7, &p),
        "  ✅ [7] character 90000001: 3 records, 2 corporations queued"
    );
}

fn saved() -> anyhow::Result<Processed> {
    Ok(Processed {
        outcome: Outcome::Saved { queued: 2 },
        detail: " Foo".into(),
    })
}

#[tokio::test]
async fn saved_counts_into_queued() {
    let (worker, settle, totals) = (
        FakeWorker::new(saved),
        Fake::new(br#"{"entityId":1}"#),
        Totals::new(),
    );
    let settled = process(&worker, &settle, &totals).await;
    assert_eq!(settled, Settled::Settled);
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.queued(), 2);
    assert_eq!(totals.processed(), 1);
    assert_eq!(totals.created(), 0);
    assert_eq!(totals.updated(), 0);
}

fn unchanged() -> anyhow::Result<Processed> {
    Ok(Processed {
        outcome: Outcome::Unchanged,
        detail: " 34 (no Jita orders)".into(),
    })
}

#[test]
fn unchanged_line_has_a_dash() {
    let p = unchanged().unwrap();
    assert_eq!(success_line(3, &p), "  - [3] 34 (no Jita orders)");
}

#[tokio::test]
async fn an_unchanged_row_is_acked_and_counted_apart() {
    let (worker, settle, totals) = (
        FakeWorker::new(unchanged),
        Fake::new(br#"{"entityId":34}"#),
        Totals::new(),
    );
    process(&worker, &settle, &totals).await;
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.processed(), 1);
    assert_eq!(totals.unchanged(), 1);
    assert_eq!(totals.created(), 0);
    assert_eq!(totals.updated(), 0);
}

#[tokio::test]
async fn summary_mentions_unchanged_only_when_there_are_some() {
    let totals = Totals::new();
    for result in [created, updated] {
        let (worker, settle) = (FakeWorker::new(result), Fake::new(br#"{"entityId":1}"#));
        process(&worker, &settle, &totals).await;
    }
    assert!(!FakeWorker::summary(&totals).contains("unchanged"));

    let (worker, settle) = (FakeWorker::new(unchanged), Fake::new(br#"{"entityId":1}"#));
    process(&worker, &settle, &totals).await;
    assert_eq!(
        FakeWorker::summary(&totals),
        "📊 final: 3 processed (1 created, 1 updated, 1 unchanged, 0 errors)"
    );
}
