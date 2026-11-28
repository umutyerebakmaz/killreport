//! What the worker-redisq tests share: a recording outbox in place of
//! RabbitMQ, an ESI client against a mock server, and a killmail.

#![allow(dead_code)]

use std::sync::Mutex;

use anyhow::anyhow;
use esi::{EsiClient, RateLimiter};
use futures_util::future::BoxFuture;
use serde_json::json;
use sqlx::PgPool;
use wiremock::matchers::{method, path, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_redisq::outbox::Outbox;

pub const ID: i32 = 133900250;
pub const HASH: &str = "8a1b2c";

/// Records every publish, or refuses them all when `fail` is set.
#[derive(Default)]
pub struct Recorder {
    pub fail: bool,
    pub calls: Mutex<Vec<(String, Vec<i32>)>>,
}

impl Recorder {
    pub fn failing() -> Self {
        Self {
            fail: true,
            ..Self::default()
        }
    }

    pub fn calls(&self) -> Vec<(String, Vec<i32>)> {
        self.calls.lock().unwrap().clone()
    }

    fn record<'a>(&'a self, queue: &'a str, ids: &'a [i32]) -> BoxFuture<'a, anyhow::Result<u64>> {
        Box::pin(async move {
            if self.fail {
                return Err(anyhow!("nack"));
            }
            self.calls
                .lock()
                .unwrap()
                .push((queue.to_owned(), ids.to_vec()));
            Ok(ids.len() as u64)
        })
    }
}

impl Outbox for Recorder {
    fn publish_killmails<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        self.record(queue, ids)
    }

    fn publish_entities<'a>(
        &'a self,
        queue: &'a str,
        ids: &'a [i32],
    ) -> BoxFuture<'a, anyhow::Result<u64>> {
        self.record(queue, ids)
    }
}

pub fn esi(server: &MockServer) -> EsiClient {
    EsiClient::with_base_url(RateLimiter::new(50), server.uri())
}

pub fn noon() -> chrono::NaiveDateTime {
    chrono::NaiveDate::from_ymd_opt(2026, 11, 28)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap()
}

/// A killmail naming a character, corporation and alliance on each side, a
/// weapon and one item.
pub fn detail_json() -> serde_json::Value {
    json!({
        "killmail_id": ID,
        "killmail_time": "2026-11-27T12:00:00Z",
        "solar_system_id": 30000142,
        "victim": {
            "character_id": 2001,
            "corporation_id": 98000002,
            "alliance_id": 99000002,
            "damage_taken": 200,
            "ship_type_id": 587,
            "items": [{ "item_type_id": 2048, "flag": 5, "quantity_destroyed": 1, "singleton": 0 }]
        },
        "attackers": [{
            "character_id": 1001,
            "corporation_id": 98000001,
            "alliance_id": 99000001,
            "damage_done": 200,
            "final_blow": true,
            "security_status": 0.5,
            "ship_type_id": 588,
            "weapon_type_id": 2488
        }]
    })
}

pub fn detail() -> killmail_writer::KillmailDetail {
    serde_json::from_value(detail_json()).unwrap()
}

pub async fn count(pool: &PgPool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT count(*) FROM {table}"))
        .fetch_one(pool)
        .await
        .unwrap()
}

fn character(name: &str) -> serde_json::Value {
    json!({ "name": name, "corporation_id": 98000001, "birthday": "2010-01-01T00:00:00Z",
            "bloodline_id": 1, "race_id": 1, "gender": "male" })
}

fn corporation(name: &str) -> serde_json::Value {
    json!({ "name": name, "ticker": "T", "member_count": 1, "ceo_id": 1001,
            "creator_id": 1001, "tax_rate": 0.1 })
}

fn alliance(name: &str) -> serde_json::Value {
    json!({ "name": name, "ticker": "A", "date_founded": "2010-01-01T00:00:00Z",
            "creator_corporation_id": 98000001, "creator_id": 1001 })
}

/// Answers every ESI route the killmail of [`detail_json`] names.
pub async fn mount_entities(server: &MockServer) {
    for (route, body) in [
        ("/characters/1001/", character("Attacker")),
        ("/characters/2001/", character("Victim")),
        ("/corporations/98000001/", corporation("Attacker Corp")),
        ("/corporations/98000002/", corporation("Victim Corp")),
        ("/alliances/99000001", alliance("Attacker Alliance")),
        ("/alliances/99000002", alliance("Victim Alliance")),
    ] {
        Mock::given(method("GET"))
            .and(path(route))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(server)
            .await;
    }
    Mock::given(method("GET"))
        .and(path_regex(r"^/universe/types/\d+/$"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "name": "Type", "group_id": 25, "published": true })),
        )
        .mount(server)
        .await;
}
