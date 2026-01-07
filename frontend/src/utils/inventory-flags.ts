/**
 * EVE Online Inventory Flag Mappings
 * Source: EVE Static Data Export (SDE)
 *
 * Flag numaraları item'ların gemideki pozisyonunu temsil eder.
 */

export interface FlagCategory {
  name: string;
  description: string;
  min: number;
  max: number;
  color: string;
}

export const FLAG_CATEGORIES: Record<string, FlagCategory> = {
  high: {
    name: 'High Slots',
    description: 'Weapons, Mining Lasers, Tractor Beams',
    min: 27,
    max: 34,
    color: '#ef4444', // red-500
  },
  mid: {
    name: 'Mid Slots',
    description: 'Shield Modules, Tackle, EWAR, Propulsion',
    min: 19,
    max: 26,
    color: '#eab308', // yellow-500
  },
  low: {
    name: 'Low Slots',
    description: 'Armor Modules, Damage Mods, Engineering',
    min: 11,
    max: 18,
    color: '#22c55e', // green-500
  },
  rig: {
    name: 'Rig Slots',
    description: 'Permanent Ship Modifications',
    min: 92,
    max: 94,
    color: '#3b82f6', // blue-500
  },
  subsystem: {
    name: 'Subsystem Slots',
    description: 'T3 Cruiser/Destroyer Subsystems',
    min: 125,
    max: 128,
    color: '#8b5cf6', // purple-500
  },
  cargo: {
    name: 'Cargo Hold',
    description: 'Ship Cargo Bay',
    min: 5,
    max: 5,
    color: '#6b7280', // gray-500
  },
  droneBay: {
    name: 'Drone Bay',
    description: 'Drones and Fighters',
    min: 87,
    max: 87,
    color: '#06b6d4', // cyan-500
  },
  fighterBay: {
    name: 'Fighter Bay',
    description: 'Carrier/Supercarrier Fighters',
    min: 158,
    max: 163,
    color: '#ec4899', // pink-500
  },
};

/**
 * Flag numarasından kategori adını bulur
 */
export function getFlagCategory(flag: number): string | null {
  for (const [key, category] of Object.entries(FLAG_CATEGORIES)) {
    if (flag >= category.min && flag <= category.max) {
      return key;
    }
  }
  return null;
}

/**
 * Flag numarasından kategori detaylarını bulur
 */
export function getFlagCategoryDetails(flag: number): FlagCategory | null {
  const categoryKey = getFlagCategory(flag);
  return categoryKey ? FLAG_CATEGORIES[categoryKey] : null;
}

/**
 * Flag numarasından slot index'ini bulur (0-based)
 */
export function getFlagSlotIndex(flag: number): number | null {
  const category = getFlagCategoryDetails(flag);
  if (!category) return null;
  return flag - category.min;
}

/**
 * Killmail items'ı slot kategorilerine göre gruplar
 */
export function groupItemsBySlot<T extends { flag: number }>(items: T[]) {
  return {
    high: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'high';
    }),
    mid: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'mid';
    }),
    low: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'low';
    }),
    rig: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'rig';
    }),
    subsystem: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'subsystem';
    }),
    cargo: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'cargo';
    }),
    droneBay: items.filter((item) => {
      const cat = getFlagCategory(item.flag);
      return cat === 'droneBay';
    }),
    other: items.filter((item) => !getFlagCategory(item.flag)),
  };
}
