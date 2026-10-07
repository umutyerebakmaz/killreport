import { MapOwnerKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import { hexToTint } from './colors';
import {
  ownerKindOf,
  SOV_COLORS,
  SOV_UNOWNED_TINT,
  sovTint,
} from './sovColors';

describe('SOV_COLORS', () => {
  it('holds a valid six-digit hex for every owner it names', () => {
    for (const [ownerId, hex] of Object.entries(SOV_COLORS)) {
      expect(hex, `owner ${ownerId}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('gives no two owners the same colour', () => {
    const values = Object.values(SOV_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('sovTint', () => {
  it('turns a dictionary entry into the number Pixi tints with', () => {
    const [ownerId, hex] = Object.entries(SOV_COLORS)[0];
    expect(sovTint(Number(ownerId))).toBe(hexToTint(hex));
  });

  it('returns null for an owner the dictionary does not name', () => {
    // A new alliance taking sov is drawn neutral and identified by its logo;
    // the caller needs to be able to tell "no colour" from a dark colour, so
    // this is null rather than SOV_UNOWNED_TINT.
    expect(sovTint(1)).toBeNull();
  });
});

describe('SOV_UNOWNED_TINT', () => {
  it('is darker than the gate line, so owned colour stays the loud thing', () => {
    expect(SOV_UNOWNED_TINT).toBe(0x475569);
  });
});

// A territory change names its owners by id alone. NPC factions are the
// 500000 block — Amarr is 500003 — and every alliance id is far above it.
describe('ownerKindOf', () => {
  it.each([
    [500003, MapOwnerKind.Faction],
    [500027, MapOwnerKind.Faction],
    [99003581, MapOwnerKind.Alliance],
    [1354830081, MapOwnerKind.Alliance],
  ])('reads %i as %s', (id, kind) => {
    expect(ownerKindOf(id)).toBe(kind);
  });
});
