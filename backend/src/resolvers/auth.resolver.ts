import { MutationResolvers, QueryResolvers } from '@generated-types';
import { randomUUID } from 'crypto';
import { CharacterService } from '../services/character/character.service';
import {
    exchangeCodeForToken,
    getAuthUrl,
    refreshAccessToken,
    verifyToken,
} from '../services/eve-sso';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

/**
 * Auth Query Resolvers
 * Handles authentication-related queries
 */
export const authQueries: QueryResolvers = {
    me: async (_parent, _args, context: any) => {
        if (!context.user) {
            throw new Error('Not authenticated');
        }

        // Get user info from database
        const user = await prisma.user.findUnique({
            where: { character_id: context.user.characterId },
        });

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.character_id.toString(),
            name: user.character_name,
            email: user.email || '',
            createdAt: user.created_at.toISOString(),
        };
    },
};

/**
 * Auth Mutation Resolvers
 * Handles authentication operations (login, token exchange, logout)
 */
export const authMutations: MutationResolvers = {
    login: async () => {
        const state = randomUUID();
        const url = await getAuthUrl(state);

        return {
            url,
            state,
        } as any;
    },

    authenticateWithCode: async (_parent: any, { code, state }: any) => {
        try {
            // Exchange authorization code for token
            const tokenData = await exchangeCodeForToken(code);

            // Verify token and get character info
            const character = await verifyToken(tokenData.access_token);

            // Calculate token expiry time
            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

            // Fetch character info from ESI to get corporation_id
            let corporationId: number | null = null;
            try {
                const characterInfo = await CharacterService.getCharacterInfo(character.characterId);
                corporationId = characterInfo.corporation_id;
            } catch (error) {
                console.warn('⚠️  Failed to fetch corporation_id for character:', error);
            }

            // Find or create user in database
            const user = await prisma.user.upsert({
                where: { character_id: character.characterId },
                update: {
                    character_name: character.characterName,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: expiresAt,
                    corporation_id: corporationId, // Update corporation_id
                },
                create: {
                    character_id: character.characterId,
                    character_name: character.characterName,
                    character_owner_hash: character.characterOwnerHash,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: expiresAt,
                    corporation_id: corporationId, // Save corporation_id
                },
            });

            // 🚀 Queue user for killmail sync after successful login
            // Only queue if user hasn't been synced recently (within 15 minutes)
            try {
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                const channel = await getRabbitMQChannel();

                // 1. Queue CHARACTER killmails
                const shouldQueueChar = !user.last_killmail_sync_at ||
                    user.last_killmail_sync_at < fifteenMinutesAgo;

                if (shouldQueueChar) {
                    const CHAR_QUEUE_NAME = 'esi_user_killmails_queue';

                    await channel.assertQueue(CHAR_QUEUE_NAME, {
                        durable: true,
                        arguments: {
                            'x-max-priority': 10,
                        },
                    });

                    const charMessage = {
                        userId: user.id,
                        characterId: user.character_id,
                        characterName: user.character_name,
                        accessToken: tokenData.access_token,
                        refreshToken: tokenData.refresh_token,
                        expiresAt: expiresAt.toISOString(),
                        queuedAt: new Date().toISOString(),
                    };

                    channel.sendToQueue(
                        CHAR_QUEUE_NAME,
                        Buffer.from(JSON.stringify(charMessage)),
                        {
                            persistent: true,
                            priority: 8, // High priority for new logins
                        }
                    );

                    console.log(`✅ Queued character killmail sync for ${user.character_name}`);
                } else {
                    const timeSinceSync = user.last_killmail_sync_at
                        ? Math.floor((Date.now() - user.last_killmail_sync_at.getTime()) / 1000 / 60)
                        : 'unknown';
                    console.log(`⏭️  Skipped character queue for ${user.character_name} (synced ${timeSinceSync} minutes ago)`);
                }

                // 2. Queue CORPORATION killmails (if user has corporation_id)
                if (corporationId) {
                    const shouldQueueCorp = !user.last_corp_killmail_sync_at ||
                        user.last_corp_killmail_sync_at < fifteenMinutesAgo;

                    if (shouldQueueCorp) {
                        const CORP_QUEUE_NAME = 'esi_corporation_killmails_queue';

                        await channel.assertQueue(CORP_QUEUE_NAME, {
                            durable: true,
                            arguments: {
                                'x-max-priority': 10,
                            },
                        });

                        // Fetch corporation name
                        let corporationName = `Corporation ${corporationId}`;
                        try {
                            const corp = await prisma.corporation.findUnique({
                                where: { id: corporationId },
                                select: { name: true },
                            });
                            if (corp) corporationName = corp.name;
                        } catch (err) {
                            // Ignore, use default name
                        }

                        const corpMessage = {
                            userId: user.id,
                            characterId: user.character_id,
                            characterName: user.character_name,
                            corporationId,
                            corporationName,
                            accessToken: tokenData.access_token,
                            refreshToken: tokenData.refresh_token,
                            expiresAt: expiresAt.toISOString(),
                            queuedAt: new Date().toISOString(),
                        };

                        channel.sendToQueue(
                            CORP_QUEUE_NAME,
                            Buffer.from(JSON.stringify(corpMessage)),
                            {
                                persistent: true,
                                priority: 7, // Slightly lower priority than character
                            }
                        );

                        console.log(`✅ Queued corporation killmail sync for ${corporationName}`);
                        console.log(`   ⚠️  Note: Requires Director/CEO role to succeed`);
                    }
                }
            } catch (queueError) {
                // Log error but don't fail the login
                console.error('⚠️  Failed to queue user for killmail sync:', queueError);
            }

            return {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                user: {
                    id: user.character_id.toString(),
                    name: user.character_name,
                    email: user.email || '',
                    createdAt: user.created_at.toISOString(),
                },
            } as any;
        } catch (error) {
            console.error('Authentication error:', error);
            throw new Error('Authentication failed');
        }
    },

    refreshToken: async (_parent: any, { refreshToken }: any) => {
        try {
            // Get new access token with refresh token
            const tokenData = await refreshAccessToken(refreshToken);

            // Verify new token and get character info
            const character = await verifyToken(tokenData.access_token);

            // Calculate token expiry time
            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

            // Update user in database
            const user = await prisma.user.update({
                where: { character_id: character.characterId },
                data: {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: expiresAt,
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            return {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                user: {
                    id: user.character_id.toString(),
                    name: user.character_name,
                    email: user.email || '',
                    createdAt: user.created_at.toISOString(),
                },
            } as any;
        } catch (error) {
            console.error('Token refresh error:', error);
            throw new Error('Token refresh failed');
        }
    },
};
