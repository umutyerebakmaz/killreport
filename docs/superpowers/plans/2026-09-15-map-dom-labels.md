# Harita etiketleri: DOM/CSS katmanı — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Evren haritasının isimlerini Pixi `BitmapText`'ten gerçek HTML/CSS elemanlarına taşımak; genişliği tahmin etmeyi bırakıp ölçmek, bölge çapasını medoid'e çekmek, isimleri tıklanabilir yapmak.

**Mimari:** Pixi sahnesi (nokta, hat, gök cisimleri) yerinde kalıyor. Canvas'ın üstüne havuzlu, imperatif bir DOM katmanı geliyor: React kapsayıcıyı sahipleniyor, pointermove başına render yapmıyor. Yerleştirme kararı saf fonksiyonlarda (`utils/map/`) kalmaya devam ediyor; oraya artık bir ölçer enjekte ediliyor.

**Teknoloji:** Next.js App Router, TypeScript, Pixi v8, Vitest 5 + jsdom + Testing Library, GraphQL Yoga + Prisma `$queryRaw`, Redis.

**Spec:** `docs/superpowers/specs/2026-09-15-map-dom-labels-design.md`

## Global kısıtlar

- **Yarn, asla npm.** `yarn workspace backend …`, `yarn workspace frontend …`.
- **Üretilen dosyalar elle düzenlenmez:** `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`. Kaynak `.graphql` değişir, codegen çalışır.
- **Backend codegen her zaman frontend codegen'den önce.**
- Etiket metrikleri **tek kaynakta**: `frontend/src/utils/map/labelStyle.ts`. CSS'e metrik yazılmaz.
- Commit mesajları İngilizce, `type(scope):` sonrası küçük harf, Claude atfı yok.
- Her task kendi testleriyle biter ve kendi commit'ini atar.
- Dal: `feat/map-dom-labels` (spec commit'leri burada).

---

### Task 1: Kademe metriklerini kendi modülüne çıkar

**Dosyalar:**

- Oluştur: `frontend/src/utils/map/labelStyle.ts`
- Test: `frontend/src/utils/map/labelStyle.spec.ts`
- Değiştir: `frontend/src/components/UniverseMap/scene/labels.ts` (yerel `TIER_STYLE` siliniyor, yeni modülden import ediliyor)

**Arayüzler:**

- Üretir: `LABEL_TIER_STYLE`, `labelLineHeight(tier)`, `labelFontString(tier)`, `labelText(tier, name)` — Task 2, 3 ve 4 bunları kullanıyor.

- [ ] **Adım 1: Düşen testi yaz**

`frontend/src/utils/map/labelStyle.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LABEL_TIER_STYLE,
  labelFontString,
  labelLineHeight,
  labelText,
} from './labelStyle';

describe('labelLineHeight', () => {
  it('atlas katmanının kullandığı üç satır yüksekliğini koruyor', () => {
    expect(labelLineHeight('region')).toBe(18);
    expect(labelLineHeight('constellation')).toBe(14);
    expect(labelLineHeight('system')).toBe(9);
  });

  it('fontSize ile birlikte hareket ediyor, elle yazılmıyor', () => {
    const ratio = labelLineHeight('region') / LABEL_TIER_STYLE.region.fontSize;
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(1.2);
  });
});

describe('labelFontString', () => {
  it('canvas sırasıyla ağırlık, boyut ve aileyi veriyor', () => {
    expect(labelFontString('region')).toBe('700 16px Shentox, sans-serif');
    expect(labelFontString('constellation')).toBe(
      '600 12px Shentox, sans-serif',
    );
    expect(labelFontString('system')).toBe('500 8px Shentox, sans-serif');
  });
});

describe('labelText', () => {
  it('yalnızca bölge kademesini büyütüyor', () => {
    expect(labelText('region', 'Sinq Laison')).toBe('SINQ LAISON');
    expect(labelText('constellation', 'Kimotoro')).toBe('Kimotoro');
    expect(labelText('system', 'Jita')).toBe('Jita');
  });
});
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labelStyle.spec.ts`
Beklenen: FAIL — `Failed to resolve import "./labelStyle"`.

- [ ] **Adım 3: Modülü yaz**

`frontend/src/utils/map/labelStyle.ts`:

```ts
import type { LabelTier } from './lod';

export interface LabelTierStyle {
  fontSize: number;
  fontWeight: '500' | '600' | '700';
  letterSpacing: number;
  uppercase: boolean;
}

/**
 * Per-tier styling. The design fixes the ORDER, not these numbers: the
 * background tier must read larger, dimmer and more spaced than the foreground
 * one. The values themselves are meant to be tuned by looking.
 *
 * Region is uppercase and letter-spaced because that is what makes a name read
 * as a region rather than as a big system.
 *
 * The weight follows the size — 700 / 600 / 500 against 16 / 12 / 8 — so the two
 * say the same thing rather than pulling against each other. The opposite was
 * tried first, on the cartographic argument that an area name should be airy
 * where a point name is solid, and it was rejected on sight: a heavy 8 px system
 * name under a light 16 px region name reads as though the small one matters
 * more. Weight is a hierarchy signal before it is a legibility one.
 *
 * These numbers live in TypeScript rather than in `map.css` because the
 * measurer and the renderer have to agree: a collision box built at 16 px for
 * text the browser draws at 12 reserves the wrong room, and no test catches it.
 * `map.css` owns colour, halo and transition; it owns no metric.
 */
export const LABEL_TIER_STYLE: Record<LabelTier, LabelTierStyle> = {
  region: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
    uppercase: true,
  },
  constellation: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    uppercase: false,
  },
  system: {
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 0,
    uppercase: false,
  },
};

/**
 * Shentox's ascender and descender together are about 1.2 em, so a collision
 * box at the font size alone would clip a descender out of the test and let two
 * names touch.
 */
export const LABEL_LINE_HEIGHT_RATIO = 1.15;

/** The collision box's height, and the minimum lift above a mark. */
export function labelLineHeight(tier: LabelTier): number {
  return Math.round(LABEL_TIER_STYLE[tier].fontSize * LABEL_LINE_HEIGHT_RATIO);
}

/**
 * The CSS font shorthand, in the order a canvas 2d context parses it. The
 * measurer and the element are set from this one function, so they cannot
 * drift.
 */
export function labelFontString(tier: LabelTier): string {
  const style = LABEL_TIER_STYLE[tier];
  return `${style.fontWeight} ${style.fontSize}px Shentox, sans-serif`;
}

/** What is actually drawn — and therefore what is actually measured. */
export function labelText(tier: LabelTier, name: string): string {
  return LABEL_TIER_STYLE[tier].uppercase ? name.toUpperCase() : name;
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labelStyle.spec.ts`
Beklenen: PASS, 5 test.

- [ ] **Adım 5: `scene/labels.ts`'i tek kaynağa bağla**

`frontend/src/components/UniverseMap/scene/labels.ts` içindeki yerel `const TIER_STYLE: Record<LabelTier, {...}> = {...}` bloğunu (yaklaşık satır 18-80, JSDoc dahil) sil ve yerine dosyanın import bloğuna ekle:

```ts
import { LABEL_TIER_STYLE, labelText } from '@/utils/map/labelStyle';
```

Dosyadaki `TIER_STYLE` kullanımlarını `LABEL_TIER_STYLE` ile değiştir. `drawLabels` içindeki

```ts
text: style.uppercase ? candidate.name.toUpperCase() : candidate.name,
```

satırı

```ts
text: labelText(candidate.tier, candidate.name),
```

olur. `TextStyleFontWeight` import'u artık kullanılmıyorsa `pixi.js` import listesinden çıkar.

- [ ] **Adım 6: Etkilenen testleri çalıştır**

Çalıştır: `yarn workspace frontend test src/components/UniverseMap src/utils/map`
Beklenen: PASS, kırmızı yok.

- [ ] **Adım 7: Tipleri doğrula**

Çalıştır: `yarn workspace frontend exec tsc --noEmit`
Beklenen: hata yok.

- [ ] **Adım 8: Commit**

```bash
git add frontend/src/utils/map/labelStyle.ts frontend/src/utils/map/labelStyle.spec.ts frontend/src/components/UniverseMap/scene/labels.ts
git commit -m "refactor(map): move label tier metrics into one module"
```

---

### Task 2: Metin ölçeri

**Dosyalar:**

- Oluştur: `frontend/src/utils/map/measure.ts`
- Test: `frontend/src/utils/map/measure.spec.ts`

**Arayüzler:**

- Tüketir: `labelFontString`, `labelText`, `LABEL_TIER_STYLE` (Task 1).
- Üretir: `type LabelMeasure = (tier: LabelTier, name: string) => number`, `createLabelMeasurer(ctx?)`, `whenLabelFontsReady()` — Task 3 ve 4 kullanıyor.

- [ ] **Adım 1: Düşen testi yaz**

`frontend/src/utils/map/measure.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createLabelMeasurer, type MeasureContext } from './measure';

/** Her karakteri 10 px sayan sahte bir 2d context. */
function fakeContext() {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  } satisfies MeasureContext;
}

describe('createLabelMeasurer', () => {
  it('ölçülen genişliğe letterSpacing ekliyor', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    // 'AB' iki karakter: 20 px metin + 3 px x 2 karakter aralık.
    expect(measure('region', 'AB')).toBe(26);
    // Sistem kademesinde aralık 0, yani çıplak ölçüm.
    expect(measure('system', 'AB')).toBe(20);
  });

  it('ölçmeden önce context fontunu kademeye göre kuruyor', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('constellation', 'Kimotoro');

    expect(ctx.font).toBe('600 12px Shentox, sans-serif');
  });

  it('bölge kademesinde büyütülmüş metni ölçüyor', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('region', 'Sinq Laison');

    expect(ctx.measureText).toHaveBeenCalledWith('SINQ LAISON');
  });

  it('aynı ismi iki kez ölçmüyor', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('system', 'Jita');
    measure('system', 'Jita');

    expect(ctx.measureText).toHaveBeenCalledTimes(1);
  });

  it('kademeler ayrı önbellek tutuyor', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('system', 'Jita');
    measure('constellation', 'Jita');

    expect(ctx.measureText).toHaveBeenCalledTimes(2);
  });

  it('context yoksa null dönüyor', () => {
    expect(createLabelMeasurer(null)).toBeNull();
  });
});
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/utils/map/measure.spec.ts`
Beklenen: FAIL — `Failed to resolve import "./measure"`.

- [ ] **Adım 3: Modülü yaz**

`frontend/src/utils/map/measure.ts`:

```ts
import { LABEL_TIER_STYLE, labelFontString, labelText } from './labelStyle';
import type { LabelTier } from './lod';

/** What the measurer needs from a canvas 2d context, and nothing more. */
export type MeasureContext = Pick<
  CanvasRenderingContext2D,
  'font' | 'measureText'
>;

export type LabelMeasure = (tier: LabelTier, name: string) => number;

function browserContext(): MeasureContext | null {
  if (typeof document === 'undefined') return null;
  return document.createElement('canvas').getContext('2d');
}

/**
 * Exact label widths, memoised per tier.
 *
 * `measureText` rather than an element's `offsetWidth`: the collision filter
 * wants the width BEFORE the element exists, and reading a layout property per
 * label per frame is the thrash the pooled layer exists to avoid. It is
 * synchronous, kerned, and — once the font string matches — the same advance
 * the browser will draw.
 *
 * letterSpacing is added here rather than set on the context: `ctx.letterSpacing`
 * is not implemented everywhere, and CSS adds the spacing after every character
 * including the last, which is what the element will do.
 *
 * Null when there is no 2d context (an old browser, a canvas-less test
 * environment). The caller draws no labels at all in that case; there is
 * deliberately no estimated-width fallback, because that is the mean-glyph
 * guess this whole change removes.
 *
 * The cache is per measurer and keyed on the raw name, so a remount starts
 * clean. 6,354 names measured once is a few milliseconds.
 */
export function createLabelMeasurer(
  ctx?: MeasureContext | null,
): LabelMeasure | null {
  const context = ctx === undefined ? browserContext() : ctx;
  if (!context) return null;

  const cache: Record<LabelTier, Map<string, number>> = {
    region: new Map(),
    constellation: new Map(),
    system: new Map(),
  };

  return (tier, name) => {
    const memo = cache[tier];
    const hit = memo.get(name);
    if (hit !== undefined) return hit;

    const text = labelText(tier, name);
    context.font = labelFontString(tier);
    const width =
      context.measureText(text).width +
      LABEL_TIER_STYLE[tier].letterSpacing * text.length;

    memo.set(name, width);
    return width;
  };
}

/**
 * Waits for the real Shentox face before anything is measured against it.
 *
 * Shentox is a webfont, loaded asynchronously by `@font-face` in
 * `app/fonts.css`. Measuring before the face is ready measures the `sans-serif`
 * fallback, and every collision box for the session is then built on the wrong
 * advances. `document.fonts.ready` alone is not enough: it can resolve before
 * anything has ever requested the font. `load()` is what actually requests it,
 * one call per face this module is about to measure, taken from
 * `LABEL_TIER_STYLE` rather than a second hardcoded list.
 *
 * Defensive rather than throwing: jsdom's `document.fonts` is a partial
 * implementation and some environments have none at all. Either way the caller
 * gets to carry on, just possibly against whatever face is available yet.
 */
export async function whenLabelFontsReady(): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;

  // One request per tier, weight included. `8px Shentox` asks for weight 400, so
  // requesting by size alone would let a 600 measurement run before SemiBold had
  // been fetched — the exact fallback this function exists to prevent.
  const faces = new Set(
    Object.values(LABEL_TIER_STYLE).map(
      (style) => `${style.fontWeight} ${style.fontSize}px Shentox`,
    ),
  );

  try {
    await Promise.all([...faces].map((face) => fonts.load(face)));
    await fonts.ready;
  } catch {
    // A rejected load (a missing file, a blocked request) must not stop the map
    // from getting labels at all.
  }
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/utils/map/measure.spec.ts`
Beklenen: PASS, 6 test.

- [ ] **Adım 5: Commit**

```bash
git add frontend/src/utils/map/measure.ts frontend/src/utils/map/measure.spec.ts
git commit -m "feat(map): measure label widths with the canvas text metrics"
```

---

### Task 3: Yerleştirmeyi ölçüme bağla

`LABEL_CHAR_WIDTH` ve `LABEL_LINE_HEIGHT` bu task'ta siliniyor; kaldırma kuralı kademeye değil veriye bağlanıyor.

**Dosyalar:**

- Değiştir: `frontend/src/utils/map/labels.ts`
- Değiştir: `frontend/src/utils/map/labels.spec.ts`
- Değiştir: `frontend/src/components/UniverseMap/UniverseMap.tsx` (ölçeri kur ve geçir)

**Arayüzler:**

- Tüketir: `LabelMeasure`, `createLabelMeasurer` (Task 2), `labelLineHeight` (Task 1).
- Üretir: `labelCandidates({ …, measure })` — Task 5 ve 7 aynı imzayı büyütüyor.

- [ ] **Adım 1: Testleri yeni imzaya göre yaz**

`frontend/src/utils/map/labels.spec.ts` başındaki import bloğunu değiştir:

```ts
import { describe, expect, it } from 'vitest';
import { labelLineHeight } from './labelStyle';
import type { LabelMeasure } from './measure';
import { systemFloorPx, systemRadiusPx } from './marks';
import {
  labelCandidates,
  LABEL_DOT_GAP_PX,
  MAX_VISIBLE_LABELS,
  placeLabels,
  type LabelCandidate,
} from './labels';

/**
 * Karakter başına 4 px sayan sahte ölçer. Gerçek `measureText` jsdom'da yok ve
 * olsa bile bu testlerin konusu değil: burada ölçülen, ölçümün nasıl
 * kullanıldığı.
 */
const measure: LabelMeasure = (_tier, name) => name.length * 4;
```

Dosyadaki her `labelCandidates({ … })` çağrısına `measure,` ekle. `LABEL_LINE_HEIGHT.region` gibi kullanımları `labelLineHeight('region')` ile değiştir. `LABEL_CHAR_WIDTH`'e dayanan genişlik beklentilerini sahte ölçere göre yeniden yaz (isim uzunluğu × 4 ÷ 2 = `halfWidth`).

Ardından iki yeni test ekle:

```ts
describe('kaldırma', () => {
  it('altında işaret olmayan bir isim tam bir satır yüksekliği yükseliyor', () => {
    const [c] = labelCandidates({
      tiers: ['constellation'],
      regions: [],
      constellations: [{ id: 1, name: 'Kimotoro', x: 0, z: 0 }],
      systems: [],
      measure,
      transform,
      width: W,
      height: H,
    });

    expect(c.screenY).toBeCloseTo(450 - labelLineHeight('constellation'), 6);
  });

  it('yarıçapı olan bir isim kendi diskini ve boşluğu temizliyor', () => {
    const radius = 4e15;
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 30000142, name: 'Jita', x: 0, z: 0, radius }],
      measure,
      transform,
      width: W,
      height: H,
    });

    const lineHeight = labelLineHeight('system');
    const floorPx = systemFloorPx(Math.log2(transform.scaleX));
    const expected = Math.max(
      lineHeight,
      lineHeight / 2 +
        systemRadiusPx(radius, transform.scaleX, floorPx) +
        LABEL_DOT_GAP_PX,
    );

    expect(c.screenY).toBeCloseTo(450 - expected, 6);
  });

  it('yarıçapı 0 olan bir sistem tabana düşüyor, satır yüksekliğine değil', () => {
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 30000001, name: 'Tanoo', x: 0, z: 0, radius: 0 }],
      measure,
      transform,
      width: W,
      height: H,
    });

    const lineHeight = labelLineHeight('system');
    const floorPx = systemFloorPx(Math.log2(transform.scaleX));
    const expected = Math.max(
      lineHeight,
      lineHeight / 2 + floorPx + LABEL_DOT_GAP_PX,
    );

    expect(c.screenY).toBeCloseTo(450 - expected, 6);
  });

  it('genişliği ölçerden alıyor, isim uzunluğundan değil', () => {
    const wide: LabelMeasure = () => 100;
    const [c] = labelCandidates({
      tiers: ['system'],
      regions: [],
      constellations: [],
      systems: [{ id: 1, name: 'I', x: 0, z: 0, radius: 0 }],
      measure: wide,
      transform,
      width: W,
      height: H,
    });

    expect(c.halfWidth).toBe(50);
  });
});
```

- [ ] **Adım 2: Testleri çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labels.spec.ts`
Beklenen: FAIL — `labelLineHeight` import edilemiyor / `measure` bilinmeyen özellik.

- [ ] **Adım 3: `labels.ts`'i değiştir**

`LABEL_CHAR_WIDTH` sabitini ve JSDoc'unu tamamen sil. `LABEL_LINE_HEIGHT` sabitini ve JSDoc'unu sil. Import bloğuna ekle:

```ts
import { labelLineHeight } from './labelStyle';
import type { LabelMeasure } from './measure';
```

`labelCandidates`'ın argüman nesnesine `measure: LabelMeasure;` ekle. Kademe döngüsünün gövdesinde:

```ts
const lineHeight = labelLineHeight(tier);
const halfHeight = lineHeight / 2;
const floorPx = systemFloorPx(Math.log2(transform.scaleX));

for (const source of byTier[tier]) {
  // The lift depends on the DATA, not on the tier: a source with a radius has
  // a mark drawn under it and the name has to clear the disc; one without has
  // nothing there and a line height is the whole lift.
  //
  // `?? 0` would be wrong here. systemRadiusPx floors at `floorPx`, so a
  // missing radius read as 0 still returns 1.5-6 px and would quietly push the
  // centroid tiers up by that much.
  const lift =
    source.radius === undefined
      ? lineHeight
      : Math.max(
          lineHeight,
          halfHeight +
            systemRadiusPx(source.radius, transform.scaleX, floorPx) +
            LABEL_DOT_GAP_PX,
        );

  const screenX = source.x * transform.scaleX + transform.x;
  const screenY = source.z * transform.scaleY + transform.y - lift;
  const halfWidth = measure(tier, source.name) / 2;
  …
}
```

`LABEL_CHAR_WIDTH` ile ilgili kalan referans olmadığını doğrula:

```bash
grep -rn "LABEL_CHAR_WIDTH\|LABEL_LINE_HEIGHT" frontend/src
```

Beklenen: çıktı boş.

- [ ] **Adım 4: Testleri çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labels.spec.ts`
Beklenen: PASS.

- [ ] **Adım 5: `UniverseMap.tsx`'te ölçeri kur**

Import ekle:

```ts
import { createLabelMeasurer } from '@/utils/map/measure';
```

`pickNodes` useMemo'sunun altına:

```ts
// Built once the face is loaded, because a measurer created earlier would
// measure the fallback font. Null when the browser has no 2d context: the map
// then draws no labels at all rather than guessing their width.
const measure = useMemo(() => {
  if (!fontsReady) return null;
  const measurer = createLabelMeasurer();
  if (!measurer) {
    console.warn('Map labels are off: this browser gave no 2d canvas context.');
  }
  return measurer;
}, [fontsReady]);
```

Uyarı `useMemo` içinde, çünkü ölçer orada bir kez kuruluyor; bir efekte taşımak
onu her `fontsReady` değişiminde tekrar yazdırırdı.

Etiket efektinin (bugün `UniverseMap.tsx:316`) kapısına `measure`'ı ekle ve `labelCandidates`'a geçir:

```ts
useEffect(() => {
  const s = scene.current;
  if (!s || !sceneReady || !measure || !camera || !size.width) return;
  …
  const candidates = labelCandidates({
    tiers,
    regions,
    constellations,
    systems: labelSystems,
    measure,
    transform: cameraTransform(camera, size.width, size.height),
    width: size.width,
    height: size.height,
  });

  drawLabels(s, placeLabels(candidates));
}, [sceneReady, measure, camera, size.width, size.height, labelSystems, regions, constellations]);
```

Dependency dizisindeki `fontsReady` yerini `measure` alıyor (`measure` zaten `fontsReady`'den türüyor).

- [ ] **Adım 6: Tüm frontend testlerini çalıştır**

Çalıştır: `yarn workspace frontend test`
Beklenen: PASS. `UniverseMap.spec.tsx` jsdom'da `getContext('2d')` null döndüğü için etiket çizmiyor; o spec'in hiçbir assertion'ı `drawLabels`'ın çağrılmasına dayanmıyor. Dayanan bir test çıkarsa, spec'e `vi.mock('@/utils/map/measure', …)` ile `createLabelMeasurer: () => (_t, name) => name.length * 4` ekle.

- [ ] **Adım 7: Tipleri doğrula**

Çalıştır: `yarn workspace frontend exec tsc --noEmit`
Beklenen: hata yok.

- [ ] **Adım 8: Commit**

```bash
git add frontend/src/utils/map/labels.ts frontend/src/utils/map/labels.spec.ts frontend/src/components/UniverseMap/UniverseMap.tsx
git commit -m "feat(map): place labels from measured widths, not a glyph average"
```

---

### Task 4: DOM etiket katmanı

Bu task'ın sonunda Pixi hiç metin çizmiyor.

**Dosyalar:**

- Oluştur: `frontend/src/components/UniverseMap/labels/labelLayer.ts`
- Test: `frontend/src/components/UniverseMap/labels/labelLayer.spec.ts`
- Oluştur: `frontend/src/app/map.css`
- Değiştir: `frontend/src/app/globals.css` (import satırı)
- Değiştir: `frontend/src/utils/map/labels.ts` (`LabelCandidate.systemId`)
- Değiştir: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Değiştir: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx` (mock hedefi)
- Değiştir: `frontend/src/components/UniverseMap/scene/createScene.ts` (`labels` container'ı gidiyor)
- Değiştir: `frontend/src/components/UniverseMap/scene/celestials.spec.ts` (sahte sahneden `labels` alanı gidiyor)
- Değiştir: `frontend/src/utils/map/colors.ts` ve `colors.spec.ts` (`LABEL_TINT` gidiyor)
- Sil: `frontend/src/components/UniverseMap/scene/labels.ts`

**Arayüzler:**

- Tüketir: `LabelCandidate` (Task 3), `LABEL_TIER_STYLE`/`labelText` (Task 1), `whenLabelFontsReady` (Task 2).
- Üretir: `createLabelLayer(host)`, `drawLabels(layer, placed)`, `destroyLabelLayer(layer)`, `type LabelLayer` — Task 5 ve 8 bunları kullanıyor.

- [ ] **Adım 1: Düşen testi yaz**

`frontend/src/components/UniverseMap/labels/labelLayer.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { LabelCandidate } from '@/utils/map/labels';
import {
  createLabelLayer,
  destroyLabelLayer,
  drawLabels,
  type LabelLayer,
} from './labelLayer';

function candidate(overrides: Partial<LabelCandidate> = {}): LabelCandidate {
  return {
    key: 'system:30000142',
    name: 'Jita',
    tier: 'system',
    screenX: 100,
    screenY: 200,
    halfWidth: 10,
    halfHeight: 5,
    systemId: 30000142,
    ...overrides,
  };
}

let host: HTMLDivElement;
let layer: LabelLayer;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  layer = createLabelLayer(host);
});

