//! Which characters get queued: the ones given on the command line, or every
//! character whose history was never fetched or is older than 6 days.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use queue_character_corporation_history::{parse_ids, stale_character_ids};
use sqlx::PgPool;

async fn character(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO characters (id, name, corporation_id, birthday, bloodline_id, race_id, gender, updated_at)
         VALUES ($1, 'Pilot', 98000001, CURRENT_TIMESTAMP, 1, 1, 'male', CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

/// A history row for `character_id`, fetched `days_ago` days ago in UTC.
async fn fetched(pool: &PgPool, record_id: i64, character_id: i32, days_ago: i32) {
    sqlx::query(
        "INSERT INTO character_corporation_history (record_id, character_id, corporation_id, start_date, fetched_at)
         VALUES ($1, $2, 98000001, '2020-01-01', (NOW() AT TIME ZONE 'UTC') - make_interval(days => $3))",
    )
    .bind(record_id)
    .bind(character_id)
    .bind(days_ago)
    .execute(pool)
    .await
    .unwrap();
}

#[test]
fn parse_ids_rejects_partial_numbers() {
    assert!(parse_ids(&["12abc".to_string()]).is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "character_corporation_history")
)]
async fn never_fetched_is_stale(pool: PgPool) {
    character(&pool, 90000001).await;
    assert_eq!(stale_character_ids(&pool).await.unwrap(), [90000001]);
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "character_corporation_history")
)]
async fn older_than_six_days_is_stale(pool: PgPool) {
    character(&pool, 90000001).await;
    fetched(&pool, 1, 90000001, 7).await;
    assert_eq!(stale_character_ids(&pool).await.unwrap(), [90000001]);
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "character_corporation_history")
)]
async fn fetched_recently_is_not_stale(pool: PgPool) {
    character(&pool, 90000001).await;
    fetched(&pool, 1, 90000001, 1).await;
    assert!(stale_character_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "character_corporation_history")
)]
async fn the_newest_fetch_decides(pool: PgPool) {
    character(&pool, 90000001).await;
    fetched(&pool, 1, 90000001, 10).await;
    fetched(&pool, 2, 90000001, 1).await;
    assert!(stale_character_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "character_corporation_history")
)]
async fn ids_come_in_order(pool: PgPool) {
    for id in [90000003, 90000001, 90000002] {
        character(&pool, id).await;
    }
    assert_eq!(
        stale_character_ids(&pool).await.unwrap(),
        [90000001, 90000002, 90000003]
    );
}
