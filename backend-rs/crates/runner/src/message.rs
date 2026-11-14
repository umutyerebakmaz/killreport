//! The queue message every info queue publisher sends.

use serde::Deserialize;

/// `{ "entityId": 99000001, "queuedAt": "...", "source": "queue-alliances" }`
/// (`queue-alliances.ts:32-34`). Only `entityId` is read; the other fields
/// are ignored rather than refused, so a publisher that adds one does not
/// break this worker.
#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct EntityQueueMessage {
    #[serde(rename = "entityId")]
    pub entity_id: i32,
}

impl EntityQueueMessage {
    /// A body that does not parse is a defect in the message: it goes down
    /// the shared failure path like any other, retried and then parked
    /// (spec, "Hata yolu"; the one deliberate difference from Node).
    pub fn parse(body: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(body)
    }
}
