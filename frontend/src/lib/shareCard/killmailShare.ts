import { SHIP_TIER_ICONS } from '@/components/ShipTierBadge/ShipTierBadge';
import type { ShareKillmailQuery } from '@/generated/graphql';
import { formatEveDateTime } from '@/utils/date';
import { eveImageUrl } from '@/utils/eveImageUrl';
import { formatISK } from '@/utils/formatISK';
import { getShipTier } from '@/utils/shipTier';
import { securityHex } from './palette';

type RawKillmail = NonNullable<ShareKillmailQuery['killmail']>;

/** A killmail that has its victim; the route answers 404 for one without. */
export type Killmail = RawKillmail & {
  victim: NonNullable<RawKillmail['victim']>;
};

export const hasVictim = (km: RawKillmail | null | undefined): km is Killmail =>
  !!km?.victim;

export interface KillmailShareCardProps {
  /** Victim portrait, or the corporation logo when there is no character. */
  portrait: string;
  victimName: string;
  memberships: { logo: string; name: string }[];
  shipImage: string;
  /** Public path of the tier icon, null for T1 and untiered hulls. */
  tierIcon: string | null;
  date: string;
  total: string;
  destroyed: string;
  dropped: string;
  shipName: string;
  secText: string;
  secColor: string;
  systemName: string;
  regionName: string;
  solo: boolean;
  npc: boolean;
  attackerCount: number;
}

export function killmailShareProps(km: Killmail): KillmailShareCardProps {
  const { victim, solarSystem } = km;
  const { character, corporation, alliance, shipType } = victim;
  const tier = getShipTier(shipType);
  const memberships: KillmailShareCardProps['memberships'] = [];
  if (corporation) {
    memberships.push({
      logo: eveImageUrl({ kind: 'corporation', id: corporation.id, size: 44 }),
      name: corporation.name,
    });
  }
  if (alliance) {
    memberships.push({
      logo: eveImageUrl({ kind: 'alliance', id: alliance.id, size: 44 }),
      name: alliance.name,
    });
  }
  const portrait = character
    ? eveImageUrl({ kind: 'character', id: character.id, size: 256 })
    : corporation
      ? eveImageUrl({ kind: 'corporation', id: corporation.id, size: 256 })
      : eveImageUrl({ kind: 'ship', id: shipType.id, size: 256 });
  const sec = solarSystem.securityStatus;
  return {
    portrait,
    victimName: character?.name ?? corporation?.name ?? shipType.name,
    memberships,
    shipImage: eveImageUrl({ kind: 'ship', id: shipType.id, size: 256 }),
    tierIcon: tier ? SHIP_TIER_ICONS[tier].src : null,
    date: formatEveDateTime(km.killmailTime),
    total: `${formatISK(km.totalValue)} ISK`,
    destroyed: `${formatISK(km.destroyedValue)} destroyed`,
    dropped: `${formatISK(km.droppedValue)} dropped`,
    shipName: shipType.name,
    secText: sec == null ? '' : sec.toFixed(1),
    secColor: securityHex(sec),
    systemName: solarSystem.name,
    regionName: solarSystem.constellation?.region?.name ?? '',
    solo: km.solo,
    npc: km.npc,
    attackerCount: km.attackerCount,
  };
}

/** `og:title` and `og:description`, no dashes or middle dots. */
export function killmailShareText(km: Killmail): {
  title: string;
  description: string;
} {
  const { victim, solarSystem } = km;
  const who =
    victim.character?.name ?? victim.corporation?.name ?? 'A structure';
  const region = solarSystem.constellation?.region?.name;
  const attackers = km.npc
    ? 'NPC'
    : km.solo
      ? 'solo'
      : `${km.attackerCount} attackers`;
  return {
    title: `${who} lost a ${victim.shipType.name}`,
    description: `${formatISK(km.totalValue)} ISK, ${solarSystem.name}${region ? ` (${region})` : ''}, ${attackers}`,
  };
}
