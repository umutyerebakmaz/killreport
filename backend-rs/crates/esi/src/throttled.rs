//! The error a throttled ESI request ends in (`rate-limiter.ts:36-51`).

use std::fmt;

/// Which of ESI's limit systems throttled the request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThrottleKind {
    /// 420, or the legacy error budget running low.
    ErrorLimit,
    /// A 429 that carried `X-Ratelimit-Group`: one route group's bucket.
    RateLimit,
    /// A 429 with no group header: the deeper server limiter.
    DeepLimit,
}

impl fmt::Display for ThrottleKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::ErrorLimit => "error-limit",
            Self::RateLimit => "rate-limit",
            Self::DeepLimit => "deep-limit",
        })
    }
}

/// ESI is throttling this process (or this route group).
///
/// Being throttled is not a defect in the message being worked on, so the
/// shared failure path requeues on it at once and burns no attempt; the brake
/// itself lives in the limiter.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{message}")]
pub struct EsiThrottled {
    /// 420 or 429.
    pub status: u16,
    pub kind: ThrottleKind,
    pub message: String,
}

impl EsiThrottled {
    pub fn new(status: u16, kind: ThrottleKind, message: impl Into<String>) -> Self {
        debug_assert!(status == 420 || status == 429, "throttle status {status}");
        Self {
            status,
            kind,
            message: message.into(),
        }
    }
}
