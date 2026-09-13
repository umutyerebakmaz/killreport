# Evren haritası etiketleri — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Haritaya zoom'la açılan ve biriken üç kademe isim eklemek — bölge,
takımyıldız, sistem.

**Architecture:** Backend'e `mapLabels(scope, kind)` sorgusu; bölge merkezi
sahnenin kendi sistem kümesinden hesaplanıyor. Frontend'de etiketler `world`'ün
değil `stage`'in üstünde, yani ekran uzayında — aynalanma doğmuyor, piksel
boyutu sabit, çarpışma filtresi zaten çalışması gereken uzayda. Takımyıldız
verisi eşiğe kadar hiç çekilmiyor.

**Tech Stack:** TypeScript, GraphQL Yoga, Prisma `$queryRaw` (`@services/prisma`),
Redis, Next.js App Router + React 19, PixiJS 8.20.1 (`BitmapText`), Vitest 5.
**Yeni bağımlılık yok.**

**Spec:** [`../specs/2026-09-14-universe-map-labels-design.md`](../specs/2026-09-14-universe-map-labels-design.md)

---

## Global Constraints

- **Yarn, asla npm.** Bu plan bağımlılık eklemiyor; `yarn.lock` yalnızca
  Task 1'de değişmemeli — hiçbir task'ta değişmemeli.
- **Migration yok.** `prisma migrate dev` beş tabloyu düşürür. Bu plan şema
  değiştirmiyor, yalnızca okuyor.
- **`.graphql` değişiyor → codegen gerekiyor**, sırası sabit: **backend → frontend.**
- **Üretilmiş dosyalar elle düzenlenmiyor.**
- **`.env`'e dokunulmaz.** Bu checkout'ta backend `PORT=4010`, frontend `:3000`.
- **`lint` kabul kriteri `main`'in sayısı, sıfır fark.** Bu plan yazılırken 228.
- Commit ve PR metinleri **İngilizce**, `type(scope):` sonrası küçük harf,
  Claude atıfsız.

---

## Ölçülmüş sabitler

Spec'ten taşınıyor:

| Kademe      | Medyan en yakın komşu |       Eşik |  Adet | Payload            |
| ----------- | --------------------: | ---------: | ----: | ------------------ |
| Bölge       |           7,4114e16 m | **−50,13** |   114 | 3 KB gzip          |
| Takımyıldız |           1,3129e16 m | **−47,64** | 1.184 | 31 KB gzip         |
| Sistem      |           3,4944e15 m | **−45,73** | 5.241 | 0 (`MapNode.name`) |

Galaksi fit'i −50,04 (1400×900) / −49,36 (2560×1440). Mevcut eşikler:
`APPROACH_ZOOM = -40`, `INTERIOR_ZOOM = -36.18`, `FINE_ZOOM = -26.51`,
`MAX_ZOOM = -24.51`. Görünür etiket tavanı **300**.

---

## Spec'in sessiz kaldığı yerler ve verdiğim kararlar

### 1. Sahne yüklemi iki parçalı, ve ikisi de gerekiyor

`universe-map.service.ts` sahneyi iki yüklemle kuruyor:

- `scopePredicate(scope)` — bölge id bandı (`backend/src/services/universe/universe-map.service.ts:73`)
- `gatelessFilter(scope)` — NEW_EDEN'de gate'i olmayan **217 Jove sistemini**
  atıyor (`:95`)

Etiket servisi **ikisini birden** kullanmak zorunda. Yalnızca ilkini kullanırsa
bölge merkezleri haritada olmayan sistemleri de sayar ve etiket kayar; ayrıca
yalnızca Jove sistemi olan bir takımyıldız listeye girer ve üzerinde hiç nokta
olmayan bir isim çizilir.

Bu yüzden iki fonksiyon `export` ediliyor ve etiket servisi onları import
ediyor — kopyalanmıyor. Kopya, iki sorgunun sahne tanımının sessizce ayrışması
demek.

### 2. Sistem etiketleri sorgu istemiyor

Üçüncü kademenin verisi `mapGeometry`'nin `nodes`'unda zaten var. `mapLabels`
yalnızca `REGION` ve `CONSTELLATION` biliyor; `MapLabelKind`'a `SYSTEM` üyesi
**eklenmiyor**, çünkü o sorgudan hiç dönmeyecek bir üye olurdu.

Frontend tarafında üç kademe tek listede birleşiyor — birleştirme
`utils/map/labels.ts`'in işi.

### 3. Etiket konumu ekranda, aday listesi dünyada

Çarpışma filtresi ekran koordinatı istiyor ama adaylar dünya koordinatında
geliyor. Dönüşüm `cameraTransform`'un zaten döndürdüğü çarpımın aynısı, ve
**saf fonksiyonda** yapılıyor — `scene/labels.ts` hazır ekran koordinatı alıyor.

### 4. Metin genişliği ölçülmeden kutu kurulamaz

Çarpışma filtresi her adayın ekran kutusunu bilmek zorunda, kutu da metnin
genişliğine bağlı. `BitmapText` genişliği ancak nesne kurulduktan sonra biliniyor
ve saf fonksiyonun Pixi'ye erişimi yok.

Karar: **genişlik filtreye parametre olarak giriyor.** Çağıran (bileşen) her
aday için `measureLabel(name, tier)` ile ölçüp verir; filtre yalnızca sayılarla
çalışır ve testlenebilir kalır. Ölçüm karakter başına sabit genişlikle yapılıyor
— `BitmapText` tek boşluklu değil ama font atlası tek boyutta ve ~%10 hata
çarpışma filtresi için önemsiz; kesin ölçüm gerekirse `scene/` tarafında
yapılır ve filtreye geçirilir.

---

## Dosya yapısı

| Dosya                                                              | Sorumluluk                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `backend/src/services/universe/universe-map.service.ts`            | `scopePredicate` ve `gatelessFilter` `export` ediliyor (değişiklik) |
| `backend/src/services/universe/map-labels.service.ts` + `.spec.ts` | `getMapLabels(scope, kind)` — Redis, `$queryRaw`, bölge merkezi     |
| `backend/src/services/universe/index.ts`                           | Barrel'a ekleme (değişiklik)                                        |
| `backend/src/schemas/UniverseMap.graphql`                          | `MapLabelKind`, `MapLabel`, `Query.mapLabels` (değişiklik)          |
| `backend/src/resolvers/universe-map/queries.ts`                    | Tek satırlık orkestrasyon (değişiklik)                              |
| `backend/src/config/cache.ts`                                      | `'MapLabels'` + `Query.mapLabels` TTL (değişiklik)                  |
| `frontend/src/graphql/MapLabels.graphql`                           | Tek sorgu dokümanı                                                  |
| `frontend/src/utils/map/lod.ts` + `.spec.ts`                       | Üç etiket eşiği ve `visibleLabelTiers` (değişiklik)                 |
| `frontend/src/utils/map/labels.ts` + `.spec.ts`                    | Aday üretimi, ekran dönüşümü, çarpışma filtresi                     |
| `frontend/src/components/UniverseMap/useMapLabels.ts`              | Kademeli çekim — takımyıldızlar eşikte                              |
| `frontend/src/components/UniverseMap/scene/labels.ts`              | `BitmapText` yazımı, font atlası                                    |
| `frontend/src/components/UniverseMap/UniverseMap.tsx`              | Etiket katmanının bağlanması (değişiklik)                           |

---

## Task 1: `mapLabels` servisi

**Files:**

- Modify: `backend/src/services/universe/universe-map.service.ts` (iki fonksiyonu `export` et)
- Create: `backend/src/services/universe/map-labels.service.ts`
- Create: `backend/src/services/universe/map-labels.service.spec.ts`
- Modify: `backend/src/services/universe/index.ts`

**Interfaces:**

