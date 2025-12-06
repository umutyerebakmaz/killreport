import {
    MutationResolvers,
    QueryResolvers
} from '../generated-types';
import { CharacterService } from '../services/character';
import { CorporationService } from '../services/corporation';
import { KillmailService } from '../services/killmail';

// Mock data
const killmails = [
    {
        id: '1',
        killmailId: 123456,
        killmailHash: 'abc123def456',
        killmailTime: new Date().toISOString(),
        totalValue: 1500000000,
    },
];

// Query Resolvers
export const killmailQueries: QueryResolvers = {
    killmail: (_, { id }) => {
        const km = killmails.find((k) => k.id === id);
        if (!km) return null;

        return {
            ...km,
            solarSystemId: 30000142,
            createdAt: new Date().toISOString(),
            items: [],
            victim: {
                characterId: 12345,
                characterName: 'Victim Name',
                corporationId: 98765,
                corporationName: 'Victim Corp',
                shipTypeId: 587,
                damageTaken: 10000,
            },
            attackers: [
                {
                    characterId: 54321,
                    characterName: 'Attacker Name',
                    corporationId: 11111,
                    shipTypeId: 588,
                    weaponTypeId: 2456,
                    damageDone: 10000,
                    finalBlow: true,
                    securityStatus: -5.0,
                },
            ],
        };
    },

    killmails: (_, args) => {
        const first = args.first ?? 10;
        const after = args.after ? parseInt(Buffer.from(args.after, 'base64').toString()) : 0;

        const data = killmails.slice(after, after + first).map((km, index) => ({
            ...km,
            solarSystemId: 30000142,
            createdAt: new Date().toISOString(),
            items: [],
            victim: {
                characterId: 12345,
                characterName: 'Victim Name',
                corporationId: 98765,
                corporationName: 'Victim Corp',
                shipTypeId: 587,
                damageTaken: 10000,
            },
            attackers: [
                {
                    characterId: 54321,
                    characterName: 'Attacker Name',
                    corporationId: 11111,
                    shipTypeId: 588,
                    weaponTypeId: 2456,
                    damageDone: 10000,
                    finalBlow: true,
                    securityStatus: -5.0,
                },
            ],
        }));

        const edges = data.map((km, index) => ({
            node: km,
            cursor: Buffer.from(`${after + index + 1}`).toString('base64'),
        }));

        return {
            edges,
            pageInfo: {
                hasNextPage: after + first < killmails.length,
                hasPreviousPage: after > 0,
                currentPage: Math.floor(after / first) + 1,
                totalPages: Math.ceil(killmails.length / first),
                totalCount: killmails.length,
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
                            killmailId: km.killmail_id,
                            killmailHash: km.killmail_hash,
                            killmailTime: detail.killmail_time,
                            victim: {
                                characterId: detail.victim.character_id ?? null,
                                characterName: null, // Will resolve character name later
                                corporationId: detail.victim.corporation_id,
                                corporationName: null,
                                shipTypeId: detail.victim.ship_type_id,
                                damageTaken: detail.victim.damage_taken,
                            },
                            attackers: detail.attackers.map((attacker) => ({
                                characterId: attacker.character_id ?? null,
                                characterName: null,
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
                            killmailId: km.killmail_id,
                            killmailHash: km.killmail_hash,
                            killmailTime: detail.killmail_time,
                            victim: {
                                characterId: detail.victim.character_id ?? null,
                                characterName: null,
                                corporationId: detail.victim.corporation_id,
                                corporationName: null,
                                shipTypeId: detail.victim.ship_type_id,
                                damageTaken: detail.victim.damage_taken,
                            },
                            attackers: detail.attackers.map((attacker) => ({
                                characterId: attacker.character_id ?? null,
                                characterName: null,
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
    solarSystem: async (parent, _, context) => {
        if (!parent.solarSystemId) return null;
        return context.loaders.solarSystem.load(parent.solarSystemId);
    },
};

export const victimFieldResolvers: VictimResolvers = {
    character: async (parent, _, context) => {
        if (!parent.characterId) return null;
        return context.loaders.character.load(parent.characterId);
    },
    corporation: async (parent, _, context) => {
        if (!parent.corporationId) return null;
        return context.loaders.corporation.load(parent.corporationId);
    },
    alliance: async (parent, _, context) => {
        if (!parent.allianceId) return null;
        return context.loaders.alliance.load(parent.allianceId);
    },
    shipType: async (parent, _, context) => {
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
    character: async (parent, _, context) => {
        if (!parent.characterId) return null;
        return context.loaders.character.load(parent.characterId);
    },
    corporation: async (parent, _, context) => {
        if (!parent.corporationId) return null;
        return context.loaders.corporation.load(parent.corporationId);
    },
    alliance: async (parent, _, context) => {
        if (!parent.allianceId) return null;
        return context.loaders.alliance.load(parent.allianceId);
    },
    shipType: async (parent, _, context) => {
        if (!parent.shipTypeId) return null;
        const type = await context.loaders.type.load(parent.shipTypeId);
        if (!type) return null;
        return {
            ...type,
            created_at: type.created_at.toISOString(),
            updated_at: type.updated_at.toISOString(),
        } as any;
    },
    weaponType: async (parent, _, context) => {
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
    itemType: async (parent, _, context) => {
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
