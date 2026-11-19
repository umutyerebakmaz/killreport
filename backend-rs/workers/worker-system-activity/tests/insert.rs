//! `insert_snapshot` against throwaway databases. `sqlx::test` creates one
//! per test from `DATABASE_URL`'s server; the database `DATABASE_URL` names
//! is never touched.

use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::PgPool;
use worker_system_activity::{insert_snapshot, SystemActivityRow};

fn hour(s: &str) -> NaiveDateTime {
    s.parse::<DateTime<Utc>>().unwrap().naive_utc()
}

fn row(system_id: i32, kills: i32, ship_jumps: Option<i32>, at: &str) -> SystemActivityRow {
    SystemActivityRow {
        system_id,
        npc_kills: kills,
        pod_kills: kills,
        ship_kills: kills,
        ship_jumps,
        timestamp: hour(at),
    }
}

async fn count(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM system_activity")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn writes_every_row_and_null_jumps(pool: PgPool) {
    let at = "2026-11-19T13:00:00Z";
    let mut first = row(30000001, 0, Some(7), at);
    (first.npc_kills, first.pod_kills, first.ship_kills) = (3, 2, 1);
    let written = insert_snapshot(&pool, &[first, row(30000002, 0, None, at)])
        .await
        .unwrap();
    assert_eq!(written, 2);

    let stored: Vec<(i32, i32, i32, i32, Option<i32>, NaiveDateTime)> = sqlx::query_as(
        "SELECT system_id, npc_kills, pod_kills, ship_kills, ship_jumps, \"timestamp\"
         FROM system_activity ORDER BY system_id",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        stored,
        vec![
            (30000001, 3, 2, 1, Some(7), hour(at)),
            (30000002, 0, 0, 0, None, hour(at)),
        ]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn rerun_of_the_same_hour_writes_nothing(pool: PgPool) {
    let at = "2026-11-19T13:00:00Z";
    let rows = [row(30000001, 1, Some(1), at), row(30000002, 1, None, at)];
    assert_eq!(insert_snapshot(&pool, &rows).await.unwrap(), 2);

    let again = [
        row(30000001, 99, Some(99), at),
        row(30000002, 99, Some(99), at),
    ];
    assert_eq!(insert_snapshot(&pool, &again).await.unwrap(), 0);

    let kills: Vec<i32> =
        sqlx::query_scalar("SELECT ship_kills FROM system_activity ORDER BY system_id")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(kills, vec![1, 1]);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn another_hour_is_a_new_snapshot(pool: PgPool) {
    for at in ["2026-11-19T13:00:00Z", "2026-11-19T14:00:00Z"] {
        let rows = [row(30000001, 1, Some(1), at), row(30000002, 1, None, at)];
        assert_eq!(insert_snapshot(&pool, &rows).await.unwrap(), 2);
    }
    assert_eq!(count(&pool).await, 4);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn writes_a_full_size_snapshot(pool: PgPool) {
    let rows: Vec<_> = (30000001..=30006000)
        .map(|id| row(id, 1, Some(2), "2026-11-19T13:00:00Z"))
        .collect();
    assert_eq!(insert_snapshot(&pool, &rows).await.unwrap(), 6000);
    assert_eq!(count(&pool).await, 6000);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "regions",
        "constellations",
        "solar_systems",
        "system_activity",
        "rows"
    )
)]
async fn empty_rows_write_nothing(pool: PgPool) {
    assert_eq!(insert_snapshot(&pool, &[]).await.unwrap(), 0);
    assert_eq!(count(&pool).await, 0);
}
