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
use serde::Deserialize;

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
