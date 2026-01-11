import { InventoryFlag } from '../constants/inventory-flags';

/**
 * Fitting Helper Service
 * Organizes killmail items into a structured fitting format
 * Groups modules by slot types (high/mid/low/rigs/subsystems)
 */

export interface RawKillmailItem {
  item_type_id: number;
  flag: number;
  quantity_dropped: number | null;
  quantity_destroyed: number | null;
  singleton: number;
}

export interface FittingModule {
  itemTypeId: number;
  flag: number;
  quantityDropped: number | null;
  quantityDestroyed: number | null;
  singleton: number;
  charge: FittingModule | null;
}

export interface FittingSlot {
  slotIndex: number;
  module: FittingModule | null;
}

export interface Fitting {
  highSlots: FittingSlot[];
  midSlots: FittingSlot[];
  lowSlots: FittingSlot[];
  rigs: FittingModule[];
  subsystems: FittingModule[];
  cargo: FittingModule[];
  droneBay: FittingModule[];
  fighterBay: FittingModule[];
}

/**
 * Groups items by their flag number
 * Used to detect modules and their charges (same flag = module + charge)
 */
function groupItemsByFlag(items: RawKillmailItem[]): Map<number, RawKillmailItem[]> {
  const flagGroups = new Map<number, RawKillmailItem[]>();

  for (const item of items) {
    if (!flagGroups.has(item.flag)) {
      flagGroups.set(item.flag, []);
    }
    flagGroups.get(item.flag)!.push(item);
  }

  return flagGroups;
}

/**
 * Determines which item is the module and which is the charge
 * Logic: The item with singleton=1 is the module, others are charges
 * If both have singleton=1, the one with higher type_id is likely the module
 */
function separateModuleAndCharge(items: RawKillmailItem[]): {
  module: RawKillmailItem;
  charge: RawKillmailItem | null;
} {
  if (items.length === 1) {
    return { module: items[0], charge: null };
  }

  // Sort by singleton (1 first) then by type_id (higher first)
  const sorted = [...items].sort((a, b) => {
    if (a.singleton !== b.singleton) {
      return b.singleton - a.singleton; // singleton=1 first
    }
    return b.item_type_id - a.item_type_id; // higher type_id first
  });

  return {
    module: sorted[0],
    charge: sorted[1] || null,
  };
}

/**
 * Converts raw item to FittingModule with charge detection
 */
function convertToFittingModule(
  items: RawKillmailItem[]
): FittingModule {
  const { module, charge } = separateModuleAndCharge(items);

  return {
    itemTypeId: module.item_type_id,
    flag: module.flag,
    quantityDropped: module.quantity_dropped,
    quantityDestroyed: module.quantity_destroyed,
    singleton: module.singleton,
    charge: charge
      ? {
        itemTypeId: charge.item_type_id,
        flag: charge.flag,
        quantityDropped: charge.quantity_dropped,
        quantityDestroyed: charge.quantity_destroyed,
        singleton: charge.singleton,
        charge: null, // Charges don't have nested charges
      }
      : null,
  };
}

/**
 * Creates empty slots for a slot range
 * e.g., for high slots (flags 27-34), creates 8 slots
 */
function createSlotArray(minFlag: number, maxFlag: number): FittingSlot[] {
  const slots: FittingSlot[] = [];
  for (let flag = minFlag; flag <= maxFlag; flag++) {
    slots.push({
      slotIndex: flag - minFlag,
      module: null,
    });
  }
  return slots;
}

/**
 * Fills slot array with modules from flagGroups
 */
function fillSlots(
  slots: FittingSlot[],
  minFlag: number,
  maxFlag: number,
  flagGroups: Map<number, RawKillmailItem[]>
): void {
  for (let flag = minFlag; flag <= maxFlag; flag++) {
    const items = flagGroups.get(flag);
    if (items && items.length > 0) {
      const slotIndex = flag - minFlag;
      slots[slotIndex].module = convertToFittingModule(items);
    }
  }
}

