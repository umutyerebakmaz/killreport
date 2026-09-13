# Evren haritasının PixiJS'e taşınması — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main`'deki evren haritasının frontend'ini deck.gl 9.4'ten PixiJS 8'e
taşımak, **görünümü ve davranışı birebir koruyarak.**

**Architecture:** Kamera bir kök `Container`'ın transform'u; pan ve zoom 5.241
nesneye değil tek nesneye dokunuyor. Karar verilecek her şey `utils/map/`'te saf
fonksiyon ve testli; `scene/` yalnızca Pixi nesnesine atama yapıyor ve testsiz.
Sprite'lar float64 kompozisyonu sayesinde ham galaktik metreyi doğrudan
kullanıyor — kayan orijin yalnızca `Graphics` geometrisinde kalıyor.

**Tech Stack:** TypeScript, Next.js App Router + React 19, **PixiJS 8.20.1**,
Apollo Client, Vitest 5. Backend'e dokunulmuyor.

**Spec:** [`../specs/2026-09-13-universe-map-pixi-design.md`](../specs/2026-09-13-universe-map-pixi-design.md)

---

## Global Constraints

- **Yarn, asla npm.** `yarn workspace frontend add pixi.js`.
- **Backend değişmiyor** — şema, servis, resolver, Redis, `.graphql` dokümanı,
  üretilmiş tipler. **Codegen çalıştırılmıyor**, çünkü çalıştırılacak bir
  değişiklik yok.
- **`.env` düzenlenmiyor.** Bu checkout'ta backend `PORT=4010`, frontend `:3000`.
- **Üretilmiş dosyalar elle düzenlenmiyor.**
- **Kabul kriteri:** `/map` ekranda `main`'inkinden farklı görünmüyorsa geçiş
  doğrudur. Spec'in "Aynı görünüm tam olarak ne" tablosu bağlayıcıdır.
- **`lint` kabul kriteri `main`'in sayısı, sıfır fark.** Bu plan yazılırken
  `main` 229.
- Commit ve PR metinleri **İngilizce**, `type(scope):` sonrası küçük harf,
  Claude atıfsız.

---

## Ölçülmüş sabitler

Spec'ten taşınıyor, yeniden ölçülmesin diye:

| Büyüklük                    | Değer                                              |
| --------------------------- | -------------------------------------------------- |
| Counter-scale, 5.241 sprite | maks **0,60 ms** (kullanıcı makinesi, 2026-09-13)  |
| deck.gl izi olan chunk'lar  | 702 KB ham / 197 KB gzip                           |
| pixi.js izi olan chunk'lar  | 704 KB ham / 204 KB gzip                           |
| Gate komşusu / sistem       | maks 8, ortalama 2,65                              |
| (sistem, hedef) çifti       | 13.978, sıfır belirsiz                             |
| Sahneler                    | NEW_EDEN 5241/6959, POCHVEN 27/30, WORMHOLE 2604/0 |

**float32 hakkında:** koordinat **metre** kalıyor. `metre / 1e12` fikri
çürütüldü — float32 göreli hassasiyetlidir, sabit bölme hiçbir şey kazandırmaz.

---

## Spec'in sessiz kaldığı yerler ve verdiğim kararlar

### 1. flipY, Pixi'de nasıl oluyor

deck.gl'de `new OrthographicView({ flipY: false })` tek satırdı. Pixi'nin ekran
y'si aşağı akıyor ve bunu kapatan bir bayrak yok. Karar: **kök container'ın y
ölçeği negatif** — `world.scale.set(scale, -scale)`.

Sonuçları:

- Dairesel sprite'lar simetrik olduğu için ters dönmeleri görünmez.
- **Etiketler bundan etkilenecek** (bu dilimde etiket yok): `BitmapText`'in
  `scale.y`'si kendi içinde bir kez daha negatiflenmeli, yoksa yazı aynada
  görünür. Etiket dilimine devredilen not.
- Pan aritmetiği `y = height / 2 + camera.z * scale` olur; işaret `+`, çünkü
  ölçek zaten negatif.

### 2. Hat kalınlığı: `pixelLine`

deck.gl `widthUnits: 'pixels'` ile 1 px veriyordu. Pixi'de `Graphics` çizgi
kalınlığı yerel birimdedir, yani saf çeviri `width: 1 / scale` olur ve **her
zoom'da 6.959 segmentin yeniden çizilmesi** demektir.

Pixi 8'in `stroke({ pixelLine: true })` seçeneği tam olarak bunu çözüyor
(`node_modules/pixi.js/lib/scene/graphics/shared/FillTypes.d.ts:318`): çizgi
kamera ölçeğinden bağımsız 1 px kalır. Karar: **geometri bir kez kurulur, zoom'da
hiç yeniden çizilmez.**

Doğrulanamazsa (sürücü tuhaflığı, kalınlık desteklenmemesi) geri düşüş,
yeniden çizimi **kova değişimine** bağlamaktır — tekerlek tıkırtısına değil.

### 3. Hangi util gerçekten değişiyor

Kullanıcı "frontend boş sayfa" dedi. Saf ve renderer'dan bağımsız bir fonksiyonu
yeniden yazmak onu birebir aynı üretir, üstelik hata sokma riski taşır. Karar:

| Dosya         | Durum                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| `colors.ts`   | **Değişiyor.** Pixi `Rgba` dizisi değil `number` tint + ayrı alfa istiyor.    |
| `camera.ts`   | **Değişiyor.** `zoomToScale`, `cameraTransform`, flipY eklendi.               |
| `lod.ts`      | **Değişiyor.** Eşikler aynı, `layerVisibility` eklendi.                       |
| `origin.ts`   | **Küçülüyor.** `nodePosition`, `maxLocalMagnitude`, `float32Step*` siliniyor. |
| `marks.ts`    | **Yeni.** Piksel yarıçapları ve counter-scale formülü.                        |
| `edges.ts`    | **Taşınıyor.** `edgeSegments` mantığı aynı, `layers/`'dan `utils/map/`'e.     |
| `topology.ts` | **Aynen kalıyor.** `gateNeighbours` render bilmiyor.                          |
| `webgl.ts`    | **Aynen kalıyor.** Pixi de WebGL istiyor.                                     |

Bu, "boş sayfa"dan bilinçli bir sapmadır ve gerekçesi yukarıdadır.

### 4. Sprite'lar orijinsiz

Bölüm gerekçesi spec'te. Pratik sonucu: `sprite.position.set(node.x, node.z)` —
**ham galaktik metre**, çıkarma yok. `toLocal` yalnızca `Graphics` köşelerinde
kullanılıyor.

---

## Dosya yapısı

| Dosya                                                      | Sorumluluk                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `frontend/src/utils/map/colors.ts` + `.spec.ts`            | Security rampası, tint, celestial renkleri                 |
| `frontend/src/utils/map/marks.ts` + `.spec.ts`             | Tür → piksel yarıçapı, counter-scale formülü, kova türleri |
| `frontend/src/utils/map/camera.ts` + `.spec.ts`            | zoom↔scale, autofit, transform, URL, limitler              |
| `frontend/src/utils/map/lod.ts` + `.spec.ts`               | Mutlak eşikler, kova, katman görünürlüğü                   |
| `frontend/src/utils/map/origin.ts` + `.spec.ts`            | `boundsCenter`, `nearestNode`, `originFor`, `toLocal`      |
| `frontend/src/utils/map/edges.ts` + `.spec.ts`             | `edgeSegments` (gate çapalama), `localEdges`               |
| `frontend/src/utils/map/topology.ts`                       | Değişmiyor                                                 |
| `frontend/src/utils/map/webgl.ts`                          | Değişmiyor                                                 |
| `frontend/src/components/UniverseMap/scene/createScene.ts` | Container ağacı, `Application` yaşam döngüsü               |
| `frontend/src/components/UniverseMap/scene/systems.ts`     | 5.241 sprite, counter-scale uygulaması                     |
| `frontend/src/components/UniverseMap/scene/edges.ts`       | İki `Graphics`                                             |
| `frontend/src/components/UniverseMap/scene/celestials.ts`  | Sistem başına container                                    |
| `frontend/src/components/UniverseMap/UniverseMap.tsx`      | React kabuğu (yeniden yazılıyor)                           |
| `frontend/src/components/UniverseMap/useMapCamera.ts`      | Değişmiyor                                                 |
| `frontend/src/components/UniverseMap/useMapCelestials.ts`  | Değişmiyor                                                 |

**Silinen:** `frontend/src/components/UniverseMap/layers/` (5 dosya),
`frontend/src/components/UniverseMap/UniverseMap.spec.tsx`,
`frontend/src/utils/map/colorScales.ts` + spec.

---

## Task 1: deck.gl'i sök, pixi.js'i kur

