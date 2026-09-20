import { MapOwnerKind } from '@/generated/graphql';
import { eveImageUrl } from '@/utils/eveImageUrl';

/**
 * One atlas cell, and the size every logo is fetched at. 128 is a power of two
 * — the image server answers 400 to anything else — and the image is drawn
 * into the cell 1:1, so no logo is ever resampled.
 */
export const LOGO_CELL_PX = 128;

/** Half a cell: what `spriteScale` divides out, as DOT_TEXTURE_RADIUS does. */
export const LOGO_TEXTURE_RADIUS = LOGO_CELL_PX / 2;

export const LOGO_ATLAS_COLUMNS = 10;

/**
 * The smallest a logo is drawn, in pixels of radius.
 *
 * SOV_LOGO_ZOOM is the zoom where 90% of held systems are more than 16 px
 * from their neighbour, so 8 px of radius is the mark that measurement was
 * made for. Past the approach the system's own disc overtakes it and the logo
 * grows with the body, which is why this is a floor and not a size.
 */
export const LOGO_MIN_RADIUS_PX = 8;

/**
 * The id the default emblem is fetched under.
 *
 * 500003 is the Amarr faction, which is not an alliance — so the alliance path
 * has no logo to answer with and serves EVE's default alliance emblem, the
 * very image a logo-less alliance gets. Any id with no alliance behind it
 * would do; this one is stable and documented.
 */
export const DEFAULT_EMBLEM_OWNER_ID = 500003;

export interface LogoOwner {
  ownerId: number;
  kind: MapOwnerKind;
}

/**
 * Where an owner's logo lives, which depends on what kind of owner it is.
 *
 * A faction's crest is served from the CORPORATION path. Down the alliance
 * path it answers 200 with the default alliance emblem — a measured trap,
 * because nothing in the status code says the image is a placeholder.
 */
export function logoUrl(owner: LogoOwner): string {
  return eveImageUrl({
    kind: owner.kind === MapOwnerKind.Alliance ? 'alliance' : 'corporation',
    id: owner.ownerId,
    // eveImageUrl asks for twice the drawn size; half a cell is what makes
    // that land exactly on LOGO_CELL_PX. The spec pins the resulting URL.
    size: LOGO_CELL_PX / 2,
  });
}

export interface FrameLayout {
  cellByOwner: Map<number, number>;
  /** The shared cell for owners with no logo; -1 when every owner has one. */
  fallbackCell: number;
  cellCount: number;
}

/**
 * Which atlas cell each owner draws from.
 *
 * Owners with no logo of their own all get the SAME cell: the default emblem
 * is byte-identical for every one of them — 22 of the 79 sovereignty-holding
 * alliances on 2026-09-20 — so a cell each would hold 22 copies of one image.
 * What tells those 22 apart on the map is the tint their sprites keep; see
 * `applyLogos`.
 */
export function assignFrames(
  owners: LogoOwner[],
  hasOwnLogo: (ownerId: number) => boolean,
): FrameLayout {
  const cellByOwner = new Map<number, number>();
  const missing: number[] = [];
  let next = 0;

  for (const owner of owners) {
    if (hasOwnLogo(owner.ownerId)) cellByOwner.set(owner.ownerId, next++);
    else missing.push(owner.ownerId);
  }

  const fallbackCell = missing.length === 0 ? -1 : next++;
  for (const ownerId of missing) cellByOwner.set(ownerId, fallbackCell);

  return { cellByOwner, fallbackCell, cellCount: next };
}

/**
 * The texture the cells are laid out on: ten columns, and as many rows as the
 * cells need. Derived rather than fixed, because the owner count moves — 101
 * owners hold sovereignty today and 80 of them need a cell, but an alliance
 * taking its first system adds one.
 */
export function atlasSize(cellCount: number): {
  columns: number;
  rows: number;
  width: number;
  height: number;
} {
  const rows = Math.max(1, Math.ceil(cellCount / LOGO_ATLAS_COLUMNS));
  return {
    columns: LOGO_ATLAS_COLUMNS,
    rows,
    width: LOGO_ATLAS_COLUMNS * LOGO_CELL_PX,
    height: rows * LOGO_CELL_PX,
  };
}

export function cellRect(cell: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: (cell % LOGO_ATLAS_COLUMNS) * LOGO_CELL_PX,
    y: Math.floor(cell / LOGO_ATLAS_COLUMNS) * LOGO_CELL_PX,
    width: LOGO_CELL_PX,
    height: LOGO_CELL_PX,
  };
}

/**
 * Whether two downloads are the same image, byte for byte.
 *
 * This is how "this alliance has no logo" is detected, because the HTTP status
 * will not say: the server answers 200 with the default emblem. Comparing the
 * bytes of the response we already have to the bytes of the default costs one
 * extra download for the whole atlas and no decoding at all.
 */
export function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
