import { MapScope } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  cameraQuery,
  cameraTransform,
  FALLBACK_FIT_ZOOM,
  fitCamera,
  fitZoom,
  panCamera,
  parseCamera,
  parseScope,
  scopeForRegionId,
  zoomCameraAt,
  zoomLimits,
  zoomToScale,
} from './camera';
import { MAX_ZOOM } from './lod';

const NEW_EDEN_BOUNDS = {
  minX: -508743946216137000,
  maxX: 336522971264518000,
  minZ: -484452845697854000,
  maxZ: 472860102256057000,
};

describe('fitZoom', () => {
  it('fits the real NEW_EDEN extent into 1400 x 900', () => {
    // Unpadded the fit is -49.918; FIT_PADDING 0.92 costs log2(0.92) = -0.12.
    expect(fitZoom(NEW_EDEN_BOUNDS, 1400, 900)).toBeCloseTo(-50.04, 2);
  });

  it('is bound by the taller axis, not the wider one', () => {
    // spanZ 9.57e17 > spanX 8.45e17, so a taller canvas changes the answer and
    // a wider one does not.
    const tall = fitZoom(NEW_EDEN_BOUNDS, 1400, 1800);
    const wide = fitZoom(NEW_EDEN_BOUNDS, 2800, 900);
    expect(tall).toBeGreaterThan(fitZoom(NEW_EDEN_BOUNDS, 1400, 900));
    expect(wide).toBeCloseTo(fitZoom(NEW_EDEN_BOUNDS, 1400, 900), 6);
  });

  it('falls back rather than returning -Infinity for a scene with no extent', () => {
    expect(fitZoom({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, 1400, 900)).toBe(
      FALLBACK_FIT_ZOOM,
    );
  });

  it('falls back rather than returning NaN for a zero-sized canvas', () => {
    expect(fitZoom(NEW_EDEN_BOUNDS, 0, 0)).toBe(FALLBACK_FIT_ZOOM);
  });
});

describe('fitCamera', () => {
  it('centres on the scene and carries the fit zoom', () => {
    const camera = fitCamera(NEW_EDEN_BOUNDS, 1400, 900);
    expect(camera.x).toBeCloseTo(-8.611049e16, -10);
    expect(camera.z).toBeCloseTo(-5.796372e15, -10);
    expect(camera.zoom).toBeCloseTo(-50.04, 2);
  });
});

describe('zoomLimits', () => {
  it('opens down to two levels below the fit and up to the absolute ceiling', () => {
    expect(zoomLimits(-50)).toEqual({ minZoom: -52, maxZoom: MAX_ZOOM });
  });

  it('gives the same ceiling on every canvas, which a fit offset would not', () => {
    expect(zoomLimits(-50.04).maxZoom).toBe(zoomLimits(-49.36).maxZoom);
  });

  it('never returns a ceiling below the floor for a tiny scene', () => {
    const limits = zoomLimits(-10);
    expect(limits.maxZoom).toBeGreaterThanOrEqual(limits.minZoom);
  });
});

describe('parseScope', () => {
  it('reads a known scope', () => {
    expect(parseScope(new URLSearchParams('scope=POCHVEN'))).toBe(
      MapScope.Pochven,
    );
  });

  it('defaults to NEW_EDEN when absent', () => {
    expect(parseScope(new URLSearchParams(''))).toBe(MapScope.NewEden);
  });

  it('defaults to NEW_EDEN for a scope the backend has no scene for', () => {
    expect(parseScope(new URLSearchParams('scope=ABYSSAL'))).toBe(
      MapScope.NewEden,
    );
    expect(parseScope(new URLSearchParams('scope=new_eden'))).toBe(
      MapScope.NewEden,
    );
  });
});

describe('parseCamera', () => {
  it('reads a complete camera', () => {
    expect(
      parseCamera(
        new URLSearchParams('x=-129550000000000000&z=1e9&zoom=-42.5'),
      ),
    ).toEqual({ x: -129550000000000000, z: 1e9, zoom: -42.5 });
  });

  it('returns null when any part is missing, so the caller can autofit', () => {
    expect(parseCamera(new URLSearchParams('x=1&z=2'))).toBeNull();
    expect(parseCamera(new URLSearchParams('x=1&zoom=-42'))).toBeNull();
    expect(parseCamera(new URLSearchParams(''))).toBeNull();
  });

  it('returns null for junk rather than a NaN camera', () => {
    expect(parseCamera(new URLSearchParams('x=abc&z=2&zoom=-42'))).toBeNull();
    expect(
      parseCamera(new URLSearchParams('x=1&z=2&zoom=Infinity')),
    ).toBeNull();
  });
});

describe('cameraQuery', () => {
  it('rounds the target to the same 1e9 m grid as the nodes', () => {
    const query = cameraQuery(MapScope.NewEden, {
      x: -129550000000123,
      z: 43236000000987,
      zoom: -50.0383,
    });
    const params = new URLSearchParams(query);
    expect(params.get('x')).toBe('-129550000000000');
    expect(params.get('z')).toBe('43236000000000');
  });

  it('writes the zoom to two decimals', () => {
    const params = new URLSearchParams(
      cameraQuery(MapScope.Pochven, { x: 0, z: 0, zoom: -50.0383 }),
    );
    expect(params.get('zoom')).toBe('-50.04');
    expect(params.get('scope')).toBe('POCHVEN');
  });

  it('never writes exponential notation, which would not parse back the same', () => {
    const query = cameraQuery(MapScope.NewEden, {
      x: -5.08743946e17,
      z: 4.7286e17,
      zoom: -50,
    });
    expect(query).not.toContain('e+');
    expect(parseCamera(new URLSearchParams(query))).toEqual({
      x: -508743946000000000,
      z: 472860000000000000,
      zoom: -50,
    });
  });

  it('round-trips a camera it wrote', () => {
    const camera = { x: 1e9, z: -2e9, zoom: -37.5 };
    expect(
      parseCamera(new URLSearchParams(cameraQuery(MapScope.Wormhole, camera))),
    ).toEqual(camera);
  });
});

describe('zoomToScale', () => {
  it('is deck.gl’s logarithmic zoom, so shipped URLs keep meaning', () => {
    // pixels = metres * 2 ** zoom. The URL still carries the log form.
    expect(zoomToScale(-36.18)).toBeCloseTo(2 ** -36.18, 20);
    expect(zoomToScale(-42.5)).toBeCloseTo(2 ** -42.5, 20);
  });
});

describe('cameraTransform', () => {
  const camera = { x: 3e17, z: 2e17, zoom: -50 };
  const t = cameraTransform(camera, 1400, 900);

  it('flips y, because Pixi’s screen y runs down and the map’s +z runs up', () => {
    // deck.gl said flipY: false in one line; in Pixi it is a negative y scale.
    // The region and constellation SVGs are drawn "x is screen x, -z is screen
    // y", and a map that disagrees with its own thumbnails is a bug nobody can
    // name.
    expect(t.scaleX).toBeCloseTo(2 ** -50, 20);
    expect(t.scaleY).toBeCloseTo(-(2 ** -50), 20);
  });

  it('puts the camera’s own point at the centre of the viewport', () => {
    expect(camera.x * t.scaleX + t.x).toBeCloseTo(700, 6);
    expect(camera.z * t.scaleY + t.y).toBeCloseTo(450, 6);
  });

  it('maps a point one screen-pixel of world above the camera above it on screen', () => {
    // +z is up, so a larger z must produce a SMALLER screen y.
    const higher = (camera.z + 1 / t.scaleX) * t.scaleY + t.y;
    expect(higher).toBeCloseTo(449, 6);
  });
});

describe('panCamera', () => {
  it('moves the camera opposite the drag, in world metres', () => {
    const c = { x: 0, z: 0, zoom: -50 };
    const scale = 2 ** -50;
    // Dragging the scene 100 px right moves the camera 100 px of world left.
    // Compared as a ratio, not with toBeCloseTo's absolute tolerance: the value
    // is ~1.1e17, and even toBeCloseTo(..., -20) admits 5e19 — 444 times the
    // number under test, which constrains nothing.
    const panned = panCamera(c, 100, 0);
    expect(panned.x / (-100 / scale)).toBeCloseTo(1, 9);
  });

  it('moves +z when dragged down, because the axis is flipped', () => {
    const c = { x: 0, z: 0, zoom: -50 };
    const scale = 2 ** -50;
    expect(panCamera(c, 0, 100).z / (100 / scale)).toBeCloseTo(1, 9);
  });

  it('leaves the zoom alone', () => {
    expect(panCamera({ x: 0, z: 0, zoom: -50 }, 10, 10).zoom).toBe(-50);
  });
});

describe('zoomCameraAt', () => {
  const limits = { minZoom: -52, maxZoom: -24.51 };

  it('keeps the world point under the pointer fixed', () => {
    const before = { x: 1e17, z: -2e17, zoom: -45 };
    const [px, py] = [1100, 300];
    const after = zoomCameraAt(before, 1.5, px, py, 1400, 900, limits);

    const worldUnder = (c: typeof before) => {
      const s = 2 ** c.zoom;
      return {
        x: c.x + (px - 700) / s,
        z: c.z - (py - 450) / s,
      };
    };
    const a = worldUnder(before);
    const b = worldUnder(after);
    expect(b.x).toBeCloseTo(a.x, -8);
    expect(b.z).toBeCloseTo(a.z, -8);
  });

  it('stops at the ceiling rather than diving past it', () => {
    const c = { x: 0, z: 0, zoom: -25 };
    expect(zoomCameraAt(c, 10, 700, 450, 1400, 900, limits).zoom).toBe(-24.51);
  });

  it('stops at the floor', () => {
    const c = { x: 0, z: 0, zoom: -51 };
    expect(zoomCameraAt(c, -10, 700, 450, 1400, 900, limits).zoom).toBe(-52);
  });

  it('does not move the camera when the zoom is already clamped', () => {
    const c = { x: 7e16, z: -3e16, zoom: -24.51 };
    const after = zoomCameraAt(c, 5, 100, 100, 1400, 900, limits);
    expect(after.x).toBeCloseTo(c.x, 6);
    expect(after.z).toBeCloseTo(c.z, 6);
  });
});

describe('scopeForRegionId', () => {
  it('puts the k-space band in NEW_EDEN', () => {
    expect(scopeForRegionId(10000001)).toBe(MapScope.NewEden);
    expect(scopeForRegionId(10000002)).toBe(MapScope.NewEden); // The Forge
    expect(scopeForRegionId(10999999)).toBe(MapScope.NewEden);
  });

  // Cut out of the middle of that band, exactly as the service's predicate
  // does: Pochven is a closed component and gets its own scene.
  it('cuts Pochven out of the k-space band', () => {
    expect(scopeForRegionId(10000070)).toBe(MapScope.Pochven);
  });

  it('puts the wormhole band in WORMHOLE', () => {
    expect(scopeForRegionId(11000001)).toBe(MapScope.Wormhole);
    expect(scopeForRegionId(11000033)).toBe(MapScope.Wormhole);
    expect(scopeForRegionId(11999999)).toBe(MapScope.Wormhole);
  });

  // Zarzakh and Manifest sit at the top of the k-space band and belong to
  // NEW_EDEN, which is where the service puts them too. Measured, not assumed.
  it('keeps Zarzakh and Manifest in NEW_EDEN', () => {
    expect(scopeForRegionId(10001000)).toBe(MapScope.NewEden); // Zarzakh
    expect(scopeForRegionId(10001004)).toBe(MapScope.NewEden); // Manifest
  });

  // Null is "this region has no scene", not "unknown": the caller renders no
  // link rather than one that opens an unrelated scene and ignores its
  // parameter.
  it('returns null for a region that has no scene at all', () => {
    expect(scopeForRegionId(12000001)).toBeNull(); // abyssal
    expect(scopeForRegionId(14000001)).toBeNull(); // proving
    expect(scopeForRegionId(19000001)).toBeNull(); // GPMR-01
    expect(scopeForRegionId(10000000)).toBeNull(); // below the k-space band
    expect(scopeForRegionId(0)).toBeNull();
  });
});
