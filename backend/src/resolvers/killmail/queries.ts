import { CACHE_TTL } from '@config/cache';
import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';
import { filtersMaterialized } from './filters-materialized';

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
            select: {
                killmail_id: true,
                killmail_hash: true,
                killmail_time: true,
                solar_system_id: true,
                created_at: true,
                total_value: true,
                destroyed_value: true,
                dropped_value: true,
                attacker_count: true,
                is_war_related: true,
            }
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
            totalValue: killmail.total_value,
            destroyedValue: killmail.destroyed_value,
            droppedValue: killmail.dropped_value,
            attackerCount: killmail.attacker_count ?? 0,
            isWarRelated: killmail.is_war_related,
        } as any;

        // Cache using centralized config (90 days - killmails never change)
        const cacheDurationSeconds = Math.floor(CACHE_TTL.KILLMAIL_DETAIL / 1000);
        await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));
        return result;
    },

    killmails: async (_, args) => {
        const page = args.filter?.page ?? 1;
        const limit = Math.min(args.filter?.limit ?? 25, 100); // Max 100 per page
        const orderBy = args.filter?.orderBy ?? 'timeDesc';

        const skip = (page - 1) * limit;

        // Create cache key based on all filter parameters
        const cacheKey = `killmails:list:${JSON.stringify({
            ...args.filter,
            page,
            limit,
            orderBy,
        })}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            console.log('✅ Cache hit for killmails query');
            return JSON.parse(cached);
        }

        // Determine filter strategy: Use killmail_filters pre-computed table for optimized queries
        const hasKillmailFiltersCompatibleFilter =
            args.filter?.shipTypeId ||
            args.filter?.shipGroupIds?.length ||
            args.filter?.characterId ||
            args.filter?.corporationId ||
            args.filter?.allianceId ||
            args.filter?.regionId ||
            args.filter?.constellationId ||
            args.filter?.systemId ||
            args.filter?.securitySpace ||
            args.filter?.minAttackers ||
            args.filter?.maxAttackers;

        if (hasKillmailFiltersCompatibleFilter) {
            // Use killmail_filters pre-computed table for faster queries
            const killmailIds = await filtersMaterialized(args.filter ?? {});

            if (killmailIds.length === 0) {
                // Early exit - no results
                const emptyResult = {
                    items: [],
                    pageInfo: {
                        hasNextPage: false,
                        hasPreviousPage: false,
                        currentPage: page,
                        totalPages: 0,
                        totalCount: 0,
                    },
                };

                const ttl = page <= 3 ? CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES : CACHE_TTL.KILLMAIL_LIST;
                const cacheDurationSeconds = Math.floor(ttl / 1000);
                await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(emptyResult));

                return emptyResult;
            }

            // Build optional value filter conditions (total_value not in killmail_filters)
            // Two variants with different param indices:
            //   countWhereClause: $1=ids, $2=minValue, $3=maxValue
            //   mainWhereClause:  $1=ids, $2=limit, $3=skip, $4=minValue, $5=maxValue
            const valueParams: number[] = [];

            const countValueConditions: string[] = [];
            let countParamIdx = 2; // $1=ids

            const mainValueConditions: string[] = [];
            let mainParamIdx = 4; // $1=ids, $2=limit, $3=skip

            if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
                countValueConditions.push(`total_value >= $${countParamIdx++}`);
                mainValueConditions.push(`total_value >= $${mainParamIdx++}`);
                valueParams.push(args.filter.minValue);
            }
            if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
                countValueConditions.push(`total_value <= $${countParamIdx++}`);
                mainValueConditions.push(`total_value <= $${mainParamIdx++}`);
                valueParams.push(args.filter.maxValue);
            }
            // War-related is a hardcoded boolean literal (not user text), so it needs
            // no bind param and does not disturb the $N positional counters above.
            const warRelated = args.filter?.warRelated === true;
            if (warRelated) {
                countValueConditions.push(`is_war_related = true`);
                mainValueConditions.push(`is_war_related = true`);
            }
            const countWhereClause = countValueConditions.length > 0 ? ` AND ${countValueConditions.join(' AND ')}` : '';
            const mainWhereClause = mainValueConditions.length > 0 ? ` AND ${mainValueConditions.join(' AND ')}` : '';

            // Date filters, applied to BOTH the count and the main query so totalCount
            // matches the rows actually returned. Count params: $1=ids, value params,
            // then date params. Main params: $1=ids, $2=limit, $3=skip, value params,
            // then date params. countParamIdx / mainParamIdx were advanced by the value
            // conditions above, so date conditions continue from there.
            const countDateConditions: string[] = [];
            const mainDateConditions: string[] = [];
            const dateParams: Date[] = [];

            if (args.filter?.startDate) {
                countDateConditions.push(`killmail_time >= $${countParamIdx++}`);
                mainDateConditions.push(`killmail_time >= $${mainParamIdx++}`);
                dateParams.push(new Date(args.filter.startDate));
            }
            if (args.filter?.endDate) {
                countDateConditions.push(`killmail_time <= $${countParamIdx++}`);
                mainDateConditions.push(`killmail_time <= $${mainParamIdx++}`);
                dateParams.push(new Date(args.filter.endDate));
            }
            const countDateWhereClause = countDateConditions.length > 0 ? ` AND ${countDateConditions.join(' AND ')}` : '';
            const mainDateWhereClause = mainDateConditions.length > 0 ? ` AND ${mainDateConditions.join(' AND ')}` : '';

            // Count against the killmails table directly whenever a value/war/date filter
            // narrows the set below the raw killmailIds list; otherwise the id count is exact.
            let totalCount: number;
            if (valueParams.length > 0 || warRelated || dateParams.length > 0) {
                const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
                    `SELECT COUNT(*) as count FROM killmails WHERE killmail_id = ANY($1::int[])${countWhereClause}${countDateWhereClause}`,
                    killmailIds,
                    ...valueParams,
                    ...dateParams
                );
                totalCount = Number(countResult[0].count);
            } else {
                // Use the length of killmailIds as total count to avoid extra query
                totalCount = killmailIds.length;
            }

            // For large result sets, use raw SQL with array to avoid parameter limit
            // PostgreSQL can handle large arrays efficiently with ANY()
            const orderByClause = orderBy === 'timeAsc' ? 'killmail_time ASC'
                : orderBy === 'timeDesc' ? 'killmail_time DESC'
                    : orderBy === 'valueAsc' ? 'total_value ASC NULLS LAST'
                        : 'total_value DESC NULLS LAST'; // valueDesc

            const killmails = await prisma.$queryRawUnsafe<Array<{
                killmail_id: number;
                killmail_hash: string;
                killmail_time: Date;
                solar_system_id: number;
                created_at: Date;
                total_value: bigint | null;
                destroyed_value: bigint | null;
                dropped_value: bigint | null;
                attacker_count: number | null;
                is_war_related: boolean;
            }>>(
                `SELECT
          killmail_id,
          killmail_hash,
          killmail_time,
          solar_system_id,
          created_at,
          total_value,
          destroyed_value,
          dropped_value,
          attacker_count,
          is_war_related
        FROM killmails
        WHERE killmail_id = ANY($1::int[])${mainWhereClause}${mainDateWhereClause}
        ORDER BY ${orderByClause}
        LIMIT $2
        OFFSET $3`,
                killmailIds,
                limit,
                skip,
                ...valueParams,
                ...dateParams
            );

            const totalPages = Math.ceil(totalCount / limit);

            // Map to GraphQL response format
            const items = killmails.map((km) => ({
                id: km.killmail_id.toString(),
                killmail_id: km.killmail_id,
                killmailHash: km.killmail_hash,
                killmailTime: km.killmail_time.toISOString(),
                solarSystemId: km.solar_system_id,
                createdAt: km.created_at.toISOString(),
                totalValue: km.total_value ? km.total_value.toString() : null,
                destroyedValue: km.destroyed_value ? km.destroyed_value.toString() : null,
                droppedValue: km.dropped_value ? km.dropped_value.toString() : null,
                attackerCount: km.attacker_count ?? 0,
                isWarRelated: km.is_war_related,
            })) as any[];

            const result = {
                items,
                pageInfo: {
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    currentPage: page,
                    totalPages,
                    totalCount,
                },
            };

            // Cache with appropriate TTL
            const ttl = page <= 3 ? CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES : CACHE_TTL.KILLMAIL_LIST;
            const cacheDurationSeconds = Math.floor(ttl / 1000);
            await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));

            return result;
        } else {
            // Only for value-only filters or no filters at all
            const where: any = {};

            if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
                where.total_value = {
                    ...where.total_value,
                    gte: args.filter.minValue,
                };
            }

            if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
                where.total_value = {
                    ...where.total_value,
                    lte: args.filter.maxValue,
                };
            }

            // Add date filters
            if (args.filter?.startDate || args.filter?.endDate) {
                where.killmail_time = {};
                if (args.filter?.startDate) {
                    where.killmail_time.gte = new Date(args.filter.startDate);
                }
                if (args.filter?.endDate) {
                    where.killmail_time.lte = new Date(args.filter.endDate);
                }
            }

            // War-related filter (correlated to an active sov campaign)
            if (args.filter?.warRelated) {
                where.is_war_related = true;
            }

            // Count total matching records
            const totalCount = await prisma.killmail.count({ where });

            const totalPages = Math.ceil(totalCount / limit);

            // Determine orderBy clause
            const prismaOrderBy = orderBy === 'timeAsc' ? { killmail_time: 'asc' as const }
                : orderBy === 'timeDesc' ? { killmail_time: 'desc' as const }
                    : orderBy === 'valueAsc' ? { total_value: 'asc' as const }
                        : { total_value: 'desc' as const }; // valueDesc

            // Fetch killmails - field resolvers will handle relations via DataLoaders
            const killmails = await prisma.killmail.findMany({
                where,
                skip,
                take: limit,
                orderBy: prismaOrderBy,
                select: {
                    killmail_id: true,
                    killmail_hash: true,
                    killmail_time: true,
                    solar_system_id: true,
                    created_at: true,
                    total_value: true,
                    destroyed_value: true,
                    dropped_value: true,
                    attacker_count: true,
                    is_war_related: true,
                }
            });

            // Map to GraphQL response format
            const items = killmails.map((km) => ({
                id: km.killmail_id.toString(),
                killmail_id: km.killmail_id,
                killmailHash: km.killmail_hash,
                killmailTime: km.killmail_time.toISOString(),
                solarSystemId: km.solar_system_id,
                createdAt: km.created_at.toISOString(),
                // Include cached values from database for performance
                totalValue: km.total_value,
                destroyedValue: km.destroyed_value,
                droppedValue: km.dropped_value,
                attackerCount: km.attacker_count ?? 0,
                isWarRelated: km.is_war_related,
            })) as any[];

            const result = {
                items,
                pageInfo: {
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    currentPage: page,
                    totalPages,
                    totalCount,
                },
            };

            // Cache the result - use shorter TTL for first 3 pages (most frequently accessed)
            const ttl = page <= 3 ? CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES : CACHE_TTL.KILLMAIL_LIST;
            const cacheDurationSeconds = Math.floor(ttl / 1000);
            await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));

            return result;
        }
    },

    killmailsDateCounts: async (_, args, context) => {
        // Create cache key based on filter parameters
        const cacheKey = `killmails:dateCounts:${JSON.stringify(args.filter ?? {})}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            console.log('✅ Cache hit for killmailsDateCounts query');
            return JSON.parse(cached);
        }

        const warRelated = args.filter?.warRelated === true;

        // Determine filter strategy
        const hasKillmailFiltersCompatibleFilter =
            args.filter?.shipTypeId ||
            args.filter?.shipGroupIds?.length ||
            args.filter?.characterId ||
            args.filter?.corporationId ||
            args.filter?.allianceId ||
            args.filter?.regionId ||
            args.filter?.constellationId ||
            args.filter?.systemId ||
            args.filter?.minAttackers ||
            args.filter?.maxAttackers;

        let result: { date: string; count: number }[];

        if (hasKillmailFiltersCompatibleFilter) {
            // Use killmail_filters pre-computed table for entity filters
            const killmailIds = await filtersMaterialized(args.filter ?? {});

            if (killmailIds.length === 0) {
                // Early exit - no results
                result = [];
            } else {
                // Pre-filter IDs by value and/or war-related if those filters are present
                let filteredIds = killmailIds;
                const hasValueFilter =
                    (args.filter?.minValue !== undefined && args.filter?.minValue !== null) ||
                    (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null);
                if (hasValueFilter || warRelated) {
                    const vConds: string[] = [];
                    const vParams: any[] = [killmailIds];
                    let vIdx = 2;
                    if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
                        vConds.push(`total_value >= $${vIdx}`);
                        vParams.push(args.filter.minValue);
                        vIdx++;
                    }
                    if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
                        vConds.push(`total_value <= $${vIdx}`);
                        vParams.push(args.filter.maxValue);
                    }
                    if (warRelated) {
                        vConds.push(`is_war_related = true`);
                    }
                    const filtered = await prisma.$queryRawUnsafe<Array<{ killmail_id: number }>>(
                        `SELECT killmail_id FROM killmails WHERE killmail_id = ANY($1) AND ${vConds.join(' AND ')}`,
                        ...vParams
                    );
                    filteredIds = filtered.map(r => r.killmail_id);
                }

                // Query by IDs (much faster than JOINs)
                const rawCounts = await prisma.$queryRawUnsafe<Array<{ date: Date; count: bigint }>>(
                    `SELECT
            DATE(killmail_time) as date,
            COUNT(*)::bigint as count
          FROM killmails
          WHERE killmail_id = ANY($1::int[])
          GROUP BY DATE(killmail_time)
          ORDER BY date DESC`,
                    filteredIds
                );

                result = rawCounts.map(item => ({
                    date: new Date(item.date).toISOString().split('T')[0],
                    count: Number(item.count),
                }));
            }
        } else if (!args.filter || Object.keys(args.filter).length === 0) {
            // No filters - use raw SQL for best performance
            const rawResult = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT
          DATE(killmail_time) as date,
          COUNT(*)::bigint as count
        FROM killmails
        GROUP BY DATE(killmail_time)
        ORDER BY date DESC
      `;

            result = rawResult.map(row => ({
                date: row.date.toISOString().split('T')[0],
                count: Number(row.count),
            }));
        } else {
            // Value-only filters (no entity/location/attacker filters)
            const where: any = {};

            if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
                where.total_value = {
                    ...where.total_value,
                    gte: args.filter.minValue,
                };
            }

            if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
                where.total_value = {
                    ...where.total_value,
                    lte: args.filter.maxValue,
                };
            }

            if (warRelated) {
                where.is_war_related = true;
            }

            // Fetch only killmail_time for date grouping
            const killmails = await prisma.killmail.findMany({
                where,
                select: { killmail_time: true },
                orderBy: { killmail_time: 'desc' },
            });

            // Group by date
            const dateCounts = new Map<string, number>();
            for (const km of killmails) {
                const date = km.killmail_time.toISOString().split('T')[0]; // YYYY-MM-DD
                dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
            }

            // Convert to array
            result = Array.from(dateCounts.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
        }

        // Cache the result (1 minute - frequently changes with new killmails)
        const cacheDurationSeconds = Math.floor(CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES / 1000);
        await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));

        return result;
    },

};

