/**
 * EVE Online Inventory Flag Mappings
 * Source: EVE Static Data Export (SDE) - Fuzzwork Database
 * Reference: https://www.fuzzwork.co.uk/dump/latest/invFlags.csv
 *
 * Flag numaraları item'ların gemideki/structure'daki pozisyonunu temsil eder.
 * Bu değerler EVE Online'da sabittir ve nadiren değişir.
 */

export enum InventoryFlag {
  // ==================== BASIC CARGO & HOLDS ====================
  Cargo = 5,
  DroneBay = 87,
  ShipHangar = 90,

  // ==================== SPECIALIZED CARGO HOLDS ====================
  // Industrial & Hauler Ships
  SpecializedFuelBay = 133,
  SpecializedOreHold = 134,
  SpecializedGasHold = 135,
  SpecializedMineralHold = 136,
  SpecializedSalvageHold = 137,
  SpecializedShipHold = 138,
  SpecializedSmallShipHold = 139,
  SpecializedMediumShipHold = 140,
  SpecializedLargeShipHold = 141,
  SpecializedIndustrialShipHold = 142,
  SpecializedAmmoHold = 143,
  SpecializedCommandCenterHold = 148,
  SpecializedPlanetaryCommoditiesHold = 149,
  SpecializedMaterialBay = 151,
  QuafeBay = 154, // Special event ship hold
  SpecializedIceHold = 181,
  SpecializedAsteroidHold = 182,

  // ==================== FLEET & CORPORATION HOLDS ====================
  FleetHangar = 155, // Command Ships, Freighters
  BoosterBay = 176, // Black Ops Ships
  SubsystemBay = 177, // T3 Ship subsystems storage
  RafflesHangar = 178, // Raffle/Lottery Hangar
  FrigateEscapeBay = 179, // Bowhead, Freighters
  CorpProjectsHangar = 184, // Corporation projects
  InfrastructureHold = 185, // Infrastructure/Colony Resources
  MoonMaterialBay = 186, // Haulers for moon materials

  // ==================== STRUCTURE HOLDS ====================
  StructureFuel = 172,
  StructureDeedBay = 180,

  // ==================== FIGHTER BAY ====================
  FighterBay = 158,
  FighterTube0 = 159,
  FighterTube1 = 160,
  FighterTube2 = 161,
  FighterTube3 = 162,
  FighterTube4 = 163,

  // ==================== MODULE SLOTS ====================
  // Low Slots (Armor, Damage Mods, Engineering)
  LoSlot0 = 11,
  LoSlot1 = 12,
  LoSlot2 = 13,
  LoSlot3 = 14,
  LoSlot4 = 15,
  LoSlot5 = 16,
  LoSlot6 = 17,
  LoSlot7 = 18,

  // Mid Slots (Shield, Tackle, EWAR, Propulsion)
  MedSlot0 = 19,
  MedSlot1 = 20,
  MedSlot2 = 21,
  MedSlot3 = 22,
  MedSlot4 = 23,
  MedSlot5 = 24,
  MedSlot6 = 25,
  MedSlot7 = 26,

  // High Slots (Weapons, Mining Lasers, Utility)
  HiSlot0 = 27,
  HiSlot1 = 28,
  HiSlot2 = 29,
  HiSlot3 = 30,
  HiSlot4 = 31,
  HiSlot5 = 32,
  HiSlot6 = 33,
  HiSlot7 = 34,

  // ==================== RIG SLOTS ====================
  RigSlot0 = 92,
  RigSlot1 = 93,
  RigSlot2 = 94,
  RigSlot3 = 95,
  RigSlot4 = 96,
  RigSlot5 = 97,
  RigSlot6 = 98,
  RigSlot7 = 99,

  // ==================== SUBSYSTEMS (T3 Ships) ====================
  SubSystem0 = 125,
  SubSystem1 = 126,
  SubSystem2 = 127,
  SubSystem3 = 128,
  SubSystem4 = 129,
  SubSystem5 = 130,
  SubSystem6 = 131,
  SubSystem7 = 132,

  // ==================== IMPLANTS (LEGACY - Pod/Capsule) ====================
  // Note: In EVE SDE, only flag 89 exists for implants
  // Multiple implants use the same flag with different container IDs
  Implant = 89,

  // ==================== SERVICE SLOTS (Upwell Structures) ====================
  ServiceSlot0 = 164,
  ServiceSlot1 = 165,
  ServiceSlot2 = 166,
  ServiceSlot3 = 167,
  ServiceSlot4 = 168,
  ServiceSlot5 = 169,
  ServiceSlot6 = 170,
  ServiceSlot7 = 171,
}

export interface FlagCategory {
  name: string;
  description: string;
  min: number;
  max: number;
  color?: string; // UI için renk
}

export const FLAG_CATEGORIES: Record<string, FlagCategory> = {
  high: {
    name: 'High Slots',
    description: 'Weapons, Mining Lasers, Tractor Beams',
    min: 27,
    max: 34,
    color: '#ef4444', // red
  },
  mid: {
    name: 'Mid Slots',
    description: 'Shield Modules, Tackle, EWAR, Propulsion',
    min: 19,
    max: 26,
    color: '#eab308', // yellow
  },
  low: {
    name: 'Low Slots',
    description: 'Armor Modules, Damage Mods, Engineering',
    min: 11,
    max: 18,
    color: '#22c55e', // green
  },
  rig: {
    name: 'Rig Slots',
    description: 'Permanent Ship Modifications',
    min: 92,
    max: 99, // Updated: 8 rig slots (was 94)
    color: '#3b82f6', // blue
  },
  subsystem: {
    name: 'Subsystem Slots',
    description: 'T3 Cruiser/Destroyer Subsystems',
    min: 125,
    max: 132, // Updated: 8 subsystem slots (was 128)
    color: '#8b5cf6', // purple
  },
  cargo: {
    name: 'Cargo',
    description: 'Ship Cargo Bay',
    min: 5,
    max: 5,
    color: '#6b7280', // gray
  },
  specializedHold: {
    name: 'Specialized Hold',
    description: 'Specialized Cargo Bays (Ore, Gas, Minerals, etc.)',
    min: 133,
    max: 186, // Covers all specialized holds (133-143, 148-149, 151, 154, 176-186)
    color: '#78716c', // stone-500
  },
  droneBay: {
    name: 'Drone Bay',
    description: 'Drones and Fighters',
    min: 87,
    max: 87,
    color: '#06b6d4', // cyan
  },
  fighterBay: {
    name: 'Fighter Bay',
    description: 'Carrier/Supercarrier Fighters',
    min: 158,
    max: 163,
    color: '#ec4899', // pink
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
 * Örnek: flag 27 (HiSlot0) -> 0, flag 28 (HiSlot1) -> 1
 */
export function getFlagSlotIndex(flag: number): number | null {
  const category = getFlagCategoryDetails(flag);
  if (!category) return null;
  return flag - category.min;
}
