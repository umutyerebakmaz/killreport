/**
 * GraphQL Context Type Definitions
 */

import DataLoader from 'dataloader';

/**
 * Verified EVE Online character information
 */
export interface VerifiedCharacter {
    characterId: number;
    characterName: string;
    characterOwnerHash: string;
    scopes?: string;
}

/**
 * DataLoader context structure
 * Matches the structure from services/dataloaders.ts
 */
export interface DataLoaderContext {
    loaders: {
        alliance: DataLoader<number, any, number>;
        corporation: DataLoader<number, any, number>;
        character: DataLoader<number, any, number>;
        race: DataLoader<number, any, number>;
        bloodline: DataLoader<number, any, number>;
        corporationsByAlliance: DataLoader<number, any[], number>;
        region: DataLoader<number, any, number>;
        constellation: DataLoader<number, any, number>;
        solarSystem: DataLoader<number, any, number>;
        constellationsByRegion: DataLoader<number, any[], number>;
        solarSystemsByConstellation: DataLoader<number, any[], number>;
        category: DataLoader<number, any, number>;
        itemGroup: DataLoader<number, any, number>;
        type: DataLoader<number, any, number>;
        itemGroupsByCategory: DataLoader<number, any[], number>;
        corporationSnapshot: DataLoader<{ corporationId: number; date: Date }, any, string>;
        allianceSnapshot: DataLoader<{ allianceId: number; date: Date }, any, string>;
        typeDogmaAttributes: DataLoader<number, any[], number>;
        typeDogmaEffects: DataLoader<number, any[], number>;
        victim: DataLoader<number, any, number>;
        attackers: DataLoader<number, any[], number>;
        items: DataLoader<number, any[], number>;
        marketPrice: DataLoader<number, any, number>;
    };
}

/**
 * GraphQL Request Context
 * Available in all resolvers as the third parameter
 */
export interface GraphQLContext extends DataLoaderContext {
    /** Authenticated user (if logged in) */
    user?: VerifiedCharacter;

    /** Access token for ESI API calls */
    token?: string;
}
