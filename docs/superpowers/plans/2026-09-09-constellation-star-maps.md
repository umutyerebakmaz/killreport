# Constellation harita görselleri — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1.184 constellation için yıldız haritası SVG'si üretmek, repoya commit etmek ve dört sayfada göstermek.

**Architecture:** Region'ın çizim modülü palet parametresi alacak şekilde `star-map-svg.ts` adıyla paylaşılan hale getirilir; geometri tek yerde kalır, region ve constellation yalnızca palet nesnesiyle ayrışır. Üretim, region'daki gibi elle çalıştırılan bir script'tir — statik evren verisi zamanlanmaz. Görseller repoda durur ve Next tarafından statik dosya olarak servis edilir; istek anında hiçbir şey render edilmez.

**Tech Stack:** TypeScript, tsx, Prisma `$queryRaw` (prismaWorker), Vitest 5, Next.js App Router, Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-09-constellation-map-images-design.md](../specs/2026-09-09-constellation-map-images-design.md)

## Global Constraints

- **Yarn, asla npm.** `yarn workspace backend ...`, `yarn workspace frontend ...`.
- **Constellation paleti**, spec'te kararlaştırıldığı gibi: nokta `#FFFFFF`, iç bağlantı `#DC2626` `stroke-opacity="0.7"`, dışa çıkan kapı `#1D4ED8`. Geometri region'la aynı: `dotR 1.3`, `jumpWidth 0.75`, `gateWidth 0.9`, `gateOpacity 0.9`, `gateLength 10`, `pad 7.3`.
- **Region paleti değişmez** ve büyük/küçük harfi dahil bugünkü haliyle kalır: `jump: '#94a3b8'` (küçük harf), `gate: '#4CC94C'`. Bir harf değişirse 114 region SVG'si yeniden yazılır.
- **Region çıktısı byte düzeyinde aynı kalmalı.** Görev 1 ve Görev 3 bunu ayrı ayrı kanıtlar.
- **Üretilen dosyalar commit edilir.** `frontend/public/images/constellations/*.svg` repoya girer; diff, SDE güncellemesinin haritaya ne yaptığının kaydıdır.
- **Commit mesajları İngilizce**, `type(scope):` sonrası küçük harf.
- **Commit ve PR'lara asla Claude atıfı eklenmez** — `Co-Authored-By: Claude`
  yok, `Generated with Claude Code` yok, oturum linki yok. Harness varsayılan
  olarak bu satırları eklemeye çalışır; eklenmeyecek.
- **Prettier**, değişen her dosyada: `npx prettier --check <dosya>`.
- **Dal:** `feat/constellation-star-maps`. Spec `2db5104` ile bu dalda zaten duruyor.

---

### Task 1: Çizim modülünü paylaşılan hale getir

Region'ın çizim modülü iki palete hizmet edecek şekilde yeniden adlandırılır ve parametreleşir. Görev, region çıktısının değişmediğinin kanıtıyla biter.

**Files:**

- Rename: `backend/src/scripts/region-map-svg.ts` → `backend/src/scripts/star-map-svg.ts`
- Rename: `backend/src/scripts/region-map-svg.spec.ts` → `backend/src/scripts/star-map-svg.spec.ts`
- Modify: `backend/src/scripts/render-region-maps.ts:6,12,95`

**Interfaces:**

- Consumes: yok, ilk görev.
- Produces: `renderStarMap(input: StarMapInput, palette: MapPalette): string`, `securityColour(security: number | null): string`, `REGION_PALETTE`, `CONSTELLATION_PALETTE`, ve tipler `MapSystem`, `MapJump`, `MapGate`, `StarMapInput`, `MapPalette`.

- [ ] **Step 1: Dosyaları yeniden adlandır**

```bash
cd backend
git mv src/scripts/region-map-svg.ts src/scripts/star-map-svg.ts
git mv src/scripts/region-map-svg.spec.ts src/scripts/star-map-svg.spec.ts
```

- [ ] **Step 2: Testi yeni API'yi isteyecek şekilde yaz**

`star-map-svg.spec.ts`'in ilk iki satırını değiştir:

```ts
import { describe, expect, it } from 'vitest';
import {
  CONSTELLATION_PALETTE,
  REGION_PALETTE,
  renderStarMap,
  securityColour,
} from './star-map-svg';
import { FADE_SYSTEMS } from './fade.fixture';
```

