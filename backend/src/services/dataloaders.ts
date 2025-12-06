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
 * Character DataLoader - Batch loading için
 *
 * Örnek: 10 killmail victim'ın character bilgisini çekiyoruz
 * ❌ Önceki: 10 ayrı SELECT query
 * ✅ DataLoader: 1 SELECT WHERE id IN (1,2,3...) query
 */
export const createCharacterLoader = () => {
    return new DataLoader<number, any>(async (characterIds) => {
        console.log(`🔄 DataLoader: Batching ${characterIds.length} character queries`);

        const characters = await prisma.character.findMany({
            where: {
                id: { in: [...characterIds] },
            },
        });

        // DataLoader expects results in same order as keys
        const characterMap = new Map(characters.map(c => [c.id, c]));
        return characterIds.map(id => characterMap.get(id) || null);
    });
};

/**
 * Race DataLoader - Batch loading için
 */
export const createRaceLoader = () => {
    return new DataLoader<number, any>(async (raceIds) => {
        console.log(`🔄 DataLoader: Batching ${raceIds.length} race queries`);

        const races = await prisma.race.findMany({
            where: {
                id: { in: [...raceIds] },
            },
        });

        // DataLoader expects results in same order as keys
        const raceMap = new Map(races.map(r => [r.id, r]));
        return raceIds.map(id => raceMap.get(id) || null);
    });
};

/**
 * Bloodline DataLoader - Batch loading için
 */
