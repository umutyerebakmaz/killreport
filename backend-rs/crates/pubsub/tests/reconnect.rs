//! Against a real Redis (`REDIS_URL`, or the default): a publisher whose
//! connection dies publishes again on the next call. Ignored by default; run
//! with `cargo test -p pubsub -- --ignored`.
//!
//! The client cannot name its connection, so the test kills every client
//! whose last command was `PUBLISH` (other than its own). On a dev machine
//! that may include a running Node worker's connection; ioredis reconnects.

use pubsub::RedisPubSub;
use serde_json::json;

fn url() -> String {
    std::env::var("REDIS_URL").unwrap_or_else(|_| esi::DEFAULT_REDIS_URL.to_owned())
}

async fn kill_publishers() -> usize {
    let client = redis::Client::open(url()).unwrap();
    let mut con = client.get_multiplexed_async_connection().await.unwrap();
    let own: i64 = redis::cmd("CLIENT")
        .arg("ID")
        .query_async(&mut con)
        .await
        .unwrap();
    let list: String = redis::cmd("CLIENT")
        .arg("LIST")
        .query_async(&mut con)
        .await
        .unwrap();
    let mut killed = 0;
    for line in list.lines().filter(|l| l.contains(" cmd=publish")) {
        let id: i64 = line
            .split(' ')
            .find_map(|f| f.strip_prefix("id="))
            .unwrap()
            .parse()
            .unwrap();
        if id != own {
            let _: i64 = redis::cmd("CLIENT")
                .arg("KILL")
                .arg("ID")
                .arg(id)
                .query_async(&mut con)
                .await
                .unwrap();
            killed += 1;
        }
    }
    killed
}

#[tokio::test]
#[ignore = "needs a real Redis"]
async fn publishes_again_after_the_connection_is_killed() {
    let pubsub = RedisPubSub::new(Some(url()));
    pubsub
        .publish("KILLREPORT_TEST", &json!({ "n": 1 }))
        .await
        .unwrap();
    assert!(
        kill_publishers().await >= 1,
        "the publisher's connection was not found"
    );

    // The first call after a kill may still meet the dead socket; a
    // reconnecting publisher answers within a few tries.
    let mut last = Err(anyhow::anyhow!("never tried"));
    for _ in 0..3 {
        last = pubsub.publish("KILLREPORT_TEST", &json!({ "n": 2 })).await;
        if last.is_ok() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    last.unwrap();
}
