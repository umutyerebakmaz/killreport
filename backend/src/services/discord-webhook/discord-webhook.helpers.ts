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

export type EmbedInput = {
  kind: 'kill' | 'loss';
  killmailId: number;
  killmailTime: Date;
  frontendUrl: string;
  shipTypeId: number;
  shipName: string | null;
  victimName: string | null;
  victimCorpName: string | null;
  victimAllianceName: string | null;
  finalBlowName: string | null;
  finalBlowShipName: string | null;
  totalValue: number | null;
  attackerCount: number;
  systemName: string | null;
  securityStatus: number | null;
  regionName: string | null;
  footerEntityNames: string[];
};
export type DiscordPayload = {
  content?: string;
  embeds?: Record<string, unknown>[];
};

const KILL_COLOR = 0x2ecc71;
const LOSS_COLOR = 0xe74c3c;
const FIELD_LIMIT = 1024;
const UNKNOWN = 'Unknown';

const orUnknown = (value: string | null): string => value ?? UNKNOWN;
const cap = (value: string): string => value.slice(0, FIELD_LIMIT);

export function buildKillmailEmbed(input: EmbedInput): DiscordPayload {
  const ship = orUnknown(input.shipName);
  const finalBlow =
    input.finalBlowName === null && input.finalBlowShipName === null
      ? UNKNOWN
      : `${orUnknown(input.finalBlowName)} (${orUnknown(input.finalBlowShipName)})`;
  const location =
    input.systemName === null && input.regionName === null
      ? UNKNOWN
      : `${orUnknown(input.systemName)}${
          input.securityStatus === null
            ? ''
            : ` (${input.securityStatus.toFixed(1)})`
        } · ${orUnknown(input.regionName)}`;
  const value =
    input.totalValue === null
      ? UNKNOWN
      : `${Math.round(input.totalValue).toLocaleString('en-US')} ISK`;

  const embed = {
    title: cap(`${ship} — ${orUnknown(input.victimName)}`).slice(0, 256),
    url: `${input.frontendUrl}/killmails/${input.killmailId}`,
    color: input.kind === 'loss' ? LOSS_COLOR : KILL_COLOR,
    thumbnail: {
      url: `https://images.evetech.net/types/${input.shipTypeId}/render?size=128`,
    },
    fields: [
      {
        name: 'Corporation',
        value: cap(orUnknown(input.victimCorpName)),
        inline: true,
      },
      {
        name: 'Alliance',
        value: cap(orUnknown(input.victimAllianceName)),
        inline: true,
      },
      { name: 'Final blow', value: cap(finalBlow), inline: false },
      { name: 'Value', value: cap(value), inline: true },
      { name: 'Attackers', value: String(input.attackerCount), inline: true },
      { name: 'System', value: cap(location), inline: false },
    ],
    timestamp: input.killmailTime.toISOString(),
    footer: {
      text: `KillReport · ${input.footerEntityNames.join(', ')}`.slice(0, 2048),
    },
  };
  return { embeds: [embed] };
}