`describe('renderRegionMap', ...)` başlığını `describe('renderStarMap with REGION_PALETTE', ...)` yap ve bu blok içindeki **on** `renderRegionMap(x)` çağrısının hepsini `renderStarMap(x, REGION_PALETTE)` yap. Assertion'ların hiçbiri değişmez — region çıktısı aynı kalacağı için beklentiler de aynı kalır.

- [ ] **Step 3: Testin başarısız olduğunu gör**

Run: `yarn workspace backend test src/scripts/star-map-svg.spec.ts`
Expected: FAIL — `does not provide an export named 'renderStarMap'`

- [ ] **Step 4: Modülü parametreleştir**

`star-map-svg.ts`'i şu hale getir. Geometri gövdesi (`renderStarMap` içindeki projeksiyon, dedupe, stub hesabı) bugünkü `renderRegionMap` ile birebir aynıdır; yalnızca sabitler `palette`'ten okunur.

```ts
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
```

- [ ] **Step 5: Testin geçtiğini gör**

Run: `yarn workspace backend test src/scripts/star-map-svg.spec.ts`
Expected: PASS — mevcut 14 testin hepsi.

- [ ] **Step 6: Constellation paleti için başarısız testleri yaz**

`star-map-svg.spec.ts`'in sonuna ekle:

```ts
describe('renderStarMap with CONSTELLATION_PALETTE', () => {
  const twoSystems = {
    systems: [
      { id: 1, x: 0, z: 0, security: 0.9 },
      { id: 2, x: 100, z: -50, security: -0.2 },
    ],
    jumps: [{ fromId: 1, toId: 2 }],
    gates: [{ fromId: 1, toX: 900, toZ: 0 }],
  };

  it('draws every system white, whatever its security', () => {
    const svg = renderStarMap(twoSystems, CONSTELLATION_PALETTE);
    expect(svg).toContain('<circle cx="0.0" cy="0.0" r="1.3" fill="#FFFFFF"/>');
    expect(svg).toContain(
      '<circle cx="100.0" cy="50.0" r="1.3" fill="#FFFFFF"/>',
    );
    expect(svg).not.toContain('#48F0C0');
    expect(svg).not.toContain('#F00000');
  });

  it('draws internal jumps red, at a higher opacity than the region', () => {
    expect(renderStarMap(twoSystems, CONSTELLATION_PALETTE)).toContain(
      '<line x1="0.0" y1="0.0" x2="100.0" y2="50.0" stroke="#DC2626" stroke-width="0.75" stroke-opacity="0.7"/>',
    );
  });

  it('draws outbound gates dark blue', () => {
    expect(renderStarMap(twoSystems, CONSTELLATION_PALETTE)).toContain(
      'stroke="#1D4ED8" stroke-width="0.9" stroke-opacity="0.9"',
    );
  });

  it('shares the region geometry exactly, differing only in colour', () => {
    const viewBoxOf = (svg: string) => /viewBox="[^"]+"/.exec(svg)?.[0];
    const region = renderStarMap(twoSystems, REGION_PALETTE);
    const constellation = renderStarMap(twoSystems, CONSTELLATION_PALETTE);
    expect(viewBoxOf(constellation)).toBe(viewBoxOf(region));
    expect(constellation.match(/<circle/g)).toHaveLength(2);
    expect(constellation.match(/<line/g)).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Testleri çalıştır**

Run: `yarn workspace backend test src/scripts/star-map-svg.spec.ts`
Expected: PASS — 18 test. Step 4'te palet zaten yazıldığı için bu blok ilk çalıştırmada geçer; testler paleti değil, paletin çizime doğru bağlandığını doğruluyor.

- [ ] **Step 8: Region script'ini yeni API'ye bağla**

`render-region-maps.ts`'te üç değişiklik:

Satır 6, doküman yolu (dosya Görev 6'da yeniden adlandırılıyor):

```ts
 * See backend/docs/ops/star-map-images.md
```

Satır 12, import:

```ts
import {
  MapGate,
  MapJump,
  MapSystem,
  REGION_PALETTE,
  renderStarMap,
} from './star-map-svg';
```

Satır 95 civarı, çağrı:

```ts
    svg: renderStarMap(
      {
        systems: regionSystems,
        jumps: jumpsOf.get(regionId) ?? [],
        gates: gatesOf.get(regionId) ?? [],
      },
      REGION_PALETTE,
    ),
