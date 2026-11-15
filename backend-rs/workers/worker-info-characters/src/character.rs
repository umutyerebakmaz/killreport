//! What ESI says about a character, and the title columns it feeds.

use chrono::{DateTime, Utc};
use esi::CompatibilityDate;
use serde::Deserialize;
use serde_json::Value;
use tracing::warn;

/// `achievement_score` and `character_title_id` only exist from this date on
/// (`character.service.ts:23`).
pub const CHARACTER_COMPATIBILITY_DATE: CompatibilityDate = CompatibilityDate::new("2026-06-09");

/// `GET /characters/{id}/` (`EsiCharacterInfo`, `character.service.ts:25-39`).
/// ESI leaves a key out rather than sending null when a character has no
/// alliance, faction and so on, hence the `Option`s.
///
/// `character_title_id` and `achievement_score` are read loosely, as JSON
/// values: Node drops a malformed one with a warning and still saves the
/// character (`character-achievement.ts`), so an unexpected value must not
/// fail the whole decode. [`title_fields`] validates them.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct CharacterInfo {
    pub name: String,
    pub corporation_id: i32,
    pub birthday: DateTime<Utc>,
    pub bloodline_id: i32,
    pub race_id: i32,
    pub gender: String,
    #[serde(default)]
    pub alliance_id: Option<i32>,
    #[serde(default)]
    pub security_status: Option<f64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub faction_id: Option<i32>,
    #[serde(default)]
    pub corporation_title: Option<String>,
    #[serde(default)]
    pub character_title_id: Option<Value>,
    #[serde(default)]
    pub achievement_score: Option<Value>,
}

/// The three character columns ESI's title data feeds.
#[derive(Debug, Clone, PartialEq)]
pub struct TitleFields {
    pub title: Option<String>,
    pub character_title_id: Option<String>,
    pub achievement_score: Option<i32>,
}

/// `characterTitleFields` (`helpers/character-achievement.ts`). Every key ESI
/// leaves out becomes `None`, so a stale value never survives an update. A
/// score that is not a whole number in `0..=i32::MAX`, or a title ID that is
/// not a UUID, would make the upsert fail, so it is dropped with a warning
/// instead.
pub fn title_fields(info: &CharacterInfo) -> TitleFields {
    TitleFields {
        title: info.corporation_title.clone(),
        character_title_id: info.character_title_id.as_ref().and_then(valid_title_id),
        achievement_score: info.achievement_score.as_ref().and_then(valid_score),
    }
}

/// A whole number that fits the `integer` column. `1.0` counts, as it does
/// for `Number.isInteger`.
fn valid_score(value: &Value) -> Option<i32> {
    let whole = value.as_i64().or_else(|| {
        value
            .as_f64()
            .filter(|f| f.fract() == 0.0 && f.abs() <= i64::MAX as f64)
            .map(|f| f as i64)
    });
    let score = whole
        .and_then(|n| i32::try_from(n).ok())
        .filter(|n| *n >= 0);
    if score.is_none() {
        warn!("Ignoring achievement_score {value}: not an int32 >= 0");
    }
    score
}

/// A string matching `UUID_PATTERN` (`sde-character-title.ts:1-2`), in
/// either case.
fn valid_title_id(value: &Value) -> Option<String> {
    let id = value.as_str().filter(|s| is_uuid(s)).map(str::to_owned);
    if id.is_none() {
        warn!("Ignoring character_title_id {value}: not a UUID");
    }
    id
}

/// `8-4-4-4-12` hex digits.
fn is_uuid(s: &str) -> bool {
    s.len() == 36
        && s.bytes().enumerate().all(|(i, b)| match i {
            8 | 13 | 18 | 23 => b == b'-',
            _ => b.is_ascii_hexdigit(),
        })
}
