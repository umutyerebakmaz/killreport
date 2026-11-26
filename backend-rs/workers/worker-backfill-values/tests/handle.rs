//! `backfill` against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use chrono::{NaiveDate, NaiveDateTime};
use killmail_value::Values;
use sqlx::PgPool;
use worker_backfill_values::{backfill, Backfilled};

const ID: i32 = 133900250;
const RIFTER: i32 = 587;
const AMMO: i32 = 178;

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 26)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

fn earlier() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 1, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap()
}

async fn exec(pool: &PgPool, sql: &str) {
    sqlx::query(sql).execute(pool).await.unwrap();
}

async fn killmail(pool: &PgPool, total_value: Option<f64>) {
    sqlx::query(
        "INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id, updated_at, total_value)
         VALUES ($1, 'hash', $2, 30000142, $2, $3)",
    )
    .bind(ID)
    .bind(earlier())
    .bind(total_value)
    .execute(pool)
    .await
    .unwrap();
}

async fn victim(pool: &PgPool, ship_type_id: i32) {
    sqlx::query(
        "INSERT INTO victims (killmail_id, corporation_id, ship_type_id, damage_taken)
         VALUES ($1, 98000001, $2, 100)",
    )
    .bind(ID)
    .bind(ship_type_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn item(pool: &PgPool, type_id: i32, destroyed: Option<i32>, dropped: Option<i32>) {
    sqlx::query(
        "INSERT INTO killmail_items (killmail_id, item_type_id, flag, quantity_destroyed, quantity_dropped, singleton)
         VALUES ($1, $2, 5, $3, $4, 0)",
    )
    .bind(ID)
    .bind(type_id)
    .bind(destroyed)
    .bind(dropped)
    .execute(pool)
    .await
    .unwrap();
}

/// Rifter at 500,000 and ammunition at 10, both in plain groups.
async fn priced_types(pool: &PgPool) {
    exec(pool, "INSERT INTO categories (id, name, updated_at) VALUES (6, 'Ship', CURRENT_TIMESTAMP), (8, 'Charge', CURRENT_TIMESTAMP)").await;
    exec(pool, "INSERT INTO item_groups (id, name, category_id, updated_at) VALUES (25, 'Frigate', 6, CURRENT_TIMESTAMP), (83, 'Ammo', 8, CURRENT_TIMESTAMP)").await;
    exec(pool, "INSERT INTO types (id, name, group_id, updated_at) VALUES (587, 'Rifter', 25, CURRENT_TIMESTAMP), (178, 'Ammo', 83, CURRENT_TIMESTAMP)").await;
    exec(pool, "INSERT INTO market_prices (type_id, buy, sell, average, volume, updated_at) VALUES (587, 0, 500000, 0, 1, CURRENT_TIMESTAMP), (178, 0, 10, 0, 1, CURRENT_TIMESTAMP)").await;
}

async fn filters_row(pool: &PgPool) {
    sqlx::query("INSERT INTO killmail_filters (killmail_id) VALUES ($1)")
        .bind(ID)
        .execute(pool)
        .await
        .unwrap();
}

async fn killmail_row(pool: &PgPool) -> (Option<f64>, Option<f64>, Option<f64>, NaiveDateTime) {
    sqlx::query_as(
        "SELECT total_value, destroyed_value, dropped_value, updated_at FROM killmails WHERE killmail_id = $1",
    )
    .bind(ID)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn filters_value(pool: &PgPool) -> Option<f64> {
    sqlx::query_scalar("SELECT total_value FROM killmail_filters WHERE killmail_id = $1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn expected() -> Values {
    Values {
        total: 501_500.0,
        destroyed: 501_000.0,
        dropped: 500.0,
    }
}

async fn rifter_killmail(pool: &PgPool) {
    priced_types(pool).await;
    killmail(pool, None).await;
    victim(pool, RIFTER).await;
    item(pool, AMMO, Some(100), None).await;
    item(pool, AMMO, None, Some(50)).await;
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "killmail_items",
        "killmail_filters",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn saves_both_tables(pool: PgPool) {
    rifter_killmail(&pool).await;
    filters_row(&pool).await;

    assert_eq!(
        backfill(&pool, ID, now()).await.unwrap(),
        Backfilled::Saved(expected())
    );
    assert_eq!(
        killmail_row(&pool).await,
        (Some(501_500.0), Some(501_000.0), Some(500.0), now())
    );
    assert_eq!(filters_value(&pool).await, Some(501_500.0));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "killmail_items",
        "killmail_filters",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn updates_without_a_filters_row(pool: PgPool) {
    rifter_killmail(&pool).await;

    assert_eq!(
        backfill(&pool, ID, now()).await.unwrap(),
        Backfilled::Saved(expected())
    );
    assert_eq!(killmail_row(&pool).await.0, Some(501_500.0));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "killmail_items",
        "killmail_filters",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn zero_values_leave_the_row(pool: PgPool) {
    killmail(&pool, Some(42.0)).await;
    victim(&pool, 99999).await;
    filters_row(&pool).await;

    assert_eq!(backfill(&pool, ID, now()).await.unwrap(), Backfilled::Zero);
    assert_eq!(
        killmail_row(&pool).await,
        (Some(42.0), None, None, earlier())
    );
    assert_eq!(filters_value(&pool).await, None);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "killmail_items",
        "killmail_filters",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn missing_killmail(pool: PgPool) {
    assert_eq!(
        backfill(&pool, ID, now()).await.unwrap(),
        Backfilled::NoKillmail
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "killmail_items",
        "killmail_filters",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn killmail_without_victim(pool: PgPool) {
    killmail(&pool, None).await;
    assert_eq!(
        backfill(&pool, ID, now()).await.unwrap(),
        Backfilled::NoVictim
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "killmail_items",
        "killmail_filters",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn rerun_is_the_same(pool: PgPool) {
    rifter_killmail(&pool).await;
    filters_row(&pool).await;

    backfill(&pool, ID, now()).await.unwrap();
    let first = killmail_row(&pool).await;
    assert_eq!(
        backfill(&pool, ID, now()).await.unwrap(),
        Backfilled::Saved(expected())
    );
    assert_eq!(killmail_row(&pool).await, first);
}
