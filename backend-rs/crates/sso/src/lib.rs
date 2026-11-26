//! EVE SSO token refresh for the killmail sync workers: the Rust counterpart
//! of `backend/src/services/eve-sso.ts` (`refreshAccessToken`) and
//! `backend/src/services/user-credentials.ts` (`loadUserCredentials`), the
//! same steps in the same order. See the spec,
//! `docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md`, "Token".
//!
//! A token that is still good is read without a lock. One that needs a
//! refresh is refreshed while the user row is held `FOR UPDATE`, so the two
//! workers syncing a user at the same moment never both send the same
//! rotating refresh token; the second waits, re-reads and finds it fresh.
//! The write is also a compare-and-swap on the old refresh token.
//! `invalid_grant` clears the refresh token; any other SSO failure is an
//! error, which the worker's shared failure path retries.

use std::time::Duration;

use anyhow::Context as _;
use chrono::{NaiveDateTime, TimeDelta};
use serde::Deserialize;
use sqlx::PgPool;
use tracing::warn;

/// EVE SSO's token endpoint (`config.ts`, `eveSso.tokenUrl`).
const TOKEN_URL: &str = "https://login.eveonline.com/v2/oauth/token";
/// A refresh runs while the user row is locked, so it may not hang.
const TIMEOUT: Duration = Duration::from_secs(10);
/// A token with less life than this is refreshed first (`user-credentials.ts`).
const REFRESH_BUFFER: TimeDelta = TimeDelta::minutes(5);

/// The SSO application's credentials and where to send refreshes.
#[derive(Clone)]
pub struct SsoClient {
    http: reqwest::Client,
    token_url: String,
    client_id: String,
    client_secret: String,
}

/// What a refresh returns. `refresh_token` is absent when SSO keeps the old one.
#[derive(Debug, Deserialize)]
pub struct Tokens {
    pub access_token: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
}

/// Why a refresh failed. The refresh token is never part of the message.
#[derive(Debug, thiserror::Error)]
pub enum RefreshError {
    /// `invalid_grant`: consent revoked or the grant invalidated. No retry
    /// helps; the user has to log in again.
    #[error("the SSO grant was revoked")]
    Revoked,
    /// Network, timeout, a 5xx or any other 4xx. Worth retrying.
    #[error("EVE SSO is unavailable: {0}")]
    Unavailable(String),
}

impl SsoClient {
    /// `EVE_CLIENT_ID` and `EVE_CLIENT_SECRET` from the environment, the same
    /// variables the API reads.
    pub fn from_env() -> anyhow::Result<Self> {
        let client_id = std::env::var("EVE_CLIENT_ID").context("EVE_CLIENT_ID is not set")?;
        let client_secret =
            std::env::var("EVE_CLIENT_SECRET").context("EVE_CLIENT_SECRET is not set")?;
        Ok(Self::with_token_url(client_id, client_secret, TOKEN_URL))
    }

    /// A client for another token endpoint, for tests.
    pub fn with_token_url(
        client_id: impl Into<String>,
        client_secret: impl Into<String>,
        token_url: impl Into<String>,
    ) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(TIMEOUT)
                .build()
                .expect("the reqwest client builds with static settings"),
            token_url: token_url.into(),
            client_id: client_id.into(),
            client_secret: client_secret.into(),
        }
    }

    /// Exchange a refresh token for a new access token.
    pub async fn refresh(&self, refresh_token: &str) -> Result<Tokens, RefreshError> {
        let response = self
            .http
            .post(&self.token_url)
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token),
            ])
            .send()
            .await
            // without_url: the error must not carry anything but its kind.
            .map_err(|e| RefreshError::Unavailable(e.without_url().to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| RefreshError::Unavailable(e.without_url().to_string()))?;
        if status.is_success() {
            return serde_json::from_str(&body).map_err(|e| {
                RefreshError::Unavailable(format!("undecodable token response: {e}"))
            });
        }
        if status.as_u16() == 400 && is_invalid_grant(&body) {
            return Err(RefreshError::Revoked);
        }
        Err(RefreshError::Unavailable(format!("SSO answered {status}")))
    }
}

