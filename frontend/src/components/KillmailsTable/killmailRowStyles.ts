import { Killmail } from "./types";

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
  const hasEntity = Boolean(characterId || corporationId || allianceId);

  // Check if the entity is the victim
  const isVictim = Boolean(
    (characterId && km.victim?.character?.id === characterId) ||
    (corporationId && km.victim?.corporation?.id === corporationId) ||
    (allianceId && km.victim?.alliance?.id === allianceId)
  );

  // No entity provided - use neutral colors
  if (!hasEntity) {
    return {
      totalValueColor: "text-orange-400",
      rowBgColor: "bg-white/5",
      rowHoverColor: "hover:bg-white/8",
    };
  }

  // Entity is victim (loss) - use red colors
  if (isVictim) {
    return {
      totalValueColor: "text-red-500",
      rowBgColor: characterId ? "bg-red-500/15" : "bg-red-500/20",
      rowHoverColor: characterId ? "hover:bg-red-500/20" : "hover:bg-red-500/30",
    };
  }

  // Entity is attacker (kill) - use green colors
  return {
    totalValueColor: "text-green-500",
    rowBgColor: characterId ? "bg-green-500/15" : "bg-green-500/20",
    rowHoverColor: "hover:bg-green-500/20",
  };
}
