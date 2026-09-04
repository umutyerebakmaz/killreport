import { describe, expect, it } from 'vitest';

import { InventoryFlag } from '../constants/inventory-flags';
import { organizeFitting } from './fitting-helper';
import { RawKillmailItem } from './type';

function item(overrides: Partial<RawKillmailItem> & Pick<RawKillmailItem, 'item_type_id' | 'flag'>): RawKillmailItem {
  return {
    quantity_dropped: null,
    quantity_destroyed: 1,
    singleton: 0,
    ...overrides,
  };
}

describe('organizeFitting', () => {
  it('creates the default slot layout for an empty item list', () => {
    const fitting = organizeFitting([]);

    expect(fitting.highSlots).toHaveLength(8);
    expect(fitting.midSlots).toHaveLength(8);
    expect(fitting.lowSlots).toHaveLength(8);
    expect(fitting.rigSlots).toHaveLength(3);
    expect(fitting.subsystemSlots).toHaveLength(0);
    expect(fitting.serviceSlots).toHaveLength(0);
    expect(fitting.highSlots.every(slot => slot.module === null)).toBe(true);
  });

  it('respects the provided slot counts', () => {
    const fitting = organizeFitting([], { hiSlots: 4, medSlots: 3, lowSlots: 2, rigSlots: 2 });

    expect(fitting.highSlots).toHaveLength(4);
    expect(fitting.midSlots).toHaveLength(3);
    expect(fitting.lowSlots).toHaveLength(2);
    expect(fitting.rigSlots).toHaveLength(2);
  });

  it('places a module in the slot matching its flag', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 100, flag: InventoryFlag.HiSlot0 + 2, singleton: 1 }),
      item({ item_type_id: 200, flag: InventoryFlag.MedSlot0, singleton: 1 }),
      item({ item_type_id: 300, flag: InventoryFlag.LoSlot0 + 7, singleton: 1 }),
    ]);

    expect(fitting.highSlots[2].module?.itemTypeId).toBe(100);
    expect(fitting.midSlots[0].module?.itemTypeId).toBe(200);
    expect(fitting.lowSlots[7].module?.itemTypeId).toBe(300);
    expect(fitting.highSlots[0].module).toBeNull();
  });

  it('pairs a fitted module with the charge sharing its flag', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 2456, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 178, flag: InventoryFlag.HiSlot0, singleton: 0, quantity_destroyed: 40 }),
    ]);

    const slot = fitting.highSlots[0].module;
    expect(slot?.itemTypeId).toBe(2456);
    expect(slot?.charge?.itemTypeId).toBe(178);
    expect(slot?.charge?.quantityDestroyed).toBe(40);
    expect(slot?.charge?.charge).toBeNull();
  });

  it('treats the higher type id as the module when both items are singletons', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 10, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 20, flag: InventoryFlag.HiSlot0, singleton: 1 }),
    ]);

    expect(fitting.highSlots[0].module?.itemTypeId).toBe(20);
    expect(fitting.highSlots[0].module?.charge?.itemTypeId).toBe(10);
  });

  it('only builds subsystem slots when subsystem flags are present', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 500, flag: InventoryFlag.SubSystem0, singleton: 1 }),
      item({ item_type_id: 501, flag: InventoryFlag.SubSystem3, singleton: 1 }),
    ]);

    expect(fitting.subsystemSlots).toHaveLength(4);
    expect(fitting.subsystemSlots[0].module?.itemTypeId).toBe(500);
    expect(fitting.subsystemSlots[3].module?.itemTypeId).toBe(501);
  });

  it('collects cargo and drone bay items without pairing them', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 34, flag: InventoryFlag.Cargo, quantity_dropped: 1000, quantity_destroyed: null }),
      item({ item_type_id: 35, flag: InventoryFlag.Cargo }),
      item({ item_type_id: 2486, flag: InventoryFlag.DroneBay }),
    ]);

    expect(fitting.cargo.map(m => m.itemTypeId)).toEqual([34, 35]);
    expect(fitting.cargo[0].quantityDropped).toBe(1000);
    expect(fitting.cargo.every(m => m.charge === null)).toBe(true);
    expect(fitting.droneBay.map(m => m.itemTypeId)).toEqual([2486]);
  });

  it('lists every implant found on flag 89 individually', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 9899, flag: InventoryFlag.Implant0, singleton: 1 }),
      item({ item_type_id: 9941, flag: InventoryFlag.Implant0, singleton: 1 }),
      item({ item_type_id: 10228, flag: InventoryFlag.Implant0, singleton: 1 }),
    ]);

    expect(fitting.implants.map(m => m.itemTypeId)).toEqual([9899, 9941, 10228]);
    expect(fitting.implants.every(m => m.charge === null)).toBe(true);
  });

  it('merges ore and asteroid holds into oreHold', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 1, flag: InventoryFlag.SpecializedOreHold }),
      item({ item_type_id: 2, flag: InventoryFlag.SpecializedAsteroidHold }),
    ]);

    expect(fitting.oreHold.map(m => m.itemTypeId)).toEqual([1, 2]);
  });
});