- Consumes: `MapScope` ve `scopePredicate`, `gatelessFilter` (aynı dosyadan,
  bu task'ta `export` hâline geliyorlar).
- Produces:

  ```ts
  export type MapLabelKind = 'REGION' | 'CONSTELLATION';
  export interface MapLabel {
    id: number;
    name: string;
    kind: MapLabelKind;
    x: number;
    z: number;
  }
  export const LABELS_CACHE_TTL_SECONDS = 86400;
  export function labelsCacheKey(scope: MapScope, kind: MapLabelKind): string;
  export function getMapLabels(
    scope: MapScope,
    kind: MapLabelKind,
  ): Promise<MapLabel[]>;
  ```

- [ ] **Step 1: İki yüklemi `export` et**

`universe-map.service.ts`'te iki satır değişiyor — `function scopePredicate`
`export function scopePredicate` oluyor, `function gatelessFilter` da
`export function gatelessFilter`. Gövdeleri ve doküman yorumları **aynen
kalıyor.**

```bash
cd /root/killreport
grep -n "^function scopePredicate\|^function gatelessFilter" backend/src/services/universe/universe-map.service.ts
```

- [ ] **Step 2: Testi yaz (kırmızı)**

`backend/src/services/universe/map-labels.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = {
  get: vi.fn(),
  setex: vi.fn(),
};
vi.mock('@services/redis', () => ({ default: redis, redis }));

const prisma = { $queryRaw: vi.fn() };
vi.mock('@services/prisma', () => ({ default: prisma, prisma }));

import {
  getMapLabels,
  labelsCacheKey,
  LABELS_CACHE_TTL_SECONDS,
} from './map-labels.service';

beforeEach(() => {
  redis.get.mockReset();
  redis.setex.mockReset();
  prisma.$queryRaw.mockReset();
  redis.get.mockResolvedValue(null);
});

describe('labelsCacheKey', () => {
  it('keys on both the scene and the tier', () => {
    // One key per (scope, kind): a shared key would serve Pochven's regions
    // to New Eden, and a key without the kind would serve 114 regions where
    // 1,184 constellations were asked for.
    expect(labelsCacheKey('NEW_EDEN', 'REGION')).toBe(
      'map:labels:NEW_EDEN:REGION',
    );
    expect(labelsCacheKey('POCHVEN', 'CONSTELLATION')).toBe(
      'map:labels:POCHVEN:CONSTELLATION',
    );
  });

  it('never collides across the two tiers of one scene', () => {
    expect(labelsCacheKey('NEW_EDEN', 'REGION')).not.toBe(
      labelsCacheKey('NEW_EDEN', 'CONSTELLATION'),
    );
  });
});

describe('getMapLabels', () => {
  it('returns the cached value without touching the database', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify([
        { id: 10000002, name: 'The Forge', kind: 'REGION', x: 1e17, z: -2e17 },
      ]),
    );

    const labels = await getMapLabels('NEW_EDEN', 'REGION');

    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('The Forge');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('queries and caches on a miss, at the static TTL', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 20000020, name: 'Kimotoro', x: 1.5e17, z: -2.5e17 },
    ]);

    const labels = await getMapLabels('NEW_EDEN', 'CONSTELLATION');

    expect(labels).toEqual([
      {
        id: 20000020,
        name: 'Kimotoro',
        kind: 'CONSTELLATION',
        x: 1.5e17,
        z: -2.5e17,
      },
    ]);
    expect(redis.setex).toHaveBeenCalledWith(
      'map:labels:NEW_EDEN:CONSTELLATION',
      LABELS_CACHE_TTL_SECONDS,
      expect.any(String),
    );
    expect(LABELS_CACHE_TTL_SECONDS).toBe(86400);
  });

  it('stamps the kind onto every row rather than trusting the query', async () => {
    // The SQL selects id/name/x/z; the tier is what the caller asked for, so it
    // is stamped here. A row that carried its own kind could disagree with the
    // cache key it was stored under.
    prisma.$queryRaw.mockResolvedValue([
      { id: 1, name: 'A', x: 0, z: 0 },
      { id: 2, name: 'B', x: 1, z: 1 },
    ]);

    const labels = await getMapLabels('WORMHOLE', 'REGION');

    expect(labels.map((l) => l.kind)).toEqual(['REGION', 'REGION']);
  });

  it('returns an empty list rather than throwing when a scene has no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(getMapLabels('POCHVEN', 'CONSTELLATION')).resolves.toEqual([]);
  });

  it('caches an empty result too, so an empty scene is not re-queried', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('POCHVEN', 'REGION');
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it('runs one query, not one per row', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 1, name: 'A', x: 0, z: 0 },
      { id: 2, name: 'B', x: 1, z: 1 },
      { id: 3, name: 'C', x: 2, z: 2 },
    ]);
    await getMapLabels('NEW_EDEN', 'REGION');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Testi çalıştır, kırmızı gör**

```bash
yarn workspace backend test src/services/universe/map-labels
```

Beklenen: `Cannot find module './map-labels.service'`.

- [ ] **Step 4: Servisi yaz**

`backend/src/services/universe/map-labels.service.ts`:

```ts
import prisma from '@services/prisma';
import redis from '@services/redis';
import { Prisma } from '@prisma/client';
import {
  gatelessFilter,
  scopePredicate,
  type MapScope,
} from './universe-map.service';

export type MapLabelKind = 'REGION' | 'CONSTELLATION';

export interface MapLabel {
  id: number;
  name: string;
  kind: MapLabelKind;
  x: number;
  z: number;
}

/** Static universe data, same as the geometry it sits beside. */
export const LABELS_CACHE_TTL_SECONDS = 86400;

export function labelsCacheKey(scope: MapScope, kind: MapLabelKind): string {
  return `map:labels:${scope}:${kind}`;
}

interface LabelRow {
  id: number;
  name: string;
  x: number;
  z: number;
}

/**
 * The two tiers differ in one way that matters: a constellation already has a
 * position, and a region does not.
 *
 * Both queries go through the SAME scene predicate the geometry uses —
 * scopePredicate plus gatelessFilter — imported rather than copied. NEW_EDEN's
 * gateless filter drops 217 Jove systems; a label query that skipped it would
 * shift every region centroid and could list a constellation with no drawn
 * system under it.
 */
function labelQuery(scope: MapScope, kind: MapLabelKind): Prisma.Sql {
  const scene = scopePredicate(scope);
  const gateless = gatelessFilter(scope);

  if (kind === 'CONSTELLATION') {
    // Measured 2026-09-14: zero constellations have a null position, and a
    // constellation's own position sits within 0.23 ly of its members' centroid,
    // so it is used directly.
    return Prisma.sql`
      SELECT DISTINCT c.constellation_id AS id, c.name AS name,
             c.position_x AS x, c.position_z AS z
      FROM constellations c
      JOIN solar_systems s ON s.constellation_id = c.constellation_id
      WHERE ${scene}
        AND c.position_x IS NOT NULL AND c.position_z IS NOT NULL
        ${gateless}
      ORDER BY id
    `;
  }

  // A region has a name and nothing else. The centroid is the mean of the
  // systems this scene actually draws — the region's visual centre of mass.
  return Prisma.sql`
    SELECT r.region_id AS id, r.name AS name,
           AVG(s.position_x) AS x, AVG(s.position_z) AS z
    FROM regions r
    JOIN constellations c ON c.region_id = r.region_id
    JOIN solar_systems s ON s.constellation_id = c.constellation_id
    WHERE ${scene}
      AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL
      ${gateless}
    GROUP BY r.region_id, r.name
    ORDER BY id
  `;
}

export async function getMapLabels(
  scope: MapScope,
  kind: MapLabelKind,
): Promise<MapLabel[]> {
  const key = labelsCacheKey(scope, kind);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapLabel[];

  const rows = await prisma.$queryRaw<LabelRow[]>(labelQuery(scope, kind));

  // The kind is stamped from the argument, not read from the row: it is the
  // thing the cache key was built on, and a row that carried its own could
  // disagree with the key it is stored under.
  const labels: MapLabel[] = rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    kind,
    x: Number(row.x),
    z: Number(row.z),
  }));

  // Cached even when empty: an empty scene is a fact, not a miss, and
  // re-querying it every request would be a slow way to learn nothing.
  await redis.setex(key, LABELS_CACHE_TTL_SECONDS, JSON.stringify(labels));
  return labels;
}
```

- [ ] **Step 5: Barrel'a ekle**

`backend/src/services/universe/index.ts`'e, mevcut iki satırın arasına:

```ts
export * from './map-labels.service';
```

- [ ] **Step 6: Testi çalıştır**

```bash
yarn workspace backend test src/services/universe/map-labels
yarn workspace backend build
```

Beklenen: 7 test yeşil, `tsc --noEmit` temiz.

- [ ] **Step 7: Gerçek veritabanına karşı doğrula**

Backend `:4010`'da açıkken bir kerelik script yerine `psql` ile:

```bash
cd /root/killreport/backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -t -A -c "
SELECT COUNT(*) FROM (
  SELECT r.region_id
  FROM regions r
  JOIN constellations c ON c.region_id=r.region_id
  JOIN solar_systems s ON s.constellation_id=c.constellation_id
  WHERE c.region_id BETWEEN 10000001 AND 10999999 AND c.region_id <> 10000070
    AND EXISTS (SELECT 1 FROM stargates g WHERE g.solar_system_id = s.system_id)
  GROUP BY r.region_id) t;"
