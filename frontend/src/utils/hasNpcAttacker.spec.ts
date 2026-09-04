import { describe, expect, it } from 'vitest';

import type { Attacker } from '@/generated/graphql';

import { hasNpcAttacker } from './hasNpcAttacker';

const attacker = (corporationId?: number | null) =>
  ({
    corporation:
      corporationId === undefined ? undefined : { id: corporationId },
  }) as unknown as Attacker;

describe('hasNpcAttacker', () => {
  it('is true only when every attacker belongs to an NPC corporation', () => {
    expect(hasNpcAttacker([attacker(1_000_144), attacker(1_000_125)])).toBe(
      true,
    );
  });

  it('is false when any attacker is a player, however many NPCs there are', () => {
    expect(hasNpcAttacker([attacker(1_000_144), attacker(98_000_001)])).toBe(
      false,
    );
  });

  it('is false for an empty or missing attacker list', () => {
    expect(hasNpcAttacker([])).toBe(false);
    expect(hasNpcAttacker(null)).toBe(false);
    expect(hasNpcAttacker(undefined)).toBe(false);
  });

  it('treats an attacker without a corporation as a player', () => {
    expect(hasNpcAttacker([attacker(undefined)])).toBe(false);
    expect(hasNpcAttacker([attacker(null)])).toBe(false);
  });
});
