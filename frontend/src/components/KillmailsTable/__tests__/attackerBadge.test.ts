import { describe, expect, it } from 'vitest';
import { attackerBadge } from '../attackerBadge';

describe('attackerBadge', () => {
  it('shows the count for a fight with more than one attacker', () => {
    expect(attackerBadge({ solo: false, npc: false })).toBe('count');
  });

  it('shows SOLO for a solo kill by a player', () => {
    expect(attackerBadge({ solo: true, npc: false })).toBe('solo');
  });

  it('shows NPC for a solo kill by an NPC', () => {
    expect(attackerBadge({ solo: true, npc: true })).toBe('npc');
  });

  it('shows the NPC count when several attackers were all NPCs', () => {
    expect(attackerBadge({ solo: false, npc: true })).toBe('npc-count');
  });
});
