//! The compatibility date a caller hands to one request.

use esi::CompatibilityDate;

#[test]
fn accepts_a_valid_date() {
    assert_eq!(CompatibilityDate::new("2026-06-09").as_str(), "2026-06-09");
}

#[test]
fn the_default_is_2020_01_01() {
    assert_eq!(CompatibilityDate::DEFAULT.as_str(), "2020-01-01");
}

#[test]
#[should_panic(expected = "YYYY-MM-DD")]
fn rejects_a_short_date() {
    CompatibilityDate::new("2026-6-09");
}

#[test]
#[should_panic(expected = "YYYY-MM-DD")]
fn rejects_wrong_separators() {
    CompatibilityDate::new("2026/06/09");
}

#[test]
#[should_panic(expected = "YYYY-MM-DD")]
fn rejects_letters() {
    CompatibilityDate::new("2026-0a-09");
}

#[test]
#[should_panic(expected = "YYYY-MM-DD")]
fn rejects_trailing_text() {
    CompatibilityDate::new("2026-06-09x");
}
