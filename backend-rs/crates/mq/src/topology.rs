//! The retry topology every worker queue sits in, and the connection a
//! worker opens: the queue-declaring half of `backend/src/services/rabbitmq.ts`.

use lapin::options::{ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions};
use lapin::types::{AMQPValue, FieldTable, LongString, ShortString};
use lapin::{Channel, Connection, ConnectionProperties, ExchangeKind};

/// Names and the wait delay of the retry topology (`queue-names.ts:66-72`).
pub mod retry_topology {
    /// Fanout: every failed message lands here, whatever queue it came from.
    pub const DLX: &str = "killreport.dlx";
    /// Direct: routes an expired message back by its origin queue's name.
    pub const RETRY: &str = "killreport.retry";
    /// No consumer; the TTL is the delay before a retry.
    pub const WAIT: &str = "killreport.wait";
    /// Where a message goes after its last attempt, for an operator to read.
    pub const PARKING: &str = "killreport.parking";
    pub const WAIT_TTL_MS: i16 = 30_000;
}

/// Every queue in the app is declared with this (CLAUDE.md, "Declaring a queue").
///
/// The AMQP types below are the ones amqplib 0.10 picks for these numbers
/// (`lib/codec.js`: a signed byte below 128, a signed short below 32768), so
/// a queue the Node workers declared and one declared here are argument for
/// argument the same.
const MAX_PRIORITY: i8 = 10;

fn args(entries: &[(&str, AMQPValue)]) -> FieldTable {
    let mut table = FieldTable::default();
    for (key, value) in entries {
        table.insert(ShortString::from(*key), value.clone());
    }
    table
}

fn priority_args() -> FieldTable {
    args(&[("x-max-priority", AMQPValue::ShortShortInt(MAX_PRIORITY))])
}

fn durable() -> QueueDeclareOptions {
    QueueDeclareOptions {
        durable: true,
        ..QueueDeclareOptions::default()
    }
}

/// Open a connection and one channel on it.
pub async fn connect(url: &str) -> Result<(Connection, Channel), lapin::Error> {
    let connection = Connection::connect(url, ConnectionProperties::default()).await?;
    let channel = connection.create_channel().await?;
    Ok((connection, channel))
}

/// Declare what one worker needs, exactly as `ensureAllQueuesExist()` does
/// for it (`rabbitmq.ts:134-166`): the two exchanges, the wait and parking
/// queues, the wait queue's binding, the worker's own queue and its binding.
///
/// Declaring the same thing again is a no-op; declaring it with a different
/// argument is a 406 that closes the channel, which is why every argument is
/// spelled once, here. The worker queue gets no `x-dead-letter-exchange`: that
/// comes from the `killreport-dlx` policy (`backend/docs/ops/rabbitmq.md`), and
/// as an argument it would be refused by a queue that already exists.
pub async fn declare_worker_queue(channel: &Channel, queue: &str) -> Result<(), lapin::Error> {
    use retry_topology::{DLX, PARKING, RETRY, WAIT, WAIT_TTL_MS};
    let exchange = ExchangeDeclareOptions {
        durable: true,
        ..ExchangeDeclareOptions::default()
    };

    channel
        .exchange_declare(DLX, ExchangeKind::Fanout, exchange, FieldTable::default())
        .await?;
    channel
        .exchange_declare(RETRY, ExchangeKind::Direct, exchange, FieldTable::default())
        .await?;

    channel
        .queue_declare(
            WAIT,
            durable(),
            args(&[
                ("x-max-priority", AMQPValue::ShortShortInt(MAX_PRIORITY)),
                ("x-message-ttl", AMQPValue::ShortInt(WAIT_TTL_MS)),
                (
                    "x-dead-letter-exchange",
                    AMQPValue::LongString(LongString::from(RETRY)),
                ),
            ]),
        )
        .await?;
    channel
        .queue_declare(PARKING, durable(), priority_args())
        .await?;
    // A fanout binding takes an empty routing key.
    channel
        .queue_bind(
            WAIT,
            DLX,
            "",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    channel
        .queue_declare(queue, durable(), priority_args())
        .await?;
    // Under its own name, so an expired message returns to exactly this queue.
    channel
        .queue_bind(
            queue,
            RETRY,
            queue,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    Ok(())
}
