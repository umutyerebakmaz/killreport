//! The four entities a killmail names — characters, corporations, alliances
//! and types: what ESI says about each, the one statement that stores it,
//! and the fetch that joins the two. The info workers and `worker-redisq`
//! both call these, so each table has one way of being written; see
//! `docs/superpowers/specs/2026-11-28-rust-redisq-design.md`, §4.

pub mod alliance;
pub mod character;
pub mod corporation;
pub mod type_info;

/// What one [`character::fetch_and_upsert`] (or its siblings) did: whether
/// the row was new, and the name (and ticker, for a corporation or an
/// alliance) ESI gave, for the caller's log line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fetched {
    pub inserted: bool,
    pub name: String,
    pub ticker: Option<String>,
}
