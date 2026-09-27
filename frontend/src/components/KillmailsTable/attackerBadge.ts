/**
 * Which badge the attackers cell leads with, beside the NPC badge that stands
 * on its own.
 *
 * A solo kill by an NPC would otherwise carry SOLO and NPC side by side, and
 * SOLO there says nothing NPC does not: it is one attacker, and not a player.
 * NPC alone tells it. The count stays beside NPC, where it is still news.
 */
export function attackerBadge({
  solo,
  npc,
}: {
  solo: boolean;
  npc: boolean;
}): 'solo' | 'count' | null {
  if (!solo) return 'count';
  return npc ? null : 'solo';
}
