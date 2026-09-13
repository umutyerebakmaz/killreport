import { MapScope, type MapBounds } from '@/generated/graphql';
import { MAX_ZOOM } from './lod';
import { boundsCenter } from './origin';

/**
 * The camera, in galactic metres. It is stored this way rather than relative to
 * the origin because the origin moves in Phase 2 and a URL has to keep meaning
 * the same frame after it does.
 */
export interface MapCamera {
  x: number;
  z: number;
  zoom: number;
}

export const MAP_SCOPES: readonly MapScope[] = [
  MapScope.NewEden,
  MapScope.Pochven,
  MapScope.Wormhole,
];

export const DEFAULT_SCOPE: MapScope = MapScope.NewEden;

/** Leaves a margin, so the outermost dots are not half-clipped by the edge. */
export const FIT_PADDING = 0.92;

export const ZOOM_BELOW_FIT = 2;

/** For a scene with no extent: one node, or none. Matches NEW_EDEN's own fit. */
export const FALLBACK_FIT_ZOOM = -49.92;

/** The same grid the service rounds nodes to; the camera is never finer. */
export const CAMERA_GRID_METRES = 1e9;

export function fitZoom(
  bounds: MapBounds,
  width: number,
  height: number,
): number {
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  if (!(spanX > 0) || !(spanZ > 0) || !(width > 0) || !(height > 0)) {
    return FALLBACK_FIT_ZOOM;
  }

  // deck.gl's orthographic zoom is logarithmic: pixels = units * 2 ** zoom.
  return Math.log2(Math.min(width / spanX, height / spanZ) * FIT_PADDING);
}

export function fitCamera(
  bounds: MapBounds,
  width: number,
  height: number,
): MapCamera {
  const centre = boundsCenter(bounds);
  return { x: centre.x, z: centre.z, zoom: fitZoom(bounds, width, height) };
}

/**
 * The ceiling is absolute, not an offset from the fit. Phase 1 used fit + 13
 * because interiors were out of scope; it happened to land below the interior
 * threshold on every canvas, but for the wrong reason. `Math.max` guards the
 * degenerate case of a scene so small that its own fit is already deeper than
 * the ceiling.
 */
export function zoomLimits(fit: number): { minZoom: number; maxZoom: number } {
  return { minZoom: fit - ZOOM_BELOW_FIT, maxZoom: Math.max(MAX_ZOOM, fit) };
}

export function parseScope(params: URLSearchParams): MapScope {
  const raw = params.get('scope');
  return MAP_SCOPES.includes(raw as MapScope)
    ? (raw as MapScope)
    : DEFAULT_SCOPE;
}

/**
 * Null means "the URL does not carry a camera" — the caller autofits instead of
 * rendering a frame built out of NaNs.
 */
export function parseCamera(params: URLSearchParams): MapCamera | null {
  const raw = {
    x: params.get('x'),
    z: params.get('z'),
    zoom: params.get('zoom'),
  };
  if (raw.x === null || raw.z === null || raw.zoom === null) return null;

  const camera = { x: Number(raw.x), z: Number(raw.z), zoom: Number(raw.zoom) };
  if (
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.z) ||
    !Number.isFinite(camera.zoom)
  ) {
    return null;
  }

  return camera;
}

function toGrid(value: number): number {
  return Math.round(value / CAMERA_GRID_METRES) * CAMERA_GRID_METRES;
}

/**
 * The canonical serialisation. useMapCamera also uses it to tell its own writes
 * apart from someone else's, so it has to be a pure function of the camera.
 */
export function cameraQuery(scope: MapScope, camera: MapCamera): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('x', String(toGrid(camera.x)));
  params.set('z', String(toGrid(camera.z)));
  params.set('zoom', camera.zoom.toFixed(2));
  return params.toString();
}
