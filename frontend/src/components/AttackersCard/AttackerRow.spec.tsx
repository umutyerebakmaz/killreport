import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KillmailQuery } from '@/generated/graphql';
import AttackerRow from './AttackerRow';

type Attacker = NonNullable<KillmailQuery['killmail']>['attackers'][0];

const killmail = { solo: false, npc: false };

const attacker = (overrides: Partial<Attacker> = {}): Attacker => ({
  damageDone: 1234,
  finalBlow: false,
  securityStatus: 0.5,
  character: { id: 1, name: 'Pilot One' },
  corporation: { id: 2, name: 'Corp Two' },
  alliance: { id: 3, name: 'Alliance Three' },
  shipType: { id: 587, name: 'Rifter', dogmaAttributes: [] },
  weaponType: { id: 2456, name: 'Rocket Launcher' },
  ...overrides,
});

const renderRow = (a: Attacker, flags: Record<string, boolean> = {}) =>
  render(
    <AttackerRow
      attacker={a}
      killmail={killmail}
      totalDamage={10000}
      isFinalBlow={flags.isFinalBlow ?? false}
      isTopDamage={flags.isTopDamage ?? false}
    />,
  );

describe('AttackerRow', () => {
  it('shows the alliance name and not the corporation name', () => {
    renderRow(attacker());

    expect(screen.getByText('Alliance Three')).toBeInTheDocument();
    expect(screen.queryByText('Corp Two')).toBeNull();
  });

  it('falls back to the corporation name when there is no alliance', () => {
    renderRow(attacker({ alliance: null }));

    expect(screen.getByText('Corp Two')).toBeInTheDocument();
  });

  it('prints the damage without a DMG suffix', () => {
    renderRow(attacker());

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.queryByText(/DMG/)).toBeNull();
  });

  it('drops the alliance and corporation logos', () => {
    const { container } = renderRow(attacker());

    expect(container.querySelector('img[src*="/alliances/"]')).toBeNull();
    expect(container.querySelector('img[src*="/corporations/"]')).toBeNull();
  });

  it('puts the final blow badge inside the portrait slot', () => {
    renderRow(attacker(), { isFinalBlow: true });

    const badge = screen.getByText('FINAL BLOW');
    expect(badge).toHaveClass('tag');

    // Asking which `.relative` is fragile — the ship tier wrapper is one too.
    // Ask instead whether the badge's positioning context holds the portrait.
    // `slot` is checked on its own line: with optional chaining alone a badge
    // that has no positioning context at all yields `undefined`, and
    // `expect(undefined).not.toBeNull()` passes.
    const slot = badge.closest('.relative');
    expect(slot).not.toBeNull();
    expect(slot?.querySelector('img[src*="/characters/"]')).not.toBeNull();
  });
});
