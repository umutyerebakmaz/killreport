import { describe, expect, it } from 'vitest';
import {
  buildKillmailEmbed,
  EMBED_WIDTH_PAD,
  formatIsk,
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

describe('formatIsk', () => {
  it('matches the site: two decimals with K / M / B / T, whole ISK below 1000', () => {
    expect(formatIsk(0)).toBe('0 ISK');
    expect(formatIsk(950)).toBe('950 ISK');
    expect(formatIsk(10_000)).toBe('10.00K ISK');
    expect(formatIsk(46_224_300.7)).toBe('46.22M ISK');
    expect(formatIsk(1_240_512_330)).toBe('1.24B ISK');
    expect(formatIsk(3_000_000_000_000)).toBe('3.00T ISK');
  });
});

describe('buildKillmailEmbed', () => {
  const PAD = '\u2800'.repeat(70);
  const site = 'https://killreport.example';
  const base: EmbedInput = {
    kind: 'loss',
    killmailId: 555,
    frontendUrl: site,
    shipTypeId: 670,
    shipName: 'Capsule',
    victim: { id: 365974960, name: 'General XAN' },
    victimCorp: { id: 98814817, name: 'Fraternity.' },
    victimAlliance: { id: 99003581, name: 'Fraternity' },
    finalBlow: { id: 9001, name: 'Alik Organa' },
    finalBlowShipName: 'Harpy',
    totalValue: 46_234_300.7,
    attackerCount: 9,
    system: { id: 30004500, name: '4-P4FE' },
    securityStatus: -0.31,
    region: { id: 10000061, name: 'Tenerifis' },
    entities: [{ type: 'CORPORATION', id: 98814817, name: 'Fraternity.' }],
  };
  type Field = { name: string; value: string; inline?: boolean };
  type Embed = {
    author: { name: string; icon_url: string; url: string };
    title: string;
    url: string;
    description: string;
    color: number;
    timestamp?: string;
    image?: unknown;
    thumbnail: { url: string };
    footer: { text: string; icon_url: string };
    fields?: Field[];
  };
  const embedOf = (input: EmbedInput): Embed =>
    buildKillmailEmbed(input).embeds![0] as unknown as Embed;

  it('kill is green, loss is red; the colour is the only colour', () => {
    expect(embedOf(base).color).toBe(0xe74c3c);
    expect(embedOf({ ...base, kind: 'kill' }).color).toBe(0x2ecc71);
  });

  it('author is the victim with portrait, linked to their page', () => {
    expect(embedOf(base).author).toEqual({
      name: 'General XAN',
      icon_url:
        'https://images.evetech.net/characters/365974960/portrait?size=128',
      url: `${site}/characters/365974960`,
    });
  });

  it('a victim without a character (structure) is authored by its corporation', () => {
    expect(
      embedOf({ ...base, victim: { id: null, name: null } }).author,
    ).toEqual({
      name: 'Fraternity.',
      icon_url:
        'https://images.evetech.net/corporations/98814817/logo?size=128',
      url: `${site}/corporations/98814817`,
    });
  });

  it('title is the ship, linked to the killmail', () => {
    const e = embedOf(base);
    expect(e.title).toBe('Capsule');
    expect(e.url).toBe(`${site}/killmails/555`);
  });

  it('description is four short lines: affiliation, location, final blow, value', () => {
    expect(embedOf(base).description).toBe(
      [
        `[Fraternity.](${site}/corporations/98814817), [Fraternity](${site}/alliances/99003581)`,
        `Lost in [4-P4FE](${site}/solar-systems/30004500) (-0.3), [Tenerifis](${site}/regions/10000061)`,
        `Final blow by [Alik Organa](${site}/characters/9001) in a Harpy, with 8 others`,
        '**46.23M ISK**',
      ].join('\n'),
    );
  });

  it('no fields: the description carries everything', () => {
    expect(embedOf(base).fields).toBeUndefined();
  });

  it('affiliation without an alliance is just the corporation', () => {
    const lines = embedOf({
      ...base,
      victimAlliance: { id: null, name: null },
    }).description.split('\n');
    expect(lines[0]).toBe(`[Fraternity.](${site}/corporations/98814817)`);
  });

  it('a solo kill says solo, one other says "1 other", articles follow the ship', () => {
    const line = (input: Partial<EmbedInput>) =>
      embedOf({ ...base, ...input }).description.split('\n')[2];
    expect(line({ attackerCount: 1 })).toBe(
      `Final blow by [Alik Organa](${site}/characters/9001) in a Harpy, solo`,
    );
    expect(line({ attackerCount: 2 })).toBe(
      `Final blow by [Alik Organa](${site}/characters/9001) in a Harpy, with 1 other`,
    );
    expect(line({ finalBlowShipName: 'Ishtar' })).toContain('in an Ishtar,');
  });

  it('ship render as a retina thumbnail on the right, no large image', () => {
    const e = embedOf(base);
    expect(e.thumbnail).toEqual({
      url: 'https://images.evetech.net/types/670/render?size=256',
    });
    expect(e.image).toBeUndefined();
  });

  it('footer names the matched entities, with the first one’s logo', () => {
    const e = embedOf(base);
    expect(e.footer).toEqual({
      text: `Fraternity. ${PAD}`,
      icon_url: 'https://images.evetech.net/corporations/98814817/logo?size=64',
    });
    const multi = embedOf({
      ...base,
      kind: 'kill',
      entities: [
        { type: 'ALLIANCE', id: 99003581, name: 'Fraternity' },
        { type: 'CHARACTER', id: 365974960, name: 'General XAN' },
      ],
    });
    expect(multi.footer.text).toBe(`Fraternity, General XAN ${PAD}`);
    expect(multi.footer.icon_url).toBe(
      'https://images.evetech.net/alliances/99003581/logo?size=64',
    );
  });

  it('pads the footer to a fixed width and carries no timestamp, so Discord adds no stray bullet', () => {
    expect(EMBED_WIDTH_PAD).toBe(70);
    const short = embedOf({ ...base, victim: { id: 1, name: 'A' } });
    const long = embedOf({ ...base, victim: { id: 1, name: 'B'.repeat(40) } });
    expect(short.footer.text).toBe(long.footer.text);
    expect(short.footer.text.endsWith('\u2800'.repeat(70))).toBe(true);
    expect(short.timestamp).toBeUndefined();
  });

  it('escapes markdown in names', () => {
    const e = embedOf({ ...base, victimCorp: { id: 1, name: 'A [B] *C*' } });
    expect(e.description).toContain(
      `[A \\[B\\] \\*C\\*](${site}/corporations/1)`,
    );
  });

  it('strips trailing slashes from the frontend url', () => {
    expect(embedOf({ ...base, frontendUrl: `${site}//` }).url).toBe(
      `${site}/killmails/555`,
    );
  });

  it('sets allowed_mentions to parse nothing', () => {
    expect(buildKillmailEmbed(base).allowed_mentions).toEqual({ parse: [] });
  });

  it('falls back to Unknown, unlinked, for missing names and values', () => {
    const e = embedOf({
      ...base,
      shipName: null,
      victim: { id: null, name: null },
      victimCorp: { id: null, name: null },
      victimAlliance: { id: null, name: null },
      finalBlow: { id: null, name: null },
      finalBlowShipName: null,
      totalValue: null,
      system: { id: null, name: null },
      securityStatus: null,
      region: { id: null, name: null },
      entities: [{ type: 'ALLIANCE', id: 99003581, name: null }],
    });
    expect(e.author.name).toBe('Unknown');
    expect(e.title).toBe('Unknown');
    expect(e.description).toBe(
      [
        'Unknown',
        'Lost in Unknown',
        'Final blow by Unknown, with 8 others',
        '**Unknown value**',
      ].join('\n'),
    );
    expect(e.footer.text).toBe(`Unknown ${PAD}`);
    expect(JSON.stringify(e)).not.toContain('null');
    expect(JSON.stringify(e)).not.toContain('](');
  });

  it('caps title, author, description and footer at their limits', () => {
    const long = 'x'.repeat(3000);
    const e = embedOf({
      ...base,
      shipName: long,
      victim: { id: 1, name: long },
      victimCorp: { id: 2, name: long },
      finalBlow: { id: 3, name: long },
      entities: [{ type: 'ALLIANCE', id: 4, name: long }],
    });
    expect(e.title.length).toBeLessThanOrEqual(256);
    expect(e.author.name.length).toBeLessThanOrEqual(256);
    expect(e.description.length).toBeLessThanOrEqual(4096);
    expect(e.footer.text.length).toBeLessThanOrEqual(2048);
  });
});
