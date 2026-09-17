# `<img>` yerine `next/image`: `ui/EveImage` — uygulama planı

> **Agentic worker'lar için:** GEREKLİ ALT-SKILL: Bu planı görev görev
> uygulamak için `superpowers:subagent-driven-development` (önerilen) veya
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox
> (`- [ ]`) sözdizimiyle yazılmıştır.

**Hedef:** Uygulamadaki 59 `<img>` elemanını `next/image`'a taşımak; 50
evetech görselini tek bir `ui/EveImage` bileşeninin arkasına almak.

**Mimari:** URL kurma saf bir fonksiyona (`utils/eveImageUrl.ts`), çizim ve
fallback state'i bir istemci bileşenine (`components/ui/EveImage.tsx`) ayrılır.
Çağrı yerleri `kind` + `id` + `size` verir; çekim ölçüsü, yol şeması ve
render→icon fallback'i bileşenin içinde kalır. Haritalar ve yerel asset'ler
`EveImage`'a girmez, düz `<Image unoptimized>` takası olur.

**Teknoloji:** Next.js 16 App Router, React 19, TypeScript, Vitest 5 +
@testing-library/react, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-17-eve-image-component-design.md`

## Global kısıtlar

- **Yarn, asla npm.** `yarn test`, `yarn workspace frontend build`.
- **Her görsel `unoptimized`.** İstisna yok.
- **Görünüm değişmez.** Bu iş bittiğinde sayfalar bugünküyle piksel piksel
  aynı görünmeli; `className` dizeleri olduğu gibi taşınır.
- **Çekim ölçüsü kuralı:** `min(512, max(32, 2^⌈log₂(2·size)⌉))`. Görsel
  sunucusu yalnızca ikinin kuvvetlerini kabul eder (32–1024); `?size=100`
  **400** döner.
- **`priority` yalnızca tek bir yerde:** killmail detay sayfasının kurban
  gövdesi. Başka hiçbir görsel almaz.
- **Commit mesajları, PR başlıkları ve kod yorumları İngilizce.** Claude
  atıfı yok.
- **Prettier:** her commit öncesi `npx prettier --check <dokunulan dosyalar>`.

## Dosya yapısı

| Dosya                                          | Sorumluluk                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `frontend/src/utils/eveImageUrl.ts`            | **Yeni.** Saf URL kurucusu + çekim ölçüsü türetme. React yok.                                  |
| `frontend/src/utils/eveImageUrl.spec.ts`       | **Yeni.** Yukarıdakinin birim testleri.                                                        |
| `frontend/src/utils/itemType.ts`               | **Yeniden adlandırma** (`itemImageUrl.ts`'ten). Yalnızca `isBlueprint` ve `getItemName` kalır. |
| `frontend/src/utils/itemType.spec.ts`          | **Yeniden adlandırma.** `getItemImageUrl` blokları çıkar.                                      |
| `frontend/src/components/ui/EveImage.tsx`      | **Yeni.** `next/image` sarmalayıcısı + render→icon fallback state'i.                           |
| `frontend/src/components/ui/EveImage.spec.tsx` | **Yeni.**                                                                                      |
| 27 çağrı yeri dosyası                          | **Değişiklik.** `<img>` → `<EveImage>`.                                                        |
| 3 harita + 3 yerel asset dosyası               | **Değişiklik.** `<img>` → `<Image unoptimized>`.                                               |
| `frontend/next.config.ts`                      | **Değişiklik.** Ölü `images.remotePatterns` bloğu silinir.                                     |
| `CLAUDE.md`                                    | **Değişiklik.** Lint sayısı güncellenir.                                                       |

---

## Görev 1: URL kurucusu ve `itemType` ayrımı

**Dosyalar:**

- Oluştur: `frontend/src/utils/eveImageUrl.ts`
- Oluştur: `frontend/src/utils/eveImageUrl.spec.ts`
- Yeniden adlandır: `frontend/src/utils/itemImageUrl.ts` → `frontend/src/utils/itemType.ts`
- Yeniden adlandır: `frontend/src/utils/itemImageUrl.spec.ts` → `frontend/src/utils/itemType.spec.ts`

**Arayüzler:**

- Tüketir: yok.
- Üretir: `EveImageKind`, `fetchSize(size: number): number`,
  `eveImageUrl(args: EveImageUrlArgs): string`. `utils/itemType.ts`'ten
  `isBlueprint(itemType: any): boolean` ve
  `getItemName(itemType: any, singleton?: number): string` aynen sürer.

- [ ] **Adım 1: Başarısız testi yaz**

`frontend/src/utils/eveImageUrl.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { eveImageUrl, fetchSize } from './eveImageUrl';

describe('fetchSize', () => {
  it('asks for twice the drawn size, rounded up to a power of two', () => {
    expect(fetchSize(32)).toBe(64);
    expect(fetchSize(40)).toBe(128);
    expect(fetchSize(48)).toBe(128);
    expect(fetchSize(56)).toBe(128);
    expect(fetchSize(64)).toBe(128);
    expect(fetchSize(128)).toBe(256);
  });

  it('clamps to the range the image server serves this app', () => {
    // The server answers 400 to anything that is not a power of two
    // between 32 and 1024; 512 is the largest this app asks for.
    expect(fetchSize(1)).toBe(32);
    expect(fetchSize(16)).toBe(32);
    expect(fetchSize(256)).toBe(512);
    expect(fetchSize(4000)).toBe(512);
  });
});

