import { Killmail } from './types';

interface KillmailRowStylesParams {
  killmail: Killmail;
  characterId?: number;
  corporationId?: number;
  allianceId?: number;
  variant?: 'detail' | 'list';
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
  variant = 'list',
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
  // The greys are the theme's own. neutral and gray are different families —
  // neutral is flat, gray carries a blue cast — so bg-neutral-900 rows read
  // slightly warm against the gray-900 head and cards around them. list maps
  // to the two surface tokens; detail keeps its one-step-lighter footing on
  // the same gray ramp, since the theme names no third surface.
  if (variant === 'detail') {
    return {
      totalValueColor: 'text-orange-400',
      rowBgColor: 'bg-surface-inset',
      rowHoverColor: 'hover:bg-gray-700',
    };
  }

  return {
    totalValueColor: 'text-orange-400',
    rowBgColor: 'bg-surface',
    rowHoverColor: 'hover:bg-surface-inset',
  };
}
