//! The message the info queue publishers send, byte for byte what the Node
//! publishers send (`backend/src/queues/queue-alliances.ts:31-35`).

use chrono::{Duration, TimeZone, Utc};
use mq::EntityMessage;

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