export const createBloodlineLoader = () => {
    return new DataLoader<number, any>(async (bloodlineIds) => {
        console.log(`🔄 DataLoader: Batching ${bloodlineIds.length} bloodline queries`);

        const bloodlines = await prisma.bloodline.findMany({
            where: {
                id: { in: [...bloodlineIds] },
            },
        });

        // DataLoader expects results in same order as keys
        const bloodlineMap = new Map(bloodlines.map(b => [b.id, b]));
        return bloodlineIds.map(id => bloodlineMap.get(id) || null);
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
 * Region DataLoader - Batch loading için
 */
export const createRegionLoader = () => {
    return new DataLoader<number, any>(async (regionIds) => {
        console.log(`🔄 DataLoader: Batching ${regionIds.length} region queries`);

        const regions = await prisma.region.findMany({
            where: {
                id: { in: [...regionIds] },
            },
        });

        const regionMap = new Map(regions.map(r => [r.id, r]));
        return regionIds.map(id => regionMap.get(id) || null);
    });
};

/**
 * Constellation DataLoader - Batch loading için
 */
export const createConstellationLoader = () => {
    return new DataLoader<number, any>(async (constellationIds) => {
        console.log(`🔄 DataLoader: Batching ${constellationIds.length} constellation queries`);

        const constellations = await prisma.constellation.findMany({
            where: {
                id: { in: [...constellationIds] },
            },
        });

        const constellationMap = new Map(constellations.map(c => [c.id, c]));
        return constellationIds.map(id => constellationMap.get(id) || null);
    });
};

/**
 * SolarSystem DataLoader - Batch loading için
 */
export const createSolarSystemLoader = () => {
    return new DataLoader<number, any>(async (systemIds) => {
        console.log(`🔄 DataLoader: Batching ${systemIds.length} solar system queries`);

        const systems = await prisma.solarSystem.findMany({
            where: {
                id: { in: [...systemIds] },
            },
        });

        const systemMap = new Map(systems.map(s => [s.id, s]));
        return systemIds.map(id => systemMap.get(id) || null);
    });
};

/**
 * Constellations by Region DataLoader
 */
export const createConstellationsByRegionLoader = () => {
    return new DataLoader<number, any[]>(async (regionIds) => {
        console.log(`🔄 DataLoader: Batching ${regionIds.length} constellations by region queries`);

        const constellations = await prisma.constellation.findMany({
            where: {
                region_id: { in: [...regionIds] },
            },
        });

        const constsByRegion = new Map<number, any[]>();
        regionIds.forEach(id => constsByRegion.set(id, []));

        constellations.forEach(const_ => {
            if (const_.region_id) {
                const existing = constsByRegion.get(const_.region_id) || [];
                existing.push(const_);
                constsByRegion.set(const_.region_id, existing);
            }
        });

        return regionIds.map(id => constsByRegion.get(id) || []);
    });
};

/**
 * Solar Systems by Constellation DataLoader
 */
export const createSolarSystemsByConstellationLoader = () => {
    return new DataLoader<number, any[]>(async (constellationIds) => {
        console.log(`🔄 DataLoader: Batching ${constellationIds.length} solar systems by constellation queries`);

        const systems = await prisma.solarSystem.findMany({
            where: {
                constellation_id: { in: [...constellationIds] },
            },
        });

        const systemsByConst = new Map<number, any[]>();
        constellationIds.forEach(id => systemsByConst.set(id, []));

        systems.forEach(sys => {
            if (sys.constellation_id) {
                const existing = systemsByConst.get(sys.constellation_id) || [];
                existing.push(sys);
                systemsByConst.set(sys.constellation_id, existing);
            }
        });

        return constellationIds.map(id => systemsByConst.get(id) || []);
    });
};

/**
 * Category DataLoader - Batch loading için
 */
export const createCategoryLoader = () => {
    return new DataLoader<number, any>(async (categoryIds) => {
        console.log(`🔄 DataLoader: Batching ${categoryIds.length} category queries`);

        const categories = await prisma.category.findMany({
            where: {
                id: { in: [...categoryIds] },
            },
        });

        const categoryMap = new Map(categories.map(c => [c.id, c]));
        return categoryIds.map(id => categoryMap.get(id) || null);
    });
};

/**
 * ItemGroup DataLoader - Batch loading için
 */
export const createItemGroupLoader = () => {
    return new DataLoader<number, any>(async (itemGroupIds) => {
        console.log(`🔄 DataLoader: Batching ${itemGroupIds.length} item group queries`);

        const itemGroups = await prisma.itemGroup.findMany({
            where: {
                id: { in: [...itemGroupIds] },
            },
        });

        const itemGroupMap = new Map(itemGroups.map(g => [g.id, g]));
        return itemGroupIds.map(id => itemGroupMap.get(id) || null);
    });
};

/**
 * Type DataLoader - Batch loading için
 */
export const createTypeLoader = () => {
    return new DataLoader<number, any>(async (typeIds) => {
        console.log(`🔄 DataLoader: Batching ${typeIds.length} type queries`);

        const types = await prisma.type.findMany({
            where: {
                id: { in: [...typeIds] },
            },
        });

        const typeMap = new Map(types.map(t => [t.id, t]));
        return typeIds.map(id => typeMap.get(id) || null);
    });
};

/**
 * Item Groups by Category DataLoader
 */
export const createItemGroupsByCategoryLoader = () => {
    return new DataLoader<number, any[]>(async (categoryIds) => {
        console.log(`🔄 DataLoader: Batching ${categoryIds.length} item groups by category queries`);

        const itemGroups = await prisma.itemGroup.findMany({
            where: {
                category_id: { in: [...categoryIds] },
            },
        });

        const groupsByCategory = new Map<number, any[]>();
        categoryIds.forEach(id => groupsByCategory.set(id, []));

        itemGroups.forEach(group => {
            const existing = groupsByCategory.get(group.category_id) || [];
            existing.push(group);
            groupsByCategory.set(group.category_id, existing);
        });

        return categoryIds.map(id => groupsByCategory.get(id) || []);
    });
};

/**
 * DataLoader Context - Her request için yeni instance
 */
export interface DataLoaderContext {
    loaders: {
        alliance: DataLoader<number, any>;
        corporation: DataLoader<number, any>;
        character: DataLoader<number, any>;
        race: DataLoader<number, any>;
        bloodline: DataLoader<number, any>;
        corporationsByAlliance: DataLoader<number, any[]>;
        region: DataLoader<number, any>;
        constellation: DataLoader<number, any>;
        solarSystem: DataLoader<number, any>;
        constellationsByRegion: DataLoader<number, any[]>;
        solarSystemsByConstellation: DataLoader<number, any[]>;
        category: DataLoader<number, any>;
        itemGroup: DataLoader<number, any>;
        type: DataLoader<number, any>;
        itemGroupsByCategory: DataLoader<number, any[]>;
    };
}

export const createDataLoaders = (): DataLoaderContext => ({
    loaders: {
        alliance: createAllianceLoader(),
        corporation: createCorporationLoader(),
        character: createCharacterLoader(),
        race: createRaceLoader(),
        bloodline: createBloodlineLoader(),
        corporationsByAlliance: createCorporationsByAllianceLoader(),
        region: createRegionLoader(),
        constellation: createConstellationLoader(),
        solarSystem: createSolarSystemLoader(),
        constellationsByRegion: createConstellationsByRegionLoader(),
        solarSystemsByConstellation: createSolarSystemsByConstellationLoader(),
        category: createCategoryLoader(),
        itemGroup: createItemGroupLoader(),
        type: createTypeLoader(),
        itemGroupsByCategory: createItemGroupsByCategoryLoader(),
    },
});
