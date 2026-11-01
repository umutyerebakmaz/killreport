import { describe, expect, it } from 'vitest';
import {
  buildKillmailEmbed,
  isEligible,
  normalizeWebhookUrl,
  planDeliveries,
  webhookUrlHash,
  type EmbedInput,
  type KillmailParties,
  type Party,
  type WebhookRow,
} from './discord-webhook.helpers';

describe('normalizeWebhookUrl', () => {
  it('canonicalises discordapp.com, strips query and trailing slash', () => {
    expect(
      normalizeWebhookUrl(
        'https://discordapp.com/api/webhooks/123/abc-DEF_9/?wait=true',
      ),
    ).toBe('https://discord.com/api/webhooks/123/abc-DEF_9');
  });
  it('rejects non-discord hosts, http and malformed paths', () => {
    expect(normalizeWebhookUrl('https://evil.com/api/webhooks/1/a')).toBeNull();
    expect(
      normalizeWebhookUrl('http://discord.com/api/webhooks/1/a'),
    ).toBeNull();
    expect(
      normalizeWebhookUrl('https://discord.com/api/webhooks/x/a'),
    ).toBeNull();
    expect(normalizeWebhookUrl('not a url')).toBeNull();
  });
});

describe('webhookUrlHash', () => {
  it('is 16 hex chars, stable, and does not contain the token', () => {
    const h = webhookUrlHash('https://discord.com/api/webhooks/1/secret');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(h).toBe(webhookUrlHash('https://discord.com/api/webhooks/1/secret'));
    expect(h).not.toContain('secret');
  });
});

describe('isEligible', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('rejects killmails before active_since', () => {
    expect(
      isEligible(
        new Date('2026-11-01T11:50:00Z'),
        new Date('2026-11-01T11:55:00Z'),
        now,
      ),
    ).toBe(false);
  });
  it('rejects killmails older than 60 minutes even if after active_since', () => {
    expect(
      isEligible(
        new Date('2026-11-01T10:59:59Z'),
        new Date('2026-08-01T00:00:00Z'),
        now,
      ),
    ).toBe(false);
  });
  it('accepts exactly 60 minutes old and after active_since', () => {
    expect(
      isEligible(
        new Date('2026-11-01T11:00:00Z'),
        new Date('2026-08-01T00:00:00Z'),
        now,
      ),
    ).toBe(true);
  });
});

describe('planDeliveries', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const killTime = new Date('2026-11-01T11:59:00Z');
  const past = new Date('2026-08-01T00:00:00Z');
  const URL_A = 'https://discord.com/api/webhooks/1/a';
  const URL_B = 'https://discord.com/api/webhooks/2/b';

  const party = (p: Partial<Party>): Party => ({
    characterId: null,
    corporationId: null,
    allianceId: null,
    ...p,
  });
  // victim corp 10, attacker corp 20
  const parties: KillmailParties = {
    victim: party({ characterId: 1, corporationId: 10, allianceId: 100 }),
    attackers: [
      party({ characterId: 2, corporationId: 20, allianceId: 200 }),
      party({ characterId: 3, corporationId: 21, allianceId: null }),
    ],
  };
  const row = (over: Partial<WebhookRow>): WebhookRow => ({
    id: 1,
    url: URL_A,
    entityType: 'CORPORATION',
    entityId: 10,
    activeSince: past,
    ...over,
  });

  it('marks victim-side match as loss and attacker-side as kill', () => {
    const rows = [
      row({ id: 1, url: URL_A, entityType: 'CORPORATION', entityId: 10 }),
      row({ id: 2, url: URL_B, entityType: 'CORPORATION', entityId: 20 }),
    ];
    expect(planDeliveries(parties, rows, killTime, now)).toEqual([
      {
        url: URL_A,
        webhookIds: [1],
        kind: 'loss',
        entities: [{ type: 'CORPORATION', id: 10 }],
      },
      {
        url: URL_B,
        webhookIds: [2],
        kind: 'kill',
        entities: [{ type: 'CORPORATION', id: 20 }],
      },
    ]);
  });

  it('intra-corp kill (corp on both sides) is a loss', () => {
    const intra: KillmailParties = {
      victim: party({ characterId: 1, corporationId: 10 }),
      attackers: [party({ characterId: 2, corporationId: 10 })],
    };
    const out = planDeliveries(intra, [row({})], killTime, now);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('loss');
  });

  it('one url bound to two matching entities yields one delivery with both entities and loss priority', () => {
    const rows = [
      row({ id: 1, entityType: 'CORPORATION', entityId: 20 }), // attacker -> kill
      row({ id: 2, entityType: 'ALLIANCE', entityId: 100 }), // victim -> loss
    ];
    expect(planDeliveries(parties, rows, killTime, now)).toEqual([
      {
        url: URL_A,
        webhookIds: [1, 2],
        kind: 'loss',
        entities: [
          { type: 'CORPORATION', id: 20 },
          { type: 'ALLIANCE', id: 100 },
        ],
      },
    ]);
  });

  it('loss matches by corporation when victim has no character', () => {
    const structure: KillmailParties = {
      victim: party({ corporationId: 10, allianceId: 100 }),
      attackers: [party({ characterId: 2, corporationId: 20 })],
    };
    const out = planDeliveries(structure, [row({})], killTime, now);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('loss');
    expect(out[0].webhookIds).toEqual([1]);
  });

  it('drops rows that fail isEligible', () => {
    const rows = [
      row({ id: 1, activeSince: new Date('2026-11-01T11:59:30Z') }),
      row({ id: 2, url: URL_B, entityType: 'CHARACTER', entityId: 1 }),
    ];
    const out = planDeliveries(parties, rows, killTime, now);
    expect(out).toHaveLength(1);
    expect(out[0].webhookIds).toEqual([2]);
    expect(out[0].url).toBe(URL_B);
  });

  it('returns [] when nothing matches', () => {
    const rows = [row({ entityType: 'CHARACTER', entityId: 999 })];
    expect(planDeliveries(parties, rows, killTime, now)).toEqual([]);
  });

  it('deduplicates entities when two rows share an entity', () => {
    const rows = [row({ id: 1 }), row({ id: 2 })];
    const out = planDeliveries(parties, rows, killTime, now);
    expect(out).toHaveLength(1);
    expect(out[0].webhookIds).toEqual([1, 2]);
    expect(out[0].entities).toEqual([{ type: 'CORPORATION', id: 10 }]);
  });
});

