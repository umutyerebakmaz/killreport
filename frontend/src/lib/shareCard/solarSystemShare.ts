import type { ShareSolarSystemQuery } from '@/generated/graphql';
import { eveImageUrl } from '@/utils/eveImageUrl';
import { regionMapUrl } from '@/utils/regionMapUrl';
import { formatSecurityStatus } from '@/utils/security';
import { fileDataUri } from './assets';
import { securityHex } from './palette';

export interface ShareSolarSystem {
  name: string;
  securityStatus: number | null;
  starTypeId: number | null;
  constellationName: string;
  regionId: number | null;
  regionName: string;
  kills24h: number;
  npcKills24h: number;
}

export interface SolarSystemShareCardProps {
  /** Null when the system has no star: the left panel is then plain ground. */
  starImage: string | null;
  /** Null when there is no map file for the region. */
  regionMap: string | null;
  systemName: string;
  secText: string;
  secColor: string;
  constellationName: string;
  regionName: string;
  kills: string;
  npcKills: string;
}

const n = (value: number) => value.toLocaleString('en-US');

export function toShareSolarSystem(
  data: ShareSolarSystemQuery | null | undefined,
): ShareSolarSystem | null {
  if (!data?.solarSystem) return null;
  const { solarSystem: s } = data;
  return {
    name: s.name,
    securityStatus: s.securityStatus ?? null,
    starTypeId: s.star?.typeId ?? null,
    constellationName: s.constellation?.name ?? '',
    regionId: s.constellation?.region?.id ?? null,
    regionName: s.constellation?.region?.name ?? '',
    kills24h: data.solarSystemStats.kills24h,
    npcKills24h: data.systemActivityHistory.reduce(
      (sum, row) => sum + row.npc_kills,
      0,
    ),
  };
}

export async function solarSystemShareProps(
  s: ShareSolarSystem,
): Promise<SolarSystemShareCardProps> {
  return {
    starImage:
      s.starTypeId == null
        ? null
        : eveImageUrl({ kind: 'ship', id: s.starTypeId, size: 256 }),
    regionMap:
      s.regionId == null ? null : await fileDataUri(regionMapUrl(s.regionId)),
    systemName: s.name,
    secText: formatSecurityStatus(s.securityStatus),
    secColor: securityHex(s.securityStatus),
    constellationName: s.constellationName,
    regionName: s.regionName,
    kills: n(s.kills24h),
    npcKills: n(s.npcKills24h),
  };
}

/** `og:title` and `og:description`, no dashes or middle dots. */
export function solarSystemShareText(s: ShareSolarSystem) {
  const where = [
    formatSecurityStatus(s.securityStatus),
    s.constellationName,
    s.regionName,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    title: s.name,
    description: `${where}. ${n(s.kills24h)} kills in the last 24 hours`,
  };
}
