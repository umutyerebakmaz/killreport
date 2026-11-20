//! `infer_outcome`: the verdict on a campaign ESI stopped listing, from its
//! last-known scores.

use worker_sovereignty_campaigns::infer_outcome;

#[test]
fn both_scores_unknown_is_abandoned() {
    assert_eq!(infer_outcome(None, None), "abandoned");
}

#[test]
fn nobody_made_progress_is_abandoned() {
    assert_eq!(infer_outcome(Some(0.01), Some(0.04)), "abandoned");
}

#[test]
fn a_tie_goes_to_the_defender() {
    assert_eq!(infer_outcome(Some(0.6), Some(0.6)), "defender_won");
}

#[test]
fn attackers_ahead_win() {
    assert_eq!(infer_outcome(Some(0.2), Some(0.7)), "attacker_won");
}

#[test]
fn unknown_defender_score_counts_as_zero() {
    assert_eq!(infer_outcome(None, Some(0.3)), "attacker_won");
}

#[test]
fn unknown_attackers_score_counts_as_zero() {
    assert_eq!(infer_outcome(Some(0.3), None), "defender_won");
}
