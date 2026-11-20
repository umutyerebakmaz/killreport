//! Sovereignty campaigns sync: `GET /sovereignty/campaigns` becomes one
//! `sovereignty_campaigns` row per active campaign plus its
//! `campaign_participants`, and a campaign ESI stops listing is ended with an
//! inferred outcome. The Rust counterpart of
//! `backend/src/workers/worker-sovereignty-campaigns.ts`; see the spec,
//! `docs/superpowers/specs/2026-11-20-rust-sovereignty-jobs-design.md`.
//!
//! Everything is written in one transaction, and the alerts it gives rise to
//! are handed back to the caller to publish after the commit: an alert never
//! announces a write that rolled back.
//!
//! Every time is UTC (EVE time) and bound from the caller's `now`, never the
//! database's `now()`, which would follow the session time zone.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, NaiveDateTime, Utc};
use esi::EsiClient;
use serde::Deserialize;
use sov::{AlertEvent, MAX_ALERTS};
use sqlx::PgPool;

/// Below this neither side "really contested" (scores are 0..1).
pub const OUTCOME_EPS: f64 = 0.05;

/// ESI reports no resolution, so the verdict comes from the last-known
/// scores: a tie goes to the defender, and a window nobody made progress in
/// lapsed uncontested.
pub fn infer_outcome(defender: Option<f64>, attackers: Option<f64>) -> &'static str {
    if defender.is_none() && attackers.is_none() {
        return "abandoned";
    }
    let d = defender.unwrap_or(0.0);
    let a = attackers.unwrap_or(0.0);
    if d.max(a) < OUTCOME_EPS {
        "abandoned"
    } else if d >= a {
        "defender_won"
    } else {
        "attacker_won"
    }
}

