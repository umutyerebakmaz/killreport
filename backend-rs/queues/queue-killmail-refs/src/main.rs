//! Killmail refs publisher: queues the killmails the user and corporation
//! syncs have seen but nobody has written yet. The Rust counterpart of
//! `backend/src/queues/queue-killmail-refs.ts`: same selection, same queue,
//! same messages. See the spec,
//! `docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md`.
//!
//! Run from `backend/` so it reads the same `.env` as the Node script:
//!
//! ```text
//! yarn queue:killmail-refs:rs
//! ```

use anyhow::{bail, Context as _};
use chrono::Utc;
use lapin::options::{BasicPublishOptions, ConfirmSelectOptions, QueueDeclareOptions};
use lapin::publisher_confirm::Confirmation;
use lapin::types::FieldTable;
use lapin::Channel;
use queue_killmail_refs::{publish_pending, Broker, PRIORITY, QUEUE_NAME};
use tracing::error;

struct LapinBroker {
    channel: Channel,
}

impl Broker for LapinBroker {
    async fn consumer_count(&self) -> anyhow::Result<u32> {
        // Passive: asks about the queue without declaring it with arguments
        // that could disagree with the real ones.
        let queue = self
            .channel
            .queue_declare(
                QUEUE_NAME,
                QueueDeclareOptions {
                    passive: true,
                    ..QueueDeclareOptions::default()
                },
                FieldTable::default(),
            )
            .await?;
        Ok(queue.consumer_count())
    }

    async fn publish_confirmed(&self, bodies: &[Vec<u8>]) -> anyhow::Result<()> {
        let mut pending = Vec::with_capacity(bodies.len());
        for body in bodies {
            pending.push(
                self.channel
                    .basic_publish(
                        "",
                        QUEUE_NAME,
                        BasicPublishOptions::default(),
                        body,
                        mq::message_properties(Some(PRIORITY)),
                    )
                    .await?,
            );
        }
        for confirm in pending {
            if let Confirmation::Nack(_) = confirm.await? {
                bail!("the broker refused a detail message");
            }
        }
        Ok(())
    }
}

#[tokio::main]
async fn main() {
    runner::init();
    if let Err(e) = run().await {
        error!("failed to queue killmail refs: {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context("RABBITMQ_URL is not set")?;
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is not set")?;

    let pool = db::worker_pool(&database_url)?;
    let (connection, channel) = mq::connect(&rabbitmq_url).await?;
    mq::declare_worker_queue(&channel, QUEUE_NAME).await?;
    channel
        .confirm_select(ConfirmSelectOptions::default())
        .await?;

    let broker = LapinBroker { channel };
    let result = publish_pending(&pool, &broker, Utc::now().naive_utc()).await;

    pool.close().await;
    broker.channel.close(200, "done").await?;
    connection.close(200, "done").await?;
    result.map(|_| ())
}
