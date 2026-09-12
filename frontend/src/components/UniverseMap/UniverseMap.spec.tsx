import { render, screen } from '@testing-library/react';
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
});
