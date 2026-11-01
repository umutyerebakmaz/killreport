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
  frontendUrl: string;
  shipTypeId: number;
  shipName: string | null;
  victim: NamedRef;
  victimCorp: NamedRef;
  victimAlliance: NamedRef;
  finalBlow: NamedRef;
  finalBlowShipName: string | null;
  totalValue: number | null;
  destroyedValue: number | null;
  droppedValue: number | null;
  attackerCount: number;
  system: NamedRef;
  securityStatus: number | null;
  region: NamedRef;
  /** The entities this channel matched on; the first one gives the footer logo. */
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
const FOOTER_LIMIT = 2048;
const NAME_LIMIT = 100;
const UNKNOWN = 'Unknown';
const IMAGE_BASE = 'https://images.evetech.net';
/**
 * Discord draws an embed thumbnail at up to 80px, top right; 256 keeps it
 * sharp on 2x screens. A large `image` would sit under the card and make it
 * much taller, which the card design rules out.
 */
const RENDER_SIZE = 256;

/**
 * Discord sizes an embed to its longest line, so cards with short names come
 * out narrower. The footer is padded with U+2800 (braille blank, which Discord
 * does not trim) to push every card to the same width; 70 was picked from
 * sample cards in a real channel. The embed carries no `timestamp`: Discord
 * would join it to the footer with a bullet that the padding pushes to the
 * far right on its own. The message's own post time is shown anyway.
 */
export const EMBED_WIDTH_PAD = 70;

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

/**
 * The site's `formatISK` (frontend/src/utils/formatISK.ts) with an ISK
 * suffix: two decimals above a thousand, whole ISK below.
 */
export function formatIsk(value: number): string {
  for (const [size, unit] of ISK_UNITS) {
    if (Math.abs(value) >= size) {
      return `${(value / size).toFixed(2)}${unit} ISK`;
    }
  }
  return `${Math.round(value).toLocaleString('en-US')} ISK`;
}

type PageType = EntityRef['type'] | 'SYSTEM' | 'REGION';

const PAGE: Record<PageType, string> = {
  CHARACTER: 'characters',
  CORPORATION: 'corporations',
  ALLIANCE: 'alliances',
  SYSTEM: 'solar-systems',
  REGION: 'regions',
};

const imageOf = (type: EntityRef['type'], id: number, size: number): string =>
  type === 'CHARACTER'
    ? `${IMAGE_BASE}/characters/${id}/portrait?size=${size}`
    : `${IMAGE_BASE}/${PAGE[type]}/${id}/logo?size=${size}`;

export function buildKillmailEmbed(input: EmbedInput): DiscordPayload {
  const base = input.frontendUrl.replace(/\/+$/, '');
  const pageOf = (type: PageType, id: number) => `${base}/${PAGE[type]}/${id}`;

  /** A linked, escaped name; an unknown name is plain `Unknown`, unlinked. */
  const link = (type: PageType, ref: NamedRef): string => {
    if (ref.name === null) return UNKNOWN;
    const text = escapeMd(cap(ref.name, NAME_LIMIT));
    return ref.id === null ? text : `[${text}](${pageOf(type, ref.id)})`;
  };
  const isk = (value: number | null) =>
    value === null ? UNKNOWN : formatIsk(value);

  // The victim is a character, or for a structure its corporation.
  const authorRef: { type: EntityRef['type']; ref: NamedRef } =
    input.victim.name !== null
      ? { type: 'CHARACTER', ref: input.victim }
      : { type: 'CORPORATION', ref: input.victimCorp };
  const author =
    authorRef.ref.name === null || authorRef.ref.id === null
      ? { name: cap(authorRef.ref.name ?? UNKNOWN, TITLE_LIMIT) }
      : {
          name: cap(authorRef.ref.name, TITLE_LIMIT),
          icon_url: imageOf(authorRef.type, authorRef.ref.id, 128),
          url: pageOf(authorRef.type, authorRef.ref.id),
        };

  const affiliation =
    input.victimCorp.name === null && input.victimAlliance.name === null
      ? UNKNOWN
      : [
          ...(input.victimCorp.name === null
            ? []
            : [link('CORPORATION', input.victimCorp)]),
          ...(input.victimAlliance.name === null
            ? []
            : [link('ALLIANCE', input.victimAlliance)]),
        ].join(', ');

  const finalBlow =
    input.finalBlow.name === null && input.finalBlowShipName === null
      ? UNKNOWN
      : `${link('CHARACTER', input.finalBlow)}\n${escapeMd(input.finalBlowShipName ?? UNKNOWN)}`;

  const location =
    input.system.name === null && input.region.name === null
      ? UNKNOWN
      : `${link('SYSTEM', input.system)}${
          input.securityStatus === null
            ? ''
            : ` (${input.securityStatus.toFixed(1)})`
        }\n${link('REGION', input.region)}`;

  const lead = input.entities[0];
  const entityNames = input.entities.map((e) => e.name ?? UNKNOWN).join(', ');

  const embed = {
    author,
    title: cap(input.shipName ?? UNKNOWN, TITLE_LIMIT),
    url: `${base}/killmails/${input.killmailId}`,
    description: cap(affiliation, 4096),
    color: input.kind === 'loss' ? LOSS_COLOR : KILL_COLOR,
    fields: [
      { name: 'DESTROYED', value: isk(input.destroyedValue), inline: true },
      { name: 'DROPPED', value: isk(input.droppedValue), inline: true },
      { name: 'TOTAL', value: `**${isk(input.totalValue)}**`, inline: true },
      { name: 'FINAL BLOW', value: cap(finalBlow), inline: true },
      { name: 'ATTACKERS', value: String(input.attackerCount), inline: true },
      { name: 'LOCATION', value: cap(location), inline: true },
    ],
    thumbnail: {
      url: `${IMAGE_BASE}/types/${input.shipTypeId}/render?size=${RENDER_SIZE}`,
    },
    footer: {
      text: cap(
        `${entityNames} ${'\u2800'.repeat(EMBED_WIDTH_PAD)}`,
        FOOTER_LIMIT,
      ),
      icon_url: imageOf(lead.type, lead.id, 64),
    },
  };
  return { embeds: [embed], allowed_mentions: NO_MENTIONS };
}
