# Sürekli evren haritası, Faz 1 — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Üç sahnenin (New Eden, Pochven, Wormhole) düğümlerini ve gate
kenarlarını tek bir GraphQL sorgusuyla sunmak ve `/map` altında deck.gl
ortografik tuvalinde çizmek; kamera ve kapsam URL'de yaşasın, GPU'ya hiçbir
zaman ham galaktik koordinat gitmesin.

**Architecture:** Faz 1 yalnızca galaksi katmanını kuruyor — sistem içleri,
picking, popup ve analitik katmanlar sırasıyla faz 2, 3 ve 4. Backend tarafı
deponun dört okuma servisinin beşincisi: `redis.get` → `$queryRaw` →
`redis.setex`, sade `async function`, resolver yalnızca orkestrasyon. Frontend
tarafı üç saf util (orijin, kamera, renk) + iki katman kurucusu + tek bir
`"use client"` bileşeni; testler saf util'lere ve bileşenin karar verdiği
yerlere gidiyor, GPU'ya değil.

**Tech Stack:** TypeScript, GraphQL Yoga + `@graphql-tools` (şema `src/schemas/**/*.graphql`
glob'undan otomatik yükleniyor), Prisma `$queryRaw` (`@services/prisma`, 5
bağlantı), Redis (`@services/redis`), Next.js App Router + React 19,
deck.gl 9.4 (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`,
`@deck.gl/widgets`), Vitest 5.

**Spec:** [`../specs/2026-09-12-universe-map-design.md`](../specs/2026-09-12-universe-map-design.md)

---

## Global Constraints

Her task'ın gereklilikleri bu bölümü de kapsar.

- **Yarn, asla npm.** `yarn workspace backend test`, `yarn workspace frontend add …`.
- **Üretilmiş dosyalar elle düzenlenmez:** `backend/src/generated-types.ts`,
  `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
  Bu plan `.graphql` dosyaları ekliyor, yani **codegen gerekiyor** ve sırası
  sabit: önce `yarn workspace backend codegen`, sonra
  `yarn workspace frontend codegen`.
- **Migration yok.** Faz 1 tek bir tabloya yazmıyor, şemaya tek kolon
  eklemiyor. `prisma migrate dev` bu depoda beş tabloyu düşürür — hiçbir
  task'ta çalıştırılmıyor.
- **Branch bu plan yazılırken açıldı:** `feature/universe-map`. Spec'in iki
  commit'i (`c09ccb39`, `5d35f6a1`, `2451e4ea`) onun üzerinde.
- **Commit ve PR metinleri İngilizce**, `type(scope):` sonrası küçük harf.
- **Commit'lerde Claude atfı yok.** `Co-Authored-By: Claude` yok, "Generated
  with Claude Code" yok. Bu, harness varsayılanını geçersiz kılar.
- **Resolver ESI'ya gitmez, veritabanı sorgusu yazmaz.** Sorgu ve önbellek
  servis katmanında.
- **Resolver ve API `@services/prisma`** (5 bağlantı) kullanır, asla
  `@services/prisma-worker` (2 bağlantı, worker'lara ait).
- **Ham SQL'de eşlenmiş kolon adları.** `solar_systems.system_id`,
  `constellations.constellation_id`, `stargates.stargate_id`,
  `planets.planet_id` — `SELECT id FROM planets` `column "id" does not exist`
  ile patlar. Bu plan yazılırken tam olarak bu hataya düşüldü.
- **`numeric` dönen her ifade `::DOUBLE PRECISION` ile geri çevrilir.** Prisma
  `numeric`'i `Prisma.Decimal` olarak verir; `TRUNC(x::numeric, 2)` cast'siz
  bırakılırsa GraphQL `Float!` alanına Decimal nesnesi gider.
- **Her değişen dosya üzerinde `npx prettier --check`.** CI'ın Format adımı
  tüm repoyu kontrol ediyor; `.husky/pre-commit` yalnızca husky kurulu
  checkout'larda ateşliyor.
- **Frontend'de `build` yerine `typecheck`.** `yarn workspace frontend build`
  çalışan dev sunucusunun `.next` dizinini altından çeker; doğrulama
  `typecheck` + `lint` + `test`, gerçek bir build gerekirse
  `yarn workspace frontend build:check` (ayrı `NEXT_DIST_DIR`).
- **Görsel doğrulama kullanıcıda.** Tarayıcı sürülmüyor, ekran görüntüsü
  alınmıyor; task sonunda "şuna bak" denip duruluyor.

### Ölçülmüş sabitler (2026-09-13, üretim veritabanı)

Testlerin beklediği sayılar bunlar. Hepsi bu plan yazılırken `psql` ile
yeniden ölçüldü ve spec'le birebir uyuştu.

| Büyüklük                     |     NEW_EDEN |     POCHVEN |      WORMHOLE |
| ---------------------------- | -----------: | ----------: | ------------: |
| Düğüm (sahnedeki sistem)     |        5.241 |          27 |         2.604 |
| Kenar (tek yön, `from < to`) |        6.959 |          30 |             0 |
| Extent (ly)                  | 89,3 × 101,2 | 24,5 × 28,0 | 152,0 × 120,1 |

- Toplam 8.490 sistem, 13.978 stargate, **`destination_system_id` hiçbirinde
  null değil**, `position_x`/`position_z` hiçbirinde null değil,
  `security_status`, `name`, `constellation_id` hiçbirinde null değil — yani
  `MapNode`'un tüm alanları `!` olabilir.
- NEW_EDEN yükleminin geçit filtresi 5.458 sistemi 5.241'e indiriyor: 217
  geçitsiz Jove sistemi autofit'i bozuyor.
- Sistem yarıçapı (x/z düzleminde en uzak celestial): medyan **3,8809e12 m**,
  maks **3,0384e13 m**. NEW_EDEN'daki 5.241 sistemin **hepsinde** celestial
  var, yani `radius` hiçbir düğümde 0 değil.
- Payload, `mapGeometry(NEW_EDEN)` gövdesi: ham 1,28 MB, **gzip 197 KB**
  (düğümler 159 KB + kenarlar 39 KB). Bütçe ≤200 KB.
- Sorgu süreleri (soğuk önbellek, üretim veritabanı): düğümler **111–123 ms**,
  kenarlar **9 ms**. Günde bir kez, sahne başına.
- **Wormhole koordinatları New Eden'ınkinden bir büyüklük mertebesi büyük:**
  ham x 6,80e18–8,24e18, ham z −1,00e19–−8,91e18. K-space'te ham değer ~5e17.
  İki sonucu var. Birincisi, float64 ULP'si orada 1,5–2,2 km, yani 1e9
  ızgarasına yuvarlanmış bir değerin en yakın double'ı gerçek katmandan ~954 m
  uzakta durabiliyor — `x % 1e9` bunu yakalar ama bir kusur değildir; ızgaranın
  verdiği söz idempotenslik (`toGrid(toGrid(x)) === toGrid(x)`, her büyüklükte
  doğrulandı) ve `JSON.stringify`'ın dokuz sıfırla basması, yani sıkıştırma
  kazancı. İkincisi, GPU'ya giden şey ham değer değil: sahne merkezine göre
  yarı span 7,19e17 m, float32 adımı 4,29e10 m, WORMHOLE'un kendi
  `z₀ + 13`'ünde **0,28 px** — NEW_EDEN'ın 0,22 px'iyle aynı mertebede. Kayan
  orijinin kazandığı yer tam olarak burası.
- `securityStatus` **kesiliyor, yuvarlanmıyor**: `ROUND(security_status, 2)`
  gerçek değeri 0,495–0,5 arasında olan **14 sistemi** 0,50'ye taşıyor ve
  `frontend/src/utils/security.ts:11`'in `>= 0.5` eşiği onları highsec ilan
  ediyor. `TRUNC(security_status, 2)` her iki eşikte de sıfır kayma veriyor
  (ölçüldü: 0 ve 0). `security.ts:90` zaten tek ondalık gösteriyor.

### Kamera sayıları (1400 × 900 px tuval, NEW_EDEN)

Plan bunları **hesaplıyor, sabit yazmıyor** — aşağıdaki değerler testlerin
beklediği sonuçlar.

| Büyüklük                                               | Değer                                    |
| ------------------------------------------------------ | ---------------------------------------- |
| `spanX`                                                | 8,4527e17 m (89,3 ly)                    |
| `spanZ`                                                | 9,5731e17 m (101,2 ly)                   |
| `z₀` (dolgusuz fit)                                    | −49,92                                   |
| `fitZoom` çıktısı (FIT_PADDING 0,92)                   | −50,04                                   |
| Faz 1 zoom tavanı                                      | `z₀ + 13` (sistem içi faz 2'de açılıyor) |
| Faz 1 zoom tabanı                                      | `z₀ − 2`                                 |
| En büyük yerel koordinat                               | 4,7866e17 m (yarı span)                  |
| float32 adımı o büyüklükte                             | 2,853e10 m                               |
| Bu adımın `z₀`'da piksel karşılığı                     | 2,7e-5 px                                |
| Orijin uygulanmasa, ham koordinatın aynı yerdeki adımı | ~390 px (faz 2'nin dibinde)              |
| Bu adımın `z₀+13`'te karşılığı                         | **0,22 px**                              |

0,22 px, faz 1 tavanında orijin sahne merkezinde dururken kabul edilen
titremedir; faz 2 orijini odaklanılan sistemin merkezine taşıdığında aynı adım
0,019 px'e düşüyor (spec, _Koordinat sistemi ve hassasiyet_).

### Spec'ten ayrıldığımız iki yer

Her ikisi de plan yazılırken kodda ölçülen bir şey yüzünden.

| #   | Spec                                                      | Bu plan                                                                  | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Header`'a sabit yükseklik + `globals.css`'e `--header-h` | Dokunulmuyor; harita `main`'in kutusunu negatif margin'le geri alıyor    | `frontend/src/app/layout.tsx:23` gövdeyi `flex flex-col`, `globals.css:26` `html, body { height: 100% }` yapıyor — `main.flex-1` zaten kesin yükseklikte, `h-[calc(100%+4rem)]` tam olarak header ve footer'dan artan alanı veriyor. Header'ın yüksekliğini değiştirmek her sayfayı etkiler ve tarayıcıda ölçemem.                                                                                                                                                                                                                                              |
| 2   | Yeni bağımlılık `deck.gl`                                 | `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`, `@deck.gl/widgets` | Şemsiye paket 9.4.0, `@deck.gl/arcgis`, `@deck.gl/carto`, `@deck.gl/google-maps`, `@deck.gl/mapbox`, `@deck.gl/maplibre` ve `@deck.gl/geo-layers`'ı **gerçek bağımlılık** olarak çekiyor (`package.json`'ı indirilip kontrol edildi); bu harita hiçbirini kullanmıyor. Import biçimi iki yolda da çalışıyor — şemsiye `DeckGL`'i hem default hem isimli export ediyor (`dist/index.d.ts:8`) — yani tek ayırt edici node_modules ağırlığı. `widgets`, `@deck.gl/react`'in `peerDependenciesMeta`'sı olmayan peer'i; eklenmezse her `yarn install` uyarı basıyor. |

Ek olarak faz 1, spec'in faz 4'e bıraktığı **güvenlik renk rampasını** saf bir
fonksiyon olarak getiriyor (katman kaydını değil). Gerekçe: 5.241 tek renk nokta
gözle doğrulanamaz, ve rampa yeni bir tasarım kararı değil —
`backend/src/scripts/star-map-svg.ts:12-24`'te aynı 11 renk zaten üretimde.

---

## Dosya yapısı

| Dosya                                                          | Sorumluluk                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `backend/src/schemas/UniverseMap.graphql`                      | Faz 1 tipleri: `MapScope`, `MapNode`, `MapEdge`, `MapBounds`, `MapGeometry`, `Query.mapGeometry` |
| `backend/src/services/universe/universe-map.service.ts`        | `getMapGeometry(scope)` — Redis, `$queryRaw`, kapsam yüklemi, bounds                             |
| `backend/src/services/universe/universe-map.service.spec.ts`   | Önbellek anahtarı, kapsam yüklemi, kesme, bounds, Decimal tuzağı                                 |
| `backend/src/services/universe/index.ts`                       | Barrel; `solar-system/index.ts` ile aynı biçim                                                   |
| `backend/src/resolvers/universe-map/queries.ts`                | Tek satırlık orkestrasyon                                                                        |
| `backend/src/resolvers/universe-map/index.ts`                  | Barrel                                                                                           |
| `backend/src/resolvers/index.ts`                               | `...universeMapQueries` (değişiklik)                                                             |
| `backend/src/config/cache.ts`                                  | `'MapGeometry'` ve `'Query.mapGeometry'` kayıtları (değişiklik)                                  |
| `frontend/package.json`                                        | deck.gl bağımlılıkları (değişiklik)                                                              |
| `frontend/src/graphql/MapGeometry.graphql`                     | Tek sorgu dokümanı                                                                               |
| `frontend/src/utils/map/origin.ts` + `.spec.ts`                | Orijin seçimi, `nesne − orijin`, float32 bütçesi                                                 |
| `frontend/src/utils/map/camera.ts` + `.spec.ts`                | bounds → viewState fit, URL serileştirme, zoom sınırları                                         |
| `frontend/src/utils/map/colorScales.ts` + `.spec.ts`           | Güvenlik rampası; değer → RGBA                                                                   |
| `frontend/src/components/UniverseMap/layers/systems.ts` + spec | `ScatterplotLayer` props'u üreten saf fonksiyon                                                  |
| `frontend/src/components/UniverseMap/layers/edges.ts` + spec   | `LineLayer` props'u üreten saf fonksiyon                                                         |
| `frontend/src/components/UniverseMap/useMapCamera.ts`          | viewState ↔ URL; harici değişimi ayırt eden ref                                                  |
| `frontend/src/components/UniverseMap/UniverseMap.tsx` + spec   | Tuval, hata/boş/WebGL-yok durumları                                                              |
| `frontend/src/app/map/page.tsx` + `page.spec.tsx`              | `scope`'u her render'da URL'den türeten sayfa                                                    |
| `frontend/src/components/Header/Header.tsx`                    | UNIVERSE menüsüne MAP girişi, masaüstü + mobil (değişiklik)                                      |

---

## Task 1: Geometri servisi

Deponun beşinci okuma servisi ve sade `async function` biçiminde olanların
dördüncüsü (`alliance-stats`, `character-stats`, `corporation-stats` ile aynı
kalıp; `solar-system-stats`'ın `static` sınıfı taklit edilmiyor).

**Files:**

- Create: `backend/src/services/universe/universe-map.service.ts`
- Create: `backend/src/services/universe/universe-map.service.spec.ts`
- Create: `backend/src/services/universe/index.ts`

**Interfaces:**

- Consumes: `@services/prisma` (default export, 5 bağlantı), `@services/redis`
  (default export), `Prisma` (`@generated/prisma/client`) — `Prisma.sql`
  fragmanları için.
- Produces:
  ```ts
  export type MapScope = 'NEW_EDEN' | 'POCHVEN' | 'WORMHOLE';
  export interface MapNode {
    systemId: number;
    name: string;
    x: number;
    z: number;
    radius: number;
    securityStatus: number;
    constellationId: number;
    regionId: number;
  }
  export interface MapEdge {
    from: number;
    to: number;
  }
  export interface MapBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }
  export interface MapGeometry {
    scope: MapScope;
    nodes: MapNode[];
    edges: MapEdge[];
    bounds: MapBounds;
  }
  export const COORDINATE_GRID_METRES = 1e9;
  export function computeBounds(nodes: MapNode[]): MapBounds;
  export async function getMapGeometry(scope: MapScope): Promise<MapGeometry>;
  ```

### Bu task'ta iki karar ve ikisinin de gerekçesi

**Koordinat yuvarlaması JS'te, güvenlik kesmesi SQL'de.** Aynı yerde
olmamalarının sebebi kayan nokta:

- Koordinatlar: `Math.round(x / 1e9) * 1e9`. Zaten 1e9 m'ye yuvarlanıyor, yani
  double'ın 5e17 büyüklüğünde ~64 m'lik gösterim hatası ölçümün 15 milyonda
  biri; JS'te yapmak SQL bind parametresi tip çıkarımı sorununu tamamen
  ortadan kaldırıyor.
- Güvenlik: `TRUNC(security_status::numeric, 2)::DOUBLE PRECISION`. JS'te
  `Math.trunc(v * 100) / 100` **yanlış sonuç veriyor**: `0.29 * 100` IEEE-754'te
  `28.999999999999996`, yani 0,29 sessizce 0,28 olur. PostgreSQL `numeric`
  birebir ondalık, o yüzden kesme orada. `::DOUBLE PRECISION` cast'i şart —
  cast'siz bırakılırsa Prisma `numeric`'i `Prisma.Decimal` nesnesi olarak
  döndürür ve GraphQL `Float!` alanına nesne gider.

**`bounds` düğümlerden JS'te hesaplanıyor, üçüncü bir sorguyla değil.** Autofit
ile çizilen şey arasında hiçbir koşulda fark olamaması için: bounds, dönen
düğüm dizisinin kendisinden türüyor.

- [ ] **Step 1: Testi yaz (kırmızı)**

`backend/src/services/universe/universe-map.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The fifth read service. Redis get, $queryRaw, Redis setex — the same three
 * beats as the other four — plus the two things unique to this one: the scope
 * predicate, and the guarantee that every edge endpoint is also a node.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import {
  computeBounds,
  getMapGeometry,
  type MapNode,
} from './universe-map.service';

/** A node row as the query returns it: raw metres, security already truncated. */
function nodeRow(overrides: Record<string, unknown> = {}) {
  return {
    system_id: 30000142,
    name: 'Jita',
    x: -1.2955e17,
    z: 4.3236e16,
    radius: 3.8809e12,
    security_status: 0.94,
    constellation_id: 20000020,
    region_id: 10000002,
    ...overrides,
  };
}

/** The SQL of the nth $queryRaw call, whitespace collapsed. */
function querySql(call: number) {
  const [strings, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...{ strings?: string[] }[],
  ];
  // Prisma.sql fragments arrive as values; splice their own text back in so the
  // predicate is visible to the assertion.
  return strings
    .map((part, i) => part + (values[i]?.strings?.join('') ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

beforeEach(() => {
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('getMapGeometry', () => {
  it('serves a cache hit without touching the database', async () => {
    const cached = { scope: 'NEW_EDEN', nodes: [], edges: [], bounds: {} };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(getMapGeometry('NEW_EDEN')).resolves.toEqual(cached);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('keys the cache on the scope and caches for a day', async () => {
    await getMapGeometry('POCHVEN');

    expect(redis.get).toHaveBeenCalledWith('map:geometry:POCHVEN');
    expect(redis.setex).toHaveBeenCalledWith(
      'map:geometry:POCHVEN',
      86400,
      expect.any(String),
    );
  });

  it('gives each scope its own key', async () => {
    await getMapGeometry('WORMHOLE');
    expect(redis.get).toHaveBeenCalledWith('map:geometry:WORMHOLE');
  });

  it('excludes Pochven and gateless systems from NEW_EDEN', async () => {
    await getMapGeometry('NEW_EDEN');

    const sql = querySql(0);
    expect(sql).toContain('c.region_id BETWEEN 10000001 AND 10999999');
    expect(sql).toContain('c.region_id <> 10000070');
    expect(sql).toContain('EXISTS (SELECT 1 FROM stargates g');
  });

  it('keeps gateless systems in POCHVEN and WORMHOLE', async () => {
    await getMapGeometry('POCHVEN');
    expect(querySql(0)).toContain('c.region_id = 10000070');
    expect(querySql(0)).not.toContain('EXISTS (SELECT 1 FROM stargates g');

    prisma.$queryRaw.mockClear();
    await getMapGeometry('WORMHOLE');
    expect(querySql(0)).toContain('c.region_id BETWEEN 11000001 AND 11999999');
    expect(querySql(0)).not.toContain('EXISTS (SELECT 1 FROM stargates g');
  });

  it('uses the mapped primary key names, never bare id', async () => {
    await getMapGeometry('NEW_EDEN');
    const sql = querySql(0);
    expect(sql).toContain('s.system_id');
    expect(sql).toContain('c.constellation_id = s.constellation_id');
    expect(sql).not.toMatch(/\bs\.id\b/);
    expect(sql).not.toMatch(/\bc\.id\b/);
  });

  it('truncates security in SQL and casts it back to a float', async () => {
    await getMapGeometry('NEW_EDEN');
    expect(querySql(0)).toContain(
      'TRUNC(scoped.security_status::numeric, 2)::DOUBLE PRECISION',
    );
  });

  it('rounds node coordinates to the 1e9 m grid', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        nodeRow({
          x: 1_234_567_890_123,
          z: -987_654_321_987,
          radius: 1_500_000_001,
        }),
      ])
      .mockResolvedValueOnce([]);

    const { nodes } = await getMapGeometry('NEW_EDEN');

    expect(nodes[0].x).toBe(1_235_000_000_000);
    expect(nodes[0].z).toBe(-988_000_000_000);
    expect(nodes[0].radius).toBe(2_000_000_000);
  });

  it('maps snake_case columns to the camelCase node shape', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([nodeRow()])
      .mockResolvedValueOnce([]);

    const { nodes } = await getMapGeometry('NEW_EDEN');

    expect(nodes[0]).toEqual({
      systemId: 30000142,
      name: 'Jita',
      x: -129550000000000000,
      z: 43236000000000000,
      radius: 3881000000000,
      securityStatus: 0.94,
      constellationId: 20000020,
      regionId: 10000002,
    });
  });

  it('emits each gate pair once, from < to', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { a: 30000142, b: 30000144 },
      { a: 30000001, b: 30000142 },
    ]);

    const { edges } = await getMapGeometry('NEW_EDEN');

    expect(edges).toEqual([
      { from: 30000142, to: 30000144 },
      { from: 30000001, to: 30000142 },
    ]);
    expect(querySql(1)).toContain('SELECT DISTINCT');
    expect(querySql(1)).toContain(
      'LEAST(g.solar_system_id, g.destination_system_id)',
    );
  });

  it('restricts both edge endpoints with the same predicate as the nodes', async () => {
    await getMapGeometry('NEW_EDEN');
    const edgeSql = querySql(1);

    expect(edgeSql).toContain(
      'g.solar_system_id IN (SELECT system_id FROM scoped)',
    );
    expect(edgeSql).toContain(
      'g.destination_system_id IN (SELECT system_id FROM scoped)',
    );
    expect(edgeSql).toContain('c.region_id <> 10000070');
  });

  it('derives bounds from the nodes it returns', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        nodeRow({ system_id: 1, x: -2e17, z: 1e17 }),
        nodeRow({ system_id: 2, x: 3e17, z: -4e17 }),
      ])
      .mockResolvedValueOnce([]);

    const { bounds } = await getMapGeometry('NEW_EDEN');

    expect(bounds).toEqual({
      minX: -2e17,
      maxX: 3e17,
      minZ: -4e17,
      maxZ: 1e17,
    });
  });

  it('caches a JSON-serialisable body — no BigInt, no Decimal', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([nodeRow()])
      .mockResolvedValueOnce([{ a: 1, b: 2 }]);

    await getMapGeometry('NEW_EDEN');

    const [, , body] = redis.setex.mock.calls[0];
    expect(() => JSON.parse(body as string)).not.toThrow();
    expect(JSON.parse(body as string).scope).toBe('NEW_EDEN');
  });
});

describe('computeBounds', () => {
  const node = (x: number, z: number): MapNode => ({
    systemId: 1,
    name: 'x',
    x,
    z,
    radius: 0,
    securityStatus: 0,
    constellationId: 1,
    regionId: 1,
  });

  it('spans every node', () => {
    expect(computeBounds([node(-1, 5), node(7, -3), node(2, 2)])).toEqual({
      minX: -1,
      maxX: 7,
      minZ: -3,
      maxZ: 5,
    });
  });

  it('collapses to zero for an empty scene rather than ±Infinity', () => {
    expect(computeBounds([])).toEqual({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  });

  it('handles a single node without a zero-width span crash downstream', () => {
    expect(computeBounds([node(4, 4)])).toEqual({
      minX: 4,
      maxX: 4,
      minZ: 4,
      maxZ: 4,
    });
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

```bash
yarn workspace backend test src/services/universe/universe-map.service.spec.ts
```

Beklenen: `Failed to resolve import "./universe-map.service"`.

- [ ] **Step 3: Servisi yaz**

`backend/src/services/universe/universe-map.service.ts`:

```ts
/**
 * Universe map geometry.
 *
 * One scene per scope, and every number in metres. The service hands out
 * galactic coordinates; turning them into something a GPU can hold is the
 * frontend's floating-origin job (`frontend/src/utils/map/origin.ts`).
 *
 * Measured 2026-09-13 against production: NEW_EDEN 5.241 nodes / 6.959 edges
 * in 111-123 ms + 9 ms, POCHVEN 27 / 30, WORMHOLE 2.604 / 0. Behind a 24 hour
 * Redis key, so those queries run once a day per scope.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

export type MapScope = 'NEW_EDEN' | 'POCHVEN' | 'WORMHOLE';

export interface MapNode {
  systemId: number;
  name: string;
  /** Galactic metres, rounded to COORDINATE_GRID_METRES. */
  x: number;
  z: number;
  /** Distance to the farthest celestial in the x/z plane, metres. */
  radius: number;
  /** Truncated to two decimals; see the note in getMapGeometry. */
  securityStatus: number;
  constellationId: number;
  regionId: number;
}

export interface MapEdge {
  from: number;
  to: number;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapGeometry {
  scope: MapScope;
  nodes: MapNode[];
  edges: MapEdge[];
  bounds: MapBounds;
}

const CACHE_TTL_SECONDS = 86400;

/**
 * Coordinates are rounded to this grid before they leave the service. 1e9 m is
 * 1e-4 ly, far under one pixel at every zoom this scene reaches, and it is what
 * takes the NEW_EDEN body from 229 KB gzip to 159 KB.
 */
export const COORDINATE_GRID_METRES = 1e9;

/**
 * Region id bands, measured 2026-09-13:
 *
 *   10000001-10001004  k-space, 70 regions, 5.485 systems (Pochven = 10000070)
 *   11000001-11000033  wormhole, 33 regions, 2.604 systems
 *   12000001-12000005  abyssal, 200 systems, zero celestials
 *   14000001-14000005  proving, 200 systems, zero celestials
 *   19000001           GPMR-01, one gateless system (GPMS-01), zero celestials
 *
 * The last three get no scene and no enum member: there is nothing inside them
 * to draw, and a scope that returns an empty scene is a trap. They are written
 * down here so the next reader does not have to measure them again.
 */
function scopePredicate(scope: MapScope): Prisma.Sql {
  switch (scope) {
    case 'NEW_EDEN':
      // Zarzakh (30000000+ id 30100000, region 10001000 Yasna Zakh) falls
      // inside this band and its four gates reach k-space, so it belongs here.
      // Pochven is cut out because it is a closed component - all 30 of its
      // edges are internal, so dropped into this scene its 27 systems would
      // land mid-cloud connected to nothing.
      return Prisma.sql`c.region_id BETWEEN 10000001 AND 10999999 AND c.region_id <> 10000070`;
    case 'POCHVEN':
      return Prisma.sql`c.region_id = 10000070`;
    case 'WORMHOLE':
      return Prisma.sql`c.region_id BETWEEN 11000001 AND 11999999`;
  }
}

/**
 * NEW_EDEN drops gateless systems - 217 Jove systems that sit far outside the
 * cloud and stretch the autofit. The other two scenes keep everything: wormhole
 * systems have no gates at all, so the same filter would empty the scene.
 */
function gatelessFilter(scope: MapScope): Prisma.Sql {
  return scope === 'NEW_EDEN'
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM stargates g WHERE g.solar_system_id = s.system_id)`
    : Prisma.sql``;
}

interface NodeRow {
  system_id: number;
  name: string;
  x: number;
  z: number;
  radius: number;
  security_status: number;
  constellation_id: number;
  region_id: number;
}

interface EdgeRow {
  a: number;
  b: number;
}

function toGrid(value: number): number {
  return Math.round(value / COORDINATE_GRID_METRES) * COORDINATE_GRID_METRES;
}

/**
 * Bounds come from the nodes themselves rather than a third query, so the
 * camera's autofit and the thing actually drawn can never disagree. An empty
 * scene collapses to zero instead of ±Infinity; the camera treats a zero span
 * as "use the default zoom".
 */
export function computeBounds(nodes: MapNode[]): MapBounds {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }

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

export async function getMapGeometry(scope: MapScope): Promise<MapGeometry> {
  const cacheKey = `map:geometry:${scope}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const predicate = scopePredicate(scope);
  const gateless = gatelessFilter(scope);

  // Security is truncated in SQL rather than in JS because numeric is exact
  // decimal: Math.trunc(0.29 * 100) / 100 is 0.28, since 0.29 * 100 is
  // 28.999999999999996 in IEEE-754. The ::DOUBLE PRECISION cast is not
  // decoration - without it Prisma hands back a Prisma.Decimal object and the
  // GraphQL Float! field receives an object.
  //
  // Rounding two decimals instead of truncating would move 14 systems whose
  // true security is between 0.495 and 0.5 up to 0.50, and the frontend's
  // >= 0.5 threshold would call them highsec.
  const nodeRowsPromise = prisma.$queryRaw<NodeRow[]>`
    WITH scoped AS (
      SELECT s.system_id, s.name, s.position_x, s.position_z,
             s.security_status, s.constellation_id, c.region_id
      FROM solar_systems s
      JOIN constellations c ON c.constellation_id = s.constellation_id
      WHERE ${predicate} ${gateless}
        AND s.position_x IS NOT NULL
        AND s.position_z IS NOT NULL
    ),
    celestial AS (
      SELECT solar_system_id, position_x AS x, position_z AS z
      FROM planets WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM moons WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM asteroid_belts WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM stations WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM stargates WHERE solar_system_id IN (SELECT system_id FROM scoped)
    ),
    extent AS (
      SELECT solar_system_id, MAX(SQRT(x * x + z * z)) AS radius
      FROM celestial
      WHERE x IS NOT NULL AND z IS NOT NULL
      GROUP BY solar_system_id
    )
    SELECT
      scoped.system_id,
      scoped.name,
      scoped.position_x AS x,
      scoped.position_z AS z,
      COALESCE(extent.radius, 0) AS radius,
      TRUNC(scoped.security_status::numeric, 2)::DOUBLE PRECISION AS security_status,
      scoped.constellation_id,
      scoped.region_id
    FROM scoped
    LEFT JOIN extent ON extent.solar_system_id = scoped.system_id
    ORDER BY scoped.system_id
  `;

  // The same predicate, so an edge can never name a system the node list
  // dropped. LEAST/GREATEST + DISTINCT is what makes each pair appear once
  // with from < to: the stargates table holds both directions.
  const edgeRowsPromise = prisma.$queryRaw<EdgeRow[]>`
    WITH scoped AS (
      SELECT s.system_id
      FROM solar_systems s
      JOIN constellations c ON c.constellation_id = s.constellation_id
      WHERE ${predicate} ${gateless}
        AND s.position_x IS NOT NULL
        AND s.position_z IS NOT NULL
    )
    SELECT DISTINCT
      LEAST(g.solar_system_id, g.destination_system_id) AS a,
      GREATEST(g.solar_system_id, g.destination_system_id) AS b
    FROM stargates g
    WHERE g.solar_system_id IN (SELECT system_id FROM scoped)
      AND g.destination_system_id IN (SELECT system_id FROM scoped)
    ORDER BY a, b
  `;

  const [nodeRows, edgeRows] = await Promise.all([
    nodeRowsPromise,
    edgeRowsPromise,
  ]);

  const nodes: MapNode[] = nodeRows.map((row) => ({
    systemId: row.system_id,
    name: row.name,
    x: toGrid(row.x),
    z: toGrid(row.z),
    radius: toGrid(row.radius),
    securityStatus: row.security_status,
    constellationId: row.constellation_id,
    regionId: row.region_id,
  }));

  const result: MapGeometry = {
    scope,
    nodes,
    edges: edgeRows.map((row) => ({ from: row.a, to: row.b })),
    bounds: computeBounds(nodes),
  };

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
  return result;
}
```

- [ ] **Step 4: Barrel'ı yaz**

`backend/src/services/universe/index.ts` — `solar-system/index.ts` ile aynı biçim:

```ts
export * from './universe-map.service';
export { UniverseService } from './universe.service';
```

- [ ] **Step 5: Testi çalıştır, yeşil olduğunu gör**

```bash
yarn workspace backend test src/services/universe/universe-map.service.spec.ts
```

Beklenen: PASS, 16 test.

- [ ] **Step 6: Gerçek veritabanına karşı doğrula**

Bu, planın en önemli tek adımı: yukarıdaki testler mock'lanmış, sayıların
doğruluğunu göstermiyor. Servisi `tsx` ile bir kez çalıştırıp üç sahnenin
ölçülen sayılarını gör.

```bash
cd backend && npx tsx -e "
import { getMapGeometry } from './src/services/universe/universe-map.service';
(async () => {
  for (const scope of ['NEW_EDEN', 'POCHVEN', 'WORMHOLE'] as const) {
    const g = await getMapGeometry(scope);
    const ids = new Set(g.nodes.map((n) => n.systemId));
    const orphans = g.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to));
    const unordered = g.edges.filter((e) => e.from >= e.to);
    // Idempotence, not `% 1e9`. WORMHOLE's raw coordinates are ~7e18-1e19 m,
    // where one float64 ULP is 1.5-2.2 km, so the nearest double to an exact
    // multiple of 1e9 can sit ~954 m off it and `%` reports that offset. The
    // grid's actual promise is that re-applying it changes nothing, and that
    // JSON still serialises nine trailing zeros - which is what it is for.
    const toGrid = (v: number) => Math.round(v / 1e9) * 1e9;
    const offGrid = g.nodes.filter(
      (n) => toGrid(n.x) !== n.x || toGrid(n.z) !== n.z,
    );
    const notNineZeros = g.nodes.filter(
      (n) => !/0{9}$/.test(String(n.x)) || !/0{9}$/.test(String(n.z)),
    );
    const body = JSON.stringify(g);
    console.log(scope, {
      nodes: g.nodes.length,
      edges: g.edges.length,
      orphanEdges: orphans.length,
      unorderedEdges: unordered.length,
      offGridNodes: offGrid.length,
      notNineZeros: notNineZeros.length,
      rawKb: Math.round(body.length / 1024),
      bounds: g.bounds,
    });
  }
  process.exit(0);
})();
"
```

`npx tsx -e`, `backend/tsconfig.json`'ın `@services/*` alias'ını çözüyor — bu
plan yazılırken denendi, ayrı bir script dosyası gerekmiyor.

Beklenen, birebir:

| scope    | nodes | edges | orphanEdges | unorderedEdges | offGridNodes | notNineZeros |
| -------- | ----: | ----: | ----------: | -------------: | -----------: | -----------: |
| NEW_EDEN |  5241 |  6959 |           0 |              0 |            0 |            0 |
| POCHVEN  |    27 |    30 |           0 |              0 |            0 |            0 |
| WORMHOLE |  2604 |     0 |           0 |              0 |            0 |            0 |

İkinci çalıştırmada aynı çıktının gelmesi önbelleğin çalıştığını gösterir.
Herhangi bir sayı tutmuyorsa dur ve sor — ölçümler 2026-09-13'e ait, veri
değiştiyse spec'in tabloları da güncellenmeli.

- [ ] **Step 7: Prettier ve commit**

```bash
npx prettier --check backend/src/services/universe/*.ts
git add backend/src/services/universe/
git commit -m "feat(backend): add the universe map geometry service"
```

---

## Task 2: Şema, resolver ve response cache kaydı

**Files:**

- Create: `backend/src/schemas/UniverseMap.graphql`
- Create: `backend/src/resolvers/universe-map/queries.ts`
- Create: `backend/src/resolvers/universe-map/index.ts`
- Modify: `backend/src/resolvers/index.ts`
- Modify: `backend/src/config/cache.ts:36` (liste) ve `:80` (TTL tablosu)
- Regenerate: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`

**Interfaces:**

- Consumes: Task 1'in `getMapGeometry` ve `MapScope`'u.
- Produces: `universeMapQueries` (`QueryResolvers`), ve frontend codegen'in
  okuyacağı `Query.mapGeometry` alanı.

Şema dosyası `src/schemas/**/*.graphql` glob'una düştüğü an hem codegen hem
`server.ts:37`'deki `loadFilesSync` onu alıyor — kayıt edilecek başka bir yer
yok.

- [ ] **Step 1: Şemayı yaz**

`backend/src/schemas/UniverseMap.graphql`:

```graphql
# Faz 1: galaksi katmanı. mapCelestials, mapActivity ve mapSovereignty
# sırasıyla faz 2 ve faz 4'te bu dosyaya ekleniyor.
#
# Tüm koordinatlar METRE. Işık yılına çeviri yalnızca gösterim kenarında
# (ölçek çubuğu) yapılıyor; ara birim yok.

"Çizilebilir bir sahne. Abyssal, Proving ve GPMR-01 burada yok: içlerinde sıfır gezegen, ay ve istasyon var."
enum MapScope {
  NEW_EDEN
  POCHVEN
  WORMHOLE
}

"Bir sistem, galaktik konumunda. Koordinatlar 1e9 m'ye yuvarlanmış ve asla ham GPU'ya gitmez."
type MapNode {
  systemId: Int!
  name: String!
  x: Float!
  z: Float!
  "x/z düzlemindeki en uzak celestial'a mesafe, metre. Nokta bu yarıçapta diske dönüşüyor."
  radius: Float!
  "İki ondalığa KESİLMİŞ, yuvarlanmamış: yuvarlama 14 sistemi highsec'e taşıyor."
  securityStatus: Float!
  constellationId: Int!
  regionId: Int!
}

"Bir geçit çifti. Her çift bir kez, from < to."
type MapEdge {
  from: Int!
  to: Int!
}

"Sahnedeki düğümlerin sınırları, metre. Kameranın autofit'i buradan geliyor."
type MapBounds {
  minX: Float!
  maxX: Float!
  minZ: Float!
  maxZ: Float!
}

type MapGeometry {
  scope: MapScope!
  nodes: [MapNode!]!
  edges: [MapEdge!]!
  bounds: MapBounds!
}

extend type Query {
  "Statik evren verisi; Redis'te 86400 s, response cache'te STATIC_GAME_DATA."
  mapGeometry(scope: MapScope! = NEW_EDEN): MapGeometry!
}
```

- [ ] **Step 2: Backend codegen'i çalıştır**

```bash
yarn workspace backend codegen
```

Beklenen: `src/generated-types.ts` ve `src/generated-schema.graphql`
güncellendi, `MapScope` enum'u ve `MapGeometry` tipi içeride.

```bash
grep -n "MapScope\|MapGeometry\|mapGeometry" backend/src/generated-types.ts | head
```

- [ ] **Step 3: Resolver'ı yaz**

`backend/src/resolvers/universe-map/queries.ts`:

```ts
import { QueryResolvers } from '@generated-types';
import { getMapGeometry } from '@services/universe';

/**
 * UniverseMap Query Resolvers
 *
 * Orchestration only; the query, the scope predicate and the cache all live in
 * the service.
 *
 * `scope` is echoed back deliberately. TypeScript's string enums are nominal in
 * one direction only: the generated `MapScope` enum value goes into the
 * service's `'NEW_EDEN' | 'POCHVEN' | 'WORMHOLE'` union without a cast, but the
 * union coming back out is not assignable to the enum-typed
 * `MapGeometry.scope` field. Spreading the result and overriding `scope` with
 * the argument we were handed costs nothing at runtime — it is the same string
 * — and keeps a cast out of the resolver.
 */
export const universeMapQueries: QueryResolvers = {
  mapGeometry: async (_, { scope }) => {
    const geometry = await getMapGeometry(scope);
    return { ...geometry, scope };
  },
};
```

`backend/src/resolvers/universe-map/index.ts`:

```ts
export { universeMapQueries } from './queries';
```

- [ ] **Step 4: `resolvers/index.ts`'e bağla**

İki satır. Import bloğu alfabetik sırada `./user`'dan önce:

```ts
import { universeMapQueries } from './universe-map';
```

ve `Query` spread listesinin sonuna, `...leaderboardQueries`'in ardına:

```ts
    ...universeMapQueries,
```

- [ ] **Step 5: Response cache'e kaydet**

`backend/src/config/cache.ts`, `PUBLIC_CACHE_QUERIES` dizisinin sonuna, `// Detail page queries` bloğundan sonra:

```ts
  // Universe map — static geometry, same body for every visitor
  'MapGeometry',
```

ve `TTL_PER_SCHEMA_COORDINATE`'in `// Geo queries` bloğunun sonuna:

```ts
  'Query.mapGeometry': CACHE_TTL.STATIC_GAME_DATA,
```

Bu iki satır olmadan sorgu 120 s'lik `DEFAULT_PUBLIC`'e ve token başına
session anahtarına düşer — statik evren verisi için ikisi de yanlış. Frontend
dokümanının operasyon adı bu yüzden **`MapGeometry`** olmak zorunda
(`PUBLIC_CACHE_QUERIES` operasyon adına bakıyor, alan adına değil).

- [ ] **Step 6: Derle**

```bash
yarn workspace backend build
```

Beklenen: hatasız çıkış.

- [ ] **Step 7: Canlı sorguyla doğrula**

Port sabit değil: `backend/.env`'deki `PORT`'u `src/config/config.ts` okuyor ve
`yarn kill` aynı satıra bakıyor. Bu checkout'ta 4010. Aşağıdaki komutlar onu
`.env`'den türetiyor — iki numaradan birini elle yazmak yanlış checkout'u vurur.

```bash
yarn dev:backend   # ayrı bir terminalde
PORT=$(grep -m1 '^PORT=' backend/.env | cut -d= -f2)
```

Şemanın yüklenmesi için sunucunun **yeniden başlaması** şart: `loadFilesSync`
yalnızca açılışta çalışıyor ve nodemon `src/**/*.ts` izliyor, `.graphql`
değişikliği tek başına onu tetiklemiyor.

```bash
curl -s http://localhost:$PORT/graphql \
  -H 'Content-Type: application/json' \
  -d '{"operationName":"MapGeometry","query":"query MapGeometry($scope: MapScope!) { mapGeometry(scope: $scope) { scope bounds { minX maxX minZ maxZ } nodes { systemId name x z radius securityStatus } edges { from to } } }","variables":{"scope":"NEW_EDEN"}}' \
  | python3 -c "
import json,sys
d = json.load(sys.stdin)
if 'errors' in d: print(d['errors']); sys.exit(1)
g = d['data']['mapGeometry']
print('nodes', len(g['nodes']), 'edges', len(g['edges']))
print('bounds', g['bounds'])
sec = {type(n['securityStatus']).__name__ for n in g['nodes']}
print('securityStatus types', sec)
assert sec <= {'int', 'float'}, 'securityStatus is not a JSON number'
print('max decimals', max(len(str(n['securityStatus']).split('.')[-1]) for n in g['nodes']))
"
```

Beklenen: `nodes 5241 edges 6959`, `securityStatus types` yalnızca `int` ve/veya
`float` içeriyor, ve `max decimals` en fazla 2.

`{'int', 'float'}` gelmesi normaldir ve bir kusur değil: kesme sonucu tam sayı
çıkan sistemler (nullsec'in büyük kısmı) JSON'a `0` olarak yazılıyor ve Python
onu `int` okuyor. Yakalanacak şey `str` veya `dict`: `::DOUBLE PRECISION`
cast'i düşerse `numeric` Prisma'dan `Prisma.Decimal` olarak gelir ve alan
sayı olmaktan çıkar. Assert tam olarak bunu kontrol ediyor.

Gövdenin gzip boyutu. Dev sunucusu sıkıştırma uygulamıyor — `Accept-Encoding:
gzip` göndermek `Content-Encoding` geri getirmiyor, yani ham yanıtı saymak
bütçeyi ölçmez. Gövdeyi kaydedip kendimiz sıkıştırıyoruz:

```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"operationName":"MapGeometry","query":"query MapGeometry { mapGeometry(scope: NEW_EDEN) { scope bounds { minX maxX minZ maxZ } nodes { systemId name x z radius securityStatus constellationId regionId } edges { from to } } }"}' \
  "http://localhost:$PORT/graphql" -o /tmp/map-body.json
echo -n "raw   "; wc -c < /tmp/map-body.json
echo -n "gzip-6 "; gzip -6 -c /tmp/map-body.json | wc -c
echo -n "gzip-9 "; gzip -9 -c /tmp/map-body.json | wc -c
```

Beklenen: ≤200 KB. 2026-09-13 ölçümü **175 KB** (seviye 9) / **185 KB**
(seviye 6) — spec'in 197 KB'si düğümleri ve kenarları iki ayrı JSON belgesi
olarak sıkıştırmıştı, tek gövde daha iyi sıkışıyor. Bütçeyi aşarsa dur ve sor.

- [ ] **Step 8: Prettier ve commit**

```bash
npx prettier --check backend/src/schemas/UniverseMap.graphql backend/src/resolvers/universe-map/*.ts backend/src/resolvers/index.ts backend/src/config/cache.ts
git add backend/src/schemas/UniverseMap.graphql backend/src/resolvers/ backend/src/config/cache.ts backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(backend): expose the map geometry query for three scenes"
```

---

## Task 3: deck.gl bağımlılığı, sorgu dokümanı ve codegen

Küçük bir task, ama sonraki her şeyin kapısı: üretilen tipler olmadan ne
util'ler ne bileşen yazılabiliyor.

**Files:**

- Modify: `frontend/package.json`
- Create: `frontend/src/graphql/MapGeometry.graphql`
- Regenerate: `frontend/src/generated/graphql.ts`

**Interfaces:**

- Consumes: Task 2'nin `backend/src/generated-schema.graphql`'ı — frontend
  codegen onu okuyor (`frontend/codegen.ts:4`), yani **backend codegen'i önce
  çalışmış olmak zorunda**.
- Produces: `useMapGeometryQuery`, ve şema tipleri `MapNode`, `MapEdge`,
  `MapBounds`, `MapGeometry`, `MapScope` (enum: `MapScope.NewEden`,
  `MapScope.Pochven`, `MapScope.Wormhole` — codegen `ALL_TIME`'ı `AllTime`
  yaptığı için üye adları böyle).

### Neden şemsiye `deck.gl` değil de scoped paketler

Şemsiye paket `@deck.gl/arcgis`, `@deck.gl/carto`, `@deck.gl/google-maps`,
`@deck.gl/mapbox`, `@deck.gl/maplibre` ve `@deck.gl/geo-layers`'ı **gerçek
bağımlılık** olarak çekiyor (9.4.0 `package.json`'ı kontrol edildi); bu harita
hiçbirini kullanmıyor. Import biçimi ikisinde de çalışıyor — şemsiye
`DeckGL`'i hem default hem isimli export ediyor — o yüzden tek ayırt edici
node_modules ağırlığı.

`@deck.gl/widgets`, `@deck.gl/react`'in `peerDependenciesMeta`'sı olmayan bir
peer'i; eklenmezse `yarn install` her seferinde eksik peer uyarısı basıyor.
Import edilmiyor, sadece peer'i susturuyor.

**Üç peer uyarısı kalıyor ve kalması doğru.** `@deck.gl/layers`,
`@loaders.gl/core`, `@luma.gl/core` ve `@luma.gl/engine`'i workspace'ten
istiyor; Yarn bunları YN0002 olarak bildiriyor. Kapatmak için üç paketi
`frontend/package.json`'a yazmak gerekir — hiçbiri import edilmediği halde, ve
her deck.gl yükseltmesinde sürümleri elle eşlenmek zorunda. Bırakmanın bedeli
yok: `.yarnrc.yml` `nodeLinker: node-modules` diyor, üçü de
`@deck.gl/core`'un gerçek bağımlılığı olarak `node_modules/` köküne hoist
ediliyor ve `require.resolve` frontend'den üçünü de buluyor (denendi).
Depo bu sınıf uyarıyı zaten taşıyor: `backend` → `@envelop/core`, bu dal
açılmadan önce de vardı. Uniformity.

- [ ] **Step 1: Bağımlılıkları ekle**

```bash
yarn workspace frontend add @deck.gl/core@~9.4.0 @deck.gl/layers@~9.4.0 @deck.gl/react@~9.4.0 @deck.gl/widgets@~9.4.0
```

- [ ] **Step 2: Peer uyarılarının tam olarak beklenenler olduğunu doğrula**

Uyarı **olmaması** bu deponun baseline'ı değil: `backend` → `@envelop/core`
uyarısı bu dal açılmadan önce de vardı.

```bash
yarn install 2>&1 | grep "YN0002"
```

Beklenen, tam olarak dört satır — biri önceden var olan backend uyarısı, üçü
`@deck.gl/layers`'ın istediği paketler:

```text
backend@workspace:backend doesn't provide @envelop/core ..., requested by @envelop/response-cache.
frontend@workspace:frontend doesn't provide @loaders.gl/core ..., requested by @deck.gl/layers.
frontend@workspace:frontend doesn't provide @luma.gl/core ..., requested by @deck.gl/layers and other dependencies.
frontend@workspace:frontend doesn't provide @luma.gl/engine ..., requested by @deck.gl/layers.
```

Üçünün de gerçekten çözüldüğünü doğrula — uyarının zararsız olduğunu gösteren
şey bu:

```bash
cd frontend && node -e "
for (const p of ['@luma.gl/core','@loaders.gl/core','@luma.gl/engine']) {
  console.log(p, '->', require.resolve(p));
}" && cd ..
```

Beklenen: üçü de `node_modules/` altında çözülüyor. Çözülmeyen varsa dur ve
sor. Bu listenin dışında bir YN0002 çıkarsa da dur ve sor.

- [ ] **Step 3: Sorgu dokümanını yaz**

`frontend/src/graphql/MapGeometry.graphql`:

```graphql
# Operasyon adı MapGeometry olmak zorunda: backend'in response cache'i
# PUBLIC_CACHE_QUERIES'e operasyon adıyla bakıyor (backend/src/config/cache.ts).
# Adı değiştirmek önbelleği sessizce token başına 120 s'ye düşürür.
query MapGeometry($scope: MapScope!) {
  mapGeometry(scope: $scope) {
    scope
    bounds {
      minX
      maxX
      minZ
      maxZ
    }
    nodes {
      systemId
      name
      x
      z
      radius
      securityStatus
      constellationId
      regionId
    }
    edges {
      from
      to
    }
  }
}
```

- [ ] **Step 4: Codegen'i sırasıyla çalıştır**

```bash
yarn workspace backend codegen && yarn workspace frontend codegen
```

- [ ] **Step 5: Üretilen tiplerin geldiğini doğrula**

```bash
grep -n "export enum MapScope" -A 5 frontend/src/generated/graphql.ts
grep -n "useMapGeometryQuery" frontend/src/generated/graphql.ts | head -3
```

Beklenen: enum üyeleri `NewEden = 'NEW_EDEN'`, `Pochven = 'POCHVEN'`,
`Wormhole = 'WORMHOLE'`; `useMapGeometryQuery` tanımlı.

- [ ] **Step 6: Typecheck ve commit**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/graphql/MapGeometry.graphql frontend/package.json
git add frontend/package.json frontend/src/graphql/MapGeometry.graphql frontend/src/generated/graphql.ts yarn.lock
git commit -m "feat(frontend): add deck.gl and the map geometry document"
```

---

## Task 4: Saf util'ler — orijin, kamera, renk

Üç dosya, üç saf sorumluluk, hiçbiri React veya deck.gl import etmiyor. Faz
1'in tüm aritmetiği burada ve tamamı test edilebiliyor.

**Files:**

- Create: `frontend/src/utils/map/origin.ts` + `origin.spec.ts`
- Create: `frontend/src/utils/map/camera.ts` + `camera.spec.ts`
- Create: `frontend/src/utils/map/colorScales.ts` + `colorScales.spec.ts`

**Interfaces:**

- Consumes: `MapBounds`, `MapNode`, `MapScope` (`@/generated/graphql`).
- Produces:

  ```ts
  // origin.ts
  export interface MapOrigin {
    x: number;
    z: number;
  }
  export const FLOAT32_RELATIVE_STEP: number; // 2 ** -24
  export function boundsCenter(bounds: MapBounds): MapOrigin;
  export function toLocal(
    origin: MapOrigin,
    x: number,
    z: number,
  ): [number, number];
  export function nodePosition(
    origin: MapOrigin,
  ): (node: Pick<MapNode, 'x' | 'z'>) => [number, number];
  export function maxLocalMagnitude(
    origin: MapOrigin,
    nodes: Pick<MapNode, 'x' | 'z'>[],
  ): number;
  export function float32StepMetres(magnitude: number): number;
  export function float32StepPixels(magnitude: number, zoom: number): number;

  // camera.ts
  export interface MapCamera {
    x: number;
    z: number;
    zoom: number;
  }
  export const MAP_SCOPES: readonly MapScope[];
  export const DEFAULT_SCOPE: MapScope;
  export const FIT_PADDING: number; // 0.92
  export const ZOOM_ABOVE_FIT: number; // 13
  export const ZOOM_BELOW_FIT: number; // 2
  export const FALLBACK_FIT_ZOOM: number; // -49.92
  export const CAMERA_GRID_METRES: number; // 1e9
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
  export function cameraQuery(scope: MapScope, camera: MapCamera): string;

  // colorScales.ts
  export const SECURITY_RAMP: readonly string[]; // 11 entries
  export type Rgba = [number, number, number, number];
  export function hexToRgba(hex: string, alpha?: number): Rgba;
  export function securityColor(security: number): Rgba;
  ```

- [ ] **Step 1: `origin.spec.ts`'i yaz (kırmızı)**

```ts
import { describe, expect, it } from 'vitest';
import {
  boundsCenter,
  float32StepMetres,
  float32StepPixels,
  maxLocalMagnitude,
  nodePosition,
  toLocal,
} from './origin';

/**
 * The whole point of this module is the one hard rule in the design: a raw
 * galactic coordinate must never reach a GPU attribute. NEW_EDEN's real bounds
 * are the fixture, so the numbers below are the ones the production scene
 * actually produces (measured 2026-09-13).
 */
const NEW_EDEN_BOUNDS = {
  minX: -508743946216137000,
  maxX: 336522971264518000,
  minZ: -484452845697854000,
  maxZ: 472860102256057000,
};

function node(x: number, z: number) {
  return { x, z };
}

describe('boundsCenter', () => {
  it('sits at the midpoint of the scene', () => {
    const origin = boundsCenter(NEW_EDEN_BOUNDS);
    expect(origin.x).toBeCloseTo(-8.611049e16, -10);
    expect(origin.z).toBeCloseTo(-5.796372e15, -10);
  });

  it('is the exact node position for a one-node scene', () => {
    expect(boundsCenter({ minX: 5, maxX: 5, minZ: -3, maxZ: -3 })).toEqual({
      x: 5,
      z: -3,
    });
  });
});

describe('toLocal', () => {
  it('subtracts the origin', () => {
    expect(toLocal({ x: 100, z: -50 }, 250, 25)).toEqual([150, 75]);
  });

  it('returns zero at the origin itself', () => {
    expect(toLocal({ x: 1e17, z: -2e17 }, 1e17, -2e17)).toEqual([0, 0]);
  });
});

describe('nodePosition', () => {
  it('reads x and z off the node', () => {
    const position = nodePosition({ x: 1e9, z: 2e9 });
    expect(position(node(3e9, 5e9))).toEqual([2e9, 3e9]);
  });
});

describe('the float32 budget on the real NEW_EDEN scene', () => {
  const origin = boundsCenter(NEW_EDEN_BOUNDS);
  const corners = [
    node(NEW_EDEN_BOUNDS.minX, NEW_EDEN_BOUNDS.minZ),
    node(NEW_EDEN_BOUNDS.maxX, NEW_EDEN_BOUNDS.maxZ),
  ];

  it('shrinks the largest coordinate from 5.1e17 to 4.8e17 metres', () => {
    expect(maxLocalMagnitude(origin, corners)).toBeCloseTo(4.786565e17, -12);
  });

  it('never lets a local coordinate exceed the scene half-span', () => {
    const halfSpan =
      Math.max(
        NEW_EDEN_BOUNDS.maxX - NEW_EDEN_BOUNDS.minX,
        NEW_EDEN_BOUNDS.maxZ - NEW_EDEN_BOUNDS.minZ,
      ) / 2;
    for (const corner of corners) {
      const [x, z] = nodePosition(origin)(corner);
      expect(Math.abs(x)).toBeLessThanOrEqual(halfSpan);
      expect(Math.abs(z)).toBeLessThanOrEqual(halfSpan);
    }
  });

  it('quantises to 2.85e10 metres in float32', () => {
    expect(float32StepMetres(4.786565e17)).toBeCloseTo(2.853015e10, -6);
  });

  it('is invisible at the galaxy fit and 0.22 px at the Faz 1 ceiling', () => {
    const fit = -49.918;
    expect(float32StepPixels(4.786565e17, fit)).toBeLessThan(0.001);
    expect(float32StepPixels(4.786565e17, fit + 13)).toBeCloseTo(0.22, 2);
  });

  it('would be 598 px without the floating origin, which is the whole reason for it', () => {
    // The raw coordinate, fed straight to the GPU, at the deepest zoom the
    // design reaches (fit + 22.8, opened in Faz 2).
    expect(float32StepPixels(9.57e17, -49.918 + 22.8)).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: `origin.ts`'i yaz**

```ts
import type { MapBounds, MapNode } from '@/generated/graphql';

/**
 * The floating origin. Every layer receives `object - origin`, the subtraction
 * happens here in float64, and the origin is the centre of the scene in Faz 1
 * (the focused system's centre from Faz 2 on).
 *
 * Why it exists, in one number: a raw galactic coordinate is ~1e18 m, float32
 * quantises it to ~6e10 m, and at the deepest zoom the design reaches that is
 * 598 px of jitter. Relative to the scene centre the same step is 2.85e10 m,
 * which is 0.22 px at the zoom Faz 1 stops at.
 */
export interface MapOrigin {
  x: number;
  z: number;
}

/** float32 keeps 24 significand bits, so this is its relative resolution. */
export const FLOAT32_RELATIVE_STEP = 2 ** -24;

export function boundsCenter(bounds: MapBounds): MapOrigin {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
}

export function toLocal(
  origin: MapOrigin,
  x: number,
  z: number,
): [number, number] {
  return [x - origin.x, z - origin.z];
}

/** The accessor every layer hands to deck.gl. Nothing else may build positions. */
export function nodePosition(origin: MapOrigin) {
  return (node: Pick<MapNode, 'x' | 'z'>): [number, number] =>
    toLocal(origin, node.x, node.z);
}

export function maxLocalMagnitude(
  origin: MapOrigin,
  nodes: Pick<MapNode, 'x' | 'z'>[],
): number {
  let max = 0;
  for (const node of nodes) {
    const [x, z] = toLocal(origin, node.x, node.z);
    max = Math.max(max, Math.abs(x), Math.abs(z));
  }
  return max;
}

export function float32StepMetres(magnitude: number): number {
  return magnitude * FLOAT32_RELATIVE_STEP;
}

/** deck.gl's orthographic zoom is logarithmic: pixels = metres * 2 ** zoom. */
export function float32StepPixels(magnitude: number, zoom: number): number {
  return float32StepMetres(magnitude) * 2 ** zoom;
}
```

- [ ] **Step 3: `camera.spec.ts`'i yaz (kırmızı)**

```ts
import { MapScope } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  cameraQuery,
  FALLBACK_FIT_ZOOM,
  fitCamera,
  fitZoom,
  parseCamera,
  parseScope,
  zoomLimits,
} from './camera';

const NEW_EDEN_BOUNDS = {
  minX: -508743946216137000,
  maxX: 336522971264518000,
  minZ: -484452845697854000,
  maxZ: 472860102256057000,
};

describe('fitZoom', () => {
  it('fits the real NEW_EDEN extent into 1400 x 900', () => {
    // Unpadded the fit is -49.918; FIT_PADDING 0.92 costs log2(0.92) = -0.12.
    expect(fitZoom(NEW_EDEN_BOUNDS, 1400, 900)).toBeCloseTo(-50.04, 2);
  });

  it('is bound by the taller axis, not the wider one', () => {
    // spanZ 9.57e17 > spanX 8.45e17, so a taller canvas changes the answer and
    // a wider one does not.
    const tall = fitZoom(NEW_EDEN_BOUNDS, 1400, 1800);
    const wide = fitZoom(NEW_EDEN_BOUNDS, 2800, 900);
    expect(tall).toBeGreaterThan(fitZoom(NEW_EDEN_BOUNDS, 1400, 900));
    expect(wide).toBeCloseTo(fitZoom(NEW_EDEN_BOUNDS, 1400, 900), 6);
  });

  it('falls back rather than returning -Infinity for a scene with no extent', () => {
    expect(fitZoom({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, 1400, 900)).toBe(
      FALLBACK_FIT_ZOOM,
    );
  });

  it('falls back rather than returning NaN for a zero-sized canvas', () => {
    expect(fitZoom(NEW_EDEN_BOUNDS, 0, 0)).toBe(FALLBACK_FIT_ZOOM);
  });
});

describe('fitCamera', () => {
  it('centres on the scene and carries the fit zoom', () => {
    const camera = fitCamera(NEW_EDEN_BOUNDS, 1400, 900);
    expect(camera.x).toBeCloseTo(-8.611049e16, -10);
    expect(camera.z).toBeCloseTo(-5.796372e15, -10);
    expect(camera.zoom).toBeCloseTo(-50.04, 2);
  });
});

describe('zoomLimits', () => {
  it('opens 13 levels above the fit and 2 below', () => {
    expect(zoomLimits(-50)).toEqual({ minZoom: -52, maxZoom: -37 });
  });
});

describe('parseScope', () => {
  it('reads a known scope', () => {
    expect(parseScope(new URLSearchParams('scope=POCHVEN'))).toBe(
      MapScope.Pochven,
    );
  });

  it('defaults to NEW_EDEN when absent', () => {
    expect(parseScope(new URLSearchParams(''))).toBe(MapScope.NewEden);
  });

  it('defaults to NEW_EDEN for a scope the backend has no scene for', () => {
    expect(parseScope(new URLSearchParams('scope=ABYSSAL'))).toBe(
      MapScope.NewEden,
    );
    expect(parseScope(new URLSearchParams('scope=new_eden'))).toBe(
      MapScope.NewEden,
    );
  });
});

describe('parseCamera', () => {
  it('reads a complete camera', () => {
    expect(
      parseCamera(
        new URLSearchParams('x=-129550000000000000&z=1e9&zoom=-42.5'),
      ),
    ).toEqual({ x: -129550000000000000, z: 1e9, zoom: -42.5 });
  });

  it('returns null when any part is missing, so the caller can autofit', () => {
    expect(parseCamera(new URLSearchParams('x=1&z=2'))).toBeNull();
    expect(parseCamera(new URLSearchParams('x=1&zoom=-42'))).toBeNull();
    expect(parseCamera(new URLSearchParams(''))).toBeNull();
  });

  it('returns null for junk rather than a NaN camera', () => {
    expect(parseCamera(new URLSearchParams('x=abc&z=2&zoom=-42'))).toBeNull();
    expect(
      parseCamera(new URLSearchParams('x=1&z=2&zoom=Infinity')),
    ).toBeNull();
  });
});

describe('cameraQuery', () => {
  it('rounds the target to the same 1e9 m grid as the nodes', () => {
    const query = cameraQuery(MapScope.NewEden, {
      x: -129550000000123,
      z: 43236000000987,
      zoom: -50.0383,
    });
    const params = new URLSearchParams(query);
    expect(params.get('x')).toBe('-129550000000000');
    expect(params.get('z')).toBe('43236000000000');
  });

  it('writes the zoom to two decimals', () => {
    const params = new URLSearchParams(
      cameraQuery(MapScope.Pochven, { x: 0, z: 0, zoom: -50.0383 }),
    );
    expect(params.get('zoom')).toBe('-50.04');
    expect(params.get('scope')).toBe('POCHVEN');
  });

  it('never writes exponential notation, which would not parse back the same', () => {
    const query = cameraQuery(MapScope.NewEden, {
      x: -5.08743946e17,
      z: 4.7286e17,
      zoom: -50,
    });
    expect(query).not.toContain('e+');
    expect(parseCamera(new URLSearchParams(query))).toEqual({
      x: -508743946000000000,
      z: 472860000000000000,
      zoom: -50,
    });
  });

  it('round-trips a camera it wrote', () => {
    const camera = { x: 1e9, z: -2e9, zoom: -37.5 };
    expect(
      parseCamera(new URLSearchParams(cameraQuery(MapScope.Wormhole, camera))),
    ).toEqual(camera);
  });
});
```

- [ ] **Step 4: `camera.ts`'i yaz**

```ts
import { MapScope, type MapBounds } from '@/generated/graphql';
import { boundsCenter } from './origin';

/**
 * The camera, in galactic metres. It is stored this way rather than relative to
 * the origin because the origin moves in Faz 2 and a URL has to keep meaning
 * the same frame after it does.
 */
export interface MapCamera {
  x: number;
  z: number;
  zoom: number;
}

export const MAP_SCOPES: readonly MapScope[] = [
  MapScope.NewEden,
  MapScope.Pochven,
  MapScope.Wormhole,
];

export const DEFAULT_SCOPE: MapScope = MapScope.NewEden;

/** Leaves a margin, so the outermost dots are not half-clipped by the edge. */
export const FIT_PADDING = 0.92;

/**
 * Faz 1 stops 13 levels above the fit. The design's threshold for system
 * interiors is fit + 13.1, so this is exactly as far as the galaxy layer alone
 * stays honest; Faz 2 raises it to fit + 22.8.
 */
export const ZOOM_ABOVE_FIT = 13;
export const ZOOM_BELOW_FIT = 2;

/** For a scene with no extent: one node, or none. Matches NEW_EDEN's own fit. */
export const FALLBACK_FIT_ZOOM = -49.92;

/** The same grid the service rounds nodes to; the camera is never finer. */
export const CAMERA_GRID_METRES = 1e9;

export function fitZoom(
  bounds: MapBounds,
  width: number,
  height: number,
): number {
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  if (!(spanX > 0) || !(spanZ > 0) || !(width > 0) || !(height > 0)) {
    return FALLBACK_FIT_ZOOM;
  }

  // deck.gl's orthographic zoom is logarithmic: pixels = units * 2 ** zoom.
  return Math.log2(Math.min(width / spanX, height / spanZ) * FIT_PADDING);
}

export function fitCamera(
  bounds: MapBounds,
  width: number,
  height: number,
): MapCamera {
  const centre = boundsCenter(bounds);
  return { x: centre.x, z: centre.z, zoom: fitZoom(bounds, width, height) };
}

export function zoomLimits(fit: number): { minZoom: number; maxZoom: number } {
  return { minZoom: fit - ZOOM_BELOW_FIT, maxZoom: fit + ZOOM_ABOVE_FIT };
}

export function parseScope(params: URLSearchParams): MapScope {
  const raw = params.get('scope');
  return MAP_SCOPES.includes(raw as MapScope)
    ? (raw as MapScope)
    : DEFAULT_SCOPE;
}

/**
 * Null means "the URL does not carry a camera" — the caller autofits instead of
 * rendering a frame built out of NaNs.
 */
export function parseCamera(params: URLSearchParams): MapCamera | null {
  const raw = {
    x: params.get('x'),
    z: params.get('z'),
    zoom: params.get('zoom'),
  };
  if (raw.x === null || raw.z === null || raw.zoom === null) return null;

  const camera = { x: Number(raw.x), z: Number(raw.z), zoom: Number(raw.zoom) };
  if (
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.z) ||
    !Number.isFinite(camera.zoom)
  ) {
    return null;
  }

  return camera;
}

function toGrid(value: number): number {
  return Math.round(value / CAMERA_GRID_METRES) * CAMERA_GRID_METRES;
}

/**
 * The canonical serialisation. useMapCamera also uses it to tell its own writes
 * apart from someone else's, so it has to be a pure function of the camera.
 */
export function cameraQuery(scope: MapScope, camera: MapCamera): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('x', String(toGrid(camera.x)));
  params.set('z', String(toGrid(camera.z)));
  params.set('zoom', camera.zoom.toFixed(2));
  return params.toString();
}
```

- [ ] **Step 5: `colorScales.spec.ts`'i yaz (kırmızı)**

```ts
import { describe, expect, it } from 'vitest';
import { hexToRgba, SECURITY_RAMP, securityColor } from './colorScales';

describe('SECURITY_RAMP', () => {
  it('has one colour per tenth, matching the shipped region maps', () => {
    expect(SECURITY_RAMP).toHaveLength(11);
    expect(SECURITY_RAMP[0]).toBe('#F00000');
    expect(SECURITY_RAMP[10]).toBe('#2FEFEF');
  });
});

describe('hexToRgba', () => {
  it('splits a six-digit hex', () => {
    expect(hexToRgba('#2FEFEF')).toEqual([47, 239, 239, 255]);
  });

  it('takes an explicit alpha', () => {
    expect(hexToRgba('#94A3B8', 140)).toEqual([148, 163, 184, 140]);
  });
});

describe('securityColor', () => {
  it('buckets to the nearest tenth, like backend/src/scripts/star-map-svg.ts', () => {
    expect(securityColor(1.0)).toEqual(hexToRgba('#2FEFEF'));
    expect(securityColor(0.95)).toEqual(hexToRgba('#2FEFEF'));
    expect(securityColor(0.94)).toEqual(hexToRgba('#48F0C0'));
    expect(securityColor(0.5)).toEqual(hexToRgba('#EFEF00'));
  });

  it('clamps everything at or below zero to the red end', () => {
    expect(securityColor(0)).toEqual(hexToRgba('#F00000'));
    expect(securityColor(-0.99)).toEqual(hexToRgba('#F00000'));
  });

  it('does not fall off the end of the ramp above 1.0', () => {
    expect(securityColor(1.5)).toEqual(hexToRgba('#2FEFEF'));
  });

  it('keeps the two lowsec systems nearest the boundary out of the highsec colour', () => {
    // 0.49 buckets to 5 (#EFEF00), 0.5 to 5 as well - the ramp is coarser than
    // the classification, which is why the service truncates rather than rounds
    // the value itself.
    expect(securityColor(0.49)).toEqual(securityColor(0.5));
  });
});
```

- [ ] **Step 6: `colorScales.ts`'i yaz**

```ts
export type Rgba = [number, number, number, number];

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

export function hexToRgba(hex: string, alpha = 255): Rgba {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

/** Same bucketing as star-map-svg.ts's securityColour, so the two never differ. */
export function securityColor(security: number): Rgba {
  const bucket = Math.round(Math.max(0, security) * 10);
  return hexToRgba(SECURITY_RAMP[Math.min(bucket, SECURITY_RAMP.length - 1)]);
}
```

- [ ] **Step 7: Testleri çalıştır**

```bash
yarn workspace frontend test src/utils/map
```

Beklenen: PASS, üç dosya, 33 test (origin 10, camera 16, colorScales 7).

- [ ] **Step 8: Prettier ve commit**

```bash
npx prettier --check frontend/src/utils/map/*.ts
git add frontend/src/utils/map/
git commit -m "feat(frontend): add the map origin, camera and security colour utils"
```

---

## Task 5: Katman prop kurucuları

Katmanlar `new ScatterplotLayer(...)` olarak değil, **props üreten saf
fonksiyonlar** olarak yazılıyor. Sebebi test: props bir düz nesne, jsdom'da
WebGL bağlamı gerektirmiyor, ve "GPU'ya giden pozisyonlar" iddiası doğrudan
`getPosition`'ı çağırarak doğrulanabiliyor.

Bunun bir şartı var ve plan ilk yazımda kaçırdı: **accessor'ların tipi
daraltılmak zorunda.** deck.gl'in `Accessor<DataT, T>`'si bir birleşim — düz
bir değer **veya** iki argümanlı `AccessorFunction<DataT, T>` — ve bu birleşimi
test içinde `as (n: MapNode) => T` ile tek argümanlı bir fonksiyona çevirmek
geçerli bir dönüşüm değil; `tsc` TS2352 veriyor. Çözüm cast değil: kurucuların
dönüş tipini kendi arayüzüyle bildirip accessor'ları tek argümanlı fonksiyon
olarak daraltmak. Tek argümanlı bir fonksiyon deck.gl'in iki argümanlı
`AccessorFunction`'ına atanabildiği için katman bunu sorunsuz kabul ediyor, ve
test hiç cast'siz çağırabiliyor.

**Files:**

- Create: `frontend/src/components/UniverseMap/layers/systems.ts`
- Create: `frontend/src/components/UniverseMap/layers/edges.ts`
- Create: `frontend/src/components/UniverseMap/layers/index.ts`
- Create: `frontend/src/components/UniverseMap/layers/layers.spec.ts`

**Interfaces:**

- Consumes: `nodePosition`, `MapOrigin` (`@/utils/map/origin`), `securityColor`,
  `hexToRgba`, `Rgba` (`@/utils/map/colorScales`), `MapEdge`, `MapGeometry`,
  `MapNode` (`@/generated/graphql`), ve tip olarak `ScatterplotLayerProps`,
  `LineLayerProps` (`@deck.gl/layers`).
- Produces:

  ```ts
  export const SYSTEMS_LAYER_ID = 'map-systems';
  export const EDGES_LAYER_ID = 'map-gates';
  export const SYSTEM_RADIUS_MIN_PIXELS = 1.5;
  export const GATE_WIDTH_MIN_PIXELS = 0.5;
  export const GATE_COLOR: Rgba;
  export interface EdgeSegment {
    from: [number, number];
    to: [number, number];
  }
  export interface SystemsLayerProps extends ScatterplotLayerProps<MapNode> {
    id: string;
    getPosition: (node: MapNode) => [number, number];
    getRadius: (node: MapNode) => number;
    getFillColor: (node: MapNode) => Rgba;
  }
  export interface EdgesLayerProps extends LineLayerProps<EdgeSegment> {
    id: string;
    getSourcePosition: (segment: EdgeSegment) => [number, number];
    getTargetPosition: (segment: EdgeSegment) => [number, number];
  }
  export function systemsLayerProps(input: {
    nodes: MapNode[];
    origin: MapOrigin;
  }): SystemsLayerProps;
  export function edgeSegments(
    edges: MapEdge[],
    nodes: MapNode[],
    origin: MapOrigin,
  ): EdgeSegment[];
  export function edgesLayerProps(input: {
    segments: EdgeSegment[];
  }): EdgesLayerProps;
  ```

- [ ] **Step 1: `layers.spec.ts`'i yaz (kırmızı)**

```ts
import type { MapEdge, MapNode } from '@/generated/graphql';
import { hexToRgba, securityColor } from '@/utils/map/colorScales';
import { describe, expect, it } from 'vitest';
import {
  edgeSegments,
  edgesLayerProps,
  GATE_COLOR,
  systemsLayerProps,
} from './index';

function node(
  systemId: number,
  x: number,
  z: number,
  extra: Partial<MapNode> = {},
): MapNode {
  return {
    __typename: 'MapNode',
    systemId,
    name: `S${systemId}`,
    x,
    z,
    radius: 3.88e12,
    securityStatus: 0.9,
    constellationId: 20000001,
    regionId: 10000001,
    ...extra,
  } as MapNode;
}

const origin = { x: 1e17, z: -2e17 };

describe('systemsLayerProps', () => {
  const nodes = [node(1, 1.5e17, -2.5e17), node(2, 0.5e17, -1.5e17)];
  const props = systemsLayerProps({ nodes, origin });

  it('hands deck.gl origin-local positions, never galactic ones', () => {
    expect(props.getPosition(nodes[0])).toEqual([5e16, -5e16]);
    expect(props.getPosition(nodes[1])).toEqual([-5e16, 5e16]);
  });

  it('shrinks the largest coordinate the layer will hand to the GPU', () => {
    // Scene-wide, not per node. A node sitting at exactly twice the origin maps
    // to the same magnitude on the other side of it, so "every coordinate
    // shrinks" is simply false — node 2 of this fixture is that case. What the
    // floating origin actually buys is that the largest number reaching a
    // float32 attribute is bounded by the scene rather than by the distance to
    // the galactic centre.
    const largestRaw = Math.max(
      ...nodes.flatMap((n) => [Math.abs(n.x), Math.abs(n.z)]),
    );
    const largestLocal = Math.max(
      ...nodes.flatMap((n) => props.getPosition(n).map(Math.abs)),
    );

    expect(largestLocal).toBeLessThan(largestRaw);
    expect(largestLocal).toBe(5e16);
    expect(largestRaw).toBe(2.5e17);
  });

  it('lets the data drive the radius so a dot becomes a disc on its own', () => {
    expect(props.getRadius(nodes[0])).toBe(3.88e12);
    expect(props.radiusUnits).toBe('common');
    expect(props.radiusMinPixels).toBe(1.5);
  });

  it('colours by security with the shipped ramp', () => {
    expect(props.getFillColor(nodes[0])).toEqual(securityColor(0.9));
  });

  it('rebuilds positions when the origin moves', () => {
    expect(props.updateTriggers?.getPosition).toEqual([origin.x, origin.z]);
  });

  it('is not pickable yet — picking is Faz 3', () => {
    expect(props.pickable).toBe(false);
  });
});

describe('edgeSegments', () => {
  const nodes = [node(1, 1.5e17, -2.5e17), node(2, 0.5e17, -1.5e17)];
  const edges: MapEdge[] = [
    { __typename: 'MapEdge', from: 1, to: 2 } as MapEdge,
  ];

  it('resolves both endpoints into origin-local metres', () => {
    expect(edgeSegments(edges, nodes, origin)).toEqual([
      { from: [5e16, -5e16], to: [-5e16, 5e16] },
    ]);
  });

  it('drops an edge whose endpoint is missing rather than drawing it to the origin', () => {
    const orphan: MapEdge[] = [
      { __typename: 'MapEdge', from: 1, to: 999 } as MapEdge,
    ];
    expect(edgeSegments(orphan, nodes, origin)).toEqual([]);
  });

  it('returns an empty list for a scene with no gates, like WORMHOLE', () => {
    expect(edgeSegments([], nodes, origin)).toEqual([]);
  });
});

describe('edgesLayerProps', () => {
  const segments = [
    { from: [1, 2] as [number, number], to: [3, 4] as [number, number] },
  ];
  const props = edgesLayerProps({ segments });

  it('reads the endpoints the segments already resolved', () => {
    expect(props.getSourcePosition(segments[0])).toEqual([1, 2]);
    expect(props.getTargetPosition(segments[0])).toEqual([3, 4]);
  });

  it('keeps a hairline visible at galaxy zoom', () => {
    expect(props.widthUnits).toBe('pixels');
    expect(props.widthMinPixels).toBe(0.5);
  });

  it('uses the same line colour as the shipped region maps', () => {
    expect(GATE_COLOR).toEqual(hexToRgba('#94A3B8', 140));
  });

  it('is never pickable: a 0.5 px line cannot be aimed at', () => {
    expect(props.pickable).toBe(false);
  });
});
```

- [ ] **Step 2: `systems.ts`'i yaz**

```ts
import type { MapNode } from '@/generated/graphql';
import { securityColor, type Rgba } from '@/utils/map/colorScales';
import { nodePosition, type MapOrigin } from '@/utils/map/origin';
import type { ScatterplotLayerProps } from '@deck.gl/layers';

export const SYSTEMS_LAYER_ID = 'map-systems';

/**
 * A 1.5 px floor with a data-driven radius is what makes a point turn into a
 * disc without a mode switch: at galaxy zoom every system is the floor, and by
 * the time the median system's 3.88e12 m radius crosses 1.5 px the disc takes
 * over on its own.
 */
export const SYSTEM_RADIUS_MIN_PIXELS = 1.5;

/**
 * The accessors are narrowed to single-argument functions rather than left as
 * deck.gl's `Accessor` union. The layer accepts either — a one-argument
 * function is assignable to deck.gl's two-argument `AccessorFunction` — but
 * only this form is callable from a test without a cast, and being callable
 * from a test is the entire reason these builders return props instead of
 * layer instances.
 */
export interface SystemsLayerProps extends ScatterplotLayerProps<MapNode> {
  id: string;
  getPosition: (node: MapNode) => [number, number];
  getRadius: (node: MapNode) => number;
  getFillColor: (node: MapNode) => Rgba;
}

export function systemsLayerProps({
  nodes,
  origin,
}: {
  nodes: MapNode[];
  origin: MapOrigin;
}): SystemsLayerProps {
  return {
    id: SYSTEMS_LAYER_ID,
    data: nodes,
    getPosition: nodePosition(origin),
    getRadius: (node: MapNode) => node.radius,
    getFillColor: (node: MapNode) => securityColor(node.securityStatus),
    // 'common' is world units. The default is 'meters', which in a
    // non-geospatial view resolves to the same thing, but saying it outright
    // keeps the metre contract visible at the layer boundary.
    radiusUnits: 'common',
    radiusMinPixels: SYSTEM_RADIUS_MIN_PIXELS,
    // Picking, hover and the popup are Faz 3.
    pickable: false,
    updateTriggers: { getPosition: [origin.x, origin.z] },
  };
}
```

- [ ] **Step 3: `edges.ts`'i yaz**

```ts
import type { MapEdge, MapNode } from '@/generated/graphql';
import { hexToRgba, type Rgba } from '@/utils/map/colorScales';
import { toLocal, type MapOrigin } from '@/utils/map/origin';
import type { LineLayerProps } from '@deck.gl/layers';

export const EDGES_LAYER_ID = 'map-gates';
export const GATE_WIDTH_MIN_PIXELS = 0.5;

/**
 * #94A3B8 at 0.55 alpha — the same line the shipped region SVGs use for an
 * internal jump (backend/src/scripts/star-map-svg.ts, REGION_PALETTE.jump). At
 * galaxy zoom 6.959 of these read as texture, which is the point.
 */
export const GATE_COLOR: Rgba = hexToRgba('#94A3B8', 140);

export interface EdgeSegment {
  from: [number, number];
  to: [number, number];
}

/**
 * Resolves each pair's endpoints once, in float64, into origin-local metres.
 *
 * An edge naming a system that is not in the node list is dropped rather than
 * drawn. The service guarantees this cannot happen — both endpoints go through
 * the same scope predicate — but a silent line to [0, 0] would be the worst
 * possible symptom if that guarantee ever broke.
 */
export function edgeSegments(
  edges: MapEdge[],
  nodes: MapNode[],
  origin: MapOrigin,
): EdgeSegment[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));
  const segments: EdgeSegment[] = [];

  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;

    segments.push({
      from: toLocal(origin, from.x, from.z),
      to: toLocal(origin, to.x, to.z),
    });
  }

  return segments;
}

/** Narrowed for the same reason as SystemsLayerProps: callable from a test. */
export interface EdgesLayerProps extends LineLayerProps<EdgeSegment> {
  id: string;
  getSourcePosition: (segment: EdgeSegment) => [number, number];
  getTargetPosition: (segment: EdgeSegment) => [number, number];
}

export function edgesLayerProps({
  segments,
}: {
  segments: EdgeSegment[];
}): EdgesLayerProps {
  return {
    id: EDGES_LAYER_ID,
    data: segments,
    getSourcePosition: (segment: EdgeSegment) => segment.from,
    getTargetPosition: (segment: EdgeSegment) => segment.to,
    getColor: GATE_COLOR,
    getWidth: 1,
    widthUnits: 'pixels',
    widthMinPixels: GATE_WIDTH_MIN_PIXELS,
    pickable: false,
  };
}
```

- [ ] **Step 4: `layers/index.ts`'i yaz**

```ts
export {
  SYSTEM_RADIUS_MIN_PIXELS,
  SYSTEMS_LAYER_ID,
  systemsLayerProps,
  type SystemsLayerProps,
} from './systems';
export {
  EDGES_LAYER_ID,
  edgeSegments,
  edgesLayerProps,
  GATE_COLOR,
  GATE_WIDTH_MIN_PIXELS,
  type EdgeSegment,
  type EdgesLayerProps,
} from './edges';
```

- [ ] **Step 5: Testleri çalıştır**

```bash
yarn workspace frontend test src/components/UniverseMap
```

Beklenen: PASS, 13 test.

- [ ] **Step 6: Prettier ve commit**

```bash
npx prettier --check frontend/src/components/UniverseMap/layers/*.ts
git add frontend/src/components/UniverseMap/layers/
git commit -m "feat(frontend): build the system and gate layer props from a floating origin"
```

---

## Task 6: Kamera hook'u ve tuval bileşeni

**Files:**

- Create: `frontend/src/utils/map/webgl.ts`
- Create: `frontend/src/components/UniverseMap/useMapCamera.ts`
- Create: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Create: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: Task 4'ün `camera.ts`/`origin.ts`'i, Task 5'in katman prop'ları,
  Task 3'ün `useMapGeometryQuery`'si.
- Produces:
  ```ts
  export function isWebgl2Available(): boolean;
  export function useMapCamera(
    scope: MapScope,
    fit: MapCamera | null,
  ): {
    camera: MapCamera | null;
    onCameraChange: (next: MapCamera) => void;
  };
  export default function UniverseMap({
    scope,
  }: {
    scope: MapScope;
  }): JSX.Element;
  ```

### İki tür state, iki ayrı kural

Spec'in bu bölümü #201'in bedelinden geliyor ve tam olarak şu:

- **`scope`** düşük frekanslı ve link'le geliyor → sayfada, her render'da
  URL'den türetiliyor (Task 7).
- **Kamera** yüksek frekanslı ve pointer'ın yetkisinde → React state'inde
  yaşıyor, URL'e 250 ms debounce ile `router.replace` ediliyor. Harici
  değişimi ayırt etmek için **son yazılan kamera** bir ref'te tutuluyor ve
  karşılaştırma `cameraQuery` üzerinden yapılıyor — query string'in anahtar
  sırasına değil, kameranın kendisine bakan tek karşılaştırma bu.

- [ ] **Step 1: `webgl.ts`'i yaz**

```ts
/**
 * Ayrı bir modül, çünkü UniverseMap.spec.tsx bunu mock'luyor: jsdom'da
 * getContext('webgl2') her zaman null döner, yani mock'lanmazsa bileşenin
 * yalnızca "WebGL yok" dalı test edilebilirdi.
 */
export function isWebgl2Available(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: `useMapCamera.ts`'i yaz**

```ts
'use client';

import type { MapScope } from '@/generated/graphql';
import { cameraQuery, parseCamera, type MapCamera } from '@/utils/map/camera';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 250 ms. Without it a drag writes a history entry per frame; with a longer one
 * the URL lags visibly behind the view when you stop moving.
 */
const URL_DEBOUNCE_MS = 250;

export function useMapCamera(scope: MapScope, fit: MapCamera | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [camera, setCamera] = useState<MapCamera | null>(() =>
    parseCamera(searchParams),
  );

  /** The last camera this hook wrote, so its own writes are recognisable. */
  const lastWritten = useRef<MapCamera | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The autofit is not known until the geometry lands, so the camera is seeded
  // late — and only once. A later fit (the window was resized) must not throw
  // away where the user has moved to.
  useEffect(() => {
    if (camera === null && fit !== null) setCamera(fit);
  }, [camera, fit]);

  // The URL is authoritative for anything that did not come from the pointer: a
  // nav link, the back button, a pasted link. App Router keeps this component
  // mounted across a query string change, so reading once on mount would
  // swallow all three.
  useEffect(() => {
    const fromUrl = parseCamera(searchParams);
    if (!fromUrl) return;
    if (
      lastWritten.current &&
      cameraQuery(scope, fromUrl) === cameraQuery(scope, lastWritten.current)
    ) {
      return;
    }
    setCamera(fromUrl);
  }, [searchParams, scope]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lastWritten.current = next;
        router.replace(`?${cameraQuery(scope, next)}`, { scroll: false });
      }, URL_DEBOUNCE_MS);
    },
    [router, scope],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { camera, onCameraChange };
}
```

- [ ] **Step 3: `UniverseMap.tsx`'i yaz**

```tsx
'use client';

import Loader from '@/components/Loader';
import { useMapGeometryQuery, type MapScope } from '@/generated/graphql';
import { fitCamera, zoomLimits, type MapCamera } from '@/utils/map/camera';
import { boundsCenter, toLocal } from '@/utils/map/origin';
import { isWebgl2Available } from '@/utils/map/webgl';
import { OrthographicView, type OrthographicViewState } from '@deck.gl/core';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { DeckGL } from '@deck.gl/react';
import { useCallback, useMemo, useState } from 'react';
import { edgeSegments, edgesLayerProps, systemsLayerProps } from './layers';
import { useMapCamera } from './useMapCamera';

/**
 * flipY: false, so +z points up the screen. That is the orientation the region
 * and constellation SVGs already shipped with — backend/src/scripts/star-map-svg.ts
 * projects "x is screen x, -z is screen y" into an SVG whose +y runs downward —
 * and a map that disagrees with its own thumbnails is a bug nobody can name.
 *
 * The consequence is that nothing in this component negates a coordinate: world
 * y is z, everywhere, and the only transform is subtracting the origin.
 */
const VIEW = new OrthographicView({ id: 'universe', flipY: false });

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

  // Static universe data behind a 24 hour Redis key and a STATIC_GAME_DATA
  // response cache: cache-first is the one place in this app that overrides the
  // client's cache-and-network default, and it is overridden here at the call
  // site rather than globally (frontend/src/lib/apolloClient.ts:244 is shared by
  // every page).
  const { data, loading, error } = useMapGeometryQuery({
    variables: { scope },
    fetchPolicy: 'cache-first',
  });

  const geometry = data?.mapGeometry;

  const origin = useMemo(
    () => (geometry ? boundsCenter(geometry.bounds) : { x: 0, z: 0 }),
    [geometry],
  );

  const fit = useMemo<MapCamera | null>(
    () =>
      geometry ? fitCamera(geometry.bounds, size.width, size.height) : null,
    [geometry, size.width, size.height],
  );

  const { camera, onCameraChange } = useMapCamera(scope, fit);

  const layers = useMemo(() => {
    if (!geometry) return [];
    return [
      new LineLayer(
        edgesLayerProps({
          segments: edgeSegments(geometry.edges, geometry.nodes, origin),
        }),
      ),
      new ScatterplotLayer(
        systemsLayerProps({ nodes: geometry.nodes, origin }),
      ),
    ];
  }, [geometry, origin]);

  const viewState = useMemo<OrthographicViewState | null>(() => {
    if (!camera || !fit) return null;
    const [x, z] = toLocal(origin, camera.x, camera.z);
    return { target: [x, z, 0], zoom: camera.zoom, ...zoomLimits(fit.zoom) };
  }, [camera, fit, origin]);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  const onViewStateChange = useCallback(
    ({ viewState: next }: { viewState: OrthographicViewState }) => {
      const target = next.target ?? [0, 0, 0];
      onCameraChange({
        x: target[0] + origin.x,
        z: target[1] + origin.z,
        zoom: typeof next.zoom === 'number' ? next.zoom : 0,
      });
    },
    [onCameraChange, origin],
  );

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
    <div ref={measure} className="relative w-full h-full bg-ground">
      {viewState && (
        <DeckGL
          views={VIEW}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          onResize={setSize}
          controller
          layers={layers}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: `UniverseMap.spec.tsx`'i yaz**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The component's job is a small state machine plus one arithmetic promise: the
 * viewState target that reaches deck.gl is origin-local, not galactic. Those are
 * what these tests hold; the layer props themselves are Task 5's.
 */

const webgl = vi.fn(() => true);
vi.mock('@/utils/map/webgl', () => ({ isWebgl2Available: () => webgl() }));

const replace = vi.fn();
let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

type QueryResult = {
  data?: unknown;
  loading: boolean;
  error?: { message: string };
};
const useMapGeometryQuery = vi.fn<() => QueryResult>();
vi.mock('@/generated/graphql', () => ({
  MapScope: { NewEden: 'NEW_EDEN', Pochven: 'POCHVEN', Wormhole: 'WORMHOLE' },
  useMapGeometryQuery: (options: unknown) => {
    lastQueryOptions = options;
    return useMapGeometryQuery();
  },
}));
let lastQueryOptions: unknown;

const deckProps: Record<string, unknown>[] = [];
vi.mock('@deck.gl/react', () => ({
  DeckGL: (props: Record<string, unknown>) => {
    deckProps.push(props);
    return <div data-testid="deck" />;
  },
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
  searchParams = new URLSearchParams('');
  deckProps.length = 0;
  useMapGeometryQuery.mockReturnValue({ data: GEOMETRY, loading: false });
});

describe('UniverseMap', () => {
  it('says so plainly when the browser has no WebGL 2', () => {
    webgl.mockReturnValue(false);
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(screen.getByText(/needs WebGL 2/)).toBeInTheDocument();
    expect(screen.queryByTestId('deck')).not.toBeInTheDocument();
  });

  it('keeps the canvas area filled on a geometry error instead of going blank', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      error: { message: 'network down' },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(
      screen.getByText(/Could not load the map geometry/),
    ).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
  });

  it('shows the loader only while there is nothing to draw', () => {
    useMapGeometryQuery.mockReturnValue({ loading: true });
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(screen.getByText('Loading the map...')).toBeInTheDocument();
  });

  it('says a scene is empty rather than rendering an empty canvas', () => {
    useMapGeometryQuery.mockReturnValue({
      loading: false,
      data: { mapGeometry: { ...GEOMETRY.mapGeometry, nodes: [] } },
    });
    render(<UniverseMap scope={MapScope.NewEden} />);

    expect(screen.getByText(/no systems to draw/)).toBeInTheDocument();
  });

  it('asks for the geometry cache-first, the one override of the global default', () => {
    render(<UniverseMap scope={MapScope.Pochven} />);

    expect(lastQueryOptions).toMatchObject({
      variables: { scope: 'POCHVEN' },
      fetchPolicy: 'cache-first',
    });
  });

  it('hands deck.gl a target relative to the scene centre, not a galactic one', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { viewState } = deckProps.at(-1) as {
      viewState: { target: number[]; zoom: number };
    };
    // bounds centre is [1e17, 0]; the autofit camera sits on it, so the target
    // deck.gl receives is the origin itself.
    expect(viewState.target).toEqual([0, 0, 0]);
    expect(Math.abs(viewState.target[0])).toBeLessThan(1e17);
  });

  it('restores the camera the URL carries, in galactic metres', () => {
    searchParams = new URLSearchParams('x=2e17&z=1e17&zoom=-40');
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { viewState } = deckProps.at(-1) as {
      viewState: { target: number[]; zoom: number };
    };
    expect(viewState.target[0]).toBeCloseTo(1e17, -14);
    expect(viewState.target[1]).toBeCloseTo(1e17, -14);
    expect(viewState.zoom).toBe(-40);
  });

  it('opens 13 zoom levels above the fit and no more, because interiors are Faz 2', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { viewState } = deckProps.at(-1) as {
      viewState: { zoom: number; minZoom: number; maxZoom: number };
    };
    expect(viewState.maxZoom - viewState.zoom).toBeCloseTo(13, 6);
    expect(viewState.zoom - viewState.minZoom).toBeCloseTo(2, 6);
  });

  it('draws gates under systems, so a dot is never hidden by a line', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);

    const { layers } = deckProps.at(-1) as { layers: { id: string }[] };
    expect(layers.map((layer) => layer.id)).toEqual([
      'map-gates',
      'map-systems',
    ]);
  });
});
```

- [ ] **Step 5: Testleri çalıştır**

```bash
yarn workspace frontend test src/components/UniverseMap
```

Beklenen: PASS, 22 test (Task 5'in 13'ü + bu 9).

Not: jsdom `getBoundingClientRect`'i 0 döndürüyor, yani autofit
`FALLBACK_FIT_ZOOM`'a düşüyor — zoom sınırlarını test eden iki senaryo bu
yüzden mutlak bir zoom değeri değil, **fit'e göre farkı** kontrol ediyor.

- [ ] **Step 6: Prettier ve commit**

```bash
npx prettier --check frontend/src/utils/map/webgl.ts frontend/src/components/UniverseMap/*.ts frontend/src/components/UniverseMap/*.tsx
git add frontend/src/utils/map/webgl.ts frontend/src/components/UniverseMap/
git commit -m "feat(frontend): render the universe map canvas with a url-backed camera"
```

---

## Task 7: `/map` rotası ve menü girişleri

**Files:**

- Create: `frontend/src/app/map/page.tsx`
- Create: `frontend/src/app/map/page.spec.tsx`
- Modify: `frontend/src/components/Header/Header.tsx` (masaüstü UNIVERSE
  popover'ı ~satır 82-98, mobil UNIVERSE disclosure'ı ~satır 216-235)

**Interfaces:**

- Consumes: `parseScope` (`@/utils/map/camera`), `UniverseMap` (Task 6).
- Produces: `/map` ve `/map?scope=POCHVEN` rotaları.

### Yerleşim: kök layout'a dokunulmuyor

Spec `Header`'a sabit yükseklik ve `globals.css`'e `--header-h` token'ı
istiyordu; gerekmiyor. `frontend/src/app/layout.tsx:23` gövdeyi
`flex flex-col`, `globals.css:26-28` `html, body { height: 100% }` yapıyor —
yani `main.flex-1` zaten kesin bir yükseklikte ve `main`'in içindeki
`h-[calc(100%+4rem)]`, `py-8`'in geri alınan 4rem'iyle birlikte tam olarak
header ve footer'dan artan alanı kaplıyor. Header'ın yüksekliğine dokunmak her
sayfayı etkiler ve tarayıcıda ölçülmesi gereken bir değişiklik olur.

Negatif margin'ler `main`'in dolgusunu birebir geri alıyor:
`px-6 py-8 lg:px-8 xl:px-12 2xl:px-16` → `-mx-6 -my-8 lg:-mx-8 xl:-mx-12 2xl:-mx-16`.

- [ ] **Step 1: `page.spec.tsx`'i yaz (kırmızı)**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The UNIVERSE nav menu links straight into this page with the scene already
 * chosen — /map?scope=POCHVEN. App Router keeps the same component mounted when
 * only the query string changes, so the scope has to be derived on every render
 * rather than seeded on mount; #201 was exactly this bug on the killmails page.
 */

let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn() }),
}));

