import type { CameraTransform } from './camera';
import { labelLineHeight } from './labelStyle';
import type { LabelMeasure } from './measure';
import { systemFloorPx, systemRadiusPx } from './marks';
import type { LabelTier } from './lod';

/** The cap the design sets on how many names may be on screen at once. */
export const MAX_VISIBLE_LABELS = 300;

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

/**
 * Extra lift for a system name while the sovereignty logos are on screen.
 *
 * The clearance term below is measured from the DOT — `systemFloorPx` tops out
 * at 6 px — while a logo is drawn at LOGO_MIN_RADIUS_PX plus its disc, so a
 * name that clears the dot still lands on the crest. This does not close that
 * gap arithmetically: full clearance would be about 12 px here, and 5 is where
 * the user left it on 2026-09-20, tuned by looking. Raising it is one number.
 */
export const LABEL_LOGO_LIFT_PX = 5;

export interface LabelBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LabelSource {
  id: number;
  name: string;
  x: number;
  z: number;
  /**
   * The system's own radius in metres, for a name with a mark under it. Absent
   * for a source with nothing drawn at its anchor.
   */
  radius?: number;
  /**
   * The area this name covers, for an area name. Absent for a point name, whose
   * anchor is the thing itself.
   */
  bounds?: LabelBounds;
}

/**
 * How much of its own name a region must be able to cover before it is named,
 * as a fraction of the name's width.
 *
 * A strict "the name must fit" rule would name nothing: at REGION_LABEL_ZOOM a
 * region spans about the 60 px that separates it from its neighbour, while
 * "Sinq Laison" sets 129 px wide. At 0.8 a region is named once it is nearly as
 * wide as its own name, which is what makes big regions open before small ones
 * instead of all of them opening at one zoom.
 *
 * A judgement, not a measurement. Tune by looking.
 */
export const REGION_FIT_RATIO = 0.8;

