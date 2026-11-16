//! `update_alliance_counts` against throwaway databases. `sqlx::test` creates
//! one per test from `DATABASE_URL`'s server; the database `DATABASE_URL`
//! names is never touched.

use sqlx::PgPool;
use update_alliance_counts::update_alliance_counts;

async fn counts(pool: &PgPool, id: i32) -> (i32, i32) {
    sqlx::query_as("SELECT member_count, corporation_count FROM alliances WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("alliances", "corporations", "rows"))]
async fn counts_members_and_corporations(pool: PgPool) {
    update_alliance_counts(&pool).await.unwrap();
    assert_eq!(counts(&pool, 99000001).await, (15, 2));
    assert_eq!(counts(&pool, 99000003).await, (3, 1));
}

#[sqlx::test(migrations = false, fixtures("alliances", "corporations", "rows"))]
async fn alliance_without_corporations_gets_zero(pool: PgPool) {
    update_alliance_counts(&pool).await.unwrap();
    assert_eq!(counts(&pool, 99000002).await, (0, 0));
}

#[sqlx::test(migrations = false, fixtures("alliances", "corporations", "rows"))]
async fn returns_every_alliance_updated(pool: PgPool) {
    assert_eq!(update_alliance_counts(&pool).await.unwrap(), 3);
}

#[sqlx::test(migrations = false, fixtures("alliances", "corporations", "rows"))]
async fn corporation_moving_alliance_moves_its_count(pool: PgPool) {
    update_alliance_counts(&pool).await.unwrap();
    sqlx::query("UPDATE corporations SET alliance_id = 99000003 WHERE id = 98000002")
        .execute(&pool)
        .await
        .unwrap();
    update_alliance_counts(&pool).await.unwrap();
    assert_eq!(counts(&pool, 99000001).await, (10, 1));
    assert_eq!(counts(&pool, 99000003).await, (8, 2));
}

#[sqlx::test(migrations = false, fixtures("alliances", "corporations", "rows"))]
async fn updated_at_is_untouched(pool: PgPool) {
    update_alliance_counts(&pool).await.unwrap();
    let stamps: Vec<String> =
        sqlx::query_scalar("SELECT updated_at::text FROM alliances ORDER BY id")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(stamps, ["2026-01-01 00:00:00"; 3]);
}

#[sqlx::test(migrations = false, fixtures("alliances", "corporations"))]
async fn empty_tables_update_nothing(pool: PgPool) {
    assert_eq!(update_alliance_counts(&pool).await.unwrap(), 0);
}
