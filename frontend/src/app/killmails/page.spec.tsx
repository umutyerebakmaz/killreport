import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The KILLMAILS nav menu links straight into this page with filters already in
 * the query string — `/killmails?page=1&regionId=10000070` (Pochven) and
 * `/killmails?page=1&securitySpace=wormhole` (Wormholes). App Router keeps the
 * same component mounted when only the query string changes, so the page has to
 * read its filters out of the URL on every render, not once on mount.
 */

let searchParams = new URLSearchParams('page=1');
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

type KillmailsQueryOptions = { variables: { filter: Record<string, unknown> } };

const useKillmailsQuery = vi.fn<(options: KillmailsQueryOptions) => unknown>(
  () => ({ data: undefined, loading: false, error: undefined }),
);
const useNewKillmailSubscription = vi.fn<
  (options: { skip: boolean }) => unknown
>(() => ({}));

vi.mock('@/generated/graphql', () => ({
  KillmailOrderBy: { TimeDesc: 'timeDesc' },
  ShipTierFilter: { Tech2: 'TECH2', Tech3: 'TECH3', Faction: 'FACTION' },
  useKillmailsQuery: (options: KillmailsQueryOptions) =>
    useKillmailsQuery(options),
  useKillmailsDateCountsQuery: () => ({ data: undefined }),
  useNewKillmailSubscription: (options: { skip: boolean }) =>
    useNewKillmailSubscription(options),
}));

vi.mock('@/components/Filters/KillmailFilterForm', () => ({
  default: () => null,
}));
vi.mock('@/components/KillmailsTable', () => ({ default: () => null }));
vi.mock('@/components/Loader', () => ({ default: () => null }));
vi.mock('@/components/MostValuableCarousel/MostValuableCarousel', () => ({
  default: () => null,
}));
vi.mock('@/components/Paginator/Paginator', () => ({ default: () => null }));
vi.mock('@/components/TopEntitySidebar/TopEntitySidebar', () => ({
  default: () => null,
}));

import KillmailsPage from './page';

function lastFilter() {
  const calls = useKillmailsQuery.mock.calls;
  return calls[calls.length - 1][0].variables.filter;
}

describe('killmails page URL filters', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams('page=1');
    useKillmailsQuery.mockClear();
    push.mockClear();
  });

  it('queries with the regionId the URL carries on first render', () => {
    searchParams = new URLSearchParams('page=1&regionId=10000070');
    render(<KillmailsPage />);
    expect(lastFilter().regionId).toBe(10000070);
  });

  it('picks up a regionId that arrives while the page stays mounted', () => {
    const { rerender } = render(<KillmailsPage />);
    expect(lastFilter().regionId).toBeUndefined();

    searchParams = new URLSearchParams('page=1&regionId=10000070');
    rerender(<KillmailsPage />);

    expect(lastFilter().regionId).toBe(10000070);
  });

  it('picks up a securitySpace that arrives while the page stays mounted', () => {
    const { rerender } = render(<KillmailsPage />);
    expect(lastFilter().securitySpace).toBeUndefined();

    searchParams = new URLSearchParams('page=1&securitySpace=wormhole');
    rerender(<KillmailsPage />);

    expect(lastFilter().securitySpace).toBe('wormhole');
  });

  it('drops a filter again when the URL no longer carries it', () => {
    searchParams = new URLSearchParams('page=1&securitySpace=wormhole');
    const { rerender } = render(<KillmailsPage />);
    expect(lastFilter().securitySpace).toBe('wormhole');

    searchParams = new URLSearchParams('page=1');
    rerender(<KillmailsPage />);

    expect(lastFilter().securitySpace).toBeUndefined();
  });

  it('sends a ship tier together with the ship group it narrows', () => {
    // Cruiser + Tech2: the tier used to stay in the URL and never reach the
    // query, so the page listed the Cruiser group's kills on their own.
    searchParams = new URLSearchParams('page=1&shipGroupIds=26&shipTier=tech2');
    render(<KillmailsPage />);

    expect(lastFilter().shipGroupIds).toEqual([26]);
    expect(lastFilter().shipTier).toBe('TECH2');
  });

  it('stops the live feed while only a ship tier is set', () => {
    // The feed runs only unfiltered: a live killmail is not checked against
    // the filter, so a tier the feed did not know about let any kill in.
    searchParams = new URLSearchParams('page=1&shipTier=faction');
    useNewKillmailSubscription.mockClear();
    render(<KillmailsPage />);

    const calls = useNewKillmailSubscription.mock.calls;
    expect(calls[calls.length - 1][0].skip).toBe(true);
  });

  it('keeps the live feed on the unfiltered first page', () => {
    useNewKillmailSubscription.mockClear();
    render(<KillmailsPage />);

    const calls = useNewKillmailSubscription.mock.calls;
    expect(calls[calls.length - 1][0].skip).toBe(false);
  });
});
