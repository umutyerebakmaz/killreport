//! Which corporation IDs get queued: the ones a killmail's victim or
//! attackers name that `corporations` does not have. `sqlx::test` creates a
//! throwaway database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use queue_killmail_corporations::missing_corporation_ids;
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

/// `victims.corporation_id` is NOT NULL, so a victim always names one.
async fn victim(pool: &PgPool, killmail_id: i32, corporation_id: i32) {
    sqlx::query(
        "INSERT INTO victims (killmail_id, corporation_id, ship_type_id, damage_taken)
         VALUES ($1, $2, 587, 100)",
    )
    .bind(killmail_id)
    .bind(corporation_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn attacker(pool: &PgPool, killmail_id: i32, id: i64, corporation_id: Option<i32>) {
    sqlx::query(
        "INSERT INTO attackers (id, killmail_id, corporation_id, damage_done, final_blow, updated_at)
         VALUES ($1, $2, $3, 100, false, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .bind(killmail_id)
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
    fixtures("killmails", "victims", "attackers", "corporations")
)]
async fn victim_corporations_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 98000002).await;
    assert_eq!(missing_corporation_ids(&pool).await.unwrap(), [98000002]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "corporations")
)]
async fn attacker_corporations_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    attacker(&pool, 1, 1, Some(98000003)).await;
    assert_eq!(missing_corporation_ids(&pool).await.unwrap(), [98000003]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "corporations")
)]
async fn duplicates_are_queued_once(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 98000001).await;
    attacker(&pool, 1, 1, Some(98000001)).await;
    attacker(&pool, 1, 2, Some(98000001)).await;
    assert_eq!(missing_corporation_ids(&pool).await.unwrap(), [98000001]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "corporations")
)]
async fn nulls_are_skipped(pool: PgPool) {
    killmail(&pool, 1).await;
    attacker(&pool, 1, 1, None).await;
    assert!(missing_corporation_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "corporations")
)]
async fn known_ids_are_dropped(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 98000001).await;
    corporation(&pool, 98000001).await;
    assert!(missing_corporation_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "corporations")
)]
async fn ids_are_ascending(pool: PgPool) {
    killmail(&pool, 1).await;
    killmail(&pool, 2).await;
    victim(&pool, 1, 98000009).await;
    victim(&pool, 2, 98000004).await;
    assert_eq!(
        missing_corporation_ids(&pool).await.unwrap(),
        [98000004, 98000009]
    );
}
