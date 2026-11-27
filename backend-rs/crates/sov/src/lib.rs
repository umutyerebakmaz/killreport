//! Sovereignty alerts: the event a sovereignty job detects, the alert the
//! API's `sovereigntyAlert` subscription hands to clients, and the Redis
//! publish between them. The Rust counterpart of
//! `backend/src/services/sovereignty/alert-builder.ts` and the
//! `SOVEREIGNTY_ALERT` channel of `backend/src/services/pubsub.ts`; see the
//! spec, `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! The API subscribes through graphql-yoga's Redis event target, whose wire
//! format is `PUBLISH <topic> <JSON.stringify(payload)>`. An alert published
//! here is therefore indistinguishable from one the Node workers publish, as
//! long as the JSON keeps the field names and order of `SovereigntyAlertData`.
//!
//! Every time in an alert is UTC: EVE runs on UTC.

use chrono::{DateTime, Utc};
use pubsub::RedisPubSub;
use serde::Serialize;
use sqlx::PgPool;
use tracing::error;

/// At most this many alerts per run, so a reseed or a large reshuffle cannot
/// flood clients. The Node workers use the same number.
pub const MAX_ALERTS: usize = 25;

/// The Redis channel the API's subscription listens on.
pub const CHANNEL: &str = "SOVEREIGNTY_ALERT";

/// What a sovereignty job saw happen, before it is named and worded.
#[derive(Debug, Clone, PartialEq)]
pub enum AlertEvent {
    CampaignStarted {
        system_id: i32,
        defender_id: Option<i32>,
    },
    CampaignEnded {
        system_id: i32,
        defender_id: Option<i32>,
        outcome: Option<String>,
    },
    TerritoryChange {
        system_id: i32,
        previous_owner_id: Option<i32>,
        new_owner_id: Option<i32>,
        change_type: Option<String>,
    },
}

impl AlertEvent {
    pub fn system_id(&self) -> i32 {
        match self {
            Self::CampaignStarted { system_id, .. }
            | Self::CampaignEnded { system_id, .. }
            | Self::TerritoryChange { system_id, .. } => *system_id,
        }
    }

    /// The alliance the alert names: the new owner of a territory change
    /// (the previous one when the system was lost), the defender otherwise.
    pub fn alliance_id(&self) -> Option<i32> {
        match self {
            Self::CampaignStarted { defender_id, .. } | Self::CampaignEnded { defender_id, .. } => {
                *defender_id
            }
            Self::TerritoryChange {
                previous_owner_id,
                new_owner_id,
                ..
            } => new_owner_id.or(*previous_owner_id),
        }
    }

    fn type_name(&self) -> &'static str {
        match self {
            Self::CampaignStarted { .. } => "campaign_started",
            Self::CampaignEnded { .. } => "campaign_ended",
            Self::TerritoryChange { .. } => "territory_change",
        }
    }
}

/// The alert as clients receive it. Field order is the wire order of
/// `SovereigntyAlertData` in `alert-builder.ts`; serde keeps declaration
/// order.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SovereigntyAlert {
    pub r#type: String,
    pub message: String,
    pub solar_system_id: i32,
    pub solar_system_name: Option<String>,
    pub region_name: Option<String>,
    pub alliance_id: Option<i32>,
    pub alliance_name: Option<String>,
    pub alliance_ticker: Option<String>,
    pub outcome: Option<String>,
    pub change_type: Option<String>,
    /// `Date.prototype.toISOString()`: UTC, milliseconds, `Z`.
    pub timestamp: String,
}