describe('drawLabels', () => {
  it('bir ismi span olarak yazıyor ve konumluyor', () => {
    drawLabels(layer, [candidate()]);

    const el = layer.root.querySelector('span')!;
    expect(el.textContent).toBe('Jita');
    expect(el.style.transform).toBe(
      'translate(-50%, -50%) translate(100px, 200px)',
    );
  });

  it('bölge ismini büyütüyor', () => {
    drawLabels(layer, [
      candidate({
        key: 'region:10000002',
        tier: 'region',
        name: 'The Forge',
        systemId: undefined,
      }),
    ]);

    expect(layer.root.querySelector('span')!.textContent).toBe('THE FORGE');
  });

  it('kademe metriklerini elemana bir kez yazıyor', () => {
    drawLabels(layer, [candidate({ tier: 'constellation', key: 'c:1' })]);

    const el = layer.root.querySelector('span')!;
    expect(el.style.fontSize).toBe('12px');
    expect(el.style.fontWeight).toBe('600');
    expect(el.style.letterSpacing).toBe('1px');
  });

  it('aynı anahtarı yeniden çizerken aynı elemanı kullanıyor', () => {
    drawLabels(layer, [candidate()]);
    const first = layer.root.querySelector('span');

    drawLabels(layer, [candidate({ screenX: 300 })]);
    const second = layer.root.querySelector('span');

    expect(second).toBe(first);
    expect(layer.root.children).toHaveLength(1);
    expect(second!.style.transform).toBe(
      'translate(-50%, -50%) translate(300px, 200px)',
    );
  });

  it('yerleşmeyen ismi silmiyor, gizliyor', () => {
    drawLabels(layer, [candidate()]);
    drawLabels(layer, []);

    const el = layer.root.querySelector('span')!;
    expect(el.classList.contains('is-visible')).toBe(false);
    expect(layer.root.children).toHaveLength(1);
  });

  it('yalnızca sistem kademesini tıklanabilir hedef olarak damgalıyor', () => {
    drawLabels(layer, [
      candidate(),
      candidate({
        key: 'region:10000002',
        tier: 'region',
        name: 'The Forge',
        systemId: undefined,
      }),
    ]);

    const [system, region] = [...layer.root.querySelectorAll('span')];
    expect(system.dataset.mapSystem).toBe('30000142');
    expect(region.dataset.mapSystem).toBeUndefined();
  });
});

