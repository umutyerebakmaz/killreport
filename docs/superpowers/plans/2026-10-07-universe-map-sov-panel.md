# Evren haritası — sov paneli ve campaign timer'ları: implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/sovereignty/map`'in ECharts haritasını emekliye ayırıp onun işini — ve FC'nin timer ihtiyacını — `/map`'in sov katmanına taşımak: URL'de katman ve sahip, campaign halkası, geri sayım çipleri, sahip izolasyonu, Timers / Owners / Changes paneli, paylaşılabilir link.

**Architecture:** URL durumu (`layer`, `owner`) `useMapCamera`'ya katılır, böylece URL'yi tek bir yazar yazar. Her karar `frontend/src/utils/map/` altında saf ve testli bir fonksiyondur (`countdown.ts`, `campaignMarks.ts`, `layers.ts`, `framing.ts`, `camera.ts`); Pixi'ye atama `scene/`'de, DOM overlay'i `labels/`'da yaşar. Halkalar ekran uzayında tek bir `Graphics`, çipler label havuzundan ayrı bir DOM katmanıdır — metinleri saniyede bir değişir, label havuzunun "bir key'in metni değişmez" sözleşmesi bunu kaldırmaz.

**Tech Stack:** Next.js 16.3 App Router, React 19, PixiJS 8, Apollo Client 4 + GraphQL Codegen, GraphQL Yoga + `@envelop/response-cache`, Prisma, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-07-universe-map-sov-panel-design.md`

## Global Constraints

- Yarn, asla npm. Komutlar repo kökünden ya da `yarn workspace <ad> <script>` ile.
- Üretilmiş dosyalara elle dokunulmaz: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`. Kaynak `.graphql` değişir, codegen çalışır; backend codegen frontend'den **önce**.
- `prisma migrate dev` yok, migration yok — bu iş şemaya dokunmuyor.
- Kod, yorumlar, commit mesajları İngilizce; commit başlığı `type(scope):` sonrası tamamen küçük harf; Claude atfı yok.
- Karar veren her şey `frontend/src/utils/map/`'te saf ve testli; Pixi atamaları (`scene/`) test edilmez.
- `UniverseMap.tsx`'e yalnızca hook çağrıları ve bağlantı eklenir; mantık dosyalarına gider.
- Katman URL değeri: yalnızca `layer=sovereignty`; `security` hiç yazılmaz. `owner` yalnızca `layer=sovereignty` iken yazılır.
- Geri sayım biçimi: `≥ 24 s` → `1d 4h`; `1 s – 24 s` → `2h 14m`; `< 1 s` → `42:10`; başladıysa `LIVE 62–38` (skor yoksa `LIVE`).
- Bayatlık eşiği: en yeni `updatedAt` **10 dakikadan** eski.
- Campaign sorgusu sov katmanı açıkken `pollInterval: 60_000`; response cache TTL'i `60_000`.
- Halka renkleri: başlamamış → accent `#5ccbcb`, LIVE → danger `#f87171` (`globals.css`'teki `--color-accent` ve `--color-destroyed` = red-400 ile aynı).
- Kopyalanan link kamera parametresi (`x`, `z`, `zoom`) taşımaz; `scope` yalnızca `NEW_EDEN` değilse yazılır.

## Review Focus

1. **Pan sırasında seçimi/katmanı/sahibi kaybetmek.** `cameraQuery` her pan'de URL'yi baştan kurar; `layer` ya da `owner`'ı taşımayan tek bir yazım kullanıcının sov görünümünü sessizce security'ye döndürür. Pin: Task 2'de "pan, katmanı ve sahibi taşır" testi.
2. **Panelden bir timer'a tıklayınca odak kaybolması.** Kamera debounce'lu, focus anında yazılır; ikisini ayrı çağırmak, gecikmeli kamera yazımının eski `focus`'u geri yazmasına yol açar. Pin: Task 2'de `jumpTo` testi (kamera ve focus tek yazımda).
3. **Geçersiz URL değerleri.** `?layer=SOVEREIGNTY`, `?owner=abc`, `?owner=-5`, security katmanında `?owner=` — hepsi sessizce varsayılana düşmeli, hata ya da boş harita vermemeli. Pin: Task 2'de parse testleri.
4. **Tek sistemli sahip.** Bir sistemi olan sahibi çerçevelemek `fitZoom`'u `FALLBACK_FIT_ZOOM`'a, yani galaksiye götürür — "göster" deyince en uzağa çıkmak. Pin: Task 3'te `ownerCamera` tek sistem testi.
5. **Sahnede olmayan campaign sistemi.** POCHVEN ya da WORMHOLE scope'unda campaign'lerin sistemleri geometride yok; halka/çip çizilmemeli, panel satırına tıklamak kamerasız da çökmeden focus'u yazmalı. Pin: Task 5'te `campaignSources` testi, Task 9'da panelden odak testi.

---

## Dosya haritası

| Dosya                                                                                 | Görev         | Sorumluluk                                                                            |
| ------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| `backend/src/schemas/Sovereignty.graphql`                                             | 1, 10         | `SovereigntyCampaign.updatedAt`; `SovMapPoint` ve `sovereigntyMapPoints`'in silinmesi |
| `backend/src/resolvers/sovereignty/queries.ts`                                        | 1, 10         | `updatedAt` eşlemesi; `sovereigntyMapPoints` resolver'ının silinmesi                  |
| `backend/src/config/cache.ts`                                                         | 1             | iki yeni public operasyon adı, iki TTL                                                |
| `frontend/src/utils/map/camera.ts` (+spec)                                            | 2             | `parseLayer`, `parseOwner`, 5 argümanlı `cameraQuery`, `sharedMapUrl`                 |
| `frontend/src/components/UniverseMap/useMapCamera.ts` (+spec)                         | 2             | URL'nin tek yazarı: camera, focus, layer, owner, `jumpTo`                             |
| `frontend/src/utils/map/layers.ts` (+spec)                                            | 3             | `isolatedOwner`, `logoOwners`                                                         |
| `frontend/src/utils/map/framing.ts` (+spec)                                           | 3             | `ownerCamera`, `frameNodes`                                                           |
| `frontend/src/utils/map/countdown.ts` (+spec)                                         | 4             | geri sayım metni, tür adı, sıralama, bayatlık                                         |
| `frontend/src/components/UniverseMap/useNow.ts`                                       | 4             | aralıkla güncellenen saat                                                             |
| `frontend/src/utils/map/campaignMarks.ts` (+spec)                                     | 5             | campaign kaynakları, halka geometrisi, çip yerleştirme                                |
| `frontend/src/utils/map/labels.ts` (+spec)                                            | 5             | `placeLabels`'a `reserved` kutular                                                    |
| `frontend/src/graphql/MapSovCampaigns.graphql`, `MapSovChanges.graphql`               | 6             | sorgular                                                                              |
| `frontend/src/components/UniverseMap/useSovCampaigns.ts`, `useSovChanges.ts` (+spec)  | 6             | katmana bağlı veri                                                                    |
| `frontend/src/components/UniverseMap/scene/createScene.ts`                            | 7             | ekran uzayında `rings` `Graphics`'i                                                   |
| `frontend/src/components/UniverseMap/scene/campaignRings.ts`                          | 7             | halkaları çizer                                                                       |
| `frontend/src/components/UniverseMap/labels/chipLayer.ts` (+spec)                     | 7             | çip DOM havuzu                                                                        |
| `frontend/src/app/map.css`                                                            | 7             | `.map-chips`, `.map-chip`                                                             |
| `frontend/src/components/UniverseMap/useCopyLink.ts`                                  | 8             | panoya kopyala + "Copied"                                                             |
| `frontend/src/components/UniverseMap/SystemPopup.tsx` (+spec), `utils/map/overlay.ts` | 8             | campaign satırı, Copy link                                                            |
| `frontend/src/components/UniverseMap/SovPanel.tsx` (+spec)                            | 9             | üç sekme; `SovLegend`'ın yerine                                                       |
| `frontend/src/components/UniverseMap/UniverseMap.tsx` (+spec)                         | 2, 3, 7, 8, 9 | bağlantı                                                                              |
| `frontend/src/app/sovereignty/map/page.tsx` (+spec)                                   | 10            | `redirect`                                                                            |

**Spec'ten iki bilinçli sapma** (her biri kendi görevinde gerekçesiyle):

- Spec'in `campaignChips.ts`'i burada `campaignMarks.ts`: aynı dosya halka geometrisini de taşıyor, ve iki işin girdisi (campaign + sistem konumu + kamera) aynı.
- Spec §2.2 SOVEREIGNTY > MAP menüsünün doğrudan `/map?layer=sovereignty`'ye gitmesini söylüyor. `navItems.spec.ts` "her menü linklediği her sayfada yanar" diye test ediyor; o link `/map`'e giderse SOVEREIGNTY'nin `match`'ine `/map` girmek zorunda kalır ve her harita ziyaretinde iki menü birden yanar. Menü `/sovereignty/map`'te kalır ve redirect'ten geçer (Task 10). Overview sayfasındaki düğme doğrudan gider.

---

### Task 1: Backend — `updatedAt`, cache adları ve TTL'ler

**Files:**

- Modify: `backend/src/schemas/Sovereignty.graphql` (`type SovereigntyCampaign`, satır ~47–75)
- Modify: `backend/src/resolvers/sovereignty/queries.ts:212-224` (`CampaignRow`), `:270-290` (`enrichCampaigns` dönüşü)
- Modify: `backend/src/config/cache.ts` (`CACHE_TTL`, `PUBLIC_CACHE_QUERIES`, `TTL_PER_SCHEMA_COORDINATE`)
- Regenerate: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`

**Interfaces:**

- Produces: `SovereigntyCampaign.updatedAt: String!` (ISO 8601); public operasyon adları `MapSovCampaigns`, `MapSovChanges` (Task 6 bu adlarla sorgu yazar); `CACHE_TTL.LIVE_CAMPAIGNS = 60_000`.

Bu görevin birim testi yok: `enrichCampaigns` dışa açık değil ve sovereignty resolver'larının hiçbirinin spec'i yok; yalnızca bunun için Prisma mock'lu bir spec kurmak, bir alan eşlemesini test etmek için orantısız. Doğrulama `build` ve backend'e doğrudan bir GraphQL sorgusu.

- [ ] **Step 1: Şemaya alanı ekle**

`backend/src/schemas/Sovereignty.graphql`, `type SovereigntyCampaign` içinde `startTime: String!` satırının hemen altına:

```graphql
  "When the campaign worker last wrote this row. The map reads the newest one to say how fresh its timers are."
  updatedAt: String!
```

- [ ] **Step 2: `CampaignRow`'a sütunu ekle**

`backend/src/resolvers/sovereignty/queries.ts`, `type CampaignRow` içinde `outcome: string | null;` satırının altına:

```ts
updated_at: Date;
```

Prisma'nın `findMany` sonucu bu sütunu zaten taşıyor (`updated_at DateTime @updatedAt`), çağıran tarafta değişiklik gerekmez.

- [ ] **Step 3: Eşlemeyi ekle**

Aynı dosyada `enrichCampaigns`'in döndürdüğü nesnede `startTime: c.start_time.toISOString(),` satırının altına:

```ts
      updatedAt: c.updated_at.toISOString(),
```

- [ ] **Step 4: Cache yapılandırması**

`backend/src/config/cache.ts`:

`CACHE_TTL` içinde `LIVE_SYSTEM_DATA` girdisinin altına:

```ts
  /**
   * Active sovereignty campaigns: the worker writes them every minute and the
   * map shows their scores live, so the response cache may not hold them for
   * the 2 minutes DEFAULT_PUBLIC would.
   */
  LIVE_CAMPAIGNS: 60_000, // 1 minute
```

`PUBLIC_CACHE_QUERIES` içinde `'MapSystemDetails',` satırının altına:

```ts
  // The sovereignty layer's timers and recent changes: the same body for every
  // visitor, so one shared entry rather than one per token.
  'MapSovCampaigns',
  'MapSovChanges',
```

`TTL_PER_SCHEMA_COORDINATE` içinde `'Query.mapSystemDetails': CACHE_TTL.LIVE_SYSTEM_DATA,` satırının altına:

```ts
  'Query.sovereigntyActiveCampaigns': CACHE_TTL.LIVE_CAMPAIGNS,
  // Territory changes are detected by worker-sov-map, every 30 minutes.
  'Query.recentTerritoryChanges': CACHE_TTL.SOVEREIGNTY,
```

- [ ] **Step 5: Codegen ve build**

Run: `yarn workspace backend codegen && yarn workspace backend build`
Expected: codegen hatasız; `tsc --noEmit` çıkış kodu 0.

- [ ] **Step 6: Testler**

Run: `yarn workspace backend test`
Expected: PASS — özellikle `src/plugins/response-cache.plugin.spec.ts` (kendi `PUBLIC_CACHE_QUERIES` mock'unu kullanır, etkilenmemeli).

- [ ] **Step 7: Alanı canlı doğrula**

Backend çalışmıyorsa `yarn dev:backend` (repo kökünden). Port `backend/.env`'deki `PORT`.

Run:

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2); curl -s "http://localhost:${PORT}/graphql" -H 'content-type: application/json' \
  -d '{"query":"query MapSovCampaigns { sovereigntyActiveCampaigns(limit: 2) { campaignId startTime updatedAt } }"}'
```

Expected: `updatedAt` her satırda ISO string (yerelde 2026-09-12 civarı — droplet yok, worker çalışmıyor).

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/Sovereignty.graphql backend/src/resolvers/sovereignty/queries.ts backend/src/config/cache.ts
git commit -m "feat(sovereignty): expose when a campaign was last written and cache the map's sov queries for everyone"
```

(Üretilmiş dosyalar `.gitignore`'da değilse onları da ekle: `git status` hangilerinin değiştiğini söyler.)

---

### Task 2: URL'de katman ve sahip — `camera.ts` ve `useMapCamera`

**Files:**

- Modify: `frontend/src/utils/map/camera.ts` (`parseFocus` civarı ve `cameraQuery`)
- Modify: `frontend/src/utils/map/camera.spec.ts`
- Modify: `frontend/src/components/UniverseMap/useMapCamera.ts` (tamamı)
- Modify: `frontend/src/components/UniverseMap/useMapCamera.spec.ts`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx:85-88` ve `:187-192`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: `MapLayerId` (`'security' | 'sovereignty'`) — `utils/map/layers.ts`.
- Produces:
  - `parseLayer(params: URLSearchParams): MapLayerId`
  - `parseOwner(params: URLSearchParams): number | null`
  - `cameraQuery(scope: MapScope, camera: MapCamera, focus: number | null, layer: MapLayerId, owner: number | null): string`
  - `sharedMapUrl(args: { origin: string; scope: MapScope; focus: number; layer: MapLayerId; owner: number | null }): string`
  - `useMapCamera(scope, fallback)` dönüşü: `{ camera, onCameraChange, focus, onFocusChange, layer, onLayerChange, owner, onOwnerChange, jumpTo }`; `owner` security katmanında her zaman `null`; `jumpTo(camera: MapCamera, focus?: number | null): void` — `focus` verilmezse mevcut seçim korunur.

- [ ] **Step 1: `camera.spec.ts`'teki mevcut `cameraQuery` çağrılarını yeni imzaya taşı**

`cameraQuery` iki zorunlu argüman kazanacak. Dosyadaki her çağrının sonuna `, 'security', null` ekle (satır ~124, 136, 143, 160 ve `cameraQuery with a focus` bloğundaki ~375). Beklenen çıktılar değişmez — security yazılmaz.

```bash
grep -n "cameraQuery(" frontend/src/utils/map/camera.spec.ts
```

Her çağrı biçimi örneği, önce:

```ts
cameraQuery(MapScope.Pochven, { x: 0, z: 0, zoom: -50.0383 }, null);
```

sonra:

```ts
cameraQuery(
  MapScope.Pochven,
  { x: 0, z: 0, zoom: -50.0383 },
  null,
  'security',
  null,
);
```

- [ ] **Step 2: Yeni davranış için başarısız testleri yaz**

`frontend/src/utils/map/camera.spec.ts` import listesine `parseLayer`, `parseOwner`, `sharedMapUrl` ekle; dosyanın sonuna:

```ts
describe('parseLayer', () => {
  it('reads the sovereignty layer', () => {
    expect(parseLayer(new URLSearchParams('layer=sovereignty'))).toBe(
      'sovereignty',
    );
  });

  // Anything else is the default, silently: a map link has no reason to show
  // an error, and `security` is what the map opened on before layers existed.
  it.each(['', 'layer=security', 'layer=SOVEREIGNTY', 'layer=activity'])(
    'falls back to security for %j',
    (query) => {
      expect(parseLayer(new URLSearchParams(query))).toBe('security');
    },
  );
});

describe('parseOwner', () => {
  it('reads a positive integer', () => {
    expect(parseOwner(new URLSearchParams('owner=99003581'))).toBe(99003581);
  });

  it.each(['', 'owner=abc', 'owner=-5', 'owner=0', 'owner=1.5'])(
    'is null for %j',
    (query) => {
      expect(parseOwner(new URLSearchParams(query))).toBeNull();
    },
  );
});

describe('cameraQuery with a layer and an owner', () => {
  const CAMERA = { x: 0, z: 0, zoom: -50 };

  it('writes nothing for the security layer, so every older link still reads the same', () => {
    expect(cameraQuery(MapScope.NewEden, CAMERA, null, 'security', null)).toBe(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00',
    );
  });

  it('writes the sovereignty layer and its isolated owner after the focus', () => {
    expect(
      cameraQuery(MapScope.NewEden, CAMERA, 30000142, 'sovereignty', 99003581),
    ).toBe(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00&focus=30000142&layer=sovereignty&owner=99003581',
    );
  });

  // An owner means nothing on a layer that does not colour by owner.
  it('drops the owner on the security layer', () => {
    expect(
      cameraQuery(MapScope.NewEden, CAMERA, null, 'security', 99003581),
    ).toBe('scope=NEW_EDEN&x=0&z=0&zoom=-50.00');
  });

  it('round-trips through the parsers', () => {
    const params = new URLSearchParams(
      cameraQuery(MapScope.NewEden, CAMERA, null, 'sovereignty', 99003581),
    );
    expect(parseLayer(params)).toBe('sovereignty');
    expect(parseOwner(params)).toBe(99003581);
  });
});

describe('sharedMapUrl', () => {
  it('carries the system, the layer and the owner, and no camera', () => {
    expect(
      sharedMapUrl({
        origin: 'https://killreport.com',
        scope: MapScope.NewEden,
        focus: 30004759,
        layer: 'sovereignty',
        owner: 99003581,
      }),
    ).toBe(
      'https://killreport.com/map?layer=sovereignty&focus=30004759&owner=99003581',
    );
  });

  it('names the scope only when it is not New Eden', () => {
    expect(
      sharedMapUrl({
        origin: 'https://killreport.com',
        scope: MapScope.Pochven,
        focus: 30000021,
        layer: 'security',
        owner: null,
      }),
    ).toBe('https://killreport.com/map?scope=POCHVEN&focus=30000021');
  });
});
```

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `yarn workspace frontend vitest run src/utils/map/camera.spec.ts`
Expected: FAIL — `parseLayer is not a function` (ve imza nedeniyle tip hatası; vitest tipleri denetlemez, çalışma zamanı hatası yeter).

- [ ] **Step 4: `camera.ts`'i uygula**

Dosyanın en üstündeki importlara:

```ts
import type { MapLayerId } from './layers';
```

`parseFocus` fonksiyonunun hemen altına:

```ts
/**
 * The colouring the URL asks for. Anything but `sovereignty` — its absence
 * included — is the default, so every link written before layers existed
 * still opens the map it always did.
 *
 * In the URL since the sovereignty panel: a timer link a fleet commander
 * pastes has to open on the layer that shows the timer.
 */
export function parseLayer(params: URLSearchParams): MapLayerId {
  return params.get('layer') === 'sovereignty' ? 'sovereignty' : 'security';
}

/** The owner the sovereignty layer isolates, or null. Same rule as every id. */
export function parseOwner(params: URLSearchParams): number | null {
  return parseId(params.get('owner'));
}
```

`cameraQuery`'yi değiştir — imza, doc yorumunun ilgili paragrafı ve gövdenin sonu:

```ts
/**
 * The canonical serialisation. useMapCamera also uses it to tell its own writes
 * apart from someone else's, so it has to be a pure function of its arguments.
 *
 * `focus`, `layer` and `owner` are required, not defaulted: a camera write
 * that forgot one would erase it from the URL, and the camera is written on
 * every pan. The compiler is what keeps that from happening.
 *
 * `security` is never written, so the default layer leaves the URL exactly as
 * it was before layers existed. `owner` is written only on the sovereignty
 * layer: it isolates an owner's colour, which the security layer has none of.
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
  layer: MapLayerId,
  owner: number | null,
): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('x', String(toGrid(camera.x)));
  params.set('z', String(toGrid(camera.z)));
  params.set('zoom', camera.zoom.toFixed(2));
  if (focus !== null) params.set('focus', String(focus));
  if (layer !== 'security') params.set('layer', layer);
  if (layer === 'sovereignty' && owner !== null) {
    params.set('owner', String(owner));
  }
  return params.toString();
}

/**
 * The link a reader copies to hand a system to someone else.
 *
 * No camera: the receiver's viewport is not the sender's, and `focus` on its
 * own frames the system on whatever screen opens it — the same path a
 * `?focus=` link has taken since phase 1. The scope is named only when it is
 * not the default, so the common link stays short enough to read in a ping.
 */
export function sharedMapUrl({
  origin,
  scope,
  focus,
  layer,
  owner,
}: {
  origin: string;
  scope: MapScope;
  focus: number;
  layer: MapLayerId;
  owner: number | null;
}): string {
  const params = new URLSearchParams();
  if (scope !== DEFAULT_SCOPE) params.set('scope', scope);
  if (layer !== 'security') params.set('layer', layer);
  params.set('focus', String(focus));
  if (layer === 'sovereignty' && owner !== null) {
    params.set('owner', String(owner));
  }
  return `${origin}/map?${params.toString()}`;
}
```

- [ ] **Step 5: `camera.spec.ts`'in geçtiğini gör**

Run: `yarn workspace frontend vitest run src/utils/map/camera.spec.ts`
Expected: PASS.

- [ ] **Step 6: `useMapCamera` için başarısız testleri yaz**

`frontend/src/components/UniverseMap/useMapCamera.spec.ts`, `describe('useMapCamera', ...)` bloğunun sonuna (son `});`'dan önce):

```ts
it('reads the layer and the owner out of the URL it was mounted with', () => {
  searchParams = new URLSearchParams('layer=sovereignty&owner=99003581');
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
  expect(result.current.layer).toBe('sovereignty');
  expect(result.current.owner).toBe(99003581);
});

// An owner in the URL of a security-layer map isolates nothing.
it('reports no owner on the security layer, whatever the URL says', () => {
  searchParams = new URLSearchParams('owner=99003581');
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
  expect(result.current.layer).toBe('security');
  expect(result.current.owner).toBeNull();
});

it('writes a layer change at once, like a selection', () => {
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

  act(() => result.current.onLayerChange('sovereignty'));

  expect(replace).toHaveBeenCalledWith(
    '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty',
    { scroll: false },
  );
  expect(result.current.layer).toBe('sovereignty');
});

it('clears the owner on the way back to security', () => {
  searchParams = new URLSearchParams('layer=sovereignty&owner=99003581');
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

  act(() => result.current.onLayerChange('security'));
  act(() => result.current.onLayerChange('sovereignty'));

  expect(result.current.owner).toBeNull();
  expect(replace).toHaveBeenLastCalledWith(
    '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty',
    { scroll: false },
  );
});

it('writes an isolated owner at once', () => {
  searchParams = new URLSearchParams('layer=sovereignty');
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

  act(() => result.current.onOwnerChange(99003581));

  expect(replace).toHaveBeenLastCalledWith(
    '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty&owner=99003581',
    { scroll: false },
  );
});

// The hazard focus already had, now for two more parameters: cameraQuery
// rebuilds the URL from nothing, so a pan that did not carry the layer would
// drop the reader back onto the security map.
it('carries the layer and the owner into a pan', () => {
  vi.useFakeTimers();
  searchParams = new URLSearchParams('layer=sovereignty&owner=99003581');
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

  act(() => result.current.onCameraChange({ x: 1e9, z: 0, zoom: -45 }));
  act(() => {
    vi.advanceTimersByTime(URL_DEBOUNCE_MS);
  });

  expect(replace).toHaveBeenLastCalledWith(
    '?scope=NEW_EDEN&x=1000000000&z=0&zoom=-45.00&layer=sovereignty&owner=99003581',
    { scroll: false },
  );
});

// A panel row moves the camera AND opens the popup. As two calls, the
// debounced camera write would land 250 ms later carrying the focus it
// closed over — the old one — and close the popup it had just opened.
it('jumps the camera and the selection in one immediate write', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

  act(() => result.current.jumpTo({ x: 2e9, z: 0, zoom: -45.73 }, 30004759));
  act(() => {
    vi.advanceTimersByTime(URL_DEBOUNCE_MS);
  });

  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith(
    '?scope=NEW_EDEN&x=2000000000&z=0&zoom=-45.73&focus=30004759',
    { scroll: false },
  );
  expect(result.current.focus).toBe(30004759);
  expect(result.current.camera).toEqual({ x: 2e9, z: 0, zoom: -45.73 });
});

it('keeps the selection when a jump names none', () => {
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

  act(() => result.current.onFocusChange(30000142));
  act(() => result.current.jumpTo({ x: 2e9, z: 0, zoom: -45 }));

  expect(result.current.focus).toBe(30000142);
});

it('takes a layer that changes in the URL underneath it', () => {
  const { result, rerender } = renderHook(() =>
    useMapCamera(MapScope.NewEden, FIT),
  );

  searchParams = new URLSearchParams(
    'scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty',
  );
  rerender();

  expect(result.current.layer).toBe('sovereignty');
});
```

- [ ] **Step 7: Testlerin başarısız olduğunu gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useMapCamera.spec.ts`
Expected: FAIL — `result.current.onLayerChange is not a function` ve benzeri.

- [ ] **Step 8: `useMapCamera.ts`'i yeniden yaz**

Dosyanın tamamı:

```ts
'use client';

import type { MapScope } from '@/generated/graphql';
import {
  cameraQuery,
  parseCamera,
  parseFocus,
  parseLayer,
  parseOwner,
  type MapCamera,
} from '@/utils/map/camera';
import type { MapLayerId } from '@/utils/map/layers';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 250 ms. Without it a drag writes a history entry per frame; with a longer one
 * the URL lags visibly behind the view when you stop moving.
 */
const URL_DEBOUNCE_MS = 250;

/**
 * One write of the URL: everything this hook owns there.
 *
 * The layer and the owner are here, beside the camera and the focus, because
 * the URL has to have exactly one writer. Two hooks calling `router.replace`
 * would each overwrite the other's parameters, and the "is this my own write"
 * comparison below only works when one serialisation describes the whole URL.
 */
interface WrittenUrl {
  camera: MapCamera;
  focus: number | null;
  layer: MapLayerId;
  owner: number | null;
}

function queryOf(scope: MapScope, url: WrittenUrl): string {
  return cameraQuery(scope, url.camera, url.focus, url.layer, url.owner);
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
  const [layer, setLayer] = useState<MapLayerId>(() =>
    parseLayer(searchParams),
  );
  const [owner, setOwner] = useState<number | null>(() =>
    parseOwner(searchParams),
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
        router.replace(`?${queryOf(scope, next)}`, { scroll: false });
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
  // against itself.
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
      cameraQuery(
        scope,
        fromUrl,
        parseFocus(searchParams),
        parseLayer(searchParams),
        parseOwner(searchParams),
      ) === queryOf(scope, written)
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

  // The focus, the layer and the owner are primitives, so setting one to the
  // value it already holds costs nothing. Their own effect rather than the
  // camera's: a `?focus=` link carries no x/z/zoom, and behind that effect's
  // early return none of the three would ever reach state.
  //
  // Deliberately unguarded, and the three are deliberately not dependencies.
  // The URL is an external store and this effect is the subscription to it —
  // the use the rule's own documentation allows, which it cannot recognise
  // here because `searchParams` reaches the hook as a value rather than through
  // a callback. Comparing against the current state is what a guard would
  // mean, and it would be wrong: between a write and the router committing it,
  // the stale searchParams would revert the change the user just made. With
  // `[searchParams]` alone the effect simply does not run in that window, and
  // the write path is what keeps the two in agreement.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setFocus(parseFocus(searchParams));
    setLayer(parseLayer(searchParams));
    setOwner(parseOwner(searchParams));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);
      write({ camera: next, focus, layer, owner }, false);
    },
    [write, focus, layer, owner],
  );

  const onFocusChange = useCallback(
    (next: number | null) => {
      setFocus(next);
      // Before the geometry lands there is no frame to write the selection
      // against. The state still moves, so the popup opens either way.
      if (effective)
        write({ camera: effective, focus: next, layer, owner }, true);
    },
    [write, effective, layer, owner],
  );

  const onLayerChange = useCallback(
    (next: MapLayerId) => {
      // An isolated owner belongs to the sovereignty layer; leaving it drops
      // the isolation rather than carrying it, invisible, into the next visit.
      const nextOwner = next === 'sovereignty' ? owner : null;
      setLayer(next);
      setOwner(nextOwner);
      if (effective) {
        write(
          { camera: effective, focus, layer: next, owner: nextOwner },
          true,
        );
      }
    },
    [write, effective, focus, owner],
  );

  const onOwnerChange = useCallback(
    (next: number | null) => {
      setOwner(next);
      if (effective)
        write({ camera: effective, focus, layer, owner: next }, true);
    },
    [write, effective, focus, layer],
  );

  // A camera move and a selection as ONE write. A panel row does both, and as
  // two calls the debounced camera write would land a moment later carrying the
  // focus it closed over — the old one — and close the popup it just opened.
  const jumpTo = useCallback(
    (nextCamera: MapCamera, nextFocus?: number | null) => {
      const resolvedFocus = nextFocus === undefined ? focus : nextFocus;
      setCamera(nextCamera);
      setFocus(resolvedFocus);
      write({ camera: nextCamera, focus: resolvedFocus, layer, owner }, true);
    },
    [write, focus, layer, owner],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    camera: effective,
    onCameraChange,
    focus,
    onFocusChange,
    layer,
    onLayerChange,
    // Reported only where it means something; the URL may still carry one the
    // security layer cannot use.
    owner: layer === 'sovereignty' ? owner : null,
    onOwnerChange,
    jumpTo,
  };
}
```

- [ ] **Step 9: `useMapCamera` testlerinin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useMapCamera.spec.ts`
Expected: PASS — eski 9 test ve yeni 9 test.

