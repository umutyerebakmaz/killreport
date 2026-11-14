//! The queue message every info worker reads.

use runner::EntityQueueMessage;

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