export interface LabelCandidate {
  key: string;
  name: string;
  tier: LabelTier;
  /** Centre of the drawn text, not of the dot it belongs to. */
  screenX: number;
  screenY: number;
  halfWidth: number;
  halfHeight: number;
  /**
   * The system this name can select, for the layer's `data-map-system` stamp.
   * Only the system tier has one: a region name selecting whichever star its
   * anchor happens to sit on would be a lie about what was clicked.
   */
  systemId?: number;
  /**
   * The area this name can highlight, for the layer's `data-map-region` and
   * `data-map-constellation` stamps. The system tier's twin, one per area
   * tier: a name lights the area it actually names and nothing wider.
   */
  regionId?: number;
  constellationId?: number;
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
  measure,
  transform,
  width,
  height,
  logos = false,
}: {
  tiers: LabelTier[];
  regions: LabelSource[];
  constellations: LabelSource[];
  systems: LabelSource[];
  measure: LabelMeasure;
  transform: CameraTransform;
  width: number;
  height: number;
  /** Whether the sovereignty layer is drawing logos in place of the dots. */
  logos?: boolean;
}): LabelCandidate[] {
  const byTier: Record<LabelTier, LabelSource[]> = {
    region: regions,
    constellation: constellations,
    system: systems,
  };

  const candidates: LabelCandidate[] = [];

  for (const tier of TIER_SOURCES) {
    if (!tiers.includes(tier)) continue;

    const lineHeight = labelLineHeight(tier);
    const halfHeight = lineHeight / 2;
    // `scaleX` is the camera's linear scale — see cameraTransform — so the dot
    // size the system tier has to clear is recoverable here without the caller
    // passing the zoom a second time.
    const floorPx = systemFloorPx(Math.log2(transform.scaleX));

    for (const source of byTier[tier]) {
      // The lift depends on the DATA, not on the tier: a source with a radius has
      // a mark drawn under it and the name has to clear the disc; one without has
      // nothing there and a line height is the whole lift.
      //
      // `?? 0` would be wrong here. systemRadiusPx floors at `floorPx`, so a
      // missing radius read as 0 still returns 1.5-6 px and would quietly push the
      // centroid tiers up by that much.
      const lift =
        source.radius === undefined
          ? lineHeight
          : Math.max(
              lineHeight,
              halfHeight +
                systemRadiusPx(source.radius, transform.scaleX, floorPx) +
                LABEL_DOT_GAP_PX,
            ) +
            // Only where there is a mark to clear. A centroid tier has nothing
            // drawn at it, so a logo elsewhere on the map is no reason to move
            // a region's name.
            (logos && source.radius !== undefined ? LABEL_LOGO_LIFT_PX : 0);

      const textWidth = measure(tier, source.name);
      const halfWidth = textWidth / 2;

      let screenX = source.x * transform.scaleX + transform.x;
      let screenY = source.z * transform.scaleY + transform.y - lift;

      if (source.bounds) {
        // An area name earns its place from the area, not from the zoom: it
        // appears when the region can nearly cover its own name, and stays
        // hidden while it would spill across its neighbours.
        const boxLeft = source.bounds.minX * transform.scaleX + transform.x;
        const boxRight = source.bounds.maxX * transform.scaleX + transform.x;
        if (boxRight - boxLeft < REGION_FIT_RATIO * textWidth) continue;

        // scaleY is negative, so maxZ projects to the SMALLER screen y.
        const boxTop = source.bounds.maxZ * transform.scaleY + transform.y;
        const boxBottom = source.bounds.minZ * transform.scaleY + transform.y;

        // A name belongs to the part of its area that is on screen; when none
        // of it is, the name is not this viewport's to draw. Without this the
        // collapsed clamp below pins it to the near edge — and `low` is inside
        // the viewport on the left and the top, so a region off to the left
        // would have its name glued to x = halfWidth and one above it to
        // y = halfHeight. Tiers accumulate, so at constellation or system zoom
        // that is a column of region names down the left edge and a row along
        // the top, each winning its collisions on coarsest-tier priority and
        // eating the MAX_VISIBLE_LABELS budget.
        if (
          boxRight < 0 ||
          boxLeft > width ||
          boxBottom < 0 ||
          boxTop > height
        ) {
          continue;
        }

        // Clamped into whatever of the area is on screen, so panning past the
        // centre slides the name along the edge instead of dropping it.
        // Clamping rather than re-centring on the intersection: a clamp is
        // monotone, so the name slides where a re-centre would jump.
        screenX = clampAnchor(
          screenX,
          Math.max(boxLeft, 0),
          Math.min(boxRight, width),
          halfWidth,
        );
        screenY = clampAnchor(
          screenY,
          Math.max(boxTop, 0),
          Math.min(boxBottom, height),
          halfHeight,
        );
      }

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
        systemId: tier === 'system' ? source.id : undefined,
        regionId: tier === 'region' ? source.id : undefined,
        constellationId: tier === 'constellation' ? source.id : undefined,
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

/** Shared empty set, so the default argument mints nothing per frame. */
const EMPTY_STICKY: ReadonlySet<string> = new Set();

/**
 * Greedy, in the order given, with the previous frame's survivors going first.
 *
 * O(n*k) with k the number already placed. k is capped at MAX_VISIBLE_LABELS and
 * the viewport clip has already cut n, so the worst case is nothing in a frame.
 *
 * `sticky` is what stops the flicker. Placement is recomputed from scratch on
 * every camera change, so two names whose boxes nearly tie were resolved
 * differently from one frame to the next and blinked against each other. Giving
 * the ones already on screen the first pass makes the tie resolve the same way
 * it resolved last time — and a candidate that has left the viewport or its
 * tier simply is not in the list any more, so the set needs no expiry of its
 * own.
 *
 * Within each pass the tier order is untouched: a sticky system name still
 * yields to a sticky region name.
 *
 * The input is not mutated; the caller keeps its candidate list.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  sticky: ReadonlySet<string> = EMPTY_STICKY,
): LabelCandidate[] {
  const placed: LabelCandidate[] = [];

  const consider = (candidate: LabelCandidate) => {
    if (placed.length >= MAX_VISIBLE_LABELS) return;
    if (placed.some((other) => overlaps(candidate, other))) return;
    placed.push(candidate);
  };

  for (const candidate of candidates) {
    if (sticky.has(candidate.key)) consider(candidate);
  }
  for (const candidate of candidates) {
    if (!sticky.has(candidate.key)) consider(candidate);
  }

  return placed;
}

/**
 * Clamped into [low, high], and pinned to `low` when the range has collapsed —
 * a box narrower than the name it holds has no valid position, and the near
 * edge is a better answer than an inverted one.
 */
function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * Puts the anchor in the part of `[low, high]` that can hold a label reaching
 * `half` either side of it.
 *
 * When `[low, high]` is too narrow to hold one — the visible sliver of an area
 * is narrower than its name — the name cannot sit inside it whatever we do, so
 * the anchor is clamped into the sliver itself and the name overhangs it
 * evenly. Insetting anyway would collapse the range and leave the anchor `half`
 * past the near edge, drawing the name beside its own area rather than over it.
 *
 * `low <= high` always: the caller has already dropped a box that does not
 * intersect the viewport, so both clamps below are well ordered.
 */
function clampAnchor(
  value: number,
  low: number,
  high: number,
  half: number,
): number {
  if (high - low < half * 2) return clamp(value, low, high);
  return clamp(value, low + half, high - half);
}
