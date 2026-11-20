//! `build_alert` against throwaway databases. `sqlx::test` creates one per
//! test from `DATABASE_URL`'s server; the database `DATABASE_URL` names is
//! never touched.

use chrono::{DateTime, Utc};
use sov::{build_alert, AlertEvent};
use sqlx::PgPool;

fn noon() -> DateTime<Utc> {
    "2026-11-20T12:00:00Z".parse().unwrap()
}

#[sqlx::test(
    migrations = false,
    fixtures("regions", "constellations", "solar_systems", "alliances", "rows")
)]
async fn builds_system_region_and_alliance(pool: PgPool) {
    let event = AlertEvent::CampaignStarted {
        system_id: 30000001,
        defender_id: Some(99000001),
    };
    let alert = build_alert(&pool, &event, noon()).await.unwrap();
    assert_eq!(alert.r#type, "campaign_started");
    assert_eq!(alert.message, "New sovereignty campaign in 1DQ1-A (Delve)");
    assert_eq!(alert.solar_system_id, 30000001);
    assert_eq!(alert.solar_system_name.as_deref(), Some("1DQ1-A"));
    assert_eq!(alert.region_name.as_deref(), Some("Delve"));
    assert_eq!(alert.alliance_id, Some(99000001));
    assert_eq!(alert.alliance_name.as_deref(), Some("Goonswarm"));
    assert_eq!(alert.alliance_ticker.as_deref(), Some("CONDI"));
    assert_eq!(alert.outcome, None);
    assert_eq!(alert.change_type, None);
    assert_eq!(alert.timestamp, "2026-11-20T12:00:00.000Z");
}

#[sqlx::test(
    migrations = false,
    fixtures("regions", "constellations", "solar_systems", "alliances", "rows")
)]
async fn system_without_constellation_has_no_region(pool: PgPool) {
    let event = AlertEvent::CampaignStarted {
        system_id: 30000002,
        defender_id: None,
    };
    let alert = build_alert(&pool, &event, noon()).await.unwrap();
    assert_eq!(alert.region_name, None);
    assert_eq!(alert.message, "New sovereignty campaign in Orphan");
}

#[sqlx::test(
    migrations = false,
    fixtures("regions", "constellations", "solar_systems", "alliances", "rows")
)]
async fn unknown_system_falls_back_to_its_id(pool: PgPool) {
    let event = AlertEvent::CampaignStarted {
        system_id: 31,
        defender_id: None,
    };
    let alert = build_alert(&pool, &event, noon()).await.unwrap();
    assert_eq!(alert.solar_system_name, None);
    assert_eq!(alert.message, "New sovereignty campaign in #31");
}

#[sqlx::test(
    migrations = false,
    fixtures("regions", "constellations", "solar_systems", "alliances", "rows")
)]
async fn unknown_alliance_is_null(pool: PgPool) {
    let event = AlertEvent::CampaignStarted {
        system_id: 30000001,
        defender_id: Some(1),
    };
    let alert = build_alert(&pool, &event, noon()).await.unwrap();
    assert_eq!(alert.alliance_id, Some(1));
    assert_eq!(alert.alliance_name, None);
    assert_eq!(alert.alliance_ticker, None);
}

#[sqlx::test(
    migrations = false,
    fixtures("regions", "constellations", "solar_systems", "alliances", "rows")
)]
async fn ended_and_change_carry_their_fields(pool: PgPool) {
    let ended = AlertEvent::CampaignEnded {
        system_id: 30000001,
        defender_id: None,
        outcome: Some("attacker_won".into()),
    };
    let alert = build_alert(&pool, &ended, noon()).await.unwrap();
    assert_eq!(alert.outcome.as_deref(), Some("attacker_won"));
    assert_eq!(alert.change_type, None);

    let change = AlertEvent::TerritoryChange {
        system_id: 30000001,
        previous_owner_id: Some(99000001),
        new_owner_id: None,
        change_type: Some("lost".into()),
    };
    let alert = build_alert(&pool, &change, noon()).await.unwrap();
    assert_eq!(alert.r#type, "territory_change");
    assert_eq!(alert.change_type.as_deref(), Some("lost"));
    assert_eq!(alert.outcome, None);
    assert_eq!(alert.alliance_name.as_deref(), Some("Goonswarm"));
    assert_eq!(alert.message, "1DQ1-A sovereignty lost (Delve)");
}
