//! `take_alliance_snapshots` against throwaway databases. `sqlx::test`
//! creates one per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use worker_alliance_snapshots::{take_alliance_snapshots, utc_day};

fn day(s: &str) -> NaiveDate {
    s.parse().unwrap()
}

async fn snapshot(pool: &PgPool, id: i32, on: &str) -> (i32, i32) {
    sqlx::query_as(
        "SELECT member_count, corporation_count FROM alliance_snapshots
         WHERE alliance_id = $1 AND snapshot_date = $2",
    )
    .bind(id)
    .bind(day(on))
    .fetch_one(pool)
    .await
    .unwrap()
}

#[test]
fn utc_day_uses_the_utc_date() {
    let at = |s: &str| s.parse::<DateTime<Utc>>().unwrap();
    assert_eq!(utc_day(at("2026-11-16T21:30:00Z")), day("2026-11-16"));
    assert_eq!(utc_day(at("2026-11-16T23:59:59Z")), day("2026-11-16"));
    assert_eq!(utc_day(at("2026-11-17T00:00:00Z")), day("2026-11-17"));
}

#[sqlx::test(
    migrations = false,
    fixtures("alliances", "corporations", "alliance_snapshots", "rows")
)]
async fn snapshots_every_alliance_from_corporations(pool: PgPool) {
    let totals = take_alliance_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    assert_eq!((totals.total, totals.created), (3, 3));
    assert_eq!(snapshot(&pool, 99000001, "2026-11-16").await, (15, 2));
    assert_eq!(snapshot(&pool, 99000002, "2026-11-16").await, (0, 0));
    assert_eq!(snapshot(&pool, 99000003, "2026-11-16").await, (3, 1));
}

#[sqlx::test(
    migrations = false,
    fixtures("alliances", "corporations", "alliance_snapshots", "rows")
)]
async fn second_run_same_day_changes_nothing(pool: PgPool) {
    take_alliance_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    sqlx::query("UPDATE corporations SET member_count = 100 WHERE id = 98000001")
        .execute(&pool)
        .await
        .unwrap();
    let totals = take_alliance_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    assert_eq!((totals.total, totals.created), (3, 0));
    assert_eq!(totals.existing(), 3);
    assert_eq!(snapshot(&pool, 99000001, "2026-11-16").await, (15, 2));
}

#[sqlx::test(
    migrations = false,
    fixtures("alliances", "corporations", "alliance_snapshots", "rows")
)]
async fn next_day_adds_new_rows(pool: PgPool) {
    take_alliance_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    let totals = take_alliance_snapshots(&pool, day("2026-11-17"))
        .await
        .unwrap();
    assert_eq!(totals.created, 3);
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM alliance_snapshots")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(rows, 6);
}

#[sqlx::test(
    migrations = false,
    fixtures("alliances", "corporations", "alliance_snapshots", "rows")
)]
async fn alliances_table_is_untouched(pool: PgPool) {
    take_alliance_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    let counts: Vec<(i32, i32)> =
        sqlx::query_as("SELECT member_count, corporation_count FROM alliances ORDER BY id")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(counts, [(999, 999); 3]);
}

#[sqlx::test(
    migrations = false,
    fixtures("alliances", "corporations", "alliance_snapshots")
)]
async fn empty_tables(pool: PgPool) {
    let totals = take_alliance_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    assert_eq!((totals.total, totals.created), (0, 0));
}
