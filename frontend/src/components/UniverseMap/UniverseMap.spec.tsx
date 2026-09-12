import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The component's job is a small state machine plus one arithmetic promise: the
 * viewState target that reaches deck.gl is origin-local, not galactic. Those are
 * what these tests hold; the layer props themselves are Task 5's.
 */

const webgl = vi.fn(() => true);
vi.mock('@/utils/map/webgl', () => ({ isWebgl2Available: () => webgl() }));

const replace = vi.fn();
let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

type QueryResult = {
  data?: unknown;
  loading: boolean;
  error?: { message: string };
};
const useMapGeometryQuery = vi.fn<() => QueryResult>();
vi.mock('@/generated/graphql', () => ({
  MapScope: { NewEden: 'NEW_EDEN', Pochven: 'POCHVEN', Wormhole: 'WORMHOLE' },
  useMapGeometryQuery: (options: unknown) => {
    lastQueryOptions = options;
    return useMapGeometryQuery();
  },
}));
let lastQueryOptions: unknown;

const deckProps: Record<string, unknown>[] = [];
vi.mock('@deck.gl/react', () => ({
  DeckGL: (props: Record<string, unknown>) => {
    deckProps.push(props);
    return <div data-testid="deck" />;
  },
}));

vi.mock('@/components/Loader', () => ({
  default: ({ text }: { text?: string }) => <div>{text}</div>,
}));

import { MapScope } from '@/generated/graphql';
import UniverseMap from './UniverseMap';

const GEOMETRY = {
  mapGeometry: {
    scope: 'NEW_EDEN',
    bounds: { minX: -1e17, maxX: 3e17, minZ: -2e17, maxZ: 2e17 },
    nodes: [
      {
        systemId: 30000142,
        name: 'Jita',
        x: 3e17,
        z: 2e17,
        radius: 3.88e12,
        securityStatus: 0.94,
        constellationId: 20000020,
        regionId: 10000002,
      },
    ],
    edges: [],
  },
};

beforeEach(() => {
  webgl.mockReturnValue(true);
  searchParams = new URLSearchParams('');
  deckProps.length = 0;
  useMapGeometryQuery.mockReturnValue({ data: GEOMETRY, loading: false });
});

