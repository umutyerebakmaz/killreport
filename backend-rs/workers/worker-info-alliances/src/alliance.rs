//! What ESI says about an alliance, and the one statement that stores it.

use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;

/// `GET /alliances/{id}`. ESI leaves a key out rather than sending null when
/// an alliance has no executor or no faction, hence the `Option`s.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct AllianceInfo {
    pub name: String,
    pub ticker: String,
    pub date_founded: DateTime<Utc>,
    pub creator_corporation_id: i32,
    pub creator_id: i32,
    #[serde(default)]
    pub executor_corporation_id: Option<i32>,
    #[serde(default)]
    pub faction_id: Option<i32>,
}

/// Insert or update one alliance; `true` if it was new.
///
/// Says out loud what Prisma's `upsert` did implicitly
/// (`worker-info-alliances.ts:99-124`):
///
/// - `updated_at` is set on insert *and* on every update: the column has no
///   database default (`@updatedAt` is Prisma's).
/// - `date_founded` and `creator_*` never change, so an update leaves them
///   alone; `created_at` is the database default; `corporation_count` and
///   `member_count` belong to `update-alliance-counts` and are never touched.
/// - A missing executor or faction is written as NULL, not skipped, so an
///   alliance that loses its executor does not keep the old one.
///
/// `date_founded` is `timestamp(3) without time zone` and Prisma stores UTC
/// in it, so the UTC instant is bound as a naive timestamp.
///
/// `xmax = 0` holds only for a row this statement inserted; it replaces the
/// separate `findUnique` the Node worker ran for its log line.
pub async fn upsert_alliance(
    pool: &PgPool,
    id: i32,
    info: &AllianceInfo,
) -> Result<bool, sqlx::Error> {
    let inserted = sqlx::query_scalar!(
        r#"
        INSERT INTO alliances (
          id, name, ticker, date_founded, creator_corporation_id, creator_id,
          executor_corporation_id, faction_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        ON CONFLICT (id) DO UPDATE SET
          name                    = EXCLUDED.name,
          ticker                  = EXCLUDED.ticker,
          executor_corporation_id = EXCLUDED.executor_corporation_id,
          faction_id              = EXCLUDED.faction_id,
          updated_at              = now()
        RETURNING (xmax = 0) AS "inserted!"
        "#,
        id,
        info.name,
        info.ticker,
        info.date_founded.naive_utc(),
        info.creator_corporation_id,
        info.creator_id,
        info.executor_corporation_id,
        info.faction_id,
    )
    .fetch_one(pool)
    .await?;
    Ok(inserted)
}
