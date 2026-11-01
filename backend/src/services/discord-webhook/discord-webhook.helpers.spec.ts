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
  it('shortens to K / M / B / T with up to two decimals', () => {
    expect(formatIsk(950)).toBe('950 ISK');
    expect(formatIsk(12_500)).toBe('12.5K ISK');
    expect(formatIsk(950_000_000)).toBe('950M ISK');
    expect(formatIsk(1_240_512_330)).toBe('1.24B ISK');
    expect(formatIsk(3_000_000_000_000)).toBe('3T ISK');
  });
});

describe('buildKillmailEmbed', () => {
  const base: EmbedInput = {
    kind: 'loss',
    killmailId: 555,
    killmailTime: new Date('2026-11-01T11:59:00Z'),
    frontendUrl: 'https://killreport.example',
    shipTypeId: 29990,
    shipName: 'Loki',
    victim: { id: 365974960, name: 'General XAN' },
    victimCorp: { id: 98814817, name: 'Corp X' },
    victimAlliance: { id: 99005338, name: 'Alliance Y' },
    finalBlow: { id: 9001, name: 'Killer' },
    finalBlowShipName: 'Sabre',
    totalValue: 1_240_512_330,
    attackerCount: 37,
    systemName: 'J-GAMP',
    securityStatus: -0.4,
    regionName: 'Catch',
    entities: [{ type: 'ALLIANCE', id: 99005338, name: 'Alliance Y' }],
  };
  type Embed = {
    author: { name: string; icon_url: string; url: string };
    title: string;
    url: string;
    description: string;
    color: number;
    timestamp: string;
    thumbnail: { url: string };
    footer: { text: string };
    fields: { name: string; value: string; inline?: boolean }[];
  };
  const embedOf = (input: EmbedInput): Embed =>
    buildKillmailEmbed(input).embeds![0] as unknown as Embed;
  const field = (e: Embed, name: string) =>
    e.fields.find((f) => f.name === name)?.value;

  it('uses red for loss, green for kill, links to the killmail page and sets the ship thumbnail', () => {
    const loss = embedOf(base);
    expect(loss.color).toBe(0xe74c3c);
    expect(embedOf({ ...base, kind: 'kill' }).color).toBe(0x2ecc71);
    expect(loss.url).toBe('https://killreport.example/killmails/555');
    expect(loss.thumbnail.url).toBe(
      'https://images.evetech.net/types/29990/render?size=128',
    );
    expect(loss.timestamp).toBe('2026-11-01T11:59:00.000Z');
  });

  it('author line names kill or loss and the entity, with its logo and page', () => {
    const loss = embedOf(base);
    expect(loss.author).toEqual({
      name: 'LOSS · Alliance Y',
      icon_url: 'https://images.evetech.net/alliances/99005338/logo?size=64',
      url: 'https://killreport.example/alliances/99005338',
    });
    const kill = embedOf({
      ...base,
      kind: 'kill',
      entities: [{ type: 'CORPORATION', id: 98814817, name: 'Corp X' }],
    });
    expect(kill.author.name).toBe('KILL · Corp X');
    expect(kill.author.icon_url).toBe(
      'https://images.evetech.net/corporations/98814817/logo?size=64',
    );
    const char = embedOf({
      ...base,
      entities: [{ type: 'CHARACTER', id: 365974960, name: 'General XAN' }],
    });
    expect(char.author.icon_url).toBe(
      'https://images.evetech.net/characters/365974960/portrait?size=64',
    );
  });

  it('author lists every entity when one channel matched several, logo of the first', () => {
    const e = embedOf({
      ...base,
      entities: [
        { type: 'ALLIANCE', id: 99005338, name: 'Alliance Y' },
        { type: 'CORPORATION', id: 98814817, name: 'Corp X' },
      ],
    });
    expect(e.author.name).toBe('LOSS · Alliance Y, Corp X');
    expect(e.author.icon_url).toContain('/alliances/99005338/');
  });

  it('title is a sentence and the description carries value and attackers', () => {
    const e = embedOf(base);
    expect(e.title).toBe('General XAN lost a Loki');
    expect(e.description).toBe('**1.24B ISK** · 37 attackers');
    expect(embedOf({ ...base, attackerCount: 1 }).description).toBe(
      '**1.24B ISK** · 1 attacker',
    );
    expect(embedOf({ ...base, shipName: 'Ishtar' }).title).toBe(
      'General XAN lost an Ishtar',
    );
  });

  it('a victim without a character (structure) is titled by its corporation', () => {
    expect(embedOf({ ...base, victim: { id: null, name: null } }).title).toBe(
      'Corp X lost a Loki',
    );
  });

  it('names link to their KillReport pages', () => {
    const e = embedOf(base);
    expect(field(e, 'Victim')).toBe(
      '[General XAN](https://killreport.example/characters/365974960)\n' +
        '[Corp X](https://killreport.example/corporations/98814817) / ' +
        '[Alliance Y](https://killreport.example/alliances/99005338)',
    );
    expect(field(e, 'Final blow')).toBe(
      '[Killer](https://killreport.example/characters/9001) (Sabre)',
    );
    expect(field(e, 'Location')).toBe('J-GAMP (-0.4) · Catch');
  });

  it('escapes markdown in names', () => {
    const e = embedOf({
      ...base,
      victimCorp: { id: 1, name: 'A [B] *C*' },
    });
    expect(field(e, 'Victim')).toContain(
      '[A \\[B\\] \\*C\\*](https://killreport.example/corporations/1)',
    );
  });

  it('strips trailing slashes from the frontend url', () => {
    expect(
      embedOf({ ...base, frontendUrl: 'https://killreport.example//' }).url,
    ).toBe('https://killreport.example/killmails/555');
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
      systemName: null,
      regionName: null,
      entities: [{ type: 'ALLIANCE', id: 99005338, name: null }],
    });
    expect(e.title).toBe('Unknown lost an Unknown');
    expect(e.author.name).toBe('LOSS · Unknown');
    expect(e.description).toBe('**Unknown value** · 37 attackers');
    expect(field(e, 'Victim')).toBe('Unknown');
    expect(field(e, 'Final blow')).toBe('Unknown');
    expect(field(e, 'Location')).toBe('Unknown');
    expect(JSON.stringify(e)).not.toContain('null');
  });

  it('a victim with no alliance shows only the corporation', () => {
    const e = embedOf({ ...base, victimAlliance: { id: null, name: null } });
    expect(field(e, 'Victim')).toBe(
      '[General XAN](https://killreport.example/characters/365974960)\n' +
        '[Corp X](https://killreport.example/corporations/98814817)',
    );
  });

  it('footer pads every card to the same width with invisible blanks', () => {
    const short = embedOf({ ...base, victim: { id: 1, name: 'A' } }).footer;
    const long = embedOf({
      ...base,
      victim: { id: 1, name: 'B'.repeat(40) },
    }).footer;
    expect(short.text).toBe(`KillReport ${'\u2800'.repeat(EMBED_WIDTH_PAD)}`);
    expect(long.text).toBe(short.text);
  });

  it('caps field values at 1024, title and author at 256 characters', () => {
    const long = 'x'.repeat(3000);
    const e = embedOf({
      ...base,
      victim: { id: 1, name: long },
      victimCorp: { id: 2, name: long },
      entities: [{ type: 'ALLIANCE', id: 3, name: long }],
    });
    for (const f of e.fields) expect(f.value.length).toBeLessThanOrEqual(1024);
    expect(e.title.length).toBeLessThanOrEqual(256);
    expect(e.author.name.length).toBeLessThanOrEqual(256);
  });
});
