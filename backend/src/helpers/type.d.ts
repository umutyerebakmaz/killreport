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
  rigSlots: FittingSlot[];
  subsystemSlots: FittingSlot[];
  serviceSlots: FittingSlot[];
  implants: FittingModule[];
  cargo: FittingModule[];
  droneBay: FittingModule[];
  fighterBay: FittingModule[];
  structureFuel: FittingModule[];
  coreRoom: FittingModule[];
}

/**
 * Slot count configuration for a ship
 */
export interface SlotCounts {
  hiSlots: number;
  medSlots: number;
  lowSlots: number;
  rigSlots: number;
  serviceSlots?: number;
}
