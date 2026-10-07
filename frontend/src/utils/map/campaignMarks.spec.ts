import { describe, expect, it } from 'vitest';
import type { CameraTransform } from './camera';
import {
  campaignSources,
  RING_ARC_COUNT,
  RING_ARC_GAP_RAD,
  RING_GAP_PX,
  RING_SPIN_PERIOD_MS,
  ringArcs,
  ringMarks,
  ringSpinAngle,
  shouldSpinRings,
  type CampaignSource,
} from './campaignMarks';
import { systemFloorPx, systemRadiusPx } from './marks';
import { discRadiusPx, LOGO_MIN_RADIUS_PX } from './sovLogos';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const HOUR = 3_600_000;
const at = (ms: number) => new Date(NOW + ms).toISOString();

/** World metres straight onto screen pixels: x→x, z→-y, centred at (500, 400). */
const SCALE = 2 ** -45;
const TRANSFORM: CameraTransform = {
  scaleX: SCALE,
  scaleY: -SCALE,
  x: 500,
  y: 400,
};
const VIEW = { width: 1000, height: 800 };

/** No system draws a logo; every system does. */
const NO_LOGOS = () => false;
const ALL_LOGOS = () => true;

/** A world point that lands on the given screen pixel. */
const worldAt = (sx: number, sy: number) => ({
  x: (sx - TRANSFORM.x) / TRANSFORM.scaleX,
  z: (sy - TRANSFORM.y) / TRANSFORM.scaleY,
});

const source = (
  id: number,
  sx: number,
  sy: number,
  startIn: number,
): CampaignSource => ({
  systemId: 30000000 + id,
  ...worldAt(sx, sy),
  radius: 1e12,
  startTime: at(startIn),
});

describe('campaignSources', () => {
  const campaign = (campaignId: number, solarSystemId: number) => ({
    campaignId,
    solarSystemId,
    solarSystemName: `S${campaignId}`,
    eventType: 'ihub_defense',
    startTime: at(HOUR),
  });
  const nodes = [{ systemId: 30000001, x: 1, z: 2, radius: 3 }];

  it('places a campaign on its system', () => {
    expect(campaignSources([campaign(1, 30000001)], nodes)).toEqual([
      {
        systemId: 30000001,
        x: 1,
        z: 2,
        radius: 3,
        startTime: at(HOUR),
      },
    ]);
  });

  // POCHVEN and WORMHOLE scenes hold no null-sec: their campaigns have no
  // system to sit on and are simply not drawn.
  it('drops a campaign whose system is not in the scene', () => {
    expect(campaignSources([campaign(2, 30009999)], nodes)).toEqual([]);
  });
});