/// The human-readable line, worded exactly as the Node builder words it. A
/// system the database does not know is shown as `#<id>`.
pub fn alert_message(
    event: &AlertEvent,
    system_name: Option<&str>,
    region_name: Option<&str>,
) -> String {
    let system = system_name
        .map(str::to_owned)
        .unwrap_or_else(|| format!("#{}", event.system_id()));
    let loc = match region_name {
        Some(region) => format!("{system} ({region})"),
        None => system.clone(),
    };
    match event {
        AlertEvent::CampaignStarted { .. } => format!("New sovereignty campaign in {loc}"),
        AlertEvent::CampaignEnded { outcome, .. } => format!(
            "Campaign in {loc} ended — {}",
            outcome.as_deref().unwrap_or("unresolved")
        ),
        AlertEvent::TerritoryChange { change_type, .. } => {
            let region = region_name.map(|r| format!(" ({r})")).unwrap_or_default();
            format!(
                "{system} sovereignty {}{region}",
                change_type.as_deref().unwrap_or("changed")
            )
        }
    }
}

/// Names the event's system, region and alliance in one query and words the
/// alert. `now` becomes its timestamp.
pub async fn build_alert(
    pool: &PgPool,
    event: &AlertEvent,
    now: DateTime<Utc>,
) -> sqlx::Result<SovereigntyAlert> {
    let alliance_id = event.alliance_id();
    let (system_name, region_name, alliance_name, alliance_ticker): (
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = sqlx::query_as(
        "SELECT s.name, r.name, a.name, a.ticker
         FROM (SELECT $1::int AS system_id, $2::int AS alliance_id) q
         LEFT JOIN solar_systems s ON s.system_id = q.system_id
         LEFT JOIN constellations c ON c.constellation_id = s.constellation_id
         LEFT JOIN regions r ON r.region_id = c.region_id
         LEFT JOIN alliances a ON a.id = q.alliance_id",
    )
    .bind(event.system_id())
    .bind(alliance_id)
    .fetch_one(pool)
    .await?;

    let (outcome, change_type) = match event {
        AlertEvent::CampaignStarted { .. } => (None, None),
        AlertEvent::CampaignEnded { outcome, .. } => (outcome.clone(), None),
        AlertEvent::TerritoryChange { change_type, .. } => (None, change_type.clone()),
    };

    Ok(SovereigntyAlert {
        r#type: event.type_name().to_owned(),
        message: alert_message(event, system_name.as_deref(), region_name.as_deref()),
        solar_system_id: event.system_id(),
        solar_system_name: system_name,
        region_name,
        alliance_id,
        alliance_name,
        alliance_ticker,
        outcome,
        change_type,
        timestamp: now.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
    })
}

/// Publishes alerts to the API, or does nothing when the API is not listening
/// on Redis: a [`RedisPubSub`] on [`CHANNEL`].
pub struct AlertPublisher {
    pubsub: RedisPubSub,
}

impl AlertPublisher {
    /// On when `USE_REDIS_PUBSUB` is exactly `true`; see
    /// [`RedisPubSub::from_env`].
    pub fn from_env() -> Self {
        Self {
            pubsub: RedisPubSub::from_env("sovereignty alerts"),
        }
    }

    /// `None` is a disabled publisher.
    pub fn new(redis_url: Option<String>) -> Self {
        Self {
            pubsub: RedisPubSub::new(redis_url),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.pubsub.is_enabled()
    }

    pub async fn publish(&self, alert: &SovereigntyAlert) -> anyhow::Result<()> {
        self.pubsub.publish(CHANNEL, alert).await
    }

    /// Builds and publishes each event in order. A failure is logged and the
    /// rest still go out: the data is already committed, and an alert is a
    /// courtesy, not a record. Returns how many were published.
    pub async fn publish_all(
        &self,
        pool: &PgPool,
        events: &[AlertEvent],
        now: DateTime<Utc>,
    ) -> usize {
        if !self.is_enabled() {
            return 0;
        }
        let mut published = 0;
        for event in events {
            let result = match build_alert(pool, event, now).await {
                Ok(alert) => self.publish(&alert).await,
                Err(e) => Err(e.into()),
            };
            match result {
                Ok(()) => published += 1,
                Err(e) => error!(
                    "failed to publish sovereignty alert for system {}: {e:#}",
                    event.system_id()
                ),
            }
        }
        published
    }
}
