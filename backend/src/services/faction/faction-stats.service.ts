/**
 * Faction Statistics Service
 *
 * The read path behind the faction pages: five top lists for the Killmails
 * tab and three counters for the header and the /factions cards. Every
 * function is redis.get → query → redis.setex, with every filter parameter
 * in the key.
 *
 * A killmail belongs to a faction by the faction ids on the killmail itself
 * (killmail_filters.victim_faction_id / attacker_faction_ids), as ESI
 * recorded them at the time of the kill. The counters use today's
 * faction_id on corporations and characters instead.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

/** ESI's placeholder faction. Its name is literally "Unknown". */
const UNKNOWN_FACTION_ID = 500021;

/**
 * NPC corporations sit below this id. The corporations resolver drops them
 * (resolvers/corporation/queries.ts), so the counter must too, or the header
 * would count corporations the Members tab never lists.
 */
const PLAYER_CORPORATION_MIN_ID = 2_000_000;

const COUNTER_TTL = 7200;

function timeFilter(filter: string | null | undefined): Prisma.Sql {
  switch (filter) {
    case 'LAST_90_DAYS':
      return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '90 days'`;
    case 'LAST_7_DAYS':
      return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '7 days'`;
    case 'TODAY':
      return Prisma.sql`AND DATE(kf.killmail_time) = CURRENT_DATE`;
    default:
      return Prisma.sql``; // ALL_TIME – no constraint
  }
}

function calculateTTL(filter?: string | null): number {
  switch (filter) {
    case 'TODAY':
      return 120;
    case 'LAST_7_DAYS':
      return 300;
    case 'LAST_90_DAYS':
      return 900;
    default:
      return 3600;
  }
}

function topKey(
  factionId: number,
  statType: string,
  filter?: string | null,
): string {
  return `faction_stats:${factionId}:${statType}:${filter || 'ALL_TIME'}`;
}

async function cached<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const value = await load();
  await redis.setex(key, ttl, JSON.stringify(value));
  return value;
}

/** Top 10 pilots by kills made while flying for the faction. */
export async function getFactionTopCharacters(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    character_id: number;
    character_name: string;
    security_status: number | null;
    corporation_id: number;
    alliance_id: number | null;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'characters', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          a.character_id,
          ch.name AS character_name,
          ch.security_status,
          ch.corporation_id,
          ch.alliance_id,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN attackers a ON a.killmail_id = kf.killmail_id
        INNER JOIN characters ch ON ch.id = a.character_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND a.faction_id = ${factionId}
          AND a.character_id IS NOT NULL
          ${timeFilter(filter)}
        GROUP BY a.character_id, ch.name, ch.security_status,
                 ch.corporation_id, ch.alliance_id
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        character: {
          id: row.character_id,
          name: row.character_name,
          security_status: row.security_status,
          corporation_id: row.corporation_id,
          alliance_id: row.alliance_id,
        },
      }));
    },
  );
}

/** Top 10 corporations by killmails their pilots made for the faction. */
export async function getFactionTopCorporations(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    corporation_id: number;
    corporation_name: string;
    corporation_ticker: string;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'corporations', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          a.corporation_id,
          co.name AS corporation_name,
          co.ticker AS corporation_ticker,
          COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN attackers a ON a.killmail_id = kf.killmail_id
        INNER JOIN corporations co ON co.id = a.corporation_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND a.faction_id = ${factionId}
          ${timeFilter(filter)}
        GROUP BY a.corporation_id, co.name, co.ticker
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        corporation: {
          id: row.corporation_id,
          name: row.corporation_name,
          ticker: row.corporation_ticker,
        },
      }));
    },
  );
}

/** Top 10 ship types the faction's pilots flew on kills. */
export async function getFactionTopShips(
  factionId: number,
  filter?: string | null,
) {
  type Row = { ship_type_id: number; ship_name: string; kill_count: bigint };

  return cached(
    topKey(factionId, 'top_ships', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          a.ship_type_id,
          t.name AS ship_name,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN attackers a ON a.killmail_id = kf.killmail_id
        INNER JOIN types t ON t.id = a.ship_type_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND a.faction_id = ${factionId}
          AND a.ship_type_id IS NOT NULL
          ${timeFilter(filter)}
        GROUP BY a.ship_type_id, t.name
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        shipType: { id: row.ship_type_id, name: row.ship_name },
      }));
    },
  );
}

/**
 * Top 10 other factions whose pilots the faction killed. The faction itself
 * and the Unknown placeholder are left out.
 */
export async function getFactionTopFactionTargets(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    victim_faction_id: number;
    faction_name: string;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'factions', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          kf.victim_faction_id,
          f.name AS faction_name,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN factions f ON f.id = kf.victim_faction_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND kf.victim_faction_id <> ${factionId}
          AND kf.victim_faction_id <> ${UNKNOWN_FACTION_ID}
          ${timeFilter(filter)}
        GROUP BY kf.victim_faction_id, f.name
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        faction: { id: row.victim_faction_id, name: row.faction_name },
      }));
    },
  );
}

/** Top 10 victim ship types on the faction's kills. */
export async function getFactionTopShipTargets(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    victim_ship_type_id: number;
    ship_name: string;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'ships', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          kf.victim_ship_type_id,
          t.name AS ship_name,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN types t ON t.id = kf.victim_ship_type_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND kf.victim_ship_type_id IS NOT NULL
          ${timeFilter(filter)}
        GROUP BY kf.victim_ship_type_id, t.name
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        shipType: { id: row.victim_ship_type_id, name: row.ship_name },
      }));
    },
  );
}

export async function getMemberCorporationCount(
  factionId: number,
): Promise<number> {
  return cached(
    `faction_stats:${factionId}:member_corporations`,
    COUNTER_TTL,
    () =>
      prisma.corporation.count({
        where: {
          faction_id: factionId,
          id: { gte: PLAYER_CORPORATION_MIN_ID },
        },
      }),
  );
}

export async function getMemberCharacterCount(
  factionId: number,
): Promise<number> {
  return cached(
    `faction_stats:${factionId}:member_characters`,
    COUNTER_TTL,
    () => prisma.character.count({ where: { faction_id: factionId } }),
  );
}

export async function getSovereigntySystemCount(
  factionId: number,
): Promise<number> {
  return cached(`faction_stats:${factionId}:sov_systems`, COUNTER_TTL, () =>
    prisma.sovereigntyMapCurrent.count({ where: { faction_id: factionId } }),
  );
}
