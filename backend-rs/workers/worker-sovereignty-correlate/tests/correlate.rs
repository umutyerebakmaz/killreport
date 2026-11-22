//! `correlate` against throwaway databases. `sqlx::test` creates one per test
//! from `DATABASE_URL`'s server; the database `DATABASE_URL` names is never
//! touched.

use chrono::{NaiveDateTime, TimeDelta};
use sqlx::PgPool;
use worker_sovereignty_correlate::{correlate, CorrelateOutcome};

const S: i32 = 30000001;
const OTHER: i32 = 30000002;

fn at(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f").unwrap()
}

fn now() -> NaiveDateTime {
    at("2026-11-22 12:00:00")
}

async fn campaign(
    pool: &PgPool,
    id: i32,
    system: i32,
    start: &str,
    end: Option<&str>,
    defender: Option<i32>,
) {
    sqlx::query(
        "INSERT INTO sovereignty_campaigns
           (campaign_id, constellation_id, solar_system_id, structure_id, event_type,
            defender_id, start_time, end_time, updated_at)
         VALUES ($1, 20000001, $2, 1, 'ihub_defense', $3, $4, $5, '2026-11-20 00:00:00')",
    )
    .bind(id)
    .bind(system)
    .bind(defender)
    .bind(at(start))
    .bind(end.map(at))
    .execute(pool)
    .await
    .unwrap();
}

/// `victim`: `None` = no victim row; `Some(alliance)` = a victim row.
async fn killmail(
    pool: &PgPool,
    id: i32,
    system: i32,
    time: &str,
    value: Option<f64>,
    victim: Option<Option<i32>>,
) {
    sqlx::query(
        "INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id,
                                total_value, updated_at)
         VALUES ($1, 'hash', $2, $3, $4, '2026-01-01 00:00:00')",
    )
    .bind(id)
    .bind(at(time))
    .bind(system)
    .bind(value)
    .execute(pool)
    .await
    .unwrap();
    if let Some(alliance) = victim {
        sqlx::query(
            "INSERT INTO victims (killmail_id, corporation_id, alliance_id, ship_type_id, damage_taken)
             VALUES ($1, 98000001, $2, 587, 100)",
        )
        .bind(id)
        .bind(alliance)
        .execute(pool)
        .await
        .unwrap();
    }
}