describe('eveImageUrl', () => {
  it('builds the render for a ship and the icon on request', () => {
    expect(eveImageUrl({ kind: 'ship', id: 587, size: 64 })).toBe(
      'https://images.evetech.net/types/587/render?size=128',
    );
    expect(eveImageUrl({ kind: 'ship', id: 587, size: 64, icon: true })).toBe(
      'https://images.evetech.net/types/587/icon?size=128',
    );
  });

  it('builds the icon for an ordinary type', () => {
    expect(eveImageUrl({ kind: 'type', id: 1877, size: 32 })).toBe(
      'https://images.evetech.net/types/1877/icon?size=64',
    );
  });

  it('uses bp for a blueprint original and bpc for a copy', () => {
    expect(
      eveImageUrl({ kind: 'type', id: 787, size: 32, blueprint: true }),
    ).toBe('https://images.evetech.net/types/787/bp?size=64');
    expect(
      eveImageUrl({
        kind: 'type',
        id: 787,
        size: 32,
        blueprint: true,
        singleton: 2,
      }),
    ).toBe('https://images.evetech.net/types/787/bpc?size=64');
  });

  it('builds the portrait and the two logos', () => {
    expect(eveImageUrl({ kind: 'character', id: 95465499, size: 64 })).toBe(
      'https://images.evetech.net/characters/95465499/portrait?size=128',
    );
    expect(eveImageUrl({ kind: 'corporation', id: 98000001, size: 32 })).toBe(
      'https://images.evetech.net/corporations/98000001/logo?size=64',
    );
    expect(eveImageUrl({ kind: 'alliance', id: 99000001, size: 32 })).toBe(
      'https://images.evetech.net/alliances/99000001/logo?size=64',
    );
  });
});
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

```bash
cd frontend && ./node_modules/.bin/vitest run src/utils/eveImageUrl.spec.ts
```

Beklenen: `Failed to resolve import "./eveImageUrl"`.

- [ ] **Adım 3: Kurucuyu yaz**

`frontend/src/utils/eveImageUrl.ts`:

```ts
/**
 * Every image URL this app asks the EVE image server for.
 *
 * Pure, and deliberately free of the item shapes the callers hold: a
 * blueprint is passed in as a boolean rather than as an `itemType` to poke
 * at, so this file needs no `any` and can be tested without React.
 */

export type EveImageKind =
  | 'ship' // /types/{id}/render, or /icon once the render has 404'd
  | 'type' // /types/{id}/icon — /bp or /bpc for a blueprint
  | 'character' // /characters/{id}/portrait
  | 'corporation' // /corporations/{id}/logo
  | 'alliance'; // /alliances/{id}/logo

/** The server answers 400 to anything that is not a power of two, and 512 is
 *  the largest size this app draws. Verified 2026-09-17. */
const MIN_FETCH = 32;
const MAX_FETCH = 512;

/**
 * The size to request for an image drawn at `size` CSS pixels: twice it, for
 * a high-density display, rounded up to a power of two and clamped to what
 * the server serves. The doubling lives here so that no call site repeats it.
 */
export const fetchSize = (size: number): number => {
  const wanted = 2 ** Math.ceil(Math.log2(Math.max(1, size) * 2));
  return Math.min(MAX_FETCH, Math.max(MIN_FETCH, wanted));
};

export interface EveImageUrlArgs {
  kind: EveImageKind;
  id: number;
  /** The drawn size in CSS pixels, square. The fetch size is derived. */
  size: number;
  /** `type` only: 2 is a blueprint copy, anything else an original. */
  singleton?: number;
  /** `type` only: the caller's `isBlueprint(itemType)`. */
  blueprint?: boolean;
  /** `ship` only: ask for the icon rather than the render. */
  icon?: boolean;
}

export const eveImageUrl = ({
  kind,
  id,
  size,
  singleton = 1,
  blueprint = false,
  icon = false,
}: EveImageUrlArgs): string => {
  const s = fetchSize(size);

  switch (kind) {
    case 'ship':
      return `https://images.evetech.net/types/${id}/${icon ? 'icon' : 'render'}?size=${s}`;
    case 'type':
      if (blueprint) {
        return `https://images.evetech.net/types/${id}/${singleton === 2 ? 'bpc' : 'bp'}?size=${s}`;
      }
      return `https://images.evetech.net/types/${id}/icon?size=${s}`;
    case 'character':
      return `https://images.evetech.net/characters/${id}/portrait?size=${s}`;
    case 'corporation':
      return `https://images.evetech.net/corporations/${id}/logo?size=${s}`;
    case 'alliance':
      return `https://images.evetech.net/alliances/${id}/logo?size=${s}`;
  }
};
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

```bash
cd frontend && ./node_modules/.bin/vitest run src/utils/eveImageUrl.spec.ts
```

Beklenen: 6 test geçer.

- [ ] **Adım 5: `itemImageUrl.ts`'i `itemType.ts` olarak yeniden adlandır**

