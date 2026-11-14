//! The Rust side of the shared limiter contract: every scenario in
//! `backend/src/services/esi-limiter/scenarios.json` runs against a real
//! Redis, with the same expectations the Node spec checks.
//!
//! Skipped (with a note on stderr) when `REDIS_URL` is unset. Each scenario
//! gets a random key prefix and deletes only its own keys, by SCAN, because
//! the local Redis is shared with other data.

use std::time::{SystemTime, UNIX_EPOCH};

use esi::shared::{AcquireOutcome, ObserveInput, Priority, SharedStore, FLOOR, KEY_PREFIX};
use futures_util::FutureExt;
use serde_json::Value;

const SCENARIOS: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../backend/src/services/esi-limiter/scenarios.json"
);

fn redis_url() -> Option<String> {
    let url = std::env::var("REDIS_URL").ok().filter(|u| !u.is_empty());
    if url.is_none() {
        eprintln!("REDIS_URL is not set: skipping the shared limiter tests");
    }
    url
}

fn nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos()
}

fn random_prefix(tag: &str) -> String {
    format!(
        "esi-limiter:test-rs:{tag}:{}:{}:",
        std::process::id(),
        nanos()
    )
}

/// Deletes the keys under `prefix`, and nothing else.
async fn cleanup(url: &str, prefix: &str) {
    let client = redis::Client::open(url).unwrap();
    let mut con = client.get_multiplexed_async_connection().await.unwrap();
    let mut cursor: u64 = 0;
    loop {
        let (next, keys): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(format!("{prefix}*"))
            .arg("COUNT")
            .arg(100)
            .query_async(&mut con)
            .await
            .unwrap();
        if !keys.is_empty() {
            let _: () = redis::cmd("DEL")
                .arg(&keys)
                .query_async(&mut con)
                .await
                .unwrap();
        }
        cursor = next;
        if cursor == 0 {
            break;
        }
    }
}

fn opt_f64(step: &Value, key: &str) -> Option<f64> {
    step.get(key).and_then(Value::as_f64)
}

async fn run_step(store: &SharedStore, step: &Value, ctx: &str) {
    let now = Some(step["now"].as_f64().unwrap());
    let template = step["template"].as_str().unwrap();
    let bucket_key = step["bucketKey"].as_str().unwrap_or("");
    let expect = &step["expect"];

    match step["op"].as_str().unwrap() {
        "acquire" => {
            let priority = match step["priority"].as_str().unwrap_or("live") {
                "bulk" => Priority::Bulk,
                _ => Priority::Live,
            };
            if let Some(repeat) = step["repeat"].as_u64() {
                let mut granted = 0;
                for _ in 0..repeat {
                    let out = store
                        .acquire(priority, template, bucket_key, now)
                        .await
                        .unwrap();
                    if out == AcquireOutcome::Granted {
                        granted += 1;
                    }
                }
                assert_eq!(expect["grantedCount"].as_u64().unwrap(), granted, "{ctx}");
                return;
            }
            let out = store
                .acquire(priority, template, bucket_key, now)
                .await
                .unwrap();
            match out {
                AcquireOutcome::Granted => {
                    assert_eq!(expect["granted"], Value::Bool(true), "{ctx}: granted");
                }
                AcquireOutcome::Wait {
                    wait_ms,
                    reason,
                    detail,
                } => {
                    assert_eq!(expect["granted"], Value::Bool(false), "{ctx}: granted");
                    if let Some(w) = expect.get("waitMs") {
                        assert_eq!(w.as_f64().unwrap(), wait_ms, "{ctx}: waitMs");
                    }
                    if let Some(r) = expect.get("reason") {
                        assert_eq!(r.as_str().unwrap(), reason.as_str(), "{ctx}: reason");
                    }
                    if let Some(d) = expect.get("detail") {
                        assert_eq!(d.as_str().unwrap(), detail, "{ctx}: detail");
                    }
                }
            }
        }
        "observe" => {
            let input = ObserveInput {
                template: template.to_string(),
                bucket_key: bucket_key.to_string(),
                status: step["status"].as_u64().unwrap() as u16,
                group: step["group"].as_str().map(str::to_string),
                limit: opt_f64(step, "limit"),
                window_ms: opt_f64(step, "windowMs"),
                remaining: opt_f64(step, "remaining"),
                error_remain: opt_f64(step, "errorRemain"),
                error_reset_ms: opt_f64(step, "errorResetMs"),
                retry_after_ms: opt_f64(step, "retryAfterMs"),
            };
            let out = store.observe(&input, now).await.unwrap();

            if let Some(e) = expect.get("brake") {
                match (&out.brake, e.is_null()) {
                    (None, true) => {}
                    (Some((ms, status, kind)), false) => {
                        assert_eq!(e["ms"].as_f64().unwrap(), *ms, "{ctx}: brake ms");
                        assert_eq!(e["status"].as_u64().unwrap(), u64::from(*status), "{ctx}");
                        assert_eq!(e["kind"].as_str().unwrap(), kind.to_string(), "{ctx}");
                    }
                    (got, _) => panic!("{ctx}: brake mismatch, got {got:?}, want {e}"),
                }
            }
            if let Some(e) = expect.get("groupPause") {
                match (&out.group_pause, e.is_null()) {
                    (None, true) => {}
                    (Some((key, ms)), false) => {
                        assert_eq!(e["key"].as_str().unwrap(), key, "{ctx}: pause key");
                        assert_eq!(e["ms"].as_f64().unwrap(), *ms, "{ctx}: pause ms");
                    }
                    (got, _) => panic!("{ctx}: groupPause mismatch, got {got:?}, want {e}"),
                }
            }
            if let Some(r) = expect.get("rate") {
                assert_eq!(r.as_f64().unwrap(), out.rate, "{ctx}: rate");
            }
        }
        other => panic!("{ctx}: unknown op {other}"),
    }
}

