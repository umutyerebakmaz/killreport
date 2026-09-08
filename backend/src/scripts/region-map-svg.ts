/**
 * Bir bölgenin harita SVG'sini üretir. Veritabanı bilmez: girdi olarak
 * sistemleri ve atlamaları alır, string döndürür.
 *
 * Bütün sabitler haritanın kendi 0-100 koordinat uzayındadır; dosyanın
 * kendisinin pikseli yoktur, `width`/`height` yalnızca doğal boyuttur ve
 * <img> üzerindeki CSS onu ezer.
 */

const DOT_R = 1.3;
const JUMP_COLOUR = '#94a3b8';
const JUMP_WIDTH = 0.75;
const JUMP_OPACITY = 0.55;
const GATE_COLOUR = '#4CC94C';
const GATE_WIDTH = 0.9;
const GATE_OPACITY = 0.9;
const GATE_LENGTH = 10;
/** Çerçeve payı. Round 6'dan devralındı: 5 (o günkü stub) + 1.3 (nokta) + 1.0. */
const PAD = 7.3;
const SPAN = 100;

/** EVE'in güvenlik rampası, 0.0'dan 1.0'a. */
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

/** Bölgeden çıkan bir geçit. Hedef, bölgenin dışındaki sistemin ham koordinatı. */
export interface MapGate {
  fromId: number;
  toX: number;
  toZ: number;
}

export interface RegionMapInput {
  systems: MapSystem[];
  jumps: MapJump[];
  gates: MapGate[];
}

export function securityColour(security: number | null): string {
  const bucket = Math.round(Math.max(0, security ?? 0) * 10);
  return RAMP[Math.min(bucket, RAMP.length - 1)];
}

export function renderRegionMap({
  systems,
  jumps,
  gates,
}: RegionMapInput): string {
  if (systems.length === 0) {
    throw new Error(
      'renderRegionMap: a region with no systems cannot be drawn',
    );
  }

  // x ekranın x'i, -z ekranın y'si. position_y atılır: EVE'de dikey eksen odur.
  const xs = systems.map((s) => s.x);
  const ys = systems.map((s) => -s.z);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;

  // Tek katsayı, iki eksene birden: dönüşüm benzerlik dönüşümü kalsın, yönler
  // bozulmasın. Tek sistemli bölgede uzunluk sıfırdır, katsayı önemsizdir.
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
      throw new Error(
        `renderRegionMap: gate from unknown system ${gate.fromId}`,
      );
    }
    const to = project({ x: gate.toX, z: gate.toZ });
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return (
      `<line x1="${n(from.x)}" y1="${n(from.y)}"` +
      ` x2="${(from.x + (dx / length) * GATE_LENGTH).toFixed(2)}"` +
      ` y2="${(from.y + (dy / length) * GATE_LENGTH).toFixed(2)}"` +
      ` stroke="${GATE_COLOUR}" stroke-width="${GATE_WIDTH}" stroke-opacity="${GATE_OPACITY}"/>`
    );
  });

  // Her atlama veritabanında iki geçit satırı olarak duruyor. Küçük id önce.
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
        ` stroke="${JUMP_COLOUR}" stroke-width="${JUMP_WIDTH}" stroke-opacity="${JUMP_OPACITY}"/>`,
    );
  }

  const dots = systems.map((s) => {
    const p = at.get(s.id)!;
    return `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${DOT_R}" fill="${securityColour(s.security)}"/>`;
  });

  // Çerçeve yalnızca noktalardan hesaplanır; stub'lar dışarı taşıp kesilir.
  const width = spanX * scale + PAD * 2;
  const height = spanY * scale + PAD * 2;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="${n(-PAD)} ${n(-PAD)} ${n(width)} ${n(height)}"` +
    ` width="128" height="128" preserveAspectRatio="xMidYMid meet">` +
    stubs.join('') +
    edges.join('') +
    dots.join('') +
    `</svg>\n`
  );
}
