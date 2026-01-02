import {
  AttackerResolvers,
  KillmailItemResolvers,
  KillmailResolvers,
  MutationResolvers,
  QueryResolvers,
  SubscriptionResolvers,
  VictimResolvers,
} from '../generated-types';
import { CharacterService } from '../services/character';
import { CorporationService } from '../services/corporation';
import { KillmailService } from '../services/killmail';
import prisma from '../services/prisma';
import { pubsub } from '../services/pubsub';
import redis from '../services/redis';

// Query Resolvers
export const killmailQueries: QueryResolvers = {
  killmail: async (_, { id }) => {
    const cacheKey = `killmail:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const killmail = await prisma.killmail.findUnique({
      where: { killmail_id: Number(id) },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    if (!killmail) return null;

    const result = {
      id: killmail.killmail_id.toString(),
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

    // Cache for 1 hour (killmails never change)
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  },

  killmails: async (_, args) => {
    const page = args.filter?.page ?? 1;
    const limit = Math.min(args.filter?.limit ?? 25, 100); // Max 100 per page
    const orderBy = args.filter?.orderBy ?? 'timeDesc';
    const search = args.filter?.search;
    const regionId = args.filter?.regionId;
    const systemId = args.filter?.systemId;

    const skip = (page - 1) * limit;

    // Build WHERE clause
    const where: any = {};

    // Search in victim or attacker names
    if (search) {
      where.OR = [
        {
          victim: {
            OR: [
              {
                character: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
              {
                corporation: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
              {
                alliance: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
            ],
          },
        },
        {
          attackers: {
            some: {
              OR: [
                {
                  character: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                },
                {
                  corporation: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                },
                {
                  alliance: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                },
              ],
            },
          },
        },
      ];
    }

    // Filter by region
    if (regionId) {
      where.solar_system = {
        constellation: {
          region_id: regionId,
        },
      };
    }

    // Filter by solar system
    if (systemId) {
      where.solar_system_id = systemId;
    }

    // Performance: Count only when needed (first page or filter change)
    // For subsequent pages, estimate from previous count
    const totalCount = await prisma.killmail.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // ⚡ Performance: Don't include relations here, use DataLoaders in field resolvers
    // This prevents eager loading and allows batching
    const killmails = await prisma.killmail.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        killmail_time: orderBy === 'timeAsc' ? 'asc' : 'desc'
      },
      // Remove include to use DataLoaders for relations
      select: {
        killmail_id: true,
        killmail_hash: true,
        killmail_time: true,
        solar_system_id: true,
        created_at: true,
        victim: {
          select: {
            character_id: true,
            corporation_id: true,
            alliance_id: true,
            faction_id: true,
            ship_type_id: true,
            damage_taken: true,
            position_x: true,
            position_y: true,
            position_z: true,
          },
        },
        attackers: {
          select: {
            character_id: true,
            corporation_id: true,
            alliance_id: true,
            faction_id: true,
            ship_type_id: true,
            weapon_type_id: true,
            damage_done: true,
            final_blow: true,
            security_status: true,
          },
        },
        items: {
          select: {
            item_type_id: true,
            flag: true,
            quantity_dropped: true,
            quantity_destroyed: true,
            singleton: true,
          },
        },
      },
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
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
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        currentPage: page,
        totalPages,
        totalCount,
      },
    };
  },

  killmailsDateCounts: async (_, args) => {
    const search = args.filter?.search;
    const regionId = args.filter?.regionId;
    const systemId = args.filter?.systemId;

    // Build WHERE clause (same as killmails query)
    const where: any = {};

    if (search) {
      where.OR = [
        {
          victim: {
            OR: [
              {
                character: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
              {
                corporation: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
              {
                alliance: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
            ],
          },
        },
        {
          attackers: {
            some: {
              OR: [
                {
                  character: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                },
                {
                  corporation: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                },
                {
                  alliance: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                },
              ],
            },
          },
        },
      ];
    }

    if (regionId) {
      where.solar_system = {
        constellation: {
          region_id: regionId,
        },
      };
    }

    if (systemId) {
      where.solar_system_id = systemId;
    }

    // Fetch all killmails with the filter and group by date in memory
    const killmails = await prisma.killmail.findMany({
      where,
      select: {
        killmail_time: true,
      },
      orderBy: {
        killmail_time: 'desc'
      }
    });

    // Group by date
    const dateCounts = new Map<string, number>();
    for (const km of killmails) {
      const date = km.killmail_time.toISOString().split('T')[0]; // YYYY-MM-DD
      dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
    }

    // Convert to array
    return Array.from(dateCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
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
              killmailHash: km.killmail_hash,
              killmailTime: detail.killmail_time,
              victim: {
                characterId: detail.victim.character_id ?? null,
                corporationId: detail.victim.corporation_id,
                shipTypeId: detail.victim.ship_type_id,
                damageTaken: detail.victim.damage_taken,
              },
              attackers: detail.attackers.map((attacker) => ({
                characterId: attacker.character_id ?? null,
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
              killmailHash: km.killmail_hash,
              killmailTime: detail.killmail_time,
              victim: {
                characterId: detail.victim.character_id ?? null,
                corporationId: detail.victim.corporation_id,
                shipTypeId: detail.victim.ship_type_id,
                damageTaken: detail.victim.damage_taken,
              },
              attackers: detail.attackers.map((attacker) => ({
                characterId: attacker.character_id ?? null,
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
  solarSystem: async (parent: any, _, context) => {
    if (!parent.solarSystemId) return null;
    return context.loaders.solarSystem.load(parent.solarSystemId);
  },
};

export const victimFieldResolvers: VictimResolvers = {
  character: async (parent: any, _, context) => {
    if (!parent.characterId) return null;
    return context.loaders.character.load(parent.characterId);
  },
  corporation: async (parent: any, _, context) => {
    if (!parent.corporationId) return null;
    return context.loaders.corporation.load(parent.corporationId);
  },
  alliance: async (parent: any, _, context) => {
    if (!parent.allianceId) return null;
    return context.loaders.alliance.load(parent.allianceId);
  },
  shipType: async (parent: any, _, context) => {
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
  character: async (parent: any, _, context) => {
    if (!parent.characterId) return null;
    return context.loaders.character.load(parent.characterId);
  },
  corporation: async (parent: any, _, context) => {
    if (!parent.corporationId) return null;
    return context.loaders.corporation.load(parent.corporationId);
  },
  alliance: async (parent: any, _, context) => {
    if (!parent.allianceId) return null;
    return context.loaders.alliance.load(parent.allianceId);
  },
  shipType: async (parent: any, _, context) => {
    if (!parent.shipTypeId) return null;
    const type = await context.loaders.type.load(parent.shipTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
  weaponType: async (parent: any, _, context) => {
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
  itemType: async (parent: any, _, context) => {
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

// Subscription Resolvers
export const killmailSubscriptions: SubscriptionResolvers = {
  newKillmail: {
    subscribe: () => {
      console.log('🔔 Client subscribed to NEW_KILLMAIL');
      return pubsub.subscribe('NEW_KILLMAIL');
    },
    resolve: async (payload: { killmailId: number }) => {
      console.log('📨 Resolving NEW_KILLMAIL for killmail_id:', payload.killmailId);

      // Fetch killmail from database with relations
      const killmail = await prisma.killmail.findUnique({
        where: { killmail_id: payload.killmailId },
        include: {
          victim: true,
          attackers: true,
          items: true,
        },
      });

      if (!killmail) {
        console.error('❌ Killmail not found:', payload.killmailId);
        return null;
      }

      // Return in the same format as killmail query resolver
      // Field resolvers (character, corporation, alliance, shipType etc.) will work automatically
      return {
        id: killmail.killmail_id.toString(),
        killmailHash: killmail.killmail_hash,
        killmailTime: killmail.killmail_time.toISOString(),
        solarSystemId: killmail.solar_system_id,
        createdAt: killmail.created_at.toISOString(),
        victim: killmail.victim ? {
          characterId: killmail.victim.character_id ?? null,
          corporationId: killmail.victim.corporation_id ?? 0,
          allianceId: killmail.victim.alliance_id ?? null,
          factionId: killmail.victim.faction_id ?? null,
          shipTypeId: killmail.victim.ship_type_id ?? 0,
          damageTaken: killmail.victim.damage_taken ?? 0,
          position: killmail.victim.position_x ? {
            x: killmail.victim.position_x,
            y: killmail.victim.position_y!,
            z: killmail.victim.position_z!,
          } : null,
        } : null,
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
  },
};
