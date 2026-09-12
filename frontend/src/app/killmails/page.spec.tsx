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

vi.mock('@/generated/graphql', () => ({
  KillmailOrderBy: { TimeDesc: 'timeDesc' },
  useKillmailsQuery: (options: KillmailsQueryOptions) =>
    useKillmailsQuery(options),
  useKillmailsDateCountsQuery: () => ({ data: undefined }),
  useNewKillmailSubscription: () => ({}),
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
});
