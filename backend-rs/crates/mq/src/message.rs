//! The message every info queue publisher sends: the publishing half of
//! `runner::EntityQueueMessage`.

use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;

/// `{"entityId":99000001,"queuedAt":"2026-11-15T10:00:00.000Z","source":"queue-alliances"}`,
/// field for field and in this order what the Node publishers send
/// (`queue-alliances.ts:31-35`), so a worker cannot tell which one queued it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityMessage {
    pub entity_id: i32,
    /// `Date.prototype.toISOString()`: milliseconds always, and `Z`.
    pub queued_at: String,
    /// The publishing script's name.
    pub source: &'static str,
}

impl EntityMessage {
    /// A message queued now.
    pub fn new(entity_id: i32, source: &'static str) -> Self {
        Self::at(entity_id, source, Utc::now())
    }

    /// A message queued at `now`.
    pub fn at(entity_id: i32, source: &'static str, now: DateTime<Utc>) -> Self {
        Self {
            entity_id,
            queued_at: now.to_rfc3339_opts(SecondsFormat::Millis, true),
            source,
        }
    }

    /// The JSON body. An integer and two strings always serialize.
    pub fn to_body(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("an EntityMessage always serializes")
    }
}
