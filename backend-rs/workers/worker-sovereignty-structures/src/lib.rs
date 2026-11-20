//! Sovereignty structures sync: `GET /sovereignty/structures` becomes one
//! `sovereignty_structures` row per IHub or TCU, and a structure ESI stops
//! listing is marked destroyed. The Rust counterpart of
//! `backend/src/workers/worker-sovereignty-structures.ts`; see the spec,
//! `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! An empty list writes nothing. ESI never reports zero sovereignty
//! structures for real, so an empty answer is a bad poll; marking every
//! structure destroyed on it would show every IHub as gone until the next run.
//!
//! Every time is UTC (EVE time) and bound from the caller's `now`, never the
//! database's `now()`, which would follow the session time zone.

use chrono::{DateTime, NaiveDateTime, Utc};
use esi::EsiClient;
use serde::Deserialize;
use sqlx::PgPool;

/// One entry of `GET /sovereignty/structures`.
#[derive(Debug, Clone, Deserialize)]
pub struct EsiStructure {
    pub structure_id: i64,
    pub solar_system_id: i32,
    pub structure_type_id: i32,
    pub alliance_id: i32,
    pub vulnerability_occupancy_level: Option<f64>,
    pub vulnerable_start_time: Option<DateTime<Utc>>,
    pub vulnerable_end_time: Option<DateTime<Utc>>,
}

#[derive(Debug, PartialEq)]
pub enum StructuresOutcome {
    /// ESI listed nothing; nothing was written.
    EmptyFeed,
    Synced {
        upserted: u64,
        destroyed: u64,
    },
}

/// Upserts every listed structure and marks the unlisted live ones
/// destroyed, in one transaction. Existing rows keep their system and type;
/// owner, vulnerability window and `last_seen` follow ESI, and a structure
/// seen again loses its `destroyed_at`.
pub async fn write_structures(
    pool: &PgPool,
    structures: &[EsiStructure],
    now: NaiveDateTime,
) -> sqlx::Result<StructuresOutcome> {
    if structures.is_empty() {
        return Ok(StructuresOutcome::EmptyFeed);
    }

    let ids: Vec<i64> = structures.iter().map(|s| s.structure_id).collect();
    let systems: Vec<i32> = structures.iter().map(|s| s.solar_system_id).collect();
    let types: Vec<i32> = structures.iter().map(|s| s.structure_type_id).collect();
    let alliances: Vec<i32> = structures.iter().map(|s| s.alliance_id).collect();
    let levels: Vec<Option<f64>> = structures
        .iter()
        .map(|s| s.vulnerability_occupancy_level)
        .collect();
    let starts: Vec<Option<NaiveDateTime>> = structures
        .iter()
        .map(|s| s.vulnerable_start_time.map(|t| t.naive_utc()))
        .collect();
    let ends: Vec<Option<NaiveDateTime>> = structures
        .iter()
        .map(|s| s.vulnerable_end_time.map(|t| t.naive_utc()))
        .collect();

    let mut tx = pool.begin().await?;
    let upserted = sqlx::query(
        "INSERT INTO sovereignty_structures
           (structure_id, solar_system_id, structure_type_id, alliance_id,
            vulnerability_occupancy_level, vulnerable_start_time, vulnerable_end_time,
            first_seen, last_seen)
         SELECT u.*, $8, $8
         FROM UNNEST($1::bigint[], $2::int[], $3::int[], $4::int[],
                     $5::float8[], $6::timestamp[], $7::timestamp[]) AS u
         ON CONFLICT (structure_id) DO UPDATE SET
           alliance_id = EXCLUDED.alliance_id,
           vulnerability_occupancy_level = EXCLUDED.vulnerability_occupancy_level,
           vulnerable_start_time = EXCLUDED.vulnerable_start_time,
           vulnerable_end_time = EXCLUDED.vulnerable_end_time,
           destroyed_at = NULL,
           last_seen = EXCLUDED.last_seen",
    )
    .bind(&ids)
    .bind(&systems)
    .bind(&types)
    .bind(&alliances)
    .bind(&levels)
    .bind(&starts)
    .bind(&ends)
    .bind(now)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let destroyed = sqlx::query(
        "UPDATE sovereignty_structures SET destroyed_at = $1
         WHERE destroyed_at IS NULL AND structure_id <> ALL($2::bigint[])",
    )
    .bind(now)
    .bind(&ids)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;

    Ok(StructuresOutcome::Synced {
        upserted,
        destroyed,
    })
}

/// Fetches the list and writes it. Returns how many structures ESI listed.
pub async fn sync(
    esi: &EsiClient,
    pool: &PgPool,
    now: NaiveDateTime,
) -> anyhow::Result<(usize, StructuresOutcome)> {
    let structures: Vec<EsiStructure> = esi.get("/sovereignty/structures").await?;
    let outcome = write_structures(pool, &structures, now).await?;
    Ok((structures.len(), outcome))
}