```bash
cd frontend
git mv src/utils/itemImageUrl.ts src/utils/itemType.ts
git mv src/utils/itemImageUrl.spec.ts src/utils/itemType.spec.ts
```

`src/utils/itemType.ts` içinden `getItemImageUrl`'ün tamamını sil — gövdesindeki
iki `console.log` bloğu da onunla gider. Dosyanın başlık yorumunu değiştir:

```ts
/**
 * Facts about an EVE item type: whether it is a blueprint, and what to call
 * it. The image URL that used to live here is `utils/eveImageUrl.ts` now,
 * which is why this file no longer has "ImageUrl" in its name.
 */
```

`src/utils/itemType.spec.ts` içinden `describe('getItemImageUrl', …)` bloğunu
ve artık kullanılmayan `vi` / `beforeAll` / `afterAll` `console.log` casusunu
sil; import satırı şu hâle gelir:

```ts
import { describe, expect, it } from 'vitest';

import { getItemName, isBlueprint } from './itemType';
```

- [ ] **Adım 6: `eveImageUrl.ts`'e tek bir geçici shim ekle**

`getItemImageUrl`'ün altı çağrısı var ve hepsi 5. görevde `EveImage`'a
dönüşecek. Arada kalan commit'lerin derlenmesi için `eveImageUrl.ts`'in
sonuna tek bir sarmalayıcı ekle — ikinci bir tane yazma:

```ts
/**
 * Temporary: the six call sites that still build their own <img> src. Task 5
 * replaces all of them with <EveImage> and deletes this along with them.
 *
 * `size` here is the fetch size the old getItemImageUrl took, so it is halved
 * back into a drawn size before `eveImageUrl` doubles it again — which keeps
 * every one of those six URLs byte for byte what it is today.
 */
export const legacyItemImageUrl = (
  itemType: { id?: number | null } | null | undefined,
  singleton: number = 1,
  size: number = 64,
  blueprint: boolean = false,
): string => {
  if (!itemType?.id) return '';
  return eveImageUrl({
    kind: 'type',
    id: itemType.id,
    size: size / 2,
    singleton,
    blueprint,
  });
};
```

- [ ] **Adım 7: Altı çağrı yerini shim'e ve yeni import yoluna bağla**

Şu altı satırda `getItemImageUrl(x, y, z)` → `legacyItemImageUrl(x, y, z, isBlueprint(x))`:

| Dosya:satır                                          | bugünkü çağrı                                        |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `components/FitScreen/Slot.tsx:60`                   | `getItemImageUrl(...)`                               |
| `components/FitScreen/Slot.tsx:81`                   | `getItemImageUrl(...)`                               |
| `components/FitScreen/ImplantSlot.tsx:22`            | `getItemImageUrl(...)`                               |
| `components/FitScreen/ServiceSlot.tsx:22`            | `getItemImageUrl(...)`                               |
| `components/KillmailSummaryCard/FittingItem.tsx:145` | `getItemImageUrl(...)`                               |
| `components/KillmailSummaryCard/FittingItem.tsx:171` | `getItemImageUrl(item.itemType, item.singleton, 64)` |

Her dosyada import satırlarını da düzelt:

```ts
import { legacyItemImageUrl } from '@/utils/eveImageUrl';
import { isBlueprint } from '@/utils/itemType';
```

Ayrıca `getItemName` / `isBlueprint` import eden iki dosya yeni yola geçer:

- `components/KillmailSummaryCard/KillmailSummaryCard.tsx:6` —
  `from '@/utils/itemImageUrl'` → `from '@/utils/itemType'`
- `components/KillmailSummaryCard/FittingItem.tsx:3-6` — aynı şekilde

- [ ] **Adım 8: Tüm testleri ve derlemeyi çalıştır**

```bash
cd frontend && ./node_modules/.bin/vitest run && cd .. && yarn workspace frontend build
```

Beklenen: tüm testler geçer, `✓ Compiled successfully`.

- [ ] **Adım 9: Commit**

```bash
npx prettier --check frontend/src/utils frontend/src/components/FitScreen frontend/src/components/KillmailSummaryCard
git add frontend/src/utils frontend/src/components
git commit -m "refactor(frontend): move EVE image URLs into a pure builder

getItemImageUrl built its URL from an \`itemType: any\` and logged two lines
to the console on every blueprint, in production. eveImageUrl takes a kind, an
id and a drawn size instead, derives the fetch size once, and needs no item
shape at all - a blueprint arrives as a boolean.

isBlueprint and getItemName stay behind: they state facts about an item type
rather than build a URL. Their file no longer builds one either, so it is
itemType.ts now."
```

---

## Görev 2: `ui/EveImage` bileşeni

**Dosyalar:**

- Oluştur: `frontend/src/components/ui/EveImage.tsx`
- Oluştur: `frontend/src/components/ui/EveImage.spec.tsx`

**Arayüzler:**

- Tüketir: `eveImageUrl`, `EveImageKind` (Görev 1).
- Üretir: varsayılan dışa aktarım `EveImage`, prop'ları
  `{ kind, id, name, className?, priority?, singleton?, blueprint? }` artı
  `{ size: number }` **veya** `{ fill: true }`.

- [ ] **Adım 1: Başarısız testi yaz**

