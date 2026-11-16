//! `handle` against a mock ESI, a recording publisher and a real PostgreSQL.

use std::sync::Mutex;

use anyhow::anyhow;
use esi::{EsiClient, RateLimiter};
use futures_util::future::BoxFuture;
use mq::EntityMessage;
use runner::{Context, Outcome, Publisher, Worker};
use serde_json::json;
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_alliance_corporations::AllianceCorporationWorker;

#[derive(Debug)]
struct Published {
    queue: String,
    priority: Option<u8>,
    ids: Vec<i32>,
    sources: Vec<String>,
}

#[derive(Default)]
struct Recorder {
    calls: Mutex<Vec<Published>>,
    fail: bool,
}

impl Publisher for Recorder {
    fn publish<'a>(
        &'a self,
        queue: &'a str,
        messages: &'a [EntityMessage],
        priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move {
            if self.fail {
                return Err(anyhow!("nack"));
            }
            self.calls.lock().unwrap().push(Published {
                queue: queue.to_string(),
                priority,
                ids: messages.iter().map(|m| m.entity_id).collect(),
                sources: messages.iter().map(|m| m.source.to_string()).collect(),
            });
            Ok(messages.len() as u64)
        })
    }
}

async fn worker(pool: PgPool, server: &MockServer) -> AllianceCorporationWorker {
    AllianceCorporationWorker {
        pool,
        esi: EsiClient::with_base_url(RateLimiter::new(50), server.uri()),
    }
}

async fn mock_corps(server: &MockServer, id: i32, corps: serde_json::Value) {
    Mock::given(method("GET"))
        .and(path(format!("/alliances/{id}/corporations")))
        .respond_with(ResponseTemplate::new(200).set_body_json(corps))
        .expect(1)
        .mount(server)
        .await;
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn publishes_one_message_per_corporation(pool: PgPool) {
    let server = MockServer::start().await;
    mock_corps(&server, 99000001, json!([98000001, 98000002])).await;
    let recorder = Recorder::default();
    let processed = worker(pool, &server)
        .await
        .handle(99000001, &Context::new(&recorder))
        .await
        .unwrap();

    let calls = recorder.calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].queue, "esi_corporation_info_queue");
    assert_eq!(calls[0].priority, Some(3));
    assert_eq!(calls[0].ids, [98000001, 98000002]);
    assert!(calls[0].sources.iter().all(|s| s == "alliance_99000001"));
    assert_eq!(processed.outcome, Outcome::Queued(2));
    assert_eq!(
        processed.detail,
        "[99000001] Test Alliance [TEST] - queued 2 corps"
    );
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn an_empty_list_publishes_nothing(pool: PgPool) {
    let server = MockServer::start().await;
    mock_corps(&server, 99000001, json!([])).await;
    let recorder = Recorder::default();
    let processed = worker(pool, &server)
        .await
        .handle(99000001, &Context::new(&recorder))
        .await
        .unwrap();

    assert!(recorder.calls.lock().unwrap().is_empty());
    assert_eq!(processed.outcome, Outcome::Queued(0));
    assert_eq!(
        processed.detail,
        "[99000001] Test Alliance [TEST] - no corporations"
    );
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn an_unknown_alliance_is_labelled_unknown(pool: PgPool) {
    let server = MockServer::start().await;
    mock_corps(&server, 99000999, json!([98000001])).await;
    let recorder = Recorder::default();
    let processed = worker(pool, &server)
        .await
        .handle(99000999, &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(
        processed.detail,
        "[99000999] Unknown [???] - queued 1 corps"
    );
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn a_failed_publish_is_an_error(pool: PgPool) {
    let server = MockServer::start().await;
    mock_corps(&server, 99000001, json!([98000001])).await;
    let recorder = Recorder {
        fail: true,
        ..Recorder::default()
    };
    let result = worker(pool, &server)
        .await
        .handle(99000001, &Context::new(&recorder))
        .await;

    assert!(result.is_err());
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn the_esi_path_has_no_trailing_slash(pool: PgPool) {
    let server = MockServer::start().await;
    // `.expect(1)` on exactly this path: a trailing slash would miss it.
    mock_corps(&server, 99000001, json!([98000001])).await;
    let recorder = Recorder::default();
    worker(pool, &server)
        .await
        .handle(99000001, &Context::new(&recorder))
        .await
        .unwrap();
}
