import { InventoryFlag } from '../constants/inventory-flags';
import { Fitting, FittingModule, FittingSlot, RawKillmailItem, SlotCounts } from './type';

/**
 * Fitting Helper Service
 * Organizes killmail items into a structured fitting format
 * Groups modules by slot types (high/mid/low/rigs/subsystems)
 */

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
 * Logic:
 * 1. singleton=1 (fitted item) is always the module
 * 2. singleton=0 (stacked/charged item) is the charge
 * 3. If multiple singleton=1 items, higher item_type_id is likely the module (weapon vs ammo)
 */
function separateModuleAndCharge(items: RawKillmailItem[]): {
    module: RawKillmailItem;
    charge: RawKillmailItem | null;
} {
    if (items.length === 1) {
        return { module: items[0], charge: null };
    }

    // Separate by singleton value first
    const singletonOnes = items.filter(i => i.singleton === 1);
    const singletonZeros = items.filter(i => i.singleton === 0);

    let module: RawKillmailItem;
    let charge: RawKillmailItem | null = null;

    if (singletonOnes.length === 1 && singletonZeros.length === 1) {
        // Clear case: singleton=1 is module, singleton=0 is charge
        module = singletonOnes[0];
        charge = singletonZeros[0];
    } else if (singletonOnes.length === 2) {
        // Both singleton=1: higher type_id is the module (weapon/launcher)
        // lower type_id is the charge (ammo/missile)
        const sorted = [...singletonOnes].sort((a, b) => b.item_type_id - a.item_type_id);
        module = sorted[0];
        charge = sorted[1];
    } else {
        // Fallback: sort by singleton desc, then type_id desc
        const sorted = [...items].sort((a, b) => {
            if (a.singleton !== b.singleton) {
                return b.singleton - a.singleton;
            }
            return b.item_type_id - a.item_type_id;
        });
        module = sorted[0];
        charge = sorted[1] || null;
    }

    return { module, charge };
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

    // Extract rigs as slots (like high/mid/low)
    const rigSlots: FittingSlot[] = [];
    for (let i = 0; i < rigSlotCount; i++) {
        rigSlots.push({
            slotIndex: i,
            module: null,
        });
    }
    fillSlots(
        rigSlots,
        InventoryFlag.RigSlot0,
        InventoryFlag.RigSlot0 + rigSlotCount - 1,
        flagGroups
    );

    // Subsystems - only for T3 Cruisers (check if any subsystem flags exist)
    const subsystemSlots: FittingSlot[] = [];
    let hasSubsystems = false;
    for (let flag = InventoryFlag.SubSystem0; flag <= InventoryFlag.SubSystem3; flag++) {
        if (flagGroups.has(flag)) {
            hasSubsystems = true;
            break;
        }
    }

    if (hasSubsystems) {
        for (let i = 0; i < 4; i++) {
            subsystemSlots.push({
                slotIndex: i,
                module: null,
            });
        }
        fillSlots(
            subsystemSlots,
            InventoryFlag.SubSystem0,
            InventoryFlag.SubSystem3,
            flagGroups
        );
    }

    // Implants (Pod/Capsule slots) - flags are not sequential (89-91, 95-101)
    const implantFlags = [
        InventoryFlag.Implant0,  // 89 // implantness
        InventoryFlag.Implant1,  // 90
        InventoryFlag.Implant2,  // 91
        InventoryFlag.Implant3,  // 95
        InventoryFlag.Implant4,  // 96
        InventoryFlag.Implant5,  // 97
        InventoryFlag.Implant6,  // 98
        InventoryFlag.Implant7,  // 99
        InventoryFlag.Implant8,  // 100
        InventoryFlag.Implant9,  // 101
    ];
    const implants: FittingModule[] = [];


    implantFlags.forEach((flag) => {
        const items = flagGroups.get(flag);
        if (items && items.length > 0) {
            implants.push(convertToFittingModule(items));
        }
    });

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

    // Service Slots (Upwell Structures) - only for structures (check if any service slot flags exist)
    const serviceSlots: FittingSlot[] = [];
    let hasServiceSlots = false;
    for (let flag = InventoryFlag.ServiceSlot0; flag <= InventoryFlag.ServiceSlot7; flag++) {
        if (flagGroups.has(flag)) {
            hasServiceSlots = true;
            break;
        }
    }

    if (hasServiceSlots) {
        // Use actual service slot count from dogma or max from fitted items
        const serviceSlotCount = slotCounts?.serviceSlots ?? 8;
        for (let i = 0; i < serviceSlotCount; i++) {
            serviceSlots.push({
                slotIndex: i,
                module: null,
            });
        }
        fillSlots(
            serviceSlots,
            InventoryFlag.ServiceSlot0,
            InventoryFlag.ServiceSlot0 + serviceSlotCount - 1,
            flagGroups
        );
    }

    // Structure Fuel Bay (Upwell Structures)
    const structureFuelItems = flagGroups.get(InventoryFlag.StructureFuel) || [];
    const structureFuel = structureFuelItems.map((item) => convertToFittingModule([item]));

    // Structure Core Room (Upwell Structures - Quantum Core)
    const coreRoomItems = flagGroups.get(InventoryFlag.StructureCoreRoom) || [];
    const coreRoom = coreRoomItems.map((item) => convertToFittingModule([item]));

    return {
        highSlots,
        midSlots,
        lowSlots,
        rigSlots,
        subsystemSlots,
        serviceSlots,
        implants,
        cargo,
        droneBay,
        fighterBay,
        structureFuel,
        coreRoom,
    };
}
