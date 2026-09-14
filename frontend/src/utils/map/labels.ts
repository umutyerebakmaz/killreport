import type { CameraTransform } from './camera';
import { systemFloorPx, systemRadiusPx } from './marks';
import type { LabelTier } from './lod';

/** The cap the design sets on how many names may be on screen at once. */
export const MAX_VISIBLE_LABELS = 300;

/**
 * Mean character width in pixels, per tier.
 *
 * The collision box needs the text's width, and a BitmapText only knows its own
 * width once it exists — which a pure function cannot make. Each constant is the
 * tier's mean glyph advance at its font size plus its letterSpacing, both taken
 * from `TIER_STYLE` in `scene/labels.ts`.
 *
 * Measured 2026-09-15, not estimated: every name the scene can draw, weighed
 * against its own tier's Shentox file straight out of the TTF.
 *
 *   region          70 names, uppercased   700   0.5453 em   16 × … + 3 = 11.72
 *   constellation  799 names               600   0.5149 em   12 × … + 1 =  7.18
 *   system       5,485 names               500   0.5172 em    8 × … + 0 =  4.14
 *
 * Each against its own weight's file, because the advances differ between them:
 * Shentox-Bold's uppercase mean is 0.5453 em where Regular's is 0.5397.
 *
 * The em figures are the measurement and do not move with the font size; only
 * the multiplication does, so a tier can be resized by redoing one line here.
 *
 * A generic alphabet mean was what these used to be derived from, and it is
 * wrong for this data: EVE names are thick with digits and hyphens, which pulls
 * the mean well off the letter-only figure. The error is still not bounded — a
 * string of all `I`s is far narrower and one of all `W`s far wider — but it is
 * now centred on the names that actually exist. Kerning makes real strings a
 * shade narrower than this, which errs the safe way for a filter whose job is
 * "do not overlap".
 *
 * If exact measurement is ever needed, scene/ can measure and pass halfWidth in;
 * the interface already takes it.
 *
 * The tiers differ in size because the design gives each a role: region is
 * background and largest, system is foreground and smallest.
 */
export const LABEL_CHAR_WIDTH: Record<LabelTier, number> = {
  region: 11.72,
  constellation: 7.18,
  system: 4.14,
};

/**
 * Line height in pixels, per tier. Two jobs: it is the collision box's height,
 * and it is the minimum lift above the dot — see `labelCandidates`, where the
 * system tier takes the larger of this and the room its own disc needs.
 *
 * 1.15x the font size, rounded: Shentox's ascender and descender together are
 * about 1.2 em, so a box at the font size alone would clip a descender out of
 * the collision test and let two names touch.
 */
export const LABEL_LINE_HEIGHT: Record<LabelTier, number> = {
  region: 18,
  constellation: 14,
  system: 9,
};

/**
 * How far a system name is held clear of its own dot, in pixels.
 *
 * Only the system tier needs it: a region or constellation name sits on a
 * centroid, which has nothing drawn at it.
 *
 * Raised from 3 to 7 by eye. At 3 the name cleared the disc arithmetically but
 * still read as attached to it; the gap is what makes the two separate things.
 * Because the clearance term is what wins at every zoom, this constant is
 * exactly how far above its dot a system name sits — change it and they all
 * move together.
 */
export const LABEL_DOT_GAP_PX = 7;

export interface LabelSource {
  id: number;
  name: string;
  x: number;
  z: number;
  /**
   * The system's own radius in metres, for the system tier. Absent for the two
   * centroid tiers, which have no mark under them to clear.
   */
  radius?: number;
}

export interface LabelCandidate {
  key: string;
  name: string;
  tier: LabelTier;
  /** Centre of the drawn text, not of the dot it belongs to. */
  screenX: number;
  screenY: number;
  halfWidth: number;
  halfHeight: number;
}

const TIER_SOURCES = ['region', 'constellation', 'system'] as const;

