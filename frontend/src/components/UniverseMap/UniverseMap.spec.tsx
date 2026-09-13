import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const webgl = vi.fn(() => true);
vi.mock('@/utils/map/webgl', () => ({ isWebgl2Available: () => webgl() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

type QueryResult = {
  data?: unknown;
  loading: boolean;
  error?: { message: string };
};
const useMapGeometryQuery = vi.fn<() => QueryResult>();
vi.mock('@/generated/graphql', () => ({
  MapScope: { NewEden: 'NEW_EDEN', Pochven: 'POCHVEN', Wormhole: 'WORMHOLE' },
  MapCelestialKind: {
    Star: 'STAR',
    Planet: 'PLANET',
    Moon: 'MOON',
    Belt: 'BELT',
    Station: 'STATION',
    Gate: 'GATE',
  },
  useMapGeometryQuery: () => useMapGeometryQuery(),
  useMapCelestialsQuery: () => ({ data: { mapCelestials: [] } }),
}));

// The scene is a WebGL object; jsdom has no GPU and this layer is verified by
// eye, not by assertion. Mocked so the component's branches can be reached.
vi.mock('./scene/createScene', () => ({
  DOT_TEXTURE_RADIUS: 32,
  createScene: vi.fn(() => new Promise(() => {})),
}));
vi.mock('./scene/systems', () => ({
  buildSystems: vi.fn(),
  scaleSystems: vi.fn(),
}));
vi.mock('./scene/edges', () => ({ drawEdges: vi.fn() }));
vi.mock('./scene/celestials', () => ({
  buildCelestials: vi.fn(),
  scaleCelestials: vi.fn(),
  setFineVisible: vi.fn(),
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
  useMapGeometryQuery.mockReturnValue({ data: GEOMETRY, loading: false });
});

describe('UniverseMap', () => {
  it('says so plainly when the browser has no WebGL 2', () => {
    webgl.mockReturnValue(false);
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(screen.getByText(/needs WebGL 2/)).toBeInTheDocument();
  });

  it('surfaces a query error rather than an empty canvas', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      error: { message: 'boom' },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(
      screen.getByText(/Could not load the map geometry: boom/),
    ).toBeInTheDocument();
  });

  it('shows the loader until the geometry lands', () => {
    useMapGeometryQuery.mockReturnValue({ loading: true });
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(screen.getByText('Loading the map...')).toBeInTheDocument();
  });

  it('says a scene is empty rather than drawing nothing silently', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      data: { mapGeometry: { ...GEOMETRY.mapGeometry, nodes: [] } },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(screen.getByText(/no systems to draw/)).toBeInTheDocument();
  });
});
