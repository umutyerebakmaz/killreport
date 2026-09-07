import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TopEntitySidebar, {
  TopEntityCardSpec,
  TopEntityFilter,
} from './TopEntitySidebar';
import { LeaderboardPeriod } from '@/generated/graphql';

/**
 * TopEntitySidebar builds one `variables` object and shares it across all
 * eight leaderboard queries; this file pins that wiring so a future edit
 * can't quietly special-case one hook without a test noticing.
 *
 * It does not pin the bug that motivated it. "Most Used Ships" rendered
 * empty on a solar system page because one generated filter type,
 * TopLast7DaysAttackerShipsFilter, didn't declare systemId, so that one
 * query failed GraphQL variable validation while its four siblings
 * succeeded — a schema mismatch. `tsc` and the GraphQL server catch that
 * class of bug, not these tests: the hooks below are `vi.fn()`s with no
 * type enforcement, so they'd have accepted a systemId that the real
 * generated type used to reject. What these tests do catch is a future
 * hand-written divergence — one hook stops receiving the shared scope, or
 * the skip/period/limit wiring drifts.
 */

// The card components fall back to <Loader>, which pulls in lottie-web.
// lottie-web reaches for a canvas 2D context at import time, which jsdom
// does not implement (no `canvas` package installed) and throws before any
// test body runs. None of these tests render while loading, so the mocked
// player is never exercised — this just keeps the module out of the way.
vi.mock('lottie-react', () => ({ default: () => null }));

interface QueryHookArgs {
  variables: { filter: Record<string, unknown> };
  skip: boolean;
}

// vi.mock is hoisted above the imports, so the mock functions it returns
// must be created through vi.hoisted rather than referenced from module
// scope below.
const {
  useTopPilotsQuery,
  useTopCorporationsQuery,
  useTopAlliancesQuery,
  useTopAttackerShipsQuery,
  useTopDestroyedShipsQuery,
  useTopFactionsQuery,
  useTopSystemsQuery,
  useTopRegionsQuery,
} = vi.hoisted(() => {
  const makeHook = () =>
    vi.fn<(args: QueryHookArgs) => { data: undefined; loading: boolean }>(
      () => ({ data: undefined, loading: false }),
    );
  return {
    useTopPilotsQuery: makeHook(),
    useTopCorporationsQuery: makeHook(),
    useTopAlliancesQuery: makeHook(),
    useTopAttackerShipsQuery: makeHook(),
    useTopDestroyedShipsQuery: makeHook(),
    useTopFactionsQuery: makeHook(),
    useTopSystemsQuery: makeHook(),
    useTopRegionsQuery: makeHook(),
  };
});

vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    // The component only imports the hooks and this enum from the generated
    // module — keep the real enum so `LeaderboardPeriod.Last_7Days` in both
    // the component and this file's assertions refer to the same value.
    LeaderboardPeriod: actual.LeaderboardPeriod,
    useTopPilotsQuery,
    useTopCorporationsQuery,
    useTopAlliancesQuery,
    useTopAttackerShipsQuery,
    useTopDestroyedShipsQuery,
    useTopFactionsQuery,
    useTopSystemsQuery,
    useTopRegionsQuery,
  };
});

type MockHook = typeof useTopPilotsQuery;

const allHooks: MockHook[] = [
  useTopPilotsQuery,
  useTopCorporationsQuery,
  useTopAlliancesQuery,
  useTopAttackerShipsQuery,
  useTopDestroyedShipsQuery,
  useTopFactionsQuery,
  useTopSystemsQuery,
  useTopRegionsQuery,
];

const allCards: TopEntityCardSpec[] = [
  { kind: 'characters', title: 'Top Pilots', emptyText: 'No pilots' },
  { kind: 'corporations', title: 'Top Corporations', emptyText: 'No corps' },
  { kind: 'alliances', title: 'Top Alliances', emptyText: 'No alliances' },
  { kind: 'factions', title: 'Top Factions', emptyText: 'No factions' },
  { kind: 'attackerShips', title: 'Most Used Ships', emptyText: 'No ships' },
  { kind: 'ships', title: 'Most Destroyed Ships', emptyText: 'No ships' },
  { kind: 'systems', title: 'Top Systems', emptyText: 'No systems' },
  { kind: 'regions', title: 'Top Regions', emptyText: 'No regions' },
];

function renderSidebar(
  filter?: TopEntityFilter,
  cards: TopEntityCardSpec[] = allCards,
) {
  return render(<TopEntitySidebar filter={filter} cards={cards} />);
}

function argsOf(hook: MockHook): QueryHookArgs {
  const call = hook.mock.calls[0];
  if (!call) throw new Error('hook was never called');
  return call[0];
}

describe('TopEntitySidebar', () => {
  it('scopes every card query to the requested location, not just the ones that always supported it', () => {
    // This is the regression the branch fixed: TopLast7DaysAttackerShipsFilter
    // used to be the one leaderboard filter type without a systemId field, so
    // on /solar-systems/[id] the attacker-ships query alone failed GraphQL
    // variable validation while its siblings succeeded. Giving every query
    // the shared TopFilter means systemId now reaches all eight.
    renderSidebar({ systemId: 30000142 });

    for (const hook of allHooks) {
      expect(argsOf(hook).variables.filter).toMatchObject({
        systemId: 30000142,
      });
    }
  });

  it('spreads the Last 7 Days period onto every card alongside the scope', () => {
    renderSidebar({ systemId: 30000142 });

    for (const hook of allHooks) {
      expect(argsOf(hook).variables.filter.period).toBe(
        LeaderboardPeriod.Last_7Days,
      );
    }
  });

  it('skips the hooks for card kinds that were not requested', () => {
    renderSidebar(undefined, [
      { kind: 'characters', title: 'Top Pilots', emptyText: 'No pilots' },
      {
        kind: 'attackerShips',
        title: 'Most Used Ships',
        emptyText: 'No ships',
      },
    ]);

    expect(argsOf(useTopPilotsQuery).skip).toBe(false);
    expect(argsOf(useTopAttackerShipsQuery).skip).toBe(false);
    expect(argsOf(useTopCorporationsQuery).skip).toBe(true);
    expect(argsOf(useTopAlliancesQuery).skip).toBe(true);
    expect(argsOf(useTopDestroyedShipsQuery).skip).toBe(true);
  });

  it('defaults the limit to 10 when the filter omits it', () => {
    renderSidebar();

    for (const hook of allHooks) {
      expect(argsOf(hook).variables.filter.limit).toBe(10);
    }
  });

  it('passes an explicit limit through instead of the default', () => {
    renderSidebar({ limit: 25 });

    for (const hook of allHooks) {
      expect(argsOf(hook).variables.filter.limit).toBe(25);
    }
  });
});