const scopes: string[] = [];
vi.mock('@/components/UniverseMap/UniverseMap', () => ({
  default: ({ scope }: { scope: string }) => {
    scopes.push(scope);
    return <div data-testid="universe-map">{scope}</div>;
  },
}));

vi.mock('@/components/Loader', () => ({ default: () => null }));

// parseScope reaches through @/utils/map/camera into the generated module for the
// MapScope enum, and that module pulls in Apollo. Stubbing the enum keeps this
// spec to the page's own decision, which is the one thing it is about.
vi.mock('@/generated/graphql', () => ({
  MapScope: { NewEden: 'NEW_EDEN', Pochven: 'POCHVEN', Wormhole: 'WORMHOLE' },
}));

import MapPage from './page';

beforeEach(() => {
  searchParams = new URLSearchParams('');
  scopes.length = 0;
});

describe('MapPage', () => {
  it('defaults to the New Eden scene', async () => {
    render(<MapPage />);
    expect(await screen.findByTestId('universe-map')).toHaveTextContent(
      'NEW_EDEN',
    );
  });

  it('reads the scene out of the query string', async () => {
    searchParams = new URLSearchParams('scope=POCHVEN');
    render(<MapPage />);
    expect(await screen.findByTestId('universe-map')).toHaveTextContent(
      'POCHVEN',
    );
  });

  it('follows a query string change without being remounted', async () => {
    const { rerender } = render(<MapPage />);
    await screen.findByTestId('universe-map');

    searchParams = new URLSearchParams('scope=WORMHOLE');
    rerender(<MapPage />);

    expect(scopes.at(-1)).toBe('WORMHOLE');
  });

  it('falls back to New Eden for a scope with no scene', async () => {
    searchParams = new URLSearchParams('scope=ABYSSAL');
    render(<MapPage />);
    expect(await screen.findByTestId('universe-map')).toHaveTextContent(
      'NEW_EDEN',
    );
  });

  it('cancels the main padding so the canvas fills the viewport', async () => {
    render(<MapPage />);
    const canvas = await screen.findByTestId('universe-map');
    const wrapper = canvas.parentElement as HTMLElement;

    expect(wrapper).toHaveClass('-mx-6', '-my-8', 'h-[calc(100%+4rem)]');
  });
});
```

`dynamic(..., { ssr: false })` bir Promise döndürdüğü için sorgular
`findBy*` — `getBy*` ilk render'da henüz bulamaz.

- [ ] **Step 2: `page.tsx`'i yaz**

```tsx
'use client';

