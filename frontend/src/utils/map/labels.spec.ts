import { describe, expect, it } from 'vitest';
import { labelLineHeight } from './labelStyle';
import type { LabelMeasure } from './measure';
import { systemFloorPx, systemRadiusPx } from './marks';
import {
  labelCandidates,
  LABEL_DOT_GAP_PX,
  MAX_VISIBLE_LABELS,
  placeLabels,
  type LabelCandidate,
} from './labels';

/**
 * A fake measurer that counts 4 px per character. jsdom has no real
 * `measureText`, and even with one it would not be the subject here: what these
 * tests are about is how the measurement is used.
 */
const measure: LabelMeasure = (_tier, name) => name.length * 4;

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
      measure,
      transform,
      width: W,
      height: H,
    });

    expect(c.screenX).toBeCloseTo(700, 6);
    // 450 is where the dot is; the name sits one line height above it.
    expect(c.screenY).toBeCloseTo(450 - labelLineHeight('region'), 6);
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
      measure,
      transform,
      width: W,
      height: H,
    });

    // The two centroid tiers lift by exactly their line height. The system tier
    // takes the larger of that and the room its dot needs, so it is allowed to
    // sit higher — never lower.
    for (const c of candidates) {
      const lift = 450 - c.screenY;
      if (c.tier === 'system') {
        expect(lift).toBeGreaterThanOrEqual(labelLineHeight('system'));
      } else {
        expect(lift).toBeCloseTo(labelLineHeight(c.tier), 6);
      }
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
      measure,
      transform,
      width: W,
      height: H,
    });

    expect(c.screenY).toBeCloseTo(449 - labelLineHeight('region'), 6);
  });

  it('drops candidates outside the viewport before anything else runs', () => {
    const offscreen = 5000 / transform.scaleX;
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'In', 0, 0), source(2, 'Out', offscreen, 0)],
      constellations: [],
      systems: [],
      measure,
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
      measure,
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.name)).toEqual(['Low']);
    expect(candidates[0].screenY).toBeCloseTo(
      H + 12 - labelLineHeight('region'),
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
      measure,
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
      measure,
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
      measure,
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
      measure,
      transform,
      width: W,
      height: H,
    });

    // 'Jita' is 4 chars; the fake measurer counts 4 px per char.
    expect(c.halfWidth).toBeCloseTo((4 * 4) / 2, 6);
  });

  it('gives every candidate a key that is unique across tiers', () => {
    // Region 10000002 and constellation 10000002 cannot collide today, but the
    // key carries the tier so a future tier cannot break this quietly.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation'],
      regions: [source(42, 'R', 0, 0)],
      constellations: [source(42, 'C', 2e16, 0)],
      systems: [],
      measure,
      transform,
      width: W,
      height: H,
    });

    expect(new Set(candidates.map((c) => c.key)).size).toBe(2);
  });

  it('carries a selectable system id on the system tier alone', () => {
    // The layer stamps `data-map-system` from this, and picking reads it. A
    // region name is anchored to a centroid, so a system id on one would make a
    // click select whichever star that centroid happens to sit near.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation', 'system'],
      regions: [source(1, 'R', 0, 0)],
      constellations: [source(2, 'C', 3e16, 0)],
      systems: [source(30000142, 'S', 6e16, 0)],
      measure,
      transform,
      width: W,
      height: H,
    });

    const byTier = new Map(candidates.map((c) => [c.tier, c.systemId]));
    expect(byTier.get('system')).toBe(30000142);
    expect(byTier.get('region')).toBeUndefined();
    expect(byTier.get('constellation')).toBeUndefined();
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

  it('keeps the one already on screen when a collision ties', () => {
    // Two names at the same point: in list order A wins.
    const a: LabelCandidate = {
      key: 'system:1',
      name: 'A',
      tier: 'system',
      screenX: 100,
      screenY: 100,
      halfWidth: 20,
      halfHeight: 5,
    };
    const b: LabelCandidate = { ...a, key: 'system:2', name: 'B' };

    expect(placeLabels([a, b]).map((c) => c.key)).toEqual(['system:1']);

    // If B was placed on the previous frame, B is the one that stays.
    expect(
      placeLabels([a, b], new Set(['system:2'])).map((c) => c.key),
    ).toEqual(['system:2']);
  });

  it('ignores a sticky key that is no longer a candidate', () => {
    const a: LabelCandidate = {
      key: 'system:1',
      name: 'A',
      tier: 'system',
      screenX: 100,
      screenY: 100,
      halfWidth: 20,
      halfHeight: 5,
    };

    expect(placeLabels([a], new Set(['system:99'])).map((c) => c.key)).toEqual([
      'system:1',
    ]);
  });

  it('keeps the tier order among the sticky candidates too', () => {
    const region: LabelCandidate = {
      key: 'region:1',
      name: 'R',
      tier: 'region',
      screenX: 100,
      screenY: 100,
      halfWidth: 20,
      halfHeight: 9,
    };
    const system: LabelCandidate = {
      key: 'system:1',
      name: 'S',
      tier: 'system',
      screenX: 100,
      screenY: 100,
      halfWidth: 20,
      halfHeight: 5,
    };

    const placed = placeLabels(
      [region, system],
      new Set(['region:1', 'system:1']),
    );

    expect(placed.map((c) => c.key)).toEqual(['region:1']);
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
      measure,
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

  // The line height is a floor on the lift, never a reduction of it. With the
  // gap at 7 the clearance term is what binds at every zoom, so the lift at the
  // galaxy view is exactly half a line plus the dot's floor plus the gap — and
  // that is the arithmetic a change to any of the three has to move.
  it('is the clearance term, and never less than the line height', () => {
    const lift = 450 - systemAt(-50, 3.8809e12).screenY;

    expect(lift).toBeGreaterThanOrEqual(labelLineHeight('system'));
    expect(lift).toBeCloseTo(
      labelLineHeight('system') / 2 + systemFloorPx(-50) + LABEL_DOT_GAP_PX,
      6,
    );
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

describe('the lift', () => {
  it('lifts a name with no mark under it by a full line height', () => {
    const [c] = labelCandidates({
      tiers: ['constellation'],
      regions: [],
      constellations: [{ id: 1, name: 'Kimotoro', x: 0, z: 0 }],
      systems: [],
      measure,
      transform,
      width: W,
      height: H,
    });

    expect(c.screenY).toBeCloseTo(450 - labelLineHeight('constellation'), 6);
  });

  it('clears both the disc and the gap when the source has a radius', () => {
    const radius = 4e15;
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 30000142, name: 'Jita', x: 0, z: 0, radius }],
      measure,
      transform,
      width: W,
      height: H,
    });

    const lineHeight = labelLineHeight('system');
    const floorPx = systemFloorPx(Math.log2(transform.scaleX));
    const expected = Math.max(
      lineHeight,
      lineHeight / 2 +
        systemRadiusPx(radius, transform.scaleX, floorPx) +
        LABEL_DOT_GAP_PX,
    );

    expect(c.screenY).toBeCloseTo(450 - expected, 6);
  });

  it('falls to the dot floor for a zero-radius system, not to the line height', () => {
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 30000001, name: 'Tanoo', x: 0, z: 0, radius: 0 }],
      measure,
      transform,
      width: W,
      height: H,
    });

    const lineHeight = labelLineHeight('system');
    const floorPx = systemFloorPx(Math.log2(transform.scaleX));
    const expected = Math.max(
      lineHeight,
      lineHeight / 2 + floorPx + LABEL_DOT_GAP_PX,
    );

    expect(c.screenY).toBeCloseTo(450 - expected, 6);
  });

  it('takes the width from the measurer, not from the name length', () => {
    const wide: LabelMeasure = () => 100;
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 1, name: 'I', x: 0, z: 0, radius: 0 }],
      measure: wide,
      transform,
      width: W,
      height: H,
    });

    expect(c.halfWidth).toBe(50);
  });
});

