//! The upsert against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server and loads the `alliances`
//! fixture into it; the database `DATABASE_URL` names is never touched.

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use sqlx::PgPool;
use worker_info_alliances::alliance::{upsert_alliance, AllianceInfo};

const ID: i32 = 99000001;

fn info() -> AllianceInfo {
    AllianceInfo {
        name: "Test Alliance".into(),
        ticker: "TEST".into(),
        date_founded: Utc.with_ymd_and_hms(2010, 11, 4, 13, 11, 0).unwrap(),
        creator_corporation_id: 98000001,
        creator_id: 90000001,
        executor_corporation_id: Some(98000002),
        faction_id: None,
    }
}

#[derive(Debug, sqlx::FromRow)]
struct Row {
    name: String,
    ticker: String,
    date_founded: NaiveDateTime,
    creator_corporation_id: i32,
    creator_id: i32,
    executor_corporation_id: Option<i32>,
    faction_id: Option<i32>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    corporation_count: i32,
    member_count: i32,
}

async fn row(pool: &PgPool) -> Row {
    sqlx::query_as::<_, Row>("SELECT * FROM alliances WHERE id = $1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn a_new_alliance_is_inserted_with_both_timestamps(pool: PgPool) {
    assert!(upsert_alliance(&pool, ID, &info()).await.unwrap());

    let row = row(&pool).await;
    assert_eq!(
        (row.name.as_str(), row.ticker.as_str()),
        ("Test Alliance", "TEST")
    );
    assert_eq!(row.date_founded, info().date_founded.naive_utc());
    assert_eq!(
        (row.creator_corporation_id, row.creator_id),
        (98000001, 90000001)
    );
    assert_eq!(
        (row.executor_corporation_id, row.faction_id),
        (Some(98000002), None)
    );
    // updated_at has no database default; without the explicit now() the
    // insert fails on NOT NULL.
    assert!(row.updated_at >= row.created_at);
    assert_eq!((row.corporation_count, row.member_count), (0, 0));
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn an_existing_alliance_is_updated_and_reported_as_not_new(pool: PgPool) {
    upsert_alliance(&pool, ID, &info()).await.unwrap();
    let before = row(&pool).await;
    // now() is the transaction's start; a pause keeps the second one apart.
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;

    let renamed = AllianceInfo {
        name: "Renamed".into(),
        ticker: "NEW".into(),
        ..info()
    };
    assert!(!upsert_alliance(&pool, ID, &renamed).await.unwrap());

    let after = row(&pool).await;
    assert_eq!(
        (after.name.as_str(), after.ticker.as_str()),
        ("Renamed", "NEW")
    );
    assert!(after.updated_at > before.updated_at);
    assert_eq!(after.created_at, before.created_at);
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn an_update_never_changes_what_never_changes(pool: PgPool) {
    upsert_alliance(&pool, ID, &info()).await.unwrap();

    let rewritten = AllianceInfo {
        date_founded: Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap(),
        creator_corporation_id: 1,
        creator_id: 2,
        ..info()
    };
    upsert_alliance(&pool, ID, &rewritten).await.unwrap();

    let row = row(&pool).await;
    assert_eq!(row.date_founded, info().date_founded.naive_utc());
    assert_eq!(
        (row.creator_corporation_id, row.creator_id),
        (98000001, 90000001)
    );
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn an_update_leaves_the_counts_alone(pool: PgPool) {
    upsert_alliance(&pool, ID, &info()).await.unwrap();
    sqlx::query("UPDATE alliances SET corporation_count = 7, member_count = 300 WHERE id = $1")
        .bind(ID)
        .execute(&pool)
        .await
        .unwrap();

    upsert_alliance(&pool, ID, &info()).await.unwrap();

    let row = row(&pool).await;
    assert_eq!((row.corporation_count, row.member_count), (7, 300));
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn a_missing_executor_clears_the_old_one(pool: PgPool) {
    upsert_alliance(
        &pool,
        ID,
        &AllianceInfo {
            faction_id: Some(500001),
            ..info()
        },
    )
    .await
    .unwrap();

    let without = AllianceInfo {
        executor_corporation_id: None,
        faction_id: None,
        ..info()
    };
    upsert_alliance(&pool, ID, &without).await.unwrap();

    let row = row(&pool).await;
    assert_eq!((row.executor_corporation_id, row.faction_id), (None, None));
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn date_founded_keeps_its_milliseconds_and_its_utc_instant(pool: PgPool) {
    let founded: DateTime<Utc> = "2010-11-04T13:11:00.123Z".parse().unwrap();
    upsert_alliance(
        &pool,
        ID,
        &AllianceInfo {
            date_founded: founded,
            ..info()
        },
    )
    .await
    .unwrap();

    // The same instant Prisma writes for `new Date('2010-11-04T13:11:00.123Z')`:
    // the UTC wall clock, no session time zone applied.
    let stored: String = sqlx::query_scalar(
        "SELECT to_char(date_founded, 'YYYY-MM-DD\"T\"HH24:MI:SS.MS') FROM alliances WHERE id = $1",
    )
    .bind(ID)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(stored, "2010-11-04T13:11:00.123");
}
