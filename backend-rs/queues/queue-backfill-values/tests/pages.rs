//! Which killmails get queued, page by page. `sqlx::test` creates a
//! throwaway database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use queue_backfill_values::{page, target, Args};
use sqlx::PgPool;

async fn killmails(pool: &PgPool, ids: std::ops::RangeInclusive<i32>) {
    sqlx::query(
        "INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id, updated_at)
         SELECT id, 'hash', '2026-11-26 10:00:00', 30000142, '2026-11-26 10:00:00'
         FROM generate_series($1::int, $2::int) AS id",
    )
    .bind(*ids.start())
    .bind(*ids.end())
    .execute(pool)
    .await
    .unwrap();
}

async fn victim(pool: &PgPool, killmail_id: i32, ship_type_id: i32) {
    sqlx::query(
        "INSERT INTO victims (killmail_id, corporation_id, ship_type_id, damage_taken)
         VALUES ($1, 98000001, $2, 100)",
    )
    .bind(killmail_id)
    .bind(ship_type_id)
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

fn descending(from: i32, to: i32) -> Vec<i32> {
    (to..=from).rev().collect()
}

#[sqlx::test(migrations = false, fixtures("killmails", "victims", "types"))]
async fn pages_are_keyset_descending(pool: PgPool) {
    killmails(&pool, 1..=1201).await;
    let all = Args::default();

    let t = target(&pool, &all).await.unwrap();
    assert_eq!((t.count, t.max_id), (1201, Some(1201)));

    assert_eq!(
        page(&pool, &all, 1202, 500).await.unwrap(),
        descending(1201, 702)
    );
    assert_eq!(
        page(&pool, &all, 702, 500).await.unwrap(),
        descending(701, 202)
    );
    assert_eq!(
        page(&pool, &all, 202, 500).await.unwrap(),
        descending(201, 1)
    );
    assert!(page(&pool, &all, 1, 500).await.unwrap().is_empty());
}

#[sqlx::test(migrations = false, fixtures("killmails", "victims", "types"))]
async fn new_rows_after_the_count_are_not_queued(pool: PgPool) {
    killmails(&pool, 1..=10).await;
    let all = Args::default();
    let t = target(&pool, &all).await.unwrap();
    assert_eq!(t.max_id, Some(10));

    killmails(&pool, 11..=11).await;
    let first = page(&pool, &all, t.max_id.unwrap() + 1, 500).await.unwrap();
    assert_eq!(first, descending(10, 1));
}

#[sqlx::test(migrations = false, fixtures("killmails", "victims", "types"))]
async fn capsules_only_by_group(pool: PgPool) {
    killmails(&pool, 1..=3).await;
    known_type(&pool, 670, 29).await;
    known_type(&pool, 33328, 29).await;
    known_type(&pool, 587, 25).await;
    victim(&pool, 1, 670).await;
    victim(&pool, 2, 33328).await;
    victim(&pool, 3, 587).await;
    let capsules = Args {
        capsules_only: true,
        ..Args::default()
    };

    let t = target(&pool, &capsules).await.unwrap();
    assert_eq!((t.count, t.max_id), (2, Some(2)));
    assert_eq!(page(&pool, &capsules, 4, 500).await.unwrap(), vec![2, 1]);
}

#[sqlx::test(migrations = false, fixtures("killmails", "victims", "types"))]
async fn single_id(pool: PgPool) {
    killmails(&pool, 1..=3).await;
    let two = Args {
        id: Some(2),
        ..Args::default()
    };
    let t = target(&pool, &two).await.unwrap();
    assert_eq!((t.count, t.max_id), (1, Some(2)));
    assert_eq!(page(&pool, &two, 3, 500).await.unwrap(), vec![2]);

    let missing = Args {
        id: Some(9),
        ..Args::default()
    };
    let t = target(&pool, &missing).await.unwrap();
    assert_eq!((t.count, t.max_id), (0, None));
}
