//! `Settle` for a real lapin delivery.

use std::future::Future;

use lapin::message::Delivery;
use lapin::options::{BasicAckOptions, BasicNackOptions, BasicPublishOptions};
use lapin::types::FieldTable;
use lapin::{BasicProperties, Channel};

use crate::failure::Settle;
use crate::topology::retry_topology::PARKING;

/// A delivery and the channel it came on.
pub struct LapinDelivery<'a> {
    pub channel: &'a Channel,
    pub delivery: &'a Delivery,
}

impl Settle for LapinDelivery<'_> {
    fn headers(&self) -> Option<&FieldTable> {
        self.delivery.properties.headers().as_ref()
    }

    fn body(&self) -> &[u8] {
        &self.delivery.data
    }

    fn ack(&self) -> impl Future<Output = Result<(), lapin::Error>> + Send {
        self.delivery.acker.ack(BasicAckOptions::default())
    }

    fn nack(&self, requeue: bool) -> impl Future<Output = Result<(), lapin::Error>> + Send {
        self.delivery.acker.nack(BasicNackOptions {
            requeue,
            multiple: false,
        })
    }

    fn park(&self) -> impl Future<Output = Result<(), lapin::Error>> + Send {
        // The default exchange with the queue's own name as the routing key:
        // no binding needed. Delivery mode 2 is `persistent: true`.
        let mut properties = BasicProperties::default().with_delivery_mode(2);
        if let Some(headers) = self.headers() {
            properties = properties.with_headers(headers.clone());
        }
        let publish = self.channel.basic_publish(
            "",
            PARKING,
            BasicPublishOptions::default(),
            self.body(),
            properties,
        );
        async move {
            publish.await?;
            Ok(())
        }
    }
}
