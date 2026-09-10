# Solar system yıldız haritaları — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8.089 solar system için yörünge diyagramı SVG'si üretmek, repoya
commit etmek ve altı dosyada beş yerde göstermek.

**Architecture:** Faz 1 ve faz 2'nin boru hattı üçüncü kez kullanılıyor:
veritabanından habersiz saf bir render modülü + unit testleri, tek bir sorgu
script'i (mutabakat korumasıyla), `frontend/public/images/` altında tek dizin,
tek `<img>` bileşeni + url util'i. Çizim yeni: `star-map-svg.ts`'in graf
girdisine (`systems`/`jumps`/`gates`) uymadığı için ayrı bir modül,
`solar-system-map-svg.ts`.

**Tech Stack:** TypeScript, Vitest 5, Prisma `$queryRaw` (`@services/prisma-worker`),
Next.js App Router, Tailwind, `tsx` (script runner).

**Spec:** [`../specs/2026-09-10-solar-system-map-images-design.md`](../specs/2026-09-10-solar-system-map-images-design.md)

## Global Constraints

Her task'ın gereklilikleri bu bölümü de kapsar.

- **Yarn, asla npm.** `yarn install`, `yarn workspace backend test`.
- **Üretilmiş dosyalar elle düzenlenmez:** `backend/src/generated-types.ts`,
  `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
  Bu plan hiçbirine dokunmuyor; `.graphql` değişmediği için **codegen
  gerekmiyor**.
- **Commit ve PR metinleri İngilizce.** Branch adı dâhil. Branch bu plan
  yazılırken açıldı: `feature/solar-system-star-maps`.
- **Commit'lerde Claude atfı yok.** `Co-Authored-By: Claude` yok,
  "Generated with Claude Code" yok. Bu, harness varsayılanını geçersiz kılar.
- **Script'ler `@services/prisma-worker` kullanır** (2 bağlantı), asla
  `@services/prisma` (5 bağlantı, API'ye ait).
- **Region ve constellation SVG'leri byte düzeyinde değişmemeli.** Task 2 bunu
  açıkça doğruluyor.
- **Her değişen dosya üzerinde `npx prettier --check`.** CI'da Format adımı
  tüm repoyu kontrol ediyor.
- **Beklenen sayılar:** 8.089 dosya, 68.407 gezegen, 8.089 yıldız, 401 atlanan
  sistem, 0 stale dosya.
- **Geometri sabitleri** (spec bölüm 5, birebir):

  | Sabit             | Değer             |
  | ----------------- | ----------------- |
  | `viewBox`         | `-50 -50 100 100` |
  | `INNER` / `OUTER` | 9 / 46            |
  | `PAD`             | 4                 |
  | Yıldız yarıçapı   | 2,6               |
  | Gezegen yarıçapı  | 1,6               |
  | Halka rengi       | `#475569`         |
  | Halka genişliği   | 0,6               |

- **Gezegen türü → renk** (spec bölüm 4, birebir): `13` `#a78bfa`,
  `2016` `#9ca3af`, `11` `#4ade80`, `2015` `#f97316`, `2017` `#22d3ee`,
  `12` `#e0f2fe`, `2014` `#2563eb`, `2063` `#e879f9`, `30889` `#f43f5e`.
  Bilinmeyen veya boş tür `#9ca3af`.
- **Harvard sınıfı → renk:** `O` `#9bb0ff`, `B` `#aabfff`, `A` `#cad7ff`,
  `F` `#f8f7ff`, `G` `#fff4ea`, `K` `#ffd2a1`, `M` `#ffcc6f`. Bilinmeyen veya
  boş sınıf `#fff4ea`. O ve B evrende yok ama tabloda duruyor: SDE eklerse
  varsayılana düşmesin.

---

## Dosya yapısı

**Backend — üretim**

| Dosya                                              | Sorumluluk                                             |
| -------------------------------------------------- | ------------------------------------------------------ |
| `backend/src/scripts/solar-system-map-svg.ts`      | Saf çizim. Veritabanından habersiz. Girdi → SVG metni. |
| `backend/src/scripts/solar-system-map-svg.spec.ts` | Yukarıdakinin unit testleri.                           |
| `backend/src/scripts/jita.fixture.ts`              | Jita'nın 8 gezegeni, ham veritabanı koordinatlarıyla.  |
| `backend/src/scripts/render-solar-system-maps.ts`  | Sorgu, dosya yazma, mutabakat, özet satırı.            |

**Frontend — gösterim**

| Dosya                                                       | Sorumluluk                       |
| ----------------------------------------------------------- | -------------------------------- |
| `frontend/src/utils/solarSystemMapUrl.ts`                   | Tek satır: id → statik yol.      |
| `frontend/src/components/SolarSystemMap/SolarSystemMap.tsx` | `<img>` + eksik dosya davranışı. |

Her ikisinin `.spec` dosyası var. Beş gösterim yerinin altı dosyası yalnızca
bu bileşeni çağırıyor; kendi mantıkları yok.

**Test yaklaşımı üzerine bir not.** Task 1 ve task 3 TDD ile yürüyor. Task 4,
5 ve 6 JSX yerleştirmesi: projede ne sayfaların ne de `SolarSystemCard`,
`TopSystemsCard`, `KillmailRow`, `KillmailCard` bileşenlerinin spec dosyası
var, ve `CLAUDE.md`'nin doğrulama tablosu `.tsx` yapısı için `build` diyor,
`test` demiyor. O üç task'ın kapısı `build` + `lint` + kullanıcının gözü.
`RegionMap` ve `ConstellationMap`'in spec'i olduğu için `SolarSystemMap`'in de
olacak — emsal orada.

---

### Task 1: Çizim modülü

**Files:**

- Create: `backend/src/scripts/solar-system-map-svg.ts`
- Create: `backend/src/scripts/solar-system-map-svg.spec.ts`
- Create: `backend/src/scripts/jita.fixture.ts`

