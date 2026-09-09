/**
 * Generates a star map SVG for a region or a constellation. Database-agnostic:
 * takes systems, jumps and gates as input plus a palette, returns a string.
 *
 * All constants are in the map's own 0–100 coordinate space; the file itself
 * has no pixels, `width`/`height` is natural size only, and CSS on the `<img>`
 * tag overrides it.
 */

const SPAN = 100;

/** EVE's security ramp, 0.0 to 1.0. */
const RAMP = [
  '#F00000',
  '#D73000',
  '#F04800',
  '#F06000',
  '#D77700',
  '#EFEF00',
  '#8FEF2F',
  '#00F000',
  '#00EF47',
  '#48F0C0',
  '#2FEFEF',
];

export interface MapSystem {
  id: number;
  x: number;
  z: number;
  security: number | null;
}

export interface MapJump {
  fromId: number;
  toId: number;
}

/** A gate exiting the map. Target is the raw coordinates of the system outside it. */
export interface MapGate {
  fromId: number;
  toX: number;
  toZ: number;
}

export interface StarMapInput {
  systems: MapSystem[];
  jumps: MapJump[];
  gates: MapGate[];
}

/**
 * How one kind of map is drawn. Region and constellation share every line of
 * geometry below and differ only here.
 */
export interface MapPalette {
  dotR: number;
  dotFill: (security: number | null) => string;
  jump: string;
  jumpWidth: number;
  jumpOpacity: number;
  gate: string;
  gateWidth: number;
  gateOpacity: number;
  gateLength: number;
  /** Frame padding. Inherited from Round 6: 5 (stub at the time) + 1.3 (dot) + 1.0. */
  pad: number;
}

export function securityColour(security: number | null): string {
  const bucket = Math.round(Math.max(0, security ?? 0) * 10);
  return RAMP[Math.min(bucket, RAMP.length - 1)];
}

export const REGION_PALETTE: MapPalette = {
  dotR: 1.3,
  dotFill: securityColour,
  jump: '#94a3b8',
  jumpWidth: 0.75,
  jumpOpacity: 0.55,
  gate: '#4CC94C',
  gateWidth: 0.9,
  gateOpacity: 0.9,
  gateLength: 10,
  pad: 7.3,
};

/**
 * A constellation averages 7.2 systems against a region's 74.5, and outbound
 * gates run about 1:2 against internal jumps instead of 1:9 — so it gets its
 * own language rather than the region's. Red at 0.55 goes muddy on the site's
 * dark surfaces, which is why jumpOpacity is 0.7 here and 0.55 there.
 */
export const CONSTELLATION_PALETTE: MapPalette = {
  dotR: 1.3,
  dotFill: () => '#FFFFFF',
  jump: '#DC2626',
  jumpWidth: 0.75,
  jumpOpacity: 0.7,
  gate: '#1D4ED8',
  gateWidth: 0.9,
  gateOpacity: 0.9,
  gateLength: 10,
  pad: 7.3,
};

export function renderStarMap(
  { systems, jumps, gates }: StarMapInput,
  palette: MapPalette,
): string {
  if (systems.length === 0) {
    throw new Error('renderStarMap: a map with no systems cannot be drawn');
  }

  // x is screen x, -z is screen y. position_y is dropped: it's the vertical axis in EVE.
  const xs = systems.map((s) => s.x);
  const ys = systems.map((s) => -s.z);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;

  // Single scale factor for both axes: the transformation stays a similarity
  // transform and direction is preserved. For a map with one system the span
  // is zero and the scale factor is irrelevant.
  const longest = Math.max(spanX, spanY);
  const scale = longest === 0 ? 1 : SPAN / longest;
  const project = (s: { x: number; z: number }) => ({
    x: (s.x - minX) * scale,
    y: (-s.z - minY) * scale,
  });

  const at = new Map(systems.map((s) => [s.id, project(s)]));
  const n = (value: number) => value.toFixed(1);

  const stubs = gates.map((gate) => {
    const from = at.get(gate.fromId);
    if (!from) {
      throw new Error(`renderStarMap: gate from unknown system ${gate.fromId}`);
    }
    const to = project({ x: gate.toX, z: gate.toZ });
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return (
      `<line x1="${n(from.x)}" y1="${n(from.y)}"` +
      ` x2="${(from.x + (dx / length) * palette.gateLength).toFixed(2)}"` +
      ` y2="${(from.y + (dy / length) * palette.gateLength).toFixed(2)}"` +
      ` stroke="${palette.gate}" stroke-width="${palette.gateWidth}" stroke-opacity="${palette.gateOpacity}"/>`
    );
  });

  // Each jump appears in the database as two rows. Small ID first.
  const seen = new Set<string>();
  const edges: string[] = [];
  for (const jump of jumps) {
    const [a, b] =
      jump.fromId < jump.toId
        ? [jump.fromId, jump.toId]
        : [jump.toId, jump.fromId];
    const key = `${a}:${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const from = at.get(a);
    const to = at.get(b);
    if (!from || !to) continue;
    edges.push(
      `<line x1="${n(from.x)}" y1="${n(from.y)}" x2="${n(to.x)}" y2="${n(to.y)}"` +
        ` stroke="${palette.jump}" stroke-width="${palette.jumpWidth}" stroke-opacity="${palette.jumpOpacity}"/>`,
    );
  }

  const dots = systems.map((s) => {
    const p = at.get(s.id)!;
    return `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${palette.dotR}" fill="${palette.dotFill(s.security)}"/>`;
  });

  // The frame is computed from dots only; stubs extend outward and are clipped.
  const width = spanX * scale + palette.pad * 2;
  const height = spanY * scale + palette.pad * 2;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="${n(-palette.pad)} ${n(-palette.pad)} ${n(width)} ${n(height)}"` +
    ` width="128" height="128" preserveAspectRatio="xMidYMid meet">` +
    stubs.join('') +
    edges.join('') +
    dots.join('') +
    `</svg>\n`
  );
}
