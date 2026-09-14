# Evren haritası — odak, derin bağlantılar ve sayfalardan girişler (faz 3b) — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Haritanın seçili sistemini URL'e taşımak ve haritaya dışarıdan bir yere bakarak girmenin üç yolunu açmak — `?focus=`, `?region=`, `?constellation=` — ardından bölge, takımyıldız ve sistem sayfalarındaki mevcut küçük resimleri canlı haritaya bağlamak.

**Architecture:** Üç parametrenin üçü de istemcide çözülüyor; `mapGeometry` her düğümün `systemId`, `constellationId` ve `regionId`'sini zaten taşıyor. **Bu plan backend'e hiç dokunmuyor**: yeni sorgu, yeni alan, yeni önbellek anahtarı, yeni migration yok. Karar katmanı `utils/map/` altında saf ve testli (`camera.ts` genişliyor, `framing.ts` yeni); `useMapCamera` URL gidiş-dönüşünün tek yazarı oluyor; `UniverseMap` yalnızca ikisini bağlıyor. `scene/` altına **hiçbir dosya eklenmiyor ve hiçbiri değişmiyor**.

**Tech Stack:** TypeScript, Next.js App Router + React 19, PixiJS 8.20.1, Vitest 5, Testing Library. **Yeni bağımlılık yok.**

**Spec:** [`../specs/2026-09-14-universe-map-focus-design.md`](../specs/2026-09-14-universe-map-focus-design.md)

## Global Constraints

