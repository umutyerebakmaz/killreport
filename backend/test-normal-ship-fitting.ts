/**
 * Test normal ships (non-Strategic Cruiser) to verify they still work
 */

import './src/config';
import prisma from './src/services/prisma';

async function testNormalShips() {
  console.log('🔍 Testing non-Strategic Cruiser ships...\n');

  // Get a few normal ship killmails (NOT Strategic Cruisers)
  const normalKillmails = await prisma.killmail.findMany({
    where: {
      victim: {
        ship_type_id: {
          notIn: [29984, 29986, 29988, 29990], // Not Strategic Cruisers
        },
      },
    },
    include: {
      victim: true,
      items: true,
    },
    take: 5,
    orderBy: {
      killmail_time: 'desc',
    },
  });

  console.log(`Found ${normalKillmails.length} normal ship killmails\n`);

  for (const km of normalKillmails) {
    const shipTypeId = km.victim?.ship_type_id;

    // Check dogma attributes
    const dogmaAttributes = await prisma.typeDogmaAttribute.findMany({
      where: {
        type_id: shipTypeId,
        attribute_id: {
          in: [12, 13, 14, 1137],
        },
      },
    });

    const hiSlots = dogmaAttributes.find(a => a.attribute_id === 14)?.value ?? 8;
    const medSlots = dogmaAttributes.find(a => a.attribute_id === 13)?.value ?? 8;
    const lowSlots = dogmaAttributes.find(a => a.attribute_id === 12)?.value ?? 8;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Killmail: ${km.killmail_id}`);
    console.log(`Ship Type ID: ${shipTypeId}`);
    console.log(`Total Items: ${km.items.length}`);
    console.log(`\nDogma Slot Counts:`);
    console.log(`  hiSlots: ${hiSlots}`);
    console.log(`  medSlots: ${medSlots}`);
    console.log(`  lowSlots: ${lowSlots}`);

    // Count actual fitted items
    const highItems = km.items.filter(i => i.flag >= 27 && i.flag <= 34).length;
    const midItems = km.items.filter(i => i.flag >= 19 && i.flag <= 26).length;
    const lowItems = km.items.filter(i => i.flag >= 11 && i.flag <= 18).length;

    console.log(`\nActual Fitted Modules:`);
    console.log(`  High: ${highItems}`);
    console.log(`  Mid: ${midItems}`);
    console.log(`  Low: ${lowItems}`);

    // Check if slot counts make sense
    const issues = [];
    if (hiSlots === 0 && highItems > 0) {
      issues.push(`⚠️  hiSlots is 0 but has ${highItems} fitted modules`);
    }
    if (medSlots === 0 && midItems > 0) {
      issues.push(`⚠️  medSlots is 0 but has ${midItems} fitted modules`);
    }
    if (lowSlots === 0 && lowItems > 0) {
      issues.push(`⚠️  lowSlots is 0 but has ${lowItems} fitted modules`);
    }

    if (issues.length > 0) {
      console.log(`\n⚠️  ISSUES DETECTED:`);
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log(`\n✅ Slot counts look correct`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

testNormalShips().catch(console.error);
