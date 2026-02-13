import { KillmailFilter } from "@generated-types";
import prisma from '@services/prisma';

interface RequiredJoins {
  needVictims: boolean;
  needAttackers: boolean;
}

/**
 * Determine which tables need to be joined based on filters
 */
function getRequiredJoins(filter: KillmailFilter): RequiredJoins {
  const hasFilter = (value: any): boolean => value !== undefined && value !== null;

  // If no filters, only need victims table
  if (!filter || Object.values(filter).every(v => !hasFilter(v))) {
    return { needVictims: true, needAttackers: false };
  }

  // These filters need either victims OR attackers
  const needsEntityFilter =
    hasFilter(filter.shipTypeId) ||
    hasFilter(filter.characterId) ||
    hasFilter(filter.corporationId) ||
    hasFilter(filter.allianceId);

  // Attacker count filters REQUIRE attackers table
  const needsAttackerCount =
    hasFilter(filter.minAttackers) ||
    hasFilter(filter.maxAttackers);

  return {
    needVictims: true, // Always needed for victim data
    needAttackers: needsEntityFilter || needsAttackerCount,
  };
}

/**
 * Build the base query structure for killmails with dynamic joins
 * @param selectClause - The SELECT part of the query
 * @param whereClause - The WHERE clause (including WHERE keyword)
 * @param groupByClause - The GROUP BY clause (including GROUP BY keyword)
 * @param havingClause - The HAVING clause (including HAVING keyword)
 * @param additionalClauses - Optional additional clauses (ORDER BY, LIMIT, OFFSET, etc.)
 * @param needAttackers - Whether to include attackers JOIN
 */
function buildKillmailQuery(
  selectClause: string,
  whereClause: string,
  groupByClause: string,
  havingClause: string,
  additionalClauses: string = '',
  needAttackers: boolean = true
): string {
  const joinClause = `
    LEFT JOIN victims v ON k.killmail_id = v.killmail_id
    ${needAttackers ? 'LEFT JOIN attackers a ON k.killmail_id = a.killmail_id' : ''}
  `.trim();

  return `
    ${selectClause}
    FROM killmails k
    ${joinClause}
    ${whereClause}
    ${groupByClause}
    ${havingClause}
    ${additionalClauses}
  `.trim();
}

/**
 * Build SQL WHERE clause fragments for raw SQL queries
 * Uses JOIN-based filtering instead of EXISTS subqueries for better performance
 */
export function buildSqlWhereClause(filter: KillmailFilter, hasAttackersJoin: boolean): {
  conditions: string[];
  params: any[];
} {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Ship type filter
  if (filter.shipTypeId) {
    if (hasAttackersJoin) {
      conditions.push(`(v.ship_type_id = $${paramIndex} OR a.ship_type_id = $${paramIndex})`);
    } else {
      conditions.push(`v.ship_type_id = $${paramIndex}`);
    }
    params.push(filter.shipTypeId);
    paramIndex++;
  }

  // Character filter
  if (filter.characterId) {
    if (hasAttackersJoin) {
      conditions.push(`(v.character_id = $${paramIndex} OR a.character_id = $${paramIndex})`);
    } else {
      conditions.push(`v.character_id = $${paramIndex}`);
    }
    params.push(filter.characterId);
    paramIndex++;
  }

  // Corporation filter
  if (filter.corporationId) {
    if (hasAttackersJoin) {
      conditions.push(`(v.corporation_id = $${paramIndex} OR a.corporation_id = $${paramIndex})`);
    } else {
      conditions.push(`v.corporation_id = $${paramIndex}`);
    }
    params.push(filter.corporationId);
    paramIndex++;
  }

  // Alliance filter
  if (filter.allianceId) {
    if (hasAttackersJoin) {
      conditions.push(`(v.alliance_id = $${paramIndex} OR a.alliance_id = $${paramIndex})`);
    } else {
      conditions.push(`v.alliance_id = $${paramIndex}`);
    }
    params.push(filter.allianceId);
    paramIndex++;
  }

  return { conditions, params };
}

/**
 * Build HAVING clause for attacker count filtering
 */
export function buildAttackerCountHaving(filter: KillmailFilter): string {
  const havingConditions: string[] = [];

  if (filter.minAttackers !== undefined && filter.minAttackers !== null) {
    havingConditions.push(`COUNT(*) >= ${filter.minAttackers}`);
  }

  if (filter.maxAttackers !== undefined && filter.maxAttackers !== null) {
    havingConditions.push(`COUNT(*) <= ${filter.maxAttackers}`);
  }

  return havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';
}

/**
 * Execute killmails query with filters and pagination
 */
