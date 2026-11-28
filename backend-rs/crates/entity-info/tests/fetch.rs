//! `fetch_and_upsert`: the ESI route each entity is read from, and the row it
//! leaves. The routes are the info workers' own, so a worker and
//! `worker-redisq` can never ask ESI for different things.

use entity_info::{alliance, character, corporation, type_info};
use esi::{EsiClient, RateLimiter};
use serde_json::json;
use sqlx::PgPool;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn esi(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

async fn name_of(pool: &PgPool, table: &str, id: i32) -> String {
    sqlx::query_scalar(&format!("SELECT name FROM {table} WHERE id = $1"))
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn fetch_and_upsert_writes_a_character(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/characters/2120000001/"))
        .and(header(
            "x-compatibility-date",
            character::CHARACTER_COMPATIBILITY_DATE.as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "name": "Test Pilot",
            "corporation_id": 98000001,
            "birthday": "2010-01-01T12:34:56Z",
            "bloodline_id": 1,
            "race_id": 2,
            "gender": "female"
        })))
        .expect(1)
        .mount(&server)
        .await;

    let fetched = character::fetch_and_upsert(&pool, &esi(&server), 2120000001)
        .await
        .unwrap();

    assert!(fetched.inserted);
    assert_eq!(fetched.name, "Test Pilot");
    assert_eq!(name_of(&pool, "characters", 2120000001).await, "Test Pilot");
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn fetch_and_upsert_writes_a_corporation(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/corporations/98000001/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "name": "Test Corp",
            "ticker": "TCORP",
            "member_count": 10,
            "ceo_id": 90000001,
            "creator_id": 90000001,
            "tax_rate": 0.1
        })))
        .expect(1)
        .mount(&server)
        .await;

    let fetched = corporation::fetch_and_upsert(&pool, &esi(&server), 98000001)
        .await
        .unwrap();

    assert!(fetched.inserted);
    assert_eq!(fetched.name, "Test Corp");
    assert_eq!(name_of(&pool, "corporations", 98000001).await, "Test Corp");
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn fetch_and_upsert_writes_an_alliance(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/alliances/99000001"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "name": "Test Alliance",
            "ticker": "TEST",
            "date_founded": "2010-11-04T13:11:00Z",
            "creator_corporation_id": 98000001,
            "creator_id": 90000001
        })))
        .expect(1)
        .mount(&server)
        .await;

    let fetched = alliance::fetch_and_upsert(&pool, &esi(&server), 99000001)
        .await
        .unwrap();

    assert!(fetched.inserted);
    assert_eq!(fetched.name, "Test Alliance");
    assert_eq!(name_of(&pool, "alliances", 99000001).await, "Test Alliance");
}

#[sqlx::test(migrations = false, fixtures("types"))]
async fn fetch_and_upsert_writes_a_type(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/universe/types/587/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "name": "Rifter",
            "group_id": 25,
            "published": true
        })))
        .expect(1)
        .mount(&server)
        .await;

    let fetched = type_info::fetch_and_upsert(&pool, &esi(&server), 587)
        .await
        .unwrap();

    assert!(fetched.inserted);
    assert_eq!(fetched.name, "Rifter");
    assert_eq!(name_of(&pool, "types", 587).await, "Rifter");
}