describe('destroyLabelLayer', () => {
  it('kökü ve havuzu bırakıyor', () => {
    drawLabels(layer, [candidate()]);
    destroyLabelLayer(layer);

    expect(host.children).toHaveLength(0);
    expect(layer.pool.size).toBe(0);
  });
});
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/components/UniverseMap/labels/labelLayer.spec.ts`
Beklenen: FAIL — `Failed to resolve import "./labelLayer"`.

- [ ] **Adım 3: `LabelCandidate`'a `systemId` ekle**

`frontend/src/utils/map/labels.ts` içinde:

```ts
export interface LabelCandidate {
  key: string;
  name: string;
  tier: LabelTier;
  /** Centre of the drawn text, not of the dot it belongs to. */
  screenX: number;
  screenY: number;
  halfWidth: number;
  halfHeight: number;
  /**
   * The system this name can select, for the layer's `data-map-system` stamp.
   * Only the system tier has one: a region name selecting whichever star its
   * anchor happens to sit on would be a lie about what was clicked.
   */
  systemId?: number;
}
```

Aday üretiminde:

```ts
candidates.push({
  key: `${tier}:${source.id}`,
  name: source.name,
  tier,
  screenX,
  screenY,
  halfWidth,
  halfHeight,
  systemId: tier === 'system' ? source.id : undefined,
});
```

- [ ] **Adım 4: Katmanı yaz**

`frontend/src/components/UniverseMap/labels/labelLayer.ts`:

```ts
import { LABEL_TIER_STYLE, labelText } from '@/utils/map/labelStyle';
import type { LabelCandidate } from '@/utils/map/labels';