export async function executeKillmailsQuery(filter: KillmailFilter | null | undefined) {
  const page = filter?.page ?? 1;
  const limit = Math.min(filter?.limit ?? 25, 100); // Max 100 per page
  const orderBy = filter?.orderBy ?? 'timeDesc';
  const skip = (page - 1) * limit;

  const { needAttackers } = getRequiredJoins(filter ?? {});
  const { conditions, params } = buildSqlWhereClause(filter ?? {}, needAttackers);
  const hasAttackerCountFilter = (filter?.minAttackers !== undefined && filter?.minAttackers !== null) ||
    (filter?.maxAttackers !== undefined && filter?.maxAttackers !== null);

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const orderDirection = orderBy === 'timeAsc' ? 'ASC' : 'DESC';

  // If we have attacker count filters, we need GROUP BY + HAVING
  if (hasAttackerCountFilter && needAttackers) {
    const havingClause = buildAttackerCountHaving(filter ?? {});

    // Count with GROUP BY (slower but necessary for HAVING)
    const countQuery = buildKillmailQuery(
      'SELECT COUNT(DISTINCT k.killmail_id)::int as count',
      whereClause,
      'GROUP BY k.killmail_id',
      havingClause,
      '',
      needAttackers
    );

    const countResult = await prisma.$queryRawUnsafe<{ count: number }[]>(countQuery, ...params);
    const totalCount = countResult.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Data query with GROUP BY
    const dataQuery = buildKillmailQuery(
      `SELECT
        k.killmail_id,
        k.killmail_hash,
        k.killmail_time,
        k.solar_system_id,
        k.created_at,
        k.total_value,
        k.destroyed_value,
        k.dropped_value`,
      whereClause,
      'GROUP BY k.killmail_id, k.killmail_hash, k.killmail_time, k.solar_system_id, k.created_at, k.total_value, k.destroyed_value, k.dropped_value',
      havingClause,
      `ORDER BY k.killmail_time ${orderDirection}
      LIMIT ${limit} OFFSET ${skip}`,
      needAttackers
    );

    const killmails = await prisma.$queryRawUnsafe<any[]>(dataQuery, ...params);

    // Map to GraphQL response format
    const items = killmails.map((km) => ({
      id: km.killmail_id.toString(),
      killmail_id: km.killmail_id,
      killmailHash: km.killmail_hash,
      killmailTime: km.killmail_time.toISOString(),
      solarSystemId: km.solar_system_id,
      createdAt: km.created_at.toISOString(),
      totalValue: km.total_value,
      destroyedValue: km.destroyed_value,
      droppedValue: km.dropped_value,
    })) as any[];

    return {
      items,
      pageInfo: {
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        currentPage: page,
        totalPages,
        totalCount,
      },
    };
  }

  // Optimized path: No attacker count filters - use simple DISTINCT
  const countQuery = buildKillmailQuery(
    'SELECT COUNT(DISTINCT k.killmail_id)::int as count',
    whereClause,
    '',
    '',
    '',
    needAttackers
  );

  const countResult = await prisma.$queryRawUnsafe<{ count: number }[]>(countQuery, ...params);
  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Data query without GROUP BY - use DISTINCT instead
  const dataQuery = buildKillmailQuery(
    `SELECT DISTINCT ON (k.killmail_id)
      k.killmail_id,
      k.killmail_hash,
      k.killmail_time,
      k.solar_system_id,
      k.created_at,
      k.total_value,
      k.destroyed_value,
      k.dropped_value`,
    whereClause,
    '',
    '',
    `ORDER BY k.killmail_id, k.killmail_time ${orderDirection}
    LIMIT ${limit} OFFSET ${skip}`,
    needAttackers
  );

  const killmails = await prisma.$queryRawUnsafe<any[]>(dataQuery, ...params);

  // Map to GraphQL response format
  const items = killmails.map((km) => ({
    id: km.killmail_id.toString(),
    killmail_id: km.killmail_id,
    killmailHash: km.killmail_hash,
    killmailTime: km.killmail_time.toISOString(),
    solarSystemId: km.solar_system_id,
    createdAt: km.created_at.toISOString(),
    totalValue: km.total_value,
    destroyedValue: km.destroyed_value,
    droppedValue: km.dropped_value,
  })) as any[];

  return {
    items,
    pageInfo: {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      currentPage: page,
      totalPages,
      totalCount,
    },
  };
}

/**
 * Execute killmails date counts query with filters
 */
export async function executeKillmailsDateCountsQuery(filter: KillmailFilter | null | undefined) {
  const { needAttackers } = getRequiredJoins(filter ?? {});
  const { conditions, params } = buildSqlWhereClause(filter ?? {}, needAttackers);
  const hasAttackerCountFilter = (filter?.minAttackers !== undefined && filter?.minAttackers !== null) ||
    (filter?.maxAttackers !== undefined && filter?.maxAttackers !== null);

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // If attacker count filter exists, use GROUP BY approach
  if (hasAttackerCountFilter && needAttackers) {
    const havingClause = buildAttackerCountHaving(filter ?? {});
    const query = buildKillmailQuery(
      `SELECT
        DATE(k.killmail_time) as date,
        COUNT(DISTINCT k.killmail_id)::int as count`,
      whereClause,
      'GROUP BY DATE(k.killmail_time), k.killmail_id',
      havingClause,
      '',
      needAttackers
    );

    const subqueryResult = await prisma.$queryRawUnsafe<{ date: Date; count: number }[]>(query, ...params);

    // Group by date again (since we grouped by killmail_id first for HAVING)
    const dateCounts = new Map<string, number>();
    for (const row of subqueryResult) {
      const dateStr = row.date.toISOString().split('T')[0];
      dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
    }

    return Array.from(dateCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // Optimized path: No attacker count filter
  const query = buildKillmailQuery(
    `SELECT
      DATE(k.killmail_time) as date,
      COUNT(DISTINCT k.killmail_id)::int as count`,
    whereClause,
    'GROUP BY DATE(k.killmail_time)',
    '',
    'ORDER BY date DESC',
    needAttackers
  );

  const result = await prisma.$queryRawUnsafe<{ date: Date; count: number }[]>(query, ...params);

  return result.map(row => ({
    date: row.date.toISOString().split('T')[0],
    count: row.count
  }));
}
