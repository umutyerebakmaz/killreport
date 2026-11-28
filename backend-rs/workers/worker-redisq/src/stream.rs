//! What to do when R2Z2 has no file at our sequence (spec §2).
//!
//! A file can be missing because nothing has happened yet (the head is not
//! past us), because the sequence has a gap or the file has expired, or
//! because the head moved before the file became readable. A skipped number
//! leaves no trace — no killmail ID, nothing `killmail_refs` could keep — so
//! a number is skipped only after [`TRIES`] answers in a row with the head
//! ahead. [`SKIPS`] skips in a row mean the saved number has fallen out of
//! what R2Z2 still keeps: jump to the head instead of walking there.

/// 404s in a row, with the head ahead, before a number is skipped.
pub const TRIES: u32 = 3;
/// Skips in a row before jumping to the head.
pub const SKIPS: u32 = 10;

/// The run of misses so far. A found killmail resets it.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Gap {
    tries: u32,
    skipped: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// Try the same number again after the empty-feed delay.
    Wait,
    /// Give up on this number; read this one next.
    Skip(i64),
    /// The saved number is out of R2Z2's range; continue from the head.
    JumpTo(i64),
}

/// A 404 at `current`, with `head` as `sequence.json` gave it.
pub fn on_not_found(gap: &mut Gap, current: i64, head: i64) -> Step {
    if head <= current {
        gap.tries = 0;
        return Step::Wait;
    }
    gap.tries += 1;
    if gap.tries < TRIES {
        return Step::Wait;
    }
    gap.tries = 0;
    gap.skipped += 1;
    if gap.skipped == SKIPS {
        gap.skipped = 0;
        return Step::JumpTo(head);
    }
    Step::Skip(current + 1)
}

/// A file was there: the misses are over.
pub fn on_found(gap: &mut Gap) {
    *gap = Gap::default();
}
