import { createHash } from 'node:crypto';

/**
 * Pure helpers for Discord webhook notifications: URL normalisation, the age
 * rules, kill/loss matching and the embed builder. No database, no network.
 */

export const MAX_KILLMAIL_AGE_MS = 60 * 60 * 1000;
export const WEBHOOK_LIMIT = 10;

const WEBHOOK_PATH = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)\/?$/;

/** Canonical `https://discord.com/api/webhooks/{id}/{token}`, or null. */
export function normalizeWebhookUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== 'discord.com' && parsed.hostname !== 'discordapp.com')
    return null;
  const match = WEBHOOK_PATH.exec(parsed.pathname);
  if (!match) return null;
  return `https://discord.com/api/webhooks/${match[1]}/${match[2]}`;
}

/** First 16 hex chars of sha256 — safe to log or use in a Redis key. */
export function webhookUrlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

export function isEligible(
  killmailTime: Date,
  activeSince: Date,
  now: Date,
): boolean {
  const t = killmailTime.getTime();
  return t >= activeSince.getTime() && t >= now.getTime() - MAX_KILLMAIL_AGE_MS;
}

export type EntityRef = {
  type: 'CHARACTER' | 'CORPORATION' | 'ALLIANCE';
  id: number;
};
export type Party = {
  characterId: number | null;
  corporationId: number | null;
  allianceId: number | null;
};
export type KillmailParties = { victim: Party; attackers: Party[] };
export type WebhookRow = {
  id: number;
  url: string;
  entityType: EntityRef['type'];
  entityId: number;
  activeSince: Date;
};
export type Delivery = {
  url: string;
  webhookIds: number[];
  kind: 'kill' | 'loss';
  entities: EntityRef[];
};

function partyHas(party: Party, type: EntityRef['type'], id: number): boolean {
  switch (type) {
    case 'CHARACTER':
      return party.characterId === id;
    case 'CORPORATION':
      return party.corporationId === id;
    case 'ALLIANCE':
      return party.allianceId === id;
  }
}

/**
 * Which webhook URLs get this killmail, and as what. A victim-side match is a
 * loss (also when both sides match), an attacker-side match a kill. One URL
 * yields one delivery; a single loss makes the whole delivery a loss.
 */
export function planDeliveries(
  parties: KillmailParties,
  rows: WebhookRow[],
  killmailTime: Date,
  now: Date,
): Delivery[] {
  const byUrl = new Map<string, Delivery>();
  for (const row of rows) {
    if (!isEligible(killmailTime, row.activeSince, now)) continue;
    let kind: Delivery['kind'];
    if (partyHas(parties.victim, row.entityType, row.entityId)) {
      kind = 'loss';
    } else if (
      parties.attackers.some((a) => partyHas(a, row.entityType, row.entityId))
    ) {
      kind = 'kill';
    } else {
      continue;
    }
    let delivery = byUrl.get(row.url);
    if (!delivery) {
      delivery = { url: row.url, webhookIds: [], kind, entities: [] };
      byUrl.set(row.url, delivery);
    }
    if (kind === 'loss') delivery.kind = 'loss';
    delivery.webhookIds.push(row.id);
    if (
      !delivery.entities.some(
        (e) => e.type === row.entityType && e.id === row.entityId,
      )
    ) {
      delivery.entities.push({ type: row.entityType, id: row.entityId });
    }
  }
  return [...byUrl.values()];
}

/** An id/name pair read from the database; either half may be missing. */
export type NamedRef = { id: number | null; name: string | null };

export type EmbedInput = {
  kind: 'kill' | 'loss';
  killmailId: number;
  killmailTime: Date;
  frontendUrl: string;
  shipTypeId: number;
  shipName: string | null;
  victim: NamedRef;
  victimCorp: NamedRef;
  victimAlliance: NamedRef;
  finalBlow: NamedRef;
  finalBlowShipName: string | null;
  totalValue: number | null;
  attackerCount: number;
  systemName: string | null;
  securityStatus: number | null;
  regionName: string | null;
  /** The entities this channel matched on; the first one gives the author logo. */
  entities: { type: EntityRef['type']; id: number; name: string | null }[];
};
export type DiscordPayload = {
  content?: string;
  embeds?: Record<string, unknown>[];
  allowed_mentions?: { parse: never[] };
};

export const NO_MENTIONS: { parse: never[] } = { parse: [] };

const KILL_COLOR = 0x2ecc71;
const LOSS_COLOR = 0xe74c3c;
const FIELD_LIMIT = 1024;
const TITLE_LIMIT = 256;
const NAME_LIMIT = 100;
const UNKNOWN = 'Unknown';
const IMAGE_BASE = 'https://images.evetech.net';

