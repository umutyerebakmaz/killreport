//! The message every info queue publisher sends: the publishing half of
//! `runner::EntityQueueMessage`.

use std::borrow::Cow;

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
    /// The publishing script's name, or a name built at run time such as
    /// `alliance_99000001`.
    pub source: Cow<'static, str>,
}

impl EntityMessage {
    /// A message queued now.
    pub fn new(entity_id: i32, source: impl Into<Cow<'static, str>>) -> Self {
        Self::at(entity_id, source, Utc::now())
    }

    /// A message queued at `now`.
    pub fn at(entity_id: i32, source: impl Into<Cow<'static, str>>, now: DateTime<Utc>) -> Self {
        Self {
            entity_id,
            queued_at: now.to_rfc3339_opts(SecondsFormat::Millis, true),
            source: source.into(),
        }
    }

    /// The JSON body. An integer and two strings always serialize.
    pub fn to_body(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("an EntityMessage always serializes")
    }
}

/// `{"killmailId":133900250,"queuedAt":"…","source":"queue-backfill-values"}`,
/// what the Node `queue-backfill-values.ts` sends, in the same field order.
/// A killmail queue names its ID `killmailId`; `runner` reads either name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillmailMessage {
    pub killmail_id: i32,
    /// `Date.prototype.toISOString()`: milliseconds always, and `Z`.
    pub queued_at: String,
    pub source: Cow<'static, str>,
}

impl KillmailMessage {
    /// A message queued now.
    pub fn new(killmail_id: i32, source: impl Into<Cow<'static, str>>) -> Self {
        Self::at(killmail_id, source, Utc::now())
    }

    /// A message queued at `now`.
    pub fn at(killmail_id: i32, source: impl Into<Cow<'static, str>>, now: DateTime<Utc>) -> Self {
        Self {
            killmail_id,
            queued_at: now.to_rfc3339_opts(SecondsFormat::Millis, true),
            source: source.into(),
        }
    }

    /// The JSON body. An integer and two strings always serialize.
    pub fn to_body(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("a KillmailMessage always serializes")
    }
}
