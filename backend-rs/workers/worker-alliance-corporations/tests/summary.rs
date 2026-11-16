//! The fan-out summary line, from totals built by driving `process_one`.

use esi::{EsiClient, RateLimiter};
use futures_util::future::BoxFuture;
use lapin::types::FieldTable;
use mq::{EntityMessage, Settle};
use runner::{process_one, Context, Publisher, Totals, Worker};
use serde_json::json;
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_alliance_corporations::AllianceCorporationWorker;

struct Delivery(Vec<u8>);

impl Settle for Delivery {
    fn headers(&self) -> Option<&FieldTable> {
        None
    }
    fn body(&self) -> &[u8] {
        &self.0
    }
    async fn ack(&self) -> Result<(), lapin::Error> {
        Ok(())
    }
    async fn nack(&self, _requeue: bool) -> Result<(), lapin::Error> {
        Ok(())
    }
    async fn park(&self) -> Result<(), lapin::Error> {
        Ok(())
    }
}

struct Sink;

impl Publisher for Sink {
    fn publish<'a>(
        &'a self,
        _queue: &'a str,
        messages: &'a [EntityMessage],
        _priority: Option<u8>,
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move { Ok(messages.len() as u64) })
    }
}

async fn corps(server: &MockServer, id: i32, response: ResponseTemplate) {
    Mock::given(method("GET"))
        .and(path(format!("/alliances/{id}/corporations")))
        .respond_with(response)
        .mount(server)
        .await;
}

#[sqlx::test(migrations = false, fixtures("alliances"))]
async fn the_summary_counts_alliances_corporations_and_errors(pool: PgPool) {
    let server = MockServer::start().await;
    corps(
        &server,
        1,
        ResponseTemplate::new(200).set_body_json(json!([10, 11, 12, 13])),
    )
    .await;
    corps(
        &server,
        2,
        ResponseTemplate::new(200).set_body_json(json!([20, 21, 22])),
    )
    .await;
    corps(&server, 3, ResponseTemplate::new(404)).await;

    let worker = AllianceCorporationWorker {
        pool,
        esi: EsiClient::with_base_url(RateLimiter::new(50), server.uri()),
    };
    let totals = Totals::new();
    let sink = Sink;
    for id in 1..=3 {
        let delivery = Delivery(format!(r#"{{"entityId":{id}}}"#).into_bytes());
        process_one(&worker, &delivery, &totals, &Context::new(&sink)).await;
    }

    assert_eq!(
        AllianceCorporationWorker::summary(&totals),
        "📊 final: 3 alliances processed, 7 corporations queued, 1 errors"
    );
}
