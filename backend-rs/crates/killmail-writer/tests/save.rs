//! `save` against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use killmail_writer::{save, Attacker, DetailItem, KillmailDetail, Position, Saved, Victim};
use sqlx::PgPool;

const ID: i32 = 133900250;
const HASH: &str = "8a1b2c";
const SYSTEM: i32 = 30000142;
const UNKNOWN_SYSTEM: i32 = 30000999;
const REGION: i32 = 10000002;
const RIFTER: i32 = 587;
const FRIGATE_GROUP: i32 = 25;
const AMMO: i32 = 178;
const CORP: i32 = 98000001;

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 28)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

fn at(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}

fn attacker(character_id: i32) -> Attacker {
    Attacker {
        character_id: Some(character_id),
        corporation_id: Some(CORP),
        alliance_id: Some(99000001),
        faction_id: None,
        ship_type_id: Some(RIFTER),
        weapon_type_id: Some(AMMO),
        damage_done: 100,
        final_blow: character_id == 1001,
        security_status: Some(-1.5),
    }
}

/// A Rifter killed by two pilots of one corporation, with one stack of ammo.
fn detail() -> KillmailDetail {
    KillmailDetail {
        killmail_id: ID,
        killmail_time: at("2026-11-27T12:00:00Z"),
        solar_system_id: SYSTEM,
        victim: Victim {
            character_id: Some(2001),
            corporation_id: 98000002,
            alliance_id: None,
            faction_id: None,
            ship_type_id: RIFTER,
            damage_taken: 200,
            position: Some(Position {
                x: 1.0,
                y: 0.0,
                z: -3.5,
            }),
            items: vec![DetailItem {
                item_type_id: Some(AMMO),
                flag: 27,
                quantity_destroyed: Some(100),
                quantity_dropped: Some(50),
                singleton: 0,
            }],
        },
        attackers: vec![attacker(1001), attacker(1002)],
    }
}

/// Corporations, region, ship group, security class and value of a filter row.
type FilterRow = (
    Vec<i32>,
    Option<i32>,
    Option<i32>,
    Option<String>,
    Option<f64>,
);

async fn exec(pool: &PgPool, sql: &str) {
    sqlx::query(sql).execute(pool).await.unwrap();
}

/// The universe and the prices: Rifter 500,000 ISK, ammo 10 ISK.
async fn seed(pool: &PgPool) {
    exec(
        pool,
        "INSERT INTO regions (region_id, name) VALUES (10000002, 'The Forge')",
    )
    .await;
    exec(
        pool,
        "INSERT INTO constellations (constellation_id, name, region_id) VALUES (20000020, 'Kimotoro', 10000002)",
    )
    .await;
    exec(
        pool,
        "INSERT INTO solar_systems (system_id, name, constellation_id, security_status, security_class)
         VALUES (30000142, 'Jita', 20000020, 0.95, 'B')",
    )
    .await;
    exec(
        pool,
        "INSERT INTO categories (id, name, updated_at) VALUES (6, 'Ship', now()), (8, 'Charge', now())",
    )
    .await;
    exec(
        pool,
        "INSERT INTO item_groups (id, name, category_id, updated_at) VALUES (25, 'Frigate', 6, now()), (83, 'Projectile Ammo', 8, now())",
    )
    .await;
    exec(
        pool,
        "INSERT INTO types (id, name, group_id, updated_at) VALUES (587, 'Rifter', 25, now()), (178, 'EMP S', 83, now())",
    )
    .await;
    exec(
        pool,
        "INSERT INTO market_prices (type_id, sell, updated_at) VALUES (587, 500000, now()), (178, 10, now())",
    )
    .await;
}

async fn count(pool: &PgPool, sql: &str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
}

