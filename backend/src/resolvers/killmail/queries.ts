import { QueryResolvers } from '@generated-types';
import { CharacterService } from '@services/character';
import { CorporationService } from '@services/corporation';
import { KillmailService } from '@services/killmail';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Killmail Query Resolvers
 * Handles fetching killmail data and listing killmails with filters
 */
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
    });

    if (!killmail) return null;

    // Field resolvers will handle victim, attackers, items via DataLoaders
    const result = {
      id: killmail.killmail_id.toString(),
      killmailHash: killmail.killmail_hash,
      killmailTime: killmail.killmail_time.toISOString(),
      solarSystemId: killmail.solar_system_id,
      createdAt: killmail.created_at.toISOString(),
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
    const shipTypeId = args.filter?.shipTypeId;
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
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                corporation: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                alliance: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
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

    if (shipTypeId) {
      where.OR = [
        {
          victim: {
            ship_type_id: shipTypeId,
          },
        },
        {
          attackers: {
            some: {
              ship_type_id: shipTypeId,
            },
          },
        },
      ];
    }

    if (regionId) {
      where.solar_system = {
        ...where.solar_system,
        constellation: {
          region_id: regionId,
        },
      };
    }

    if (systemId) {
      where.solar_system_id = systemId;
    }

    // Performance: Count only when needed (first page or filter change)
    // For subsequent pages, estimate from previous count
    const totalCount = await prisma.killmail.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch only killmail data, field resolvers will handle relations via DataLoaders
    const killmails = await prisma.killmail.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        killmail_time: orderBy === 'timeAsc' ? 'asc' : 'desc'
      },
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmail_id: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
        // Values will be calculated by field resolvers on demand
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
    const shipTypeId = args.filter?.shipTypeId;
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
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                corporation: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                alliance: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
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
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  }
                },
                {
                  corporation: {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  }
                },
                {
                  alliance: {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  }
                },
              ],
            },
          },
        },
      ];
    }

    if (shipTypeId) {
      where.OR = [
        {
          victim: {
            ship_type_id: shipTypeId,
          },
        },
        {
          attackers: {
            some: {
              ship_type_id: shipTypeId,
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

    // Fetch only killmail_time for date grouping (performance optimization)
    const killmails = await prisma.killmail.findMany({
      where,
      select: { killmail_time: true },
      orderBy: { killmail_time: 'desc' },
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

    // Fetch killmails - field resolvers will handle victim/attackers/items
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
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmail_id: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
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
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmail_id: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
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
    });

    const edges = killmails.map((km, index) => ({
      node: {
        id: km.killmail_id.toString(),
        killmail_id: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
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
