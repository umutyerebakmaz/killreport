//! Queue topology and the shared worker failure path: the Rust port of the
//! queue half of `backend/src/services/rabbitmq.ts` and of
//! `backend/src/workers/worker-error.ts`, and the message the info queue
//! publishers send.

mod delivery;
mod failure;
mod message;
mod publish;
mod topology;

pub use delivery::LapinDelivery;
pub use failure::{
    death_count, handle_worker_error, is_forbidden, HttpStatusError, Settle, WorkerLog,
    MAX_ATTEMPTS,
};
pub use message::EntityMessage;
pub use publish::{publish_entities, BATCH_SIZE};
pub use topology::{connect, declare_worker_queue, retry_topology};
