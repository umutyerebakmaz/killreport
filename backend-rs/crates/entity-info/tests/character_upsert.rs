//! The upsert against a real PostgreSQL. `sqlx::test` creates a throwaway
//! database per test from `DATABASE_URL`'s server and loads the `characters`
//! fixture into it; the database `DATABASE_URL` names is never touched.

use chrono::{Duration, NaiveDateTime, TimeZone, Utc};
use entity_info::character::{upsert_character, CharacterInfo};
use serde_json::json;
use sqlx::PgPool;

const ID: i32 = 2120000001;
const UUID: &str = "00851de7-b7ca-5136-871e-d07429563c06";

fn info() -> CharacterInfo {
    CharacterInfo {
        name: "Test Pilot".into(),
        corporation_id: 98000001,
        birthday: Utc.with_ymd_and_hms(2010, 1, 1, 12, 34, 56).unwrap()
            + Duration::milliseconds(789),
        bloodline_id: 1,
        race_id: 2,
        gender: "female".into(),
        alliance_id: Some(99000001),
        security_status: Some(-2.5),
        description: Some("hello".into()),
        faction_id: Some(500001),
        corporation_title: Some("CEO".into()),
        character_title_id: Some(json!(UUID)),
        achievement_score: Some(json!(1234)),
    }
}

#[derive(Debug, sqlx::FromRow)]
struct Row {
    name: String,
    corporation_id: i32,
    alliance_id: Option<i32>,
    birthday: NaiveDateTime,
    bloodline_id: i32,
    race_id: i32,
    gender: String,
    security_status: Option<f64>,
    description: Option<String>,
    title: Option<String>,
    faction_id: Option<i32>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    achievement_score: Option<i32>,
    character_title_id: Option<String>,
}

