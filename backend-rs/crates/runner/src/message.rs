//! The queue message every info queue publisher sends.

use serde::Deserialize;

/// `{ "entityId": 99000001, "queuedAt": "...", "source": "queue-alliances" }`,
/// as any info-queue publisher sends it.
/// The ID is read as `entityId`, or under the name a queue gives it:
/// `killmailId` (`backfill_killmail_values_queue`), `userId` (the two
/// killmail sync queues). `fullSync` is read when present, false otherwise;
/// only the killmail sync workers look at it. Other fields are ignored rather
/// than refused, so a publisher that adds one does not break a worker.
#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct EntityQueueMessage {
    #[serde(rename = "entityId", alias = "killmailId", alias = "userId")]
    pub entity_id: i32,
    #[serde(default, rename = "fullSync")]
    pub full_sync: bool,
}

impl EntityQueueMessage {
    /// A body that does not parse is a defect in the message: it goes down
    /// the shared failure path like any other, retried and then parked
    /// (spec, "Hata yolu").
    pub fn parse(body: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(body)
    }
}
