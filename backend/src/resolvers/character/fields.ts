import { CharacterResolvers } from '@generated-types';
import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';

/**
 * Returns a Prisma.Sql fragment for filtering killmail_time by TimeFilter enum.
 * Uses killmail_filters table with GIN indexes for fast queries.
 */
function timeFilter(filter: string | null | undefined): Prisma.Sql {
  switch (filter) {
    case 'last90Days': return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '90 days'`;
    case 'last7Days': return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '7 days'`;
    case 'today': return Prisma.sql`AND DATE(kf.killmail_time) = CURRENT_DATE`;
    default: return Prisma.sql``; // allTime – no constraint
  }
}

/**
 * Character Field Resolvers
 * Handles nested fields and computed properties for Character type
 * Uses DataLoaders to prevent N+1 queries
 */
export const characterFields: CharacterResolvers = {
  corporation: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaChar = parent as any;
    const corporation = await context.loaders.corporation.load(prismaChar.corporation_id);
    if (!corporation) return null;

    return {
      ...corporation,
      date_founded: corporation.date_founded?.toISOString() || null,
    };
  },

  alliance: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaChar = parent as any;
    if (!prismaChar.alliance_id) return null;

    const alliance = await context.loaders.alliance.load(prismaChar.alliance_id);
    if (!alliance) return null;

    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    };
  },

  race: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaChar = parent as any;
    const race = await context.loaders.race.load(prismaChar.race_id);
    return race || null;
  },

  bloodline: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaChar = parent as any;
    const bloodline = await context.loaders.bloodline.load(prismaChar.bloodline_id);
    return bloodline || null;
  },

  // Map Prisma's security_status (snake_case) to GraphQL's securityStatus (camelCase)
  securityStatus: (parent) => {
    const prismaChar = parent as any;
    return prismaChar.security_status ?? null;
  },

  // Top 10 alliances this character killed most.
  // Uses killmail_filters with GIN indexes - fast and simple.
  topAllianceTargets: async (parent, args, _context) => {
    const characterId = (parent as any).id;
    const filter = timeFilter((args as any).filter);

    type Row = {
      victim_alliance_id: number;
      alliance_name: string;
      alliance_ticker: string;
      kill_count: bigint;
    };

    const results = await prisma.$queryRaw<Row[]>`
      SELECT
        kf.victim_alliance_id,
        a.name AS alliance_name,
        a.ticker AS alliance_ticker,
        COUNT(*)::BIGINT AS kill_count
      FROM killmail_filters kf
      INNER JOIN alliances a ON a.id = kf.victim_alliance_id
      WHERE ${characterId} = ANY(kf.attacker_character_ids)
        AND kf.victim_alliance_id IS NOT NULL
        ${filter}
      GROUP BY kf.victim_alliance_id, a.name, a.ticker
      ORDER BY kill_count DESC
      LIMIT 10
    `;

    return results.map(row => ({
      killCount: Number(row.kill_count),
      alliance: {
        id: row.victim_alliance_id,
        name: row.alliance_name,
        ticker: row.alliance_ticker,
      } as any,
    }));
  },

  // Top 10 corporations this character killed most.
  // Uses killmail_filters with GIN indexes - fast and simple.
  topCorporationTargets: async (parent, args, _context) => {
    const characterId = (parent as any).id;
    const filter = timeFilter((args as any).filter);

    type Row = {
      victim_corporation_id: number;
      corporation_name: string;
      corporation_ticker: string;
      kill_count: bigint;
    };

    const results = await prisma.$queryRaw<Row[]>`
      SELECT
        kf.victim_corporation_id,
        co.name AS corporation_name,
        co.ticker AS corporation_ticker,
        COUNT(*)::BIGINT AS kill_count
      FROM killmail_filters kf
      INNER JOIN corporations co ON co.id = kf.victim_corporation_id
      WHERE ${characterId} = ANY(kf.attacker_character_ids)
        AND kf.victim_corporation_id IS NOT NULL
        ${filter}
      GROUP BY kf.victim_corporation_id, co.name, co.ticker
      ORDER BY kill_count DESC
      LIMIT 10
    `;

    return results.map(row => ({
      killCount: Number(row.kill_count),
      corporation: {
        id: row.victim_corporation_id,
        name: row.corporation_name,
        ticker: row.corporation_ticker,
      } as any,
    }));
  },

  // Top 10 ship types this character killed most.
  // Uses killmail_filters with GIN indexes - fast and simple.
  topShipTargets: async (parent, args, _context) => {
    const characterId = (parent as any).id;
    const filter = timeFilter((args as any).filter);

    type Row = {
      victim_ship_type_id: number;
      ship_name: string;
      kill_count: bigint;
    };

    const results = await prisma.$queryRaw<Row[]>`
      SELECT
        kf.victim_ship_type_id,
        t.name AS ship_name,
        COUNT(*)::BIGINT AS kill_count
      FROM killmail_filters kf
      INNER JOIN types t ON t.id = kf.victim_ship_type_id
      WHERE ${characterId} = ANY(kf.attacker_character_ids)
        AND kf.victim_ship_type_id IS NOT NULL
        ${filter}
      GROUP BY kf.victim_ship_type_id, t.name
      ORDER BY kill_count DESC
      LIMIT 10
    `;

    return results.map(row => ({
      killCount: Number(row.kill_count),
      shipType: {
        id: row.victim_ship_type_id,
        name: row.ship_name,
      } as any,
    }));
  },
};
