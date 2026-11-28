//! The title columns, ported from `helpers/character-achievement.spec.ts`.

use chrono::{TimeZone, Utc};
use serde_json::{json, Value};
use entity_info::character::{title_fields, CharacterInfo, TitleFields};

const UUID: &str = "00851de7-b7ca-5136-871e-d07429563c06";

fn base() -> CharacterInfo {
    CharacterInfo {
        name: "x".into(),
        corporation_id: 1,
        birthday: Utc.with_ymd_and_hms(2010, 1, 1, 0, 0, 0).unwrap(),
        bloodline_id: 1,
        race_id: 1,
        gender: "male".into(),
        alliance_id: None,
        security_status: None,
        description: None,
        faction_id: None,
        corporation_title: None,
        character_title_id: None,
        achievement_score: None,
    }
}

fn score(value: Value) -> Option<i32> {
    title_fields(&CharacterInfo {
        achievement_score: Some(value),
        ..base()
    })
    .achievement_score
}

fn title_id(value: Value) -> Option<String> {
    title_fields(&CharacterInfo {
        character_title_id: Some(value),
        ..base()
    })
    .character_title_id
}

#[test]
fn maps_the_new_fields_corporation_title_into_title() {
    let fields = title_fields(&CharacterInfo {
        corporation_title: Some("CEO".into()),
        character_title_id: Some(json!(UUID)),
        achievement_score: Some(json!(1234)),
        ..base()
    });
    assert_eq!(
        fields,
        TitleFields {
            title: Some("CEO".into()),
            character_title_id: Some(UUID.into()),
            achievement_score: Some(1234),
        }
    );
}

#[test]
fn writes_none_for_every_key_esi_left_out() {
    assert_eq!(
        title_fields(&base()),
        TitleFields {
            title: None,
            character_title_id: None,
            achievement_score: None,
        }
    );
}

#[test]
fn keeps_a_score_of_0() {
    assert_eq!(score(json!(0)), Some(0));
}

#[test]
fn keeps_an_integral_float_score() {
    assert_eq!(score(json!(1.0)), Some(1));
}

#[test]
fn drops_a_score_that_does_not_fit_an_int_column() {
    assert_eq!(score(json!(2_147_483_648_i64)), None);
    assert_eq!(score(json!(-1)), None);
    assert_eq!(score(json!(2_147_483_647)), Some(i32::MAX));
}

#[test]
fn drops_a_fractional_or_non_numeric_score() {
    assert_eq!(score(json!(1.5)), None);
    assert_eq!(score(json!("x")), None);
}

#[test]
fn keeps_an_uppercase_uuid() {
    let upper = UUID.to_ascii_uppercase();
    assert_eq!(title_id(json!(upper)), Some(upper));
}

#[test]
fn drops_a_title_id_that_is_not_a_uuid() {
    assert_eq!(title_id(json!("not-a-uuid")), None);
    assert_eq!(title_id(json!(7)), None);
}