async fn row(pool: &PgPool) -> Row {
    sqlx::query_as::<_, Row>(
        "SELECT name, corporation_id, alliance_id, birthday, bloodline_id, race_id, gender,
                security_status, description, title, faction_id, created_at, updated_at,
                achievement_score, character_title_id::text AS character_title_id
         FROM characters WHERE id = $1",
    )
    .bind(ID)
    .fetch_one(pool)
    .await
    .unwrap()
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn a_new_character_is_inserted(pool: PgPool) {
    assert!(upsert_character(&pool, ID, &info()).await.unwrap());

    let row = row(&pool).await;
    let want = info();
    assert_eq!(row.name, want.name);
    assert_eq!(row.corporation_id, want.corporation_id);
    assert_eq!(row.alliance_id, want.alliance_id);
    // Milliseconds included: the column is timestamp(3).
    assert_eq!(row.birthday, want.birthday.naive_utc());
    assert_eq!(row.bloodline_id, want.bloodline_id);
    assert_eq!(row.race_id, want.race_id);
    assert_eq!(row.gender, want.gender);
    assert_eq!(row.security_status, want.security_status);
    assert_eq!(row.description, want.description);
    assert_eq!(row.title.as_deref(), Some("CEO"));
    assert_eq!(row.faction_id, want.faction_id);
    assert_eq!(row.achievement_score, Some(1234));
    assert_eq!(row.character_title_id.as_deref(), Some(UUID));
    // updated_at has no database default; without the explicit now() the
    // insert fails on NOT NULL.
    assert!(row.updated_at >= row.created_at);
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn an_existing_character_is_updated(pool: PgPool) {
    upsert_character(&pool, ID, &info()).await.unwrap();
    let before = row(&pool).await;
    // now() is the transaction start; a pause keeps the second one apart.
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    let other_uuid = "11111111-2222-3333-4444-555555555555";
    let changed = CharacterInfo {
        corporation_id: 98000009,
        alliance_id: Some(99000009),
        security_status: Some(5.0),
        description: Some("changed".into()),
        corporation_title: Some("Director".into()),
        character_title_id: Some(json!(other_uuid)),
        achievement_score: Some(json!(99)),
        faction_id: Some(500009),
        ..info()
    };
    assert!(!upsert_character(&pool, ID, &changed).await.unwrap());

    let after = row(&pool).await;
    assert_eq!(after.corporation_id, 98000009);
    assert_eq!(after.alliance_id, Some(99000009));
    assert_eq!(after.security_status, Some(5.0));
    assert_eq!(after.description.as_deref(), Some("changed"));
    assert_eq!(after.title.as_deref(), Some("Director"));
    assert_eq!(after.character_title_id.as_deref(), Some(other_uuid));
    assert_eq!(after.achievement_score, Some(99));
    assert_eq!(after.faction_id, Some(500009));
    assert!(after.updated_at > before.updated_at);
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn columns_written_only_on_insert_keep_their_value(pool: PgPool) {
    upsert_character(&pool, ID, &info()).await.unwrap();
    let before = row(&pool).await;

    let rewritten = CharacterInfo {
        name: "Renamed".into(),
        birthday: Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap(),
        bloodline_id: 9,
        race_id: 9,
        gender: "male".into(),
        ..info()
    };
    upsert_character(&pool, ID, &rewritten).await.unwrap();

    let after = row(&pool).await;
    assert_eq!(after.name, "Test Pilot");
    assert_eq!(after.birthday, before.birthday);
    assert_eq!(after.bloodline_id, 1);
    assert_eq!(after.race_id, 2);
    assert_eq!(after.gender, "female");
    assert_eq!(after.created_at, before.created_at);
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn missing_optional_fields_clear_the_old_value(pool: PgPool) {
    upsert_character(&pool, ID, &info()).await.unwrap();

    let without = CharacterInfo {
        alliance_id: None,
        security_status: None,
        description: None,
        faction_id: None,
        corporation_title: None,
        character_title_id: None,
        achievement_score: None,
        ..info()
    };
    upsert_character(&pool, ID, &without).await.unwrap();

    let row = row(&pool).await;
    assert_eq!(row.alliance_id, None);
    assert_eq!(row.security_status, None);
    assert_eq!(row.description, None);
    assert_eq!(row.faction_id, None);
    assert_eq!(row.title, None);
    assert_eq!(row.character_title_id, None);
    assert_eq!(row.achievement_score, None);
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn a_rejected_score_or_title_id_is_null(pool: PgPool) {
    let malformed = CharacterInfo {
        achievement_score: Some(json!("x")),
        character_title_id: Some(json!("nope")),
        ..info()
    };
    upsert_character(&pool, ID, &malformed).await.unwrap();

    let row = row(&pool).await;
    assert_eq!(row.achievement_score, None);
    assert_eq!(row.character_title_id, None);
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn an_uppercase_title_id_is_stored(pool: PgPool) {
    let upper = CharacterInfo {
        character_title_id: Some(json!(UUID.to_ascii_uppercase())),
        ..info()
    };
    upsert_character(&pool, ID, &upper).await.unwrap();

    assert_eq!(row(&pool).await.character_title_id.as_deref(), Some(UUID));
}

#[sqlx::test(migrations = false, fixtures("characters"))]
async fn a_birthday_past_milliseconds_is_truncated_not_rounded(pool: PgPool) {
    // JavaScript's Date keeps milliseconds and drops the rest, so Node stores
    // .789 for .789999; PostgreSQL's timestamp(3) would round it to .790.
    let precise = CharacterInfo {
        birthday: Utc.with_ymd_and_hms(2010, 1, 1, 12, 34, 56).unwrap()
            + Duration::microseconds(789_999),
        ..info()
    };
    upsert_character(&pool, ID, &precise).await.unwrap();

    let want = Utc.with_ymd_and_hms(2010, 1, 1, 12, 34, 56).unwrap() + Duration::milliseconds(789);
    assert_eq!(row(&pool).await.birthday, want.naive_utc());
}
