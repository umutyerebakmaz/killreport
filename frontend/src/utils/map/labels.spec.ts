import { describe, expect, it } from 'vitest';
import {
  labelCandidates,
  LABEL_CHAR_WIDTH,
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
    expect(c.screenY).toBeCloseTo(450, 6);
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

    expect(c.screenY).toBeCloseTo(449, 6);
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

    expect(placeLabels(many).length).toBeLessThanOrEqual(MAX_VISIBLE_LABELS);
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
