//! `get_paged` against a local mock server: how it walks `X-Pages`, and that a
//! failing page fails the whole call.

use esi::{EsiClient, EsiError, RateLimiter};
use serde_json::json;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

const LIST: &str = "/universe/types/";

async fn client_for(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

/// Page `n` of the list answers `response`, exactly `times` times.
async fn page(server: &MockServer, n: &str, response: ResponseTemplate, times: u64) {
    Mock::given(method("GET"))
        .and(path(LIST))
        .and(query_param("page", n))
        .respond_with(response)
        .expect(times)
        .mount(server)
        .await;
}

fn ids(body: serde_json::Value, pages: Option<&str>) -> ResponseTemplate {
    let response = ResponseTemplate::new(200).set_body_json(body);
    match pages {
        Some(pages) => response.insert_header("x-pages", pages),
        None => response,
    }
}

#[tokio::test]
async fn reads_every_page_in_order() {
    let server = MockServer::start().await;
    page(&server, "1", ids(json!([1, 2]), Some("3")), 1).await;
    page(&server, "2", ids(json!([3]), Some("3")), 1).await;
    page(&server, "3", ids(json!([4, 5]), Some("3")), 1).await;

    let all: Vec<i32> = client_for(&server).await.get_paged(LIST).await.unwrap();
    assert_eq!(all, [1, 2, 3, 4, 5]);
}

#[tokio::test]
async fn without_x_pages_only_the_first_page_is_read() {
    let server = MockServer::start().await;
    page(&server, "1", ids(json!([7]), None), 1).await;
    page(&server, "2", ids(json!([8]), None), 0).await;

    let all: Vec<i32> = client_for(&server).await.get_paged(LIST).await.unwrap();
    assert_eq!(all, [7]);
}

#[tokio::test]
async fn an_unreadable_x_pages_counts_as_one_page() {
    let server = MockServer::start().await;
    page(&server, "1", ids(json!([7]), Some("abc")), 1).await;
    page(&server, "2", ids(json!([8]), None), 0).await;

    let all: Vec<i32> = client_for(&server).await.get_paged(LIST).await.unwrap();
    assert_eq!(all, [7]);
}

#[tokio::test]
async fn a_failing_later_page_fails_the_whole_call() {
    let server = MockServer::start().await;
    page(&server, "1", ids(json!([1]), Some("2")), 1).await;
    page(&server, "2", ResponseTemplate::new(500), 1).await;

    let error = client_for(&server)
        .await
        .get_paged::<i32>(LIST)
        .await
        .unwrap_err();
    assert!(
        matches!(error, EsiError::Http { status: 500, .. }),
        "{error:?}"
    );
}

#[tokio::test]
async fn a_throttled_later_page_brakes_the_limiter() {
    let server = MockServer::start().await;
    page(&server, "1", ids(json!([1]), Some("2")), 1).await;
    page(
        &server,
        "2",
        ResponseTemplate::new(420).insert_header("x-esi-error-limit-reset", "30"),
        1,
    )
    .await;
    let client = client_for(&server).await;

    let error = client.get_paged::<i32>(LIST).await.unwrap_err();
    assert!(matches!(error, EsiError::Throttled(_)), "{error:?}");
    assert!(client.limiter().stats().paused_until.is_some());
}

#[tokio::test]
async fn a_path_with_a_query_gets_its_page_with_an_ampersand() {
    const ORDERS: &str = "/markets/10000002/orders/";
    let server = MockServer::start().await;
    for (n, body) in [("1", json!([1])), ("2", json!([2]))] {
        Mock::given(method("GET"))
            .and(path(ORDERS))
            .and(query_param("type_id", "34"))
            .and(query_param("page", n))
            .respond_with(ids(body, Some("2")))
            .expect(1)
            .mount(&server)
            .await;
    }

    let all: Vec<i32> = client_for(&server)
        .await
        .get_paged(&format!("{ORDERS}?type_id=34"))
        .await
        .unwrap();
    assert_eq!(all, [1, 2]);
}
