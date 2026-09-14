import type { CameraTransform } from './camera';
import type { LabelTier } from './lod';

/** The cap the design sets on how many names may be on screen at once. */
export const MAX_VISIBLE_LABELS = 300;

/**
 * Approximate character width in pixels, per tier.
 *
 * The collision box needs the text's width, and a BitmapText only knows its own
 * width once it exists — which a pure function cannot make. Each constant is
 * the tier's mean glyph advance at its font size plus its letterSpacing, both
 * taken from `TIER_STYLE` in `scene/labels.ts`. Region is uppercased at render,
 * so it uses Shentox-Regular's uppercase mean of 0.578 em: 18 × 0.578 + 3 ≈ 13.4.
 * The lowercase tiers use 0.5 em: 13 × 0.5 + 1 = 7.5, and 11 × 0.5 = 5.5.
 *
 * That makes a name of ordinary letter mix come out close, but the error is not
 * bounded: a string of all `I`s is far narrower than the estimate and a string
 * of all `W`s far wider. Good enough for a filter whose job is "do not overlap"
 * rather than pixel alignment. If exact measurement is ever needed, scene/ can
 * measure and pass halfWidth in; the interface already takes it.
 *
 * The tiers differ in size because the design gives each a role: region is
 * background and largest, system is foreground and smallest.
 */
export const LABEL_CHAR_WIDTH: Record<LabelTier, number> = {
  region: 13.4,
  constellation: 7.5,
  system: 5.5,
};

/**
 * Line height in pixels, per tier. Two jobs: it is the collision box's height,
 * and it is how far above the dot the name sits — see `labelCandidates`.
 */
export const LABEL_LINE_HEIGHT: Record<LabelTier, number> = {
  region: 21,
  constellation: 14,
  system: 11,
};

export interface LabelSource {
  id: number;
  name: string;
  x: number;
  z: number;
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

    for (const source of byTier[tier]) {
      const screenX = source.x * transform.scaleX + transform.x;
      const screenY = source.z * transform.scaleY + transform.y - lineHeight;
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
