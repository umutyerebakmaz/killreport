import { describe, expect, it } from 'vitest';

import { InventoryFlag } from '../constants/inventory-flags';
import { organizeFitting } from './fitting-helper';
import { RawKillmailItem } from './type';

function item(
  overrides: Partial<RawKillmailItem> &
    Pick<RawKillmailItem, 'item_type_id' | 'flag'>,
): RawKillmailItem {
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
    expect(fitting.highSlots.every((slot) => slot.module === null)).toBe(true);
  });

  it('respects the provided slot counts', () => {
    const fitting = organizeFitting([], {
      hiSlots: 4,
      medSlots: 3,
      lowSlots: 2,
      rigSlots: 2,
    });

    expect(fitting.highSlots).toHaveLength(4);
    expect(fitting.midSlots).toHaveLength(3);
    expect(fitting.lowSlots).toHaveLength(2);
    expect(fitting.rigSlots).toHaveLength(2);
  });

  it('places a module in the slot matching its flag', () => {
    const fitting = organizeFitting([
      item({
        item_type_id: 100,
        flag: InventoryFlag.HiSlot0 + 2,
        singleton: 1,
      }),
      item({ item_type_id: 200, flag: InventoryFlag.MedSlot0, singleton: 1 }),
      item({
        item_type_id: 300,
        flag: InventoryFlag.LoSlot0 + 7,
        singleton: 1,
      }),
    ]);

    expect(fitting.highSlots[2].module?.itemTypeId).toBe(100);
    expect(fitting.midSlots[0].module?.itemTypeId).toBe(200);
    expect(fitting.lowSlots[7].module?.itemTypeId).toBe(300);
    expect(fitting.highSlots[0].module).toBeNull();
  });

  it('pairs a fitted module with the charge sharing its flag', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 2456, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({
        item_type_id: 178,
        flag: InventoryFlag.HiSlot0,
        singleton: 0,
        quantity_destroyed: 40,
      }),
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
      item({
        item_type_id: 34,
        flag: InventoryFlag.Cargo,
        quantity_dropped: 1000,
        quantity_destroyed: null,
      }),
      item({ item_type_id: 35, flag: InventoryFlag.Cargo }),
      item({ item_type_id: 2486, flag: InventoryFlag.DroneBay }),
    ]);

    expect(fitting.cargo.map((m) => m.itemTypeId)).toEqual([34, 35]);
    expect(fitting.cargo[0].quantityDropped).toBe(1000);
    expect(fitting.cargo.every((m) => m.charge === null)).toBe(true);
    expect(fitting.droneBay.map((m) => m.itemTypeId)).toEqual([2486]);
  });

  it('lists every implant found on flag 89 individually', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 9899, flag: InventoryFlag.Implant0, singleton: 1 }),
      item({ item_type_id: 9941, flag: InventoryFlag.Implant0, singleton: 1 }),
      item({ item_type_id: 10228, flag: InventoryFlag.Implant0, singleton: 1 }),
    ]);

    expect(fitting.implants.map((m) => m.itemTypeId)).toEqual([
      9899, 9941, 10228,
    ]);
    expect(fitting.implants.every((m) => m.charge === null)).toBe(true);
  });

  it('merges ore and asteroid holds into oreHold', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 1, flag: InventoryFlag.SpecializedOreHold }),
      item({ item_type_id: 2, flag: InventoryFlag.SpecializedAsteroidHold }),
    ]);

    expect(fitting.oreHold.map((m) => m.itemTypeId)).toEqual([1, 2]);
  });
});

/**
 * Items sharing a flag are a module and its charge, but a killmail can put
 * more than two there, or none of them fitted. The fallback ordering below is
 * what decides which one the UI draws in the slot.
 */
