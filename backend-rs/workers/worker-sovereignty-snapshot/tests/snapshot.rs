//! `snapshot` against throwaway databases. `sqlx::test` creates one per test
//! from `DATABASE_URL`'s server; the database `DATABASE_URL` names is never
//! touched.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use worker_sovereignty_snapshot::{snapshot, snapshot_date, SnapshotOutcome};

const IHUB: i32 = 32458;
const TCU: i32 = 32226;

fn d() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 11, 20).unwrap()
}

async fn exec(pool: &PgPool, sql: &str) {
    sqlx::query(sql).execute(pool).await.unwrap();
}

async fn system(pool: &PgPool, system_id: i32, alliance_id: Option<i32>, faction_id: Option<i32>) {
    sqlx::query(
        "INSERT INTO sovereignty_map_current
           (solar_system_id, alliance_id, corporation_id, faction_id, last_updated)
         VALUES ($1, $2, $3, $4, '2026-11-20 12:00:00')",
    )
    .bind(system_id)
    .bind(alliance_id)
    .bind(alliance_id.map(|a| a + 1000))
    .bind(faction_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn structure(pool: &PgPool, id: i64, alliance_id: i32, type_id: i32, destroyed: bool) {
    sqlx::query(
        "INSERT INTO sovereignty_structures
           (structure_id, solar_system_id, structure_type_id, alliance_id, last_seen, destroyed_at)
         VALUES ($1, 30000001, $2, $3, '2026-11-20 12:00:00',
                 CASE WHEN $4 THEN TIMESTAMP '2026-11-20 13:00:00' END)",
    )
    .bind(id)
    .bind(type_id)
    .bind(alliance_id)
    .bind(destroyed)
    .execute(pool)
    .await
    .unwrap();
}

async fn campaign(
    pool: &PgPool,
    id: i32,
    defender_id: Option<i32>,
    ended: bool,
    participants: &[i32],
) {
    sqlx::query(
        "INSERT INTO sovereignty_campaigns
           (campaign_id, constellation_id, solar_system_id, structure_id, event_type,
            defender_id, start_time, end_time, updated_at)
         VALUES ($1, 20000001, 30000001, 1, 'ihub_defense', $2, '2026-11-20 10:00:00',
                 CASE WHEN $3 THEN TIMESTAMP '2026-11-20 11:00:00' END, '2026-11-20 10:00:00')",
    )
    .bind(id)
    .bind(defender_id)
    .bind(ended)
    .execute(pool)
    .await
    .unwrap();
    for alliance_id in participants {
        sqlx::query(
            "INSERT INTO campaign_participants (campaign_id, alliance_id, score, updated_at)
             VALUES ($1, $2, 0.5, '2026-11-20 10:00:00')",
        )
        .bind(id)
        .bind(alliance_id)
        .execute(pool)
        .await
        .unwrap();
    }
}

async fn change(pool: &PgPool, previous: i32, new: i32, at: &str) {
    sqlx::query(
        "INSERT INTO territory_changes
           (solar_system_id, previous_owner_id, new_owner_id, change_type, detected_at)
         VALUES (30000001, $1, $2, 'transferred', $3::timestamp)",
    )
    .bind(previous)
    .bind(new)
    .bind(at)
    .execute(pool)
    .await
    .unwrap();
}

/// `(systems_controlled, ihub_count, tcu_count, campaigns_attacking,
/// campaigns_defending, systems_gained, systems_lost)` of one alliance on `D`.
type Stats = (i32, i32, i32, i32, i32, i32, i32);

async fn stats(pool: &PgPool, alliance_id: i32) -> Option<Stats> {
    sqlx::query_as(
        "SELECT systems_controlled, ihub_count, tcu_count, campaigns_attacking,
                campaigns_defending, systems_gained, systems_lost
         FROM alliance_territory_stats WHERE alliance_id = $1 AND date = $2",
    )
    .bind(alliance_id)
    .bind(d())
    .fetch_optional(pool)
    .await
    .unwrap()
}

async fn count(pool: &PgPool, sql: &str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
}

fn utc(s: &str) -> DateTime<Utc> {
    s.parse().unwrap()
}

#[test]
fn snapshot_date_is_previous_utc_day() {
    assert_eq!(snapshot_date(utc("2026-11-21T01:00:00Z")), d());
    assert_eq!(snapshot_date(utc("2026-11-21T00:00:00Z")), d());
    assert_eq!(
        snapshot_date(utc("2026-11-20T23:59:59Z")),
        NaiveDate::from_ymd_opt(2026, 11, 19).unwrap()
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn empty_map_writes_nothing(pool: PgPool) {
    exec(
        &pool,
        "INSERT INTO sovereignty_map_snapshots (solar_system_id, alliance_id, snapshot_date)
         VALUES (30000001, 1, '2026-11-20')",
    )
    .await;
    exec(
        &pool,
        "INSERT INTO alliance_territory_stats (alliance_id, date, systems_controlled)
         VALUES (1, '2026-11-20', 5)",
    )
    .await;

    assert_eq!(
        snapshot(&pool, d()).await.unwrap(),
        SnapshotOutcome::EmptyMap
    );
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM sovereignty_map_snapshots").await,
        1
    );
    assert_eq!(stats(&pool, 1).await.map(|s| s.0), Some(5));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn counts_systems_and_live_structures(pool: PgPool) {
    system(&pool, 30000001, Some(1), None).await;
    system(&pool, 30000002, Some(1), None).await;
    system(&pool, 30000003, None, Some(500001)).await;
    structure(&pool, 1, 1, IHUB, false).await;
    structure(&pool, 2, 1, IHUB, true).await;
    structure(&pool, 3, 1, TCU, false).await;

    assert_eq!(
        snapshot(&pool, d()).await.unwrap(),
        SnapshotOutcome::Written {
            map_rows: 3,
            stat_rows: 1
        }
    );
    assert_eq!(stats(&pool, 1).await, Some((2, 1, 1, 0, 0, 0, 0)));
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM sovereignty_map_snapshots WHERE snapshot_date = '2026-11-20'"
        )
        .await,
        3
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM sovereignty_map_snapshots
             WHERE alliance_id IS NULL AND faction_id = 500001"
        )
        .await,
        1
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn gained_lost_cover_the_full_utc_day(pool: PgPool) {
    system(&pool, 30000001, Some(1), None).await;
    change(&pool, 2, 1, "2026-11-19 23:59:59.999").await;
    change(&pool, 2, 1, "2026-11-20 00:00:00").await;
    change(&pool, 2, 1, "2026-11-20 23:59:59.999").await;
    change(&pool, 2, 1, "2026-11-21 00:00:00").await;

    snapshot(&pool, d()).await.unwrap();
    assert_eq!(stats(&pool, 1).await.map(|s| s.5), Some(2));
    assert_eq!(stats(&pool, 2).await.map(|s| s.6), Some(2));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn defender_is_not_counted_as_attacker(pool: PgPool) {
    system(&pool, 30000001, Some(1), None).await;
    campaign(&pool, 10, Some(1), false, &[1, 2]).await;
    campaign(&pool, 11, Some(3), true, &[2]).await;

    snapshot(&pool, d()).await.unwrap();
    let one = stats(&pool, 1).await.unwrap();
    assert_eq!((one.3, one.4), (0, 1));
    assert_eq!(stats(&pool, 2).await.map(|s| s.3), Some(1));
    assert_eq!(stats(&pool, 3).await, None);
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn null_defender_counts_every_participant(pool: PgPool) {
    system(&pool, 30000001, Some(1), None).await;
    campaign(&pool, 10, None, false, &[1, 2]).await;

    snapshot(&pool, d()).await.unwrap();
    assert_eq!(stats(&pool, 1).await.map(|s| s.3), Some(1));
    assert_eq!(stats(&pool, 2).await.map(|s| s.3), Some(1));
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn rerun_replaces_the_day(pool: PgPool) {
    system(&pool, 30000001, Some(1), None).await;
    system(&pool, 30000002, Some(3), None).await;
    snapshot(&pool, d()).await.unwrap();
    assert!(stats(&pool, 3).await.is_some());

    exec(
        &pool,
        "DELETE FROM sovereignty_map_current WHERE solar_system_id = 30000002",
    )
    .await;
    snapshot(&pool, d()).await.unwrap();

    assert_eq!(stats(&pool, 3).await, None);
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM sovereignty_map_snapshots").await,
        1
    );
}

#[sqlx::test(
    migrations = false,
    fixtures(
        "sovereignty_map_current",
        "sovereignty_map_snapshots",
        "sovereignty_structures",
        "sovereignty_campaigns",
        "campaign_participants",
        "territory_changes",
        "alliance_territory_stats"
    )
)]
async fn other_days_are_untouched(pool: PgPool) {
    exec(
        &pool,
        "INSERT INTO sovereignty_map_snapshots (solar_system_id, alliance_id, snapshot_date)
         VALUES (30000009, 9, '2026-11-19')",
    )
    .await;
    exec(
        &pool,
        "INSERT INTO alliance_territory_stats (alliance_id, date, systems_controlled)
         VALUES (9, '2026-11-19', 7)",
    )
    .await;
    system(&pool, 30000001, Some(1), None).await;

    snapshot(&pool, d()).await.unwrap();
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM sovereignty_map_snapshots
             WHERE snapshot_date = '2026-11-19' AND alliance_id = 9"
        )
        .await,
        1
    );
    assert_eq!(
        count(
            &pool,
            "SELECT systems_controlled::bigint FROM alliance_territory_stats
             WHERE alliance_id = 9 AND date = '2026-11-19'"
        )
        .await,
        7
    );
}
