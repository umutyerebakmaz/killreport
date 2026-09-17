import { describe, expect, it } from 'vitest';

import { isNavActive } from './navActive';

describe('isNavActive', () => {
  it('matches the page a nav item points at', () => {
    expect(isNavActive('/alliances', ['/alliances'])).toBe(true);
  });

  it('keeps the item lit on that page’s detail routes', () => {
    expect(isNavActive('/alliances/99005338', ['/alliances'])).toBe(true);
    expect(isNavActive('/sovereignty/structures', ['/sovereignty'])).toBe(true);
  });

  it('stops at a segment boundary rather than at a prefix', () => {
    expect(isNavActive('/alliancesmerged', ['/alliances'])).toBe(false);
    expect(isNavActive('/maps', ['/map'])).toBe(false);
  });

  it('ignores the query string a nav href carries', () => {
    expect(
      isNavActive('/killmails/128342753', [
        '/killmails?page=1&regionId=10000070',
      ]),
    ).toBe(true);
  });

  it('is true when any one of an item’s hrefs matches', () => {
    const universe = ['/map', '/regions', '/constellations', '/solar-systems'];
    expect(isNavActive('/constellations/20000001', universe)).toBe(true);
    expect(isNavActive('/workers', universe)).toBe(false);
  });

  it('does not let a deeper route claim a shallower item', () => {
    // SOVEREIGNTY owns /sovereignty/map; UNIVERSE's /map must not also light up.
    expect(isNavActive('/sovereignty/map', ['/map'])).toBe(false);
  });

  it('lights nothing on the home page', () => {
    expect(isNavActive('/', ['/alliances'])).toBe(false);
    expect(isNavActive('/', ['/map'])).toBe(false);
  });

  it('is false without a pathname, which is what usePathname gives on first paint', () => {
    expect(isNavActive(null, ['/alliances'])).toBe(false);
  });
});
