//! Which corporation IDs get queued: the ones characters point at, now or in
//! their history, that `corporations` does not have. `sqlx::test` creates a
//! throwaway database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use queue_character_corporations::missing_corporation_ids;
use sqlx::PgPool;

async fn character(pool: &PgPool, id: i32, corporation_id: i32) {
    sqlx::query(
        "INSERT INTO characters (id, name, corporation_id, birthday, bloodline_id, race_id, gender, updated_at)
         VALUES ($1, 'Pilot', $2, CURRENT_TIMESTAMP, 1, 1, 'male', CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .bind(corporation_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn history(pool: &PgPool, record_id: i64, character_id: i32, corporation_id: i32) {
    sqlx::query(
        "INSERT INTO character_corporation_history (record_id, character_id, corporation_id, start_date, fetched_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .bind(record_id)
    .bind(character_id)
    .bind(corporation_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn corporation(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO corporations (id, name, ticker, member_count, ceo_id, creator_id, tax_rate, updated_at)
         VALUES ($1, 'Known', 'KNWN', 1, 90000001, 90000001, 0.1, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "characters", "character_corporation_history")
)]
async fn current_corporations_are_queued(pool: PgPool) {
    character(&pool, 90000001, 98000002).await;
    character(&pool, 90000002, 98000001).await;
    assert_eq!(
        missing_corporation_ids(&pool).await.unwrap(),
        [98000001, 98000002]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "characters", "character_corporation_history")
)]
async fn history_corporations_are_queued(pool: PgPool) {
    character(&pool, 90000001, 98000001).await;
    history(&pool, 1, 90000001, 98000003).await;
    assert_eq!(
        missing_corporation_ids(&pool).await.unwrap(),
        [98000001, 98000003]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "characters", "character_corporation_history")
)]
async fn union_is_deduplicated(pool: PgPool) {
    character(&pool, 90000001, 98000001).await;
    history(&pool, 1, 90000001, 98000001).await;
    assert_eq!(missing_corporation_ids(&pool).await.unwrap(), [98000001]);
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "characters", "character_corporation_history")
)]
async fn known_corporations_are_dropped(pool: PgPool) {
    character(&pool, 90000001, 98000001).await;
    character(&pool, 90000002, 98000002).await;
    corporation(&pool, 98000001).await;
    assert_eq!(missing_corporation_ids(&pool).await.unwrap(), [98000002]);
}

#[sqlx::test(
    migrations = false,
    fixtures("corporations", "characters", "character_corporation_history")
)]
async fn nothing_missing_is_empty(pool: PgPool) {
    assert!(missing_corporation_ids(&pool).await.unwrap().is_empty());
}
