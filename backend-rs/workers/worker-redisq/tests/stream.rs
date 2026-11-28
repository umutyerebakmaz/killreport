//! The 404 rule (spec §2): wait while the head is not ahead; with the head
//! ahead, give the file three tries before skipping it; after ten skips in a
//! row, jump to the head.

use worker_redisq::stream::{on_found, on_not_found, Gap, Step};

#[test]
fn waits_while_the_head_is_not_ahead() {
    let mut gap = Gap::default();
    for _ in 0..5 {
        assert_eq!(on_not_found(&mut gap, 100, 99), Step::Wait);
        assert_eq!(on_not_found(&mut gap, 100, 100), Step::Wait);
    }
}

#[test]
fn waits_twice_then_skips_when_the_head_is_ahead() {
    let mut gap = Gap::default();
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Skip(101));
    // The next number starts its own three tries.
    assert_eq!(on_not_found(&mut gap, 101, 105), Step::Wait);
}

#[test]
fn a_head_that_falls_back_resets_the_tries() {
    let mut gap = Gap::default();
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 100), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Wait);
    assert_eq!(on_not_found(&mut gap, 100, 105), Step::Skip(101));
}

fn skip_once(gap: &mut Gap, current: i64, head: i64) -> Step {
    on_not_found(gap, current, head);
    on_not_found(gap, current, head);
    on_not_found(gap, current, head)
}

#[test]
fn ten_skips_jump_to_the_head() {
    let mut gap = Gap::default();
    for n in 0..9 {
        assert_eq!(skip_once(&mut gap, 100 + n, 5000), Step::Skip(101 + n));
    }
    assert_eq!(skip_once(&mut gap, 109, 5000), Step::JumpTo(5000));
    // The count starts again after a jump.
    assert_eq!(skip_once(&mut gap, 5000, 6000), Step::Skip(5001));
}

#[test]
fn a_found_killmail_resets_the_skip_count() {
    let mut gap = Gap::default();
    for n in 0..9 {
        skip_once(&mut gap, 100 + n, 5000);
    }
    on_found(&mut gap);
    assert_eq!(skip_once(&mut gap, 110, 5000), Step::Skip(111));
}
