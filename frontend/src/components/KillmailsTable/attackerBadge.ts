/**
 * The one badge the attackers cell shows.
 *
 * `npc` means every attacker was an NPC, so a row is exactly one of four
 * cases and never needs two badges: a player alone (SOLO), players in a
 * fight (the count), an NPC alone (NPC), NPCs in a fight (the count, under
 * the NPC icon). Two badges side by side read as two groups of attackers.
 */
export function attackerBadge({
  solo,
  npc,
}: {
  solo: boolean;
  npc: boolean;
}): 'solo' | 'count' | 'npc' | 'npc-count' {
  if (npc) return solo ? 'npc' : 'npc-count';
  return solo ? 'solo' : 'count';
}