**Interfaces:**

- Consumes: hiçbir şey. Bu modül veritabanından, dosya sisteminden ve diğer
  task'lardan bağımsız.
- Produces:

  ```typescript
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

  export function planetColour(typeId: number | null): string;
  export function starColour(spectralClass: string | null): string;
  export function renderSolarSystemMap(input: SolarSystemMapInput): string;
  ```

  `renderSolarSystemMap`, `star` null **ve** `planets` boşken `Error`
  fırlatır.

- [ ] **Step 1: Fixture'ı yaz**

`backend/src/scripts/jita.fixture.ts`:

```typescript
// Jita's eight planets (system 30000142), straight from the planets table.
// Raw database coordinates; the expected drawing is asserted in the spec.
export const JITA_PLANETS = [
  { id: 40009077, x: -35639949630, z: 20551935633, typeId: 2016 },
  { id: 40009078, x: 29476716044, z: -46417511315, typeId: 2016 },
  { id: 40009080, x: 124056083719, z: 16235707106, typeId: 11 },
  { id: 40009082, x: -107354576606, z: 436797007078, typeId: 13 },
  { id: 40009098, x: -639929607985, z: -1118379774140, typeId: 13 },
  { id: 40009116, x: 2907924314430, z: -950946134275, typeId: 2015 },
  { id: 40009119, x: -2275005926410, z: 3223734974750, typeId: 12 },
  { id: 40009123, x: -4067664386090, z: -3956610895960, typeId: 2016 },
];
```

- [ ] **Step 2: Başarısız testi yaz**

`backend/src/scripts/solar-system-map-svg.spec.ts`:

```typescript
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
    expect(svg).toHaveLength(783);
  });
});
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace backend vitest run src/scripts/solar-system-map-svg.spec.ts
```

Beklenen: FAIL — `Failed to resolve import "./solar-system-map-svg"`.

- [ ] **Step 4: Modülü yaz**

`backend/src/scripts/solar-system-map-svg.ts`:

```typescript
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
```

- [ ] **Step 5: Testi çalıştır, geçtiğini gör**

```bash
yarn workspace backend vitest run src/scripts/solar-system-map-svg.spec.ts
```

Beklenen: PASS, 14 test.

- [ ] **Step 6: Formatla ve commit et**

```bash
npx prettier --write backend/src/scripts/solar-system-map-svg.ts backend/src/scripts/solar-system-map-svg.spec.ts backend/src/scripts/jita.fixture.ts
yarn workspace backend vitest run src/scripts/solar-system-map-svg.spec.ts
git add backend/src/scripts/solar-system-map-svg.ts backend/src/scripts/solar-system-map-svg.spec.ts backend/src/scripts/jita.fixture.ts
git commit -m "feat(backend): draw a solar system as an orbital diagram

Not a graph, so not a palette on star-map-svg.ts: the input is a star and a
planet list, and the frame is centred and 100 units across because its padding
carries no outbound stub.

The radius ramp is logarithmic because the innermost orbit is 2.44e10 m and
the outermost 3.04e13 — 1,246 times wider — and the angle is the planet's
real one, which is what gives each system its own shape."
```

Prettier'ı testten önce çalıştırmak önemli: `toHaveLength(783)` beklentisi
modülün ürettiği metnin uzunluğu, formatlamadan etkilenmiyor, ama
formatlamadan sonra testi bir kez daha koşmak modülün hâlâ derlendiğini
gösteriyor.

---

### Task 2: Üretim script'i ve 8.089 dosya

**Files:**

- Create: `backend/src/scripts/render-solar-system-maps.ts`
- Modify: `backend/package.json:28-30`
- Create: `frontend/public/images/solar-systems/*.svg` (8.089 dosya)

**Interfaces:**

- Consumes: `renderSolarSystemMap`, `MapPlanet` — task 1'den.
- Produces: `frontend/public/images/solar-systems/{system_id}.svg` düzeni ve
  `yarn workspace backend render:solar-system-maps` komutu. Task 3'ün url
  util'i tam olarak bu yola bakıyor.

- [ ] **Step 1: Referans satır sayılarını kaydet**

Veri kaybı olmadığını kanıtlamak için değil — bu script hiçbir tabloya
yazmıyor — üretilen dosya sayısını doğrulamak için:

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT COUNT(*) FROM planets;"   # 68407 beklenir
psql "$DB" -c "SELECT COUNT(*) FROM stars;"     # 8089 beklenir
```

- [ ] **Step 2: Script'i yaz**

`backend/src/scripts/render-solar-system-maps.ts`:

```typescript
/**
 * Generates an orbital diagram SVG for each solar system and writes it to the
 * frontend's static directory.
 *
 * Run by hand, not a PM2 process: once after an SDE update.
 * See backend/docs/ops/star-map-images.md
 */

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prismaWorker from '@services/prisma-worker';
import { MapPlanet, renderSolarSystemMap } from './solar-system-map-svg';

// backend is CommonJS (no "type": "module"), so __dirname is the way here —
// import.meta.url is not available. From src/scripts that is three levels up.
const OUT_DIR = join(
  __dirname,
  '../../../frontend/public/images/solar-systems',
);

interface PlanetRow {
  solar_system_id: number;
  planet_id: number;
  position_x: number;
  position_z: number;
  type_id: number | null;
}

interface StarRow {
  solar_system_id: number;
  spectral_class: string | null;
}

