//! The one place a Rust worker writes a killmail: the counterpart of
//! `backend/src/services/killmail-writer.ts`, with the same rows, values and
//! derived writes. See the spec,
//! `docs/superpowers/specs/2026-11-28-rust-killmail-detail-design.md`.
//!
//! Everything a killmail needs is written in one transaction: the killmail,
//! its victim, attackers and items, the three daily leaderboard tables and
//! its `killmail_filters` row. A killmail can therefore never be committed
//! without its stats or its filter row, which every later writer would then
//! skip as already stored. The transaction starts by claiming the
//! killmail's row; a writer that finds it taken writes nothing else.
//!
//! Column mapping follows the Node writer to the operator: where it writes
//! `x || null` a 0 is stored as NULL ([`nonzero`]), where it writes
//! `x ?? null` a 0 is kept.

mod detail;

use std::collections::HashSet;

use anyhow::bail;
use chrono::NaiveDateTime;
use killmail_value::{compute, type_info, Item as ValueItem};
use sqlx::{PgPool, Postgres, Transaction};
use tracing::warn;

pub use detail::{Attacker, DetailItem, KillmailDetail, Position, Victim};

/// What [`save`] did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Saved {
    Written,
    /// Another writer got there first; nothing was written. A result, not an
    /// error: two sources can find the same killmail.
    AlreadyStored,
}

/// Write `detail` under `hash`. `now` is the UTC time for the `updated_at`
/// columns, which Prisma fills itself and raw SQL does not.
pub async fn save(
    pool: &PgPool,
    detail: &KillmailDetail,
    hash: &str,
    now: NaiveDateTime,
) -> anyhow::Result<Saved> {
    let id = detail.killmail_id;
    // A killmail always has an attacker. Writing one without would count it
    // nowhere, permanently (#245); the source has to fetch it again.
    if detail.attackers.is_empty() {
        bail!("killmail {id} has no attackers; refusing to write it");
    }

    let items: Vec<(i32, &DetailItem)> = detail
        .victim
        .items
        .iter()
        .filter_map(|item| item.item_type_id.map(|type_id| (type_id, item)))
        .collect();
    let skipped = detail.victim.items.len() - items.len();
    if skipped > 0 {
        warn!("   ⚠️  skipping {skipped} invalid items (null item_type_id) for killmail {id}");
    }

    let value_items: Vec<ValueItem> = items
        .iter()
        .map(|&(type_id, item)| ValueItem {
            type_id,
            quantity_destroyed: item.quantity_destroyed,
            quantity_dropped: item.quantity_dropped,
            singleton: item.singleton,
        })
        .collect();
    let mut type_ids: Vec<i32> = std::iter::once(detail.victim.ship_type_id)
        .chain(value_items.iter().map(|item| item.type_id))
        .collect();
    type_ids.sort_unstable();
    type_ids.dedup();
    let types = type_info(pool, &type_ids).await?;
    let values = compute(detail.victim.ship_type_id, &value_items, &types);

    let killmail_time = detail.killmail_time.naive_utc();
    let mut tx = pool.begin().await?;

    let claimed: Option<i32> = sqlx::query_scalar(
        "INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id,
                                total_value, destroyed_value, dropped_value, attacker_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (killmail_id) DO NOTHING
         RETURNING killmail_id",
    )
    .bind(id)
    .bind(hash)
    .bind(killmail_time)
    .bind(detail.solar_system_id)
    .bind(values.total)
    .bind(values.destroyed)
    .bind(values.dropped)
    .bind(attacker_count(detail)?)
    .bind(now)
    .fetch_optional(&mut *tx)
    .await?;
    if claimed.is_none() {
        tx.rollback().await?;
        return Ok(Saved::AlreadyStored);
    }

    write_victim(&mut tx, detail).await?;
    write_attackers(&mut tx, detail, now).await?;
    write_items(&mut tx, id, &items).await?;
    write_stats(&mut tx, detail).await?;
    write_filter(&mut tx, detail).await?;

    tx.commit().await?;
    Ok(Saved::Written)
}

fn attacker_count(detail: &KillmailDetail) -> anyhow::Result<i32> {
    Ok(i32::try_from(detail.attackers.len())?)
}

/// `x || null`: 0 is no ID.
fn nonzero(id: Option<i32>) -> Option<i32> {
    id.filter(|&v| v != 0)
}

/// The IDs without nulls and duplicates, in first-seen order:
/// `[...new Set(ids.filter((id) => id !== null))]`.
fn unique(ids: impl Iterator<Item = Option<i32>>) -> Vec<i32> {
    let mut seen = HashSet::new();
    ids.flatten().filter(|id| seen.insert(*id)).collect()
}

