//! `take_snapshot` against a mock ESI and a real PostgreSQL: the two
//! requests, the all-or-nothing write and the empty answer.

use chrono::{DateTime, NaiveDateTime, Utc};
use esi::{EsiClient, RateLimiter};
use serde_json::{json, Value};
use sqlx::PgPool;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_system_activity::take_snapshot;

const KILLS: &str = "/universe/system_kills";
const JUMPS: &str = "/universe/system_jumps";

fn at(s: &str) -> DateTime<Utc> {
    s.parse().unwrap()
}

fn esi(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

/// A mock that only answers a request carrying the job's compatibility
/// date; one without it gets wiremock's 404 and fails the call.
async fn route(
    server: &MockServer,
    route: &str,
    response: ResponseTemplate,
    times: impl Into<wiremock::Times>,
) {
    Mock::given(method("GET"))
        .and(path(route))
        .and(header("x-compatibility-date", "2025-12-16"))
        .respond_with(response)
        .expect(times)
        .mount(server)
        .await;
}

fn body(value: Value) -> ResponseTemplate {
    ResponseTemplate::new(200).set_body_json(value)
}

async fn count(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM system_activity")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn writes_the_merged_snapshot(pool: PgPool) {
    let server = MockServer::start().await;
    let kills = json!([{ "system_id": 30000001, "npc_kills": 1, "pod_kills": 2, "ship_kills": 3 }]);
    let jumps = json!([
        { "system_id": 30000001, "ship_jumps": 7 },
        { "system_id": 30000002, "ship_jumps": 4 }
    ]);
    route(&server, KILLS, body(kills), 1).await;
    route(&server, JUMPS, body(jumps), 1).await;

    let s = take_snapshot(&esi(&server), &pool, at("2026-11-19T13:42:00Z"))
        .await
        .unwrap()
        .expect("a snapshot");
    let thirteen = at("2026-11-19T13:00:00Z").naive_utc();
    assert_eq!((s.rows, s.inserted), (2, 2));
    assert_eq!((s.kill_systems, s.jump_systems), (1, 2));
    assert_eq!(
        (s.npc_kills, s.pod_kills, s.ship_kills, s.ship_jumps),
        (1, 2, 3, 11)
    );
    assert_eq!(s.timestamp, thirteen);

    let stored: Vec<NaiveDateTime> =
        sqlx::query_scalar("SELECT \"timestamp\" FROM system_activity")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(stored, vec![thirteen, thirteen]);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn sends_the_compatibility_date(pool: PgPool) {
    let server = MockServer::start().await;
    route(&server, KILLS, body(json!([])), 1).await;
    route(
        &server,
        JUMPS,
        body(json!([{ "system_id": 30000001, "ship_jumps": 1 }])),
        1,
    )
    .await;

    take_snapshot(&esi(&server), &pool, at("2026-11-19T13:00:00Z"))
        .await
        .unwrap();
    // `expect(1)` on both mocks is checked when the server drops.
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn a_failed_request_writes_nothing(pool: PgPool) {
    let server = MockServer::start().await;
    let kills = json!([{ "system_id": 30000001, "npc_kills": 1, "pod_kills": 1, "ship_kills": 1 }]);
    route(&server, KILLS, body(kills), 1..).await;
    route(&server, JUMPS, ResponseTemplate::new(500), 1..).await;

    let result = take_snapshot(&esi(&server), &pool, at("2026-11-19T13:00:00Z")).await;
    assert!(result.is_err(), "a failed jumps request must fail the run");
    assert_eq!(count(&pool).await, 0);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn two_empty_lists_write_nothing(pool: PgPool) {
    let server = MockServer::start().await;
    route(&server, KILLS, body(json!([])), 1).await;
    route(&server, JUMPS, body(json!([])), 1).await;

    let result = take_snapshot(&esi(&server), &pool, at("2026-11-19T13:00:00Z"))
        .await
        .unwrap();
    assert!(result.is_none());
    assert_eq!(count(&pool).await, 0);
}
