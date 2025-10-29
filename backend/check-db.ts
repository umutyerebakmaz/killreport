import axios from 'axios';
import './src/config';
import prisma from './src/services/prisma';

async function checkDatabase() {
  try {
    // Total count
    const totalCount = await prisma.alliance.count();
    console.log('📊 Number of alliances in database:', totalCount);

    // First and last IDs
    const firstAlliance = await prisma.alliance.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true }
    });
    const lastAlliance = await prisma.alliance.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    console.log('🔢 First ID:', firstAlliance?.id ?? 'N/A');
    console.log('🔢 Last ID:', lastAlliance?.id ?? 'N/A');

    // Last 10 added alliances
    const latest = await prisma.alliance.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { id: true, name: true, created_at: true }
    });
    console.log('\n📋 Last 10 added alliances:');
    latest.forEach((row: any, idx: number) => {
      console.log(`  ${idx + 1}. ${row.id}: ${row.name}`);
    });

    // First 10 added alliances
    const earliest = await prisma.alliance.findMany({
      orderBy: { created_at: 'asc' },
      take: 10,
      select: { id: true, name: true, created_at: true }
    });
    console.log('\n📋 First 10 added alliances:');
    earliest.forEach((row: any, idx: number) => {
      console.log(`  ${idx + 1}. ${row.id}: ${row.name}`);
    });

    // Get current count from ESI
    console.log('\n🌐 Checking ESI API...');
    const esiResponse = await axios.get('https://esi.evetech.net/latest/alliances/');
    const esiCount = esiResponse.data.length;
    console.log('📊 Number of alliances in ESI:', esiCount);

    console.log('\n' + '='.repeat(50));
    if (totalCount === esiCount) {
      console.log('✅ RESULT: All alliances are in the database!');
    } else {
      console.log('⚠️  RESULT: Missing records!');
      console.log(`   Database: ${totalCount}`);
      console.log(`   ESI: ${esiCount}`);
      console.log(`   Difference: ${esiCount - totalCount}`);
    }
    console.log('='.repeat(50));

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Hata:', error);
    await prisma.$disconnect();
  }
}

checkDatabase();
