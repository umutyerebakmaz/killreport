import DataLoader from 'dataloader';
import logger from './logger';
import prisma from './prisma';

/** A region's or a constellation's dominant sovereignty holder. */
export interface SovereigntyHolderRow {
  ownerType: 'FACTION' | 'ALLIANCE';
  ownerId: number;
  ownerName: string | null;
  allianceTicker: string | null;
  systemCount: number;
}

/**
 * Alliance DataLoader - Batch loading için
 *
 * Örnek: 10 corporation'ın alliance'ını çekiyoruz
 * ❌ Önceki: 10 ayrı SELECT query
 * ✅ DataLoader: 1 SELECT WHERE id IN (1,2,3...) query
 */
export const createAllianceLoader = () => {
  return new DataLoader<number, any>(async (allianceIds) => {
    logger.debug('DataLoader: Batching alliance queries', {
      count: allianceIds.length,
    });

    const alliances = await prisma.alliance.findMany({
      where: {
        id: { in: [...allianceIds] },
      },
    });

    // DataLoader expects results in same order as keys
    const allianceMap = new Map(alliances.map((a) => [a.id, a]));
    return allianceIds.map((id) => allianceMap.get(id) || null);
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
    logger.debug('DataLoader: Batching corporation queries', {
      count: corporationIds.length,
    });

    const corporations = await prisma.corporation.findMany({
      where: {
        id: { in: [...corporationIds] },
      },
    });

    // DataLoader expects results in same order as keys
    const corporationMap = new Map(corporations.map((c) => [c.id, c]));
    return corporationIds.map((id) => corporationMap.get(id) || null);
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
    logger.debug('DataLoader: Batching character queries', {
      count: characterIds.length,
    });

    const characters = await prisma.character.findMany({
      where: {
        id: { in: [...characterIds] },
      },
    });

    // DataLoader expects results in same order as keys
    const characterMap = new Map(characters.map((c) => [c.id, c]));
    return characterIds.map((id) => characterMap.get(id) || null);
  });
};

/**
 * Race DataLoader - Batch loading için
 */
export const createRaceLoader = () => {
  return new DataLoader<number, any>(async (raceIds) => {
    logger.debug('DataLoader: Batching race queries', {
      count: raceIds.length,
    });

    const races = await prisma.race.findMany({
      where: {
        id: { in: [...raceIds] },
      },
    });

    // DataLoader expects results in same order as keys
    const raceMap = new Map(races.map((r) => [r.id, r]));
    return raceIds.map((id) => raceMap.get(id) || null);
  });
};

/**
 * Bloodline DataLoader - Batch loading için
 */
export const createBloodlineLoader = () => {
  return new DataLoader<number, any>(async (bloodlineIds) => {
    logger.debug('DataLoader: Batching bloodline queries', {
      count: bloodlineIds.length,
    });

    const bloodlines = await prisma.bloodline.findMany({
      where: {
        id: { in: [...bloodlineIds] },
      },
    });

    // DataLoader expects results in same order as keys
    const bloodlineMap = new Map(bloodlines.map((b) => [b.id, b]));
    return bloodlineIds.map((id) => bloodlineMap.get(id) || null);
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
    console.log(
      `🔄 DataLoader: Batching ${allianceIds.length} corporations queries`,
    );

    const corporations = await prisma.corporation.findMany({
      where: {
        alliance_id: { in: [...allianceIds] },
      },
    });

    // Group by alliance_id
    const corpsByAlliance = new Map<number, any[]>();
    allianceIds.forEach((id) => corpsByAlliance.set(id, []));

    corporations.forEach((corp) => {
      if (corp.alliance_id) {
        const existing = corpsByAlliance.get(corp.alliance_id) || [];
        existing.push(corp);
        corpsByAlliance.set(corp.alliance_id, existing);
      }
    });

    return allianceIds.map((id) => corpsByAlliance.get(id) || []);
  });
};

/**
 * Characters by Corporation DataLoader
 *
 * Örnek: 5 corporation'ın character'larını çekiyoruz
 * ❌ Önceki: 5 ayrı SELECT query
 * ✅ DataLoader: 1 SELECT WHERE corporation_id IN (1,2,3,4,5) query
 */
