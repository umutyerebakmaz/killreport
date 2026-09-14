import { describe, expect, it } from 'vitest';
import { systemFloorPx, systemRadiusPx } from './marks';
import {
  labelCandidates,
  LABEL_CHAR_WIDTH,
  LABEL_DOT_GAP_PX,
  LABEL_LINE_HEIGHT,
  MAX_VISIBLE_LABELS,
  placeLabels,
  type LabelCandidate,
} from './labels';

// A camera at the galaxy fit on a 1400x900 canvas, centred on the origin.
const transform = { scaleX: 2 ** -50, scaleY: -(2 ** -50), x: 700, y: 450 };
const W = 1400;
const H = 900;

function source(id: number, name: string, x: number, z: number) {
  return { id, name, x, z };
}

describe('labelCandidates', () => {
  it('projects a world position into screen space with the camera transform', () => {
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'The Forge', 0, 0)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(c.screenX).toBeCloseTo(700, 6);
    // 450 is where the dot is; the name sits one line height above it.
    expect(c.screenY).toBeCloseTo(450 - LABEL_LINE_HEIGHT.region, 6);
  });

  it('lifts the text one line height above the projected position, per tier', () => {
    // The coordinates a candidate carries are where the GLYPHS are, not where
    // the dot is. The filter, the viewport clip and later picking all read
    // them, so the lift has to be in them rather than applied at draw time.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation', 'system'],
      regions: [source(1, 'R', 0, 0)],
      constellations: [source(2, 'C', 3e16, 0)],
      systems: [source(3, 'S', 6e16, 0)],
      transform,
      width: W,
      height: H,
    });

    // At the galaxy fit the dot is at its floor, so the system tier's clearance
    // rule does not yet exceed its line height and all three still agree.
    for (const c of candidates) {
      expect(c.screenY).toBeCloseTo(450 - LABEL_LINE_HEIGHT[c.tier], 6);
    }

    // And the lift really does differ per tier, which is why a filter working
    // on unshifted anchors would clear cross-tier pairs that then overlap.
    expect(new Set(candidates.map((c) => c.screenY)).size).toBe(3);
  });

  it('puts a larger z higher on screen, not lower', () => {
    // +z is up. Getting this backwards is the one mistake that makes the map
    // disagree with the region thumbnails shipped elsewhere in the app.
    const above = 1 / transform.scaleX; // one screen pixel of world
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'A', 0, above)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(c.screenY).toBeCloseTo(449 - LABEL_LINE_HEIGHT.region, 6);
  });

  it('drops candidates outside the viewport before anything else runs', () => {
    const offscreen = 5000 / transform.scaleX;
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'In', 0, 0), source(2, 'Out', offscreen, 0)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.name)).toEqual(['In']);
  });

  it('keeps a label near the bottom edge whose text is still on screen', () => {
    // The dot sits 12 px below the canvas, so its own box is clear of the
    // viewport and an unshifted clip would drop the name. The name is drawn a
    // line height above the dot, which puts its centre back on screen.
    const below = (H + 12 - transform.y) / transform.scaleY;
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'Low', 0, below)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.name)).toEqual(['Low']);
    expect(candidates[0].screenY).toBeCloseTo(
      H + 12 - LABEL_LINE_HEIGHT.region,
      6,
    );
    // And the dot's own unshifted box really was off screen.
    expect(H + 12 - candidates[0].halfHeight).toBeGreaterThan(H);
  });

  it('drops a label whose text has been lifted off the top edge', () => {
    // The mirror of the case above: the dot is 4 px inside the canvas, but the
    // lift puts the whole box above y = 0, so nothing would be readable.
    const high = (0 + 4 - transform.y) / transform.scaleY;
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'High', 0, high)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toEqual([]);
  });

  it('includes only the tiers it was given', () => {
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'R', 0, 0)],
      constellations: [source(2, 'C', 0, 0)],
      systems: [source(3, 'S', 0, 0)],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.tier)).toEqual(['region']);
  });

  it('orders candidates coarsest tier first', () => {
    // This order IS the collision priority; placeLabels relies on it.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation', 'system'],
      regions: [source(1, 'R', 0, 0)],
      constellations: [source(2, 'C', 3e16, 0)],
      systems: [source(3, 'S', 6e16, 0)],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.tier)).toEqual([
      'region',
      'constellation',
      'system',
    ]);
  });

  it('sizes the box from the name length and the tier', () => {
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'Jita', 0, 0)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(c.halfWidth).toBeCloseTo((4 * LABEL_CHAR_WIDTH.region) / 2, 6);
  });

  it('gives every candidate a key that is unique across tiers', () => {
    // Region 10000002 and constellation 10000002 cannot collide today, but the
    // key carries the tier so a future tier cannot break this quietly.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation'],
      regions: [source(42, 'R', 0, 0)],
      constellations: [source(42, 'C', 2e16, 0)],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(new Set(candidates.map((c) => c.key)).size).toBe(2);
  });
});

