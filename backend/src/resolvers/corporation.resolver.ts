import { Corporation, CorporationConnection, CorporationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';
import redis from '../services/redis';

/**
 * Corporation Query Resolvers
 * Handles fetching corporation data and listing corporations with filters
 */
export const corporationQueries: QueryResolvers = {
  corporation: async (_, { id }): Promise<Corporation | null> => {
    const cacheKey = `corporation:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const corp = await prisma.corporation.findUnique({
      where: { id: Number(id) },
    });

    if (!corp) return null;

    // Field resolver'lar eksik field'ları otomatik doldurur
    const result = {
      ...corp,
      date_founded: corp.date_founded?.toISOString() || null,
      // BigInt'i String'e dönüştür (JSON.stringify BigInt'i serialize edemez)
      shares: corp.shares ? corp.shares.toString() : null,
    } as any;

    // Cache for 30 minutes (corporation info updates occasionally)
    await redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  },

  corporations: async (_, { filter }): Promise<CorporationConnection> => {
    const page = filter?.page || 1;
    const limit = filter?.limit || 25;
    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: any = {
      // Filter out NPC corporations (player corporations have ID >= 2000000)
      id: { gte: 2000000 }
    };

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { ticker: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter?.name) {
      where.name = { contains: filter.name, mode: 'insensitive' };
    }

    if (filter?.ticker) {
      where.ticker = { contains: filter.ticker, mode: 'insensitive' };
    }

    if (filter?.allianceId) {
      where.alliance_id = filter.allianceId;
    }

    if (filter?.dateFoundedFrom || filter?.dateFoundedTo) {
      where.date_founded = {};
      if (filter?.dateFoundedFrom) {
        where.date_founded.gte = new Date(filter.dateFoundedFrom);
      }
      if (filter?.dateFoundedTo) {
        where.date_founded.lte = new Date(filter.dateFoundedTo);
      }
    }

    // Build orderBy clause
    let orderBy: any = { member_count: 'desc' }; // Default ordering

    if (filter?.orderBy) {
      switch (filter.orderBy) {
        case 'nameAsc':
          orderBy = { name: 'asc' };
          break;
        case 'nameDesc':
          orderBy = { name: 'desc' };
          break;
        case 'memberCountAsc':
          orderBy = { member_count: 'asc' };
          break;
        case 'memberCountDesc':
          orderBy = { member_count: 'desc' };
          break;
      }
    }

    const [corporations, totalCount] = await Promise.all([
      prisma.corporation.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      prisma.corporation.count({ where }),
    ]);

    const edges = corporations.map((corp: any) => ({
      node: {
        ...corp,
        date_founded: corp.date_founded?.toISOString() || null,
        // BigInt'i String'e dönüştür (JSON.stringify BigInt'i serialize edemez)
        shares: corp.shares ? corp.shares.toString() : null,
      } as any, // Field resolver'lar eksik field'ları otomatik doldurur
      cursor: Buffer.from(`${corp.id}`).toString('base64'),
    }));

    const totalPages = Math.ceil(totalCount / limit);

    const pageInfo: PageInfo = {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      currentPage: page,
      totalPages,
      totalCount,
    };

    return {
      edges,
      pageInfo,
    };
  },
};

/**
 * Corporation Field Resolvers
 * Handles nested fields and computed properties for Corporation type
 * Uses DataLoaders to prevent N+1 queries
 */
export const corporationFieldResolvers: CorporationResolvers = {
  alliance: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaCorp = parent as any;
    if (!prismaCorp.alliance_id) return null;

    // DataLoader kullan - otomatik batch yapacak
    const alliance = await context.loaders.alliance.load(prismaCorp.alliance_id);

    if (!alliance) return null;

    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
      corporations: [], // Circular reference'ı önlemek için boş array
    };
  },

  ceo: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaCorp = parent as any;
    // DataLoader kullan - otomatik batch yapacak
    const character = await context.loaders.character.load(prismaCorp.ceo_id);

    if (!character) return null;

    return {
      ...character,
      birthday: character.birthday.toISOString(),
    } as any;
  },

  creator: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaCorp = parent as any;
    // DataLoader kullan - otomatik batch yapacak
    const character = await context.loaders.character.load(prismaCorp.creator_id);

    if (!character) return null;

    return {
      ...character,
      birthday: character.birthday.toISOString(),
    } as any;
  },

  metrics: async (parent, _args, context) => {
    const now = new Date();
    const date1d = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Mevcut member count değerini al
    const currentMemberCount = parent.member_count;

    // Use DataLoader to batch snapshot queries
    const [snapshot1d, snapshot7d, snapshot30d] = await Promise.all([
      context.loaders.corporationSnapshot.load({ corporationId: parent.id, date: date1d }),
      context.loaders.corporationSnapshot.load({ corporationId: parent.id, date: date7d }),
      context.loaders.corporationSnapshot.load({ corporationId: parent.id, date: date30d }),
    ]);

    // Delta hesaplamaları
    const memberCountDelta1d = snapshot1d
      ? currentMemberCount - snapshot1d.member_count
      : null;
    const memberCountDelta7d = snapshot7d
      ? currentMemberCount - snapshot7d.member_count
      : null;
    const memberCountDelta30d = snapshot30d
      ? currentMemberCount - snapshot30d.member_count
      : null;

    // Growth rate hesaplamaları (yüzde)
    const memberCountGrowthRate1d = snapshot1d && snapshot1d.member_count > 0
      ? ((currentMemberCount - snapshot1d.member_count) / snapshot1d.member_count) * 100
      : null;
    const memberCountGrowthRate7d = snapshot7d && snapshot7d.member_count > 0
      ? ((currentMemberCount - snapshot7d.member_count) / snapshot7d.member_count) * 100
      : null;
    const memberCountGrowthRate30d = snapshot30d && snapshot30d.member_count > 0
      ? ((currentMemberCount - snapshot30d.member_count) / snapshot30d.member_count) * 100
      : null;

    return {
      memberCountDelta1d,
      memberCountDelta7d,
      memberCountDelta30d,
      memberCountGrowthRate1d,
      memberCountGrowthRate7d,
      memberCountGrowthRate30d,
    };
  },

  snapshots: async (parent, args) => {
    const days = args.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.corporationSnapshot.findMany({
      where: {
        corporation_id: parent.id,
        snapshot_date: { gte: since },
      },
      orderBy: { snapshot_date: 'asc' },
    });

    return snapshots.map(s => ({
      date: s.snapshot_date.toISOString().split('T')[0], // YYYY-MM-DD formatında
      memberCount: s.member_count,
    }));
  },
};
