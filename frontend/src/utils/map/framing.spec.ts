import { describe, expect, it } from 'vitest';

import { fitCamera } from './camera';
import { framingFor, nodeBounds, type FramingNode } from './framing';
import { SYSTEM_LABEL_ZOOM } from './lod';

const WIDTH = 1400;
const HEIGHT = 900;

function node(over: Partial<FramingNode> = {}): FramingNode {
  return {
    systemId: 30000142,
    constellationId: 20000020,
    regionId: 10000002,
    x: 0,
    z: 0,
    ...over,
  };
}

/** The Forge, two systems of it, and one system of Domain to sit outside. */
const NODES: FramingNode[] = [
  node({ systemId: 30000142, x: 1e16, z: 2e16 }), // Jita
  node({ systemId: 30000144, x: 3e16, z: 6e16 }), // Perimeter
  node({
    systemId: 30002187, // Amarr
    constellationId: 20000322,
    regionId: 10000043,
    x: -9e16,
    z: -9e16,
  }),
];

describe('nodeBounds', () => {
  it('is null for an empty set, rather than an infinite box', () => {
    expect(nodeBounds([])).toBeNull();
  });

  it('spans every node it is given', () => {
    expect(nodeBounds(NODES)).toEqual({
      minX: -9e16,
      maxX: 3e16,
      minZ: -9e16,
      maxZ: 6e16,
    });
  });

  it('collapses to a point for a single node', () => {
    expect(nodeBounds([node({ x: 5e16, z: -5e16 })])).toEqual({
      minX: 5e16,
      maxX: 5e16,
      minZ: -5e16,
      maxZ: -5e16,
    });
  });
});

describe('framingFor', () => {
  it('is null when the URL asks for nothing', () => {
    expect(framingFor(null, NODES, WIDTH, HEIGHT)).toBeNull();
  });

  // A system is centred, not framed. Framing it to its gate neighbours was the
  // more elegant single rule and it is wrong: a system whose only gate leads
  // 20 ly away would frame so wide that the focused system becomes a dot.
  it('centres a system at the zoom where its neighbours are 59.9 px away', () => {
    expect(
      framingFor({ kind: 'system', id: 30000142 }, NODES, WIDTH, HEIGHT),
    ).toEqual({ x: 1e16, z: 2e16, zoom: SYSTEM_LABEL_ZOOM });
  });

  it('does not widen a system framing to reach its neighbours', () => {
    const framing = framingFor(
      { kind: 'system', id: 30000142 },
      NODES,
      WIDTH,
      HEIGHT,
    );
    // Amarr is 9e16 away. A bounds-based rule would have zoomed out to hold it.
    expect(framing?.zoom).toBe(SYSTEM_LABEL_ZOOM);
    expect(framing?.zoom).toBeGreaterThan(-49);
  });

  // A cluster is framed, because what is wanted there is to see the whole set.
  it('frames a region to the bounds of its own nodes', () => {
    expect(
      framingFor({ kind: 'region', id: 10000002 }, NODES, WIDTH, HEIGHT),
    ).toEqual(
      fitCamera(
        { minX: 1e16, maxX: 3e16, minZ: 2e16, maxZ: 6e16 },
        WIDTH,
        HEIGHT,
      ),
    );
  });

  it('frames a constellation the same way', () => {
    expect(
      framingFor({ kind: 'constellation', id: 20000020 }, NODES, WIDTH, HEIGHT),
    ).toEqual(
      fitCamera(
        { minX: 1e16, maxX: 3e16, minZ: 2e16, maxZ: 6e16 },
        WIDTH,
        HEIGHT,
      ),
    );
  });

  // Duzna Kah (20010000) holds only Zarzakh; Manifest District (20010001) only
  // Manifest. Five more single-system constellations exist in WORMHOLE, so this
  // is an ordinary entry, not a hypothetical. A zero span sends fitZoom to
  // FALLBACK_FIT_ZOOM, which is the galaxy fit — silently ignoring the request.
  it('falls back to the system zoom for a cluster with one node', () => {
    const solitary = [
      node({
        systemId: 30100000,
        constellationId: 20010000,
        x: 7e16,
        z: -3e16,
      }),
    ];
    expect(
      framingFor(
        { kind: 'constellation', id: 20010000 },
        solitary,
        WIDTH,
        HEIGHT,
      ),
    ).toEqual({ x: 7e16, z: -3e16, zoom: SYSTEM_LABEL_ZOOM });
  });

  // The same trap on one axis: fitZoom needs both spans positive.
  it('falls back to the system zoom for a cluster with no width', () => {
    const column = [
      node({ systemId: 30000142, constellationId: 20000020, x: 4e16, z: 1e16 }),
      node({ systemId: 30000144, constellationId: 20000020, x: 4e16, z: 5e16 }),
    ];
    expect(
      framingFor(
        { kind: 'constellation', id: 20000020 },
        column,
        WIDTH,
        HEIGHT,
      ),
    ).toEqual({ x: 4e16, z: 3e16, zoom: SYSTEM_LABEL_ZOOM });
  });

  // The map is not a validator, and showing a 404 would mean waiting for the
  // whole scene. Null sends the caller back to its autofit.
  it('is null for an id the loaded scene does not hold', () => {
    expect(
      framingFor({ kind: 'system', id: 39999999 }, NODES, WIDTH, HEIGHT),
    ).toBeNull();
    expect(
      framingFor({ kind: 'region', id: 10000070 }, NODES, WIDTH, HEIGHT),
    ).toBeNull();
  });

  // Before the host is measured there is no frame to compute, and fitZoom would
  // hand back FALLBACK_FIT_ZOOM for a viewport of zero.
  it('is null until the viewport has been measured', () => {
    expect(
      framingFor({ kind: 'region', id: 10000002 }, NODES, 0, 0),
    ).toBeNull();
  });
});
