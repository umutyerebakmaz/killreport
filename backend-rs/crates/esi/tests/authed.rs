//! `get_page_authed` against a local mock server: one page of an
//! authenticated list, its `X-Pages`, and the statuses the killmail syncs
//! settle themselves.

use esi::{EsiClient, EsiError, RateLimiter};
use serde_json::json;
use wiremock::matchers::{header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

const LIST: &str = "/characters/95465499/killmails/recent/";

async fn client_for(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

#[tokio::test]
async fn sends_the_token_and_the_page_and_reads_x_pages() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(LIST))
        .and(query_param("page", "2"))
        .and(header("authorization", "Bearer secret-token"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!([1, 2]))
                .insert_header("x-pages", "3"),
        )
        .expect(1)
        .mount(&server)
        .await;

    let page = client_for(&server)
        .await
        .get_page_authed::<i32>(LIST, 2, "secret-token", "95465499")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(page.items, [1, 2]);
    assert_eq!(page.pages, Some(3));
}

#[tokio::test]
async fn a_missing_x_pages_is_none() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(LIST))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([1])))
        .mount(&server)
        .await;

    let page = client_for(&server)
        .await
        .get_page_authed::<i32>(LIST, 1, "t", "95465499")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(page.pages, None);
}

#[tokio::test]
async fn a_404_is_no_page() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(LIST))
        .respond_with(ResponseTemplate::new(404))
        .mount(&server)
        .await;

    let page = client_for(&server)
        .await
        .get_page_authed::<i32>(LIST, 1, "t", "95465499")
        .await
        .unwrap();
    assert!(page.is_none());
}

#[tokio::test]
async fn a_403_is_an_http_error_without_the_token_in_it() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(LIST))
        .respond_with(ResponseTemplate::new(403))
        .mount(&server)
        .await;

    let error = client_for(&server)
        .await
        .get_page_authed::<i32>(LIST, 1, "secret-token", "95465499")
        .await
        .unwrap_err();
    assert!(matches!(error, EsiError::Http { status: 403, .. }));
    assert!(!format!("{error:?} {error}").contains("secret-token"));
}