`frontend/src/components/ui/EveImage.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import EveImage from './EveImage';

describe('EveImage', () => {
  it('writes the drawn size as width and height', () => {
    render(<EveImage kind="character" id={95465499} name="Pilot" size={64} />);

    const img = screen.getByAltText('Pilot');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });

  it('asks the image server for twice the drawn size', () => {
    render(<EveImage kind="character" id={95465499} name="Pilot" size={64} />);

    expect(screen.getByAltText('Pilot')).toHaveAttribute(
      'src',
      'https://images.evetech.net/characters/95465499/portrait?size=128',
    );
  });

  it('keeps the caller class', () => {
    render(
      <EveImage
        kind="alliance"
        id={99000001}
        name="Alliance"
        size={32}
        className="shadow-md"
      />,
    );

    expect(screen.getByAltText('Alliance')).toHaveClass('shadow-md');
  });

  it('falls back from a ship render to its icon', () => {
    render(<EveImage kind="ship" id={587} name="Rifter" size={64} />);

    const img = screen.getByAltText('Rifter');
    expect(img).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/587/render?size=128',
    );

    fireEvent.error(img);

    expect(screen.getByAltText('Rifter')).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/587/icon?size=128',
    );
  });

  it('does not carry a ship fallback into the next ship', () => {
    const { rerender } = render(
      <EveImage kind="ship" id={587} name="Rifter" size={64} />,
    );
    fireEvent.error(screen.getByAltText('Rifter'));

    rerender(<EveImage kind="ship" id={588} name="Rupture" size={64} />);

    expect(screen.getByAltText('Rupture')).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/588/render?size=128',
    );
  });

  it('draws a fill image without width and height', () => {
    render(<EveImage kind="ship" id={587} name="Rifter" fill />);

    const img = screen.getByAltText('Rifter');
    expect(img).not.toHaveAttribute('width');
    expect(img).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/587/render?size=512',
    );
  });
});
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

```bash
cd frontend && ./node_modules/.bin/vitest run src/components/ui/EveImage.spec.tsx
```

Beklenen: `Failed to resolve import "./EveImage"`.

- [ ] **Adım 3: Bileşeni yaz**

`frontend/src/components/ui/EveImage.tsx`:

```tsx
'use client';

import { eveImageUrl, type EveImageKind } from '@/utils/eveImageUrl';
import Image from 'next/image';
import { useState } from 'react';

/**
 * A `fill` image has no pixel box to derive a fetch size from, so it asks for
 * the largest size this app draws — the same 512 the fit screen's hull has
 * always requested.
 */
const FILL_SIZE = 512;

type Sizing = { size: number; fill?: never } | { fill: true; size?: never };

export type EveImageProps = {
  kind: EveImageKind;
  id: number;
  /** The entity's name; it is the alt text. */
  name: string;
  className?: string;
  /** Only the killmail page's victim hull sets this. */
  priority?: boolean;
  /** `type` only: 2 is a blueprint copy. */
  singleton?: number;
  /** `type` only: the caller's `isBlueprint(itemType)`. */
  blueprint?: boolean;
} & Sizing;

/**
 * Every image this app loads from the EVE image server.
 *
 * `unoptimized`, because the server already serves the exact size asked for:
 * routing it through `/_next/image` would spend CPU re-encoding what is
 * already right. What next/image is here for is the explicit width and height
 * — 56 of the 59 `<img>` elements this replaced had none, so every one of them
 * shifted its row as it loaded — and lazy loading.
 */