- [ ] **Step 10: `UniverseMap`'i hook'un katmanına bağla**

`frontend/src/components/UniverseMap/UniverseMap.tsx`:

Satır 85–88'deki yorumu ve `useState<MapLayerId>` satırını sil:

```ts
// The layer lives in component state, not the URL: `scope`, the camera and
// `?focus=` are all in the URL because they are what a shared link has to
// carry, and which colouring the sender happened to be looking at is not.
const [layerId, setLayerId] = useState<MapLayerId>('security');
```

Satır 187–192'deki `useMapCamera` çağrısını şununla değiştir:

```ts
// The layer is URL state too, since the sovereignty panel: a timer link a
// fleet commander pastes has to open on the layer that shows the timer, so
// `useMapCamera` — the URL's one writer — owns it with the rest.
const {
  camera,
  onCameraChange,
  focus: selected,
  onFocusChange: setSelected,
  layer: layerId,
  onLayerChange: setLayerId,
} = useMapCamera(scope, framing ?? fit);
```

`layer`, `useMapSovereignty(scope, layerId === 'sovereignty')` ve `layerData` bu çağrıdan **sonra** tanımlanmış olmalı; değillerse (`const layer = MAP_LAYERS[layerId];` satır ~221) yerlerinde kalırlar — zaten sonra geliyorlar. Import listesinden `type MapLayerId` artık kullanılmıyorsa sil (lint `no-unused-vars`).

- [ ] **Step 11: `UniverseMap.spec.tsx`'e URL'den katman testini ekle**