export const createCharactersByCorpLoader = () => {
  return new DataLoader<number, any[]>(async (corporationIds) => {
    console.log(
      `🔄 DataLoader: Batching ${corporationIds.length} characters by corp queries`,
    );

    const characters = await prisma.character.findMany({
      where: {
        corporation_id: { in: [...corporationIds] },
      },
    });

    // Group by corporation_id
    const charsByCorp = new Map<number, any[]>();
    corporationIds.forEach((id) => charsByCorp.set(id, []));

    characters.forEach((char) => {
      const existing = charsByCorp.get(char.corporation_id) || [];
      existing.push(char);
      charsByCorp.set(char.corporation_id, existing);
    });

    return corporationIds.map((id) => charsByCorp.get(id) || []);
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

    const regionMap = new Map(regions.map((r) => [r.id, r]));
    return regionIds.map((id) => regionMap.get(id) || null);
  });
};

/**
 * Constellation DataLoader - Batch loading için
 */
export const createConstellationLoader = () => {
  return new DataLoader<number, any>(async (constellationIds) => {
    console.log(
      `🔄 DataLoader: Batching ${constellationIds.length} constellation queries`,
    );

    const constellations = await prisma.constellation.findMany({
      where: {
        id: { in: [...constellationIds] },
      },
    });

    const constellationMap = new Map(constellations.map((c) => [c.id, c]));
    return constellationIds.map((id) => constellationMap.get(id) || null);
  });
};

/**
 * SolarSystem DataLoader - Batch loading için
 */
export const createSolarSystemLoader = () => {
  return new DataLoader<number, any>(async (systemIds) => {
    console.log(
      `🔄 DataLoader: Batching ${systemIds.length} solar system queries`,
    );

    const systems = await prisma.solarSystem.findMany({
      where: {
        id: { in: [...systemIds] },
      },
    });

    const systemMap = new Map(systems.map((s) => [s.id, s]));
    return systemIds.map((id) => systemMap.get(id) || null);
  });
};

/**
 * Constellations by Region DataLoader
 */
export const createConstellationsByRegionLoader = () => {
  return new DataLoader<number, any[]>(async (regionIds) => {
    console.log(
      `🔄 DataLoader: Batching ${regionIds.length} constellations by region queries`,
    );

    const constellations = await prisma.constellation.findMany({
      where: {
        region_id: { in: [...regionIds] },
      },
    });

    const constsByRegion = new Map<number, any[]>();
    regionIds.forEach((id) => constsByRegion.set(id, []));

    constellations.forEach((const_) => {
      if (const_.region_id) {
        const existing = constsByRegion.get(const_.region_id) || [];
        existing.push(const_);
        constsByRegion.set(const_.region_id, existing);
      }
    });

    return regionIds.map((id) => constsByRegion.get(id) || []);
  });
};

/**
 * Solar Systems by Constellation DataLoader
 */
export const createSolarSystemsByConstellationLoader = () => {
  return new DataLoader<number, any[]>(async (constellationIds) => {
    console.log(
      `🔄 DataLoader: Batching ${constellationIds.length} solar systems by constellation queries`,
    );

    const systems = await prisma.solarSystem.findMany({
      where: {
        constellation_id: { in: [...constellationIds] },
      },
    });

    const systemsByConst = new Map<number, any[]>();
    constellationIds.forEach((id) => systemsByConst.set(id, []));

    systems.forEach((sys) => {
      if (sys.constellation_id) {
        const existing = systemsByConst.get(sys.constellation_id) || [];
        existing.push(sys);
        systemsByConst.set(sys.constellation_id, existing);
      }
    });

    return constellationIds.map((id) => systemsByConst.get(id) || []);
  });
};

/**
 * Category DataLoader - Batch loading için
 */
