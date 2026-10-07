import { describe, expect, it } from 'vitest';
import type { CameraTransform } from './camera';
import {
  campaignSources,
  CHIP_COUNTDOWN_RESERVE_PX,
  CHIP_HEIGHT_PX,
  CHIP_PAD_X_PX,
  placeChips,
  RING_GAP_PX,
  ringMarks,
  withoutChippedNames,
  type CampaignSource,
  type ChipBox,
} from './campaignMarks';
import {
  LABEL_LOGO_LIFT_PX,
  labelCandidates,
  type LabelCandidate,
} from './labels';
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
  campaignId: number,
  sx: number,
  sy: number,
  startIn: number,
): CampaignSource => ({
  campaignId,
  systemId: 30000000 + campaignId,
  ...worldAt(sx, sy),
  radius: 1e12,
  startTime: at(startIn),
  prefix: `SYS${campaignId} · IHub · `,
});

/** Every prefix measures 10 px per character. */
const measure = (text: string) => text.length * 10;

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
        campaignId: 1,
        systemId: 30000001,
        x: 1,
        z: 2,
        radius: 3,
        startTime: at(HOUR),
        prefix: 'S1 · IHub · ',
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

describe('placeChips', () => {
  it('sizes the box from the prefix plus the countdown reserve', () => {
    const [chip] = placeChips({
      sources: [source(1, 300, 300, HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    const prefixWidth = 'SYS1 · IHub · '.length * 10;
    expect(chip.halfWidth).toBe(
      (prefixWidth + CHIP_COUNTDOWN_RESERVE_PX + 2 * CHIP_PAD_X_PX) / 2,
    );
    expect(chip.halfHeight).toBe(CHIP_HEIGHT_PX / 2);
    expect(chip.screenX).toBeCloseTo(300);
    // Above the system, where its name would have been.
    expect(chip.screenY).toBeLessThan(300);
  });

  // The chip takes the name's place, so it is lifted by the very rule that
  // lifts the name: the dot's clearance, plus the logo lift while crests are on.
  it('sits on the system label lift, logo lift included', () => {
    const chipY = (logos: boolean) =>
      placeChips({
        sources: [source(1, 300, 300, HOUR)],
        measure,
        transform: TRANSFORM,
        ...VIEW,
        logos,
      })[0].screenY;
    const dot = systemRadiusPx(1e12, SCALE, systemFloorPx(Math.log2(SCALE)));

    expect(300 - chipY(false)).toBeCloseTo(
      Math.max(CHIP_HEIGHT_PX, CHIP_HEIGHT_PX / 2 + dot + 7),
    );
    expect(chipY(false) - chipY(true)).toBeCloseTo(LABEL_LOGO_LIFT_PX);
  });

  it('clears the ring around the mark it sits above', () => {
    for (const logos of [false, true]) {
      const [chip] = placeChips({
        sources: [source(1, 300, 300, HOUR)],
        measure,
        transform: TRANSFORM,
        ...VIEW,
        logos,
      });
      const [ring] = ringMarks({
        sources: [source(1, 300, 300, HOUR)],
        transform: TRANSFORM,
        ...VIEW,
        drawsLogo: logos ? ALL_LOGOS : NO_LOGOS,
        now: NOW,
      });
      expect(ring.y - (chip.screenY + chip.halfHeight)).toBeGreaterThan(
        ring.radius,
      );
    }
  });

  // The order given is the priority — soonest first, live before both.
  it('keeps the first of two colliding chips and drops the second', () => {
    const placed = placeChips({
      sources: [source(1, 300, 300, HOUR), source(2, 310, 302, 2 * HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    expect(placed.map((c) => c.campaignId)).toEqual([1]);
  });

  it('keeps chips that do not touch', () => {
    const placed = placeChips({
      sources: [source(1, 300, 300, HOUR), source(2, 300, 600, 2 * HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    expect(placed.map((c) => c.campaignId)).toEqual([1, 2]);
  });

  it('places no chip for a system off screen', () => {
    expect(
      placeChips({
        sources: [source(1, 300, 2000, HOUR)],
        measure,
        transform: TRANSFORM,
        ...VIEW,
        logos: false,
      }),
    ).toEqual([]);
  });

  it('carries the system id, which is what makes a chip clickable', () => {
    const [chip] = placeChips({
      sources: [source(1, 300, 300, HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    expect(chip.systemId).toBe(30000001);
  });
});

describe('withoutChippedNames', () => {
  const name = (tier: LabelCandidate['tier'], id: number): LabelCandidate => ({
    key: `${tier}:${id}`,
    name: `N${id}`,
    tier,
    screenX: 0,
    screenY: 0,
    halfWidth: 10,
    halfHeight: 6,
    systemId: tier === 'system' ? id : undefined,
    regionId: tier === 'region' ? id : undefined,
  });
  const chip: ChipBox = {
    campaignId: 1,
    systemId: 30000001,
    screenX: 0,
    screenY: 0,
    halfWidth: 50,
    halfHeight: 9,
  };

  it('drops the name of a system whose chip was placed — the chip carries it', () => {
    const kept = withoutChippedNames(
      [name('system', 30000001), name('system', 30000002)],
      [chip],
    );
    expect(kept.map((c) => c.key)).toEqual(['system:30000002']);
  });

  // Ids are only unique within a tier; a region that happens to share the
  // number is a different thing and keeps its name.
  it('touches only the system tier', () => {
    const region = name('region', 30000001);
    expect(withoutChippedNames([region], [chip])).toEqual([region]);
  });

  it('returns the list unchanged when no chip was placed', () => {
    const candidates = [name('system', 30000001)];
    expect(withoutChippedNames(candidates, [])).toBe(candidates);
  });

  it('agrees with labelCandidates on what a system name is keyed by', () => {
    const [candidate] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 30000001, name: 'SYS1', x: 0, z: 0, radius: 1e12 }],
      measure: (_tier, text) => text.length * 10,
      transform: TRANSFORM,
      ...VIEW,
    });
    expect(withoutChippedNames([candidate], [chip])).toEqual([]);
  });
});
