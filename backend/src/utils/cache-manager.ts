import logger from '../services/logger';
import redis from '../services/redis-cache';

/**
 * Cache Manager Utility
 *
 * Provides helper functions for managing GraphQL response cache and entity cache
 */

export class CacheManager {
    /**
     * Clear all cache keys matching a pattern
     */
    static async clearPattern(pattern: string): Promise<number> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length === 0) {
                logger.info(`No keys found matching pattern: ${pattern}`);
                return 0;
            }

            const deleted = await redis.del(...keys);
            logger.info(`Deleted ${deleted} cache keys matching pattern: ${pattern}`);
            return deleted;
        } catch (error) {
            logger.error(`Error clearing cache pattern ${pattern}:`, error);
            throw error;
        }
    }

    /**
     * Clear cache for a specific killmail
     */
    static async clearKillmail(killmailId: number): Promise<void> {
        await Promise.all([
            redis.del(`killmail:detail:${killmailId}`),
            this.clearPattern(`response-cache:*:Killmail:*`),
            this.clearPattern(`response-cache:*:Killmails:*`),
            this.clearPattern(`killmails:list:*`), // Clear killmails list cache
            this.clearPattern(`killmails:dateCounts:*`), // Clear date counts cache
        ]);
        logger.info(`Cleared cache for killmail ${killmailId}`);
    }

    /**
     * Clear cache for a specific character
     */
    static async clearCharacter(characterId: number): Promise<void> {
        await Promise.all([
            redis.del(`character:detail:${characterId}`),
            this.clearPattern(`response-cache:*:Character:*`),
            this.clearPattern(`response-cache:*:Characters:*`),
        ]);
        logger.info(`Cleared cache for character ${characterId}`);
    }

    /**
     * Clear cache for a specific corporation
     */
    static async clearCorporation(corporationId: number): Promise<void> {
        await Promise.all([
            redis.del(`corporation:detail:${corporationId}`),
            this.clearPattern(`response-cache:*:Corporation:*`),
            this.clearPattern(`response-cache:*:Corporations:*`),
        ]);
        logger.info(`Cleared cache for corporation ${corporationId}`);
    }

    /**
     * Clear cache for a specific alliance
     */
    static async clearAlliance(allianceId: number): Promise<void> {
        await Promise.all([
            redis.del(`alliance:detail:${allianceId}`),
            this.clearPattern(`response-cache:*:Alliance:*`),
            this.clearPattern(`response-cache:*:Alliances:*`),
        ]);
        logger.info(`Cleared cache for alliance ${allianceId}`);
    }

    /**
     * Clear all killmail caches (useful after large data updates)
     */
    static async clearAllKillmails(): Promise<void> {
        await Promise.all([
            this.clearPattern('killmail:detail:*'),
            this.clearPattern('killmails:list:*'), // Clear killmails list cache
            this.clearPattern('killmails:dateCounts:*'), // Clear date counts cache
            this.clearPattern('response-cache:*:Killmail*'),
        ]);
        logger.info('Cleared all killmail caches');
    }

    /**
     * Get cache statistics
     */
    static async getStats(): Promise<{
        totalKeys: number;
        killmailDetailKeys: number;
        characterDetailKeys: number;
        corporationDetailKeys: number;
        allianceDetailKeys: number;
        responseCacheKeys: number;
    }> {
        const [
            allKeys,
            killmailKeys,
            characterKeys,
            corporationKeys,
            allianceKeys,
            responseCacheKeys,
        ] = await Promise.all([
            redis.keys('*'),
            redis.keys('killmail:detail:*'),
            redis.keys('character:detail:*'),
            redis.keys('corporation:detail:*'),
            redis.keys('alliance:detail:*'),
            redis.keys('response-cache:*'),
        ]);

        return {
            totalKeys: allKeys.length,
            killmailDetailKeys: killmailKeys.length,
            characterDetailKeys: characterKeys.length,
            corporationDetailKeys: corporationKeys.length,
            allianceDetailKeys: allianceKeys.length,
            responseCacheKeys: responseCacheKeys.length,
        };
    }

    /**
     * Warm up cache with most accessed entities
     * Useful after cache flush or server restart
     */
    static async warmupCache(limit: number = 100): Promise<void> {
        logger.info(`Starting cache warmup for top ${limit} entities...`);

        // This would need to be implemented with actual queries
        // For now, just log the intent
        logger.info('Cache warmup would populate most-accessed killmails, characters, corps, alliances');
    }

    /**
     * Check if cache is healthy (Redis is responding)
     */
    static async healthCheck(): Promise<boolean> {
        try {
            await redis.ping();
            return true;
        } catch (error) {
            logger.error('Cache health check failed:', error);
            return false;
        }
    }

    /**
     * Get memory usage from Redis INFO command
     */
    static async getMemoryUsage(): Promise<string> {
        try {
            const info = await redis.info('memory');
            const lines = info.split('\r\n');
            const usedMemory = lines.find(line => line.startsWith('used_memory_human:'));
            return usedMemory ? usedMemory.split(':')[1] : 'unknown';
        } catch (error) {
            logger.error('Error getting memory usage:', error);
            return 'error';
        }
    }

    /**
     * Get comprehensive Redis metrics
     */
    static async getRedisMetrics(): Promise<{
        connected: boolean;
        memoryUsage: string;
        totalKeys: number;
        connectedClients: number;
        totalCommandsProcessed: number;
        commandsPerSecond: number;
        uptimeInSeconds: number;
    }> {
        try {
            const [memoryInfo, serverInfo, clientsInfo, statsInfo] = await Promise.all([
                redis.info('memory'),
                redis.info('server'),
                redis.info('clients'),
                redis.info('stats'),
            ]);

            // Parse memory usage
            const memoryLines = memoryInfo.split('\r\n');
            const usedMemoryLine = memoryLines.find(line => line.startsWith('used_memory_human:'));
            const memoryUsage = usedMemoryLine ? usedMemoryLine.split(':')[1] : 'unknown';

            // Parse uptime
            const serverLines = serverInfo.split('\r\n');
            const uptimeLine = serverLines.find(line => line.startsWith('uptime_in_seconds:'));
            const uptimeInSeconds = uptimeLine ? parseInt(uptimeLine.split(':')[1]) : 0;

            // Parse connected clients
            const clientsLines = clientsInfo.split('\r\n');
            const connectedClientsLine = clientsLines.find(line => line.startsWith('connected_clients:'));
            const connectedClients = connectedClientsLine ? parseInt(connectedClientsLine.split(':')[1]) : 0;

            // Parse stats
            const statsLines = statsInfo.split('\r\n');
            const totalCommandsLine = statsLines.find(line => line.startsWith('total_commands_processed:'));
            const totalCommandsProcessed = totalCommandsLine ? parseInt(totalCommandsLine.split(':')[1]) : 0;

            const commandsPerSecLine = statsLines.find(line => line.startsWith('instantaneous_ops_per_sec:'));
            const commandsPerSecond = commandsPerSecLine ? parseInt(commandsPerSecLine.split(':')[1]) : 0;

            // Count total keys
            const totalKeys = await redis.dbsize();

            return {
                connected: true,
                memoryUsage,
                totalKeys,
                connectedClients,
                totalCommandsProcessed,
                commandsPerSecond,
                uptimeInSeconds,
            };
        } catch (error) {
            logger.error('Error getting Redis metrics:', error);
            return {
                connected: false,
                memoryUsage: 'error',
                totalKeys: 0,
                connectedClients: 0,
                totalCommandsProcessed: 0,
                commandsPerSecond: 0,
                uptimeInSeconds: 0,
            };
        }
    }
}

export default CacheManager;