export const createCategoryLoader = () => {
  return new DataLoader<number, any>(async (categoryIds) => {
    console.log(
      `🔄 DataLoader: Batching ${categoryIds.length} category queries`,
    );

    const categories = await prisma.category.findMany({
      where: {
        id: { in: [...categoryIds] },
      },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    return categoryIds.map((id) => categoryMap.get(id) || null);
  });
};

/**
 * ItemGroup DataLoader - Batch loading için
 */
export const createItemGroupLoader = () => {
  return new DataLoader<number, any>(async (itemGroupIds) => {
    console.log(
      `🔄 DataLoader: Batching ${itemGroupIds.length} item group queries`,
    );

    const itemGroups = await prisma.itemGroup.findMany({
      where: {
        id: { in: [...itemGroupIds] },
      },
    });

    const itemGroupMap = new Map(itemGroups.map((g) => [g.id, g]));
    return itemGroupIds.map((id) => itemGroupMap.get(id) || null);
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

    const typeMap = new Map(types.map((t) => [t.id, t]));
    return typeIds.map((id) => typeMap.get(id) || null);
  });
};

/**
 * Item Groups by Category DataLoader
 */
export const createItemGroupsByCategoryLoader = () => {
  return new DataLoader<number, any[]>(async (categoryIds) => {
    console.log(
      `🔄 DataLoader: Batching ${categoryIds.length} item groups by category queries`,
    );

    const itemGroups = await prisma.itemGroup.findMany({
      where: {
        category_id: { in: [...categoryIds] },
      },
    });

    const groupsByCategory = new Map<number, any[]>();
    categoryIds.forEach((id) => groupsByCategory.set(id, []));

    itemGroups.forEach((group) => {
      const existing = groupsByCategory.get(group.category_id) || [];
      existing.push(group);
      groupsByCategory.set(group.category_id, existing);
    });

    return categoryIds.map((id) => groupsByCategory.get(id) || []);
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
    charactersByCorp: DataLoader<number, any[]>;
    region: DataLoader<number, any>;
    constellation: DataLoader<number, any>;
    solarSystem: DataLoader<number, any>;
    constellationsByRegion: DataLoader<number, any[]>;
    solarSystemsByConstellation: DataLoader<number, any[]>;
    category: DataLoader<number, any>;
    itemGroup: DataLoader<number, any>;
    type: DataLoader<number, any>;
    itemGroupsByCategory: DataLoader<number, any[]>;
    typesByGroup: DataLoader<number, any[]>;
    regionStats: DataLoader<
      number,
      { constellationCount: number; solarSystemCount: number }
    >;
    constellationSovereignty: DataLoader<number, SovereigntyHolderRow | null>;
    regionSovereignty: DataLoader<number, SovereigntyHolderRow | null>;
    corporationSnapshot: DataLoader<{ corporationId: number; date: Date }, any>;
    allianceSnapshot: DataLoader<{ allianceId: number; date: Date }, any>;
    typeDogmaAttributes: DataLoader<number, any[]>;
    typeDogmaEffects: DataLoader<number, any[]>;
    victim: DataLoader<number, any>;
    attackers: DataLoader<number, any[]>;
    finalBlow: DataLoader<number, any>;
    items: DataLoader<number, any[]>;
    marketPrice: DataLoader<number, any>;
    stargatesBySystem: DataLoader<number, any[]>;
    stargate: DataLoader<number, any>;
    starBySystem: DataLoader<number, any>;
    planetsBySystem: DataLoader<number, any[]>;
    stationsBySystem: DataLoader<number, any[]>;
    moonsByPlanet: DataLoader<number, any[]>;
    asteroidBeltsByPlanet: DataLoader<number, any[]>;
    planet: DataLoader<number, any>;
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
    charactersByCorp: createCharactersByCorpLoader(),
    region: createRegionLoader(),
    constellation: createConstellationLoader(),
    solarSystem: createSolarSystemLoader(),
    constellationsByRegion: createConstellationsByRegionLoader(),
    solarSystemsByConstellation: createSolarSystemsByConstellationLoader(),
    category: createCategoryLoader(),
    itemGroup: createItemGroupLoader(),
    type: createTypeLoader(),
    itemGroupsByCategory: createItemGroupsByCategoryLoader(),
    typesByGroup: createTypesByGroupLoader(),
    regionStats: createRegionStatsLoader(),
    constellationSovereignty: createConstellationSovereigntyLoader(),
    regionSovereignty: createRegionSovereigntyLoader(),
    corporationSnapshot: createCorporationSnapshotLoader(),
    allianceSnapshot: createAllianceSnapshotLoader(),
    typeDogmaAttributes: createTypeDogmaAttributesLoader(),
    typeDogmaEffects: createTypeDogmaEffectsLoader(),
    victim: createVictimLoader(),
    attackers: createAttackersLoader(),
    finalBlow: createFinalBlowLoader(),
    items: createItemsLoader(),
    marketPrice: createMarketPriceLoader(),
    stargatesBySystem: createStargatesBySystemLoader(),
    stargate: createStargateLoader(),
    starBySystem: createStarBySystemLoader(),
    planetsBySystem: createPlanetsBySystemLoader(),
    stationsBySystem: createStationsBySystemLoader(),
    moonsByPlanet: createMoonsByPlanetLoader(),
    asteroidBeltsByPlanet: createAsteroidBeltsByPlanetLoader(),
    planet: createPlanetLoader(),
  },
});

/**
 * Corporation Snapshot DataLoader
 * Fetches snapshots for multiple corporations and date ranges at once
 */
export const createCorporationSnapshotLoader = () => {
  return new DataLoader<{ corporationId: number; date: Date }, any>(
    async (keys) => {
      logger.debug('DataLoader: Batching corporation snapshot queries', {
        count: keys.length,
      });

      const corporationIds = [...new Set(keys.map((k) => k.corporationId))];
      const dates = keys.map((k) => k.date);
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));

      // Fetch all relevant snapshots in one query
      const snapshots = await prisma.corporationSnapshot.findMany({
        where: {
          corporation_id: { in: corporationIds },
          snapshot_date: { lte: new Date(), gte: minDate },
        },
        orderBy: { snapshot_date: 'desc' },
      });

      // For each key, find the closest snapshot before or on the requested date
      return keys.map(({ corporationId, date }) => {
        const corporationSnapshots = snapshots
          .filter(
            (s) =>
              s.corporation_id === corporationId && s.snapshot_date <= date,
          )
          .sort(
            (a, b) => b.snapshot_date.getTime() - a.snapshot_date.getTime(),
          );

        return corporationSnapshots[0] || null;
      });
    },
    {
      cacheKeyFn: (key) =>
        `${key.corporationId}-${key.date.toISOString()}` as any,
    },
  );
};

