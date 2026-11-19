//! What ESI's `/markets/{region_id}/orders/` sends parses into `Order`.

use serde_json::json;
use worker_prices::market::Order;

#[test]
fn a_full_esi_order_parses_and_a_structure_id_fits() {
    let body = json!([
        {
            "duration": 90,
            "is_buy_order": false,
            "issued": "2026-11-18T10:00:00Z",
            "location_id": 60003760,
            "min_volume": 1,
            "order_id": 7000000001_i64,
            "price": 5.25,
            "range": "region",
            "system_id": 30000142,
            "type_id": 34,
            "volume_remain": 1000000,
            "volume_total": 2000000
        },
        {
            "duration": 30,
            "is_buy_order": true,
            "issued": "2026-11-18T10:00:00Z",
            "location_id": 1_035_466_617_946_i64,
            "min_volume": 1,
            "order_id": 7000000002_i64,
            "price": 4.0,
            "range": "station",
            "system_id": 30000142,
            "type_id": 34,
            "volume_remain": 3,
            "volume_total": 3
        }
    ]);
    let orders: Vec<Order> = serde_json::from_value(body).unwrap();
    assert_eq!(orders.len(), 2);
    assert_eq!(orders[0].location_id, 60003760);
    assert!(!orders[0].is_buy_order);
    assert_eq!(orders[0].volume_remain, 1_000_000);
    assert_eq!(orders[1].location_id, 1_035_466_617_946);
    assert!(orders[1].is_buy_order);
    assert_eq!(orders[1].price, 4.0);
}
