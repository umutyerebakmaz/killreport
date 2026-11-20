//! The alert's message and wire shape, without a database.

use sov::{alert_message, AlertEvent, SovereigntyAlert};

fn started(system_id: i32) -> AlertEvent {
    AlertEvent::CampaignStarted {
        system_id,
        defender_id: None,
    }
}

fn ended(outcome: Option<&str>) -> AlertEvent {
    AlertEvent::CampaignEnded {
        system_id: 30000001,
        defender_id: None,
        outcome: outcome.map(str::to_owned),
    }
}

fn change(previous: Option<i32>, new: Option<i32>, change_type: Option<&str>) -> AlertEvent {
    AlertEvent::TerritoryChange {
        system_id: 30000001,
        previous_owner_id: previous,
        new_owner_id: new,
        change_type: change_type.map(str::to_owned),
    }
}

#[test]
fn campaign_started_with_region() {
    assert_eq!(
        alert_message(&started(30000001), Some("1DQ1-A"), Some("Delve")),
        "New sovereignty campaign in 1DQ1-A (Delve)"
    );
}

#[test]
fn campaign_started_without_region() {
    assert_eq!(
        alert_message(&started(30000001), Some("1DQ1-A"), None),
        "New sovereignty campaign in 1DQ1-A"
    );
}

#[test]
fn campaign_ended_unresolved() {
    assert_eq!(
        alert_message(&ended(None), Some("1DQ1-A"), Some("Delve")),
        "Campaign in 1DQ1-A (Delve) ended — unresolved"
    );
}

#[test]
fn campaign_ended_with_outcome() {
    assert_eq!(
        alert_message(&ended(Some("defender_won")), Some("1DQ1-A"), Some("Delve")),
        "Campaign in 1DQ1-A (Delve) ended — defender_won"
    );
}

#[test]
fn territory_change_with_region() {
    assert_eq!(
        alert_message(
            &change(None, Some(1), Some("captured")),
            Some("1DQ1-A"),
            Some("Delve")
        ),
        "1DQ1-A sovereignty captured (Delve)"
    );
}

#[test]
fn territory_change_unnamed() {
    assert_eq!(
        alert_message(&change(None, Some(1), None), Some("1DQ1-A"), None),
        "1DQ1-A sovereignty changed"
    );
}

#[test]
fn unknown_system_uses_its_id() {
    assert_eq!(
        alert_message(&started(31), None, None),
        "New sovereignty campaign in #31"
    );
}

#[test]
fn alliance_id_prefers_new_owner() {
    assert_eq!(change(Some(1), Some(2), None).alliance_id(), Some(2));
    assert_eq!(change(Some(1), None, None).alliance_id(), Some(1));
    let defended = AlertEvent::CampaignStarted {
        system_id: 1,
        defender_id: Some(7),
    };
    assert_eq!(defended.alliance_id(), Some(7));
    assert_eq!(defended.system_id(), 1);
}

#[test]
fn json_field_order_and_names() {
    let alert = SovereigntyAlert {
        r#type: "campaign_ended".into(),
        message: "Campaign in 1DQ1-A (Delve) ended — defender_won".into(),
        solar_system_id: 30000001,
        solar_system_name: Some("1DQ1-A".into()),
        region_name: Some("Delve".into()),
        alliance_id: Some(99000001),
        alliance_name: Some("Goonswarm".into()),
        alliance_ticker: Some("CONDI".into()),
        outcome: Some("defender_won".into()),
        change_type: None,
        timestamp: "2026-11-20T12:00:00.000Z".into(),
    };
    assert_eq!(
        serde_json::to_string(&alert).unwrap(),
        r#"{"type":"campaign_ended","message":"Campaign in 1DQ1-A (Delve) ended — defender_won","solarSystemId":30000001,"solarSystemName":"1DQ1-A","regionName":"Delve","allianceId":99000001,"allianceName":"Goonswarm","allianceTicker":"CONDI","outcome":"defender_won","changeType":null,"timestamp":"2026-11-20T12:00:00.000Z"}"#
    );
}
