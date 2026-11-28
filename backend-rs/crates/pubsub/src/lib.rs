//! Redis PUBLISH to the API's subscriptions: the Rust side of
//! `backend/src/services/pubsub.ts`.
//!
//! The API subscribes through graphql-yoga's Redis event target, whose wire
//! format is `PUBLISH <topic> <JSON.stringify(payload)>`. A payload published
//! here is therefore indistinguishable from one a Node worker publishes, as
//! long as its JSON keeps the field names and order of the TypeScript type.

use std::time::Duration;

use redis::aio::{ConnectionManager, ConnectionManagerConfig};
use serde::Serialize;
use tokio::sync::OnceCell;
use tracing::info;

/// How long a connect or a reply may take before the publish fails.
const TIMEOUT: Duration = Duration::from_secs(5);

/// Publishes to Redis, or does nothing when the API is not listening on
/// Redis. The connection opens on the first publish, so a run with nothing
/// to say never touches Redis. It is a [`ConnectionManager`]: a connection
/// that dies (a Redis restart, an idle timeout) is opened again, so a
/// long-running stream keeps publishing.
pub struct RedisPubSub {
    redis_url: Option<String>,
    connection: OnceCell<ConnectionManager>,
}

impl RedisPubSub {
    /// On when `USE_REDIS_PUBSUB` is exactly `true`, as `config.ts` reads it.
    /// Off, the API's pubsub is in-memory and a Node worker's publish reaches
    /// nobody either; this publisher then stays silent. `what` names what
    /// goes unpublished in the startup line, e.g. "new killmails".
    pub fn from_env(what: &str) -> Self {
        let enabled = std::env::var("USE_REDIS_PUBSUB").is_ok_and(|v| v == "true");
        if !enabled {
            info!("📡 USE_REDIS_PUBSUB is not true — {what} are not published");
            return Self::new(None);
        }
        let url = std::env::var("REDIS_URL").unwrap_or_else(|_| esi::DEFAULT_REDIS_URL.to_owned());
        Self::new(Some(url))
    }

    /// `None` is a disabled publisher.
    pub fn new(redis_url: Option<String>) -> Self {
        Self {
            redis_url,
            connection: OnceCell::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.redis_url.is_some()
    }

    /// `PUBLISH <channel> <payload as JSON>`. A disabled publisher returns
    /// `Ok(())` without doing anything.
    pub async fn publish(&self, channel: &str, payload: &impl Serialize) -> anyhow::Result<()> {
        let Some(url) = &self.redis_url else {
            return Ok(());
        };
        let payload = serde_json::to_string(payload)?;
        let connection = self
            .connection
            .get_or_try_init(|| async {
                ConnectionManager::new_with_config(
                    redis::Client::open(url.as_str())?,
                    ConnectionManagerConfig::new()
                        .set_connection_timeout(Some(TIMEOUT))
                        .set_response_timeout(Some(TIMEOUT))
                        .set_number_of_retries(1),
                )
                .await
            })
            .await?;
        let mut connection = connection.clone();
        redis::cmd("PUBLISH")
            .arg(channel)
            .arg(payload)
            .query_async::<i64>(&mut connection)
            .await?;
        Ok(())
    }
}
