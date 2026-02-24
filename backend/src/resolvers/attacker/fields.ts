import { AttackerResolvers } from '@generated-types';

/**
 * Attacker Field Resolvers
 * Handles field mapping from Prisma (snake_case) to GraphQL (camelCase)
 * Uses DataLoaders to prevent N+1 queries for related entities
 */
export const attackerFields: AttackerResolvers = {
  // Map snake_case database fields to camelCase GraphQL fields (scalar fields)
  factionId: (parent: any) => parent.faction_id ?? null,
  damageDone: (parent: any) => parent.damage_done,
  finalBlow: (parent: any) => parent.final_blow,
  securityStatus: (parent: any) => parent.security_status ?? null,

  // Nested entities - use DataLoaders
  character: async (parent: any, _, context) => {
    if (!parent.character_id) return null;
    return context.loaders.character.load(parent.character_id);
  },

  corporation: async (parent: any, _, context) => {
    if (!parent.corporation_id) return null;
    const corporation = await context.loaders.corporation.load(parent.corporation_id);
    if (!corporation) return null;
    return {
      ...corporation,
      date_founded: corporation.date_founded?.toISOString() || null,
    } as any;
  },

  alliance: async (parent: any, _, context) => {
    if (!parent.alliance_id) return null;
    const alliance = await context.loaders.alliance.load(parent.alliance_id);
    if (!alliance) return null;
    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    } as any;
  },

  shipType: async (parent: any, _, context) => {
    if (!parent.ship_type_id) return null;
    const type = await context.loaders.type.load(parent.ship_type_id);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },

  weaponType: async (parent: any, _, context) => {
    if (!parent.weapon_type_id) return null;
    const type = await context.loaders.type.load(parent.weapon_type_id);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
};
