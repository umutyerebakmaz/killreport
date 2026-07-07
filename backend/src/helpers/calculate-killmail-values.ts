import prismaWorker from '@services/prisma-worker';

// Capsule (pod) type_id - special handling for value calculations
const CAPSULE_TYPE_ID = 670;
const CAPSULE_VALUE = 10;
const BPC_VALUE = 0.01; // Blueprint Copy fixed value

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
    singleton?: number;
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

  // Fetch type info to get group_ids
  const typeInfo = await prismaWorker.type.findMany({
    where: {
      id: { in: uniqueTypeIds }
    },
    select: {
      id: true,
      group_id: true
    }
  });

  // Get unique group IDs
  const groupIds = [...new Set(typeInfo.map(t => t.group_id))];

  // Fetch groups
  const groups = await prismaWorker.itemGroup.findMany({
    where: {
      id: { in: groupIds }
    },
    select: {
      id: true,
      category_id: true
    }
  });

  // Get unique category IDs
  const categoryIds = [...new Set(groups.map(g => g.category_id))];

  // Fetch categories
  const categories = await prismaWorker.category.findMany({
    where: {
      id: { in: categoryIds }
    },
    select: {
      id: true,
      name: true
    }
  });

  // Create maps for quick lookup
  const priceMap = new Map(
    marketPrices.map(p => [p.type_id, p.sell || 0])
  );

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const groupMap = new Map(groups.map(g => [g.id, g]));

  const blueprintMap = new Map(
    typeInfo.map(t => {
      const group = groupMap.get(t.group_id);
      const category = group ? categoryMap.get(group.category_id) : null;
      return [t.id, category?.name?.toLowerCase() === 'blueprint'];
    })
  );

  // Calculate ship value (always destroyed)
  // Special case: Capsule (pod) has fixed value of 10 ISK
  const shipPrice = killmailData.victim.ship_type_id === CAPSULE_TYPE_ID
    ? CAPSULE_VALUE
    : (priceMap.get(killmailData.victim.ship_type_id) || 0);

  let totalValue = shipPrice;
  let destroyedValue = shipPrice;
  let droppedValue = 0;

  // Calculate item values
  for (const item of items) {
    // singleton = 1 → BPO (Blueprint Original) → use market price
    // singleton = 2 → BPC (Blueprint Copy) → use fixed 0.01 ISK value
    // singleton = 0 (or null) → normal stackable item → use market price
    const isBlueprint = blueprintMap.get(item.item_type_id) || false;
    const isBlueprintCopy = isBlueprint && item.singleton === 2;

    const price = isBlueprintCopy
      ? BPC_VALUE
      : (priceMap.get(item.item_type_id) || 0);
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
    singleton?: number;
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

  // Fetch type info to get group_ids
  const typeInfo = await prismaWorker.type.findMany({
    where: {
      id: { in: Array.from(allTypeIds) }
    },
    select: {
      id: true,
      group_id: true
    }
  });

  // Get unique group IDs
  const groupIds = [...new Set(typeInfo.map(t => t.group_id))];

  // Fetch groups
  const groups = await prismaWorker.itemGroup.findMany({
    where: {
      id: { in: groupIds }
    },
    select: {
      id: true,
      category_id: true
    }
  });

  // Get unique category IDs
  const categoryIds = [...new Set(groups.map(g => g.category_id))];

  // Fetch categories
  const categories = await prismaWorker.category.findMany({
    where: {
      id: { in: categoryIds }
    },
    select: {
      id: true,
      name: true
    }
  });

  // Create maps for quick lookup
  const priceMap = new Map(
    marketPrices.map(p => [p.type_id, p.sell || 0])
  );

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const groupMap = new Map(groups.map(g => [g.id, g]));

  const blueprintMap = new Map(
    typeInfo.map(t => {
      const group = groupMap.get(t.group_id);
      const category = group ? categoryMap.get(group.category_id) : null;
      return [t.id, category?.name?.toLowerCase() === 'blueprint'];
    })
  );

  // Calculate values for each killmail
  return killmailsData.map(km => {
    const items = km.items || [];
    // Special case: Capsule (pod) has fixed value of 10 ISK
    const shipPrice = km.victim.ship_type_id === CAPSULE_TYPE_ID
      ? CAPSULE_VALUE
      : (priceMap.get(km.victim.ship_type_id) || 0);

    let totalValue = shipPrice;
    let destroyedValue = shipPrice;
    let droppedValue = 0;

    for (const item of items) {
      // singleton = 1 → BPO (Blueprint Original) → use market price
      // singleton = 2 → BPC (Blueprint Copy) → use fixed 0.01 ISK value
      // singleton = 0 (or null) → normal stackable item → use market price
      const isBlueprint = blueprintMap.get(item.item_type_id) || false;
      const isBlueprintCopy = isBlueprint && item.singleton === 2;

      const price = isBlueprintCopy
        ? BPC_VALUE
        : (priceMap.get(item.item_type_id) || 0);
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
