import { describe, expect, it } from 'vitest';
import { renderRegionMap, securityColour } from './region-map-svg';
import { FADE_SYSTEMS } from './fade.fixture';

describe('securityColour', () => {
  it("maps each tenth of security status to EVE's ramp", () => {
    expect(securityColour(1.0)).toBe('#2FEFEF');
    expect(securityColour(0.9)).toBe('#48F0C0');
    expect(securityColour(0.8)).toBe('#00EF47');
    expect(securityColour(0.7)).toBe('#00F000');
    expect(securityColour(0.6)).toBe('#8FEF2F');
    expect(securityColour(0.5)).toBe('#EFEF00');
    expect(securityColour(0.4)).toBe('#D77700');
    expect(securityColour(0.3)).toBe('#F06000');
    expect(securityColour(0.2)).toBe('#F04800');
    expect(securityColour(0.1)).toBe('#D73000');
    expect(securityColour(0.0)).toBe('#F00000');
  });

  it('rounds to the nearest tenth', () => {
    expect(securityColour(0.4501)).toBe('#EFEF00');
    expect(securityColour(0.44)).toBe('#D77700');
  });

  it('treats negative security and a missing value as null-sec', () => {
    expect(securityColour(-0.19)).toBe('#F00000');
    expect(securityColour(null)).toBe('#F00000');
  });

  it('clamps above 1.0', () => {
    expect(securityColour(1.4)).toBe('#2FEFEF');
  });
});

describe('renderRegionMap', () => {
  // Two systems 100 units apart on x, 50 on z. The long axis is x, so the
  // scale is 1 and z passes through at 50 — negated, so the system with the
  // LOWER z (id 2) gets the LARGER y and sits at the bottom of the drawing.
  const twoSystems = {
    systems: [
      { id: 1, x: 0, z: 0, security: 0.9 },
      { id: 2, x: 100, z: -50, security: -0.2 },
    ],
    jumps: [{ fromId: 1, toId: 2 }],
    gates: [],
  };

  it('normalises the long axis to 0-100 and negates z', () => {
    const svg = renderRegionMap(twoSystems);
    expect(svg).toContain('<circle cx="0.0" cy="0.0" r="1.3" fill="#48F0C0"/>');
    expect(svg).toContain(
      '<circle cx="100.0" cy="50.0" r="1.3" fill="#F00000"/>',
    );
  });

  it('pads the viewBox by 7.3 on every side', () => {
    expect(renderRegionMap(twoSystems)).toContain(
      'viewBox="-7.3 -7.3 114.6 64.6"',
    );
  });

  it('is square and letterboxed, with no background', () => {
    const svg = renderRegionMap(twoSystems);
    expect(svg).toContain('width="128" height="128"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).not.toContain('<rect');
  });

  it('draws one line per internal jump, in the neutral colour', () => {
    expect(renderRegionMap(twoSystems)).toContain(
      '<line x1="0.0" y1="0.0" x2="100.0" y2="50.0" stroke="#94a3b8" stroke-width="0.75" stroke-opacity="0.55"/>',
    );
  });

  it('deduplicates a jump listed in both directions', () => {
    const svg = renderRegionMap({
      ...twoSystems,
      jumps: [
        { fromId: 1, toId: 2 },
        { fromId: 2, toId: 1 },
      ],
    });
    expect(svg.match(/#94a3b8/g)).toHaveLength(1);
  });

  it('draws an outbound gate as a 10-unit stub towards its destination', () => {
    const svg = renderRegionMap({
      systems: [{ id: 1, x: 0, z: 0, security: 0.5 }],
      jumps: [],
      // destination is far to the right; direction is +x, so the stub ends at x=10
      gates: [{ fromId: 1, toX: 900, toZ: 0 }],
    });
    expect(svg).toContain(
      '<line x1="0.0" y1="0.0" x2="10.00" y2="0.00" stroke="#4CC94C" stroke-width="0.9" stroke-opacity="0.9"/>',
    );
  });

  it('draws stubs beneath the jump lines, and dots on top of both', () => {
    const svg = renderRegionMap({
      ...twoSystems,
      gates: [{ fromId: 1, toX: -900, toZ: 0 }],
    });
    expect(svg.indexOf('#4CC94C')).toBeLessThan(svg.indexOf('#94a3b8'));
    expect(svg.indexOf('#94a3b8')).toBeLessThan(svg.indexOf('<circle'));
  });

  it('normalises the long axis to 0-100 when z is the longer span', () => {
    // Two systems 50 apart on x, 100 on z — the mirror image of twoSystems
    // above, where x is the longer span. Pins Math.max(spanX, spanY) picking
    // spanY: scale = 100 / 100 = 1, so id 1 projects to (0, 0) and id 2 to
    // (50, 100) (z negated, then both axes shifted so the minimum is 0).
    // viewBox width = spanX*scale + 14.6 = 64.6, height = spanY*scale + 14.6 = 114.6.
    const svg = renderRegionMap({
      systems: [
        { id: 1, x: 0, z: 0, security: 0.9 },
        { id: 2, x: 50, z: -100, security: -0.2 },
      ],
      jumps: [],
      gates: [],
    });
    expect(svg).toContain('<circle cx="0.0" cy="0.0" r="1.3" fill="#48F0C0"/>');
    expect(svg).toContain(
      '<circle cx="50.0" cy="100.0" r="1.3" fill="#F00000"/>',
    );
    expect(svg).toContain('viewBox="-7.3 -7.3 64.6 114.6"');
  });

  it('gives a single-system region a 14.6-unit square viewBox', () => {
    const svg = renderRegionMap({
      systems: [{ id: 1, x: 42, z: -7, security: -1 }],
      jumps: [],
      gates: [],
    });
    expect(svg).toContain('viewBox="-7.3 -7.3 14.6 14.6"');
    expect(svg).toContain('<circle cx="0.0" cy="0.0" r="1.3" fill="#F00000"/>');
  });

  it('reproduces the approved drawing of Fade', () => {
    // The 27 systems of Fade (region 10000046), and the point coordinates the
    // approved artifact drew them at. Guards the projection against drift.
    const expected = [
      [46.7, 0.5],
      [100.0, 19.0],
      [88.5, 18.7],
      [85.3, 15.8],
      [82.4, 19.0],
      [66.9, 13.4],
      [74.0, 12.0],
      [52.3, 10.3],
      [42.1, 13.3],
      [49.5, 12.2],
      [57.2, 9.5],
      [49.8, 5.5],
      [26.9, 15.3],
      [39.7, 11.0],
      [27.8, 4.9],
      [17.4, 9.7],
      [23.0, 17.2],
      [21.5, 15.2],
      [20.8, 13.5],
      [30.0, 3.7],
      [17.2, 3.7],
      [11.3, 2.6],
      [16.8, 5.8],
      [0.0, 0.0],
      [11.4, 8.2],
      [32.0, 8.7],
      [38.3, 3.0],
    ];
    const svg = renderRegionMap({
      systems: FADE_SYSTEMS,
      jumps: [],
      gates: [],
    });
    const drawn = [
      ...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    expect(drawn).toHaveLength(27);
    for (const point of expected) {
      expect(drawn).toContainEqual(point);
    }
  });
});
