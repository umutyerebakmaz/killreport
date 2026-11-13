//! Pure helpers the limiter reads paths and headers with
//! (`rate-limiter.ts:80-114`).

use std::sync::LazyLock;
use std::time::Duration;

use regex::Regex;

// `[0-9]`, not `\d`: Rust's `\d` matches every Unicode digit, JavaScript's
// only ASCII ones.
static HASH: LazyLock<Regex> = LazyLock::new(|| Regex::new("^[0-9a-f]{40}$").unwrap());
static ID: LazyLock<Regex> = LazyLock::new(|| Regex::new("^[0-9]+$").unwrap());
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "read by the limiter, plan task 4")
)]
static LIMIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new("^([0-9]+)/([0-9]+)([smhd])$").unwrap());

/// The route a path belongs to, as ESI groups it: the query string goes, a
/// numeric segment becomes `{id}` and a killmail hash `{hash}`.
pub fn route_template(path: &str) -> String {
    let path = path.split('?').next().unwrap_or_default();
    path.split('/')
        .map(|segment| {
            if HASH.is_match(segment) {
                "{hash}"
            } else if ID.is_match(segment) {
                "{id}"
            } else {
                segment
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// A header value in seconds, as milliseconds; `None` when absent, blank or
/// not a finite number.
///
/// Zero and negative values come back as they are: ignoring them is the
/// brake's decision (`rate-limiter.ts:394`), not the parser's. That is also why
/// this returns `f64` and not `Duration`, which cannot hold a negative.
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "read by the limiter, plan task 4")
)]
pub(crate) fn seconds(value: Option<&str>) -> Option<f64> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        return None;
    }
    let n: f64 = trimmed.parse().ok()?;
    n.is_finite().then_some(n * 1000.0)
}

/// `X-Ratelimit-Limit`, e.g. `150/15m` → `(150, 15 min)`; `None` unless both
/// numbers are positive.
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "read by the limiter, plan task 4")
)]
pub(crate) fn parse_limit(value: Option<&str>) -> Option<(u32, Duration)> {
    let caps = LIMIT.captures(value?.trim())?;
    let limit: u32 = caps[1].parse().ok()?;
    let count: u64 = caps[2].parse().ok()?;
    let unit_ms: u64 = match &caps[3] {
        "s" => 1_000,
        "m" => 60_000,
        "h" => 3_600_000,
        "d" => 86_400_000,
        _ => unreachable!("the regex admits only s, m, h, d"),
    };
    let window = Duration::from_millis(count.checked_mul(unit_ms)?);
    (limit > 0 && !window.is_zero()).then_some((limit, window))
}

#[cfg(test)]
mod tests {
    use super::*;

    // rate-limiter.spec.ts:383
    const HASH_SAMPLE: &str = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

    // rate-limiter.spec.ts:397
    #[test]
    fn maps_ids_and_the_killmail_hash() {
        assert_eq!(
            route_template(&format!("/killmails/123/{HASH_SAMPLE}/")),
            "/killmails/{id}/{hash}/"
        );
    }

    // rate-limiter.spec.ts:404
    #[test]
    fn drops_the_query_string() {
        assert_eq!(
            route_template("/characters/9/killmails/recent/?page=3"),
            "/characters/{id}/killmails/recent/"
        );
    }

    // rate-limiter.spec.ts:411
    #[test]
    fn keeps_a_path_without_a_trailing_slash_as_it_is() {
        assert_eq!(route_template("/sovereignty/map"), "/sovereignty/map");
    }

    #[test]
    fn a_non_ascii_digit_is_not_an_id() {
        // Arabic-Indic digits: \d would match them in Rust, not in JavaScript.
        assert_eq!(route_template("/alliances/١٢٣/"), "/alliances/١٢٣/");
    }

    #[test]
    fn seconds_reads_a_number_of_seconds() {
        assert_eq!(seconds(Some("5")), Some(5000.0));
        assert_eq!(seconds(Some(" 1.5 ")), Some(1500.0));
    }

    #[test]
    fn seconds_keeps_zero_and_negatives() {
        assert_eq!(seconds(Some("0")), Some(0.0));
        assert_eq!(seconds(Some("-3")), Some(-3000.0));
    }

    #[test]
    fn seconds_has_no_value_for_absent_blank_or_non_numbers() {
        assert_eq!(seconds(None), None);
        assert_eq!(seconds(Some("")), None);
        assert_eq!(seconds(Some("   ")), None);
        assert_eq!(seconds(Some("abc")), None);
        assert_eq!(seconds(Some("inf")), None);
        assert_eq!(seconds(Some("NaN")), None);
    }

    #[test]
    fn parse_limit_reads_each_unit() {
        assert_eq!(
            parse_limit(Some("150/15m")),
            Some((150, Duration::from_secs(900)))
        );
        assert_eq!(
            parse_limit(Some("3600/1h")),
            Some((3600, Duration::from_secs(3600)))
        );
        assert_eq!(
            parse_limit(Some("10/1s")),
            Some((10, Duration::from_secs(1)))
        );
        assert_eq!(
            parse_limit(Some(" 20/1d ")),
            Some((20, Duration::from_secs(86_400)))
        );
    }

    #[test]
    fn parse_limit_rejects_zero_and_malformed_values() {
        assert_eq!(parse_limit(None), None);
        assert_eq!(parse_limit(Some("")), None);
        assert_eq!(parse_limit(Some("0/15m")), None);
        assert_eq!(parse_limit(Some("150/0m")), None);
        assert_eq!(parse_limit(Some("150/15")), None);
        assert_eq!(parse_limit(Some("150/15w")), None);
        assert_eq!(parse_limit(Some("-1/15m")), None);
        assert_eq!(parse_limit(Some("150 / 15m")), None);
    }
}