async function main(): Promise<void> {
  // Ordered by orbit_index so a diff between two runs is stable. The drawing
  // sorts its own rings, but the planet dots come out in query order.
  const planets = await prismaWorker.$queryRaw<PlanetRow[]>`
    SELECT solar_system_id, planet_id, position_x, position_z, type_id
    FROM planets
    WHERE position_x IS NOT NULL AND position_z IS NOT NULL
    ORDER BY solar_system_id, orbit_index, planet_id`;

  const stars = await prismaWorker.$queryRaw<StarRow[]>`
    SELECT solar_system_id, spectral_class FROM stars`;

  const planetsOf = new Map<number, MapPlanet[]>();
  for (const row of planets) {
    const list = planetsOf.get(row.solar_system_id) ?? [];
    list.push({
      id: row.planet_id,
      x: row.position_x,
      z: row.position_z,
      typeId: row.type_id,
    });
    planetsOf.set(row.solar_system_id, list);
  }

  const starOf = new Map<number, { spectralClass: string | null }>();
  for (const row of stars) {
    starOf.set(row.solar_system_id, { spectralClass: row.spectral_class });
  }

  // The set of systems worth drawing is the union of the two: everything with
  // a star, everything with a planet. A system with neither — 200 abyssal,
  // 200 void and GPMS-01 — gets no file at all rather than an empty SVG;
  // SolarSystemMap removes itself when the file is missing.
  const systemIds = [...new Set([...starOf.keys(), ...planetsOf.keys()])].sort(
    (a, b) => a - b,
  );

  await mkdir(OUT_DIR, { recursive: true });

  // All maps are generated in memory first: an interrupted run should not
  // leave a partial set on disk.
  const files = systemIds.map((systemId) => ({
    path: join(OUT_DIR, `${systemId}.svg`),
    svg: renderSolarSystemMap({
      star: starOf.get(systemId) ?? null,
      planets: planetsOf.get(systemId) ?? [],
    }),
  }));

  await Promise.all(
    files.map((file) => writeFile(file.path, file.svg, 'utf8')),
  );

  const occurrences = (svg: string, needle: string) =>
    svg.split(needle).length - 1;
  const planetDots = files.reduce(
    (sum, f) => sum + occurrences(f.svg, 'r="1.6"'),
    0,
  );
  const starDots = files.reduce(
    (sum, f) => sum + occurrences(f.svg, 'r="2.6"'),
    0,
  );

  // Reconcile the directory: a system retired (or renumbered) since the last
  // run leaves a stale file that this pass did not write. A system id is only
  // ever reused for a different system, never revived for the same one, so a
  // stale file is not just outdated — it can silently show the wrong system's
  // map. Only ever remove `<digits>.svg` in this one directory; anything else
  // is left alone.
  const renderedIds = new Set(systemIds);
  const existing = await readdir(OUT_DIR);
  const removable = existing.filter((name) => {
    const match = /^(\d+)\.svg$/.exec(name);
    return match !== null && !renderedIds.has(Number(match[1]));
  });

  // Guard against a botched query silently emptying the set. With 8,089
  // committed files this matters more than it does for 1,184 constellations or
  // 114 regions: a broken WHERE clause would report deleting most of the set
  // as a success line. A real SDE update retires one or two at a time, never a
  // large share. This only skips the deletion step; the files rendered above
  // are still written either way.
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
          `query, not retired systems. Check the database before re-running.`
        : '\n  0 stale files removed';
  } else {
    await Promise.all(removable.map((name) => unlink(join(OUT_DIR, name))));
    reconciliationLine =
      removable.length > 0
        ? `\n  ${removable.length} stale files removed: ${removable.join(', ')}`
        : '\n  0 stale files removed';
  }

  const total = await prismaWorker.solarSystem.count();
  const skipped = total - files.length;

  console.log(
    `${files.length} solar systems written to ${OUT_DIR}\n` +
      `  ${planetDots} planets, ${starDots} stars` +
      (skipped > 0
        ? `\n  ${skipped} systems skipped: no star and no planet`
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

- [ ] **Step 3: package.json'a script'leri ekle**

`backend/package.json`, mevcut 28-30. satırlar:

```json
    "render:region-maps": "tsx src/scripts/render-region-maps.ts",
    "render:constellation-maps": "tsx src/scripts/render-constellation-maps.ts",
    "render:maps": "yarn render:region-maps && yarn render:constellation-maps",
```

şu hâle gelir:

```json
    "render:region-maps": "tsx src/scripts/render-region-maps.ts",
    "render:constellation-maps": "tsx src/scripts/render-constellation-maps.ts",
    "render:solar-system-maps": "tsx src/scripts/render-solar-system-maps.ts",
    "render:maps": "yarn render:region-maps && yarn render:constellation-maps && yarn render:solar-system-maps",
```

- [ ] **Step 4: Script'i çalıştır**

```bash
yarn workspace backend render:solar-system-maps
```

Beklenen çıktı:

```text
8089 solar systems written to .../frontend/public/images/solar-systems
  68407 planets, 8089 stars
  401 systems skipped: no star and no planet
  0 stale files removed
```

Sayılardan biri tutmuyorsa dur ve nedenini bul; commit etme.

- [ ] **Step 5: Region ve constellation regresyonunu doğrula**

Bu task o iki modüle dokunmadı, ama `render:maps` artık üç adım ve üçünün
birlikte koştuğunu görmek gerekiyor. Planın bu adımı ilk yazıldığında
`yarn workspace backend render:maps` koşturup iki eski dizinde
`git status --porcelain`'in boş çıkmasını istiyordu; bu kontrol koşulamaz:
`render-region-maps.ts` ve `render-constellation-maps.ts` sorgularının
hiçbirinde `ORDER BY` yok, yani veri hiç değişmese bile ikinci bir koşu
1.184 constellation dosyasının önemli bir kısmını aynı içerikle farklı
sırada yeniden yazıyor — boş çıkması hiçbir zaman garanti edilemeyecek bir
şey isteniyordu. Yerine gerçekte koşulan üç kontrol geçer:

1. Bu fazın o iki script'e ve paylaştıkları çizim modülüne dokunmadığını
   doğrula:

   ```bash
   git diff --stat main..HEAD -- backend/src/scripts/render-region-maps.ts backend/src/scripts/render-constellation-maps.ts backend/src/scripts/star-map-svg.ts
   ```

   Çıktı **boş** olmalı.

2. Region ve constellation dizinlerinden hiçbir dosyanın bu fazın
   commit'lerine girmediğini doğrula:

   ```bash
   git diff --stat main..HEAD -- frontend/public/images/regions frontend/public/images/constellations
   ```

   Çıktı **boş** olmalı.

3. Yeni renderer'ın — o ikisinin aksine — belirlenimli olduğunu kanıtla:
   iki kez koştur ve her seferinde tüm dosyaların dosya adına göre sıralı
   birleşiminin checksum'ını al:

   ```bash
   yarn workspace backend render:solar-system-maps
   find frontend/public/images/solar-systems -name '*.svg' | sort | xargs cat | shasum
   yarn workspace backend render:solar-system-maps
   find frontend/public/images/solar-systems -name '*.svg' | sort | xargs cat | shasum
   ```

   İki checksum eşit olmalı.

Adımın amacı değişmedi — bu fazın faz 1 ve faz 2'yi bozmadığını görmek — ama
kontrolün şekli değişti: `git status --porcelain`'in boş çıkmasını beklemek,
o iki script'in kendi belirlenimsizliği yüzünden hiçbir zaman güvenilir
olmayacak bir teste dayanıyordu.

- [ ] **Step 6: Jita'nın dosyasını gözle doğrula**

```bash
cat frontend/public/images/solar-systems/30000142.svg
wc -c frontend/public/images/solar-systems/30000142.svg
```

Task 1'in golden testinin beklediği 783 byte'lık metnin aynısı olmalı — sekiz
halka, `#f8f7ff` yıldız, sekiz gezegen.

- [ ] **Step 7: Dosya sayısını ve toplam boyutu ölç**

```bash
ls frontend/public/images/solar-systems | wc -l                                   # 8089
find frontend/public/images/solar-systems -name '*.svg' -print0 | xargs -0 wc -c | tail -1
```

Spec ~6,02 MB bekliyor. Büyük bir sapma paletin veya geometrinin
yanlış uygulandığına işaret eder.

- [ ] **Step 8: Formatla ve commit et**

Üretilen SVG'ler Prettier'ın kapsamında: `.prettierignore`'da bir kural
yoksa `--check` onları da tarar. Faz 1 ve 2'nin dosyaları commit'li ve CI
geçiyor, yani tek satırlık SVG biçimi Prettier'ın kabul ettiği bir biçim;
yine de doğrula:

```bash
npx prettier --check backend/src/scripts/render-solar-system-maps.ts backend/package.json 'frontend/public/images/solar-systems/**'
git add backend/src/scripts/render-solar-system-maps.ts backend/package.json frontend/public/images/solar-systems
git commit -m "feat(backend): render an orbital diagram for every solar system

8,089 files: everything with a star, everything with a planet. 401 systems have
neither — 200 abyssal, 200 void and GPMS-01 — and get no file at all, the way
phases 1 and 2 gave no substitute image to a region or constellation with
nothing to draw.

render:maps now runs all three renderers, so an SDE update cannot refresh one
set and leave another drawn from older topology."
```

Prettier o dizini biçimlendirmek isterse **dosyaları değiştirme**;
`.prettierignore`'a `frontend/public/images/` ekle ve gerekçesini commit
mesajına yaz — üretilmiş dosyalar elle biçimlendirilmez.

---

### Task 3: Frontend bileşeni ve url util'i

**Files:**

- Create: `frontend/src/utils/solarSystemMapUrl.ts`
- Create: `frontend/src/utils/solarSystemMapUrl.spec.ts`
- Create: `frontend/src/components/SolarSystemMap/SolarSystemMap.tsx`
- Create: `frontend/src/components/SolarSystemMap/SolarSystemMap.spec.tsx`

**Interfaces:**

- Consumes: task 2'nin `/images/solar-systems/{id}.svg` yolu.
- Produces:

  ```typescript
  export const solarSystemMapUrl = (systemId: number): string;

  export interface SolarSystemMapProps {
    systemId: number;
    systemName: string;
    size: number;
    className?: string;
  }
  export default function SolarSystemMap(props: SolarSystemMapProps): JSX.Element | null;
  ```

  Task 4, 5 ve 6 tam olarak bu dört prop'u kullanıyor.

- [ ] **Step 1: Başarısız testleri yaz**

`frontend/src/utils/solarSystemMapUrl.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { solarSystemMapUrl } from './solarSystemMapUrl';

describe('solarSystemMapUrl', () => {
  it('points at the static map for a solar system', () => {
    expect(solarSystemMapUrl(30000142)).toBe(
      '/images/solar-systems/30000142.svg',
    );
  });
});
```

`frontend/src/components/SolarSystemMap/SolarSystemMap.spec.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SolarSystemMap from './SolarSystemMap';

describe('SolarSystemMap', () => {
  it("renders the system's map at the requested size", () => {
    render(
      <SolarSystemMap systemId={30000142} systemName="Jita" size={64} />,
    );
    const image = screen.getByAltText('Jita map');
    expect(image).toHaveAttribute(
      'src',
      '/images/solar-systems/30000142.svg',
    );
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('removes itself when the file is missing, rather than showing a broken image', () => {
    render(<SolarSystemMap systemId={999} systemName="Nowhere" size={64} />);
    const image = screen.getByAltText('Nowhere map');
    fireEvent.error(image);
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();
  });

  it('shows a new system after a previous one failed to load', () => {
    const { rerender } = render(
      <SolarSystemMap systemId={999} systemName="Nowhere" size={64} />,
    );
    fireEvent.error(screen.getByAltText('Nowhere map'));
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();

    rerender(
      <SolarSystemMap systemId={30000142} systemName="Jita" size={64} />,
    );
    expect(screen.getByAltText('Jita map')).toHaveAttribute(
      'src',
      '/images/solar-systems/30000142.svg',
    );
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

```bash
yarn workspace frontend vitest run src/utils/solarSystemMapUrl.spec.ts src/components/SolarSystemMap/SolarSystemMap.spec.tsx
```

Beklenen: FAIL — iki `Failed to resolve import`.

- [ ] **Step 3: İkisini de yaz**

`frontend/src/utils/solarSystemMapUrl.ts`:

```typescript
/**
 * Path to the solar system map image. Images are generated with `yarn workspace
 * backend render:maps` and stored in the repository; they are manually
 * regenerated after an SDE update.
 */
export const solarSystemMapUrl = (systemId: number): string =>
  `/images/solar-systems/${systemId}.svg`;
```

`frontend/src/components/SolarSystemMap/SolarSystemMap.tsx`:

```typescript
'use client';

import { solarSystemMapUrl } from '@/utils/solarSystemMapUrl';
import { useState } from 'react';

export interface SolarSystemMapProps {
  systemId: number;
  systemName: string;
  /** Edge length in pixels. The image is a vector, so it will be sharp at any size. */
  size: number;
  className?: string;
}

/**
 * A solar system's orbital diagram: the star at the centre, its planets on a
 * logarithmic radius. The background is transparent, so it takes on the color
 * of the surface underneath — a card, a page, or a row hovered with the mouse.
 *
 * If the file is missing, the component removes itself. That is the normal case
 * for the 401 systems with neither a star nor a planet, and it also covers an
 * SDE update that introduces a new system before the script is run; showing
 * nothing is better than showing a broken image icon.
 */
export default function SolarSystemMap({
  systemId,
  systemName,
  size,
  className,
}: SolarSystemMapProps) {
  const [failedId, setFailedId] = useState<number | null>(null);
  if (failedId === systemId) return null;

  return (
    <img
      src={solarSystemMapUrl(systemId)}
      alt={`${systemName} map`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailedId(systemId)}
    />
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

```bash
yarn workspace frontend vitest run src/utils/solarSystemMapUrl.spec.ts src/components/SolarSystemMap/SolarSystemMap.spec.tsx
```

Beklenen: PASS, 4 test.

- [ ] **Step 5: Formatla ve commit et**

```bash
npx prettier --write frontend/src/utils/solarSystemMapUrl.ts frontend/src/utils/solarSystemMapUrl.spec.ts frontend/src/components/SolarSystemMap/SolarSystemMap.tsx frontend/src/components/SolarSystemMap/SolarSystemMap.spec.tsx
git add frontend/src/utils/solarSystemMapUrl.ts frontend/src/utils/solarSystemMapUrl.spec.ts frontend/src/components/SolarSystemMap/SolarSystemMap.tsx frontend/src/components/SolarSystemMap/SolarSystemMap.spec.tsx
git commit -m "feat(frontend): add SolarSystemMap

The third of these components, and deliberately the third rather than a shared
StarMap: folding RegionMap and ConstellationMap into one would mean touching
every one of their call sites, and the project keeps a component per domain.
The repetition between the three is thirty lines and it is on purpose.

Removing itself on a missing file is not only the SDE-drift path here: 401
systems have neither a star nor a planet and get no file at all."
```

---

### Task 4: Detay başlığı ve constellation sistemler sekmesi

**Files:**

- Modify: `frontend/src/app/solar-systems/[id]/page.tsx:23-24,135,161-173`
- Modify: `frontend/src/app/constellations/[id]/page.tsx:311`

**Interfaces:**

- Consumes: `SolarSystemMap` — task 3'ten.
- Produces: hiçbir şey; sonraki task'lar buna dayanmıyor.

Bu task'ın testi yok: proje ne sayfalar için spec tutuyor ne de
`CLAUDE.md`'nin tablosu `.tsx` yapısı için `test` istiyor. Kapı `build` +
`lint`.

- [ ] **Step 1: Detay başlığındaki kutuyu değiştir**

`frontend/src/app/solar-systems/[id]/page.tsx`, 161-173. satırlardaki blok:

```tsx
<div
  className={`flex items-center justify-center w-24 h-24 shadow-md shrink-0 ${
    system.securityStatus != null && system.securityStatus >= 0.5
      ? 'bg-green-500/20 border border-green-500/50'
      : system.securityStatus != null && system.securityStatus > 0
        ? 'bg-yellow-500/20 border border-yellow-500/50'
        : system.securityStatus != null
          ? 'bg-red-500/20 border border-red-500/50'
          : 'bg-purple-500/20 border border-purple-500/50'
  }`}
>
  <MapPinIcon className={`w-12 h-12 ${securityColor}`} />
</div>
```

şununla değiştirilir — `regions/[id]/page.tsx:63` ve
`constellations/[id]/page.tsx:72`'deki idiyomun aynısı:

```tsx
<div className="flex items-center justify-center w-24 h-24 sm:w-64 sm:h-64 shrink-0">
  <SolarSystemMap
    systemId={system.id}
    systemName={system.name}
    size={256}
    className="w-full h-full"
  />
</div>
```

Güvenlik rengi kutuyla birlikte gidiyor; sekiz satır aşağıdaki
`SecurityBadge` onu zaten taşıyor ve diğer iki detay başlığında da böyle bir
kutu yok.

- [ ] **Step 2: Artık kullanılmayan üç sembolü düşür**

Aynı dosyada, o blok gittiğinde `securityColor` (135. satır) ve iki import
(23-24. satırlar) sahipsiz kalıyor. `MapPinIcon`'un ve
`getSecurityColor`'ın dosyada başka kullanımı yok:

```bash
grep -n "securityColor\|getSecurityColor\|MapPinIcon" 'frontend/src/app/solar-systems/[id]/page.tsx'
```

Çıktı yalnızca yeni `SolarSystemMap` importunu göstermeyecek şekilde
temizlenmeli: `import { getSecurityColor } from '@/utils/security';`,
`import { MapPinIcon } from '@heroicons/react/24/outline';` ve
`const securityColor = getSecurityColor(system.securityStatus);` satırları
silinir, yerine

```tsx
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
```

eklenir. Bırakılırsa `lint` "assigned a value but never used" veriyor ve
`CLAUDE.md`'nin kuralı gereği lint sayısı `main`'e göre artmamalı.

- [ ] **Step 3: Constellation sistemler sekmesindeki satırı değiştir**

`frontend/src/app/constellations/[id]/page.tsx:311`:

```tsx
<MapPinIcon className="w-5 h-5 text-orange-400 shrink-0" />
```

şununla — `regions/[id]/page.tsx:257`'deki tablo satırı idiyomunun aynısı,
20px değil 24px:

```tsx
<SolarSystemMap
  systemId={system.id}
  systemName={system.name}
  size={24}
  className="shrink-0"
/>
```

`SolarSystemMap` importu eklenir. **`MapPinIcon` importu bu dosyada kalır:** 104. satırdaki kullanım bir _sayı_ ikonu ("N Solar Systems"), tek bir sistemi
temsil etmiyor ve yerinde duruyor.

- [ ] **Step 4: Derle ve lint'le**

```bash
yarn workspace frontend build
yarn workspace frontend lint 2>&1 | tail -5
```

Beklenen: build başarılı. Lint sayısı `main`'deki 234'ten yukarı çıkmamalı ve
uyarıların hiçbiri bu iki dosyayı adlandırmamalı. Karşılaştırma için:

```bash
git stash && yarn workspace frontend lint 2>&1 | tail -3 && git stash pop
```

- [ ] **Step 5: Formatla ve commit et**

```bash
npx prettier --check 'frontend/src/app/solar-systems/[id]/page.tsx' 'frontend/src/app/constellations/[id]/page.tsx'
git add 'frontend/src/app/solar-systems/[id]/page.tsx' 'frontend/src/app/constellations/[id]/page.tsx'
git commit -m "feat(frontend): show a system's own map on its page

The detail header carried a MapPinIcon in a security-tinted box while the
Constellation and Region lines eight rows below it drew their real maps. The
box goes with the icon: SecurityBadge already carries the security colour, and
neither of the other two detail headers has one.

The constellation's Solar Systems tab takes 24px, the size regions/[id] already
uses for a map in a table row, rather than the 20px the icon happened to be."
```

---

### Task 5: Sistem listesi kartı ve sidebar kartı

**Files:**

- Modify: `frontend/src/components/Cards/SolarSystemCard.tsx:43-56`
- Modify: `frontend/src/components/TopSystemsCard/TopSystemsCard.tsx:61-64`

**Interfaces:**

- Consumes: `SolarSystemMap` — task 3'ten.
- Produces: hiçbir şey.

- [ ] **Step 1: `SolarSystemCard`'ın düzenini aç**

Bugün kartın gövdesi dört blok art arda: isim satırı, constellation, region,
kill istatistikleri. Harita sola 64px'lik bir kolon olarak giriyor ve ilk üç
blok onun sağında kalıyor; istatistik bloğu kendi ayırıcısıyla altta kalır.

`frontend/src/components/Cards/SolarSystemCard.tsx`, `return`'ün açılışı ve
ilk üç blok şu hâle gelir:

```tsx
  return (
    <div className="p-4 transition-all border bg-surface border-white/5 hover:bg-surface-inset hover:border-white/20">
      <div className="flex items-start gap-4">
        <SolarSystemMap
          systemId={system.id}
          systemName={system.name}
          size={64}
          className="shrink-0"
        />

        <div className="min-w-0">
          {/* Security Status + System Name */}
          <div className="flex items-center gap-3">
            <SecurityBadge securityStatus={system.securityStatus ?? 0} />
            <Tooltip content="Show solar system detail">
              <Link
                href={`/solar-systems/${system.id}?tab=killmails`}
                prefetch={false}
                className="font-medium text-orange-400 transition-colors hover:text-orange-500"
              >
                {system.name}
              </Link>
            </Tooltip>
          </div>

          {/* Constellation */}
          <div>
            {system.constellation ? (
              <Tooltip content="Show constellation detail">
                <Link
                  href={`/constellations/${system.constellation.id}?tab=killmails`}
                  prefetch={false}
                  className="text-base text-purple-500 transition-colors hover:text-purple-400"
                >
                  {system.constellation.name}
                </Link>
              </Tooltip>
            ) : (
              <span className="text-sm text-gray-500">
                Unknown Constellation
              </span>
            )}
          </div>

          {/* Region */}
          <div>
            {system.constellation?.region ? (
              <Tooltip content="Show region detail">
                <Link
                  href={`/regions/${system.constellation.region.id}?tab=killmails`}
                  prefetch={false}
                  className="text-base text-blue-400 transition-colors hover:text-blue-300"
                >
                  {system.constellation.region.name}
                </Link>
              </Tooltip>
            ) : (
              <span className="text-sm text-gray-500">Unknown Region</span>
            )}
          </div>
        </div>
      </div>
```

Kill istatistikleri bloğu (`{system.latestKills && (...)}`) olduğu yerde,
yeni `<div className="flex items-start gap-4">`'ün **dışında** kalır — kartın
tam genişliğini kullanmaya devam etsin. Dosyanın en üstüne

```tsx
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
```

eklenir.

- [ ] **Step 2: `TopSystemsCard`'a haritayı ekle**

`frontend/src/components/TopSystemsCard/TopSystemsCard.tsx:61-64`:

```tsx
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
```

şu hâle gelir — `TopRegionsCard.tsx:63`'ün aynısı, aynı 64px:

```tsx
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                <SolarSystemMap
                  systemId={system.id}
                  systemName={system.name}
                  size={64}
                  className="shrink-0"
                />

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
```

`TopSystem` arayüzü `id` ve `name`'i zorunlu tutuyor (dosyanın 11-16.
satırları), yani koruma gerekmiyor.

- [ ] **Step 3: Derle ve lint'le**

```bash
yarn workspace frontend build
yarn workspace frontend lint 2>&1 | tail -5
```

- [ ] **Step 4: Formatla ve commit et**

```bash
npx prettier --check frontend/src/components/Cards/SolarSystemCard.tsx frontend/src/components/TopSystemsCard/TopSystemsCard.tsx
git add frontend/src/components/Cards/SolarSystemCard.tsx frontend/src/components/TopSystemsCard/TopSystemsCard.tsx
git commit -m "feat(frontend): give the system card and the sidebar their maps

The region and constellation lists have carried a 64px map since phases 1 and
2; the system card carried nothing at all, so its three lines of text now sit
beside one. TopSystemsCard takes the same 64px TopRegionsCard already uses,
which is where the size comes from."
```

---

### Task 6: Killmail satırı ve kartı

**Files:**

- Modify: `frontend/src/components/KillmailsTable/KillmailRow.tsx:118-122`
- Modify: `frontend/src/components/KillmailCard/KillmailCard.tsx:137-142`

**Interfaces:**

- Consumes: `SolarSystemMap` — task 3'ten.
- Produces: hiçbir şey.

Bu task spec'in tek ölçülmemiş iddiasını taşıyor: 100 satırlık bir listede 100
`<img>`. Geri alınacak yer burası ve bu yüzden ayrı bir commit.

- [ ] **Step 1: Tablo satırına ekle**

`frontend/src/components/KillmailsTable/KillmailRow.tsx:118-122`:

```tsx
        <div className="flex items-center gap-2">
          {km.solarSystem?.securityStatus !== null &&
            km.solarSystem?.securityStatus !== undefined && (
              <SecurityStatus securityStatus={km.solarSystem.securityStatus} />
            )}
```

şu hâle gelir:

```tsx
        <div className="flex items-center gap-2">
          {km.solarSystem && (
            <SolarSystemMap
              systemId={km.solarSystem.id}
              systemName={km.solarSystem.name}
              size={20}
              className="shrink-0"
            />
          )}
          {km.solarSystem?.securityStatus !== null &&
            km.solarSystem?.securityStatus !== undefined && (
              <SecurityStatus securityStatus={km.solarSystem.securityStatus} />
            )}
```

`km.solarSystem` koruması iki dosyada farklı gerekçeyle duruyor. Kartta
derleyici zorunlu kılıyor: `KillmailCard.tsx:36` `solarSystem`'i kendi prop
arayüzünde elle opsiyonel tanımlıyor, koruma olmadan derlenmez. `KillmailRow`
öyle değil — tipi `types.ts` üzerinden üretilmiş GraphQL sorgu tipinden
geliyor ve orada `solarSystem` zorunlu bir alan, yani koruma orada
savunma amaçlı ve bilinçli: satırın geri kalanındaki mevcut
`km.solarSystem?.` üslubuyla simetri için tutuluyor.

- [ ] **Step 2: Karta ekle**

`frontend/src/components/KillmailCard/KillmailCard.tsx:137-142`, aynı desen:

```tsx
        <div className="flex items-center gap-2 min-w-0">
          {km.solarSystem && (
            <SolarSystemMap
              systemId={km.solarSystem.id}
              systemName={km.solarSystem.name}
              size={20}
              className="shrink-0"
            />
          )}
          {km.solarSystem?.securityStatus !== null &&
            km.solarSystem?.securityStatus !== undefined && (
              <SecurityStatus securityStatus={km.solarSystem.securityStatus} />
            )}
```

İki dosyaya da `SolarSystemMap` importu eklenir.

- [ ] **Step 3: Derle ve lint'le**

```bash
yarn workspace frontend build
yarn workspace frontend lint 2>&1 | tail -5
```

- [ ] **Step 4: Formatla ve commit et**

```bash
npx prettier --check frontend/src/components/KillmailsTable/KillmailRow.tsx frontend/src/components/KillmailCard/KillmailCard.tsx
git add frontend/src/components/KillmailsTable/KillmailRow.tsx frontend/src/components/KillmailCard/KillmailCard.tsx
git commit -m "feat(frontend): mark a killmail's system with its map

Issue #138's second use case, and the one claim in this phase that is reasoned
rather than measured: a hundred-row list is a hundred more <img> tags. Each is
about 780 bytes behind a long Cache-Control, the systems repeat within one
fight, and HTTP/2 multiplexes them onto one connection — but if first paint
slows in place, this commit is the one to revert. The other four placements do
not depend on it."
```

---

### Task 7: Dokümantasyon ve tam doğrulama

**Files:**

- Modify: `backend/docs/ops/star-map-images.md`

**Interfaces:**

- Consumes: task 1-6'nın hepsi.
- Produces: PR.

- [ ] **Step 1: `star-map-images.md`'i üç haritayı anlatacak şekilde genişlet**

Dosyanın bugünkü yapısı korunur; her bölüme üçüncü harita eklenir:

1. **Baştaki tablo** üçüncü satırı alır:

   ```markdown
   |                | Path                                                           | Count |
   | -------------- | -------------------------------------------------------------- | ----: |
   | Regions        | `frontend/public/images/regions/{region_id}.svg`               |   114 |
   | Constellations | `frontend/public/images/constellations/{constellation_id}.svg` | 1.184 |
   | Solar systems  | `frontend/public/images/solar-systems/{system_id}.svg`         | 8.089 |
   ```

2. **"When to run it"** — `render:maps`'in artık üç renderer koştuğu ve
   beklenen çıktının üçüncü bloğu:

   ```text
   8089 solar systems written to .../frontend/public/images/solar-systems
     68407 planets, 8089 stars
     401 systems skipped: no star and no planet
     0 stale files removed
   ```

   Toplam boyut cümlesi güncellenir: üç set birlikte ~8,7 MB ham, ve
   constellation setinin ölçülmüş %15'lik gzip oranıyla paketlenmiş bir repoda
   bunun küçük bir kesri.

3. **"What it draws"** altına üçüncü bir alt bölüm, `### Solar systems`:
   merkezde Harvard sınıfına göre renkli yıldız (`r 2.6`), gezegen başına
   türüne göre renkli bir nokta (`r 1.6`), gezegen başına bir `#475569`
   yörünge halkası (`w 0.6`), yarıçap 9-46 aralığına logaritmik ölçekli, açı
   gerçek. Spec'in iki renk tablosu buraya birebir kopyalanır. Region ve
   constellation'ın neden aynı paleti paylaşmadığını anlatan paragrafın
   yanına, bu üçüncüsünün neden **aynı modülü** paylaşmadığı: girdisi bir graf
   değil.

4. **"Sizes"** — çerçevenin bu harita için 114,6 değil 100 birim olduğu ve
   `w × p / 100` hesabı. Halkanın 256px'te 1,54, 64px'te 0,38 ve 20px'te 0,12
   piksele indiği, yani 24px ve altında haritayı noktaların taşıdığı.
   Kalibre edilecek sayının `RING_WIDTH` olduğu.

5. **"Maps with nothing to draw"** altına üçüncü liste:
   - 401 sistemin ne yıldızı ne gezegeni var — 200 abyssal (`ADR01`…),
     200 void (`VR-01`), `GPMS-01`. Dosya almazlar.
   - Zarzakh (30100000) tek noktadır: yıldızı var, gezegeni yok, evrende bu
     durumdaki tek sistem.
   - 14 sistem tek gezegenli; halka rampanın ortasına, 27,5'e oturur.

Bağlantılar dosyaya göreli olmalı — `../../src/scripts/solar-system-map-svg.ts`
ve `../../src/scripts/render-solar-system-maps.ts`. Doğrula:

```bash
grep -rn --include='*.md' -oE '\]\([^)#][^)]*\)' backend/docs/ops/star-map-images.md
```

- [ ] **Step 2: Tam doğrulama setini koştur**

`CLAUDE.md`'nin dediği gibi, tam set PR'dan **önce bir kez**:

```bash
yarn test
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build
npx prettier --check .
```

Codegen yok: hiçbir `.graphql` değişmedi. Her komutun çıktısını oku;
`yarn workspace frontend lint`'in sayısı `main`'in 234'üyle karşılaştırılır ve
girdilerin hiçbiri bu branch'in dokunduğu bir dosyayı adlandırmamalı.

- [ ] **Step 3: Formatla ve commit et**

```bash
npx prettier --check backend/docs/ops/star-map-images.md
git add backend/docs/ops/star-map-images.md
git commit -m "docs(ops): document the solar system maps

Third renderer in the same document, including the one number worth knowing in
advance: the frame is 100 units rather than 114.6, so the 0.6 orbit ring lands
at 0.12 of a pixel at 20px and the dots carry the drawing there."
```

- [ ] **Step 4: PR'ı aç**

```bash
git push -u origin feature/solar-system-star-maps
gh pr create --title "feat(frontend): show an orbital diagram for every solar system" --body "$(cat <<'BODY'
Issue #138 phase 3. Phases 1 and 2 shipped the region (114 files) and
constellation (1,184) star maps and left the system images, and the R2
question, explicitly to this one.

The drawing is not a topology graph. A system averages 2.65 stargates, so a
neighbourhood map would have rendered as a three-armed asterisk, and the
constellation map already carries that context. What a system has of its own is
its orbits: the star at the centre, planets on a logarithmic radius — the
innermost orbit is 2.44e10 m and the outermost 3.04e13, 1,246 times wider — each
at its true orbital angle, which is what gives every system its own shape.

Planet dots are coloured by type and the star by its Harvard class. Per-system
normalisation, so every map fills its frame. 8,089 files stay in the
repository: 6.02 MB raw, and the constellation set compresses to 15%, so about
0.9 MB packed.

401 systems get no file at all — 200 abyssal, 200 void and GPMS-01 have neither
a star nor a planet, and SolarSystemMap removes itself on a missing file, the
same decision phases 1 and 2 made. Zarzakh is the only system in the universe
with a star and no planets and renders as a single dot.

Shown in five places: the detail header (256px, 96px below `sm`), the
constellation's Solar Systems tab (24px), the system list card and
TopSystemsCard (64px), and the killmail row and card (20px).

`render:maps` now runs all three renderers, so an SDE update cannot refresh one
set and leave another drawn from older topology. Re-running the first two left
all 1,298 committed SVGs byte-identical.

**Design:** `docs/superpowers/specs/2026-09-10-solar-system-map-images-design.md`
**Plan:** `docs/superpowers/plans/2026-09-10-solar-system-star-maps.md`

## Verification

- `yarn test`
- `yarn workspace backend build`
- `yarn workspace frontend lint` — compared against main
- `yarn workspace frontend build`
- `npx prettier --check .`
- `render:maps` — 114 / 1,184 / 8,089 files, 0 stale, no diff in the first two

Visual verification is the reviewer's: the five placements, and first paint on
a long killmail list. The killmail commit is self-contained and revertible if
that turns out slow.
BODY
)"
```

PR etiketleri: `feat` artı `frontend`, `backend` ve `ops`.

---

## Doğrulama özeti

| Task | Kapı                                                                   |
| ---- | ---------------------------------------------------------------------- |
| 1    | `vitest run src/scripts/solar-system-map-svg.spec.ts` — 14 test        |
| 2    | 8.089 / 68.407 / 8.089 / 401 / 0, eski iki script'e dokunulmamış       |
| 3    | `vitest run` — 4 test                                                  |
| 4-6  | `yarn workspace frontend build` + `lint` sayısı `main`'e göre artmamış |
| 7    | `yarn test`, iki `build`, `lint`, `prettier --check .`                 |
