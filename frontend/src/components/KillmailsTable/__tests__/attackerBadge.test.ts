import { describe, expect, it } from 'vitest';
import { attackerBadge } from '../attackerBadge';

describe('attackerBadge', () => {
  it('shows the count for a fight with more than one attacker', () => {
    expect(attackerBadge({ solo: false, npc: false })).toBe('count');
  });

  it('shows SOLO for a solo kill by a player', () => {
    expect(attackerBadge({ solo: true, npc: false })).toBe('solo');
  });

  it('shows nothing beside NPC when an NPC made a solo kill', () => {
    expect(attackerBadge({ solo: true, npc: true })).toBeNull();
  });

  it('keeps the count beside NPC when several attackers were NPCs', () => {
    expect(attackerBadge({ solo: false, npc: true })).toBe('count');
  });
});
