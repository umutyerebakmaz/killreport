import { describe, expect, it } from 'vitest';
import {
  killmailShareProps,
  killmailShareText,
  type Killmail,
} from './killmailShare';

const T2_ATTRS = [
  { attribute_id: 422, value: 2 },
  { attribute_id: 1692, value: 2 },
];

const km = (over: Partial<Killmail> = {}): Killmail =>
  ({
    killmailTime: '2026-10-30T18:42:11.000Z',
    totalValue: 1097930000,
    destroyedValue: 982440000,
    droppedValue: 115490000,
    attackerCount: 5,
    solo: false,
    npc: false,
    victim: {
      character: { id: 1, name: "Den'orm" },
      corporation: { id: 2, name: 'Some Corp' },
      alliance: { id: 3, name: 'Some Alliance' },
      shipType: {
        id: 11,
        name: 'Kronos',
        metaGroupId: null,
        dogmaAttributes: T2_ATTRS,
      },
    },
    solarSystem: {
      name: 'Sibot',
      securityStatus: 0.4,
      constellation: { region: { name: 'Domain' } },
    },
    ...over,
  }) as unknown as Killmail;

describe('killmailShareText', () => {
  it('builds the title and description', () => {
    expect(killmailShareText(km())).toEqual({
      title: "Den'orm lost a Kronos",
      description: '1.10B ISK, Sibot (Domain), 5 attackers',
    });
  });

  it('uses an before a vowel-initial hull', () => {
    const k = km();
    k.victim.shipType.name = 'Ishtar';
    expect(killmailShareText(k).title).toBe("Den'orm lost an Ishtar");
    expect(killmailShareText(km()).title).toBe("Den'orm lost a Kronos");
  });

  it('falls back to the corporation, then the hull, like the card', () => {
    const k = km();
    k.victim.character = null;
    expect(killmailShareText(k).title).toBe('Some Corp lost a Kronos');
    k.victim.corporation = null;
    expect(killmailShareText(k).title).toBe('Kronos lost a Kronos');
    expect(killmailShareProps(k).victimName).toBe('Kronos');
  });

  it('leaves the region out when there is none', () => {
    const k = km();
    k.solarSystem.constellation = null;
    expect(killmailShareText(k).description).toBe(
      '1.10B ISK, Sibot, 5 attackers',
    );
  });

  it('says solo and NPC', () => {
    expect(killmailShareText(km({ solo: true })).description).toBe(
      '1.10B ISK, Sibot (Domain), solo',
    );
    expect(killmailShareText(km({ npc: true })).description).toBe(
      '1.10B ISK, Sibot (Domain), NPC',
    );
  });
});

describe('killmailShareProps', () => {
  it('formats the values', () => {
    const p = killmailShareProps(km());
    expect(p.total).toBe('1.10B ISK');
    expect(p.destroyed).toBe('982.44M destroyed');
    expect(p.dropped).toBe('115.49M dropped');
    expect(p.secColor).toBe('#facc15');
    expect(p.tierIcon).toBe('/icons/t2.svg');
    expect(p.shipName).toBe('Kronos');
    expect(p.memberships).toHaveLength(2);
  });

  it('has no tier icon for T1', () => {
    const k = km();
    k.victim.shipType!.dogmaAttributes = [{ attribute_id: 422, value: 1 }];
    expect(killmailShareProps(k).tierIcon).toBeNull();
  });

  it('falls back to the corp logo without a character', () => {
    const k = km();
    k.victim.character = null;
    k.victim.alliance = null;
    const p = killmailShareProps(k);
    expect(p.portrait).toContain('/corporations/2/logo?size=512');
    expect(p.memberships).toHaveLength(1);
    expect(p.victimName).toBe('Some Corp');
  });
});
