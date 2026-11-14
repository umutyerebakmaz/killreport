//! Publishing entity IDs against a real RabbitMQ.
//!
//! Ignored by default. Needs a broker in `RABBITMQ_URL`:
//!
//! ```text
//! RABBITMQ_URL=amqp://guest:guest@localhost:5672 cargo test -p mq --test publish -- --ignored
//! ```

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use lapin::options::{BasicAckOptions, BasicGetOptions, QueueDeleteOptions};
use lapin::types::FieldTable;
use lapin::Channel;
use mq::{connect, declare_worker_queue, publish_entities};

fn url() -> String {
    std::env::var("RABBITMQ_URL").expect("RABBITMQ_URL is not set")
}

fn queue_name(test: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("esi_publish_test_{test}_{nanos}")
}

async fn delete(channel: &Channel, queue: &str) {
    let _ = channel
        .queue_delete(queue, QueueDeleteOptions::default())
        .await;
}

/// Everything in the queue, acked, as `(body, delivery mode, priority, headers)`.
async fn drain(
    channel: &Channel,
    queue: &str,
) -> Vec<(
    serde_json::Value,
    Option<u8>,
    Option<u8>,
    Option<FieldTable>,
)> {
    let mut out = Vec::new();
    while let Some(message) = channel
        .basic_get(queue, BasicGetOptions::default())
        .await
        .unwrap()
    {
        let delivery = message.delivery;
        out.push((
            serde_json::from_slice(&delivery.data).unwrap(),
            *delivery.properties.delivery_mode(),
            *delivery.properties.priority(),
            delivery.properties.headers().clone(),
        ));
        delivery
            .acker
            .ack(BasicAckOptions::default())
            .await
            .unwrap();
    }
    out
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL"]
async fn publishes_every_id_persistently() {
    let (connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("every");
    declare_worker_queue(&channel, &queue).await.unwrap();

    let confirmed = publish_entities(&channel, &queue, "queue-test", &[1, 2, 3], |_, _, _| {})
        .await
        .unwrap();
    assert_eq!(confirmed, 3);

    let messages = drain(&channel, &queue).await;
    let ids: Vec<i64> = messages
        .iter()
        .map(|(body, _, _, _)| body["entityId"].as_i64().unwrap())
        .collect();
    assert_eq!(ids, [1, 2, 3]);
    for (body, mode, priority, headers) in &messages {
        assert_eq!(body["source"], "queue-test");
        assert_eq!(*mode, Some(2));
        assert_eq!(*priority, None);
        // amqplib always sends a headers table, empty when none are given.
        assert_eq!(*headers, Some(FieldTable::default()));
    }

    delete(&channel, &queue).await;
    let _ = connection.close(200, "test done").await;
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL"]
async fn publishes_nothing_for_no_ids() {
    let (connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("none");
    declare_worker_queue(&channel, &queue).await.unwrap();

    let batches = Mutex::new(0);
    let confirmed = publish_entities(&channel, &queue, "queue-test", &[], |_, _, _| {
        *batches.lock().unwrap() += 1;
    })
    .await
    .unwrap();
    assert_eq!(confirmed, 0);
    assert_eq!(*batches.lock().unwrap(), 0);
    assert!(drain(&channel, &queue).await.is_empty());

    delete(&channel, &queue).await;
    let _ = connection.close(200, "test done").await;
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL"]
async fn reports_batches_of_100() {
    let (connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("batches");
    declare_worker_queue(&channel, &queue).await.unwrap();

    let ids: Vec<i32> = (1..=250).collect();
    let batches = Mutex::new(Vec::new());
    let confirmed = publish_entities(&channel, &queue, "queue-test", &ids, |n, total, len| {
        batches.lock().unwrap().push((n, total, len));
    })
    .await
    .unwrap();
    assert_eq!(confirmed, 250);
    assert_eq!(
        *batches.lock().unwrap(),
        [(1, 3, 100), (2, 3, 100), (3, 3, 50)]
    );
    assert_eq!(drain(&channel, &queue).await.len(), 250);

    delete(&channel, &queue).await;
    let _ = connection.close(200, "test done").await;
}
