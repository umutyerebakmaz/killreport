//! The message the info queue publishers send, byte for byte what the Node
//! publishers send (`backend/src/queues/queue-alliances.ts:31-35`).

use chrono::{Duration, TimeZone, Utc};
use lapin::types::FieldTable;
use mq::{message_properties, EntityMessage};

#[test]
fn body_matches_the_node_publisher() {
    let now = Utc.with_ymd_and_hms(2026, 11, 15, 10, 0, 0).unwrap() + Duration::milliseconds(7);
    let body = EntityMessage::at(99000001, "queue-alliances", now).to_body();
    assert_eq!(
        std::str::from_utf8(&body).unwrap(),
        r#"{"entityId":99000001,"queuedAt":"2026-11-15T10:00:00.007Z","source":"queue-alliances"}"#
    );
}

#[test]
fn whole_seconds_keep_three_digits() {
    let now = Utc.with_ymd_and_hms(2026, 11, 15, 10, 0, 0).unwrap();
    let message = EntityMessage::at(1, "queue-corporations", now);
    assert_eq!(message.queued_at, "2026-11-15T10:00:00.000Z");
}

#[test]
fn a_runtime_source_serializes_like_a_static_one() {
    let now = Utc.with_ymd_and_hms(2026, 11, 16, 10, 0, 0).unwrap();
    let body = EntityMessage::at(98000001, format!("alliance_{}", 99000001), now).to_body();
    assert_eq!(
        String::from_utf8(body).unwrap(),
        r#"{"entityId":98000001,"queuedAt":"2026-11-16T10:00:00.000Z","source":"alliance_99000001"}"#
    );
}

#[test]
fn priority_is_set_only_when_given() {
    assert_eq!(*message_properties(Some(3)).priority(), Some(3));
    assert_eq!(*message_properties(None).priority(), None);
    assert_eq!(*message_properties(None).delivery_mode(), Some(2));
    assert_eq!(
        *message_properties(None).headers(),
        Some(FieldTable::default())
    );
}

#[test]
fn killmail_message_body_matches_node() {
    let now = Utc.with_ymd_and_hms(2026, 11, 26, 10, 0, 0).unwrap();
    let body = mq::KillmailMessage::at(133900250, "queue-backfill-values", now).to_body();
    assert_eq!(
        std::str::from_utf8(&body).unwrap(),
        r#"{"killmailId":133900250,"queuedAt":"2026-11-26T10:00:00.000Z","source":"queue-backfill-values"}"#
    );
}
