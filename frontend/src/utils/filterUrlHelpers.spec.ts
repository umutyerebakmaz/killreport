import { describe, expect, it } from 'vitest';

import { ShipTierFilter } from '@/generated/graphql';
import {
  buildKillmailFiltersUrl,
  hasActiveKillmailFilters,
  killmailFiltersOf,
  parseKillmailFiltersFromUrl,
} from './filterUrlHelpers';

describe('parseKillmailFiltersFromUrl', () => {
  it("defaults to page 1 and role 'all' with no params", () => {
    const parsed = parseKillmailFiltersFromUrl(new URLSearchParams());

    expect(parsed.page).toBe(1);
    expect(parsed.shipTypeRole).toBe('all');
    expect(parsed.characterRole).toBe('all');
    expect(parsed.securitySpaceRole).toBe('all');
    expect(parsed.shipTypeId).toBeUndefined();
    expect(parsed.victim).toBeUndefined();
    expect(parsed.attacker).toBeUndefined();
  });

  it('parses numeric filters', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams(
        'page=3&shipTypeId=587&minValue=1000&maxAttackers=5&systemId=30000142',
      ),
    );

    expect(parsed.page).toBe(3);
    expect(parsed.shipTypeId).toBe(587);
    expect(parsed.minValue).toBe(1000);
    expect(parsed.maxAttackers).toBe(5);
    expect(parsed.systemId).toBe(30000142);
  });

  it('parses comma separated ship group ids', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('shipGroupIds=25,26,27'),
    );

    expect(parsed.shipGroupIds).toEqual([25, 26, 27]);
  });

  it('derives victim/attacker flags from shipTypeRole', () => {
    const victim = parseKillmailFiltersFromUrl(
      new URLSearchParams('shipTypeId=587&shipTypeRole=victim'),
    );
    expect(victim.victim).toBe(true);
    expect(victim.attacker).toBe(false);

    const attacker = parseKillmailFiltersFromUrl(
      new URLSearchParams('shipTypeId=587&shipTypeRole=attacker'),
    );
    expect(attacker.victim).toBe(false);
    expect(attacker.attacker).toBe(true);
  });

  it('ignores shipTypeRole when no ship filter is set', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('shipTypeRole=victim'),
    );

    expect(parsed.victim).toBeUndefined();
    expect(parsed.attacker).toBeUndefined();
  });

  it('derives character flags from characterRole', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('characterId=123&characterRole=attacker'),
    );

    expect(parsed.characterAttacker).toBe(true);
    expect(parsed.characterVictim).toBe(false);
  });

  it('derives the victim side from characterRole too', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('characterId=123&characterRole=victim'),
    );

    expect(parsed.characterVictim).toBe(true);
    expect(parsed.characterAttacker).toBe(false);
  });

  it("leaves the character flags unset when the role is 'all'", () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('characterId=42&characterRole=all'),
    );

    expect(parsed.characterId).toBe(42);
    expect(parsed.characterVictim).toBeUndefined();
    expect(parsed.characterAttacker).toBeUndefined();
  });

  it('ignores characterRole when no character is selected', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('characterRole=victim'),
    );

    expect(parsed.characterVictim).toBeUndefined();
    expect(parsed.characterAttacker).toBeUndefined();
  });

  it("leaves the ship flags unset when shipTypeRole is 'all'", () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams('shipGroupIds=25,26&shipTypeRole=all'),
    );

    expect(parsed.shipGroupIds).toEqual([25, 26]);
    expect(parsed.victim).toBeUndefined();
    expect(parsed.attacker).toBeUndefined();
  });

  it("only sets securitySpace when it is not 'all'", () => {
    expect(
      parseKillmailFiltersFromUrl(new URLSearchParams('securitySpace=nullsec'))
        .securitySpace,
    ).toBe('nullsec');
    expect(
      parseKillmailFiltersFromUrl(new URLSearchParams('securitySpace=all'))
        .securitySpace,
    ).toBeUndefined();
  });

  it("parses warRelated only when it is 'true'", () => {
    expect(
      parseKillmailFiltersFromUrl(new URLSearchParams('warRelated=true'))
        .warRelated,
    ).toBe(true);
    expect(
      parseKillmailFiltersFromUrl(new URLSearchParams('warRelated=false'))
        .warRelated,
    ).toBeUndefined();
  });
});

