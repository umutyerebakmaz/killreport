import {
  AttackerResolvers,
  KillmailItemResolvers,
  KillmailResolvers,
  MutationResolvers,
  QueryResolvers,
  VictimResolvers,
} from '../generated-types';
import { CharacterService } from '../services/character';
import { CorporationService } from '../services/corporation';
import { KillmailService } from '../services/killmail';
import prisma from '../services/prisma';

// Query Resolvers
export const killmailQueries: QueryResolvers = {
  killmail: async (_, { id }) => {
    const killmail = await prisma.killmail.findUnique({
      where: { killmail_id: Number(id) },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    if (!killmail) return null;

    return {
      id: killmail.killmail_id.toString(),
      killmailId: killmail.killmail_id,
      killmailHash: killmail.killmail_hash,
      killmailTime: killmail.killmail_time.toISOString(),
      solarSystemId: killmail.solar_system_id,
      createdAt: killmail.created_at.toISOString(),
      victim: {
        characterId: killmail.victim?.character_id ?? null,
        corporationId: killmail.victim?.corporation_id ?? 0,
        allianceId: killmail.victim?.alliance_id ?? null,
        factionId: killmail.victim?.faction_id ?? null,
        shipTypeId: killmail.victim?.ship_type_id ?? 0,
        damageTaken: killmail.victim?.damage_taken ?? 0,
        position: killmail.victim?.position_x ? {
          x: killmail.victim.position_x,
          y: killmail.victim.position_y!,
          z: killmail.victim.position_z!,
        } : null,
      },
      attackers: killmail.attackers.map(attacker => ({
        characterId: attacker.character_id ?? null,
        corporationId: attacker.corporation_id ?? null,
        allianceId: attacker.alliance_id ?? null,
        factionId: attacker.faction_id ?? null,
        shipTypeId: attacker.ship_type_id ?? null,
        weaponTypeId: attacker.weapon_type_id ?? null,
        damageDone: attacker.damage_done,
        finalBlow: attacker.final_blow,
        securityStatus: attacker.security_status,
      })),
      items: killmail.items.map(item => ({
        itemTypeId: item.item_type_id,
        flag: item.flag,
        quantityDropped: item.quantity_dropped ?? null,
        quantityDestroyed: item.quantity_destroyed ?? null,
        singleton: item.singleton,
      })),
      totalValue: null,
    } as any;
  },

  killmails: async (_, args) => {
    const first = args.first ?? 25;
    const after = args.after ? parseInt(Buffer.from(args.after, 'base64').toString()) : 0;

    const totalCount = await prisma.killmail.count();
    const totalPages = Math.ceil(totalCount / first);

    const killmails = await prisma.killmail.findMany({
      skip: after,
      take: first,
      orderBy: { killmail_time: 'desc' },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmailId: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
        victim: {
          characterId: km.victim?.character_id ?? null,
          corporationId: km.victim?.corporation_id ?? 0,
          allianceId: km.victim?.alliance_id ?? null,
          factionId: km.victim?.faction_id ?? null,
          shipTypeId: km.victim?.ship_type_id ?? 0,
          damageTaken: km.victim?.damage_taken ?? 0,
          position: km.victim?.position_x ? {
            x: km.victim.position_x,
            y: km.victim.position_y!,
            z: km.victim.position_z!,
          } : null,
        },
        attackers: km.attackers.map(attacker => ({
          characterId: attacker.character_id ?? null,
          corporationId: attacker.corporation_id ?? null,
          allianceId: attacker.alliance_id ?? null,
          factionId: attacker.faction_id ?? null,
          shipTypeId: attacker.ship_type_id ?? null,
          weaponTypeId: attacker.weapon_type_id ?? null,
          damageDone: attacker.damage_done,
          finalBlow: attacker.final_blow,
          securityStatus: attacker.security_status,
        })),
        items: km.items.map(item => ({
          itemTypeId: item.item_type_id,
          flag: item.flag,
          quantityDropped: item.quantity_dropped ?? null,
          quantityDestroyed: item.quantity_destroyed ?? null,
          singleton: item.singleton,
        })),
        totalValue: null,
      } as any,
      cursor: Buffer.from(`${after + index + 1}`).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: after + first < totalCount,
        hasPreviousPage: after > 0,
        currentPage: Math.floor(after / first) + 1,
        totalPages,
        totalCount,
      },
    };
  },

  characterKillmails: async (_, { characterId, first, after }) => {
    const take = first ?? 25;
    const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

    // Count killmails where character is victim OR attacker
    const totalCount = await prisma.killmail.count({
      where: {
        OR: [
          { victim: { character_id: characterId } },
          { attackers: { some: { character_id: characterId } } },
        ],
      },
    });

    const totalPages = Math.ceil(totalCount / take);

    // Fetch killmails
    const killmails = await prisma.killmail.findMany({
      where: {
        OR: [
          { victim: { character_id: characterId } },
          { attackers: { some: { character_id: characterId } } },
        ],
      },
      skip,
      take,
      orderBy: { killmail_time: 'desc' },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmailId: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
        victim: {
          characterId: km.victim?.character_id ?? null,
          corporationId: km.victim?.corporation_id ?? 0,
          allianceId: km.victim?.alliance_id ?? null,
          factionId: km.victim?.faction_id ?? null,
          shipTypeId: km.victim?.ship_type_id ?? 0,
          damageTaken: km.victim?.damage_taken ?? 0,
          position: km.victim?.position_x ? {
            x: km.victim.position_x,
            y: km.victim.position_y!,
            z: km.victim.position_z!,
          } : null,
        },
        attackers: km.attackers.map(attacker => ({
          characterId: attacker.character_id ?? null,
          corporationId: attacker.corporation_id ?? null,
          allianceId: attacker.alliance_id ?? null,
          factionId: attacker.faction_id ?? null,
          shipTypeId: attacker.ship_type_id ?? null,
          weaponTypeId: attacker.weapon_type_id ?? null,
          damageDone: attacker.damage_done,
          finalBlow: attacker.final_blow,
          securityStatus: attacker.security_status,
        })),
        items: km.items.map(item => ({
          itemTypeId: item.item_type_id,
          flag: item.flag,
          quantityDropped: item.quantity_dropped ?? null,
          quantityDestroyed: item.quantity_destroyed ?? null,
          singleton: item.singleton,
        })),
        totalValue: null,
      } as any,
      cursor: Buffer.from(`${skip + index + 1}`).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: skip + take < totalCount,
        hasPreviousPage: skip > 0,
        currentPage: Math.floor(skip / take) + 1,
        totalPages,
        totalCount,
      },
    };
  },

  corporationKillmails: async (_, { corporationId, first, after }) => {
    const take = first ?? 25;
    const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

    const totalCount = await prisma.killmail.count({
      where: {
        OR: [
          { victim: { corporation_id: corporationId } },
          { attackers: { some: { corporation_id: corporationId } } },
        ],
      },
    });

    const totalPages = Math.ceil(totalCount / take);

    const killmails = await prisma.killmail.findMany({
      where: {
        OR: [
          { victim: { corporation_id: corporationId } },
          { attackers: { some: { corporation_id: corporationId } } },
        ],
      },
      skip,
      take,
      orderBy: { killmail_time: 'desc' },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmailId: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
        victim: {
          characterId: km.victim?.character_id ?? null,
          corporationId: km.victim?.corporation_id ?? 0,
          allianceId: km.victim?.alliance_id ?? null,
          factionId: km.victim?.faction_id ?? null,
          shipTypeId: km.victim?.ship_type_id ?? 0,
          damageTaken: km.victim?.damage_taken ?? 0,
          position: km.victim?.position_x ? {
            x: km.victim.position_x,
            y: km.victim.position_y!,
            z: km.victim.position_z!,
          } : null,
        },
        attackers: km.attackers.map(attacker => ({
          characterId: attacker.character_id ?? null,
          corporationId: attacker.corporation_id ?? null,
          allianceId: attacker.alliance_id ?? null,
          factionId: attacker.faction_id ?? null,
          shipTypeId: attacker.ship_type_id ?? null,
          weaponTypeId: attacker.weapon_type_id ?? null,
          damageDone: attacker.damage_done,
          finalBlow: attacker.final_blow,
          securityStatus: attacker.security_status,
        })),
        items: km.items.map(item => ({
          itemTypeId: item.item_type_id,
          flag: item.flag,
          quantityDropped: item.quantity_dropped ?? null,
          quantityDestroyed: item.quantity_destroyed ?? null,
          singleton: item.singleton,
        })),
        totalValue: null,
      } as any,
      cursor: Buffer.from(`${skip + index + 1}`).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: skip + take < totalCount,
        hasPreviousPage: skip > 0,
        currentPage: Math.floor(skip / take) + 1,
        totalPages,
        totalCount,
      },
    };
  },

  allianceKillmails: async (_, { allianceId, first, after }) => {
    const take = first ?? 25;
    const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

    const totalCount = await prisma.killmail.count({
      where: {
        OR: [
          { victim: { alliance_id: allianceId } },
          { attackers: { some: { alliance_id: allianceId } } },
        ],
      },
    });

    const totalPages = Math.ceil(totalCount / take);

    const killmails = await prisma.killmail.findMany({
      where: {
        OR: [
          { victim: { alliance_id: allianceId } },
          { attackers: { some: { alliance_id: allianceId } } },
        ],
      },
      skip,
      take,
      orderBy: { killmail_time: 'desc' },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmailId: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
        victim: {
          characterId: km.victim?.character_id ?? null,
          corporationId: km.victim?.corporation_id ?? 0,
          allianceId: km.victim?.alliance_id ?? null,
          factionId: km.victim?.faction_id ?? null,
          shipTypeId: km.victim?.ship_type_id ?? 0,
          damageTaken: km.victim?.damage_taken ?? 0,
          position: km.victim?.position_x ? {
            x: km.victim.position_x,
            y: km.victim.position_y!,
            z: km.victim.position_z!,
          } : null,
        },
        attackers: km.attackers.map(attacker => ({
          characterId: attacker.character_id ?? null,
          corporationId: attacker.corporation_id ?? null,
          allianceId: attacker.alliance_id ?? null,
          factionId: attacker.faction_id ?? null,
          shipTypeId: attacker.ship_type_id ?? null,
          weaponTypeId: attacker.weapon_type_id ?? null,
          damageDone: attacker.damage_done,
          finalBlow: attacker.final_blow,
          securityStatus: attacker.security_status,
        })),
        items: km.items.map(item => ({
          itemTypeId: item.item_type_id,
          flag: item.flag,
          quantityDropped: item.quantity_dropped ?? null,
          quantityDestroyed: item.quantity_destroyed ?? null,
          singleton: item.singleton,
        })),
        totalValue: null,
      } as any,
      cursor: Buffer.from(`${skip + index + 1}`).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: skip + take < totalCount,
        hasPreviousPage: skip > 0,
        currentPage: Math.floor(skip / take) + 1,
        totalPages,
        totalCount,
      },
    };
  },

  myKillmails: async (_, { limit }, context: any) => {
    // Check authentication
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    const maxLimit = limit ?? 50;

    try {
      // Fetch user's killmails from ESI
      const killmailList = await CharacterService.getCharacterKillmails(
        context.user.characterId,
        context.token
      );

      // Get first N items
      const limitedList = killmailList.slice(0, maxLimit);

      // Fetch details for each killmail
      const killmailsWithDetails = await Promise.all(
        limitedList.map(async (km) => {
          try {
            const detail = await KillmailService.getKillmailDetail(
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
      const characterInfo = await CharacterService.getCharacterInfo(context.user.characterId);

      if (!characterInfo.corporation_id) {
        throw new Error('Character has no corporation');
      }

      console.log(`📊 Fetching corporation killmails for corp ${characterInfo.corporation_id}`);

      // Fetch corporation killmails from ESI
      const killmailList = await CorporationService.getCorporationKillmails(
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
            const detail = await KillmailService.getKillmailDetail(
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
  syncMyKillmails: async (_, { input }, context: any) => {
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    try {
      // Fetch killmails from ESI
      const killmailList = await CharacterService.getCharacterKillmails(
        context.user.characterId,
        context.token
      );

      // TODO: Database save operation will be added here
      // For now, just return the count

      return {
        success: true,
        message: `Successfully fetched ${killmailList.length} killmails`,
        syncedCount: killmailList.length,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
        syncedCount: 0,
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};

// Field Resolvers
export const killmailFieldResolvers: KillmailResolvers = {
  solarSystem: async (parent, _, context) => {
    if (!parent.solarSystemId) return null;
    return context.loaders.solarSystem.load(parent.solarSystemId);
  },
};

export const victimFieldResolvers: VictimResolvers = {
  character: async (parent, _, context) => {
    if (!parent.characterId) return null;
    return context.loaders.character.load(parent.characterId);
  },
  corporation: async (parent, _, context) => {
    if (!parent.corporationId) return null;
    return context.loaders.corporation.load(parent.corporationId);
  },
  alliance: async (parent, _, context) => {
    if (!parent.allianceId) return null;
    return context.loaders.alliance.load(parent.allianceId);
  },
  shipType: async (parent, _, context) => {
    if (!parent.shipTypeId) return null;
    const type = await context.loaders.type.load(parent.shipTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
};

export const attackerFieldResolvers: AttackerResolvers = {
  character: async (parent, _, context) => {
    if (!parent.characterId) return null;
    return context.loaders.character.load(parent.characterId);
  },
  corporation: async (parent, _, context) => {
    if (!parent.corporationId) return null;
    return context.loaders.corporation.load(parent.corporationId);
  },
  alliance: async (parent, _, context) => {
    if (!parent.allianceId) return null;
    return context.loaders.alliance.load(parent.allianceId);
  },
  shipType: async (parent, _, context) => {
    if (!parent.shipTypeId) return null;
    const type = await context.loaders.type.load(parent.shipTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
  weaponType: async (parent, _, context) => {
    if (!parent.weaponTypeId) return null;
    const type = await context.loaders.type.load(parent.weaponTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
};

export const killmailItemFieldResolvers: KillmailItemResolvers = {
  itemType: async (parent, _, context) => {
    if (!parent.itemTypeId) return null;
    const type = await context.loaders.type.load(parent.itemTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
};
