import { MutationResolvers, QueryResolvers } from '../generated-types';
import {
  getCharacterKillmails,
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
    // Authentication kontrolü
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    const maxLimit = limit ?? 50;

    try {
      // ESI'dan kullanıcının killmail'lerini çek
      const killmailList = await getCharacterKillmails(
        context.user.characterId,
        context.token
      );

      // İlk N taneyi al
      const limitedList = killmailList.slice(0, maxLimit);

      // Her killmail için detayları çek
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
                characterName: null, // Sonra character name resolve edeceğiz
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
              totalValue: null, // Değer hesaplaması sonra eklenecek
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

      // Null olanları filtrele
      return killmailsWithDetails.filter((km) => km !== null) as any;
    } catch (error) {
      console.error('Failed to fetch character killmails:', error);
      throw new Error('Failed to fetch your killmails');
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
      // ESI'dan killmail'leri çek
      const killmailList = await getCharacterKillmails(
        context.user.characterId,
        context.token
      );

      // TODO: Database'e kaydetme işlemi buraya gelecek
      // Şimdilik sadece sayısını döndürelim

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

