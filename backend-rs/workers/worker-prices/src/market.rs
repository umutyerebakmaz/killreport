//! What ESI says about a type's market, the Jita price made from it, and the
//! one statement that stores it.

use serde::Deserialize;
use sqlx::PgPool;

/// The Forge, Jita's region.
pub const REGION_ID: i32 = 10000002;
/// Jita IV - Moon 4 - Caldari Navy Assembly Plant. Only its orders count.
pub const JITA_4_4: i64 = 60003760;
/// A side's price is the volume-weighted mean of its best orders up to this
/// share of the side's total volume.
const BEST_SHARE: f64 = 0.05;

/// One order from `GET /markets/{region_id}/orders/`, the fields the price
/// needs; the rest are ignored. `location_id` is an `i64` because a player
/// structure's ID does not fit an `i32`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Order {
    pub location_id: i64,
    pub price: f64,
    pub is_buy_order: bool,
    pub volume_remain: i64,
}

/// One `market_prices` row's values.
#[derive(Debug, Clone, PartialEq)]
pub struct Price {
    pub buy: f64,
    pub sell: f64,
    pub average: f64,
    pub volume: f64,
}

/// The type's orders path; `get_paged` adds the page after the query.
pub fn orders_path(type_id: i32) -> String {
    format!("/markets/{REGION_ID}/orders/?type_id={type_id}")
}

/// The Jita 4-4 price, or `None` when Jita 4-4 has no orders for the type,
/// so the stored price stays as it was.
///
/// `sell` is the volume-weighted mean of the cheapest sell orders that make up
/// 5 % of Jita's sell volume, `buy` the same over the dearest buy orders,
/// so a single small order far off the market cannot set the price. A side
/// with no orders is 0. `average` and `volume` are the Node worker's:
/// `(buy + sell) / 2` and the sum of `volume_remain` over every Jita order.
pub fn jita_price(orders: &[Order]) -> Option<Price> {
    let jita: Vec<&Order> = orders
        .iter()
        .filter(|o| o.location_id == JITA_4_4)
        .collect();
    if jita.is_empty() {
        return None;
    }

    let mut sells: Vec<&Order> = jita.iter().copied().filter(|o| !o.is_buy_order).collect();
    let mut buys: Vec<&Order> = jita.iter().copied().filter(|o| o.is_buy_order).collect();
    sells.sort_by(|a, b| a.price.total_cmp(&b.price));
    buys.sort_by(|a, b| b.price.total_cmp(&a.price));

    let buy = best_share_price(&buys);
    let sell = best_share_price(&sells);
    Some(Price {
        buy,
        sell,
        average: (buy + sell) / 2.0,
        volume: jita.iter().map(|o| o.volume_remain as f64).sum(),
    })
}

/// The volume-weighted mean price of `orders`, best first, up to
/// [`BEST_SHARE`] of their total volume; the last order counts only for what
/// is still missing. 0 for no orders.
fn best_share_price(orders: &[&Order]) -> f64 {
    let total: f64 = orders.iter().map(|o| o.volume_remain as f64).sum();
    if total <= 0.0 {
        return 0.0;
    }
    let target = total * BEST_SHARE;
    let (mut taken, mut value) = (0.0, 0.0);
    for order in orders {
        let take = (order.volume_remain as f64).min(target - taken);
        taken += take;
        value += take * order.price;
        if taken >= target {
            break;
        }
    }
    value / taken
}

/// Insert or update one type's price; `true` if it was new.
///
/// `updated_at` is set on insert *and* on update: the column has no database
/// default (`@updatedAt` is Prisma's). `created_at` is the database default.
/// `xmax = 0` holds only for a row this statement inserted.
pub async fn upsert_price(pool: &PgPool, type_id: i32, price: &Price) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO market_prices (type_id, buy, sell, average, volume, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (type_id) DO UPDATE SET
           buy        = EXCLUDED.buy,
           sell       = EXCLUDED.sell,
           average    = EXCLUDED.average,
           volume     = EXCLUDED.volume,
           updated_at = now()
         RETURNING (xmax = 0)",
    )
    .bind(type_id)
    .bind(price.buy)
    .bind(price.sell)
    .bind(price.average)
    .bind(price.volume)
    .fetch_one(pool)
    .await
}
