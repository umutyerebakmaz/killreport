# Bölge harita thumbnail'leri — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 114 bölgenin her biri için tek bir SVG harita üretmek, repoda statik dosya olarak tutmak ve dört yerde göstermek.

**Architecture:** Saf bir render modülü (veritabanı bilmez, tamamen test edilebilir) + onu çağıran elle çalıştırılan bir script (Prisma sorgusu ve dosya yazımı). Frontend tarafında URL üreten bir yardımcı ve tek bir sunum bileşeni; dört çağrı yeri o bileşeni kullanır.

**Tech Stack:** TypeScript, `tsx`, Prisma (`@services/prisma-worker`), Vitest 5, Next.js App Router, React, Tailwind. Yeni bağımlılık yok — SVG düz string olarak üretiliyor, `sharp` yok, çizim kütüphanesi yok.

**Spec:** [`docs/superpowers/specs/2026-09-09-region-map-thumbnails-design.md`](../specs/2026-09-09-region-map-thumbnails-design.md)

## Global Constraints

- **Yarn only, asla npm.** `yarn`, `yarn add`, `yarn workspace <ws> <script>`.
- **Commit ve PR içeriği İngilizce**, branch adı dahil. Branch: `feat/region-map-thumbnails`.
- **Commit'te Claude atfı yok** — `Co-Authored-By` yok, "Generated with" yok.
- **Commit/PR başlığında `type(scope):` sonrası her şey küçük harf.**
- **Generated dosyalara dokunulmaz.** Bu iş GraphQL şemasına dokunmuyor; codegen çalıştırılmayacak.
- **`.env` düzenlenmez.** Bu iş zaten hiçbir ortam değişkeni istemiyor.
- **Veritabanı yalnızca okunur.** Migration yok, yazma yok.
- Prisma istemcisi: script `@services/prisma-worker` (2 bağlantı) kullanır, `@services/prisma` değil.
- Çizim sabitleri (spec'ten, birebir): nokta `r 1.3`; bölge içi atlama `#94a3b8` / `stroke-width 0.75` / `stroke-opacity 0.55`; çıkış stub'ı `#4CC94C` / `stroke-width 0.9` / `stroke-opacity 0.9` / uzunluk `10`; çerçeve payı her yönde `7.3`.
- Güvenlik rampası (düşükten yükseğe, 0.0 → 1.0): `#F00000`, `#D73000`, `#F04800`, `#F06000`, `#D77700`, `#EFEF00`, `#8FEF2F`, `#00F000`, `#00EF47`, `#48F0C0`, `#2FEFEF`.
- Projeksiyon: `x → ekran x`, `−z → ekran y`, uzun eksen 0–100'e ölçeklenir, kısa eksen oranını korur.
- Beklenen toplamlar: **114** dosya, **8.490** nokta, **6.619** bölge içi çizgi, **740** çıkış stub'ı.

---

### Task 1: Saf render modülü

Veritabanına dokunmayan, tek sorumluluğu "sistemler + atlamalar → SVG string" olan modül. Bütün geometri ve renk kararları burada, dolayısıyla bütün testler de burada.

**Files:**

- Create: `backend/src/scripts/region-map-svg.ts`
- Test: `backend/src/scripts/region-map-svg.spec.ts`

**Interfaces:**

- Consumes: hiçbir şey (ilk task).
- Produces:
  - `securityColour(security: number | null): string`
  - `renderRegionMap(input: RegionMapInput): string`
  - `interface MapSystem { id: number; x: number; z: number; security: number | null }`
  - `interface MapJump { fromId: number; toId: number }`
  - `interface MapGate { fromId: number; toX: number; toZ: number }`
  - `interface RegionMapInput { systems: MapSystem[]; jumps: MapJump[]; gates: MapGate[] }`

`MapGate.toX` / `toZ`, bölgenin **dışındaki** hedef sistemin ham veritabanı koordinatlarıdır. Renderer onları da aynı dönüşümle projeler; sonuç 0–100 kutusunun dışına düşer, stub o yöne 10 birim çizilir.

- [ ] **Step 1: Write the failing test**

`backend/src/scripts/region-map-svg.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderRegionMap, securityColour } from './region-map-svg';

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
```

`FADE_SYSTEMS` bir sonraki adımda üretiliyor; test şu an derlenmiyor, bu beklenen durum.

- [ ] **Step 2: Generate the Fade fixture from the database**

Fixture ham veritabanı koordinatlarını taşır — beklenen çıktı yukarıda elle yazılı olduğu için üretim döngüsel değil.

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
{
  echo "// The 27 systems of Fade (region 10000046), straight from solar_systems."
  echo "// Raw database coordinates; the expected drawing is asserted in the spec."
  echo "export const FADE_SYSTEMS = ["
  psql "$DB" -At -F'|' -c "SELECT s.system_id, s.position_x, s.position_z, s.security_status FROM solar_systems s JOIN constellations c ON c.constellation_id = s.constellation_id WHERE c.region_id = 10000046 ORDER BY s.system_id;" \
    | awk -F'|' '{printf "  { id: %s, x: %s, z: %s, security: %s },\n", $1, $2, $3, $4}'
  echo "];"
} > src/scripts/fade.fixture.ts
wc -l src/scripts/fade.fixture.ts   # 31 satır bekleniyor
```

Sonra spec dosyasının başına import eklenir:

```ts
import { FADE_SYSTEMS } from './fade.fixture';
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `yarn workspace backend test src/scripts/region-map-svg.spec.ts`
Expected: FAIL — `Failed to resolve import "./region-map-svg"`.

- [ ] **Step 4: Write the implementation**

`backend/src/scripts/region-map-svg.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn workspace backend test src/scripts/region-map-svg.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Typecheck and format**

```bash
yarn workspace backend build
npx prettier --write backend/src/scripts/region-map-svg.ts backend/src/scripts/region-map-svg.spec.ts backend/src/scripts/fade.fixture.ts
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/scripts/region-map-svg.ts backend/src/scripts/region-map-svg.spec.ts backend/src/scripts/fade.fixture.ts
git commit -m "feat(backend): render a region's stargate topology as an svg map"
```

---

### Task 2: Haritaları üreten script

Task 1'in modülünü veritabanına bağlar ve 114 dosyayı yazar.

**Files:**

- Create: `backend/src/scripts/render-region-maps.ts`
- Modify: `backend/package.json` (scripts bloğuna bir satır)
- Create: `frontend/public/images/regions/*.svg` (script'in çıktısı, 114 dosya)

**Interfaces:**

- Consumes: `renderRegionMap`, `MapSystem`, `MapJump`, `MapGate` — Task 1'den.
- Produces: `yarn workspace backend render:region-maps` komutu ve `frontend/public/images/regions/{region_id}.svg` dosyaları.

- [ ] **Step 1: Write the script**

`backend/src/scripts/render-region-maps.ts`:

```ts
/**
 * Her bölge için bir harita SVG'si üretir ve frontend'in statik dizinine yazar.
 *
 * Elle çalıştırılır, PM2 süreci değildir: SDE güncellemesinden sonra bir kez.
 * Bkz. backend/docs/ops/region-map-images.md
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prismaWorker from '@services/prisma-worker';
import { MapGate, MapJump, MapSystem, renderRegionMap } from './region-map-svg';

// backend is CommonJS (no "type": "module"), so __dirname is the way here —
// import.meta.url is not available. From src/scripts that is three levels up.
const OUT_DIR = join(__dirname, '../../../frontend/public/images/regions');

interface SystemRow {
  region_id: number;
  system_id: number;
  position_x: number;
  position_z: number;
  security_status: number | null;
}

interface GateRow {
  solar_system_id: number;
  destination_system_id: number;
}

async function main(): Promise<void> {
  const systems = await prismaWorker.$queryRaw<SystemRow[]>`
    SELECT c.region_id, s.system_id, s.position_x, s.position_z, s.security_status
    FROM solar_systems s
    JOIN constellations c ON c.constellation_id = s.constellation_id
    WHERE s.position_x IS NOT NULL AND s.position_z IS NOT NULL`;

  const gates = await prismaWorker.$queryRaw<GateRow[]>`
    SELECT solar_system_id, destination_system_id
    FROM stargates
    WHERE destination_system_id IS NOT NULL`;

  const regionOf = new Map<number, number>();
  const coordOf = new Map<number, { x: number; z: number }>();
  const byRegion = new Map<number, MapSystem[]>();

  for (const row of systems) {
    regionOf.set(row.system_id, row.region_id);
    coordOf.set(row.system_id, { x: row.position_x, z: row.position_z });
    const list = byRegion.get(row.region_id) ?? [];
    list.push({
      id: row.system_id,
      x: row.position_x,
      z: row.position_z,
      security: row.security_status,
    });
    byRegion.set(row.region_id, list);
  }

  const jumpsOf = new Map<number, MapJump[]>();
  const gatesOf = new Map<number, MapGate[]>();
  let orphaned = 0;

  for (const gate of gates) {
    const from = regionOf.get(gate.solar_system_id);
    const to = regionOf.get(gate.destination_system_id);
    const destination = coordOf.get(gate.destination_system_id);
    if (from === undefined || to === undefined || !destination) {
      orphaned += 1;
      continue;
    }
    if (from === to) {
      const list = jumpsOf.get(from) ?? [];
      list.push({
        fromId: gate.solar_system_id,
        toId: gate.destination_system_id,
      });
      jumpsOf.set(from, list);
    } else {
      const list = gatesOf.get(from) ?? [];
      list.push({
        fromId: gate.solar_system_id,
        toX: destination.x,
        toZ: destination.z,
      });
      gatesOf.set(from, list);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });

  // Hepsi önce bellekte üretilir: yarım kalan bir koşu diske yarım set bırakmasın.
  const files = [...byRegion.entries()].map(([regionId, regionSystems]) => ({
    path: join(OUT_DIR, `${regionId}.svg`),
    svg: renderRegionMap({
      systems: regionSystems,
      jumps: jumpsOf.get(regionId) ?? [],
      gates: gatesOf.get(regionId) ?? [],
    }),
  }));

  await Promise.all(
    files.map((file) => writeFile(file.path, file.svg, 'utf8')),
  );

  const dots = files.reduce(
    (sum, f) => sum + (f.svg.match(/<circle/g) ?? []).length,
    0,
  );
  const edges = files.reduce(
    (sum, f) => sum + (f.svg.match(/#94a3b8/g) ?? []).length,
    0,
  );
  const stubs = files.reduce(
    (sum, f) => sum + (f.svg.match(/#4CC94C/g) ?? []).length,
    0,
  );

  console.log(
    `${files.length} regions written to ${OUT_DIR}\n` +
      `  ${dots} systems, ${edges} internal jumps, ${stubs} outbound gates` +
      (orphaned > 0
        ? `\n  ${orphaned} gates skipped: endpoint missing or unpositioned`
        : ''),
  );

  await prismaWorker.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prismaWorker.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Add the package.json script**

`backend/package.json`, `scripts` bloğuna, `queue:*` satırlarının hemen üstüne:

```json
"render:region-maps": "tsx src/scripts/render-region-maps.ts",
```

- [ ] **Step 3: Run it**

Run: `yarn workspace backend render:region-maps`

Expected, birebir:

```
114 regions written to .../frontend/public/images/regions
  8490 systems, 6619 internal jumps, 740 outbound gates
```

Sayılardan biri tutmazsa dur ve rapor et — beklenen toplamlar spec'te ölçülmüş değerlerdir, tutmaması sorgunun ya da gruplamanın yanlış olduğu anlamına gelir.

- [ ] **Step 4: Verify the output against the approved drawing**

```bash
cd /root/killreport
ls frontend/public/images/regions/*.svg | wc -l                    # 114
grep -c '<circle' frontend/public/images/regions/10000046.svg      # 27  (Fade)
grep -o '#4CC94C' frontend/public/images/regions/10000046.svg | wc -l   # 6
grep -l '<rect' frontend/public/images/regions/*.svg               # hiçbir şey döndürmemeli
grep -c '<circle' frontend/public/images/regions/10000043.svg      # 189 (Domain)
```

Fade'in nokta koordinatları Task 1'in testinde zaten doğrulandı; burada üretilen dosyanın aynı sayıları taşıdığı kontrol ediliyor.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write backend/src/scripts/render-region-maps.ts backend/package.json
git add backend/src/scripts/render-region-maps.ts backend/package.json frontend/public/images/regions
git commit -m "feat(backend): add a script that renders every region map to the frontend"
```

---

### Task 3: Frontend yardımcısı ve bileşeni

**Files:**

- Create: `frontend/src/utils/regionMapUrl.ts`
- Test: `frontend/src/utils/regionMapUrl.spec.ts`
- Create: `frontend/src/components/RegionMap/RegionMap.tsx`
- Test: `frontend/src/components/RegionMap/RegionMap.spec.tsx`

**Interfaces:**

- Consumes: Task 2'nin ürettiği `frontend/public/images/regions/{id}.svg` dosyaları.
- Produces:
  - `regionMapUrl(regionId: number): string`
  - `<RegionMap regionId={number} regionName={string} size={number} className?={string} />`

- [ ] **Step 1: Write the failing tests**

`frontend/src/utils/regionMapUrl.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { regionMapUrl } from './regionMapUrl';

describe('regionMapUrl', () => {
  it('points at the static map for a region', () => {
    expect(regionMapUrl(10000046)).toBe('/images/regions/10000046.svg');
  });
});
```

`frontend/src/components/RegionMap/RegionMap.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RegionMap from './RegionMap';

describe('RegionMap', () => {
  it("renders the region's map at the requested size", () => {
    render(<RegionMap regionId={10000046} regionName="Fade" size={64} />);
    const image = screen.getByAltText('Fade map');
    expect(image).toHaveAttribute('src', '/images/regions/10000046.svg');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('removes itself when the file is missing, rather than showing a broken image', () => {
    render(<RegionMap regionId={999} regionName="Nowhere" size={64} />);
    const image = screen.getByAltText('Nowhere map');
    fireEvent.error(image);
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn workspace frontend test src/utils/regionMapUrl.spec.ts src/components/RegionMap/RegionMap.spec.tsx`
Expected: FAIL — her iki modül de çözümlenemiyor.

- [ ] **Step 3: Write the implementation**

`frontend/src/utils/regionMapUrl.ts`:

```ts
/**
 * Bölge harita görselinin yolu. Görseller `yarn workspace backend
 * render:region-maps` ile üretilip repoda tutuluyor; SDE güncellemesinden
 * sonra elle yeniden üretilirler.
 */
export const regionMapUrl = (regionId: number): string =>
  `/images/regions/${regionId}.svg`;
```

`frontend/src/components/RegionMap/RegionMap.tsx`:

```tsx
'use client';

import { regionMapUrl } from '@/utils/regionMapUrl';
import { useState } from 'react';

export interface RegionMapProps {
  regionId: number;
  regionName: string;
  /** Kenar uzunluğu, piksel. Görsel vektör: her boyutta net çıkar. */
  size: number;
  className?: string;
}

/**
 * Bir bölgenin yıldız haritası. Zemini şeffaftır, o yüzden altındaki yüzeyi
 * alır — kart, sayfa, ya da fareyle üstüne gelinmiş satır.
 *
 * Dosya yoksa bileşen kendini kaldırır. Bu ancak SDE güncellemesiyle yeni bir
 * bölge gelip script'in çalıştırılmamasıyla olur; kırık görsel ikonu
 * göstermektense hiçbir şey göstermemek doğru.
 */
export default function RegionMap({
  regionId,
  regionName,
  size,
  className,
}: RegionMapProps) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    <img
      src={regionMapUrl(regionId)}
      alt={`${regionName} map`}
      width={size}
      height={size}
      className={className}
      onError={() => setMissing(true)}
    />
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn workspace frontend test src/utils/regionMapUrl.spec.ts src/components/RegionMap/RegionMap.spec.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Lint, format, commit**

```bash
yarn workspace frontend lint
npx prettier --write frontend/src/utils/regionMapUrl.ts frontend/src/utils/regionMapUrl.spec.ts frontend/src/components/RegionMap/RegionMap.tsx frontend/src/components/RegionMap/RegionMap.spec.tsx
git add frontend/src/utils/regionMapUrl.ts frontend/src/utils/regionMapUrl.spec.ts frontend/src/components/RegionMap
git commit -m "feat(frontend): add a region map thumbnail component"
```

`lint` yeni bir uyarı eklememeli. Sayıyı `main` ile karşılaştır: 2026-09-08 itibarıyla 234.

---

### Task 4: Dört çağrı yeri

**Files:**

- Modify: `frontend/src/app/regions/[id]/page.tsx:61-63`
- Modify: `frontend/src/app/regions/page.tsx:150-153`
- Modify: `frontend/src/components/TopRegionsCard/TopRegionsCard.tsx:57-62`
- Modify: `frontend/src/app/constellations/[id]/page.tsx:70-72`
- Modify: `frontend/src/app/solar-systems/[id]/page.tsx:202-214`

**Interfaces:**

- Consumes: `<RegionMap>` — Task 3'ten.
- Produces: kullanıcının bakacağı son hâl.

Beş dosyanın hepsinde import: `import RegionMap from '@/components/RegionMap/RegionMap';`

- [ ] **Step 1: Bölge detay sayfası — yer tutucuyu haritayla değiştir**

`frontend/src/app/regions/[id]/page.tsx`. Sayfada zaten 96×96'lık bir yer tutucu var; içindeki jenerik küre ikonu bölgeyi bölgeden ayırmıyor. Bunu değiştir:

```tsx
<div className="flex items-center justify-center w-24 h-24 shadow-md bg-gray-800/50 shrink-0">
  <GlobeAltIcon className="w-12 h-12 text-cyan-500" />
</div>
```

şununla:

```tsx
<div className="flex items-center justify-center w-24 h-24 shadow-md bg-gray-800/50 shrink-0">
  <RegionMap regionId={region.id} regionName={region.name} size={96} />
</div>
```

`GlobeAltIcon` bu dosyada başka yerde kullanılmıyorsa import'unu da kaldır; kullanılıyorsa bırak. Kontrol: `grep -c GlobeAltIcon 'frontend/src/app/regions/[id]/page.tsx'`.

- [ ] **Step 2: Bölge listesi — Region hücresine ekle**

`frontend/src/app/regions/page.tsx`, tablo satırındaki `<div className="flex items-center">` içine, `<Link>`'ten önce:

```tsx
<div className="flex items-center gap-3">
  <RegionMap
    regionId={region.id}
    regionName={region.name}
    size={64}
    className="shrink-0"
  />
  <Link
    href={`/regions/${region.id}`}
    prefetch={false}
    className="font-medium text-gray-400 transition-colors hover:text-blue-400"
  >
    {region.name}
  </Link>
</div>
```

Mevcut `<div className="flex items-center">` sınıfına `gap-3` eklendiğine dikkat et.

- [ ] **Step 3: Top Regions kartı — rank ile ad arasına ekle**

`frontend/src/components/TopRegionsCard/TopRegionsCard.tsx`, `<RankNumber ... />` ile onu izleyen `<div className="flex items-center justify-between ...">` arasına:

```tsx
<RegionMap
  regionId={region.id}
  regionName={region.name}
  size={64}
  className="shrink-0"
/>
```

Dosya zaten `'use client'` taşıyor, ek bir şey gerekmiyor.

- [ ] **Step 4: Takımyıldız sayfası — üstündeki bölgeyi göster**

`frontend/src/app/constellations/[id]/page.tsx`. Buradaki yer tutucu takımyıldızın kendi ikonu; onu **değiştirme**. Bunun yerine, sayfanın zaten gösterdiği "Region: <ad>" satırındaki `GlobeAltIcon`'u haritayla değiştir:

```tsx
<div className="flex items-center gap-2 mt-2 text-gray-400">
  <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
  <span>Region:</span>
```

şununla:

```tsx
<div className="flex items-center gap-2 mt-2 text-gray-400">
  <RegionMap
    regionId={constellation.region.id}
    regionName={constellation.region.name}
    size={20}
    className="shrink-0"
  />
  <span>Region:</span>
```

Görsel burada 20px; küçük ve amacı da bu — satır içi bir işaret, harita değil.

- [ ] **Step 5: Sistem sayfası — üstündeki bölgeyi göster**

`frontend/src/app/solar-systems/[id]/page.tsx:202-214`. Buradaki 96×96 kutu sistemin güvenlik rengini taşıyor; **dokunma**, bilgi taşıyor. Sayfa bölgesini zaten gösteriyor ve takımyıldız sayfasıyla birebir aynı deseni kullanıyor. Şunu:

```tsx
{system.constellation?.region && (
  <div className="flex items-center gap-2 text-gray-400">
    <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
    <span>Region:</span>
```

şununla değiştir:

```tsx
{system.constellation?.region && (
  <div className="flex items-center gap-2 text-gray-400">
    <RegionMap
      regionId={system.constellation.region.id}
      regionName={system.constellation.region.name}
      size={20}
      className="shrink-0"
    />
    <span>Region:</span>
```

Görsel burada da 20px — satır içi bir işaret, harita değil.

Her iki dosyada da `GlobeAltIcon` başka yerde kullanılıyor olabilir; import'u ancak kullanım sayısı sıfıra düşerse kaldır:

```bash
grep -c GlobeAltIcon 'frontend/src/app/constellations/[id]/page.tsx' \
  'frontend/src/app/solar-systems/[id]/page.tsx'
```

- [ ] **Step 6: Typecheck, lint, format**

```bash
yarn workspace frontend lint
npx prettier --write 'frontend/src/app/regions/**/*.tsx' 'frontend/src/app/constellations/[id]/page.tsx' 'frontend/src/app/solar-systems/[id]/page.tsx' frontend/src/components/TopRegionsCard/TopRegionsCard.tsx
```

`build` çalıştırma: `frontend`'in `build`'i `yarn kill` ile 3000 portundaki dev sunucusunu öldürüyor. Tip kontrolü için `yarn workspace frontend test` ve `lint` yeterli; tam `build` PR öncesi tek seferde koşulacak.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app frontend/src/components/TopRegionsCard
git commit -m "feat(frontend): show the region map on region, constellation and system pages"
```

---

### Task 5: Operasyon dokümanı

**Files:**

- Create: `backend/docs/ops/region-map-images.md`
- Modify: `backend/docs/ops/` içindeki README ya da indeks varsa ona bir satır

- [ ] **Step 1: Write the document**

`backend/docs/ops/region-map-images.md`:

````markdown
# Region map images

Every region has a star map thumbnail at
`frontend/public/images/regions/{region_id}.svg`. They are generated from our
own topology data, committed to the repository, and served by Next as static
files. Nothing renders at request time.

## When to run it

After an SDE update — that is, after `queue:regions`, `queue:constellations`,
`queue:solar-systems` or `worker-stargates` have changed the topology. Not on a
schedule: this is static universe data, and per the project's rule only mutable
data gets scheduled.

```bash
yarn workspace backend render:region-maps
```

Expected output today:

```
114 regions written to .../frontend/public/images/regions
  8490 systems, 6619 internal jumps, 740 outbound gates
```

Then commit whatever changed. The diff is the record of what the SDE update
did to the map — that is the reason these live in git rather than in object
storage.

## What it draws

- One dot per system, `r 1.3`, coloured on EVE's own security ramp
  (`#2FEFEF` at 1.0 down to `#F00000` at 0.0 and below).
- One neutral line per stargate jump inside the region.
- A 10-unit green stub for each gate leaving the region. Stubs are allowed to
  run past the frame and be clipped — 690 of the 740 clear it whole.
- Transparent background. The site has a single dark theme and the image sits
  on three different surfaces, one of which changes on hover
  (`.card-row` in `cards.css`), so a baked-in background would leave a dark
  square behind.

The drawing itself is in [`../../src/scripts/region-map-svg.ts`](../../src/scripts/region-map-svg.ts),
which knows nothing about the database and is covered by unit tests. The script
that queries and writes is
[`../../src/scripts/render-region-maps.ts`](../../src/scripts/render-region-maps.ts).

## Sizes

There is one file per region and it is used at every size — 20px in a line of
text, 64px in a list row, 96px in a page header. An SVG has no resolution, so
there is nothing to export at 2x and no `srcset`.

What does change with size is line weight: everything scales together, so at
64px the `w 0.75` jump line lands at 0.42 of a pixel and reads faint. If that
turns out too weak in place, raise `JUMP_WIDTH` in `region-map-svg.ts` and
re-run — it is one number and 114 files.

## Regions with nothing to draw

- 47 regions contain no stargates at all (wormhole and abyssal space). They
  render as a scatter of dots with no lines. That is correct: those regions
  genuinely have no gate topology.
- 48 regions have no gates leaving them, so they carry no green.
- 3 regions hold a single system (G-R00031, GPMR-01, Yasna Zakh) and render as
  one dot.

None of these get a substitute image.
````

- [ ] **Step 2: Check the links resolve**

```bash
node scripts/check-doc-links.js
```

Expected: yeni bir kırık link yok. `.github/prompts/add-killmail-filter.prompt.md:11` zaten kırıktı, bu işle ilgisi yok.

- [ ] **Step 3: Format and commit**

```bash
npx prettier --write backend/docs/ops/region-map-images.md
git add backend/docs/ops/region-map-images.md
git commit -m "docs(backend): document the region map render step"
```

---

### Task 6: PR öncesi tam doğrulama

**Files:** yok — yalnızca doğrulama.

- [ ] **Step 1: Run the full set**

```bash
cd /root/killreport
yarn test
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build
npx prettier --check .
```

Her komutun çıktısını oku. `lint` sayısını `main` ile karşılaştır (2026-09-08: 234) ve girdilerin hiçbirinin bu branch'in dokunduğu bir dosyayı adlandırmadığını doğrula.

- [ ] **Step 2: Confirm the working tree is clean**

```bash
git status --short
```

Boş olmalı: script'in ürettiği 114 dosya Task 2'de commit'lendi.

- [ ] **Step 3: Hand over for visual review**

Kullanıcıya bakması gereken dört yeri söyle:

- `/regions/10000043` — Domain, başlıkta 96px
- `/regions` — listede 64px, satır yüksekliği artmış olacak
- `/killmails` — sidebar'daki Top Regions kartında 64px
- `/constellations/[id]` ve `/solar-systems/[id]` — "Region:" satırında 20px

Sorulacak tek şey: 64px'te atlama çizgileri yeterince okunaklı mı. Değilse
`region-map-svg.ts`'te `JUMP_WIDTH` 0.75 → 1.10 ve script yeniden çalıştırılır.

- [ ] **Step 4: Delete the spec and this plan before merging**

`docs/superpowers/` altındaki spec ve plan `main`'e girmez.

```bash
git rm docs/superpowers/specs/2026-09-09-region-map-thumbnails-design.md \
       docs/superpowers/plans/2026-09-09-region-map-thumbnails.md
git commit -m "chore: remove the region map thumbnail spec and plan"
```