describe('separating a module from its charge', () => {
  const inHighSlot = (...items: RawKillmailItem[]) =>
    organizeFitting(items).highSlots[0].module;

  it('leaves a lone item without a charge', () => {
    const module = inHighSlot(
      item({ item_type_id: 2456, flag: InventoryFlag.HiSlot0, singleton: 1 }),
    );

    expect(module?.itemTypeId).toBe(2456);
    expect(module?.charge).toBeNull();
  });

  it('treats a lone unfitted item as the module', () => {
    const module = inHighSlot(
      item({ item_type_id: 178, flag: InventoryFlag.HiSlot0, singleton: 0 }),
    );

    expect(module?.itemTypeId).toBe(178);
    expect(module?.charge).toBeNull();
  });

  it('prefers the fitted item over the higher type id', () => {
    const module = inHighSlot(
      item({ item_type_id: 10, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 999, flag: InventoryFlag.HiSlot0, singleton: 0 }),
    );

    expect(module?.itemTypeId).toBe(10);
    expect(module?.charge?.itemTypeId).toBe(999);
  });

  it('falls back to the higher type id when neither item is fitted', () => {
    const module = inHighSlot(
      item({ item_type_id: 3, flag: InventoryFlag.HiSlot0, singleton: 0 }),
      item({ item_type_id: 9, flag: InventoryFlag.HiSlot0, singleton: 0 }),
    );

    expect(module?.itemTypeId).toBe(9);
    expect(module?.charge?.itemTypeId).toBe(3);
  });

  it('puts the fitted item first when a flag holds three items', () => {
    const module = inHighSlot(
      item({ item_type_id: 5, flag: InventoryFlag.HiSlot0, singleton: 0 }),
      item({ item_type_id: 10, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 7, flag: InventoryFlag.HiSlot0, singleton: 0 }),
    );

    expect(module?.itemTypeId).toBe(10);
    expect(module?.charge?.itemTypeId).toBe(7);
  });

  it('still prefers the fitted item when an unfitted one outranks it', () => {
    const module = inHighSlot(
      item({ item_type_id: 999, flag: InventoryFlag.HiSlot0, singleton: 0 }),
      item({ item_type_id: 500, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 300, flag: InventoryFlag.HiSlot0, singleton: 0 }),
    );

    expect(module?.itemTypeId).toBe(500);
    expect(module?.charge?.itemTypeId).toBe(999);
  });

  it('keeps only two of the items sharing a flag', () => {
    const module = inHighSlot(
      item({ item_type_id: 30, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 20, flag: InventoryFlag.HiSlot0, singleton: 1 }),
      item({ item_type_id: 10, flag: InventoryFlag.HiSlot0, singleton: 1 }),
    );

    expect(module?.itemTypeId).toBe(30);
    expect(module?.charge?.itemTypeId).toBe(20);
    expect(module?.charge?.charge).toBeNull();
  });
});

describe('subsystem slots', () => {
  const subsystemsAt = (...flags: number[]) =>
    organizeFitting(
      flags.map((flag, index) =>
        item({ item_type_id: 500 + index, flag, singleton: 1 }),
      ),
    ).subsystemSlots;

  it('builds none when no subsystem flag is present', () => {
    expect(organizeFitting([]).subsystemSlots).toHaveLength(0);
  });

  it('builds four for a T3 cruiser even from a single subsystem', () => {
    expect(subsystemsAt(InventoryFlag.SubSystem0)).toHaveLength(4);
  });

  it('grows to the highest subsystem flag present', () => {
    expect(subsystemsAt(InventoryFlag.SubSystem5)).toHaveLength(6);
    expect(subsystemsAt(InventoryFlag.SubSystem7)).toHaveLength(8);
  });

  it('places each subsystem at the index its flag names', () => {
    const slots = subsystemsAt(
      InventoryFlag.SubSystem0,
      InventoryFlag.SubSystem4,
    );

    expect(slots).toHaveLength(5);
    expect(slots[0].module?.itemTypeId).toBe(500);
    expect(slots[4].module?.itemTypeId).toBe(501);
    expect(slots[1].module).toBeNull();
  });
});

describe('service slots', () => {
  it('builds none for a ship, which has no service slot flags', () => {
    expect(organizeFitting([]).serviceSlots).toHaveLength(0);
  });

  it('builds the full eight for a structure by default', () => {
    const fitting = organizeFitting([
      item({
        item_type_id: 35894,
        flag: InventoryFlag.ServiceSlot0,
        singleton: 1,
      }),
    ]);

    expect(fitting.serviceSlots).toHaveLength(8);
    expect(fitting.serviceSlots[0].module?.itemTypeId).toBe(35894);
  });

  it('honours a service slot count from the dogma attributes', () => {
    const fitting = organizeFitting(
      [
        item({
          item_type_id: 35894,
          flag: InventoryFlag.ServiceSlot2,
          singleton: 1,
        }),
      ],
      { hiSlots: 8, medSlots: 8, lowSlots: 8, rigSlots: 3, serviceSlots: 3 },
    );

    expect(fitting.serviceSlots).toHaveLength(3);
    expect(fitting.serviceSlots[2].module?.itemTypeId).toBe(35894);
  });

  it('drops a service module the configured count cannot reach', () => {
    const fitting = organizeFitting(
      [
        item({
          item_type_id: 35894,
          flag: InventoryFlag.ServiceSlot4,
          singleton: 1,
        }),
      ],
      { hiSlots: 8, medSlots: 8, lowSlots: 8, rigSlots: 3, serviceSlots: 2 },
    );

    expect(fitting.serviceSlots).toHaveLength(2);
    expect(fitting.serviceSlots.every((slot) => slot.module === null)).toBe(
      true,
    );
  });
});

