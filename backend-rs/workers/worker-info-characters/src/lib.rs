//! The character info worker's pure parts, split from the binary so the
//! tests can reach them: the ESI shape, the title fields and the upsert. The
//! queue message lives in the `runner` crate.

pub mod character;
