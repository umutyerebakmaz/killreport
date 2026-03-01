import { CorporationResolvers } from '@generated-types';
import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';

/**
 * Returns a Prisma.Sql fragment for filtering killmail_time by TopTargetFilter enum.
 * Uses killmail_filters table with GIN indexes for fast queries.
 */
function timeFilter(filter: string | null | undefined): Prisma.Sql {
    switch (filter) {
        case 'LAST_90_DAYS': return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '90 days'`;
        case 'LAST_7_DAYS': return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '7 days'`;
        case 'TODAY': return Prisma.sql`AND DATE(kf.killmail_time) = CURRENT_DATE`;
        default: return Prisma.sql``; // ALL_TIME – no constraint
    }
}

/**
 * Corporation Field Resolvers
 * Handles nested fields and computed properties for Corporation type
 * Uses DataLoaders to prevent N+1 queries
 */
export const corporationFields: CorporationResolvers = {
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

    // Top 10 ship types this corporation killed most
    // Uses killmail_filters with GIN indexes - fast and simple
    topShipTargets: async (parent, args, context) => {
        const corporationId = (parent as any).id;
        const filter = timeFilter((args as any).filter);

        type ShipTopKillRow = {
            victim_ship_type_id: number;
            ship_name: string;
            kill_count: bigint;
        };

        const results = await prisma.$queryRaw<ShipTopKillRow[]>`
      SELECT
        kf.victim_ship_type_id,
        t.name AS ship_name,
        COUNT(*)::BIGINT AS kill_count
      FROM killmail_filters kf
      INNER JOIN types t ON t.id = kf.victim_ship_type_id
      WHERE ${corporationId} = ANY(kf.attacker_corporation_ids)
        AND kf.victim_ship_type_id IS NOT NULL
        ${filter}
      GROUP BY kf.victim_ship_type_id, t.name
      ORDER BY kill_count DESC
      LIMIT 10
    `;

        return results.map(row => ({
            killCount: Number(row.kill_count),
            shipType: {
                id: row.victim_ship_type_id,
                name: row.ship_name,
            } as any,
        }));
    },

    // Top 10 alliances this corporation killed most
    // Uses killmail_filters with GIN indexes - fast and simple
    topAllianceTargets: async (parent, args, context) => {
        const corporationId = (parent as any).id;
        const filter = timeFilter((args as any).filter);

        type AllianceTopTargetRow = {
            victim_alliance_id: number;
            alliance_name: string;
            alliance_ticker: string;
            kill_count: bigint;
        };

        const results = await prisma.$queryRaw<AllianceTopTargetRow[]>`
      SELECT
        kf.victim_alliance_id,
        a.name AS alliance_name,
        a.ticker AS alliance_ticker,
        COUNT(*)::BIGINT AS kill_count
      FROM killmail_filters kf
      INNER JOIN alliances a ON a.id = kf.victim_alliance_id
      WHERE ${corporationId} = ANY(kf.attacker_corporation_ids)
        AND kf.victim_alliance_id IS NOT NULL
        ${filter}
      GROUP BY kf.victim_alliance_id, a.name, a.ticker
      ORDER BY kill_count DESC
      LIMIT 10
    `;

        return results.map(row => ({
            killCount: Number(row.kill_count),
            alliance: {
                id: row.victim_alliance_id,
                name: row.alliance_name,
                ticker: row.alliance_ticker,
            } as any,
        }));
    },

    // Top 10 corporations this corporation killed most
    // Uses killmail_filters with GIN indexes - fast and simple
    topCorporationTargets: async (parent, args, context) => {
        const corporationId = (parent as any).id;
        const filter = timeFilter((args as any).filter);

        type CorporationTopTargetRow = {
            victim_corporation_id: number;
            corporation_name: string;
            corporation_ticker: string;
            kill_count: bigint;
        };

        const results = await prisma.$queryRaw<CorporationTopTargetRow[]>`
      SELECT
        kf.victim_corporation_id,
        co.name AS corporation_name,
        co.ticker AS corporation_ticker,
        COUNT(*)::BIGINT AS kill_count
      FROM killmail_filters kf
      INNER JOIN corporations co ON co.id = kf.victim_corporation_id
      WHERE ${corporationId} = ANY(kf.attacker_corporation_ids)
        AND kf.victim_corporation_id IS NOT NULL
        ${filter}
      GROUP BY kf.victim_corporation_id, co.name, co.ticker
      ORDER BY kill_count DESC
      LIMIT 10
    `;

        return results.map(row => ({
            killCount: Number(row.kill_count),
            corporation: {
                id: row.victim_corporation_id,
                name: row.corporation_name,
                ticker: row.corporation_ticker,
            } as any,
        }));
    },
};