describe('ringMarks', () => {
  it('rings the system just outside its drawn disc', () => {
    const [ring] = ringMarks({
      sources: [source(1, 300, 200, HOUR)],
      transform: TRANSFORM,
      ...VIEW,
      drawsLogo: NO_LOGOS,
      now: NOW,
    });
    const disc = systemRadiusPx(1e12, SCALE, systemFloorPx(Math.log2(SCALE)));

    expect(ring.x).toBeCloseTo(300);
    expect(ring.y).toBeCloseTo(200);
    expect(ring.radius).toBeCloseTo(disc + RING_GAP_PX);
    expect(ring.live).toBe(false);
  });

  it('is live once the timer has started', () => {
    const [ring] = ringMarks({
      sources: [source(1, 300, 200, -1)],
      transform: TRANSFORM,
      ...VIEW,
      drawsLogo: NO_LOGOS,
      now: NOW,
    });
    expect(ring.live).toBe(true);
  });

  // Two campaigns in one system draw two rings of one size, and the last one
  // drawn is the one seen. Soonest first puts the live one first, so without
  // the ordering the upcoming ring painted over it.
  it('draws live rings last, over an upcoming ring in the same system', () => {
    const live = source(1, 300, 200, -1);
    const upcoming = { ...source(2, 300, 200, HOUR), systemId: live.systemId };
    const elsewhere = source(3, 600, 200, 2 * HOUR);
    const rings = ringMarks({
      sources: [live, upcoming, elsewhere],
      transform: TRANSFORM,
      ...VIEW,
      drawsLogo: NO_LOGOS,
      now: NOW,
    });

    expect(rings.map((ring) => ring.live)).toEqual([false, false, true]);
    expect(rings[2].x).toBeCloseTo(300);
    expect(rings[0].x).toBeCloseTo(300);
    expect(rings[1].x).toBeCloseTo(600);
  });

  it('clears the logo disc rather than the dot where a crest is drawn', () => {
    const [logo] = ringMarks({
      sources: [source(1, 300, 200, HOUR)],
      transform: TRANSFORM,
      ...VIEW,
      drawsLogo: ALL_LOGOS,
      now: NOW,
    });
    expect(logo.radius).toBeCloseTo(
      discRadiusPx(LOGO_MIN_RADIUS_PX) + RING_GAP_PX,
    );
  });

  // With crests on, a system whose owner is not the isolated one — or whose
  // logo has not loaded — is still a dot, and its ring hugs the dot.
  it('asks per system, not per layer, which mark is drawn', () => {
    const rings = ringMarks({
      sources: [source(1, 300, 200, HOUR), source(2, 600, 200, HOUR)],
      transform: TRANSFORM,
      ...VIEW,
      drawsLogo: (systemId) => systemId === 30000001,
      now: NOW,
    });
    const dot = systemRadiusPx(1e12, SCALE, systemFloorPx(Math.log2(SCALE)));

    expect(rings[0].radius).toBeCloseTo(
      discRadiusPx(LOGO_MIN_RADIUS_PX) + RING_GAP_PX,
    );
    expect(rings[1].radius).toBeCloseTo(dot + RING_GAP_PX);
  });

  it('skips a ring wholly off screen', () => {
    expect(
      ringMarks({
        sources: [source(1, -500, 200, HOUR)],
        transform: TRANSFORM,
        ...VIEW,
        drawsLogo: NO_LOGOS,
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe('ringSpinAngle', () => {
  it('turns once per period, starting from zero', () => {
    expect(ringSpinAngle(0)).toBe(0);
    expect(ringSpinAngle(RING_SPIN_PERIOD_MS / 4)).toBeCloseTo(Math.PI / 2);
    expect(ringSpinAngle(RING_SPIN_PERIOD_MS / 2)).toBeCloseTo(Math.PI);
  });

  // From the clock, so a long-open tab does not grow the angle without bound.
  it('wraps into [0, 2π)', () => {
    expect(ringSpinAngle(RING_SPIN_PERIOD_MS)).toBe(0);
    expect(ringSpinAngle(10 * RING_SPIN_PERIOD_MS + 1_500)).toBeCloseTo(
      ringSpinAngle(1_500),
    );
    expect(ringSpinAngle(-1_500)).toBeCloseTo(ringSpinAngle(4_500));
  });

  it('takes the period as a parameter', () => {
    expect(ringSpinAngle(500, 1_000)).toBeCloseTo(Math.PI);
  });
});

describe('ringArcs', () => {
  const step = (2 * Math.PI) / RING_ARC_COUNT;

  it('draws RING_ARC_COUNT arcs', () => {
    expect(ringArcs(0)).toHaveLength(RING_ARC_COUNT);
    expect(ringArcs(0, 4)).toHaveLength(4);
  });

  it('leaves RING_ARC_GAP_RAD between neighbouring arcs, all the way round', () => {
    const arcs = ringArcs(0);
    for (let i = 0; i < arcs.length; i++) {
      const next = arcs[(i + 1) % arcs.length];
      const nextStart =
        i + 1 === arcs.length ? next.start + 2 * Math.PI : next.start;
      expect(nextStart - arcs[i].end).toBeCloseTo(RING_ARC_GAP_RAD);
      expect(arcs[i].end - arcs[i].start).toBeCloseTo(step - RING_ARC_GAP_RAD);
    }
  });

  it('is offset as a whole by the angle', () => {
    const still = ringArcs(0);
    const turned = ringArcs(1);
    turned.forEach((arc, i) => {
      expect(arc.start - still[i].start).toBeCloseTo(1);
      expect(arc.end - still[i].end).toBeCloseTo(1);
    });
  });

  // Pixi's y points down: a point at angle θ sits at (cos θ, sin θ) on screen,
  // so a growing angle carries an arc from the right of the centre towards
  // below it — clockwise as the viewer sees it.
  it('turns clockwise on screen as time passes', () => {
    const screen = (angle: number) => ({
      x: Math.cos(angle),
      y: Math.sin(angle),
    });
    const before = screen(ringArcs(ringSpinAngle(0))[0].start);
    const after = screen(
      ringArcs(ringSpinAngle(RING_SPIN_PERIOD_MS / 8))[0].start,
    );
    // The first arc starts just past +x (to the right, y slightly down) and
    // moves further down, i.e. clockwise, an eighth of a turn later.
    expect(before.x).toBeGreaterThan(0);
    expect(after.y).toBeGreaterThan(before.y);
    expect(after.x).toBeLessThan(before.x);
  });
});

describe('shouldSpinRings', () => {
  it('spins while there is a ring to turn', () => {
    expect(shouldSpinRings(2, false)).toBe(true);
  });

  it('does not run with nothing to draw', () => {
    expect(shouldSpinRings(0, false)).toBe(false);
  });

  it('stands still for a viewer who asked for reduced motion', () => {
    expect(shouldSpinRings(2, true)).toBe(false);
  });
});
