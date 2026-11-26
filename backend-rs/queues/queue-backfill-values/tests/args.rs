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

mod next_take {
    use queue_backfill_values::{next_take, PAGE_SIZE};

    /// Without --limit a run pages until a page comes back empty: the count
    /// at the start is only for the progress line, because a sync can save
    /// an old killmail below the cursor while the run goes.
    #[test]
    fn without_a_limit_it_never_stops_on_a_count() {
        assert_eq!(next_take(None, 0), Some(PAGE_SIZE));
        assert_eq!(next_take(None, 5_000_000), Some(PAGE_SIZE));
    }

    #[test]
    fn a_limit_caps_the_run() {
        assert_eq!(next_take(Some(1200), 0), Some(PAGE_SIZE));
        assert_eq!(next_take(Some(1200), 1000), Some(200));
        assert_eq!(next_take(Some(1200), 1200), None);
    }
}
