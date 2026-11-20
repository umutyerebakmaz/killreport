//! Sovereignty map sync: `GET /sovereignty/map` keeps
//! `sovereignty_map_current` equal to who holds which system, and every
//! system that changed hands gets a `territory_changes` row. The Rust
//! counterpart of `backend/src/workers/worker-sovereignty-map.ts`; see the
//! spec, `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! A first run (empty current map) loads the baseline without logging
//! changes. A feed with no owned system writes nothing: ESI never reports an
//! unclaimed New Eden for real, and acting on it would log a permanent `lost`
//! row for every system and empty the table, so the next run would mistake
//! itself for a first run. The change log, the upserts and the deletes go in
//! one transaction, so a failure cannot leave a change logged against a map
//! that never moved.
//!
//! Every time is UTC (EVE time) and bound from the caller's `now`, never the
//! database's `now()`, which would follow the session time zone.

use std::collections::HashMap;

use chrono::NaiveDateTime;
use esi::EsiClient;
use serde::Deserialize;
use sov::{AlertEvent, MAX_ALERTS};
use sqlx::PgPool;

/// Who holds a system. A system with none of the three is unowned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, sqlx::FromRow)]
pub struct Owner {
    pub alliance_id: Option<i32>,
    pub corporation_id: Option<i32>,
    pub faction_id: Option<i32>,
}

impl Owner {
    pub fn is_owned(&self) -> bool {
        self.alliance_id.is_some() || self.corporation_id.is_some() || self.faction_id.is_some()
    }
}

/// One entry of `GET /sovereignty/map`.
#[derive(Debug, Clone, Deserialize)]
pub struct EsiSovSystem {
    pub system_id: i32,
    pub alliance_id: Option<i32>,
    pub corporation_id: Option<i32>,
    pub faction_id: Option<i32>,
}

impl EsiSovSystem {
    fn owner(&self) -> Owner {
        Owner {
            alliance_id: self.alliance_id,
            corporation_id: self.corporation_id,
            faction_id: self.faction_id,
        }
    }
}

