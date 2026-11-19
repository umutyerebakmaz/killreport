//! Which character IDs get queued: the ones a killmail's victim or attackers
//! name that `characters` does not have. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use queue_killmail_characters::missing_character_ids;
use sqlx::PgPool;

async fn killmail(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id, updated_at)
         VALUES ($1, 'hash', CURRENT_TIMESTAMP, 30000142, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

async fn victim(pool: &PgPool, killmail_id: i32, character_id: Option<i32>) {
    sqlx::query(
        "INSERT INTO victims (killmail_id, character_id, corporation_id, ship_type_id, damage_taken)
         VALUES ($1, $2, 98000001, 587, 100)",
    )
    .bind(killmail_id)
    .bind(character_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn attacker(pool: &PgPool, killmail_id: i32, id: i64, character_id: Option<i32>) {
    sqlx::query(
        "INSERT INTO attackers (id, killmail_id, character_id, damage_done, final_blow, updated_at)
         VALUES ($1, $2, $3, 100, false, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .bind(killmail_id)
    .bind(character_id)
    .execute(pool)
    .await
    .unwrap();
}

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

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "characters")
)]
async fn victim_characters_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, Some(90000002)).await;
    assert_eq!(missing_character_ids(&pool).await.unwrap(), [90000002]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "characters")
)]
async fn attacker_characters_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    attacker(&pool, 1, 1, Some(90000003)).await;
    assert_eq!(missing_character_ids(&pool).await.unwrap(), [90000003]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "characters")
)]
async fn duplicates_are_queued_once(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, Some(90000001)).await;
    attacker(&pool, 1, 1, Some(90000001)).await;
    attacker(&pool, 1, 2, Some(90000001)).await;
    assert_eq!(missing_character_ids(&pool).await.unwrap(), [90000001]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "characters")
)]
async fn nulls_are_skipped(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, None).await;
    attacker(&pool, 1, 1, None).await;
    assert!(missing_character_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "characters")
)]
async fn known_ids_are_dropped(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, Some(90000001)).await;
    character(&pool, 90000001).await;
    assert!(missing_character_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "characters")
)]
async fn ids_are_ascending(pool: PgPool) {
    killmail(&pool, 1).await;
    killmail(&pool, 2).await;
    victim(&pool, 1, Some(90000009)).await;
    victim(&pool, 2, Some(90000004)).await;
    assert_eq!(
        missing_character_ids(&pool).await.unwrap(),
        [90000004, 90000009]
    );
}
