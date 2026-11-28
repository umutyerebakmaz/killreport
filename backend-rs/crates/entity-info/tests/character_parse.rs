//! The shape of ESI's answer.

use chrono::{Duration, TimeZone, Utc};
use serde_json::json;
use entity_info::character::CharacterInfo;

fn esi(extra: &str) -> String {
    format!(
        r#"{{"name":"Test Pilot","corporation_id":98000001,"birthday":"2010-01-01T12:34:56.789Z",
            "bloodline_id":1,"race_id":1,"gender":"male"{extra}}}"#
    )
}

#[test]
fn only_the_required_fields_parse_with_every_optional_as_none() {
    let info: CharacterInfo = serde_json::from_str(&esi("")).unwrap();
    assert_eq!(info.name, "Test Pilot");
    assert_eq!(info.corporation_id, 98000001);
    assert_eq!(
        info.birthday,
        Utc.with_ymd_and_hms(2010, 1, 1, 12, 34, 56).unwrap() + Duration::milliseconds(789)
    );
    assert_eq!((info.bloodline_id, info.race_id), (1, 1));
    assert_eq!(info.gender, "male");
    assert_eq!(info.alliance_id, None);
    assert_eq!(info.security_status, None);
    assert_eq!(info.description, None);
    assert_eq!(info.faction_id, None);
    assert_eq!(info.corporation_title, None);
    assert_eq!(info.character_title_id, None);
    assert_eq!(info.achievement_score, None);
}

#[test]
fn every_field_parses() {
    let info: CharacterInfo = serde_json::from_str(&esi(
        r#","alliance_id":99000001,"security_status":-2.5,"description":"hi",
           "faction_id":500001,"corporation_title":"CEO",
           "character_title_id":"00851de7-b7ca-5136-871e-d07429563c06","achievement_score":1234"#,
    ))
    .unwrap();
    assert_eq!(info.alliance_id, Some(99000001));
    assert_eq!(info.security_status, Some(-2.5));
    assert_eq!(info.description.as_deref(), Some("hi"));
    assert_eq!(info.faction_id, Some(500001));
    assert_eq!(info.corporation_title.as_deref(), Some("CEO"));
    assert_eq!(
        info.character_title_id,
        Some(json!("00851de7-b7ca-5136-871e-d07429563c06"))
    );
    assert_eq!(info.achievement_score, Some(json!(1234)));
}

#[test]
fn explicit_nulls_parse_as_none() {
    let info: CharacterInfo = serde_json::from_str(&esi(
        r#","alliance_id":null,"faction_id":null,"achievement_score":null"#,
    ))
    .unwrap();
    assert_eq!(info.alliance_id, None);
    assert_eq!(info.faction_id, None);
    assert_eq!(info.achievement_score, None);
}

#[test]
fn a_wrong_typed_score_does_not_fail_the_decode() {
    let parsed = serde_json::from_str::<CharacterInfo>(&esi(
        r#","achievement_score":"x","character_title_id":7"#,
    ));
    assert!(parsed.is_ok(), "{parsed:?}");
}
