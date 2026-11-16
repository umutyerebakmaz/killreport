//! `take_corporation_snapshots` against throwaway databases. `sqlx::test`
//! creates one per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use worker_corporation_snapshots::{take_corporation_snapshots, utc_day};

fn day(s: &str) -> NaiveDate {
    s.parse().unwrap()
}

async fn members(pool: &PgPool) -> Vec<i32> {
    sqlx::query_scalar("SELECT member_count FROM corporation_snapshots ORDER BY corporation_id")
        .fetch_all(pool)
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
    fixtures("corporations", "corporation_snapshots", "rows")
)]
async fn snapshots_every_corporation(pool: PgPool) {
    let totals = take_corporation_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    assert_eq!((totals.total, totals.created), (3, 3));
    assert_eq!(members(&pool).await, [10, 5, 3]);
    let dates: Vec<NaiveDate> =
        sqlx::query_scalar("SELECT DISTINCT snapshot_date FROM corporation_snapshots")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(dates, [day("2026-11-16")]);
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "corporation_snapshots", "rows")
)]
async fn second_run_same_day_changes_nothing(pool: PgPool) {
    take_corporation_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    sqlx::query("UPDATE corporations SET member_count = 100 WHERE id = 98000001")
        .execute(&pool)
        .await
        .unwrap();
    let totals = take_corporation_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    assert_eq!((totals.total, totals.created), (3, 0));
    assert_eq!(totals.existing(), 3);
    assert_eq!(members(&pool).await, [10, 5, 3]);
}

#[sqlx::test(migrations = false, fixtures("corporations", "corporation_snapshots"))]
async fn empty_table(pool: PgPool) {
    let totals = take_corporation_snapshots(&pool, day("2026-11-16"))
        .await
        .unwrap();
    assert_eq!((totals.total, totals.created), (0, 0));
}
