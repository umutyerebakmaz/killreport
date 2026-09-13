import { act, render, screen, waitFor } from '@testing-library/react';
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

// The scene is a WebGL object; jsdom has no GPU and what it draws is verified
// by eye, not by assertion. It is mocked — but mocked to a scene that actually
// resolves, because everything the component does with it afterwards is
// ordinary wiring, and a promise that never settled put all of it out of reach
// of any test.
const createScene = vi.fn<(host: HTMLElement) => Promise<FakeScene>>();
vi.mock('./scene/createScene', () => ({
  DOT_TEXTURE_RADIUS: 32,
  createScene: (host: HTMLElement) => createScene(host),
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

/** The canvas is a real element: `useMapPointer` binds listeners to it. */
type FakeScene = ReturnType<typeof fakeScene>;
function fakeScene() {
  return {
    app: {
      canvas: document.createElement('canvas'),
      renderer: { width: VIEWPORT.width, height: VIEWPORT.height },
    },
    world: { scale: { set: vi.fn() }, position: { set: vi.fn() } },
    edgesGalaxy: { visible: true, clear: vi.fn() },
    edgesLocal: { visible: true, clear: vi.fn() },
    systems: { visible: true },
    celestials: { visible: true },
    dot: {},
    destroy: vi.fn(),
  };
}

/** jsdom measures every element as 0x0, so the size comes from the renderer. */
const VIEWPORT = { width: 1400, height: 900 };

// jsdom has no ResizeObserver. vitest.setup.ts installs an inert stub for the
// components that merely construct one; this file needs to drive it, so it
// replaces it with a version that hands the callback back to the test.
let observedResize: ((box: { width: number; height: number }) => void) | null =
  null;
class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observedResize = (box) =>
      callback(
        [{ contentRect: box } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
  }
  observe() {}
  unobserve() {}
  disconnect() {
    observedResize = null;
  }
}
globalThis.ResizeObserver =
  TestResizeObserver as unknown as typeof ResizeObserver;

vi.mock('@/components/Loader', () => ({
  default: ({ text }: { text?: string }) => <div>{text}</div>,
}));

import { MapScope } from '@/generated/graphql';
import {
  cameraTransform,
  fitCamera,
  fitZoom,
  zoomToScale,
} from '@/utils/map/camera';
import UniverseMap from './UniverseMap';
import { buildCelestials } from './scene/celestials';
import { buildSystems } from './scene/systems';

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

let scene: FakeScene;

beforeEach(() => {
  webgl.mockReturnValue(true);
  useMapGeometryQuery.mockReturnValue({ data: GEOMETRY, loading: false });
  scene = fakeScene();
  createScene.mockResolvedValue(scene);
});

/** The camera the component autofits to, once the renderer has reported a size. */
const FIT_SCALE = zoomToScale(
  fitZoom(GEOMETRY.mapGeometry.bounds, VIEWPORT.width, VIEWPORT.height),
);

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

  // The host div renders behind the loader, so on a cold Apollo cache it does
  // not exist on the first render at all. A scene keyed on anything but the
  // node itself never notices it arriving, and the map stays blank for good.
  it('builds the scene when the host arrives on a later render', async () => {
    useMapGeometryQuery.mockReturnValue({ loading: true });
    const { rerender } = render(<UniverseMap scope={MapScope.NewEden} />);
    expect(createScene).not.toHaveBeenCalled();

    useMapGeometryQuery.mockReturnValue({ data: GEOMETRY, loading: false });
    rerender(<UniverseMap scope={MapScope.NewEden} />);

    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1));
    expect(createScene).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('builds the scene exactly once across renders that change nothing', async () => {
    const { rerender } = render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1));

    rerender(<UniverseMap scope={MapScope.NewEden} />);
    rerender(<UniverseMap scope={MapScope.NewEden} />);
    expect(createScene).toHaveBeenCalledTimes(1);
    expect(scene.destroy).not.toHaveBeenCalled();
  });

  // A sprite built at Pixi's default scale of 1 measures one texture radius in
  // world metres and is invisible. The build has to size what it makes, rather
  // than wait for a camera move that may not come.
  it('hands the builders the camera scale, so nothing is built invisible', async () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    await waitFor(() => expect(buildSystems).toHaveBeenCalled());
    expect(buildSystems).toHaveBeenLastCalledWith(
      scene,
      GEOMETRY.mapGeometry.nodes,
      FIT_SCALE,
    );
    expect(buildCelestials).toHaveBeenLastCalledWith(
      scene,
      [],
      expect.any(Map),
      FIT_SCALE,
    );
  });

  // deck.gl reported its own size through `onResize`. Pixi's `resizeTo` keeps
  // the canvas right but says nothing to React, so without an observer the
  // camera keeps centring the viewport the map was opened at and the zoom floor
  // stays derived from its dimensions.
  it('follows the host when the viewport changes size', async () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());

    act(() => observedResize?.({ width: 800, height: 600 }));

    const t = cameraTransform(
      fitCamera(GEOMETRY.mapGeometry.bounds, 800, 600),
      800,
      600,
    );
    expect(scene.world.scale.set).toHaveBeenLastCalledWith(t.scaleX, t.scaleY);
    expect(scene.world.position.set).toHaveBeenLastCalledWith(t.x, t.y);
  });

  it('ignores a zero-sized observation rather than fitting to nothing', async () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());
    const before = scene.world.position.set.mock.lastCall;

    act(() => observedResize?.({ width: 0, height: 0 }));

    expect(scene.world.position.set.mock.lastCall).toEqual(before);
  });

  it('tears the scene down when the map goes away', async () => {
    const { unmount } = render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1));

    unmount();
    expect(scene.destroy).toHaveBeenCalledTimes(1);
  });
});
