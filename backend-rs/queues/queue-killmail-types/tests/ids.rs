//! Which type IDs get queued: the victim's ship, the attackers' ships and
//! weapons, and every dropped or destroyed item, when `types` does not have
//! them. `sqlx::test` creates a throwaway database per test from
//! `DATABASE_URL`'s server; the database `DATABASE_URL` names is never
//! touched.

use queue_killmail_types::missing_type_ids;
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

/// `victims.ship_type_id` is NOT NULL, so a victim always names one.
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

async fn attacker(
    pool: &PgPool,
    killmail_id: i32,
    id: i64,
    ship_type_id: Option<i32>,
    weapon_type_id: Option<i32>,
) {
    sqlx::query(
        "INSERT INTO attackers (id, killmail_id, ship_type_id, weapon_type_id, damage_done, final_blow, updated_at)
         VALUES ($1, $2, $3, $4, 100, false, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .bind(killmail_id)
    .bind(ship_type_id)
    .bind(weapon_type_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn item(pool: &PgPool, killmail_id: i32, id: i64, item_type_id: i32) {
    sqlx::query(
        "INSERT INTO killmail_items (id, killmail_id, item_type_id, flag, singleton)
         VALUES ($1, $2, $3, 5, 0)",
    )
    .bind(id)
    .bind(killmail_id)
    .bind(item_type_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn known_type(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO types (id, name, group_id, updated_at)
         VALUES ($1, 'Known', 25, CURRENT_TIMESTAMP)",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn victim_ships_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 587).await;
    assert_eq!(missing_type_ids(&pool).await.unwrap(), [587]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn attacker_ships_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    attacker(&pool, 1, 1, Some(603), None).await;
    assert_eq!(missing_type_ids(&pool).await.unwrap(), [603]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn attacker_weapons_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    attacker(&pool, 1, 1, None, Some(2873)).await;
    assert_eq!(missing_type_ids(&pool).await.unwrap(), [2873]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn items_are_queued(pool: PgPool) {
    killmail(&pool, 1).await;
    item(&pool, 1, 1, 3170).await;
    assert_eq!(missing_type_ids(&pool).await.unwrap(), [3170]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn duplicates_are_queued_once(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 587).await;
    attacker(&pool, 1, 1, Some(587), Some(587)).await;
    item(&pool, 1, 1, 587).await;
    item(&pool, 1, 2, 587).await;
    assert_eq!(missing_type_ids(&pool).await.unwrap(), [587]);
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn nulls_are_skipped(pool: PgPool) {
    killmail(&pool, 1).await;
    attacker(&pool, 1, 1, None, None).await;
    assert!(missing_type_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn known_ids_are_dropped(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 587).await;
    known_type(&pool, 587).await;
    assert!(missing_type_ids(&pool).await.unwrap().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("killmails", "victims", "attackers", "killmail_items", "types")
)]
async fn ids_are_ascending(pool: PgPool) {
    killmail(&pool, 1).await;
    victim(&pool, 1, 3170).await;
    item(&pool, 1, 1, 587).await;
    attacker(&pool, 1, 1, None, Some(2873)).await;
    assert_eq!(missing_type_ids(&pool).await.unwrap(), [587, 2873, 3170]);
}
