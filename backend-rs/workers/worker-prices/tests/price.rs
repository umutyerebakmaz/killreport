//! `jita_price`: which orders count and how a side's price comes out of them.

use worker_prices::market::{jita_price, Order, Price, JITA_4_4};

const ELSEWHERE: i64 = 60008494; // Amarr VIII

fn sell(location_id: i64, volume_remain: i64, price: f64) -> Order {
    Order {
        location_id,
        price,
        is_buy_order: false,
        volume_remain,
    }
}

fn buy(location_id: i64, volume_remain: i64, price: f64) -> Order {
    Order {
        is_buy_order: true,
        ..sell(location_id, volume_remain, price)
    }
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-9
}

fn assert_price(got: Option<Price>, buy: f64, sell: f64, average: f64, volume: f64) {
    let got = got.expect("a price");
    assert!(close(got.buy, buy), "buy {got:?}");
    assert!(close(got.sell, sell), "sell {got:?}");
    assert!(close(got.average, average), "average {got:?}");
    assert!(close(got.volume, volume), "volume {got:?}");
}

#[test]
fn other_stations_are_ignored() {
    let orders = [sell(JITA_4_4, 1, 5.0), sell(ELSEWHERE, 1, 4.0)];
    assert_price(jita_price(&orders), 0.0, 5.0, 2.5, 1.0);
}

#[test]
fn buy_only() {
    assert_price(jita_price(&[buy(JITA_4_4, 1, 3.0)]), 3.0, 0.0, 1.5, 1.0);
}

#[test]
fn sell_only() {
    assert_price(jita_price(&[sell(JITA_4_4, 1, 3.0)]), 0.0, 3.0, 1.5, 1.0);
}

#[test]
fn a_single_cheap_order_does_not_set_the_price() {
    let orders = [
        sell(JITA_4_4, 100, 10.0),
        sell(JITA_4_4, 1, 1.0),
        sell(JITA_4_4, 99, 11.0),
    ];
    // Target 5 % of 200 = 10: 1 × 1.0 then 9 × 10.0.
    assert!(close(jita_price(&orders).unwrap().sell, 9.1));
}

#[test]
fn buy_takes_the_top_five_percent() {
    let orders = [
        buy(JITA_4_4, 100, 10.0),
        buy(JITA_4_4, 99, 9.0),
        buy(JITA_4_4, 1, 100.0),
    ];
    // Target 10: 1 × 100.0 then 9 × 10.0.
    assert!(close(jita_price(&orders).unwrap().buy, 19.0));
}

#[test]
fn both_sides() {
    let orders = [buy(JITA_4_4, 1, 4.0), sell(JITA_4_4, 1, 5.0)];
    assert_price(jita_price(&orders), 4.0, 5.0, 4.5, 2.0);
}

#[test]
fn no_jita_orders_is_none() {
    assert_eq!(jita_price(&[sell(ELSEWHERE, 1, 4.0)]), None);
}

#[test]
fn empty_is_none() {
    assert_eq!(jita_price(&[]), None);
}
