import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import { createPubSub } from 'graphql-yoga';
import Redis from 'ioredis';

// PubSub event types
export type PubSubChannels = {
    'NEW_KILLMAIL': [{ killmailId: number }];
};

// Check if Redis is available for distributed PubSub
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS = process.env.USE_REDIS_PUBSUB === 'true';

let pubsub: ReturnType<typeof createPubSub<PubSubChannels>>;
let redisPublishClient: Redis | null = null;
let redisSubscribeClient: Redis | null = null;

// Create PubSub instance with proper error handling
if (USE_REDIS) {
    console.log('📡 PubSub: Initializing Redis (distributed mode)');
    console.log(`   Redis URL: ${REDIS_URL.replace(/:[^:]*@/, ':****@')}`); // Hide password in logs

    try {
        // Create Redis clients with explicit error handlers
        redisPublishClient = new Redis(REDIS_URL, {
            lazyConnect: false, // Connect immediately
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000, // 10 seconds
        });

        redisSubscribeClient = new Redis(REDIS_URL, {
            lazyConnect: false,
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000,
        });

        // Log connection events for publish client
        redisPublishClient.on('connect', () => {
            console.log('✅ Redis Publish Client: Connected');
        });

        redisPublishClient.on('ready', () => {
            console.log('✅ Redis Publish Client: Ready');
        });

        redisPublishClient.on('error', (err) => {
            console.error('❌ Redis Publish Client Error:', err.message);
            console.error('   Connection details:', {
                url: REDIS_URL.replace(/:[^:]*@/, ':****@'),
                code: err.code,
                syscall: err.syscall,
            });
        });

        redisPublishClient.on('close', () => {
            console.warn('⚠️  Redis Publish Client: Connection closed');
        });

        redisPublishClient.on('reconnecting', (delay) => {
            console.log(`🔄 Redis Publish Client: Reconnecting in ${delay}ms...`);
        });

        // Log connection events for subscribe client
        redisSubscribeClient.on('connect', () => {
            console.log('✅ Redis Subscribe Client: Connected');
        });

        redisSubscribeClient.on('ready', () => {
            console.log('✅ Redis Subscribe Client: Ready');
        });

        redisSubscribeClient.on('error', (err) => {
            console.error('❌ Redis Subscribe Client Error:', err.message);
            console.error('   Connection details:', {
                url: REDIS_URL.replace(/:[^:]*@/, ':****@'),
                code: err.code,
                syscall: err.syscall,
            });
        });

        redisSubscribeClient.on('close', () => {
            console.warn('⚠️  Redis Subscribe Client: Connection closed');
        });

        redisSubscribeClient.on('reconnecting', (delay) => {
            console.log(`🔄 Redis Subscribe Client: Reconnecting in ${delay}ms...`);
        });

        // Create PubSub with Redis event target
        pubsub = createPubSub<PubSubChannels>({
            eventTarget: createRedisEventTarget({
                publishClient: redisPublishClient,
                subscribeClient: redisSubscribeClient,
            })
        });

        console.log('✅ PubSub: Redis-based PubSub initialized successfully');

        // Verify connection by pinging
        setTimeout(async () => {
            try {
                const pingResult = await redisPublishClient!.ping();
                console.log('✅ Redis Health Check: PING response:', pingResult);
            } catch (error: any) {
                console.error('❌ Redis Health Check Failed:', error.message);
                console.error('   This will cause real-time updates to fail!');
                console.error('   Please verify REDIS_URL in .env and ensure Redis is running');
            }
        }, 1000);

    } catch (error: any) {
        console.error('❌ Failed to initialize Redis PubSub:', error.message);
        console.error('   Falling back to in-memory PubSub (single process only)');
        console.error('   Real-time updates will NOT work across multiple processes!');
        
        // Fallback to in-memory
        pubsub = createPubSub<PubSubChannels>();
    }
} else {
    console.log('📡 PubSub: In-memory mode (single process only)');
    console.log('   Set USE_REDIS_PUBSUB=true to enable distributed PubSub');
    pubsub = createPubSub<PubSubChannels>();
}

export { pubsub };

// Export function to check Redis connection status
export function isRedisConnected(): boolean {
    if (!USE_REDIS || !redisPublishClient || !redisSubscribeClient) {
        return false;
    }
    return redisPublishClient.status === 'ready' && redisSubscribeClient.status === 'ready';
}

// Export function to get Redis connection status details
export function getRedisStatus() {
    return {
        enabled: USE_REDIS,
        publishClient: redisPublishClient?.status || 'not-initialized',
        subscribeClient: redisSubscribeClient?.status || 'not-initialized',
        connected: isRedisConnected(),
        url: REDIS_URL.replace(/:[^:]*@/, ':****@'),
    };
}