```

Kabul: **67.** Türetilişi: 70 k-space bölgesi, eksi Pochven, eksi hiç stargate'i
olmayan iki bölge — J7HZ-F (10000017) ve A821-A (10000019). İkisi de gerçekten
gate'siz, yani `gatelessFilter`'ın onları düşürmesi doğru davranış.

114 çıkarsa yüklemlerden biri uygulanmamış demektir.

`COUNT(*)`'ın alt sorgu içinde olması ve `-A` gerekli: `psql -t` çıktısına
sondaki boş satırı ekliyor, `| wc -l` onu da sayıyor ve sonuç bir fazla çıkıyor.

- [ ] **Step 8: Prettier ve commit**

```bash
cd /root/killreport
npx prettier --check backend/src/services/universe
git add backend/src/services/universe
git commit -m "feat(backend): add the map labels service with a per-tier cache"
```

---

## Task 2: Şema, resolver ve response cache kaydı

**Files:**

- Modify: `backend/src/schemas/UniverseMap.graphql`
- Modify: `backend/src/resolvers/universe-map/queries.ts`
- Modify: `backend/src/config/cache.ts`
- Regenerate: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`

**Interfaces:**

- Consumes: `getMapLabels(scope, kind)` (Task 1).
- Produces: `Query.mapLabels(scope: MapScope! = NEW_EDEN, kind: MapLabelKind!): [MapLabel!]!`

- [ ] **Step 1: Şemayı genişlet**

`backend/src/schemas/UniverseMap.graphql`'in sonuna, `extend type Query`
bloğundan **önce**:

```graphql
"Bir etiketin kademesi. Sistem adları mapGeometry'den geldiği için burada yok."
enum MapLabelKind {
  REGION
  CONSTELLATION
}

"""
Haritada bir isim. Koordinat **galaktik metre**, düğümlerle aynı uzayda.
Bölgede konum yok ve sahnenin çizdiği sistemlerin ortalamasından hesaplanıyor;
takımyıldızda constellations.position_x/z doğrudan kullanılıyor.
"""
type MapLabel {
  "Bölgede region_id, takımyıldızda constellation_id. Bantlar çakışmıyor ama tek anahtar isteyen bir tüketici kind ile birlikte anahtarlamalı."
  id: Int!
  name: String!
  kind: MapLabelKind!
  x: Float!
  z: Float!
}
```

ve `extend type Query` bloğunun içine, `mapCelestials`'ın altına:

```graphql
  """
  Verilen sahnenin bir kademesinin adları. Statik evren verisi; servis Redis'te
  86400 s tutuyor, API'den görünen tazelik response cache'in STATIC_GAME_DATA'sı.
  """
  mapLabels(scope: MapScope! = NEW_EDEN, kind: MapLabelKind!): [MapLabel!]!
```

- [ ] **Step 2: Codegen, sırasıyla**

```bash
cd /root/killreport
yarn workspace backend codegen
grep -n "MapLabelKind" backend/src/generated-types.ts | head -3
```

Frontend codegen **bu task'ta çalıştırılmıyor** — frontend dokümanı Task 4'te
yazılıyor ve codegen onunla birlikte koşuyor.

- [ ] **Step 3: Resolver'ı genişlet**

#### Enum asimetrisi, ve neden cast yok

Servis `kind`'ı TypeScript string birleşimi olarak döndürüyor
(`'REGION' | 'CONSTELLATION'`); GraphQL alanı üretilmiş `MapLabelKind`
enum'unu istiyor. **Bu yön atanabilir değil** — TypeScript'in string enum'ları
nominal, yani `'REGION'` bir `MapLabelKind` değil. (Ters yön çalışıyor: enum
üyesi kendi literal tipine atanabilir, o yüzden `args.kind`'ı servise vermek
sorunsuz.)

`mapCelestials` bunu 2026-09-13'te çözdü ve çözümü kopyalanıyor:
`backend/src/resolvers/universe-map/queries.ts:15`'te **tüketici bir `Record`**,
cast değil. Cast, servise yeni bir kind eklendiğinde sessizce geçerdi; `Record`
derlemeyi durdurur.

Aynı dosyaya, `CELESTIAL_KIND`'ın hemen altına:

```ts
/**
 * Same asymmetry as CELESTIAL_KIND above: the service speaks string literals,
 * the schema speaks an enum, and TypeScript's string enums are nominal. An
 * exhaustive Record converts without a cast — add a tier to the service and
 * this stops compiling, which is exactly what a cast would have hidden.
 */
const LABEL_KIND: Record<ServiceLabelKind, MapLabelKind> = {
  REGION: MapLabelKind.Region,
  CONSTELLATION: MapLabelKind.Constellation,
};
```

`ServiceLabelKind`, servisin `MapLabelKind`'ı — mevcut `ServiceCelestialKind`
importunun yanına, aynı yeniden adlandırma biçimiyle:

```ts
import type { MapLabelKind as ServiceLabelKind } from '@services/universe';
```

ve resolver, `mapCelestials`'ın hemen altına:

```ts
  mapLabels: async (_, { scope, kind }) => {
    const labels = await getMapLabels(scope, kind);
    return labels.map((l) => ({ ...l, kind: LABEL_KIND[l.kind] }));
  },
```

`getMapLabels` importu `@services/universe`'ten, mevcut import satırına
ekleniyor. `MapLabelKind` (üretilmiş enum) importu da üretilmiş tiplerden,
`MapCelestialKind`'ın yanına.

- [ ] **Step 4: Response cache'e kaydet**

`backend/src/config/cache.ts`'te `mapGeometry` ve `mapCelestials` nerede
listeleniyorsa `'MapLabels'` operasyon adı ve `Query.mapLabels` TTL'i aynı
`STATIC_GAME_DATA` grubuna ekleniyor. Mevcut iki satırın biçimini birebir taklit
et — bu dosyada icat edilecek bir şey yok.

```bash
grep -n "MapCelestials\|mapCelestials" backend/src/config/cache.ts
```

- [ ] **Step 5: Derle ve test et**

```bash
yarn workspace backend build
yarn workspace backend test
```

- [ ] **Step 6: Canlı sorguyla doğrula**

Backend `:4010`'da açıkken:

```bash
for K in REGION CONSTELLATION; do
  echo -n "$K: "
  curl -s -X POST http://localhost:4010/graphql -H 'Content-Type: application/json' \
    -d "{\"query\":\"query MapLabels{ mapLabels(scope: NEW_EDEN, kind: $K){ id name kind x z } }\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['data']['mapLabels']; print(len(r), 'rows; all named:', all(x['name'] for x in r), '; sample:', r[0]['name'] if r else '-')"
done
```

