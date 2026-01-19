import prisma from './src/services/prisma';

async function checkStructureFuel() {
  try {
    // Check flag 133 directly
    const flag133Items = await prisma.killmailItem.findMany({
      where: { flag: 133 },
      take: 10,
      orderBy: { killmail_id: 'desc' }
    });

    console.log('📊 Flag 133 (Structure Fuel) items in database:', flag133Items.length);

    if (flag133Items.length > 0) {
      console.log('\n✅ Found Structure Fuel items:');
      flag133Items.forEach(item => {
        console.log(`  KM ${item.killmail_id}: Type ${item.item_type_id}, Destroyed: ${item.quantity_destroyed}, Dropped: ${item.quantity_dropped}`);
      });
    } else {
      console.log('\n❌ No items with flag 133 found in database');

      // Show what flags we DO have
      const flagCounts = await prisma.killmailItem.groupBy({
        by: ['flag'],
        _count: true,
        orderBy: { _count: { flag: 'desc' } },
        take: 20
      });

      console.log('\n📊 Top 20 flags in database:');
      flagCounts.forEach(({ flag, _count }) => {
        console.log(`  Flag ${flag}: ${_count} items`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStructureFuel();
