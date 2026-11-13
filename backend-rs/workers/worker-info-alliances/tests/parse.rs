//! The two shapes the worker reads: its queue message and ESI's answer.

use chrono::{TimeZone, Utc};
use worker_info_alliances::alliance::AllianceInfo;
use worker_info_alliances::message::EntityQueueMessage;

#[test]
fn reads_the_entity_id_and_ignores_the_other_fields() {
    let body = br#"{"entityId":99000001,"queuedAt":"2026-11-13T22:00:00.000Z","source":"queue-alliances"}"#;
    assert_eq!(
        EntityQueueMessage::parse(body).unwrap(),
        EntityQueueMessage {
            entity_id: 99000001
        }
    );
}

#[test]
fn a_body_without_a_numeric_entity_id_does_not_parse() {
    assert!(EntityQueueMessage::parse(br#"{"queuedAt":"x"}"#).is_err());
    assert!(EntityQueueMessage::parse(br#"{"entityId":"99000001"}"#).is_err());
    assert!(EntityQueueMessage::parse(b"99000001").is_err());
    assert!(EntityQueueMessage::parse(b"not json").is_err());
}

fn esi(extra: &str) -> String {
    format!(
        r#"{{"name":"Test Alliance","ticker":"TEST","date_founded":"2010-11-04T13:11:00Z",
            "creator_corporation_id":98000001,"creator_id":90000001{extra}}}"#
    )
}

#[test]
fn a_missing_executor_and_faction_read_as_none() {
    let info: AllianceInfo = serde_json::from_str(&esi("")).unwrap();
    assert_eq!(info.executor_corporation_id, None);
    assert_eq!(info.faction_id, None);
}

#[test]
fn present_executor_and_faction_are_read() {
    let info: AllianceInfo = serde_json::from_str(&esi(
        r#","executor_corporation_id":98000002,"faction_id":500001"#,
    ))
    .unwrap();
    assert_eq!(info.executor_corporation_id, Some(98000002));
    assert_eq!(info.faction_id, Some(500001));
}

#[test]
fn date_founded_reads_with_and_without_milliseconds() {
    let info: AllianceInfo = serde_json::from_str(&esi("")).unwrap();
    assert_eq!(
        info.date_founded,
        Utc.with_ymd_and_hms(2010, 11, 4, 13, 11, 0).unwrap()
    );

    let with_ms = esi("").replace("13:11:00Z", "13:11:00.123Z");
    let info: AllianceInfo = serde_json::from_str(&with_ms).unwrap();
    assert_eq!(info.date_founded.timestamp_subsec_millis(), 123);
}