Kabul: `REGION` **67**, `CONSTELLATION` **1.184'ten küçük ama yakın**
(gate'siz sistemli takımyıldızlar düşüyor), hepsinin adı dolu. Tekrarlayan
istekte `extensions.responseCache.hit` `true` olmalı.

- [ ] **Step 7: Prettier ve commit**

```bash
npx prettier --check backend/src
git add backend/src
git commit -m "feat(backend): expose the map labels query"
```

---

## Task 3: Eşikler ve görünür kademeler

**Files:**

- Modify: `frontend/src/utils/map/lod.ts`
- Modify: `frontend/src/utils/map/lod.spec.ts`

**Interfaces:**

- Produces:

  ```ts
  export const REGION_LABEL_ZOOM: number; // -50.13
  export const CONSTELLATION_LABEL_ZOOM: number; // -47.64
  export const SYSTEM_LABEL_ZOOM: number; // -45.73
  export type LabelTier = 'region' | 'constellation' | 'system';
  export function visibleLabelTiers(zoom: number): LabelTier[];
  ```

  Mevcut `APPROACH_ZOOM`, `INTERIOR_ZOOM`, `FINE_ZOOM`, `MAX_ZOOM`, `LodBucket`,
  `lodBucket`, `streamsInteriors`, `showsMoonsAndBelts`, `LayerVisibility`,
  `layerVisibility` **değişmeden kalıyor.**

- [ ] **Step 1: `lod.spec.ts`'e testleri ekle**

```ts
import {
  CONSTELLATION_LABEL_ZOOM,
  REGION_LABEL_ZOOM,
  SYSTEM_LABEL_ZOOM,
  visibleLabelTiers,
} from './lod';

describe('label thresholds', () => {
  it('is the zoom at which each tier’s median neighbour reaches 60 px', () => {
    // Measured 2026-09-14: median nearest-neighbour distance is 7.4114e16 m for
    // regions, 1.3129e16 for constellations, 3.4944e15 for systems. A name needs
    // ~60 px of separation to read, so the threshold is log2(60 / distance).
    expect(REGION_LABEL_ZOOM).toBeCloseTo(Math.log2(60 / 7.4114e16), 2);
    expect(CONSTELLATION_LABEL_ZOOM).toBeCloseTo(Math.log2(60 / 1.3129e16), 2);
    expect(SYSTEM_LABEL_ZOOM).toBeCloseTo(Math.log2(60 / 3.4944e15), 2);
  });

  it('opens the coarsest tier first and the finest last', () => {
    expect(REGION_LABEL_ZOOM).toBeLessThan(CONSTELLATION_LABEL_ZOOM);
    expect(CONSTELLATION_LABEL_ZOOM).toBeLessThan(SYSTEM_LABEL_ZOOM);
  });

  it('has regions readable from the galaxy fit itself', () => {
    // The fit is -50.04 on 1400x900 and -49.36 on 2560x1440; both are above the
    // region threshold, so region names are on the very first frame.
    expect(REGION_LABEL_ZOOM).toBeLessThan(-50.04);
  });

  it('opens every label tier below the approach threshold', () => {
    // All three land inside the galaxy bucket, which is why label visibility is
    // derived from the zoom directly rather than from a bucket.
    expect(SYSTEM_LABEL_ZOOM).toBeLessThan(-40);
  });
});

describe('visibleLabelTiers', () => {
  it('shows nothing below the region threshold', () => {
    // The camera can go two levels under the fit; at that distance 114 names
    // would sit on top of each other.
    expect(visibleLabelTiers(-52)).toEqual([]);
  });

  it('shows regions alone from their threshold up', () => {
    expect(visibleLabelTiers(-50)).toEqual(['region']);
    expect(visibleLabelTiers(-48)).toEqual(['region']);
  });

  it('accumulates rather than handing over', () => {
    // A tier opening does not close the one beneath it: zooming in adds names,
    // it does not swap them. The coarser tier stays as background context, the
    // way a map keeps a country name while showing cities.
    expect(visibleLabelTiers(-47)).toEqual(['region', 'constellation']);
    expect(visibleLabelTiers(-45)).toEqual([
      'region',
      'constellation',
      'system',
    ]);
  });

  it('keeps all three at the deepest zoom', () => {
    expect(visibleLabelTiers(-24.51)).toEqual([
      'region',
      'constellation',
      'system',
    ]);
  });

  it('returns the tiers coarsest first, which is the collision priority', () => {
    // The filter places labels in this order and drops what will not fit, so
    // the tier sacrificed in a crowd is always the finest one.
    expect(visibleLabelTiers(-45)[0]).toBe('region');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

```bash
yarn workspace frontend test src/utils/map/lod
```

- [ ] **Step 3: `lod.ts`'e ekle**

Dosyanın sonuna, mevcut hiçbir şeye dokunmadan:

```ts
/**
 * Label thresholds, measured 2026-09-14 against the production database.
 *
 * Each is the zoom at which that tier's median nearest-neighbour distance
 * reaches 60 px — the separation a name needs to read. The distances are
 * 7.4114e16 m between regions, 1.3129e16 between constellations and 3.4944e15
 * between systems, which puts the three about two levels apart without anyone
 * choosing that.
 *
 * All three sit inside the galaxy bucket, which is why label visibility is
 * derived from the zoom directly instead of from a LodBucket.
 *
 * The 60 px is a judgement, not a measurement: the distances were measured, the
 * readable separation was chosen. It is one constant, and it is meant to be
 * tuned by looking.
 */
export const REGION_LABEL_ZOOM = -50.13;
export const CONSTELLATION_LABEL_ZOOM = -47.64;
export const SYSTEM_LABEL_ZOOM = -45.73;

export type LabelTier = 'region' | 'constellation' | 'system';

/**
 * Which tiers are on screen, coarsest first.
 *
 * Tiers accumulate: opening one does not close the one beneath it. A map keeps
 * the country name while showing cities, and the viewport clip does most of the
 * thinning on its own — by the constellation threshold the screen covers a small
 * enough area that only one or two region centroids remain inside it.
 *
 * The order is also the collision priority. The coarsest tier is placed first,
 * so what gets sacrificed in a crowd is always the finest.
 */
export function visibleLabelTiers(zoom: number): LabelTier[] {
  const tiers: LabelTier[] = [];
  if (zoom >= REGION_LABEL_ZOOM) tiers.push('region');
  if (zoom >= CONSTELLATION_LABEL_ZOOM) tiers.push('constellation');
  if (zoom >= SYSTEM_LABEL_ZOOM) tiers.push('system');
  return tiers;
}
```

- [ ] **Step 4: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/utils/map/lod
yarn workspace frontend typecheck
npx prettier --check frontend/src/utils/map/lod.ts frontend/src/utils/map/lod.spec.ts
git add frontend/src/utils/map/lod.ts frontend/src/utils/map/lod.spec.ts
git commit -m "feat(frontend): say which label tiers each zoom shows"
```

Beklenen: mevcut 17 + bu task'ın 10'u = **27**.

---

## Task 4: Sorgu dokümanı ve kademeli çekim hook'u

**Files:**

- Create: `frontend/src/graphql/MapLabels.graphql`
- Create: `frontend/src/components/UniverseMap/useMapLabels.ts`
- Regenerate: `frontend/src/generated/graphql.ts`

**Interfaces:**

- Consumes: `visibleLabelTiers` (Task 3).
- Produces:
  ```ts
  export interface MapLabelData {
    id: number;
    name: string;
    kind: string;
    x: number;
    z: number;
  }
  export function useMapLabels(
    scope: MapScope,
    zoom: number | null,
  ): {
    regions: MapLabelData[];
    constellations: MapLabelData[];
  };
  ```

### Kademeli çekimin tam olarak nerede olduğu

Bölgeler mount'ta çekiliyor (3 KB). Takımyıldızlar **yalnızca** zoom
`CONSTELLATION_LABEL_ZOOM`'u geçtiğinde (31 KB). Sistem adları hiç çekilmiyor —
`mapGeometry`'nin `nodes`'unda zaten varlar ve bu hook onları hiç görmüyor.

Apollo'nun `skip`'i bunu tek satırda veriyor: `skip` doğruyken istek atılmıyor,
yanlışa dönünce atılıyor ve bir daha `skip` doğru olsa bile veri önbellekte
kalıyor. Yani eşiğin altına geri çıkmak veriyi atmıyor — 31 KB bir kez iniyor.

- [ ] **Step 1: Dokümanı yaz**

`frontend/src/graphql/MapLabels.graphql`:

```graphql
# Operasyon adı MapLabels olmak zorunda: backend'in response cache'i
# PUBLIC_CACHE_QUERIES'e operasyon adıyla bakıyor (backend/src/config/cache.ts).
query MapLabels($scope: MapScope!, $kind: MapLabelKind!) {
  mapLabels(scope: $scope, kind: $kind) {
    id
    name
    kind
    x
    z
  }
}
```

- [ ] **Step 2: Codegen, sırasıyla**

```bash
cd /root/killreport
yarn workspace backend codegen && yarn workspace frontend codegen
grep -n "useMapLabelsQuery" frontend/src/generated/graphql.ts | head -2
```

- [ ] **Step 3: Hook'u yaz**

`frontend/src/components/UniverseMap/useMapLabels.ts`:

```ts
'use client';

import {
  MapLabelKind,
  useMapLabelsQuery,
  type MapScope,
} from '@/generated/graphql';
import { CONSTELLATION_LABEL_ZOOM } from '@/utils/map/lod';

export interface MapLabelData {
  id: number;
  name: string;
  kind: string;
  x: number;
  z: number;
}

/**
 * The two label tiers that need fetching, staged by zoom.
 *
 * The rule this follows: a dataset shown only above a zoom threshold should not
 * be FETCHED below it either. Regions are 3 KB and arrive with the scene;
 * constellations are 31 KB and wait for -47.64, which is 2.4 levels above the
 * galaxy fit — so someone who opens the map and just looks never downloads them.
 *
 * System names are absent on purpose: mapGeometry's nodes already carry them.
 *
 * Once the constellation query has run, Apollo keeps the result. Zooming back
 * out re-skips the query but does not throw the data away, so the 31 KB is paid
 * at most once per session.
 */
export function useMapLabels(scope: MapScope, zoom: number | null) {
  const { data: regionData } = useMapLabelsQuery({
    variables: { scope, kind: MapLabelKind.Region },
    fetchPolicy: 'cache-first',
  });

  const { data: constellationData } = useMapLabelsQuery({
    variables: { scope, kind: MapLabelKind.Constellation },
    fetchPolicy: 'cache-first',
    skip: zoom === null || zoom < CONSTELLATION_LABEL_ZOOM,
  });

  return {
    regions: regionData?.mapLabels ?? [],
    constellations: constellationData?.mapLabels ?? [],
  };
}
```

- [ ] **Step 4: Typecheck ve commit**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/graphql/MapLabels.graphql frontend/src/components/UniverseMap/useMapLabels.ts
git add frontend/src/graphql frontend/src/components/UniverseMap/useMapLabels.ts frontend/src/generated/graphql.ts backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(frontend): fetch label tiers only once their zoom is reached"
```

---

## Task 5: Aday üretimi ve çarpışma filtresi

Bu task'ın tamamı saf fonksiyon ve tamamı testli. Etiket katmanının **bütün
kararları** burada; `scene/labels.ts` yalnızca sonucu çiziyor.

**Files:**

- Create: `frontend/src/utils/map/labels.ts`
- Create: `frontend/src/utils/map/labels.spec.ts`

**Interfaces:**

- Consumes: `LabelTier`, `visibleLabelTiers` (Task 3); `CameraTransform`
  (`utils/map/camera.ts`, alanları `scaleX`, `scaleY`, `x`, `y`).
- Produces:
  ```ts
  export const MAX_VISIBLE_LABELS: number; // 300
  export const LABEL_CHAR_WIDTH: Record<LabelTier, number>;
  export const LABEL_LINE_HEIGHT: Record<LabelTier, number>;
  export interface LabelSource {
    id: number;
    name: string;
    x: number;
    z: number;
  }
  export interface LabelCandidate {
    key: string;
    name: string;
    tier: LabelTier;
    screenX: number;
    screenY: number;
    halfWidth: number;
    halfHeight: number;
  }
  export function labelCandidates(input: {
    tiers: LabelTier[];
    regions: LabelSource[];
    constellations: LabelSource[];
    systems: LabelSource[];
    transform: CameraTransform;
    width: number;
    height: number;
  }): LabelCandidate[];
  export function placeLabels(candidates: LabelCandidate[]): LabelCandidate[];
  ```

### Metin genişliği neden parametre değil sabit

Çarpışma kutusu metnin genişliğini bilmek zorunda ve `BitmapText` genişliği
ancak nesne kurulduktan sonra biliniyor — saf fonksiyonun Pixi'ye erişimi yok.

Karar: **kademe başına sabit karakter genişliği.** `name.length * LABEL_CHAR_WIDTH[tier]`
gerçek genişliğe ~%10 hatayla yaklaşıyor, ve çarpışma filtresi için bu önemsiz —
filtre zaten "üst üste binmesin" diyor, piksel piksel hizalama yapmıyor. Gerçek
ölçüm gerekirse `scene/` tarafında yapılıp `halfWidth` olarak geçirilir; arayüz
buna hazır.

- [ ] **Step 1: `labels.spec.ts`'i yaz (kırmızı)**

```ts
import { describe, expect, it } from 'vitest';
import {
  labelCandidates,
  LABEL_CHAR_WIDTH,
  MAX_VISIBLE_LABELS,
  placeLabels,
  type LabelCandidate,
} from './labels';

// A camera at the galaxy fit on a 1400x900 canvas, centred on the origin.
const transform = { scaleX: 2 ** -50, scaleY: -(2 ** -50), x: 700, y: 450 };
const W = 1400;
const H = 900;

function source(id: number, name: string, x: number, z: number) {
  return { id, name, x, z };
}

describe('labelCandidates', () => {
  it('projects a world position into screen space with the camera transform', () => {
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'The Forge', 0, 0)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(c.screenX).toBeCloseTo(700, 6);
    expect(c.screenY).toBeCloseTo(450, 6);
  });

  it('puts a larger z higher on screen, not lower', () => {
    // +z is up. Getting this backwards is the one mistake that makes the map
    // disagree with the region thumbnails shipped elsewhere in the app.
    const above = 1 / transform.scaleX; // one screen pixel of world
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'A', 0, above)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(c.screenY).toBeCloseTo(449, 6);
  });

  it('drops candidates outside the viewport before anything else runs', () => {
    const offscreen = 5000 / transform.scaleX;
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'In', 0, 0), source(2, 'Out', offscreen, 0)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.name)).toEqual(['In']);
  });

  it('includes only the tiers it was given', () => {
    const candidates = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'R', 0, 0)],
      constellations: [source(2, 'C', 0, 0)],
      systems: [source(3, 'S', 0, 0)],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.tier)).toEqual(['region']);
  });

  it('orders candidates coarsest tier first', () => {
    // This order IS the collision priority; placeLabels relies on it.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation', 'system'],
      regions: [source(1, 'R', 0, 0)],
      constellations: [source(2, 'C', 3e16, 0)],
      systems: [source(3, 'S', 6e16, 0)],
      transform,
      width: W,
      height: H,
    });

    expect(candidates.map((c) => c.tier)).toEqual([
      'region',
      'constellation',
      'system',
    ]);
  });

  it('sizes the box from the name length and the tier', () => {
    const [c] = labelCandidates({
      tiers: ['region'],
      regions: [source(1, 'Jita', 0, 0)],
      constellations: [],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(c.halfWidth).toBeCloseTo((4 * LABEL_CHAR_WIDTH.region) / 2, 6);
  });

  it('gives every candidate a key that is unique across tiers', () => {
    // Region 10000002 and constellation 10000002 cannot collide today, but the
    // key carries the tier so a future tier cannot break this quietly.
    const candidates = labelCandidates({
      tiers: ['region', 'constellation'],
      regions: [source(42, 'R', 0, 0)],
      constellations: [source(42, 'C', 2e16, 0)],
      systems: [],
      transform,
      width: W,
      height: H,
    });

    expect(new Set(candidates.map((c) => c.key)).size).toBe(2);
  });
});

