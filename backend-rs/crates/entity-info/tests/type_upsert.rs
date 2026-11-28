//! The upsert against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server and loads the `types`
//! fixture into it; the database `DATABASE_URL` names is never touched.

use chrono::NaiveDateTime;
use entity_info::type_info::{upsert_type, TypeInfo};
use sqlx::PgPool;

const ID: i32 = 587;

fn info() -> TypeInfo {
    TypeInfo {
        name: "Rifter".into(),
        description: Some("A frigate.".into()),
        group_id: 25,
        published: true,
        volume: Some(27289.0),
        capacity: Some(140.0),
        mass: Some(1067000.0),
        icon_id: Some(587),
    }
}

#[derive(Debug, sqlx::FromRow)]
struct Row {
    name: String,
    description: Option<String>,
    group_id: i32,
    published: bool,
    volume: Option<f64>,
    capacity: Option<f64>,
    mass: Option<f64>,
    icon_id: Option<i32>,
    meta_group_id: Option<i32>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

async fn row(pool: &PgPool) -> Row {
    sqlx::query_as::<_, Row>("SELECT * FROM types WHERE id = $1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

/// An older version of the row, as another writer would have left it.
async fn seed(pool: &PgPool, meta_group_id: Option<i32>) {
    sqlx::query(
        "INSERT INTO types (id, name, group_id, published, meta_group_id, created_at, updated_at)
         VALUES ($1, 'Old Rifter', 1, false, $2,
                 '2020-01-01 00:00:00', '2020-01-01 00:00:00')",
    )
    .bind(ID)
    .bind(meta_group_id)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(migrations = false, fixtures("types"))]
async fn a_new_type_is_inserted_with_both_timestamps(pool: PgPool) {
    assert!(upsert_type(&pool, ID, &info()).await.unwrap());

    let row = row(&pool).await;
    assert_eq!(row.name, "Rifter");
    assert_eq!(row.description.as_deref(), Some("A frigate."));
    assert_eq!(row.group_id, 25);
    assert!(row.published);
    assert_eq!(row.volume, Some(27289.0));
    assert_eq!(row.capacity, Some(140.0));
    assert_eq!(row.mass, Some(1067000.0));
    assert_eq!(row.icon_id, Some(587));
    assert_eq!(row.meta_group_id, None);
    // Both set by this statement, so neither is older than a moment ago.
    let recent = chrono::Utc::now().naive_utc() - chrono::Duration::minutes(5);
    assert!(row.created_at > recent, "{row:?}");
    assert!(row.updated_at > recent, "{row:?}");
}

#[sqlx::test(migrations = false, fixtures("types"))]
async fn an_existing_type_is_updated(pool: PgPool) {
    seed(&pool, None).await;

    assert!(!upsert_type(&pool, ID, &info()).await.unwrap());

    let row = row(&pool).await;
    assert_eq!(row.name, "Rifter");
    assert_eq!(row.group_id, 25);
    assert!(row.published);
    assert_eq!(row.mass, Some(1067000.0));
}

#[sqlx::test(migrations = false, fixtures("types"))]
async fn an_update_keeps_meta_group_id_and_created_at(pool: PgPool) {
    seed(&pool, Some(2)).await;

    upsert_type(&pool, ID, &info()).await.unwrap();

    let row = row(&pool).await;
    let seeded: NaiveDateTime = "2020-01-01T00:00:00".parse().unwrap();
    assert_eq!(row.meta_group_id, Some(2));
    assert_eq!(row.created_at, seeded);
    assert!(row.updated_at > seeded, "{row:?}");
}
