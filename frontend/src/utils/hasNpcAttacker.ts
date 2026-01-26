// Utility to check if all attackers are NPC corporations
import { Attacker } from '@/generated/graphql';
import { isNPCCorporation } from './isNPCCorporation';

export function hasNpcAttacker(attackers?: Attacker[] | null): boolean {
  if (!attackers || attackers.length === 0) return false;
  return attackers.every(att => isNPCCorporation(att.corporation?.id));
}
