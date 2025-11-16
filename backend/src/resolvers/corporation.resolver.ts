import { Corporation, CorporationConnection, CorporationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';

export const corporationQueries: QueryResolvers = {
    corporation: async (_, { id }): Promise<Corporation | null> => {
        const corp = await prisma.corporation.findUnique({
            where: { id: Number(id) },
        });

        if (!corp) return null;

        return {
            ...corp,
            date_founded: corp.date_founded?.toISOString() || null,
            alliance: null, // Field resolver handles this
        };
    },

    corporations: async (_, { filter }): Promise<CorporationConnection> => {
        const page = filter?.page || 1;
        const limit = filter?.limit || 25;
        const skip = (page - 1) * limit;

        // Build where clause for filters
        const where: any = {};

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

        const [corporations, totalCount] = await Promise.all([
            prisma.corporation.findMany({
                where,
                take: limit,
                skip,
                orderBy: { member_count: 'desc' },
            }),
            prisma.corporation.count({ where }),
        ]);

        const edges = corporations.map((corp: any) => ({
            node: {
                ...corp,
                date_founded: corp.date_founded?.toISOString() || null,
                alliance: null, // Field resolver handles this
            },
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
 * Field Resolvers - Nested fields için lazy loading + DataLoader
 * Alliance bilgisi sadece query'de istenirse çekilir
 * DataLoader ile batch loading - N+1 problem çözümü
 */
export const corporationFieldResolvers: CorporationResolvers = {
    alliance: async (parent, _args, context) => {
        if (!parent.alliance_id) return null;

        // DataLoader kullan - otomatik batch yapacak
        const alliance = await context.loaders.alliance.load(parent.alliance_id);

        if (!alliance) return null;

        return {
            ...alliance,
            date_founded: alliance.date_founded.toISOString(),
            corporations: [], // Circular reference'ı önlemek için boş array
        };
    },

    metrics: async (parent) => {
        const now = new Date();
        const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Mevcut member count değerini al
        const currentMemberCount = parent.member_count;

        // 7 gün önceki snapshot
        const snapshot7d = await prisma.corporationSnapshot.findFirst({
            where: {
                corporation_id: parent.id,
                snapshot_date: { lte: date7d },
            },
            orderBy: { snapshot_date: 'desc' },
        });

        // 30 gün önceki snapshot
        const snapshot30d = await prisma.corporationSnapshot.findFirst({
            where: {
                corporation_id: parent.id,
                snapshot_date: { lte: date30d },
            },
            orderBy: { snapshot_date: 'desc' },
        });

        // Delta hesaplamaları
        const memberCountDelta7d = snapshot7d
            ? currentMemberCount - snapshot7d.member_count
            : null;
        const memberCountDelta30d = snapshot30d
            ? currentMemberCount - snapshot30d.member_count
            : null;

        // Growth rate hesaplamaları (yüzde)
        const memberCountGrowthRate7d = snapshot7d && snapshot7d.member_count > 0
            ? ((currentMemberCount - snapshot7d.member_count) / snapshot7d.member_count) * 100
            : null;
        const memberCountGrowthRate30d = snapshot30d && snapshot30d.member_count > 0
            ? ((currentMemberCount - snapshot30d.member_count) / snapshot30d.member_count) * 100
            : null;

        return {
            memberCountDelta7d,
            memberCountDelta30d,
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
