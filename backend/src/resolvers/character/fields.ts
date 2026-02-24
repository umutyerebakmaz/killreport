import { CharacterResolvers } from '@generated-types';
import prisma from '@services/prisma';

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

  // Top 10 alliances this character killed most
  // Uses pre-computed materialized view for O(1) lookup
  topAllianceTargets: async (parent, _args, context) => {
    const characterId = (parent as any).id;

    type AllianceTopTargetRow = {
      character_id: bigint;
      alliance_id: number;
      kill_count: bigint;
      alliance_name: string;
    };

    const results = await prisma.$queryRaw<AllianceTopTargetRow[]>`
      SELECT
        character_id,
        alliance_id,
        kill_count,
        alliance_name
      FROM character_top_alliance_targets_mv
      WHERE character_id = ${characterId}
      ORDER BY kill_count DESC
      LIMIT 10
    `;

    return results.map(row => ({
      killCount: Number(row.kill_count),
      alliance: {
        id: row.alliance_id,
        name: row.alliance_name,
        // Return minimal data - full Alliance object not needed
      } as any,
    }));
  },

  // Top 10 corporations this character killed most
  // Uses pre-computed materialized view for O(1) lookup
  topCorporationTargets: async (parent, _args, context) => {
    const characterId = (parent as any).id;

    type CorporationTopTargetRow = {
      character_id: bigint;
      corporation_id: number;
      kill_count: bigint;
      corporation_name: string;
    };

    const results = await prisma.$queryRaw<CorporationTopTargetRow[]>`
      SELECT
        character_id,
        corporation_id,
        kill_count,
        corporation_name
      FROM character_top_corporation_targets_mv
      WHERE character_id = ${characterId}
      ORDER BY kill_count DESC
      LIMIT 10
    `;

    return results.map(row => ({
      killCount: Number(row.kill_count),
      corporation: {
        id: row.corporation_id,
        name: row.corporation_name,
        // Return minimal data - full Corporation object not needed
      } as any,
    }));
  },
};
