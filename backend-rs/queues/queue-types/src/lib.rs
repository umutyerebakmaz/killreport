//! The type queue publisher's testable parts: ESI's list of type IDs, the IDs
//! the table already holds, and the difference between them.
//!
//! The candidates come from an ESI list endpoint, as for a root scan, but the
//! "already in the database?" filter is applied here, as for an enrichment
//! queue: types are static, so only the missing ones are published and the
//! worker never has to skip.

use std::collections::HashSet;

use esi::{EsiClient, EsiError};
use sqlx::PgPool;

/// The queue `worker-info-types` consumes.
pub const QUEUE_NAME: &str = "esi_type_info_queue";
/// The `source` field of every message, the Node script's name.
pub const SOURCE: &str = "queue-types";

/// Every type ID ESI knows, every page of `/universe/types/`. Node collects
/// them group by group from `/universe/groups/` and reads only that list's
/// first page (`type.service.ts:12-49`), which misses every group past it.
pub async fn fetch_type_ids(esi: &EsiClient) -> Result<Vec<i32>, EsiError> {
    esi.get_paged("/universe/types/").await
}

/// Every type already in the table.
pub async fn existing_type_ids(pool: &PgPool) -> sqlx::Result<HashSet<i32>> {
    let ids: Vec<i32> = sqlx::query_scalar("SELECT id FROM types")
        .fetch_all(pool)
        .await?;
    Ok(ids.into_iter().collect())
}

/// The IDs in `esi_ids` that are not in `existing`, in ESI's order, each
/// once: a list that shifts between page reads can repeat an ID.
pub fn missing(esi_ids: &[i32], existing: &HashSet<i32>) -> Vec<i32> {
    let mut seen = HashSet::new();
    esi_ids
        .iter()
        .copied()
        .filter(|id| !existing.contains(id) && seen.insert(*id))
        .collect()
}
