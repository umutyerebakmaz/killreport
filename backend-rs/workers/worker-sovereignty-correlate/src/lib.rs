//! Sovereignty killmail correlation: tags killmails that fall in a sov
//! campaign's system and activity window with `related_campaign_id` and
//! `is_war_related`, then rolls the tagged kills up into
//! `campaign_combat_stats`. The Rust counterpart of
//! `backend/src/workers/worker-sovereignty-correlate.ts`, which runs the same
//! three statements; see the spec,
//! `docs/superpowers/specs/2026-11-22-rust-sovereignty-correlate-design.md`.
//!
//! - A campaign is eligible while active and for 24 hours after it ends, so
//!   the kills of its last minutes and killmails that arrive late still land.
//! - Its window is `[start_time - 24 h, end_time]`, or up to `now` while it
//!   is active.
//! - A killmail two eligible campaigns both claim goes to the one that
//!   started first, then to the lower `campaign_id`. A tagged killmail is
//!   never re-evaluated.
//!
//! `now` is bound from the application in UTC. The columns are `timestamp`
//! without time zone, so a database `now()` would write the session's local
//! time instead.

use chrono::NaiveDateTime;
use sqlx::PgPool;

#[derive(Debug, PartialEq, Eq)]
pub struct CorrelateOutcome {
    /// Active campaigns plus those ended in the last 24 hours.
    pub campaigns: i64,
    /// Killmails tagged by this run.
    pub tagged: u64,
    /// Eligible campaigns with at least one tagged killmail.
    pub with_kills: u64,
}

const CAMPAIGNS: &str = "
SELECT COUNT(*) FROM sovereignty_campaigns
WHERE end_time IS NULL OR end_time >= $1::timestamp - interval '24 hours'";

const TAG: &str = "
WITH
  eligible AS (
    SELECT campaign_id, solar_system_id, start_time,
           start_time - interval '24 hours' AS window_start,
           COALESCE(end_time, $1::timestamp) AS window_end
    FROM sovereignty_campaigns
    WHERE end_time IS NULL OR end_time >= $1::timestamp - interval '24 hours'),
  picks AS (
    SELECT DISTINCT ON (k.killmail_id) k.killmail_id, e.campaign_id
    FROM killmails k
    JOIN eligible e ON e.solar_system_id = k.solar_system_id
     AND k.killmail_time >= e.window_start AND k.killmail_time <= e.window_end
    WHERE k.related_campaign_id IS NULL
    ORDER BY k.killmail_id, e.start_time, e.campaign_id)
UPDATE killmails k
SET related_campaign_id = p.campaign_id, is_war_related = true, updated_at = $1::timestamp
FROM picks p
WHERE k.killmail_id = p.killmail_id";

/// A kill is a defender loss when its victim's alliance is the campaign's
/// defender; everything else, a kill without a victim row included, is on
/// the attacker side, derived as total - defender so the two always sum to
/// the totals. The inner join on `killmails` writes no row for a campaign
/// without kills.
const STATS: &str = "
WITH
  eligible AS (
    SELECT campaign_id, defender_id FROM sovereignty_campaigns
    WHERE end_time IS NULL OR end_time >= $1::timestamp - interval '24 hours'),
  totals AS (
    SELECT e.campaign_id,
           COUNT(*)::int AS war_kills,
           COALESCE(SUM(k.total_value), 0) AS isk,
           (COUNT(*) FILTER (WHERE v.alliance_id = e.defender_id))::int AS def_ships,
           COALESCE(SUM(k.total_value) FILTER (WHERE v.alliance_id = e.defender_id), 0) AS def_isk
    FROM eligible e
    JOIN killmails k ON k.related_campaign_id = e.campaign_id
    LEFT JOIN victims v ON v.killmail_id = k.killmail_id
    GROUP BY e.campaign_id)
INSERT INTO campaign_combat_stats
  (campaign_id, war_kills, isk_destroyed, ships_destroyed, defender_isk_lost,
   attacker_isk_lost, defender_ships_lost, attacker_ships_lost, last_correlated)
SELECT campaign_id, war_kills, isk, war_kills, def_isk, isk - def_isk,
       def_ships, war_kills - def_ships, $1::timestamp
FROM totals
ON CONFLICT (campaign_id) DO UPDATE SET
  war_kills = EXCLUDED.war_kills, isk_destroyed = EXCLUDED.isk_destroyed,
  ships_destroyed = EXCLUDED.ships_destroyed,
  defender_isk_lost = EXCLUDED.defender_isk_lost,
  attacker_isk_lost = EXCLUDED.attacker_isk_lost,
  defender_ships_lost = EXCLUDED.defender_ships_lost,
  attacker_ships_lost = EXCLUDED.attacker_ships_lost,
  last_correlated = EXCLUDED.last_correlated";

/// Tags and rolls up in one transaction. `now` is UTC.
pub async fn correlate(pool: &PgPool, now: NaiveDateTime) -> Result<CorrelateOutcome, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let campaigns: i64 = sqlx::query_scalar(CAMPAIGNS)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;
    let tagged = sqlx::query(TAG)
        .bind(now)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    let with_kills = sqlx::query(STATS)
        .bind(now)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    tx.commit().await?;

    Ok(CorrelateOutcome {
        campaigns,
        tagged,
        with_kills,
    })
}
