import prismaWorker from './src/services/prisma-worker.js';
import { isCharge } from './src/utils/item-classifier.js';

async function main() {
  const items = await prismaWorker.killmailItem.findMany({
    where: { killmail_id: 132445660 },
    orderBy: { flag: 'asc' }
  });

  console.log('Total items:', items.length);
  console.log('\nChecking flag 27 items:');
  
  const flag27Items = items.filter(i => i.flag === 27);
  
  for (const item of flag27Items) {
    const type = await prismaWorker.type.findUnique({
      where: { id: item.item_type_id }
    });
    
    const group = type?.group_id ? await prismaWorker.itemGroup.findUnique({
      where: { id: type.group_id }
    }) : null;
    
    console.log(`\nType ID: ${item.item_type_id}`);
    console.log(`  Name: ${type?.name}`);
    console.log(`  Group ID: ${type?.group_id}`);
    console.log(`  Group Name: ${group?.name}`);
    console.log(`  Is Charge: ${isCharge(type?.group_id)}`);
    console.log(`  Qty: ${item.quantity_dropped || item.quantity_destroyed}`);
  }

  await prismaWorker.$disconnect();
}

main().catch(console.error);
