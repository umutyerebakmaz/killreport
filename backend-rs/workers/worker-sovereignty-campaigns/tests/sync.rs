//! `write_campaigns` and `sync` against throwaway databases. `sqlx::test`
//! creates one per test from `DATABASE_URL`'s server; the database
//! `DATABASE_URL` names is never touched.

use chrono::{NaiveDateTime, Utc};
use esi::{EsiClient, RateLimiter};
use serde_json::{json, Value};
use sov::AlertEvent;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_sovereignty_campaigns::{infer_outcome, sync, write_campaigns, EsiCampaign};

fn at(s: &str) -> NaiveDateTime {
    s.parse::<chrono::DateTime<Utc>>().unwrap().naive_utc()
}

fn now() -> NaiveDateTime {
    at("2026-11-20T12:34:56.789Z")
}

/// A campaign as ESI sends it; `system` doubles as the defender's id offset
/// so alerts are easy to tell apart.
fn esi(id: i32, extra: Value) -> Value {
    let mut c = json!({
        "campaign_id": id,
        "constellation_id": 20000001,
        "solar_system_id": 30000000 + id,
        "structure_id": 1000000000000_i64 + id as i64,
        "event_type": "tcu_defense",
        "defender_id": 99000000 + id,
        "defender_score": 0.6,
        "attackers_score": 0.4,
        "start_time": "2026-11-20T10:00:00Z",
        "participants": []
    });
    if let (Some(base), Some(extra)) = (c.as_object_mut(), extra.as_object()) {
        for (k, v) in extra {
            if v.is_null() {
                base.remove(k);
            } else {
                base.insert(k.clone(), v.clone());
            }
        }
    }
    c
}

fn campaign(id: i32, extra: Value) -> EsiCampaign {
    serde_json::from_value(esi(id, extra)).unwrap()
}

/// An active campaign already stored, scores (d, a).
async fn seed(
    pool: &PgPool,
    id: i32,
    d: Option<f64>,
    a: Option<f64>,
    end: Option<NaiveDateTime>,
    outcome: Option<&str>,
) {
    sqlx::query(
        "INSERT INTO sovereignty_campaigns
           (campaign_id, constellation_id, solar_system_id, structure_id, event_type,
            defender_id, defender_score, attackers_score, start_time, end_time, outcome,
            first_seen, updated_at)
         VALUES ($1, 20000001, 30000000 + $1, 1000000000000 + $1, 'tcu_defense',
                 99000000 + $1, $2, $3, $4, $5, $6, $4, $4)",
    )
    .bind(id)
    .bind(d)
    .bind(a)
    .bind(at("2026-11-19T10:00:00Z"))
    .bind(end)
    .bind(outcome)
    .execute(pool)
    .await
    .unwrap();
}

