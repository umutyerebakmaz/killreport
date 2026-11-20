//! `write_map` and `sync` against throwaway databases. `sqlx::test` creates
//! one per test from `DATABASE_URL`'s server; the database `DATABASE_URL`
//! names is never touched.

use chrono::{NaiveDateTime, Utc};
use esi::{EsiClient, RateLimiter};
use serde_json::json;
use sov::AlertEvent;
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_sovereignty_map::{sync, write_map, EsiSovSystem, MapOutcome};

fn now() -> NaiveDateTime {
    "2026-11-20T12:34:56.789Z"
        .parse::<chrono::DateTime<Utc>>()
        .unwrap()
        .naive_utc()
}

fn owned(system_id: i32, alliance: i32) -> EsiSovSystem {
    EsiSovSystem {
        system_id,
        alliance_id: Some(alliance),
        corporation_id: Some(1000 + alliance),
        faction_id: None,
    }
}

async fn seed(pool: &PgPool, system_id: i32, alliance: i32) {
    sqlx::query(
        "INSERT INTO sovereignty_map_current (solar_system_id, alliance_id, corporation_id, last_updated)
         VALUES ($1, $2, 1000 + $2, '2026-11-19')",
    )
    .bind(system_id)
    .bind(alliance)
    .execute(pool)
    .await
    .unwrap();
}

async fn current(pool: &PgPool) -> Vec<(i32, Option<i32>)> {
    sqlx::query_as("SELECT solar_system_id, alliance_id FROM sovereignty_map_current ORDER BY 1")
        .fetch_all(pool)
        .await
        .unwrap()
}

async fn change_count(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM territory_changes")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_map_current", "territory_changes")
)]
async fn first_run_fills_the_baseline(pool: PgPool) {
    let o = write_map(&pool, &[owned(1, 1), owned(2, 2)], now())
        .await
        .unwrap();
    let MapOutcome::Synced {
        initial,
        changes,
        owned: n,
        ..
    } = o
    else {
        panic!("expected Synced, got {o:?}");
    };
    assert!(initial);
    assert_eq!((changes, n), (0, 2));
    assert_eq!(current(&pool).await, vec![(1, Some(1)), (2, Some(2))]);
    assert_eq!(change_count(&pool).await, 0);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_map_current", "territory_changes")
)]
async fn a_change_is_written_with_its_row(pool: PgPool) {
    seed(&pool, 1, 1).await;
    let o = write_map(&pool, &[owned(1, 2)], now()).await.unwrap();
    let MapOutcome::Synced { alerts, .. } = o else {
        panic!("expected Synced");
    };
    assert_eq!(
        alerts,
        vec![AlertEvent::TerritoryChange {
            system_id: 1,
            previous_owner_id: Some(1),
            new_owner_id: Some(2),
            change_type: Some("transferred".into()),
        }]
    );
    let row: (Option<i32>, NaiveDateTime) = sqlx::query_as(
        "SELECT alliance_id, last_updated FROM sovereignty_map_current WHERE solar_system_id = 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row, (Some(2), now()));
    let change: (i32, Option<i32>, Option<i32>, String, NaiveDateTime) = sqlx::query_as(
        "SELECT solar_system_id, previous_owner_id, new_owner_id, change_type, detected_at FROM territory_changes",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(change, (1, Some(1), Some(2), "transferred".into(), now()));
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_map_current", "territory_changes")
)]
async fn no_owned_systems_writes_nothing(pool: PgPool) {
    seed(&pool, 1, 1).await;
    let unowned = EsiSovSystem {
        system_id: 1,
        alliance_id: None,
        corporation_id: None,
        faction_id: None,
    };
    for feed in [vec![], vec![unowned]] {
        let o = write_map(&pool, &feed, now()).await.unwrap();
        assert!(matches!(o, MapOutcome::NoOwnedSystems), "{o:?}");
    }
    assert_eq!(current(&pool).await, vec![(1, Some(1))]);
    assert_eq!(change_count(&pool).await, 0);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_map_current", "territory_changes")
)]
async fn writes_are_atomic(pool: PgPool) {
    seed(&pool, 1, 1).await;
    seed(&pool, 2, 2).await;
    sqlx::query("ALTER TABLE sovereignty_map_current ADD CONSTRAINT ck CHECK (alliance_id <> 666)")
        .execute(&pool)
        .await
        .unwrap();
    // System 1 changes hands to an alliance the constraint rejects, system 2
    // is lost: the change rows go in first, then the upsert fails.
    assert!(write_map(&pool, &[owned(1, 666)], now()).await.is_err());
    assert_eq!(change_count(&pool).await, 0);
    assert_eq!(current(&pool).await, vec![(1, Some(1)), (2, Some(2))]);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_map_current", "territory_changes")
)]
async fn alerts_are_capped(pool: PgPool) {
    for id in 1..=30 {
        seed(&pool, id, 1).await;
    }
    let feed: Vec<EsiSovSystem> = (1..=30).map(|id| owned(id, 2)).collect();
    let o = write_map(&pool, &feed, now()).await.unwrap();
    let MapOutcome::Synced {
        alerts, changes, ..
    } = o
    else {
        panic!("expected Synced");
    };
    assert_eq!(changes, 30);
    assert_eq!(alerts.len(), 25);
    assert_eq!(change_count(&pool).await, 30);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_map_current", "territory_changes")
)]
async fn sync_reads_the_esi_list(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/sovereignty/map"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([
            { "system_id": 30000001, "alliance_id": 99000001, "corporation_id": 98000001 },
            { "system_id": 30000002, "faction_id": 500001 },
            { "system_id": 30000003 }
        ])))
        .expect(1)
        .mount(&server)
        .await;
    let esi = EsiClient::with_base_url(RateLimiter::new(50), server.uri());
    let (received, o) = sync(&esi, &pool, now()).await.unwrap();
    assert_eq!(received, 3);
    assert!(matches!(o, MapOutcome::Synced { owned: 2, .. }), "{o:?}");
}
