//! The alliance info worker's pure parts, split from `main.rs` so the tests
//! can reach them: the ESI shape and the upsert. The queue message lives in
//! the `runner` crate.

pub mod alliance;
