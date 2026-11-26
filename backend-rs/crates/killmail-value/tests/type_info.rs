//! `type_info` against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use killmail_value::type_info;
use sqlx::PgPool;

async fn category(pool: &PgPool, id: i32, name: &str) {
    sqlx::query("INSERT INTO categories (id, name, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)")
        .bind(id)
        .bind(name)
        .execute(pool)
        .await
        .unwrap();
}

async fn group(pool: &PgPool, id: i32, category_id: i32) {
    sqlx::query(
        "INSERT INTO item_groups (id, name, category_id, updated_at)
         VALUES ($1, 'group', $2, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .bind(category_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn known_type(pool: &PgPool, id: i32, group_id: i32) {
    sqlx::query(
        "INSERT INTO types (id, name, group_id, updated_at)
         VALUES ($1, 'type', $2, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .bind(group_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn price(pool: &PgPool, type_id: i32, sell: f64) {
    sqlx::query(
        "INSERT INTO market_prices (type_id, buy, sell, average, volume, updated_at)
         VALUES ($1, 0, $2, $2, 1, CURRENT_TIMESTAMP)",
    )
    .bind(type_id)
    .bind(sell)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(
    migrations = false,
    fixtures("types", "item_groups", "categories", "market_prices")
)]
async fn type_info_joins_group_and_category(pool: PgPool) {
    category(&pool, 6, "Ship").await;
    category(&pool, 9, "Blueprint").await;
    group(&pool, 25, 6).await;
    group(&pool, 700, 9).await;
    known_type(&pool, 587, 25).await;
    known_type(&pool, 999, 700).await;
    price(&pool, 587, 500_000.0).await;

    let map = type_info(&pool, &[587, 999]).await.unwrap();
    let rifter = map[&587];
    assert_eq!(rifter.sell, 500_000.0);
    assert_eq!(rifter.group_id, Some(25));
    assert!(!rifter.is_blueprint);
    let blueprint = map[&999];
    assert!(blueprint.is_blueprint);
    assert_eq!(blueprint.sell, 0.0);
}

#[sqlx::test(
    migrations = false,
    fixtures("types", "item_groups", "categories", "market_prices")
)]
async fn type_info_without_group_row(pool: PgPool) {
    known_type(&pool, 1234, 9999).await;
    price(&pool, 1234, 7.0).await;

    let map = type_info(&pool, &[1234]).await.unwrap();
    let t = map[&1234];
    assert_eq!(t.sell, 7.0);
    assert_eq!(t.group_id, Some(9999));
    assert!(!t.is_blueprint);
}

#[sqlx::test(
    migrations = false,
    fixtures("types", "item_groups", "categories", "market_prices")
)]
async fn type_info_unknown_type_is_absent(pool: PgPool) {
    let map = type_info(&pool, &[42]).await.unwrap();
    assert!(!map.contains_key(&42));
}

#[sqlx::test(
    migrations = false,
    fixtures("types", "item_groups", "categories", "market_prices")
)]
async fn type_info_empty_input(pool: PgPool) {
    assert!(type_info(&pool, &[]).await.unwrap().is_empty());
}
