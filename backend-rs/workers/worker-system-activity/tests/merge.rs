//! The two pure decisions behind an hourly snapshot: the hour it is filed
//! under and how the two ESI lists become one row per system. The Rust
//! counterparts of `backend/src/utils/system-activity.spec.ts`.

use chrono::{DateTime, NaiveDateTime, Utc};
use worker_system_activity::{
    hour_snapshot_time, merge_system_activity, EsiSystemJumps, EsiSystemKills,
};

fn at(s: &str) -> DateTime<Utc> {
    s.parse().unwrap()
}

fn hour(s: &str) -> NaiveDateTime {
    at(s).naive_utc()
}

fn k(id: i32, n: i32) -> EsiSystemKills {
    EsiSystemKills {
        system_id: id,
        npc_kills: n,
        pod_kills: n,
        ship_kills: n,
    }
}

fn j(id: i32, n: i32) -> EsiSystemJumps {
    EsiSystemJumps {
        system_id: id,
        ship_jumps: n,
    }
}

fn ids(kills: &[EsiSystemKills], jumps: &[EsiSystemJumps]) -> Vec<i32> {
    merge_system_activity(kills, jumps, hour("2026-11-19T13:00:00Z"))
        .iter()
        .map(|r| r.system_id)
        .collect()
}

#[test]
fn floors_to_the_hour() {
    assert_eq!(
        hour_snapshot_time(at("2026-11-19T13:42:17.123Z")),
        hour("2026-11-19T13:00:00Z")
    );
}

#[test]
fn leaves_an_exact_hour_alone() {
    assert_eq!(
        hour_snapshot_time(at("2026-11-19T13:00:00Z")),
        hour("2026-11-19T13:00:00Z")
    );
}

#[test]
fn floors_the_last_millisecond() {
    assert_eq!(
        hour_snapshot_time(at("2026-11-19T13:59:59.999Z")),
        hour("2026-11-19T13:00:00Z")
    );
}

#[test]
fn merges_a_system_both_endpoints_report() {
    let ts = hour("2026-11-19T13:00:00Z");
    let rows = merge_system_activity(&[k(1, 3)], &[j(1, 7)], ts);
    assert_eq!(rows.len(), 1);
    let row = &rows[0];
    assert_eq!(
        (row.npc_kills, row.pod_kills, row.ship_kills, row.ship_jumps),
        (3, 3, 3, Some(7))
    );
    assert_eq!(row.timestamp, ts);
}

#[test]
fn kills_only_system_has_null_jumps() {
    let rows = merge_system_activity(&[k(1, 3)], &[], hour("2026-11-19T13:00:00Z"));
    assert_eq!(rows[0].ship_jumps, None);
    assert_eq!(rows[0].ship_kills, 3);
}

#[test]
fn jumps_only_system_has_zero_kills() {
    let rows = merge_system_activity(&[], &[j(2, 9)], hour("2026-11-19T13:00:00Z"));
    let row = &rows[0];
    assert_eq!(
        (
            row.system_id,
            row.npc_kills,
            row.pod_kills,
            row.ship_kills,
            row.ship_jumps
        ),
        (2, 0, 0, 0, Some(9))
    );
}

#[test]
fn one_row_per_system_across_both_lists() {
    assert_eq!(ids(&[k(1, 1), k(2, 1)], &[j(2, 5), j(3, 5)]).len(), 3);
}

#[test]
fn kills_order_first_then_jumps_only() {
    assert_eq!(ids(&[k(5, 1), k(3, 1)], &[j(4, 1), j(3, 1)]), vec![5, 3, 4]);
}

#[test]
fn two_empty_lists_give_nothing() {
    assert!(ids(&[], &[]).is_empty());
}

#[test]
fn the_last_repeat_wins_in_the_first_place() {
    let rows = merge_system_activity(
        &[k(5, 1), k(6, 1), k(5, 2)],
        &[],
        hour("2026-11-19T13:00:00Z"),
    );
    assert_eq!(
        rows.iter().map(|r| r.system_id).collect::<Vec<_>>(),
        vec![5, 6]
    );
    assert_eq!(rows[0].ship_kills, 2);
}