`describe` bloklarından birinin içinde (örneğin `it('always fetches region names, ...')`'in yanına):

```ts
  it('opens on the sovereignty layer when the URL names it', () => {
    searchParams = new URLSearchParams('layer=sovereignty');
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(sovQueries.at(-1)?.skip).toBe(false);
  });
```

- [ ] **Step 12: Etkilenen testleri ve tipleri çalıştır**

Run: `yarn workspace frontend vitest run src/utils/map src/components/UniverseMap && yarn workspace frontend typecheck`
Expected: PASS; `tsc` çıkış 0. `cameraQuery`'nin başka bir çağıranı kalmışsa tip hatası onu gösterir: `grep -rn "cameraQuery(" frontend/src`.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/utils/map/camera.ts frontend/src/utils/map/camera.spec.ts frontend/src/components/UniverseMap/useMapCamera.ts frontend/src/components/UniverseMap/useMapCamera.spec.ts frontend/src/components/UniverseMap/UniverseMap.tsx frontend/src/components/UniverseMap/UniverseMap.spec.tsx
git commit -m "feat(map): keep the layer and the isolated owner in the map's url"
```

---

### Task 3: Sahip izolasyonu ve sahibe çerçeveleme

**Files:**

- Modify: `frontend/src/utils/map/layers.ts` (`MapLayerData`, `ownerTint`, sov `edgeTint`, yeni `logoOwners`)
- Modify: `frontend/src/utils/map/layers.spec.ts`
- Modify: `frontend/src/utils/map/framing.ts` (`frameNodes`, `ownerCamera`)
- Modify: `frontend/src/utils/map/framing.spec.ts`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx` (`useMapCamera` destructuring, `layerData`, `applyLogos` çağrısı, `EMPTY_OWNERS`)

**Interfaces:**

- Consumes: Task 2'den `useMapCamera(...).owner`, `.onOwnerChange`, `.jumpTo`.
- Produces:
  - `MapLayerData.isolatedOwner?: number | null`
  - `logoOwners(sov: SovIndex | null, isolatedOwner: number | null): Map<number, number>`
  - `ownerCamera(ownerId: number, ownerBySystem: Map<number, number>, nodes: FramingNode[], width: number, height: number): MapCamera | null`
  - `frameNodes(members: Pick<FramingNode, 'x' | 'z'>[], width: number, height: number): MapCamera | null`

`isolatedOwner` isteğe bağlı (`?`) bırakılıyor: `MapLayerData` literal'i kuran üç spec dosyası (`layers.spec.ts`, `scene/systems.spec.ts`) değişmeden derlensin; `undefined` "izolasyon yok" demek.

- [ ] **Step 1: `layers.spec.ts`'e başarısız testleri yaz**

Dosyanın import listesine `logoOwners` ekle; sona:

```ts
describe('isolating an owner', () => {
  const sovereignty = buildSovIndex({
    systems: [
      { systemId: 1, ownerId: 99003581 },
      { systemId: 2, ownerId: 99003581 },
      { systemId: 3, ownerId: 1354830081 },
    ],
  });
  const layer = MAP_LAYERS.sovereignty;
  const node = (systemId: number) =>
    ({ systemId, securityStatus: -0.5 }) as MapNode;

  it('keeps the isolated owner in its colour and dims everyone else', () => {
    const data = { sovereignty, isolatedOwner: 99003581 };
    expect(layer.tint(node(1), data)).toBe(sovTint(99003581));
    expect(layer.tint(node(3), data)).toBe(SOV_UNOWNED_TINT);
  });

  it('colours only the isolated owner’s own gates', () => {
    const data = { sovereignty, isolatedOwner: 1354830081 };
    expect(layer.edgeTint({ from: 1, to: 2 }, data)).toBeNull();
  });

  it('changes nothing when no owner is isolated', () => {
    const data = { sovereignty, isolatedOwner: null };
    expect(layer.tint(node(3), data)).toBe(sovTint(1354830081));
    expect(layer.edgeTint({ from: 1, to: 2 }, data)).toBe(sovTint(99003581));
  });

  it('lets only the isolated owner’s systems show a crest', () => {
    expect([...logoOwners(sovereignty, 99003581).keys()]).toEqual([1, 2]);
  });

  it('hands the logo pass every owner when none is isolated', () => {
    expect(logoOwners(sovereignty, null)).toBe(sovereignty.ownerBySystem);
  });

  it('hands it nothing when there is no sovereignty data yet', () => {
    expect(logoOwners(null, 99003581).size).toBe(0);
  });
});
```

`sovTint`, `SOV_UNOWNED_TINT`, `MapNode`, `buildSovIndex`, `MAP_LAYERS` dosyada zaten import edilmiş değilse ekle (`sovTint`/`SOV_UNOWNED_TINT` → `./sovColors`, `MapNode` → `@/generated/graphql`). `sovTint(99003581)` `null` dönerse (renk tablosunda yoksa) test anlamsızlaşır; tablonun ilk iki sahibini kullan: `grep -n ':' frontend/src/utils/map/sovColors.ts | sed -n 1,4p` ve yukarıdaki iki id'yi oradakilerle değiştir.

- [ ] **Step 2: `framing.spec.ts`'e başarısız testleri yaz**

Import listesine `ownerCamera` ekle; sona:

```ts
describe('ownerCamera', () => {
  const NODES = [
    { systemId: 1, constellationId: 10, regionId: 100, x: 0, z: 0 },
    { systemId: 2, constellationId: 10, regionId: 100, x: 4e16, z: 2e16 },
    { systemId: 3, constellationId: 11, regionId: 100, x: 9e16, z: 9e16 },
  ];
  const owners = new Map([
    [1, 7],
    [2, 7],
    [3, 8],
  ]);

  it('frames every system the owner holds and nothing else', () => {
    const camera = ownerCamera(7, owners, NODES, 1400, 900);
    expect(camera).not.toBeNull();
    expect(camera!.x).toBe(2e16);
    expect(camera!.z).toBe(1e16);
  });

  // fitZoom of a point is the galaxy fit: "show me this owner" must not answer
  // by zooming all the way out.
  it('centres a one-system owner at the system zoom', () => {
    expect(ownerCamera(8, owners, NODES, 1400, 900)).toEqual({
      x: 9e16,
      z: 9e16,
      zoom: SYSTEM_LABEL_ZOOM,
    });
  });

  it('is null for an owner the scene holds none of', () => {
    expect(ownerCamera(9, owners, NODES, 1400, 900)).toBeNull();
  });

  it('is null before the viewport has been measured', () => {
    expect(ownerCamera(7, owners, NODES, 0, 0)).toBeNull();
  });
});
```

`SYSTEM_LABEL_ZOOM` import edilmemişse `./lod`'dan ekle.

- [ ] **Step 3: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/utils/map/layers.spec.ts src/utils/map/framing.spec.ts`
Expected: FAIL — `logoOwners is not a function`, `ownerCamera is not a function`, izolasyon testleri yanlış renk.

- [ ] **Step 4: `layers.ts`'i uygula**

`MapLayerData`:

```ts
export interface MapLayerData {
  sovereignty: SovIndex | null;
  /**
   * The one owner left in colour, or null/absent for all of them. Read by the
   * sovereignty layer only — the security layer has no owners to isolate.
   */
  isolatedOwner?: number | null;
}
```

`ownerTint`:

```ts
/**
 * The owner's colour, or null for unheld, uncoloured, dimmed by an isolation,
 * or no data at all.
 */
function ownerTint(systemId: number, data: MapLayerData): number | null {
  const sov = data.sovereignty;
  if (!sov) return null;
  const ownerId = sov.ownerBySystem.get(systemId);
  if (ownerId === undefined) return null;
  if (data.isolatedOwner != null && ownerId !== data.isolatedOwner) return null;
  return sov.tintByOwner.get(ownerId) ?? null;
}
```

`MAP_LAYERS.sovereignty.edgeTint` içinde `if (from === undefined || from !== to) return null;` satırının altına:

```ts
if (data.isolatedOwner != null && from !== data.isolatedOwner) {
  return null;
}
```

`buildSovIndex`'in altına:

```ts
/** Stable empty lookup, so a map with no sovereignty data allocates nothing. */
const NO_OWNERS = new Map<number, number>();

/**
 * The owner map the logo pass reads. With an owner isolated only its own
 * systems may show a crest: a dimmed system wearing someone's crest would
 * still say whose it is, which is the one thing the isolation took away.
 *
 * Returns the index's own map, not a copy, when nothing is isolated — the
 * logo effect keys on its identity.
 */
export function logoOwners(
  sov: SovIndex | null,
  isolatedOwner: number | null,
): Map<number, number> {
  if (!sov) return NO_OWNERS;
  if (isolatedOwner === null) return sov.ownerBySystem;

  const only = new Map<number, number>();
  for (const [systemId, ownerId] of sov.ownerBySystem) {
    if (ownerId === isolatedOwner) only.set(systemId, ownerId);
  }
  return only;
}
```

- [ ] **Step 5: `framing.ts`'i uygula**

`framingFor`'un son bölümünü (`const bounds = nodeBounds(members);`'dan `return fitCamera(...)`'ya kadar) yeni bir fonksiyona çıkar ve `framingFor` onu çağırsın:

```ts
/**
 * The camera that shows a set of nodes whole.
 *
 * A set with no extent on either axis would send fitZoom to
 * FALLBACK_FIT_ZOOM — the galaxy fit — which would answer "frame these" by
 * showing the galaxy, so it is centred at the system zoom instead, the same
 * constant a focus uses.
 */
export function frameNodes(
  members: Pick<FramingNode, 'x' | 'z'>[],
  width: number,
  height: number,
): MapCamera | null {
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

`framingFor`'un sonu:

```ts
  const members = nodes.filter((candidate) =>
    framing.kind === 'constellation'
      ? candidate.constellationId === framing.id
      : candidate.regionId === framing.id,
  );

  return frameNodes(members, width, height);
}
```

Dosyanın sonuna:

```ts
/**
 * Every system an owner holds, framed — what the Owners row's "show on the
 * map" asks for. Kept apart from isolating the owner: isolating and then
 * staying where you are is a use of its own.
 */
export function ownerCamera(
  ownerId: number,
  ownerBySystem: Map<number, number>,
  nodes: FramingNode[],
  width: number,
  height: number,
): MapCamera | null {
  if (!(width > 0) || !(height > 0)) return null;
  return frameNodes(
    nodes.filter((node) => ownerBySystem.get(node.systemId) === ownerId),
    width,
    height,
  );
}
```

- [ ] **Step 6: Testlerin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/utils/map/layers.spec.ts src/utils/map/framing.spec.ts`
Expected: PASS (eski `framingFor` testleri dahil).

- [ ] **Step 7: `UniverseMap`'te izolasyonu bağla**

`useMapCamera` destructuring'ine ekle:

```ts
    owner: isolatedOwner,
```

`layerData` memo'su:

```ts
// One object for both the marks and the mesh, so the two can never be
// reading different sovereignty — or a different isolation.
const layerData = useMemo<MapLayerData>(
  () => ({ sovereignty: sovIndex, isolatedOwner }),
  [sovIndex, isolatedOwner],
);

const crestOwners = useMemo(
  () => logoOwners(sovIndex, isolatedOwner),
  [sovIndex, isolatedOwner],
);
```

Marks effect'indeki `applyLogos` çağrısında `sovIndex?.ownerBySystem ?? EMPTY_OWNERS` yerine `crestOwners`; dependency dizisinde `sovIndex` yerine `crestOwners`:

```ts
    applyLogos(
      systemSprites.current,
      geometry.nodes,
      scene.current.dot,
      atlas.current,
      showLogos,
      crestOwners,
      cameraScale.current,
    );
  }, [sceneReady, geometry, layer, layerData, showLogos, atlasReady, crestOwners]);
```

Dosyanın başındaki `EMPTY_OWNERS` sabitini ve yorumunu sil (artık kullanılmıyor). `logoOwners`'ı `@/utils/map/layers` importuna ekle.

`onOwnerChange` ve `jumpTo` bu görevde henüz kullanılmıyor (Task 9 bağlar); destructure etme, lint `no-unused-vars` uyarır.

- [ ] **Step 8: Harita testleri ve tipler**

Run: `yarn workspace frontend vitest run src/components/UniverseMap src/utils/map && yarn workspace frontend typecheck`
Expected: PASS; `tsc` 0.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/utils/map/layers.ts frontend/src/utils/map/layers.spec.ts frontend/src/utils/map/framing.ts frontend/src/utils/map/framing.spec.ts frontend/src/components/UniverseMap/UniverseMap.tsx
git commit -m "feat(map): isolate one sovereignty owner and frame an owner's systems"
```

---

### Task 4: Geri sayım — `countdown.ts` ve `useNow`

**Files:**

- Create: `frontend/src/utils/map/countdown.ts`
- Create: `frontend/src/utils/map/countdown.spec.ts`
- Create: `frontend/src/components/UniverseMap/useNow.ts`

**Interfaces:**

- Produces:
  - `type CountdownCampaign = { startTime: string; defenderScore?: number | null; attackersScore?: number | null }`
  - `type ChipCampaign = CountdownCampaign & { campaignId: number; solarSystemId: number; solarSystemName?: string | null; eventType: string }`
  - `eventLabel(eventType: string): string`
  - `isLive(campaign: CountdownCampaign, now: number): boolean`
  - `countdownText(campaign: CountdownCampaign, now: number): string`
  - `chipPrefix(campaign: ChipCampaign): string` — `"1DQ1-A · IHub · "`
  - `chipText(campaign: ChipCampaign, now: number): string`
  - `byStartTime<T extends { startTime: string }>(campaigns: readonly T[]): T[]`
  - `latestUpdate(campaigns: readonly { updatedAt: string }[]): string | null`
  - `STALE_AFTER_MS = 600_000`, `isStale(latest: string | null, now: number): boolean`
  - `eveTimestamp(iso: string): string` — `"2026-09-12 14:33 EVE"`
  - `useNow(intervalMs: number, enabled?: boolean): number`

- [ ] **Step 1: Başarısız testleri yaz**

`frontend/src/utils/map/countdown.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  byStartTime,
  chipPrefix,
  chipText,
  countdownText,
  eventLabel,
  eveTimestamp,
  isLive,
  isStale,
  latestUpdate,
  STALE_AFTER_MS,
} from './countdown';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const at = (ms: number) => new Date(NOW + ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('countdownText', () => {
  it('shows days and hours from a day out', () => {
    expect(
      countdownText({ startTime: at(DAY + 4 * HOUR + 30 * MINUTE) }, NOW),
    ).toBe('1d 4h');
  });

  it('shows exactly one day as days', () => {
    expect(countdownText({ startTime: at(DAY) }, NOW)).toBe('1d 0h');
  });

  it('shows hours and padded minutes inside a day', () => {
    expect(
      countdownText(
        { startTime: at(2 * HOUR + 4 * MINUTE + 59 * SECOND) },
        NOW,
      ),
    ).toBe('2h 04m');
  });

  it('shows exactly one hour as hours', () => {
    expect(countdownText({ startTime: at(HOUR) }, NOW)).toBe('1h 00m');
  });

  // Inside the hour a fleet is forming up; the seconds are what it is counting.
  it('shows minutes and seconds inside the hour', () => {
    expect(
      countdownText({ startTime: at(42 * MINUTE + 10 * SECOND) }, NOW),
    ).toBe('42:10');
  });

  it('shows the last second as 00:00 rather than going live early', () => {
    expect(countdownText({ startTime: at(999) }, NOW)).toBe('00:00');
  });

  it('is live with both scores as percentages once the timer has started', () => {
    expect(
      countdownText(
        { startTime: at(0), defenderScore: 0.62, attackersScore: 0.38 },
        NOW,
      ),
    ).toBe('LIVE 62–38');
  });

  it('is live alone when ESI has not reported the scores', () => {
    expect(
      countdownText(
        { startTime: at(-MINUTE), defenderScore: null, attackersScore: 0.4 },
        NOW,
      ),
    ).toBe('LIVE');
  });
});

describe('isLive', () => {
  it('is live from the start time on', () => {
    expect(isLive({ startTime: at(0) }, NOW)).toBe(true);
    expect(isLive({ startTime: at(1) }, NOW)).toBe(false);
  });
});

describe('eventLabel', () => {
  it.each([
    ['ihub_defense', 'IHub'],
    ['tcu_defense', 'TCU'],
    ['station_defense', 'Station'],
    ['station_freeport', 'Freeport'],
  ])('names %s as %s', (eventType, label) => {
    expect(eventLabel(eventType)).toBe(label);
  });

  // A new event type from CCP still says something rather than nothing.
  it('passes an unknown type through as it came', () => {
    expect(eventLabel('skyhook_defense')).toBe('skyhook_defense');
  });
});

describe('chip text', () => {
  const campaign = {
    campaignId: 1,
    solarSystemId: 30004759,
    solarSystemName: '1DQ1-A',
    eventType: 'ihub_defense',
    startTime: at(2 * HOUR + 14 * MINUTE),
  };

  it('is the system, the event and the countdown', () => {
    expect(chipText(campaign, NOW)).toBe('1DQ1-A · IHub · 2h 14m');
  });

  it('has a prefix that does not change while the clock runs', () => {
    expect(chipPrefix(campaign)).toBe('1DQ1-A · IHub · ');
  });

  it('falls back to the system id when the name is missing', () => {
    expect(chipPrefix({ ...campaign, solarSystemName: null })).toBe(
      '30004759 · IHub · ',
    );
  });
});

describe('byStartTime', () => {
  // Live timers started earlier than any upcoming one, so one ascending sort
  // puts them first — the order the panel and the chip priority both want.
  it('puts the live ones first and then the soonest', () => {
    const sorted = byStartTime([
      { id: 'later', startTime: at(3 * HOUR) },
      { id: 'live', startTime: at(-HOUR) },
      { id: 'soon', startTime: at(HOUR) },
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['live', 'soon', 'later']);
  });

  it('does not reorder the caller’s array', () => {
    const input = [{ startTime: at(2) }, { startTime: at(1) }];
    byStartTime(input);
    expect(input[0].startTime).toBe(at(2));
  });
});

describe('freshness', () => {
  it('finds the newest write', () => {
    expect(
      latestUpdate([{ updatedAt: at(-HOUR) }, { updatedAt: at(-MINUTE) }]),
    ).toBe(at(-MINUTE));
  });

  it('has nothing to say about no campaigns', () => {
    expect(latestUpdate([])).toBeNull();
    expect(isStale(null, NOW)).toBe(false);
  });

  it('is stale only past ten minutes', () => {
    expect(isStale(at(-STALE_AFTER_MS), NOW)).toBe(false);
    expect(isStale(at(-STALE_AFTER_MS - 1), NOW)).toBe(true);
  });

  it('prints a write in EVE time, which is UTC', () => {
    expect(eveTimestamp('2026-09-12T14:33:49.046Z')).toBe(
      '2026-09-12 14:33 EVE',
    );
  });
});
```