export interface LabelLayer {
  /** The absolutely positioned overlay, a sibling of the Pixi canvas. */
  root: HTMLDivElement;
  /** Keyed on `LabelCandidate.key`; a key's text never changes. */
  pool: Map<string, HTMLSpanElement>;
}

export function createLabelLayer(host: HTMLElement): LabelLayer {
  const root = document.createElement('div');
  root.className = 'map-labels';
  host.appendChild(root);
  return { root, pool: new Map() };
}

/**
 * Writes the placed labels into the overlay, reusing the elements.
 *
 * This runs on EVERY camera change — every pointermove of a drag — so it is a
 * pool, not a rebuild. Creating up to 300 elements per pointer tick would mean
 * 300 insertions and 300 style recalculations a frame; reusing them means one
 * `transform` write each, which the compositor can take without a layout.
 *
 * The transform is the only per-frame write for that reason: `left`/`top` would
 * invalidate layout, and `translate(-50%, -50%)` centres the text on its anchor
 * without the layer ever needing to know how wide it is.
 *
 * No rounding to whole pixels, unlike the atlas this replaces: a BitmapText on a
 * fractional coordinate resampled its glyph quads across two texels, and DOM
 * text is laid out by the browser with subpixel positioning instead. Rounding
 * here would only make a pan step visibly.
 *
 * Entries that fall out of the placed set lose `is-visible` rather than being
 * removed: they come back as soon as the camera moves again.
 */
export function drawLabels(layer: LabelLayer, placed: LabelCandidate[]): void {
  for (const candidate of placed) {
    let el = layer.pool.get(candidate.key);

    if (!el) {
      const style = LABEL_TIER_STYLE[candidate.tier];
      el = document.createElement('span');
      el.className = `map-label map-label--${candidate.tier}`;
      el.textContent = labelText(candidate.tier, candidate.name);
      // The metrics come from labelStyle, the same constants the measurer read,
      // so the collision box and the drawn text cannot disagree. map.css owns
      // everything else about how this looks.
      el.style.fontSize = `${style.fontSize}px`;
      el.style.fontWeight = style.fontWeight;
      el.style.letterSpacing = `${style.letterSpacing}px`;
      if (candidate.systemId !== undefined) {
        el.dataset.mapSystem = String(candidate.systemId);
      }
      layer.pool.set(candidate.key, el);
      layer.root.appendChild(el);
    }

    el.style.transform = `translate(-50%, -50%) translate(${candidate.screenX}px, ${candidate.screenY}px)`;
    el.classList.add('is-visible');
  }

  const shown = new Set(placed.map((candidate) => candidate.key));
  for (const [key, el] of layer.pool) {
    if (!shown.has(key)) el.classList.remove('is-visible');
  }
}

export function destroyLabelLayer(layer: LabelLayer): void {
  layer.root.remove();
  layer.pool.clear();
}
```

- [ ] **Adım 5: CSS'i yaz**

`frontend/src/app/map.css`:

```css
/* The label overlay sits above the Pixi canvas and below the hover tip and the
   popup, which are React nodes in the same host. It owns colour, halo and
   transition; every metric (size, weight, letter spacing) is written from
   utils/map/labelStyle.ts, so the measurer and the text agree. */
.map-labels {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* Transparent as a sheet: the gaps between names must reach the canvas, which
     is where panning and zooming are bound. Only a system name opts back in. */
  pointer-events: none;
}

.map-label {
  position: absolute;
  top: 0;
  left: 0;
  white-space: nowrap;
  font-family: Shentox, sans-serif;
  line-height: 1;
  color: #fff;
  /* Over the galaxy there is nothing behind a name, so the halo is what keeps
     one legible where it crosses a gate line or a dot. */
  text-shadow: 0 0 3px rgb(0 0 0 / 0.9);
}

.map-label:not(.is-visible) {
  visibility: hidden;
}

.map-label--system {
  pointer-events: auto;
  cursor: pointer;
}
```

`frontend/src/app/globals.css`'te `@import './cards.css';` satırının altına ekle:

```css
@import './map.css';
```

- [ ] **Adım 6: Testi çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/components/UniverseMap/labels/labelLayer.spec.ts`
Beklenen: PASS, 8 test.

- [ ] **Adım 7: `UniverseMap.tsx`'i katmana bağla**

Import satırlarını değiştir — `./scene/labels` gidiyor:

```ts
import {
  createLabelLayer,
  destroyLabelLayer,
  drawLabels,
  type LabelLayer,
} from './labels/labelLayer';
import { createLabelMeasurer, whenLabelFontsReady } from '@/utils/map/measure';
```

`scene` ref'inin yanına:

```ts
const labelLayer = useRef<LabelLayer | null>(null);
```

Sahne efektinde `installLabelFonts()` çağrısını `whenLabelFontsReady()` ile değiştir (zincir ve yorum aynı kalıyor; artık beklenen şey atlas değil ölçüm).

Sahne efektinin altına yeni bir efekt:

```ts
// The label overlay belongs to the host, not to the scene: it survives a
// renderer rebuild and has nothing to tear down on the GPU.
useEffect(() => {
  if (!host) return;
  const layer = createLabelLayer(host);
  labelLayer.current = layer;
  return () => {
    destroyLabelLayer(layer);
    labelLayer.current = null;
  };
}, [host]);
```

Etiket efektini katmana çevir:

```ts
useEffect(() => {
  const layer = labelLayer.current;
  if (!layer || !measure || !camera || !size.width) return;

  const tiers = visibleLabelTiers(camera.zoom);
  if (tiers.length === 0) {
    drawLabels(layer, []);
    return;
  }

  const candidates = labelCandidates({ … });

  drawLabels(layer, placeLabels(candidates));
}, [host, measure, camera, size.width, size.height, labelSystems, regions, constellations]);
```

Dependency dizisinde `sceneReady` yerini `host` alıyor: katman artık sahneye değil host'a bağlı.

- [ ] **Adım 8: Pixi tarafını temizle**

`frontend/src/components/UniverseMap/scene/createScene.ts`:

- `MapScene` arayüzünden `labels: Container;` alanını sil.
- `const labels = new Container();` satırını, `stage.addChild(labels)` çağrısını ve dönen nesnedeki `labels` alanını sil.
- Etiketlerin neden stage'de olduğunu anlatan yorumu (satır 77 civarı) sil.

`frontend/src/components/UniverseMap/scene/celestials.spec.ts`: sahte sahne nesnesinden `labels: new Container(),` satırını sil.

`frontend/src/utils/map/colors.ts`: `LABEL_TINT` sabitini ve JSDoc'unu sil — rengi artık `map.css` veriyor. `frontend/src/utils/map/colors.spec.ts` içindeki `LABEL_TINT` describe bloğunu sil.

Dosyayı sil:

```bash
git rm frontend/src/components/UniverseMap/scene/labels.ts
```

`frontend/src/components/UniverseMap/UniverseMap.spec.tsx` içindeki mock'u taşı:

```ts
vi.mock('./labels/labelLayer', () => ({
  createLabelLayer: (host: HTMLElement) => ({
    root: host,
    pool: new Map(),
  }),
  destroyLabelLayer: vi.fn(),
  drawLabels: vi.fn(),
}));
```

`vi.mock('./scene/labels', …)` bloğunu sil. `FakeScene` tipinde `labels` alanı varsa onu da sil.

- [ ] **Adım 9: Kalıntı kalmadığını doğrula**

```bash
grep -rn "BitmapText\|BitmapFont\|installLabelFonts\|LABEL_TINT\|scene/labels" frontend/src
```

Beklenen: çıktı boş.

- [ ] **Adım 10: Tüm frontend testlerini ve tipleri çalıştır**

Çalıştır: `yarn workspace frontend test`
Beklenen: PASS.

Çalıştır: `yarn workspace frontend exec tsc --noEmit`
Beklenen: hata yok.

- [ ] **Adım 11: Commit**

```bash
git add -A
git commit -m "feat(map): draw labels as pooled dom elements"
```

---

### Task 5: Histerezis ve geçiş

**Dosyalar:**

- Değiştir: `frontend/src/utils/map/labels.ts` (`placeLabels` ikinci argüman)
- Değiştir: `frontend/src/utils/map/labels.spec.ts`
- Değiştir: `frontend/src/components/UniverseMap/UniverseMap.tsx` (sticky ref)
- Değiştir: `frontend/src/app/map.css` (opacity geçişi)