describe('UniverseMap', () => {
  it('says so plainly when the browser has no WebGL 2', () => {
    webgl.mockReturnValue(false);
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(screen.getByText(/needs WebGL 2/)).toBeInTheDocument();
    expect(screen.queryByTestId('deck')).not.toBeInTheDocument();
  });

  it('keeps the canvas area filled on a geometry error instead of going blank', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      error: { message: 'network down' },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(
      screen.getByText(/Could not load the map geometry/),
    ).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
  });

  it('shows the loader only while there is nothing to draw', () => {
    useMapGeometryQuery.mockReturnValue({ loading: true });
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(screen.getByText('Loading the map...')).toBeInTheDocument();
  });

  it('says a scene is empty rather than rendering an empty canvas', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      data: { mapGeometry: { ...GEOMETRY.mapGeometry, nodes: [] } },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(screen.getByText(/no systems to draw/)).toBeInTheDocument();
  });

  it('asks for the geometry cache-first, the one override of the global default', () => {
    render(<UniverseMap scope={MapScope.Pochven} />);

    expect(lastQueryOptions).toMatchObject({
      variables: { scope: 'POCHVEN' },
      fetchPolicy: 'cache-first',
    });
  });

  it('hands deck.gl a target relative to the scene centre, not a galactic one', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { viewState } = deckProps.at(-1) as {
      viewState: { target: number[]; zoom: number };
    };
    // bounds centre is [1e17, 0]; the autofit camera sits on it, so the target
    // deck.gl receives is the origin itself.
    expect(viewState.target).toEqual([0, 0, 0]);
    expect(Math.abs(viewState.target[0])).toBeLessThan(1e17);
  });

  it('restores the camera the URL carries, in galactic metres', () => {
    searchParams = new URLSearchParams('x=2e17&z=1e17&zoom=-40');
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { viewState } = deckProps.at(-1) as {
      viewState: { target: number[]; zoom: number };
    };
    expect(viewState.target[0]).toBeCloseTo(1e17, -14);
    expect(viewState.target[1]).toBeCloseTo(1e17, -14);
    expect(viewState.zoom).toBe(-40);
  });

  it('opens 13 zoom levels above the fit and no more, because interiors are Phase 2', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { viewState } = deckProps.at(-1) as {
      viewState: { zoom: number; minZoom: number; maxZoom: number };
    };
    expect(viewState.maxZoom - viewState.zoom).toBeCloseTo(13, 6);
    expect(viewState.zoom - viewState.minZoom).toBeCloseTo(2, 6);
  });

  it('draws gates under systems, so a dot is never hidden by a line', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { layers } = deckProps.at(-1) as { layers: { id: string }[] };
    expect(layers.map((layer) => layer.id)).toEqual([
      'map-gates',
      'map-systems',
    ]);
  });

  // The three below are the reason useMapCamera exists at all. #201 shipped
  // because a page read its query string once on mount; App Router keeps a
  // component mounted when only the query string changes, so the fix is a
  // debounced write plus a way to tell that write apart from someone else's.
  // Without these, an edit that compared raw objects instead of the canonical
  // query string — or compared on every render instead of through the ref —
  // would pass every other test in this file.

  function captureViewStateChange() {
    const { onViewStateChange } = deckProps.at(-1) as {
      onViewStateChange: (change: {
        viewState: { target: number[]; zoom: number };
      }) => void;
    };
    return onViewStateChange;
  }

  function currentViewState() {
    return (
      deckProps.at(-1) as { viewState: { target: number[]; zoom: number } }
    ).viewState;
  }

  it('writes the camera to the url once the pointer settles, not once per frame', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    const onViewStateChange = captureViewStateChange();

    // Fake timers go on after render: React's scheduler uses real ones to
    // flush the first paint.
    vi.useFakeTimers();
    try {
      // Two moves inside one debounce window. A real drag produces dozens.
      act(() => {
        onViewStateChange({
          viewState: { target: [1e16, 2e16, 0], zoom: -45 },
        });
      });
      act(() => {
        onViewStateChange({
          viewState: { target: [3e16, 4e16, 0], zoom: -44 },
        });
      });

      expect(replace).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(replace).toHaveBeenCalledTimes(1);

      // The origin is the bounds centre [1e17, 0], so the galactic camera is
      // the local target plus the origin — the target test's arithmetic run the
      // other way — and only the last move survives.
      const written = new URLSearchParams(
        (replace.mock.calls[0][0] as string).replace(/^\?/, ''),
      );
      expect(written.get('scope')).toBe('NEW_EDEN');
      expect(written.get('x')).toBe('130000000000000000');
      expect(written.get('z')).toBe('40000000000000000');
      expect(written.get('zoom')).toBe('-44.00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('follows a url change that arrives after mount — the #201 regression', () => {
    const { rerender } = render(<UniverseMap scope={MapScope.NewEden} />);

    // The autofit sits on the scene centre, so the target is the origin itself.
    expect(currentViewState().target).toEqual([0, 0, 0]);

    // A nav link lands while the component stays mounted.
    searchParams = new URLSearchParams('x=2e17&z=1e17&zoom=-40');
    rerender(<UniverseMap scope={MapScope.NewEden} />);

    const viewState = currentViewState();
    expect(viewState.target[0]).toBeCloseTo(1e17, -14);
    expect(viewState.target[1]).toBeCloseTo(1e17, -14);
    expect(viewState.zoom).toBe(-40);
  });

  it('ignores the url it wrote itself, so its own echo cannot fight the pointer', () => {
    const { rerender } = render(<UniverseMap scope={MapScope.NewEden} />);
    const onViewStateChange = captureViewStateChange();

    vi.useFakeTimers();
    try {
      // A zoom carrying more precision than the URL does: the write rounds it
      // to -45.01, so adopting the echo would show up as a changed camera.
      act(() => {
        onViewStateChange({
          viewState: { target: [1e16, 2e16, 0], zoom: -45.006 },
        });
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(replace).toHaveBeenCalledTimes(1);

      const echoed = (replace.mock.calls[0][0] as string).replace(/^\?/, '');
      expect(new URLSearchParams(echoed).get('zoom')).toBe('-45.01');

      // The router echoes the write back as a fresh searchParams object.
      searchParams = new URLSearchParams(echoed);
      rerender(<UniverseMap scope={MapScope.NewEden} />);

      expect(currentViewState().zoom).toBe(-45.006);
    } finally {
      vi.useRealTimers();
    }
  });
});
