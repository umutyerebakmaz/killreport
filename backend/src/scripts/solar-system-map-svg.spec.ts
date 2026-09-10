import { describe, expect, it } from 'vitest';
import {
  planetColour,
  renderSolarSystemMap,
  starColour,
} from './solar-system-map-svg';
import { JITA_PLANETS } from './jita.fixture';

describe('planetColour', () => {
  it('gives each published planet type its own colour', () => {
    expect(planetColour(13)).toBe('#a78bfa'); // Gas
    expect(planetColour(2016)).toBe('#9ca3af'); // Barren
    expect(planetColour(11)).toBe('#4ade80'); // Temperate
    expect(planetColour(2015)).toBe('#f97316'); // Lava
    expect(planetColour(2017)).toBe('#22d3ee'); // Storm
    expect(planetColour(12)).toBe('#e0f2fe'); // Ice
    expect(planetColour(2014)).toBe('#2563eb'); // Oceanic
    expect(planetColour(2063)).toBe('#e879f9'); // Plasma
    expect(planetColour(30889)).toBe('#f43f5e'); // Shattered
  });

  it("falls back to Barren's grey for an unknown or missing type", () => {
    expect(planetColour(73911)).toBe('#9ca3af'); // Scorched Barren, one planet
    expect(planetColour(999999)).toBe('#9ca3af');
    expect(planetColour(null)).toBe('#9ca3af');
  });
});

describe('starColour', () => {
  it('reads the Harvard class off the first character', () => {
    expect(starColour('K3 V')).toBe('#ffd2a1');
    expect(starColour('G5 V')).toBe('#fff4ea');
    expect(starColour('M0 V')).toBe('#ffcc6f');
    expect(starColour('F1 V')).toBe('#f8f7ff');
    expect(starColour('A0 IV')).toBe('#cad7ff');
  });

  it('carries O and B even though the universe has none today', () => {
    expect(starColour('O5 V')).toBe('#9bb0ff');
    expect(starColour('B2 V')).toBe('#aabfff');
  });

  it('falls back to a sun-like white for an unknown or missing class', () => {
    expect(starColour('Z9 X')).toBe('#fff4ea');
    expect(starColour(null)).toBe('#fff4ea');
  });
});