/**
 * Discord sizes an embed to its longest line, so short kills render narrower
 * than long ones. A footer line of U+2800 (braille blank — Discord does not
 * trim it) longer than the embed's maximum width makes every card open to
 * that maximum. Tune the count if cards still differ.
 */
export const EMBED_WIDTH_PAD = 60;

const cap = (value: string, limit = FIELD_LIMIT): string =>
  value.slice(0, limit);

/**
 * Backslash the inline markdown characters. `#`, `-` and `>` only mean
 * something at the start of a line, and no name is ever placed there.
 */
const escapeMd = (value: string): string =>
  value.replace(/[\\*_~`|[\]()]/g, '\\$&');

const ISK_UNITS: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** `1240512330` → `1.24B ISK`: at most two decimals, trailing zeros dropped. */
export function formatIsk(value: number): string {
  for (const [size, unit] of ISK_UNITS) {
    if (Math.abs(value) >= size) {
      return `${Number((value / size).toFixed(2))}${unit} ISK`;
    }
  }
  return `${Math.round(value)} ISK`;
}

const PAGE: Record<EntityRef['type'], string> = {
  CHARACTER: 'characters',
  CORPORATION: 'corporations',
  ALLIANCE: 'alliances',
};

const ICON: Record<EntityRef['type'], string> = {
  CHARACTER: 'portrait',
  CORPORATION: 'logo',
  ALLIANCE: 'logo',
};

const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

export function buildKillmailEmbed(input: EmbedInput): DiscordPayload {
  const base = input.frontendUrl.replace(/\/+$/, '');

  /** A linked, escaped name; an unknown name is plain `Unknown`, unlinked. */
  const link = (type: EntityRef['type'], ref: NamedRef): string =>
    ref.name === null
      ? UNKNOWN
      : ref.id === null
        ? escapeMd(cap(ref.name, NAME_LIMIT))
        : `[${escapeMd(cap(ref.name, NAME_LIMIT))}](${base}/${PAGE[type]}/${ref.id})`;

  const ship = input.shipName ?? UNKNOWN;
  const victimLabel = input.victim.name ?? input.victimCorp.name ?? UNKNOWN;

  const victimLines =
    input.victim.name === null && input.victimCorp.name === null
      ? UNKNOWN
      : [
          ...(input.victim.name === null
            ? []
            : [link('CHARACTER', input.victim)]),
          [
            link('CORPORATION', input.victimCorp),
            ...(input.victimAlliance.name === null
              ? []
              : [link('ALLIANCE', input.victimAlliance)]),
          ].join(' / '),
        ].join('\n');

  const finalBlow =
    input.finalBlow.name === null && input.finalBlowShipName === null
      ? UNKNOWN
      : `${link('CHARACTER', input.finalBlow)} (${escapeMd(input.finalBlowShipName ?? UNKNOWN)})`;

  const location =
    input.systemName === null && input.regionName === null
      ? UNKNOWN
      : `${escapeMd(input.systemName ?? UNKNOWN)}${
          input.securityStatus === null
            ? ''
            : ` (${input.securityStatus.toFixed(1)})`
        } · ${escapeMd(input.regionName ?? UNKNOWN)}`;

  const value =
    input.totalValue === null ? 'Unknown value' : formatIsk(input.totalValue);
  const attackers = `${input.attackerCount} attacker${input.attackerCount === 1 ? '' : 's'}`;

  const lead = input.entities[0];
  const entityNames = input.entities.map((e) => e.name ?? UNKNOWN).join(', ');

  const embed = {
    author: {
      name: cap(
        `${input.kind === 'loss' ? 'LOSS' : 'KILL'} · ${entityNames}`,
        TITLE_LIMIT,
      ),
      icon_url: `${IMAGE_BASE}/${PAGE[lead.type]}/${lead.id}/${ICON[lead.type]}?size=64`,
      url: `${base}/${PAGE[lead.type]}/${lead.id}`,
    },
    title: cap(`${victimLabel} lost ${article(ship)} ${ship}`, TITLE_LIMIT),
    url: `${base}/killmails/${input.killmailId}`,
    description: `**${value}** · ${attackers}`,
    color: input.kind === 'loss' ? LOSS_COLOR : KILL_COLOR,
    thumbnail: {
      url: `${IMAGE_BASE}/types/${input.shipTypeId}/render?size=128`,
    },
    fields: [
      { name: 'Victim', value: cap(victimLines) },
      { name: 'Final blow', value: cap(finalBlow) },
      { name: 'Location', value: cap(location) },
    ],
    timestamp: input.killmailTime.toISOString(),
    footer: { text: `KillReport ${'\u2800'.repeat(EMBED_WIDTH_PAD)}` },
  };
  return { embeds: [embed], allowed_mentions: NO_MENTIONS };
}
