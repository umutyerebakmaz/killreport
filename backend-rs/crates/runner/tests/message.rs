//! The queue message every info worker reads.

use runner::EntityQueueMessage;

#[test]
fn reads_the_entity_id_and_ignores_the_other_fields() {
    let body = br#"{"entityId":99000001,"queuedAt":"2026-11-13T22:00:00.000Z","source":"queue-alliances"}"#;
    assert_eq!(
        EntityQueueMessage::parse(body).unwrap(),
        EntityQueueMessage {
            entity_id: 99000001,
            full_sync: false,
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

#[test]
fn parses_what_mq_publishes() {
    let body = mq::EntityMessage::new(98000001, "queue-corporations").to_body();
    assert_eq!(
        EntityQueueMessage::parse(&body).unwrap(),
        EntityQueueMessage {
            entity_id: 98000001,
            full_sync: false,
        }
    );
}

#[test]
fn parses_entity_id_and_killmail_id() {
    let killmail = br#"{"killmailId":133900250,"queuedAt":"2026-11-26T10:00:00.000Z","source":"queue-backfill-values"}"#;
    assert_eq!(
        EntityQueueMessage::parse(killmail).unwrap(),
        EntityQueueMessage {
            entity_id: 133900250,
            full_sync: false,
        }
    );
    assert_eq!(
        EntityQueueMessage::parse(br#"{"entityId":1}"#).unwrap(),
        EntityQueueMessage {
            entity_id: 1,
            full_sync: false,
        }
    );
    assert!(EntityQueueMessage::parse(b"{}").is_err());
}

#[test]
fn parses_what_mq_publishes_for_a_killmail() {
    let body = mq::KillmailMessage::new(133900250, "queue-backfill-values").to_body();
    assert_eq!(
        EntityQueueMessage::parse(&body).unwrap(),
        EntityQueueMessage {
            entity_id: 133900250,
            full_sync: false,
        }
    );
}

#[test]
fn parses_user_id_and_full_sync() {
    let body = br#"{"userId":7,"fullSync":true,"queuedAt":"2026-11-26T10:00:00.000Z"}"#;
    let message = EntityQueueMessage::parse(body).unwrap();
    assert_eq!((message.entity_id, message.full_sync), (7, true));

    let message = EntityQueueMessage::parse(br#"{"userId":7,"queuedAt":"x"}"#).unwrap();
    assert!(!message.full_sync);
}