async fn tag_of(pool: &PgPool, id: i32) -> (Option<i32>, bool) {
    sqlx::query_as(
        "SELECT related_campaign_id, is_war_related FROM killmails WHERE killmail_id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .unwrap()
}

/// `(war_kills, isk_destroyed, ships_destroyed, defender_isk_lost,
/// attacker_isk_lost, defender_ships_lost, attacker_ships_lost)`.
type Stats = (i32, f64, i32, f64, f64, i32, i32);

async fn stats(pool: &PgPool, campaign_id: i32) -> Option<Stats> {
    sqlx::query_as(
        "SELECT war_kills, isk_destroyed, ships_destroyed, defender_isk_lost,
                attacker_isk_lost, defender_ships_lost, attacker_ships_lost
         FROM campaign_combat_stats WHERE campaign_id = $1",
    )
    .bind(campaign_id)
    .fetch_optional(pool)
    .await
    .unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn window_bounds_for_active_campaign(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, None).await;
    killmail(&pool, 1, S, "2026-11-21 09:59:59.999", None, None).await;
    killmail(&pool, 2, S, "2026-11-21 10:00:00", None, None).await;
    killmail(&pool, 3, S, "2026-11-22 11:59:00", None, None).await;
    killmail(&pool, 4, S, "2026-11-22 12:00:00.001", None, None).await;
    killmail(&pool, 5, OTHER, "2026-11-22 11:00:00", None, None).await;

    let outcome = correlate(&pool, now()).await.unwrap();
    assert_eq!(outcome.tagged, 2);
    assert_eq!(tag_of(&pool, 1).await, (None, false));
    assert_eq!(tag_of(&pool, 2).await, (Some(1), true));
    assert_eq!(tag_of(&pool, 3).await, (Some(1), true));
    assert_eq!(tag_of(&pool, 4).await, (None, false));
    assert_eq!(tag_of(&pool, 5).await, (None, false));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn ended_campaign_is_processed_for_24_hours(pool: PgPool) {
    campaign(
        &pool,
        1,
        S,
        "2026-11-21 08:00:00",
        Some("2026-11-21 13:00:00"),
        None,
    )
    .await;
    killmail(&pool, 1, S, "2026-11-21 13:00:00", Some(10.0), None).await;
    killmail(&pool, 2, S, "2026-11-21 13:00:00.001", Some(10.0), None).await;

    let outcome = correlate(&pool, now()).await.unwrap();
    assert_eq!(outcome.campaigns, 1);
    assert_eq!(tag_of(&pool, 1).await, (Some(1), true));
    assert_eq!(tag_of(&pool, 2).await, (None, false));
    assert_eq!(stats(&pool, 1).await.map(|s| s.0), Some(1));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn campaign_ended_over_24_hours_ago_is_ignored(pool: PgPool) {
    campaign(
        &pool,
        1,
        S,
        "2026-11-21 08:00:00",
        Some("2026-11-21 11:59:59.999"),
        None,
    )
    .await;
    killmail(&pool, 1, S, "2026-11-21 10:00:00", Some(10.0), None).await;

    let outcome = correlate(&pool, now()).await.unwrap();
    assert_eq!(outcome.campaigns, 0);
    assert_eq!(tag_of(&pool, 1).await, (None, false));
    assert_eq!(stats(&pool, 1).await, None);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn overlapping_campaigns_earliest_start_wins(pool: PgPool) {
    campaign(&pool, 20, S, "2026-11-22 10:00:00", None, None).await;
    campaign(&pool, 21, S, "2026-11-22 09:00:00", None, None).await;
    killmail(&pool, 1, S, "2026-11-22 11:00:00", None, None).await;

    correlate(&pool, now()).await.unwrap();
    assert_eq!(tag_of(&pool, 1).await, (Some(21), true));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn equal_starts_lowest_id_wins(pool: PgPool) {
    campaign(&pool, 31, S, "2026-11-22 10:00:00", None, None).await;
    campaign(&pool, 30, S, "2026-11-22 10:00:00", None, None).await;
    killmail(&pool, 1, S, "2026-11-22 11:00:00", None, None).await;

    correlate(&pool, now()).await.unwrap();
    assert_eq!(tag_of(&pool, 1).await, (Some(30), true));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn tagged_killmail_is_not_retagged(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, None).await;
    killmail(&pool, 1, S, "2026-11-22 11:00:00", None, None).await;
    sqlx::query("UPDATE killmails SET related_campaign_id = 99 WHERE killmail_id = 1")
        .execute(&pool)
        .await
        .unwrap();

    let outcome = correlate(&pool, now()).await.unwrap();
    assert_eq!(outcome.tagged, 0);
    assert_eq!(tag_of(&pool, 1).await, (Some(99), false));
    let updated: NaiveDateTime =
        sqlx::query_scalar("SELECT updated_at FROM killmails WHERE killmail_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(updated, at("2026-01-01 00:00:00"));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn defender_attacker_split(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, Some(1)).await;
    killmail(
        &pool,
        1,
        S,
        "2026-11-22 10:01:00",
        Some(100.0),
        Some(Some(1)),
    )
    .await;
    killmail(
        &pool,
        2,
        S,
        "2026-11-22 10:02:00",
        Some(50.0),
        Some(Some(2)),
    )
    .await;
    killmail(&pool, 3, S, "2026-11-22 10:03:00", None, Some(None)).await;
    killmail(&pool, 4, S, "2026-11-22 10:04:00", Some(25.0), None).await;

    correlate(&pool, now()).await.unwrap();
    assert_eq!(
        stats(&pool, 1).await,
        Some((4, 175.0, 4, 100.0, 75.0, 1, 3))
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn null_defender_puts_everything_on_attackers(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, None).await;
    killmail(
        &pool,
        1,
        S,
        "2026-11-22 10:01:00",
        Some(10.0),
        Some(Some(1)),
    )
    .await;
    killmail(
        &pool,
        2,
        S,
        "2026-11-22 10:02:00",
        Some(20.0),
        Some(Some(2)),
    )
    .await;

    correlate(&pool, now()).await.unwrap();
    assert_eq!(stats(&pool, 1).await, Some((2, 30.0, 2, 0.0, 30.0, 0, 2)));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn rerun_is_stable(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, Some(1)).await;
    killmail(
        &pool,
        1,
        S,
        "2026-11-22 10:01:00",
        Some(100.0),
        Some(Some(1)),
    )
    .await;
    killmail(
        &pool,
        2,
        S,
        "2026-11-22 10:02:00",
        Some(50.0),
        Some(Some(2)),
    )
    .await;

    correlate(&pool, now()).await.unwrap();
    let first = stats(&pool, 1).await;
    let later = now() + TimeDelta::minutes(10);
    let outcome = correlate(&pool, later).await.unwrap();

    assert_eq!(
        outcome,
        CorrelateOutcome {
            campaigns: 1,
            tagged: 0,
            with_kills: 1
        }
    );
    assert_eq!(stats(&pool, 1).await, first);
    let last: NaiveDateTime = sqlx::query_scalar(
        "SELECT last_correlated FROM campaign_combat_stats WHERE campaign_id = 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(last, later);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn campaign_without_kills_gets_no_row(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, None).await;

    let outcome = correlate(&pool, now()).await.unwrap();
    assert_eq!(outcome.with_kills, 0);
    assert_eq!(stats(&pool, 1).await, None);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn updated_at_is_the_bound_now(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, None).await;
    killmail(&pool, 1, S, "2026-11-22 11:00:00", None, None).await;

    correlate(&pool, now()).await.unwrap();
    let updated: NaiveDateTime =
        sqlx::query_scalar("SELECT updated_at FROM killmails WHERE killmail_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(updated, now());
}

/// A concurrent run that tags a row between this run's snapshot and its
/// row lock wins: the outer `UPDATE` re-checks `related_campaign_id IS NULL`
/// after the wait, so the row keeps the other run's tag.
#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_campaigns",
        "killmails",
        "victims",
        "campaign_combat_stats"
    )
)]
async fn concurrent_tag_is_not_overwritten(pool: PgPool) {
    campaign(&pool, 1, S, "2026-11-22 10:00:00", None, None).await;
    killmail(&pool, 1, S, "2026-11-22 11:00:00", None, None).await;

    let mut other = pool.begin().await.unwrap();
    sqlx::query("UPDATE killmails SET related_campaign_id = 99 WHERE killmail_id = 1")
        .execute(&mut *other)
        .await
        .unwrap();

    let run = tokio::spawn({
        let pool = pool.clone();
        async move { correlate(&pool, now()).await.unwrap() }
    });
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    other.commit().await.unwrap();

    let outcome = run.await.unwrap();
    assert_eq!(outcome.tagged, 0);
    assert_eq!(tag_of(&pool, 1).await, (Some(99), false));
}
