import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createYoga, useLogger } from 'graphql-yoga';
import { createServer } from 'node:http';
import path from 'path';

import { VerifiedCharacter } from '@app-types/context';
import { REDIS_CONFIG } from '@config/cache';
import { config } from '@config/config';
import { createDisableIntrospectionPlugin } from '@plugins/disable-introspection.plugin';
import { createRateLimitPlugin } from '@plugins/rate-limit.plugin';
import { createResponseCachePlugin } from '@plugins/response-cache.plugin';
import { trackActiveUser } from '@resolvers/analytics';
import { createDataLoaders } from '@services/dataloaders';
import { verifyToken } from '@services/eve-sso';
import logger from '@services/logger';
import { ensureAllQueuesExist } from '@services/rabbitmq';
import { userKillmailCron } from '@services/user-killmail-cron';
import { handleAuthCallback } from './handlers/auth-callback.handler';
import { resolvers } from './resolvers';

/**
 * GraphQL Context - extends DataLoader context with auth info
 */
interface ServerContext extends ReturnType<typeof createDataLoaders> {
    user?: VerifiedCharacter;
    token?: string;
}

/**
 * Load and merge GraphQL schema files
 */
const typesArray = loadFilesSync(path.join(__dirname, 'schemas/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);

/**
 * Create executable GraphQL schema
 */
const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

/**
 * Create GraphQL Yoga server instance
 */
const yoga = createYoga<ServerContext>({
    schema,
    graphqlEndpoint: '/graphql',

    // GraphQL introspection and playground settings
    graphiql: config.graphql.playground ? { subscriptionsProtocol: 'SSE' } : false,
    maskedErrors: config.app.isProduction, // Mask errors in production

    // CORS configuration
    cors: config.app.isProduction
        ? {
            origin: [
                'https://killreport.com',
                'https://www.killreport.com',
                'https://api.killreport.com'
            ],
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept', 'x-session-id'],
        }
        : {
            origin: '*', // Development: allow all origins
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept', 'x-session-id'],
        },

    plugins: [
        // Rate limiting (must be first to prevent abuse)
        createRateLimitPlugin({
            max: config.app.isProduction ? 100 : 1000, // 100 req/min in prod, 1000 in dev
            windowMs: 60_000, // 1 minute window
        }),
        // Disable introspection when config is set to false
        ...(config.graphql.introspection ? [] : [createDisableIntrospectionPlugin()]),
        useLogger({
            logFn: (eventName, { args }) => {
                // Track execution timing
                if (eventName === 'execute-start') {
                    (args.contextValue as any).startTime = Date.now();
                } else if (eventName === 'execute-end') {
                    const duration = Date.now() - ((args.contextValue as any).startTime || 0);
                    const operationName = args.operationName || 'anonymous';

                    // Log based on duration thresholds
                    if (duration >= 5000) {
                        logger.error(`🐌 Slow Query [${operationName}] - ${duration}ms`);
                    } else if (duration >= 1000) {
                        logger.warn(`⚠️  Long Query [${operationName}] - ${duration}ms`);
                    } else {
                        logger.debug(`✅ [${operationName}] - ${duration}ms`);
                    }
                }
            }
        }),
        createResponseCachePlugin(), // Cache responses
    ],
    context: async ({ request }): Promise<ServerContext> => {
        // Create fresh DataLoader instances per request
        const dataLoaders = createDataLoaders();

        const authorization = request.headers.get('authorization');

        // Generate or extract session ID for tracking
        // Fallback to IP-based identifier if no session ID provided
        let sessionId = request.headers.get('x-session-id');

        if (!sessionId) {
            // Use IP address as fallback identifier
            const forwarded = request.headers.get('x-forwarded-for');
            const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
            sessionId = `ip_${ip}`;
            logger.debug('⚠️  No session ID provided, using IP-based identifier:', sessionId);
        }

        // Verify Bearer token if present
        if (authorization?.startsWith('Bearer ')) {
            const token = authorization.slice(7);
            logger.debug('🔑 Token received, length:', token.length);

            try {
                const character = await verifyToken(token);
                logger.debug('✅ Token verified for character:', character.characterName);

                // Track user as active (with user ID)
                await trackActiveUser(character.characterId.toString(), sessionId);

                return {
                    user: character,
                    token,
                    ...dataLoaders,
                };
            } catch (error) {
                logger.error('❌ Token verification failed:', error);
                // Continue without authentication
            }
        }

        // Track anonymous user as active (with session ID only)
        await trackActiveUser(undefined, sessionId);

        logger.debug('⚠️  No token provided');
        return {
            ...dataLoaders,
        };
    },
});/**
 * Create HTTP server with routing
 * NOTE: CORS is handled by Nginx reverse proxy, not here!
 */
const server = createServer(async (req, res) => {
    // Route: EVE SSO callback
    if (req.url?.startsWith('/auth/callback')) {
        return handleAuthCallback(req, res);
    }

    // Route: GraphQL endpoint
    return yoga(req, res);
});

/**
 * Start server
 */
const port = config.app.port;
const USE_REDIS = process.env.USE_REDIS_PUBSUB === 'true';

server.listen(port, () => {
    logger.info('='.repeat(80));
    logger.info(`🚀 KillReport GraphQL Server`);
    logger.info('='.repeat(80));
    logger.info(`📍 GraphQL Playground: http://localhost:${port}/graphql`);
    logger.info(`🔐 Auth Callback:      http://localhost:${port}/auth/callback`);
    logger.info(`❤️  Health Check:       http://localhost:${port}/health`);
    logger.info('─'.repeat(80));
    logger.info(`📡 Subscriptions:      ${USE_REDIS ? `Redis PubSub (${REDIS_CONFIG.url})` : 'In-memory (single instance)'}`);
    logger.info(`💾 Response Cache:     Enabled (Redis storage)`);
    logger.info(`🛡️  Rate Limiting:      ${config.app.isProduction ? '100' : '1000'} requests/minute`);
    logger.info(`⏱️  Response Time:      Enabled (warn: 1s, error: 5s)`);
    logger.info('─'.repeat(80));
    logger.info('Available Workers:');
    logger.info('  yarn worker:redisq         # RedisQ stream worker');
    logger.info('  yarn worker:user-killmails # User killmail sync worker');
    logger.info('='.repeat(80));

    // Start background cron job
    userKillmailCron.start().catch((error) => {
        logger.error('Failed to start user killmail cron:', error);
    });

    // Ensure all RabbitMQ queues exist
    ensureAllQueuesExist().catch((error) => {
        logger.error('Failed to ensure RabbitMQ queues:', error);
    });

    // NOTE: Materialized view refresh is now handled by a separate worker
    // Run: yarn worker:materialized-views (or start via PM2)
    // See: src/workers/worker-top-targets-cleanup.ts
});
