//! A killmail's ISK value: the formula of
//! `backend/src/helpers/calculate-killmail-values.ts`, split into a pure
//! [`compute`] and the one read it needs, [`type_info`]. Shared by the
//! backfill worker and, later, the Rust redisq port; see the spec,
//! `docs/superpowers/specs/2026-11-26-rust-backfill-values-design.md`.
//!
//! The arithmetic keeps Node's order (the ship first, then each item in
//! turn, `total` summed on its own rather than as `destroyed + dropped`) so
//! that the `f64` results match the Node worker's to the bit.

use std::collections::HashMap;

use sqlx::PgExecutor;

/// Pods: `CAPSULE_GROUP_IDS` in `backend/src/config/ship-groups.ts`. Group,
/// not type 670, so that the Genolution variant counts as well.
pub const CAPSULE_GROUP_ID: i32 = 29;
/// A pod's flat price: it has no market price of its own, and what a pod
/// kill is worth lives in its implants.
const CAPSULE_VALUE: f64 = 10.0;
/// A blueprint copy's fixed price.
const BPC_VALUE: f64 = 0.01;
/// `killmail_items.singleton` of a blueprint copy.
const SINGLETON_COPY: i32 = 2;

/// One `killmail_items` row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Item {
    pub type_id: i32,
    pub quantity_destroyed: Option<i32>,
    pub quantity_dropped: Option<i32>,
    pub singleton: i32,
}

/// What the formula needs to know about a type. A type missing from the map
/// counts as the default: no price, no group, not a blueprint.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct TypeInfo {
    /// `market_prices.sell`, 0 without a price row.
    pub sell: f64,
    pub group_id: Option<i32>,
    /// The type's category is named `blueprint`, case-insensitively.
    pub is_blueprint: bool,
}

/// The three cached columns of `killmails`, rounded to two places.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Values {
    pub total: f64,
    pub destroyed: f64,
    pub dropped: f64,
}

impl Values {
    /// All three are zero: no market data at all.
    pub fn is_zero(&self) -> bool {
        self.total == 0.0 && self.destroyed == 0.0 && self.dropped == 0.0
    }
}

/// The value of a killmail whose victim flew `ship_type_id`. The ship is
/// always destroyed; a pod is worth 10 ISK, a blueprint copy 0.01, anything
/// else its sell price, and a type without one 0.
pub fn compute(ship_type_id: i32, items: &[Item], types: &HashMap<i32, TypeInfo>) -> Values {
    let lookup = |id: i32| types.get(&id).copied().unwrap_or_default();

    let ship = lookup(ship_type_id);
    let ship_price = if ship.group_id == Some(CAPSULE_GROUP_ID) {
        CAPSULE_VALUE
    } else {
        ship.sell
    };

    let mut total = ship_price;
    let mut destroyed = ship_price;
    let mut dropped = 0.0;

    for item in items {
        let info = lookup(item.type_id);
        let price = if info.is_blueprint && item.singleton == SINGLETON_COPY {
            BPC_VALUE
        } else {
            info.sell
        };
        let quantity_destroyed = f64::from(item.quantity_destroyed.unwrap_or(0));
        let quantity_dropped = f64::from(item.quantity_dropped.unwrap_or(0));

        destroyed += price * quantity_destroyed;
        dropped += price * quantity_dropped;
        total += price * (quantity_destroyed + quantity_dropped);
    }

    Values {
        total: round2(total),
        destroyed: round2(destroyed),
        dropped: round2(dropped),
    }
}

/// `Math.round(x * 100) / 100`. The values are never negative, where
/// `round` (half away from zero) and `Math.round` (half up) agree.
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

/// Price, group and blueprint flag for every type in `type_ids` that `types`
/// has, in one query. Groups and categories are left-joined: a type whose
/// group is not known yet still has its price. `market_prices` references
/// `types`, so a type without a `types` row has no price either and is
/// simply absent.
pub async fn type_info<'e>(
    executor: impl PgExecutor<'e>,
    type_ids: &[i32],
) -> sqlx::Result<HashMap<i32, TypeInfo>> {
    let rows: Vec<(i32, f64, i32, bool)> = sqlx::query_as(
        "SELECT t.id,
                COALESCE(mp.sell, 0),
                t.group_id,
                COALESCE(lower(c.name) = 'blueprint', false)
         FROM types t
         LEFT JOIN market_prices mp ON mp.type_id = t.id
         LEFT JOIN item_groups g ON g.id = t.group_id
         LEFT JOIN categories c ON c.id = g.category_id
         WHERE t.id = ANY($1)",
    )
    .bind(type_ids)
    .fetch_all(executor)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, sell, group_id, is_blueprint)| {
            (
                id,
                TypeInfo {
                    sell,
                    group_id: Some(group_id),
                    is_blueprint,
                },
            )
        })
        .collect())
}