describe('buildKillmailFiltersUrl', () => {
  it('always includes the page', () => {
    expect(buildKillmailFiltersUrl(2, {})).toBe('page=2');
  });

  it('serialises ship filters with their role', () => {
    const url = buildKillmailFiltersUrl(1, {
      shipTypeId: 587,
      victim: true,
      attacker: false,
    });
    const params = new URLSearchParams(url);

    expect(params.get('shipTypeId')).toBe('587');
    expect(params.get('shipTypeRole')).toBe('victim');
  });

  it('sets shipTypeRole from ship groups only when no ship type is selected', () => {
    const groupsOnly = new URLSearchParams(
      buildKillmailFiltersUrl(1, {
        shipGroupIds: [25, 26],
        attacker: true,
        victim: false,
      }),
    );
    expect(groupsOnly.get('shipGroupIds')).toBe('25,26');
    expect(groupsOnly.get('shipTypeRole')).toBe('attacker');
  });

  it('omits filters that are unset or falsy', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, {
        minValue: 0,
        warRelated: false,
        securitySpace: 'all',
      }),
    );

    expect([...params.keys()]).toEqual(['page']);
  });

  it('sets shipTypeRole to attacker for an attacker-side ship', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, {
        shipTypeId: 587,
        attacker: true,
        victim: false,
      }),
    );

    expect(params.get('shipTypeRole')).toBe('attacker');
  });

  it('leaves shipTypeRole out when the ship is on both sides', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, { shipTypeId: 587 }),
    );

    expect(params.get('shipTypeId')).toBe('587');
    expect(params.get('shipTypeRole')).toBeNull();
  });

  it('takes the role from the ship type when both it and groups are set', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, {
        shipTypeId: 587,
        shipGroupIds: [25, 26],
        victim: true,
        attacker: false,
      }),
    );

    expect(params.get('shipGroupIds')).toBe('25,26');
    expect(params.getAll('shipTypeRole')).toEqual(['victim']);
  });

  it('leaves shipTypeRole out when ship groups have no side', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, { shipGroupIds: [25] }),
    );

    expect(params.get('shipGroupIds')).toBe('25');
    expect(params.get('shipTypeRole')).toBeNull();
  });

  it('sets shipTypeRole from ship groups on the victim side too', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, {
        shipGroupIds: [25],
        victim: true,
        attacker: false,
      }),
    );

    expect(params.get('shipTypeRole')).toBe('victim');
  });

  it.each([
    { side: 'victim', characterVictim: true, characterAttacker: false },
    { side: 'attacker', characterVictim: false, characterAttacker: true },
  ])('serialises a character on the $side side', ({ side, ...flags }) => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, { characterId: 42, ...flags }),
    );

    expect(params.get('characterId')).toBe('42');
    expect(params.get('characterRole')).toBe(side);
  });

  it('leaves characterRole out when the character is on both sides', () => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, { characterId: 42 }),
    );

    expect(params.get('characterId')).toBe('42');
    expect(params.get('characterRole')).toBeNull();
  });

  /**
   * Each of these is one `if` in the builder and one `Number()` in the parser.
   * A pair reading the wrong key would drop a filter silently, so both
   * directions are checked from the same table.
   */
  const NUMERIC = [
    { key: 'minAttackers', value: 2 },
    { key: 'maxAttackers', value: 50 },
    { key: 'minValue', value: 1_000_000 },
    { key: 'maxValue', value: 9_000_000_000 },
    { key: 'systemId', value: 30000142 },
    { key: 'constellationId', value: 20000020 },
    { key: 'regionId', value: 10000002 },
  ] as const;

  it.each(NUMERIC)('serialises $key', ({ key, value }) => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, { [key]: value }),
    );

    expect(params.get(key)).toBe(String(value));
    expect([...params.keys()]).toEqual(['page', key]);
  });

  it.each(NUMERIC)('round-trips $key back as a number', ({ key, value }) => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams(buildKillmailFiltersUrl(1, { [key]: value })),
    );

    expect(parsed[key]).toBe(value);
  });

  it.each(NUMERIC)('omits $key when it is zero', ({ key }) => {
    const params = new URLSearchParams(
      buildKillmailFiltersUrl(1, { [key]: 0 }),
    );

    expect([...params.keys()]).toEqual(['page']);
  });

  it('round-trips through the parser', () => {
    const filters = {
      shipTypeId: 587,
      victim: true,
      attacker: false,
      characterId: 42,
      characterAttacker: true,
      characterVictim: false,
      regionId: 10000002,
      securitySpace: 'lowsec',
      minAttackers: 2,
      warRelated: true,
    };

    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams(buildKillmailFiltersUrl(4, filters)),
    );

    expect(parsed.page).toBe(4);
    expect(parsed).toMatchObject(filters);
  });
});

