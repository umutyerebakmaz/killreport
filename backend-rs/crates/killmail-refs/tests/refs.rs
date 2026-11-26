//! killmail_refs against a real PostgreSQL: recording a page, the walk's stop
//! rules, and which refs the publisher picks. `sqlx::test` creates a
//! throwaway database per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use std::cell::Cell;

use chrono::{NaiveDate, NaiveDateTime, TimeDelta};
use esi::{EsiError, Page};
use killmail_refs::{mark_queued, pending, record, walk, Ref, MAX_PAGES};
use sqlx::PgPool;

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 26)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

fn r(id: i32) -> Ref {
    Ref {
        killmail_id: id,
        killmail_hash: format!("h{id}"),
    }
}

fn page(ids: &[i32], pages: Option<u32>) -> Option<Page<Ref>> {
    Some(Page {
        items: ids.iter().copied().map(r).collect(),
        pages,
    })
}

async fn count(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM killmail_refs")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn stored_killmail(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id, updated_at)
         VALUES ($1, 'hash', '2026-11-26 09:00:00', 30000142, '2026-11-26 09:00:00')",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

async fn queued(pool: &PgPool, id: i32, count: i32, last: Option<NaiveDateTime>) {
    sqlx::query(
        "INSERT INTO killmail_refs (killmail_id, killmail_hash, source, discovered_at, queued_count, last_queued_at)
         VALUES ($1, $2, 'character', $3, $4, $5)",
    )
    .bind(id)
    .bind(format!("h{id}"))
    .bind(now() - TimeDelta::days(3))
    .bind(count)
    .bind(last)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(migrations = false, fixtures("killmail_refs"))]
async fn record_inserts_new_refs_and_counts_them(pool: PgPool) {
    assert_eq!(
        record(&pool, &[r(1), r(2)], "character", now())
            .await
            .unwrap(),
        2
    );
    assert_eq!(
        record(&pool, &[r(2), r(3)], "corporation", now())
            .await
            .unwrap(),
        1
    );
    assert_eq!(record(&pool, &[], "corporation", now()).await.unwrap(), 0);
    assert_eq!(count(&pool).await, 3);

    // The first sync to see a killmail keeps its row.
    let source: String =
        sqlx::query_scalar("SELECT source FROM killmail_refs WHERE killmail_id = 2")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(source, "character");
}

#[sqlx::test(migrations = false, fixtures("killmail_refs"))]
async fn walk_stops_on_a_fully_known_page(pool: PgPool) {
    record(&pool, &[r(4), r(5)], "character", now())
        .await
        .unwrap();
    let calls = Cell::new(0);
    let result = walk(
        |n| {
            calls.set(calls.get() + 1);
            async move {
                Ok::<_, EsiError>(match n {
                    1 => page(&[1, 2], Some(3)),
                    2 => page(&[4, 5], Some(3)),
                    _ => page(&[6], Some(3)),
                })
            }
        },
        &pool,
        "character",
        false,
        now(),
    )
    .await
    .unwrap();

    assert_eq!(calls.get(), 2);
    assert_eq!((result.pages, result.found, result.inserted), (2, 4, 2));
    assert!(!result.capped);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs"))]
async fn a_full_sync_walks_past_known_pages_to_x_pages(pool: PgPool) {
    record(&pool, &[r(1), r(2), r(3)], "character", now())
        .await
        .unwrap();
    let calls = Cell::new(0);
    let result = walk(
        |n| {
            calls.set(calls.get() + 1);
            async move { Ok::<_, EsiError>(page(&[n as i32], Some(3))) }
        },
        &pool,
        "character",
        true,
        now(),
    )
    .await
    .unwrap();

    assert_eq!(calls.get(), 3);
    assert_eq!(result.inserted, 0);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs"))]
async fn walk_stops_on_404_and_on_an_empty_page(pool: PgPool) {
    let result = walk(
        |_| async { Ok::<_, EsiError>(None) },
        &pool,
        "character",
        true,
        now(),
    )
    .await
    .unwrap();
    assert_eq!((result.pages, result.found), (0, 0));

    let result = walk(
        |_| async { Ok::<_, EsiError>(page(&[], None)) },
        &pool,
        "character",
        true,
        now(),
    )
    .await
    .unwrap();
    assert_eq!(result.pages, 0);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs"))]
async fn walk_caps_at_14_pages(pool: PgPool) {
    assert_eq!(MAX_PAGES, 14);
    let calls = Cell::new(0);
    let result = walk(
        |n| {
            calls.set(calls.get() + 1);
            async move { Ok::<_, EsiError>(page(&[n as i32], None)) }
        },
        &pool,
        "character",
        false,
        now(),
    )
    .await
    .unwrap();

    assert_eq!(calls.get(), 14);
    assert!(result.capped);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs"))]
async fn failure_mid_walk_keeps_refs(pool: PgPool) {
    let error = walk(
        |n| async move {
            if n < 3 {
                Ok(page(&[n as i32], Some(5)))
            } else {
                Err(EsiError::Http {
                    status: 502,
                    path: "/x".to_owned(),
                })
            }
        },
        &pool,
        "character",
        false,
        now(),
    )
    .await
    .unwrap_err();

    assert!(matches!(
        error.downcast_ref::<EsiError>(),
        Some(EsiError::Http { status: 502, .. })
    ));
    assert_eq!(count(&pool).await, 2);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn pending_follows_the_three_retry_rules(pool: PgPool) {
    let hour = TimeDelta::hours(1);
    queued(&pool, 1, 0, None).await; // never queued: yes
    queued(&pool, 2, 2, Some(now() - hour * 2)).await; // round 3, an hour passed: yes
    queued(&pool, 3, 2, Some(now() - TimeDelta::minutes(30))).await; // too soon: no
    queued(&pool, 4, 5, Some(now() - hour * 5)).await; // daily, a day not passed: no
    queued(&pool, 5, 7, Some(now() - hour * 25)).await; // daily, a day passed: yes
    queued(&pool, 6, 0, None).await;
    stored_killmail(&pool, 6).await; // already written: no

    let picked: Vec<i32> = pending(&pool, now())
        .await
        .unwrap()
        .into_iter()
        .map(|r| r.killmail_id)
        .collect();
    assert_eq!(picked, [5, 2, 1]);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn mark_queued_counts_a_round(pool: PgPool) {
    queued(&pool, 1, 0, None).await;
    queued(&pool, 2, 4, Some(now() - TimeDelta::days(1))).await;

    assert_eq!(mark_queued(&pool, &[1, 2], now()).await.unwrap(), 2);
    let rows: Vec<(i32, i32, Option<NaiveDateTime>)> = sqlx::query_as(
        "SELECT killmail_id, queued_count, last_queued_at FROM killmail_refs ORDER BY killmail_id",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(rows, [(1, 1, Some(now())), (2, 5, Some(now()))]);
}
