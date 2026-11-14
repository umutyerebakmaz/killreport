//! The shape of ESI's answer.

use chrono::{TimeZone, Utc};
use worker_info_corporations::corporation::CorporationInfo;

fn esi(extra: &str) -> String {
    format!(
        r#"{{"name":"Test Corp","ticker":"TSTC","member_count":42,"ceo_id":90000001,
            "creator_id":90000002,"tax_rate":0.115{extra}}}"#
    )
}

#[test]
fn only_the_required_fields_parse_with_every_optional_as_none() {
    let info: CorporationInfo = serde_json::from_str(&esi("")).unwrap();
    assert_eq!(info.name, "Test Corp");
    assert_eq!(info.ticker, "TSTC");
    assert_eq!(info.member_count, 42);
    assert_eq!((info.ceo_id, info.creator_id), (90000001, 90000002));
    assert_eq!(info.tax_rate, 0.115);
    assert_eq!(info.date_founded, None);
    assert_eq!(info.description, None);
    assert_eq!(info.alliance_id, None);
    assert_eq!(info.faction_id, None);
    assert_eq!(info.home_station_id, None);
    assert_eq!(info.shares, None);
    assert_eq!(info.url, None);
}

#[test]
fn every_optional_field_is_read() {
    let info: CorporationInfo = serde_json::from_str(&esi(
        r#","date_founded":"2010-11-04T13:11:00Z","description":"hello","alliance_id":99000001,
            "faction_id":500001,"home_station_id":60000001,"shares":1000,"url":"https://example.com""#,
    ))
    .unwrap();
    assert_eq!(
        info.date_founded,
        Some(Utc.with_ymd_and_hms(2010, 11, 4, 13, 11, 0).unwrap())
    );
    assert_eq!(info.description.as_deref(), Some("hello"));
    assert_eq!(info.alliance_id, Some(99000001));
    assert_eq!(info.faction_id, Some(500001));
    assert_eq!(info.home_station_id, Some(60000001));
    assert_eq!(info.shares, Some(1000));
    assert_eq!(info.url.as_deref(), Some("https://example.com"));
}

#[test]
fn shares_beyond_i32_is_read() {
    let info: CorporationInfo = serde_json::from_str(&esi(r#","shares":5000000000"#)).unwrap();
    assert_eq!(info.shares, Some(5_000_000_000));
}

#[test]
fn date_founded_reads_with_and_without_milliseconds() {
    let info: CorporationInfo =
        serde_json::from_str(&esi(r#","date_founded":"2010-11-04T13:11:00Z""#)).unwrap();
    assert_eq!(
        info.date_founded,
        Some(Utc.with_ymd_and_hms(2010, 11, 4, 13, 11, 0).unwrap())
    );

    let info: CorporationInfo =
        serde_json::from_str(&esi(r#","date_founded":"2010-11-04T13:11:00.123Z""#)).unwrap();
    assert_eq!(info.date_founded.unwrap().timestamp_subsec_millis(), 123);
}

#[test]
fn unknown_fields_are_ignored() {
    let info: CorporationInfo = serde_json::from_str(&esi(r#","war_eligible":true"#)).unwrap();
    assert_eq!(info.name, "Test Corp");
}