/**
 * Extracts modules for a flag range (used for rigs, subsystems, etc.)
 */
function extractModules(
  minFlag: number,
  maxFlag: number,
  flagGroups: Map<number, RawKillmailItem[]>
): FittingModule[] {
  const modules: FittingModule[] = [];

  for (let flag = minFlag; flag <= maxFlag; flag++) {
    const items = flagGroups.get(flag);
    if (items && items.length > 0) {
      modules.push(convertToFittingModule(items));
    }
  }

  return modules;
}

/**
 * Slot count configuration for a ship
 */
export interface SlotCounts {
  hiSlots: number;
  medSlots: number;
  lowSlots: number;
  rigSlots: number;
}

/**
 * Main function: Organizes killmail items into fitting structure
 * @param items - Raw killmail items
 * @param slotCounts - Optional slot counts from dogma attributes. If not provided, uses max (8 for modules, 3 for rigs)
 */
export function organizeFitting(
  items: RawKillmailItem[],
  slotCounts?: SlotCounts
): Fitting {
  const flagGroups = groupItemsByFlag(items);

  // Use provided slot counts or default to maximum
  const hiSlotCount = slotCounts?.hiSlots ?? 8;
  const medSlotCount = slotCounts?.medSlots ?? 8;
  const lowSlotCount = slotCounts?.lowSlots ?? 8;
  const rigSlotCount = slotCounts?.rigSlots ?? 3;

  // Create slot arrays with actual ship slot counts
  const highSlots = createSlotArray(
    InventoryFlag.HiSlot0,
    InventoryFlag.HiSlot0 + hiSlotCount - 1
  );
  const midSlots = createSlotArray(
    InventoryFlag.MedSlot0,
    InventoryFlag.MedSlot0 + medSlotCount - 1
  );
  const lowSlots = createSlotArray(
    InventoryFlag.LoSlot0,
    InventoryFlag.LoSlot0 + lowSlotCount - 1
  );

  // Fill slots with modules
  fillSlots(
    highSlots,
    InventoryFlag.HiSlot0,
    InventoryFlag.HiSlot0 + hiSlotCount - 1,
    flagGroups
  );
  fillSlots(
    midSlots,
    InventoryFlag.MedSlot0,
    InventoryFlag.MedSlot0 + medSlotCount - 1,
    flagGroups
  );
  fillSlots(
    lowSlots,
    InventoryFlag.LoSlot0,
    InventoryFlag.LoSlot0 + lowSlotCount - 1,
    flagGroups
  );

  // Extract rigs (always try to get up to rigSlotCount, but only return what exists)
  const rigs = extractModules(
    InventoryFlag.RigSlot0,
    InventoryFlag.RigSlot0 + rigSlotCount - 1,
    flagGroups
  );

  const subsystems = extractModules(
    InventoryFlag.SubSystem0,
    InventoryFlag.SubSystem3,
    flagGroups
  );

  // Cargo
  const cargoItems = flagGroups.get(InventoryFlag.Cargo) || [];
  const cargo = cargoItems.map((item) => convertToFittingModule([item]));

  // Drone Bay
  const droneBayItems = flagGroups.get(InventoryFlag.DroneBay) || [];
  const droneBay = droneBayItems.map((item) => convertToFittingModule([item]));

  // Fighter Bay (includes all fighter tube flags)
  const fighterBayItems: RawKillmailItem[] = [];
  for (
    let flag = InventoryFlag.FighterBay;
    flag <= InventoryFlag.FighterTube4;
    flag++
  ) {
    const items = flagGroups.get(flag);
    if (items) {
      fighterBayItems.push(...items);
    }
  }
  const fighterBay = fighterBayItems.map((item) => convertToFittingModule([item]));

  return {
    highSlots,
    midSlots,
    lowSlots,
    rigs,
    subsystems,
    cargo,
    droneBay,
    fighterBay,
  };
}
