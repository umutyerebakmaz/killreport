//! The Redis side of the shared ESI limiter, the Rust twin of
//! `backend/src/services/esi-limiter/shared-store.ts`.
//!
//! The logic lives in `acquire.lua` and `observe.lua` (with the helpers both
//! share in `lib.lua`), the single copy the Node store loads too. Each script
//! runs atomically inside Redis on Redis's own clock; this module only
//! marshals arguments and results. An absent number travels as `''`, which the
//! scripts read as "no value".

use std::sync::LazyLock;

use redis::aio::ConnectionManager;
use redis::{Client, ErrorKind, RedisError, Script, Value};
use tokio::sync::OnceCell;

use crate::throttled::ThrottleKind;

/// Lowercase, so the response cache's `*<Typename>:<id>*` KEYS never match.
pub const KEY_PREFIX: &str = "esi-limiter:";
/// Tokens a bulk acquire leaves in the shared bucket for live traffic.
pub const FLOOR: u32 = 5;

// One body per script: lib.lua, a newline, then the script (lib.lua:3-8).
static ACQUIRE: LazyLock<Script> = LazyLock::new(|| {
    Script::new(concat!(
        include_str!("../../../../backend/src/services/esi-limiter/lib.lua"),
        "\n",
        include_str!("../../../../backend/src/services/esi-limiter/acquire.lua")
    ))
});
static OBSERVE: LazyLock<Script> = LazyLock::new(|| {
    Script::new(concat!(
        include_str!("../../../../backend/src/services/esi-limiter/lib.lua"),
        "\n",
        include_str!("../../../../backend/src/services/esi-limiter/observe.lua")
    ))
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Priority {
    Live,
    Bulk,
}

impl Priority {
    fn as_str(self) -> &'static str {
        match self {
            Self::Live => "live",
            Self::Bulk => "bulk",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WaitReason {
    Brake,
    Group,
    Rate,
}

impl WaitReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Brake => "brake",
            Self::Group => "group",
            Self::Rate => "rate",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum AcquireOutcome {
    Granted,
    Wait {
        wait_ms: f64,
        reason: WaitReason,
        detail: String,
    },
}

#[derive(Debug, Clone, Default)]
pub struct ObserveInput {
    pub template: String,
    pub bucket_key: String,
    pub status: u16,
    pub group: Option<String>,
    pub limit: Option<f64>,
    pub window_ms: Option<f64>,
    pub remaining: Option<f64>,
    pub error_remain: Option<f64>,
    pub error_reset_ms: Option<f64>,
    pub retry_after_ms: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObserveOutcome {
    /// Only when this call set a new brake: (ms, status, kind).
    pub brake: Option<(f64, u16, ThrottleKind)>,
    /// Only when this call set a new group pause: (group bucket key, ms).
    pub group_pause: Option<(String, f64)>,
    /// The adapted dispatch rate after this response.
    pub rate: f64,
}

/// An absent number travels as `''`.
fn arg(value: Option<f64>) -> String {
    value.map(|v| v.to_string()).unwrap_or_default()
}

fn bad_reply(what: &str) -> RedisError {
    RedisError::from((
        ErrorKind::Parse,
        "unexpected limiter script reply",
        what.to_string(),
    ))
}

fn int(value: &Value, what: &str) -> Result<i64, RedisError> {
    match value {
        Value::Int(n) => Ok(*n),
        _ => Err(bad_reply(what)),
    }
}

fn text(value: &Value, what: &str) -> Result<String, RedisError> {
    match value {
        Value::BulkString(bytes) => Ok(String::from_utf8_lossy(bytes).into_owned()),
        Value::SimpleString(s) => Ok(s.clone()),
        _ => Err(bad_reply(what)),
    }
}

fn parse_kind(kind: &str) -> Result<ThrottleKind, RedisError> {
    match kind {
        "error-limit" => Ok(ThrottleKind::ErrorLimit),
        "rate-limit" => Ok(ThrottleKind::RateLimit),
        "deep-limit" => Ok(ThrottleKind::DeepLimit),
        _ => Err(bad_reply("brake kind")),
    }
}

/// A connection is made on first use, so building a store never fails on an
/// unreachable Redis and never blocks.
pub struct SharedStore {
    client: Client,
    connection: OnceCell<ConnectionManager>,
    max_rps: u32,
    prefix: String,
}

impl SharedStore {
    pub fn new(redis_url: &str, max_rps: u32) -> Result<Self, String> {
        let client = Client::open(redis_url).map_err(|e| e.to_string())?;
        Ok(Self {
            client,
            connection: OnceCell::new(),
            max_rps,
            prefix: KEY_PREFIX.to_string(),
        })
    }

    /// For tests: a random prefix keeps a run off the real keys.
    pub fn with_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.prefix = prefix.into();
        self
    }

    async fn connection(&self) -> Result<ConnectionManager, RedisError> {
        self.connection
            .get_or_try_init(|| ConnectionManager::new(self.client.clone()))
            .await
            .cloned()
    }

    /// `now` is for tests; without it the script uses Redis TIME.
    pub async fn acquire(
        &self,
        priority: Priority,
        template: &str,
        bucket_key: &str,
        now: Option<f64>,
    ) -> Result<AcquireOutcome, RedisError> {
        let mut con = self.connection().await?;
        // Script::invoke_async sends EVALSHA and falls back to EVAL on NOSCRIPT.
        let reply: Vec<Value> = ACQUIRE
            .key(&[] as &[&str])
            .arg(&self.prefix)
            .arg(priority.as_str())
            .arg(template)
            .arg(bucket_key)
            .arg(self.max_rps.to_string())
            .arg(FLOOR.to_string())
            .arg(arg(now))
            .invoke_async(&mut con)
            .await?;

        let first = reply.first().ok_or_else(|| bad_reply("acquire"))?;
        if int(first, "granted")? == 1 {
            return Ok(AcquireOutcome::Granted);
        }
        let field = |i: usize| reply.get(i).ok_or_else(|| bad_reply("acquire wait"));
        let reason = match text(field(2)?, "reason")?.as_str() {
            "brake" => WaitReason::Brake,
            "group" => WaitReason::Group,
            "rate" => WaitReason::Rate,
            _ => return Err(bad_reply("reason")),
        };
        let detail = match reply.get(3) {
            Some(v) => text(v, "detail")?,
            None => String::new(),
        };
        Ok(AcquireOutcome::Wait {
            wait_ms: int(field(1)?, "waitMs")? as f64,
            reason,
            detail,
        })
    }

    /// `now` is for tests; without it the script uses Redis TIME.
    pub async fn observe(
        &self,
        input: &ObserveInput,
        now: Option<f64>,
    ) -> Result<ObserveOutcome, RedisError> {
        let mut con = self.connection().await?;
        let reply: Vec<Value> = OBSERVE
            .key(&[] as &[&str])
            .arg(&self.prefix)
            .arg(&input.template)
            .arg(&input.bucket_key)
            .arg(input.status.to_string())
            .arg(input.group.as_deref().unwrap_or(""))
            .arg(arg(input.limit))
            .arg(arg(input.window_ms))
            .arg(arg(input.remaining))
            .arg(arg(input.error_remain))
            .arg(arg(input.error_reset_ms))
            .arg(arg(input.retry_after_ms))
            .arg(self.max_rps.to_string())
            .arg(arg(now))
            .invoke_async(&mut con)
            .await?;

        let at = |i: usize| reply.get(i).ok_or_else(|| bad_reply("observe"));
        let brake_ms = int(at(0)?, "brakeMs")?;
        let brake_status = int(at(1)?, "brakeStatus")?;
        let brake_kind = text(at(2)?, "brakeKind")?;
        let group_key = text(at(3)?, "groupKey")?;
        let group_pause_ms = int(at(4)?, "groupPauseMs")?;
        let rate = int(at(5)?, "rate")?;

        let brake = if brake_ms > 0 {
            Some((
                brake_ms as f64,
                brake_status as u16,
                parse_kind(&brake_kind)?,
            ))
        } else {
            None
        };
        let group_pause = (group_pause_ms > 0).then_some((group_key, group_pause_ms as f64));
        Ok(ObserveOutcome {
            brake,
            group_pause,
            rate: rate as f64,
        })
    }
}
