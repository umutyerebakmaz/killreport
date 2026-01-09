import { CorporationResolvers } from '@generated-types';
import prisma from '@services/prisma';

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
};
