//! The backfill worker's parts, split from the binary so the tests can reach
//! them: the read, the formula, the write, and `handle`.

use anyhow::bail;
use chrono::{NaiveDateTime, Utc};
use killmail_value::{compute, type_info, Item, Values};
use runner::{Context, Outcome, Processed, Worker};
use sqlx::PgPool;

pub struct BackfillWorker {
    pub pool: PgPool,
}

/// What [`backfill`] did with one killmail.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Backfilled {
    NoKillmail,
    NoVictim,
    /// No market data at all: the row keeps whatever value it had.
    Zero,
    Saved(Values),
}

impl Worker for BackfillWorker {
    const QUEUE_NAME: &'static str = "backfill_killmail_values_queue";
    const CONSUMER_TAG: &'static str = "worker-backfill-values-rs";
    const STARTED: &'static str = "💰 backfill killmail values worker started";
    const WAITING_FOR: &'static str = "killmails";
    const ENTITY: &'static str = "killmail";

    async fn handle(&self, id: i32, _ctx: &Context<'_>) -> anyhow::Result<Processed> {
        let (outcome, detail) = match backfill(&self.pool, id, Utc::now().naive_utc()).await? {
            Backfilled::NoKillmail => (Outcome::Unchanged, format!(" {id} (not found)")),
            Backfilled::NoVictim => (Outcome::Unchanged, format!(" {id} (no victim)")),
            Backfilled::Zero => (Outcome::Unchanged, format!(" {id} (zero values)")),
            Backfilled::Saved(v) => (
                Outcome::Updated,
                format!(
                    " KM {id}: total={:.2}, destroyed={:.2}, dropped={:.2}",
                    v.total, v.destroyed, v.dropped
                ),
            ),
        };
        Ok(Processed { outcome, detail })
    }
}

/// Recalculate one killmail's value and save it to `killmails` and its
/// denormalized copy in `killmail_filters`, in one transaction. `now` is
/// `updated_at`, bound from the application in UTC: Prisma's `@updatedAt`
/// is not written by raw SQL, and the database's own clock would be the
/// session's local time.
pub async fn backfill(
    pool: &PgPool,
    killmail_id: i32,
    now: NaiveDateTime,
) -> anyhow::Result<Backfilled> {
    let found: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT v.ship_type_id
         FROM killmails k
         LEFT JOIN victims v ON v.killmail_id = k.killmail_id
         WHERE k.killmail_id = $1",
    )
    .bind(killmail_id)
    .fetch_optional(pool)
    .await?;
    let ship_type_id = match found {
        None => return Ok(Backfilled::NoKillmail),
        Some((None,)) => return Ok(Backfilled::NoVictim),
        Some((Some(ship_type_id),)) => ship_type_id,
    };

    // In `id` order, so the sum adds the items in a fixed order.
    let items: Vec<(i32, Option<i32>, Option<i32>, i32)> = sqlx::query_as(
        "SELECT item_type_id, quantity_destroyed, quantity_dropped, singleton
         FROM killmail_items
         WHERE killmail_id = $1
         ORDER BY id",
    )
    .bind(killmail_id)
    .fetch_all(pool)
    .await?;
    let items: Vec<Item> = items
        .into_iter()
        .map(
            |(type_id, quantity_destroyed, quantity_dropped, singleton)| Item {
                type_id,
                quantity_destroyed,
                quantity_dropped,
                singleton,
            },
        )
        .collect();

    let mut type_ids: Vec<i32> = std::iter::once(ship_type_id)
        .chain(items.iter().map(|item| item.type_id))
        .collect();
    type_ids.sort_unstable();
    type_ids.dedup();
    let types = type_info(pool, &type_ids).await?;

    let values = compute(ship_type_id, &items, &types);
    if values.is_zero() {
        return Ok(Backfilled::Zero);
    }

    let mut tx = pool.begin().await?;
    let updated = sqlx::query(
        "UPDATE killmails
         SET total_value = $2, destroyed_value = $3, dropped_value = $4, updated_at = $5
         WHERE killmail_id = $1",
    )
    .bind(killmail_id)
    .bind(values.total)
    .bind(values.destroyed)
    .bind(values.dropped)
    .bind(now)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if updated != 1 {
        bail!("killmail {killmail_id} was not updated ({updated} rows)");
    }
    sqlx::query("UPDATE killmail_filters SET total_value = $2 WHERE killmail_id = $1")
        .bind(killmail_id)
        .bind(values.total)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    Ok(Backfilled::Saved(values))
}
