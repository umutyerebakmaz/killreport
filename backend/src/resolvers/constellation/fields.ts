import { ConstellationResolvers, SecurityStats } from '@generated-types';

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
 * Constellation Field Resolvers
 * Handles nested fields and computed properties for Constellation
 * Uses DataLoaders to prevent N+1 queries
 */
export const constellationFields: ConstellationResolvers = {
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
