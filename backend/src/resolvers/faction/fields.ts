import { FactionResolvers } from '@generated-types';

/**
 * Faction Field Resolvers
 * Maps Prisma's snake_case columns to GraphQL's camelCase fields.
 */
export const factionFields: FactionResolvers = {
  // Map Prisma's corporation_id (snake_case) to GraphQL's corporationId
  corporationId: (parent) => {
    const prismaParent = parent as any;
    return prismaParent.corporation_id ?? null;
  },

  // Map Prisma's militia_corporation_id (snake_case) to GraphQL's militiaCorporationId
  militiaCorporationId: (parent) => {
    const prismaParent = parent as any;
    return prismaParent.militia_corporation_id ?? null;
  },
};