/// The label of a change, judged on the alliance alone, as Node judges it.
/// Anything that is not an alliance gaining, losing or swapping the system
/// is `faction_change`, a corporation swap inside one alliance included.
pub fn change_type(prev: Option<Owner>, next: Option<Owner>) -> &'static str {
    let prev = prev.and_then(|o| o.alliance_id);
    let next = next.and_then(|o| o.alliance_id);
    match (prev, next) {
        (None, Some(_)) => "captured",
        (Some(_), None) => "lost",
        (Some(p), Some(n)) if p != n => "transferred",
        _ => "faction_change",
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TerritoryChangeRow {
    pub solar_system_id: i32,
    pub previous_owner_id: Option<i32>,
    pub new_owner_id: Option<i32>,
    pub previous_faction_id: Option<i32>,
    pub new_faction_id: Option<i32>,
    pub change_type: &'static str,
}

#[derive(Debug, Default, PartialEq)]
pub struct MapDiff {
    pub upserts: Vec<(i32, Owner)>,
    pub deletes: Vec<i32>,
    pub changes: Vec<TerritoryChangeRow>,
}

/// What `fetched` changes against `existing`. Owned systems keep the feed's
/// order (a repeated one its first place and last owner); systems that lost
/// sovereignty follow, in system ID order. An empty `existing` is the first
/// run: rows, but no changes.
pub fn diff(existing: &HashMap<i32, Owner>, fetched: &[EsiSovSystem]) -> MapDiff {
    let mut owned: Vec<(i32, Owner)> = Vec::new();
    let mut index: HashMap<i32, usize> = HashMap::new();
    for entry in fetched {
        let owner = entry.owner();
        if !owner.is_owned() {
            continue;
        }
        match index.get(&entry.system_id) {
            Some(&i) => owned[i].1 = owner,
            None => {
                index.insert(entry.system_id, owned.len());
                owned.push((entry.system_id, owner));
            }
        }
    }

    let initial = existing.is_empty();
    let mut d = MapDiff::default();
    for &(system_id, owner) in &owned {
        let prev = existing.get(&system_id).copied();
        if prev == Some(owner) {
            continue;
        }
        d.upserts.push((system_id, owner));
        if !initial {
            d.changes.push(TerritoryChangeRow {
                solar_system_id: system_id,
                previous_owner_id: prev.and_then(|p| p.alliance_id),
                new_owner_id: owner.alliance_id,
                previous_faction_id: prev.and_then(|p| p.faction_id),
                new_faction_id: owner.faction_id,
                change_type: change_type(prev, Some(owner)),
            });
        }
    }

    let mut gone: Vec<(i32, Owner)> = existing
        .iter()
        .filter(|(id, _)| !index.contains_key(id))
        .map(|(id, o)| (*id, *o))
        .collect();
    gone.sort_unstable_by_key(|(id, _)| *id);
    for (system_id, prev) in gone {
        d.deletes.push(system_id);
        d.changes.push(TerritoryChangeRow {
            solar_system_id: system_id,
            previous_owner_id: prev.alliance_id,
            new_owner_id: None,
            previous_faction_id: prev.faction_id,
            new_faction_id: None,
            change_type: "lost",
        });
    }
    d
}

#[derive(Debug)]
pub enum MapOutcome {
    /// ESI listed no owned system; nothing was written.
    NoOwnedSystems,
    Synced {
        owned: usize,
        updated: usize,
        lost: usize,
        changes: usize,
        /// The first run: the baseline went in, no change was logged.
        initial: bool,
        /// The first `MAX_ALERTS` changes, to publish after the commit.
        alerts: Vec<AlertEvent>,
    },
}

#[derive(sqlx::FromRow)]
struct CurrentRow {
    solar_system_id: i32,
    #[sqlx(flatten)]
    owner: Owner,
}

pub async fn write_map(
    pool: &PgPool,
    fetched: &[EsiSovSystem],
    now: NaiveDateTime,
) -> sqlx::Result<MapOutcome> {
    if !fetched.iter().any(|e| e.owner().is_owned()) {
        return Ok(MapOutcome::NoOwnedSystems);
    }

    let mut tx = pool.begin().await?;
    let existing: HashMap<i32, Owner> = sqlx::query_as::<_, CurrentRow>(
        "SELECT solar_system_id, alliance_id, corporation_id, faction_id
         FROM sovereignty_map_current FOR UPDATE",
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|r| (r.solar_system_id, r.owner))
    .collect();
    let initial = existing.is_empty();
    let d = diff(&existing, fetched);
    let owned = fetched
        .iter()
        .filter(|e| e.owner().is_owned())
        .map(|e| e.system_id)
        .collect::<std::collections::HashSet<_>>()
        .len();

    if !d.changes.is_empty() {
        sqlx::query(
            "INSERT INTO territory_changes
               (solar_system_id, previous_owner_id, new_owner_id,
                previous_faction_id, new_faction_id, change_type, detected_at)
             SELECT u.*, $7
             FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[], $5::int[], $6::text[]) AS u",
        )
        .bind(
            d.changes
                .iter()
                .map(|c| c.solar_system_id)
                .collect::<Vec<_>>(),
        )
        .bind(
            d.changes
                .iter()
                .map(|c| c.previous_owner_id)
                .collect::<Vec<_>>(),
        )
        .bind(d.changes.iter().map(|c| c.new_owner_id).collect::<Vec<_>>())
        .bind(
            d.changes
                .iter()
                .map(|c| c.previous_faction_id)
                .collect::<Vec<_>>(),
        )
        .bind(
            d.changes
                .iter()
                .map(|c| c.new_faction_id)
                .collect::<Vec<_>>(),
        )
        .bind(d.changes.iter().map(|c| c.change_type).collect::<Vec<_>>())
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    if !d.upserts.is_empty() {
        sqlx::query(
            "INSERT INTO sovereignty_map_current
               (solar_system_id, alliance_id, corporation_id, faction_id, last_updated)
             SELECT u.*, $5 FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[]) AS u
             ON CONFLICT (solar_system_id) DO UPDATE SET
               alliance_id = EXCLUDED.alliance_id,
               corporation_id = EXCLUDED.corporation_id,
               faction_id = EXCLUDED.faction_id,
               last_updated = EXCLUDED.last_updated",
        )
        .bind(d.upserts.iter().map(|(id, _)| *id).collect::<Vec<_>>())
        .bind(
            d.upserts
                .iter()
                .map(|(_, o)| o.alliance_id)
                .collect::<Vec<_>>(),
        )
        .bind(
            d.upserts
                .iter()
                .map(|(_, o)| o.corporation_id)
                .collect::<Vec<_>>(),
        )
        .bind(
            d.upserts
                .iter()
                .map(|(_, o)| o.faction_id)
                .collect::<Vec<_>>(),
        )
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    if !d.deletes.is_empty() {
        sqlx::query("DELETE FROM sovereignty_map_current WHERE solar_system_id = ANY($1)")
            .bind(&d.deletes)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    let alerts = d
        .changes
        .iter()
        .take(MAX_ALERTS)
        .map(|c| AlertEvent::TerritoryChange {
            system_id: c.solar_system_id,
            previous_owner_id: c.previous_owner_id,
            new_owner_id: c.new_owner_id,
            change_type: Some(c.change_type.to_owned()),
        })
        .collect();
    Ok(MapOutcome::Synced {
        owned,
        updated: d.upserts.len(),
        lost: d.deletes.len(),
        changes: d.changes.len(),
        initial,
        alerts,
    })
}

/// Fetches the map and writes it. Returns how many systems ESI listed.
pub async fn sync(
    esi: &EsiClient,
    pool: &PgPool,
    now: NaiveDateTime,
) -> anyhow::Result<(usize, MapOutcome)> {
    let map: Vec<EsiSovSystem> = esi.get("/sovereignty/map").await?;
    let outcome = write_map(pool, &map, now).await?;
    Ok((map.len(), outcome))
}
