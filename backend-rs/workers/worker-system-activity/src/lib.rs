//! Hourly system activity snapshot: the two ESI lists,
//! `/universe/system_kills` and `/universe/system_jumps`, become one
//! `system_activity` row per system for the hour. The Rust counterpart of
//! `backend/src/workers/worker-system-activity.ts` and
//! `backend/src/utils/system-activity.ts`; see the spec,
//! `docs/superpowers/specs/2026-11-19-rust-system-activity-design.md`.
//!
//! The two lists do not cover the same systems, and a gap means different
//! things on each side, deliberately:
//!
//! - A missing kill count is 0. The three kills columns are NOT NULL with a
//!   zero default and have always been filled that way.
//! - A missing jump count is NULL. `ship_jumps` is nullable so that rows
//!   written before the column existed do not claim their hours had no
//!   traffic. A chart skips a null; it would plot a zero.

use std::collections::HashMap;

use chrono::{DateTime, DurationRound as _, NaiveDateTime, TimeDelta, Utc};
use esi::{CompatibilityDate, EsiClient};
use serde::Deserialize;
use sqlx::PgPool;

/// One entry of `GET /universe/system_kills`.
#[derive(Debug, Clone, Deserialize)]
pub struct EsiSystemKills {
    pub system_id: i32,
    pub npc_kills: i32,
    pub pod_kills: i32,
    pub ship_kills: i32,
}

/// One entry of `GET /universe/system_jumps`.
#[derive(Debug, Clone, Deserialize)]
pub struct EsiSystemJumps {
    pub system_id: i32,
    pub ship_jumps: i32,
}

/// One `system_activity` row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SystemActivityRow {
    pub system_id: i32,
    pub npc_kills: i32,
    pub pod_kills: i32,
    pub ship_kills: i32,
    /// `None` means ESI did not report the system, not that nobody jumped.
    pub ship_jumps: Option<i32>,
    /// UTC; the column is `timestamp(3) without time zone`.
    pub timestamp: NaiveDateTime,
}

/// The snapshot's own hour: `now` floored to the UTC hour. Every row of one
/// run shares it, which makes `(system_id, timestamp)` a usable unique key
/// and lets a re-run of the same hour write nothing.
pub fn hour_snapshot_time(now: DateTime<Utc>) -> NaiveDateTime {
    now.naive_utc()
        .duration_trunc(TimeDelta::hours(1))
        .expect("an hour always divides a timestamp")
}

/// The two ESI lists into one row per system: the kills list's order first,
/// then the systems only the jumps list reports. A system an endpoint repeats
/// keeps its first place and takes the last values, as the Node `Map` does.
pub fn merge_system_activity(
    kills: &[EsiSystemKills],
    jumps: &[EsiSystemJumps],
    timestamp: NaiveDateTime,
) -> Vec<SystemActivityRow> {
    let mut rows: Vec<SystemActivityRow> = Vec::with_capacity(kills.len() + jumps.len());
    let mut index: HashMap<i32, usize> = HashMap::with_capacity(rows.capacity());

    for kill in kills {
        let row = SystemActivityRow {
            system_id: kill.system_id,
            npc_kills: kill.npc_kills,
            pod_kills: kill.pod_kills,
            ship_kills: kill.ship_kills,
            ship_jumps: None,
            timestamp,
        };
        match index.get(&kill.system_id) {
            Some(&i) => rows[i] = row,
            None => {
                index.insert(kill.system_id, rows.len());
                rows.push(row);
            }
        }
    }

    for jump in jumps {
        match index.get(&jump.system_id) {
            Some(&i) => rows[i].ship_jumps = Some(jump.ship_jumps),
            None => {
                index.insert(jump.system_id, rows.len());
                rows.push(SystemActivityRow {
                    system_id: jump.system_id,
                    npc_kills: 0,
                    pod_kills: 0,
                    ship_kills: 0,
                    ship_jumps: Some(jump.ship_jumps),
                    timestamp,
                });
            }
        }
    }

    rows
}

/// Write one snapshot in a single statement and return how many rows were
/// written. A row whose `(system_id, timestamp)` is already there is skipped,
/// so a re-run of the same hour writes nothing and keeps the first rows; one
/// statement means the snapshot is written whole or not at all.
pub async fn insert_snapshot(pool: &PgPool, rows: &[SystemActivityRow]) -> sqlx::Result<u64> {
    if rows.is_empty() {
        return Ok(0);
    }
    let column = |f: fn(&SystemActivityRow) -> i32| rows.iter().map(f).collect::<Vec<_>>();
    let ship_jumps: Vec<Option<i32>> = rows.iter().map(|r| r.ship_jumps).collect();
    let timestamps: Vec<NaiveDateTime> = rows.iter().map(|r| r.timestamp).collect();

    let result = sqlx::query(
        "INSERT INTO system_activity
           (system_id, npc_kills, pod_kills, ship_kills, ship_jumps, \"timestamp\")
         SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[], $5::int[], $6::timestamp[])
         ON CONFLICT (system_id, \"timestamp\") DO NOTHING",
    )
    .bind(column(|r| r.system_id))
    .bind(column(|r| r.npc_kills))
    .bind(column(|r| r.pod_kills))
    .bind(column(|r| r.ship_kills))
    .bind(ship_jumps)
    .bind(timestamps)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// The date both routes are read at, as `solar-system.service.ts` sends it.
pub const COMPATIBILITY_DATE: CompatibilityDate = CompatibilityDate::new("2025-12-16");

/// What one run fetched and wrote, for the log.
#[derive(Debug)]
pub struct Snapshot {
    pub timestamp: NaiveDateTime,
    pub kill_systems: usize,
    pub jump_systems: usize,
    pub ship_kills: i64,
    pub pod_kills: i64,
    pub npc_kills: i64,
    pub ship_jumps: i64,
    pub rows: usize,
    pub inserted: u64,
}

/// Fetch both lists together, merge them and write the snapshot for the hour
/// `now` falls in. `None` when ESI returned two empty lists. A failed request
/// fails the run before anything is written: half a snapshot would record the
/// other half as "not reported" for an hour that is never revisited.
pub async fn take_snapshot(
    esi: &EsiClient,
    pool: &PgPool,
    now: DateTime<Utc>,
) -> anyhow::Result<Option<Snapshot>> {
    let timestamp = hour_snapshot_time(now);
    let (kills, jumps) = tokio::try_join!(
        esi.get_with_compatibility_date::<Vec<EsiSystemKills>>(
            "/universe/system_kills",
            COMPATIBILITY_DATE
        ),
        esi.get_with_compatibility_date::<Vec<EsiSystemJumps>>(
            "/universe/system_jumps",
            COMPATIBILITY_DATE
        ),
    )?;
    if kills.is_empty() && jumps.is_empty() {
        return Ok(None);
    }

    let sum = |f: fn(&EsiSystemKills) -> i32| kills.iter().map(|k| i64::from(f(k))).sum::<i64>();
    let rows = merge_system_activity(&kills, &jumps, timestamp);
    let inserted = insert_snapshot(pool, &rows).await?;
    Ok(Some(Snapshot {
        timestamp,
        kill_systems: kills.len(),
        jump_systems: jumps.len(),
        ship_kills: sum(|k| k.ship_kills),
        pod_kills: sum(|k| k.pod_kills),
        npc_kills: sum(|k| k.npc_kills),
        ship_jumps: jumps.iter().map(|j| i64::from(j.ship_jumps)).sum(),
        rows: rows.len(),
        inserted,
    }))
}
