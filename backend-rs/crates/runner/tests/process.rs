//! Per-message processing: what `process_one` settles and counts for each
//! outcome of `Worker::handle`.

use std::future::Future;
use std::sync::Mutex;

use anyhow::anyhow;
use lapin::types::FieldTable;
use mq::Settle;
use runner::{process_one, success_line, Processed, Totals, Worker};

#[test]
fn success_line_keeps_each_workers_own_shape() {
    let alliance = Processed {
        inserted: true,
        detail: " Foo [FOO] ID:99000001".into(),
    };
    assert_eq!(
        success_line(12, &alliance),
        "  ✅ [12] Foo [FOO] ID:99000001 (created)"
    );
    let corp = Processed {
        inserted: false,
        detail: "[98000001] Foo [FOO]".into(),
    };
    assert_eq!(
        success_line(12, &corp),
        "  ✅ [12][98000001] Foo [FOO] (updated)"
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
    const PREFETCH_COUNT: u16 = 1;
    const CONSUMER_TAG: &'static str = "fake";
    const STARTED: &'static str = "fake worker started";
    const WAITING_FOR: &'static str = "fakes";
    const ENTITY: &'static str = "fake";

    fn handle(&self, id: i32) -> impl Future<Output = anyhow::Result<Processed>> + Send {
        self.seen.lock().unwrap().push(id);
        let result = (self.result)();
        async move { result }
    }
}

fn created() -> anyhow::Result<Processed> {
    Ok(Processed {
        inserted: true,
        detail: " Foo".into(),
    })
}

fn updated() -> anyhow::Result<Processed> {
    Ok(Processed {
        inserted: false,
        detail: " Foo".into(),
    })
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
    process_one(&worker, &settle, &totals).await;
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
    process_one(&worker, &settle, &totals).await;
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
    process_one(&worker, &settle, &totals).await;
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
    process_one(&worker, &settle, &totals).await;
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
    process_one(&worker, &settle, &totals).await;
    assert_eq!(settle.calls(), vec![Call::Ack]);
    assert_eq!(totals.errors(), 1);
}