/// The IDs without nulls and duplicates, ascending. The stats upserts lock
/// one row per ID; every writer locking them in the same order is what keeps
/// two concurrent saves of one fight from deadlocking.
fn sorted_unique(ids: impl Iterator<Item = Option<i32>>) -> Vec<i32> {
    let mut ids = unique(ids);
    ids.sort_unstable();
    ids
}

async fn write_victim(
    tx: &mut Transaction<'_, Postgres>,
    detail: &KillmailDetail,
) -> sqlx::Result<()> {
    let v = &detail.victim;
    sqlx::query(
        "INSERT INTO victims (killmail_id, character_id, corporation_id, alliance_id, ship_type_id,
                              damage_taken, position_x, position_y, position_z, faction_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(detail.killmail_id)
    .bind(nonzero(v.character_id))
    .bind(v.corporation_id)
    .bind(nonzero(v.alliance_id))
    .bind(v.ship_type_id)
    .bind(v.damage_taken)
    .bind(v.position.map(|p| p.x))
    .bind(v.position.map(|p| p.y))
    .bind(v.position.map(|p| p.z))
    .bind(v.faction_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn write_attackers(
    tx: &mut Transaction<'_, Postgres>,
    detail: &KillmailDetail,
    now: NaiveDateTime,
) -> sqlx::Result<()> {
    let a = &detail.attackers;
    let column = |f: fn(&Attacker) -> Option<i32>| a.iter().map(f).collect::<Vec<_>>();
    sqlx::query(
        "INSERT INTO attackers (killmail_id, character_id, corporation_id, alliance_id, ship_type_id,
                                weapon_type_id, damage_done, final_blow, security_status, faction_id, updated_at)
         SELECT $1, t.* , $11
         FROM UNNEST($2::int[], $3::int[], $4::int[], $5::int[], $6::int[],
                     $7::int[], $8::bool[], $9::float8[], $10::int[])
              AS t(character_id, corporation_id, alliance_id, ship_type_id, weapon_type_id,
                   damage_done, final_blow, security_status, faction_id)",
    )
    .bind(detail.killmail_id)
    .bind(column(|x| nonzero(x.character_id)))
    .bind(column(|x| nonzero(x.corporation_id)))
    .bind(column(|x| nonzero(x.alliance_id)))
    .bind(column(|x| nonzero(x.ship_type_id)))
    .bind(column(|x| nonzero(x.weapon_type_id)))
    .bind(a.iter().map(|x| x.damage_done).collect::<Vec<_>>())
    .bind(a.iter().map(|x| x.final_blow).collect::<Vec<_>>())
    .bind(a.iter().map(|x| x.security_status).collect::<Vec<_>>())
    .bind(column(|x| x.faction_id))
    .bind(now)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn write_items(
    tx: &mut Transaction<'_, Postgres>,
    killmail_id: i32,
    items: &[(i32, &DetailItem)],
) -> sqlx::Result<()> {
    if items.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO killmail_items (killmail_id, item_type_id, flag, quantity_dropped, quantity_destroyed, singleton)
         SELECT $1, t.*
         FROM UNNEST($2::int[], $3::int[], $4::int[], $5::int[], $6::int[])
              AS t(item_type_id, flag, quantity_dropped, quantity_destroyed, singleton)",
    )
    .bind(killmail_id)
    .bind(items.iter().map(|&(type_id, _)| type_id).collect::<Vec<_>>())
    .bind(items.iter().map(|(_, i)| i.flag).collect::<Vec<_>>())
    .bind(items.iter().map(|(_, i)| nonzero(i.quantity_dropped)).collect::<Vec<_>>())
    .bind(items.iter().map(|(_, i)| nonzero(i.quantity_destroyed)).collect::<Vec<_>>())
    .bind(items.iter().map(|(_, i)| i.singleton).collect::<Vec<_>>())
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One kill per distinct pilot, corporation and alliance on the killmail's
/// UTC day: `updateDailyAggregatesRealtime` in `kill-stats-realtime.ts`.
/// The IDs are distinct, so one statement per table never meets its own key
/// twice.
async fn write_stats(
    tx: &mut Transaction<'_, Postgres>,
    detail: &KillmailDetail,
) -> sqlx::Result<()> {
    let kill_date = detail.killmail_time.date_naive();
    let a = &detail.attackers;
    let tables: [(&str, &str, Vec<i32>); 3] = [
        (
            "character_kill_stats",
            "character_id",
            sorted_unique(a.iter().map(|x| x.character_id)),
        ),
        (
            "corporation_kill_stats",
            "corporation_id",
            sorted_unique(a.iter().map(|x| x.corporation_id)),
        ),
        (
            "alliance_kill_stats",
            "alliance_id",
            sorted_unique(a.iter().map(|x| x.alliance_id)),
        ),
    ];
    for (table, column, ids) in tables {
        if ids.is_empty() {
            continue;
        }
        sqlx::query(&format!(
            "INSERT INTO {table} (kill_date, {column}, kill_count)
             SELECT $1, id, 1 FROM UNNEST($2::int[]) AS t(id)
             ON CONFLICT (kill_date, {column})
             DO UPDATE SET kill_count = {table}.kill_count + 1"
        ))
        .bind(kill_date)
        .bind(ids)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// The `killmail_filters` row: `insertKillmailFilter` in
/// `killmail-filters-realtime.ts`, the same SQL. Location, ship group and
/// value come from joins; inside this transaction the join to `killmails`
/// sees the row just written.
async fn write_filter(
    tx: &mut Transaction<'_, Postgres>,
    detail: &KillmailDetail,
) -> sqlx::Result<()> {
    let a = &detail.attackers;
    let v = &detail.victim;
    sqlx::query(
        "WITH data_row AS (
           SELECT $1::int AS killmail_id, $2::timestamp AS killmail_time, $3::int AS solar_system_id,
                  $4::int AS attacker_count, $5::int AS victim_ship_type_id, $6::int AS victim_character_id,
                  $7::int AS victim_corporation_id, $8::int AS victim_alliance_id, $9::int AS victim_faction_id,
                  $10::int[] AS attacker_ship_type_ids, $11::int[] AS attacker_character_ids,
                  $12::int[] AS attacker_corporation_ids, $13::int[] AS attacker_alliance_ids,
                  $14::int[] AS attacker_faction_ids
         )
         INSERT INTO killmail_filters (
           killmail_id, killmail_time, solar_system_id, constellation_id, region_id, attacker_count,
           victim_ship_type_id, victim_character_id, victim_corporation_id, victim_alliance_id,
           victim_faction_id, attacker_ship_type_ids, attacker_character_ids, attacker_corporation_ids,
           attacker_alliance_ids, attacker_faction_ids, security_status, security_class,
           victim_ship_group_id, total_value
         )
         SELECT d.killmail_id, d.killmail_time, d.solar_system_id, ss.constellation_id, c.region_id,
                d.attacker_count, d.victim_ship_type_id, d.victim_character_id, d.victim_corporation_id,
                d.victim_alliance_id, d.victim_faction_id, d.attacker_ship_type_ids,
                d.attacker_character_ids, d.attacker_corporation_ids, d.attacker_alliance_ids,
                d.attacker_faction_ids, ss.security_status, ss.security_class, t.group_id, k.total_value
         FROM data_row d
         LEFT JOIN solar_systems  ss ON ss.system_id       = d.solar_system_id
         LEFT JOIN constellations c  ON c.constellation_id = ss.constellation_id
         LEFT JOIN types          t  ON t.id               = d.victim_ship_type_id
         LEFT JOIN killmails      k  ON k.killmail_id      = d.killmail_id
         ON CONFLICT (killmail_id) DO UPDATE SET
           constellation_id     = EXCLUDED.constellation_id,
           region_id            = EXCLUDED.region_id,
           security_status      = EXCLUDED.security_status,
           security_class       = EXCLUDED.security_class,
           victim_ship_group_id = EXCLUDED.victim_ship_group_id,
           total_value          = EXCLUDED.total_value
         WHERE killmail_filters.region_id            IS NULL
            OR killmail_filters.security_status      IS NULL
            OR killmail_filters.total_value          IS NULL
            OR killmail_filters.victim_ship_group_id IS NULL",
    )
    .bind(detail.killmail_id)
    .bind(detail.killmail_time.naive_utc())
    .bind(detail.solar_system_id)
    .bind(attacker_count(detail).map_err(|e| sqlx::Error::Decode(e.into()))?)
    .bind(v.ship_type_id)
    .bind(v.character_id)
    .bind(v.corporation_id)
    .bind(v.alliance_id)
    .bind(v.faction_id)
    .bind(unique(a.iter().map(|x| x.ship_type_id)))
    .bind(unique(a.iter().map(|x| x.character_id)))
    .bind(unique(a.iter().map(|x| x.corporation_id)))
    .bind(unique(a.iter().map(|x| x.alliance_id)))
    .bind(unique(a.iter().map(|x| x.faction_id)))
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stats_ids_are_sorted_so_concurrent_saves_lock_rows_in_one_order() {
        // Two killmails of one fight, one listing corp 9 then 3, the other 3
        // then 9: locking in listed order is how two writers deadlock.
        let ids = [Some(9), None, Some(3), Some(9), Some(5)];
        assert_eq!(sorted_unique(ids.into_iter()), vec![3, 5, 9]);
    }
}
