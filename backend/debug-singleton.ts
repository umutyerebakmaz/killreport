import { calculateKillmailValues } from './src/helpers/calculate-killmail-values';
import prisma from './src/services/prisma';

async function test() {
    const km = await prisma.killmail.findUnique({
        where: { killmail_id: 133900250 },
        include: {
            victim: { select: { ship_type_id: true } },
            items: { select: { item_type_id: true, quantity_destroyed: true, quantity_dropped: true, singleton: true } }
        }
    });

    if (!km || !km.victim) { console.log('not found'); return; }

    console.log('DB total_value:', km.total_value);

    const v = await calculateKillmailValues({
        victim: km.victim,
        items: km.items.map(i => ({
            item_type_id: i.item_type_id,
            quantity_destroyed: i.quantity_destroyed ?? undefined,
            quantity_dropped: i.quantity_dropped ?? undefined,
            singleton: i.singleton
        }))
    });

    console.log('Newly calculated total:', v.totalValue);
    console.log('Newly calculated destroyed:', v.destroyedValue);
    console.log('Newly calculated dropped:', v.droppedValue);
    console.log('Diff (new - old):', v.totalValue - (Number(km.total_value) || 0));

    await prisma.$disconnect();
}

test().catch(console.error);