describe('the region extent rule', () => {
  const bounds = { minX: -1e16, maxX: 1e16, minZ: -1e16, maxZ: 1e16 };

  it('does not draw a region name the region cannot nearly cover', () => {
    // The measurer calls the name 1000 px; the region is far narrower than
    // that at this transform.
    const huge: LabelMeasure = () => 1000;

    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'The Forge', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: huge,
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toEqual([]);
  });

  it('draws it once the region is wide enough', () => {
    const small: LabelMeasure = () => 4;

    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'The Forge', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: small,
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toHaveLength(1);
  });

  it('does not apply the rule to a source with no bounds', () => {
    const huge: LabelMeasure = () => 1000;

    const candidates = labelCandidates({
      tiers: ['constellation'],
      regions: [],
      constellations: [{ id: 1, name: 'Kimotoro', x: 0, z: 0 }],
      systems: [],
      measure: huge,
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toHaveLength(1);
  });
});

describe('viewport clamping', () => {
  const bounds = { minX: -1e17, maxX: 1e17, minZ: -1e17, maxZ: 1e17 };

  it('keeps the name of an off-centre region in the part that is on screen', () => {
    // The centre is off to the left while the box still intersects the
    // screen. -5000 put the box itself entirely off screen too, so it did not
    // set up the case this describes.
    const offscreen = { ...transform, x: -50 };

    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform: offscreen,
      width: W,
      height: H,
    });

    expect(c).toBeDefined();
    expect(c.screenX).toBeGreaterThanOrEqual(c.halfWidth);
    expect(c.screenX).toBeLessThanOrEqual(W - c.halfWidth);
  });

  it('leaves the position alone while the centre is on screen', () => {
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform,
      width: W,
      height: H,
    });

    expect(c.screenX).toBeCloseTo(700, 6);
  });

  it('drops a region lying entirely off the left edge instead of pinning its name there', () => {
    // The clamp below only makes sense for a box that still intersects the
    // viewport. With the whole region to the LEFT the range collapses and the
    // clamp falls back to `low` — which on this side is the inside-the-viewport
    // value, so the name would be glued to x = halfWidth.
    const offLeft = { ...transform, x: -500 };
    const boxRight = bounds.maxX * offLeft.scaleX + offLeft.x;
    expect(boxRight).toBeLessThan(0);

    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform: offLeft,
      width: W,
      height: H,
    });

    expect(candidates).toEqual([]);
  });

  it('drops a region lying entirely above the top edge instead of pinning its name there', () => {
    // The other side that misbehaves: scaleY is negative, so a region wholly
    // above the viewport has both boxTop and boxBottom below zero, the vertical
    // range collapses, and `low` is again inside the viewport.
    const offTop = { ...transform, y: -500 };
    const boxBottom = bounds.minZ * offTop.scaleY + offTop.y;
    expect(boxBottom).toBeLessThan(0);

    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform: offTop,
      width: W,
      height: H,
    });

    expect(candidates).toEqual([]);
  });

  it('keeps the anchor inside a sliver narrower than the name', () => {
    // The other half of the clamp, and the case C1's guard deliberately left
    // alone: the box DOES intersect the viewport, but the part on screen is
    // narrower than the name. Inset by halfWidth the range collapses, and
    // falling back to `low` puts the centre outside the sliver — the name
    // drawn beside its own area rather than over it.
    const sliver = { ...transform, x: -68.82 };
    const boxRight = bounds.maxX * sliver.scaleX + sliver.x;
    expect(boxRight).toBeGreaterThan(0);
    expect(boxRight).toBeLessThan(20.1);

    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 80,
      transform: sliver,
      width: W,
      height: H,
    });

    expect(c).toBeDefined();
    // Wider than the sliver, so it has to overhang — but the anchor itself
    // stays over the visible part.
    expect(c.halfWidth * 2).toBeGreaterThan(boxRight);
    expect(c.screenX).toBeGreaterThanOrEqual(0);
    expect(c.screenX).toBeLessThanOrEqual(boxRight);
  });

  it('keeps a region whose box still overlaps the viewport by a sliver', () => {
    // The boundary the guard must not overshoot: 38.8 px of this region is on
    // screen, so it is still this viewport's name to draw.
    const barely = { ...transform, x: -50 };

    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform: barely,
      width: W,
      height: H,
    });

    expect(c).toBeDefined();
    expect(c.screenX).toBeGreaterThanOrEqual(c.halfWidth);
  });
});