import Loader from '@/components/Loader';
import { parseScope } from '@/utils/map/camera';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// deck.gl reaches for window and a WebGL context at module scope, so the canvas
// never renders on the server.
const UniverseMap = dynamic(
  () => import('@/components/UniverseMap/UniverseMap'),
  {
    ssr: false,
    loading: () => (
      <Loader size="lg" text="Loading the map..." className="h-full p-8" />
    ),
  },
);

function MapContent() {
  const searchParams = useSearchParams();

  // Derived on every render, not seeded on mount: App Router keeps this
  // component mounted when only the query string changes, so the UNIVERSE menu's
  // /map?scope=POCHVEN link would otherwise be swallowed. That was #201.
  const scope = parseScope(searchParams);

  // The map is the only page that wants the whole viewport. Rather than change
  // the header's height for every other page, it cancels main's own padding:
  // main is a flex-1 child of a full-height column, so 100% of its content box
  // plus the 4rem of vertical padding taken back is exactly what is left over
  // between header and footer.
  return (
    <div className="-mx-6 -my-8 h-[calc(100%+4rem)] lg:-mx-8 xl:-mx-12 2xl:-mx-16">
      <UniverseMap scope={scope} />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading the map..." className="h-full p-8" />
      }
    >
      <MapContent />
    </Suspense>
  );
}
```

- [ ] **Step 3: Masaüstü menüsüne ekle**

`frontend/src/components/Header/Header.tsx`, UNIVERSE popover'ının **en
başına** (haritanın kapsayıcı olması, listedeki en genel giriş olduğu için):

```tsx
<NavPopoverLink
  href="/map"
  label="MAP"
  description="The whole of New Eden in one continuous zoom, with Pochven and wormhole space"
