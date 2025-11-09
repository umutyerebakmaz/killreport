import DataLoader from 'dataloader';
import prisma from './prisma';

/**
 * Alliance DataLoader - Batch loading için
 *
 * Örnek: 10 corporation'ın alliance'ını çekiyoruz
 * ❌ Önceki: 10 ayrı SELECT query
 * ✅ DataLoader: 1 SELECT WHERE id IN (1,2,3...) query
 */
export const createAllianceLoader = () => {
    return new DataLoader<number, any>(async (allianceIds) => {
        console.log(`🔄 DataLoader: Batching ${allianceIds.length} alliance queries`);

        const alliances = await prisma.alliance.findMany({
            where: {
                id: { in: [...allianceIds] },
            },
        });

        // DataLoader expects results in same order as keys
        const allianceMap = new Map(alliances.map(a => [a.id, a]));
        return allianceIds.map(id => allianceMap.get(id) || null);
    });
};

/**
 * Corporation DataLoader - Batch loading için
 *
 * Örnek: 10 alliance'ın executor corporation'ını çekiyoruz
 * ❌ Önceki: 10 ayrı SELECT query
 * ✅ DataLoader: 1 SELECT WHERE id IN (1,2,3...) query
 */
export const createCorporationLoader = () => {
    return new DataLoader<number, any>(async (corporationIds) => {
        console.log(`🔄 DataLoader: Batching ${corporationIds.length} corporation queries`);

        const corporations = await prisma.corporation.findMany({
            where: {
                id: { in: [...corporationIds] },
            },
        });

        // DataLoader expects results in same order as keys
        const corporationMap = new Map(corporations.map(c => [c.id, c]));
        return corporationIds.map(id => corporationMap.get(id) || null);
    });
};

/**
 * Corporations by Alliance DataLoader
 *
 * Örnek: 5 alliance'ın corporation'larını çekiyoruz
 * ❌ Önceki: 5 ayrı SELECT query
 * ✅ DataLoader: 1 SELECT WHERE alliance_id IN (1,2,3,4,5) query
 */
export const createCorporationsByAllianceLoader = () => {
    return new DataLoader<number, any[]>(async (allianceIds) => {
        console.log(`🔄 DataLoader: Batching ${allianceIds.length} corporations queries`);

        const corporations = await prisma.corporation.findMany({
            where: {
                alliance_id: { in: [...allianceIds] },
            },
        });

        // Group by alliance_id
        const corpsByAlliance = new Map<number, any[]>();
        allianceIds.forEach(id => corpsByAlliance.set(id, []));

        corporations.forEach(corp => {
            if (corp.alliance_id) {
                const existing = corpsByAlliance.get(corp.alliance_id) || [];
                existing.push(corp);
                corpsByAlliance.set(corp.alliance_id, existing);
            }
        });

        return allianceIds.map(id => corpsByAlliance.get(id) || []);
    });
};

/**
 * DataLoader Context - Her request için yeni instance
 */
export interface DataLoaderContext {
    loaders: {
        alliance: DataLoader<number, any>;
        corporation: DataLoader<number, any>;
        corporationsByAlliance: DataLoader<number, any[]>;
    };
}

export const createDataLoaders = (): DataLoaderContext => ({
    loaders: {
        alliance: createAllianceLoader(),
        corporation: createCorporationLoader(),
        corporationsByAlliance: createCorporationsByAllianceLoader(),
    },
});