Ağacın her commit'te yeşil kalması için önce sökülüyor. Bu task'tan sonra `/map`
bir yer tutucu gösterir; harita Task 7'de geri gelir.

**Files:**

- Modify: `frontend/package.json`
- Rewrite: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Modify: `frontend/src/app/map/page.tsx:9-10` (yorum)
- Delete: `frontend/src/components/UniverseMap/layers/` (tamamı)
- Delete: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Produces: `UniverseMap({ scope })` — aynı prop, geçici gövde.

- [ ] **Step 1: Bağımlılıkları değiştir**

```bash
cd /root/killreport
yarn workspace frontend remove @deck.gl/core @deck.gl/layers @deck.gl/react @deck.gl/widgets
yarn workspace frontend add pixi.js
grep -n '"pixi.js"\|@deck.gl' frontend/package.json    # yalnızca pixi.js çıkmalı
```

- [ ] **Step 2: Katmanları ve bileşen testini sil**

```bash
rm -r frontend/src/components/UniverseMap/layers
rm frontend/src/components/UniverseMap/UniverseMap.spec.tsx
```

- [ ] **Step 3: Bileşeni yer tutucuyla değiştir**

`frontend/src/components/UniverseMap/UniverseMap.tsx` tamamen şu olur:

```tsx
'use client';

import type { MapScope } from '@/generated/graphql';

/**
 * Placeholder while the renderer is swapped. The Pixi scene lands in Task 7;
 * until then /map is deliberately blank rather than half-drawn, so a partial
 * commit cannot be mistaken for a rendering bug.
 */
export default function UniverseMap({ scope }: { scope: MapScope }) {
  return (
    <div className="flex h-full items-center justify-center bg-ground text-gray-400">
      The map is being rebuilt on PixiJS ({scope}).
    </div>
  );
}
```

- [ ] **Step 4: Sayfadaki yorumu düzelt**

`frontend/src/app/map/page.tsx`'te şu iki satır:

```tsx
// deck.gl reaches for window and a WebGL context at module scope, so the canvas
// never renders on the server.
```

şununla değişir:

```tsx
// PixiJS reaches for window and a WebGL context at module scope, so the canvas
// never renders on the server.
```

- [ ] **Step 5: Doğrula ve commit et**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
npx prettier --check frontend/src/components/UniverseMap frontend/src/app/map
git add -A frontend
git commit -m "chore(frontend): remove deck.gl and stand pixi.js up in its place"
```

Beklenen: `typecheck` temiz; test sayısı `layers.spec.ts`'in 28'i ve
`UniverseMap.spec.tsx`'in 17'si kadar düşer.

---

## Task 2: `colors.ts` ve `marks.ts`

Pixi `Rgba` dizisi değil `number` tint istiyor, ve piksel yarıçapları artık
layer prop'u değil saf tablo.

**Files:**

- Create: `frontend/src/utils/map/colors.ts` + `colors.spec.ts`
- Create: `frontend/src/utils/map/marks.ts` + `marks.spec.ts`
- Delete: `frontend/src/utils/map/colorScales.ts` + `colorScales.spec.ts`

**Interfaces:**

- Produces:

  ```ts
  // colors.ts
  export const SECURITY_RAMP: readonly string[]; // 11 durak
  export function hexToTint(hex: string): number;
  export function securityTint(security: number): number;
  export const GATE_TINT: number;
  export const GATE_ALPHA: number;
  export const CELESTIAL_TINT: Record<MapCelestialKind, number>;

  // marks.ts
  export const SYSTEM_MIN_RADIUS_PX: number; // 1.5
  export const CELESTIAL_RADIUS_PX: Record<MapCelestialKind, number>;
  export const INTERIOR_KINDS: readonly MapCelestialKind[];
  export const FINE_KINDS: readonly MapCelestialKind[];
  export function systemRadiusPx(
    worldRadius: number,
    cameraScale: number,
  ): number;
  export function spriteScale(
    radiusPx: number,
    textureRadiusPx: number,
    cameraScale: number,
  ): number;
  ```

- [ ] **Step 1: `colors.spec.ts`'i yaz (kırmızı)**

```ts
import { MapCelestialKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_TINT,
  GATE_ALPHA,
  GATE_TINT,
  hexToTint,
  SECURITY_RAMP,
  securityTint,
} from './colors';

describe('hexToTint', () => {
  it('turns a css hex into the single number Pixi wants', () => {
    // deck.gl took [r, g, b, a]; Pixi takes 0xRRGGBB and an alpha of its own.
    expect(hexToTint('#94A3B8')).toBe(0x94a3b8);
    expect(hexToTint('#000000')).toBe(0x000000);
    expect(hexToTint('#FFFFFF')).toBe(0xffffff);
  });
});

describe('securityTint', () => {
  it('keeps EVE’s eleven stops, not a three-colour simplification', () => {
    expect(SECURITY_RAMP).toHaveLength(11);
    expect(SECURITY_RAMP[0]).toBe('#F00000');
    expect(SECURITY_RAMP[10]).toBe('#2FEFEF');
  });

  it('buckets to a tenth, the way star-map-svg.ts does', () => {
    expect(securityTint(1.0)).toBe(hexToTint('#2FEFEF'));
    expect(securityTint(0.5)).toBe(hexToTint('#EFEF00'));
    expect(securityTint(0.0)).toBe(hexToTint('#F00000'));
  });

  it('clamps a negative security to the bottom of the ramp', () => {
    // Nullsec runs to -1.0 and the ramp has no entries below zero.
    expect(securityTint(-0.9)).toBe(hexToTint('#F00000'));
  });

  it('clamps above 1.0 rather than reading past the array', () => {
    expect(securityTint(1.7)).toBe(hexToTint('#2FEFEF'));
  });
});

