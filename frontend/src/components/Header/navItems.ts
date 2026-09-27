/**
 * The site nav, once. The desktop bar and the mobile drawer both render from
 * this list, so a destination added here appears in both — the drawer used to
 * be a hand-written copy of the bar and could fall behind it.
 */

export type NavLinkItem = { label: string; href: string };

export type NavGroupItem = { label: string; href: string; description: string };

/**
 * A menu. `match` is given rather than read off `items`: see `NavPopover` for
 * why, and navItems.spec.ts for the check that it covers every item.
 */
export type NavGroup = {
  label: string;
  match: readonly string[];
  items: readonly NavGroupItem[];
};

export type NavEntry = NavLinkItem | NavGroup;

export const isNavGroup = (entry: NavEntry): entry is NavGroup =>
  'items' in entry;

export const NAV: readonly NavEntry[] = [
  {
    label: 'UNIVERSE',
    match: ['/map', '/regions', '/constellations', '/solar-systems'],
    items: [
      {
        href: '/map',
        label: 'MAP',
        description:
          'Every gate-connected system in New Eden, in one continuous zoom',
      },
      {
        href: '/regions',
        label: 'REGIONS',
        description:
          '64 Regions across New Eden - High, Low, Null, and Wormhole space',
      },
      {
        href: '/constellations',
        label: 'CONSTELLATIONS',
        description: '1,090+ Constellations connecting solar systems',
      },
      {
        href: '/solar-systems',
        label: 'SOLAR SYSTEMS',
        description:
          '8,000+ Solar Systems with security ratings and statistics',
      },
    ],
  },
  {
    label: 'KILLMAILS',
    match: ['/killmails'],
    items: [
      {
        href: '/killmails?page=1&regionId=10000070',
        label: 'POCHVEN',
        description:
          'Explore Pochven triglavian space killmails and statistics',
      },
      {
        href: '/killmails?page=1&securitySpace=wormhole',
        label: 'WORMHOLES',
        description: 'Explore wormhole space killmails and statistics',
      },
    ],
  },
  { label: 'ALLIANCES', href: '/alliances' },
  { label: 'CORPORATIONS', href: '/corporations' },
  { label: 'CHARACTERS', href: '/characters' },
  { label: 'LEADERBOARDS', href: '/leaderboards' },
  {
    label: 'SOVEREIGNTY',
    match: ['/sovereignty'],
    items: [
      {
        href: '/sovereignty',
        label: 'OVERVIEW',
        description: 'Null-sec territory control, rankings, and active wars',
      },
      {
        href: '/sovereignty/structures',
        label: 'STRUCTURES & TIMERS',
        description: 'IHub/TCU inventory and upcoming vulnerability windows',
      },
      {
        href: '/sovereignty/history',
        label: 'HISTORY',
        description: 'Resolved campaigns, outcomes, and top defenders',
      },
      {
        href: '/sovereignty/hotspots',
        label: 'HOT ZONES',
        description: 'Regions ranked by conflict intensity',
      },
      {
        href: '/sovereignty/map',
        label: 'MAP',
        description: 'Territory map colored by controlling alliance',
      },
    ],
  },
  { label: 'WORKERS', href: '/workers' },
];
