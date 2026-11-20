//! `change_type` and `diff`: what the fetched map changes, without a database.

use std::collections::HashMap;

use worker_sovereignty_map::{change_type, diff, EsiSovSystem, Owner, TerritoryChangeRow};

fn alliance(id: i32) -> Owner {
    Owner {
        alliance_id: Some(id),
        corporation_id: Some(1000 + id),
        faction_id: None,
    }
}

fn faction(id: i32) -> Owner {
    Owner {
        alliance_id: None,
        corporation_id: None,
        faction_id: Some(id),
    }
}

fn entry(system_id: i32, o: Owner) -> EsiSovSystem {
    EsiSovSystem {
        system_id,
        alliance_id: o.alliance_id,
        corporation_id: o.corporation_id,
        faction_id: o.faction_id,
    }
}

#[test]
fn change_types() {
    assert_eq!(change_type(None, Some(alliance(1))), "captured");
    assert_eq!(change_type(Some(alliance(1)), None), "lost");
    assert_eq!(
        change_type(Some(alliance(1)), Some(faction(500001))),
        "lost"
    );
    assert_eq!(
        change_type(Some(alliance(1)), Some(alliance(2))),
        "transferred"
    );
    assert_eq!(
        change_type(Some(faction(500001)), Some(faction(500002))),
        "faction_change"
    );
    let other_corp = Owner {
        corporation_id: Some(7),
        ..alliance(1)
    };
    assert_eq!(
        change_type(Some(alliance(1)), Some(other_corp)),
        "faction_change"
    );
}

#[test]
fn unowned_entries_are_ignored() {
    let d = diff(&HashMap::new(), &[entry(1, Owner::default())]);
    assert!(d.upserts.is_empty());
    assert!(d.changes.is_empty());
}

#[test]
fn unchanged_system_is_skipped() {
    let existing = HashMap::from([(1, alliance(1))]);
    let d = diff(&existing, &[entry(1, alliance(1))]);
    assert_eq!(d, Default::default());
}

#[test]
fn initial_population_logs_nothing() {
    let d = diff(
        &HashMap::new(),
        &[entry(1, alliance(1)), entry(2, alliance(2))],
    );
    assert_eq!(d.upserts, vec![(1, alliance(1)), (2, alliance(2))]);
    assert!(d.changes.is_empty());
    assert!(d.deletes.is_empty());
}

#[test]
fn owner_change_is_logged() {
    let existing = HashMap::from([(1, alliance(1))]);
    let d = diff(&existing, &[entry(1, alliance(2))]);
    assert_eq!(d.upserts, vec![(1, alliance(2))]);
    assert_eq!(
        d.changes,
        vec![TerritoryChangeRow {
            solar_system_id: 1,
            previous_owner_id: Some(1),
            new_owner_id: Some(2),
            previous_faction_id: None,
            new_faction_id: None,
            change_type: "transferred",
        }]
    );
}

#[test]
fn lost_system_is_deleted_and_logged() {
    let existing = HashMap::from([(1, alliance(1)), (2, alliance(2))]);
    let d = diff(&existing, &[entry(1, alliance(1))]);
    assert_eq!(d.deletes, vec![2]);
    assert_eq!(
        d.changes,
        vec![TerritoryChangeRow {
            solar_system_id: 2,
            previous_owner_id: Some(2),
            new_owner_id: None,
            previous_faction_id: None,
            new_faction_id: None,
            change_type: "lost",
        }]
    );
}

#[test]
fn a_repeated_system_keeps_the_last_owner() {
    let existing = HashMap::from([(1, alliance(1))]);
    let d = diff(&existing, &[entry(1, alliance(2)), entry(1, alliance(3))]);
    assert_eq!(d.upserts, vec![(1, alliance(3))]);
    assert_eq!(d.changes.len(), 1);
    assert_eq!(d.changes[0].new_owner_id, Some(3));
}