```

- [ ] **Step 9: Tip kontrolü**

Run: `yarn workspace backend build`
Expected: hatasız çıkış.

- [ ] **Step 10: Region regresyon kanıtı**

```bash
yarn workspace backend render:region-maps
git status --porcelain frontend/public/images/regions
```

Expected: `render:region-maps` bugünkü satırı yazdırır (`114 regions written to ...`, `8490 systems, 6619 internal jumps, 740 outbound gates`, `0 stale files removed`) ve `git status` **hiçbir şey** yazdırmaz. Tek bir dosya bile listeleniyorsa refactor çıktıyı değiştirmiştir; devam etme, farkı bul.

- [ ] **Step 11: Commit**

```bash
npx prettier --check backend/src/scripts/star-map-svg.ts backend/src/scripts/star-map-svg.spec.ts backend/src/scripts/render-region-maps.ts
git add backend/src/scripts
git commit
```

Mesaj: `refactor(backend): share the star map drawing between region and constellation`

---

### Task 2: Constellation üretim script'i

**Files:**

- Create: `backend/src/scripts/render-constellation-maps.ts`
- Modify: `backend/package.json` (scripts bloğu)

**Interfaces:**

- Consumes: Görev 1'den `renderStarMap`, `CONSTELLATION_PALETTE`, `MapGate`, `MapJump`, `MapSystem`.
- Produces: `yarn workspace backend render:constellation-maps` komutu ve `frontend/public/images/constellations/` dizini.

- [ ] **Step 1: Script'i yaz**

`backend/src/scripts/render-constellation-maps.ts`:

```ts
/**
 * Generates a map SVG for each constellation and writes it to the frontend's
 * static directory.
 *
 * Run by hand, not a PM2 process: once after an SDE update.
 * See backend/docs/ops/star-map-images.md
 */

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prismaWorker from '@services/prisma-worker';
import {
  CONSTELLATION_PALETTE,
  MapGate,
  MapJump,
  MapSystem,
  renderStarMap,
} from './star-map-svg';

// backend is CommonJS (no "type": "module"), so __dirname is the way here —
// import.meta.url is not available. From src/scripts that is three levels up.
const OUT_DIR = join(
  __dirname,
  '../../../frontend/public/images/constellations',
);

interface SystemRow {
  constellation_id: number;
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
  // No join to constellations here: solar_systems carries constellation_id
  // directly, which is one level shallower than the region script needs.
  const systems = await prismaWorker.$queryRaw<SystemRow[]>`
    SELECT s.constellation_id, s.system_id, s.position_x, s.position_z, s.security_status
    FROM solar_systems s
    WHERE s.position_x IS NOT NULL AND s.position_z IS NOT NULL
      AND s.constellation_id IS NOT NULL`;

  const gates = await prismaWorker.$queryRaw<GateRow[]>`
    SELECT solar_system_id, destination_system_id
    FROM stargates
    WHERE destination_system_id IS NOT NULL`;

  const constellationOf = new Map<number, number>();
  const coordOf = new Map<number, { x: number; z: number }>();
  const byConstellation = new Map<number, MapSystem[]>();

  for (const row of systems) {
    constellationOf.set(row.system_id, row.constellation_id);
    coordOf.set(row.system_id, { x: row.position_x, z: row.position_z });
    const list = byConstellation.get(row.constellation_id) ?? [];
    list.push({
      id: row.system_id,
      x: row.position_x,
      z: row.position_z,
      security: row.security_status,
    });
    byConstellation.set(row.constellation_id, list);
  }

  const jumpsOf = new Map<number, MapJump[]>();
  const gatesOf = new Map<number, MapGate[]>();
  let orphaned = 0;

