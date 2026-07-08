import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useServer } from 'graphql-ws/use/ws';
import { createYoga, useLogger } from 'graphql-yoga';
import { createServer } from 'node:http';
import path from 'path';
import { WebSocketServer } from 'ws';

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
  graphiql: config.graphql.playground ? { subscriptionsProtocol: 'WS' } : false,
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

    const authorization = request?.headers.get('authorization');

    // Generate or extract session ID for tracking
    // Fallback to IP-based identifier if no session ID provided
    let sessionId = request?.headers.get('x-session-id');

    if (!sessionId) {
      // Use IP address as fallback identifier
      const forwarded = request?.headers.get('x-forwarded-for');
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
 * WebSocket server for GraphQL subscriptions (graphql-ws protocol).
 *
 * Subscriptions used to run over SSE, but each SSE subscription holds its own
 * long-lived HTTP/1.1 connection. Browsers cap concurrent connections at ~6 per
 * origin, so a handful of always-on subscriptions (active users, sovereignty
 * alerts, new killmails) starved the connection pool and left regular GraphQL
 * queries stuck "pending". WebSockets are not subject to that per-origin HTTP
 * connection limit, so all subscriptions now multiplex over a single socket.
 *
 * NOTE (deploy): the Nginx reverse proxy must forward the WebSocket upgrade for
 * `/graphql` (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).
 */
const wsServer = new WebSocketServer({ server, path: yoga.graphqlEndpoint });

useServer(
  {
    execute: (args: any) => args.rootValue.execute(args),
    subscribe: (args: any) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, _id, params) => {
      // Browsers cannot set headers on the WS handshake, so auth/session travel
      // in connectionParams. Bridge them onto the upgrade request's headers so
      // Yoga's existing context factory (which reads request.headers) picks them up.
      const connectionParams = (ctx.connectionParams ?? {}) as Record<string, string>;
      const upgradeReq = ctx.extra.request as any;
      if (upgradeReq?.headers) {
        if (connectionParams.authorization) {
          upgradeReq.headers.authorization = connectionParams.authorization;
        }
        if (connectionParams['x-session-id']) {
          upgradeReq.headers['x-session-id'] = connectionParams['x-session-id'];
        }
      }

      const { schema, execute, subscribe, contextFactory, parse, validate } = yoga.getEnveloped({
        ...ctx,
        req: ctx.extra.request,
        socket: ctx.extra.socket,
        params,
      });

      const args = {
        schema,
        operationName: params.operationName,
        document: parse(params.query),
        variableValues: params.variables,
        contextValue: await contextFactory(),
        rootValue: { execute, subscribe },
      };

      const errors = validate(args.schema, args.document);
      if (errors.length) return errors;
      return args;
    },
  },
  wsServer
);

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
});
