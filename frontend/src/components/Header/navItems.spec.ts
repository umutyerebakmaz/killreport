import { describe, expect, it } from 'vitest';

import { isNavActive } from '@/utils/navActive';

import { NAV, isNavGroup } from './navItems';

/** The path a link lands on, which is what the browser reports back. */
const pathOf = (href: string) => href.split(/[?#]/)[0];

describe('NAV', () => {
  it('is five entries, the entity pages gathered under one menu', () => {
    expect(NAV.map((entry) => entry.label)).toEqual([
      'UNIVERSE',
      'KILLMAILS',
      'ENTITIES',
      'LEADERBOARDS',
      'SOVEREIGNTY',
    ]);
  });

  it('opens KILLMAILS on the unfiltered list', () => {
    const killmails = NAV.filter(isNavGroup).find(
      (group) => group.label === 'KILLMAILS',
    );

    expect(killmails?.items[0].href).toBe('/killmails');
  });

  it.each(NAV.filter(isNavGroup).map((group) => [group.label, group]))(
    '%s lights up on every page its menu links to',
    (_label, group) => {
      for (const item of group.items)
        expect(isNavActive(pathOf(item.href), group.match)).toBe(true);
    },
  );

  it('links every destination once', () => {
    const hrefs = NAV.flatMap((entry) =>
      isNavGroup(entry) ? entry.items.map((item) => item.href) : [entry.href],
    );

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
