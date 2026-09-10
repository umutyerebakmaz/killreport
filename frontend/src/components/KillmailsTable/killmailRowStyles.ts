import { Killmail } from './types';

interface KillmailRowStylesParams {
  killmail: Killmail;
  characterId?: number;
  corporationId?: number;
  allianceId?: number;
}

interface KillmailRowStyles {
  totalValueColor: string;
  rowBgColor: string;
  rowHoverColor: string;
}

/**
 * Calculates the styling classes for a killmail row based on whether
 * the provided entity (character, corporation, or alliance) is the victim or attacker
 */
export function getKillmailRowStyles({
  killmail: km,
  characterId,
  corporationId,
  allianceId,
}: KillmailRowStylesParams): KillmailRowStyles {
  // Check if the entity is the victim
  const isVictim = Boolean(
    (characterId && km.victim?.character?.id === characterId) ||
    (corporationId && km.victim?.corporation?.id === corporationId) ||
    (allianceId && km.victim?.alliance?.id === allianceId),
  );

  // Check if the entity is among the attackers
  // For corporations/alliances: check if ANY attacker belongs to that entity
  // For characters: check if the character is in the attackers list
  const isAttacker = Boolean(
    (characterId &&
      km.attackers?.some((a) => a.character?.id === characterId)) ||
    (corporationId &&
      km.attackers?.some((a) => a.corporation?.id === corporationId)) ||
    (allianceId && km.attackers?.some((a) => a.alliance?.id === allianceId)),
  );

  // Entity is victim (loss) - use red colors
  if (isVictim) {
    return {
      totalValueColor: 'text-red-500',
      rowBgColor: characterId ? 'bg-red-500/15' : 'bg-red-500/20',
      rowHoverColor: characterId
        ? 'hover:bg-red-500/20'
        : 'hover:bg-red-500/30',
    };
  }

  // Entity is attacker (kill) - use green colors
  if (isAttacker) {
    return {
      totalValueColor: 'text-green-500',
      rowBgColor: characterId ? 'bg-green-500/15' : 'bg-green-500/20',
      rowHoverColor: characterId
        ? 'hover:bg-green-500/20'
        : 'hover:bg-green-500/30',
    };
  }

  // Not involved, or no entity to be involved with. One branch, not two: an
  // absent entity cannot be a victim or an attacker either, so the old
  // !hasEntity case returned exactly this and never reached anything else.
  //
  // The greys are the theme's own, and there is one set of them. A `detail`
  // variant used to lift these rows to surface-inset, because the only table
  // whose rows are neutral — the killmails tab of a detail page — sat inside a
  // .card and would have matched it exactly. That container is .tab-shell's
  // ground now, so the lift is gone: a row rests on surface and hovers to
  // surface-inset, on every page.
  return {
    totalValueColor: 'text-orange-400',
    rowBgColor: 'bg-surface',
    rowHoverColor: 'hover:bg-surface-inset',
  };
}
