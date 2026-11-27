//! The publisher's two cases that need no Redis: off, and a server that is
//! not there.

use pubsub::RedisPubSub;
use serde_json::json;

#[tokio::test]
async fn disabled_is_a_no_op() {
    let pubsub = RedisPubSub::new(None);
    assert!(!pubsub.is_enabled());
    pubsub
        .publish("NEW_KILLMAIL", &json!({ "killmailId": 1 }))
        .await
        .unwrap();
}

#[tokio::test]
async fn unreachable_redis_errors() {
    let pubsub = RedisPubSub::new(Some("redis://127.0.0.1:1".into()));
    assert!(pubsub.is_enabled());
    assert!(pubsub
        .publish("NEW_KILLMAIL", &json!({ "killmailId": 1 }))
        .await
        .is_err());
}
