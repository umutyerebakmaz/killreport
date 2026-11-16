//! The alliance-corporations queue publisher's testable part: the ESI list fetch.

use esi::{EsiClient, EsiError};

/// The queue `worker-alliance-corporations` consumes.
pub const QUEUE_NAME: &str = "esi_alliance_corporations_queue";
/// The `source` field of every message, the queue's own name.
pub const SOURCE: &str = "esi_alliance_corporations_queue";
/// Message priority, as the Node publisher sets it.
pub const PRIORITY: u8 = 5;

/// Every alliance ID ESI knows, unfiltered: this is a root scan
/// (`alliance.service.ts:11-14`, no trailing slash).
pub async fn fetch_alliance_ids(esi: &EsiClient) -> Result<Vec<i32>, EsiError> {
    esi.get("/alliances").await
}
