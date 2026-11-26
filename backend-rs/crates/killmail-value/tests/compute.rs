//! The formula on its own, with the values of the Node spec
//! (`backend/src/helpers/calculate-killmail-values.spec.ts`).

use std::collections::HashMap;

use killmail_value::{compute, Item, TypeInfo, Values};

const CAPSULE: i32 = 670;
const GENOLUTION: i32 = 33328;
const RIFTER: i32 = 587;
const AMMO: i32 = 178;
const BLUEPRINT: i32 = 999;

fn info(sell: f64, group_id: i32, is_blueprint: bool) -> TypeInfo {
    TypeInfo {
        sell,
        group_id: Some(group_id),
        is_blueprint,
    }
}

fn types() -> HashMap<i32, TypeInfo> {
    HashMap::from([
        (CAPSULE, info(0.0, 29, false)),
        (GENOLUTION, info(5_000_000.0, 29, false)),
        (RIFTER, info(500_000.0, 25, false)),
        (AMMO, info(10.0, 83, false)),
        (BLUEPRINT, info(1_000_000.0, 700, true)),
    ])
}

fn item(type_id: i32, destroyed: Option<i32>, dropped: Option<i32>, singleton: i32) -> Item {
    Item {
        type_id,
        quantity_destroyed: destroyed,
        quantity_dropped: dropped,
        singleton,
    }
}

fn values(total: f64, destroyed: f64, dropped: f64) -> Values {
    Values {
        total,
        destroyed,
        dropped,
    }
}

#[test]
fn ship_only() {
    assert_eq!(
        compute(RIFTER, &[], &types()),
        values(500_000.0, 500_000.0, 0.0)
    );
}

#[test]
fn destroyed_and_dropped() {
    let items = [
        item(AMMO, Some(100), None, 0),
        item(AMMO, None, Some(50), 0),
    ];
    assert_eq!(
        compute(RIFTER, &items, &types()),
        values(501_500.0, 501_000.0, 500.0)
    );
}

#[test]
fn capsule_by_group() {
    assert_eq!(compute(CAPSULE, &[], &types()), values(10.0, 10.0, 0.0));
    // Group 29, not type 670: the Genolution pod is a capsule too, whatever
    // its market price.
    assert_eq!(compute(GENOLUTION, &[], &types()), values(10.0, 10.0, 0.0));
}

#[test]
fn bpc_and_bpo() {
    let copy = compute(CAPSULE, &[item(BLUEPRINT, Some(1), None, 2)], &types());
    assert_eq!(copy, values(10.01, 10.01, 0.0));
    let original = compute(CAPSULE, &[item(BLUEPRINT, Some(1), None, 1)], &types());
    assert_eq!(original, values(1_000_010.0, 1_000_010.0, 0.0));
}

#[test]
fn unknown_type_is_zero() {
    let result = compute(1, &[item(2, Some(5), Some(5), 0)], &types());
    assert_eq!(result, values(0.0, 0.0, 0.0));
    assert!(result.is_zero());
    assert!(!compute(RIFTER, &[], &types()).is_zero());
}

#[test]
fn none_quantities_are_zero() {
    assert_eq!(
        compute(RIFTER, &[item(AMMO, None, None, 0)], &types()),
        values(500_000.0, 500_000.0, 0.0)
    );
}

#[test]
fn rounds_to_two_places() {
    let mut map = types();
    map.insert(RIFTER, info(0.0, 25, false));
    map.insert(AMMO, info(0.333, 83, false));
    let result = compute(RIFTER, &[item(AMMO, Some(3), None, 0)], &map);
    assert_eq!(result, values(1.0, 1.0, 0.0));

    map.insert(AMMO, info(1.234, 83, false));
    let result = compute(RIFTER, &[item(AMMO, Some(1), None, 0)], &map);
    assert_eq!(result, values(1.23, 1.23, 0.0));
}
