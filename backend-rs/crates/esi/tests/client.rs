//! The client against a local mock server: what it sends, how each answer
//! comes back and what it tells the limiter.

use esi::{EsiClient, EsiError, RateLimiter, ThrottleKind};
use serde::Deserialize;
use wiremock::matchers::{header, header_regex, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[derive(Debug, Deserialize, PartialEq)]
struct Alliance {
    name: String,
    ticker: String,
}

async fn client_for(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

#[tokio::test]
async fn decodes_a_200() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/alliances/99000001"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!({ "name": "Test Alliance", "ticker": "TEST" })),
        )
        .mount(&server)
        .await;

    let alliance: Alliance = client_for(&server)
        .await
        .get("/alliances/99000001")
        .await
        .unwrap();
    assert_eq!(
        alliance,
        Alliance {
            name: "Test Alliance".into(),
            ticker: "TEST".into()
        }
    );
}

#[tokio::test]
async fn sends_the_user_agent_and_the_compatibility_date() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(header(
            "user-agent",
            format!(
                "KillReport-rs/{} (+https://github.com/umutyerebakmaz/killreport)",
                env!("CARGO_PKG_VERSION")
            )
            .as_str(),
        ))
        .and(header("x-compatibility-date", "2020-01-01"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({})))
        .expect(1)
        .mount(&server)
        .await;

    let _: serde_json::Value = client_for(&server).await.get("/status").await.unwrap();
}

#[tokio::test]
async fn a_404_is_an_http_error_with_its_status() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&server)
        .await;

    let error = client_for(&server)
        .await
        .get::<serde_json::Value>("/alliances/1")
        .await
        .unwrap_err();
    assert!(
        matches!(&error, EsiError::Http { status: 404, path } if path == "/alliances/1"),
        "{error:?}"
    );
    assert_eq!(error.status(), Some(404));
}

#[tokio::test]
async fn a_420_is_throttled_and_brakes_the_limiter() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(420).insert_header("x-esi-error-limit-reset", "30"))
        .mount(&server)
        .await;
    let client = client_for(&server).await;

    let error = client
        .get::<serde_json::Value>("/alliances/1")
        .await
        .unwrap_err();
    match error {
        EsiError::Throttled(throttled) => {
            assert_eq!(
                (throttled.status, throttled.kind),
                (420, ThrottleKind::ErrorLimit)
            );
        }
        other => panic!("expected a throttle, got {other:?}"),
    }
    assert!(client.limiter().stats().paused_until.is_some());
}

#[tokio::test]
async fn a_grouped_429_is_a_rate_limit_and_does_not_brake_the_process() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(
            ResponseTemplate::new(429)
                .insert_header("x-ratelimit-group", "alliance")
                .insert_header("retry-after", "30"),
        )
        .mount(&server)
        .await;
    let client = client_for(&server).await;

    let error = client
        .get::<serde_json::Value>("/alliances/1")
        .await
        .unwrap_err();
    assert!(
        matches!(&error, EsiError::Throttled(t) if (t.status, t.kind) == (429, ThrottleKind::RateLimit)),
        "{error:?}"
    );
    assert_eq!(client.limiter().stats().paused_until, None);
}

#[tokio::test]
async fn a_header_less_429_is_the_deep_limit() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(429))
        .mount(&server)
        .await;

    let error = client_for(&server)
        .await
        .get::<serde_json::Value>("/alliances/1")
        .await
        .unwrap_err();
    assert!(
        matches!(&error, EsiError::Throttled(t) if (t.status, t.kind) == (429, ThrottleKind::DeepLimit)),
        "{error:?}"
    );
}

#[tokio::test]
async fn a_low_error_budget_on_a_200_brakes_the_limiter() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(
            ResponseTemplate::new(200)
                .insert_header("x-esi-error-limit-remain", "5")
                .insert_header("x-esi-error-limit-reset", "30")
                .set_body_json(serde_json::json!({})),
        )
        .mount(&server)
        .await;
    let client = client_for(&server).await;

    let _: serde_json::Value = client.get("/status").await.unwrap();
    assert!(client.limiter().stats().paused_until.is_some());
}

#[tokio::test]
async fn a_body_of_the_wrong_shape_is_a_decode_error() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_string("not json"))
        .mount(&server)
        .await;

    let error = client_for(&server)
        .await
        .get::<Alliance>("/alliances/1")
        .await
        .unwrap_err();
    assert!(matches!(error, EsiError::Decode { .. }), "{error:?}");
    assert_eq!(error.status(), None);
}

#[tokio::test]
async fn no_answer_is_a_transport_error_and_gives_the_slot_back() {
    // Nothing listens on port 9 (discard) on a test machine.
    let client = EsiClient::with_base_url(RateLimiter::new(50), "http://127.0.0.1:9");

    let error = client
        .get::<serde_json::Value>("/status")
        .await
        .unwrap_err();
    assert!(matches!(error, EsiError::Transport { .. }), "{error:?}");
    // Every slot was given back: 50 more acquires all go through.
    for _ in 0..50 {
        drop(
            tokio::time::timeout(
                std::time::Duration::from_secs(2),
                client
                    .limiter()
                    .acquire(&esi::EsiRoute::new("/status"), None),
            )
            .await
            .expect("a slot is free")
            .unwrap(),
        );
    }
}

#[tokio::test]
async fn an_error_message_carries_no_header() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(header_regex("user-agent", "KillReport-rs"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    let error = client_for(&server)
        .await
        .get::<serde_json::Value>("/alliances/1")
        .await
        .unwrap_err();
    let text = format!("{error} {error:?}");
    assert!(!text.contains("KillReport-rs"), "{text}");
    assert!(
        !text.to_ascii_lowercase().contains("authorization"),
        "{text}"
    );
}