- **Yarn, asla npm.** Bu plan bağımlılık eklemiyor; `yarn.lock` hiçbir task'ta değişmemeli.
- **Migration yok, backend yok.** Bu plan `backend/` altında tek satır değiştirmiyor. `prisma migrate dev` hiçbir task'ta çağrılmıyor — beş tabloyu düşürür.
- **`.graphql` değişmiyor → codegen gerekmiyor.** Hiçbir task `yarn codegen` koşmuyor. Bir task'ta codegen'e ihtiyaç duyulduğu düşünülüyorsa, plandan sapılmış demektir: bu dilimin sözleşmesi zaten üretilmiş tiplerde duruyor.
- **Üretilmiş dosyalar elle düzenlenmiyor:** `frontend/src/generated/graphql.ts` okunuyor, yazılmıyor.
- **`.env`'e dokunulmaz.** Bu checkout'ta backend `PORT=4010`, frontend `:3000`.
- **`lint` kabul kriteri `main`'in sayısı, sıfır fark.** Bu plan yazılırken **228 problems (144 errors, 84 warnings)**. Sayı artmışsa artıran satır bu dala aittir.
- **Karar `utils/map/`'te ve testli; Pixi nesnesine atama `scene/`'de ve testsiz.** 3a'nın kuralı, aynen.
- **`build` çalışan dev sunucusunu öldürür** (port 3000'de `yarn kill`). Doğrulama sırası: `test` → `build`, ve `build` en sona.
- Commit ve PR metinleri **İngilizce**, `type(scope):` sonrası küçük harf, Claude atıfsız.

## Ölçülmüş sabitler

Spec'ten taşınıyor; hiçbiri task içinde yeniden türetilmeyecek. Alt sıradaki dördü bu plan yazılırken `psql` ile doğrulandı.

| Sabit                               | Değer                                                                                                   | Nereden                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `SYSTEM_LABEL_ZOOM`                 | -45,73                                                                                                  | `utils/map/lod.ts`, mevcut                   |
| Sistemlerin medyan komşu mesafesi   | 3,4944e15 m                                                                                             | `utils/map/lod.ts`                           |
| Aynı mesafe `SYSTEM_LABEL_ZOOM`'da  | 59,9 px                                                                                                 | `3.4944e15 * 2 ** -45.73`                    |
| `FIT_PADDING` / `FALLBACK_FIT_ZOOM` | 0,92 / -49,92                                                                                           | `utils/map/camera.ts`, mevcut                |
| Pochven bölgesi                     | 10000070                                                                                                | `universe-map.service.ts:82-86`              |
| Pochven'in sistemleri               | 27 sistem, `30000021`–`30045329`                                                                        | `psql`, plan yazılırken                      |
| Pochven'in takımyıldızları          | 3 adet, `20000787`–`20000789`                                                                           | `psql` — sıradan k-space bandının **içinde** |
| Tek sistemli takımyıldızlar         | NEW_EDEN'de **2**, WORMHOLE'da **5**                                                                    | `psql`                                       |
| Duzna Kah / Manifest District       | `20010000` → Zarzakh `30100000` (bölge `10001000`), `20010001` → Manifest `30100032` (bölge `10001004`) | `psql`                                       |

İki ölçümün planı doğrudan şekillendirdiği yer:

1. Pochven'in takımyıldız id'leri `20000787`–`20000789`, yani sıradan bandın içinde. Spec'in "takımyıldız ve sistem id'sinden scope çıkarılamaz" cümlesi ölçümle doğrulandı; `scopeForRegionId` **yalnızca bölge id'si** alıyor.
2. Tek düğümlü küme WORMHOLE'da 5 kez oluyor, NEW_EDEN'de 2. Dejenere durum nadir bir kenar vakası değil, olağan bir giriş — Task 3'te kendi testi var.

---

## Task 1: `scopeForRegionId` — linkin taşıyacağı sahne

**Files:**

- Modify: `frontend/src/utils/map/camera.ts` (dosyanın sonuna, `parseScope`'un yanına)
- Test: `frontend/src/utils/map/camera.spec.ts`

**Interfaces:**

- Consumes: `MapScope` (`@/generated/graphql`)
- Produces: `scopeForRegionId(regionId: number): MapScope | null`

**Spec'in açık bıraktığı bir karar, burada kapanıyor.** Spec `scopeForRegionId` için "banda düşmeyen bir id"yi test vakası sayıyor ama ne döneceğini söylemiyor. Dönüş `MapScope | null` ve **null "bu bölgenin sahnesi yok" demek**: abyssal (`12000001`–`12000005`), proving (`14000001`–`14000005`) ve GPMR-01 (`19000001`) içlerinde sıfır celestial taşıyor ve backend onlara bilerek `MapScope` üyesi vermiyor (`universe-map.service.ts:61-72`). Alternatif — NEW_EDEN'e düşürmek — hata vermeyen ama yanlış davranan bir link üretirdi, ki spec'in Pochven bölümü tam olarak bunu reddediyor. Null alan sayfa link kurmuyor, küçük resmi çıplak bırakıyor.

- [ ] **Step 1: Testleri yaz**

`frontend/src/utils/map/camera.spec.ts`'in sonuna:

```typescript
describe('scopeForRegionId', () => {
  it('puts the k-space band in NEW_EDEN', () => {
    expect(scopeForRegionId(10000001)).toBe(MapScope.NewEden);
    expect(scopeForRegionId(10000002)).toBe(MapScope.NewEden); // The Forge
    expect(scopeForRegionId(10999999)).toBe(MapScope.NewEden);
  });

  // Cut out of the middle of that band, exactly as the service's predicate
  // does: Pochven is a closed component and gets its own scene.
  it('cuts Pochven out of the k-space band', () => {
    expect(scopeForRegionId(10000070)).toBe(MapScope.Pochven);
  });

  it('puts the wormhole band in WORMHOLE', () => {
    expect(scopeForRegionId(11000001)).toBe(MapScope.Wormhole);
    expect(scopeForRegionId(11000033)).toBe(MapScope.Wormhole);
    expect(scopeForRegionId(11999999)).toBe(MapScope.Wormhole);
  });

  // Zarzakh and Manifest sit at the top of the k-space band and belong to
  // NEW_EDEN, which is where the service puts them too. Measured, not assumed.
  it('keeps Zarzakh and Manifest in NEW_EDEN', () => {
    expect(scopeForRegionId(10001000)).toBe(MapScope.NewEden); // Zarzakh
    expect(scopeForRegionId(10001004)).toBe(MapScope.NewEden); // Manifest
  });

  // Null is "this region has no scene", not "unknown": the caller renders no
  // link rather than one that opens an unrelated scene and ignores its
  // parameter.
  it('returns null for a region that has no scene at all', () => {
    expect(scopeForRegionId(12000001)).toBeNull(); // abyssal
    expect(scopeForRegionId(14000001)).toBeNull(); // proving
    expect(scopeForRegionId(19000001)).toBeNull(); // GPMR-01
    expect(scopeForRegionId(10000000)).toBeNull(); // below the k-space band
    expect(scopeForRegionId(0)).toBeNull();
  });
});
```

`camera.spec.ts`'in en üstündeki `from './camera'` import listesine `scopeForRegionId` eklenecek (alfabetik: `parseScope`'tan sonra).

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd frontend && npx vitest run src/utils/map/camera.spec.ts`
Expected: FAIL — `scopeForRegionId is not a function` / TS2305 export yok.

- [ ] **Step 3: Fonksiyonu yaz**

`frontend/src/utils/map/camera.ts`'in sonuna:

```typescript
/**
 * Which scene a region belongs to.
 *
 * This mirrors the backend's own rule — `scopePredicate` in
 * `backend/src/services/universe/universe-map.service.ts` — so a link can carry
 * the right scope without a round trip. Two places now hold one rule: if CCP
 * opens a new region band, both move together. The trade was taken deliberately
 * to keep this slice free of the backend; the comment there points back here.
 *
 * Only a REGION id decides this. Pochven's 27 systems sit at 30000021-30045329
 * and its 3 constellations at 20000787-20000789 — both inside the ordinary
 * k-space bands, because CCP converted them from existing ones and they kept
 * their ids. Measured 2026-09-14; a system or constellation id carries no scope
 * signal at all.
 *
 * Null means the region has no scene: abyssal, proving and GPMR-01 hold zero
 * celestials and the service gives them no MapScope member. A caller with null
 * builds no link.
 */
export function scopeForRegionId(regionId: number): MapScope | null {
  if (regionId === 10000070) return MapScope.Pochven;
  if (regionId >= 10000001 && regionId <= 10999999) return MapScope.NewEden;
  if (regionId >= 11000001 && regionId <= 11999999) return MapScope.Wormhole;
  return null;
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `cd frontend && npx vitest run src/utils/map/camera.spec.ts`
Expected: PASS, hepsi.

- [ ] **Step 5: Backend'in yorumunu bu fonksiyona işaret ettir**

`backend/src/services/universe/universe-map.service.ts`, `scopePredicate`'in üstündeki blok yorumun sonuna tek satır:

```typescript
 * The frontend mirrors these bands in `scopeForRegionId`
 * (`frontend/src/utils/map/camera.ts`) to build a /map link without a round
 * trip. A new band moves both.
```

Bu, Global Constraints'in "backend'e dokunulmuyor" maddesinin **tek istisnası** ve bilerek: değişen şey yalnızca bir yorum satırı, davranış değil. Spec bu iki yerin birbirine işaret etmesini açıkça istiyor (_Riskler_, madde 4).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/map/camera.ts frontend/src/utils/map/camera.spec.ts \
  backend/src/services/universe/universe-map.service.ts
git commit -m "feat(frontend): derive the map scope a region belongs to"
```

---

## Task 2: `parseFocus`, `parseFraming` ve `cameraQuery`'nin üçüncü argümanı

**Files:**

- Modify: `frontend/src/utils/map/camera.ts`
- Modify: `frontend/src/components/UniverseMap/useMapCamera.ts` (yalnızca iki çağrı yerine `null` eklemek — gerçek kullanım Task 4)
- Test: `frontend/src/utils/map/camera.spec.ts`

**Interfaces:**

- Consumes: Task 1'in hiçbir şeyi; bu task bağımsız
- Produces:
  - `parseFocus(params: URLSearchParams): number | null`
  - `type Framing = { kind: 'system' | 'constellation' | 'region'; id: number }`
  - `parseFraming(params: URLSearchParams): Framing | null`
  - `cameraQuery(scope: MapScope, camera: MapCamera, focus: number | null): string` — **üçüncü argüman zorunlu**

**Üçüncü argüman neden isteğe bağlı değil.** Varsayılan `null` verilseydi kod bugün derlenirdi ve spec'in uyardığı hata sessizce geri gelirdi: `focus`'u unutan bir kamera yazımı onu URL'den siler, ve kamera her pan'de yazılır. Zorunlu parametre, derleyiciyi her çağrı yerine bakmaya zorluyor. Bunun bedeli `camera.spec.ts`'teki mevcut dört çağrının (121, 133, 140, 156. satırlar) güncellenmesi — o da Step 1'de.

`Framing` tipi `camera.ts`'te tanımlanıyor ama `framingFor` Task 3'te `framing.ts`'e gidiyor: parametreyi **okuyan** ile onu bir kameraya **çeviren** ayrı sorumluluklar, ve `camera.ts` zaten URL çözümlemesinin evi (`parseScope`, `parseCamera`).

- [ ] **Step 1: Mevcut `cameraQuery` çağrılarını üçüncü argümana taşı ve testleri yaz**

`camera.spec.ts`'teki dört mevcut `cameraQuery(...)` çağrısının sonuna `, null` ekle (121, 133, 140, 156. satırlar). Sonra dosyanın sonuna:

```typescript
describe('parseFocus', () => {
  it('reads the selected system id', () => {
    expect(parseFocus(new URLSearchParams('focus=30000142'))).toBe(30000142);
  });

  it('is null when the parameter is absent', () => {
    expect(parseFocus(new URLSearchParams('scope=NEW_EDEN'))).toBeNull();
  });

  // The map is not a validator: anything that is not a plain positive integer
  // is ignored rather than rendered as a NaN selection.
  it('rejects what is not a positive integer', () => {
    expect(parseFocus(new URLSearchParams('focus=Jita'))).toBeNull();
    expect(parseFocus(new URLSearchParams('focus=-30000142'))).toBeNull();
    expect(parseFocus(new URLSearchParams('focus=30000142.5'))).toBeNull();
    expect(parseFocus(new URLSearchParams('focus='))).toBeNull();
    expect(parseFocus(new URLSearchParams('focus=0'))).toBeNull();
  });
});

describe('parseFraming', () => {
  it('reads a focus as a system framing', () => {
    expect(parseFraming(new URLSearchParams('focus=30000142'))).toEqual({
      kind: 'system',
      id: 30000142,
    });
  });

  it('reads a constellation and a region', () => {
    expect(parseFraming(new URLSearchParams('constellation=20000020'))).toEqual(
      {
        kind: 'constellation',
        id: 20000020,
      },
    );
    expect(parseFraming(new URLSearchParams('region=10000002'))).toEqual({
      kind: 'region',
      id: 10000002,
    });
  });

  // A URL carrying all three was typed by hand. The order is most specific
  // first, which is the least surprising answer to a question nobody meant to
  // ask.
  it('takes the most specific parameter when more than one is present', () => {
    expect(
      parseFraming(
        new URLSearchParams(
          'focus=30000142&constellation=20000020&region=10000002',
        ),
      ),
    ).toEqual({ kind: 'system', id: 30000142 });

    expect(
      parseFraming(
        new URLSearchParams('constellation=20000020&region=10000002'),
      ),
    ).toEqual({ kind: 'constellation', id: 20000020 });
  });

  it('falls through a parameter it cannot read', () => {
    expect(
      parseFraming(new URLSearchParams('focus=nope&region=10000002')),
    ).toEqual({
      kind: 'region',
      id: 10000002,
    });
  });

  it('is null when the URL asks for nothing', () => {
    expect(parseFraming(new URLSearchParams('scope=POCHVEN'))).toBeNull();
  });
});

describe('cameraQuery with a focus', () => {
  const CAMERA = { x: 0, z: 0, zoom: -50 };

  it('writes the focus it is given', () => {
    const params = new URLSearchParams(
      cameraQuery(MapScope.NewEden, CAMERA, 30000142),
    );
    expect(params.get('focus')).toBe('30000142');
  });

  // Not `focus=`, not `focus=null`: absent. This is also what makes clicking
  // empty space clear it, with no second code path.
  it('writes no focus parameter at all when nothing is selected', () => {
    const query = cameraQuery(MapScope.NewEden, CAMERA, null);
    expect(query).not.toContain('focus');
  });

  // Phase 1 and 2 shipped links in this exact shape and they have to go on
  // meaning the same frame.
  it('leaves the phase 1-2 parameter order and format untouched', () => {
    expect(cameraQuery(MapScope.NewEden, CAMERA, null)).toBe(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00',
    );
    expect(cameraQuery(MapScope.NewEden, CAMERA, 30000142)).toBe(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00&focus=30000142',
    );
  });

  it('round-trips a focus it wrote', () => {
    const query = cameraQuery(MapScope.Pochven, CAMERA, 30045329);
    expect(parseFocus(new URLSearchParams(query))).toBe(30045329);
  });
});
```

Import listesine `parseFocus` ve `parseFraming` eklenecek.

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd frontend && npx vitest run src/utils/map/camera.spec.ts`
Expected: FAIL — `parseFocus is not a function`, ve `cameraQuery` üçüncü argümanı yok sayıyor.

- [ ] **Step 3: Üçünü de yaz**

`camera.ts`'te, `parseCamera`'nın hemen altına:

```typescript
/** A system id out of the URL, or null. Ids are positive integers; nothing else is one. */
function parseId(raw: string | null): number | null {
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The selected system. This one is state — whether the popup is open — which is
 * why it is written back to the URL and `region`/`constellation` are not.
 */
export function parseFocus(params: URLSearchParams): number | null {
  return parseId(params.get('focus'));
}

/** What the URL asks the camera to look at. */
export type Framing =
  | { kind: 'system'; id: number }
  | { kind: 'constellation'; id: number }
  | { kind: 'region'; id: number };

/**
 * Most specific first. A URL carrying more than one of these was written by
 * hand, and a map link has no reason to show an error message: the order
 * resolves it silently.
 *
 * An explicit camera in the URL beats all three, and that is settled by the
 * caller — `useMapCamera` only falls back to a framing when the URL carries no
 * x/z/zoom. See UniverseMap.tsx.
 */
export function parseFraming(params: URLSearchParams): Framing | null {
  const focus = parseFocus(params);
  if (focus !== null) return { kind: 'system', id: focus };

  const constellation = parseId(params.get('constellation'));
  if (constellation !== null)
    return { kind: 'constellation', id: constellation };

  const region = parseId(params.get('region'));
  if (region !== null) return { kind: 'region', id: region };

  return null;
}
```

Ve `cameraQuery` değişiyor:

```typescript
/**
 * The canonical serialisation. useMapCamera also uses it to tell its own writes
 * apart from someone else's, so it has to be a pure function of its arguments.
 *
 * `focus` is the third argument and it is required, not defaulted: a camera
 * write that forgot it would erase the selection from the URL, and the camera
 * is written on every pan. The compiler is what keeps that from happening
 * again.
 *
 * `region` and `constellation` are deliberately never written. They are
 * instructions — "set the map up here" — not state, and keeping them would
 * leave a URL still saying "look at this region" after the user has panned
 * somewhere else.
 */
export function cameraQuery(
  scope: MapScope,
  camera: MapCamera,
  focus: number | null,
): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('x', String(toGrid(camera.x)));
  params.set('z', String(toGrid(camera.z)));
  params.set('zoom', camera.zoom.toFixed(2));
  if (focus !== null) params.set('focus', String(focus));
  return params.toString();
}
```

- [ ] **Step 4: `useMapCamera`'yı derlenir hâlde tut**

`useMapCamera.ts`'teki iki `cameraQuery` çağrısına üçüncü argüman olarak `null` geçilecek — 35-36. satırlardaki karşılaştırma ve 49. satırdaki yazım. Gerçek focus'u Task 4 getiriyor; buradaki amaç yalnızca dalın her commit'te derlenmesi.

- [ ] **Step 5: Testlerin ve tiplerin geçtiğini gör**

Run: `cd frontend && npx vitest run src/utils/map/camera.spec.ts && npx tsc --noEmit`
Expected: testler PASS, `tsc` sessiz.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/map/camera.ts frontend/src/utils/map/camera.spec.ts \
  frontend/src/components/UniverseMap/useMapCamera.ts
git commit -m "feat(frontend): read the map's focus and framing out of the url"
```

---

## Task 3: `framing.ts` — parametreden kameraya

**Files:**

- Create: `frontend/src/utils/map/framing.ts`
- Test: `frontend/src/utils/map/framing.spec.ts`

**Interfaces:**

- Consumes: `Framing` (Task 2), `MapCamera` / `fitCamera` (`./camera`), `boundsCenter` (`./origin`), `SYSTEM_LABEL_ZOOM` (`./lod`)
- Produces:
  - `interface FramingNode { systemId: number; constellationId: number; regionId: number; x: number; z: number }`
  - `nodeBounds(nodes: Pick<FramingNode, 'x' | 'z'>[]): MapBounds | null`
  - `framingFor(framing: Framing | null, nodes: FramingNode[], width: number, height: number): MapCamera | null`

**Spec'in bir cümlesi burada bir adım genişliyor, bilerek.** Spec dejenere durumu "sıfır açıklık" diye tanımlıyor. Kod `spanX` ve `spanZ`'den **herhangi biri** sıfırsa `SYSTEM_LABEL_ZOOM`'a düşüyor, ikisi birden değil. Sebep `fitZoom`'un kendisi: `!(spanX > 0) || !(spanZ > 0)` olduğunda `FALLBACK_FIT_ZOOM`'a (-49,92, galaksi fiti) dönüyor. Tek eksende hizalanmış iki sistem — dikey duran bir takımyıldız — spec'in tarif ettiğinden farklı bir durum değil, aynı tuzağın öbür yüzü: çerçeveleme isteği sessizce galaksi fitine çevrilirdi. İki düğümün bu hâli için de testi var.

- [ ] **Step 1: Testleri yaz**

`frontend/src/utils/map/framing.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { fitCamera } from './camera';
import { framingFor, nodeBounds, type FramingNode } from './framing';
import { SYSTEM_LABEL_ZOOM } from './lod';

const WIDTH = 1400;
const HEIGHT = 900;

function node(over: Partial<FramingNode> = {}): FramingNode {
  return {
    systemId: 30000142,
    constellationId: 20000020,
    regionId: 10000002,
    x: 0,
    z: 0,
    ...over,
  };
}

/** The Forge, two systems of it, and one system of Domain to sit outside. */
const NODES: FramingNode[] = [
  node({ systemId: 30000142, x: 1e16, z: 2e16 }), // Jita
  node({ systemId: 30000144, x: 3e16, z: 6e16 }), // Perimeter
  node({
    systemId: 30002187, // Amarr
    constellationId: 20000322,
    regionId: 10000043,
    x: -9e16,
    z: -9e16,
  }),
];

describe('nodeBounds', () => {
  it('is null for an empty set, rather than an infinite box', () => {
    expect(nodeBounds([])).toBeNull();
  });

  it('spans every node it is given', () => {
    expect(nodeBounds(NODES)).toEqual({
      minX: -9e16,
      maxX: 3e16,
      minZ: -9e16,
      maxZ: 6e16,
    });
  });

  it('collapses to a point for a single node', () => {
    expect(nodeBounds([node({ x: 5e16, z: -5e16 })])).toEqual({
      minX: 5e16,
      maxX: 5e16,
      minZ: -5e16,
      maxZ: -5e16,
    });
  });
});

describe('framingFor', () => {
  it('is null when the URL asks for nothing', () => {
    expect(framingFor(null, NODES, WIDTH, HEIGHT)).toBeNull();
  });

  // A system is centred, not framed. Framing it to its gate neighbours was the
  // more elegant single rule and it is wrong: a system whose only gate leads
  // 20 ly away would frame so wide that the focused system becomes a dot.
  it('centres a system at the zoom where its neighbours are 59.9 px away', () => {
    expect(
      framingFor({ kind: 'system', id: 30000142 }, NODES, WIDTH, HEIGHT),
    ).toEqual({ x: 1e16, z: 2e16, zoom: SYSTEM_LABEL_ZOOM });
  });

  it('does not widen a system framing to reach its neighbours', () => {
    const framing = framingFor(
      { kind: 'system', id: 30000142 },
      NODES,
      WIDTH,
      HEIGHT,
    );
    // Amarr is 9e16 away. A bounds-based rule would have zoomed out to hold it.
    expect(framing?.zoom).toBe(SYSTEM_LABEL_ZOOM);
    expect(framing?.zoom).toBeGreaterThan(-49);
  });

  // A cluster is framed, because what is wanted there is to see the whole set.
  it('frames a region to the bounds of its own nodes', () => {
    expect(
      framingFor({ kind: 'region', id: 10000002 }, NODES, WIDTH, HEIGHT),
    ).toEqual(
      fitCamera(
        { minX: 1e16, maxX: 3e16, minZ: 2e16, maxZ: 6e16 },
        WIDTH,
        HEIGHT,
      ),
    );
  });

  it('frames a constellation the same way', () => {
    expect(
      framingFor({ kind: 'constellation', id: 20000020 }, NODES, WIDTH, HEIGHT),
    ).toEqual(
      fitCamera(
        { minX: 1e16, maxX: 3e16, minZ: 2e16, maxZ: 6e16 },
        WIDTH,
        HEIGHT,
      ),
    );
  });

  // Duzna Kah (20010000) holds only Zarzakh; Manifest District (20010001) only
  // Manifest. Five more single-system constellations exist in WORMHOLE, so this
  // is an ordinary entry, not a hypothetical. A zero span sends fitZoom to
  // FALLBACK_FIT_ZOOM, which is the galaxy fit — silently ignoring the request.
  it('falls back to the system zoom for a cluster with one node', () => {
    const solitary = [
      node({
        systemId: 30100000,
        constellationId: 20010000,
        x: 7e16,
        z: -3e16,
      }),
    ];
    expect(
      framingFor(
        { kind: 'constellation', id: 20010000 },
        solitary,
        WIDTH,
        HEIGHT,
      ),
    ).toEqual({ x: 7e16, z: -3e16, zoom: SYSTEM_LABEL_ZOOM });
  });

  // The same trap on one axis: fitZoom needs both spans positive.
  it('falls back to the system zoom for a cluster with no width', () => {
    const column = [
      node({ systemId: 30000142, constellationId: 20000020, x: 4e16, z: 1e16 }),
      node({ systemId: 30000144, constellationId: 20000020, x: 4e16, z: 5e16 }),
    ];
    const framed = framingFor(
      { kind: 'constellation', id: 20000020 },
      column,
      WIDTH,
      HEIGHT,
    );
    expect(framed).toEqual({ x: 4e16, z: 3e16, zoom: SYSTEM_LABEL_ZOOM });
  });

  // The map is not a validator, and showing a 404 would mean waiting for the
  // whole scene. Null sends the caller back to its autofit.
  it('is null for an id the loaded scene does not hold', () => {
    expect(
      framingFor({ kind: 'system', id: 39999999 }, NODES, WIDTH, HEIGHT),
    ).toBeNull();
    expect(
      framingFor({ kind: 'region', id: 10000070 }, NODES, WIDTH, HEIGHT),
    ).toBeNull();
  });

  // Before the host is measured there is no frame to compute, and fitZoom would
  // hand back FALLBACK_FIT_ZOOM for a viewport of zero.
  it('is null until the viewport has been measured', () => {
    expect(
      framingFor({ kind: 'region', id: 10000002 }, NODES, 0, 0),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd frontend && npx vitest run src/utils/map/framing.spec.ts`
Expected: FAIL — `Failed to resolve import "./framing"`.

- [ ] **Step 3: `framing.ts`'i yaz**

```typescript
import type { MapBounds } from '@/generated/graphql';
import { fitCamera, type Framing, type MapCamera } from './camera';
import { SYSTEM_LABEL_ZOOM } from './lod';
import { boundsCenter } from './origin';

/**
 * What framing needs from a node. mapGeometry's nodes already carry all five
 * and are loaded with the scene, which is why this slice needs no query: the
 * answer to "where is region 10000002" is already in the browser.
 */
export interface FramingNode {
  systemId: number;
  constellationId: number;
  regionId: number;
  x: number;
  z: number;
}

/** Null for an empty set: an infinite box is not a smaller mistake than none. */
export function nodeBounds(
  nodes: Pick<FramingNode, 'x' | 'z'>[],
): MapBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.z < minZ) minZ = node.z;
    if (node.z > maxZ) maxZ = node.z;
  }

  return { minX, maxX, minZ, maxZ };
}

/**
 * The camera a URL parameter asks for, or null to leave the caller on its
 * autofit.
 *
 * Two mechanisms, and the asymmetry is the design. A SYSTEM is centred at a
 * measured constant, so every system arrives at the same scale with its
 * neighbours 59.9 px away. A REGION or CONSTELLATION is framed to the bounds of
 * its nodes, because what is wanted there is the whole set.
 *
 * A cluster with no extent on either axis would send fitZoom to
 * FALLBACK_FIT_ZOOM — the galaxy fit — which would answer "frame this
 * constellation" by showing the galaxy. Two NEW_EDEN constellations hold one
 * system each (Duzna Kah, Manifest District) and five more do in WORMHOLE, so
 * it falls back to the system zoom instead, the same constant a focus uses.
 */
export function framingFor(
  framing: Framing | null,
  nodes: FramingNode[],
  width: number,
  height: number,
): MapCamera | null {
  if (!framing) return null;
  if (!(width > 0) || !(height > 0)) return null;

  if (framing.kind === 'system') {
    const node = nodes.find((candidate) => candidate.systemId === framing.id);
    return node ? { x: node.x, z: node.z, zoom: SYSTEM_LABEL_ZOOM } : null;
  }

  const members = nodes.filter((candidate) =>
    framing.kind === 'constellation'
      ? candidate.constellationId === framing.id
      : candidate.regionId === framing.id,
  );

  const bounds = nodeBounds(members);
  if (!bounds) return null;

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  if (!(spanX > 0) || !(spanZ > 0)) {
    return { ...boundsCenter(bounds), zoom: SYSTEM_LABEL_ZOOM };
  }

  return fitCamera(bounds, width, height);
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `cd frontend && npx vitest run src/utils/map/framing.spec.ts`
Expected: PASS, 12 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/map/framing.ts frontend/src/utils/map/framing.spec.ts
git commit -m "feat(frontend): turn a map url parameter into a camera"
```

---

## Task 4: `useMapCamera` — URL'in tek yazarı

**Files:**

- Modify: `frontend/src/components/UniverseMap/useMapCamera.ts`
- Test: `frontend/src/components/UniverseMap/useMapCamera.spec.ts` (yeni)

**Interfaces:**

- Consumes: `cameraQuery`, `parseCamera`, `parseFocus` (Task 2)
- Produces: `useMapCamera(scope: MapScope, fallback: MapCamera | null): { camera: MapCamera | null; onCameraChange: (next: MapCamera) => void; focus: number | null; onFocusChange: (next: number | null) => void }`

İkinci parametrenin adı `fit`'ten **`fallback`**'e dönüyor. Hook'un sözleşmesi zaten "URL'de kamera yoksa sana verdiğim şey"di; Task 5'ten sonra oraya `framing ?? fit` geliyor ve `fit` adı yalan söylemeye başlıyor.

**Uygulamada plandan sapılan yer, ve sebebi.** Plan URL'i tek bir efektte
okuyordu ve `onCameraChange`/`onFocusChange` güncel değerleri ayna ref'lerinden
alıyordu. İkisi de değişti:

- **Efekt ikiye bölündü.** `react-hooks/set-state-in-effect` korumasız duran
  `setState`'i bildiriyor. Kameranınki zaten iki erken dönüşün arkasında, ama
  focus'unki olamaz: `?focus=` linki x/z/zoom taşımıyor, yani kameranın erken
  dönüşünün arkasında kalsaydı seçim hiç state'e ulaşmazdı. `main` bu kuralı
  tetiklemiyordu çünkü tek state'li bir dosyada analiz oraya ulaşmıyor — çağrı
  aynı çağrıydı.
- **Focus efektinde tek satırlık `eslint-disable`**, gerekçesi dosyada. `focus`'u
  bağımlılığa koyup karşılaştırmak denendi ve **yanlış**: `onFocusChange` URL'i
  yazdıktan sonra router onu işleyene kadar geçen pencerede bayat `searchParams`
  kullanıcının az önce yaptığı seçimi geri alıyor. Beş test bunu yakaladı.
- **Ayna ref'leri kalktı**, iki callback düz bağımlılık alıyor. `useMapPointer`
  zaten `onCameraChange`'i ve `pick`'i ref'te tutuyor
  (`useMapPointer.ts:72-84`), yani kimlik değişmesi bedava.
- **`setCamera` fonksiyonel güncelleme** kullanıyor: `parseCamera` her çağrıda
  yeni nesne üretiyor, yani düz atama eşitlikte bail-out edemiyor ve yalnız
  `focus` değişen bir URL'de kamerayı boşuna yeniden render ediyordu.

Bir focus yazımı **debounce'suz**. Pan sürekli bir olay akışı ve 250 ms onu tarih kaydı yağmurundan koruyor; tıklama tek olay, ve popup'ın URL'e girmesi için çeyrek saniye beklemek arada basılan bir geri tuşuna onu kaybettirir.

- [ ] **Step 1: Testleri yaz**

`frontend/src/components/UniverseMap/useMapCamera.spec.ts`:

```typescript
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

import { MapScope } from '@/generated/graphql';
import { useMapCamera } from './useMapCamera';

/** Stands in for the autofit the component computes from the geometry. */
const FIT = { x: 0, z: 0, zoom: -50 };
const URL_DEBOUNCE_MS = 250;

beforeEach(() => {
  searchParams = new URLSearchParams('');
  replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMapCamera', () => {
  it('is the fallback until the camera moves', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    expect(result.current.camera).toEqual(FIT);
    expect(result.current.focus).toBeNull();
  });

  it('reads a focus out of the URL it was mounted with', () => {
    searchParams = new URLSearchParams('focus=30000142');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    expect(result.current.focus).toBe(30000142);
  });

  // A click is one event: waiting out the pan debounce would lose the selection
  // to a back button pressed in between.
  it('writes a selection at once, without the pan debounce', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));

    expect(replace).toHaveBeenCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&focus=30000142',
      { scroll: false },
    );
    expect(result.current.focus).toBe(30000142);
  });

  // Clicking empty space clears it, and nothing but the absent parameter says so.
  it('removes the parameter when the selection is cleared', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));
    act(() => result.current.onFocusChange(null));

    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00',
      {
        scroll: false,
      },
    );
    expect(result.current.focus).toBeNull();
  });

  // The hazard the whole slice is built around: cameraQuery writes a fresh
  // URLSearchParams, so a camera write that did not carry the focus would drop
  // the popup out of the URL on the first drag.
  it('carries the selection into a camera write instead of erasing it', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));
    act(() => result.current.onCameraChange({ x: 1e9, z: 2e9, zoom: -45 }));
    act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS));

    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=1000000000&z=2000000000&zoom=-45.00&focus=30000142',
      { scroll: false },
    );
  });

  it('debounces a camera write, and writes once for a burst of them', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onCameraChange({ x: 1e9, z: 0, zoom: -50 }));
    act(() => result.current.onCameraChange({ x: 2e9, z: 0, zoom: -50 }));
    act(() => result.current.onCameraChange({ x: 3e9, z: 0, zoom: -50 }));
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      '?scope=NEW_EDEN&x=3000000000&z=0&zoom=-50.00',
      {
        scroll: false,
      },
    );
  });

  // Its own echo is not an external change; the back button is. The comparison
  // is the output of one pure function against itself, which is why focus came
  // along for free.
  it('keeps its own write, and accepts one it did not make', () => {
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    act(() => result.current.onFocusChange(30000142));

    searchParams = new URLSearchParams(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00&focus=30000142',
    );
    rerender();
    expect(result.current.focus).toBe(30000142);

    // The back button: the same camera, no focus. Not this hook's own write.
    searchParams = new URLSearchParams('scope=NEW_EDEN&x=0&z=0&zoom=-50.00');
    rerender();
    expect(result.current.focus).toBeNull();
  });

  it('takes a camera that changes in the URL underneath it', () => {
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    searchParams = new URLSearchParams('scope=NEW_EDEN&x=5e9&z=0&zoom=-44');
    rerender();

    expect(result.current.camera).toEqual({ x: 5e9, z: 0, zoom: -44 });
  });

  // Nothing has been written yet, so there is no camera in state — but the
  // frame on screen is the fallback, and that is what the selection has to be
  // written against.
  it('writes a selection made before the camera has ever moved', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    act(() => result.current.onFocusChange(30000142));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('writes nothing at all when there is no frame yet', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, null));
    act(() => result.current.onFocusChange(30000142));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.focus).toBe(30000142);
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd frontend && npx vitest run src/components/UniverseMap/useMapCamera.spec.ts`
Expected: FAIL — `result.current.onFocusChange is not a function`.

- [ ] **Step 3: Hook'u yaz**

`useMapCamera.ts` bütünüyle:

```typescript
'use client';

