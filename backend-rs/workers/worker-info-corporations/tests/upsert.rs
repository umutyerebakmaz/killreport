//! The upsert against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server and loads the `corporations`
//! fixture into it; the database `DATABASE_URL` names is never touched.

use chrono::{NaiveDateTime, TimeZone, Utc};
use sqlx::PgPool;
use worker_info_corporations::corporation::{upsert_corporation, CorporationInfo};

const ID: i32 = 98000001;

fn info() -> CorporationInfo {
    CorporationInfo {
        name: "Test Corp".into(),
        ticker: "TSTC".into(),
        member_count: 42,
        ceo_id: 90000001,
        creator_id: 90000002,
        tax_rate: 0.115,
        date_founded: Some(Utc.with_ymd_and_hms(2010, 11, 4, 13, 11, 0).unwrap()),
        description: Some("hello".into()),
        alliance_id: Some(99000001),
        faction_id: Some(500001),
        home_station_id: Some(60000001),
        shares: Some(5_000_000_000),
        url: Some("https://example.com".into()),
    }
}

#[derive(Debug, sqlx::FromRow)]
struct Row {
    name: String,
    ticker: String,
    member_count: i32,
    ceo_id: i32,
    creator_id: i32,
    tax_rate: f64,
    date_founded: Option<NaiveDateTime>,
    description: Option<String>,
    alliance_id: Option<i32>,
    faction_id: Option<i32>,
    home_station_id: Option<i32>,
    shares: Option<i64>,
    url: Option<String>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

async fn row(pool: &PgPool) -> Row {
    sqlx::query_as::<_, Row>("SELECT * FROM corporations WHERE id = $1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn a_new_corporation_is_inserted(pool: PgPool) {
    assert!(upsert_corporation(&pool, ID, &info()).await.unwrap());

    let row = row(&pool).await;
    let want = info();
    assert_eq!(row.name, want.name);
    assert_eq!(row.ticker, want.ticker);
    assert_eq!(row.member_count, want.member_count);
    assert_eq!(row.ceo_id, want.ceo_id);
    assert_eq!(row.creator_id, want.creator_id);
    assert_eq!(row.tax_rate, want.tax_rate);
    assert_eq!(row.date_founded, want.date_founded.map(|d| d.naive_utc()));
    assert_eq!(row.description, want.description);
    assert_eq!(row.alliance_id, want.alliance_id);
    assert_eq!(row.faction_id, want.faction_id);
    assert_eq!(row.home_station_id, want.home_station_id);
    assert_eq!(row.shares, want.shares);
    assert_eq!(row.url, want.url);
    // updated_at has no database default; without the explicit now() the
    // insert fails on NOT NULL.
    assert!(row.updated_at >= row.created_at);
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn an_existing_corporation_is_updated(pool: PgPool) {
    upsert_corporation(&pool, ID, &info()).await.unwrap();
    let before = row(&pool).await;
    // now() is the transaction start; a pause keeps the second one apart.
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    let changed = CorporationInfo {
        name: "Renamed".into(),
        ticker: "NEW".into(),
        member_count: 7,
        ceo_id: 90000009,
        alliance_id: Some(99000009),
        faction_id: Some(500009),
        tax_rate: 0.5,
        description: Some("changed".into()),
        url: Some("https://example.org".into()),
        ..info()
    };
    assert!(!upsert_corporation(&pool, ID, &changed).await.unwrap());

    let after = row(&pool).await;
    assert_eq!(after.name, "Renamed");
    assert_eq!(after.ticker, "NEW");
    assert_eq!(after.member_count, 7);
    assert_eq!(after.ceo_id, 90000009);
    assert_eq!(after.alliance_id, Some(99000009));
    assert_eq!(after.faction_id, Some(500009));
    assert_eq!(after.tax_rate, 0.5);
    assert_eq!(after.description.as_deref(), Some("changed"));
    assert_eq!(after.url.as_deref(), Some("https://example.org"));
    assert!(after.updated_at > before.updated_at);
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn columns_written_only_on_insert_keep_their_value(pool: PgPool) {
    upsert_corporation(&pool, ID, &info()).await.unwrap();
    let before = row(&pool).await;

    let rewritten = CorporationInfo {
        date_founded: Some(Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap()),
        creator_id: 1,
        home_station_id: Some(1),
        shares: Some(1),
        ..info()
    };
    upsert_corporation(&pool, ID, &rewritten).await.unwrap();

    let after = row(&pool).await;
    assert_eq!(after.date_founded, before.date_founded);
    assert_eq!(after.creator_id, 90000002);
    assert_eq!(after.home_station_id, Some(60000001));
    assert_eq!(after.shares, Some(5_000_000_000));
    assert_eq!(after.created_at, before.created_at);
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn missing_optional_fields_clear_the_old_value(pool: PgPool) {
    upsert_corporation(&pool, ID, &info()).await.unwrap();

    let without = CorporationInfo {
        alliance_id: None,
        faction_id: None,
        description: None,
        url: None,
        ..info()
    };
    upsert_corporation(&pool, ID, &without).await.unwrap();

    let row = row(&pool).await;
    assert_eq!(row.alliance_id, None);
    assert_eq!(row.faction_id, None);
    assert_eq!(row.description, None);
    assert_eq!(row.url, None);
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn a_missing_date_founded_is_null(pool: PgPool) {
    let no_date = CorporationInfo {
        date_founded: None,
        ..info()
    };
    upsert_corporation(&pool, ID, &no_date).await.unwrap();

    assert_eq!(row(&pool).await.date_founded, None);
}