/**
 * World positions into screen-space boxes, viewport-clipped, coarsest tier first.
 *
 * The projection is the same multiply-add cameraTransform already describes —
 * note that scaleY is negative, so a larger z lands at a smaller screen y. That
 * is the map's +z-is-up contract, and it is the one thing here that silently
 * inverts if copied wrong.
 *
 * The projected y is then lifted by one line height, so the name sits above the
 * mark it belongs to rather than on it. That offset is applied HERE rather than
 * at draw time on purpose: it differs per tier, so a filter that reserved the
 * unshifted anchor would clear cross-tier pairs that then overlap by up to the
 * difference, and its viewport clip would test a box the glyphs never occupy —
 * dropping names along the bottom edge while letting names along the top edge
 * through to be cut off by the canvas. A `LabelCandidate`'s coordinates mean
 * "where the text is", which is what picking and hover will need too.
 *
 * The returned order is the collision priority: coarsest first, so a crowd
 * sacrifices the finest tier.
 */
export function labelCandidates({
  tiers,
  regions,
  constellations,
  systems,
  transform,
  width,
  height,
}: {
  tiers: LabelTier[];
  regions: LabelSource[];
  constellations: LabelSource[];
  systems: LabelSource[];
  transform: CameraTransform;
  width: number;
  height: number;
}): LabelCandidate[] {
  const byTier: Record<LabelTier, LabelSource[]> = {
    region: regions,
    constellation: constellations,
    system: systems,
  };

  const candidates: LabelCandidate[] = [];

  for (const tier of TIER_SOURCES) {
    if (!tiers.includes(tier)) continue;

    const charWidth = LABEL_CHAR_WIDTH[tier];
    const lineHeight = LABEL_LINE_HEIGHT[tier];
    const halfHeight = lineHeight / 2;
    // `scaleX` is the camera's linear scale — see cameraTransform — so the dot
    // size the system tier has to clear is recoverable here without the caller
    // passing the zoom a second time.
    const floorPx = systemFloorPx(Math.log2(transform.scaleX));

    for (const source of byTier[tier]) {
      // A line height is the whole lift for a centroid tier. For a system it is
      // a minimum: the dots grow with the camera, and a fixed lift put the
      // glyphs inside the disc the moment it passed half a line height. Taking
      // the larger of the two keeps the galaxy view exactly where it was and
      // lets the name rise with the mark from there.
      const lift =
        tier === 'system'
          ? Math.max(
              lineHeight,
              halfHeight +
                systemRadiusPx(source.radius ?? 0, transform.scaleX, floorPx) +
                LABEL_DOT_GAP_PX,
            )
          : lineHeight;

      const screenX = source.x * transform.scaleX + transform.x;
      const screenY = source.z * transform.scaleY + transform.y - lift;
      const halfWidth = (source.name.length * charWidth) / 2;

      // Clipped before anything else runs: the filter is O(n*k) and n is what
      // the viewport leaves, not what the scene holds.
      if (
        screenX + halfWidth < 0 ||
        screenX - halfWidth > width ||
        screenY + halfHeight < 0 ||
        screenY - halfHeight > height
      ) {
        continue;
      }

      candidates.push({
        key: `${tier}:${source.id}`,
        name: source.name,
        tier,
        screenX,
        screenY,
        halfWidth,
        halfHeight,
      });
    }
  }

  return candidates;
}

function overlaps(a: LabelCandidate, b: LabelCandidate): boolean {
  // Strict: boxes that exactly touch are clear. Rejecting those would thin the
  // map for nothing.
  return (
    Math.abs(a.screenX - b.screenX) < a.halfWidth + b.halfWidth &&
    Math.abs(a.screenY - b.screenY) < a.halfHeight + b.halfHeight
  );
}

/**
 * Greedy, single pass, in the order given.
 *
 * O(n*k) with k the number already placed. k is capped at 300 and the viewport
 * clip has already cut n, so the worst case is nothing in a frame.
 *
 * The input is not mutated; the caller keeps its candidate list.
 */
export function placeLabels(candidates: LabelCandidate[]): LabelCandidate[] {
  const placed: LabelCandidate[] = [];

  for (const candidate of candidates) {
    if (placed.length >= MAX_VISIBLE_LABELS) break;
    if (placed.some((other) => overlaps(candidate, other))) continue;
    placed.push(candidate);
  }

  return placed;
}
