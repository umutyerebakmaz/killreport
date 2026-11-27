//! A killmail as ESI's public `/killmails/{id}/{hash}/` returns it: the
//! fields `saveKillmail` reads, nothing else. A field ESI may leave out is
//! an `Option`; unknown fields (nested container items among them) are
//! ignored, as the Node writer ignores them.

use chrono::{DateTime, Utc};
use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct KillmailDetail {
    pub killmail_id: i32,
    pub killmail_time: DateTime<Utc>,
    pub solar_system_id: i32,
    pub victim: Victim,
    /// Missing reads as empty, which `save` then refuses, the same way as an
    /// empty list.
    #[serde(default)]
    pub attackers: Vec<Attacker>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Victim {
    pub character_id: Option<i32>,
    pub corporation_id: i32,
    pub alliance_id: Option<i32>,
    pub faction_id: Option<i32>,
    pub ship_type_id: i32,
    pub damage_taken: i32,
    pub position: Option<Position>,
    #[serde(default)]
    pub items: Vec<DetailItem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Attacker {
    pub character_id: Option<i32>,
    pub corporation_id: Option<i32>,
    pub alliance_id: Option<i32>,
    pub faction_id: Option<i32>,
    pub ship_type_id: Option<i32>,
    pub weapon_type_id: Option<i32>,
    pub damage_done: i32,
    pub final_blow: bool,
    pub security_status: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct DetailItem {
    /// Null in real ESI data now and then; such an item is skipped.
    pub item_type_id: Option<i32>,
    pub flag: i32,
    pub quantity_destroyed: Option<i32>,
    pub quantity_dropped: Option<i32>,
    pub singleton: i32,
}
