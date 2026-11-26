//! `sync_user` against a real PostgreSQL, a mock ESI and a mock SSO.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use chrono::{NaiveDate, NaiveDateTime, TimeDelta};
use esi::{EsiClient, RateLimiter};
use serde_json::json;
use sqlx::PgPool;
use sso::SsoClient;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_user_killmails::{sync_user, Synced};

const USER: i32 = 7;
const CHARACTER: i32 = 95465499;
const LIST: &str = "/characters/95465499/killmails/recent/";

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 26)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

async fn user(pool: &PgPool, refresh_token: Option<&str>, last_sync: Option<NaiveDateTime>) {
    sqlx::query(
        "INSERT INTO users (id, character_id, character_name, character_owner_hash, access_token,
                            refresh_token, expires_at, updated_at, last_killmail_sync_at)
         VALUES ($1, $2, 'Test Pilot', 'hash', 'access', $3, $4, $5, $6)",
    )
    .bind(USER)
    .bind(CHARACTER)
    .bind(refresh_token)
    .bind(now() + TimeDelta::minutes(15))
    .bind(now() - TimeDelta::days(1))
    .bind(last_sync)
    .execute(pool)
    .await
    .unwrap();
}

async fn page(server: &MockServer, n: &str, ids: &[i32], pages: &str) {
    let body: Vec<_> = ids
        .iter()
        .map(|id| json!({"killmail_id": id, "killmail_hash": format!("h{id}")}))
        .collect();
    Mock::given(method("GET"))
        .and(path(LIST))
        .and(query_param("page", n))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(body)
                .insert_header("x-pages", pages),
        )
        .mount(server)
        .await;
}

async fn refs(pool: &PgPool) -> Vec<(i32, String)> {
    sqlx::query_as("SELECT killmail_id, source FROM killmail_refs ORDER BY killmail_id")
        .fetch_all(pool)
        .await
        .unwrap()
}

async fn stamp(pool: &PgPool) -> Option<NaiveDateTime> {
    sqlx::query_scalar("SELECT last_killmail_sync_at FROM users WHERE id = $1")
        .bind(USER)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn clients(esi: &MockServer, sso: &MockServer) -> (EsiClient, SsoClient) {
    (
        EsiClient::with_base_url(RateLimiter::new(50), esi.uri()),
        SsoClient::with_token_url("id", "secret", format!("{}/token", sso.uri())),
    )
}

#[sqlx::test(migrations = false, fixtures("users", "killmail_refs"))]
async fn records_character_refs_and_stamps_the_user(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    page(&esi_server, "1", &[2, 1], "1").await;
    user(&pool, Some("refresh"), Some(now() - TimeDelta::hours(1))).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_user(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Synced { walk, .. } if walk.inserted == 2));
    assert_eq!(
        refs(&pool).await,
        [(1, "character".into()), (2, "character".into())]
    );
    assert_eq!(stamp(&pool).await, Some(now()));
}

#[sqlx::test(migrations = false, fixtures("users", "killmail_refs"))]
async fn a_never_synced_user_walks_every_page(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    page(&esi_server, "1", &[3], "2").await;
    page(&esi_server, "2", &[2], "2").await;
    user(&pool, Some("refresh"), None).await;
    sqlx::query(
        "INSERT INTO killmail_refs (killmail_id, killmail_hash, source, discovered_at)
         VALUES (3, 'h3', 'corporation', $1)",
    )
    .bind(now())
    .execute(&pool)
    .await
    .unwrap();
    let (esi, sso) = clients(&esi_server, &sso_server);

    sync_user(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    // Page 1 added nothing, but a first sync does not stop on it.
    assert_eq!(refs(&pool).await.len(), 2);
}

#[sqlx::test(migrations = false, fixtures("users", "killmail_refs"))]
async fn an_empty_list_still_stamps(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    Mock::given(method("GET"))
        .and(path(LIST))
        .respond_with(ResponseTemplate::new(404))
        .mount(&esi_server)
        .await;
    user(&pool, Some("refresh"), Some(now() - TimeDelta::hours(1))).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    sync_user(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert_eq!(stamp(&pool).await, Some(now()));
}

#[sqlx::test(migrations = false, fixtures("users", "killmail_refs"))]
async fn failure_mid_walk_keeps_refs_and_no_stamp(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    page(&esi_server, "1", &[5], "3").await;
    Mock::given(method("GET"))
        .and(path(LIST))
        .and(query_param("page", "2"))
        .respond_with(ResponseTemplate::new(502))
        .mount(&esi_server)
        .await;
    let before = now() - TimeDelta::hours(1);
    user(&pool, Some("refresh"), Some(before)).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    assert!(sync_user(&pool, &esi, &sso, USER, false, now())
        .await
        .is_err());
    assert_eq!(refs(&pool).await.len(), 1);
    assert_eq!(stamp(&pool).await, Some(before));
}

#[sqlx::test(migrations = false, fixtures("users", "killmail_refs"))]
async fn a_user_without_a_refresh_token_is_skipped(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&esi_server)
        .await;
    user(&pool, None, None).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_user(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Skipped(_)));
    assert_eq!(stamp(&pool).await, None);
}

#[sqlx::test(migrations = false, fixtures("users", "killmail_refs"))]
async fn a_403_on_the_character_list_is_stamped_and_skipped(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    Mock::given(method("GET"))
        .and(path(LIST))
        .respond_with(ResponseTemplate::new(403))
        .mount(&esi_server)
        .await;
    user(&pool, Some("refresh"), Some(now() - TimeDelta::hours(1))).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_user(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Skipped(_)));
    assert_eq!(stamp(&pool).await, Some(now()));
}

#[test]
fn the_success_line_names_the_character() {
    let line = worker_user_killmails::processed(
        USER,
        Synced::Synced {
            walk: killmail_refs::Walk {
                pages: 2,
                found: 73,
                inserted: 73,
                capped: false,
            },
            character_name: "General XAN".to_owned(),
        },
    );
    assert_eq!(
        line.detail,
        " General XAN (user 7): 73 listed on 2 page(s), 73 new"
    );
}