/**
 * One flag, one bucket. Each is a single line in the helper, and a bucket
 * reading the wrong flag would quietly empty a section of the killmail page.
 */
describe('specialized holds', () => {
  const HOLDS = [
    { bucket: 'fuelBay', flag: InventoryFlag.SpecializedFuelBay },
    { bucket: 'gasHold', flag: InventoryFlag.SpecializedGasHold },
    { bucket: 'mineralHold', flag: InventoryFlag.SpecializedMineralHold },
    { bucket: 'salvageHold', flag: InventoryFlag.SpecializedSalvageHold },
    {
      bucket: 'planetaryCommoditiesHold',
      flag: InventoryFlag.SpecializedPlanetaryCommoditiesHold,
    },
    { bucket: 'iceHold', flag: InventoryFlag.SpecializedIceHold },
    { bucket: 'infrastructureHold', flag: InventoryFlag.InfrastructureHold },
    { bucket: 'fleetHangar', flag: InventoryFlag.FleetHangar },
    { bucket: 'structureFuel', flag: InventoryFlag.StructureFuel },
    { bucket: 'coreRoom', flag: InventoryFlag.StructureDeedBay },
  ] as const;

  it.each(HOLDS)('collects flag $flag into $bucket', ({ bucket, flag }) => {
    const fitting = organizeFitting([
      item({ item_type_id: 4247, flag, quantity_dropped: 25 }),
    ]);

    expect(fitting[bucket].map((m) => m.itemTypeId)).toEqual([4247]);
    expect(fitting[bucket][0].quantityDropped).toBe(25);
  });

  it.each(HOLDS)('leaves $bucket empty when nothing is there', ({ bucket }) => {
    const fitting = organizeFitting([
      item({ item_type_id: 34, flag: InventoryFlag.Cargo }),
    ]);

    expect(fitting[bucket]).toEqual([]);
  });

  it('never pairs two items in the same hold as a module and charge', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 4246, flag: InventoryFlag.SpecializedFuelBay }),
      item({ item_type_id: 4247, flag: InventoryFlag.SpecializedFuelBay }),
    ]);

    expect(fitting.fuelBay.map((m) => m.itemTypeId)).toEqual([4246, 4247]);
    expect(fitting.fuelBay.every((m) => m.charge === null)).toBe(true);
  });
});

describe('the combined holds', () => {
  it('gathers the remaining special holds into infrastructureHangar', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 1, flag: InventoryFlag.BoosterBay }),
      item({ item_type_id: 2, flag: InventoryFlag.SubsystemBay }),
      item({ item_type_id: 3, flag: InventoryFlag.QuafeBay }),
      item({ item_type_id: 4, flag: InventoryFlag.MoonMaterialBay }),
    ]);

    expect(
      fitting.infrastructureHangar.map((m) => m.itemTypeId).sort(),
    ).toEqual([1, 2, 3, 4]);
  });

  it('orders the combined hold by the flag list, not by item order', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 1, flag: InventoryFlag.MoonMaterialBay }),
      item({ item_type_id: 2, flag: InventoryFlag.RafflesHangar }),
    ]);

    expect(fitting.infrastructureHangar.map((m) => m.itemTypeId)).toEqual([
      2, 1,
    ]);
  });

  it('reports a structure deed in coreRoom and the combined hold both', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 57478, flag: InventoryFlag.StructureDeedBay }),
    ]);

    expect(fitting.coreRoom.map((m) => m.itemTypeId)).toEqual([57478]);
    expect(fitting.infrastructureHangar.map((m) => m.itemTypeId)).toEqual([
      57478,
    ]);
  });

  it('gathers every fighter tube into the fighter bay', () => {
    const fitting = organizeFitting([
      item({ item_type_id: 1, flag: InventoryFlag.FighterBay }),
      item({ item_type_id: 2, flag: InventoryFlag.FighterTube4 }),
      item({ item_type_id: 3, flag: InventoryFlag.FighterBay + 1 }),
    ]);

    expect(fitting.fighterBay.map((m) => m.itemTypeId)).toEqual([1, 3, 2]);
  });

  it('leaves the fighter bay empty for a ship that carries none', () => {
    expect(organizeFitting([]).fighterBay).toEqual([]);
  });
});
