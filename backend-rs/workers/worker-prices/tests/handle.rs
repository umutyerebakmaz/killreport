//! `handle` against a mock ESI and a real PostgreSQL. The worker publishes
//! nothing, so the publisher it is handed fails the test if it is used.

use esi::{EsiClient, RateLimiter};
use futures_util::future::BoxFuture;
use mq::EntityMessage;
use runner::{Context, Outcome, Publisher, Worker};
use serde_json::{json, Value};
use sqlx::PgPool;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_prices::PriceWorker;

const ID: i32 = 34;
const ORDERS: &str = "/markets/10000002/orders/";

struct Nobody;

impl Publisher for Nobody {
    fn publish<'a>(
        &'a self,
        _queue: &'a str,
        _messages: &'a [EntityMessage],
        _priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        panic!("the price worker publishes nothing")
    }
    fn publish_killmails<'a>(
        &'a self,
        _queue: &'a str,
        _source: &'static str,
        _ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        panic!("this worker publishes no killmails")
    }
}

fn worker(pool: PgPool, server: &MockServer) -> PriceWorker {
    PriceWorker {
        pool,
        esi: EsiClient::with_base_url(RateLimiter::new(50), server.uri()),
    }
}

async fn page(server: &MockServer, n: &str, pages: &str, response: ResponseTemplate) {
    Mock::given(method("GET"))
        .and(path(ORDERS))
        .and(query_param("type_id", "34"))
        .and(query_param("page", n))
        .respond_with(response.insert_header("x-pages", pages))
        .expect(1)
        .mount(server)
        .await;
}

fn orders(body: Value) -> ResponseTemplate {
    ResponseTemplate::new(200).set_body_json(body)
}

fn order(location_id: i64, price: f64) -> Value {
    json!({
        "duration": 90, "is_buy_order": false, "issued": "2026-11-18T10:00:00Z",
        "location_id": location_id, "min_volume": 1, "order_id": 1, "price": price,
        "range": "region", "system_id": 30000142, "type_id": ID,
        "volume_remain": 10, "volume_total": 10
    })
}

async fn known_type(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO types (id, name, group_id, updated_at)
         VALUES ($1, 'Tritanium', 18, CURRENT_TIMESTAMP)",
    )
    .bind(ID)
    .execute(pool)
    .await
    .unwrap();
}

async fn seed_price(pool: &PgPool, sell: f64) {
    sqlx::query(
        "INSERT INTO market_prices (type_id, buy, sell, average, volume, updated_at)
         VALUES ($1, 0, $2, $2 / 2, 1, CURRENT_TIMESTAMP)",
    )
    .bind(ID)
    .bind(sell)
    .execute(pool)
    .await
    .unwrap();
}

async fn sell(pool: &PgPool) -> Option<f64> {
    sqlx::query_scalar("SELECT sell FROM market_prices WHERE type_id = $1")
        .bind(ID)
        .fetch_optional(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("types", "market_prices"))]
async fn jita_orders_on_page_two_are_priced(pool: PgPool) {
    known_type(&pool).await;
    let server = MockServer::start().await;
    page(&server, "1", "2", orders(json!([order(60008494, 1.0)]))).await;
    page(&server, "2", "2", orders(json!([order(60003760, 5.0)]))).await;

    let processed = worker(pool.clone(), &server)
        .handle(ID, &Context::new(&Nobody))
        .await
        .unwrap();

    assert_eq!(processed.outcome, Outcome::Created);
    assert_eq!(processed.detail, " 34 buy=0.00 sell=5.00");
    assert_eq!(sell(&pool).await, Some(5.0));
}

#[sqlx::test(migrations = false, fixtures("types", "market_prices"))]
async fn other_stations_only_leaves_the_row(pool: PgPool) {
    known_type(&pool).await;
    seed_price(&pool, 7.0).await;
    let server = MockServer::start().await;
    page(&server, "1", "1", orders(json!([order(60008494, 1.0)]))).await;

    let processed = worker(pool.clone(), &server)
        .handle(ID, &Context::new(&Nobody))
        .await
        .unwrap();

    assert_eq!(processed.outcome, Outcome::Unchanged);
    assert_eq!(processed.detail, " 34 (no Jita orders)");
    assert_eq!(sell(&pool).await, Some(7.0));
}

#[sqlx::test(migrations = false, fixtures("types", "market_prices"))]
async fn esi_error_is_an_error(pool: PgPool) {
    known_type(&pool).await;
    seed_price(&pool, 7.0).await;
    let server = MockServer::start().await;
    page(&server, "1", "1", ResponseTemplate::new(500)).await;

    let result = worker(pool.clone(), &server)
        .handle(ID, &Context::new(&Nobody))
        .await;

    assert!(result.is_err());
    assert_eq!(sell(&pool).await, Some(7.0));
}
