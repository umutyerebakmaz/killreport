import { CACHE_TTL } from '@config/cache';
import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';
import { executeKillmailsDateCountsQuery, executeKillmailsQuery } from './query';

/**
 * Killmail Query Resolvers
 * Handles fetching killmail data and listing killmails with filters
 */
export const killmailQueries: QueryResolvers = {
  killmail: async (_, { id }) => {
    const cacheKey = `killmail:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const killmail = await prisma.killmail.findUnique({
      where: { killmail_id: Number(id) },
    });

    if (!killmail) return null;

    // Field resolvers will handle victim, attackers, items via DataLoaders
    const result = {
      id: killmail.killmail_id.toString(),
      killmailHash: killmail.killmail_hash,
      killmailTime: killmail.killmail_time.toISOString(),
      solarSystemId: killmail.solar_system_id,
      createdAt: killmail.created_at.toISOString(),
      // Include cached values from database for performance
      totalValue: (killmail as any).total_value,
      destroyedValue: (killmail as any).destroyed_value,
      droppedValue: (killmail as any).dropped_value,
    } as any;

    // Cache using centralized config (90 days - killmails never change)
    const cacheDurationSeconds = Math.floor(CACHE_TTL.KILLMAIL_DETAIL / 1000);
    await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));
    return result;
  },

  killmails: async (_, args) => {
    return executeKillmailsQuery(args.filter);
  },

  killmailsDateCounts: async (_, args) => {
    return executeKillmailsDateCountsQuery(args.filter);
  },

};