/**
 * Alliance Snapshot DataLoader
 * Fetches snapshots for multiple alliances and date ranges at once
 */
export const createAllianceSnapshotLoader = () => {
  return new DataLoader<{ allianceId: number; date: Date }, any>(
    async (keys) => {
      logger.debug('DataLoader: Batching alliance snapshot queries', {
        count: keys.length,
      });

      const allianceIds = [...new Set(keys.map((k) => k.allianceId))];
      const dates = keys.map((k) => k.date);
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));

      // Fetch all relevant snapshots in one query
      const snapshots = await prisma.allianceSnapshot.findMany({
        where: {
          alliance_id: { in: allianceIds },
          snapshot_date: { lte: new Date(), gte: minDate },
        },
        orderBy: { snapshot_date: 'desc' },
      });

      // For each key, find the closest snapshot before or on the requested date
      return keys.map(({ allianceId, date }) => {
        const allianceSnapshots = snapshots
          .filter(
            (s) => s.alliance_id === allianceId && s.snapshot_date <= date,
          )
          .sort(
            (a, b) => b.snapshot_date.getTime() - a.snapshot_date.getTime(),
          );

        return allianceSnapshots[0] || null;
      });
    },
    {
      cacheKeyFn: (key) => `${key.allianceId}-${key.date.toISOString()}` as any,
    },
  );
};

/**
 * TypeDogmaAttribute DataLoader - Batch loading for type dogma attributes
 * Fetches attributes for multiple types at once
 */
export const createTypeDogmaAttributesLoader = () => {
  return new DataLoader<number, any[]>(async (typeIds) => {
    logger.debug('DataLoader: Batching type dogma attributes queries', {
      count: typeIds.length,
    });

    const attributes = await prisma.typeDogmaAttribute.findMany({
      where: {
        type_id: { in: [...typeIds] },
      },
      include: {
        attribute: true,
      },
    });

    // Group by type_id
    const attributesByType = new Map<number, any[]>();
    attributes.forEach((attr) => {
      if (!attributesByType.has(attr.type_id)) {
        attributesByType.set(attr.type_id, []);
      }
      attributesByType.get(attr.type_id)!.push(attr);
    });

    return typeIds.map((id) => attributesByType.get(id) || []);
  });
};

/**
 * TypeDogmaEffect DataLoader - Batch loading for type dogma effects
 * Fetches effects for multiple types at once
 */
export const createTypeDogmaEffectsLoader = () => {
  return new DataLoader<number, any[]>(async (typeIds) => {
    logger.debug('DataLoader: Batching type dogma effects queries', {
      count: typeIds.length,
    });

    const effects = await prisma.typeDogmaEffect.findMany({
      where: {
        type_id: { in: [...typeIds] },
      },
      include: {
        effect: true,
      },
    });

    // Group by type_id
    const effectsByType = new Map<number, any[]>();
    effects.forEach((eff) => {
      if (!effectsByType.has(eff.type_id)) {
        effectsByType.set(eff.type_id, []);
      }
      effectsByType.get(eff.type_id)!.push(eff);
    });

    return typeIds.map((id) => effectsByType.get(id) || []);
  });
};

/**
 * Killmail Victim DataLoader - Batch loading for victims
 * Fetches victim details for multiple killmails at once
 */
