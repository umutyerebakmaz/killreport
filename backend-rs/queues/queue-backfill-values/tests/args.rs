//! The three flags of `queue:backfill-values`, and what is refused.

use queue_backfill_values::{parse_args, Args};

fn args(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

#[test]
fn no_flags_is_everything() {
    assert_eq!(parse_args(&[]).unwrap(), Args::default());
}

#[test]
fn all_three_flags() {
    assert_eq!(
        parse_args(&args(&[
            "--limit=10000",
            "--capsules-only",
            "--id=133900250"
        ]))
        .unwrap(),
        Args {
            limit: Some(10000),
            id: Some(133900250),
            capsules_only: true,
        }
    );
}

#[test]
fn rejects_a_bad_limit() {
    for bad in [
        "--limit=abc",
        "--limit=0",
        "--limit=-5",
        "--id=",
        "--id=x",
        "--mode=all",
        "extra",
    ] {
        assert!(parse_args(&args(&[bad])).is_err(), "{bad} was accepted");
    }
}
