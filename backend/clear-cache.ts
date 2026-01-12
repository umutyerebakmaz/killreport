/**
 * Clear all Redis cache
 */
import redis from './src/services/redis';

async function clearCache() {
    try {
        console.log('🗑️  Clearing Redis cache...');

        // Get all keys to see what we're clearing
        const keys = await redis.keys('*');
        console.log(`Found ${keys.length} keys in cache`);

        if (keys.length > 0) {
            console.log('Sample keys:', keys.slice(0, 10));
        }

        // Clear all cache
        await redis.flushdb();

        console.log('✅ Cache cleared successfully!');

        // Disconnect
        await redis.quit();
    } catch (error) {
        console.error('❌ Error clearing cache:', error);
        process.exit(1);
    }
}

clearCache();
