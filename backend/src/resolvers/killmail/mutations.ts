import { MutationResolvers } from '@generated-types';
import { CharacterService } from '@services/character';

/**
 * Killmail Mutation Resolvers
 * Handles operations that modify killmail data
 */
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
