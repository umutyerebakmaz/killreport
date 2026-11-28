//! zKillboard R2Z2 stream worker, split from the binary so the tests can
//! reach its parts. The Rust counterpart of
//! `backend/src/workers/worker-redisq-stream.ts`; see the spec,
//! `docs/superpowers/specs/2026-11-28-rust-redisq-design.md`.

pub mod cursor;
pub mod r2z2;
pub mod stream;
