import {
    AsteroidBeltResolvers,
    MoonResolvers,
    PlanetResolvers,
    SolarSystemResolvers,
    StargateDestinationResolvers,
    StargateResolvers,
    StarResolvers,
    StationResolvers,
} from '@generated-types';
import prisma from '@services/prisma';

/**
 * Prisma rows carry position_x/y/z; GraphQL exposes a Position object whose
 * fields are non-null. A missing component collapses the whole object to null
 * rather than producing a half-filled Position.
 */
function toPosition(row: any) {
    if (row.position_x === null || row.position_y === null || row.position_z === null) {
        return null;
    }
    return { x: row.position_x, y: row.position_y, z: row.position_z };
}

/**
 * Fields the topology schema adds to SolarSystem.
 * Merged into solarSystemFields in ./index.ts.
 */
export const solarSystemTopologyFields: SolarSystemResolvers = {
    stargates: async (parent, _, context) =>
        context.loaders.stargatesBySystem.load((parent as any).id),

    planets: async (parent, _, context) =>
        context.loaders.planetsBySystem.load((parent as any).id),

    stations: async (parent, _, context) =>
        context.loaders.stationsBySystem.load((parent as any).id),

    star: async (parent, _, context) =>
        context.loaders.starBySystem.load((parent as any).id),

    counts: async (parent) => {
        const systemId = (parent as any).id;
        const [stargates, planets, moons, asteroidBelts, stations, sovereigntyStructures] =
            await Promise.all([
                prisma.stargate.count({ where: { solar_system_id: systemId } }),
                prisma.planet.count({ where: { solar_system_id: systemId } }),
                prisma.moon.count({ where: { solar_system_id: systemId } }),
                prisma.asteroidBelt.count({ where: { solar_system_id: systemId } }),
                prisma.station.count({ where: { solar_system_id: systemId } }),
                prisma.sovereigntyStructure.count({
                    where: { solar_system_id: systemId, destroyed_at: null },
                }),
            ]);

        // The Adjacent tab label reads `stargates`, not a count of resolved
        // destinations: stargate rows exist after step 2, while
        // destination_system_id is only filled in by step 3.
        return { stargates, planets, moons, asteroidBelts, stations, sovereigntyStructures };
    },
};

export const stargateFields: StargateResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    position: (parent) => toPosition(parent),
    solarSystem: async (parent, _, context) =>
        context.loaders.solarSystem.load((parent as any).solar_system_id),
    // The destination object is shaped from the stargate row itself; the
    // resolvers below read the same parent.
    destination: (parent) => parent as any,
};

export const stargateDestinationFields: StargateDestinationResolvers = {
    destinationSystemId: (parent) => (parent as any).destination_system_id ?? null,
    destinationStargateId: (parent) => (parent as any).destination_stargate_id ?? null,
    system: async (parent, _, context) => {
        const systemId = (parent as any).destination_system_id;
        if (!systemId) return null;
        return context.loaders.solarSystem.load(systemId);
    },
    stargate: async (parent, _, context) => {
        const stargateId = (parent as any).destination_stargate_id;
        if (!stargateId) return null;
        return context.loaders.stargate.load(stargateId);
    },
};

export const starFields: StarResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    spectralClass: (parent) => (parent as any).spectral_class ?? null,
    solarSystem: async (parent, _, context) =>
        context.loaders.solarSystem.load((parent as any).solar_system_id),
};

export const planetFields: PlanetResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    orbitIndex: (parent) => (parent as any).orbit_index ?? null,
    position: (parent) => toPosition(parent),
    moons: async (parent, _, context) =>
        context.loaders.moonsByPlanet.load((parent as any).id),
    asteroidBelts: async (parent, _, context) =>
        context.loaders.asteroidBeltsByPlanet.load((parent as any).id),
    solarSystem: async (parent, _, context) =>
        context.loaders.solarSystem.load((parent as any).solar_system_id),
};

export const moonFields: MoonResolvers = {
    orbitIndex: (parent) => (parent as any).orbit_index ?? null,
    position: (parent) => toPosition(parent),
    planet: async (parent, _, context) =>
        context.loaders.planet.load((parent as any).planet_id),
    solarSystem: async (parent, _, context) =>
        context.loaders.solarSystem.load((parent as any).solar_system_id),
};

export const asteroidBeltFields: AsteroidBeltResolvers = {
    orbitIndex: (parent) => (parent as any).orbit_index ?? null,
    position: (parent) => toPosition(parent),
    planet: async (parent, _, context) =>
        context.loaders.planet.load((parent as any).planet_id),
    solarSystem: async (parent, _, context) =>
        context.loaders.solarSystem.load((parent as any).solar_system_id),
};

export const stationFields: StationResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    ownerCorporationId: (parent) => (parent as any).owner_corporation_id ?? null,
    ownerCorporation: async (parent, _, context) => {
        const corpId = (parent as any).owner_corporation_id;
        if (!corpId) return null;
        return context.loaders.corporation.load(corpId);
    },
    raceId: (parent) => (parent as any).race_id ?? null,
    reprocessingEfficiency: (parent) => (parent as any).reprocessing_efficiency ?? null,
    reprocessingStationsTake: (parent) => (parent as any).reprocessing_stations_take ?? null,
    officeRentalCost: (parent) => (parent as any).office_rental_cost ?? null,
    maxDockableShipVolume: (parent) => (parent as any).max_dockable_ship_volume ?? null,
    position: (parent) => toPosition(parent),
    solarSystem: async (parent, _, context) =>
        context.loaders.solarSystem.load((parent as any).solar_system_id),
};