describe('renderSolarSystemMap', () => {
  const twoPlanets = {
    star: { spectralClass: 'K0 V' },
    planets: [
      { id: 1, x: 100, z: 0, typeId: 11 },
      { id: 2, x: 0, z: -1000, typeId: 13 },
    ],
  };

  it('is a square 100-unit frame with no background', () => {
    const svg = renderSolarSystemMap(twoPlanets);
    expect(svg).toContain('viewBox="-50 -50 100 100"');
    expect(svg).toContain('width="128" height="128"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).not.toContain('<rect');
  });

  it('normalises the orbital radius onto a 9-46 log ramp', () => {
    const svg = renderSolarSystemMap(twoPlanets);
    // x is screen x, -z is screen y: the planet at z=-1000 goes to +y.
    expect(svg).toContain('<circle cx="9.0" cy="0.0" r="1.6" fill="#4ade80"/>');
    expect(svg).toContain(
      '<circle cx="0.0" cy="46.0" r="1.6" fill="#a78bfa"/>',
    );
  });

  it('places a single planet halfway up the ramp, where the span is zero', () => {
    const svg = renderSolarSystemMap({
      star: { spectralClass: 'M3 V' },
      planets: [{ id: 1, x: 100, z: 0, typeId: 11 }],
    });
    expect(svg).toContain('<circle r="27.5"/>');
    expect(svg).toContain(
      '<circle cx="27.5" cy="0.0" r="1.6" fill="#4ade80"/>',
    );
  });

  it('refuses to draw a system where a planet sits at the centre among others', () => {
    // lo=0 makes Math.log(lo) -Infinity, so with a second, non-zero radius
    // present the ramp's span comes out infinite and every position would be
    // NaN. Regression test for that.
    expect(() =>
      renderSolarSystemMap({
        star: { spectralClass: 'G2 V' },
        planets: [
          { id: 1, x: 0, z: 0, typeId: 11 },
          { id: 2, x: 100, z: 0, typeId: 13 },
        ],
      }),
    ).toThrow(
      'renderSolarSystemMap: a planet at the centre of the system (a non-positive orbital radius) cannot be drawn on a logarithmic ramp',
    );
  });

  it('places a single planet at the centre halfway up the ramp too', () => {
    // A lone planet at radius 0 makes lo=hi=0 and span NaN rather than
    // Infinity — there is no second radius for it to be degenerate against,
    // so it gets the same halfway treatment as any other single planet
    // instead of the throw above.
    const svg = renderSolarSystemMap({
      star: { spectralClass: 'M3 V' },
      planets: [{ id: 1, x: 0, z: 0, typeId: 11 }],
    });
    expect(svg).toContain('<circle r="27.5"/>');
    expect(svg).toContain(
      '<circle cx="27.5" cy="0.0" r="1.6" fill="#4ade80"/>',
    );
  });

  it('draws one ring per distinct radius, sharing a single stroke', () => {
    const svg = renderSolarSystemMap({
      star: { spectralClass: 'K0 V' },
      planets: [
        { id: 1, x: 100, z: 0, typeId: 11 },
        { id: 2, x: 0, z: -100, typeId: 13 },
      ],
    });
    expect(svg).toContain(
      '<g fill="none" stroke="#475569" stroke-width="0.6"><circle r="27.5"/></g>',
    );
    expect(svg.match(/<circle r="27.5"\/>/g)).toHaveLength(1);
    // Ascending order is asserted on Jita below, where there are eight rings.
  });

  it('draws the rings beneath the star, and the planets on top of both', () => {
    const svg = renderSolarSystemMap(twoPlanets);
    expect(svg.indexOf('<g fill="none"')).toBeLessThan(svg.indexOf('r="2.6"'));
    expect(svg.indexOf('r="2.6"')).toBeLessThan(svg.indexOf('r="1.6"'));
  });

  it('draws a star with no planets as a single dot', () => {
    expect(
      renderSolarSystemMap({ star: { spectralClass: 'F7 V' }, planets: [] }),
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"' +
        ' width="128" height="128" preserveAspectRatio="xMidYMid meet">' +
        '<circle r="2.6" fill="#f8f7ff"/></svg>\n',
    );
  });

  it('omits the star dot when the system has no star row', () => {
    const svg = renderSolarSystemMap({
      star: null,
      planets: [{ id: 1, x: 100, z: 0, typeId: 11 }],
    });
    expect(svg).not.toContain('r="2.6"');
    expect(svg).toContain('r="1.6"');
  });

  it('refuses to draw a system with neither a star nor a planet', () => {
    expect(() => renderSolarSystemMap({ star: null, planets: [] })).toThrow(
      'renderSolarSystemMap: a system with no star and no planet cannot be drawn',
    );
  });

  it('reproduces the approved drawing of Jita', () => {
    // Jita's eight planets and the points the approved artifact drew them at.
    // Guards the log ramp and the true orbital angle against drift.
    const expected = [
      [-7.8, -4.5],
      [6.0, 9.4],
      [17.2, -2.3],
      [-6.4, -26.2],
      [-17.3, 30.3],
      [39.3, 12.9],
      [-24.9, -35.4],
      [-33.0, 32.1],
    ];
    const svg = renderSolarSystemMap({
      star: { spectralClass: 'F1 V' },
      planets: JITA_PLANETS,
    });
    const drawn = [
      ...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    expect(drawn).toEqual(expected);
    expect(svg).toContain(
      '<g fill="none" stroke="#475569" stroke-width="0.6">' +
        '<circle r="9.0"/><circle r="11.2"/><circle r="17.4"/>' +
        '<circle r="27.0"/><circle r="34.9"/><circle r="41.4"/>' +
        '<circle r="43.3"/><circle r="46.0"/></g>',
    );
  });
});
