import { RegionResolvers, SecurityStats } from '@generated-types';

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
    constellationCount: async (parent, _, context) => {
        if (!parent.id) return 0;
        // Use DataLoader to batch region stats queries
        const stats = await context.loaders.regionStats.load(parent.id);
        return stats.constellationCount;
    },
    solarSystemCount: async (parent, _, context) => {
        if (!parent.id) return 0;
        // Use DataLoader to batch region stats queries
        const stats = await context.loaders.regionStats.load(parent.id);
        return stats.solarSystemCount;
    },
    securityStats: async (parent, _, context) => {
        if (!parent.id) return { highSec: 0, lowSec: 0, nullSec: 0, wormhole: 0, avgSecurity: null };
        // Use DataLoader to batch security stats queries
        return context.loaders.regionSecurityStats.load(parent.id);
    },
};
