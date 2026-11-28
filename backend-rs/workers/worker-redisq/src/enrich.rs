//! Enrichment before the save (spec §4): every character, corporation,
//! alliance and type the killmail names that the database does not have is
//! fetched from ESI and written, so the killmail never reaches the live feed
//! with a name missing. The writes are `entity_info`'s, the same ones the
//! info workers make.
//!
//! An entity ESI will not give is logged and queued to its own info queue,
//! for its worker to retry; the killmail is saved regardless.

use std::collections::BTreeSet;
use std::future::Future;

use esi::EsiClient;
use futures_util::stream::{self, StreamExt};
use killmail_writer::KillmailDetail;
use sqlx::PgPool;
use tracing::warn;

use crate::outbox::Outbox;

/// Fetches in flight at once within one kind, as Node's batches of 10.
const CONCURRENCY: usize = 10;

/// What the database lacks, each list sorted and without duplicates.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Missing {
    pub alliances: Vec<i32>,
    pub corporations: Vec<i32>,
    pub characters: Vec<i32>,
    pub types: Vec<i32>,
}

/// One enrichment's tally.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Enriched {
    pub written: usize,
    pub failed: usize,
}

fn ids(it: impl IntoIterator<Item = Option<i32>>) -> Vec<i32> {
    it.into_iter()
        .flatten()
        .filter(|&id| id > 0)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

async fn absent(pool: &PgPool, table: &str, ids: Vec<i32>) -> sqlx::Result<Vec<i32>> {
    if ids.is_empty() {
        return Ok(ids);
    }
    // `table` is one of four constants below, never input.
    sqlx::query_scalar(&format!(
        "SELECT id FROM UNNEST($1::int[]) AS t(id)
         WHERE NOT EXISTS (SELECT 1 FROM {table} e WHERE e.id = t.id)
         ORDER BY id"
    ))
    .bind(&ids)
    .fetch_all(pool)
    .await
}

/// The IDs Node's enrichment collects — victim character, corporation,
/// alliance and ship; each attacker's character, corporation, alliance,
/// ship and weapon; the item types — that have no row.
pub async fn missing(pool: &PgPool, detail: &KillmailDetail) -> sqlx::Result<Missing> {
    let v = &detail.victim;
    let a = &detail.attackers;
    let characters = ids(std::iter::once(v.character_id).chain(a.iter().map(|a| a.character_id)));
    let corporations =
        ids(std::iter::once(Some(v.corporation_id)).chain(a.iter().map(|a| a.corporation_id)));
    let alliances = ids(std::iter::once(v.alliance_id).chain(a.iter().map(|a| a.alliance_id)));
    let types = ids(std::iter::once(Some(v.ship_type_id))
        .chain(a.iter().flat_map(|a| [a.ship_type_id, a.weapon_type_id]))
        .chain(v.items.iter().map(|i| i.item_type_id)));

    Ok(Missing {
        alliances: absent(pool, "alliances", alliances).await?,
        corporations: absent(pool, "corporations", corporations).await?,
        characters: absent(pool, "characters", characters).await?,
        types: absent(pool, "types", types).await?,
    })
}

/// Fetch and write one kind, [`CONCURRENCY`] at a time; returns the IDs that
/// failed.
async fn fetch_all<'a, F, Fut>(entity: &str, ids: &'a [i32], fetch: F) -> Vec<i32>
where
    F: Fn(i32) -> Fut,
    Fut: Future<Output = anyhow::Result<entity_info::Fetched>> + 'a,
{
    stream::iter(ids.iter().copied())
        .map(|id| {
            let fut = fetch(id);
            async move { (id, fut.await) }
        })
        .buffer_unordered(CONCURRENCY)
        .filter_map(|(id, result)| async move {
            match result {
                Ok(_) => None,
                Err(e) => {
                    warn!("   ✗ {entity} {id} not enriched: {e:#}");
                    Some(id)
                }
            }
        })
        .collect()
        .await
}

/// Write what [`missing`] finds, alliances first, then corporations,
/// characters and types, as Node orders them. Only the lookup's database
/// error is an `Err`; a fetch that fails is counted, logged and queued.
pub async fn enrich(
    pool: &PgPool,
    esi: &EsiClient,
    outbox: &dyn Outbox,
    detail: &KillmailDetail,
) -> sqlx::Result<Enriched> {
    let missing = missing(pool, detail).await?;
    let mut tally = Enriched::default();

    let kinds = [
        ("alliance", &missing.alliances),
        ("corporation", &missing.corporations),
        ("character", &missing.characters),
        ("type", &missing.types),
    ];
    for (entity, ids) in kinds {
        if ids.is_empty() {
            continue;
        }
        let failed = match entity {
            "alliance" => {
                fetch_all(entity, ids, |id| {
                    entity_info::alliance::fetch_and_upsert(pool, esi, id)
                })
                .await
            }
            "corporation" => {
                fetch_all(entity, ids, |id| {
                    entity_info::corporation::fetch_and_upsert(pool, esi, id)
                })
                .await
            }
            "character" => {
                fetch_all(entity, ids, |id| {
                    entity_info::character::fetch_and_upsert(pool, esi, id)
                })
                .await
            }
            _ => {
                fetch_all(entity, ids, |id| {
                    entity_info::type_info::fetch_and_upsert(pool, esi, id)
                })
                .await
            }
        };
        tally.written += ids.len() - failed.len();
        tally.failed += failed.len();
        if !failed.is_empty() {
            let queue = format!("esi_{entity}_info_queue");
            if let Err(e) = outbox.publish_entities(&queue, &failed).await {
                warn!(
                    "   ⚠️  {} {entity}(s) not queued to {queue}: {e:#}",
                    failed.len()
                );
            }
        }
    }
    Ok(tally)
}
