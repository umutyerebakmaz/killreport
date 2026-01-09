import { ConstellationResolvers, MutationResolvers, PageInfo, QueryResolvers, SecurityStats } from '@generated-types';
import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';
import axios from 'axios';

/**
 * calculateSecurityStats - Solar system'ların güvenlik durumlarını analiz eder
 *
 * EVE Online'da her solar system'ın bir security_status değeri vardır:
 * - High Sec (Yüksek Güvenlik): 0.5 ile 1.0 arası - CONCORD koruması tam
 * - Low Sec (Düşük Güvenlik): 0.1 ile 0.4 arası - CONCORD koruması zayıf
 * - Null Sec (Sıfır Güvenlik): 0.0 ve altı - CONCORD koruması yok
 * - Wormhole (Solucan Deliği): security_status = null - Bilinmeyen uzay
 *
 * Bu fonksiyon bir constellation veya region'daki tüm solar system'ları
 * analiz ederek her güvenlik kategorisindeki sistem sayısını ve
 * ortalama güvenlik değerini hesaplar.
 *
 * @param solarSystems - Analiz edilecek solar system listesi
 * @returns SecurityStats objesi: highSec, lowSec, nullSec, wormhole sayıları ve avgSecurity
 */
async function calculateSecurityStats(solarSystems: { security_status: number | null }[]): Promise<SecurityStats> {
  // Her güvenlik kategorisi için sayaçlar
  let highSec = 0;   // High security sistem sayısı (>= 0.5)
  let lowSec = 0;    // Low security sistem sayısı (0.1 - 0.4)
  let nullSec = 0;   // Null security sistem sayısı (<= 0.0)
  let wormhole = 0;  // Wormhole sistem sayısı (security_status = null)

  // Ortalama güvenlik hesaplaması için değişkenler
  let totalSecurity = 0;     // Tüm geçerli security değerlerinin toplamı
  let validSecurityCount = 0; // Geçerli security değeri olan sistem sayısı

  // Her solar system için güvenlik durumunu kontrol et
  for (const system of solarSystems) {
    const sec = system.security_status;

    // Wormhole sistemleri: security_status null ise wormhole'dur
    // Wormhole'lar ortalama hesaplamasına dahil edilmez
    if (sec === null) {
      wormhole++;
      continue; // Sonraki sisteme geç
    }

    // Ortalama hesaplaması için toplama ekle
    totalSecurity += sec;
    validSecurityCount++;

    // Güvenlik kategorisini belirle
    if (sec >= 0.5) {
      // High Sec: 0.5 ve üzeri - Empire space, CONCORD aktif
      highSec++;
    } else if (sec > 0.0) {
      // Low Sec: 0.1 - 0.4 arası - Düşük güvenlik bölgesi
      lowSec++;
    } else {
      // Null Sec: 0.0 ve altı - Yasasız bölge, sovereignty mümkün
      nullSec++;
    }
  }

  return {
    highSec,
    lowSec,
    nullSec,
    wormhole,
    // Ortalama güvenlik: Sadece geçerli security değerleri için hesaplanır
    // Hiç geçerli sistem yoksa (hepsi wormhole ise) null döner
    avgSecurity: validSecurityCount > 0 ? totalSecurity / validSecurityCount : null,
  };
}

/**
 * Constellation Query Resolvers
 * Handles fetching constellation data and listing constellations with filters
 */
export const constellationQueries: QueryResolvers = {
  constellation: async (_, { id }) => {
    const constellation = await prisma.constellation.findUnique({
      where: { id: Number(id) },
    });
    return constellation as any;
  },

  constellations: async (_, { filter }) => {
    const take = filter?.limit ?? 25;
    const currentPage = filter?.page ?? 1;
    const skip = (currentPage - 1) * take;

    // Filter koşullarını oluştur
    const where: any = {};
    if (filter) {
      if (filter.search) {
        where.name = { contains: filter.search, mode: 'insensitive' };
      }
      if (filter.name) {
        where.name = { contains: filter.name, mode: 'insensitive' };
      }
      if (filter.region_id) {
        where.region_id = filter.region_id;
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.constellation.count({ where });
    const totalPages = Math.ceil(totalCount / take);

    // OrderBy logic
    let orderBy: any = { name: 'asc' }; // default
    if (filter?.orderBy) {
      switch (filter.orderBy) {
        case 'nameAsc':
          orderBy = { name: 'asc' };
          break;
        case 'nameDesc':
          orderBy = { name: 'desc' };
          break;
        default:
          orderBy = { name: 'asc' };
      }
    }

    // Fetch data
    const constellations = await prisma.constellation.findMany({
      where,
      skip,
      take,
      orderBy,
    });

    const pageInfo: PageInfo = {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };

    return {
      edges: constellations.map((c: any, index: number) => ({
        node: c,
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};

/**
 * Constellation Mutation Resolvers
 * Handles operations that modify constellation data
 */
export const constellationMutations: MutationResolvers = {
  startConstellationSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting constellation sync via GraphQL...');

      // Get all constellation IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/universe/constellations/');
      const constellationIds: number[] = response.data;

      logger.info(`✓ Found ${constellationIds.length} constellations`);
      logger.info(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_constellations_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      let publishedCount = 0;
      for (const id of constellationIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;
      }

      logger.info(`✅ All ${constellationIds.length} constellations queued successfully!`);
      return {
        success: true,
        message: `${constellationIds.length} constellations queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      logger.error('❌ Error starting constellation sync:', error);
      return {
        success: false,
        message: 'Failed to start constellation sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};

/**
 * Constellation Field Resolvers
 * Handles nested fields and computed properties for Constellation
 * Uses DataLoaders to prevent N+1 queries
 */
export const constellationFieldResolvers: ConstellationResolvers = {
  position: (parent) => {
    // parent is from Prisma, has position_x, position_y, position_z
    const prismaParent = parent as any;
    if (prismaParent.position_x === null || prismaParent.position_y === null || prismaParent.position_z === null) {
      return null;
    }
    return {
      x: prismaParent.position_x,
      y: prismaParent.position_y,
      z: prismaParent.position_z,
    };
  },
  region: async (parent: any, _: any, context: any) => {
    const prismaParent = parent as any;
    if (!prismaParent.region_id) return null;
    return context.loaders.region.load(prismaParent.region_id);
  },
  solarSystems: async (parent: any, _: any, context: any) => {
    if (!parent.id) return [];
    return context.loaders.solarSystemsByConstellation.load(parent.id);
  },
  solarSystemCount: async (parent, _, context) => {
    if (!parent.id) return 0;
    // DataLoader kullan - N+1 yok!
    const systems = await context.loaders.solarSystemsByConstellation.load(parent.id);
    return systems.length;
  },
  securityStats: async (parent, _, context) => {
    if (!parent.id) return { highSec: 0, lowSec: 0, nullSec: 0, wormhole: 0, avgSecurity: null };
    // DataLoader kullan - N+1 yok!
    const solarSystems = await context.loaders.solarSystemsByConstellation.load(parent.id);
    return calculateSecurityStats(solarSystems);
  },
};