**Arayüzler:**

- Üretir: `placeLabels(candidates, sticky?: ReadonlySet<string>)`.

- [ ] **Adım 1: Düşen testi yaz**

`frontend/src/utils/map/labels.spec.ts` içindeki `placeLabels` describe bloğuna ekle:

```ts
it('berabere kalan bir çakışmada ekranda zaten olanı tutuyor', () => {
  // Aynı noktada iki isim: sıraya göre A kazanır.
  const a: LabelCandidate = {
    key: 'system:1',
    name: 'A',
    tier: 'system',
    screenX: 100,
    screenY: 100,
    halfWidth: 20,
    halfHeight: 5,
  };
  const b: LabelCandidate = { ...a, key: 'system:2', name: 'B' };

  expect(placeLabels([a, b]).map((c) => c.key)).toEqual(['system:1']);

  // B bir önceki karede yerleşmişse, bu karede de o kalır.
  expect(placeLabels([a, b], new Set(['system:2'])).map((c) => c.key)).toEqual([
    'system:2',
  ]);
});

it('sticky bir aday artık aday değilse etkisi kalmıyor', () => {
  const a: LabelCandidate = {
    key: 'system:1',
    name: 'A',
    tier: 'system',
    screenX: 100,
    screenY: 100,
    halfWidth: 20,
    halfHeight: 5,
  };

  expect(placeLabels([a], new Set(['system:99'])).map((c) => c.key)).toEqual([
    'system:1',
  ]);
});

it('sticky adaylar kendi aralarında yine kademe sırasını koruyor', () => {
  const region: LabelCandidate = {
    key: 'region:1',
    name: 'R',
    tier: 'region',
    screenX: 100,
    screenY: 100,
    halfWidth: 20,
    halfHeight: 9,
  };
  const system: LabelCandidate = {
    key: 'system:1',
    name: 'S',
    tier: 'system',
    screenX: 100,
    screenY: 100,
    halfWidth: 20,
    halfHeight: 5,
  };

  const placed = placeLabels(
    [region, system],
    new Set(['region:1', 'system:1']),
  );

  expect(placed.map((c) => c.key)).toEqual(['region:1']);
});
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labels.spec.ts`
Beklenen: FAIL — `placeLabels` ikinci argümanı yok, ilk assertion `['system:1']` dönüyor.

- [ ] **Adım 3: `placeLabels`'ı iki geçişe çevir**

```ts
/**
 * Greedy, in the order given, with the previous frame's survivors going first.
 *
 * O(n*k) with k the number already placed. k is capped at MAX_VISIBLE_LABELS and
 * the viewport clip has already cut n, so the worst case is nothing in a frame.
 *
 * `sticky` is what stops the flicker. Placement is recomputed from scratch on
 * every camera change, so two names whose boxes nearly tie were resolved
 * differently from one frame to the next and blinked against each other. Giving
 * the ones already on screen the first pass makes the tie resolve the same way
 * it resolved last time — and a candidate that has left the viewport or its
 * tier simply is not in the list any more, so the set needs no expiry of its
 * own.
 *
 * Within each pass the tier order is untouched: a sticky system name still
 * yields to a sticky region name.
 *
 * The input is not mutated; the caller keeps its candidate list.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  sticky: ReadonlySet<string> = EMPTY_STICKY,
): LabelCandidate[] {
  const placed: LabelCandidate[] = [];

  const consider = (candidate: LabelCandidate) => {
    if (placed.length >= MAX_VISIBLE_LABELS) return;
    if (placed.some((other) => overlaps(candidate, other))) return;
    placed.push(candidate);
  };

  for (const candidate of candidates) {
    if (sticky.has(candidate.key)) consider(candidate);
  }
  for (const candidate of candidates) {
    if (!sticky.has(candidate.key)) consider(candidate);
  }

  return placed;
}
```

Dosyanın üstüne, `overlaps`'ın yanına:

```ts
/** Shared empty set, so the default argument mints nothing per frame. */
const EMPTY_STICKY: ReadonlySet<string> = new Set();
```

