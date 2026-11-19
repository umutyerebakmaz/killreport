//! The upsert against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server and loads the fixtures
//! into it; the database `DATABASE_URL` names is never touched.

use chrono::NaiveDateTime;
use sqlx::PgPool;
use worker_prices::market::{upsert_price, Price};

const ID: i32 = 34;

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

#[derive(Debug, sqlx::FromRow)]
struct Row {
    buy: f64,
    sell: f64,
    average: f64,
    volume: f64,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

async fn row(pool: &PgPool) -> Row {
    sqlx::query_as("SELECT buy, sell, average, volume, created_at, updated_at FROM market_prices WHERE type_id = $1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn price(sell: f64) -> Price {
    Price {
        buy: 4.0,
        sell,
        average: (4.0 + sell) / 2.0,
        volume: 100.0,
    }
}

#[sqlx::test(migrations = false, fixtures("types", "market_prices"))]
async fn a_new_price_is_inserted_with_both_timestamps(pool: PgPool) {
    known_type(&pool).await;
    assert!(upsert_price(&pool, ID, &price(5.0)).await.unwrap());

    let row = row(&pool).await;
    assert_eq!(
        (row.buy, row.sell, row.average, row.volume),
        (4.0, 5.0, 4.5, 100.0)
    );
    let recent = chrono::Utc::now().naive_utc() - chrono::Duration::minutes(5);
    assert!(row.created_at > recent, "{row:?}");
    assert!(row.updated_at > recent, "{row:?}");
}

#[sqlx::test(migrations = false, fixtures("types", "market_prices"))]
async fn an_existing_price_is_updated_and_keeps_created_at(pool: PgPool) {
    known_type(&pool).await;
    sqlx::query(
        "INSERT INTO market_prices (type_id, buy, sell, average, volume, created_at, updated_at)
         VALUES ($1, 1, 1, 1, 1, '2020-01-01', '2020-01-01')",
    )
    .bind(ID)
    .execute(&pool)
    .await
    .unwrap();

    assert!(!upsert_price(&pool, ID, &price(6.0)).await.unwrap());

    let row = row(&pool).await;
    let seeded: NaiveDateTime = "2020-01-01T00:00:00".parse().unwrap();
    assert_eq!(
        (row.buy, row.sell, row.average, row.volume),
        (4.0, 6.0, 5.0, 100.0)
    );
    assert_eq!(row.created_at, seeded);
    assert!(row.updated_at > seeded, "{row:?}");
}
