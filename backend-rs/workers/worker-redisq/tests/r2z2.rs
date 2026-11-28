//! The R2Z2 client against a mock server: `sequence.json`, and what each
//! answer to `/{sequence}.json` becomes.

use serde_json::json;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_redisq::r2z2::{Poll, R2z2};

const SEQ: i64 = 96_123_456;

fn esi_copy(attackers: serde_json::Value) -> serde_json::Value {
    json!({
        "killmail_id": 133900250,
        "killmail_time": "2026-11-27T12:00:00Z",
        "solar_system_id": 30000142,
        "victim": {
            "corporation_id": 98000002,
            "damage_taken": 200,
            "ship_type_id": 587
        },
        "attackers": attackers
    })
}

fn attacker() -> serde_json::Value {
    json!([{
        "corporation_id": 98000001,
        "damage_done": 200,
        "final_blow": true,
        "security_status": 0.5
    }])
}

async fn serve(server: &MockServer, response: ResponseTemplate) {
    Mock::given(method("GET"))
        .and(path(format!("/{SEQ}.json")))
        .respond_with(response)
        .mount(server)
        .await;
}

async fn poll(response: ResponseTemplate) -> anyhow::Result<Poll> {
    let server = MockServer::start().await;
    serve(&server, response).await;
    R2z2::new(&server.uri()).get(SEQ).await
}

#[tokio::test]
async fn head_reads_sequence_json() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/sequence.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "sequence": SEQ })))
        .mount(&server)
        .await;
    assert_eq!(R2z2::new(&server.uri()).head().await.unwrap(), SEQ);
}

#[tokio::test]
async fn a_200_with_a_usable_esi_copy_is_found() {
    let body = json!({
        "killmail_id": 133900250,
        "hash": "top",
        "zkb": { "hash": "8a1b2c", "totalValue": 1.0 },
        "esi": esi_copy(attacker())
    });
    let Poll::Found(pkg) = poll(ResponseTemplate::new(200).set_body_json(body))
        .await
        .unwrap()
    else {
        panic!("not found");
    };
    assert_eq!(pkg.killmail_id, 133900250);
    assert_eq!(pkg.hash, "8a1b2c");
    assert_eq!(pkg.esi.unwrap().attackers.len(), 1);
}

#[tokio::test]
async fn a_200_without_attackers_is_found_without_esi() {
    let body = json!({
        "killmail_id": 133900250,
        "zkb": { "hash": "8a1b2c" },
        "esi": esi_copy(json!([]))
    });
    let Poll::Found(pkg) = poll(ResponseTemplate::new(200).set_body_json(body))
        .await
        .unwrap()
    else {
        panic!("not found");
    };
    assert!(pkg.esi.is_none());
}

#[tokio::test]
async fn a_body_with_an_id_and_hash_but_no_killmail_shape_is_found_without_esi() {
    let body = json!({
        "killmail_id": 133900250,
        "zkb": { "hash": "8a1b2c" },
        "esi": { "killmail_id": 133900250 }
    });
    let Poll::Found(pkg) = poll(ResponseTemplate::new(200).set_body_json(body))
        .await
        .unwrap()
    else {
        panic!("not found");
    };
    assert_eq!((pkg.killmail_id, pkg.hash.as_str()), (133900250, "8a1b2c"));
    assert!(pkg.esi.is_none());
}

#[tokio::test]
async fn the_hash_falls_back_to_the_top_level_hash() {
    let body = json!({ "killmail_id": 133900250, "hash": "top", "zkb": {} });
    let Poll::Found(pkg) = poll(ResponseTemplate::new(200).set_body_json(body))
        .await
        .unwrap()
    else {
        panic!("not found");
    };
    assert_eq!(pkg.hash, "top");
}

#[tokio::test]
async fn a_body_without_a_hash_is_unreadable() {
    let body = json!({ "killmail_id": 133900250, "zkb": {} });
    assert!(matches!(
        poll(ResponseTemplate::new(200).set_body_json(body))
            .await
            .unwrap(),
        Poll::Unreadable(_)
    ));
}

#[tokio::test]
async fn a_non_json_body_is_unreadable() {
    assert!(matches!(
        poll(ResponseTemplate::new(200).set_body_string("<html>"))
            .await
            .unwrap(),
        Poll::Unreadable(_)
    ));
}

#[tokio::test]
async fn not_found_is_not_found() {
    assert!(matches!(
        poll(ResponseTemplate::new(404)).await.unwrap(),
        Poll::NotFound
    ));
}

#[tokio::test]
async fn forbidden_and_too_many_requests_are_rate_limited() {
    for status in [403, 429] {
        assert!(matches!(
            poll(ResponseTemplate::new(status)).await.unwrap(),
            Poll::RateLimited
        ));
    }
}

#[tokio::test]
async fn a_server_error_is_an_error() {
    assert!(poll(ResponseTemplate::new(500)).await.is_err());
}

#[tokio::test]
async fn requests_carry_the_user_agent() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(format!("/{SEQ}.json")))
        .and(header("user-agent", worker_redisq::r2z2::USER_AGENT))
        .respond_with(ResponseTemplate::new(404))
        .expect(1)
        .mount(&server)
        .await;
    R2z2::new(&server.uri()).get(SEQ).await.unwrap();
}