Dönen dizinin artık kademe sırasında olmadığına dikkat: sticky olanlar önde. `drawLabels` sırayı kullanmıyor (her eleman kendi `transform`'unu alıyor), yığılma sırası da DOM'a ekleniş sırası — yani ilk görünme sırası — olarak kalıyor.

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labels.spec.ts`
Beklenen: PASS.

- [ ] **Adım 5: `UniverseMap.tsx`'te sticky kümesini tut**

`labelLayer` ref'inin yanına:

```ts
// The keys placed last frame. A ref rather than state: it is read and written
// inside the label effect and must never itself trigger a render.
const stickyLabels = useRef<Set<string>>(new Set());
```

Etiket efektinin sonunu değiştir:

```ts
if (tiers.length === 0) {
  drawLabels(layer, []);
  stickyLabels.current = new Set();
  return;
}

const candidates = labelCandidates({ … });
const placed = placeLabels(candidates, stickyLabels.current);
stickyLabels.current = new Set(placed.map((candidate) => candidate.key));
drawLabels(layer, placed);
```

- [ ] **Adım 6: Geçişi CSS'e ekle**

`frontend/src/app/map.css` içinde `.map-label` kuralına ekle:

```css
opacity: 0;
/* Visibility transitions discretely, so it flips at the end going out and at
     the start coming in — which is what keeps a faded-out name from catching a
     click on its way to zero. */
transition:
  opacity 150ms ease-out,
  visibility 150ms;
```

Ve:

```css
.map-label.is-visible {
  opacity: 1;
}
```

`.map-label:not(.is-visible) { visibility: hidden; }` kuralı yerinde kalıyor.

- [ ] **Adım 7: Testleri ve tipleri çalıştır**

Çalıştır: `yarn workspace frontend test`
Beklenen: PASS.

Çalıştır: `yarn workspace frontend exec tsc --noEmit`
Beklenen: hata yok.

- [ ] **Adım 8: Commit**

```bash
git add frontend/src/utils/map/labels.ts frontend/src/utils/map/labels.spec.ts frontend/src/components/UniverseMap/UniverseMap.tsx frontend/src/app/map.css
git commit -m "feat(map): keep placed labels placed across camera moves"
```

---

### Task 6: Bölge medoid'i ve extent'i (backend)

**Dosyalar:**

- Değiştir: `backend/src/services/universe/map-labels.service.ts`
- Değiştir: `backend/src/services/universe/map-labels.service.spec.ts`
- Değiştir: `backend/src/schemas/UniverseMap.graphql`

**Arayüzler:**

- Üretir: `MapLabel { systemId: Int, bounds: MapBounds }` — Task 7 bunu tüketiyor.

- [ ] **Adım 1: Düşen testleri yaz**

`backend/src/services/universe/map-labels.service.spec.ts` içindeki bölge sorgusu testlerini değiştir. `AVG` bekleyen iki assertion (`spec:146-147`) siliniyor, yerine:

```ts
it('bölge sorgusu extent ve medoid hesaplıyor, ortalama değil', async () => {
  await getMapLabels('NEW_EDEN', 'REGION');

  const sql = lastQueryText();
  expect(sql).toContain('MIN(x)');
  expect(sql).toContain('MAX(x)');
  expect(sql).toContain('MIN(z)');
  expect(sql).toContain('MAX(z)');
  expect(sql).toContain('DISTINCT ON (a.region_id)');
  expect(sql).not.toContain('AVG');
});

it('tek sistemli bir bölgenin medoid’i düşmesin diye LEFT JOIN kullanıyor', async () => {
  await getMapLabels('NEW_EDEN', 'REGION');

  const sql = lastQueryText();
  expect(sql).toContain('LEFT JOIN scene b');
  expect(sql).toContain('COALESCE(SUM(');
});

it('bölge satırını systemId ve bounds ile eşliyor', async () => {
  queueRows([
    {
      id: 10000002,
      name: 'The Forge',
      system_id: 30000142,
      x: 1,
      z: 2,
      min_x: -10,
      max_x: 10,
      min_z: -20,
      max_z: 20,
    },
  ]);

  const [label] = await getMapLabels('NEW_EDEN', 'REGION');

  expect(label).toEqual({
    id: 10000002,
    name: 'The Forge',
    kind: 'REGION',
    x: 1,
    z: 2,
    systemId: 30000142,
    bounds: { minX: -10, maxX: 10, minZ: -20, maxZ: 20 },
  });
});

it('takımyıldız satırında systemId ve bounds null', async () => {
  queueRows([{ id: 20000020, name: 'Kimotoro', x: 1, z: 2 }]);

  const [label] = await getMapLabels('NEW_EDEN', 'CONSTELLATION');

  expect(label.systemId).toBeNull();
  expect(label.bounds).toBeNull();
});
```

`queueRows` ve `lastQueryText` bu spec'te zaten var; yoksa mevcut mock yardımcılarının adlarını kullan (dosyanın başındaki `$queryRaw` mock'una bak) ve testleri ona göre yaz.

Cache anahtarı testine ekle:

```ts
it('anahtar satır şekli değiştiği için sürümlendi', () => {
  expect(labelsCacheKey('NEW_EDEN', 'REGION')).toBe(
    'map:labels:v2:NEW_EDEN:REGION',
  );
});
```

- [ ] **Adım 2: Testleri çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace backend test src/services/universe/map-labels.service.spec.ts`
Beklenen: FAIL — sorguda `AVG` var, anahtar `v2` değil.

- [ ] **Adım 3: Servisi değiştir**

`backend/src/services/universe/map-labels.service.ts`:

Satır tipini ve dönüş tipini genişlet:

```ts
export interface MapLabelBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapLabel {
  id: number;
  name: string;
  kind: MapLabelKind;
  x: number;
  z: number;
  /** REGION only: the medoid the name is anchored to. Null on a constellation. */
  systemId: number | null;
  /** REGION only: the extent of the region's drawn systems. Null otherwise. */
  bounds: MapLabelBounds | null;
}

interface LabelRow {
  id: number;
  name: string;
  x: number;
  z: number;
  system_id?: number | null;
  min_x?: number | null;
  max_x?: number | null;
  min_z?: number | null;
  max_z?: number | null;
}
```

Cache anahtarını sürümle:

```ts
/**
 * `v2` because the region row grew a medoid and an extent. Without the bump a
 * deploy would keep serving yesterday's shape — no bounds, no systemId — for up
 * to LABELS_CACHE_TTL_SECONDS, and the client would hide every region name
 * because none of them would pass the fit rule.
 */
export function labelsCacheKey(scope: MapScope, kind: MapLabelKind): string {
  return `map:labels:v2:${scope}:${kind}`;
}
```

Bölge sorgusunu değiştir (takımyıldız dalı aynı kalıyor):

```ts
// A region has a name and nothing else, so both the anchor and the extent are
// derived from the systems this scene actually draws.
//
// The anchor is the MEDOID — the region's own system whose total distance to
// the others is smallest — not the mean position. A mean can land outside a
// concave region: measured 2026-09-15, 12 of 114 regions had the star nearest
// their centroid belonging to a DIFFERENT region, Delve and The Citadel among
// them. A medoid is by definition one of the region's own stars, so that
// failure stops being possible rather than merely rare. It costs 191 ms for
// all 114 regions, paid once per LABELS_CACHE_TTL_SECONDS.
//
// LEFT JOIN, not JOIN: three regions hold exactly one system, and an inner
// join would produce no pair for them and drop their names off the map
// entirely. COALESCE gives the lone system a total distance of 0, which makes
// it its own medoid.
return Prisma.sql`
    WITH scene AS (
      SELECT r.region_id, r.name, s.system_id,
             s.position_x AS x, s.position_z AS z
      FROM regions r
      JOIN constellations c ON c.region_id = r.region_id
      JOIN solar_systems s ON s.constellation_id = c.constellation_id
      WHERE ${scene}
        AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL
        ${gateless}
    ),
    extent AS (
      SELECT region_id, name,
             MIN(x) AS min_x, MAX(x) AS max_x,
             MIN(z) AS min_z, MAX(z) AS max_z
      FROM scene
      GROUP BY region_id, name
    ),
    medoid AS (
      SELECT DISTINCT ON (a.region_id)
             a.region_id, a.system_id, a.x, a.z
      FROM scene a
      LEFT JOIN scene b
        ON b.region_id = a.region_id AND b.system_id <> a.system_id
      GROUP BY a.region_id, a.system_id, a.x, a.z
      ORDER BY a.region_id,
               COALESCE(SUM(sqrt(power(a.x - b.x, 2) + power(a.z - b.z, 2))), 0)
    )
    SELECT e.region_id AS id, e.name, m.system_id, m.x, m.z,
           e.min_x, e.max_x, e.min_z, e.max_z
    FROM extent e
    JOIN medoid m ON m.region_id = e.region_id
    ORDER BY id
  `;
```

Satır eşlemesini değiştir:

```ts
const labels: MapLabel[] = rows.map((row) => ({
  id: Number(row.id),
  name: row.name,
  kind,
  x: Number(row.x),
  z: Number(row.z),
  // Null rather than undefined: this object is what JSON.stringify writes into
  // Redis, and an undefined field would simply vanish from the cached row.
  systemId: row.system_id == null ? null : Number(row.system_id),
  bounds:
    row.min_x == null
      ? null
      : {
          minX: Number(row.min_x),
          maxX: Number(row.max_x),
          minZ: Number(row.min_z),
          maxZ: Number(row.max_z),
        },
}));
```

- [ ] **Adım 4: Şemayı değiştir**

`backend/src/schemas/UniverseMap.graphql` içindeki `MapLabel` tipine iki alan ekle:

```graphql
  "Yalnızca REGION: ismin çapalandığı medoid sistemi. Yarıçapı istemci mapGeometry'den okur."
  systemId: Int
  "Yalnızca REGION: bölgenin çizilen sistemlerinin sınırları. İsmin görünürlük eşiği buradan."
  bounds: MapBounds
```

Tipin doc-string'indeki "Bölgede konum yok ve sahnenin çizdiği sistemlerin ortalamasından hesaplanıyor" cümlesini güncelle: artık ortalama değil, medoid.

- [ ] **Adım 5: Codegen ve testler**

Çalıştır: `yarn workspace backend codegen`
Beklenen: `generated-types.ts` ve `generated-schema.graphql` güncelleniyor.

Çalıştır: `yarn workspace backend test src/services/universe/map-labels.service.spec.ts`
Beklenen: PASS.

Çalıştır: `yarn workspace backend build`
Beklenen: hata yok.

- [ ] **Adım 6: Sorguyu gerçek veritabanında doğrula**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT COUNT(*) FROM regions;"
```

Sonra backend'i çalıştırıp (`yarn dev:backend`) sorgula:

```bash
curl -s localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ mapLabels(scope: NEW_EDEN, kind: REGION) { id name systemId bounds { minX maxX minZ maxZ } } }"}' \
  | head -c 600
```

Beklenen: her satırda dolu `systemId` ve dört sınır; bölge sayısı `SELECT COUNT(*)`'ın New Eden kısmıyla tutarlı ve tek sistemli bölgeler listede.

- [ ] **Adım 7: Commit**

```bash
git add backend/src/services/universe/map-labels.service.ts backend/src/services/universe/map-labels.service.spec.ts backend/src/schemas/UniverseMap.graphql backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(map): anchor region labels on the medoid and return the extent"
```

---

### Task 7: Bölge görünürlüğü ve kenetleme (frontend)

**Dosyalar:**

- Değiştir: `frontend/src/graphql/MapLabels.graphql`
- Değiştir: `frontend/src/utils/map/labels.ts`
- Değiştir: `frontend/src/utils/map/labels.spec.ts`
- Değiştir: `frontend/src/components/UniverseMap/UniverseMap.tsx`

**Arayüzler:**

- Tüketir: `MapLabel.systemId`, `MapLabel.bounds` (Task 6).
- Üretir: `LabelSource.bounds`, `REGION_FIT_RATIO`.

- [ ] **Adım 1: Belgeyi büyüt ve codegen çalıştır**

`frontend/src/graphql/MapLabels.graphql`:

```graphql
query MapLabels($scope: MapScope!, $kind: MapLabelKind!) {
  mapLabels(scope: $scope, kind: $kind) {
    id
    name
    kind
    x
    z
    systemId
    bounds {
      minX
      maxX
      minZ
      maxZ
    }
  }
}
```

Dosyanın başındaki operasyon adı yorumu olduğu gibi kalıyor.

Çalıştır: `yarn workspace frontend codegen`
Beklenen: `frontend/src/generated/graphql.ts` güncelleniyor.

- [ ] **Adım 2: Düşen testleri yaz**

`frontend/src/utils/map/labels.spec.ts`'e yeni bir describe ekle:

```ts
describe('bölge extent kuralı', () => {
  const bounds = { minX: -1e16, maxX: 1e16, minZ: -1e16, maxZ: 1e16 };

  it('bölge ismi kendi genişliğine sığmıyorsa çizilmiyor', () => {
    // Ölçer ismi 1000 px sayıyor; bölge bu transform'da çok daha dar.
    const huge: LabelMeasure = () => 1000;

    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'The Forge', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: huge,
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toEqual([]);
  });

  it('sığdığında çiziliyor', () => {
    const small: LabelMeasure = () => 4;

    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'The Forge', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: small,
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toHaveLength(1);
  });

  it('bounds yoksa kural uygulanmıyor', () => {
    const huge: LabelMeasure = () => 1000;

    const candidates = labelCandidates({
      tiers: ['constellation'],
      regions: [],
      constellations: [{ id: 1, name: 'Kimotoro', x: 0, z: 0 }],
      systems: [],
      measure: huge,
      transform,
      width: W,
      height: H,
    });

    expect(candidates).toHaveLength(1);
  });
});

describe('viewport kenetleme', () => {
  const bounds = { minX: -1e17, maxX: 1e17, minZ: -1e17, maxZ: 1e17 };

  it('merkezi ekran dışında kalan bir bölgenin ismini görünen parçada tutuyor', () => {
    // Merkez soldan dışarıda; kutu hâlâ ekranı kesiyor.
    const offscreen = { ...transform, x: -5000 };

    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform: offscreen,
      width: W,
      height: H,
    });

    expect(c).toBeDefined();
    expect(c.screenX).toBeGreaterThanOrEqual(c.halfWidth);
    expect(c.screenX).toBeLessThanOrEqual(W - c.halfWidth);
  });

  it('merkez ekrandayken konumu değiştirmiyor', () => {
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [{ id: 1, name: 'R', x: 0, z: 0, bounds }],
      constellations: [],
      systems: [],
      measure: () => 20,
      transform,
      width: W,
      height: H,
    });

    expect(c.screenX).toBeCloseTo(700, 6);
  });
});
```

- [ ] **Adım 3: Testleri çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labels.spec.ts`
Beklenen: FAIL — `bounds` bilinmeyen özellik.

