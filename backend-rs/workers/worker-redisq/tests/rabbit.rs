//! A broker that never answers must not stop the stream: a publish gives up
//! after the outbox's timeout instead of waiting forever (final review,
//! Important #1). A TCP listener that accepts and stays silent stands in
//! for a blocked or stalled RabbitMQ.

use std::time::Duration;

use tokio::net::TcpListener;
use worker_redisq::outbox::{Outbox, DISCORD_WEBHOOK_QUEUE};
use worker_redisq::rabbit::RabbitOutbox;

#[tokio::test]
async fn a_silent_broker_fails_the_publish_after_the_timeout() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let held = tokio::spawn(async move {
        let mut sockets = Vec::new();
        loop {
            let (socket, _) = listener.accept().await.unwrap();
            sockets.push(socket);
        }
    });

    let outbox = RabbitOutbox::with_timeout(
        format!("amqp://guest:guest@127.0.0.1:{port}/%2f"),
        Duration::from_millis(300),
    );
    let result = tokio::time::timeout(
        Duration::from_secs(5),
        outbox.publish_killmails(DISCORD_WEBHOOK_QUEUE, &[1]),
    )
    .await;

    held.abort();
    let publish = result.expect("the publish hung past its timeout");
    assert!(publish.is_err());
}