export const createVictimLoader = () => {
  return new DataLoader<number, any>(async (killmailIds) => {
    logger.debug('DataLoader: Batching victim queries', {
      count: killmailIds.length,
    });

    const victims = await prisma.victim.findMany({
      where: {
        killmail_id: { in: [...killmailIds] },
      },
    });

    // DataLoader expects results in same order as keys
    const victimMap = new Map(victims.map((v) => [v.killmail_id, v]));
    return killmailIds.map((id) => victimMap.get(id) || null);
  });
};

/**
 * Killmail Attackers DataLoader - Batch loading for attackers
 * Fetches attackers for multiple killmails at once
 */
export const createAttackersLoader = () => {
  return new DataLoader<number, any[]>(async (killmailIds) => {
    logger.debug('DataLoader: Batching attackers queries', {
      count: killmailIds.length,
    });

    const attackers = await prisma.attacker.findMany({
      where: {
        killmail_id: { in: [...killmailIds] },
      },
    });

    // Group by killmail_id
    const attackersByKillmail = new Map<number, any[]>();
    attackers.forEach((attacker) => {
      if (!attackersByKillmail.has(attacker.killmail_id)) {
        attackersByKillmail.set(attacker.killmail_id, []);
      }
      attackersByKillmail.get(attacker.killmail_id)!.push(attacker);
    });

    return killmailIds.map((id) => attackersByKillmail.get(id) || []);
  });
};

/**
 * Final Blow Attacker DataLoader
 * Optimized loader that fetches ONLY the final blow attacker for each killmail
 * Much more efficient than loading all attackers and filtering
 */
export const createFinalBlowLoader = () => {
  return new DataLoader<number, any>(async (killmailIds) => {
    logger.debug('DataLoader: Batching final blow queries', {
      count: killmailIds.length,
    });

    // Only fetch attackers with final_blow: true
    const finalBlowAttackers = await prisma.attacker.findMany({
      where: {
        killmail_id: { in: [...killmailIds] },
        final_blow: true,
      },
    });

    // Map by killmail_id (each killmail has only 1 final blow attacker)
    const finalBlowMap = new Map<number, any>();
    finalBlowAttackers.forEach((attacker) => {
      finalBlowMap.set(attacker.killmail_id, attacker);
    });

    return killmailIds.map((id) => finalBlowMap.get(id) || null);
  });
};

/**
 * Attacker Count DataLoader
 * Batch loads attacker counts for multiple killmails
/**
 * Killmail Items DataLoader - Batch loading for items
 * Fetches items for multiple killmails at once
 *
 * Note: attackerCount DataLoader removed - now using cached attacker_count column from database
 */
export const createItemsLoader = () => {
  return new DataLoader<number, any[]>(async (killmailIds) => {
    logger.debug('DataLoader: Batching items queries', {
      count: killmailIds.length,
    });

    const items = await prisma.killmailItem.findMany({
      where: {
        killmail_id: { in: [...killmailIds] },
      },
    });

    // Group by killmail_id
    const itemsByKillmail = new Map<number, any[]>();
    items.forEach((item) => {
      if (!itemsByKillmail.has(item.killmail_id)) {
        itemsByKillmail.set(item.killmail_id, []);
      }
      itemsByKillmail.get(item.killmail_id)!.push(item);
    });

    return killmailIds.map((id) => itemsByKillmail.get(id) || []);
  });
};

/**
 * Market Price DataLoader - Batch loading for market prices
 * Fetches prices from database for multiple types at once
 */
export const createMarketPriceLoader = () => {
  return new DataLoader<number, any>(async (typeIds) => {
    console.log(
      '🔄 DataLoader: Batching',
      typeIds.length,
      'market price queries',
    );

    const prices = await prisma.marketPrice.findMany({
      where: {
        type_id: { in: [...typeIds] },
      },
    });

    const priceMap = new Map(prices.map((p) => [p.type_id, p]));
    return typeIds.map((id) => priceMap.get(id) || null);
  });
};

/**
 * Types by Group DataLoader - Batch loading for types by group_id
 * Fetches all types for multiple groups at once
 */
export const createTypesByGroupLoader = () => {
  return new DataLoader<number, any[]>(async (groupIds) => {
    console.log(
      '🔄 DataLoader: Batching',
      groupIds.length,
      'types by group queries',
    );

    const types = await prisma.type.findMany({
      where: {
        group_id: { in: [...groupIds] },
      },
      orderBy: { name: 'asc' },
    });

    const typesByGroup = new Map<number, any[]>();
    for (const type of types) {
      if (!typesByGroup.has(type.group_id)) {
        typesByGroup.set(type.group_id, []);
      }
      typesByGroup.get(type.group_id)!.push(type);
    }

    return groupIds.map((id) => typesByGroup.get(id) || []);
  });
};