- [ ] **Adım 4: `labels.ts`'i değiştir**

`LabelSource`'a ekle:

```ts
export interface LabelBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LabelSource {
  id: number;
  name: string;
  x: number;
  z: number;
  /**
   * The system's own radius in metres, for a name with a mark under it. Absent
   * for a source with nothing drawn at its anchor.
   */
  radius?: number;
  /**
   * The area this name covers, for an area name. Absent for a point name, whose
   * anchor is the thing itself.
   */
  bounds?: LabelBounds;
}
```

Sabiti ekle:

```ts
/**
 * How much of its own name a region must be able to cover before it is named,
 * as a fraction of the name's width.
 *
 * A strict "the name must fit" rule would name nothing: at REGION_LABEL_ZOOM a
 * region spans about the 60 px that separates it from its neighbour, while
 * "Sinq Laison" sets 129 px wide. At 0.8 a region is named once it is nearly as
 * wide as its own name, which is what makes big regions open before small ones
 * instead of all of them opening at one zoom.
 *
 * A judgement, not a measurement. Tune by looking.
 */
export const REGION_FIT_RATIO = 0.8;
```

Aday döngüsünde, projeksiyondan sonra ve clip'ten önce:

```ts
// Task 3'teki `const halfWidth = measure(tier, source.name) / 2;` satırının yerine:
const textWidth = measure(tier, source.name);
const halfWidth = textWidth / 2;

let screenX = source.x * transform.scaleX + transform.x;
let screenY = source.z * transform.scaleY + transform.y - lift;

if (source.bounds) {
  // An area name earns its place from the area, not from the zoom: it appears
  // when the region can nearly cover its own name, and stays hidden while it
  // would spill across its neighbours.
  const boxLeft = source.bounds.minX * transform.scaleX + transform.x;
  const boxRight = source.bounds.maxX * transform.scaleX + transform.x;
  if (boxRight - boxLeft < REGION_FIT_RATIO * textWidth) continue;

  // scaleY is negative, so maxZ projects to the SMALLER screen y.
  const boxTop = source.bounds.maxZ * transform.scaleY + transform.y;
  const boxBottom = source.bounds.minZ * transform.scaleY + transform.y;

  // Clamped into whatever of the area is on screen, so panning past the centre
  // slides the name along the edge instead of dropping it. Clamping rather than
  // re-centring on the intersection: a clamp is monotone, so the name slides
  // where a re-centre would jump.
  screenX = clamp(
    screenX,
    Math.max(boxLeft, 0) + halfWidth,
    Math.min(boxRight, width) - halfWidth,
  );
  screenY = clamp(
    screenY,
    Math.max(boxTop, 0) + halfHeight,
    Math.min(boxBottom, height) - halfHeight,
  );
}
```

Dosyanın altına yardımcıyı ekle:

```ts
/**
 * Clamped into [low, high], and pinned to `low` when the range has collapsed —
 * a box narrower than the name it holds has no valid position, and the near
 * edge is a better answer than an inverted one.
 */
function clamp(value: number, low: number, high: number): number {
  if (high < low) return low;
  return Math.min(Math.max(value, low), high);
}
```

- [ ] **Adım 5: Testleri çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/utils/map/labels.spec.ts`
Beklenen: PASS.

- [ ] **Adım 6: `UniverseMap.tsx`'te bölge kaynaklarını besle**

`labelSystems` useMemo'sunun altına, düğüm yarıçaplarını id'den okumak için:

```ts
// The medoid's drawn radius, looked up rather than fetched: the region label's
// clearance then uses the very number the renderer uses for that dot.
const radiusBySystem = useMemo(
  () =>
    new Map(
      (geometry?.nodes ?? []).map((node) => [node.systemId, node.radius]),
    ),
  [geometry],
);

const regionSources = useMemo(
  () =>
    regions.map((label) => ({
      id: label.id,
      name: label.name,
      x: label.x,
      z: label.z,
      radius:
        label.systemId == null ? undefined : radiusBySystem.get(label.systemId),
      bounds: label.bounds ?? undefined,
    })),
  [regions, radiusBySystem],
);
```

Etiket efektinde `regions` yerine `regionSources` geçir ve dependency dizisinde `regions`'ı `regionSources` ile değiştir.

- [ ] **Adım 7: Testleri ve tipleri çalıştır**

Çalıştır: `yarn workspace frontend test`
Beklenen: PASS.

Çalıştır: `yarn workspace frontend exec tsc --noEmit`
Beklenen: hata yok.

- [ ] **Adım 8: Commit**

```bash
git add frontend/src/graphql/MapLabels.graphql frontend/src/generated/graphql.ts frontend/src/utils/map/labels.ts frontend/src/utils/map/labels.spec.ts frontend/src/components/UniverseMap/UniverseMap.tsx
git commit -m "feat(map): show a region name when the region can carry it"
```

---

### Task 8: İsimleri tıklanabilir yap

**Dosyalar:**

- Değiştir: `frontend/src/components/UniverseMap/useMapPointer.ts`
- Değiştir: `frontend/src/components/UniverseMap/useMapPointer.spec.ts`
- Değiştir: `frontend/src/utils/map/pick.ts`
- Değiştir: `frontend/src/utils/map/pick.spec.ts`
- Değiştir: `frontend/src/components/UniverseMap/UniverseMap.tsx`

**Arayüzler:**

- Üretir: `pickById(nodes, systemId, transform)`, `MapPick.onHoverSystem`, `MapPick.onSelectSystem`.
- `useMapPointer`'ın ilk argümanı `SceneCanvas | null` yerine `HTMLElement | null` (host) oluyor.

- [ ] **Adım 1: `pickById` için düşen testi yaz**

`frontend/src/utils/map/pick.spec.ts`'in import listesine `pickById` ekle
(`pickSystem`'in yanına), sonra dosyaya yeni describe'ı ekle:

```ts
describe('pickById', () => {
  const nodes = [
    {
      systemId: 30000142,
      name: 'Jita',
      x: 1e16,
      z: 2e16,
      radius: 0,
      securityStatus: 0.94,
    },
  ];
  const transform = { scaleX: 2 ** -50, scaleY: -(2 ** -50), x: 700, y: 450 };

  it('düğümü id ile bulup pickSystem ile aynı şekli döndürüyor', () => {
    const target = pickById(nodes, 30000142, transform)!;

    expect(target.node.name).toBe('Jita');
    expect(target.screenX).toBeCloseTo(1e16 * transform.scaleX + 700, 6);
    expect(target.screenY).toBeCloseTo(2e16 * transform.scaleY + 450, 6);
  });

  it('bilinmeyen id için null', () => {
    expect(pickById(nodes, 1, transform)).toBeNull();
  });
});
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/utils/map/pick.spec.ts`
Beklenen: FAIL — `pickById` export edilmiyor.

- [ ] **Adım 3: `pickById`'yi yaz**

`frontend/src/utils/map/pick.ts` sonuna:

```ts
/**
 * The same PickTarget a hit test would produce, for a system already known by
 * id — a label click, where WHAT was clicked is not in doubt and only its
 * position still has to be computed.
 *
 * Linear over the node list, and deliberately not indexed: it runs on a click,
 * not on a pointermove.
 */
