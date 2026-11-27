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
use worker_character_corporation_history::CorporationHistoryWorker;

const CHARACTER: i32 = 90000001;

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
    fn publish_killmails<'a>(
        &'a self,
        _queue: &'a str,
        _source: &'static str,
        _ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        panic!("this worker publishes no killmails")
    }
}

fn worker(pool: PgPool, server: &MockServer) -> CorporationHistoryWorker {
    CorporationHistoryWorker {
        pool,
        esi: EsiClient::with_base_url(RateLimiter::new(50), server.uri()),
    }
}

async fn mock_history(server: &MockServer, status: u16, body: serde_json::Value) {
    Mock::given(method("GET"))
        .and(path(format!("/characters/{CHARACTER}/corporationhistory/")))
        .respond_with(ResponseTemplate::new(status).set_body_json(body))
        .expect(1)
        .mount(server)
        .await;
}

fn record(record_id: i64, corporation_id: i32) -> serde_json::Value {
    json!({ "record_id": record_id, "corporation_id": corporation_id, "start_date": "2020-01-01T00:00:00Z" })
}

async fn known_corporation(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO corporations (id, name, ticker, member_count, ceo_id, creator_id, tax_rate, updated_at)
         VALUES ($1, 'Known', 'KNWN', 1, 90000001, 90000001, 0.1, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

async fn rows(pool: &PgPool) -> Vec<(i64, i32, bool)> {
    sqlx::query_as(
        "SELECT record_id, corporation_id, is_deleted FROM character_corporation_history
         WHERE character_id = $1 ORDER BY record_id",
    )
    .bind(CHARACTER)
    .fetch_all(pool)
    .await
    .unwrap()
}

/// Seconds since the character's rows were last stamped, in UTC.
async fn stamp_age_secs(pool: &PgPool) -> f64 {
    sqlx::query_scalar(
        "SELECT EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC') - MIN(fetched_at))::float8
         FROM character_corporation_history WHERE character_id = $1",
    )
    .bind(CHARACTER)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn old_row(pool: &PgPool, record_id: i64, corporation_id: i32) {
    sqlx::query(
        "INSERT INTO character_corporation_history (record_id, character_id, corporation_id, start_date, fetched_at)
         VALUES ($1, $2, $3, '2019-01-01', (NOW() AT TIME ZONE 'UTC') - INTERVAL '10 days')",
    )
    .bind(record_id)
    .bind(CHARACTER)
    .bind(corporation_id)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn saves_history_and_queues_missing_corporations(pool: PgPool) {
    let server = MockServer::start().await;
    mock_history(
        &server,
        200,
        json!([record(1, 98000001), record(2, 98000002)]),
    )
    .await;
    known_corporation(&pool, 98000001).await;
    let recorder = Recorder::default();

    let processed = worker(pool.clone(), &server)
        .handle(CHARACTER, &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(
        rows(&pool).await,
        [(1, 98000001, false), (2, 98000002, false)]
    );
    assert!(stamp_age_secs(&pool).await.abs() < 60.0);
    let calls = recorder.calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].queue, "esi_corporation_info_queue");
    assert_eq!(calls[0].priority, None);
    assert_eq!(calls[0].ids, [98000002]);
    assert_eq!(calls[0].sources, ["worker-character-corporation-history"]);
    assert_eq!(processed.outcome, Outcome::Saved { queued: 1 });
    assert_eq!(
        processed.detail,
        " character 90000001: 2 records, 1 corporations queued"
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn known_corporations_queue_nothing(pool: PgPool) {
    let server = MockServer::start().await;
    mock_history(&server, 200, json!([record(1, 98000001)])).await;
    known_corporation(&pool, 98000001).await;
    let recorder = Recorder::default();

    let processed = worker(pool, &server)
        .handle(CHARACTER, &Context::new(&recorder))
        .await
        .unwrap();

    assert!(recorder.calls.lock().unwrap().is_empty());
    assert_eq!(processed.outcome, Outcome::Saved { queued: 0 });
    assert_eq!(
        processed.detail,
        " character 90000001: 1 records, 0 corporations queued"
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn a_repeated_corporation_is_queued_once(pool: PgPool) {
    let server = MockServer::start().await;
    mock_history(
        &server,
        200,
        json!([record(1, 98000002), record(2, 98000002)]),
    )
    .await;
    let recorder = Recorder::default();

    worker(pool, &server)
        .handle(CHARACTER, &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(recorder.calls.lock().unwrap()[0].ids, [98000002]);
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn existing_records_are_updated(pool: PgPool) {
    let server = MockServer::start().await;
    old_row(&pool, 1, 98000009).await;
    mock_history(&server, 200, json!([record(1, 98000001)])).await;

    worker(pool.clone(), &server)
        .handle(CHARACTER, &Context::new(&Recorder::default()))
        .await
        .unwrap();

    assert_eq!(rows(&pool).await, [(1, 98000001, false)]);
    assert!(stamp_age_secs(&pool).await.abs() < 60.0);
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn an_empty_history_still_stamps_and_queues_nothing(pool: PgPool) {
    let server = MockServer::start().await;
    old_row(&pool, 1, 98000001).await;
    mock_history(&server, 200, json!([])).await;
    let recorder = Recorder::default();

    let processed = worker(pool.clone(), &server)
        .handle(CHARACTER, &Context::new(&recorder))
        .await
        .unwrap();

    assert!(stamp_age_secs(&pool).await.abs() < 60.0);
    assert!(recorder.calls.lock().unwrap().is_empty());
    assert_eq!(processed.outcome, Outcome::Saved { queued: 0 });
    assert_eq!(
        processed.detail,
        " character 90000001: 0 records, 0 corporations queued"
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn is_deleted_defaults_to_false(pool: PgPool) {
    let server = MockServer::start().await;
    mock_history(
        &server,
        200,
        json!([
            record(1, 98000001),
            { "record_id": 2, "corporation_id": 98000002, "start_date": "2021-01-01T00:00:00Z", "is_deleted": true }
        ]),
    )
    .await;

    worker(pool.clone(), &server)
        .handle(CHARACTER, &Context::new(&Recorder::default()))
        .await
        .unwrap();

    assert_eq!(
        rows(&pool).await,
        [(1, 98000001, false), (2, 98000002, true)]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn an_esi_404_writes_nothing(pool: PgPool) {
    let server = MockServer::start().await;
    mock_history(&server, 404, json!({ "error": "Character not found" })).await;
    let recorder = Recorder::default();

    let result = worker(pool.clone(), &server)
        .handle(CHARACTER, &Context::new(&recorder))
        .await;

    assert!(result.is_err());
    assert!(rows(&pool).await.is_empty());
    assert!(recorder.calls.lock().unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "character_corporation_history")
)]
async fn a_nack_fails_the_message(pool: PgPool) {
    let server = MockServer::start().await;
    mock_history(&server, 200, json!([record(1, 98000002)])).await;
    let recorder = Recorder {
        fail: true,
        ..Recorder::default()
    };

    let result = worker(pool, &server)
        .handle(CHARACTER, &Context::new(&recorder))
        .await;

    assert!(result.is_err());
}
