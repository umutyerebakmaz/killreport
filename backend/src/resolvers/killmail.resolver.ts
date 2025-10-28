import { MutationResolvers, QueryResolvers } from '../generated-types';
import {
  getCharacterInfo,
  getCharacterKillmails,
  getCorporationKillmails,
  getKillmailDetail,
} from '../services/eve-esi';

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
    const km = killmails.find((k) => k.id === id);
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

    return killmails.slice(offset, offset + limit).map((km) => ({
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

  myKillmails: async (_, { limit }, context: any) => {
    // Check authentication
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    const maxLimit = limit ?? 50;

    try {
      // Fetch user's killmails from ESI
      const killmailList = await getCharacterKillmails(
        context.user.characterId,
        context.token
      );

      // Get first N items
      const limitedList = killmailList.slice(0, maxLimit);

      // Fetch details for each killmail
      const killmailsWithDetails = await Promise.all(
        limitedList.map(async (km) => {
          try {
            const detail = await getKillmailDetail(
              km.killmail_id,
              km.killmail_hash
            );

            return {
              id: km.killmail_id.toString(),
              killmailId: km.killmail_id,
              killmailHash: km.killmail_hash,
              killmailTime: detail.killmail_time,
              victim: {
                characterId: detail.victim.character_id ?? null,
                characterName: null, // Will resolve character name later
                corporationId: detail.victim.corporation_id,
                corporationName: null,
                shipTypeId: detail.victim.ship_type_id,
                damageTaken: detail.victim.damage_taken,
              },
              attackers: detail.attackers.map((attacker) => ({
                characterId: attacker.character_id ?? null,
                characterName: null,
                corporationId: attacker.corporation_id ?? null,
                shipTypeId: attacker.ship_type_id ?? null,
                weaponTypeId: attacker.weapon_type_id ?? null,
                finalBlow: attacker.final_blow,
              })),
              totalValue: null, // Value calculation will be added later
            };
          } catch (error) {
            console.error(
              `Failed to fetch killmail ${km.killmail_id}:`,
              error
            );
            return null;
          }
        })
      );

      // Filter out null values
      return killmailsWithDetails.filter((km) => km !== null) as any;
    } catch (error) {
      console.error('Failed to fetch character killmails:', error);
      throw new Error('Failed to fetch your killmails');
    }
  },

  myCorporationKillmails: async (_, { limit }, context: any) => {
    // Check authentication
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    const maxLimit = limit ?? 50;

    try {
      // First get user's corporation ID
      const characterInfo = await getCharacterInfo(context.user.characterId);

      if (!characterInfo.corporation_id) {
        throw new Error('Character has no corporation');
      }

      console.log(`📊 Fetching corporation killmails for corp ${characterInfo.corporation_id}`);

      // Fetch corporation killmails from ESI
      const killmailList = await getCorporationKillmails(
        characterInfo.corporation_id,
        context.token
      );

      console.log(`✅ Found ${killmailList.length} corporation killmails`);

      // Get first N items
      const limitedList = killmailList.slice(0, maxLimit);

      // Fetch details for each killmail
      const killmailsWithDetails = await Promise.all(
        limitedList.map(async (km) => {
          try {
            const detail = await getKillmailDetail(
              km.killmail_id,
              km.killmail_hash
            );

            return {
              id: km.killmail_id.toString(),
              killmailId: km.killmail_id,
              killmailHash: km.killmail_hash,
              killmailTime: detail.killmail_time,
              victim: {
                characterId: detail.victim.character_id ?? null,
                characterName: null,
                corporationId: detail.victim.corporation_id,
                corporationName: null,
                shipTypeId: detail.victim.ship_type_id,
                damageTaken: detail.victim.damage_taken,
              },
              attackers: detail.attackers.map((attacker) => ({
                characterId: attacker.character_id ?? null,
                characterName: null,
                corporationId: attacker.corporation_id ?? null,
                shipTypeId: attacker.ship_type_id ?? null,
                weaponTypeId: attacker.weapon_type_id ?? null,
                finalBlow: attacker.final_blow,
              })),
              totalValue: null,
            };
          } catch (error) {
            console.error(
              `Failed to fetch killmail ${km.killmail_id}:`,
              error
            );
            return null;
          }
        })
      );

      // Filter out null values
      return killmailsWithDetails.filter((km) => km !== null) as any;
    } catch (error) {
      console.error('Failed to fetch corporation killmails:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to fetch corporation killmails'
      );
    }
  },
};

// Mutation Resolvers
export const killmailMutations: MutationResolvers = {
  syncMyKillmails: async (_, __, context: any) => {
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    try {
      // Fetch killmails from ESI
      const killmailList = await getCharacterKillmails(
        context.user.characterId,
        context.token
      );

      // TODO: Database save operation will be added here
      // For now, just return the count

      return {
        success: true,
        message: `Successfully fetched ${killmailList.length} killmails`,
        syncedCount: killmailList.length,
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
        syncedCount: 0,
      };
    }
  },
};