describe('shipTier', () => {
  const parse = (query: string) =>
    parseKillmailFiltersFromUrl(new URLSearchParams(query));

  it('reads the tier from the URL in lower case and sends it upper case', () => {
    expect(parse('shipTier=tech2').shipTier).toBe('TECH2');
    expect(parse('shipTier=tech3').shipTier).toBe('TECH3');
    expect(parse('shipTier=faction').shipTier).toBe('FACTION');
  });

  it('ignores a tier it does not know', () => {
    expect(parse('shipTier=officer').shipTier).toBeUndefined();
    expect(parse('').shipTier).toBeUndefined();
  });

  it('applies the ship role to a tier on its own', () => {
    const victimOnly = parse('shipTier=faction&shipTypeRole=victim');
    expect(victimOnly.victim).toBe(true);
    expect(victimOnly.attacker).toBe(false);

    const attackerOnly = parse('shipTier=faction&shipTypeRole=attacker');
    expect(attackerOnly.victim).toBe(false);
    expect(attackerOnly.attacker).toBe(true);
  });

  it('writes the tier and its role back to the URL', () => {
    const url = new URLSearchParams(
      buildKillmailFiltersUrl(1, {
        shipTier: ShipTierFilter.Faction,
        victim: true,
        attacker: false,
      }),
    );
    expect(url.get('shipTier')).toBe('faction');
    expect(url.get('shipTypeRole')).toBe('victim');
  });

  it('round-trips a tier together with a ship group', () => {
    const query = buildKillmailFiltersUrl(1, {
      shipGroupIds: [27],
      shipTier: ShipTierFilter.Tech2,
      victim: false,
      attacker: true,
    });
    const parsed = parse(query);
    expect(parsed.shipGroupIds).toEqual([27]);
    expect(parsed.shipTier).toBe('TECH2');
    expect(parsed.attacker).toBe(true);
    // The role goes into the URL once, not once per ship filter.
    expect(new URLSearchParams(query).getAll('shipTypeRole')).toEqual([
      'attacker',
    ]);
  });
});

describe('killmailFiltersOf', () => {
  it('keeps every filter and drops the page and the UI-only roles', () => {
    const parsed = parseKillmailFiltersFromUrl(
      new URLSearchParams(
        'page=3&shipGroupIds=26&shipTier=tech2&shipTypeRole=victim&securitySpace=lowsec',
      ),
    );
    const filters = killmailFiltersOf(parsed);

    expect(filters).toMatchObject({
      shipGroupIds: [26],
      shipTier: 'TECH2',
      victim: true,
      attacker: false,
      securitySpace: 'lowsec',
    });
    expect(filters).not.toHaveProperty('page');
    expect(filters).not.toHaveProperty('shipTypeRole');
    expect(filters).not.toHaveProperty('characterRole');
    expect(filters).not.toHaveProperty('securitySpaceRole');
  });
});

describe('hasActiveKillmailFilters', () => {
  const active = (query: string) =>
    hasActiveKillmailFilters(
      killmailFiltersOf(
        parseKillmailFiltersFromUrl(new URLSearchParams(query)),
      ),
    );

  it('is false with nothing but a page', () => {
    expect(active('page=2')).toBe(false);
    expect(active('page=1&securitySpace=all')).toBe(false);
  });

  it('is true for any filter, a ship tier on its own included', () => {
    expect(active('shipTier=faction')).toBe(true);
    expect(active('regionId=10000070')).toBe(true);
    expect(active('warRelated=true')).toBe(true);
  });
});
