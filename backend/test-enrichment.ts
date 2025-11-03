/**
 * Test enrichment service
 * Tests the enrichment function with a killmail ID
 */

import './src/config.js';
import { enrichKillmail } from './src/services/enrichment.js';
import prisma from './src/services/prisma.js';

async function testEnrichment() {
  try {
    // En son eklenen killmail'i bul
    const latestKillmail = await prisma.killmail.findFirst({
      orderBy: { created_at: 'desc' },
      select: { killmail_id: true },
    });

    if (!latestKillmail) {
      console.log('❌ No killmails found in database');
      return;
    }

    console.log(`🧪 Testing enrichment for killmail ${latestKillmail.killmail_id}...\n`);

    const result = await enrichKillmail(latestKillmail.killmail_id);

    console.log('\n📊 Enrichment Results:');
    console.log('━'.repeat(50));
    console.log(`✅ Characters added: ${result.charactersAdded}`);
    console.log(`✅ Corporations added: ${result.corporationsAdded}`);
    console.log(`✅ Alliances added: ${result.alliancesAdded}`);
    console.log(`✅ Types added: ${result.typesAdded}`);
    console.log(`❌ Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Error Details:');
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }

    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEnrichment();
