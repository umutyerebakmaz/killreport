//! Decoding `GET /universe/types/{id}/`.

use serde_json::json;
use worker_info_types::type_info::TypeInfo;

#[test]
fn parses_a_real_esi_answer() {
    // Rifter (587), cut short; the fields Node does not store stay in, to
    // show they are ignored.
    let body = json!({
        "type_id": 587,
        "name": "Rifter",
        "description": "The Rifter is a very powerful combat frigate.",
        "group_id": 25,
        "published": true,
        "volume": 27289.0,
        "capacity": 140.0,
        "mass": 1067000.0,
        "icon_id": 587,
        "graphic_id": 46,
        "market_group_id": 64,
        "packaged_volume": 2500.0,
        "portion_size": 1,
        "radius": 31.0,
        "dogma_attributes": [{ "attribute_id": 4, "value": 1067000.0 }],
        "dogma_effects": [{ "effect_id": 1, "is_default": false }]
    });

    let info: TypeInfo = serde_json::from_value(body).unwrap();
    assert_eq!(
        info,
        TypeInfo {
            name: "Rifter".into(),
            description: Some("The Rifter is a very powerful combat frigate.".into()),
            group_id: 25,
            published: true,
            volume: Some(27289.0),
            capacity: Some(140.0),
            mass: Some(1067000.0),
            icon_id: Some(587),
        }
    );
}

#[test]
fn optional_fields_may_be_missing() {
    let body = json!({ "type_id": 1, "name": "x", "group_id": 2, "published": false });

    let info: TypeInfo = serde_json::from_value(body).unwrap();
    assert_eq!(
        info,
        TypeInfo {
            name: "x".into(),
            description: None,
            group_id: 2,
            published: false,
            volume: None,
            capacity: None,
            mass: None,
            icon_id: None,
        }
    );
}
