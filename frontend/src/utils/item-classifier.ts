/**
 * EVE Online Item Type Classifier - Frontend Version
 * Determines if an item is a charge based on common charge group IDs
 */

/**
 * Common Charge/Ammunition Group IDs
 */
export const CHARGE_GROUP_IDS = new Set([
  // Ammunition
  83,   // Projectile Ammo
  85,   // Hybrid Charges
  86,   // Frequency Crystals

  // Module Charges
  87,   // Capacitor Booster Charges
  88,   // Mining Crystals
  89,   // Shield Booster Charges
  90,   // Armor Repair Charges

  // Scanner Probes
  479,  // Scanner Probe (Core Scanner Probe, Combat Scanner Probe, etc.)
  492,  // Survey Probe

  // Scripts
  1771, 1773, 1774, 1775, 1776, 1777, 1778, 1779,
  1780, 1781, 1782, 1783, 1785, 1786, 1787,
]);

/**
 * Checks if an item has a charge field populated
 * If so, this item is a module with ammo/charge loaded
 */
export function hasCharge(item: { charge?: any }): boolean {
  return item.charge !== null && item.charge !== undefined;
}

/**
 * Filters out standalone charge items that should be displayed as part of their parent module
 * Returns only module items (which may have charge field)
 */
export function filterModulesOnly<T extends { flag: number; charge?: any }>(
  items: T[]
): T[] {
  // Aynı flag'deki itemları grupla
  const itemsByFlag = new Map<number, T[]>();

  items.forEach(item => {
    const existing = itemsByFlag.get(item.flag) || [];
    existing.push(item);
    itemsByFlag.set(item.flag, existing);
  });

  const result: T[] = [];

  // Her flag grubu için sadece charge field'ı olan itemı al
  itemsByFlag.forEach((flagItems) => {
    if (flagItems.length === 1) {
      // Tek item varsa direkt ekle
      result.push(flagItems[0]);
    } else {
      // Birden fazla item varsa, charge field'ı olan modülü al
      const moduleItem = flagItems.find(item => hasCharge(item));
      if (moduleItem) {
        result.push(moduleItem);
      } else {
        // Hiçbirinde charge yoksa hepsini ekle (eski davranış)
        result.push(...flagItems);
      }
    }
  });

  return result;
}
