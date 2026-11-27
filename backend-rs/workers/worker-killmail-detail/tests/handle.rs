//! `handle_message` against a mock ESI and a real PostgreSQL, with a
//! recording publisher in place of RabbitMQ and Redis switched off.

use std::sync::Mutex;

use anyhow::anyhow;
use esi::{EsiClient, EsiError, RateLimiter};
use futures_util::future::BoxFuture;
use mq::EntityMessage;
use pubsub::RedisPubSub;
use runner::{Context, EntityQueueMessage, Outcome, Publisher, Worker};
use serde_json::json;
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_killmail_detail::DetailWorker;

const ID: i32 = 133900250;
const HASH: &str = "8a1b2c";

/// Records killmail publishes, or refuses them when `fail` is set.
#[derive(Default)]
struct Recorder {
    fail: bool,
    calls: Mutex<Vec<(String, Vec<i32>)>>,
}

impl Publisher for Recorder {
    fn publish<'a>(
        &'a self,
        _queue: &'a str,
        _messages: &'a [EntityMessage],
        _priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        panic!("the detail worker publishes no entity messages")
    }

    fn publish_killmails<'a>(
        &'a self,
        queue: &'a str,
        _source: &'static str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move {
            if self.fail {
                return Err(anyhow!("nack"));
            }
            self.calls
                .lock()
                .unwrap()
                .push((queue.to_owned(), ids.to_vec()));
            Ok(ids.len() as u64)
        })
    }
}

fn worker(pool: PgPool, server: &MockServer) -> DetailWorker {
    DetailWorker {
        pool,
        esi: EsiClient::with_base_url(RateLimiter::new(50), server.uri()),
        pubsub: RedisPubSub::new(None),
    }
}

fn message(hash: Option<&str>, announce: bool) -> EntityQueueMessage {
    EntityQueueMessage {
        entity_id: ID,
        full_sync: false,
        killmail_hash: hash.map(str::to_owned),
        announce,
    }
}

async fn mock_detail(server: &MockServer, response: ResponseTemplate) {
    Mock::given(method("GET"))
        .and(path(format!("/killmails/{ID}/{HASH}/")))
        .respond_with(response)
        .mount(server)
        .await;
}

fn detail_json() -> serde_json::Value {
    json!({
        "killmail_id": ID,
        "killmail_time": "2026-11-27T12:00:00Z",
        "solar_system_id": 30000142,
        "victim": {
            "character_id": 2001,
            "corporation_id": 98000002,
            "damage_taken": 200,
            "ship_type_id": 587,
            "items": []
        },
        "attackers": [{
            "character_id": 1001,
            "corporation_id": 98000001,
            "damage_done": 200,
            "final_blow": true,
            "security_status": 0.5,
            "ship_type_id": 587
        }]
    })
}

async fn killmails(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM killmails")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn saves_and_stays_quiet_without_announce(pool: PgPool) {
    let server = MockServer::start().await;
    mock_detail(
        &server,
        ResponseTemplate::new(200).set_body_json(detail_json()),
    )
    .await;
    let recorder = Recorder::default();

    let processed = worker(pool.clone(), &server)
        .handle_message(&message(Some(HASH), false), &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(processed.outcome, Outcome::Saved { queued: 0 });
    assert!(recorder.calls.lock().unwrap().is_empty());
    assert_eq!(killmails(&pool).await, 1);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn announces_to_discord(pool: PgPool) {
    let server = MockServer::start().await;
    mock_detail(
        &server,
        ResponseTemplate::new(200).set_body_json(detail_json()),
    )
    .await;
    let recorder = Recorder::default();

    let processed = worker(pool, &server)
        .handle_message(&message(Some(HASH), true), &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(processed.outcome, Outcome::Saved { queued: 1 });
    assert_eq!(
        *recorder.calls.lock().unwrap(),
        vec![("discord_webhook_queue".to_owned(), vec![ID])]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn failed_announcement_still_saves(pool: PgPool) {
    let server = MockServer::start().await;
    mock_detail(
        &server,
        ResponseTemplate::new(200).set_body_json(detail_json()),
    )
    .await;
    let recorder = Recorder {
        fail: true,
        ..Recorder::default()
    };

    let processed = worker(pool.clone(), &server)
        .handle_message(&message(Some(HASH), true), &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(processed.outcome, Outcome::Saved { queued: 0 });
    assert_eq!(killmails(&pool).await, 1);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn already_stored_is_unchanged(pool: PgPool) {
    let server = MockServer::start().await;
    mock_detail(
        &server,
        ResponseTemplate::new(200).set_body_json(detail_json()),
    )
    .await;
    let recorder = Recorder::default();
    let worker = worker(pool, &server);

    worker
        .handle_message(&message(Some(HASH), true), &Context::new(&recorder))
        .await
        .unwrap();
    let second = worker
        .handle_message(&message(Some(HASH), true), &Context::new(&recorder))
        .await
        .unwrap();

    assert_eq!(second.outcome, Outcome::Unchanged);
    assert_eq!(recorder.calls.lock().unwrap().len(), 1);
}

#[sqlx::test(migrations = false)]
async fn missing_hash_errors(pool: PgPool) {
    let server = MockServer::start().await;
    let recorder = Recorder::default();

    let error = worker(pool, &server)
        .handle_message(&message(None, false), &Context::new(&recorder))
        .await
        .unwrap_err();

    assert!(error.to_string().contains("no killmailHash"), "{error:#}");
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[sqlx::test(migrations = false, fixtures("killmails"))]
async fn esi_404_errors(pool: PgPool) {
    let server = MockServer::start().await;
    mock_detail(
        &server,
        ResponseTemplate::new(404).set_body_json(json!({ "error": "Killmail not found" })),
    )
    .await;
    let recorder = Recorder::default();

    let error = worker(pool.clone(), &server)
        .handle_message(&message(Some(HASH), false), &Context::new(&recorder))
        .await
        .unwrap_err();

    let esi = error.downcast_ref::<EsiError>().expect("an ESI error");
    assert_eq!(esi.status(), Some(404));
    assert_eq!(killmails(&pool).await, 0);
}