/// One entry of `GET /sovereignty/campaigns`. ESI leaves `participants` out
/// when there are none.
#[derive(Debug, Clone, Deserialize)]
pub struct EsiCampaign {
    pub campaign_id: i32,
    pub constellation_id: i32,
    pub solar_system_id: i32,
    pub structure_id: i64,
    pub event_type: String,
    pub defender_id: Option<i32>,
    pub defender_score: Option<f64>,
    pub attackers_score: Option<f64>,
    pub start_time: DateTime<Utc>,
    #[serde(default)]
    pub participants: Vec<EsiParticipant>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EsiParticipant {
    pub alliance_id: i32,
    pub score: f64,
}

/// A live campaign ESI no longer lists.
#[derive(sqlx::FromRow)]
struct Departing {
    campaign_id: i32,
    solar_system_id: i32,
    defender_id: Option<i32>,
    defender_score: Option<f64>,
    attackers_score: Option<f64>,
}

#[derive(Debug)]
pub struct CampaignsOutcome {
    pub active: usize,
    pub participants: usize,
    pub ended: u64,
    /// ESI listed nothing, so no campaign was ended: an empty answer is far
    /// likelier a bad poll than every war stopping at once.
    pub skipped_end_marking: bool,
    /// At most `MAX_ALERTS`, started campaigns first.
    pub alerts: Vec<AlertEvent>,
}

/// The last entry for each key wins, in the place it was first seen. One
/// `INSERT … ON CONFLICT` cannot touch the same row twice, and Node's
/// row-by-row upserts let the last one win.
fn last_wins<T, K: std::hash::Hash + Eq>(
    items: impl IntoIterator<Item = T>,
    key: impl Fn(&T) -> K,
) -> Vec<T> {
    let mut out: Vec<T> = Vec::new();
    let mut index: HashMap<K, usize> = HashMap::new();
    for item in items {
        match index.get(&key(&item)) {
            Some(&i) => out[i] = item,
            None => {
                index.insert(key(&item), out.len());
                out.push(item);
            }
        }
    }
    out
}

pub async fn write_campaigns(
    pool: &PgPool,
    campaigns: &[EsiCampaign],
    now: NaiveDateTime,
) -> sqlx::Result<CampaignsOutcome> {
    let campaigns = last_wins(campaigns.iter(), |c| c.campaign_id);
    let ids: Vec<i32> = campaigns.iter().map(|c| c.campaign_id).collect();
    let participant_count: usize = campaigns.iter().map(|c| c.participants.len()).sum();
    let participants = last_wins(
        campaigns
            .iter()
            .flat_map(|c| c.participants.iter().map(move |p| (c.campaign_id, p))),
        |(c, p)| (*c, p.alliance_id),
    );

    let mut tx = pool.begin().await?;

    // A first run imports the feed as a baseline, not as a wave of new wars.
    let stored: i64 = sqlx::query_scalar("SELECT count(*) FROM sovereignty_campaigns")
        .fetch_one(&mut *tx)
        .await?;
    let existing: HashSet<i32> = sqlx::query_scalar(
        "SELECT campaign_id FROM sovereignty_campaigns WHERE campaign_id = ANY($1)",
    )
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .collect();

    if !campaigns.is_empty() {
        sqlx::query(
            "INSERT INTO sovereignty_campaigns
               (campaign_id, constellation_id, solar_system_id, structure_id, event_type,
                defender_id, defender_score, attackers_score, start_time, first_seen, updated_at)
             SELECT u.*, $10, $10
             FROM UNNEST($1::int[], $2::int[], $3::int[], $4::bigint[], $5::text[],
                         $6::int[], $7::float8[], $8::float8[], $9::timestamp[]) AS u
             ON CONFLICT (campaign_id) DO UPDATE SET
               defender_id = EXCLUDED.defender_id,
               defender_score = EXCLUDED.defender_score,
               attackers_score = EXCLUDED.attackers_score,
               end_time = NULL,
               outcome = NULL,
               updated_at = EXCLUDED.updated_at",
        )
        .bind(&ids)
        .bind(
            campaigns
                .iter()
                .map(|c| c.constellation_id)
                .collect::<Vec<_>>(),
        )
        .bind(
            campaigns
                .iter()
                .map(|c| c.solar_system_id)
                .collect::<Vec<_>>(),
        )
        .bind(campaigns.iter().map(|c| c.structure_id).collect::<Vec<_>>())
        .bind(
            campaigns
                .iter()
                .map(|c| c.event_type.clone())
                .collect::<Vec<_>>(),
        )
        .bind(campaigns.iter().map(|c| c.defender_id).collect::<Vec<_>>())
        .bind(
            campaigns
                .iter()
                .map(|c| c.defender_score)
                .collect::<Vec<_>>(),
        )
        .bind(
            campaigns
                .iter()
                .map(|c| c.attackers_score)
                .collect::<Vec<_>>(),
        )
        .bind(
            campaigns
                .iter()
                .map(|c| c.start_time.naive_utc())
                .collect::<Vec<_>>(),
        )
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    if !participants.is_empty() {
        sqlx::query(
            "INSERT INTO campaign_participants (campaign_id, alliance_id, score, updated_at)
             SELECT u.*, $4 FROM UNNEST($1::int[], $2::int[], $3::float8[]) AS u
             ON CONFLICT (campaign_id, alliance_id) DO UPDATE SET
               score = EXCLUDED.score,
               updated_at = EXCLUDED.updated_at",
        )
        .bind(participants.iter().map(|(c, _)| *c).collect::<Vec<_>>())
        .bind(
            participants
                .iter()
                .map(|(_, p)| p.alliance_id)
                .collect::<Vec<_>>(),
        )
        .bind(
            participants
                .iter()
                .map(|(_, p)| p.score)
                .collect::<Vec<_>>(),
        )
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    let mut started: Vec<AlertEvent> = Vec::new();
    if stored > 0 {
        started = campaigns
            .iter()
            .filter(|c| !existing.contains(&c.campaign_id))
            .map(|c| AlertEvent::CampaignStarted {
                system_id: c.solar_system_id,
                defender_id: c.defender_id,
            })
            .collect();
    }

    let mut ended_alerts: Vec<AlertEvent> = Vec::new();
    let mut ended = 0;
    let skipped_end_marking = campaigns.is_empty();
    if !skipped_end_marking {
        let departing: Vec<Departing> = sqlx::query_as(
            "SELECT campaign_id, solar_system_id, defender_id, defender_score, attackers_score
             FROM sovereignty_campaigns
             WHERE end_time IS NULL AND campaign_id <> ALL($1)
             ORDER BY campaign_id
             FOR UPDATE",
        )
        .bind(&ids)
        .fetch_all(&mut *tx)
        .await?;

        let outcomes: Vec<&'static str> = departing
            .iter()
            .map(|d| infer_outcome(d.defender_score, d.attackers_score))
            .collect();
        if !departing.is_empty() {
            ended = sqlx::query(
                "UPDATE sovereignty_campaigns c
                 SET end_time = $3, outcome = u.outcome, updated_at = $3
                 FROM UNNEST($1::int[], $2::text[]) AS u(campaign_id, outcome)
                 WHERE c.campaign_id = u.campaign_id",
            )
            .bind(departing.iter().map(|d| d.campaign_id).collect::<Vec<_>>())
            .bind(&outcomes)
            .bind(now)
            .execute(&mut *tx)
            .await?
            .rows_affected();
        }
        ended_alerts = departing
            .iter()
            .zip(&outcomes)
            .map(|(d, outcome)| AlertEvent::CampaignEnded {
                system_id: d.solar_system_id,
                defender_id: d.defender_id,
                outcome: Some((*outcome).to_owned()),
            })
            .collect();
    }

    tx.commit().await?;

    let mut alerts = started;
    alerts.extend(ended_alerts);
    alerts.truncate(MAX_ALERTS);
    Ok(CampaignsOutcome {
        active: campaigns.len(),
        participants: participant_count,
        ended,
        skipped_end_marking,
        alerts,
    })
}

/// Fetches the list and writes it.
pub async fn sync(
    esi: &EsiClient,
    pool: &PgPool,
    now: NaiveDateTime,
) -> anyhow::Result<CampaignsOutcome> {
    let campaigns: Vec<EsiCampaign> = esi.get("/sovereignty/campaigns").await?;
    Ok(write_campaigns(pool, &campaigns, now).await?)
}
