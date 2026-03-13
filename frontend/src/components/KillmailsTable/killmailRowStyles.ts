import { Killmail } from "./types";

interface KillmailRowStylesParams {
  killmail: Killmail;
  characterId?: number;
  corporationId?: number;
  allianceId?: number;
  variant?: "detail" | "list";
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
  variant = "list",
}: KillmailRowStylesParams): KillmailRowStyles {
  const hasEntity = Boolean(characterId || corporationId || allianceId);

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
    (characterId && km.attackers?.some(a => a.character?.id === characterId)) ||
    (corporationId && km.attackers?.some(a => a.corporation?.id === corporationId)) ||
    (allianceId && km.attackers?.some(a => a.alliance?.id === allianceId)),
  );

  // No entity provided - use neutral colors based on variant
  if (!hasEntity) {
    return {
      totalValueColor: "text-orange-400",
      rowBgColor: variant === "list" ? "bg-neutral-900" : "bg-neutral-800",
      rowHoverColor:
        variant === "list" ? "hover:bg-neutral-800" : "hover:bg-neutral-700",
    };
  }

  // Entity exists but is neither victim nor attacker - use neutral colors based on variant
  if (!isVictim && !isAttacker) {
    return {
      totalValueColor: "text-orange-400",
      rowBgColor: variant === "list" ? "bg-neutral-900" : "bg-neutral-800",
      rowHoverColor:
        variant === "list" ? "hover:bg-neutral-800" : "hover:bg-neutral-700",
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
    rowHoverColor: characterId ? "hover:bg-green-500/20" : "hover:bg-green-500/30",
  };
}
