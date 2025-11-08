#!/usr/bin/env node
/**
 * Alliance Snapshot Worker
 *
 * Bu worker her gün çalıştırılmalı (cron job ile) ve tüm alliance'ların
 * o günkü member_count ve corporation_count değerlerini snapshot olarak kaydeder.
 *
 * Çalıştırma:
 *   yarn snapshot:alliances
 *
 * Cron örneği (her gün gece yarısı):
 *   0 0 * * * cd /root/killreport/backend && yarn snapshot:alliances
 */

import prisma from '../services/prisma';

async function takeAllianceSnapshots() {
  console.log('📸 Alliance Snapshot Worker başlatıldı...');

  const startTime = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Günün başlangıcı

  try {
    // Tüm alliance'ları al
    const alliances = await prisma.alliance.findMany({
      select: { id: true },
    });

    console.log(`✓ ${alliances.length} alliance bulundu`);

    let processed = 0;
    let created = 0;
    let skipped = 0;

    for (const alliance of alliances) {
      // Bu alliance için bugünün snapshot'ı var mı kontrol et
      const existingSnapshot = await prisma.allianceSnapshot.findUnique({
        where: {
          alliance_id_snapshot_date: {
            alliance_id: alliance.id,
            snapshot_date: today,
          },
        },
      });

      if (existingSnapshot) {
        skipped++;
        processed++;
        continue;
      }

      // Mevcut değerleri hesapla
      const corporationCount = await prisma.corporation.count({
        where: { alliance_id: alliance.id },
      });

      const memberResult = await prisma.corporation.aggregate({
        where: { alliance_id: alliance.id },
        _sum: {
          member_count: true,
        },
      });

      const memberCount = memberResult._sum.member_count || 0;

      // Snapshot oluştur
      await prisma.allianceSnapshot.create({
        data: {
          alliance_id: alliance.id,
          member_count: memberCount,
          corporation_count: corporationCount,
          snapshot_date: today,
        },
      });

      created++;
      processed++;

      // Her 50 alliance'da bir progress göster
      if (processed % 50 === 0) {
        console.log(`  ⏳ İşlenen: ${processed}/${alliances.length} (${created} yeni, ${skipped} mevcut)`);
      }
    }

    const endTime = new Date();
    const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

    console.log(`✅ Snapshot alma tamamlandı!`);
    console.log(`   • Toplam işlenen: ${processed}`);
    console.log(`   • Yeni snapshot: ${created}`);
    console.log(`   • Zaten mevcut: ${skipped}`);
    console.log(`   • Süre: ${duration} saniye`);
    console.log(`   • Tarih: ${today.toISOString().split('T')[0]}`);

  } catch (error) {
    console.error('❌ Snapshot alma hatası:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}// Worker'ı başlat
takeAllianceSnapshots()
  .then(() => {
    console.log('👋 Worker sonlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Worker hatası:', error);
    process.exit(1);
  });