fn is_invalid_grant(body: &str) -> bool {
    #[derive(Deserialize)]
    struct OAuthError {
        error: Option<String>,
    }
    serde_json::from_str::<OAuthError>(body)
        .ok()
        .and_then(|e| e.error)
        .is_some_and(|e| e == "invalid_grant")
}

/// What a sync worker needs about a user, minus the credentials.
#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct SyncUser {
    pub id: i32,
    pub character_id: i32,
    pub character_name: String,
    pub last_killmail_sync_at: Option<NaiveDateTime>,
    pub last_corp_killmail_sync_at: Option<NaiveDateTime>,
}

/// The answer for one user. Only `Ok` can be synced; the other three are
/// settled by acking, since no retry helps before the user logs in again.
#[derive(Debug)]
pub enum Credentials {
    Ok {
        user: SyncUser,
        access_token: String,
    },
    NotFound,
    NoRefreshToken,
    /// SSO answered `invalid_grant`; the refresh token has been cleared.
    Revoked,
}

#[derive(sqlx::FromRow)]
struct UserRow {
    #[sqlx(flatten)]
    user: SyncUser,
    access_token: String,
    refresh_token: Option<String>,
    expires_at: NaiveDateTime,
}

#[derive(sqlx::FromRow)]
struct TokenRow {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: NaiveDateTime,
}

fn needs_refresh(expires_at: NaiveDateTime, now: NaiveDateTime) -> bool {
    expires_at <= now + REFRESH_BUFFER
}

/// A valid access token for `user_id`, refreshing and persisting it first if
/// needed. `now` is UTC. A transient SSO failure is an `Err`.
pub async fn load_credentials(
    pool: &PgPool,
    sso: &SsoClient,
    user_id: i32,
    now: NaiveDateTime,
) -> anyhow::Result<Credentials> {
    let row: Option<UserRow> = sqlx::query_as(
        "SELECT id, character_id, character_name, last_killmail_sync_at,
                last_corp_killmail_sync_at, access_token, refresh_token, expires_at
         FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    let Some(row) = row else {
        return Ok(Credentials::NotFound);
    };
    if row.refresh_token.is_none() {
        return Ok(Credentials::NoRefreshToken);
    }
    if !needs_refresh(row.expires_at, now) {
        return Ok(Credentials::Ok {
            user: row.user,
            access_token: row.access_token,
        });
    }

    let mut tx = pool.begin().await?;
    let locked: Option<TokenRow> = sqlx::query_as(
        "SELECT access_token, refresh_token, expires_at FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(locked) = locked else {
        return Ok(Credentials::NotFound);
    };
    let Some(old_refresh) = locked.refresh_token else {
        return Ok(Credentials::NoRefreshToken);
    };
    if !needs_refresh(locked.expires_at, now) {
        // Another process refreshed it while this one waited for the lock.
        tx.commit().await?;
        return Ok(Credentials::Ok {
            user: row.user,
            access_token: locked.access_token,
        });
    }

    match sso.refresh(&old_refresh).await {
        Ok(tokens) => {
            sqlx::query(
                "UPDATE users
                 SET access_token = $3, refresh_token = COALESCE($4, refresh_token),
                     expires_at = $5, updated_at = $6
                 WHERE id = $1 AND refresh_token = $2",
            )
            .bind(user_id)
            .bind(&old_refresh)
            .bind(&tokens.access_token)
            .bind(&tokens.refresh_token)
            .bind(now + TimeDelta::seconds(tokens.expires_in))
            .bind(now)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            Ok(Credentials::Ok {
                user: row.user,
                access_token: tokens.access_token,
            })
        }
        Err(RefreshError::Revoked) => {
            sqlx::query(
                "UPDATE users SET refresh_token = NULL, updated_at = $3
                 WHERE id = $1 AND refresh_token = $2",
            )
            .bind(user_id)
            .bind(&old_refresh)
            .bind(now)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            warn!("refresh token of user {user_id} was revoked; cleared until the next login");
            Ok(Credentials::Revoked)
        }
        // Dropping the transaction rolls it back and releases the lock.
        Err(error @ RefreshError::Unavailable(_)) => Err(error.into()),
    }
}
