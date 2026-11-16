//! How many messages a worker holds unacked, and so works on at once.
//!
//! Concurrency, not a rate: every request still waits for a slot from the
//! shared ESI limiter, which owns the dispatch ceiling. The prefetch only has
//! to keep that ceiling fed, so it is at least half the target rate. The same
//! rule as the Node workers (`worker-info-types.ts`, `worker-asteroid-belts.ts`):
//! `max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`, 25 with the defaults.

/// `ESI_PREFETCH` when unset (`config.ts`, `ESI_PREFETCH` default `'25'`).
const DEFAULT_PREFETCH: u16 = 25;

/// The prefetch from `ESI_PREFETCH` and `ESI_MAX_RPS` in the environment.
pub(crate) fn prefetch_from_env() -> Result<u16, String> {
    prefetch(
        std::env::var("ESI_PREFETCH").ok().as_deref(),
        esi::max_rps_from_env()?,
    )
}

/// `max(ESI_PREFETCH, ceil(max_rps / 2))`. A value that is not a positive
/// integer is an error at startup rather than Node's silent NaN.
pub(crate) fn prefetch(esi_prefetch: Option<&str>, max_rps: u32) -> Result<u16, String> {
    let configured = match esi_prefetch {
        None => DEFAULT_PREFETCH,
        Some(raw) => match raw.trim().parse::<u16>() {
            Ok(n) if n > 0 => n,
            _ => {
                return Err(format!(
                    "ESI_PREFETCH must be a positive integer up to {}, got {raw:?}",
                    u16::MAX
                ))
            }
        },
    };
    let half_rate = u16::try_from(max_rps.div_ceil(2)).unwrap_or(u16::MAX);
    Ok(configured.max(half_rate))
}

#[cfg(test)]
mod tests {
    use super::prefetch;

    #[test]
    fn the_defaults_give_25() {
        assert_eq!(prefetch(None, 50), Ok(25));
    }

    #[test]
    fn esi_prefetch_raises_it() {
        assert_eq!(prefetch(Some("100"), 50), Ok(100));
    }

    #[test]
    fn it_never_drops_below_half_the_rate() {
        assert_eq!(prefetch(Some("5"), 50), Ok(25));
        assert_eq!(prefetch(None, 81), Ok(41));
    }

    #[test]
    fn a_bad_esi_prefetch_is_an_error() {
        for raw in ["", "0", "-3", "abc", "70000"] {
            assert!(prefetch(Some(raw), 50).is_err(), "{raw:?}");
        }
    }
}