describe('placeLabels', () => {
  function box(
    name: string,
    tier: LabelCandidate['tier'],
    screenX: number,
    screenY: number,
  ): LabelCandidate {
    return {
      key: `${tier}:${name}`,
      name,
      tier,
      screenX,
      screenY,
      halfWidth: 20,
      halfHeight: 6,
    };
  }

  it('keeps labels that do not touch', () => {
    const placed = placeLabels([
      box('A', 'region', 100, 100),
      box('B', 'region', 400, 400),
    ]);

    expect(placed.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('drops the later of two overlapping labels', () => {
    const placed = placeLabels([
      box('A', 'region', 100, 100),
      box('B', 'region', 110, 102),
    ]);

    expect(placed.map((p) => p.name)).toEqual(['A']);
  });

  it('sacrifices the finer tier, because the input arrives coarsest first', () => {
    // The order is the priority. A constellation sitting on a region loses.
    const placed = placeLabels([
      box('Region', 'region', 100, 100),
      box('Constellation', 'constellation', 105, 100),
    ]);

    expect(placed.map((p) => p.name)).toEqual(['Region']);
  });

  it('treats touching-but-not-overlapping boxes as clear', () => {
    // Exactly adjacent: 100 + 20 === 140 - 20. Rejecting these would thin the
    // map for no reason.
    const placed = placeLabels([
      box('A', 'region', 100, 100),
      box('B', 'region', 140, 100),
    ]);

    expect(placed).toHaveLength(2);
  });

  it('stops at the cap', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      box(`L${i}`, 'system', (i % 20) * 200, Math.floor(i / 20) * 200),
    );

    // toBe, not toBeLessThanOrEqual: the grid is 20x20 at 200 px pitch with
    // 40x12 boxes, so nothing overlaps and the cap is the only thing that can
    // stop it. An assertion that merely bounded it would pass on zero.
    expect(placeLabels(many)).toHaveLength(MAX_VISIBLE_LABELS);
    expect(MAX_VISIBLE_LABELS).toBe(300);
  });

  it('returns an empty list for an empty input rather than throwing', () => {
    expect(placeLabels([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [box('A', 'region', 100, 100), box('B', 'region', 105, 100)];
    placeLabels(input);
    expect(input).toHaveLength(2);
  });
});

describe('a system name clearing its own dot', () => {
  /** A camera deep enough that the dot has grown past its floor. */
  const deep = (zoom: number) => ({
    scaleX: 2 ** zoom,
    scaleY: -(2 ** zoom),
    x: 700,
    y: 450,
  });

  function systemAt(zoom: number, radius: number) {
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 3, name: 'Jita', x: 0, z: 0, radius }],
      transform: deep(zoom),
      width: W,
      height: H,
    });
    return c;
  }

  /** How far the glyph box's bottom edge sits above the dot's own edge. */
  function clearance(c: LabelCandidate, zoom: number, radius: number) {
    const dot = systemRadiusPx(radius, 2 ** zoom, systemFloorPx(zoom));
    const bottomEdge = c.screenY + c.halfHeight;
    return 450 - dot - bottomEdge;
  }

  // The dots grow with the camera now, and a lift fixed at one line height put
  // the glyphs inside the disc as soon as it passed 5.5 px.
  it('keeps the gap as the dot grows under it', () => {
    for (const zoom of [-45.73, -42, -40, -38]) {
      const c = systemAt(zoom, 3.8809e12);
      expect(clearance(c, zoom, 3.8809e12)).toBeGreaterThanOrEqual(
        LABEL_DOT_GAP_PX - 1e-9,
      );
    }
  });

  // Past the cap the disc is the system's own radius, not the floor, and the
  // name has to clear that too. At INTERIOR_ZOOM the median system is 49.85 px
  // across — the figure lod.ts derives that threshold from.
  it('clears a disc far larger than the floor', () => {
    const zoom = -36.18;
    const radius = 3.8809e12;
    const c = systemAt(zoom, radius);
    expect(systemRadiusPx(radius, 2 ** zoom, systemFloorPx(zoom))).toBeCloseTo(
      49.85,
      1,
    );
    expect(clearance(c, zoom, radius)).toBeGreaterThanOrEqual(
      LABEL_DOT_GAP_PX - 1e-9,
    );
  });

  // The rule is a floor on the lift, not a replacement for it: at the galaxy
  // view the line height is still the larger of the two and nothing moves.
  it('leaves the galaxy view exactly where it was', () => {
    const c = systemAt(-50, 3.8809e12);
    expect(c.screenY).toBeCloseTo(450 - LABEL_LINE_HEIGHT.system, 6);
  });

  it('rises monotonically as the camera comes in', () => {
    let previousLift = 0;
    for (let zoom = -50; zoom <= -36; zoom += 0.5) {
      const lift = 450 - systemAt(zoom, 3.8809e12).screenY;
      expect(lift).toBeGreaterThanOrEqual(previousLift);
      previousLift = lift;
    }
  });
});