export default function EveImage({
  kind,
  id,
  name,
  className,
  priority,
  singleton,
  blueprint,
  size,
  fill,
}: EveImageProps) {
  /*
   * Which id the render 404'd for, not a bare boolean: a row that re-renders
   * with a different ship must ask for its render again rather than inherit
   * the previous one's fallback. RegionMap holds a failed map's id the same
   * way.
   */
  const [iconFor, setIconFor] = useState<number | null>(null);

  const src = eveImageUrl({
    kind,
    id,
    size: fill ? FILL_SIZE : size,
    singleton,
    blueprint,
    icon: kind === 'ship' && iconFor === id,
  });

  /* Only a ship has somewhere to fall back to: a hull with no render still
     has an icon. Nothing else does, so nothing else listens. */
  const onError =
    kind === 'ship' && iconFor !== id ? () => setIconFor(id) : undefined;

  if (fill) {
    return (
      <Image
        src={src}
        alt={name}
        fill
        className={className}
        priority={priority}
        onError={onError}
        unoptimized
      />
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      priority={priority}
      onError={onError}
      unoptimized
    />
  );
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

```bash
cd frontend && ./node_modules/.bin/vitest run src/components/ui/EveImage.spec.tsx
```

Beklenen: 6 test geçer.

- [ ] **Adım 5: Commit**

```bash
npx prettier --check frontend/src/components/ui
git add frontend/src/components/ui
git commit -m "feat(frontend): add ui/EveImage

One component for every image this app loads from the EVE image server. It
takes the drawn size and derives the fetch size, writes width and height so
the image stops shifting its row as it loads, and holds the render-to-icon
fallback that five call sites had each copied.

unoptimized: the image server already serves the exact size asked for, so
/_next/image would re-encode what is already right, on a droplet shared with
the API and the workers."
```

---

## Görev 3: Gemi görselleri (8 çağrı yeri)

**Dosyalar (Değiştir):**

| Dosya:satır                                                  | `size` | Not                          |
| ------------------------------------------------------------ | -----: | ---------------------------- |
| `components/AttackersCard/AttackerRow.tsx:68`                |     64 | NPC yuvası                   |
| `components/AttackersCard/AttackerRow.tsx:107`               |     32 |                              |
| `components/AttackersCard/AttackerRow.tsx:132`               |     32 |                              |
| `components/AttackersCard/FeaturedAttackerCard.tsx:85`       |     48 |                              |
| `components/FitScreen/FitScreen.tsx:48`                      | `fill` | `.hull` yüzde ölçülü         |
| `components/KillmailCard/KillmailCard.tsx:80`                | `fill` | `absolute inset-0 size-full` |
| `components/KillmailSummaryCard/KillmailSummaryCard.tsx:212` |     64 | **tek `priority`**           |
| `components/KillmailToast/KillmailToast.tsx:85`              |     56 | `w-14 h-14`                  |
| `components/KillmailsTable/KillmailRow.tsx:83`               |     64 |                              |
| `components/TopShipsCard/TopShipsCard.tsx:77`                |     64 |                              |

**Arayüzler:**

- Tüketir: `EveImage` (Görev 2).
- Üretir: yok.

- [ ] **Adım 1: On çağrı yerini dönüştür**

Her birinde `<img …>` bloğunu sil, yerine `<EveImage>` yaz. `className` ve
`alt` metnini aynen taşı; `onError` bloğunu, `loading`, `decoding`, `width`,
`height` ve `src` satırlarını sil. Örnek — `KillmailSummaryCard.tsx:212`:

```tsx
<EveImage
  kind="ship"
  id={victim.shipType.id}
  name={victim.shipType.name}
  size={64}
  className="border size-16 border-amber-900/80"
  priority
/>
```

`FitScreen.tsx:48` ve `KillmailCard.tsx:80` `size` yerine `fill` alır;
`fill` konumlandırılmış bir ebeveyn ister — ikisinde de zaten var
(`.hull` `position: absolute`, `KillmailCard`'ın `<Link>`'i `relative`).

`KillmailCard.tsx`'te `usingIcon` state'i, `RENDER_SIZE` ve `ICON_SIZE`
sabitleri artık kullanılmıyor; üçünü de sil.

`KillmailToast.tsx`'te `shipImageUrl` ve `handleImageError` artık
kullanılmıyor; ikisini de sil, koşulu `toast.victimShipTypeId ? … : …`
hâline getir.

`FitScreen.tsx`'te `shipType` prop'unun `{ id: number; name: string }`
şekli değişmez.

- [ ] **Adım 2: Testleri ve derlemeyi çalıştır**

```bash
cd frontend && ./node_modules/.bin/vitest run && cd .. && yarn workspace frontend build
```

Beklenen: tüm testler geçer (`AttackerRow.spec.tsx` ve
`KillmailSummaryCard.spec.tsx` dahil), `✓ Compiled successfully`.

`KillmailSummaryCard.spec.tsx` `getByAltText('Gatling')` gibi alt metinlere
bakıyor; `alt` aynen taşındığı için geçmeli. Geçmiyorsa `alt` metnini
değiştirmişsindir — geri al.

- [ ] **Adım 3: Lint uyarı sayısını ölç**

```bash
cd frontend && yarn lint 2>&1 | grep -c 'no-img-element'
```

Beklenen: 58 - 10 = **48**.

- [ ] **Adım 4: Commit**

```bash
npx prettier --check frontend/src
git add frontend/src
git commit -m "refactor(frontend): draw ship images with EveImage

Ten call sites, five of which carried their own copy of the same
render-to-icon fallback by assigning to target.src in onError - which
next/image cannot honour, since it owns the src. The component holds it once.

FitScreen's hull and KillmailCard's backdrop take fill: their boxes are a
percentage of their container rather than a pixel square. KillmailCard's
usingIcon state and its two size constants go with the change."
```

---

## Görev 4: Karakter, kurum ve ittifak görselleri (28 çağrı yeri)

**Dosyalar (Değiştir):**

| Dosya:satır                                               | `kind`      | `size` |
| --------------------------------------------------------- | ----------- | -----: |
| `app/alliances/[id]/page.tsx:334`                         | alliance    |    128 |
| `app/characters/[id]/page.tsx:226`                        | character   |    128 |
| `app/characters/[id]/page.tsx:243`                        | corporation |     64 |
| `app/characters/[id]/page.tsx:259`                        | alliance    |     64 |
| `app/corporations/[id]/page.tsx:334`                      | corporation |    128 |
| `app/leaderboards/page.tsx:87`                            | character   |     64 |
| `app/leaderboards/page.tsx:169`                           | corporation |     32 |
| `app/leaderboards/page.tsx:180`                           | alliance    |     32 |
| `components/AttackersCard/AttackerRow.tsx:49`             | character   |     64 |
| `components/AttackersCard/AttackerRow.tsx:57`             | corporation |     64 |
| `components/AttackersCard/AttackersCard.tsx:193`          | alliance    |     32 |
| `components/AttackersCard/AttackersCard.tsx:223`          | corporation |     32 |
| `components/AttackersCard/AttackersCard.tsx:253`          | corporation |     32 |
| `components/AttackersCard/FeaturedAttackerCard.tsx:30`    | character   |    256 |
| `components/AttackersCard/FeaturedAttackerCard.tsx:44`    | corporation |     32 |
| `components/AttackersCard/FeaturedAttackerCard.tsx:57`    | alliance    |     32 |
| `components/CharactersTable/CharactersTable.tsx:42`       | character   |     48 |
| `components/CorporationsTable/CorporationsTable.tsx:50`   | corporation |     32 |
| `components/Filters/KillmailFilterForm.tsx:712`           | character   |     64 |
| `components/Filters/KillmailFilterForm.tsx:764`           | character   |     32 |
| `components/Footer/Footer.tsx:193`                        | character   |     64 |
| `components/KillmailCard/KillmailCard.tsx:170`            | corporation |     40 |
| `components/KillmailsTable/KillmailRow.tsx:179`           | corporation |     64 |
| `components/KillmailsTable/KillmailRow.tsx:258`           | corporation |     64 |
| `components/TopAllianceCard/TopAllianceCard.tsx:68`       | alliance    |     64 |
| `components/TopCharacterCard/TopCharacterCard.tsx:78`     | character   |     64 |
| `components/TopCorporationCard/TopCorporationCard.tsx:68` | corporation |     64 |
| `components/TopFactionsCard/TopFactionsCard.tsx:72`       | corporation |     64 |
| `components/TopTargetsCard/TopTargetsCard.tsx:84`         | değişken    |     64 |
| `components/WeeklyTopCharCard/WeeklyTopCharCard.tsx:49`   | character   |     40 |

**Arayüzler:**

- Tüketir: `EveImage` (Görev 2).
- Üretir: yok.

- [ ] **Adım 1: Dört eski URL'i modern şemaya çek**

`alliances/[id]/page.tsx:334`, `AttackersCard.tsx:193`,
`CharactersTable.tsx:42` ve `CorporationsTable.tsx:50` bugün
`https://images.evetech.net/Alliance/${id}_128.png` biçiminde. Bunlar da
yukarıdaki tabloya göre `<EveImage kind="alliance" … />` olur; eski şema
tamamen kalkar.

- [ ] **Adım 2: `TopTargetsCard`'ın kendi switch'ini kaldır**

`TopTargetsCard.tsx:36-47`'deki `getImageUrl` fonksiyonunu sil. `targetType`
zaten `'alliance' | 'corporation' | 'character'` — doğrudan `kind` olarak
geçir:

```tsx
<EveImage kind={targetType} id={target.id} name={target.name} size={64} />
```

`targetType`'ın kendi tipi `TopTargetsCard.tsx` içinde tanımlı. Onu
`EveImageKind`'tan türet, böylece iki liste ayrı ayrı bakım istemez:

```ts
import type { EveImageKind } from '@/utils/eveImageUrl';

type TargetType = Extract<
  EveImageKind,
  'alliance' | 'corporation' | 'character'
>;
```

- [ ] **Adım 3: `KillmailFilterForm`'un ölü fallback'lerini sil**

`:712` ve `:764`'teki `onError` blokları `/images/default-avatar.png`'ye
düşüyor; `frontend/public/images/` içinde böyle bir dosya **yok**, yani
fallback'in kendisi 404 veriyor. Dönüşümde `onError` bloğu taşınmaz.
(Bu spec'te adı geçmeyen bir bulgu — PR gövdesinde belirt.)

- [ ] **Adım 4: Testleri, derlemeyi ve lint sayısını çalıştır**

```bash
cd frontend && ./node_modules/.bin/vitest run && cd .. && yarn workspace frontend build
cd frontend && yarn lint 2>&1 | grep -c 'no-img-element'
```

Beklenen: testler geçer, derleme başarılı, uyarı sayısı 48 - 30 = **18**.

- [ ] **Adım 5: Commit**

```bash
npx prettier --check frontend/src
git add frontend/src
git commit -m "refactor(frontend): draw portraits and logos with EveImage

Thirty call sites. Four of them still used the old image server scheme -
/Alliance/{id}_128.png - so the app asked for the same logo two ways; the
component knows one scheme, which settles it.

TopTargetsCard's private getImageUrl switch goes: its targetType is already
the kind. Two onError handlers in KillmailFilterForm fell back to
/images/default-avatar.png, which is not in the repo, so the fallback 404'd
too; they are dropped rather than carried over."
```

---

## Görev 5: Tip görselleri ve geçici shim'in silinmesi (10 çağrı yeri)

**Dosyalar (Değiştir):**

| Dosya:satır                                             | `size` | Not                  |
| ------------------------------------------------------- | -----: | -------------------- |
| `components/AttackersCard/AttackerRow.tsx:123`          |     32 | silah ikonu          |
| `components/AttackersCard/FeaturedAttackerCard.tsx:100` |     48 | silah ikonu          |
| `components/Filters/KillmailFilterForm.tsx:851`         |     64 | ölü fallback silinir |
| `components/Filters/KillmailFilterForm.tsx:893`         |     32 | ölü fallback silinir |
| `components/FitScreen/ImplantSlot.tsx:22`               |     48 |                      |
| `components/FitScreen/ServiceSlot.tsx:22`               |     48 |                      |
| `components/FitScreen/Slot.tsx:60`                      |     48 |                      |
| `components/FitScreen/Slot.tsx:81`                      |     48 |                      |
| `components/KillmailSummaryCard/FittingItem.tsx:145`    |     64 |                      |
| `components/KillmailSummaryCard/FittingItem.tsx:171`    |     32 |                      |

**Arayüzler:**

- Tüketir: `EveImage` (Görev 2), `isBlueprint` (Görev 1, `@/utils/itemType`).
- Üretir: yok. `legacyItemImageUrl` bu görevde silinir.

- [ ] **Adım 1: On çağrı yerini dönüştür**

Blueprint bilgisini taşıyanlarda `blueprint` ve `singleton` prop'ları verilir.
Örnek — `FittingItem.tsx:171`:

```tsx
<EveImage
  kind="type"
  id={item.itemType.id}
  name={itemName}
  size={32}
  singleton={item.singleton}
  blueprint={isBlueprint(item.itemType)}
  className="bg-white/5 size-8 border-white/10"
/>
```

`AttackerRow.tsx:123` ve `FeaturedAttackerCard.tsx:100` silah ikonu — blueprint
olamaz, `blueprint` ve `singleton` verilmez.

`:851` ve `:893`'teki `onError` blokları `/images/default-ship.png`'ye
düşüyor; o dosya da repoda yok. Taşınmaz.

- [ ] **Adım 2: Geçici shim'i sil**

`src/utils/eveImageUrl.ts`'ten `legacyItemImageUrl`'ü ve
`FittingItem.tsx`'teki geçici `itemImageUrl` yardımcısını sil. Hiçbir
çağrısının kalmadığını doğrula:

```bash
cd frontend && grep -rn 'legacyItemImageUrl\|getItemImageUrl' src | grep -v '\.spec\.'
```

Beklenen: hiçbir çıktı yok.

- [ ] **Adım 3: Testleri, derlemeyi ve lint sayısını çalıştır**

```bash
cd frontend && ./node_modules/.bin/vitest run && cd .. && yarn workspace frontend build
cd frontend && yarn lint 2>&1 | grep -c 'no-img-element'
```

Beklenen: testler geçer (`FittingItem.spec.tsx` dahil), derleme başarılı,
uyarı sayısı 18 - 10 = **8**.

- [ ] **Adım 4: Commit**

```bash
npx prettier --check frontend/src
git add frontend/src
git commit -m "refactor(frontend): draw item icons with EveImage

The last ten evetech call sites, and with them the shim that carried the slot
components between the URL builder landing and this change.

Two more onError handlers went the way of the first two: they fell back to
/images/default-ship.png, which the repo does not contain."
```

---

## Görev 6: Haritalar, yerel asset'ler ve temizlik (9 çağrı yeri)

**Dosyalar (Değiştir):**

- `components/RegionMap/RegionMap.tsx:36`
- `components/ConstellationMap/ConstellationMap.tsx:37`
- `components/SolarSystemMap/SolarSystemMap.tsx:34`
- `components/ShipTierBadge/ShipTierBadge.tsx:15,19,23,27`
- `components/FitScreen/Slot.tsx:101`
- `components/Footer/Footer.tsx:255`
- `frontend/next.config.ts`
- `CLAUDE.md`

**Arayüzler:**

- Tüketir: yok (bu dosyalar `EveImage` kullanmaz).
- Üretir: yok.

- [ ] **Adım 1: Üç haritayı dönüştür**

Üçü de `width={size} height={size}` ve state'li `onError` taşıyor; ikisi de
korunur. Yalnızca eleman değişir:

```tsx
<Image
  src={regionMapUrl(regionId)}
  alt={`${regionName} map`}
  width={size}
  height={size}
  className={className}
  onError={() => setFailedId(regionId)}
  unoptimized
/>
```

`import Image from 'next/image';` ekle. Üç dosyanın spec'leri
(`RegionMap.spec.tsx` vb.) varsa alt metinlerine bakar, geçmeli.

- [ ] **Adım 2: `ShipTierBadge`'i dönüştür**

Ölçü `className` ile geliyor (`size-4`, `size-5`, `size-10`, varsayılan
`size-6`), o yüzden `width`/`height` içsel bir ipucu olarak sabit verilir ve
`className` üstüne yazar. Dört ikon da kare olduğu için Next'in "biri
değişti diğeri değişmedi" uyarısı çıkmaz. Dört dalın gövdesi tek bir
eşlemeye iner:

```tsx
import type { ShipTier } from '@/utils/shipTier';
import Image from 'next/image';

interface ShipTierBadgeProps {
  tier: ShipTier;
  className?: string;
}

/** The four tiers that have an icon, and what it is called. */
const ICONS: Record<Exclude<ShipTier, null>, { src: string; alt: string }> = {
  T2: { src: '/icons/t2.svg', alt: 'T2' },
  T3: { src: '/icons/t3.svg', alt: 'T3' },
  faction: { src: '/icons/faction.svg', alt: 'Faction' },
  officer: { src: '/icons/officer.svg', alt: 'Officer' },
};

/** An intrinsic hint only: the class the caller passes sets the drawn size,
 *  and both dimensions come from it, so next/image has nothing to warn about. */
const INTRINSIC = 24;

export default function ShipTierBadge({
  tier,
  className = 'size-6',
}: ShipTierBadgeProps) {
  if (!tier) return null;

  const icon = ICONS[tier];

  return (
    <Image
      src={icon.src}
      alt={icon.alt}
      width={INTRINSIC}
      height={INTRINSIC}
      className={className}
      unoptimized
    />
  );
}
```

- [ ] **Adım 3: Kalan iki yerel asset'i dönüştür**

`FitScreen/Slot.tsx:101` (`slotIcon`, `z-10 w-12 h-12`):

```tsx
<Image
  src={slotIcon}
  alt={`${slotType} slot`}
  width={48}
  height={48}
  className="z-10 w-12 h-12"
  unoptimized
/>
```

`Footer/Footer.tsx:255` (partner PNG'si, bugün `style={{ width: '300px' }}`).
`next/image`'a dosyanın **kendi** ölçüleri verilir, çizim ölçüsü sınıfta kalır.
Önce ölçüyü PNG başlığından oku:

```bash
cd frontend && node -e "const b=require('fs').readFileSync('public/images/eve-online-partner.png');console.log(b.readUInt32BE(16), b.readUInt32BE(20))"
```

Çıkan iki sayıyı `width` ve `height`'a aynen yaz (aşağıda `W` ve `H`):

```tsx
<Image
  src="/images/eve-online-partner.png"
  alt="Eve Online Partnership Program"
  width={W}
  height={H}
  className="w-75 h-auto"
  unoptimized
/>
```

`style` yerine sınıf: `next/image` yalnızca **bir** boyutu CSS ile değişen
görselde uyarı veriyor, `w-75 h-auto` ikisini birden sınıftan verir. `w-75`
Tailwind 4'te 300px'tir (75 × 4px), yani bugünkü genişlik korunur.

- [ ] **Adım 4: `next.config.ts`'ten ölü yapılandırmayı sil**

Artık her görsel `unoptimized`, yani `images.remotePatterns` bloğunu
(`next.config.ts:11-22`) hiçbir şey okumuyor. Tüm `images` anahtarını sil.

- [ ] **Adım 5: Sıfırı doğrula**

```bash
cd frontend && yarn lint 2>&1 | grep -c 'no-img-element'
cd frontend && grep -rn '<img' --include='*.tsx' src | grep -v '\.spec\.' | wc -l
```

Beklenen: **0** ve **0**.

- [ ] **Adım 6: Tam doğrulama setini çalıştır**

```bash
yarn test
yarn workspace frontend build
yarn workspace frontend lint 2>&1 | tail -3
npx prettier --check .
```

Beklenen: tüm testler geçer; derleme başarılı; toplam lint sorunu
**201'den 143'e** (121 hata, 22 uyarı) düşmüş; prettier temiz.

- [ ] **Adım 7: `CLAUDE.md`'deki lint sayısını güncelle**

`CLAUDE.md`'de `lint` raporlanan sorun sayısını veren satır 2026-09-10
itibarıyla 237 diyor. Bir önceki adımda ölçtüğün gerçek sayıyla ve bugünün
tarihiyle değiştir.

- [ ] **Adım 8: Commit**

```bash
npx prettier --check frontend CLAUDE.md
git add frontend CLAUDE.md
git commit -m "refactor(frontend): draw maps and local assets with next/image

The last nine <img> elements: three maps that already carried width, height
and a state-based onError, four tier badges whose four near-identical
branches collapse into one lookup, a slot icon and the partner logo.

images.remotePatterns goes with them: only the optimizer reads it, and every
image in the app is unoptimized now. Re-adding it is one block if that ever
changes, and Next says so plainly when it is missing."
```

---

## Spec'ten sapmalar

Uygulama sırasında karşılaşılan, spec'te adı geçmeyen üç şey. Üçü de PR
gövdesinde belirtilmeli:

1. **Dört ölü `onError` fallback'i.** `KillmailFilterForm`'un dört görseli
   `/images/default-avatar.png` ve `/images/default-ship.png`'ye düşüyor;
   ikisi de `frontend/public/images/` içinde yok, yani fallback'in kendisi
   404 veriyor. Taşınmıyorlar. Yerine bir yer tutucu koymak ayrı bir karar.
2. **`FeaturedAttackerCard.tsx:30` bugün 1× çekiyor.** 256px çizilen portre
   `?size=256` istiyor; kural onu `?size=512`ye çıkarır. Tek yönlü bir
   iyileşme, ama bir istek değişikliği.
3. **Slot ikonları 64'ten 128'e çıkar.** `size-12` (48px) çizilen modül
   ikonları bugün `getItemImageUrl`'ün varsayılanı olan 64'ü istiyor; kural
   128 veriyor. Aynı şekilde tek yönlü.

## PR şekli

Tek dal, tek PR, altı commit — her görev bir commit. Etiketler: `refactor`,
`frontend`. Yarım göç uygulamada iki konvansiyon bırakır, o yüzden altısı tek
PR'da.