async fn corp_kills(pool: &PgPool) -> i32 {
    sqlx::query_scalar("SELECT kill_count FROM corporation_kill_stats WHERE corporation_id = $1")
        .bind(CORP)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn writes_every_table(pool: PgPool) {
    seed(&pool).await;
    assert_eq!(
        save(&pool, &detail(), HASH, now()).await.unwrap(),
        Saved::Written
    );

    let (hash, attacker_count, total, destroyed, dropped, updated_at): (
        String,
        Option<i32>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        NaiveDateTime,
    ) = sqlx::query_as(
        "SELECT killmail_hash, attacker_count, total_value, destroyed_value, dropped_value, updated_at
         FROM killmails WHERE killmail_id = $1",
    )
    .bind(ID)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(hash, HASH);
    assert_eq!(attacker_count, Some(2));
    // 500,000 for the hull, 100 × 10 destroyed and 50 × 10 dropped.
    assert_eq!(total, Some(501_500.0));
    assert_eq!(destroyed, Some(501_000.0));
    assert_eq!(dropped, Some(500.0));
    assert_eq!(updated_at, now());

    let position: (Option<f64>, Option<f64>, Option<f64>) = sqlx::query_as(
        "SELECT position_x, position_y, position_z FROM victims WHERE killmail_id = $1",
    )
    .bind(ID)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(position, (Some(1.0), Some(0.0), Some(-3.5)));
    assert_eq!(count(&pool, "SELECT count(*) FROM attackers").await, 2);
    assert_eq!(
        count(&pool, "SELECT count(*) FROM attackers WHERE final_blow").await,
        1
    );
    assert_eq!(count(&pool, "SELECT count(*) FROM killmail_items").await, 1);

    assert_eq!(
        count(&pool, "SELECT count(*) FROM character_kill_stats WHERE kill_date = '2026-11-27' AND kill_count = 1").await,
        2
    );
    assert_eq!(corp_kills(&pool).await, 1);
    assert_eq!(
        count(&pool, "SELECT count(*) FROM alliance_kill_stats").await,
        1
    );

    let (corps, region, group, security_class, filter_total): FilterRow = sqlx::query_as(
        "SELECT attacker_corporation_ids, region_id, victim_ship_group_id, security_class, total_value
         FROM killmail_filters WHERE killmail_id = $1",
    )
    .bind(ID)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(corps, vec![CORP]);
    assert_eq!(region, Some(REGION));
    assert_eq!(group, Some(FRIGATE_GROUP));
    assert_eq!(security_class.as_deref(), Some("B"));
    assert_eq!(filter_total, Some(501_500.0));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn second_save_is_already_stored(pool: PgPool) {
    seed(&pool).await;
    assert_eq!(
        save(&pool, &detail(), HASH, now()).await.unwrap(),
        Saved::Written
    );
    assert_eq!(
        save(&pool, &detail(), HASH, now()).await.unwrap(),
        Saved::AlreadyStored
    );
    assert_eq!(corp_kills(&pool).await, 1);
    assert_eq!(count(&pool, "SELECT count(*) FROM attackers").await, 2);
    assert_eq!(count(&pool, "SELECT count(*) FROM killmail_items").await, 1);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn skips_items_without_a_type(pool: PgPool) {
    seed(&pool).await;
    let mut d = detail();
    d.victim.items.push(DetailItem {
        item_type_id: None,
        flag: 5,
        quantity_destroyed: Some(1),
        quantity_dropped: None,
        singleton: 0,
    });
    assert_eq!(save(&pool, &d, HASH, now()).await.unwrap(), Saved::Written);
    assert_eq!(count(&pool, "SELECT count(*) FROM killmail_items").await, 1);
    let total: Option<f64> = sqlx::query_scalar("SELECT total_value FROM killmails")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(total, Some(501_500.0));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn npc_attacker_counts_but_adds_no_ids(pool: PgPool) {
    seed(&pool).await;
    let mut d = detail();
    d.attackers.push(Attacker {
        character_id: None,
        corporation_id: None,
        alliance_id: None,
        faction_id: None,
        ship_type_id: None,
        weapon_type_id: None,
        damage_done: 5,
        final_blow: false,
        security_status: None,
    });
    assert_eq!(save(&pool, &d, HASH, now()).await.unwrap(), Saved::Written);
    let attacker_count: Option<i32> = sqlx::query_scalar("SELECT attacker_count FROM killmails")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(attacker_count, Some(3));
    assert_eq!(
        count(&pool, "SELECT count(*) FROM character_kill_stats").await,
        2
    );
    assert_eq!(
        count(&pool, "SELECT count(*) FROM corporation_kill_stats").await,
        1
    );
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM killmail_filters
             WHERE array_position(attacker_character_ids, NULL) IS NOT NULL
                OR array_position(attacker_ship_type_ids, NULL) IS NOT NULL"
        )
        .await,
        0
    );
    let characters: Vec<i32> =
        sqlx::query_scalar("SELECT attacker_character_ids FROM killmail_filters")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(characters.len(), 2);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn zero_ids_are_stored_as_null(pool: PgPool) {
    seed(&pool).await;
    let mut d = detail();
    d.victim.alliance_id = Some(0);
    d.victim.faction_id = Some(0);
    d.attackers[0].weapon_type_id = Some(0);
    assert_eq!(save(&pool, &d, HASH, now()).await.unwrap(), Saved::Written);
    let (alliance, faction): (Option<i32>, Option<i32>) =
        sqlx::query_as("SELECT alliance_id, faction_id FROM victims")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!((alliance, faction), (None, Some(0)));
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM attackers WHERE weapon_type_id IS NULL"
        )
        .await,
        1
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn kill_date_is_the_utc_day(pool: PgPool) {
    seed(&pool).await;
    let mut d = detail();
    d.killmail_time = at("2026-11-27T23:59:59Z");
    assert_eq!(save(&pool, &d, HASH, now()).await.unwrap(), Saved::Written);
    let day: NaiveDate = sqlx::query_scalar("SELECT kill_date FROM corporation_kill_stats")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(day, NaiveDate::from_ymd_opt(2026, 11, 27).unwrap());
    let time: NaiveDateTime = sqlx::query_scalar("SELECT killmail_time FROM killmails")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        time,
        NaiveDate::from_ymd_opt(2026, 11, 27)
            .unwrap()
            .and_hms_opt(23, 59, 59)
            .unwrap()
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn unknown_system_still_writes_the_filter_row(pool: PgPool) {
    seed(&pool).await;
    let mut d = detail();
    d.solar_system_id = UNKNOWN_SYSTEM;
    assert_eq!(save(&pool, &d, HASH, now()).await.unwrap(), Saved::Written);
    let region: Option<i32> = sqlx::query_scalar("SELECT region_id FROM killmail_filters")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(region, None);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "killmails",
        "victims",
        "attackers",
        "killmail_items",
        "killmail_filters",
        "character_kill_stats",
        "corporation_kill_stats",
        "alliance_kill_stats",
        "regions",
        "constellations",
        "solar_systems",
        "types",
        "item_groups",
        "categories",
        "market_prices"
    )
)]
async fn refuses_no_attackers(pool: PgPool) {
    seed(&pool).await;
    let mut d = detail();
    d.attackers.clear();
    let error = save(&pool, &d, HASH, now()).await.unwrap_err();
    assert!(error.to_string().contains("has no attackers"), "{error:#}");
    assert_eq!(count(&pool, "SELECT count(*) FROM killmails").await, 0);
}

#[test]
fn deserializes_esi_json() {
    let body = r#"{
        "killmail_id": 1,
        "killmail_time": "2026-11-27T12:00:00Z",
        "solar_system_id": 30000142,
        "victim": {
            "corporation_id": 1000001,
            "damage_taken": 10,
            "ship_type_id": 670,
            "items": [{ "flag": 5, "item_type_id": 178, "quantity_dropped": 3, "singleton": 0 }]
        }
    }"#;
    let d: KillmailDetail = serde_json::from_str(body).unwrap();
    assert!(d.attackers.is_empty());
    assert!(d.victim.position.is_none());
    assert_eq!(d.victim.character_id, None);
    assert_eq!(d.victim.items[0].quantity_destroyed, None);
    assert_eq!(d.killmail_time, at("2026-11-27T12:00:00Z"));
}
