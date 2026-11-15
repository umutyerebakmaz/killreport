//! ESI client and rate limiter: the Rust port of
//! `backend/src/services/esi-client.ts` and `rate-limiter.ts`, with the
//! shared Redis budget of `esi-limiter/` in front of the limiter.

mod client;
mod compatibility;
mod limiter;
mod route;
pub mod shared;
pub mod shared_limiter;
mod throttled;

pub use client::{EsiClient, EsiError};
pub use compatibility::CompatibilityDate;
pub use limiter::{EsiRoute, LimiterStats, Permit, RateLimiter, DEFAULT_REDIS_URL};
pub use route::route_template;
pub use throttled::{EsiThrottled, ThrottleKind};
