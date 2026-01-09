/**
 * EVE Online Item Type Classifier
 * Determines if an item is a charge (ammunition, crystals, paste, etc.)
 * based on its Item Group ID from EVE SDE
 */

/**
 * Charge/Ammunition Group IDs from EVE Static Data Export
 * These items are loaded INTO modules (weapons, boosters, etc.)
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
  90,   // Armor Repair Charges (Nanite Paste)

  // Scripts
  1771, // Burst Projector Scripts
  1773, // Energy Neutralizer Scripts
  1774, // Energy Nosferatu Scripts
  1775, // Sensor Booster Scripts
  1776, // Sensor Dampener Scripts
  1777, // Tracking Computer Scripts
  1778, // Tracking Disruptor Scripts
  1779, // Remote Sensor Booster Scripts
  1780, // Remote Sensor Dampener Scripts
  1781, // Weapon Disruptor Scripts
  1782, // Stasis Webifier Scripts
  1783, // Target Painter Scripts
  1785, // Propulsion Module Scripts
  1786, // Missile Guidance Scripts
  1787, // Remote ECM Burst Scripts

  // Advanced Charges
  479,  // Scanner Probe (Core Scanner Probe, Combat Scanner Probe, etc.)
  492,  // Survey Probe
  1796, // Structure Scanner Probe (deprecated ID)
  863,  // Survey Probe (old)

  // Structure/Upwell Charges
  4217, // Structure Anti-Capital Missiles
  4218, // Structure Anti-Subcapital Missiles
  4051, // Structure Guided Bombs
  4052, // Structure Point Defense Batteries
]);

/**
 * Checks if an item type is a charge/ammunition
 */
export function isCharge(groupId: number | null | undefined): boolean {
  if (groupId === null || groupId === undefined) {
    return false;
  }
  return CHARGE_GROUP_IDS.has(groupId);
}

/**
 * Checks if an item type is a module (not a charge)
 */
export function isModule(groupId: number | null | undefined): boolean {
  return !isCharge(groupId);
}

/**
 * Given a list of items in the same slot (same flag),
 * separates them into modules and charges
 */
export function separateModulesAndCharges<T extends {
  item_type_id: number;
  itemType?: { group_id?: number | null } | null;
}>(items: T[]): {
  modules: T[];
  charges: T[];
} {
  const modules: T[] = [];
  const charges: T[] = [];

  for (const item of items) {
    const groupId = item.itemType?.group_id;

    if (isCharge(groupId)) {
      charges.push(item);
    } else {
      modules.push(item);
    }
  }

  return { modules, charges };
}
