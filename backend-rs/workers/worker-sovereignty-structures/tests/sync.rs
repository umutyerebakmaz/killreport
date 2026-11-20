//! `write_structures` and `sync` against throwaway databases. `sqlx::test`
//! creates one per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use chrono::{NaiveDateTime, Utc};
use esi::{EsiClient, RateLimiter};
use serde_json::json;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_sovereignty_structures::{sync, write_structures, EsiStructure, StructuresOutcome};

fn at(s: &str) -> NaiveDateTime {
    s.parse::<chrono::DateTime<Utc>>().unwrap().naive_utc()
}

fn now() -> NaiveDateTime {
    at("2026-11-20T12:34:56.789Z")
}

fn structure(id: i64, system: i32, kind: i32, alliance: i32) -> EsiStructure {
    EsiStructure {
        structure_id: id,
        solar_system_id: system,
        structure_type_id: kind,
        alliance_id: alliance,
        vulnerability_occupancy_level: None,
        vulnerable_start_time: None,
        vulnerable_end_time: None,
    }
}

async fn seed(pool: &PgPool, id: i64, destroyed_at: Option<NaiveDateTime>) {
    sqlx::query(
        "INSERT INTO sovereignty_structures
           (structure_id, solar_system_id, structure_type_id, alliance_id, first_seen, last_seen, destroyed_at)
         VALUES ($1, 1, 32226, 1, $2, $2, $3)",
    )
    .bind(id)
    .bind(at("2026-11-01T00:00:00Z"))
    .bind(destroyed_at)
    .execute(pool)
    .await
    .unwrap();
}

async fn destroyed_at(pool: &PgPool, id: i64) -> Option<NaiveDateTime> {
    sqlx::query_scalar("SELECT destroyed_at FROM sovereignty_structures WHERE structure_id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn inserts_new_structures(pool: PgPool) {
    let feed = [
        structure(1, 30000001, 32226, 1),
        structure(2, 30000002, 32458, 1),
    ];
    let outcome = write_structures(&pool, &feed, now()).await.unwrap();
    assert_eq!(
        outcome,
        StructuresOutcome::Synced {
            upserted: 2,
            destroyed: 0
        }
    );
    let rows: Vec<(NaiveDateTime, NaiveDateTime, Option<NaiveDateTime>)> = sqlx::query_as(
        "SELECT first_seen, last_seen, destroyed_at FROM sovereignty_structures ORDER BY structure_id",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(rows, vec![(now(), now(), None), (now(), now(), None)]);
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn updates_owner_and_window_keeps_system_and_type(pool: PgPool) {
    seed(&pool, 1, None).await;
    let mut s = structure(1, 2, 99, 2);
    s.vulnerability_occupancy_level = Some(1.5);
    s.vulnerable_start_time = Some("2026-11-21T18:00:00Z".parse().unwrap());
    s.vulnerable_end_time = Some("2026-11-21T22:00:00Z".parse().unwrap());
    write_structures(&pool, &[s], now()).await.unwrap();

    let row: (
        i32,
        i32,
        i32,
        Option<f64>,
        Option<NaiveDateTime>,
        Option<NaiveDateTime>,
        NaiveDateTime,
    ) = sqlx::query_as(
        "SELECT solar_system_id, structure_type_id, alliance_id, vulnerability_occupancy_level,
                    vulnerable_start_time, vulnerable_end_time, last_seen
             FROM sovereignty_structures WHERE structure_id = 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        row,
        (
            1,
            32226,
            2,
            Some(1.5),
            Some(at("2026-11-21T18:00:00Z")),
            Some(at("2026-11-21T22:00:00Z")),
            now()
        )
    );
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn marks_missing_structures_destroyed(pool: PgPool) {
    seed(&pool, 1, None).await;
    seed(&pool, 2, None).await;
    let outcome = write_structures(&pool, &[structure(1, 1, 32226, 1)], now())
        .await
        .unwrap();
    assert_eq!(
        outcome,
        StructuresOutcome::Synced {
            upserted: 1,
            destroyed: 1
        }
    );
    assert_eq!(destroyed_at(&pool, 2).await, Some(now()));
    assert_eq!(destroyed_at(&pool, 1).await, None);
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn already_destroyed_is_not_touched_again(pool: PgPool) {
    let t0 = at("2026-11-10T00:00:00Z");
    seed(&pool, 1, None).await;
    seed(&pool, 2, Some(t0)).await;
    write_structures(&pool, &[structure(1, 1, 32226, 1)], now())
        .await
        .unwrap();
    assert_eq!(destroyed_at(&pool, 2).await, Some(t0));
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn a_reappearing_structure_is_revived(pool: PgPool) {
    seed(&pool, 1, None).await;
    seed(&pool, 2, Some(at("2026-11-10T00:00:00Z"))).await;
    write_structures(
        &pool,
        &[structure(1, 1, 32226, 1), structure(2, 1, 32226, 1)],
        now(),
    )
    .await
    .unwrap();
    assert_eq!(destroyed_at(&pool, 2).await, None);
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn empty_feed_writes_nothing(pool: PgPool) {
    seed(&pool, 1, None).await;
    let outcome = write_structures(&pool, &[], now()).await.unwrap();
    assert_eq!(outcome, StructuresOutcome::EmptyFeed);
    assert_eq!(destroyed_at(&pool, 1).await, None);
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn now_is_bound_with_a_non_utc_session(
    _pool_opts: PgPoolOptions,
    conn_opts: PgConnectOptions,
) {
    let pool = PgPoolOptions::new()
        .connect_with(conn_opts.options([("TimeZone", "Europe/Istanbul")]))
        .await
        .unwrap();
    seed(&pool, 1, None).await;
    seed(&pool, 2, None).await;
    write_structures(&pool, &[structure(1, 1, 32226, 1)], now())
        .await
        .unwrap();
    assert_eq!(destroyed_at(&pool, 2).await, Some(now()));
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn sync_reads_the_esi_list(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/sovereignty/structures"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([
            {
                "alliance_id": 99000001,
                "solar_system_id": 30000001,
                "structure_id": 1018253388776_i64,
                "structure_type_id": 32226,
                "vulnerability_occupancy_level": 2.0,
                "vulnerable_start_time": "2026-11-21T18:00:00Z",
                "vulnerable_end_time": "2026-11-21T22:00:00Z"
            },
            {
                "alliance_id": 99000001,
                "solar_system_id": 30000002,
                "structure_id": 1018253388777_i64,
                "structure_type_id": 32458
            }
        ])))
        .expect(1)
        .mount(&server)
        .await;
    let esi = EsiClient::with_base_url(RateLimiter::new(50), server.uri());
    let (received, outcome) = sync(&esi, &pool, now()).await.unwrap();
    assert_eq!(received, 2);
    assert_eq!(
        outcome,
        StructuresOutcome::Synced {
            upserted: 2,
            destroyed: 0
        }
    );
}

#[sqlx::test(migrations = false, fixtures("sovereignty_structures"))]
async fn a_duplicate_id_in_the_feed_keeps_the_last(pool: PgPool) {
    let feed = [structure(1, 1, 32226, 1), structure(1, 1, 32226, 2)];
    let outcome = write_structures(&pool, &feed, now()).await.unwrap();
    assert_eq!(
        outcome,
        StructuresOutcome::Synced {
            upserted: 1,
            destroyed: 0
        }
    );
    let alliance: i32 =
        sqlx::query_scalar("SELECT alliance_id FROM sovereignty_structures WHERE structure_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(alliance, 2);
}
