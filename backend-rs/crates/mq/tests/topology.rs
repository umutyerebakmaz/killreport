//! Against a real RabbitMQ: the declarations agree with what is already
//! there, and the retry and parking paths work end to end.
//!
//! Ignored by default. Needs a broker in `RABBITMQ_URL` with the
//! `killreport-dlx` policy applied (`backend/docs/ops/rabbitmq.md`):
//!
//! ```text
//! RABBITMQ_URL=amqp://guest:guest@localhost:5672 cargo test -p mq --test topology -- --ignored
//! ```

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::anyhow;
use futures_util::StreamExt;
use lapin::options::{
    BasicConsumeOptions, BasicGetOptions, BasicPublishOptions, QueueDeleteOptions,
};
use lapin::types::{AMQPValue, FieldArray, FieldTable, LongString, ShortString};
use lapin::{BasicProperties, Channel};
use mq::{
    connect, death_count, declare_worker_queue, handle_worker_error, retry_topology, LapinDelivery,
    WorkerLog, MAX_ATTEMPTS,
};

struct Quiet;
impl WorkerLog for Quiet {
    fn warn(&self, _: &str) {}
    fn error(&self, _: &str, _: &anyhow::Error) {}
}

fn url() -> String {
    std::env::var("RABBITMQ_URL").expect("RABBITMQ_URL is not set")
}

/// A fresh `esi_` queue, so the `killreport-dlx` policy applies to it.
fn queue_name(test: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("esi_spike_test_{test}_{nanos}")
}

async fn publish(channel: &Channel, queue: &str, body: &[u8], headers: FieldTable) {
    channel
        .basic_publish(
            "",
            queue,
            BasicPublishOptions::default(),
            body,
            BasicProperties::default()
                .with_delivery_mode(2)
                .with_headers(headers),
        )
        .await
        .unwrap()
        .await
        .unwrap();
}

async fn delete(channel: &Channel, queue: &str) {
    let _ = channel
        .queue_delete(queue, QueueDeleteOptions::default())
        .await;
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL"]
async fn declaring_the_same_queue_again_is_accepted() {
    let (_connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("redeclare");

    declare_worker_queue(&channel, &queue).await.unwrap();
    // A second declaration with any differing argument would be a 406 that
    // closes the channel.
    declare_worker_queue(&channel, &queue).await.unwrap();

    delete(&channel, &queue).await;
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL"]
async fn agrees_with_the_queue_the_node_workers_declared() {
    let (_connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("node_shape");

    // What amqplib 0.10 sends for `{ durable: true, arguments:
    // { 'x-max-priority': 10 } }`: the number as a signed byte.
    let mut node_args = FieldTable::default();
    node_args.insert(
        ShortString::from("x-max-priority"),
        AMQPValue::ShortShortInt(10),
    );
    channel
        .queue_declare(
            &queue,
            lapin::options::QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            node_args,
        )
        .await
        .unwrap();

    declare_worker_queue(&channel, &queue).await.unwrap();

    delete(&channel, &queue).await;
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL and takes about 30 s"]
async fn a_failed_message_comes_back_through_the_wait_queue_with_x_death() {
    let (_connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("retry");
    declare_worker_queue(&channel, &queue).await.unwrap();
    publish(&channel, &queue, b"{\"entityId\":1}", FieldTable::default()).await;

    let mut consumer = channel
        .basic_consume(
            &queue,
            "spike-test",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await
        .unwrap();

    let first = consumer.next().await.unwrap().unwrap();
    assert_eq!(death_count(first.properties.headers().as_ref()), 0);
    let settle = LapinDelivery {
        channel: &channel,
        delivery: &first,
    };
    handle_worker_error(&settle, &queue, &anyhow!("ESI 500"), &Quiet)
        .await
        .unwrap();

    // dlx → wait (30 s TTL) → retry → back here.
    let again = tokio::time::timeout(Duration::from_secs(45), consumer.next())
        .await
        .expect("the message did not come back within 45 s")
        .unwrap()
        .unwrap();
    assert_eq!(again.data, b"{\"entityId\":1}");
    assert_eq!(death_count(again.properties.headers().as_ref()), 1);

    again
        .acker
        .ack(lapin::options::BasicAckOptions::default())
        .await
        .unwrap();
    delete(&channel, &queue).await;
}

#[tokio::test]
#[ignore = "needs RabbitMQ in RABBITMQ_URL"]
async fn the_last_attempt_parks_the_message_with_its_headers() {
    let (_connection, channel) = connect(&url()).await.unwrap();
    let queue = queue_name("park");
    declare_worker_queue(&channel, &queue).await.unwrap();

    // A delivery that has already been dead-lettered MAX_ATTEMPTS - 1 times.
    let mut death = FieldTable::default();
    death.insert(
        ShortString::from("count"),
        AMQPValue::LongLongInt(i64::from(MAX_ATTEMPTS) - 1),
    );
    death.insert(
        ShortString::from("queue"),
        AMQPValue::LongString(LongString::from(queue.as_str())),
    );
    let mut headers = FieldTable::default();
    headers.insert(
        ShortString::from("x-death"),
        AMQPValue::FieldArray(FieldArray::from(vec![AMQPValue::FieldTable(death)])),
    );
    let body = format!("{{\"marker\":\"{queue}\"}}");
    publish(&channel, &queue, body.as_bytes(), headers).await;

    let delivery = channel
        .basic_get(&queue, BasicGetOptions::default())
        .await
        .unwrap()
        .expect("the message is in the queue");
    let settle = LapinDelivery {
        channel: &channel,
        delivery: &delivery,
    };
    handle_worker_error(&settle, &queue, &anyhow!("ESI 500"), &Quiet)
        .await
        .unwrap();

    // Parking is shared; find this test's message by its body.
    let mut found = None;
    for _ in 0..50 {
        match channel
            .basic_get(retry_topology::PARKING, BasicGetOptions::default())
            .await
            .unwrap()
        {
            Some(parked) if parked.data == body.as_bytes() => {
                found = Some(parked);
                break;
            }
            Some(other) => {
                other
                    .acker
                    .nack(lapin::options::BasicNackOptions {
                        requeue: true,
                        multiple: false,
                    })
                    .await
                    .unwrap();
            }
            None => tokio::time::sleep(Duration::from_millis(100)).await,
        }
    }
    let parked = found.expect("the message was not parked");
    assert_eq!(
        death_count(parked.properties.headers().as_ref()),
        MAX_ATTEMPTS - 1
    );
    assert_eq!(parked.properties.delivery_mode(), &Some(2));
    parked
        .acker
        .ack(lapin::options::BasicAckOptions::default())
        .await
        .unwrap();

    // The original was acked, so the worker queue is empty.
    assert!(channel
        .basic_get(&queue, BasicGetOptions::default())
        .await
        .unwrap()
        .is_none());
    delete(&channel, &queue).await;
}
