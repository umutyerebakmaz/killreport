import { MapScope } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  cameraQuery,
  FALLBACK_FIT_ZOOM,
  fitCamera,
  fitZoom,
  parseCamera,
  parseScope,
  zoomLimits,
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
