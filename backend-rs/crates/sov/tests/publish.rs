//! `AlertPublisher` without a Redis to talk to.

use sov::{AlertPublisher, SovereigntyAlert};

fn alert() -> SovereigntyAlert {
    SovereigntyAlert {
        r#type: "campaign_started".into(),
        message: "New sovereignty campaign in #31".into(),
        solar_system_id: 31,
        solar_system_name: None,
        region_name: None,
        alliance_id: None,
        alliance_name: None,
        alliance_ticker: None,
        outcome: None,
        change_type: None,
        timestamp: "2026-11-20T12:00:00.000Z".into(),
    }
}

#[tokio::test]
async fn disabled_publisher_is_a_no_op() {
    let publisher = AlertPublisher::new(None);
    assert!(!publisher.is_enabled());
    publisher.publish(&alert()).await.unwrap();
}

#[tokio::test]
async fn publish_to_an_unreachable_redis_errors() {
    let publisher = AlertPublisher::new(Some("redis://127.0.0.1:1".into()));
    assert!(publisher.is_enabled());
    assert!(publisher.publish(&alert()).await.is_err());
}
