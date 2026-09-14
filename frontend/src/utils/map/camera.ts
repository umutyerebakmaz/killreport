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

export interface CameraTransform {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

/**
 * The URL keeps deck.gl's logarithmic zoom so links shipped by phases 1 and 2
 * keep meaning. Pixi's camera is a linear container scale, and this is the
 * whole of the conversion: pixels = metres * 2 ** zoom.
 */
export function zoomToScale(zoom: number): number {
  return 2 ** zoom;
}

/**
 * What the root container's transform must be for this camera.
 *
 * scaleY is NEGATIVE. deck.gl expressed the orientation as flipY: false in one
 * line; Pixi's screen y runs down and has no such flag, so the axis is flipped
 * here instead. The region and constellation SVGs project "x is screen x, -z is
 * screen y", and a map that disagrees with its own thumbnails is a bug nobody
 * can name. Nothing else in the codebase may negate a coordinate.
 */
export function cameraTransform(
  camera: MapCamera,
  width: number,
  height: number,
): CameraTransform {
  const scale = zoomToScale(camera.zoom);
  return {
    scaleX: scale,
    scaleY: -scale,
    x: width / 2 - camera.x * scale,
    y: height / 2 + camera.z * scale,
  };
}

/** A drag of the scene, in screen pixels, as a move of the camera in metres. */
export function panCamera(
  camera: MapCamera,
  dxPixels: number,
  dyPixels: number,
): MapCamera {
  const scale = zoomToScale(camera.zoom);
  return {
    x: camera.x - dxPixels / scale,
    // Plus, not minus: the axis is flipped, so dragging down raises z.
    z: camera.z + dyPixels / scale,
    zoom: camera.zoom,
  };
}

/**
 * Zoom about a pointer, keeping the world point under it still. Clamped first,
 * so a wheel spun past the ceiling does not drag the view sideways while the
 * zoom refuses to move.
 */
export function zoomCameraAt(
  camera: MapCamera,
  deltaZoom: number,
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
  limits: { minZoom: number; maxZoom: number },
): MapCamera {
  const zoom = Math.min(
    limits.maxZoom,
    Math.max(limits.minZoom, camera.zoom + deltaZoom),
  );
  if (zoom === camera.zoom) return camera;

  const before = zoomToScale(camera.zoom);
  const after = zoomToScale(zoom);
  const offsetX = pointerX - width / 2;
  const offsetY = pointerY - height / 2;

  // The world point under the pointer, before and after, set equal.
  const worldX = camera.x + offsetX / before;
  const worldZ = camera.z - offsetY / before;

  return {
    x: worldX - offsetX / after,
    z: worldZ + offsetY / after,
    zoom,
  };
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

/** A system id out of the URL, or null. Ids are positive integers; nothing else is one. */
function parseId(raw: string | null): number | null {
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The selected system. This one is state — whether the popup is open — which is
 * why it is written back to the URL and `region`/`constellation` are not.
 */
export function parseFocus(params: URLSearchParams): number | null {
  return parseId(params.get('focus'));
}

/** What the URL asks the camera to look at. */
export type Framing =
  | { kind: 'system'; id: number }
  | { kind: 'constellation'; id: number }
  | { kind: 'region'; id: number };

/**
 * Most specific first. A URL carrying more than one of these was written by
 * hand, and a map link has no reason to show an error message: the order
 * resolves it silently.
 *
 * An explicit camera in the URL beats all three, and that is settled by the
 * caller — `useMapCamera` only falls back to a framing when the URL carries no
 * x/z/zoom. See UniverseMap.tsx.
 */
export function parseFraming(params: URLSearchParams): Framing | null {
  const focus = parseFocus(params);
  if (focus !== null) return { kind: 'system', id: focus };

  const constellation = parseId(params.get('constellation'));
  if (constellation !== null)
    return { kind: 'constellation', id: constellation };

  const region = parseId(params.get('region'));
  if (region !== null) return { kind: 'region', id: region };

  return null;
}

function toGrid(value: number): number {
  return Math.round(value / CAMERA_GRID_METRES) * CAMERA_GRID_METRES;
}

/**
 * The canonical serialisation. useMapCamera also uses it to tell its own writes
 * apart from someone else's, so it has to be a pure function of its arguments.
 *
 * `focus` is the third argument and it is required, not defaulted: a camera
 * write that forgot it would erase the selection from the URL, and the camera
 * is written on every pan. The compiler is what keeps that from happening
 * again.
 *
 * `region` and `constellation` are deliberately never written. They are
 * instructions — "set the map up here" — not state, and keeping them would
 * leave a URL still saying "look at this region" after the user has panned
 * somewhere else.
 */
export function cameraQuery(
  scope: MapScope,
  camera: MapCamera,
  focus: number | null,
): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('x', String(toGrid(camera.x)));
  params.set('z', String(toGrid(camera.z)));
  params.set('zoom', camera.zoom.toFixed(2));
  if (focus !== null) params.set('focus', String(focus));
  return params.toString();
}

/**
 * Which scene a region belongs to.
 *
 * This mirrors the backend's own rule — `scopePredicate` in
 * `backend/src/services/universe/universe-map.service.ts` — so a link can carry
 * the right scope without a round trip. Two places now hold one rule: if CCP
 * opens a new region band, both move together. The trade was taken deliberately
 * to keep this slice free of the backend; the comment there points back here.
 *
 * Only a REGION id decides this. Pochven's 27 systems sit at 30000021-30045329
 * and its 3 constellations at 20000787-20000789 — both inside the ordinary
 * k-space bands, because CCP converted them from existing ones and they kept
 * their ids. Measured 2026-09-14; a system or constellation id carries no scope
 * signal at all.
 *
 * Null means the region has no scene: abyssal, proving and GPMR-01 hold zero
 * celestials and the service gives them no MapScope member. A caller with null
 * builds no link.
 */
export function scopeForRegionId(regionId: number): MapScope | null {
  if (regionId === 10000070) return MapScope.Pochven;
  if (regionId >= 10000001 && regionId <= 10999999) return MapScope.NewEden;
  if (regionId >= 11000001 && regionId <= 11999999) return MapScope.Wormhole;
  return null;
}
