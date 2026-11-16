//! The type list fetch against a mock ESI.

use esi::{EsiClient, RateLimiter};
use queue_types::fetch_type_ids;
use serde_json::json;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn client(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

#[tokio::test]
async fn fetches_every_page_of_the_type_list() {
    let server = MockServer::start().await;
    for (page, body) in [("1", json!([1, 2])), ("2", json!([3]))] {
        Mock::given(method("GET"))
            .and(path("/universe/types/"))
            .and(query_param("page", page))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_json(body)
                    .insert_header("x-pages", "2"),
            )
            .expect(1)
            .mount(&server)
            .await;
    }

    let ids = fetch_type_ids(&client(&server).await).await.unwrap();
    assert_eq!(ids, [1, 2, 3]);
}

#[tokio::test]
async fn server_error_is_an_error() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/universe/types/"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    assert!(fetch_type_ids(&client(&server).await).await.is_err());
}