import type { MapScope } from '@/generated/graphql';
import {
  cameraQuery,
  parseCamera,
  parseFocus,
  type MapCamera,
} from '@/utils/map/camera';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 250 ms. Without it a drag writes a history entry per frame; with a longer one
 * the URL lags visibly behind the view when you stop moving.
 */
const URL_DEBOUNCE_MS = 250;

/** One write of the URL: the two things this hook owns there. */
interface WrittenUrl {
  camera: MapCamera;
  focus: number | null;
}

export function useMapCamera(scope: MapScope, fallback: MapCamera | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [camera, setCamera] = useState<MapCamera | null>(() =>
    parseCamera(searchParams),
  );
  const [focus, setFocus] = useState<number | null>(() =>
    parseFocus(searchParams),
  );

  /** The last URL this hook wrote, so its own writes are recognisable. */
  const lastWritten = useRef<WrittenUrl | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The autofit is not known until the geometry lands, so until the pointer has
  // moved the camera simply *is* the fallback — resolved here at render time
  // rather than copied into state by an effect. Writing it to state would cost
  // an extra render pass and trips react-hooks/set-state-in-effect; it would
  // also pin the very first frame, so a window resized before anyone touched
  // the map would keep the stale one. Once `camera` is set, `fallback` is
  // ignored, which is what keeps a later resize from throwing away where the
  // user has moved to.
  const effective = camera ?? fallback;

  const write = useCallback(
    (next: WrittenUrl, immediate: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      const run = () => {
        lastWritten.current = next;
        router.replace(`?${cameraQuery(scope, next.camera, next.focus)}`, {
          scroll: false,
        });
      };
      // A pan is a stream of events and is debounced. A click is one event:
      // waiting out the debounce to put the popup in the URL would lose it to a
      // back button pressed in between.
      if (immediate) run();
      else timer.current = setTimeout(run, URL_DEBOUNCE_MS);
    },
    [router, scope],
  );

  // The URL is authoritative for anything that did not come from the pointer: a
  // nav link, the back button, a pasted link. App Router keeps this component
  // mounted across a query string change, so reading once on mount would
  // swallow all three.
  //
  // Telling its own writes apart is a comparison of one pure function's output
  // against itself, which is why the focus came along for free when cameraQuery
  // took a third argument.
  //
  // The camera is applied through a functional update rather than `setCamera
  // (fromUrl)`: parseCamera allocates a fresh object every call, so a plain set
  // can never bail out on equality and every URL change would re-render whether
  // the frame moved or not. Returning `current` when the two agree is what makes
  // the no-op actually free — and is what react-hooks' set-state-in-effect rule
  // is asking for.
  useEffect(() => {
    const fromUrl = parseCamera(searchParams);
    if (!fromUrl) return;

    const written = lastWritten.current;
    if (
      written &&
      cameraQuery(scope, fromUrl, parseFocus(searchParams)) ===
        cameraQuery(scope, written.camera, written.focus)
    ) {
      return;
    }

    setCamera((current) =>
      current &&
      current.x === fromUrl.x &&
      current.z === fromUrl.z &&
      current.zoom === fromUrl.zoom
        ? current
        : fromUrl,
    );
  }, [searchParams, scope]);

  // A focus is a number, so setting it to the value it already holds costs
  // nothing. Its own effect rather than the camera's: a `?focus=` link carries
  // no x/z/zoom, and behind that effect's early return the selection would
  // never reach state at all.
  //
  // Deliberately unguarded, and `focus` is deliberately not a dependency. The
  // URL is an external store and this effect is the subscription to it — the
  // use the rule's own documentation allows, which it cannot recognise here
  // because `searchParams` reaches the hook as a value rather than through a
  // callback. Comparing against the current focus is what a guard would mean,
  // and it would be wrong: between `onFocusChange` writing the URL and the
  // router committing it, the stale searchParams would revert the selection the
  // user just made. With `[searchParams]` alone the effect simply does not run
  // in that window, and the write path is what keeps the two in agreement.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocus(parseFocus(searchParams));
  }, [searchParams]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);
      write({ camera: next, focus }, false);
    },
    [write, focus],
  );

  const onFocusChange = useCallback(
    (next: number | null) => {
      setFocus(next);
      // Before the geometry lands there is no frame to write the selection
      // against. The state still moves, so the popup opens either way.
      if (effective) write({ camera: effective, focus: next }, true);
    },
    [write, effective],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { camera: effective, onCameraChange, focus, onFocusChange };
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `cd frontend && npx vitest run src/components/UniverseMap/useMapCamera.spec.ts`
Expected: PASS, 10 test.

- [ ] **Step 5: Bileşenin hâlâ derlendiğini gör**

Run: `cd frontend && npx tsc --noEmit`
Expected: sessiz. `UniverseMap.tsx` hook'u hâlâ iki alanla çağırıyor; `focus`/`onFocusChange` şimdilik kullanılmıyor, bu bir hata değil.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UniverseMap/useMapCamera.ts \
  frontend/src/components/UniverseMap/useMapCamera.spec.ts
git commit -m "feat(frontend): make the map's url carry its selected system"
```

---

## Task 5: `UniverseMap` — seçimi URL'den okumak, çerçevelemeyi kameraya vermek

**Files:**

- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Test: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: `parseFraming` (Task 2), `framingFor` (Task 3), `useMapCamera`'nın dört alanı (Task 4)
- Produces: bileşen davranışı; dışarıya yeni bir API yok

**İki isim çakışması var ve ikisi de kasıtlı olarak çözülüyor.**

1. `UniverseMap.tsx` içinde zaten `focus` adlı bir yerel değer var (satır 125) ve o **bambaşka bir şey**: kameranın merkezine en yakın düğüm, celestial'ların hangi sistem için akacağını seçiyor. Ona dokunulmuyor. URL'den gelen odak bileşende `selected` adıyla duruyor — zaten bugün o adla duran state'in yerini alıyor.
2. `const [selected, setSelected] = useState<number | null>(null)` **siliniyor**. Seçim artık hook'un sahibi olduğu bir şey; bileşende iki kopyası olsaydı URL ile popup ayrı ayrı yaşardı.

**`limits` değişmiyor ve bu bir karar.** `zoomLimits(fit.zoom)` zoom tabanını `fit - 2` veriyor. Oraya `framing` geçseydi `?focus=` ile gelen bir kullanıcı `SYSTEM_LABEL_ZOOM - 2`'nin altına inemez, yani galaksiye geri zoom'layamazdı. Limitler galaksi autofitinden gelmeye devam ediyor; hook'un yedeği `framing ?? fit`'ten geliyor. Spec'in "fit iki iş yapıyor ve ikisi ayrılmak zorunda" dediği yer tam burası, ve ayrılma `fit`'i olduğu yerde bırakarak oluyor.

- [ ] **Step 1: Testleri yaz**

`UniverseMap.spec.tsx`'in sonuna, mevcut `describe('picking', ...)` bloğundan sonra:

```typescript
  // Three parameters resolved entirely on the client: mapGeometry's nodes carry
  // systemId, constellationId and regionId and are already loaded.
  describe('deep links', () => {
    /** Two systems of The Forge and one of Domain, so a framing has extent. */
    const LINKED = {
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
          {
            systemId: 30000144,
            name: 'Perimeter',
            x: 2e17,
            z: 1e17,
            radius: 3.88e12,
            securityStatus: 1,
            constellationId: 20000020,
            regionId: 10000002,
          },
          {
            systemId: 30002187,
            name: 'Amarr',
            x: -1e17,
            z: -2e17,
            radius: 3.88e12,
            securityStatus: 1,
            constellationId: 20000322,
            regionId: 10000043,
          },
        ],
        edges: [],
      },
    };

    beforeEach(() => {
      useMapGeometryQuery.mockReturnValue({ data: LINKED, loading: false });
    });

    async function mountedWith(query: string) {
      searchParams = new URLSearchParams(query);
      render(<UniverseMap scope={MapScope.NewEden} />);
      await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());
    }

    /** What the scene's transform must be for a camera, as one assertion. */
    function expectCamera(expected: {
      x: number;
      z: number;
      zoom: number;
    }) {
      const t = cameraTransform(expected, VIEWPORT.width, VIEWPORT.height);
      expect(scene.world.scale.set).toHaveBeenLastCalledWith(t.scaleX, t.scaleY);
      expect(scene.world.position.set).toHaveBeenLastCalledWith(t.x, t.y);
    }

    it('opens the popup for a system named by ?focus=', async () => {
      await mountedWith('focus=30000142');

      expect(await screen.findByText('Kimotoro · The Forge')).toBeInTheDocument();
      expect(detailsQueries).toContain(30000142);
    });

    it('centres the camera on that system rather than framing its neighbours', async () => {
      await mountedWith('focus=30000142');
      expectCamera({ x: 3e17, z: 2e17, zoom: SYSTEM_LABEL_ZOOM });
    });

    it('frames a region to its own systems, and opens no popup', async () => {
      await mountedWith('region=10000002');

      expectCamera(
        fitCamera(
          { minX: 2e17, maxX: 3e17, minZ: 1e17, maxZ: 2e17 },
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      );
      expect(screen.queryByText('Kimotoro · The Forge')).not.toBeInTheDocument();
    });

    it('frames a constellation the same way', async () => {
      await mountedWith('constellation=20000020');
      expectCamera(
        fitCamera(
          { minX: 2e17, maxX: 3e17, minZ: 1e17, maxZ: 2e17 },
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      );
    });

    // The back button: returning from "Open the system" carries both, and
    // re-centring would steal the frame the user left.
    it('keeps an explicit camera that arrives together with a focus', async () => {
      await mountedWith('x=0&z=0&zoom=-48&focus=30000142');

      expectCamera({ x: 0, z: 0, zoom: -48 });
      expect(await screen.findByText('Kimotoro · The Forge')).toBeInTheDocument();
    });

    // The map is not a validator: an id from another scene is ignored, and the
    // autofit is what is left.
    it('ignores an id the loaded scene does not hold', async () => {
      await mountedWith('focus=39999999');

      expectCamera(
        fitCamera(
          LINKED.mapGeometry.bounds,
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      );
      expect(screen.queryByText('Kimotoro · The Forge')).not.toBeInTheDocument();
    });
  });
```

Dosyanın üstündeki import bloğuna eklenecekler: `@/utils/map/camera`'dan `fitCamera` (zaten var) ve `@/utils/map/lod`'dan `SYSTEM_LABEL_ZOOM`. `lod` bu dosyada mock'lanmıyor, gerçek modül kullanılıyor.

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd frontend && npx vitest run src/components/UniverseMap/UniverseMap.spec.tsx`
Expected: FAIL — `?focus=` ile popup açılmıyor, kamera autofit'te kalıyor.

- [ ] **Step 3: Bileşeni bağla**

`UniverseMap.tsx`'te dört değişiklik.

**(a)** Import'lara:

```typescript
import { parseFraming } from '@/utils/map/camera';
import { framingFor } from '@/utils/map/framing';
import { useSearchParams } from 'next/navigation';
```

`parseFraming` mevcut `@/utils/map/camera` import bloğuna alfabetik girecek (`fitCamera`'dan sonra).

**(b)** `const [selected, setSelected] = useState<number | null>(null);` satırı ve üstündeki yorum siliniyor, yerine hiçbir şey gelmiyor — açıklaması hook'a taşındı.

**(c)** `fit` memo'sunun hemen altına, `useMapCamera` çağrısının **üstüne**:

```typescript
const searchParams = useSearchParams();

// Where the URL says to look. Resolved against the loaded scene on the
// client — every node carries its three ids — so none of this costs a query.
// Memoised because `framingFor` filters all 5,241 nodes, and it is an
// argument to a hook that runs on every render.
const framing = useMemo(
  () =>
    framingFor(
      parseFraming(searchParams),
      geometry?.nodes ?? [],
      size.width,
      size.height,
    ),
  [searchParams, geometry, size.width, size.height],
);

// `framing ?? fit` rather than a new branch inside the hook: the hook already
// returns "the camera to use when the URL carries none", and a framing is
// exactly that. An explicit x/z/zoom in the URL still wins over both, which
// is what makes the back button whole.
const {
  camera,
  onCameraChange,
  focus: selected,
  onFocusChange: setSelected,
} = useMapCamera(scope, framing ?? fit);
```

Mevcut `const { camera, onCameraChange } = useMapCamera(scope, fit);` satırı bununla değişiyor.

**(d)** `limits`'in üstüne, satır 383'teki yoruma ek:

```typescript
// From the galaxy autofit, never from `framing`. zoomLimits puts the floor at
// fit - 2; a `?focus=` link arrives at SYSTEM_LABEL_ZOOM, and a floor two
// levels under *that* would forbid zooming back out to the galaxy at all.
const limits = fit ? zoomLimits(fit.zoom) : null;
```

`pick.onSelect` zaten `setSelected(...)` çağırıyor, `SystemPopup`'ın `onClose`'u zaten `setSelected(null)`, ve ikisi de artık hook'un setter'ına gidiyor. Tek ek: `pick` memo'sunun bağımlılık dizisine `setSelected` giriyor — `useState`'in setter'ı lint için sabitti, `useCallback`'inki değil.

- [ ] **Step 4: Testin geçtiğini gör**

Run: `cd frontend && npx vitest run src/components/UniverseMap/UniverseMap.spec.tsx`
Expected: PASS — yeni altı test ve mevcut picking testleri birlikte.

- [ ] **Step 5: Tüm frontend testlerini koş**

Run: `cd frontend && yarn test`
Expected: PASS. Özellikle `?focus=` ile açılan popup'ın 3a'nın picking testlerini bozmadığı.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UniverseMap/UniverseMap.tsx \
  frontend/src/components/UniverseMap/UniverseMap.spec.tsx
git commit -m "feat(map): open the map already looking at a system, region or constellation"
```

---

## Task 6: Üç sayfadan giriş

**Files:**

- Modify: `frontend/src/app/regions/[id]/page.tsx`
- Modify: `frontend/src/app/constellations/[id]/page.tsx`
- Modify: `frontend/src/app/solar-systems/[id]/page.tsx`

**Interfaces:**

- Consumes: `scopeForRegionId` (Task 1)
- Produces: kullanıcıya görünen üç link

**Testsiz, bilerek.** Spec'in dediği gibi: bu üç sarma `build` ve gözle doğrulanıyor. Üç sayfanın hiçbirinin spec dosyası yok ve bir `<Link>`'in `href`'ini iddia eden bir test, linkin doğru yere gittiğini değil, kodun kendisini tekrar ederdi.

**Link neden bileşende değil, sayfada.** `RegionMap`, `ConstellationMap` ve `SolarSystemMap` **11 yerde** kullanılıyor ve çoğunun (`KillmailRow`, `TopSystemsCard`, `SolarSystemCard`) elinde bölge id'si yok. Bileşen linki kendi kursaydı o çağrı yerleri scope'u sistem id'sinden tahmin etmek zorunda kalırdı ve Pochven'in 27 sistemi sessizce yanlış sahneye giderdi. Üç detay sayfasının üçünün de bölge id'si var. **Liste kartlarındaki küçük resimler bu task'ta değişmiyor.**

- [ ] **Step 1: Bölge sayfası**

`frontend/src/app/regions/[id]/page.tsx`. Bu dosya `next/link`'i **henüz import etmiyor**; import bloğuna eklenecek (`useRouter` satırının üstüne, alfabetik olarak `next/link` `next/navigation`'dan önce gelir):

```typescript
import Link from 'next/link';
```

`scopeForRegionId` de `@/utils/map/camera`'dan import edilecek.

`return (` satırından önce:

```typescript
  // Null for abyssal, proving and GPMR-01: they have no scene, so they get no
  // link rather than one that opens NEW_EDEN and ignores its parameter.
  const mapScope = scopeForRegionId(region.id);
  const regionMap = (
    <RegionMap
      regionId={region.id}
      regionName={region.name}
      size={256}
      className="w-full h-full"
    />
  );
```

Ve mevcut `<RegionMap ... />` bloğu (129-134. satırlar) şununla değişiyor:

```tsx
{
  mapScope ? (
    <Link
      href={`/map?scope=${mapScope}&region=${region.id}`}
      className="w-full h-full"
      title={`See ${region.name} on the universe map`}
    >
      {regionMap}
    </Link>
  ) : (
    regionMap
  );
}
```

- [ ] **Step 2: Takımyıldız sayfası**

`frontend/src/app/constellations/[id]/page.tsx`. `Link` zaten import edilmiş (11. satır); yalnızca `scopeForRegionId` eklenecek.

`return (` satırından önce:

```typescript
  // The constellation's own id names the framing; the scope has to come from
  // its region, because a constellation id carries no scope signal — Pochven's
  // three sit at 20000787-20000789, inside the ordinary k-space band.
  const mapScope = constellation.region
    ? scopeForRegionId(constellation.region.id)
    : null;
  const constellationMap = (
    <ConstellationMap
      constellationId={constellation.id}
      constellationName={constellation.name}
      size={256}
      className="w-full h-full"
    />
  );
```

Mevcut `<ConstellationMap ... />` bloğu (134-139. satırlar):

```tsx
{
  mapScope ? (
    <Link
      href={`/map?scope=${mapScope}&constellation=${constellation.id}`}
      className="w-full h-full"
      title={`See ${constellation.name} on the universe map`}
    >
      {constellationMap}
    </Link>
  ) : (
    constellationMap
  );
}
```

- [ ] **Step 3: Sistem sayfası**

`frontend/src/app/solar-systems/[id]/page.tsx`. `Link` zaten import edilmiş (24. satır); `scopeForRegionId` eklenecek.

`return (` satırından önce:

```typescript
  // Two hops for the scope: the system's own id cannot give it. Pochven's 27
  // systems sit at 30000021-30045329, inside the k-space band, because CCP
  // converted them from existing systems and they kept their ids.
  const mapScope = system.constellation?.region
    ? scopeForRegionId(system.constellation.region.id)
    : null;
  const solarSystemMap = (
    <SolarSystemMap
      systemId={system.id}
      systemName={system.name}
      size={256}
      className="w-full h-full"
    />
  );
```

Mevcut `<SolarSystemMap ... />` bloğu (161-166. satırlar):

```tsx
{
  mapScope ? (
    <Link
      href={`/map?scope=${mapScope}&focus=${system.id}`}
      className="w-full h-full"
      title={`See ${system.name} on the universe map`}
    >
      {solarSystemMap}
    </Link>
  ) : (
    solarSystemMap
  );
}
```

- [ ] **Step 4: Tiplerin geçtiğini gör**

Run: `cd frontend && npx tsc --noEmit`
Expected: sessiz. Özellikle `constellation.region` ve `system.constellation?.region`'ın isteğe bağlı olduğu ve her ikisinin de korunduğu.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/regions/\[id\]/page.tsx \
  frontend/src/app/constellations/\[id\]/page.tsx \
  frontend/src/app/solar-systems/\[id\]/page.tsx
git commit -m "feat(frontend): link the three detail pages into the universe map"
```

---

## Task 7: Tam doğrulama ve PR

**Files:**

- Modify: `docs/superpowers/plans/2026-09-14-universe-map-focus.md` (sapma olduysa)
- PR: [#210](https://github.com/umutyerebakmaz/killreport/pull/210)

- [ ] **Step 1: Tam takımı koş, sırasıyla**

```bash
cd /root/killreport
yarn test
yarn workspace frontend lint
yarn workspace frontend build
```

Kabul kriterleri:

- `yarn test`: backend ve frontend, sıfır başarısız.
- `lint`: **228 problems**, ve hiçbir satır bu dalın dokunduğu altı dosyayı adlandırmıyor. Sayı arttıysa artıran satır bu dala aittir.
- `build`: başarılı. **Bu komut :3000'deki dev sunucusunu öldürür**, bu yüzden en sonda.

- [ ] **Step 2: Prettier**

```bash
cd /root/killreport
npx prettier --check $(git diff --name-only main...HEAD)
```

Expected: hepsi `All matched files use Prettier code style!`. CI'ın **Format** adımı bütün depoyu tarıyor ve `.husky/pre-commit` yalnızca husky'nin kurulu olduğu checkout'ta çalışıyor.

- [ ] **Step 3: Backend'in dokunulmadığını kanıtla**

```bash
git diff --stat main...HEAD -- backend/
```

Expected: yalnızca `universe-map.service.ts`, yalnızca yorum satırları (Task 1, Step 5). Başka bir şey çıkarsa plandan sapılmış demektir.

- [ ] **Step 4: Gerçek veriyle gözle doğrulama — kullanıcının işi**

Sunucular ayakta (`yarn dev:backend`, `yarn dev:frontend`), sonra:

| Bakılacak                | URL                                                                        | Beklenen                                                           |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Odak                     | `/map?scope=NEW_EDEN&focus=30000142`                                       | Jita ortada, popup açık, komşuları görünür                         |
| Odak, Pochven            | `/map?scope=POCHVEN&focus=30045329`                                        | Sistem ortada, popup açık — yanlış sahneye düşmüyor                |
| Bölge                    | `/map?scope=NEW_EDEN&region=10000002`                                      | The Forge kenarlarda payla çerçevelenmiş, popup yok                |
| Takımyıldız              | `/map?scope=NEW_EDEN&constellation=20000020`                               | Kimotoro çerçevelenmiş                                             |
| Tek sistemli takımyıldız | `/map?scope=NEW_EDEN&constellation=20010000`                               | Zarzakh ortada, galaksi fitine düşmüyor                            |
| Pan sonrası URL          | yukarıdakilerden biri, sonra sürükle                                       | URL `?scope=&x=&z=&zoom=` oluyor, `region`/`constellation` düşüyor |
| Seçim pan'de kalıyor     | `focus=` ile aç, sürükle                                                   | `focus` URL'de kalıyor, popup sistemine çapalı                     |
| Geri tuşu                | popup → "Open the system" → geri                                           | Ayrılınan kare korunuyor, popup açık                               |
| Sayfa girişleri          | `/regions/10000002`, `/constellations/20000020`, `/solar-systems/30000142` | Küçük resim tıklanabilir, doğru sahneye ve yere götürüyor          |

**Spec'in 1. açık sorusu burada cevaplanıyor:** `SYSTEM_LABEL_ZOOM` odak için doğru derinlik mi. Yoğun bir highsec kümesinde (Jita) ve seyrek bir nullsec bölgesinde ayrı ayrı bakılacak. Tek sabit, `lod.ts`'te, gözle ayarlanıyor.

- [ ] **Step 4b: Sapmaları plana işle**

Doğrulamada bir sabit değiştiyse veya bir task planından saptıysa, **plan dosyası düzeltilecek** — plan ve spec işle birlikte merge oluyor, uygulanmamış hâliyle değil.

- [ ] **Step 5: PR #210'u güncelle**

PR gövdesinde spec'in altına yapışmış olan `pull_request_template.md` artığı (`## 📋 Description`, `## 🎯 Type of Change`, boş `Fixes #(issue number)`) **siliniyor**; gövde #195/#196'daki gibi düz prose kalıyor. Mevcut spec anlatısının altına planın getirdiklerini ekleyen bir bölüm yazılacak; en az şunlar:

- `scopeForRegionId`'nin `MapScope | null` dönmesi ve null'ın "bu bölgenin sahnesi yok" demesi — spec'in açık bıraktığı ve bu planın kapattığı karar.
- `framingFor`'un tek eksende sıfır açıklığı da dejenere sayması, ve sebebinin `fitZoom`'un `FALLBACK_FIT_ZOOM`'u olması.
- `cameraQuery`'nin üçüncü argümanının zorunlu olması.
- Ölçümler: Pochven'in takımyıldızları `20000787`–`20000789`, tek sistemli takımyıldızlar NEW_EDEN'de 2 / WORMHOLE'da 5.
- 1. açık sorunun (odak derinliği) gözle nasıl sonuçlandığı.

```bash
gh pr edit 210 --body-file /tmp/pr-210-body.md
```

---

## Self-review notları

**Spec kapsaması.** Spec'in her bölümü bir task'a düşüyor: _Üç parametre, iki mekanizma_ → Task 2 + 3; _Dejenere durumlar_ → Task 3, Step 1'in son iki testi; _URL'in tek yazarı_ ve _`region`/`constellation` yazılmıyor_ → Task 4; _Öncelik_ ve _`useMapCamera` çağrısındaki tek satırlık yer_ → Task 5, Step 3(c) ve 3(d); _Scope, ve Pochven_ → Task 1; _Bu yüzden link sayfanın işi_ → Task 6; _Mimari sınır_ → `scene/` altında hiçbir dosya yok, Task 7 Step 3 bunu kanıtlıyor; _Test ve doğrulama_ → Task 1-5'in testleri ve Task 7'nin tablosu.

**Spec'i aşan iki karar, ikisi de yukarıda gerekçesiyle duruyor:** `scopeForRegionId`'nin null dönmesi (Task 1) ve tek eksende sıfır açıklığın dejenere sayılması (Task 3). İkisi de spec'in bıraktığı boşluğu doldurma, yönünü değiştirme değil.

**Tip tutarlılığı.** `Framing` `camera.ts`'te tanımlanıp `framing.ts`'te tüketiliyor; `FramingNode`'un beş alanı `MapNode`'un bir alt kümesi, yani `geometry.nodes` doğrudan geçiyor. `useMapCamera`'nın dönüşündeki `focus`/`onFocusChange`, `UniverseMap`'te `selected`/`setSelected` adlarına bağlanıyor ve o adlar bileşende zaten kullanımda olduğu için `SystemPopup` ile `pick.onSelect` değişmiyor.

**Bu planın dokunmadıkları:** `scene/` altındaki altı dosya, backend'in tek satır yorumu dışında her şey, `frontend/src/generated/`, ve 11 çağrı yerinin sekizindeki küçük resimler.
