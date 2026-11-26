//! The SSO refresh request against a mock token endpoint: its shape, and how
//! a revoked grant is told from an outage.

use sso::{RefreshError, SsoClient};
use wiremock::matchers::{basic_auth, body_string_contains, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn client(server: &MockServer) -> SsoClient {
    SsoClient::with_token_url(
        "client-id",
        "client-secret",
        format!("{}/token", server.uri()),
    )
}

#[tokio::test]
async fn posts_the_refresh_grant_with_basic_auth() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .and(basic_auth("client-id", "client-secret"))
        .and(body_string_contains("grant_type=refresh_token"))
        .and(body_string_contains("refresh_token=old-refresh"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "access_token": "new-access",
            "expires_in": 1199,
            "token_type": "Bearer",
            "refresh_token": "new-refresh"
        })))
        .expect(1)
        .mount(&server)
        .await;

    let tokens = client(&server).refresh("old-refresh").await.unwrap();
    assert_eq!(tokens.access_token, "new-access");
    assert_eq!(tokens.expires_in, 1199);
    assert_eq!(tokens.refresh_token.as_deref(), Some("new-refresh"));
}

#[tokio::test]
async fn invalid_grant_is_revoked() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(400).set_body_json(serde_json::json!({"error": "invalid_grant"})),
        )
        .mount(&server)
        .await;

    assert!(matches!(
        client(&server).refresh("dead").await,
        Err(RefreshError::Revoked)
    ));
}

#[tokio::test]
async fn a_5xx_or_another_4xx_is_unavailable() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&server)
        .await;
    assert!(matches!(
        client(&server).refresh("live").await,
        Err(RefreshError::Unavailable(_))
    ));

    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(400)
                .set_body_json(serde_json::json!({"error": "invalid_request"})),
        )
        .mount(&server)
        .await;
    assert!(matches!(
        client(&server).refresh("live").await,
        Err(RefreshError::Unavailable(_))
    ));
}

#[tokio::test]
async fn the_refresh_token_never_appears_in_the_error() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
        .mount(&server)
        .await;

    let error = client(&server).refresh("secret-refresh").await.unwrap_err();
    assert!(!format!("{error} {error:?}").contains("secret-refresh"));
}
