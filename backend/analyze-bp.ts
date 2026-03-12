import prisma from './src/services/prisma';

async function analyze() {
    const killmailId = 133900250;

    const km = await prisma.killmail.findUnique({
        where: { killmail_id: killmailId },
        include: {
            victim: { select: { ship_type_id: true } },
            items: {
                select: {
                    item_type_id: true,
                    quantity_destroyed: true,
                    quantity_dropped: true,
                    singleton: true
                }
            }
        }
    });

    if (!km || !km.victim) {
        console.log('Killmail not found');
        process.exit(1);
    }

    console.log(`\n🔍 Analyzing Killmail ${killmailId}\n`);

    // Find blueprint items
    let totalBPOValue = 0;
    let totalBPCValue = 0;
    let bpoCount = 0;
    let bpcCount = 0;

    for (const item of km.items) {
        const type = await prisma.type.findUnique({
            where: { id: item.item_type_id }
        });

        if (!type) continue;

        const group = await prisma.itemGroup.findUnique({
            where: { id: type.group_id }
        });

        if (!group) continue;

        const category = await prisma.category.findUnique({
            where: { id: group.category_id }
        });

        if (category?.name?.toLowerCase() === 'blueprint') {
            const marketPrice = await prisma.marketPrice.findUnique({
                where: { type_id: item.item_type_id }
            });

            const qty = (item.quantity_destroyed || 0) + (item.quantity_dropped || 0);
            const price = marketPrice?.sell || 0;

            if (item.singleton === 1) {
                // BPO
                bpoCount++;
                totalBPOValue += price * qty;
                console.log(`📘 BPO: ${type.name}`);
                console.log(`   Singleton: ${item.singleton} | Qty: ${qty} | Price: ${price.toLocaleString()} | Total: ${(price * qty).toLocaleString()}`);
            } else {
                // BPC
                bpcCount++;
                totalBPCValue += price * qty; // Currently wrong calculation
                console.log(`📕 BPC: ${type.name}`);
                console.log(`   Singleton: ${item.singleton} | Qty: ${qty} | Market: ${price.toLocaleString()} | Should be: 0.01 | Wrong total: ${(price * qty).toLocaleString()}`);
            }
        }
    }

    console.log(`\n📊 Blueprint Summary:`);
    console.log(`   BPO Count: ${bpoCount} | Total Value: ${totalBPOValue.toLocaleString()}`);
    console.log(`   BPC Count: ${bpcCount} | Wrong Value: ${totalBPCValue.toLocaleString()} | Should be: ${(bpcCount * 0.01).toFixed(2)}`);
    console.log(`\n⚠️  Over-valuation: ${totalBPCValue.toLocaleString()} ISK`);

    await prisma.$disconnect();
}

analyze().catch(console.error);
