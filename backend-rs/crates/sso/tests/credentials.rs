//! `load_credentials` against a real PostgreSQL and a mock token endpoint.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use std::time::Duration;

use chrono::{NaiveDate, NaiveDateTime, TimeDelta};
use sqlx::PgPool;
use sso::{load_credentials, Credentials, SsoClient};
use wiremock::matchers::method;
use wiremock::{Mock, MockServer, ResponseTemplate};

const USER: i32 = 7;

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 26)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

async fn user(pool: &PgPool, refresh_token: Option<&str>, expires_at: NaiveDateTime) {
    sqlx::query(
        "INSERT INTO users (id, character_id, character_name, character_owner_hash,
                            access_token, refresh_token, expires_at, updated_at)
         VALUES ($1, 95465499, 'Test Pilot', 'hash', 'old-access', $2, $3, $4)",
    )
    .bind(USER)
    .bind(refresh_token)
    .bind(expires_at)
    .bind(now() - TimeDelta::days(1))
    .execute(pool)
    .await
    .unwrap();
}

async fn tokens(pool: &PgPool) -> (String, Option<String>, NaiveDateTime) {
    sqlx::query_as("SELECT access_token, refresh_token, expires_at FROM users WHERE id = $1")
        .bind(USER)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn sso(server: &MockServer) -> SsoClient {
    SsoClient::with_token_url("id", "secret", format!("{}/token", server.uri()))
}

fn refreshed() -> ResponseTemplate {
    ResponseTemplate::new(200).set_body_json(serde_json::json!({
        "access_token": "new-access",
        "expires_in": 1200,
        "token_type": "Bearer",
        "refresh_token": "new-refresh"
    }))
}

fn access_token(credentials: Credentials) -> String {
    match credentials {
        Credentials::Ok { access_token, .. } => access_token,
        other => panic!("expected Ok, got {other:?}"),
    }
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn a_fresh_token_needs_no_sso(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(refreshed())
        .expect(0)
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now() + TimeDelta::minutes(10)).await;

    let credentials = load_credentials(&pool, &sso(&server), USER, now())
        .await
        .unwrap();
    match credentials {
        Credentials::Ok { user, access_token } => {
            assert_eq!(access_token, "old-access");
            assert_eq!(user.character_id, 95465499);
            assert_eq!(user.last_killmail_sync_at, None);
        }
        other => panic!("expected Ok, got {other:?}"),
    }
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn refreshes_and_writes_with_compare_and_swap(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(refreshed())
        .expect(1)
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now() + TimeDelta::minutes(4)).await;

    let credentials = load_credentials(&pool, &sso(&server), USER, now())
        .await
        .unwrap();
    assert_eq!(access_token(credentials), "new-access");
    assert_eq!(
        tokens(&pool).await,
        (
            "new-access".to_owned(),
            Some("new-refresh".to_owned()),
            now() + TimeDelta::seconds(1200)
        )
    );
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn keeps_the_refresh_token_when_sso_does_not_rotate_it(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "access_token": "new-access", "expires_in": 1200, "token_type": "Bearer"
        })))
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now() - TimeDelta::minutes(1)).await;

    load_credentials(&pool, &sso(&server), USER, now())
        .await
        .unwrap();
    assert_eq!(tokens(&pool).await.1.as_deref(), Some("old-refresh"));
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn concurrent_refresh_calls_sso_once(pool: PgPool) {
    let server = MockServer::start().await;
    // Slow enough that the second caller is waiting on the row lock.
    Mock::given(method("POST"))
        .respond_with(refreshed().set_delay(Duration::from_millis(300)))
        .expect(1)
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now() + TimeDelta::minutes(1)).await;

    let client = sso(&server);
    let (a, b) = tokio::join!(
        load_credentials(&pool, &client, USER, now()),
        load_credentials(&pool, &client, USER, now()),
    );
    assert_eq!(access_token(a.unwrap()), "new-access");
    assert_eq!(access_token(b.unwrap()), "new-access");
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn invalid_grant_clears_the_refresh_token(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(400).set_body_json(serde_json::json!({"error": "invalid_grant"})),
        )
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now()).await;

    let credentials = load_credentials(&pool, &sso(&server), USER, now())
        .await
        .unwrap();
    assert!(matches!(credentials, Credentials::Revoked));
    assert_eq!(tokens(&pool).await.1, None);
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn a_transient_sso_error_is_an_error_and_keeps_the_token(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now()).await;

    assert!(load_credentials(&pool, &sso(&server), USER, now())
        .await
        .is_err());
    assert_eq!(tokens(&pool).await.1.as_deref(), Some("old-refresh"));
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn missing_user_and_missing_refresh_token(pool: PgPool) {
    let server = MockServer::start().await;
    assert!(matches!(
        load_credentials(&pool, &sso(&server), USER, now())
            .await
            .unwrap(),
        Credentials::NotFound
    ));

    user(&pool, None, now()).await;
    assert!(matches!(
        load_credentials(&pool, &sso(&server), USER, now())
            .await
            .unwrap(),
        Credentials::NoRefreshToken
    ));
}

#[sqlx::test(migrations = false, fixtures("users"))]
async fn a_waiter_gives_up_on_a_held_lock_instead_of_refreshing_late(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(refreshed())
        .expect(0)
        .mount(&server)
        .await;
    user(&pool, Some("old-refresh"), now()).await;

    // Another process holds the row for longer than the lock wait.
    let mut holder = pool.begin().await.unwrap();
    sqlx::query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE")
        .bind(USER)
        .execute(&mut *holder)
        .await
        .unwrap();

    let started = std::time::Instant::now();
    let result = load_credentials(&pool, &sso(&server), USER, now()).await;
    assert!(result.is_err());
    assert!(started.elapsed() < Duration::from_secs(8));
    holder.rollback().await.unwrap();
}
