import { QueryResolvers } from '@generated-types';
import { getTrackerRefs } from '@services/tracker/tracker.service';
import { GraphQLError } from 'graphql';

type Entry = { automatic: boolean; name: string };

/** Automatic entries first, then by name. */
function byAutomaticThenName(a: Entry, b: Entry): number {
  if (a.automatic !== b.automatic) return a.automatic ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * Tracker Query Resolvers
 * Entities come from the DataLoaders, so the existing Character, Corporation
 * and Alliance field resolvers work on the rows returned here.
 */
export const trackerQueries: QueryResolvers = {
  myTracker: async (_parent, _args, context: any) => {
    const characterId = context.user?.characterId;
    if (!characterId) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const refs = await getTrackerRefs(characterId);

    const resolved = await Promise.all(
      refs.map(async (ref) => {
        switch (ref.type) {
          case 'CHARACTER': {
            const row = await context.loaders.character.load(ref.id);
            if (!row) return null;
            return {
              type: ref.type,
              automatic: ref.automatic,
              name: row.name as string,
              entity: {
                ...row,
                updatedAt: row.updated_at
                  ? row.updated_at.toISOString()
                  : new Date().toISOString(),
                birthday: row.birthday ? row.birthday.toISOString() : null,
              },
            };
          }
          case 'CORPORATION': {
            const row = await context.loaders.corporation.load(ref.id);
            if (!row) return null;
            return {
              type: ref.type,
              automatic: ref.automatic,
              name: row.name as string,
              entity: {
                ...row,
                date_founded: row.date_founded?.toISOString() || null,
                // BigInt is not serializable
                shares: row.shares ? row.shares.toString() : null,
              },
            };
          }
          case 'ALLIANCE': {
            const row = await context.loaders.alliance.load(ref.id);
            if (!row) return null;
            return {
              type: ref.type,
              automatic: ref.automatic,
              name: row.name as string,
              entity: {
                ...row,
                date_founded: row.date_founded.toISOString(),
              },
            };
          }
        }
      }),
    );

    const present = resolved
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort(byAutomaticThenName);

    return {
      characters: present
        .filter((r) => r.type === 'CHARACTER')
        .map((r) => ({ automatic: r.automatic, character: r.entity })),
      corporations: present
        .filter((r) => r.type === 'CORPORATION')
        .map((r) => ({ automatic: r.automatic, corporation: r.entity })),
      alliances: present
        .filter((r) => r.type === 'ALLIANCE')
        .map((r) => ({ automatic: r.automatic, alliance: r.entity })),
    } as any;
  },
};