describe('buildKillmailEmbed', () => {
  const base: EmbedInput = {
    kind: 'kill',
    killmailId: 555,
    killmailTime: new Date('2026-11-01T11:59:00Z'),
    frontendUrl: 'https://killreport.example',
    shipTypeId: 670,
    shipName: 'Capsule',
    victimName: 'Some Pilot',
    victimCorpName: 'Corp X',
    victimAllianceName: 'Alliance Y',
    finalBlowName: 'Killer',
    finalBlowShipName: 'Rifter',
    totalValue: 1234567.5,
    attackerCount: 3,
    systemName: 'Jita',
    securityStatus: 0.9,
    regionName: 'The Forge',
    footerEntityNames: ['Corp X', 'Alliance Y'],
  };
  type Embed = {
    title: string;
    url: string;
    color: number;
    timestamp: string;
    thumbnail: { url: string };
    footer: { text: string };
    fields: { name: string; value: string }[];
  };
  const embedOf = (input: EmbedInput): Embed =>
    buildKillmailEmbed(input).embeds![0] as unknown as Embed;

  it('uses red for loss, green for kill, links to the killmail page and sets the ship thumbnail', () => {
    const kill = embedOf(base);
    expect(kill.color).toBe(0x2ecc71);
    expect(embedOf({ ...base, kind: 'loss' }).color).toBe(0xe74c3c);
    expect(kill.title).toBe('Capsule — Some Pilot');
    expect(kill.url).toBe('https://killreport.example/killmails/555');
    expect(kill.thumbnail.url).toBe(
      'https://images.evetech.net/types/670/render?size=128',
    );
    expect(kill.timestamp).toBe('2026-11-01T11:59:00.000Z');
  });

  it('strips trailing slashes from the frontend url', () => {
    expect(
      embedOf({ ...base, frontendUrl: 'https://killreport.example//' }).url,
    ).toBe('https://killreport.example/killmails/555');
  });

  it('sets allowed_mentions to parse nothing', () => {
    expect(buildKillmailEmbed(base).allowed_mentions).toEqual({ parse: [] });
  });

  it('embed falls back to Unknown for missing names', () => {
    const e = embedOf({
      ...base,
      shipName: null,
      victimName: null,
      victimCorpName: null,
      victimAllianceName: null,
      finalBlowName: null,
      finalBlowShipName: null,
      systemName: null,
      regionName: null,
    });
    expect(e.title).toBe('Unknown — Unknown');
    expect(e.fields.some((f) => f.value.includes('Unknown'))).toBe(true);
    expect(JSON.stringify(e)).not.toContain('null');
  });

  it('footer lists every entity name', () => {
    expect(embedOf(base).footer.text).toBe('KillReport · Corp X, Alliance Y');
  });

  it('caps field values at 1024 characters', () => {
    const e = embedOf({ ...base, victimCorpName: 'x'.repeat(3000) });
    for (const f of e.fields) expect(f.value.length).toBeLessThanOrEqual(1024);
  });
});