- [ ] **Step 2: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/utils/map/countdown.spec.ts`
Expected: FAIL — `Failed to resolve import "./countdown"`.

- [ ] **Step 3: `countdown.ts`'i yaz**

```ts
/**
 * What a sovereignty timer says, as text.
 *
 * One function for the chip on the map, the panel's Timers row and the
 * popup's campaign line, so the three can never disagree about how long is
 * left. All of it is pure: the caller passes `now`, which is what makes the
 * thresholds testable to the millisecond.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this, the panel says how old its timers are. The worker runs every minute. */
export const STALE_AFTER_MS = 10 * MINUTE;

export type CountdownCampaign = {
  startTime: string;
  defenderScore?: number | null;
  attackersScore?: number | null;
};

export type ChipCampaign = CountdownCampaign & {
  campaignId: number;
  solarSystemId: number;
  solarSystemName?: string | null;
  eventType: string;
};

const EVENT_LABEL: Record<string, string> = {
  ihub_defense: 'IHub',
  tcu_defense: 'TCU',
  station_defense: 'Station',
  station_freeport: 'Freeport',
};

/** ESI's event type in the words a pilot uses; an unknown one passes through. */
export function eventLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType;
}

/** A campaign's start time is the moment its timer opens; from then it is live. */
export function isLive(campaign: CountdownCampaign, now: number): boolean {
  return Date.parse(campaign.startTime) <= now;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Floors throughout: "00:00" is the last second before the timer opens, and
 * the chip turns LIVE on the second it actually does rather than one early.
 * ESI's scores are 0..1; they are shown as whole percentages.
 */
export function countdownText(
  campaign: CountdownCampaign,
  now: number,
): string {
  const left = Date.parse(campaign.startTime) - now;

  if (left <= 0) {
    const { defenderScore, attackersScore } = campaign;
    if (defenderScore == null || attackersScore == null) return 'LIVE';
    return `LIVE ${Math.round(defenderScore * 100)}–${Math.round(attackersScore * 100)}`;
  }

  if (left >= DAY) {
    return `${Math.floor(left / DAY)}d ${Math.floor((left % DAY) / HOUR)}h`;
  }

  if (left >= HOUR) {
    return `${Math.floor(left / HOUR)}h ${pad(Math.floor((left % HOUR) / MINUTE))}m`;
  }

  return `${pad(Math.floor(left / MINUTE))}:${pad(Math.floor((left % MINUTE) / SECOND))}`;
}

/**
 * The part of a chip that does not change while the clock runs. The chip's
 * collision box is measured from this plus a fixed reserve for the countdown,
 * so a box does not grow and shrink every second and push its neighbours
 * around.
 */
export function chipPrefix(campaign: ChipCampaign): string {
  const name = campaign.solarSystemName ?? String(campaign.solarSystemId);
  return `${name} · ${eventLabel(campaign.eventType)} · `;
}

export function chipText(campaign: ChipCampaign, now: number): string {
  return chipPrefix(campaign) + countdownText(campaign, now);
}

/**
 * Soonest first. A live timer started before any upcoming one, so a single
 * ascending sort also puts every live one at the top. A copy: the caller's
 * array is Apollo's, and Apollo's results are frozen.
 */
export function byStartTime<T extends { startTime: string }>(
  campaigns: readonly T[],
): T[] {
  return [...campaigns].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
  );
}

/** The newest write among the campaigns, or null when there are none. */
export function latestUpdate(
  campaigns: readonly { updatedAt: string }[],
): string | null {
  let latest: string | null = null;
  for (const { updatedAt } of campaigns) {
    if (latest === null || Date.parse(updatedAt) > Date.parse(latest)) {
      latest = updatedAt;
    }
  }
  return latest;
}

export function isStale(latest: string | null, now: number): boolean {
  return latest !== null && now - Date.parse(latest) > STALE_AFTER_MS;
}

/** An ISO timestamp as EVE time, which is UTC: `2026-09-12 14:33 EVE`. */
export function eveTimestamp(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} EVE`;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/utils/map/countdown.spec.ts`
Expected: PASS.

- [ ] **Step 5: `useNow.ts`'i yaz**

```ts
'use client';

import { useEffect, useState } from 'react';

/**
 * The time, refreshed every `intervalMs` while `enabled`.
 *
 * For the React side of the timers — the panel rows and the popup line. The
 * chips on the map do not use it: they rewrite their own text from an
 * interval, so the whole map is not re-rendered once a second.
 */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
```

- [ ] **Step 6: Tipler ve lint**

Run: `yarn workspace frontend typecheck && cd frontend && npx eslint src/utils/map/countdown.ts src/components/UniverseMap/useNow.ts`
Expected: `tsc` 0; eslint çıktısı boş.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/map/countdown.ts frontend/src/utils/map/countdown.spec.ts frontend/src/components/UniverseMap/useNow.ts
git commit -m "feat(map): format sovereignty timers as a countdown"
```

---

### Task 5: Campaign işaretlerinin geometrisi ve çip yerleştirme

**Files:**

- Create: `frontend/src/utils/map/campaignMarks.ts`
- Create: `frontend/src/utils/map/campaignMarks.spec.ts`
- Modify: `frontend/src/utils/map/labels.ts` (`overlaps`, `placeLabels`)
- Modify: `frontend/src/utils/map/labels.spec.ts`

**Interfaces:**

- Consumes: `ChipCampaign`, `chipPrefix`, `isLive` (Task 4); `CameraTransform` (`camera.ts`); `systemFloorPx`, `systemRadiusPx` (`marks.ts`); `LABEL_DOT_GAP_PX`, `LABEL_LOGO_LIFT_PX` (`labels.ts`); `LOGO_MIN_RADIUS_PX`, `discRadiusPx` (`sovLogos.ts`).
- Produces:
  - `type CampaignSource = { campaignId: number; systemId: number; x: number; z: number; radius: number; startTime: string; prefix: string }`
  - `campaignSources(campaigns: readonly ChipCampaign[], nodes: readonly { systemId: number; x: number; z: number; radius: number }[]): CampaignSource[]` — sahnede olmayan sistemler düşer, sıra korunur
  - `type RingMark = { x: number; y: number; radius: number; live: boolean }`
  - `ringMarks(args: { sources: readonly CampaignSource[]; transform: CameraTransform; width: number; height: number; logos: boolean; now: number }): RingMark[]`
  - `type ChipBox = { campaignId: number; systemId: number; screenX: number; screenY: number; halfWidth: number; halfHeight: number }`
  - `placeChips(args: { sources: readonly CampaignSource[]; measure: (text: string) => number; transform: CameraTransform; width: number; height: number; logos: boolean }): ChipBox[]`
  - Sabitler: `RING_GAP_PX = 3`, `RING_STROKE_PX = 1.5`, `CHIP_HEIGHT_PX = 18`, `CHIP_PAD_X_PX = 6`, `CHIP_COUNTDOWN_RESERVE_PX = 72`
  - `placeLabels(candidates, sticky?, reserved?: readonly LabelBox[])`; `type LabelBox = Pick<LabelCandidate, 'screenX' | 'screenY' | 'halfWidth' | 'halfHeight'>`

`CHIP_COUNTDOWN_RESERVE_PX = 72`: 12 px Roboto Condensed'de en geniş geri sayım biçimi `LIVE 100–100` ve `23h 59m`; ölçülmüş bir değer değil, yukarı yuvarlanmış bir rezerv. Biraz geniş olması bir komşu çipi gereğinden erken gizler; dar olması iki çipi üst üste bindirir — bu yüzden geniş tarafta.

- [ ] **Step 1: `labels.spec.ts`'e başarısız testi yaz**

```ts
describe('placeLabels with reserved boxes', () => {
  it('keeps a name off a box already taken by a chip', () => {
    const name = {
      key: 'system:1',
      name: 'Jita',
      tier: 'system' as const,
      screenX: 100,
      screenY: 100,
      halfWidth: 20,
      halfHeight: 7,
    };
    const chip = { screenX: 110, screenY: 100, halfWidth: 40, halfHeight: 9 };

    expect(placeLabels([name], undefined, [chip])).toEqual([]);
    expect(placeLabels([name])).toEqual([name]);
  });
});
```

- [ ] **Step 2: `campaignMarks.spec.ts`'i yaz**

```ts
import { describe, expect, it } from 'vitest';
import type { CameraTransform } from './camera';
import {
  campaignSources,
  CHIP_COUNTDOWN_RESERVE_PX,
  CHIP_HEIGHT_PX,
  CHIP_PAD_X_PX,
  placeChips,
  RING_GAP_PX,
  ringMarks,
  type CampaignSource,
} from './campaignMarks';
import { systemFloorPx, systemRadiusPx } from './marks';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const HOUR = 3_600_000;
const at = (ms: number) => new Date(NOW + ms).toISOString();

/** World metres straight onto screen pixels: x→x, z→-y, centred at (500, 400). */
const SCALE = 2 ** -45;
const TRANSFORM: CameraTransform = {
  scaleX: SCALE,
  scaleY: -SCALE,
  x: 500,
  y: 400,
};
const VIEW = { width: 1000, height: 800 };

/** A world point that lands on the given screen pixel. */
const worldAt = (sx: number, sy: number) => ({
  x: (sx - TRANSFORM.x) / TRANSFORM.scaleX,
  z: (sy - TRANSFORM.y) / TRANSFORM.scaleY,
});

const source = (
  campaignId: number,
  sx: number,
  sy: number,
  startIn: number,
): CampaignSource => ({
  campaignId,
  systemId: 30000000 + campaignId,
  ...worldAt(sx, sy),
  radius: 1e12,
  startTime: at(startIn),
  prefix: `SYS${campaignId} · IHub · `,
});

/** Every prefix measures 10 px per character. */
const measure = (text: string) => text.length * 10;

describe('campaignSources', () => {
  const campaign = (campaignId: number, solarSystemId: number) => ({
    campaignId,
    solarSystemId,
    solarSystemName: `S${campaignId}`,
    eventType: 'ihub_defense',
    startTime: at(HOUR),
  });
  const nodes = [{ systemId: 30000001, x: 1, z: 2, radius: 3 }];

  it('places a campaign on its system', () => {
    expect(campaignSources([campaign(1, 30000001)], nodes)).toEqual([
      {
        campaignId: 1,
        systemId: 30000001,
        x: 1,
        z: 2,
        radius: 3,
        startTime: at(HOUR),
        prefix: 'S1 · IHub · ',
      },
    ]);
  });

  // POCHVEN and WORMHOLE scenes hold no null-sec: their campaigns have no
  // system to sit on and are simply not drawn.
  it('drops a campaign whose system is not in the scene', () => {
    expect(campaignSources([campaign(2, 30009999)], nodes)).toEqual([]);
  });
});

