import { QueryResolvers } from '../generated-types';

// Mock data
const killmails = [
  {
    id: '1',
    killmailId: 123456,
    killmailHash: 'abc123def456',
    killmailTime: new Date().toISOString(),
    totalValue: 1500000000,
  },
];

// Query Resolvers
export const killmailQueries: QueryResolvers = {
  killmail: (_, { id }) => {
    const km = killmails.find(k => k.id === id);
    if (!km) return null;

    return {
      ...km,
      victim: {
        characterId: 12345,
        characterName: 'Victim Name',
        corporationId: 98765,
        corporationName: 'Victim Corp',
        shipTypeId: 587,
        damageTaken: 10000,
      },
      attackers: [
        {
          characterId: 54321,
          characterName: 'Attacker Name',
          corporationId: 11111,
          shipTypeId: 588,
          weaponTypeId: 2456,
          finalBlow: true,
        },
      ],
    };
  },

  killmails: (_, args) => {
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    return killmails
      .slice(offset, offset + limit)
      .map(km => ({
        ...km,
        victim: {
          characterId: 12345,
          characterName: 'Victim Name',
          corporationId: 98765,
          corporationName: 'Victim Corp',
          shipTypeId: 587,
          damageTaken: 10000,
        },
        attackers: [
          {
            characterId: 54321,
            characterName: 'Attacker Name',
            corporationId: 11111,
            shipTypeId: 588,
            weaponTypeId: 2456,
            finalBlow: true,
          },
        ],
      }));
  },
};
