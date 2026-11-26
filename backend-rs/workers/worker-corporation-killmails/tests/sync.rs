//! `sync_corporation` against a real PostgreSQL, a mock ESI and a mock SSO.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use chrono::{NaiveDate, NaiveDateTime, TimeDelta};
use esi::{EsiClient, RateLimiter};
use serde_json::json;
use sqlx::PgPool;
use sso::SsoClient;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_corporation_killmails::{sync_corporation, Synced};

const USER: i32 = 7;
const CHARACTER: i32 = 95465499;
const CORPORATION: i32 = 98000001;
const LIST: &str = "/corporations/98000001/killmails/recent/";

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 26)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

fn before() -> NaiveDateTime {
    now() - TimeDelta::hours(1)
}

async fn user(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO users (id, character_id, character_name, character_owner_hash, access_token,
                            refresh_token, expires_at, updated_at, last_corp_killmail_sync_at)
         VALUES ($1, $2, 'Test Director', 'hash', 'access', 'refresh', $3, $4, $5)",
    )
    .bind(USER)
    .bind(CHARACTER)
    .bind(now() + TimeDelta::minutes(15))
    .bind(now() - TimeDelta::days(1))
    .bind(before())
    .execute(pool)
    .await
    .unwrap();
}

async fn character(pool: &PgPool, corporation_id: i32) {
    sqlx::query(
        "INSERT INTO characters (id, name, corporation_id, birthday, bloodline_id, race_id, gender, updated_at)
         VALUES ($1, 'Test Director', $2, '2010-01-01', 1, 1, 'female', '2026-11-26')",
    )
    .bind(CHARACTER)
    .bind(corporation_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn list(server: &MockServer, response: ResponseTemplate) {
    Mock::given(method("GET"))
        .and(path(LIST))
        .and(query_param("page", "1"))
        .respond_with(response)
        .mount(server)
        .await;
}

fn killmails(ids: &[i32]) -> ResponseTemplate {
    let body: Vec<_> = ids
        .iter()
        .map(|id| json!({"killmail_id": id, "killmail_hash": format!("h{id}")}))
        .collect();
    ResponseTemplate::new(200)
        .set_body_json(body)
        .insert_header("x-pages", "1")
}

async fn stamps(pool: &PgPool) -> (Option<NaiveDateTime>, Option<NaiveDateTime>) {
    sqlx::query_as(
        "SELECT last_corp_killmail_sync_at, corp_killmails_denied_at FROM users WHERE id = $1",
    )
    .bind(USER)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn sources(pool: &PgPool) -> Vec<String> {
    sqlx::query_scalar("SELECT source FROM killmail_refs")
        .fetch_all(pool)
        .await
        .unwrap()
}

fn clients(esi: &MockServer, sso: &MockServer) -> (EsiClient, SsoClient) {
    (
        EsiClient::with_base_url(RateLimiter::new(50), esi.uri()),
        SsoClient::with_token_url("id", "secret", format!("{}/token", sso.uri())),
    )
}

#[sqlx::test(migrations = false, fixtures("users", "characters", "killmail_refs"))]
async fn reads_the_corporation_from_characters(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    list(&esi_server, killmails(&[1, 2])).await;
    user(&pool).await;
    character(&pool, CORPORATION).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_corporation(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Synced { walk, .. } if walk.inserted == 2));
    assert_eq!(sources(&pool).await, ["corporation", "corporation"]);
    assert_eq!(stamps(&pool).await, (Some(now()), None));
}

#[sqlx::test(migrations = false, fixtures("users", "characters", "killmail_refs"))]
async fn an_empty_list_still_stamps(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    list(&esi_server, killmails(&[])).await;
    user(&pool).await;
    character(&pool, CORPORATION).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    sync_corporation(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert_eq!(stamps(&pool).await.0, Some(now()));
}

#[sqlx::test(migrations = false, fixtures("users", "characters", "killmail_refs"))]
async fn missing_character_row_skips_corporation(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&esi_server)
        .await;
    user(&pool).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_corporation(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Skipped(_)));
    assert_eq!(stamps(&pool).await.0, Some(now()));
}

#[sqlx::test(migrations = false, fixtures("users", "characters", "killmail_refs"))]
async fn an_npc_corporation_is_skipped(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&esi_server)
        .await;
    user(&pool).await;
    character(&pool, 1_000_125).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_corporation(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Skipped(_)));
}

#[sqlx::test(migrations = false, fixtures("users", "characters", "killmail_refs"))]
async fn a_403_is_recorded_as_denied(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    list(&esi_server, ResponseTemplate::new(403)).await;
    user(&pool).await;
    character(&pool, CORPORATION).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    let synced = sync_corporation(&pool, &esi, &sso, USER, false, now())
        .await
        .unwrap();
    assert!(matches!(synced, Synced::Denied));
    assert_eq!(stamps(&pool).await, (Some(now()), Some(now())));
}

#[sqlx::test(migrations = false, fixtures("users", "characters", "killmail_refs"))]
async fn failure_mid_walk_keeps_refs_and_no_stamp(pool: PgPool) {
    let (esi_server, sso_server) = (MockServer::start().await, MockServer::start().await);
    list(&esi_server, killmails(&[1]).insert_header("x-pages", "2")).await;
    Mock::given(method("GET"))
        .and(path(LIST))
        .and(query_param("page", "2"))
        .respond_with(ResponseTemplate::new(502))
        .mount(&esi_server)
        .await;
    user(&pool).await;
    character(&pool, CORPORATION).await;
    let (esi, sso) = clients(&esi_server, &sso_server);

    assert!(sync_corporation(&pool, &esi, &sso, USER, false, now())
        .await
        .is_err());
    assert_eq!(sources(&pool).await.len(), 1);
    assert_eq!(stamps(&pool).await, (Some(before()), None));
}

#[test]
fn the_success_line_names_the_character() {
    let line = worker_corporation_killmails::processed(
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