describe('ringMarks', () => {
  it('rings the system just outside its drawn disc', () => {
    const [ring] = ringMarks({
      sources: [source(1, 300, 200, HOUR)],
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
      now: NOW,
    });
    const disc = systemRadiusPx(1e12, SCALE, systemFloorPx(Math.log2(SCALE)));

    expect(ring.x).toBeCloseTo(300);
    expect(ring.y).toBeCloseTo(200);
    expect(ring.radius).toBeCloseTo(disc + RING_GAP_PX);
    expect(ring.live).toBe(false);
  });

  it('is live once the timer has started', () => {
    const [ring] = ringMarks({
      sources: [source(1, 300, 200, -1)],
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
      now: NOW,
    });
    expect(ring.live).toBe(true);
  });

  it('clears the logo disc rather than the dot while crests are drawn', () => {
    const [dot] = ringMarks({
      sources: [source(1, 300, 200, HOUR)],
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
      now: NOW,
    });
    const [logo] = ringMarks({
      sources: [source(1, 300, 200, HOUR)],
      transform: TRANSFORM,
      ...VIEW,
      logos: true,
      now: NOW,
    });
    expect(logo.radius).toBeGreaterThan(dot.radius);
  });

  it('skips a ring wholly off screen', () => {
    expect(
      ringMarks({
        sources: [source(1, -500, 200, HOUR)],
        transform: TRANSFORM,
        ...VIEW,
        logos: false,
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe('placeChips', () => {
  it('sizes the box from the prefix plus the countdown reserve', () => {
    const [chip] = placeChips({
      sources: [source(1, 300, 300, HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    const prefixWidth = 'SYS1 · IHub · '.length * 10;
    expect(chip.halfWidth).toBe(
      (prefixWidth + CHIP_COUNTDOWN_RESERVE_PX + 2 * CHIP_PAD_X_PX) / 2,
    );
    expect(chip.halfHeight).toBe(CHIP_HEIGHT_PX / 2);
    expect(chip.screenX).toBeCloseTo(300);
    // Above the system, where its name would have been.
    expect(chip.screenY).toBeLessThan(300);
  });

  // The order given is the priority — soonest first, live before both.
  it('keeps the first of two colliding chips and drops the second', () => {
    const placed = placeChips({
      sources: [source(1, 300, 300, HOUR), source(2, 310, 302, 2 * HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    expect(placed.map((c) => c.campaignId)).toEqual([1]);
  });

  it('keeps chips that do not touch', () => {
    const placed = placeChips({
      sources: [source(1, 300, 300, HOUR), source(2, 300, 600, 2 * HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    expect(placed.map((c) => c.campaignId)).toEqual([1, 2]);
  });

  it('places no chip for a system off screen', () => {
    expect(
      placeChips({
        sources: [source(1, 300, 2000, HOUR)],
        measure,
        transform: TRANSFORM,
        ...VIEW,
        logos: false,
      }),
    ).toEqual([]);
  });

  it('carries the system id, which is what makes a chip clickable', () => {
    const [chip] = placeChips({
      sources: [source(1, 300, 300, HOUR)],
      measure,
      transform: TRANSFORM,
      ...VIEW,
      logos: false,
    });
    expect(chip.systemId).toBe(30000001);
  });
});
```

- [ ] **Step 3: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/utils/map/campaignMarks.spec.ts src/utils/map/labels.spec.ts`
Expected: FAIL — `./campaignMarks` çözülemiyor; `placeLabels` reserved kutuyu yok sayıyor.

- [ ] **Step 4: `labels.ts`'i değiştir**

`LabelCandidate` arayüzünün altına:

```ts
/** What a collision needs: a centre and two half extents. */
export type LabelBox = Pick<
  LabelCandidate,
  'screenX' | 'screenY' | 'halfWidth' | 'halfHeight'
>;
```

`overlaps`'in imzası:

```ts
function overlaps(a: LabelBox, b: LabelBox): boolean {
```

`placeLabels`'ın imzası ve `consider`:

```ts
export function placeLabels(
  candidates: LabelCandidate[],
  sticky: ReadonlySet<string> = EMPTY_STICKY,
  /**
   * Boxes already taken before any name is placed — the campaign chips. They
   * do not count toward MAX_VISIBLE_LABELS and are not returned.
   */
  reserved: readonly LabelBox[] = NO_RESERVED,
): LabelCandidate[] {
  const placed: LabelCandidate[] = [];

  const consider = (candidate: LabelCandidate) => {
    if (placed.length >= MAX_VISIBLE_LABELS) return;
    if (reserved.some((box) => overlaps(candidate, box))) return;
    if (placed.some((other) => overlaps(candidate, other))) return;
    placed.push(candidate);
  };
```

`EMPTY_STICKY`'nin altına:

```ts
/** Shared empty list, for the same reason. */
const NO_RESERVED: readonly LabelBox[] = [];
```

- [ ] **Step 5: `campaignMarks.ts`'i yaz**

```ts
import type { CameraTransform } from './camera';
import { chipPrefix, isLive, type ChipCampaign } from './countdown';
import { LABEL_DOT_GAP_PX, LABEL_LOGO_LIFT_PX } from './labels';
import { systemFloorPx, systemRadiusPx } from './marks';
import { discRadiusPx, LOGO_MIN_RADIUS_PX } from './sovLogos';

/** Clear space between a system's drawn mark and the ring around it. */
export const RING_GAP_PX = 3;

/** The ring's stroke, in screen pixels at every zoom. */
export const RING_STROKE_PX = 1.5;

/** A chip's box: one 12 px line plus its border and padding. */
export const CHIP_HEIGHT_PX = 18;

export const CHIP_PAD_X_PX = 6;

/**
 * The countdown's share of a chip's width, reserved rather than measured: the
 * text changes every second, and a box measured from it would grow and shrink
 * and push its neighbours in and out of view. Wide enough for `LIVE 100–100`
 * and `23h 59m` at 12 px, rounded up — too wide hides a neighbour a little
 * early, too narrow lets two chips overlap.
 */
export const CHIP_COUNTDOWN_RESERVE_PX = 72;

/** A campaign with the position of the system it is fought over. */
export interface CampaignSource {
  campaignId: number;
  systemId: number;
  x: number;
  z: number;
  radius: number;
  startTime: string;
  prefix: string;
}

/**
 * Campaigns joined to the scene's nodes, in the order given — which is the
 * chip priority, so the caller sorts first. A campaign whose system the scene
 * does not hold (every one of them, on the POCHVEN and WORMHOLE maps) is
 * dropped: there is nowhere to draw it.
 */
export function campaignSources(
  campaigns: readonly ChipCampaign[],
  nodes: readonly { systemId: number; x: number; z: number; radius: number }[],
): CampaignSource[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));
  const sources: CampaignSource[] = [];

  for (const campaign of campaigns) {
    const node = byId.get(campaign.solarSystemId);
    if (!node) continue;
    sources.push({
      campaignId: campaign.campaignId,
      systemId: node.systemId,
      x: node.x,
      z: node.z,
      radius: node.radius,
      startTime: campaign.startTime,
      prefix: chipPrefix(campaign),
    });
  }

  return sources;
}

/**
 * The drawn radius of the mark a ring or a chip has to clear. With crests on,
 * a held system is a logo on a disc, which is larger than its dot and has a
 * floor of its own — the same two rules `scaleSystems` applies.
 */
function markRadiusPx(
  radius: number,
  scale: number,
  floorPx: number,
  logos: boolean,
): number {
  if (!logos) return systemRadiusPx(radius, scale, floorPx);
  return discRadiusPx(
    systemRadiusPx(radius, scale, Math.max(floorPx, LOGO_MIN_RADIUS_PX)),
  );
}

export interface RingMark {
  x: number;
  y: number;
  radius: number;
  live: boolean;
}

/**
 * Where each ring goes on screen. In screen space rather than the world's:
 * the stroke stays the same width at every zoom, and screen coordinates are
 * small enough for float32 — world metres are not.
 */
export function ringMarks({
  sources,
  transform,
  width,
  height,
  logos,
  now,
}: {
  sources: readonly CampaignSource[];
  transform: CameraTransform;
  width: number;
  height: number;
  logos: boolean;
  now: number;
}): RingMark[] {
  const scale = transform.scaleX;
  const floorPx = systemFloorPx(Math.log2(scale));
  const rings: RingMark[] = [];

  for (const source of sources) {
    const x = source.x * transform.scaleX + transform.x;
    const y = source.z * transform.scaleY + transform.y;
    const radius =
      markRadiusPx(source.radius, scale, floorPx, logos) + RING_GAP_PX;

    if (
      x + radius < 0 ||
      x - radius > width ||
      y + radius < 0 ||
      y - radius > height
    ) {
      continue;
    }

    rings.push({ x, y, radius, live: isLive(source, now) });
  }

  return rings;
}

export interface ChipBox {
  campaignId: number;
  systemId: number;
  screenX: number;
  screenY: number;
  halfWidth: number;
  halfHeight: number;
}

const overlaps = (a: ChipBox, b: ChipBox) =>
  Math.abs(a.screenX - b.screenX) < a.halfWidth + b.halfWidth &&
  Math.abs(a.screenY - b.screenY) < a.halfHeight + b.halfHeight;

/**
 * Greedy, in the order given: the caller sorts soonest first, so in a crowd
 * the timers about to open are the ones that stay. A chip that does not fit
 * is dropped — its ring still marks the system, and the panel lists it.
 *
 * Anchored above the system, where its name would sit and with the same lift
 * the system label uses; the name itself is not drawn under a chip, which
 * carries it.
 */
export function placeChips({
  sources,
  measure,
  transform,
  width,
  height,
  logos,
}: {
  sources: readonly CampaignSource[];
  measure: (text: string) => number;
  transform: CameraTransform;
  width: number;
  height: number;
  logos: boolean;
}): ChipBox[] {
  const scale = transform.scaleX;
  const floorPx = systemFloorPx(Math.log2(scale));
  const halfHeight = CHIP_HEIGHT_PX / 2;
  const placed: ChipBox[] = [];

  for (const source of sources) {
    const mark = markRadiusPx(source.radius, scale, floorPx, logos);
    const lift =
      Math.max(CHIP_HEIGHT_PX, halfHeight + mark + LABEL_DOT_GAP_PX) +
      (logos ? LABEL_LOGO_LIFT_PX : 0);

    const halfWidth =
      (measure(source.prefix) + CHIP_COUNTDOWN_RESERVE_PX + 2 * CHIP_PAD_X_PX) /
      2;
    const screenX = source.x * transform.scaleX + transform.x;
    const screenY = source.z * transform.scaleY + transform.y - lift;

    if (
      screenX + halfWidth < 0 ||
      screenX - halfWidth > width ||
      screenY + halfHeight < 0 ||
      screenY - halfHeight > height
    ) {
      continue;
    }

    const chip: ChipBox = {
      campaignId: source.campaignId,
      systemId: source.systemId,
      screenX,
      screenY,
      halfWidth,
      halfHeight,
    };
    if (placed.some((other) => overlaps(chip, other))) continue;
    placed.push(chip);
  }

  return placed;
}
```

`CampaignSource`'un `isLive`'a geçebilmesi için `startTime` alanı yeter (`CountdownCampaign`'in skor alanları isteğe bağlı).

- [ ] **Step 6: Testlerin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/utils/map/campaignMarks.spec.ts src/utils/map/labels.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/map/campaignMarks.ts frontend/src/utils/map/campaignMarks.spec.ts frontend/src/utils/map/labels.ts frontend/src/utils/map/labels.spec.ts
git commit -m "feat(map): place campaign rings and countdown chips on screen"
```

---

### Task 6: Sov verisi — sorgular ve hook'lar

**Files:**

- Create: `frontend/src/graphql/MapSovCampaigns.graphql`
- Create: `frontend/src/graphql/MapSovChanges.graphql`
- Create: `frontend/src/components/UniverseMap/useSovCampaigns.ts`
- Create: `frontend/src/components/UniverseMap/useSovChanges.ts`
- Create: `frontend/src/components/UniverseMap/useSovCampaigns.spec.ts`
- Regenerate: `frontend/src/generated/graphql.ts`

**Interfaces:**

- Consumes: Task 1'deki `updatedAt` ve operasyon adları; Task 4'teki `byStartTime`.
- Produces:
  - `type SovCampaign = MapSovCampaignsQuery['sovereigntyActiveCampaigns'][number]`
  - `useSovCampaigns(active: boolean): SovCampaign[]` — başlangıç zamanına göre sıralı, sabit kimlikli boş dizi
  - `type SovChange = MapSovChangesQuery['recentTerritoryChanges'][number]`
  - `useSovChanges(active: boolean): { changes: SovChange[]; loading: boolean }`

- [ ] **Step 1: Sorgu dokümanlarını yaz**

`frontend/src/graphql/MapSovCampaigns.graphql`:

```graphql
# Named MapSovCampaigns on purpose: the backend's response cache finds public
# queries by operation name in PUBLIC_CACHE_QUERIES (backend/src/config/cache.ts),
# and its 60 s TTL is set on Query.sovereigntyActiveCampaigns there. Renaming
# the operation drops it to a per-token entry.
#
# limit: the resolver's default is 100, newest first; 200 is room for a war
# without a cap that would silently cut the oldest live timers.
query MapSovCampaigns {
  sovereigntyActiveCampaigns(limit: 200) {
    campaignId
    eventType
    solarSystemId
    solarSystemName
    regionName
    defenderId
    defenderName
    defenderTicker
    defenderScore
    attackersScore
    startTime
    updatedAt
  }
}
```

`frontend/src/graphql/MapSovChanges.graphql`:

```graphql
# Public by operation name, like MapSovCampaigns.
query MapSovChanges {
  recentTerritoryChanges(limit: 50) {
    id
    solarSystemId
    solarSystemName
    previousOwnerId
    previousOwnerName
    newOwnerId
    newOwnerName
    changeType
    detectedAt
  }
}
```

- [ ] **Step 2: Codegen**

Run: `yarn workspace frontend codegen`
Expected: `useMapSovCampaignsQuery`, `useMapSovChangesQuery` ve tipleri üretildi (`grep -c "useMapSovCampaignsQuery" frontend/src/generated/graphql.ts` ≥ 1).

- [ ] **Step 3: Başarısız testi yaz**

`frontend/src/components/UniverseMap/useSovCampaigns.spec.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let calls: { skip?: boolean; pollInterval?: number }[] = [];
let rows: { campaignId: number; startTime: string }[] | undefined;
vi.mock('@/generated/graphql', () => ({
  useMapSovCampaignsQuery: (options: {
    skip?: boolean;
    pollInterval?: number;
  }) => {
    calls.push(options);
    return { data: rows ? { sovereigntyActiveCampaigns: rows } : undefined };
  },
}));

import { useSovCampaigns } from './useSovCampaigns';

beforeEach(() => {
  calls = [];
  rows = undefined;
});

describe('useSovCampaigns', () => {
  // The rule every map dataset follows: not drawn, not fetched.
  it('fetches nothing while the sovereignty layer is off', () => {
    renderHook(() => useSovCampaigns(false));
    expect(calls.at(-1)).toMatchObject({ skip: true, pollInterval: 0 });
  });

  it('polls every minute while the layer is on', () => {
    renderHook(() => useSovCampaigns(true));
    expect(calls.at(-1)).toMatchObject({ skip: false, pollInterval: 60_000 });
  });

  it('hands back the timers soonest first', () => {
    rows = [
      { campaignId: 2, startTime: '2026-10-07T14:00:00.000Z' },
      { campaignId: 1, startTime: '2026-10-07T13:00:00.000Z' },
    ];
    const { result } = renderHook(() => useSovCampaigns(true));
    expect(result.current.map((c) => c.campaignId)).toEqual([1, 2]);
  });

  it('keeps one empty array across renders while there is no data', () => {
    const { result, rerender } = renderHook(() => useSovCampaigns(true));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
```

- [ ] **Step 4: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useSovCampaigns.spec.ts`
Expected: FAIL — `./useSovCampaigns` çözülemiyor.

- [ ] **Step 5: Hook'ları yaz**

`frontend/src/components/UniverseMap/useSovCampaigns.ts`:

```ts
'use client';

import {
  useMapSovCampaignsQuery,
  type MapSovCampaignsQuery,
} from '@/generated/graphql';
import { byStartTime } from '@/utils/map/countdown';
import { useMemo } from 'react';

export type SovCampaign =
  MapSovCampaignsQuery['sovereigntyActiveCampaigns'][number];

/** Stable identity for "no rows", for the reason useMapSovereignty holds one. */
const EMPTY: SovCampaign[] = [];

/** The worker writes campaigns every minute; this follows it no faster. */
const POLL_MS = 60_000;

/**
 * Active sovereignty campaigns, soonest first, while the sovereignty layer is
 * on — fetched only then, the rule every map dataset follows.
 *
 * Polled rather than tied to the SOVEREIGNTY_ALERT subscription: the alert
 * covers a campaign starting or ending but not the scores moving, and the
 * response cache would hand a subscription-triggered refetch the same body
 * for up to 60 s anyway.
 */
export function useSovCampaigns(active: boolean): SovCampaign[] {
  const { data } = useMapSovCampaignsQuery({
    skip: !active,
    pollInterval: active ? POLL_MS : 0,
    fetchPolicy: 'cache-and-network',
  });

  const rows = data?.sovereigntyActiveCampaigns;
  return useMemo(() => (rows ? byStartTime(rows) : EMPTY), [rows]);
}
```

`frontend/src/components/UniverseMap/useSovChanges.ts`:

```ts
'use client';

import {
  useMapSovChangesQuery,
  type MapSovChangesQuery,
} from '@/generated/graphql';

export type SovChange = MapSovChangesQuery['recentTerritoryChanges'][number];

const EMPTY: SovChange[] = [];

/**
 * Recent changes of hands, newest first as the resolver orders them. Fetched
 * the first time the Changes tab opens and not polled: they are detected by
 * worker-sov-map every 30 minutes.
 */
export function useSovChanges(active: boolean): {
  changes: SovChange[];
  loading: boolean;
} {
  const { data, loading } = useMapSovChangesQuery({
    skip: !active,
    fetchPolicy: 'cache-first',
  });
  return { changes: data?.recentTerritoryChanges ?? EMPTY, loading };
}
```

- [ ] **Step 6: Testlerin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useSovCampaigns.spec.ts && yarn workspace frontend typecheck`
Expected: PASS; `tsc` 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/graphql/MapSovCampaigns.graphql frontend/src/graphql/MapSovChanges.graphql frontend/src/components/UniverseMap/useSovCampaigns.ts frontend/src/components/UniverseMap/useSovCampaigns.spec.ts frontend/src/components/UniverseMap/useSovChanges.ts
git commit -m "feat(map): fetch sovereignty campaigns and changes for the sovereignty layer"
```

---

### Task 7: Halkalar ve çipler haritada

**Files:**

- Modify: `frontend/src/components/UniverseMap/scene/createScene.ts` (`MapScene.rings`)
- Create: `frontend/src/components/UniverseMap/scene/campaignRings.ts`
- Create: `frontend/src/components/UniverseMap/labels/chipLayer.ts`
- Create: `frontend/src/components/UniverseMap/labels/chipLayer.spec.ts`
- Modify: `frontend/src/app/map.css`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: `useSovCampaigns`, `SovCampaign` (Task 6); `campaignSources`, `ringMarks`, `placeChips`, `RING_STROKE_PX`, `CHIP_HEIGHT_PX`, `CHIP_PAD_X_PX`, `ChipBox`, `RingMark` (Task 5); `chipText`, `isLive`, `ChipCampaign` (Task 4); `useNow` (Task 4); `placeLabels(..., reserved)` (Task 5).
- Produces:
  - `MapScene.rings: Graphics` (ekran uzayında, `app.stage`'de `world`'ün üstünde)
  - `drawRings(target: Graphics, rings: readonly RingMark[]): void`
  - `ChipLayer`, `createChipLayer(host)`, `drawChips(layer, placed)`, `writeChipText(layer, campaigns, now)`, `destroyChipLayer(layer)`
  - `UniverseMap` içinde `campaigns: SovCampaign[]` (Task 8 ve 9 kullanır)

- [ ] **Step 1: `chipLayer.spec.ts` — başarısız testi yaz**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createChipLayer,
  destroyChipLayer,
  drawChips,
  writeChipText,
  type ChipLayer,
} from './chipLayer';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const campaign = {
  campaignId: 7,
  solarSystemId: 30004759,
  solarSystemName: '1DQ1-A',
  eventType: 'ihub_defense',
  startTime: new Date(NOW + 42 * 60_000 + 10_000).toISOString(),
  defenderScore: 0.6,
  attackersScore: 0.4,
};
const box = {
  campaignId: 7,
  systemId: 30004759,
  screenX: 120,
  screenY: 80,
  halfWidth: 60,
  halfHeight: 9,
};

let host: HTMLDivElement;
let layer: ChipLayer;

beforeEach(() => {
  host = document.createElement('div');
  layer = createChipLayer(host);
});

describe('chipLayer', () => {
  it('draws a placed chip where the placement put it, stamped with its system', () => {
    drawChips(layer, [box]);
    const chip = host.querySelector('.map-chip') as HTMLElement;

    expect(chip.dataset.mapSystem).toBe('30004759');
    expect(chip.classList.contains('is-visible')).toBe(true);
    expect(chip.style.transform).toContain('translate(120px, 80px)');
  });

  it('writes the countdown into a drawn chip', () => {
    drawChips(layer, [box]);
    writeChipText(layer, [campaign], NOW);
    expect(host.querySelector('.map-chip')!.textContent).toBe(
      '1DQ1-A · IHub · 42:10',
    );
  });

  it('marks a chip live once its timer has started', () => {
    drawChips(layer, [box]);
    writeChipText(layer, [campaign], NOW + 60 * 60_000);
    const chip = host.querySelector('.map-chip') as HTMLElement;
    expect(chip.dataset.live).toBe('');
    expect(chip.textContent).toBe('1DQ1-A · IHub · LIVE 60–40');
  });

  // Pooled like the labels: a chip that loses its place is hidden, not removed,
  // so the next pan brings it back with a class change.
  it('hides a chip that is no longer placed, and keeps its element', () => {
    drawChips(layer, [box]);
    drawChips(layer, []);
    const chip = host.querySelector('.map-chip') as HTMLElement;
    expect(chip.classList.contains('is-visible')).toBe(false);
  });

  it('leaves the host as it found it', () => {
    drawChips(layer, [box]);
    destroyChipLayer(layer);
    expect(host.querySelector('.map-chips')).toBeNull();
  });
});
```

- [ ] **Step 2: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/labels/chipLayer.spec.ts`
Expected: FAIL — `./chipLayer` çözülemiyor.

- [ ] **Step 3: `chipLayer.ts`'i yaz**

```ts
import { CHIP_HEIGHT_PX } from '@/utils/map/campaignMarks';
import type { ChipBox } from '@/utils/map/campaignMarks';
import { chipText, isLive, type ChipCampaign } from '@/utils/map/countdown';
import { LABEL_FONT_FAMILY, LABEL_TIER_STYLE } from '@/utils/map/labelStyle';

/**
 * The countdown chips, in an overlay of their own.
 *
 * Not the label layer: that pool writes a name once and promises its text
 * never changes, and a chip's changes every second. The technique is the same
 * — pooled elements, one `transform` write per camera change — so a pan costs
 * a chip what it costs a name.
 */
export interface ChipLayer {
  root: HTMLDivElement;
  /** Keyed on campaign id. Never evicted, like the label pool. */
  pool: Map<number, HTMLSpanElement>;
}

export function createChipLayer(host: HTMLElement): ChipLayer {
  const root = document.createElement('div');
  root.className = 'map-chips';
  host.appendChild(root);
  return { root, pool: new Map() };
}

/**
 * Positions the placed chips and hides the rest.
 *
 * `data-map-system` is what makes a chip clickable for free: useMapPointer
 * already selects whatever system a `[data-map-system]` element under the
 * pointer names, the way it does for a system's name.
 */
export function drawChips(layer: ChipLayer, placed: readonly ChipBox[]): void {
  const style = LABEL_TIER_STYLE.system;

  for (const box of placed) {
    let el = layer.pool.get(box.campaignId);
    if (!el) {
      el = document.createElement('span');
      el.className = 'map-chip';
      el.dataset.mapSystem = String(box.systemId);
      // The face and size the chip was measured in — the system tier's — so
      // the collision box and the drawn chip cannot disagree.
      el.style.fontFamily = LABEL_FONT_FAMILY;
      el.style.fontSize = `${style.fontSize}px`;
      el.style.fontWeight = style.fontWeight;
      el.style.height = `${CHIP_HEIGHT_PX}px`;
      layer.pool.set(box.campaignId, el);
      layer.root.appendChild(el);
    }
    el.style.transform = `translate(-50%, -50%) translate(${box.screenX}px, ${box.screenY}px)`;
    el.classList.add('is-visible');
  }

  const shown = new Set(placed.map((box) => box.campaignId));
  for (const [campaignId, el] of layer.pool) {
    if (!shown.has(campaignId)) el.classList.remove('is-visible');
  }
}

/**
 * Writes each chip's countdown. Called once a second; a text that has not
 * changed — every chip more than an hour out, 59 seconds a minute — is not
 * written, so the browser has nothing to lay out.
 */
export function writeChipText(
  layer: ChipLayer,
  campaigns: readonly ChipCampaign[],
  now: number,
): void {
  for (const campaign of campaigns) {
    const el = layer.pool.get(campaign.campaignId);
    if (!el) continue;

    const text = chipText(campaign, now);
    if (el.textContent !== text) el.textContent = text;

    const live = isLive(campaign, now);
    if (live && el.dataset.live === undefined) el.dataset.live = '';
    if (!live && el.dataset.live !== undefined) delete el.dataset.live;
  }
}

export function destroyChipLayer(layer: ChipLayer): void {
  layer.root.remove();
  layer.pool.clear();
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/labels/chipLayer.spec.ts`
Expected: PASS.

- [ ] **Step 5: Çip stilleri**

`frontend/src/app/map.css`, dosyanın sonuna:

```css
/* The countdown chips: their own overlay, one step above the names so a chip
   is never under the name of a neighbour. Transparent as a sheet, like
   .map-labels; only a chip takes the pointer. */
.map-chips {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 2;
  pointer-events: none;
}

.map-chip {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  padding: 0 6px; /* CHIP_PAD_X_PX in utils/map/campaignMarks.ts */
  white-space: nowrap;
  color: #fff;
  background: rgb(0 0 0 / 0.72);
  border: 1px solid var(--color-accent);
  /* Digits that do not change width: a countdown that jitters sideways every
     second reads as broken. */
  font-variant-numeric: tabular-nums;
  user-select: none;
  pointer-events: auto;
  cursor: pointer;
  visibility: hidden;
}

.map-chip.is-visible {
  visibility: visible;
}

.map-chip[data-live] {
  border-color: var(--color-danger);
}
```

Odak halkası ekleme — projede global `:focus-visible { outline: none }` kuralı var ve çip bir buton değil.

- [ ] **Step 6: Sahneye `rings` ekle**

`frontend/src/components/UniverseMap/scene/createScene.ts`:

`MapScene` arayüzüne `celestials: Container;` satırının altına:

```ts
/**
 * The campaign rings, in SCREEN space on the stage rather than in the
 * world: a ring's stroke has to stay one width at every zoom, and screen
 * coordinates are small enough for float32 where galactic metres are not.
 * Redrawn on every camera change — a few dozen circles.
 */
rings: Graphics;
```

`app.stage.addChild(world);` satırını şununla değiştir:

```ts
const rings = new Graphics();
app.stage.addChild(world, rings);
```

Dönen nesneye `celestials,` satırının altına `rings,` ekle.

- [ ] **Step 7: `campaignRings.ts`'i yaz**

```ts
import { RING_STROKE_PX, type RingMark } from '@/utils/map/campaignMarks';
import type { Graphics } from 'pixi.js';

/** `--color-accent` in globals.css: a timer that has not opened yet. */
export const RING_UPCOMING_TINT = 0x5ccbcb;

/** `--color-destroyed` (red-400) in globals.css: a timer that is live. */
export const RING_LIVE_TINT = 0xf87171;

/** Clears and redraws every ring. Positions are already in screen pixels. */
export function drawRings(target: Graphics, rings: readonly RingMark[]): void {
  target.clear();
  for (const ring of rings) {
    target.circle(ring.x, ring.y, ring.radius).stroke({
      width: RING_STROKE_PX,
      color: ring.live ? RING_LIVE_TINT : RING_UPCOMING_TINT,
      alpha: 1,
    });
  }
}
```

- [ ] **Step 8: `UniverseMap.spec.tsx`'in mock'larını yeni modüllere göre genişlet**

`vi.mock('@/generated/graphql', ...)` nesnesine, `useMapSovereigntyQuery`'nin yanına:

```ts
  useMapSovCampaignsQuery: (options: { skip?: boolean }) => {
    sovCampaignQueries.push({ skip: !!options.skip });
    return { data: undefined };
  },
  useMapSovChangesQuery: () => ({ data: undefined, loading: false }),
```

Dosyanın üstündeki `let sovQueries...` satırının altına:

```ts
/** Whether the campaigns query was skipped — it is, off the sovereignty layer. */
let sovCampaignQueries: { skip: boolean }[] = [];
```

`beforeEach` içinde `sovQueries = [];` satırının altına `sovCampaignQueries = [];`.

`vi.mock('./labels/labelLayer', ...)` bloğunun altına:

```ts
vi.mock('./labels/chipLayer', () => ({
  createChipLayer: (host: HTMLElement) => ({
    root: host,
    pool: new Map<number, HTMLSpanElement>(),
  }),
  destroyChipLayer: vi.fn(),
  drawChips: vi.fn(),
  writeChipText: vi.fn(),
}));
vi.mock('./scene/campaignRings', () => ({ drawRings: vi.fn() }));
```

`fakeScene()`'in döndürdüğü nesneye `celestials: { visible: true },` satırının altına `rings: {},`.

Yeni test (`opens on the sovereignty layer...` testinin yanına):

```ts
  it('fetches campaigns only on the sovereignty layer', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(sovCampaignQueries.at(-1)?.skip).toBe(true);

    searchParams = new URLSearchParams('layer=sovereignty');
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(sovCampaignQueries.at(-1)?.skip).toBe(false);
  });
```

- [ ] **Step 9: Testin başarısız olduğunu gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/UniverseMap.spec.tsx`
Expected: FAIL — yeni test `sovCampaignQueries.at(-1)` `undefined` (UniverseMap henüz sorguyu çağırmıyor).

- [ ] **Step 10: `UniverseMap.tsx`'te halkaları ve çipleri bağla**

Importlara:

```ts
import {
  campaignSources,
  placeChips,
  ringMarks,
} from '@/utils/map/campaignMarks';
import {
  createChipLayer,
  destroyChipLayer,
  drawChips,
  writeChipText,
  type ChipLayer,
} from './labels/chipLayer';
import { drawRings } from './scene/campaignRings';
import { useNow } from './useNow';
import { useSovCampaigns } from './useSovCampaigns';
```

`labelLayer` ref'inin altına:

```ts
// The countdown chips' overlay. A ref for the label layer's reason.
const chipLayer = useRef<ChipLayer | null>(null);
```

`useMapSovereignty(...)` çağrısının altına:

```ts
const campaigns = useSovCampaigns(layerId === 'sovereignty');

// The clock the rings read to turn red when a timer opens. Fifteen seconds is
// close enough for a colour; the chips count the seconds themselves, from an
// interval of their own, so the map is not re-rendered every second.
const ringNow = useNow(15_000, campaigns.length > 0);

// Joined to the scene once per fetch, not per frame. Soonest first, which is
// the chips' priority: useSovCampaigns already sorted them.
const markSources = useMemo(
  () => (geometry ? campaignSources(campaigns, geometry.nodes) : []),
  [campaigns, geometry],
);
```

Label overlay effect'inin (`createLabelLayer`) altına:

```ts
useEffect(() => {
  if (!host) return;
  const layer = createChipLayer(host);
  chipLayer.current = layer;
  return () => {
    destroyChipLayer(layer);
    chipLayer.current = null;
  };
}, [host]);
```

`transform` memo'sunun altına (label effect'inden **önce**, çünkü label effect bunu okuyacak):

```ts
// Where the chips go this frame. A memo, not an effect: the label placement
// below reads it to keep names off the chips and to leave a chipped system's
// own name undrawn, at every zoom — including the galaxy zoom, where no
// label tier is open but the chips still are.
const placedChips = useMemo(
  () =>
    measure && transform && markSources.length > 0
      ? placeChips({
          sources: markSources,
          measure: (text) => measure('system', text),
          transform,
          width: size.width,
          height: size.height,
          logos: showLogos,
        })
      : [],
  [measure, transform, markSources, size.width, size.height, showLogos],
);

const chippedSystems = useMemo(
  () => new Set(placedChips.map((chip) => chip.systemId)),
  [placedChips],
);
```

Label effect'inde `labelCandidates` çağrısının `systems:` satırı:

```ts
      // A system with a chip is named by its chip.
      systems:
        chippedSystems.size > 0
          ? labelSystems.filter((system) => !chippedSystems.has(system.id))
          : labelSystems,
```

ve `placeLabels` satırı:

```ts
const placed = placeLabels(candidates, stickyLabels.current, placedChips);
```

Label effect'inin dependency dizisine `placedChips` ve `chippedSystems` ekle.

Label effect'inin altına:

```ts
// The chips' positions, on every camera change, and their text at once so a
// chip never shows empty for the first second.
useEffect(() => {
  const layer = chipLayer.current;
  if (!layer) return;
  drawChips(layer, placedChips);
  writeChipText(layer, campaigns, Date.now());
}, [host, placedChips, campaigns]);

// The countdown itself, once a second while there is anything to count.
useEffect(() => {
  const layer = chipLayer.current;
  if (!layer || campaigns.length === 0) return;
  const id = setInterval(
    () => writeChipText(layer, campaigns, Date.now()),
    1_000,
  );
  return () => clearInterval(id);
}, [host, campaigns]);

// The rings, in screen space, redrawn on every camera change — a few dozen
// circles. Empty off the sovereignty layer, which clears them.
useEffect(() => {
  if (!scene.current) return;
  drawRings(
    scene.current.rings,
    transform && layerId === 'sovereignty'
      ? ringMarks({
          sources: markSources,
          transform,
          width: size.width,
          height: size.height,
          logos: showLogos,
          now: ringNow,
        })
      : [],
  );
}, [
  sceneReady,
  transform,
  layerId,
  markSources,
  size.width,
  size.height,
  showLogos,
  ringNow,
]);
```

`campaigns` security katmanında boş dizi döner (`skip`), dolayısıyla `markSources`, `placedChips` ve çipler de boştur; ayrıca katmana bakmak gerekmez.

- [ ] **Step 11: Testler, tipler, lint**

Run: `yarn workspace frontend vitest run src/components/UniverseMap src/utils/map && yarn workspace frontend typecheck && cd frontend && npx eslint src/components/UniverseMap src/utils/map`
Expected: PASS; `tsc` 0; eslint çıktısında bu dosyalar için yeni sorun yok (önceden var olan uyarılar `main` ile karşılaştırılır).

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/UniverseMap/scene/createScene.ts frontend/src/components/UniverseMap/scene/campaignRings.ts frontend/src/components/UniverseMap/labels/chipLayer.ts frontend/src/components/UniverseMap/labels/chipLayer.spec.ts frontend/src/app/map.css frontend/src/components/UniverseMap/UniverseMap.tsx frontend/src/components/UniverseMap/UniverseMap.spec.tsx
git commit -m "feat(map): ring sovereignty campaigns and count their timers down on the map"
```

---

### Task 8: Popup — campaign satırı ve "Copy link"

**Files:**

- Create: `frontend/src/components/UniverseMap/useCopyLink.ts`
- Modify: `frontend/src/utils/map/overlay.ts` (`popupHeightPx`)
- Modify: `frontend/src/utils/map/overlay.spec.ts`
- Modify: `frontend/src/components/UniverseMap/SystemPopup.tsx`
- Modify: `frontend/src/components/UniverseMap/SystemPopup.spec.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx` (popup props)

**Interfaces:**

- Consumes: `countdownText`, `eventLabel`, `isLive` (Task 4); `useNow` (Task 4); `sharedMapUrl` (Task 2); `campaigns` (Task 7).
- Produces:
  - `useCopyLink(): { copied: string | null; copy: (key: string, url: string) => void }` — `copied`, en son kopyalanan anahtar; 1,5 sn sonra `null`
  - `SystemPopup` yeni props: `campaign?: { eventType: string; startTime: string; defenderScore?: number | null; attackersScore?: number | null } | null`, `shareUrl: string`
  - `popupHeightPx({ stargateCount, hasOwner, hasCampaign })`, `POPUP_CAMPAIGN_LINE_PX = 20`

- [ ] **Step 1: `overlay.spec.ts`'e başarısız testi yaz**

```ts
describe('popupHeightPx with a campaign', () => {
  it('grows by one line when the system has a live campaign', () => {
    const without = popupHeightPx({
      stargateCount: 0,
      hasOwner: true,
      hasCampaign: false,
    });
    const withOne = popupHeightPx({
      stargateCount: 0,
      hasOwner: true,
      hasCampaign: true,
    });
    expect(withOne - without).toBe(POPUP_CAMPAIGN_LINE_PX);
  });
});
```

Import listesine `POPUP_CAMPAIGN_LINE_PX` ekle. Dosyadaki mevcut `popupHeightPx({...})` çağrılarına `hasCampaign: false` ekle (`grep -n "popupHeightPx(" frontend/src/utils/map/overlay.spec.ts`).

- [ ] **Step 2: `SystemPopup.spec.tsx`'e başarısız testleri yaz**

Dosyanın `describe` bloğuna (dosyadaki mevcut render yardımcısını kullanarak — yoksa aşağıdaki gibi doğrudan `render`):

```ts
  it('shows the system’s campaign with its countdown', () => {
    useMapSystemDetailsQuery.mockReturnValue({
      loading: false,
      data: { mapSystemDetails: { ...JITA, owner: null, stargates: [] } },
    });
    render(
      <SystemPopup
        systemId={30000142}
        screenX={400}
        screenY={300}
        anchorRadius={4}
        {...VIEWPORT}
        onClose={() => {}}
        shareUrl="https://killreport.com/map?focus=30000142"
        campaign={{
          eventType: 'ihub_defense',
          startTime: new Date(Date.now() + 3 * 3_600_000 + 60_000).toISOString(),
        }}
      />,
    );
    const line = screen.getByTestId('popup-campaign');
    expect(line).toHaveTextContent('IHub defense');
    expect(line).toHaveTextContent(/3h 0[01]m/);
  });

  it('shows no campaign line for a quiet system', () => {
    useMapSystemDetailsQuery.mockReturnValue({
      loading: false,
      data: { mapSystemDetails: { ...JITA, owner: null, stargates: [] } },
    });
    render(
      <SystemPopup
        systemId={30000142}
        screenX={400}
        screenY={300}
        anchorRadius={4}
        {...VIEWPORT}
        onClose={() => {}}
        shareUrl="https://killreport.com/map?focus=30000142"
      />,
    );
    expect(screen.queryByTestId('popup-campaign')).toBeNull();
  });

  it('copies the system’s link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    useMapSystemDetailsQuery.mockReturnValue({
      loading: false,
      data: { mapSystemDetails: { ...JITA, owner: null, stargates: [] } },
    });
    render(
      <SystemPopup
        systemId={30000142}
        screenX={400}
        screenY={300}
        anchorRadius={4}
        {...VIEWPORT}
        onClose={() => {}}
        shareUrl="https://killreport.com/map?focus=30000142"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(writeText).toHaveBeenCalledWith('https://killreport.com/map?focus=30000142');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
```

`JITA`, dosyadaki mevcut `mapSystemDetails` sabitinin adı değilse onu kullan (`grep -n "const .* = {" frontend/src/components/UniverseMap/SystemPopup.spec.tsx`); `userEvent` import edilmemişse `import userEvent from '@testing-library/user-event';` ekle. Mevcut tüm `<SystemPopup .../>` render'larına `shareUrl="https://killreport.com/map?focus=30000142"` ekle — prop zorunlu.

- [ ] **Step 3: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/utils/map/overlay.spec.ts src/components/UniverseMap/SystemPopup.spec.tsx`
Expected: FAIL — `POPUP_CAMPAIGN_LINE_PX` tanımsız, `popup-campaign` bulunamadı, `Copy link` düğmesi yok.

- [ ] **Step 4: `overlay.ts`'i değiştir**

`POPUP_OWNER_LINE_PX`'in altına:

```ts
/** The campaign line — event and countdown — shown only while one is active. */
export const POPUP_CAMPAIGN_LINE_PX = 20;
```

`popupHeightPx`:

```ts
export function popupHeightPx({
  stargateCount,
  hasOwner,
  hasCampaign,
}: {
  stargateCount: number;
  hasOwner: boolean;
  hasCampaign: boolean;
}): number {
  return (
    POPUP_BASE_HEIGHT_PX +
    (hasOwner ? POPUP_OWNER_LINE_PX : 0) +
    (hasCampaign ? POPUP_CAMPAIGN_LINE_PX : 0) +
    // A system with no stargates draws no heading either — there is nothing
    // for it to head, and "Stargates" over an empty space reads as a failure
    // to load rather than as a wormhole.
    (stargateCount === 0
      ? 0
      : POPUP_STARGATE_HEADING_PX +
        Math.ceil(stargateCount / STARGATE_CHIPS_PER_ROW) *
          POPUP_STARGATE_ROW_PX)
  );
}
```

- [ ] **Step 5: `useCopyLink.ts`'i yaz**

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a button says "Copied" before it goes back to what it does. */
const COPIED_MS = 1_500;

/**
 * Copies a link and remembers which one, so the button that was pressed — and
 * only that one, in a list of timers — says it worked.
 *
 * A clipboard the browser refuses (no permission, an insecure origin) leaves
 * the button as it was: there is no second channel to report it through, and
 * the URL bar already holds the same link.
 */
export function useCopyLink(): {
  copied: string | null;
  copy: (key: string, url: string) => void;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback((key: string, url: string) => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(key);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), COPIED_MS);
      })
      .catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { copied, copy };
}
```

- [ ] **Step 6: `SystemPopup.tsx`'i değiştir**

Importlara:

```ts
import { countdownText, eventLabel, isLive } from '@/utils/map/countdown';
import { useCopyLink } from './useCopyLink';
import { useNow } from './useNow';
```

Prop listesine (bileşen imzası ve tip bloğu), `onClose`'un altına:

```ts
  /** The system's active sovereignty campaign, if it has one. */
  campaign?: {
    eventType: string;
    startTime: string;
    defenderScore?: number | null;
    attackersScore?: number | null;
  } | null;
  /** The link "Copy link" puts on the clipboard. */
  shareUrl: string;
```

Bileşen gövdesinin başına (`useMapSystemDetailsQuery`'nin altına):

```ts
const now = useNow(1_000, Boolean(campaign));
const { copied, copy } = useCopyLink();
```

`popupHeightPx({...})` çağrısına `hasCampaign: Boolean(campaign),`.

Sahip satırının (`{details.owner && (...)}`) hemen altına:

```tsx
{
  /* The timer, under the holder it threatens. Its colour is its state:
              accent while it waits, danger once it is live — the ring on the
              map says the same thing the same way. */
}
{
  campaign && (
    <div
      data-testid="popup-campaign"
      className="flex items-center justify-between mt-1 text-xs gap-x-3"
    >
      <span className="text-ink-muted">
        {eventLabel(campaign.eventType)} defense
      </span>
      <span
        className={`font-medium tabular-nums ${
          isLive(campaign, now) ? 'text-danger' : 'text-accent'
        }`}
      >
        {countdownText(campaign, now)}
      </span>
    </div>
  );
}
```

En alttaki `Open the system` linkini iki düğmelik bir satırla değiştir:

```tsx
{
  /* Two equal halves: the page is still the panel's main way on, and
              the link is what a fleet commander pastes into a ping. Side by
              side so the panel does not grow a line. */
}
<div className="grid grid-cols-2 gap-2 mt-3">
  <Link
    href={`/solar-systems/${details.systemId}`}
    className="button button-primary button-sm"
  >
    Open the system
  </Link>
  <button
    type="button"
    className="button button-outline button-sm"
    onClick={() => copy('popup', shareUrl)}
  >
    {copied === 'popup' ? 'Copied' : 'Copy link'}
  </button>
</div>;
```

Mevcut testlerden biri `Open the system`'ın `button-block` sınıfına bakıyorsa onu güncelle (`grep -n "button-block" frontend/src/components/UniverseMap/SystemPopup.spec.tsx`).

- [ ] **Step 7: `UniverseMap.tsx`'te popup'a yeni props'ları ver**

`useMapCamera` destructuring'inde `owner: isolatedOwner` zaten var (Task 3). Importa `sharedMapUrl` ekle (`@/utils/map/camera`).

`selectedNode` hesaplamasının altına:

```ts
const selectedCampaign = selected
  ? (campaigns.find((campaign) => campaign.solarSystemId === selected) ?? null)
  : null;
```

`<SystemPopup ...>`'a:

```tsx
          campaign={selectedCampaign}
          shareUrl={sharedMapUrl({
            origin: window.location.origin,
            scope,
            focus: selectedNode.systemId,
            layer: layerId,
            owner: isolatedOwner,
          })}
```

(`window` bu bileşende güvenli: `/map` onu `ssr: false` ile yükler.)

- [ ] **Step 8: Testler ve tipler**

Run: `yarn workspace frontend vitest run src/utils/map/overlay.spec.ts src/components/UniverseMap && yarn workspace frontend typecheck`
Expected: PASS; `tsc` 0.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/UniverseMap/useCopyLink.ts frontend/src/utils/map/overlay.ts frontend/src/utils/map/overlay.spec.ts frontend/src/components/UniverseMap/SystemPopup.tsx frontend/src/components/UniverseMap/SystemPopup.spec.tsx frontend/src/components/UniverseMap/UniverseMap.tsx
git commit -m "feat(map): show a system's campaign in its popup and copy a link to it"
```

---

### Task 9: Sov paneli

**Files:**

- Create: `frontend/src/components/UniverseMap/SovPanel.tsx`
- Create: `frontend/src/components/UniverseMap/SovPanel.spec.tsx`
- Delete: `frontend/src/components/UniverseMap/SovLegend.tsx`, `frontend/src/components/UniverseMap/SovLegend.spec.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`

**Interfaces:**

- Consumes: `SovCampaign` (Task 6), `useSovChanges` (Task 6), `countdownText`, `eventLabel`, `isLive`, `latestUpdate`, `isStale`, `eveTimestamp` (Task 4), `useNow` (Task 4), `useCopyLink` (Task 8), `ownerCamera` (Task 3), `framingFor` (mevcut), `useMapCamera(...).onOwnerChange`, `.jumpTo` (Task 2).
- Produces: `SovPanel` props:

  ```ts
  {
    owners: readonly Owner[];            // MapSovereigntyQuery['mapSovereignty']['owners'][number]
    campaigns: readonly SovCampaign[];
    isolatedOwner: number | null;
    onIsolate: (ownerId: number | null) => void;
    onFrameOwner: (ownerId: number) => void;
    onFocusSystem: (systemId: number) => void;
    shareUrlFor: (systemId: number) => string;
  }
  ```

- [ ] **Step 1: Başarısız testleri yaz**

`frontend/src/components/UniverseMap/SovPanel.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let changesSkipped: boolean[] = [];
vi.mock('@/generated/graphql', () => ({
  MapOwnerKind: {
    Alliance: 'ALLIANCE',
    Faction: 'FACTION',
    Corporation: 'CORPORATION',
  },
  useMapSovChangesQuery: (options: { skip?: boolean }) => {
    changesSkipped.push(!!options.skip);
    return {
      loading: false,
      data: options.skip
        ? undefined
        : {
            recentTerritoryChanges: [
              {
                id: 'c1',
                solarSystemId: 30004759,
                solarSystemName: '1DQ1-A',
                previousOwnerId: 1,
                previousOwnerName: 'Old Holder',
                newOwnerId: 2,
                newOwnerName: 'New Holder',
                changeType: 'gained',
                detectedAt: new Date(Date.now() - 3_600_000).toISOString(),
              },
            ],
          },
    };
  },
}));

import SovPanel from './SovPanel';

const owners = [
  {
    ownerId: 99003581,
    kind: 'ALLIANCE',
    name: 'Fraternity.',
    ticker: 'FRT',
    systemCount: 300,
  },
  {
    ownerId: 500003,
    kind: 'FACTION',
    name: 'Amarr Empire',
    ticker: null,
    systemCount: 706,
  },
] as never;

const soon = new Date(
  Date.now() + 2 * 3_600_000 + 14 * 60_000 + 30_000,
).toISOString();
const campaigns = [
  {
    campaignId: 1,
    eventType: 'ihub_defense',
    solarSystemId: 30004759,
    solarSystemName: '1DQ1-A',
    regionName: 'Delve',
    defenderId: 99003581,
    defenderName: 'Fraternity.',
    defenderTicker: 'FRT',
    defenderScore: null,
    attackersScore: null,
    startTime: soon,
    updatedAt: new Date().toISOString(),
  },
] as never;

const handlers = () => ({
  onIsolate: vi.fn(),
  onFrameOwner: vi.fn(),
  onFocusSystem: vi.fn(),
  shareUrlFor: (id: number) =>
    `https://killreport.com/map?layer=sovereignty&focus=${id}`,
});

beforeEach(() => {
  changesSkipped = [];
});

describe('SovPanel', () => {
  // The page exists for fleet commanders; the timers are what they came for.
  it('opens on the timers', () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Timers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('1DQ1-A')).toBeInTheDocument();
    expect(screen.getByText(/2h 14m/)).toBeInTheDocument();
  });

  it('focuses the map on a timer’s system', async () => {
    const h = handlers();
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...h}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /1DQ1-A/ }));
    expect(h.onFocusSystem).toHaveBeenCalledWith(30004759);
  });

  it('copies a timer’s link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Copy link to 1DQ1-A' }),
    );

    expect(writeText).toHaveBeenCalledWith(
      'https://killreport.com/map?layer=sovereignty&focus=30004759',
    );
  });

  it('says so when there are no timers', () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={[] as never}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(screen.getByText('No active campaigns')).toBeInTheDocument();
  });

  it('says how old the timers are when the worker has stopped', () => {
    const stale = [
      { ...(campaigns as never[])[0], updatedAt: '2026-09-12T14:33:49.046Z' },
    ] as never;
    render(
      <SovPanel
        owners={owners}
        campaigns={stale}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(
      screen.getByText('Data as of 2026-09-12 14:33 EVE'),
    ).toBeInTheDocument();
  });

  it('lists owners by the systems they hold, faction included', async () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));

    const rows = screen.getAllByRole('button', { pressed: false });
    expect(rows[0]).toHaveTextContent('Amarr Empire');
    expect(rows[0]).toHaveTextContent('706');
  });

  it('isolates an owner, and lets go of it on a second press', async () => {
    const h = handlers();
    const { rerender } = render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...h}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
    await userEvent.click(
      screen.getByRole('button', { name: /Fraternity\./, pressed: false }),
    );
    expect(h.onIsolate).toHaveBeenLastCalledWith(99003581);

    rerender(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={99003581}
        {...h}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Fraternity\./, pressed: true }),
    );
    expect(h.onIsolate).toHaveBeenLastCalledWith(null);
  });

  it('frames an owner’s systems from its own button', async () => {
    const h = handlers();
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...h}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Show Fraternity. on the map' }),
    );
    expect(h.onFrameOwner).toHaveBeenCalledWith(99003581);
  });

  // Fetched the first time the tab opens, not before.
  it('fetches the changes only once their tab is opened', async () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(changesSkipped.at(-1)).toBe(true);

    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));

    expect(changesSkipped.at(-1)).toBe(false);
    const row = screen.getByRole('button', { name: /1DQ1-A/ });
    expect(within(row).getByText(/Old Holder/)).toBeInTheDocument();
    expect(within(row).getByText(/New Holder/)).toBeInTheDocument();
  });

  it('shows the owner crest from the corporation path for a faction', async () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
    expect(screen.getByAltText('Amarr Empire')).toHaveAttribute(
      'src',
      expect.stringContaining('/corporations/500003/'),
    );
  });
});
```

- [ ] **Step 2: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/SovPanel.spec.tsx`
Expected: FAIL — `./SovPanel` çözülemiyor.

- [ ] **Step 3: `SovPanel.tsx`'i yaz**

`SovLegend.tsx`'in disk ve arma işaretini (`CREST_PX`, `NEUTRAL`, `SOV_COLORS`) aynen taşı; okuyucu listede ve haritada aynı işareti görmeli.

```tsx
'use client';

import EveImage from '@/components/ui/EveImage';
import { MapOwnerKind, type MapSovereigntyQuery } from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import {
  countdownText,
  eventLabel,
  eveTimestamp,
  isLive,
  isStale,
  latestUpdate,
} from '@/utils/map/countdown';
import { SOV_COLORS, SOV_UNOWNED_TINT } from '@/utils/map/sovColors';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useCopyLink } from './useCopyLink';
import { useNow } from './useNow';
import type { SovCampaign } from './useSovCampaigns';
import { useSovChanges } from './useSovChanges';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

type Tab = 'timers' | 'owners' | 'changes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'timers', label: 'Timers' },
  { id: 'owners', label: 'Owners' },
  { id: 'changes', label: 'Changes' },
];

/** The neutral the canvas draws an owner the dictionary does not name. */
const NEUTRAL = `#${SOV_UNOWNED_TINT.toString(16).padStart(6, '0')}`;

/**
 * The crest's drawn size in the list, square, on a `size-5` (20 px) disc —
 * exactly the 1 px rim of owner colour the map's own disc shows.
 */
const CREST_PX = 18;

/** Below `sm` the panel starts folded: on a phone it would cover the map. */
function startsOpen(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 640px)').matches
    : true;
}

function OwnerMark({ owner }: { owner: Owner }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: SOV_COLORS[owner.ownerId] ?? NEUTRAL }}
    >
      {/* A faction's crest is served from the CORPORATION path; down the
          alliance path it answers 200 with the default emblem. */}
      <EveImage
        kind={owner.kind === MapOwnerKind.Alliance ? 'alliance' : 'corporation'}
        id={owner.ownerId}
        name={owner.name}
        size={CREST_PX}
      />
    </span>
  );
}

