import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createYoga, useLogger } from 'graphql-yoga';
import { createServer } from 'node:http';
import path from 'path';

import { config } from './config';
import { REDIS_CONFIG } from './config/cache.config';
import { handleAuthCallback } from './handlers/auth-callback.handler';
import { createResponseCachePlugin } from './plugins/response-cache.plugin';
import { resolvers } from './resolvers';
import { createDataLoaders } from './services/dataloaders';
import { verifyToken } from './services/eve-sso';
import logger from './services/logger';
import { userKillmailCron } from './services/user-killmail-cron';
import { VerifiedCharacter } from './types/context';

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
  plugins: [
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
  graphiql: {
    subscriptionsProtocol: 'SSE',
  },
  context: async ({ request }): Promise<ServerContext> => {
    // Create fresh DataLoader instances per request
    const dataLoaders = createDataLoaders();

    const authorization = request.headers.get('authorization');

    // Verify Bearer token if present
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      logger.debug('🔑 Token received, length:', token.length);

      try {
        const character = await verifyToken(token);
        logger.debug('✅ Token verified for character:', character.characterName);

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

    logger.debug('⚠️  No token provided');
    return {
      ...dataLoaders,
    };
  },
});/**
 * Create HTTP server with routing
 */
const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

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
});
