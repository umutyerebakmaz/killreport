//! The alliance list fetch against a mock ESI.

use esi::{EsiClient, RateLimiter};
use queue_alliances::fetch_alliance_ids;
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn client(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

#[tokio::test]
async fn fetches_the_alliance_list() {
    let server = MockServer::start().await;
    // Exactly `/alliances`, no trailing slash (`alliance.service.ts:12`).
    Mock::given(method("GET"))
        .and(path("/alliances"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([99000001, 99000002])))
        .expect(1)
        .mount(&server)
        .await;

    let ids = fetch_alliance_ids(&client(&server).await).await.unwrap();
    assert_eq!(ids, [99000001, 99000002]);
}

#[tokio::test]
async fn server_error_is_an_error() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/alliances"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    assert!(fetch_alliance_ids(&client(&server).await).await.is_err());
}