export function pickById(
  nodes: PickNode[],
  systemId: number,
  transform: CameraTransform,
): PickTarget | null {
  const node = nodes.find((candidate) => candidate.systemId === systemId);
  if (!node) return null;

  return {
    node,
    screenX: node.x * transform.scaleX + transform.x,
    screenY: node.z * transform.scaleY + transform.y,
  };
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `yarn workspace frontend test src/utils/map/pick.spec.ts`
Beklenen: PASS.

- [ ] **Adım 5: Pointer testlerini yaz**

`frontend/src/components/UniverseMap/useMapPointer.spec.ts`'e ekle (mevcut yardımcıları kullanarak; hook artık host elemanı alıyor):

```ts
describe('etiket hedefleri', () => {
  function hostWithLabel() {
    const host = document.createElement('div');
    const label = document.createElement('span');
    label.dataset.mapSystem = '30000142';
    host.appendChild(label);
    document.body.appendChild(host);
    return { host, label };
  }

  it('bir ismin üstündeki tıklama sistemi id ile seçiyor', () => {
    const { host, label } = hostWithLabel();
    const onSelectSystem = vi.fn();
    const onSelect = vi.fn();
    renderHook(() =>
      useMapPointer(host, camera, limits, onCameraChange, {
        onHover: vi.fn(),
        onHoverSystem: vi.fn(),
        onSelect,
        onSelectSystem,
      }),
    );

    label.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 10, clientY: 10 }),
    );
    label.dispatchEvent(
      pointerEvent('pointerup', { clientX: 10, clientY: 10 }),
    );

    expect(onSelectSystem).toHaveBeenCalledWith(30000142);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('bir isimden başlayan sürükleme kamerayı kaydırıyor', () => {
    const { host, label } = hostWithLabel();
    const onCameraChange = vi.fn();
    renderHook(() => useMapPointer(host, camera, limits, onCameraChange, pick));

    label.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 10, clientY: 10 }),
    );
    label.dispatchEvent(
      pointerEvent('pointermove', { clientX: 60, clientY: 10 }),
    );

    expect(onCameraChange).toHaveBeenCalled();
  });

  it('bir ismin üstünde hover id ile bildiriliyor', async () => {
    const { host, label } = hostWithLabel();
    const onHoverSystem = vi.fn();
    renderHook(() =>
      useMapPointer(host, camera, limits, onCameraChange, {
        onHover: vi.fn(),
        onHoverSystem,
        onSelect: vi.fn(),
        onSelectSystem: vi.fn(),
      }),
    );

    label.dispatchEvent(
      pointerEvent('pointermove', { clientX: 10, clientY: 10 }),
    );
    await animationFrame();

    expect(onHoverSystem).toHaveBeenCalledWith(30000142);
  });
});
```

`pointerEvent` ve `animationFrame` yardımcıları spec'te yoksa, mevcut testlerin olay üretme biçimini birebir izle.

- [ ] **Adım 6: Testleri çalıştır, düştüğünü gör**

Çalıştır: `yarn workspace frontend test src/components/UniverseMap/useMapPointer.spec.ts`
Beklenen: FAIL.

- [ ] **Adım 7: `useMapPointer`'ı host'a taşı**

`MapPick` arayüzünü büyüt:

```ts
export interface MapPick {
  /** Null means "nothing to hover": the pointer left, or a drag started. */
  onHover: (at: PointerPosition | null) => void;
  /** A label was hovered, so the system is known without a hit test. */
  onHoverSystem: (systemId: number) => void;
  onSelect: (at: PointerPosition) => void;
  /** A label was clicked. */
  onSelectSystem: (systemId: number) => void;
}
```

İmzayı değiştir — `SceneCanvas` tipi ve import'u siliniyor:

```ts
/**
 * Bound to the HOST, not to the canvas.
 *
 * The label overlay sits above the canvas and its system names take pointer
 * events, so a press or a wheel that starts on a name never reaches the canvas
 * at all — the map would freeze exactly where it is labelled. Listening on the
 * host puts every one of those events back in reach, because they bubble out of
 * the label to it. The canvas fills the host, so `getBoundingClientRect` reports
 * the same box a canvas-bound version read.
 */
export function useMapPointer(
  host: HTMLElement | null,
  camera: MapCamera | null,
  limits: ZoomLimits | null,
  onCameraChange: (next: MapCamera) => void,
  pick?: MapPick,
): void {
```

Gövde içinde her `canvas` kullanımını `host` yap (`canvasPosition`, beş `addEventListener`, beş `removeEventListener`, `wheel`'deki `getBoundingClientRect`, ve efektin dependency dizisi).

`up` ve `move` handler'larına etiket kestirmesini ekle:

```ts
/**
 * The system a pointer event landed on by way of a label, or null.
 *
 * One picking path with one drag-tolerance rule, not two: the shortcut answers
 * WHAT was hit, and everything about WHETHER it counts as a click is unchanged
 * below.
 */
const labelSystemId = (e: Event): number | null => {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const label = target.closest('[data-map-system]');
  const raw =
    label instanceof HTMLElement ? label.dataset.mapSystem : undefined;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};
```

`up`:

```ts
const up = (e: PointerEvent) => {
  const wasDragging = dragging;
  dragging = false;
  if (!wasDragging || movedBeyondTolerance) return;

  const id = labelSystemId(e);
  if (id !== null) {
    pickRef.current?.onSelectSystem(id);
    return;
  }
  pickRef.current?.onSelect(canvasPosition(e));
};
```

`move`, sürükleme yokken:

```ts
if (!dragging) {
  const id = labelSystemId(e);
  if (id !== null) {
    scheduleHoverSystem(id);
    return;
  }
  scheduleHover(canvasPosition(e));
  return;
}
```

`scheduleHover`'ın yanına, aynı rAF kısıtlamasını paylaşan ikizi:

```ts
// The same single frame the coordinate hover uses, so moving between a label
// and the canvas cannot queue two reports for one frame.
let hoverSystemId: number | null = null;

const scheduleHoverSystem = (systemId: number) => {
  hoverAt = null;
  hoverSystemId = systemId;
  if (hoverFrame !== null) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = null;
    if (hoverSystemId !== null) pickRef.current?.onHoverSystem(hoverSystemId);
  });
};
```

`scheduleHover` içinde `hoverSystemId = null;` ve `cancelHover` içinde de `hoverSystemId = null;` ayarla; `hoverFrame` geri çağrısında `hoverAt` dalını `else if` olarak koru:

```ts
hoverFrame = requestAnimationFrame(() => {
  hoverFrame = null;
  if (hoverSystemId !== null) pickRef.current?.onHoverSystem(hoverSystemId);
  else if (hoverAt) pickRef.current?.onHover(hoverAt);
});
```

İki `schedule*` fonksiyonu aynı geri çağrıyı paylaştığı için tek bir tanım yeterli; `scheduleHover` ve `scheduleHoverSystem` yalnızca hangi alanı doldurduklarıyla ayrılıyor.

- [ ] **Adım 8: `UniverseMap.tsx`'i bağla**

`canvas` state'i artık pointer için gerekmiyor; `useMapPointer(canvas, …)` çağrısını değiştir:

```ts
useMapPointer(host, camera, limits, onCameraChange, pick);
```

`pick` useMemo'suna iki yeni alan:

```ts
return {
  onHover: (pointer) => setHovered(pointer ? at(pointer.x, pointer.y) : null),
  onHoverSystem: (systemId) =>
    setHovered(
      camera && size.width
        ? pickById(
            pickNodes,
            systemId,
            cameraTransform(camera, size.width, size.height),
          )
        : null,
    ),
  onSelect: (pointer) => {
    const target = at(pointer.x, pointer.y);
    setSelected(target ? target.node.systemId : null);
  },
  onSelectSystem: (systemId) => setSelected(systemId),
};
```

`pickById` import'unu ekle.

`canvas` state'ini sil: tek okuyucusu `useMapPointer` idi (`UniverseMap.tsx:454`).
Gidenler — `const [canvas, setCanvas] = useState<SceneCanvas | null>(null);`
(satır 80), sahne efektindeki `setCanvas(built.app.canvas);` (satır 230), temizlik
dalındaki `setCanvas(null);` ve `SceneCanvas` tip import'u. `useMapPointer.ts`
içindeki `SceneCanvas` tip tanımı da artık kimsenin işine yaramıyor; onu da sil.

`UniverseMap.spec.tsx`'te `canvas`'a dayanan bir assertion varsa host'a çevir —
Adım 9'daki test koşusu bunu gösterecek.

- [ ] **Adım 9: Testleri ve tipleri çalıştır**

Çalıştır: `yarn workspace frontend test`
Beklenen: PASS.

Çalıştır: `yarn workspace frontend exec tsc --noEmit`
Beklenen: hata yok.

- [ ] **Adım 10: Commit**

```bash
git add frontend/src/components/UniverseMap frontend/src/utils/map/pick.ts frontend/src/utils/map/pick.spec.ts
git commit -m "feat(map): make a system name a click target"
```

---

### Task 9: Tam doğrulama ve PR

**Dosyalar:** yok (yalnızca doğrulama).

- [ ] **Adım 1: Tüm takımı çalıştır**

```bash
yarn workspace backend codegen
yarn workspace backend build
yarn workspace frontend codegen
yarn test
yarn workspace frontend lint
yarn workspace frontend build
```

`lint` temiz çıkmıyor — 237 önceden var olan sorun bekleniyor. Sayıyı `main` ile karşılaştır ve hiçbirinin bu dalın dokunduğu bir dosyayı adlandırmadığını doğrula.

- [ ] **Adım 2: Biçimi doğrula**

```bash
npx prettier --check $(git diff --name-only main...HEAD)
```

Beklenen: `All matched files use Prettier code style!`

- [ ] **Adım 3: Codegen çıktısının temiz olduğunu doğrula**

```bash
git status --porcelain
```

Beklenen: boş. Kirliyse üretilen dosyalar commit edilmemiş demektir; ekle ve commit et.

- [ ] **Adım 4: Veriyi API'den doğrula**

`yarn dev:backend` açıkken:

```bash
curl -s localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ mapLabels(scope: NEW_EDEN, kind: REGION) { name systemId bounds { minX maxX } } }"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['data']['mapLabels']; print(len(d), 'bölge'); print('systemId boş:', [x['name'] for x in d if x['systemId'] is None]); print('bounds boş:', [x['name'] for x in d if x['bounds'] is None])"
```

Beklenen: bölge sayısı dolu, iki liste de boş.

- [ ] **Adım 5: Kullanıcıya görsel doğrulama için ne bakacağını söyle**

Rapor et — tarayıcı sürme, kullanıcı bakar:

- Hangi bölge isimleri hangi zoom'da açılıyor (küçük bölgeler daha geç açılmalı).
- Zoom'da isimler titriyor mu; fade akıcı mı.
- Bir bölge ismi komşu bölgenin üstünde duruyor mu.
- Bir sistem isminin üstüne gelince tip **noktanın** üstünde açılıyor mu; isme tıklayınca popup açılıyor mu.
- Bir isimden başlayan sürükleme haritayı kaydırıyor, ismin üstündeki tekerlek zoom yapıyor mu.

- [ ] **Adım 6: PR aç**

```bash
git push -u origin feat/map-dom-labels
```

PR gövdesi düz yazı bölümleriyle (#195/#196 biçimi): ne değişti, neden DOM, ölçülen sayılar (191 ms medoid, 114'te 12 bölge, 3 tek sistemli bölge), neyin kapsam dışı bırakıldığı.
