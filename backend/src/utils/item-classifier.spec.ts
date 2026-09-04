import { describe, expect, it } from 'vitest';

import {
  CHARGE_GROUP_IDS,
  filterModulesOnly,
  hasCharge,
  isCharge,
  isModule,
  separateModulesAndCharges,
} from './item-classifier';

describe('isCharge', () => {
  it('returns true for known charge group ids', () => {
    expect(isCharge(83)).toBe(true); // Projectile Ammo
    expect(isCharge(1782)).toBe(true); // Stasis Webifier Scripts
    expect(isCharge(4217)).toBe(true); // Structure Anti-Capital Missiles
  });

  it('returns false for module group ids', () => {
    expect(isCharge(55)).toBe(false); // Projectile Weapon
    expect(isCharge(0)).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isCharge(null)).toBe(false);
    expect(isCharge(undefined)).toBe(false);
  });

  it('agrees with CHARGE_GROUP_IDS for every listed id', () => {
    for (const id of CHARGE_GROUP_IDS) {
      expect(isCharge(id)).toBe(true);
    }
  });
});

describe('isModule', () => {
  it('is the inverse of isCharge', () => {
    expect(isModule(83)).toBe(false);
    expect(isModule(55)).toBe(true);
    expect(isModule(null)).toBe(true);
  });
});

describe('separateModulesAndCharges', () => {
  it('splits items by the group id of their type', () => {
    const weapon = { item_type_id: 1, itemType: { group_id: 55 } };
    const ammo = { item_type_id: 2, itemType: { group_id: 83 } };
    const unknown = { item_type_id: 3, itemType: null };

    const { modules, charges } = separateModulesAndCharges([
      weapon,
      ammo,
      unknown,
    ]);

    expect(modules).toEqual([weapon, unknown]);
    expect(charges).toEqual([ammo]);
  });

  it('returns empty arrays for empty input', () => {
    expect(separateModulesAndCharges([])).toEqual({ modules: [], charges: [] });
  });
});

describe('hasCharge', () => {
  it('detects a populated charge field', () => {
    expect(hasCharge({ charge: { id: 1 } })).toBe(true);
    expect(hasCharge({ charge: 0 })).toBe(true);
  });

  it('treats null and undefined as no charge', () => {
    expect(hasCharge({ charge: null })).toBe(false);
    expect(hasCharge({})).toBe(false);
  });
});

describe('filterModulesOnly', () => {
  it('keeps single items in their slot', () => {
    const items = [
      { flag: 27, charge: null },
      { flag: 28, charge: null },
    ];
    expect(filterModulesOnly(items)).toEqual(items);
  });

  it('keeps only the module when a slot holds a module and its charge', () => {
    const module = { flag: 27, charge: { id: 'ammo' } };
    const charge = { flag: 27, charge: null };

    expect(filterModulesOnly([charge, module])).toEqual([module]);
  });

  it('keeps every item in a slot when none of them carries a charge', () => {
    const a = { flag: 5, charge: null };
    const b = { flag: 5, charge: null };

    expect(filterModulesOnly([a, b])).toEqual([a, b]);
  });
});