async fn end_of(pool: &PgPool, id: i32) -> (Option<NaiveDateTime>, Option<String>) {
    sqlx::query_as("SELECT end_time, outcome FROM sovereignty_campaigns WHERE campaign_id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn started(id: i32) -> AlertEvent {
    AlertEvent::CampaignStarted {
        system_id: 30000000 + id,
        defender_id: Some(99000000 + id),
    }
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn baseline_import_has_no_started_alerts(pool: PgPool) {
    let feed = [campaign(1, json!({})), campaign(2, json!({}))];
    let o = write_campaigns(&pool, &feed, now()).await.unwrap();
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM sovereignty_campaigns")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
    assert_eq!(o.active, 2);
    assert!(o.alerts.is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn a_new_campaign_alerts(pool: PgPool) {
    seed(&pool, 1, Some(0.5), Some(0.5), None, None).await;
    let feed = [campaign(1, json!({})), campaign(2, json!({}))];
    let o = write_campaigns(&pool, &feed, now()).await.unwrap();
    assert_eq!(o.alerts, vec![started(2)]);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn updates_scores_keeps_identity(pool: PgPool) {
    seed(&pool, 1, Some(0.5), Some(0.5), None, None).await;
    let feed = [campaign(
        1,
        json!({ "defender_score": 0.9, "attackers_score": 0.1, "event_type": "ihub_defense",
                "start_time": "2026-11-20T11:00:00Z" }),
    )];
    write_campaigns(&pool, &feed, now()).await.unwrap();
    let row: (
        Option<f64>,
        Option<f64>,
        String,
        NaiveDateTime,
        NaiveDateTime,
    ) = sqlx::query_as(
        "SELECT defender_score, attackers_score, event_type, start_time, updated_at
         FROM sovereignty_campaigns WHERE campaign_id = 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        row,
        (
            Some(0.9),
            Some(0.1),
            "tcu_defense".into(),
            at("2026-11-19T10:00:00Z"),
            now()
        )
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn a_reappearing_campaign_reopens(pool: PgPool) {
    seed(
        &pool,
        1,
        Some(0.0),
        Some(0.0),
        Some(at("2026-11-19T12:00:00Z")),
        Some("abandoned"),
    )
    .await;
    let o = write_campaigns(&pool, &[campaign(1, json!({}))], now())
        .await
        .unwrap();
    assert_eq!(end_of(&pool, 1).await, (None, None));
    assert!(o.alerts.is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn upserts_participants(pool: PgPool) {
    let first = campaign(
        1,
        json!({ "participants": [{ "alliance_id": 1, "score": 0.3 }, { "alliance_id": 2, "score": 0.1 }] }),
    );
    let o = write_campaigns(&pool, &[first], now()).await.unwrap();
    assert_eq!(o.participants, 2);
    let second = campaign(
        1,
        json!({ "participants": [{ "alliance_id": 1, "score": 0.5 }] }),
    );
    write_campaigns(&pool, &[second], now()).await.unwrap();
    let rows: Vec<(i32, f64)> = sqlx::query_as(
        "SELECT alliance_id, score FROM campaign_participants WHERE campaign_id = 1 ORDER BY alliance_id",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(rows, vec![(1, 0.5), (2, 0.1)]);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn a_campaign_without_participants_or_defender(pool: PgPool) {
    let bare = campaign(
        1,
        json!({ "participants": null, "defender_id": null, "defender_score": null }),
    );
    let o = write_campaigns(&pool, &[bare], now()).await.unwrap();
    assert_eq!(o.participants, 0);
    let defender: Option<i32> =
        sqlx::query_scalar("SELECT defender_id FROM sovereignty_campaigns WHERE campaign_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(defender, None);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn ends_missing_campaigns_with_outcome(pool: PgPool) {
    seed(&pool, 1, Some(0.5), Some(0.5), None, None).await;
    seed(&pool, 2, Some(0.2), Some(0.7), None, None).await;
    let o = write_campaigns(&pool, &[campaign(1, json!({}))], now())
        .await
        .unwrap();
    let outcome = infer_outcome(Some(0.2), Some(0.7));
    assert_eq!(o.ended, 1);
    assert_eq!(
        end_of(&pool, 2).await,
        (Some(now()), Some(outcome.to_owned()))
    );
    assert_eq!(
        o.alerts,
        vec![AlertEvent::CampaignEnded {
            system_id: 30000002,
            defender_id: Some(99000002),
            outcome: Some(outcome.to_owned()),
        }]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn empty_feed_skips_end_marking(pool: PgPool) {
    seed(&pool, 1, Some(0.5), Some(0.5), None, None).await;
    let o = write_campaigns(&pool, &[], now()).await.unwrap();
    assert!(o.skipped_end_marking);
    assert_eq!(o.ended, 0);
    assert_eq!(end_of(&pool, 1).await, (None, None));
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn alerts_are_capped_in_total_started_first(pool: PgPool) {
    // One stored campaign that stays, ten that disappear, twenty new ones.
    seed(&pool, 1, Some(0.5), Some(0.5), None, None).await;
    for id in 100..110 {
        seed(&pool, id, Some(0.5), Some(0.5), None, None).await;
    }
    let mut feed = vec![campaign(1, json!({}))];
    feed.extend((200..220).map(|id| campaign(id, json!({}))));
    let o = write_campaigns(&pool, &feed, now()).await.unwrap();

    assert_eq!(o.alerts.len(), 25);
    assert!(o.alerts[..20]
        .iter()
        .all(|a| matches!(a, AlertEvent::CampaignStarted { .. })));
    assert!(o.alerts[20..]
        .iter()
        .all(|a| matches!(a, AlertEvent::CampaignEnded { .. })));
    assert_eq!(o.ended, 10);
    let still_open: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM sovereignty_campaigns WHERE campaign_id BETWEEN 100 AND 109 AND end_time IS NULL",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(still_open, 0);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn now_is_bound_with_a_non_utc_session(
    _pool_opts: PgPoolOptions,
    conn_opts: PgConnectOptions,
) {
    let pool = PgPoolOptions::new()
        .connect_with(conn_opts.options([("TimeZone", "Europe/Istanbul")]))
        .await
        .unwrap();
    seed(&pool, 1, Some(0.5), Some(0.5), None, None).await;
    seed(&pool, 2, Some(0.5), Some(0.5), None, None).await;
    write_campaigns(&pool, &[campaign(1, json!({}))], now())
        .await
        .unwrap();
    assert_eq!(end_of(&pool, 2).await.0, Some(now()));
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn sync_reads_the_esi_list(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/sovereignty/campaigns"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([esi(1, json!({}))])))
        .expect(1)
        .mount(&server)
        .await;
    let esi = EsiClient::with_base_url(RateLimiter::new(50), server.uri());
    let o = sync(&esi, &pool, now()).await.unwrap();
    assert_eq!(o.active, 1);
}

#[sqlx::test(
    migrations = false,
    fixtures("sovereignty_campaigns", "campaign_participants")
)]
async fn duplicate_ids_in_the_feed_keep_the_last(pool: PgPool) {
    let feed = [
        campaign(
            1,
            json!({ "defender_score": 0.1, "participants": [{ "alliance_id": 1, "score": 0.1 }] }),
        ),
        campaign(
            1,
            json!({ "defender_score": 0.9, "participants": [{ "alliance_id": 1, "score": 0.2 }, { "alliance_id": 1, "score": 0.3 }] }),
        ),
    ];
    let o = write_campaigns(&pool, &feed, now()).await.unwrap();
    assert_eq!(o.active, 1);
    let score: Option<f64> = sqlx::query_scalar(
        "SELECT defender_score FROM sovereignty_campaigns WHERE campaign_id = 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(score, Some(0.9));
    let p: f64 = sqlx::query_scalar(
        "SELECT score FROM campaign_participants WHERE campaign_id = 1 AND alliance_id = 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(p, 0.3);
}
