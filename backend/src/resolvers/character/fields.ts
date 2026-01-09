import { CharacterResolvers } from '@generated-types';

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
};
