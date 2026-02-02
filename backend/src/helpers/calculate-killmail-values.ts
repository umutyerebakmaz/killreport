import prismaWorker from '../services/prisma-worker';

/**
 * Calculate totalValue, destroyedValue, droppedValue for a killmail
 * This is used during killmail insertion to cache values in database
 *
 * @param killmailData - The killmail data from ESI/zKillboard
 * @returns Object with totalValue, destroyedValue, droppedValue
 */
export async function calculateKillmailValues(killmailData: {
  victim: { ship_type_id: number };
  items?: Array<{
    item_type_id: number;
    quantity_destroyed?: number;
    quantity_dropped?: number;
  }>;
}): Promise<{
  totalValue: number;
  destroyedValue: number;
  droppedValue: number;
}> {
  const items = killmailData.items || [];

  // Collect all unique type IDs (ship + items)
  const allTypeIds = [
    killmailData.victim.ship_type_id,
    ...items.map(item => item.item_type_id)
  ];
  const uniqueTypeIds = [...new Set(allTypeIds)];

  // Fetch market prices in a single batch query
  const marketPrices = await prismaWorker.marketPrice.findMany({
    where: {
      type_id: { in: uniqueTypeIds }
    },
    select: {
      type_id: true,
      sell: true
    }
  });

  // Create price map for quick lookup
  const priceMap = new Map(
    marketPrices.map(p => [p.type_id, p.sell || 0])
  );

  // Calculate ship value (always destroyed)
  const shipPrice = priceMap.get(killmailData.victim.ship_type_id) || 0;

  let totalValue = shipPrice;
  let destroyedValue = shipPrice;
  let droppedValue = 0;

  // Calculate item values
  for (const item of items) {
    const price = priceMap.get(item.item_type_id) || 0;
    const quantityDestroyed = item.quantity_destroyed || 0;
    const quantityDropped = item.quantity_dropped || 0;

    destroyedValue += price * quantityDestroyed;
    droppedValue += price * quantityDropped;
    totalValue += price * (quantityDestroyed + quantityDropped);
  }

  return {
    totalValue: Math.round(totalValue * 100) / 100, // Round to 2 decimals
    destroyedValue: Math.round(destroyedValue * 100) / 100,
    droppedValue: Math.round(droppedValue * 100) / 100
  };
}

/**
 * Batch calculate values for multiple killmails
 * More efficient when processing multiple killmails at once
 *
 * @param killmailsData - Array of killmail data
 * @returns Array of value objects in same order
 */
export async function calculateKillmailValuesBatch(killmailsData: Array<{
  victim: { ship_type_id: number };
  items?: Array<{
    item_type_id: number;
    quantity_destroyed?: number;
    quantity_dropped?: number;
  }>;
}>): Promise<Array<{
  totalValue: number;
  destroyedValue: number;
  droppedValue: number;
}>> {
  // Collect ALL unique type IDs from all killmails
  const allTypeIds = new Set<number>();

  for (const km of killmailsData) {
    allTypeIds.add(km.victim.ship_type_id);
    if (km.items) {
      km.items.forEach(item => allTypeIds.add(item.item_type_id));
    }
  }

  // Fetch ALL market prices in ONE query
  const marketPrices = await prismaWorker.marketPrice.findMany({
    where: {
      type_id: { in: Array.from(allTypeIds) }
    },
    select: {
      type_id: true,
      sell: true
    }
  });

  const priceMap = new Map(
    marketPrices.map(p => [p.type_id, p.sell || 0])
  );

  // Calculate values for each killmail
  return killmailsData.map(km => {
    const items = km.items || [];
    const shipPrice = priceMap.get(km.victim.ship_type_id) || 0;

    let totalValue = shipPrice;
    let destroyedValue = shipPrice;
    let droppedValue = 0;

    for (const item of items) {
      const price = priceMap.get(item.item_type_id) || 0;
      const quantityDestroyed = item.quantity_destroyed || 0;
      const quantityDropped = item.quantity_dropped || 0;

      destroyedValue += price * quantityDestroyed;
      droppedValue += price * quantityDropped;
      totalValue += price * (quantityDestroyed + quantityDropped);
    }

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      destroyedValue: Math.round(destroyedValue * 100) / 100,
      droppedValue: Math.round(droppedValue * 100) / 100
    };
  });
}