#[tokio::test]
async fn scenarios_match_the_node_store() {
    let Some(url) = redis_url() else { return };
    let file = std::fs::read_to_string(SCENARIOS).unwrap();
    let doc: Value = serde_json::from_str(&file).unwrap();

    for scenario in doc["scenarios"].as_array().unwrap() {
        let name = scenario["name"].as_str().unwrap();
        let max_rps = scenario["maxRps"].as_u64().unwrap() as u32;
        let prefix = random_prefix("scn");
        // One store per client, each with its own connection.
        let stores: Vec<(&str, SharedStore)> = ["a", "b", "c"]
            .into_iter()
            .map(|c| {
                let store = SharedStore::new(&url, max_rps)
                    .unwrap()
                    .with_prefix(prefix.clone());
                (c, store)
            })
            .collect();

        let run = async {
            for (i, step) in scenario["steps"].as_array().unwrap().iter().enumerate() {
                let client = step["client"].as_str().unwrap();
                let store = &stores.iter().find(|(c, _)| *c == client).unwrap().1;
                run_step(store, step, &format!("{name} / step {i}")).await;
            }
        };
        let outcome = std::panic::AssertUnwindSafe(run).catch_unwind().await;
        cleanup(&url, &prefix).await;
        if let Err(panic) = outcome {
            std::panic::resume_unwind(panic);
        }
    }
}

#[tokio::test]
async fn acquire_without_now_uses_redis_time() {
    let Some(url) = redis_url() else { return };
    let prefix = random_prefix("time");
    let store = SharedStore::new(&url, 50)
        .unwrap()
        .with_prefix(prefix.clone());
    let out = store
        .acquire(Priority::Live, "/status/", "", None)
        .await
        .unwrap();
    cleanup(&url, &prefix).await;
    assert_eq!(out, AcquireOutcome::Granted);
}

#[test]
fn constants_match_the_node_store() {
    assert_eq!(KEY_PREFIX, "esi-limiter:");
    assert_eq!(FLOOR, 5);
}

/// `redis::Script` sends EVALSHA and, on NOSCRIPT, EVAL. Proven here without
/// touching the shared script cache: a body that has never been loaded makes a
/// plain EVALSHA fail with NOSCRIPT, and invoking the same body through
/// `Script` succeeds.
#[tokio::test]
async fn script_falls_back_to_eval_on_noscript() {
    let Some(url) = redis_url() else { return };
    // Small enough for a Lua double to return exactly.
    let n = nanos() % 1_000_000_000;
    let script = redis::Script::new(&format!("return {n}"));

    let client = redis::Client::open(url.as_str()).unwrap();
    let mut con = client.get_multiplexed_async_connection().await.unwrap();

    let err = redis::cmd("EVALSHA")
        .arg(script.get_hash())
        .arg(0)
        .query_async::<i64>(&mut con)
        .await
        .unwrap_err();
    assert_eq!(err.code(), Some("NOSCRIPT"), "{err}");

    let got: i64 = script.invoke_async(&mut con).await.unwrap();
    assert_eq!(got, n as i64);
}
