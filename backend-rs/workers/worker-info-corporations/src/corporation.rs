//! What ESI says about a corporation, and the one statement that stores it.

use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;

/// `GET /corporations/{id}`. ESI leaves a key out rather than sending null
/// when a corporation has no founding date, alliance, faction and so on,
/// hence the `Option`s. Keys this worker does not read (`war_eligible`) are
/// ignored.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct CorporationInfo {
    pub name: String,
    pub ticker: String,
    pub member_count: i32,
    pub ceo_id: i32,
    pub creator_id: i32,
    pub tax_rate: f64,
    #[serde(default)]
    pub date_founded: Option<DateTime<Utc>>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub alliance_id: Option<i32>,
    #[serde(default)]
    pub faction_id: Option<i32>,
    #[serde(default)]
    pub home_station_id: Option<i32>,
    #[serde(default)]
    pub shares: Option<i64>,
    #[serde(default)]
    pub url: Option<String>,
}

/// Insert or update one corporation; `true` if it was new.
///
/// Says out loud what Prisma's `upsert` did implicitly
/// (`worker-info-corporations.ts:95-136`):
///
/// - `updated_at` is set on insert *and* on every update: the column has no
///   database default (`@updatedAt` is Prisma's).
/// - `date_founded` and `creator_id` never change, so an update leaves them
///   alone; `created_at` is the database default.
/// - `home_station_id` and `shares` are likewise absent from the Node
///   `update` block (`worker-info-corporations.ts:123-136`), although both
///   can change over time. That is probably a gap in the Node worker; it is
///   kept here for parity, and fixing it belongs in a separate change that
///   touches both workers.
/// - A missing alliance, faction, description or url is written as NULL, not
///   skipped, so a corporation that leaves its alliance does not keep the
///   old one.
///
/// `date_founded` is `timestamp(3) without time zone` and Prisma stores UTC
/// in it, so the UTC instant is bound as a naive timestamp.
///
/// `xmax = 0` holds only for a row this statement inserted; it replaces the
/// separate `findUnique` the Node worker ran for its log line.
pub async fn upsert_corporation(
    pool: &PgPool,
    id: i32,
    info: &CorporationInfo,
) -> Result<bool, sqlx::Error> {
    let inserted = sqlx::query_scalar!(
        r#"
        INSERT INTO corporations (
          id, name, ticker, member_count, ceo_id, creator_id, date_founded,
          description, alliance_id, faction_id, home_station_id, shares, tax_rate,
          url, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
        ON CONFLICT (id) DO UPDATE SET
          name         = EXCLUDED.name,
          ticker       = EXCLUDED.ticker,
          member_count = EXCLUDED.member_count,
          ceo_id       = EXCLUDED.ceo_id,
          alliance_id  = EXCLUDED.alliance_id,
          faction_id   = EXCLUDED.faction_id,
          tax_rate     = EXCLUDED.tax_rate,
          description  = EXCLUDED.description,
          url          = EXCLUDED.url,
          updated_at   = now()
        RETURNING (xmax = 0) AS "inserted!"
        "#,
        id,
        info.name,
        info.ticker,
        info.member_count,
        info.ceo_id,
        info.creator_id,
        info.date_founded.map(|d| d.naive_utc()),
        info.description,
        info.alliance_id,
        info.faction_id,
        info.home_station_id,
        info.shares,
        info.tax_rate,
        info.url,
    )
    .fetch_one(pool)
    .await?;
    Ok(inserted)
}
