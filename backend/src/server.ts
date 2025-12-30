import { useResponseCache } from '@envelop/response-cache';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createYoga } from 'graphql-yoga';
import Redis from 'ioredis';
import { createServer } from 'node:http';
import path from 'path';

// Tüm resolver'ları modüler yapıdan import et
import { config } from './config';
import { resolvers } from './resolvers';
import { createDataLoaders } from './services/dataloaders';
import { exchangeCodeForToken, verifyToken } from './services/eve-sso';
import logger from './services/logger';
import prisma from './services/prisma';
import { userKillmailCron } from './services/user-killmail-cron';

// Redis cache için
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisCache = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
  connectTimeout: 10000, // 10 second connection timeout
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.info(`Redis reconnecting... attempt ${times}`);
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error('Redis connection error:', err.message);
    return true; // Always try to reconnect
  },
});

// Redis connection'ı başlat
redisCache.connect().catch(err => {
  logger.error('❌ Redis cache connection failed:', err);
});

// --- ADIM 1: SDL Dosyalarını Yükleme ---
// Projedeki tüm .graphql dosyalarını bul ve yükle
const typesArray = loadFilesSync(path.join(__dirname, 'schemas/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);
// 'typeDefs' artık tüm şemalarınızı içeren BÜYÜK bir string (veya AST) içerir.
// --- Bitti ---

// Executable schema oluştur
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// GraphQL Yoga instance'ı oluştur
const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  plugins: [
    // Response caching - aynı query'ler cache'den dönecek
    useResponseCache({
      // Session-based cache key (user'a göre)
      session: (request) => {
        // GraphQL operation name'i kontrol et
        const body = request?.request?.body;
        let operationName = '';

        if (body && typeof body === 'object' && 'operationName' in body) {
          operationName = String(body.operationName || '');
        }

        // Public queries: Tüm kullanıcılar için aynı cache
        const publicQueries = [
          'Alliances',
          'Corporations',
          'Characters',
          'Killmails',
          'KillmailDetails',
          'AllianceDetails',
          'CorporationDetails',
          'CharacterDetails',
          'Regions',
          'Systems',
          'Types',
        ];

        if (publicQueries.includes(operationName)) {
          return 'public'; // Tüm kullanıcılar aynı cache'i paylaşır
        }

        // User-specific queries: Her kullanıcı kendi cache'ini kullanır
        const auth = request?.request?.headers?.get('authorization') || request?.request?.headers?.get('Authorization');
        if (typeof auth === 'string') {
          return auth.slice(7, 15); // Token'ın ilk 8 karakteri
        }

        return 'anonymous';
      },
      // Cache süresi (ms)
      ttl: 60_000, // 1 dakika
      // Cache'lenebilir query'ler
      includeExtensionMetadata: true,
      // Redis cache storage
      cache: {
        get: async (key) => {
          try {
            const value = await redisCache.get(key);
            return value ? JSON.parse(value) : null;
          } catch (e) {
            logger.error('Cache get error:', e);
            return null;
          }
        },
        set: async (key, value, ttl) => {
          try {
            // TTL can come as various types from useResponseCache plugin
            // Sometimes it's a Map Iterator, number, or undefined
            let ttlValue = 60000; // Default: 60 seconds in milliseconds

            if (ttl !== undefined && ttl !== null) {
              // If it's a Map Iterator or object, try to extract first value
              if (typeof ttl === 'object' && Symbol.iterator in Object(ttl)) {
                const iterator = ttl[Symbol.iterator]();
                const first = iterator.next();
                if (!first.done && typeof first.value === 'number') {
                  ttlValue = first.value;
                }
              } else if (typeof ttl === 'number') {
                ttlValue = ttl;
              }
            }

            // Convert to seconds
            const ttlInSeconds = Math.ceil(ttlValue / 1000);

            // Sanity check
            if (isNaN(ttlInSeconds) || ttlInSeconds <= 0 || ttlInSeconds > 3600) {
              logger.warn(`Invalid TTL value: ${ttlInSeconds}s, using default 60s`);
              await redisCache.setex(key, 60, JSON.stringify(value));
              return;
            }

            await redisCache.setex(key, ttlInSeconds, JSON.stringify(value));
          } catch (e) {
            logger.error('Cache set error:', e);
          }
        },
        invalidate: async (entities) => {
          try {
            // Invalidate cache entries based on entities
            // For now, we'll implement a simple pattern-based invalidation
            for (const entity of entities) {
              const pattern = `*${entity.typename}:${entity.id}*`;
              const keys = await redisCache.keys(pattern);
              if (keys.length > 0) {
                await redisCache.del(...keys);
              }
            }
          } catch (e) {
            logger.error('Cache invalidate error:', e);
          }
        },
      },
      // Mutation'ları cache'leme
      shouldCacheResult: ({ result }) => {
        // Hata varsa cache'leme
        if (result.errors && result.errors.length > 0) {
          return false;
        }
        return true;
      },
    }),
  ],
  graphiql: {
    subscriptionsProtocol: 'SSE', // Server-Sent Events için GraphiQL subscription desteği
  },
  context: async ({ request }) => {
    // Her request için yeni DataLoader instance'ları oluştur
    const dataLoaders = createDataLoaders();

    const authorization = request.headers.get('authorization');

    // Bearer token varsa doğrula
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      logger.debug('🔑 Token received, length:', token.length);
      try {
        const character = await verifyToken(token);
        logger.debug('✅ Token verified for character:', character.characterName);
        return {
          user: character,
          token, // ESI API çağrıları için token'ı da context'e ekle
          ...dataLoaders, // DataLoader'ları context'e ekle
        };
      } catch (error) {
        logger.error('❌ Token verification failed:', error);
        // Token geçersiz ama request devam etsin
      }
    }

    logger.debug('⚠️  No token provided');
    return {
      ...dataLoaders, // Token olmasa da DataLoader'lar kullanılabilir
    };
  },
});// HTTP sunucusunu oluştur
const server = createServer(async (req, res) => {
  // CORS headers ekle
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Eve SSO Callback endpoint
  if (req.url?.startsWith('/auth/callback')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing code or state parameter' }));
      return;
    }

    try {
      // Authorization code'u token ile değiştir
      const tokenData = await exchangeCodeForToken(code);

      // Verify token and get character info
      const character = await verifyToken(tokenData.access_token);

      // Calculate token expiry time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Find or create user in database using Prisma
      const user = await prisma.user.upsert({
        where: { character_id: character.characterId },
        update: {
          character_name: character.characterName,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        },
        create: {
          character_id: character.characterId,
          character_name: character.characterName,
          character_owner_hash: character.characterOwnerHash,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        },
      });

      // Redirect to frontend (with token)
      const redirectUrl = `${config.eveSso.frontendUrl}/auth/success?token=${encodeURIComponent(tokenData.access_token)}&refresh_token=${encodeURIComponent(tokenData.refresh_token || '')}&expires_in=${tokenData.expires_in}&character_name=${encodeURIComponent(character.characterName)}&character_id=${character.characterId}`;

      res.writeHead(302, {
        'Location': redirectUrl,
      });
      res.end();
    } catch (error) {
      logger.error('Callback error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
    return;
  }

  // GraphQL endpoint için Yoga'yı kullan
  return yoga(req, res);
});

const port = config.app.port;

// Check Redis PubSub configuration
const USE_REDIS = process.env.USE_REDIS_PUBSUB === 'true';

server.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}/graphql`);
  logger.info(`Auth callback available at http://localhost:${port}/auth/callback`);
  logger.info(`Health check available at http://localhost:${port}/health`);
  logger.info(`GraphQL subscriptions ready via ${USE_REDIS ? `Redis PubSub (${REDIS_URL})` : 'In-memory (single instance only)'}`);
  logger.info(`💾 Response cache enabled (TTL: 60s, Redis storage)`);
  logger.info('To start workers independently:');
  logger.info('  yarn worker:redisq         # RedisQ stream worker');
  logger.info('  yarn worker:user-killmails # User killmail sync worker');

  // Start background cron job for user killmail syncing
  userKillmailCron.start().catch((error) => {
    logger.error('Failed to start user killmail cron', { error });
  });
});
