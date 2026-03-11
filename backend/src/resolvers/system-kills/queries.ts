import prisma from '@services/prisma';

/**
 * SystemKills Query Resolvers
 * Handles fetching system kills data for charts and stats
 */
export const systemKillsQueries = {
  // Get hourly snapshots for a specific system (for 24h charts)
  systemKillsHistory: async (_: any, { filter }: any) => {
    const hours = filter.hours || 24;
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

    const kills = await prisma.systemKills.findMany({
      where: {
        system_id: filter.system_id,
        timestamp: {
          gte: hoursAgo,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return kills as any;
  },

  // Get latest kills for a specific system
  systemLatestKills: async (_: any, { system_id }: any) => {
    const latestKill = await prisma.systemKills.findFirst({
      where: {
        system_id,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return latestKill as any;
  },

  // Get top active systems by total kills in last 24h
  topActiveSystems: async (_: any, { limit = 10 }: any) => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const topSystems = await prisma.systemKills.groupBy({
      by: ['system_id'],
      where: {
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      _sum: {
        ship_kills: true,
        pod_kills: true,
        npc_kills: true,
      },
      orderBy: {
        _sum: {
          ship_kills: 'desc',
        },
      },
      take: limit,
    });

    // Get system names and latest data
    const systemIds = topSystems.map(s => s.system_id);
    const systems = await prisma.solarSystem.findMany({
      where: {
        id: { in: systemIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const latestKills = await prisma.systemKills.findMany({
      where: {
        system_id: { in: systemIds },
      },
      orderBy: {
        timestamp: 'desc',
      },
      distinct: ['system_id'],
    });

    const systemMap = new Map(systems.map(s => [s.id, s.name]));
    const latestKillsMap = new Map(latestKills.map(k => [k.system_id, k]));

    return topSystems.map(s => {
      const latest = latestKillsMap.get(s.system_id);
      return {
        system_id: s.system_id,
        system_name: systemMap.get(s.system_id) || 'Unknown',
        total_kills: (s._sum.ship_kills || 0) + (s._sum.pod_kills || 0) + (s._sum.npc_kills || 0),
        latest_ship_kills: latest?.ship_kills || 0,
        latest_pod_kills: latest?.pod_kills || 0,
        latest_npc_kills: latest?.npc_kills || 0,
        latest_timestamp: latest?.timestamp || null,
      };
    }) as any;
  },
};
