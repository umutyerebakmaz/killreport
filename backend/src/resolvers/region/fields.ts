import { RegionResolvers, SecurityStats } from '@generated-types';
import prisma from '@services/prisma';

// Helper function to calculate security stats from solar systems
async function calculateSecurityStats(solarSystems: { security_status: number | null }[]): Promise<SecurityStats> {
  let highSec = 0;
  let lowSec = 0;
  let nullSec = 0;
  let wormhole = 0;
  let totalSecurity = 0;
  let validSecurityCount = 0;

  for (const system of solarSystems) {
    const sec = system.security_status;
    if (sec === null) {
      wormhole++;
      continue;
    }
    totalSecurity += sec;
    validSecurityCount++;
    if (sec >= 0.5) {
      highSec++;
    } else if (sec > 0.0) {
      lowSec++;
    } else {
      nullSec++;
    }
  }

  return {
    highSec,
    lowSec,
    nullSec,
    wormhole,
    avgSecurity: validSecurityCount > 0 ? totalSecurity / validSecurityCount : null,
  };
}

/**
 * Region Field Resolvers
 * Handles nested fields and computed properties for Region
 * Uses DataLoaders to prevent N+1 queries
 */
export const regionFields: RegionResolvers = {
  constellations: async (parent, _, context) => {
    if (!parent.id) return [];
    return context.loaders.constellationsByRegion.load(parent.id);
  },
  constellationCount: async (parent) => {
    if (!parent.id) return 0;
    return prisma.constellation.count({
      where: { region_id: parent.id },
    });
  },
  solarSystemCount: async (parent) => {
    if (!parent.id) return 0;
    const constellations = await prisma.constellation.findMany({
      where: { region_id: parent.id },
      select: { id: true },
    });
    const constellationIds = constellations.map(c => c.id);
    return prisma.solarSystem.count({
      where: { constellation_id: { in: constellationIds } },
    });
  },
  securityStats: async (parent) => {
    if (!parent.id) return { highSec: 0, lowSec: 0, nullSec: 0, wormhole: 0, avgSecurity: null };
    const constellations = await prisma.constellation.findMany({
      where: { region_id: parent.id },
      select: { id: true },
    });
    const constellationIds = constellations.map(c => c.id);
    const solarSystems = await prisma.solarSystem.findMany({
      where: { constellation_id: { in: constellationIds } },
      select: { security_status: true },
    });
    return calculateSecurityStats(solarSystems);
  },
};