/**
 * The sovereignty layer's side panel: what a fleet commander came for — the
 * timers — then who holds what, then what changed hands.
 *
 * It replaces the owner legend, whose list is now the Owners tab: one owner
 * list on the map, not two. The tab is component state, not URL state — a
 * shared link carries the system and the owner, and which tab the sender had
 * open is a preference.
 */
export default function SovPanel({
  owners,
  campaigns,
  isolatedOwner,
  onIsolate,
  onFrameOwner,
  onFocusSystem,
  shareUrlFor,
}: {
  owners: readonly Owner[];
  campaigns: readonly SovCampaign[];
  isolatedOwner: number | null;
  onIsolate: (ownerId: number | null) => void;
  onFrameOwner: (ownerId: number) => void;
  onFocusSystem: (systemId: number) => void;
  shareUrlFor: (systemId: number) => string;
}) {
  const [open, setOpen] = useState(startsOpen);
  const [tab, setTab] = useState<Tab>('timers');
  // Latched: once the Changes tab has been opened its data stays, rather than
  // being skipped again — and refetched — on every return to it.
  const [changesWanted, setChangesWanted] = useState(false);

  const now = useNow(1_000, open && tab === 'timers' && campaigns.length > 0);
  const { copied, copy } = useCopyLink();
  const { changes } = useSovChanges(changesWanted);

  const byHoldings = useMemo(
    () => [...owners].sort((a, b) => b.systemCount - a.systemCount),
    [owners],
  );
  const latest = latestUpdate(campaigns);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === 'changes') setChangesWanted(true);
  };

  return (
    <div
      className={`float flex w-72 max-w-full flex-col text-xs ${
        open ? 'h-240 max-h-full min-h-0' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="button button-ghost button-sm button-block shrink-0 gap-x-2"
      >
        {open ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        <span className="flex-1 text-left">Sovereignty</span>
        <span className="tabular-nums">{campaigns.length} timers</span>
      </button>

      {open && (
        <>
          <div role="tablist" className="flex gap-1 px-3 pb-2 shrink-0">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => selectTab(id)}
                className="button button-secondary button-sm"
              >
                {label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            className="flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto px-3 pb-2"
          >
            {tab === 'timers' && (
              <>
                {isStale(latest, now) && latest && (
                  <p className="text-[11px] text-ink-faint">
                    Data as of {eveTimestamp(latest)}
                  </p>
                )}
                {campaigns.length === 0 ? (
                  <p className="text-ink-muted">No active campaigns</p>
                ) : (
                  campaigns.map((campaign) => {
                    const name =
                      campaign.solarSystemName ??
                      String(campaign.solarSystemId);
                    return (
                      <div
                        key={campaign.campaignId}
                        className="flex items-center gap-x-1"
                      >
                        <button
                          type="button"
                          onClick={() => onFocusSystem(campaign.solarSystemId)}
                          className="button button-ghost button-sm min-w-0 flex-1 flex-col items-stretch gap-y-0.5"
                        >
                          <span className="flex items-baseline justify-between gap-x-2">
                            <span className="truncate font-medium">{name}</span>
                            <span
                              className={`shrink-0 tabular-nums ${
                                isLive(campaign, now)
                                  ? 'text-danger'
                                  : 'text-accent'
                              }`}
                            >
                              {countdownText(campaign, now)}
                            </span>
                          </span>
                          <span className="truncate text-left text-ink-muted">
                            {campaign.regionName ?? '—'} ·{' '}
                            {campaign.defenderTicker ??
                              campaign.defenderName ??
                              '—'}{' '}
                            · {eventLabel(campaign.eventType)}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Copy link to ${name}`}
                          onClick={() =>
                            copy(
                              `timer:${campaign.campaignId}`,
                              shareUrlFor(campaign.solarSystemId),
                            )
                          }
                          className="button button-ghost button-sm shrink-0"
                        >
                          {copied === `timer:${campaign.campaignId}` ? (
                            'Copied'
                          ) : (
                            <LinkIcon className="size-4" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {tab === 'owners' &&
              byHoldings.map((owner) => {
                const pressed = isolatedOwner === owner.ownerId;
                return (
                  <div
                    key={owner.ownerId}
                    className="flex items-center gap-x-1"
                  >
                    <button
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => onIsolate(pressed ? null : owner.ownerId)}
                      className="button button-ghost button-sm min-w-0 flex-1 justify-start gap-x-2"
                    >
                      <OwnerMark owner={owner} />
                      <span className="flex-1 truncate text-left">
                        {owner.name}
                      </span>
                      <span className="tabular-nums text-ink-muted">
                        {owner.systemCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Show ${owner.name} on the map`}
                      onClick={() => onFrameOwner(owner.ownerId)}
                      className="button button-ghost button-sm shrink-0"
                    >
                      <ViewfinderCircleIcon className="size-4" />
                    </button>
                  </div>
                );
              })}

            {tab === 'changes' &&
              (changes.length === 0 ? (
                <p className="text-ink-muted">No recent changes</p>
              ) : (
                changes.map((change) => (
                  <button
                    key={change.id}
                    type="button"
                    onClick={() => onFocusSystem(change.solarSystemId)}
                    className="button button-ghost button-sm flex-col items-stretch gap-y-0.5"
                  >
                    <span className="flex items-baseline justify-between gap-x-2">
                      <span className="truncate font-medium">
                        {change.solarSystemName ?? change.solarSystemId}
                      </span>
                      <span className="shrink-0 text-ink-faint">
                        {formatTimeAgo(change.detectedAt, true)}
                      </span>
                    </span>
                    <span className="truncate text-left text-ink-muted">
                      {change.previousOwnerName ?? 'Unclaimed'} →{' '}
                      {change.newOwnerName ?? 'Unclaimed'}
                    </span>
                  </button>
                ))
              ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/SovPanel.spec.tsx`
Expected: PASS. "lists owners by the systems they hold" testindeki `getAllByRole('button', { pressed: false })` sıralı sahip satırlarını döndürür (sekme düğmeleri `aria-pressed` taşımaz); başarısız olursa önce bu varsayımı kontrol et.

- [ ] **Step 5: `UniverseMap`'te paneli bağla, legend'ı kaldır**

Importlarda `SovLegend` yerine `SovPanel`; `framingFor`'u `@/utils/map/framing`'den, `ownerCamera`'yı aynı yerden import et (`framingFor` zaten import edilmiş).

`useMapCamera` destructuring'ine ekle:

```ts
    onOwnerChange: setIsolatedOwner,
    jumpTo,
```

`pick` memo'sundan önce:

```ts
// A panel row's "go there": the camera and the popup in one write. A system
// the scene does not hold — a campaign seen from the POCHVEN map — still
// opens nothing worse than a popup with no camera move.
const focusSystem = useCallback(
  (systemId: number) => {
    const target = geometry
      ? framingFor(
          { kind: 'system', id: systemId },
          geometry.nodes,
          size.width,
          size.height,
        )
      : null;
    if (target) jumpTo(target, systemId);
    else setSelected(systemId);
  },
  [geometry, size.width, size.height, jumpTo, setSelected],
);

const frameOwner = useCallback(
  (ownerId: number) => {
    if (!geometry || !sovIndex) return;
    const target = ownerCamera(
      ownerId,
      sovIndex.ownerBySystem,
      geometry.nodes,
      size.width,
      size.height,
    );
    if (target) jumpTo(target);
  },
  [geometry, sovIndex, size.width, size.height, jumpTo],
);

const shareUrlFor = useCallback(
  (systemId: number) =>
    sharedMapUrl({
      origin: window.location.origin,
      scope,
      focus: systemId,
      layer: layerId,
      owner: isolatedOwner,
    }),
  [scope, layerId, isolatedOwner],
);
```

Bu üç `useCallback` erken `return`'lerden (`if (!webgl)`, `if (error)` ...) **önce** olmalı — hook kuralları.

Overlay'deki legend satırı:

```tsx
{
  layer.legend.kind === 'owners' && (
    <SovPanel
      owners={sovOwners}
      campaigns={campaigns}
      isolatedOwner={isolatedOwner}
      onIsolate={setIsolatedOwner}
      onFrameOwner={frameOwner}
      onFocusSystem={focusSystem}
      shareUrlFor={shareUrlFor}
    />
  );
}
```

Task 8'de popup için yazdığın `sharedMapUrl({...})` ifadesini `shareUrl={shareUrlFor(selectedNode.systemId)}` ile değiştir.

Overlay `div`'inin yorumundaki "legend" sözcüklerini "panel" yap; `data-map-overlay` aynen kalır.

- [ ] **Step 6: `SovLegend`'ı sil**

```bash
git rm frontend/src/components/UniverseMap/SovLegend.tsx frontend/src/components/UniverseMap/SovLegend.spec.tsx
grep -rn "SovLegend" frontend/src
```

Expected: `grep` yalnızca yorumlarda bir şey bulursa onları `SovPanel` yap; kod referansı kalmamalı.

`SystemPopup.tsx`'teki `CREST_PX` yorumunda "the legend" geçiyor — "the panel's owner list" yap.

- [ ] **Step 7: Testler, tipler, lint**

Run: `yarn workspace frontend vitest run src/components/UniverseMap src/utils/map && yarn workspace frontend typecheck && cd frontend && npx eslint src/components/UniverseMap`
Expected: PASS (`UniverseMap.spec`'in "scrolls the legend rather than zooming the map" testi `[data-map-overlay]`'e baktığı için değişmeden geçer); `tsc` 0; yeni lint sorunu yok.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/UniverseMap/SovPanel.tsx frontend/src/components/UniverseMap/SovPanel.spec.tsx frontend/src/components/UniverseMap/UniverseMap.tsx frontend/src/components/UniverseMap/SystemPopup.tsx
git commit -m "feat(map): replace the sovereignty legend with a timers, owners and changes panel"
```

---

### Task 10: `/sovereignty/map`'i emekliye ayır

**Files:**

- Modify: `frontend/src/app/sovereignty/map/page.tsx` (tamamı)
- Create: `frontend/src/app/sovereignty/map/page.spec.tsx`
- Modify: `frontend/src/app/sovereignty/page.tsx:87-93`
- Modify: `frontend/src/components/Header/navItems.ts:133-137`
- Delete: `frontend/src/components/Sovereignty/TerritoryMap.tsx`, `frontend/src/graphql/SovereigntyMap.graphql`
- Modify: `backend/src/schemas/Sovereignty.graphql` (`SovMapPoint`, `sovereigntyMapPoints`)
- Modify: `backend/src/resolvers/sovereignty/queries.ts` (`sovereigntyMapPoints` resolver'ı)
- Regenerate: backend ve frontend üretilmiş dosyaları

**Interfaces:**

- Consumes: `/map?layer=sovereignty` (Task 2'nin `parseLayer`'ı).
- Produces: `/sovereignty/map` → `/map?layer=sovereignty` (sunucu tarafı yönlendirme).

Menü linki `/sovereignty/map`'te kalıyor; gerekçe planın başındaki "bilinçli sapmalar"da.

- [ ] **Step 1: Başarısız testi yaz**

`frontend/src/app/sovereignty/map/page.spec.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

import SovereigntyMapPage from './page';

describe('/sovereignty/map', () => {
  // Old links and bookmarks keep working; the map they open is the one map.
  it('sends the reader to the universe map on its sovereignty layer', () => {
    SovereigntyMapPage();
    expect(redirect).toHaveBeenCalledWith('/map?layer=sovereignty');
  });
});
```

- [ ] **Step 2: Başarısızlığı gör**

Run: `yarn workspace frontend vitest run src/app/sovereignty/map/page.spec.tsx`
Expected: FAIL — bugünkü sayfa bir React bileşeni döndürüyor, `redirect` çağrılmıyor.

- [ ] **Step 3: Sayfayı yönlendirmeye çevir**

`frontend/src/app/sovereignty/map/page.tsx`, dosyanın tamamı:

```tsx
import { redirect } from 'next/navigation';

/**
 * The territory map was folded into the universe map's sovereignty layer:
 * one map, with the owners, the timers and the changes beside it. The route
 * stays so old links, bookmarks and the SOVEREIGNTY menu still arrive.
 */
export default function SovereigntyMapPage() {
  redirect('/map?layer=sovereignty');
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `yarn workspace frontend vitest run src/app/sovereignty/map/page.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Giriş noktaları**

`frontend/src/app/sovereignty/page.tsx`, `href="/sovereignty/map"` olan `Link`:

```tsx
<Link
  href="/map?layer=sovereignty"
  prefetch={false}
  className="button button-secondary button-sm"
>
  Map
</Link>
```

`frontend/src/components/Header/navItems.ts`, SOVEREIGNTY > MAP girdisi (href aynı kalır, açıklama değişir):

```ts
      {
        // Through the redirect rather than straight to /map: SOVEREIGNTY's
        // `match` would otherwise have to claim /map, and both menus would
        // light on every visit to the universe map.
        href: '/sovereignty/map',
        label: 'MAP',
        description: 'The universe map on its sovereignty layer, with timers',
      },
```

- [ ] **Step 6: ECharts haritasını ve sorgusunu sil**

```bash
git rm frontend/src/components/Sovereignty/TerritoryMap.tsx frontend/src/graphql/SovereigntyMap.graphql
grep -rn "TerritoryMap\|useSovereigntyMapQuery\|sovereigntyMapPoints" frontend/src --include='*.ts' --include='*.tsx' --include='*.graphql' | grep -v generated
```

Expected: boş.

- [ ] **Step 7: Backend'den `sovereigntyMapPoints`'i sil**

`backend/src/schemas/Sovereignty.graphql`: `SovMapPoint` tipini (üstündeki doc yorumuyla, satır ~186–199) ve `Query` içindeki `sovereigntyMapPoints: [SovMapPoint!]!` satırını (ve varsa üstündeki doc yorumunu) sil.

`backend/src/resolvers/sovereignty/queries.ts`: `sovereigntyMapPoints: async () => { ... },` girdisini tamamen sil (satır ~565'ten kapanan `},`'e kadar). Silindikten sonra `LIGHT_YEAR_M` gibi yalnızca orada kullanılan yardımcılar kalmışsa onları da sil — `npx eslint backend/src/resolvers/sovereignty/queries.ts` kullanılmayanları gösterir.

```bash
grep -rn "sovereigntyMapPoints\|SovMapPoint" backend/src --include='*.ts' --include='*.graphql' | grep -v generated
```

Expected: boş.

- [ ] **Step 8: Codegen, build, test**

Run:

```bash
yarn workspace backend codegen && yarn workspace backend build && \
yarn workspace frontend codegen && yarn workspace frontend typecheck && \
yarn workspace frontend vitest run src/components/Header src/app/sovereignty
```

Expected: hepsi 0; `navItems.spec.ts` dahil PASS.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src/app/sovereignty frontend/src/components/Header/navItems.ts backend/src/schemas/Sovereignty.graphql backend/src/resolvers/sovereignty/queries.ts
git commit -m "feat(sovereignty): fold the territory map into the universe map's sovereignty layer"
```

(`git rm` ile silinenler zaten stage'de. Üretilmiş dosyalar repoda izleniyorsa `git status`'a bakıp ekle.)

---

### Task 11: Tam doğrulama

**Files:** yok (yalnızca çalıştırma).

Bu iş CLAUDE.md'ye göre "ciddi" bir değişiklik — `.graphql` şeması, resolver, cache yapılandırması — yani tam set yerelde çalışır, ve `qa` agent'ına arka planda verilir.

- [ ] **Step 1: Tam seti `qa` agent'ına ver**

Agent'a verilecek görev:

> Run the full verification set from the repo root on branch `feat/universe-map-sov-panel` and report exact results: `yarn workspace backend codegen`, `yarn workspace frontend codegen`, `yarn test`, `yarn workspace backend build`, `yarn workspace frontend lint`, `yarn workspace frontend build:check` (not `build` — the dev server may be running), and `npx prettier --check` on every file changed against `main` (`git diff --name-only main...HEAD`). For lint, compare the problem count against `main` and list any problem in a file this branch touched. Confirm `git status` is clean before and after.

Expected: test, build ve codegen 0; lint sayısı `main` ile aynı ve dokunulan dosyalarda yeni sorun yok; prettier temiz.

- [ ] **Step 2: Veriyi doğrudan backend'den doğrula**

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2)
curl -s "http://localhost:${PORT}/graphql" -H 'content-type: application/json' \
  -d '{"query":"query MapSovCampaigns { sovereigntyActiveCampaigns(limit: 200) { campaignId solarSystemName startTime updatedAt } }"}' | head -c 600; echo
curl -s "http://localhost:${PORT}/graphql" -H 'content-type: application/json' \
  -d '{"query":"query MapSovChanges { recentTerritoryChanges(limit: 3) { solarSystemName previousOwnerName newOwnerName detectedAt } }"}' | head -c 600; echo
```

Expected: ikisi de veri döner, `errors` yok.

- [ ] **Step 3: Kullanıcıya bakılacak yerleri söyle**

Görsel doğrulama kullanıcıda. Yerel veri 2026-09-12'de kaldı; tüm timer'lar `LIVE` görünecek ve panelde "Data as of 2026-09-12 … EVE" notu çıkacak — beklenen bu. Bakılacaklar:

1. `/map?layer=sovereignty` — The Spire, Etherium Reach ve Perrigen Falls'ta kırmızı halkalar ve çipler; galaksi zoom'unda sığmayan çipler gizli, halkaları duruyor.
2. Bir çipe tıklamak popup'ı açıyor; popup'ta campaign satırı ve **Copy link**.
3. Panel → Owners → bir sahibe tıkla: diğerleri sönüyor, URL'de `owner=`; ikinci tıklama geri alıyor; çerçeve düğmesi sahibin sistemlerine gidiyor.
4. Panel → Timers → bir satıra tıkla: kamera gidiyor, popup açılıyor; zincir ikonu linki kopyalıyor.
5. Security'ye geçip geri dön: izolasyon kalkmış.
6. `/sovereignty/map` → `/map?layer=sovereignty`'ye yönleniyor.
