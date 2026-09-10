/**
 * Generates a solar system's orbital diagram SVG. Database-agnostic: takes a
 * star and a planet list, returns a string.
 *
 * Unlike `star-map-svg.ts` this is not a graph. The frame is centred on the
 * star and 100 units across, not the 114.6 of a region or a constellation:
 * the drawing is circular and its padding carries no outbound stub. All
 * constants are in that 0-100 space; the file itself has no pixels,
 * `width`/`height` is natural size only, and CSS on the `<img>` tag overrides it.
 */

/** Innermost and outermost orbit, in frame units. */
const INNER = 9;
const OUTER = 46;
/** Frame padding: OUTER + PAD is the half-frame, and it clears a 1.6 dot. */
const PAD = 4;
const HALF = OUTER + PAD;

const STAR_R = 2.6;
const PLANET_R = 1.6;
const RING = '#475569';
const RING_WIDTH = 0.6;

/** EVE's published planet types. */
const PLANET_COLOUR: Record<number, string> = {
  13: '#a78bfa', // Gas
  2016: '#9ca3af', // Barren
  11: '#4ade80', // Temperate
  2015: '#f97316', // Lava
  2017: '#22d3ee', // Storm
  12: '#e0f2fe', // Ice
  2014: '#2563eb', // Oceanic
  2063: '#e879f9', // Plasma
  30889: '#f43f5e', // Shattered
};
/**
 * Barren's grey. A type the SDE adds later draws grey rather than breaking the
 * map — Scorched Barren (73911, one planet in the universe) lands here today.
 */
const UNKNOWN_PLANET = '#9ca3af';

/**
 * Harvard spectral classes. O and B do not occur in EVE, but they are real
 * classes and cost two lines: an SDE addition should not fall to the default.
 */
const STAR_COLOUR: Record<string, string> = {
  O: '#9bb0ff',
  B: '#aabfff',
  A: '#cad7ff',
  F: '#f8f7ff',
  G: '#fff4ea',
  K: '#ffd2a1',
  M: '#ffcc6f',
};
/** Sun-like white, class G. */
const UNKNOWN_STAR = '#fff4ea';

export interface MapPlanet {
  id: number;
  x: number;
  z: number;
  typeId: number | null;
}

export interface SolarSystemMapInput {
  /** The system's star, or null when it has no star row. */
  star: { spectralClass: string | null } | null;
  planets: MapPlanet[];
}

export function planetColour(typeId: number | null): string {
  if (typeId === null) return UNKNOWN_PLANET;
  return PLANET_COLOUR[typeId] ?? UNKNOWN_PLANET;
}

export function starColour(spectralClass: string | null): string {
  if (spectralClass === null) return UNKNOWN_STAR;
  return STAR_COLOUR[spectralClass.charAt(0).toUpperCase()] ?? UNKNOWN_STAR;
}

export function renderSolarSystemMap({
  star,
  planets,
}: SolarSystemMapInput): string {
  if (star === null && planets.length === 0) {
    throw new Error(
      'renderSolarSystemMap: a system with no star and no planet cannot be drawn',
    );
  }

  // The orbital radius drops position_y, the same way the region and
  // constellation maps do: y is the vertical axis in EVE.
  const radii = planets.map((p) => Math.hypot(p.x, p.z));
  const lo = Math.min(...radii);
  const hi = Math.max(...radii);
  const span = Math.log(hi) - Math.log(lo);

  // The innermost orbit is 2.44e10 m and the outermost 3.04e13 — 1,246 times
  // wider — so the ramp is logarithmic. A single planet leaves the span at
  // zero: it sits halfway up the ramp.
  const ramp = (r: number) =>
    span <= 0
      ? (INNER + OUTER) / 2
      : INNER + (OUTER - INNER) * ((Math.log(r) - Math.log(lo)) / span);

  const n = (value: number) => value.toFixed(1);
  const parts: string[] = [];

  // Rings first, so the star and the planets sit on top of them. One ring per
  // distinct radius, ascending, so the file does not depend on the order the
  // planets arrived in.
  if (planets.length > 0) {
    const rings = [...new Set(radii.map((r) => n(ramp(r))))].sort(
      (a, b) => Number(a) - Number(b),
    );
    parts.push(
      `<g fill="none" stroke="${RING}" stroke-width="${RING_WIDTH}">` +
        rings.map((r) => `<circle r="${r}"/>`).join('') +
        `</g>`,
    );
  }

  if (star !== null) {
    parts.push(
      `<circle r="${STAR_R}" fill="${starColour(star.spectralClass)}"/>`,
    );
  }

  // x is screen x, -z is screen y — again as in `star-map-svg.ts`. The angle
  // is the planet's real one: without it every system would be a row of
  // evenly spaced dots and two systems would differ only in planet count.
  for (const planet of planets) {
    const r = ramp(Math.hypot(planet.x, planet.z));
    const angle = Math.atan2(-planet.z, planet.x);
    parts.push(
      `<circle cx="${n(Math.cos(angle) * r)}" cy="${n(Math.sin(angle) * r)}"` +
        ` r="${PLANET_R}" fill="${planetColour(planet.typeId)}"/>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}"` +
    ` width="128" height="128" preserveAspectRatio="xMidYMid meet">` +
    parts.join('') +
    `</svg>\n`
  );
}