  for (const gate of gates) {
    const from = constellationOf.get(gate.solar_system_id);
    const to = constellationOf.get(gate.destination_system_id);
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

  // All maps are generated in memory first: an interrupted run should not leave a partial set on disk.
  const files = [...byConstellation.entries()].map(
    ([constellationId, constellationSystems]) => ({
      path: join(OUT_DIR, `${constellationId}.svg`),
      svg: renderStarMap(
        {
          systems: constellationSystems,
          jumps: jumpsOf.get(constellationId) ?? [],
          gates: gatesOf.get(constellationId) ?? [],
        },
        CONSTELLATION_PALETTE,
      ),
    }),
  );

  await Promise.all(
    files.map((file) => writeFile(file.path, file.svg, 'utf8')),
  );

  // Counted off the palette rather than a literal, so a palette change cannot
  // silently turn these totals into zero.
  const occurrences = (svg: string, needle: string) =>
    svg.split(needle).length - 1;
  const dots = files.reduce((sum, f) => sum + occurrences(f.svg, '<circle'), 0);
  const edges = files.reduce(
    (sum, f) => sum + occurrences(f.svg, CONSTELLATION_PALETTE.jump),
    0,
  );
  const stubs = files.reduce(
    (sum, f) => sum + occurrences(f.svg, CONSTELLATION_PALETTE.gate),
    0,
  );

  // Reconcile the directory: a constellation retired (or renumbered) since the
  // last run leaves a stale file that this pass did not write. A constellation
  // id is only ever reused for a different constellation, never revived for the
  // same one, so a stale file is not just outdated — it can silently show the
  // wrong constellation's map. Only ever remove `<digits>.svg` in this one
  // directory; anything else is left alone.
  const renderedIds = new Set(byConstellation.keys());
  const existing = await readdir(OUT_DIR);
  const removable = existing.filter((name) => {
    const match = /^(\d+)\.svg$/.exec(name);
    return match !== null && !renderedIds.has(Number(match[1]));
  });

  // Guard against a botched query silently emptying the constellation set.
  // With 1,184 committed files this matters more than it does for 114 regions:
  // a broken WHERE clause would report deleting most of the set as a success
  // line. A real SDE update retires one or two at a time, never a large share.
  // This only skips the deletion step; the files rendered above are still
  // written either way.
  const MAX_REMOVAL_FRACTION = 0.25;
  const reconciliationLooksUnsafe =
    files.length === 0 ||
    (existing.length > 0 &&
      removable.length / existing.length > MAX_REMOVAL_FRACTION);

  let reconciliationLine: string;
  if (reconciliationLooksUnsafe) {
    reconciliationLine =
      removable.length > 0
        ? `\n  reconciliation skipped: would remove ${removable.length} of ` +
          `${existing.length} files on disk — this looks like an incomplete ` +
          `query, not retired constellations. Check the database before re-running.`
        : '\n  0 stale files removed';
  } else {
    await Promise.all(removable.map((name) => unlink(join(OUT_DIR, name))));
    reconciliationLine =
      removable.length > 0
        ? `\n  ${removable.length} stale files removed: ${removable.join(', ')}`
        : '\n  0 stale files removed';
  }

  console.log(
    `${files.length} constellations written to ${OUT_DIR}\n` +
      `  ${dots} systems, ${edges} internal jumps, ${stubs} outbound gates` +
      (orphaned > 0
        ? `\n  ${orphaned} gates skipped: endpoint missing or unpositioned`
        : '') +
      reconciliationLine,
  );

  await prismaWorker.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prismaWorker.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: package.json script satırlarını ekle**

`backend/package.json`'da `render:region-maps` satırının hemen altına:

```json
"render:constellation-maps": "tsx src/scripts/render-constellation-maps.ts",
"render:maps": "yarn render:region-maps && yarn render:constellation-maps",
```

`render:maps` bilerek tek satırlık bir `package.json` girdisidir, `scripts/` altında bir dosya değil: iki komuttan birinin unutulması, region ile constellation'ın farklı topolojiye göre çizilmiş olması demek.

- [ ] **Step 3: Tip kontrolü**

Run: `yarn workspace backend build`
Expected: hatasız çıkış.

- [ ] **Step 4: Prettier ve commit**

```bash
npx prettier --check backend/src/scripts/render-constellation-maps.ts backend/package.json
git add backend/src/scripts/render-constellation-maps.ts backend/package.json
git commit
```

Mesaj: `feat(backend): add a constellation star map render script`

---

### Task 3: 1.184 SVG'yi üret ve commit et

Script'in çıktısı kendi commit'inde durur, böylece hem üretim kodu hem üretilen set ayrı ayrı gözden geçirilebilir.

**Files:**

- Create: `frontend/public/images/constellations/*.svg` (1.184 dosya)

**Interfaces:**

- Consumes: Görev 2'den `yarn workspace backend render:constellation-maps`.
- Produces: `frontend/public/images/constellations/{constellation_id}.svg`, Görev 4'ün `constellationMapUrl`'ünün işaret ettiği yol.

- [ ] **Step 1: Script'i çalıştır**

Run: `yarn workspace backend render:maps`

Expected — region kısmı bugünkü satırını, constellation kısmı şunu yazdırır:

```
1184 constellations written to .../frontend/public/images/constellations
  8490 systems, 5704 internal jumps, 2570 outbound gates
  0 stale files removed
```

Sayılar tutmuyorsa dur. Beklenen değerlerin kaynağı topoloji verisinin kendisi: 1.184 constellation, 8.490 konumlanmış sistem, 11.408 iç stargate satırı (tekilleştirilince 5.704) ve 2.570 sınır aşan stargate satırı.

- [ ] **Step 2: Region setinin bozulmadığını doğrula**

```bash
git status --porcelain frontend/public/images/regions
```

Expected: boş çıktı. `render:maps` region'ları da yeniden ürettiği için bu, Görev 1'deki regresyon kanıtının ikinci ve bağımsız tekrarıdır.

- [ ] **Step 3: Uç durumları gözle doğrula**

```bash
ls frontend/public/images/constellations | wc -l          # 1184
grep -c '<circle' frontend/public/images/constellations/20010001.svg   # 1  (Manifest District, tek sistem)
grep -c '#1D4ED8' frontend/public/images/constellations/20010001.svg   # 5  (beş dışa çıkan kapı)
grep -c '#DC2626' frontend/public/images/constellations/21000329.svg   # 0  (E-C00329, wormhole: iç bağlantı yok)
grep -c '#1D4ED8' frontend/public/images/constellations/21000329.svg   # 0  (kapı da yok)
grep -c '<circle' frontend/public/images/constellations/21000329.svg   # 19 (sadece nokta)
grep -c '#F00000\|#2FEFEF' frontend/public/images/constellations/20000020.svg  # 0  (security ramp kullanılmıyor)
```

Beklenen değerler her satırın yanında. Biri tutmuyorsa palet ya da gruplama yanlış bağlanmıştır.

- [ ] **Step 4: Boyutu kaydet**

```bash
du -sh frontend/public/images/constellations
```

Expected: ~1,5 MB. Spec'in tahmini eleman başına 77 byte üzerinden 1,47 MB'tı; belirgin sapma varsa commit'ten önce nedenini anla.

- [ ] **Step 5: Commit**

```bash
git add frontend/public/images/constellations
git commit
```

Mesaj: `feat(frontend): add star map images for all 1,184 constellations`

---

### Task 4: Frontend yardımcısı ve bileşeni

**Files:**

- Create: `frontend/src/utils/constellationMapUrl.ts`
- Create: `frontend/src/utils/constellationMapUrl.spec.ts`
- Create: `frontend/src/components/ConstellationMap/ConstellationMap.tsx`
- Create: `frontend/src/components/ConstellationMap/ConstellationMap.spec.tsx`

**Interfaces:**

- Consumes: Görev 3'ten `frontend/public/images/constellations/{id}.svg`.
- Produces: `constellationMapUrl(constellationId: number): string` ve varsayılan export `ConstellationMap` — props `{ constellationId: number; constellationName: string; size: number; className?: string }`. Görev 5'in dört çağrı yeri bu props adlarını kullanır.

- [ ] **Step 1: URL yardımcısı için başarısız testi yaz**

`frontend/src/utils/constellationMapUrl.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { constellationMapUrl } from './constellationMapUrl';

describe('constellationMapUrl', () => {
  it('points at the static map for a constellation', () => {
    expect(constellationMapUrl(20000020)).toBe(
      '/images/constellations/20000020.svg',
    );
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `yarn workspace frontend test src/utils/constellationMapUrl.spec.ts`
Expected: FAIL — `Failed to resolve import "./constellationMapUrl"`

- [ ] **Step 3: Yardımcıyı yaz**

`frontend/src/utils/constellationMapUrl.ts`:

```ts
/**
 * Path to the constellation map image. Images are generated with `yarn workspace
 * backend render:maps` and stored in the repository; they are manually
 * regenerated after an SDE update.
 */
export const constellationMapUrl = (constellationId: number): string =>
  `/images/constellations/${constellationId}.svg`;
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `yarn workspace frontend test src/utils/constellationMapUrl.spec.ts`
Expected: PASS

- [ ] **Step 5: Bileşen için başarısız testleri yaz**

`frontend/src/components/ConstellationMap/ConstellationMap.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConstellationMap from './ConstellationMap';

describe('ConstellationMap', () => {
  it("renders the constellation's map at the requested size", () => {
    render(
      <ConstellationMap
        constellationId={20000020}
        constellationName="Kimotoro"
        size={64}
      />,
    );
    const image = screen.getByAltText('Kimotoro map');
    expect(image).toHaveAttribute('src', '/images/constellations/20000020.svg');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('removes itself when the file is missing, rather than showing a broken image', () => {
    render(
      <ConstellationMap
        constellationId={999}
        constellationName="Nowhere"
        size={64}
      />,
    );
    const image = screen.getByAltText('Nowhere map');
    fireEvent.error(image);
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();
  });

  it('shows a new constellation after a previous one failed to load', () => {
    const { rerender } = render(
      <ConstellationMap
        constellationId={999}
        constellationName="Nowhere"
        size={64}
      />,
    );
    fireEvent.error(screen.getByAltText('Nowhere map'));
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();

    rerender(
      <ConstellationMap
        constellationId={20000020}
        constellationName="Kimotoro"
        size={64}
      />,
    );
    expect(screen.getByAltText('Kimotoro map')).toHaveAttribute(
      'src',
      '/images/constellations/20000020.svg',
    );
  });
});
```

- [ ] **Step 6: Testlerin başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/ConstellationMap`
Expected: FAIL — `Failed to resolve import "./ConstellationMap"`

- [ ] **Step 7: Bileşeni yaz**

`frontend/src/components/ConstellationMap/ConstellationMap.tsx`:

```tsx
'use client';

import { constellationMapUrl } from '@/utils/constellationMapUrl';
import { useState } from 'react';

export interface ConstellationMapProps {
  constellationId: number;
  constellationName: string;
  /** Edge length in pixels. The image is a vector, so it will be sharp at any size. */
  size: number;
  className?: string;
}

/**
 * A constellation's star map. The background is transparent, so it takes on the
 * color of the surface underneath — a card, a page, or a row hovered with the
 * mouse.
 *
 * If the file is missing, the component removes itself. This can only happen if
 * an SDE update introduces a new constellation and the script is not run;
 * showing nothing is better than showing a broken image icon.
 */
export default function ConstellationMap({
  constellationId,
  constellationName,
  size,
  className,
}: ConstellationMapProps) {
  const [failedId, setFailedId] = useState<number | null>(null);
  if (failedId === constellationId) return null;

  return (
    <img
      src={constellationMapUrl(constellationId)}
      alt={`${constellationName} map`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailedId(constellationId)}
    />
  );
}
```

- [ ] **Step 8: Testlerin geçtiğini gör**

Run: `yarn workspace frontend test src/components/ConstellationMap src/utils/constellationMapUrl.spec.ts`
Expected: PASS — 4 test.

- [ ] **Step 9: Prettier ve commit**

```bash
npx prettier --check frontend/src/utils/constellationMapUrl.ts frontend/src/utils/constellationMapUrl.spec.ts frontend/src/components/ConstellationMap/ConstellationMap.tsx frontend/src/components/ConstellationMap/ConstellationMap.spec.tsx
git add frontend/src/utils/constellationMapUrl.ts frontend/src/utils/constellationMapUrl.spec.ts frontend/src/components/ConstellationMap
git commit
```

Mesaj: `feat(frontend): add a constellation map component`

---

### Task 5: Dört sayfaya yerleştir

Dördü de aynı bileşeni farklı boyutta kullanır. Üçünde jenerik mor `MapIcon` vardır ve harita onun yerine geçer; birinde satırda ikon yoktur ve harita eklenir.

**Files:**

- Modify: `frontend/src/app/constellations/[id]/page.tsx:8,72`
- Modify: `frontend/src/app/constellations/page.tsx:158`
- Modify: `frontend/src/app/regions/[id]/page.tsx:256`
- Modify: `frontend/src/app/solar-systems/[id]/page.tsx:23,192`

**Interfaces:**

- Consumes: Görev 4'ten `ConstellationMap` ve props'ları.
- Produces: kullanıcıya görünür çıktı; sonraki görev yok.

- [ ] **Step 1: Constellation detay header'ı — 96px**

`frontend/src/app/constellations/[id]/page.tsx`, satır 72. Mevcut:

```tsx
<div className="flex items-center justify-center w-24 h-24 shadow-md bg-gray-800/50 shrink-0">
  <MapIcon className="w-12 h-12 text-purple-500" />
</div>
```

Yerine:

```tsx
<div className="flex items-center justify-center w-24 h-24 shadow-md bg-gray-800/50 shrink-0">
  <ConstellationMap
    constellationId={constellation.id}
    constellationName={constellation.name}
    size={96}
  />
</div>
```

Import'ları düzelt: `MapIcon` bu dosyada başka kullanılmıyor, satır 8'den düşer, `MapPinIcon` kalır. `ConstellationMap` eklenir:

```tsx
import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import { MapPinIcon } from '@heroicons/react/24/outline';
```

- [ ] **Step 2: Constellations liste sayfası — 64px**

`frontend/src/app/constellations/page.tsx`, satır 158. Mevcut:

```tsx
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/constellations/${constellation.id}`}
```

Yerine:

```tsx
                    <div className="flex items-center gap-3">
                      <ConstellationMap
                        constellationId={constellation.id}
                        constellationName={constellation.name}
                        size={64}
                        className="shrink-0"
                      />
                      <Link
                        href={`/constellations/${constellation.id}`}
```

Import ekle: `import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';`. Bu dosyada `MapIcon` yok, kaldırılacak import da yok.

- [ ] **Step 3: Region detayının Constellations tabı — 24px**

`frontend/src/app/regions/[id]/page.tsx`, satır 256. Mevcut:

```tsx
<MapIcon className="w-5 h-5 text-purple-400 shrink-0" />
```

Yerine:

```tsx
<ConstellationMap
  constellationId={constellation.id}
  constellationName={constellation.name}
  size={24}
  className="shrink-0"
/>
```

Import ekle. **`MapIcon` import'unu bu dosyada kaldırma** — satır 79'da ikinci bir kullanımı var ve o değişmiyor.

- [ ] **Step 4: Solar system detayının "Constellation:" satırı — 20px**

`frontend/src/app/solar-systems/[id]/page.tsx`, satır 192. Mevcut:

```tsx
<MapIcon className="w-4 h-4 text-purple-500" />
```

Yerine:

```tsx
<ConstellationMap
  constellationId={system.constellation.id}
  constellationName={system.constellation.name}
  size={20}
  className="shrink-0"
/>
```

Import'ları düzelt: `MapIcon` bu dosyada başka kullanılmıyor, satır 23'ten düşer, `MapPinIcon` kalır. `ConstellationMap` eklenir.

Bu satır artık ait olduğu region'ın 20px'lik `RegionMap`'iyle (satır 205) simetrik olur: iki komşu satırın ikisi de kendi topolojisini gösterir.

- [ ] **Step 5: Lint ve tip kontrolü**

```bash
yarn workspace frontend lint
yarn workspace frontend build
```

Expected: `build` hatasız. `lint` deposunun genelinde önceden var olan sorunları raporlar — sinyal temiz çıkış değil, **sayı**: `main` ile karşılaştır ve girdilerin hiçbirinin bu dalın dokunduğu dört dosyayı adlandırmadığını doğrula. Kullanılmayan `MapIcon` import'u kalırsa lint bunu yakalar.

- [ ] **Step 6: Prettier ve commit**

```bash
npx prettier --check "frontend/src/app/constellations/page.tsx" "frontend/src/app/constellations/[id]/page.tsx" "frontend/src/app/regions/[id]/page.tsx" "frontend/src/app/solar-systems/[id]/page.tsx"
git add frontend/src/app
git commit
```

Mesaj: `feat(frontend): show a star map for every constellation`

---

### Task 6: Dokümantasyon ve tam doğrulama

**Files:**

- Rename: `backend/docs/ops/region-map-images.md` → `backend/docs/ops/star-map-images.md`
- Modify: içeriği ikisini birden anlatacak şekilde

**Interfaces:**

- Consumes: önceki beş görevin hepsi.
- Produces: yok, son görev.

- [ ] **Step 1: Dokümanı yeniden adlandır**

```bash
git mv backend/docs/ops/region-map-images.md backend/docs/ops/star-map-images.md
```

- [ ] **Step 2: İçeriği güncelle**

Başlığı `# Star map images` yap ve şu altı değişikliği uygula:

1. Giriş paragrafına constellation'ları ekle: görseller `frontend/public/images/regions/{region_id}.svg` **ve** `frontend/public/images/constellations/{constellation_id}.svg` altında.
2. "When to run it" bölümündeki komutu `yarn workspace backend render:maps` yap ve iki alt komutun (`render:region-maps`, `render:constellation-maps`) ayrı ayrı da çalıştırılabildiğini yaz.
3. Beklenen çıktı bloğuna constellation satırlarını ekle:

   ```
   1184 constellations written to .../frontend/public/images/constellations
     8490 systems, 5704 internal jumps, 2570 outbound gates
     0 stale files removed
   ```

4. "What it draws" bölümünü ikiye ayır. Region bugünkü metnini korur. Constellation için: beyaz nokta `r 1.3`; `#DC2626` iç bağlantı `w 0.75 / o 0.7`; `#1D4ED8` dışa çıkan kapı `w 0.9 / o 0.9`, 10 birim; şeffaf zemin. Paletin neden region'dan ayrıldığı tek cümleyle: constellation ortalama 7,2 sistem taşıyor ve dışa çıkan kapı oranı 1:9 yerine 1:2.
5. Satır 48 ve 62'deki `region-map-svg.ts` referanslarını `star-map-svg.ts` yap; satır 48'deki link `../../src/scripts/star-map-svg.ts` olur. `render-constellation-maps.ts`'e de link ekle.
6. "Regions with nothing to draw" bölümünün yanına constellation karşılığını ekle: 418 constellation'ın (3.222 sistem) hiç stargate'i yok — wormhole ve abyssal uzay, sadece nokta olarak çizilirler; 8 constellation tek sistemli. Region'daki gibi, hiçbirine yedek görsel verilmez.

- [ ] **Step 3: Doküman linklerini doğrula**

```bash
yarn docs:check-links
```

Expected: hatasız. Bu script `scripts/check-doc-links.js`'i çalıştırır; yeniden adlandırılan dosyaya kırık bir link kalırsa burada çıkar.

- [ ] **Step 4: Tam doğrulama setini çalıştır**

Sırayla, her birinin çıktısını okuyarak:

```bash
yarn test
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build
npx prettier --check .
```

`yarn workspace frontend build`'in 3000 portunda `yarn kill` çalıştırdığını unutma — çalışan bir dev sunucusu varsa düşer.

- [ ] **Step 5: Temiz ağaç kontrolü**

```bash
git status --porcelain
```

Expected: boş. Doğrulama koşusunun bir şey ürettiği bir ağaçta yeşil sonuç commit hakkında kanıt sayılmaz.

- [ ] **Step 6: Prettier ve commit**

```bash
npx prettier --check backend/docs/ops/star-map-images.md
git add backend/docs/ops
git commit
```

Mesaj: `docs: cover constellation maps in the star map ops guide`

- [ ] **Step 7: Görsel doğrulamayı kullanıcıya devret**

Bu projede sayfaya bakmak kullanıcının işidir. Tarayıcı sürme; dört sayfayı adıyla bildir:

- `/constellations` — liste satırlarında 64px
- `/constellations/20000020` — header'da 96px (Kimotoro, Jita'nın constellation'ı)
- `/regions/10000002` → Constellations tabı — satırlarda 24px
- `/solar-systems/30000142` — "Constellation:" satırında 20px, hemen altındaki region haritasıyla yan yana (Jita)

---

## Doğrulama özeti

| Ne                    | Nasıl                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Çizim mantığı         | `star-map-svg.spec.ts`, 18 test, iki palet                                                   |
| Region'ın bozulmadığı | `render:region-maps` sonrası boş `git status` — Görev 1 Step 10 ve Görev 3 Step 2'de iki kez |
| Üretim sayıları       | 1.184 dosya / 8.490 sistem / 5.704 iç bağlantı / 2.570 dışa çıkan kapı                       |
| Uç durumlar           | Görev 3 Step 3'teki altı `grep`                                                              |
| Frontend              | `constellationMapUrl.spec.ts` + `ConstellationMap.spec.tsx`, 4 test                          |
| Tipler ve lint        | `backend build`, `frontend lint`, `frontend build`                                           |
| Biçim                 | `npx prettier --check .`                                                                     |
| Görünüm               | Kullanıcı, dört sayfa                                                                        |
