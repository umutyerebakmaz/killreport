import type {
  ShareAllianceQuery,
  ShareCharacterQuery,
  ShareCorporationQuery,
} from '@/generated/graphql';
import { eveImageUrl } from '@/utils/eveImageUrl';
import { blurredBackdropUri } from './backdrop';

type Named = { id: number; name: string };

export interface ShareCharacter {
  id: number;
  name: string;
  corporation: Named | null;
  alliance: Named | null;
  kills: number;
  losses: number;
}

export interface ShareCorporation {
  id: number;
  name: string;
  memberCount: number;
  alliance: Named | null;
  kills: number;
  losses: number;
}

export interface ShareAlliance {
  id: number;
  name: string;
  memberCount: number;
  corporationCount: number;
  sovCount: number;
  kills: number;
  losses: number;
}

interface Bars {
  kills: number;
  losses: number;
}

export interface CharacterShareCardProps {
  portrait: string;
  /** Blurred backdrop SVG data URI; null when the image could not be fetched. */
  backdrop: string | null;
  name: string;
  memberships: { logo: string; name: string }[];
  kills: string;
  losses: string;
  bars: Bars | null;
}

export interface CorporationShareCardProps {
  logo: string;
  /** Blurred backdrop SVG data URI; null when the image could not be fetched. */
  backdrop: string | null;
  name: string;
  memberships: { logo: string; name: string }[];
  members: string;
  kills: string;
  losses: string;
  bars: Bars | null;
}

export interface AllianceShareCardProps {
  logo: string;
  /** Blurred backdrop SVG data URI; null when the image could not be fetched. */
  backdrop: string | null;
  name: string;
  members: string;
  corporations: string;
  sov: string;
  kills: string;
  losses: string;
  bars: Bars | null;
}

const n = (value: number) => value.toLocaleString('en-US');
const bars = (kills: number, losses: number): Bars | null =>
  kills > 0 || losses > 0 ? { kills, losses } : null;
const membership = (kind: 'corporation' | 'alliance', e: Named) => ({
  logo: eveImageUrl({ kind, id: e.id, size: 44 }),
  name: e.name,
});

/** Joins the parts that exist: `Clown Swords., Fraternity.` */
const names = (...parts: (Named | null | undefined)[]) =>
  parts
    .filter((p): p is Named => !!p)
    .map((p) => p.name)
    .join(', ');

export function toShareCharacter(
  id: number,
  data: ShareCharacterQuery | null | undefined,
): ShareCharacter | null {
  if (!data?.character) return null;
  const { character, characterKillLossTotals: t } = data;
  return {
    id,
    name: character.name,
    corporation: character.corporation ?? null,
    alliance: character.alliance ?? null,
    kills: t.kills,
    losses: t.losses,
  };
}

export function toShareCorporation(
  id: number,
  data: ShareCorporationQuery | null | undefined,
): ShareCorporation | null {
  if (!data?.corporation) return null;
  const { corporation: c, corporationKillLossTotals: t } = data;
  return {
    id,
    name: c.name,
    memberCount: c.member_count ?? 0,
    alliance: c.alliance ?? null,
    kills: t.kills,
    losses: t.losses,
  };
}

export function toShareAlliance(
  id: number,
  data: ShareAllianceQuery | null | undefined,
): ShareAlliance | null {
  if (!data?.alliance) return null;
  const { alliance: a, allianceKillLossTotals: t } = data;
  return {
    id,
    name: a.name,
    memberCount: a.memberCount ?? 0,
    corporationCount: a.corporationCount ?? 0,
    sovCount: a.sovereigntySystemCount ?? 0,
    kills: t.kills,
    losses: t.losses,
  };
}

export async function characterShareProps(
  c: ShareCharacter,
): Promise<CharacterShareCardProps> {
  const memberships = [];
  if (c.corporation) memberships.push(membership('corporation', c.corporation));
  if (c.alliance) memberships.push(membership('alliance', c.alliance));
  return {
    portrait: eveImageUrl({ kind: 'character', id: c.id, size: 256 }),
    backdrop: await blurredBackdropUri(
      eveImageUrl({ kind: 'character', id: c.id, size: 64 }),
    ),
    name: c.name,
    memberships,
    kills: n(c.kills),
    losses: n(c.losses),
    bars: bars(c.kills, c.losses),
  };
}

export async function corporationShareProps(
  c: ShareCorporation,
): Promise<CorporationShareCardProps> {
  return {
    logo: eveImageUrl({ kind: 'corporation', id: c.id, size: 256 }),
    backdrop: await blurredBackdropUri(
      eveImageUrl({ kind: 'corporation', id: c.id, size: 64 }),
    ),
    name: c.name,
    memberships: c.alliance ? [membership('alliance', c.alliance)] : [],
    members: n(c.memberCount),
    kills: n(c.kills),
    losses: n(c.losses),
    bars: bars(c.kills, c.losses),
  };
}

export async function allianceShareProps(
  a: ShareAlliance,
): Promise<AllianceShareCardProps> {
  return {
    logo: eveImageUrl({ kind: 'alliance', id: a.id, size: 256 }),
    backdrop: await blurredBackdropUri(
      eveImageUrl({ kind: 'alliance', id: a.id, size: 64 }),
    ),
    name: a.name,
    members: n(a.memberCount),
    corporations: n(a.corporationCount),
    sov: n(a.sovCount),
    kills: n(a.kills),
    losses: n(a.losses),
    bars: bars(a.kills, a.losses),
  };
}

/** `og:title` and `og:description`, no dashes or middle dots. */
export function characterShareText(c: ShareCharacter) {
  const who = names(c.corporation, c.alliance);
  return {
    title: c.name,
    description: `${who ? `${who} ` : ''}${n(c.kills)} kills, ${n(c.losses)} losses`,
  };
}

export function corporationShareText(c: ShareCorporation) {
  const who = names(c.alliance);
  return {
    title: c.name,
    description: `${who ? `${who} ` : ''}${n(c.memberCount)} members, ${n(c.kills)} kills, ${n(c.losses)} losses`,
  };
}

export function allianceShareText(a: ShareAlliance) {
  return {
    title: a.name,
    description: `${n(a.memberCount)} members, ${n(a.corporationCount)} corporations, ${n(a.sovCount)} sov systems`,
  };
}