/>
```

- [ ] **Step 4: Mobil menüye ekle**

Aynı dosyada, mobil UNIVERSE disclosure'ının en başına:

```tsx
<MobileNavSubLink href="/map" onNavigate={closeMobileMenu}>
  MAP
</MobileNavSubLink>
```

- [ ] **Step 5: Testleri çalıştır**

```bash
yarn workspace frontend test src/app/map
```

Beklenen: PASS, 5 test.

- [ ] **Step 6: Prettier ve commit**

```bash
npx prettier --check frontend/src/app/map/*.tsx frontend/src/components/Header/Header.tsx
git add frontend/src/app/map/ frontend/src/components/Header/Header.tsx
git commit -m "feat(frontend): add the /map route and link it from the universe menu"
```

---

## Task 8: Tam doğrulama ve PR

Buraya kadar hiçbir adımda "geçiyor" denmedi; tam set yalnızca burada
çalışıyor. CLAUDE.md'nin sırası bağlayıcı.

- [ ] **Step 1: Çalışma ağacının temiz olduğunu doğrula**

Yeşil bir koşunun hangi commit hakkında kanıt olduğunu bilmenin tek yolu.

```bash
git status --short
```

Beklenen: boş.

- [ ] **Step 2: Codegen, sırasıyla**

```bash
yarn workspace backend codegen && yarn workspace frontend codegen
git status --short
```

Beklenen: `git status` yine boş — üretilen dosyalar Task 2 ve 3'te
commit'lendiği için burada fark çıkmamalı. Fark çıkarsa commit'lenmemiş bir
codegen çıktısı var, ekleyip commit et.

- [ ] **Step 3: Testler**

```bash
yarn test
```

Beklenen: backend ve frontend ayrı ayrı PASS. Bu planın eklediği test sayısı:
backend 16, frontend 60 (util'ler 33, katmanlar 13, bileşen 9, sayfa 5).

- [ ] **Step 4: Backend derlemesi**

```bash
yarn workspace backend build
```

Beklenen: çıktı yok, exit 0.

- [ ] **Step 5: Frontend typecheck ve lint**

```bash
yarn workspace frontend typecheck
yarn workspace frontend lint 2>&1 | tail -5
```

`lint` deponun genelinde önceden var olan sorunları sayıyor — 2026-09-10
itibarıyla 237. Sinyal temiz çıkış değil, **sayı**: `main`'le karşılaştır ve
girdilerden hiçbirinin bu branch'in dokunduğu bir dosyayı adlandırmadığını
doğrula.

```bash
git stash list  # boş olmalı
yarn workspace frontend lint 2>&1 | grep -c "^\s*[0-9]*:[0-9]*" || true
yarn workspace frontend lint 2>&1 | grep -E "UniverseMap|utils/map|app/map|Header.tsx" || echo "none of the branch's files"
```

- [ ] **Step 6: Frontend build**

Dev sunucusu çalışıyorsa `build:check` kullan — `build` çalışan sunucunun
`.next`'ini altından çeker.

```bash
yarn workspace frontend build:check
```

Beklenen: başarılı build, `/map` rota listesinde.

- [ ] **Step 7: Prettier, tüm repo**

```bash
npx prettier --check .
```

Beklenen: `All matched files use Prettier code style!`

- [ ] **Step 8: Veriyi doğrudan GraphQL ile doğrula**

Üç sahnenin de canlı sunucudan ölçülen sayıları döndürdüğünü son bir kez gör.

```bash
PORT=$(grep -m1 '^PORT=' backend/.env | cut -d= -f2)
for scope in NEW_EDEN POCHVEN WORMHOLE; do
  curl -s "http://localhost:$PORT/graphql" -H 'Content-Type: application/json' \
    -d "{\"operationName\":\"MapGeometry\",\"query\":\"query MapGeometry { mapGeometry(scope: $scope) { nodes { systemId } edges { from to } } }\"}" \
    | python3 -c "
import json,sys
g = json.load(sys.stdin)['data']['mapGeometry']
print('$scope', len(g['nodes']), 'nodes', len(g['edges']), 'edges')"
done
```

Beklenen: `NEW_EDEN 5241 nodes 6959 edges`, `POCHVEN 27 nodes 30 edges`,
`WORMHOLE 2604 nodes 0 edges`.

- [ ] **Step 9: Kullanıcıya ne bakacağını söyle**

Görsel ve his doğrulaması kullanıcıda. Bu fazda bakılacaklar:

- `/map` açılışta New Eden'ın tamamı kadrajda, kenarlardaki noktalar kırpılmamış.
- Güvenlik renkleri bölge küçük haritalarındakiyle aynı
  (`/regions/10000002` kartındaki SVG ile aynı sistemin rengi).
- Zoom'da 13 seviye boyunca titreme yok; noktalar büyürken gate hatları
  yerinde kalıyor.
- Pan/zoom durduktan ~250 ms sonra URL'deki `x`, `z`, `zoom` değişiyor; adres
  çubuğundaki URL yeni bir sekmede aynı kareyi kuruyor.
- Menüden UNIVERSE → MAP, sonra tarayıcı geri tuşu: kamera geri geliyor.
- `/map?scope=POCHVEN` 27 sistem ve 30 hat; `/map?scope=WORMHOLE` geçit yok,
  yalnızca bulut.

- [ ] **Step 10: Push ve PR aç**

```bash
git push -u origin feature/universe-map
```

PR gövdesi düzyazı bölümlerle (#195/#196 biçimi), checkbox şablonu değil.
Kapsaması gerekenler:

- Ne geldi: üç sahne, `mapGeometry`, deck.gl tuvali, kayan orijin, URL'de
  kamera ve kapsam, `/map`.
- Ne gelmedi ve hangi fazda: sistem içleri ve gate uçlarının çapalanması
  (faz 2), picking/popup/`?focus=` (faz 3), aktivite ve sovereignty
  territory (faz 4).
- Ölçülen sayılar: düğüm/kenar sayıları, 197 KB gzip payload, sorgu süreleri.
- İki tasarım kararı ve gerekçesi: `securityStatus`'un kesilmesi (14 sistem),
  `Header`'a dokunmadan yerleşim.
- Spec'e bağlantı: `docs/superpowers/specs/2026-09-12-universe-map-design.md`.

---

## Self-review

Spec'in bölümleri ve bu planın onları karşıladığı yer:

| Spec bölümü                        | Faz 1 kapsamı                                             | Task |
| ---------------------------------- | --------------------------------------------------------- | ---- |
| Sahne modeli (üç kapsam)           | Tamamı                                                    | 1    |
| Koordinat sistemi, metre           | Tamamı                                                    | 1, 4 |
| Kayan orijin                       | Sahne merkezi; sistem merkezi faz 2                       | 4, 5 |
| Zoom merdiveni ve LOD              | Yalnızca fit ve `fit + 13` tavanı                         | 4, 6 |
| Şema                               | `MapGeometry` bloğu; celestial/activity/sov faz 2-4       | 2    |
| Servis + Redis anahtarları         | `map:geometry:{scope}`                                    | 1    |
| Response cache kaydı               | Tamamı                                                    | 2    |
| Route ve yerleşim                  | Tamamı (spec'ten sapmayla)                                | 7    |
| İki tür state, iki ayrı kural      | Tamamı                                                    | 6, 7 |
| Katman yığını                      | Gate hatları + sistemler; diğer altı katman faz 2-4       | 5    |
| Renk katmanı kaydı                 | **Kapsam dışı** — faz 4; rampa saf fonksiyon olarak geldi | 4    |
| Performans (ayrık LOD kovası)      | **Kapsam dışı** — faz 2, LOD eşikleriyle birlikte         | —    |
| Hata ve boş durumlar               | Tamamı                                                    | 6    |
| Etkileşim (picking, popup, klavye) | **Kapsam dışı** — faz 3                                   | —    |
| Overlay'ler (sov, aktivite)        | **Kapsam dışı** — faz 4                                   | —    |
| Test ve kabul kriterleri           | Faz 1'e düşenlerin tamamı                                 | 1-8  |

Spec'in kabul kriterlerinden faz 1'e düşenler ve karşılayan test:

| Kriter                                         | Nerede                                          |
| ---------------------------------------------- | ----------------------------------------------- |
| Hiçbir katmana ham galaktik koordinat girmiyor | `layers.spec.ts` (iki test), `origin.spec.ts`   |
| Her kenar bir kez, `from < to`; 6959 / 30 / 0  | `universe-map.service.spec.ts` + Task 1 Step 6  |
| Düğümler 1e9 m'ye yuvarlanmış                  | `universe-map.service.spec.ts` + Task 1 Step 6  |
| `securityStatus` kesilmiş, sınıf kaymıyor      | Task 1 Step 3 SQL'i + Task 2 Step 7 canlı sorgu |
| Kapsam yüklemleri 5241 / 27 / 2604             | Task 1 Step 6, Task 8 Step 8                    |
| Payload ≤200 KB gzip                           | Task 2 Step 7                                   |
| Komut seti, CLAUDE.md sırasıyla                | Task 8                                          |