describe('placeLabels', () => {
  function box(
    name: string,
    tier: LabelCandidate['tier'],
    screenX: number,
    screenY: number,
  ): LabelCandidate {
    return {
      key: `${tier}:${name}`,
      name,
      tier,
      screenX,
      screenY,
      halfWidth: 20,
      halfHeight: 6,
    };
  }

  it('keeps labels that do not touch', () => {
    const placed = placeLabels([
      box('A', 'region', 100, 100),
      box('B', 'region', 400, 400),
    ]);

    expect(placed.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('drops the later of two overlapping labels', () => {
    const placed = placeLabels([
      box('A', 'region', 100, 100),
      box('B', 'region', 110, 102),
    ]);

    expect(placed.map((p) => p.name)).toEqual(['A']);
  });

  it('sacrifices the finer tier, because the input arrives coarsest first', () => {
    // The order is the priority. A constellation sitting on a region loses.
    const placed = placeLabels([
      box('Region', 'region', 100, 100),
      box('Constellation', 'constellation', 105, 100),
    ]);

    expect(placed.map((p) => p.name)).toEqual(['Region']);
  });

  it('treats touching-but-not-overlapping boxes as clear', () => {
    // Exactly adjacent: 100 + 20 === 140 - 20. Rejecting these would thin the
    // map for no reason.
    const placed = placeLabels([
      box('A', 'region', 100, 100),
      box('B', 'region', 140, 100),
    ]);

    expect(placed).toHaveLength(2);
  });

  it('stops at the cap', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      box(`L${i}`, 'system', (i % 20) * 200, Math.floor(i / 20) * 200),
    );

    expect(placeLabels(many).length).toBeLessThanOrEqual(MAX_VISIBLE_LABELS);
    expect(MAX_VISIBLE_LABELS).toBe(300);
  });

  it('returns an empty list for an empty input rather than throwing', () => {
    expect(placeLabels([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [box('A', 'region', 100, 100), box('B', 'region', 105, 100)];
    placeLabels(input);
    expect(input).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

```bash
yarn workspace frontend test src/utils/map/labels
```

Beklenen: `Cannot find module './labels'`.

- [ ] **Step 3: `labels.ts`'i yaz**

```ts
import type { CameraTransform } from './camera';
import type { LabelTier } from './lod';

/** The cap the design sets on how many names may be on screen at once. */
export const MAX_VISIBLE_LABELS = 300;

/**
 * Approximate character width in pixels, per tier.
 *
 * The collision box needs the text's width, and a BitmapText only knows its own
 * width once it exists — which a pure function cannot make. These constants
 * approximate it from the name's length, within about 10%, which is far below
 * what matters to a filter whose job is "do not overlap" rather than pixel
 * alignment. If exact measurement is ever needed, scene/ can measure and pass
 * halfWidth in; the interface already takes it.
 *
 * The tiers differ in size because the design gives each a role: region is
 * background and largest, system is foreground and smallest.
 */
export const LABEL_CHAR_WIDTH: Record<LabelTier, number> = {
  region: 9,
  constellation: 7,
  system: 5.5,
};

export const LABEL_LINE_HEIGHT: Record<LabelTier, number> = {
  region: 16,
  constellation: 13,
  system: 11,
};

export interface LabelSource {
  id: number;
  name: string;
  x: number;
  z: number;
}

export interface LabelCandidate {
  key: string;
  name: string;
  tier: LabelTier;
  screenX: number;
  screenY: number;
  halfWidth: number;
  halfHeight: number;
}

const TIER_SOURCES = ['region', 'constellation', 'system'] as const;

/**
 * World positions into screen-space boxes, viewport-clipped, coarsest tier first.
 *
 * The projection is the same multiply-add cameraTransform already describes —
 * note that scaleY is negative, so a larger z lands at a smaller screen y. That
 * is the map's +z-is-up contract, and it is the one thing here that silently
 * inverts if copied wrong.
 *
 * The returned order is the collision priority: coarsest first, so a crowd
 * sacrifices the finest tier.
 */
export function labelCandidates({
  tiers,
  regions,
  constellations,
  systems,
  transform,
  width,
  height,
}: {
  tiers: LabelTier[];
  regions: LabelSource[];
  constellations: LabelSource[];
  systems: LabelSource[];
  transform: CameraTransform;
  width: number;
  height: number;
}): LabelCandidate[] {
  const byTier: Record<LabelTier, LabelSource[]> = {
    region: regions,
    constellation: constellations,
    system: systems,
  };

  const candidates: LabelCandidate[] = [];

  for (const tier of TIER_SOURCES) {
    if (!tiers.includes(tier)) continue;

    const charWidth = LABEL_CHAR_WIDTH[tier];
    const halfHeight = LABEL_LINE_HEIGHT[tier] / 2;

    for (const source of byTier[tier]) {
      const screenX = source.x * transform.scaleX + transform.x;
      const screenY = source.z * transform.scaleY + transform.y;
      const halfWidth = (source.name.length * charWidth) / 2;

      // Clipped before anything else runs: the filter is O(n*k) and n is what
      // the viewport leaves, not what the scene holds.
      if (
        screenX + halfWidth < 0 ||
        screenX - halfWidth > width ||
        screenY + halfHeight < 0 ||
        screenY - halfHeight > height
      ) {
        continue;
      }

      candidates.push({
        key: `${tier}:${source.id}`,
        name: source.name,
        tier,
        screenX,
        screenY,
        halfWidth,
        halfHeight,
      });
    }
  }

  return candidates;
}

function overlaps(a: LabelCandidate, b: LabelCandidate): boolean {
  // Strict: boxes that exactly touch are clear. Rejecting those would thin the
  // map for nothing.
  return (
    Math.abs(a.screenX - b.screenX) < a.halfWidth + b.halfWidth &&
    Math.abs(a.screenY - b.screenY) < a.halfHeight + b.halfHeight
  );
}

/**
 * Greedy, single pass, in the order given.
 *
 * O(n*k) with k the number already placed. k is capped at 300 and the viewport
 * clip has already cut n, so the worst case is nothing in a frame.
 *
 * The input is not mutated; the caller keeps its candidate list.
 */
export function placeLabels(candidates: LabelCandidate[]): LabelCandidate[] {
  const placed: LabelCandidate[] = [];

  for (const candidate of candidates) {
    if (placed.length >= MAX_VISIBLE_LABELS) break;
    if (placed.some((other) => overlaps(candidate, other))) continue;
    placed.push(candidate);
  }

  return placed;
}
```

- [ ] **Step 4: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/utils/map/labels
yarn workspace frontend typecheck
npx prettier --check frontend/src/utils/map/labels.ts frontend/src/utils/map/labels.spec.ts
git add frontend/src/utils/map/labels.ts frontend/src/utils/map/labels.spec.ts
git commit -m "feat(frontend): place map labels without letting them overlap"
```

Beklenen: `labels.spec.ts` **14** test.

---

## Task 6: `scene/labels.ts`

**Bu task'ın testi yoktur.** Bütün kararlar Task 5'te verildi ve testlendi;
burada yalnızca `BitmapText` nesnelerine atama var. Doğrulaması Task 8'de,
kullanıcının gözüyle.

**Files:**

- Create: `frontend/src/components/UniverseMap/scene/labels.ts`
- Modify: `frontend/src/components/UniverseMap/scene/createScene.ts`

**Interfaces:**

- Consumes: `LabelCandidate`, `LABEL_LINE_HEIGHT` (Task 5); `LabelTier` (Task 3);
  `MapScene` (`scene/createScene.ts`).
- Produces:
  ```ts
  export const LABEL_FONT: Record<LabelTier, string>;
  export function installLabelFonts(): void;
  export function drawLabels(scene: MapScene, placed: LabelCandidate[]): void;
  ```
  `createScene` kazanıyor: `labels: Container` alanı.

### Katman `stage`'de, `world`'de değil

`labels` konteyneri `app.stage`'e **doğrudan** ekleniyor, `world`'ün içine
değil. Sebebi üç katlı: dünya konteynerinin y ölçeği negatif olduğu için
oradaki her `BitmapText` aynada çıkardı; ekran uzayında piksel boyutu
counter-scale gerektirmiyor; ve çarpışma filtresi zaten ekran koordinatı
üretiyor.

`world`'den **sonra** ekleniyor, yani isimler noktaların üstünde çiziliyor.

- [ ] **Step 1: `createScene`'e etiket konteynerini ekle**

`scene/createScene.ts`'te üç değişiklik. `MapScene` arayüzüne:

```ts
labels: Container;
```

Gövdede, `world`'ün `app.stage`'e eklendiği satırdan **sonra**:

```ts
// On the stage, not in world: world's y scale is negative, so a BitmapText
// inside it would render mirrored. Screen space also keeps the type at a
// constant pixel size with no counter-scale, and the collision filter already
// works in screen coordinates. Added after world, so names draw over dots.
const labels = new Container();
app.stage.addChild(labels);
```

ve döndürülen nesneye `labels,` alanı. `destroy` değişmiyor — `app.destroy`
zaten `stage`'in çocuklarını yok ediyor.

- [ ] **Step 2: `labels.ts`'i yaz**

```ts
import { LABEL_LINE_HEIGHT, type LabelCandidate } from '@/utils/map/labels';
import type { LabelTier } from '@/utils/map/lod';
import { BitmapFont, BitmapFontManager, BitmapText } from 'pixi.js';
import type { MapScene } from './createScene';

export const LABEL_FONT: Record<LabelTier, string> = {
  region: 'MapLabelRegion',
  constellation: 'MapLabelConstellation',
  system: 'MapLabelSystem',
};

/**
 * Per-tier styling. The design fixes the ORDER, not these numbers: the
 * background tier must read larger, dimmer and more spaced than the foreground
 * one. The values themselves are meant to be tuned by looking.
 *
 * Region is uppercase and letter-spaced because that is what makes a name read
 * as a region rather than as a big system.
 */
const TIER_STYLE: Record<
  LabelTier,
  { fontSize: number; letterSpacing: number; alpha: number; uppercase: boolean }
> = {
  region: { fontSize: 14, letterSpacing: 3, alpha: 0.45, uppercase: true },
  constellation: {
    fontSize: 12,
    letterSpacing: 1,
    alpha: 0.7,
    uppercase: false,
  },
  system: { fontSize: 11, letterSpacing: 0, alpha: 1, uppercase: false },
};

let installed = false;

/**
 * Three bitmap fonts, one per tier, generated once.
 *
 * BitmapText draws quads from a shared atlas; plain Text rasterises a texture
 * per unique string, and this map has 5,241 system names alone.
 *
 * A font per tier rather than one scaled three ways: the tiers differ by only a
 * few pixels, and scaling a 14 px atlas down to 11 px is visibly softer than
 * rasterising at 11. Three atlases of ASCII are small.
 */
export function installLabelFonts(): void {
  if (installed) return;

  for (const tier of ['region', 'constellation', 'system'] as const) {
    const style = TIER_STYLE[tier];
    BitmapFont.install({
      name: LABEL_FONT[tier],
      style: {
        fontFamily: 'Shentox, sans-serif',
        fontSize: style.fontSize,
        // White, because dynamicFill below needs it: it is what lets a tier be
        // tinted at runtime instead of costing another atlas.
        fill: 0xffffff,
        letterSpacing: style.letterSpacing,
      },
      // The preset rather than a hand-rolled range list. Task 8 Step 3 proves
      // every EVE name in this database is printable ASCII.
      chars: BitmapFontManager.ASCII,
      // Managed by the font, not the BitmapText — passing resolution to an
      // instance is ignored and logs a warning.
      resolution: window.devicePixelRatio || 1,
      // Kerning metadata costs memory and install time and buys nothing at
      // label sizes.
      skipKerning: true,
      // Runtime tinting without a new atlas per colour. Phase 4's colour
      // registry will want this; enabling it now costs nothing.
      dynamicFill: true,
    });
  }

  installed = true;
}

/**
 * Writes the placed labels onto the stage, reusing the text objects.
 *
 * This runs on EVERY camera change — every pointermove of a drag — so it is a
 * pool, not a rebuild. PixiJS's own performance guidance rates destroy-and-
 * recreate on frequently respawned objects as a high-severity mistake: it
 * deallocates GPU resources, triggers GC and forces fresh uploads. Creating up
 * to 300 BitmapText objects per pointer tick would be exactly that.
 *
 * The pool is keyed on `LabelCandidate.key` (`tier:id`), and a key's text never
 * changes — a region is always called the same thing. So a reused entry only
 * has its position and visibility touched, which is the cheap path BitmapText
 * exists for.
 *
 * Entries that fall out of the placed set are hidden rather than destroyed:
 * they come back as soon as the camera moves again, and a hidden Container
 * costs nothing to skip.
 */
export function drawLabels(scene: MapScene, placed: LabelCandidate[]): void {
  const pool = poolFor(scene);

  for (const candidate of placed) {
    let text = pool.get(candidate.key);

    if (!text) {
      const style = TIER_STYLE[candidate.tier];
      text = new BitmapText({
        text: style.uppercase ? candidate.name.toUpperCase() : candidate.name,
        style: { fontFamily: LABEL_FONT[candidate.tier] },
      });
      text.anchor.set(0.5);
      text.alpha = style.alpha;
      pool.set(candidate.key, text);
      scene.labels.addChild(text);
    }

    // Nudged above the dot rather than centred on it, so the name does not sit
    // on the mark it belongs to.
    text.position.set(
      candidate.screenX,
      candidate.screenY - LABEL_LINE_HEIGHT[candidate.tier],
    );
    text.visible = true;
  }

  // Everything not placed this pass goes invisible. Iterating the pool rather
  // than diffing two sets: the pool is bounded by how many distinct labels have
  // ever been on screen, and hiding is one property write.
  const shown = new Set(placed.map((candidate) => candidate.key));
  for (const [key, text] of pool) {
    if (!shown.has(key)) text.visible = false;
  }
}

/**
 * One pool per scene, hung off the scene object rather than a module-level Map
 * so a second scene — or a remount — does not inherit the first one's text.
 */
const POOLS = new WeakMap<MapScene, Map<string, BitmapText>>();

function poolFor(scene: MapScene): Map<string, BitmapText> {
  let pool = POOLS.get(scene);
  if (!pool) {
    pool = new Map();
    POOLS.set(scene, pool);
  }
  return pool;
}
```

- [ ] **Step 3: Derle ve commit et**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap/scene
git add frontend/src/components/UniverseMap/scene
git commit -m "feat(frontend): draw map labels as bitmap text on the stage"
```

Bu task test eklemez. `installLabelFonts`'un `chars` kümesi ASCII varsayıyor;
Task 8 bunu gerçek veriye karşı doğruluyor.

---

## Task 7: Bileşene bağlama

**Files:**

- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: Task 3–6'nın tamamı.

### Neden kendi efekti

Etiketler kova değişiminde değil **her kamera değişiminde** yeniden
yerleşiyor, çünkü konumları ekran uzayında. Bu yüzden mevcut kamera efektine
eklenmiyor, kendi efektine giriyor: bağımlılıkları farklı (etiket verisi de
dahil) ve mevcut efekti kirletmek 5.241 sprite'ın counter-scale'ini etiket
verisi değiştiğinde de tetiklerdi.

- [ ] **Step 1: Bileşeni değiştir**

Import bloğuna eklenenler:

```tsx
import { labelCandidates, placeLabels } from '@/utils/map/labels';
import { visibleLabelTiers } from '@/utils/map/lod';
import { drawLabels, installLabelFonts } from './scene/labels';
import { useMapLabels } from './useMapLabels';
```

`useMapCelestials` çağrısının altına:

```tsx
const { regions, constellations } = useMapLabels(scope, camera?.zoom ?? null);
```

Sahne kurulum efektinin içinde, `createScene` çözüldükten hemen sonra
(`setSceneReady(true)`'dan önce):

```tsx
// Generated once per session; the guard inside makes a second call free.
installLabelFonts();
```

Ve yeni bir efekt, kamera efektinin **altına**:

```tsx
// Labels live in screen space, so they re-place on every camera change rather
// than on a bucket change. Their own effect: the dependencies differ from the
// camera effect's, and folding them in would re-run the 5,241-sprite
// counter-scale whenever label data arrived.
useEffect(() => {
  const s = scene.current;
  if (!s || !sceneReady || !camera || !size.width) return;

  const tiers = visibleLabelTiers(camera.zoom);
  if (tiers.length === 0) {
    drawLabels(s, []);
    return;
  }

  const candidates = labelCandidates({
    tiers,
    regions,
    constellations,
    // System names ride in the geometry that is already loaded; this tier
    // costs no request at all.
    systems: (geometry?.nodes ?? []).map((node) => ({
      id: node.systemId,
      name: node.name,
      x: node.x,
      z: node.z,
    })),
    transform: cameraTransform(camera, size.width, size.height),
    width: size.width,
    height: size.height,
  });

  drawLabels(s, placeLabels(candidates));
}, [
  sceneReady,
  camera,
  size.width,
  size.height,
  geometry,
  regions,
  constellations,
]);
```

- [ ] **Step 2: Spec'e testleri ekle**

`UniverseMap.spec.tsx`'in `@/generated/graphql` mock'una `MapLabelKind` ve
`useMapLabelsQuery` ekleniyor, ve `./scene/labels` mock'lanıyor:

```tsx
// inside the existing vi.mock('@/generated/graphql', ...) factory:
  MapLabelKind: { Region: 'REGION', Constellation: 'CONSTELLATION' },
  useMapLabelsQuery: (options: { variables: { kind: string }; skip?: boolean }) => {
    labelQueries.push({ kind: options.variables.kind, skip: !!options.skip });
    return { data: { mapLabels: [] } };
  },
```

Dosyanın üstüne `let labelQueries: { kind: string; skip: boolean }[] = [];`,
`beforeEach`'e `labelQueries = [];`, ve scene mock'larının yanına:

```tsx
vi.mock('./scene/labels', () => ({
  installLabelFonts: vi.fn(),
  drawLabels: vi.fn(),
}));
```

Testler:

```tsx
it('does not fetch constellation names before their zoom is reached', () => {
  // The staged-fetch rule: 31 KB that is not shown is not downloaded. Someone
  // who opens the map and only looks never pays for it.
  searchParams = new URLSearchParams('x=0&z=0&zoom=-50');
  render(<UniverseMap scope={MapScope.NewEden} />);

  const constellation = labelQueries.find((q) => q.kind === 'CONSTELLATION');
  expect(constellation?.skip).toBe(true);
});

it('always fetches region names, which are 3 KB and wanted on the first frame', () => {
  searchParams = new URLSearchParams('x=0&z=0&zoom=-50');
  render(<UniverseMap scope={MapScope.NewEden} />);

  const region = labelQueries.find((q) => q.kind === 'REGION');
  expect(region?.skip).toBe(false);
});

it('fetches constellation names once past their threshold', () => {
  // -47.64 is the threshold; -47 is above it.
  searchParams = new URLSearchParams('x=0&z=0&zoom=-47');
  render(<UniverseMap scope={MapScope.NewEden} />);

  const constellation = labelQueries.find((q) => q.kind === 'CONSTELLATION');
  expect(constellation?.skip).toBe(false);
});
```

- [ ] **Step 3: Çalıştır ve commit et**

```bash
yarn workspace frontend test src/components/UniverseMap
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap
git add frontend/src/components/UniverseMap
git commit -m "feat(frontend): show the map's names, staged by zoom"
```

Beklenen: `UniverseMap.spec.tsx` mevcut sayısının üstüne **3**.

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
yarn install --immutable
```

Kabul: `lint` `main`'in sayısıyla **sıfır fark** (bu plan yazılırken 228).
`build:check` çıktısında `/map`. Test sayıları ölçülüp yazılır, tahmin edilmez.

- [ ] **Step 2: Canlı sorgu**

```bash
for K in REGION CONSTELLATION; do
  echo -n "$K: "
  curl -s -X POST http://localhost:4010/graphql -H 'Content-Type: application/json' \
    -d "{\"query\":\"query MapLabels{ mapLabels(scope: NEW_EDEN, kind: $K){ id name x z } }\"}" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['data']['mapLabels']; print(len(r),'rows; named:',all(x['name'] for x in r),'; finite:',all(isinstance(x['x'],(int,float)) for x in r))"
done
```

Kabul: `REGION` **67** (70 k-space bölgesi, eksi Pochven, eksi tamamen
gate'siz iki bölge: J7HZ-F ve A821-A), `CONSTELLATION` 1.184'e yakın ama
altında, hepsinin adı dolu ve koordinatı sayı.

- [ ] **Step 3: ASCII varsayımını doğrula**

Task 6'nın font atlası ASCII varsayıyor. Doğrula:

```bash
cd /root/killreport/backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -t -c "
SELECT COUNT(*) FROM (
  SELECT name FROM regions UNION ALL SELECT name FROM constellations
  UNION ALL SELECT name FROM solar_systems) n
WHERE name ~ '[^ -~]';"
```

Kabul: **0**. Sıfır değilse `chars` kümesi genişletilmeli ve bu adım hangi
karakterlerin çıktığını raporlamalı.

- [ ] **Step 4: Kademeli çekimin gerçekten çalıştığını kanıtla**

Bu, bu dilimin imza iddiası ve tarayıcı olmadan doğrulanabilir:

```bash
grep -n "skip:" frontend/src/components/UniverseMap/useMapLabels.ts
```

Kabul: `skip` yalnızca takımyıldız sorgusunda var ve
`CONSTELLATION_LABEL_ZOOM`'a bağlı; bölge sorgusunda `skip` yok.

- [ ] **Step 5: Kullanıcıya ne bakacağını söyle**

- **İlk karede bölge adları okunuyor mu** — eşik fit'in üstünde, yani zoom
  yapmadan görünmeli.
- **Zoom'la takımyıldızlar, sonra sistemler biniyor mu** — ve **öncekiler
  kalıyor mu.** Kaybolan varsa `visibleLabelTiers` birikmiyordur.
- **Kademeler stille ayrışıyor mu**: bölge büyük/sönük/aralıklı ve büyük harf,
  sistem küçük ve tam opak.
- **İsimler üst üste biniyor mu.**
- **Yazılar düz mü, ayna görüntüsü değil mi** — Pixi geçişinden devreden tuzağın
  kontrolü.
- **Takımyıldız eşiğini geçerken gecikme göze batıyor mu** — 31 KB, ~100 ms.
  Batıyorsa çözüm sorguyu eşikten biraz önce tetiklemek.
- Bölgenin kenarına zoom yapınca bölge adının kaybolması **beklenen** — spec'te
  kabul edilmiş kusur, merkez ekran dışında kalıyor.

---

## Self-review

| Spec bölümü                                            | Task                      |
| ------------------------------------------------------ | ------------------------- |
| `mapLabels(scope, kind)` şeması ve servisi             | 1, 2                      |
| Kademe başına önbellek anahtarı                        | 1                         |
| Sahne yükleminin paylaşılması (`gatelessFilter` dahil) | 1                         |
| Bölge merkezi = üye sistemlerin ortalaması             | 1                         |
| Kademeli çekim kuralı                                  | 4, 8 Step 4               |
| Üç eşik, ölçülmüş                                      | 3                         |
| Kademelerin birikmesi                                  | 3 (`visibleLabelTiers`)   |
| Ekran uzayında etiket katmanı                          | 6 (`stage`'e ekleme)      |
| Çarpışma filtresi, öncelik, 300 tavanı                 | 5                         |
| Kademe başına stil                                     | 6 (`TIER_STYLE`)          |
| `BitmapText` ve font atlası                            | 6, 8 Step 3               |
| Sistem adlarının sorgusuz gelmesi                      | 7                         |
| Test sınırı: karar testli, atama testsiz               | 1/3/4/5 testli, 6 testsiz |

**Açık riskler:**

- **Font atlası bu depoda ilk kez üretiliyor.** `BitmapFontManager.ASCII`
  kullanılıyor ve Task 8 Step 3 bunu gerçek isimlere karşı doğruluyor; sıfır
  çıkmazsa atlas genişler.

**PixiJS'in resmi skill'lerinden gelen düzeltmeler (2026-09-14'te kuruldu):**

- `chars` elle yazılmış aralık listesi yerine `BitmapFontManager.ASCII` preset'i.
- `resolution` sabit 2 yerine `window.devicePixelRatio` — ve `BitmapText`
  örneğine değil `BitmapFont.install`'a verilmeli, örneğe verilen yok sayılıp
  uyarı basıyor.
- `skipKerning: true` ve `dynamicFill: true` eklendi; ikincisi çalışma anında
  tint'e izin veriyor ve faz 4'ün renk kaydı bunu isteyecek.
- **`drawLabels` yeniden kurmak yerine havuz kullanıyor.** İlk taslak her kamera
  değişiminde `removeChildren()` yapıp 300'e kadar `BitmapText` yaratıyordu;
  PixiJS'in performans rehberi sık yaratılıp yok edilen nesnelerde bunu
  **yüksek şiddetli** hata sayıyor. Sürükleme sırasında her `pointermove`'da
  olacaktı.
- **Karakter genişliği yaklaşık.** Çarpışma kutuları `LABEL_CHAR_WIDTH` ile
  hesaplanıyor, gerçek `BitmapText` genişliğiyle değil. ~%10 hata filtre için
  önemsiz; göze batarsa `scene/` ölçüp `halfWidth`'i geçirir, arayüz hazır.
- **60 px okunabilirlik eşiği bir yargı.** Mesafeler ölçüldü, eşik seçildi.
  Üç sabit, gözle ayarlanır.
