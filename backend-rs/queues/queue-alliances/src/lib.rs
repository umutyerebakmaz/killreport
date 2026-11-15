//! The alliance queue publisher's testable part: the ESI list fetch.

use esi::{EsiClient, EsiError};

/// The queue `worker-info-alliances` consumes.
pub const QUEUE_NAME: &str = "esi_alliance_info_queue";
/// The `source` field of every message, the Node script's name.
pub const SOURCE: &str = "queue-alliances";

/// Every alliance ID ESI knows, unfiltered: this is a root scan
/// (`alliance.service.ts:11-14`, no trailing slash).
pub async fn fetch_alliance_ids(esi: &EsiClient) -> Result<Vec<i32>, EsiError> {
    esi.get("/alliances").await
}