describe('gate and celestial colours', () => {
  it('keeps the gate line the shipped SVGs use', () => {
    expect(GATE_TINT).toBe(0x94a3b8);
    // deck.gl carried 140/255 inside the Rgba tuple; Pixi wants it separately.
    expect(GATE_ALPHA).toBeCloseTo(140 / 255, 6);
  });

  it('keeps every celestial colour phase 2 shipped', () => {
    expect(CELESTIAL_TINT[MapCelestialKind.Star]).toBe(0xfff4ea);
    expect(CELESTIAL_TINT[MapCelestialKind.Planet]).toBe(0x9ca3af);
    expect(CELESTIAL_TINT[MapCelestialKind.Station]).toBe(0x38bdf8);
    expect(CELESTIAL_TINT[MapCelestialKind.Gate]).toBe(0x4cc94c);
    expect(CELESTIAL_TINT[MapCelestialKind.Moon]).toBe(0x64748b);
    expect(CELESTIAL_TINT[MapCelestialKind.Belt]).toBe(0xa16207);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

```bash
yarn workspace frontend test src/utils/map/colors
```

Beklenen: `Cannot find module './colors'`.

- [ ] **Step 3: `colors.ts`'i yaz**

```ts
import { MapCelestialKind } from '@/generated/graphql';

/**
 * EVE's security ramp, 0.0 to 1.0, one entry per tenth. Byte for byte the array
 * in backend/src/scripts/star-map-svg.ts, which colours the region and
 * constellation SVGs already shipped under frontend/public/images — the map has
 * to agree with those or the same system is two colours in two places.
 *
 * Duplicated rather than shared because those SVGs are pre-rendered on the
 * backend: there is no module the two sides both import.
 */
export const SECURITY_RAMP = [
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
] as const;

/** Pixi tints with a single number, not the [r, g, b, a] tuple deck.gl took. */
export function hexToTint(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** Same bucketing as star-map-svg.ts's securityColour, so the two never differ. */
export function securityTint(security: number): number {
  const bucket = Math.round(Math.max(0, security) * 10);
  return hexToTint(SECURITY_RAMP[Math.min(bucket, SECURITY_RAMP.length - 1)]);
}

/**
 * #94A3B8 at 0.55 alpha — the same line the shipped region SVGs use for an
 * internal jump (star-map-svg.ts, REGION_PALETTE.jump). The alpha is separate
 * because Pixi carries it on the object, not in the colour.
 */
export const GATE_TINT = 0x94a3b8;
export const GATE_ALPHA = 140 / 255;

/**
 * Phase 2's palette, unchanged. Three are inherited from the shipped SVGs —
 * star #FFF4EA and planet #9CA3AF from solar-system-map-svg.ts, gate #4CC94C
 * from star-map-svg.ts — and three were chosen because those SVGs draw no
 * stations, moons or belts.
 */
export const CELESTIAL_TINT: Record<MapCelestialKind, number> = {
  STAR: 0xfff4ea,
  PLANET: 0x9ca3af,
  STATION: 0x38bdf8,
  GATE: 0x4cc94c,
  MOON: 0x64748b,
  BELT: 0xa16207,
};
```

- [ ] **Step 4: `marks.spec.ts`'i yaz**

```ts
import { MapCelestialKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_RADIUS_PX,
  FINE_KINDS,
  INTERIOR_KINDS,
  spriteScale,
  SYSTEM_MIN_RADIUS_PX,
  systemRadiusPx,
} from './marks';

describe('systemRadiusPx', () => {
  it('grows with the camera, which is what turns a point into a disc', () => {
    // The median system radius is 3.8809e12 m.
    expect(systemRadiusPx(3.8809e12, 2 ** -36)).toBeCloseTo(
      3.8809e12 * 2 ** -36,
      6,
    );
  });

  it('never falls under the floor, so a galaxy-zoom dot stays visible', () => {
    // At the fit, 3.88e12 m is far below a pixel.
    expect(systemRadiusPx(3.8809e12, 2 ** -50)).toBe(SYSTEM_MIN_RADIUS_PX);
    expect(SYSTEM_MIN_RADIUS_PX).toBe(1.5);
  });
});

describe('spriteScale', () => {
  it('counters the camera so a mark is sized in pixels, not metres', () => {
    // The sprite lives under a container scaled by the camera, so the scale it
    // needs is the pixel size divided by both the texture radius and that
    // camera scale. This is the whole of the 0.60 ms pass.
    expect(spriteScale(1.5, 32, 2 ** -50)).toBeCloseTo(
      1.5 / 32 / 2 ** -50,
      -20,
    );
  });

  it('is independent of the camera in screen terms', () => {
    // Same pixel size at two cameras means the on-screen result matches.
    const a = spriteScale(4, 32, 2 ** -40) * 2 ** -40;
    const b = spriteScale(4, 32, 2 ** -30) * 2 ** -30;
    expect(a).toBeCloseTo(b, 12);
  });
});

describe('celestial marks', () => {
  it('orders the hierarchy star > planet > station = gate > moon > belt', () => {
    const r = CELESTIAL_RADIUS_PX;
    expect(r.STAR).toBeGreaterThan(r.PLANET);
    expect(r.PLANET).toBeGreaterThan(r.STATION);
    expect(r.STATION).toBe(r.GATE);
    expect(r.GATE).toBeGreaterThan(r.MOON);
    expect(r.MOON).toBeGreaterThan(r.BELT);
  });

  it('keeps phase 2’s exact pixel sizes', () => {
    expect(CELESTIAL_RADIUS_PX.STAR).toBe(7);
    expect(CELESTIAL_RADIUS_PX.PLANET).toBe(4.5);
    expect(CELESTIAL_RADIUS_PX.STATION).toBe(3);
    expect(CELESTIAL_RADIUS_PX.GATE).toBe(3);
    expect(CELESTIAL_RADIUS_PX.MOON).toBe(2);
    expect(CELESTIAL_RADIUS_PX.BELT).toBe(1.5);
  });

  it('splits the kinds into the two buckets that draw them', () => {
    expect(INTERIOR_KINDS).toEqual([
      MapCelestialKind.Star,
      MapCelestialKind.Planet,
      MapCelestialKind.Station,
      MapCelestialKind.Gate,
    ]);
    expect(FINE_KINDS).toEqual([MapCelestialKind.Moon, MapCelestialKind.Belt]);
  });
});
```

- [ ] **Step 5: `marks.ts`'i yaz**

```ts
import { MapCelestialKind } from '@/generated/graphql';

/**
 * A 1.5 px floor with a data-driven radius is what makes a point turn into a
 * disc without a mode switch: at galaxy zoom every system is the floor, and by
 * the time the median system's 3.8809e12 m radius crosses 1.5 px the disc takes
 * over on its own.
 */
export const SYSTEM_MIN_RADIUS_PX = 1.5;

export function systemRadiusPx(
  worldRadius: number,
  cameraScale: number,
): number {
  return Math.max(worldRadius * cameraScale, SYSTEM_MIN_RADIUS_PX);
}

/**
 * The counter-scale. A sprite hangs under the camera container, so to occupy
 * `radiusPx` on screen it must divide out both the texture's own radius and the
 * camera's scale. Measured at 0.60 ms for all 5,241 systems, which is why the
 * systems layer stays a scene graph instead of becoming a shader.
 */
export function spriteScale(
  radiusPx: number,
  textureRadiusPx: number,
  cameraScale: number,
): number {
  return radiusPx / textureRadiusPx / cameraScale;
}

/**
 * Marks in pixels, not bodies in metres. A world radius derived from the
 * measured geometry is 0.23 px where the interior opens and 753 px at the
 * ceiling, because a real planet is ~1e7 m and never spans a pixel at any zoom
 * this design reaches. The geometry carries the scale, the mark carries the kind.
 */
export const CELESTIAL_RADIUS_PX: Record<MapCelestialKind, number> = {
  STAR: 7,
  PLANET: 4.5,
  STATION: 3,
  GATE: 3,
  MOON: 2,
  BELT: 1.5,
};

export const INTERIOR_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Star,
  MapCelestialKind.Planet,
  MapCelestialKind.Station,
  MapCelestialKind.Gate,
];

/** 344,457 moons exist; none is built below the fine bucket. */
export const FINE_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Moon,
  MapCelestialKind.Belt,
];
```

- [ ] **Step 6: Eskiyi sil, çalıştır, commit et**

```bash
rm frontend/src/utils/map/colorScales.ts frontend/src/utils/map/colorScales.spec.ts
yarn workspace frontend test src/utils/map
yarn workspace frontend typecheck
npx prettier --check frontend/src/utils/map
git add -A frontend/src/utils/map
git commit -m "feat(frontend): give the map tints and pixel marks pixi can use"
```

Beklenen: `colors.spec.ts` 7, `marks.spec.ts` 7 test.

---

## Task 3: `camera.ts`

deck.gl kamerayı bir `viewState` objesi olarak alıyordu ve pan/zoom'u controller
hallediyordu. Pixi'de controller yok — o aritmetik bize kalıyor, ve **saf
fonksiyon olarak buraya** yazılıyor ki `scene/` yalnızca sonucu uygulasın.

**Files:**

- Rewrite: `frontend/src/utils/map/camera.ts`
- Rewrite: `frontend/src/utils/map/camera.spec.ts`

**Interfaces:**

- Consumes: `MAX_ZOOM` (Task 4'ten; bu task'ta geçici olarak `lod.ts`'in
  `main`'deki hâli kullanılıyor, değeri aynı: −24,51).
- Produces:

  ```ts
  export interface MapCamera {
    x: number;
    z: number;
    zoom: number;
  }
  export interface CameraTransform {
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;
  }
  export function zoomToScale(zoom: number): number;
  export function scaleToZoom(scale: number): number;
  export function cameraTransform(
    c: MapCamera,
    width: number,
    height: number,
  ): CameraTransform;
  export function panCamera(
    c: MapCamera,
    dxPixels: number,
    dyPixels: number,
  ): MapCamera;
  export function zoomCameraAt(
    c: MapCamera,
    deltaZoom: number,
    px: number,
    py: number,
    width: number,
    height: number,
    limits: { minZoom: number; maxZoom: number },
  ): MapCamera;
  export function fitZoom(
    bounds: MapBounds,
    width: number,
    height: number,
  ): number;
  export function fitCamera(
    bounds: MapBounds,
    width: number,
    height: number,
  ): MapCamera;
  export function zoomLimits(fit: number): { minZoom: number; maxZoom: number };
  export function parseScope(params: URLSearchParams): MapScope;
  export function parseCamera(params: URLSearchParams): MapCamera | null;
  export function cameraQuery(scope: MapScope, c: MapCamera): string;
  ```

- [ ] **Step 1: `camera.spec.ts`'i yaz (kırmızı)**

`main`'deki spec'in `fitZoom`, `parseCamera`, `cameraQuery`, `parseScope` ve
`zoomLimits` testleri **aynen korunuyor** — o davranışlar değişmiyor. Üstüne
şunlar ekleniyor:

```ts
import { describe, expect, it } from 'vitest';
import {
  cameraTransform,
  panCamera,
  scaleToZoom,
  zoomCameraAt,
  zoomToScale,
} from './camera';

describe('zoomToScale', () => {
  it('is deck.gl’s logarithmic zoom, so shipped URLs keep meaning', () => {
    // pixels = metres * 2 ** zoom. The URL still carries the log form.
    expect(zoomToScale(-36.18)).toBeCloseTo(2 ** -36.18, 20);
    expect(scaleToZoom(2 ** -36.18)).toBeCloseTo(-36.18, 9);
  });

  it('round-trips', () => {
    expect(scaleToZoom(zoomToScale(-42.5))).toBeCloseTo(-42.5, 9);
  });
});

describe('cameraTransform', () => {
  const camera = { x: 3e17, z: 2e17, zoom: -50 };
  const t = cameraTransform(camera, 1400, 900);

  it('flips y, because Pixi’s screen y runs down and the map’s +z runs up', () => {
    // deck.gl said flipY: false in one line; in Pixi it is a negative y scale.
    // The region and constellation SVGs are drawn "x is screen x, -z is screen
    // y", and a map that disagrees with its own thumbnails is a bug nobody can
    // name.
    expect(t.scaleX).toBeCloseTo(2 ** -50, 20);
    expect(t.scaleY).toBeCloseTo(-(2 ** -50), 20);
  });

  it('puts the camera’s own point at the centre of the viewport', () => {
    expect(camera.x * t.scaleX + t.x).toBeCloseTo(700, 6);
    expect(camera.z * t.scaleY + t.y).toBeCloseTo(450, 6);
  });

  it('maps a point one screen-pixel of world above the camera above it on screen', () => {
    // +z is up, so a larger z must produce a SMALLER screen y.
    const higher = (camera.z + 1 / t.scaleX) * t.scaleY + t.y;
    expect(higher).toBeCloseTo(449, 6);
  });
});

describe('panCamera', () => {
  it('moves the camera opposite the drag, in world metres', () => {
    const c = { x: 0, z: 0, zoom: -50 };
    const scale = 2 ** -50;
    // Dragging the scene 100 px right moves the camera 100 px of world left.
    const panned = panCamera(c, 100, 0);
    expect(panned.x).toBeCloseTo(-100 / scale, -20);
  });

  it('moves +z when dragged down, because the axis is flipped', () => {
    const c = { x: 0, z: 0, zoom: -50 };
    const scale = 2 ** -50;
    expect(panCamera(c, 0, 100).z).toBeCloseTo(100 / scale, -20);
  });

  it('leaves the zoom alone', () => {
    expect(panCamera({ x: 0, z: 0, zoom: -50 }, 10, 10).zoom).toBe(-50);
  });
});

describe('zoomCameraAt', () => {
  const limits = { minZoom: -52, maxZoom: -24.51 };

  it('keeps the world point under the pointer fixed', () => {
    const before = { x: 1e17, z: -2e17, zoom: -45 };
    const [px, py] = [1100, 300];
    const after = zoomCameraAt(before, 1.5, px, py, 1400, 900, limits);

    const worldUnder = (c: typeof before) => {
      const s = 2 ** c.zoom;
      return {
        x: c.x + (px - 700) / s,
        z: c.z - (py - 450) / s,
      };
    };
    const a = worldUnder(before);
    const b = worldUnder(after);
    expect(b.x).toBeCloseTo(a.x, -8);
    expect(b.z).toBeCloseTo(a.z, -8);
  });

  it('stops at the ceiling rather than diving past it', () => {
    const c = { x: 0, z: 0, zoom: -25 };
    expect(zoomCameraAt(c, 10, 700, 450, 1400, 900, limits).zoom).toBe(-24.51);
  });

  it('stops at the floor', () => {
    const c = { x: 0, z: 0, zoom: -51 };
    expect(zoomCameraAt(c, -10, 700, 450, 1400, 900, limits).zoom).toBe(-52);
  });

  it('does not move the camera when the zoom is already clamped', () => {
    const c = { x: 7e16, z: -3e16, zoom: -24.51 };
    const after = zoomCameraAt(c, 5, 100, 100, 1400, 900, limits);
    expect(after.x).toBeCloseTo(c.x, 6);
    expect(after.z).toBeCloseTo(c.z, 6);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

```bash
yarn workspace frontend test src/utils/map/camera
```

- [ ] **Step 3: `camera.ts`'i yaz**

`main`'deki dosya şu eklemelerle değişiyor; `MapCamera`, `MAP_SCOPES`,
`DEFAULT_SCOPE`, `FIT_PADDING`, `ZOOM_BELOW_FIT`, `FALLBACK_FIT_ZOOM`,
`CAMERA_GRID_METRES`, `fitZoom`, `fitCamera`, `zoomLimits`, `parseScope`,
`parseCamera`, `toGrid`, `cameraQuery` **olduğu gibi kalıyor**. `boundsCenter`
importu duruyor. Eklenenler:

```ts
export interface CameraTransform {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

/**
 * The URL keeps deck.gl's logarithmic zoom so links shipped by phases 1 and 2
 * keep meaning. Pixi's camera is a linear container scale, and this is the
 * whole of the conversion: pixels = metres * 2 ** zoom.
 */
export function zoomToScale(zoom: number): number {
  return 2 ** zoom;
}

export function scaleToZoom(scale: number): number {
  return Math.log2(scale);
}

/**
 * What the root container's transform must be for this camera.
 *
 * scaleY is NEGATIVE. deck.gl expressed the orientation as flipY: false in one
 * line; Pixi's screen y runs down and has no such flag, so the axis is flipped
 * here instead. The region and constellation SVGs project "x is screen x, -z is
 * screen y", and a map that disagrees with its own thumbnails is a bug nobody
 * can name. Nothing else in the codebase may negate a coordinate.
 */
export function cameraTransform(
  camera: MapCamera,
  width: number,
  height: number,
): CameraTransform {
  const scale = zoomToScale(camera.zoom);
  return {
    scaleX: scale,
    scaleY: -scale,
    x: width / 2 - camera.x * scale,
    y: height / 2 + camera.z * scale,
  };
}

/** A drag of the scene, in screen pixels, as a move of the camera in metres. */
export function panCamera(
  camera: MapCamera,
  dxPixels: number,
  dyPixels: number,
): MapCamera {
  const scale = zoomToScale(camera.zoom);
  return {
    x: camera.x - dxPixels / scale,
    // Plus, not minus: the axis is flipped, so dragging down raises z.
    z: camera.z + dyPixels / scale,
    zoom: camera.zoom,
  };
}

/**
 * Zoom about a pointer, keeping the world point under it still. Clamped first,
 * so a wheel spun past the ceiling does not drag the view sideways while the
 * zoom refuses to move.
 */
export function zoomCameraAt(
  camera: MapCamera,
  deltaZoom: number,
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
  limits: { minZoom: number; maxZoom: number },
): MapCamera {
  const zoom = Math.min(
    limits.maxZoom,
    Math.max(limits.minZoom, camera.zoom + deltaZoom),
  );
  if (zoom === camera.zoom) return camera;

  const before = zoomToScale(camera.zoom);
  const after = zoomToScale(zoom);
  const offsetX = pointerX - width / 2;
  const offsetY = pointerY - height / 2;

  // The world point under the pointer, before and after, set equal.
  const worldX = camera.x + offsetX / before;
  const worldZ = camera.z - offsetY / before;

  return {
    x: worldX - offsetX / after,
    z: worldZ + offsetY / after,
    zoom,
  };
}
```

- [ ] **Step 4: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/utils/map/camera
yarn workspace frontend typecheck
npx prettier --check frontend/src/utils/map/camera.ts frontend/src/utils/map/camera.spec.ts
git add frontend/src/utils/map/camera.ts frontend/src/utils/map/camera.spec.ts
git commit -m "feat(frontend): make the camera a transform pixi can apply"
```

Beklenen: `main`'in 18 testi + bu task'ın 13'ü = **31**.

---

## Task 4: `lod.ts`

Eşikler değişmiyor; eklenen tek şey "hangi kovada hangi container görünür"
sorusunun saf fonksiyon hâli.

**Files:**

- Modify: `frontend/src/utils/map/lod.ts`
- Modify: `frontend/src/utils/map/lod.spec.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface LayerVisibility {
    edgesGalaxy: boolean;
    edgesLocal: boolean;
    systems: boolean;
    celestials: boolean;
    fine: boolean;
  }
  export function layerVisibility(bucket: LodBucket): LayerVisibility;
  ```

  `APPROACH_ZOOM`, `INTERIOR_ZOOM`, `FINE_ZOOM`, `MAX_ZOOM`, `LodBucket`,
  `lodBucket`, `streamsInteriors`, `showsMoonsAndBelts` değişmeden kalıyor.

- [ ] **Step 1: `lod.spec.ts`'e testleri ekle**

`main`'deki 12 test korunuyor. Eklenenler:

```ts
import { layerVisibility } from './lod';

describe('layerVisibility', () => {
  it('draws the galaxy edge mesh and the systems, and nothing else, at galaxy zoom', () => {
    expect(layerVisibility('galaxy')).toEqual({
      edgesGalaxy: true,
      edgesLocal: false,
      systems: true,
      celestials: false,
      fine: false,
    });
  });

  it('changes nothing on approach — the discs grow on their own', () => {
    expect(layerVisibility('approach')).toEqual(layerVisibility('galaxy'));
  });

  it('swaps the galaxy mesh for the local one when interiors open', () => {
    // The galaxy mesh is hidden rather than kept: its vertices are float32 in
    // scene-centre-local metres, which is 0.22 px at galaxy zoom and useless
    // this far in. The local mesh is rebuilt around the focused system instead.
    const v = layerVisibility('interior');
    expect(v.edgesGalaxy).toBe(false);
    expect(v.edgesLocal).toBe(true);
    expect(v.celestials).toBe(true);
    expect(v.fine).toBe(false);
  });

  it('adds moons and belts only in the fine bucket', () => {
    expect(layerVisibility('fine').fine).toBe(true);
    expect(layerVisibility('fine').edgesLocal).toBe(true);
  });

  it('keeps the systems visible in every bucket', () => {
    for (const bucket of ['galaxy', 'approach', 'interior', 'fine'] as const) {
      expect(layerVisibility(bucket).systems).toBe(true);
    }
  });
});
```

- [ ] **Step 2: `lod.ts`'e ekle**

```ts
/**
 * Which containers exist on screen for a bucket. A pure function rather than a
 * branch inside the scene, so the one decision that governs what is drawn can
 * be read and tested without a canvas.
 */
export interface LayerVisibility {
  edgesGalaxy: boolean;
  edgesLocal: boolean;
  systems: boolean;
  celestials: boolean;
  fine: boolean;
}

export function layerVisibility(bucket: LodBucket): LayerVisibility {
  const interiors = streamsInteriors(bucket);
  return {
    edgesGalaxy: !interiors,
    edgesLocal: interiors,
    systems: true,
    celestials: interiors,
    fine: showsMoonsAndBelts(bucket),
  };
}
```

- [ ] **Step 3: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/utils/map/lod
yarn workspace frontend typecheck
npx prettier --check frontend/src/utils/map/lod.ts frontend/src/utils/map/lod.spec.ts
git add frontend/src/utils/map/lod.ts frontend/src/utils/map/lod.spec.ts
git commit -m "feat(frontend): say which map layers each lod bucket draws"
```

Beklenen: 12 + 5 = **17**.

---

## Task 5: `origin.ts` ve `edges.ts`

Kayan orijin küçülüyor — sprite'lar ham metre kullandığı için geriye yalnızca
`Graphics` geometrisinin ihtiyaçları kalıyor. Gate çapalama mantığı
`layers/edges.ts`'ten `utils/map/edges.ts`'e taşınıyor; **aritmetiği aynı**,
çünkü doğruydu.

**Files:**

- Rewrite: `frontend/src/utils/map/origin.ts` + `origin.spec.ts`
- Create: `frontend/src/utils/map/edges.ts` + `edges.spec.ts`

**Interfaces:**

- Produces:
  ```ts
  // origin.ts
  export interface MapOrigin {
    x: number;
    z: number;
  }
  export function boundsCenter(bounds: MapBounds): MapOrigin;
  export function toLocal(
    origin: MapOrigin,
    x: number,
    z: number,
  ): [number, number];
  export function nearestNode<T extends Pick<MapNode, 'x' | 'z'>>(
    nodes: T[],
    x: number,
    z: number,
  ): T | null;
  export function originFor(
    bounds: MapBounds,
    focus: Pick<MapNode, 'x' | 'z'> | null,
  ): MapOrigin;

  // edges.ts
  export interface EdgeSegment {
    from: [number, number];
    to: [number, number];
  }
  export function edgeSegments(
    edges: MapEdge[],
    nodes: MapNode[],
    origin: MapOrigin,
    gates?: Pick<
      MapCelestial,
      'systemId' | 'destinationSystemId' | 'x' | 'z'
    >[],
  ): EdgeSegment[];
  export function localEdges(edges: MapEdge[], systemIds: number[]): MapEdge[];
  ```

**Silinen tek şey `nodePosition`'dır** — sprite'lar orijin kullanmadığı için
çağıranı kalmadı.

`maxLocalMagnitude`, `float32StepMetres`, `float32StepPixels` ve
`FLOAT32_RELATIVE_STEP` **kalıyor.** İlk taslakta bunları silmeyi planlamıştım;
yanlıştı. Yeni tasarımda galaksi hat ağının kabul edilebilir olmasının gerekçesi
"sahne merkezine göre float32 adımı o zoom'da 0,22 px" iddiasıdır, ve o iddiayı
ölçen araçlar tam olarak bunlardır. Silmek delili atmak olurdu.

- [ ] **Step 1: `origin.spec.ts`'i yaz**

`main`'deki testlerin tamamı korunuyor; yalnızca `nodePosition` describe'ı
(1 test) düşüyor. `the float32 budget on the real NEW_EDEN scene` describe'ının
başlığı ve yorumları, artık bütün sahneyi değil **galaksi hat ağını** tarif
edecek şekilde güncelleniyor — sayılar aynı, çünkü ağ hâlâ sahne merkezine
göre. Ek olarak:

```ts
it('is the only place a Graphics vertex is built — sprites never use it', () => {
  // Documentation as a test: Pixi composes a sprite's transform in float64 and
  // writes the screen coordinate to float32, so a sprite takes raw galactic
  // metres. Only Graphics keeps world-space vertices in a float32 buffer, and
  // that is the entire remaining job of the origin.
  const origin = { x: 1e17, z: -2e17 };
  expect(toLocal(origin, 1.5e17, -2.5e17)).toEqual([5e16, -5e16]);
});
```

- [ ] **Step 2: `origin.ts`'i yaz**

`main`'deki dosyadan `nodePosition` dışında her şey **aynen** alınır.
`MapOrigin`'in doküman yorumu şununla değişir:

```ts
/**
 * The floating origin, for Graphics vertices only.
 *
 * Sprites do not need one: Pixi's batcher computes `a * x + c * y + tx` in
 * float64 and writes the screen coordinate — a number in the hundreds — into
 * the float32 buffer, so a sprite takes raw galactic metres and the 299 px of
 * jitter deck.gl measured at the deepest zoom never arises.
 *
 * A Graphics is different: it builds one geometry buffer of world-space
 * vertices in float32 and does not repack it per frame. At galaxy zoom the
 * scene centre puts float32's step at 3.4e10 m, which phase 1 measured as
 * 0.22 px and is fine; deeper in, the galaxy mesh is hidden and a small local
 * mesh is built around the focused system instead.
 */
export interface MapOrigin {
  x: number;
  z: number;
}
```

- [ ] **Step 3: `edges.spec.ts`'i yaz**

`main`'deki `layers/layers.spec.ts`'in `edgeSegments` testleri (`edgeSegments`
ve `edgeSegments with loaded gates` describe'ları, toplam 9 test) **aynen**
buraya taşınır — import'lar `./edges`'e döner, `origin` yerel değişkenler
korunur. Üstüne `localEdges` için:

```ts
describe('localEdges', () => {
  const edges = [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 3, to: 4 },
  ] as MapEdge[];

  it('keeps only the edges whose both ends are in the neighbourhood', () => {
    // A half-in edge would run off to a node the local mesh does not place,
    // and its far end would land at the origin. Dropping it is the same rule
    // edgeSegments already follows for an unknown node.
    expect(localEdges(edges, [1, 2, 3])).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ]);
  });

  it('returns nothing for an empty neighbourhood', () => {
    expect(localEdges(edges, [])).toEqual([]);
  });

  it('does not care about the order of the ids', () => {
    expect(localEdges(edges, [3, 2])).toEqual([{ from: 2, to: 3 }]);
  });
});
```

- [ ] **Step 4: `edges.ts`'i yaz**

`main`'deki `layers/edges.ts`'ten `EdgeSegment` ve `edgeSegments` **aynen**
taşınır (doküman yorumları dahil; `LineLayerProps` importu ve
`edgesLayerProps`, `GATE_COLOR`, `GATE_WIDTH_MIN_PIXELS` gelmez — renk
`colors.ts`'te). Eklenen:

```ts
/**
 * The edges of one neighbourhood, both ends inside it.
 *
 * A half-contained edge is dropped rather than drawn: the local mesh only
 * places the systems it was given, so the far end would fall at the origin —
 * the same silent [0, 0] line edgeSegments already refuses for an unknown node.
 */
export function localEdges(edges: MapEdge[], systemIds: number[]): MapEdge[] {
  const inside = new Set(systemIds);
  return edges.filter((edge) => inside.has(edge.from) && inside.has(edge.to));
}
```

- [ ] **Step 5: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/utils/map
yarn workspace frontend typecheck
npx prettier --check frontend/src/utils/map
git add frontend/src/utils/map
git commit -m "feat(frontend): narrow the floating origin to graphics vertices"
```

Beklenen: `origin.spec.ts` **16** (16'dan silinen 1, eklenen 1),
`edges.spec.ts` **12** (taşınan 9 + yeni 3).

---

## Task 6: `scene/` — Pixi katmanı

Bu task'ın **testi yoktur.** Karar verilecek her şey Task 2–5'te hesaplandı;
burada yalnızca atama var. Doğrulaması Task 8'de, kullanıcının gözüyle.

**Files:**

- Create: `frontend/src/components/UniverseMap/scene/createScene.ts`
- Create: `frontend/src/components/UniverseMap/scene/systems.ts`
- Create: `frontend/src/components/UniverseMap/scene/edges.ts`
- Create: `frontend/src/components/UniverseMap/scene/celestials.ts`

**Interfaces:**

- Consumes: Task 2–5'in tamamı.
- Produces:

  ```ts
  // createScene.ts
  export const DOT_TEXTURE_RADIUS: number; // 32
  export interface MapScene {
    app: Application;
    world: Container;
    edgesGalaxy: Graphics;
    edgesLocal: Graphics;
    systems: Container;
    celestials: Container;
    dot: Texture;
    destroy(): void;
  }
  export function createScene(host: HTMLElement): Promise<MapScene>;

  // systems.ts
  export interface SystemSprites {
    sprites: Sprite[];
    radii: number[];
  }
  export function buildSystems(
    scene: MapScene,
    nodes: MapNode[],
  ): SystemSprites;
  export function scaleSystems(s: SystemSprites, cameraScale: number): void;

  // edges.ts
  export function drawEdges(
    target: Graphics,
    segments: EdgeSegment[],
    origin: MapOrigin,
  ): void;

  // celestials.ts
  export interface CelestialSprites {
    interior: Sprite[];
    interiorRadii: number[];
    fine: Sprite[];
    fineRadii: number[];
    fineContainers: Container[];
  }
  export function buildCelestials(
    scene: MapScene,
    celestials: MapCelestial[],
    systemById: Map<number, Pick<MapNode, 'x' | 'z'>>,
  ): CelestialSprites;
  export function scaleCelestials(
    s: CelestialSprites,
    cameraScale: number,
  ): void;
  export function setFineVisible(s: CelestialSprites, visible: boolean): void;
  ```

- [ ] **Step 1: `createScene.ts`'i yaz**

```ts
import { Application, Container, Graphics, Texture } from 'pixi.js';

/** The texture is drawn once at this radius; every mark counter-scales from it. */
export const DOT_TEXTURE_RADIUS = 32;

export interface MapScene {
  app: Application;
  world: Container;
  edgesGalaxy: Graphics;
  edgesLocal: Graphics;
  systems: Container;
  celestials: Container;
  dot: Texture;
  destroy(): void;
}

/**
 * The container tree, built once. Every later call mutates it; nothing here is
 * rebuilt on a camera move, which is the point of putting the camera on the
 * root container's transform.
 *
 * Child order is draw order: gates under systems, so a dot is never hidden by
 * a line.
 */
export async function createScene(host: HTMLElement): Promise<MapScene> {
  const app = new Application();
  await app.init({ background: 0x0b0d10, resizeTo: host, antialias: true });
  host.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const edgesGalaxy = new Graphics();
  const edgesLocal = new Graphics();
  const systems = new Container();
  const celestials = new Container();
  world.addChild(edgesGalaxy, edgesLocal, systems, celestials);

  const dot = app.renderer.generateTexture(
    new Graphics().circle(0, 0, DOT_TEXTURE_RADIUS).fill(0xffffff),
  );

  return {
    app,
    world,
    edgesGalaxy,
    edgesLocal,
    systems,
    celestials,
    dot,
    destroy: () => app.destroy(true, { children: true, texture: true }),
  };
}
```

- [ ] **Step 2: `systems.ts`'i yaz**

```ts
import type { MapNode } from '@/generated/graphql';
import { securityTint } from '@/utils/map/colors';
import { spriteScale, systemRadiusPx } from '@/utils/map/marks';
import { Sprite } from 'pixi.js';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';

export interface SystemSprites {
  sprites: Sprite[];
  radii: number[];
}

/**
 * One sprite per system, sharing one texture so Pixi batches the lot.
 *
 * The position is the raw galactic metre, with no origin subtracted: Pixi
 * composes the transform in float64 and only the resulting screen coordinate
 * reaches float32.
 */
export function buildSystems(scene: MapScene, nodes: MapNode[]): SystemSprites {
  scene.systems.removeChildren();

  const sprites: Sprite[] = [];
  const radii: number[] = [];

  for (const node of nodes) {
    const sprite = new Sprite(scene.dot);
    sprite.anchor.set(0.5);
    sprite.position.set(node.x, node.z);
    sprite.tint = securityTint(node.securityStatus);
    sprites.push(sprite);
    radii.push(node.radius);
    scene.systems.addChild(sprite);
  }

  return { sprites, radii };
}

/**
 * The counter-scale pass. Measured at 0.60 ms for 5,241 systems, which is 3.6%
 * of a 60 fps frame and runs only when the zoom changes — not per frame, and
 * deliberately not debounced, because the disc growing continuously is the
 * whole feel of the approach.
 */
export function scaleSystems(
  { sprites, radii }: SystemSprites,
  cameraScale: number,
): void {
  for (let i = 0; i < sprites.length; i++) {
    sprites[i].scale.set(
      spriteScale(
        systemRadiusPx(radii[i], cameraScale),
        DOT_TEXTURE_RADIUS,
        cameraScale,
      ),
    );
  }
}
```

- [ ] **Step 3: `edges.ts`'i yaz**

```ts
import { GATE_ALPHA, GATE_TINT } from '@/utils/map/colors';
import type { EdgeSegment } from '@/utils/map/edges';
import type { MapOrigin } from '@/utils/map/origin';
import type { Graphics } from 'pixi.js';

/**
 * Builds one Graphics from segments that are already origin-local.
 *
 * `pixelLine: true` is what makes this a build-once job: the stroke stays one
 * pixel whatever the camera scale, so the geometry is never rebuilt on a zoom.
 * Expressing the width in world units instead would mean redrawing all 6,959
 * segments on every wheel tick.
 *
 * The Graphics is positioned at the origin, so its float32 vertices stay
 * origin-local while the large offset rides in the float64 transform.
 */
export function drawEdges(
  target: Graphics,
  segments: EdgeSegment[],
  origin: MapOrigin,
): void {
  target.clear();
  target.position.set(origin.x, origin.z);

  for (const segment of segments) {
    target.moveTo(segment.from[0], segment.from[1]);
    target.lineTo(segment.to[0], segment.to[1]);
  }

  target.stroke({
    width: 1,
    pixelLine: true,
    color: GATE_TINT,
    alpha: GATE_ALPHA,
  });
}
```

- [ ] **Step 4: `celestials.ts`'i yaz**

```ts
import type { MapCelestial, MapNode } from '@/generated/graphql';
import { CELESTIAL_TINT } from '@/utils/map/colors';
import {
  CELESTIAL_RADIUS_PX,
  FINE_KINDS,
  INTERIOR_KINDS,
  spriteScale,
} from '@/utils/map/marks';
import { Container, Sprite } from 'pixi.js';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';

export interface CelestialSprites {
  interior: Sprite[];
  interiorRadii: number[];
  fine: Sprite[];
  fineRadii: number[];
  fineContainers: Container[];
}

/**
 * One container per system, positioned at that system's galactic coordinate,
 * with its celestials as children at their in-system offsets.
 *
 * This is what deck.gl had to do by hand: its getPosition added
 * `system.x + celestial.x` for every object. Here the hierarchy composes the
 * two, in float64, and the child's own coordinate stays small.
 *
 * Moons and belts hang off a nested container per system, collected in
 * `fineContainers`, so the fine bucket is a handful of visibility flags rather
 * than a walk over every sprite.
 *
 * A celestial whose system is not in the index is dropped rather than drawn at
 * the origin — the same rule the gate edges follow, for the same reason.
 */
export function buildCelestials(
  scene: MapScene,
  celestials: MapCelestial[],
  systemById: Map<number, Pick<MapNode, 'x' | 'z'>>,
): CelestialSprites {
  scene.celestials.removeChildren();

  const interiorKinds = new Set<string>(INTERIOR_KINDS);
  const fineKinds = new Set<string>(FINE_KINDS);

  const bySystem = new Map<number, Container>();
  const fineBySystem = new Map<number, Container>();
  const result: CelestialSprites = {
    interior: [],
    interiorRadii: [],
    fine: [],
    fineRadii: [],
    fineContainers: [],
  };

  for (const celestial of celestials) {
    const system = systemById.get(celestial.systemId);
    if (!system) continue;

    const isInterior = interiorKinds.has(celestial.kind);
    const isFine = fineKinds.has(celestial.kind);
    if (!isInterior && !isFine) continue;

    let container = bySystem.get(celestial.systemId);
    if (!container) {
      container = new Container();
      container.position.set(system.x, system.z);
      bySystem.set(celestial.systemId, container);
      scene.celestials.addChild(container);
    }

    const sprite = new Sprite(scene.dot);
    sprite.anchor.set(0.5);
    sprite.position.set(celestial.x, celestial.z);
    sprite.tint = CELESTIAL_TINT[celestial.kind];

    const radius = CELESTIAL_RADIUS_PX[celestial.kind];

    if (isInterior) {
      container.addChild(sprite);
      result.interior.push(sprite);
      result.interiorRadii.push(radius);
      continue;
    }

    let fine = fineBySystem.get(celestial.systemId);
    if (!fine) {
      fine = new Container();
      fineBySystem.set(celestial.systemId, fine);
      container.addChild(fine);
      result.fineContainers.push(fine);
    }
    fine.addChild(sprite);
    result.fine.push(sprite);
    result.fineRadii.push(radius);
  }

  return result;
}

export function scaleCelestials(
  sprites: CelestialSprites,
  cameraScale: number,
): void {
  for (let i = 0; i < sprites.interior.length; i++) {
    sprites.interior[i].scale.set(
      spriteScale(sprites.interiorRadii[i], DOT_TEXTURE_RADIUS, cameraScale),
    );
  }
  for (let i = 0; i < sprites.fine.length; i++) {
    sprites.fine[i].scale.set(
      spriteScale(sprites.fineRadii[i], DOT_TEXTURE_RADIUS, cameraScale),
    );
  }
}

/** The fine bucket, toggled per system container rather than per sprite. */
export function setFineVisible(
  sprites: CelestialSprites,
  visible: boolean,
): void {
  for (const container of sprites.fineContainers) container.visible = visible;
}
```

- [ ] **Step 5: Derle ve commit et**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap/scene
git add frontend/src/components/UniverseMap/scene
git commit -m "feat(frontend): build the map's pixi scene graph"
```

Bu task test eklemez.

---

## Task 7: Bileşeni bağla

Task 1'in yer tutucusu gerçek haritayla değişiyor.

**Files:**

- Rewrite: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Create: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: Task 2–6'nın tamamı, ve değişmeyen `useMapCamera`,
  `useMapCelestials`, `isWebgl2Available`.

### Neden efekt, `useMemo` değil

deck.gl'de katman dizisi bir `useMemo`'ydu ve React her render'da yeni layer
nesneleri kurup deck.gl'e veriyordu. Pixi'de sahne **mutasyona uğrayan uzun
ömürlü bir nesne**; React'in işi onu kurmak, beslemek ve söküp atmak. Yani:

- `createScene` bir kez, mount efektinde.
- Geometri geldiğinde `buildSystems` + galaksi hatları, bir kez.
- Kamera değiştiğinde transform + counter-scale.
- Kova değiştiğinde `visible` bayrakları.
- Odak değiştiğinde yerel hatlar ve celestial'lar.

Her biri kendi bağımlılık dizisiyle ayrı bir efekt; hiçbiri diğerinin işini
tekrar yapmıyor.

- [ ] **Step 1: Bileşeni yaz**

```tsx
'use client';

import Loader from '@/components/Loader';
import {
  MapCelestialKind,
  useMapGeometryQuery,
  type MapScope,
} from '@/generated/graphql';
import {
  cameraTransform,
  fitCamera,
  panCamera,
  zoomCameraAt,
  zoomLimits,
  zoomToScale,
  type MapCamera,
} from '@/utils/map/camera';
import { edgeSegments, localEdges } from '@/utils/map/edges';
import { layerVisibility, lodBucket } from '@/utils/map/lod';
import { boundsCenter, nearestNode, originFor } from '@/utils/map/origin';
import { gateNeighbours } from '@/utils/map/topology';
import { isWebgl2Available } from '@/utils/map/webgl';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildCelestials,
  scaleCelestials,
  setFineVisible,
  type CelestialSprites,
} from './scene/celestials';
import { createScene, type MapScene } from './scene/createScene';
import { drawEdges } from './scene/edges';
import {
  buildSystems,
  scaleSystems,
  type SystemSprites,
} from './scene/systems';
import { useMapCamera } from './useMapCamera';
import { useMapCelestials } from './useMapCelestials';

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full p-8 text-center text-gray-400">
      {children}
    </div>
  );
}

export default function UniverseMap({ scope }: { scope: MapScope }) {
  const [webgl] = useState(isWebgl2Available);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MapScene | null>(null);
  const systemSprites = useRef<SystemSprites | null>(null);
  const celestialSprites = useRef<CelestialSprites | null>(null);

  // Static universe data behind a 24 hour Redis key and a STATIC_GAME_DATA
  // response cache: cache-first is overridden here at the call site rather than
  // globally, because apolloClient.ts is shared by every page.
  const { data, loading, error } = useMapGeometryQuery({
    variables: { scope },
    fetchPolicy: 'cache-first',
  });
  const geometry = data?.mapGeometry;

  const fit = geometry
    ? fitCamera(geometry.bounds, size.width, size.height)
    : null;
  const { camera, onCameraChange } = useMapCamera(scope, fit);

  const bucket = camera ? lodBucket(camera.zoom) : 'galaxy';
  const focus =
    geometry && camera && layerVisibility(bucket).celestials
      ? nearestNode(geometry.nodes, camera.x, camera.z)
      : null;

  const celestialSystemIds =
    focus && geometry
      ? [focus.systemId, ...gateNeighbours(geometry.edges, focus.systemId)]
      : [];
  const celestials = useMapCelestials(celestialSystemIds);

  // The scene outlives every render; React only builds it, feeds it and tears
  // it down. Mount and unmount, once.
  useEffect(() => {
    if (!webgl || !host.current) return;
    let live = true;
    let created: MapScene | null = null;

    createScene(host.current).then((built) => {
      if (!live) {
        built.destroy();
        return;
      }
      created = built;
      scene.current = built;
      setSize({
        width: built.app.renderer.width,
        height: built.app.renderer.height,
      });
    });

    return () => {
      live = false;
      created?.destroy();
      scene.current = null;
      systemSprites.current = null;
      celestialSprites.current = null;
    };
  }, [webgl]);

  // The galaxy: 5,241 sprites and the full 6,959-segment mesh, built once per
  // scene. The mesh is scene-centre-local, where float32's step is 0.22 px.
  useEffect(() => {
    const s = scene.current;
    if (!s || !geometry) return;
    systemSprites.current = buildSystems(s, geometry.nodes);
    const centre = boundsCenter(geometry.bounds);
    drawEdges(
      s.edgesGalaxy,
      edgeSegments(geometry.edges, geometry.nodes, centre),
      centre,
    );
  }, [geometry]);

  // The focused neighbourhood: at most 9 systems, so the mesh is small and its
  // vertices are focus-local rather than scene-local.
  useEffect(() => {
    const s = scene.current;
    if (!s || !geometry) return;
    if (!focus) {
      s.edgesLocal.clear();
      return;
    }
    const origin = originFor(geometry.bounds, focus);
    const near = localEdges(geometry.edges, celestialSystemIds);
    const gates = celestials.filter((c) => c.kind === MapCelestialKind.Gate);
    drawEdges(
      s.edgesLocal,
      edgeSegments(near, geometry.nodes, origin, gates),
      origin,
    );
  }, [geometry, focus, celestials, celestialSystemIds]);

  useEffect(() => {
    const s = scene.current;
    if (!s || !geometry) return;
    const systemById = new Map(
      geometry.nodes.map((node) => [node.systemId, node]),
    );
    celestialSprites.current = buildCelestials(s, celestials, systemById);
  }, [geometry, celestials]);

  // Camera and counter-scale. The transform is one object write; the scale pass
  // is 0.60 ms for every system.
  useEffect(() => {
    const s = scene.current;
    if (!s || !camera || !size.width) return;
    const t = cameraTransform(camera, size.width, size.height);
    s.world.scale.set(t.scaleX, t.scaleY);
    s.world.position.set(t.x, t.y);

    const scale = zoomToScale(camera.zoom);
    if (systemSprites.current) scaleSystems(systemSprites.current, scale);
    if (celestialSprites.current)
      scaleCelestials(celestialSprites.current, scale);
  }, [camera, size.width, size.height]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    const v = layerVisibility(bucket);
    s.edgesGalaxy.visible = v.edgesGalaxy;
    s.edgesLocal.visible = v.edgesLocal;
    s.systems.visible = v.systems;
    s.celestials.visible = v.celestials;
    if (celestialSprites.current) {
      setFineVisible(celestialSprites.current, v.fine);
    }
  }, [bucket, celestials]);

  // Pan and zoom. deck.gl shipped a controller; Pixi does not, so the events
  // land here and the arithmetic lives in camera.ts where it is tested.
  useEffect(() => {
    const s = scene.current;
    if (!s || !camera || !fit) return;
    const canvas = s.app.canvas;
    const limits = zoomLimits(fit.zoom);
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let current = camera;

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => (dragging = false);
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      current = panCamera(current, e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      onCameraChange(current);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      current = zoomCameraAt(
        current,
        -e.deltaY / 300,
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height,
        limits,
      );
      onCameraChange(current);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', up);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('wheel', wheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', up);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [camera, fit, onCameraChange]);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  if (!webgl) {
    return (
      <MapMessage>
        This map needs WebGL 2, which this browser has turned off or does not
        support. The region and system pages show the same space as static maps.
      </MapMessage>
    );
  }

  if (error) {
    return (
      <MapMessage>Could not load the map geometry: {error.message}</MapMessage>
    );
  }

  if (loading && !geometry) {
    return (
      <Loader size="lg" text="Loading the map..." className="h-full p-8" />
    );
  }

  if (!geometry || geometry.nodes.length === 0) {
    return <MapMessage>This scene has no systems to draw.</MapMessage>;
  }

  return (
    <div
      ref={(node) => {
        host.current = node;
        measure(node);
      }}
      className="relative w-full h-full bg-ground"
    />
  );
}
```

- [ ] **Step 2: `UniverseMap.spec.tsx`'i yaz**

Testler **yalnızca Pixi'ye dokunmayan dallara** bakar: WebGL yokluğu, hata,
yükleme, boş sahne. Sahne kurulumunun kendisi mock'lanır ve doğrulanmaz — bu
katmanın doğrulaması gözledir.

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const webgl = vi.fn(() => true);
vi.mock('@/utils/map/webgl', () => ({ isWebgl2Available: () => webgl() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

type QueryResult = {
  data?: unknown;
  loading: boolean;
  error?: { message: string };
};
const useMapGeometryQuery = vi.fn<() => QueryResult>();
vi.mock('@/generated/graphql', () => ({
  MapScope: { NewEden: 'NEW_EDEN', Pochven: 'POCHVEN', Wormhole: 'WORMHOLE' },
  MapCelestialKind: {
    Star: 'STAR',
    Planet: 'PLANET',
    Moon: 'MOON',
    Belt: 'BELT',
    Station: 'STATION',
    Gate: 'GATE',
  },
  useMapGeometryQuery: () => useMapGeometryQuery(),
  useMapCelestialsQuery: () => ({ data: { mapCelestials: [] } }),
}));

// The scene is a WebGL object; jsdom has no GPU and this layer is verified by
// eye, not by assertion. Mocked so the component's branches can be reached.
vi.mock('./scene/createScene', () => ({
  DOT_TEXTURE_RADIUS: 32,
  createScene: vi.fn(() => new Promise(() => {})),
}));
vi.mock('./scene/systems', () => ({
  buildSystems: vi.fn(),
  scaleSystems: vi.fn(),
}));
vi.mock('./scene/edges', () => ({ drawEdges: vi.fn() }));
vi.mock('./scene/celestials', () => ({
  buildCelestials: vi.fn(),
  scaleCelestials: vi.fn(),
  setFineVisible: vi.fn(),
}));

vi.mock('@/components/Loader', () => ({
  default: ({ text }: { text?: string }) => <div>{text}</div>,
}));

import { MapScope } from '@/generated/graphql';
import UniverseMap from './UniverseMap';

const GEOMETRY = {
  mapGeometry: {
    scope: 'NEW_EDEN',
    bounds: { minX: -1e17, maxX: 3e17, minZ: -2e17, maxZ: 2e17 },
    nodes: [
      {
        systemId: 30000142,
        name: 'Jita',
        x: 3e17,
        z: 2e17,
        radius: 3.88e12,
        securityStatus: 0.94,
        constellationId: 20000020,
        regionId: 10000002,
      },
    ],
    edges: [],
  },
};

beforeEach(() => {
  webgl.mockReturnValue(true);
  useMapGeometryQuery.mockReturnValue({ data: GEOMETRY, loading: false });
});

describe('UniverseMap', () => {
  it('says so plainly when the browser has no WebGL 2', () => {
    webgl.mockReturnValue(false);
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(screen.getByText(/needs WebGL 2/)).toBeInTheDocument();
  });

  it('surfaces a query error rather than an empty canvas', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      error: { message: 'boom' },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(
      screen.getByText(/Could not load the map geometry: boom/),
    ).toBeInTheDocument();
  });

  it('shows the loader until the geometry lands', () => {
    useMapGeometryQuery.mockReturnValue({ loading: true });
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(screen.getByText('Loading the map...')).toBeInTheDocument();
  });

  it('says a scene is empty rather than drawing nothing silently', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      data: { mapGeometry: { ...GEOMETRY.mapGeometry, nodes: [] } },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(screen.getByText(/no systems to draw/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/components/UniverseMap
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap
git add frontend/src/components/UniverseMap
git commit -m "feat(frontend): draw the universe map with pixi"
```

Beklenen: `UniverseMap.spec.tsx` **4** test.

---

## Task 8: Tam doğrulama

- [ ] **Step 1: Bütün doğrulama kümesi**

```bash
cd /root/killreport
yarn test
yarn workspace backend build
yarn workspace frontend typecheck
yarn workspace frontend lint
yarn workspace frontend build:check
npx prettier --check .
```

Kabul: `backend` **671** (değişmedi — backend'e dokunulmadı). `frontend` sayısı
ölçülüp buraya yazılır; tahmin edilmez. `lint` **229**, `main`'le sıfır fark.
`build:check` çıktısında `/map` olmalı. `prettier` temiz.

- [ ] **Step 2: Backend'in değişmediğini kanıtla**

```bash
git diff main --stat -- backend/   # bos olmali
```

- [ ] **Step 3: Canlı sorgu**

Backend `:4010`'da açıkken:

```bash
for s in NEW_EDEN POCHVEN WORMHOLE; do
  curl -s -X POST http://localhost:4010/graphql -H 'Content-Type: application/json' \
    -d "{\"query\":\"{ mapGeometry(scope: $s) { nodes { systemId } edges { from } } }\"}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['data']['mapGeometry'];print(len(d['nodes']),len(d['edges']))"
done
```

Kabul: `5241 6959`, `27 30`, `2604 0`. Farklıysa geçişin dışında bir şey
bozulmuştur.

- [ ] **Step 4: Bağımlılığın söküldüğünü kanıtla**

```bash
grep -rn "deck.gl" frontend/src frontend/package.json   # bos olmali
grep -n '"pixi.js"' frontend/package.json               # 8.20.1
```

- [ ] **Step 5: Kullanıcıya ne bakacağını söyle**

Kapsam "aynısını yap" olduğu için kriter tek cümle: **`/map` `main`'inkinden
farklı görünmemeli.** Özellikle bakılacaklar:

- **Yön.** Bir bölgeyi açıp aynı bölgenin küçük resmiyle karşılaştır. +z
  ekranda yukarı olmalı; ters dönmüşse `cameraTransform`'un negatif y ölçeği
  yanlış taraftadır.
- **Nokta diske açılıyor mu**, ve aynı zoom'da mı açılıyor.
- **Gate hatları 1 px mi kalıyor** her zoom'da (`pixelLine`), ve sistem içine
  inince gerçek geçitlere çapalanıyor mu.
- **Pan ve zoom** imlecin altındaki noktayı sabit tutuyor mu.
- **URL**: elle `?x=&z=&zoom=` yazıp gitmek, ve geri tuşu.
- Aylar ve kuşaklar en dipte geliyor mu.

---

## Self-review

| Spec bölümü                                    | Task                                    |
| ---------------------------------------------- | --------------------------------------- |
| Aynı görünüm tablosu (renk, yarıçap, alfa)     | 2                                       |
| flipY, Pixi'de negatif y ölçeği                | 3                                       |
| zoom↔scale, URL sözleşmesi değişmiyor          | 3                                       |
| LOD eşikleri ve katman görünürlüğü             | 4                                       |
| Kayan orijinin yalnızca Graphics'te kalması    | 5, 6                                    |
| Gate uçlarının çapalanması                     | 5                                       |
| Sahne ağacı, sistem başına container           | 6                                       |
| Counter-scale (0,60 ms)                        | 2 (formül), 6 (uygulama), 7 (tetikleme) |
| `pixelLine` ile bir kez kurulan hat geometrisi | 6                                       |
| Veri akışının değişmemesi                      | 7                                       |
| deck.gl'in sökülmesi, pixi.js'in kurulması     | 1, 8                                    |
| Test sınırı: karar testli, atama testsiz       | 2–5 testli, 6 testsiz                   |
| Backend'e dokunulmaması                        | 8 Step 2                                |
| Etiketler, görsel dil, picking, sovereignty    | **Kapsam dışı**                         |

**Açık risk:** `pixelLine: true` kod okunarak seçildi, çalıştırılarak değil.
Task 8 Step 5'te gözle doğrulanıyor; tutmazsa geri düşüş, hat geometrisini
**kova değişiminde** yeniden çizmektir — tekerlek tıkırtısında değil.