/**
 * Region Stats DataLoader - Batch loading for region statistics
 * Calculates constellation/system counts for multiple regions at once
 */
export const createRegionStatsLoader = () => {
  return new DataLoader<
    number,
    { constellationCount: number; solarSystemCount: number }
  >(async (regionIds) => {
    console.log(
      '🔄 DataLoader: Batching',
      regionIds.length,
      'region stats queries',
    );

    // Fetch all constellations for these regions
    const constellations = await prisma.constellation.findMany({
      where: {
        region_id: { in: [...regionIds] },
      },
      select: { id: true, region_id: true },
    });

    // Group constellations by region
    const constByRegion = new Map<number, number[]>();
    for (const const_obj of constellations) {
      if (const_obj.region_id === null) continue;
      if (!constByRegion.has(const_obj.region_id)) {
        constByRegion.set(const_obj.region_id, []);
      }
      constByRegion.get(const_obj.region_id)!.push(const_obj.id);
    }

    // Fetch solar systems for all constellations
    const allConstIds = constellations.map((c) => c.id);
    const solarSystems = await prisma.solarSystem.findMany({
      where: {
        constellation_id: { in: allConstIds },
      },
      select: { constellation_id: true },
    });

    // Count solar systems per constellation
    const systemCountByConst = new Map<number, number>();
    for (const sys of solarSystems) {
      if (sys.constellation_id === null) continue;
      systemCountByConst.set(
        sys.constellation_id,
        (systemCountByConst.get(sys.constellation_id) || 0) + 1,
      );
    }

    // Calculate stats for each region
    return regionIds.map((regionId) => {
      const constIds = constByRegion.get(regionId) || [];
      const constellationCount = constIds.length;
      const solarSystemCount = constIds.reduce(
        (sum, constId) => sum + (systemCountByConst.get(constId) || 0),
        0,
      );

      return { constellationCount, solarSystemCount };
    });
  });
};

/**
 * Resolves the dominant sovereignty holder for a set of groups of systems.
 *
 * EVE holds sovereignty per solar system, so a region's or a constellation's
 * owner is whoever holds the most of its systems. Ownership is rarely split:
 * of the 784 held constellations 739 have one owner throughout, and a faction
 * never shares one with an alliance.
 *
 * `groupOf` says which group each system id belongs to — a constellation id or
 * a region id. Two batched name queries follow, one per owner kind.
 */
