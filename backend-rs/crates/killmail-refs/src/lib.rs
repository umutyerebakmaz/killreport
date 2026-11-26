//! `killmail_refs`: every killmail a user or corporation sync has seen on
//! ESI, the durable record of work RabbitMQ only carries. A ref with no row in
//! `killmails` is pending. The Rust counterpart of
//! `backend/src/services/killmail-refs.ts`, `killmail-walk.ts` and the
//! selection in `backend/src/queues/queue-killmail-refs.ts`, the same rules.
//! See the spec, `docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md`.

use std::future::Future;

use chrono::{NaiveDateTime, TimeDelta};
use esi::{EsiError, Page};
use serde::Deserialize;
use sqlx::PgPool;

/// The most pages one sync reads: the `char-killmail` and `corp-killmail`
/// groups allow 30 tokens per 15 minutes per character and a 2xx costs 2, so
/// 15 pages; one is left for the next sync.
pub const MAX_PAGES: u32 = 14;
/// Refs published per run of the publisher.
const BATCH: i64 = 5000;
/// Rounds published hourly before a ref drops to daily.
const HOURLY_ROUNDS: i32 = 5;

/// One entry of an ESI killmail list.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, sqlx::FromRow)]
pub struct Ref {
    pub killmail_id: i32,
    pub killmail_hash: String,
}

/// Record one page in one statement and return how many refs were new. The
/// first sync to see a killmail keeps its row. `now` is UTC.
pub async fn record(
    pool: &PgPool,
    refs: &[Ref],
    source: &str,
    now: NaiveDateTime,
) -> sqlx::Result<u64> {
    if refs.is_empty() {
        return Ok(0);
    }
    let ids: Vec<i32> = refs.iter().map(|r| r.killmail_id).collect();
    let hashes: Vec<&str> = refs.iter().map(|r| r.killmail_hash.as_str()).collect();
    Ok(sqlx::query(
        "INSERT INTO killmail_refs (killmail_id, killmail_hash, source, discovered_at)
         SELECT id, hash, $3, $4 FROM UNNEST($1::int[], $2::text[]) AS t(id, hash)
         ON CONFLICT (killmail_id) DO NOTHING",
    )
    .bind(&ids)
    .bind(&hashes)
    .bind(source)
    .bind(now)
    .execute(pool)
    .await?
    .rows_affected())
}

/// What one walk saw.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Walk {
    pub pages: u32,
    pub found: usize,
    pub inserted: u64,
    pub capped: bool,
}

/// Read an authenticated killmail list page by page, recording each page as
/// it comes so a failure later keeps what was already seen.
///
/// Stops on a 404 (`None`) or an empty page, at `X-Pages`, after
/// [`MAX_PAGES`], and — unless `full_sync` — on a page that added no new ref:
/// everything below it was recorded by an earlier sync. An ESI error comes
/// back as the [`EsiError`] inside the `anyhow::Error`, so a caller can
/// `downcast_ref` it (the corporation worker settles a 403).
pub async fn walk<F, Fut>(
    mut fetch: F,
    pool: &PgPool,
    source: &str,
    full_sync: bool,
    now: NaiveDateTime,
) -> anyhow::Result<Walk>
where
    F: FnMut(u32) -> Fut,
    Fut: Future<Output = Result<Option<Page<Ref>>, EsiError>>,
{
    let mut result = Walk::default();
    for n in 1..=MAX_PAGES {
        let Some(page) = fetch(n).await? else {
            return Ok(result);
        };
        if page.items.is_empty() {
            return Ok(result);
        }
        let inserted = record(pool, &page.items, source, now).await?;
        result.pages = n;
        result.found += page.items.len();
        result.inserted += inserted;

        if !full_sync && inserted == 0 {
            return Ok(result);
        }
        if page.pages.is_some_and(|pages| n >= pages) {
            return Ok(result);
        }
    }
    result.capped = true;
    Ok(result)
}

/// The refs due a round: no killmail yet, and never queued, or fewer than
/// five rounds with the last over an hour ago, or five and more with the last
/// over a day ago. Newest first, one batch.
pub async fn pending(pool: &PgPool, now: NaiveDateTime) -> sqlx::Result<Vec<Ref>> {
    sqlx::query_as(
        "SELECT r.killmail_id, r.killmail_hash
         FROM killmail_refs r
         WHERE NOT EXISTS (SELECT 1 FROM killmails k WHERE k.killmail_id = r.killmail_id)
           AND (
             r.last_queued_at IS NULL
             OR (r.queued_count < $1 AND r.last_queued_at < $2)
             OR (r.queued_count >= $1 AND r.last_queued_at < $3)
           )
         ORDER BY r.killmail_id DESC
         LIMIT $4",
    )
    .bind(HOURLY_ROUNDS)
    .bind(now - TimeDelta::hours(1))
    .bind(now - TimeDelta::hours(24))
    .bind(BATCH)
    .fetch_all(pool)
    .await
}

/// Count a published round, after the broker confirmed it.
pub async fn mark_queued(pool: &PgPool, ids: &[i32], now: NaiveDateTime) -> sqlx::Result<u64> {
    Ok(sqlx::query(
        "UPDATE killmail_refs SET queued_count = queued_count + 1, last_queued_at = $2
         WHERE killmail_id = ANY($1)",
    )
    .bind(ids)
    .bind(now)
    .execute(pool)
    .await?
    .rows_affected())
}