async function resolveSovereigntyHolders(
  groupIds: readonly number[],
  groupOf: Map<number, number>,
): Promise<(SovereigntyHolderRow | null)[]> {
  const systemIds = [...groupOf.keys()];
  const sovRows = systemIds.length
    ? await prisma.sovereigntyMapCurrent.findMany({
        where: { solar_system_id: { in: systemIds } },
        select: { solar_system_id: true, alliance_id: true, faction_id: true },
      })
    : [];

  // Count systems per owner within each group. The key keeps the owner's kind,
  // so an alliance and a faction that share an id cannot collide.
  const counts = new Map<number, Map<string, number>>();
  for (const row of sovRows) {
    const groupId = groupOf.get(row.solar_system_id);
    if (groupId === undefined) continue;

    const ownerType = row.alliance_id !== null ? 'ALLIANCE' : 'FACTION';
    const ownerId = row.alliance_id ?? row.faction_id;
    if (ownerId === null) continue;

    const perOwner = counts.get(groupId) ?? new Map<string, number>();
    const key = `${ownerType}:${ownerId}`;
    perOwner.set(key, (perOwner.get(key) ?? 0) + 1);
    counts.set(groupId, perOwner);
  }

  // Pick each group's dominant owner, breaking a tie on the lower id so the
  // answer does not move between requests.
  type Winner = {
    ownerType: 'ALLIANCE' | 'FACTION';
    ownerId: number;
    systemCount: number;
  };
  const winners = new Map<number, Winner>();
  for (const [groupId, perOwner] of counts) {
    let winner: Winner | null = null;

    for (const [key, systemCount] of perOwner) {
      const [ownerType, rawId] = key.split(':');
      const ownerId = Number(rawId);
      if (
        !winner ||
        systemCount > winner.systemCount ||
        (systemCount === winner.systemCount && ownerId < winner.ownerId)
      ) {
        winner = {
          ownerType: ownerType as 'ALLIANCE' | 'FACTION',
          ownerId,
          systemCount,
        };
      }
    }

    if (winner) winners.set(groupId, winner);
  }

  const allianceIds = [...winners.values()]
    .filter((w) => w.ownerType === 'ALLIANCE')
    .map((w) => w.ownerId);
  const factionIds = [...winners.values()]
    .filter((w) => w.ownerType === 'FACTION')
    .map((w) => w.ownerId);

  const [alliances, factions] = await Promise.all([
    allianceIds.length
      ? prisma.alliance.findMany({
          where: { id: { in: allianceIds } },
          select: { id: true, name: true, ticker: true },
        })
      : [],
    factionIds.length
      ? prisma.faction.findMany({
          where: { id: { in: factionIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const allianceMap = new Map(alliances.map((a) => [a.id, a]));
  const factionMap = new Map(factions.map((f) => [f.id, f]));

  return groupIds.map((groupId) => {
    const winner = winners.get(groupId);
    if (!winner) return null;

    if (winner.ownerType === 'ALLIANCE') {
      const alliance = allianceMap.get(winner.ownerId);
      return {
        ownerType: 'ALLIANCE',
        ownerId: winner.ownerId,
        ownerName: alliance?.name ?? null,
        allianceTicker: alliance?.ticker ?? null,
        systemCount: winner.systemCount,
      };
    }

    const faction = factionMap.get(winner.ownerId);
    return {
      ownerType: 'FACTION',
      ownerId: winner.ownerId,
      ownerName: faction?.name ?? null,
      allianceTicker: null,
      systemCount: winner.systemCount,
    };
  });
}

/**
 * Constellation Sovereignty DataLoader
 *
 * One query for the systems, then the shared roll-up above.
 */
export const createConstellationSovereigntyLoader = () => {
  return new DataLoader<number, SovereigntyHolderRow | null>(
    async (constellationIds) => {
      console.log(
        `🔄 DataLoader: Batching ${constellationIds.length} constellation sovereignty queries`,
      );

      const systems = await prisma.solarSystem.findMany({
        where: { constellation_id: { in: [...constellationIds] } },
        select: { id: true, constellation_id: true },
      });

      const groupOf = new Map<number, number>();
      for (const sys of systems) {
        if (sys.constellation_id === null) continue;
        groupOf.set(sys.id, sys.constellation_id);
      }

      return resolveSovereigntyHolders(constellationIds, groupOf);
    },
  );
};

/**
 * Region Sovereignty DataLoader
 *
 * Same roll-up one level higher: systems reach a region through their
 * constellation, so the constellations are read first and the systems second.
 */
export const createRegionSovereigntyLoader = () => {
  return new DataLoader<number, SovereigntyHolderRow | null>(
    async (regionIds) => {
      console.log(
        `🔄 DataLoader: Batching ${regionIds.length} region sovereignty queries`,
      );

      const constellations = await prisma.constellation.findMany({
        where: { region_id: { in: [...regionIds] } },
        select: { id: true, region_id: true },
      });

      const regionOfConstellation = new Map<number, number>();
      for (const constellation of constellations) {
        if (constellation.region_id === null) continue;
        regionOfConstellation.set(constellation.id, constellation.region_id);
      }

      const systems = constellations.length
        ? await prisma.solarSystem.findMany({
            where: {
              constellation_id: { in: [...regionOfConstellation.keys()] },
            },
            select: { id: true, constellation_id: true },
          })
        : [];

      const groupOf = new Map<number, number>();
      for (const sys of systems) {
        if (sys.constellation_id === null) continue;
        const regionId = regionOfConstellation.get(sys.constellation_id);
        if (regionId === undefined) continue;
        groupOf.set(sys.id, regionId);
      }

      return resolveSovereigntyHolders(regionIds, groupOf);
    },
  );
};

/**
 * Stargates by Solar System DataLoader
 */
export const createStargatesBySystemLoader = () => {
  return new DataLoader<number, any[]>(async (systemIds) => {
    console.log(
      `🔄 DataLoader: Batching ${systemIds.length} stargates-by-system queries`,
    );

    const rows = await prisma.stargate.findMany({
      where: { solar_system_id: { in: [...systemIds] } },
      orderBy: { id: 'asc' },
    });

    const grouped = new Map<number, any[]>();
    for (const row of rows) {
      const list = grouped.get(row.solar_system_id) ?? [];
      list.push(row);
      grouped.set(row.solar_system_id, list);
    }
    return systemIds.map((id) => grouped.get(id) ?? []);
  });
};

/**
 * Single Stargate DataLoader - used by StargateDestination.stargate
 */
export const createStargateLoader = () => {
  return new DataLoader<number, any>(async (stargateIds) => {
    console.log(
      `🔄 DataLoader: Batching ${stargateIds.length} stargate queries`,
    );

    const rows = await prisma.stargate.findMany({
      where: { id: { in: [...stargateIds] } },
    });

    const map = new Map(rows.map((r) => [r.id, r]));
    return stargateIds.map((id) => map.get(id) || null);
  });
};

/**
 * Star by Solar System DataLoader
 */
export const createStarBySystemLoader = () => {
  return new DataLoader<number, any>(async (systemIds) => {
    console.log(
      `🔄 DataLoader: Batching ${systemIds.length} star-by-system queries`,
    );

    const rows = await prisma.star.findMany({
      where: { solar_system_id: { in: [...systemIds] } },
    });

    const map = new Map(rows.map((r) => [r.solar_system_id, r]));
    return systemIds.map((id) => map.get(id) || null);
  });
};

/**
 * Planets by Solar System DataLoader
 */
export const createPlanetsBySystemLoader = () => {
  return new DataLoader<number, any[]>(async (systemIds) => {
    console.log(
      `🔄 DataLoader: Batching ${systemIds.length} planets-by-system queries`,
    );

    const rows = await prisma.planet.findMany({
      where: { solar_system_id: { in: [...systemIds] } },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });

    const grouped = new Map<number, any[]>();
    for (const row of rows) {
      const list = grouped.get(row.solar_system_id) ?? [];
      list.push(row);
      grouped.set(row.solar_system_id, list);
    }
    return systemIds.map((id) => grouped.get(id) ?? []);
  });
};

/**
 * Stations by Solar System DataLoader
 */
export const createStationsBySystemLoader = () => {
  return new DataLoader<number, any[]>(async (systemIds) => {
    console.log(
      `🔄 DataLoader: Batching ${systemIds.length} stations-by-system queries`,
    );

    const rows = await prisma.station.findMany({
      where: { solar_system_id: { in: [...systemIds] } },
      orderBy: { id: 'asc' },
    });

    const grouped = new Map<number, any[]>();
    for (const row of rows) {
      const list = grouped.get(row.solar_system_id) ?? [];
      list.push(row);
      grouped.set(row.solar_system_id, list);
    }
    return systemIds.map((id) => grouped.get(id) ?? []);
  });
};

/**
 * Moons by Planet DataLoader
 */
export const createMoonsByPlanetLoader = () => {
  return new DataLoader<number, any[]>(async (planetIds) => {
    console.log(
      `🔄 DataLoader: Batching ${planetIds.length} moons-by-planet queries`,
    );

    const rows = await prisma.moon.findMany({
      where: { planet_id: { in: [...planetIds] } },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });

    const grouped = new Map<number, any[]>();
    for (const row of rows) {
      const list = grouped.get(row.planet_id) ?? [];
      list.push(row);
      grouped.set(row.planet_id, list);
    }
    return planetIds.map((id) => grouped.get(id) ?? []);
  });
};

/**
 * Asteroid Belts by Planet DataLoader
 */
export const createAsteroidBeltsByPlanetLoader = () => {
  return new DataLoader<number, any[]>(async (planetIds) => {
    console.log(
      `🔄 DataLoader: Batching ${planetIds.length} belts-by-planet queries`,
    );

    const rows = await prisma.asteroidBelt.findMany({
      where: { planet_id: { in: [...planetIds] } },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });

    const grouped = new Map<number, any[]>();
    for (const row of rows) {
      const list = grouped.get(row.planet_id) ?? [];
      list.push(row);
      grouped.set(row.planet_id, list);
    }
    return planetIds.map((id) => grouped.get(id) ?? []);
  });
};

/**
 * Single Planet DataLoader - used by Moon.planet and AsteroidBelt.planet
 */
export const createPlanetLoader = () => {
  return new DataLoader<number, any>(async (planetIds) => {
    console.log(`🔄 DataLoader: Batching ${planetIds.length} planet queries`);

    const rows = await prisma.planet.findMany({
      where: { id: { in: [...planetIds] } },
    });

    const map = new Map(rows.map((r) => [r.id, r]));
    return planetIds.map((id) => map.get(id) || null);
  });
};
