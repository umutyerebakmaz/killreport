# Evren haritası — katman sistemi ve sovereignty katmanı — uygulama planı

> **Agentic worker'lar için:** GEREKLİ ALT-SKILL: Bu planı görev görev
> uygulamak için `superpowers:subagent-driven-development` (önerilen) veya
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox
> (`- [ ]`) sözdizimiyle yazılmıştır.

**Hedef:** `/map`'e bir katman sistemi eklemek ve o sistemin ilk katmanı olarak
sovereignty'yi çizmek: sahibin rengi sistem işaretinde ve kendi içindeki
kapılarda, sahibin logosu `−46,2` zoom'undan itibaren noktanın yerinde.

**Mimari:** Karar saf fonksiyonda, çizim Pixi'de. Bir katman
`utils/map/layers.ts` içinde bir kayıt girdisidir (`tint`, `edgeTint`,
`usesLogos`, `legend`); `scene/` tarafı o kararı sprite'a ve mesh'e yazar.
Bugünkü güvenlik renklendirmesi de bir katman girdisi oluyor, yani sov özel
durum değil. Backend tek yeni sorgu veriyor: `mapSovereignty`.

**Teknoloji:** GraphQL Yoga + Prisma `$queryRaw` + Redis (backend), Next.js 16
App Router + PixiJS v8 + Apollo Client (frontend), Vitest 5 her iki tarafta.

**Spec:** `docs/superpowers/specs/2026-09-20-universe-map-sov-layer-design.md`

## Global kısıtlar

- **Yarn, asla npm.** `yarn workspace backend test`,
  `yarn workspace frontend test`.
- **Codegen sırası:** `.graphql` değişince önce
  `yarn workspace backend codegen`, sonra `yarn workspace frontend codegen`.
- **Üretilmiş dosya elle düzenlenmez:** `backend/src/generated-types.ts`,
  `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
- **Resolver ESI çağırmaz, veritabanı sorgusu yazmaz.** Sorgu ve Redis
  servistedir; resolver yalnızca çağırır.
- **Cache anahtarında her filtre parametresi bulunur.** Burada tek parametre
  `scope`.
- **`::BIGINT` `Number()`'a çevrilmeden cache'e yazılmaz.** `JSON.stringify`
  `BigInt`'te patlar.
- **İki Prisma istemcisi:** API tarafı `@services/prisma` (5 bağlantı).
  Bu işte worker yok.
- **Eşik sabitleri ölçülmüş değerlerdir**, yuvarlanmaz: `SOV_LOGO_ZOOM = -46.2`.
- **Commit mesajları, PR başlığı ve kod yorumları İngilizce.** Claude atıfı yok.
  `type(scope):` sonrası her şey küçük harf.
- **Prettier:** her commit öncesi `npx prettier --check <dokunulan dosyalar>`.
- **Görsel doğrulama kullanıcınındır.** Tarayıcı sürülmez; doğrulama
  `test` + `typecheck` + `lint` + `build:check` ve backend'e doğrudan GraphQL
  sorgusu.

## Dosya yapısı

| Dosya                                                           | Sorumluluk                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `backend/src/schemas/UniverseMap.graphql`                       | **Değişiklik.** `MapOwnerKind`, `MapSovOwner`, `MapSovSystem`, `MapSovereignty`, sorgu. |
| `backend/src/services/universe/map-sovereignty.service.ts`      | **Yeni.** Redis → `$queryRaw` → Redis. Sahne yüklemi `universe-map.service`'ten.        |
| `backend/src/services/universe/map-sovereignty.service.spec.ts` | **Yeni.** Anahtar, cache, BigInt.                                                       |
| `backend/src/services/universe/index.ts`                        | **Değişiklik.** Yeni servisin dışa aktarımı.                                            |
| `backend/src/resolvers/universe-map/queries.ts`                 | **Değişiklik.** `mapSovereignty` orkestrasyonu + `OWNER_KIND` Record.                   |
| `frontend/src/graphql/MapSovereignty.graphql`                   | **Yeni.** Sorgu dokümanı.                                                               |
| `frontend/src/utils/map/sovColors.ts` + `.spec.ts`              | **Yeni.** `ownerId → hex` sözlüğü, `sovTint`, `SOV_UNOWNED_TINT`.                       |
| `frontend/src/utils/map/layers.ts` + `.spec.ts`                 | **Yeni.** Katman kaydı, `usesLogos`, kapı gruplaması.                                   |
| `frontend/src/utils/map/sovLogos.ts` + `.spec.ts`               | **Yeni.** Logo adresi, sahip → frame eşlemesi, atlas yerleşimi.                         |
| `frontend/src/components/UniverseMap/scene/edges.ts`            | **Değişiklik.** `drawEdgeGroups`.                                                       |
| `frontend/src/components/UniverseMap/scene/edges.spec.ts`       | **Yeni.** Grup başına stroke.                                                           |
| `frontend/src/components/UniverseMap/scene/systems.ts`          | **Değişiklik.** `applyLayer`, `applyLogos`, logo modunda ölçek.                         |
| `frontend/src/components/UniverseMap/scene/systems.spec.ts`     | **Yeni.** Tint ve doku takası.                                                          |
| `frontend/src/components/UniverseMap/scene/logoAtlas.ts`        | **Yeni.** Görselleri indirip tek dokuya çizen kurucu. Test edilmez.                     |
| `frontend/src/components/UniverseMap/useMapSovereignty.ts`      | **Yeni.** Katman seçiliyken çeken hook + `SovIndex` kurulumu.                           |
| `frontend/src/components/UniverseMap/UniverseMap.tsx`           | **Değişiklik.** Katman state'i, üç effect, anahtar ve lejantın yerleştirilmesi.         |
| `frontend/src/components/UniverseMap/MapLayerSwitch.tsx`        | **Yeni.** İki katmanlı anahtar.                                                         |
| `frontend/src/components/UniverseMap/SovLegend.tsx` + `.spec`   | **Yeni.** Sahip lejantı.                                                                |

---

## Görev 1: Backend — `mapSovereignty`

**Dosyalar:**

- Değişiklik: `backend/src/schemas/UniverseMap.graphql`
- Oluştur: `backend/src/services/universe/map-sovereignty.service.ts`
- Oluştur: `backend/src/services/universe/map-sovereignty.service.spec.ts`
- Değişiklik: `backend/src/services/universe/index.ts`
- Değişiklik: `backend/src/resolvers/universe-map/queries.ts`

**Arayüzler:**

- Tüketir: `universe-map.service.ts`'ten `scopePredicate(scope)`,
  `gatelessFilter(scope)`, `type MapScope`.
- Üretir: `getMapSovereignty(scope: MapScope): Promise<MapSovereignty>`,
  `sovCacheKey(scope: MapScope): string`, `SOV_CACHE_TTL_SECONDS`,
  `type MapOwnerKind = 'ALLIANCE' | 'FACTION' | 'CORPORATION'`,
  `interface MapSovOwner { ownerId: number; kind: MapOwnerKind; name: string; ticker: string | null; systemCount: number }`,
  `interface MapSovSystem { systemId: number; ownerId: number }`,
  `interface MapSovereignty { scope: MapScope; owners: MapSovOwner[]; systems: MapSovSystem[]; updatedAt: string | null }`.

**Ölçülmüş veri (2026-09-20, üretim):** `sovereignty_map_current` 5.383 satır.
2.712'si alliance'lı (hepsinde `corporation_id` de dolu — sahip alliance'tır),
2.671'i faction'lı, ikisi birden dolu olan satır **yok**, üçü birden boş satır
**yok**. Yalnızca `corporation_id` dolu satır bugün **sıfır**, ama enum'da
`CORPORATION` yine de var: tablo o sütunu taşıyor ve bir gün dolabilir.
Sahipler: 79 alliance + 22 faction = 101.

- [ ] **Adım 1: Şemayı yaz**

`backend/src/schemas/UniverseMap.graphql` — dosyanın sonundaki
`extend type Query` bloğunun **üstüne** tipleri, bloğun içine sorguyu ekle:

```graphql
"Bir sistemi tutan şeyin türü. Satırda alliance varsa sahip odur; corporation yalnızca alliance yokken sahiptir."
enum MapOwnerKind {
  ALLIANCE
  FACTION
  CORPORATION
}

"""
Sahnede toprağı olan tek bir sahip. `systems` içinde adı tekrarlanmıyor;
iki liste `ownerId` üzerinden birleşiyor.
"""
type MapSovOwner {
  ownerId: Int!
  kind: MapOwnerKind!
  name: String!
  "Faction'da null: factions tablosunda ticker sütunu yok."
  ticker: String
  systemCount: Int!
}

"Tek bir sahiplik çifti. NEW_EDEN'da 5.383 satır."
type MapSovSystem {
  systemId: Int!
  ownerId: Int!
}

type MapSovereignty {
  scope: MapScope!
  owners: [MapSovOwner!]!
  systems: [MapSovSystem!]!
  "Anlık görüntünün tazeliği, ISO. Hiç satır yoksa null."
  updatedAt: String
}
```

`extend type Query` içine:

```graphql
  """
  Sahnenin sovereignty katmanı. Servis Redis'te 900 s tutuyor.

  Response cache'e **bilerek** alınmadı: `PUBLIC_CACHE_QUERIES`'e eklenirse
  TTL'i `TTL_PER_SCHEMA_COORDINATE`'a da girmek zorunda kalır, ve servisin
  kendi Redis anahtarı zaten işi görürken ikinci katman yalnızca bayatlığı
  ikiye katlar.
  """
  mapSovereignty(scope: MapScope! = NEW_EDEN): MapSovereignty!
```

- [ ] **Adım 2: Codegen'i çalıştır**

```bash
yarn workspace backend codegen
```

Beklenen: `generated-types.ts` içinde `MapSovereignty`, `MapSovOwner`,
`MapOwnerKind` görünür. Hata verirse şema yazımı bozuktur; ilerleme.

- [ ] **Adım 3: Başarısız testi yaz**

`backend/src/services/universe/map-sovereignty.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest hoists vi.mock above plain consts, so the factory's outer variables
// come from vi.hoisted — the same pattern map-labels.service.spec.ts uses.
const { redis, prisma } = vi.hoisted(() => ({
  redis: { get: vi.fn(), setex: vi.fn() },
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@services/prisma', () => ({ default: prisma, prisma }));

import { Prisma } from '@generated/prisma/client';
import {
  getMapSovereignty,
  sovCacheKey,
  SOV_CACHE_TTL_SECONDS,
} from './map-sovereignty.service';

function queryText(call: number): string {
  return (prisma.$queryRaw.mock.calls[call][0] as Prisma.Sql).sql;
}

beforeEach(() => {
  redis.get.mockReset();
  redis.setex.mockReset();
  prisma.$queryRaw.mockReset();
  redis.get.mockResolvedValue(null);
});

describe('sovCacheKey', () => {
  it('carries the scope, so one scene never serves another', () => {
    expect(sovCacheKey('NEW_EDEN')).toBe('map:sov:NEW_EDEN');
    expect(sovCacheKey('POCHVEN')).toBe('map:sov:POCHVEN');
    expect(sovCacheKey('NEW_EDEN')).not.toBe(sovCacheKey('WORMHOLE'));
  });
});

describe('getMapSovereignty', () => {
  it('returns the cached value without touching the database', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        scope: 'NEW_EDEN',
        owners: [],
        systems: [],
        updatedAt: null,
      }),
    );

    const sov = await getMapSovereignty('NEW_EDEN');

    expect(sov.systems).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('runs both queries through the scene predicate', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getMapSovereignty('NEW_EDEN');

    // The gateless filter matters as much as the band: a sovereignty row for
    // a Jove system would put an owner on the map that the geometry never
    // draws, and its colour would be in the legend with nothing under it.
    for (const call of [0, 1]) {
      expect(queryText(call)).toContain('c.region_id BETWEEN');
      expect(queryText(call)).toContain('FROM stargates g');
    }
  });

  it('converts the BIGINT count to a number before caching it', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ system_id: 30000142, owner_id: 99003581 }])
      .mockResolvedValueOnce([
        {
          owner_id: 99003581,
          kind: 'ALLIANCE',
          name: 'Brave Collective',
          ticker: 'BRAVE',
          // What $queryRaw actually hands back for ::BIGINT. JSON.stringify
          // throws on it, so a service that forgot the Number() would fail
          // right here rather than in production.
          system_count: 329n,
          updated_at: new Date('2026-09-12T14:33:56.686Z'),
        },
      ]);

    const sov = await getMapSovereignty('NEW_EDEN');

    expect(sov.owners[0].systemCount).toBe(329);
    expect(typeof sov.owners[0].systemCount).toBe('number');
    expect(sov.updatedAt).toBe('2026-09-12T14:33:56.686Z');
    expect(redis.setex).toHaveBeenCalledWith(
      'map:sov:NEW_EDEN',
      SOV_CACHE_TTL_SECONDS,
      expect.any(String),
    );
  });

  it('names an owner the entity tables do not know by its id', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        owner_id: 99015215,
        kind: 'ALLIANCE',
        name: null,
        ticker: null,
        system_count: 2n,
        updated_at: null,
      },
    ]);

    // An alliance that took sov before the info worker fetched it still has to
    // appear: the legend row is the only place the map admits it exists.
    const sov = await getMapSovereignty('NEW_EDEN');

    expect(sov.owners[0].name).toBe('#99015215');
  });
});
```

- [ ] **Adım 4: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace backend test src/services/universe/map-sovereignty.service.spec.ts
```

Beklenen: FAIL — `Failed to resolve import "./map-sovereignty.service"`.

- [ ] **Adım 5: Servisi yaz**

`backend/src/services/universe/map-sovereignty.service.ts`:

```ts
/**
 * The sovereignty layer's data: who holds what, and how to name them.
 *
 * Two queries rather than one join: the pairs are 5,383 rows the client indexes
 * by system, the owners are 101 rows it indexes by owner, and repeating a name
 * on every pair would be most of the body for nothing.
 *
 * Measured 2026-09-20 against production: 5,383 pairs, 79 alliances and 22
 * factions, no row holding both and none holding neither.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';
import {
  gatelessFilter,
  scopePredicate,
  type MapScope,
} from './universe-map.service';

export type MapOwnerKind = 'ALLIANCE' | 'FACTION' | 'CORPORATION';

export interface MapSovOwner {
  ownerId: number;
  kind: MapOwnerKind;
  name: string;
  /** Null on a faction: the factions table has no ticker column. */
  ticker: string | null;
  systemCount: number;
}

export interface MapSovSystem {
  systemId: number;
  ownerId: number;
}

export interface MapSovereignty {
  scope: MapScope;
  owners: MapSovOwner[];
  systems: MapSovSystem[];
  updatedAt: string | null;
}

/**
 * Not a row from CLAUDE.md's TTL table, and deliberately not.
 * `worker-sovereignty-map.ts` refreshes this and a system changing hands is a
 * day-scale event, so a quarter hour of staleness is fine for territory — but
 * it is not "never changes" either.
 */
export const SOV_CACHE_TTL_SECONDS = 900;

export function sovCacheKey(scope: MapScope): string {
  return `map:sov:${scope}`;
}

/**
 * The owner of a row, as one expression used by both queries.
 *
 * COALESCE order is the ownership rule: a row that names an alliance is held by
 * that alliance even though it also names the holding corporation. Measured
 * 2026-09-20: every alliance row carries a corporation id too, so reading the
 * corporation first would relabel all 2,712 of them.
 */
const OWNER_ID = Prisma.sql`COALESCE(m.alliance_id, m.corporation_id, m.faction_id)`;

const OWNER_KIND = Prisma.sql`CASE
  WHEN m.alliance_id IS NOT NULL THEN 'ALLIANCE'
  WHEN m.corporation_id IS NOT NULL THEN 'CORPORATION'
  ELSE 'FACTION'
END`;

/** The scene the geometry draws, so no owner can appear over an undrawn system. */
function ownedRows(scope: MapScope): Prisma.Sql {
  return Prisma.sql`
    FROM sovereignty_map_current m
    JOIN solar_systems s ON s.system_id = m.solar_system_id
    JOIN constellations c ON c.constellation_id = s.constellation_id
    WHERE ${scopePredicate(scope)}
      ${gatelessFilter(scope)}
      AND ${OWNER_ID} IS NOT NULL
  `;
}

interface SystemRow {
  system_id: number;
  owner_id: number;
}

interface OwnerRow {
  owner_id: number;
  kind: MapOwnerKind;
  name: string | null;
  ticker: string | null;
  system_count: bigint;
  updated_at: Date | null;
}

export async function getMapSovereignty(
  scope: MapScope,
): Promise<MapSovereignty> {
  const key = sovCacheKey(scope);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapSovereignty;

  const rows = ownedRows(scope);

  const systemRows = await prisma.$queryRaw<SystemRow[]>(Prisma.sql`
    SELECT s.system_id AS system_id, ${OWNER_ID} AS owner_id
    ${rows}
    ORDER BY s.system_id
  `);

  // The three LEFT JOINs are guarded by the kind, so an alliance id that
  // happens to equal a faction id cannot pick up the wrong name.
  const ownerRows = await prisma.$queryRaw<OwnerRow[]>(Prisma.sql`
    WITH owned AS (
      SELECT ${OWNER_ID} AS owner_id, ${OWNER_KIND} AS kind, m.last_updated
      ${rows}
    )
    SELECT o.owner_id,
           o.kind,
           COALESCE(a.name, co.name, f.name) AS name,
           COALESCE(a.ticker, co.ticker) AS ticker,
           COUNT(*)::BIGINT AS system_count,
           MAX(o.last_updated) AS updated_at
    FROM owned o
    LEFT JOIN alliances a ON o.kind = 'ALLIANCE' AND a.id = o.owner_id
    LEFT JOIN corporations co ON o.kind = 'CORPORATION' AND co.id = o.owner_id
    LEFT JOIN factions f ON o.kind = 'FACTION' AND f.id = o.owner_id
    GROUP BY o.owner_id, o.kind, a.name, co.name, f.name, a.ticker, co.ticker
    ORDER BY system_count DESC, o.owner_id
  `);

  const owners: MapSovOwner[] = ownerRows.map((row) => ({
    ownerId: Number(row.owner_id),
    kind: row.kind,
    // An owner the info workers have not fetched yet still gets a row: the
    // legend is the only place the map admits it exists, and a blank name
    // there reads as a bug rather than as a gap in the entity tables.
    name: row.name ?? `#${Number(row.owner_id)}`,
    ticker: row.ticker,
    // COUNT(*) is BIGINT and JSON.stringify throws on it, so the conversion
    // happens before the value can reach the cache write below.
    systemCount: Number(row.system_count),
  }));

  const freshest = ownerRows.reduce<Date | null>((latest, row) => {
    if (!row.updated_at) return latest;
    return latest === null || row.updated_at > latest ? row.updated_at : latest;
  }, null);

  const sovereignty: MapSovereignty = {
    scope,
    owners,
    systems: systemRows.map((row) => ({
      systemId: Number(row.system_id),
      ownerId: Number(row.owner_id),
    })),
    updatedAt: freshest?.toISOString() ?? null,
  };

  // Cached even when empty: a scene with no sovereignty is a fact, not a miss.
  await redis.setex(key, SOV_CACHE_TTL_SECONDS, JSON.stringify(sovereignty));
  return sovereignty;
}
```

- [ ] **Adım 6: Dışa aktar**

`backend/src/services/universe/index.ts` — `map-system.service` satırının
altına:

```ts
export * from './map-sovereignty.service';
```

- [ ] **Adım 7: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace backend test src/services/universe/map-sovereignty.service.spec.ts
```

Beklenen: 5 test PASS.

- [ ] **Adım 8: Resolver'ı bağla**

`backend/src/resolvers/universe-map/queries.ts` — `LABEL_KIND`'ın altına
üçüncü Record'u ekle, sonra sorguyu:

```ts
/**
 * Third of the same shape as CELESTIAL_KIND and LABEL_KIND: the service speaks
 * string literals, the schema an enum, and a Record converts without a cast.
 */
const OWNER_KIND: Record<ServiceOwnerKind, MapOwnerKind> = {
  ALLIANCE: MapOwnerKind.Alliance,
  FACTION: MapOwnerKind.Faction,
  CORPORATION: MapOwnerKind.Corporation,
};
```

İçe aktarımlara `MapOwnerKind` (generated-types'tan), `getMapSovereignty` ve
`type MapOwnerKind as ServiceOwnerKind` (`@services/universe`'ten) eklenir.
`universeMapQueries` nesnesine:

```ts
  mapSovereignty: async (_, { scope }) => {
    const sovereignty = await getMapSovereignty(scope);
    return {
      ...sovereignty,
      scope,
      owners: sovereignty.owners.map((owner) => ({
        ...owner,
        kind: OWNER_KIND[owner.kind],
      })),
    };
  },
```

- [ ] **Adım 9: Derle ve canlı sorguyla doğrula**

```bash
yarn workspace backend build
yarn dev:backend   # ayrı bir terminalde
curl -s localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ mapSovereignty(scope: NEW_EDEN) { updatedAt owners { ownerId kind name ticker systemCount } systems { systemId ownerId } } }"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0)).data.mapSovereignty; console.log(d.owners.length, d.systems.length, d.owners[0]);'
```

Beklenen: `101 5383` ve ilk satır 509 sistemli alliance. İkinci çağrı
Redis'ten döner — bariz biçimde daha hızlı olmalı.

- [ ] **Adım 10: Commit**

```bash
npx prettier --check backend/src/schemas/UniverseMap.graphql \
  backend/src/services/universe/map-sovereignty.service.ts \
  backend/src/services/universe/map-sovereignty.service.spec.ts \
  backend/src/resolvers/universe-map/queries.ts
git add backend/src
git commit -m "feat(map): serve the sovereignty layer's data as one query"
```

---

## Görev 2: Renk sözlüğü — `sovColors.ts`

**Dosyalar:**

- Oluştur: `frontend/src/utils/map/sovColors.ts`
- Oluştur: `frontend/src/utils/map/sovColors.spec.ts`
- Geçici (commit edilmez): `<scratchpad>/sov-colors.mjs`

**Arayüzler:**

- Tüketir: `utils/map/colors.ts`'ten `hexToTint`.
- Üretir: `SOV_COLORS: Record<number, string>`,
  `sovTint(ownerId: number): number | null`, `SOV_UNOWNED_TINT: number`.

**Bu görevin girdisi kullanıcıdadır.** 101 değer tasarım oturumunda üretildi ve
depoda yok. Göreve başlarken kullanıcıdan tabloyu iste. Tablo elde değilse
Adım 2'deki üretici onu yeniden türetir; tek kaybolan şey elle seçilmiş 26
değerin kendisidir (22 faction + dört alliance), ve onlar kullanıcının
seçimidir — üreticiye tohum olarak verilir, yoksa 101'in tamamı üretilir.
Sözlük eksik de olabilir: sözlükte olmayan sahip nötr çizilir (spec §3.1), yani
bu görev sözlük yarımken de tamamlanmış sayılır.

- [ ] **Adım 1: Sahip listesini çıkar**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -A -F, -t -c "
  SELECT COALESCE(m.alliance_id, m.corporation_id, m.faction_id) AS owner_id,
         CASE WHEN m.alliance_id IS NOT NULL THEN 'ALLIANCE'
              WHEN m.corporation_id IS NOT NULL THEN 'CORPORATION'
              ELSE 'FACTION' END AS kind,
         COUNT(*) AS system_count
  FROM sovereignty_map_current m
  GROUP BY 1, 2
  ORDER BY system_count DESC, owner_id;
" > /tmp/owners.csv
wc -l /tmp/owners.csv   # 101
```

- [ ] **Adım 2: Eksik renkleri üret**

Scratchpad'e `sov-colors.mjs` olarak yaz ve çalıştır. Commit edilmez: üretilen
şey sözlüğün kendisidir, ve sözlüğe bir satır eklemek tek satırlık bir
düzenleme — bir üreticiyi ağaçta tutmayı hak edecek kadar tekrarlanan bir iş
değil.

```js
// OKLab farthest-point sampling. Seeds are the hand-picked values; the rest
// are placed as far from everything already chosen as the gamut allows.
import { readFileSync } from 'node:fs';

const GROUND = '#030712';
// Hand-picked, from the design session. Fill in what exists; an empty object
// generates all 101.
const SEEDS = {
  // 99003581: '#7cd05d',
};

const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexToLinear = (hex) =>
  [1, 3, 5].map((i) => f(parseInt(hex.slice(i, i + 2), 16) / 255));

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklchToHex(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b2 = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b2) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (rgb.some((c) => c < 0 || c > 1)) return null; // out of sRGB gamut
  const enc = (c) =>
    Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4)));
  return '#' + rgb.map((c) => enc(c).toString(16).padStart(2, '0')).join('');
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const ground = linearToOklab(hexToLinear(GROUND));

// The candidate set: light enough to read on the map's own ground, chromatic
// enough to be a colour rather than a grey.
const candidates = [];
for (let L = 0.55; L <= 0.86; L += 0.025)
  for (let C = 0.06; C <= 0.21; C += 0.015)
    for (let h = 0; h < 360; h += 2) {
      const hex = oklchToHex(L, C, h);
      if (!hex) continue;
      const lab = linearToOklab(hexToLinear(hex));
      if (dist(lab, ground) < 0.45) continue; // must separate from the ground
      candidates.push({ hex, lab });
    }

const owners = readFileSync('/tmp/owners.csv', 'utf8')
  .trim()
  .split('\n')
  .map((line) => Number(line.split(',')[0]));

const chosen = new Map(
  Object.entries(SEEDS).map(([id, hex]) => [Number(id), hex]),
);
const taken = [...chosen.values()].map((hex) =>
  linearToOklab(hexToLinear(hex)),
);

for (const ownerId of owners) {
  if (chosen.has(ownerId)) continue;
  let best = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = taken.length
      ? Math.min(...taken.map((t) => dist(t, candidate.lab)))
      : 1;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  chosen.set(ownerId, best.hex);
  taken.push(best.lab);
}

// Worst separation in the finished dictionary, for the module's comment.
let worst = Infinity;
for (let i = 0; i < taken.length; i++)
  for (let j = i + 1; j < taken.length; j++)
    worst = Math.min(worst, dist(taken[i], taken[j]));

for (const ownerId of owners)
  console.log(`  ${ownerId}: '${chosen.get(ownerId)}',`);
console.error(`${chosen.size} colours, min OKLab distance ${worst.toFixed(3)}`);
```

```bash
node <scratchpad>/sov-colors.mjs > /tmp/sov-colors.txt
```

- [ ] **Adım 3: Başarısız testi yaz**

`frontend/src/utils/map/sovColors.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hexToTint } from './colors';
import { SOV_COLORS, SOV_UNOWNED_TINT, sovTint } from './sovColors';

describe('SOV_COLORS', () => {
  it('holds a valid six-digit hex for every owner it names', () => {
    for (const [ownerId, hex] of Object.entries(SOV_COLORS)) {
      expect(hex, `owner ${ownerId}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('gives no two owners the same colour', () => {
    const values = Object.values(SOV_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('sovTint', () => {
  it('turns a dictionary entry into the number Pixi tints with', () => {
    const [ownerId, hex] = Object.entries(SOV_COLORS)[0];
    expect(sovTint(Number(ownerId))).toBe(hexToTint(hex));
  });

  it('returns null for an owner the dictionary does not name', () => {
    // A new alliance taking sov is drawn neutral and identified by its logo;
    // the caller needs to be able to tell "no colour" from a dark colour, so
    // this is null rather than SOV_UNOWNED_TINT.
    expect(sovTint(1)).toBeNull();
  });
});

describe('SOV_UNOWNED_TINT', () => {
  it('is darker than the gate line, so owned colour stays the loud thing', () => {
    expect(SOV_UNOWNED_TINT).toBe(0x475569);
  });
});
```

- [ ] **Adım 4: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace frontend test src/utils/map/sovColors.spec.ts
```

Beklenen: FAIL — `Failed to resolve import "./sovColors"`.

- [ ] **Adım 5: Sözlüğü yaz**

`frontend/src/utils/map/sovColors.ts` — `SOV_COLORS` gövdesine Adım 2'nin
çıktısı (ya da kullanıcının tablosu) birebir yapıştırılır:

```ts
import { hexToTint } from './colors';

/**
 * Sovereignty owner colours, chosen against the map's own ground (#030712).
 *
 * 26 of them were picked by hand — the 22 factions and four alliances — and
 * the rest were placed by farthest-point sampling in OKLab, each one as far
 * from every colour already in the dictionary as the sRGB gamut allows.
 *
 * **101 colours do not fully separate.** The best achievable minimum
 * separation in the range that stays visible on this ground is small, and that
 * is the layer's reading contract rather than a defect: the colour says "these
 * are one holding", and which holding is answered by the logo at
 * SOV_LOGO_ZOOM. See the spec's §3.1.
 *
 * An owner missing from here is drawn SOV_UNOWNED_TINT and identified by its
 * logo alone, so the layer is correct while the dictionary is incomplete.
 * Adding one is a single line.
 */
export const SOV_COLORS: Record<number, string> = {
  // ... Adım 2'nin çıktısı, sistem sayısına göre azalan sırada ...
};

/**
 * Systems nobody holds, and owners the dictionary does not name.
 *
 * Not the security colour: that is another layer's sentence, and two
 * magnitudes told at once leaves neither readable. Not GATE_TINT either — the
 * dot has to sit quieter than the lines that connect it, or an empty region
 * reads louder than a held one. A judgement; tune by looking.
 */
export const SOV_UNOWNED_TINT = 0x475569;

/** The owner's tint, or null when the dictionary does not name them. */
export function sovTint(ownerId: number): number | null {
  const hex = SOV_COLORS[ownerId];
  return hex === undefined ? null : hexToTint(hex);
}
```

- [ ] **Adım 6: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace frontend test src/utils/map/sovColors.spec.ts
```

Beklenen: 5 test PASS.

- [ ] **Adım 7: Commit**

```bash
npx prettier --check frontend/src/utils/map/sovColors.ts frontend/src/utils/map/sovColors.spec.ts
git add frontend/src/utils/map/sovColors.ts frontend/src/utils/map/sovColors.spec.ts
git commit -m "feat(map): add the sovereignty owner colour dictionary"
```

---

## Görev 3: Katman kaydı — `layers.ts`

**Dosyalar:**

- Oluştur: `frontend/src/utils/map/layers.ts`
- Oluştur: `frontend/src/utils/map/layers.spec.ts`

**Arayüzler:**

- Tüketir: `sovColors.ts`'ten `sovTint`, `SOV_UNOWNED_TINT`; `colors.ts`'ten
  `securityTint`; `@/generated/graphql`'den `MapNode`, `MapEdge`.
- Üretir: `SOV_LOGO_ZOOM = -46.2`, `type MapLayerId`, `interface SovIndex`,
  `interface MapLayerData`, `type LegendSpec`, `interface MapColorLayer`,
  `MAP_LAYERS: Record<MapLayerId, MapColorLayer>`,
  `buildSovIndex(sov): SovIndex`.

- [ ] **Adım 1: Başarısız testi yaz**

`frontend/src/utils/map/layers.spec.ts`:

```ts
import type { MapNode } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import { securityTint } from './colors';
import {
  buildSovIndex,
  MAP_LAYERS,
  SOV_LOGO_ZOOM,
  type MapLayerData,
} from './layers';
import { SOV_COLORS, SOV_UNOWNED_TINT, sovTint } from './sovColors';

const OWNED = Number(Object.keys(SOV_COLORS)[0]);
const UNCOLOURED = 1;

function node(systemId: number, securityStatus = 0.5): MapNode {
  return {
    systemId,
    name: `S-${systemId}`,
    x: 0,
    z: 0,
    radius: 1e12,
    securityStatus,
    constellationId: 20000001,
    regionId: 10000001,
  };
}

const DATA: MapLayerData = {
  sovereignty: buildSovIndex({
    systems: [
      { systemId: 1, ownerId: OWNED },
      { systemId: 2, ownerId: OWNED },
      { systemId: 3, ownerId: UNCOLOURED },
    ],
  }),
};

describe('the security layer', () => {
  it('records today behaviour unchanged', () => {
    const layer = MAP_LAYERS.security;
    expect(layer.tint(node(1, 0.9), DATA)).toBe(securityTint(0.9));
    expect(layer.tint(node(1, -0.3), DATA)).toBe(securityTint(-0.3));
  });

  it('leaves every gate neutral and never asks for logos', () => {
    const layer = MAP_LAYERS.security;
    expect(layer.edgeTint({ from: 1, to: 2 }, DATA)).toBeNull();
    expect(layer.usesLogos(0)).toBe(false);
    expect(layer.usesLogos(-60)).toBe(false);
  });
});

describe('the sovereignty layer', () => {
  const layer = MAP_LAYERS.sovereignty;

  it('paints a held system in its owner colour', () => {
    expect(layer.tint(node(1), DATA)).toBe(sovTint(OWNED));
  });

  it('paints an unheld system neutral, not its security colour', () => {
    // Security is another layer's sentence; telling two magnitudes at once
    // leaves neither readable.
    expect(layer.tint(node(99, 0.9), DATA)).toBe(SOV_UNOWNED_TINT);
  });

  it('paints an owner the dictionary does not name neutral too', () => {
    // The layer has to be correct while the dictionary is incomplete; the
    // logo carries the identity of a system drawn this way.
    expect(layer.tint(node(3), DATA)).toBe(SOV_UNOWNED_TINT);
  });

  it('falls back to neutral when the layer has no data yet', () => {
    expect(layer.tint(node(1), { sovereignty: null })).toBe(SOV_UNOWNED_TINT);
  });

  it('colours a gate whose two ends share an owner', () => {
    expect(layer.edgeTint({ from: 1, to: 2 }, DATA)).toBe(sovTint(OWNED));
  });

  it('leaves a border gate neutral, which is what draws the border', () => {
    // Different owners, held-to-unheld and unheld-to-unheld alike. Painting
    // half of it in each end's colour would blur the one line that separates
    // two territories.
    expect(layer.edgeTint({ from: 1, to: 3 }, DATA)).toBeNull();
    expect(layer.edgeTint({ from: 1, to: 99 }, DATA)).toBeNull();
    expect(layer.edgeTint({ from: 98, to: 99 }, DATA)).toBeNull();
  });

  it('leaves a gate between two systems of an uncoloured owner neutral', () => {
    // Same owner at both ends, but no colour to paint it with: neutral is the
    // honest answer, not a colour invented at the edge.
    const both: MapLayerData = {
      sovereignty: buildSovIndex({
        systems: [
          { systemId: 3, ownerId: UNCOLOURED },
          { systemId: 4, ownerId: UNCOLOURED },
        ],
      }),
    };
    expect(layer.edgeTint({ from: 3, to: 4 }, both)).toBeNull();
  });

  it('opens the logos at the measured zoom and not below it', () => {
    // -46.2 is where 90% of held systems are more than 16 px from their
    // nearest neighbour, measured 2026-09-19.
    expect(SOV_LOGO_ZOOM).toBe(-46.2);
    expect(layer.usesLogos(SOV_LOGO_ZOOM)).toBe(true);
    expect(layer.usesLogos(SOV_LOGO_ZOOM + 1)).toBe(true);
    expect(layer.usesLogos(SOV_LOGO_ZOOM - 0.01)).toBe(false);
  });
});

describe('buildSovIndex', () => {
  it('indexes the pairs by system and resolves each owner colour once', () => {
    const index = buildSovIndex({ systems: [{ systemId: 1, ownerId: OWNED }] });
    expect(index.ownerBySystem.get(1)).toBe(OWNED);
    expect(index.tintByOwner.get(OWNED)).toBe(sovTint(OWNED));
  });

  it('leaves an owner with no dictionary entry out of the tint map', () => {
    const index = buildSovIndex({
      systems: [{ systemId: 3, ownerId: UNCOLOURED }],
    });
    expect(index.ownerBySystem.get(3)).toBe(UNCOLOURED);
    expect(index.tintByOwner.has(UNCOLOURED)).toBe(false);
  });
});
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace frontend test src/utils/map/layers.spec.ts
```

Beklenen: FAIL — `Failed to resolve import "./layers"`.

- [ ] **Adım 3: Katman kaydını yaz**

`frontend/src/utils/map/layers.ts`:

```ts
import type { MapEdge, MapNode } from '@/generated/graphql';
import { securityTint } from './colors';
import { SOV_UNOWNED_TINT, sovTint } from './sovColors';

/**
 * Where a system's mark becomes its owner's logo.
 *
 * Measured, not chosen. `pixels = metres * 2 ** zoom` (camera.ts), and the
 * nearest-neighbour distances of held systems were measured against production
 * on 2026-09-19: p10 1.29e15 m, median 3.47e15 m, p90 6.40e15 m. -46.2 is
 * where the p10 pair reaches 16 px — so at this zoom 90% of held systems have
 * room for a 16 px mark. It lands between CONSTELLATION_LABEL_ZOOM (-47.64)
 * and SYSTEM_LABEL_ZOOM (-45.73): logos arrive after constellation names and
 * just before system names.
 */
export const SOV_LOGO_ZOOM = -46.2;

export type MapLayerId = 'security' | 'sovereignty';

/**
 * The sovereignty data as the drawing side needs it: one lookup per system and
 * one per owner, both O(1).
 *
 * The owner's tint is resolved once here rather than per sprite — 5,241
 * systems share 101 owners, so a per-sprite dictionary read would do the same
 * hex parse fifty times over.
 */
export interface SovIndex {
  ownerBySystem: Map<number, number>;
  /** Only owners the dictionary names; a miss means "draw it neutral". */
  tintByOwner: Map<number, number>;
}

export interface MapLayerData {
  sovereignty: SovIndex | null;
}

/** What the legend under the switch draws. */
export type LegendSpec = { kind: 'security' } | { kind: 'owners'; max: number };

export interface MapColorLayer {
  id: MapLayerId;
  label: string;
  /** The system mark's colour. */
  tint: (node: MapNode, data: MapLayerData) => number;
  /** The gate line's colour; null means the neutral grey. */
  edgeTint: (edge: MapEdge, data: MapLayerData) => number | null;
  /** Whether this zoom draws logos in place of the dots. */
  usesLogos: (zoom: number) => boolean;
  legend: LegendSpec;
}

export function buildSovIndex(sov: {
  systems: readonly { systemId: number; ownerId: number }[];
}): SovIndex {
  const ownerBySystem = new Map<number, number>();
  const tintByOwner = new Map<number, number>();

  for (const row of sov.systems) {
    ownerBySystem.set(row.systemId, row.ownerId);
    if (!tintByOwner.has(row.ownerId)) {
      const tint = sovTint(row.ownerId);
      if (tint !== null) tintByOwner.set(row.ownerId, tint);
    }
  }

  return { ownerBySystem, tintByOwner };
}

/** The owner's colour, or null for unheld, uncoloured, or no data at all. */
function ownerTint(systemId: number, data: MapLayerData): number | null {
  const sov = data.sovereignty;
  if (!sov) return null;
  const ownerId = sov.ownerBySystem.get(systemId);
  if (ownerId === undefined) return null;
  return sov.tintByOwner.get(ownerId) ?? null;
}

/**
 * Both layers, as data.
 *
 * `security` records today's map exactly: the security ramp on the marks,
 * neutral gates, no logos. Making it an entry rather than the default branch
 * is what keeps sovereignty from being a special case bolted to the side —
 * when a third layer arrives (activity, geography) it is one more entry here
 * and nothing else changes.
 */
export const MAP_LAYERS: Record<MapLayerId, MapColorLayer> = {
  security: {
    id: 'security',
    label: 'Security',
    tint: (node) => securityTint(node.securityStatus),
    edgeTint: () => null,
    usesLogos: () => false,
    legend: { kind: 'security' },
  },
  sovereignty: {
    id: 'sovereignty',
    label: 'Sovereignty',
    tint: (node, data) => ownerTint(node.systemId, data) ?? SOV_UNOWNED_TINT,
    // A gate is only coloured when BOTH ends are the same owner. A gate
    // between two owners is a border, and leaving it grey is what separates
    // the two territories; splitting it down the middle would show ownership
    // more completely and lose the one line that reads as an edge.
    edgeTint: (edge, data) => {
      const sov = data.sovereignty;
      if (!sov) return null;
      const from = sov.ownerBySystem.get(edge.from);
      const to = sov.ownerBySystem.get(edge.to);
      if (from === undefined || from !== to) return null;
      return sov.tintByOwner.get(from) ?? null;
    },
    usesLogos: (zoom) => zoom >= SOV_LOGO_ZOOM,
    legend: { kind: 'owners', max: 10 },
  },
};
```

- [ ] **Adım 4: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace frontend test src/utils/map/layers.spec.ts
```

Beklenen: 13 test PASS.

- [ ] **Adım 5: Commit**

```bash
npx prettier --check frontend/src/utils/map/layers.ts frontend/src/utils/map/layers.spec.ts
git add frontend/src/utils/map/layers.ts frontend/src/utils/map/layers.spec.ts
git commit -m "feat(map): make the security colouring the first entry of a layer registry"
```

---

## Görev 4: Kapı grupları — `groupSegmentsByTint` + `drawEdgeGroups`

**Dosyalar:**

- Değişiklik: `frontend/src/utils/map/layers.ts`
- Değişiklik: `frontend/src/utils/map/layers.spec.ts`
- Değişiklik: `frontend/src/components/UniverseMap/scene/edges.ts`
- Oluştur: `frontend/src/components/UniverseMap/scene/edges.spec.ts`

**Arayüzler:**

- Tüketir: Görev 3'ten `MapColorLayer`, `MapLayerData`; `utils/map/edges.ts`'ten
  `EdgeSegment`; `utils/map/dash.ts`'ten `splitDashed`; `colors.ts`'ten
  `GATE_TINT`, `GATE_ALPHA`.
- Üretir: `interface EdgeGroup { tint: number | null; segments: EdgeSegment[] }`,
  `groupSegmentsByTint(segments, layer, data): EdgeGroup[]`,
  `drawEdgeGroups(target: Graphics, groups: EdgeGroup[], origin: MapOrigin): void`.

- [ ] **Adım 1: Başarısız testleri yaz**

`frontend/src/utils/map/layers.spec.ts` — tepedeki içe aktarımlara
`import type { EdgeSegment } from './edges';` ve `./layers`'ın listesine
`groupSegmentsByTint` eklenir, sonra dosyanın sonuna:

```ts
function segment(from: number, to: number): EdgeSegment {
  return {
    from: [0, 0],
    to: [1, 1],
    regions: [10000001, 10000001],
    constellations: [20000001, 20000001],
    systems: [from, to],
  };
}

describe('groupSegmentsByTint', () => {
  it('puts every segment in one neutral group for the security layer', () => {
    const groups = groupSegmentsByTint(
      [segment(1, 2), segment(1, 3)],
      MAP_LAYERS.security,
      DATA,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].tint).toBeNull();
    expect(groups[0].segments).toHaveLength(2);
  });

  it('splits the sov layer into one group per colour, neutral first', () => {
    // Neutral first is draw order: the borders go down before the territories,
    // so a coloured line is never covered by the grey it separates.
    const groups = groupSegmentsByTint(
      [segment(1, 3), segment(1, 2), segment(2, 1)],
      MAP_LAYERS.sovereignty,
      DATA,
    );
    expect(groups.map((g) => g.tint)).toEqual([null, sovTint(OWNED)]);
    expect(groups[0].segments).toHaveLength(1);
    expect(groups[1].segments).toHaveLength(2);
  });

  it('emits no empty group', () => {
    const groups = groupSegmentsByTint([], MAP_LAYERS.sovereignty, DATA);
    expect(groups).toEqual([]);
  });
});
```

`frontend/src/components/UniverseMap/scene/edges.spec.ts`:

```ts
import type { EdgeSegment } from '@/utils/map/edges';
import { GATE_ALPHA, GATE_TINT } from '@/utils/map/colors';
import { Graphics } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { drawEdgeGroups } from './edges';

/**
 * A Graphics builds its path without a GPU, so what this asserts is the one
 * thing the grouping exists for: one stroke per colour, with that colour.
 */
function segment(x: number): EdgeSegment {
  return {
    from: [x, 0],
    to: [x + 1, 1],
    regions: [10000001, 10000001],
    constellations: [20000001, 20000001],
    systems: [x, x + 1],
  };
}

const ORIGIN = { x: 0, z: 0 };

describe('drawEdgeGroups', () => {
  it('strokes each group with its own colour and the neutral one with GATE_TINT', () => {
    const target = new Graphics();
    const stroke = vi.spyOn(target, 'stroke');

    drawEdgeGroups(
      target,
      [
        { tint: null, segments: [segment(0)] },
        { tint: 0x7cd05d, segments: [segment(2)] },
      ],
      ORIGIN,
    );

    const colours = stroke.mock.calls.map((call) => call[0]);
    expect(colours).toEqual([
      { width: 1, pixelLine: true, color: GATE_TINT, alpha: GATE_ALPHA },
      { width: 1, pixelLine: true, color: 0x7cd05d, alpha: GATE_ALPHA },
    ]);
  });

  it('clears what was there, so a layer switch does not draw over itself', () => {
    const target = new Graphics();
    const clear = vi.spyOn(target, 'clear');
    drawEdgeGroups(target, [], ORIGIN);
    expect(clear).toHaveBeenCalled();
  });
});
```

- [ ] **Adım 2: Testleri çalıştır, başarısız olduklarını gör**

```bash
yarn workspace frontend test src/utils/map/layers.spec.ts src/components/UniverseMap/scene/edges.spec.ts
```

Beklenen: FAIL — `groupSegmentsByTint is not exported`, `drawEdgeGroups is not exported`.

- [ ] **Adım 3: Gruplamayı yaz**

`frontend/src/utils/map/layers.ts`'in sonuna (içe aktarımlara
`import type { EdgeSegment } from './edges';` eklenerek):

```ts
export interface EdgeGroup {
  /** null is the neutral grey the security layer draws everything in. */
  tint: number | null;
  segments: EdgeSegment[];
}

/**
 * The mesh, split into one path per colour.
 *
 * Pure and here rather than in the scene, because it is the whole of the
 * decision: `scene/edges.ts` only lays the paths down. Worst case is 101
 * colours plus the neutral group, each averaging ~70 segments, and it is a
 * build-once cost — `pixelLine: true` keeps the geometry valid at every zoom,
 * so this runs on a layer change and never on a wheel tick.
 *
 * The neutral group is emitted first so the borders are under the territories.
 */
export function groupSegmentsByTint(
  segments: EdgeSegment[],
  layer: MapColorLayer,
  data: MapLayerData,
): EdgeGroup[] {
  const byTint = new Map<number | null, EdgeSegment[]>();

  for (const segment of segments) {
    const tint = layer.edgeTint(
      { from: segment.systems[0], to: segment.systems[1] },
      data,
    );
    const group = byTint.get(tint);
    if (group) group.push(segment);
    else byTint.set(tint, [segment]);
  }

  const groups: EdgeGroup[] = [];
  const neutral = byTint.get(null);
  if (neutral) groups.push({ tint: null, segments: neutral });
  for (const [tint, group] of byTint) {
    if (tint !== null) groups.push({ tint, segments: group });
  }
  return groups;
}
```

- [ ] **Adım 4: Çizimi yaz**

`frontend/src/components/UniverseMap/scene/edges.ts`'e, `drawEdges`'in altına:

```ts
/**
 * The galaxy mesh when the layer colours it.
 *
 * `drawEdges` stays as it is for the local mesh and this takes over the galaxy
 * one: the two differ only in how many styles the path is laid down in, and a
 * one-group call here is `drawEdges` exactly.
 *
 * Each group is laid down twice for the same reason `drawEdges` is — the
 * solid pieces and the dashes a region crossing was cut into share every part
 * of their style but the dashing — and `strokeAll` returns early on an empty
 * list, so a group with no crossings costs one call and no path.
 */
export function drawEdgeGroups(
  target: Graphics,
  groups: EdgeGroup[],
  origin: MapOrigin,
): void {
  target.clear();
  target.position.set(origin.x, origin.z);

  for (const group of groups) {
    const colour = group.tint ?? GATE_TINT;
    const { solid, dashed } = splitDashed(group.segments);
    strokeAll(target, solid, colour, GATE_ALPHA);
    strokeAll(target, dashed, colour, GATE_ALPHA);
  }
}
```

İçe aktarımlara `import type { EdgeGroup } from '@/utils/map/layers';` eklenir.
`GATE_ALPHA` her iki grupta da aynı: sov katmanında kapı rengini değiştiriyoruz,
malzemesini değil — renkli çizgi de gri çizgiyle aynı perdeden okunmalı.

- [ ] **Adım 5: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace frontend test src/utils/map/layers.spec.ts src/components/UniverseMap/scene/edges.spec.ts
```

Beklenen: 16 + 2 test PASS.

- [ ] **Adım 6: Commit**

```bash
npx prettier --check frontend/src/utils/map/layers.ts frontend/src/utils/map/layers.spec.ts \
  frontend/src/components/UniverseMap/scene/edges.ts frontend/src/components/UniverseMap/scene/edges.spec.ts
git add frontend/src/utils/map frontend/src/components/UniverseMap/scene
git commit -m "feat(map): stroke the gate mesh once per owner colour"
```

---

## Görev 5: Logo yerleşimi — `sovLogos.ts`

**Dosyalar:**

- Oluştur: `frontend/src/utils/map/sovLogos.ts`
- Oluştur: `frontend/src/utils/map/sovLogos.spec.ts`

**Arayüzler:**

- Tüketir: `utils/eveImageUrl.ts`'ten `eveImageUrl`; `@/generated/graphql`'den
  `MapOwnerKind`.
- Üretir: `LOGO_CELL_PX = 128`, `LOGO_TEXTURE_RADIUS = 64`,
  `LOGO_ATLAS_COLUMNS = 10`, `LOGO_MIN_RADIUS_PX = 8`,
  `DEFAULT_EMBLEM_OWNER_ID = 500003`,
  `logoUrl(owner: LogoOwner): string`,
  `interface LogoOwner { ownerId: number; kind: MapOwnerKind }`,
  `interface FrameLayout { cellByOwner: Map<number, number>; fallbackCell: number; cellCount: number }`,
  `assignFrames(owners: LogoOwner[], hasOwnLogo: (ownerId: number) => boolean): FrameLayout`,
  `atlasSize(cellCount: number): { columns: number; rows: number; width: number; height: number }`,
  `cellRect(cell: number): { x: number; y: number; width: number; height: number }`,
  `sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean`.

- [ ] **Adım 1: Başarısız testi yaz**

`frontend/src/utils/map/sovLogos.spec.ts`:

```ts
import { MapOwnerKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  assignFrames,
  atlasSize,
  cellRect,
  LOGO_CELL_PX,
  logoUrl,
  sameBytes,
} from './sovLogos';

const alliance = (ownerId: number) => ({
  ownerId,
  kind: MapOwnerKind.Alliance,
});

describe('logoUrl', () => {
  it('asks the alliance path for an alliance', () => {
    expect(logoUrl(alliance(99003581))).toBe(
      'https://images.evetech.net/alliances/99003581/logo?size=128',
    );
  });

  it('asks the CORPORATION path for a faction', () => {
    // Measured trap: alliances/500003/logo answers 200 with the default
    // alliance emblem, so a faction fetched down the alliance path is drawn
    // as a generic star instead of its own crest — and nothing in the HTTP
    // status says so.
    expect(logoUrl({ ownerId: 500003, kind: MapOwnerKind.Faction })).toBe(
      'https://images.evetech.net/corporations/500003/logo?size=128',
    );
  });

  it('asks for exactly one cell of the atlas', () => {
    // The image server only serves powers of two, and the atlas cell is what
    // the image is drawn into 1:1 — a mismatch would resample every logo.
    expect(logoUrl(alliance(1))).toContain(`size=${LOGO_CELL_PX}`);
  });
});

describe('assignFrames', () => {
  const owners = [alliance(1), alliance(2), alliance(3)];
  const hasOwnLogo = (ownerId: number) => ownerId !== 2 && ownerId !== 3;

  it('gives an owner with its own logo a cell of its own', () => {
    const layout = assignFrames(owners, hasOwnLogo);
    expect(layout.cellByOwner.get(1)).toBe(0);
  });

  it('points every logo-less owner at one shared cell', () => {
    // The default emblem is byte-identical for all of them — 22 of the 79 sov
    // alliances as of 2026-09-20 — so 22 cells would hold 22 copies of one
    // image and the client would download it 22 times.
    const layout = assignFrames(owners, hasOwnLogo);
    expect(layout.cellByOwner.get(2)).toBe(layout.fallbackCell);
    expect(layout.cellByOwner.get(3)).toBe(layout.fallbackCell);
    expect(layout.cellCount).toBe(2);
  });

  it('allocates no fallback cell when every owner has a logo', () => {
    const layout = assignFrames(owners, () => true);
    expect(layout.cellCount).toBe(3);
    expect(layout.fallbackCell).toBe(-1);
  });
});

describe('atlasSize', () => {
  it('fills ten columns and derives the rows', () => {
    expect(atlasSize(80)).toEqual({
      columns: 10,
      rows: 8,
      width: 1280,
      height: 1024,
    });
  });

  it('grows by a row rather than shrinking the cell', () => {
    // A cell that is not exactly LOGO_CELL_PX would resample every logo it
    // holds; an extra row costs 1280 x 128 of texture and nothing else.
    expect(atlasSize(81).rows).toBe(9);
    expect(atlasSize(1)).toEqual({
      columns: 10,
      rows: 1,
      width: 1280,
      height: 128,
    });
  });
});

describe('cellRect', () => {
  it('walks the grid row by row', () => {
    expect(cellRect(0)).toEqual({ x: 0, y: 0, width: 128, height: 128 });
    expect(cellRect(9)).toEqual({ x: 1152, y: 0, width: 128, height: 128 });
    expect(cellRect(10)).toEqual({ x: 0, y: 128, width: 128, height: 128 });
  });
});

describe('sameBytes', () => {
  it('is how a logo-less owner is recognised', () => {
    const a = new Uint8Array([1, 2, 3]).buffer;
    const b = new Uint8Array([1, 2, 3]).buffer;
    const c = new Uint8Array([1, 2, 4]).buffer;
    expect(sameBytes(a, b)).toBe(true);
    expect(sameBytes(a, c)).toBe(false);
    expect(sameBytes(a, new Uint8Array([1, 2]).buffer)).toBe(false);
  });
});
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace frontend test src/utils/map/sovLogos.spec.ts
```

Beklenen: FAIL — `Failed to resolve import "./sovLogos"`.

- [ ] **Adım 3: Modülü yaz**

`frontend/src/utils/map/sovLogos.ts`:

```ts
import { MapOwnerKind } from '@/generated/graphql';
import { eveImageUrl } from '@/utils/eveImageUrl';

/**
 * One atlas cell, and the size every logo is fetched at. 128 is a power of two
 * — the image server answers 400 to anything else — and the image is drawn
 * into the cell 1:1, so no logo is ever resampled.
 */
export const LOGO_CELL_PX = 128;

/** Half a cell: what `spriteScale` divides out, as DOT_TEXTURE_RADIUS does. */
export const LOGO_TEXTURE_RADIUS = LOGO_CELL_PX / 2;

export const LOGO_ATLAS_COLUMNS = 10;

/**
 * The smallest a logo is drawn, in pixels of radius.
 *
 * SOV_LOGO_ZOOM is the zoom where 90% of held systems are more than 16 px
 * from their neighbour, so 8 px of radius is the mark that measurement was
 * made for. Past the approach the system's own disc overtakes it and the logo
 * grows with the body, which is why this is a floor and not a size.
 */
export const LOGO_MIN_RADIUS_PX = 8;

/**
 * The id the default emblem is fetched under.
 *
 * 500003 is the Amarr faction, which is not an alliance — so the alliance path
 * has no logo to answer with and serves EVE's default alliance emblem, the
 * very image a logo-less alliance gets. Any id with no alliance behind it
 * would do; this one is stable and documented.
 */
export const DEFAULT_EMBLEM_OWNER_ID = 500003;

export interface LogoOwner {
  ownerId: number;
  kind: MapOwnerKind;
}

/**
 * Where an owner's logo lives, which depends on what kind of owner it is.
 *
 * A faction's crest is served from the CORPORATION path. Down the alliance
 * path it answers 200 with the default alliance emblem — a measured trap,
 * because nothing in the status code says the image is a placeholder.
 */
export function logoUrl(owner: LogoOwner): string {
  return eveImageUrl({
    kind: owner.kind === MapOwnerKind.Alliance ? 'alliance' : 'corporation',
    id: owner.ownerId,
    // eveImageUrl asks for twice the drawn size; half a cell is what makes
    // that land exactly on LOGO_CELL_PX. The spec pins the resulting URL.
    size: LOGO_CELL_PX / 2,
  });
}

export interface FrameLayout {
  cellByOwner: Map<number, number>;
  /** The shared cell for owners with no logo; -1 when every owner has one. */
  fallbackCell: number;
  cellCount: number;
}

/**
 * Which atlas cell each owner draws from.
 *
 * Owners with no logo of their own all get the SAME cell: the default emblem
 * is byte-identical for every one of them — 22 of the 79 sovereignty-holding
 * alliances on 2026-09-20 — so a cell each would hold 22 copies of one image.
 * What tells those 22 apart on the map is the tint their sprites keep; see
 * `applyLogos`.
 */
export function assignFrames(
  owners: LogoOwner[],
  hasOwnLogo: (ownerId: number) => boolean,
): FrameLayout {
  const cellByOwner = new Map<number, number>();
  const missing: number[] = [];
  let next = 0;

  for (const owner of owners) {
    if (hasOwnLogo(owner.ownerId)) cellByOwner.set(owner.ownerId, next++);
    else missing.push(owner.ownerId);
  }

  const fallbackCell = missing.length === 0 ? -1 : next++;
  for (const ownerId of missing) cellByOwner.set(ownerId, fallbackCell);

  return { cellByOwner, fallbackCell, cellCount: next };
}

/**
 * The texture the cells are laid out on: ten columns, and as many rows as the
 * cells need. Derived rather than fixed, because the owner count moves — 101
 * owners hold sovereignty today and 80 of them need a cell, but an alliance
 * taking its first system adds one.
 */
export function atlasSize(cellCount: number): {
  columns: number;
  rows: number;
  width: number;
  height: number;
} {
  const rows = Math.max(1, Math.ceil(cellCount / LOGO_ATLAS_COLUMNS));
  return {
    columns: LOGO_ATLAS_COLUMNS,
    rows,
    width: LOGO_ATLAS_COLUMNS * LOGO_CELL_PX,
    height: rows * LOGO_CELL_PX,
  };
}

export function cellRect(cell: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: (cell % LOGO_ATLAS_COLUMNS) * LOGO_CELL_PX,
    y: Math.floor(cell / LOGO_ATLAS_COLUMNS) * LOGO_CELL_PX,
    width: LOGO_CELL_PX,
    height: LOGO_CELL_PX,
  };
}

/**
 * Whether two downloads are the same image, byte for byte.
 *
 * This is how "this alliance has no logo" is detected, because the HTTP status
 * will not say: the server answers 200 with the default emblem. Comparing the
 * bytes of the response we already have to the bytes of the default costs one
 * extra download for the whole atlas and no decoding at all.
 */
export function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
```

- [ ] **Adım 4: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace frontend test src/utils/map/sovLogos.spec.ts
```

Beklenen: 11 test PASS.

- [ ] **Adım 5: Commit**

```bash
npx prettier --check frontend/src/utils/map/sovLogos.ts frontend/src/utils/map/sovLogos.spec.ts
git add frontend/src/utils/map/sovLogos.ts frontend/src/utils/map/sovLogos.spec.ts
git commit -m "feat(map): lay out the owner logo atlas, one shared cell for the logo-less"
```

---

## Görev 6: Çizim — atlas kurulumu ve sprite'lara yazma

**Dosyalar:**

- Oluştur: `frontend/src/components/UniverseMap/scene/logoAtlas.ts`
- Değişiklik: `frontend/src/components/UniverseMap/scene/systems.ts`
- Oluştur: `frontend/src/components/UniverseMap/scene/systems.spec.ts`

**Arayüzler:**

- Tüketir: Görev 5'ten `assignFrames`, `atlasSize`, `cellRect`, `logoUrl`,
  `sameBytes`, `LOGO_CELL_PX`, `LOGO_TEXTURE_RADIUS`, `LOGO_MIN_RADIUS_PX`,
  `DEFAULT_EMBLEM_OWNER_ID`; Görev 3'ten `MapColorLayer`, `MapLayerData`.
- Üretir: `interface LogoAtlas { textureByOwner: Map<number, Texture>; tintedOwners: Set<number>; destroy(): void }`,
  `buildLogoAtlas(owners: LogoOwner[]): Promise<LogoAtlas | null>`,
  `applyLayer(built, nodes, layer, data): void`,
  `applyLogos(built, nodes, dot, atlas, on, ownerBySystem, cameraScale): void`,
  `SystemSprites` artık `logos: boolean[]` taşıyor.

- [ ] **Adım 1: Başarısız testi yaz**

`frontend/src/components/UniverseMap/scene/systems.spec.ts`:

```ts
import type { MapNode } from '@/generated/graphql';
import { securityTint } from '@/utils/map/colors';
import {
  buildSovIndex,
  MAP_LAYERS,
  type MapLayerData,
} from '@/utils/map/layers';
import { LOGO_MIN_RADIUS_PX, LOGO_TEXTURE_RADIUS } from '@/utils/map/sovLogos';
import { spriteScale, SYSTEM_MAX_FLOOR_PX } from '@/utils/map/marks';
import { SOV_COLORS, SOV_UNOWNED_TINT, sovTint } from '@/utils/map/sovColors';
import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';
import { applyLayer, applyLogos, buildSystems } from './systems';

/**
 * Sprites and their transforms are plain arithmetic; Pixi needs a GPU to draw
 * them, not to build them. Same fake scene celestials.spec.ts uses.
 */
function fakeScene(): MapScene {
  return {
    app: null as unknown as MapScene['app'],
    world: new Container(),
    edgesGalaxy: null as unknown as MapScene['edgesGalaxy'],
    edgesHighlight: null as unknown as MapScene['edgesHighlight'],
    edgesLocal: null as unknown as MapScene['edgesLocal'],
    systems: new Container(),
    celestials: new Container(),
    dot: Texture.EMPTY,
    destroy: () => {},
  };
}

const WITH_LOGO = Number(Object.keys(SOV_COLORS)[0]);
const NO_LOGO = Number(Object.keys(SOV_COLORS)[1]);

function node(systemId: number, securityStatus = 0.5): MapNode {
  return {
    systemId,
    name: `S-${systemId}`,
    x: 0,
    z: 0,
    radius: 1,
    securityStatus,
    constellationId: 20000001,
    regionId: 10000001,
  };
}

const NODES = [node(1), node(2), node(3, -0.4)];

const DATA: MapLayerData = {
  sovereignty: buildSovIndex({
    systems: [
      { systemId: 1, ownerId: WITH_LOGO },
      { systemId: 2, ownerId: NO_LOGO },
    ],
  }),
};

const OWN_LOGO_TEXTURE = new Texture();
const FALLBACK_TEXTURE = new Texture();

const ATLAS = {
  textureByOwner: new Map([
    [WITH_LOGO, OWN_LOGO_TEXTURE],
    [NO_LOGO, FALLBACK_TEXTURE],
  ]),
  tintedOwners: new Set([NO_LOGO]),
  destroy: () => {},
};

describe('applyLayer', () => {
  it('writes the layer colour over whatever the sprites carried', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);

    expect(built.sprites[2].tint).toBe(securityTint(-0.4));

    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);

    expect(built.sprites[0].tint).toBe(sovTint(WITH_LOGO));
    expect(built.sprites[2].tint).toBe(SOV_UNOWNED_TINT);
  });
});

describe('applyLogos', () => {
  const ownerBySystem = DATA.sovereignty!.ownerBySystem;

  it('swaps a held system to its owner logo and drops the tint', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(OWN_LOGO_TEXTURE);
    // White, or the tint would multiply the logo's own colours.
    expect(built.sprites[0].tint).toBe(0xffffff);
  });

  it('keeps the owner colour on a logo-less owner sharing the default emblem', () => {
    // The emblem is the same image for all of them, so the colour is the only
    // thing left that says WHICH alliance this system belongs to.
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[1].texture).toBe(FALLBACK_TEXTURE);
    expect(built.sprites[1].tint).toBe(sovTint(NO_LOGO));
  });

  it('leaves an unheld system as a dot', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[2].texture).toBe(scene.dot);
    expect(built.logos[2]).toBe(false);
  });

  it('sizes a logo from its own texture radius and floor', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    // A 1 m radius at scale 1 is far under both floors, so the floor decides
    // the size. systemFloorPx(log2(1) = 0) is past APPROACH_ZOOM, so the dot's
    // floor is SYSTEM_MAX_FLOOR_PX (6) and the logo's is the larger of that
    // and LOGO_MIN_RADIUS_PX (8).
    expect(built.sprites[0].scale.x).toBeCloseTo(
      spriteScale(LOGO_MIN_RADIUS_PX, LOGO_TEXTURE_RADIUS, 1),
    );
    expect(built.sprites[2].scale.x).toBeCloseTo(
      spriteScale(SYSTEM_MAX_FLOOR_PX, DOT_TEXTURE_RADIUS, 1),
    );
  });

  it('puts every dot back when the threshold is crossed downward', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, false, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(scene.dot);
    expect(built.logos.every((on) => on === false)).toBe(true);
  });

  it('draws dots when the atlas has not arrived yet', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, null, true, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(scene.dot);
  });
});
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace frontend test src/components/UniverseMap/scene/systems.spec.ts
```

Beklenen: FAIL — `applyLayer is not exported`.

- [ ] **Adım 3: `systems.ts`'i genişlet**

`SystemSprites`'a sprite başına logo bayrağı eklenir, `buildSystems` onu
`false` ile doldurur, `scaleSystems` ona bakar, ve iki yeni geçiş gelir:

```ts
export interface SystemSprites {
  sprites: Sprite[];
  radii: number[];
  /**
   * Per sprite, whether it is currently showing a logo. Two marks with two
   * texture radii and two floors share one pass, so the pass has to know which
   * of them it is looking at — and a system with no owner stays a dot even at
   * a zoom where its neighbours are logos.
   */
  logos: boolean[];
}
```

`buildSystems` içinde, `radii.push(node.radius)` satırının yanına
`logos.push(false)` ve dönen nesneye `logos` eklenir.

`scaleSystems`:

```ts
export function scaleSystems(
  { sprites, radii, logos }: SystemSprites,
  cameraScale: number,
): void {
  const floorPx = systemFloorPx(Math.log2(cameraScale));

  for (let i = 0; i < sprites.length; i++) {
    // A logo is a mark, not a body: it has a floor of its own (the 16 px the
    // threshold was measured for) and a texture twice the dot's. Past the
    // approach the system's own radius overtakes both, so the logo grows with
    // the disc rather than sitting in the middle of it.
    const textureRadius = logos[i] ? LOGO_TEXTURE_RADIUS : DOT_TEXTURE_RADIUS;
    const floor = logos[i] ? Math.max(floorPx, LOGO_MIN_RADIUS_PX) : floorPx;

    sprites[i].scale.set(
      spriteScale(
        systemRadiusPx(radii[i], cameraScale, floor),
        textureRadius,
        cameraScale,
      ),
    );
  }
}

/**
 * The layer's colour on every sprite. One pass, run on a layer change and not
 * on a camera move: nothing here depends on the zoom.
 */
export function applyLayer(
  { sprites }: SystemSprites,
  nodes: MapNode[],
  layer: MapColorLayer,
  data: MapLayerData,
): void {
  for (let i = 0; i < sprites.length; i++) {
    sprites[i].tint = layer.tint(nodes[i], data);
  }
}

/**
 * Dots to logos and back, at the one threshold.
 *
 * Called after `applyLayer`, never instead of it: the layer writes the colour
 * and this whitens only the sprites that ended up showing a logo of their own.
 * The owners drawing the shared default emblem keep their colour — the emblem
 * is identical for all of them, so the tint is the only thing left that says
 * which alliance a system belongs to.
 *
 * A system with no owner, an owner with no cell, and the whole of the map
 * before the atlas has arrived all stay dots.
 */
export function applyLogos(
  built: SystemSprites,
  nodes: MapNode[],
  dot: Texture,
  atlas: LogoAtlas | null,
  on: boolean,
  ownerBySystem: Map<number, number>,
  cameraScale: number,
): void {
  const { sprites, logos } = built;

  for (let i = 0; i < sprites.length; i++) {
    const ownerId = ownerBySystem.get(nodes[i].systemId);
    const logo =
      on && atlas && ownerId !== undefined
        ? atlas.textureByOwner.get(ownerId)
        : undefined;

    if (logo && ownerId !== undefined) {
      sprites[i].texture = logo;
      logos[i] = true;
      if (!atlas!.tintedOwners.has(ownerId)) sprites[i].tint = 0xffffff;
    } else {
      sprites[i].texture = dot;
      logos[i] = false;
    }
  }

  // The texture radius just changed under half the sprites, so the
  // counter-scale has to run before the next frame draws them at the other
  // mark's size.
  scaleSystems(built, cameraScale);
}
```

İçe aktarımlara `Texture` (pixi.js), `LOGO_MIN_RADIUS_PX`,
`LOGO_TEXTURE_RADIUS` (`@/utils/map/sovLogos`), `MapColorLayer`,
`MapLayerData` (`@/utils/map/layers`) ve `LogoAtlas` (`./logoAtlas`) eklenir.

- [ ] **Adım 4: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace frontend test src/components/UniverseMap/scene/systems.spec.ts
```

Beklenen: 7 test PASS.

- [ ] **Adım 5: Atlası kur**

`frontend/src/components/UniverseMap/scene/logoAtlas.ts` — testi yok: ağ,
`createImageBitmap` ve bir GPU dokusu, üçü de tarayıcının işi.

```ts
import {
  assignFrames,
  atlasSize,
  cellRect,
  DEFAULT_EMBLEM_OWNER_ID,
  logoUrl,
  sameBytes,
  type LogoOwner,
} from '@/utils/map/sovLogos';
import { MapOwnerKind } from '@/generated/graphql';
import { Rectangle, Texture } from 'pixi.js';

export interface LogoAtlas {
  textureByOwner: Map<number, Texture>;
  /** Owners drawn with the shared default emblem; they keep their tint. */
  tintedOwners: Set<number>;
  destroy(): void;
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Every owner's logo on one texture, built once per session.
 *
 * One base texture and one draw call is what keeps `buildSystems`'s batching:
 * 5,241 sprites sharing a texture are one batch, and 80 textures would be 80.
 *
 * "This alliance has no logo" cannot be read off the HTTP status — the server
 * answers 200 with EVE's default alliance emblem — so the default is fetched
 * once and every response is compared to it byte for byte. The 22 owners that
 * match share a single cell, and their sprites keep their colour so that one
 * emblem can still stand for 22 different alliances.
 *
 * Returns null when nothing could be drawn at all, which the caller reads as
 * "stay on dots".
 */
export async function buildLogoAtlas(
  owners: LogoOwner[],
): Promise<LogoAtlas | null> {
  const fallbackBytes = await fetchBytes(
    logoUrl({
      ownerId: DEFAULT_EMBLEM_OWNER_ID,
      kind: MapOwnerKind.Alliance,
    }),
  );

  const downloads = await Promise.all(
    owners.map(async (owner) => ({
      owner,
      bytes: await fetchBytes(logoUrl(owner)),
    })),
  );

  const bytesByOwner = new Map<number, ArrayBuffer>();
  const missing = new Set<number>();
  for (const { owner, bytes } of downloads) {
    if (!bytes) {
      missing.add(owner.ownerId);
      continue;
    }
    // A failed default download leaves nothing to compare against, so every
    // logo is taken at face value: the 22 then draw the emblem untinted,
    // which is the wrong reading but never a blank map.
    if (fallbackBytes && sameBytes(bytes, fallbackBytes)) {
      missing.add(owner.ownerId);
      continue;
    }
    bytesByOwner.set(owner.ownerId, bytes);
  }

  const layout = assignFrames(owners, (id) => bytesByOwner.has(id));
  if (layout.cellCount === 0) return null;

  const size = atlasSize(layout.cellCount);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  async function draw(cell: number, bytes: ArrayBuffer): Promise<void> {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const rect = cellRect(cell);
    context!.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
    bitmap.close();
  }

  const drawings: Promise<void>[] = [];
  for (const [ownerId, bytes] of bytesByOwner) {
    drawings.push(draw(layout.cellByOwner.get(ownerId)!, bytes));
  }
  if (layout.fallbackCell >= 0 && fallbackBytes) {
    drawings.push(draw(layout.fallbackCell, fallbackBytes));
  }
  await Promise.all(drawings);

  const base = Texture.from(canvas);
  const textureByOwner = new Map<number, Texture>();
  const frames = new Map<number, Texture>();

  for (const [ownerId, cell] of layout.cellByOwner) {
    // One Texture per CELL, not per owner: the 22 that share the default
    // emblem share its frame too, so Pixi holds one object for all of them.
    let frame = frames.get(cell);
    if (!frame) {
      const rect = cellRect(cell);
      frame = new Texture({
        source: base.source,
        frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
      });
      frames.set(cell, frame);
    }
    textureByOwner.set(ownerId, frame);
  }

  return {
    textureByOwner,
    tintedOwners: missing,
    destroy: () => {
      for (const frame of frames.values()) frame.destroy();
      base.destroy(true);
    },
  };
}
```

- [ ] **Adım 6: Tip kontrolü ve commit**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap/scene/systems.ts \
  frontend/src/components/UniverseMap/scene/systems.spec.ts \
  frontend/src/components/UniverseMap/scene/logoAtlas.ts
git add frontend/src/components/UniverseMap/scene
git commit -m "feat(map): draw a held system as its owner's logo past the measured zoom"
```

---

## Görev 7: Bağlama — sorgu, hook ve `UniverseMap` effect'leri

**Dosyalar:**

- Oluştur: `frontend/src/graphql/MapSovereignty.graphql`
- Oluştur: `frontend/src/components/UniverseMap/useMapSovereignty.ts`
- Değişiklik: `frontend/src/components/UniverseMap/UniverseMap.tsx`

**Arayüzler:**

- Tüketir: Görev 1'in `mapSovereignty` sorgusu; Görev 3'ten `MAP_LAYERS`,
  `buildSovIndex`, `groupSegmentsByTint`, `type MapLayerId`,
  `type MapLayerData`; Görev 4'ten `drawEdgeGroups`; Görev 6'dan `applyLayer`,
  `applyLogos`, `buildLogoAtlas`.
- Üretir: `useMapSovereignty(scope, active)` →
  `{ index: SovIndex | null; owners: MapSovereigntyQuery['mapSovereignty']['owners'] }`;
  `UniverseMap` içinde `layerId` state'i ve onu değiştiren `setLayerId`.

- [ ] **Adım 1: Sorgu dokümanını yaz**

`frontend/src/graphql/MapSovereignty.graphql`:

```graphql
# Adı PUBLIC_CACHE_QUERIES'te **yok** ve bu bilerek: servisin kendi 900 s'lik
# Redis anahtarı zaten işi görüyor, response cache ikinci bir katman olarak
# yalnızca bayatlığı ikiye katlardı. Listeye eklenirse TTL'i
# TTL_PER_SCHEMA_COORDINATE'a da girmek zorunlu — yoksa 120 s'lik
# DEFAULT_PUBLIC'e ve token başına bir oturum anahtarına düşer.
query MapSovereignty($scope: MapScope!) {
  mapSovereignty(scope: $scope) {
    scope
    updatedAt
    owners {
      ownerId
      kind
      name
      ticker
      systemCount
    }
    systems {
      systemId
      ownerId
    }
  }
}
```

- [ ] **Adım 2: Codegen'i çalıştır**

```bash
yarn workspace frontend codegen
```

Beklenen: `frontend/src/generated/graphql.ts` içinde `useMapSovereigntyQuery`
ve `MapOwnerKind` görünür. (Backend codegen'i Görev 1'de çalıştı; şema
değişmediyse tekrar gerekmez.)

- [ ] **Adım 3: Hook'u yaz**

`frontend/src/components/UniverseMap/useMapSovereignty.ts`:

```ts
'use client';

import {
  useMapSovereigntyQuery,
  type MapScope,
  type MapSovereigntyQuery,
} from '@/generated/graphql';
import { buildSovIndex, type SovIndex } from '@/utils/map/layers';
import { useMemo } from 'react';

/**
 * Stable identity for "no rows yet", the same reason useMapLabels holds one:
 * `data?.x ?? []` mints a new array on every render while data is undefined,
 * and every effect that depends on it would re-run.
 */
const EMPTY: MapSovereigntyQuery['mapSovereignty']['owners'] = [];

/**
 * The sovereignty layer's data, fetched only while the layer is selected.
 *
 * The rule phases 2 and 3 set: a dataset that is not drawn is not fetched
 * either. Someone who opens the map and never leaves the security layer never
 * downloads the 5,383 pairs. Apollo keeps them once fetched, so switching back
 * and forth costs one request per session.
 */
export function useMapSovereignty(
  scope: MapScope,
  active: boolean,
): {
  index: SovIndex | null;
  owners: MapSovereigntyQuery['mapSovereignty']['owners'];
} {
  const { data } = useMapSovereigntyQuery({
    variables: { scope },
    fetchPolicy: 'cache-first',
    skip: !active,
  });

  const sovereignty = data?.mapSovereignty;

  // Two Maps over 5,383 rows, built once per fetch rather than per render:
  // the effects below take the index as a dependency, so a fresh object each
  // render would rewrite 5,241 tints on every pointer move.
  const index = useMemo(
    () => (sovereignty ? buildSovIndex(sovereignty) : null),
    [sovereignty],
  );

  return { index, owners: sovereignty?.owners ?? EMPTY };
}
```

- [ ] **Adım 4: `UniverseMap.tsx` — state ve veri**

`const [webgl] = useState(isWebgl2Available);` satırının altına:

```tsx
// The layer lives in component state, not the URL: `scope`, the camera and
// `?focus=` are all in the URL because they are what a shared link has to
// carry, and which colouring the sender happened to be looking at is not.
const [layerId, setLayerId] = useState<MapLayerId>('security');
```

`hovered` state'inin altına, atlası tutan iki satır:

```tsx
// The logo atlas: a long-lived GPU object, so a ref for the same reason the
// scene is one. `atlasReady` is the render-visible signal that stands in for
// "the ref now points at something".
const atlas = useRef<LogoAtlas | null>(null);
const [atlasReady, setAtlasReady] = useState(false);
```

`const { regions, constellations } = useMapLabels(...)` satırının altına:

```tsx
const layer = MAP_LAYERS[layerId];
const { index: sovIndex, owners: sovOwners } = useMapSovereignty(
  scope,
  layerId === 'sovereignty',
);

// One object for both the marks and the mesh, so the two can never be
// reading different sovereignty.
const layerData = useMemo<MapLayerData>(
  () => ({ sovereignty: sovIndex }),
  [sovIndex],
);

// A boolean, not the zoom: this is what the logo pass keys on, so the
// threshold fires once on the way in and once on the way out instead of on
// every wheel tick — 5,241 texture writes a tick is exactly what the spec's
// "eşik geçişi yalnızca bir kez" line is about.
const showLogos = camera ? layer.usesLogos(camera.zoom) : false;
```

`camera` yukarıda tanımlandığı için bu blok `useMapCamera` çağrısının
**altında** durmalı; `layer` ve `layerData` ondan önce de tanımlanabilir ama
tek blok hâlinde tutmak okunmayı kolaylaştırıyor.

- [ ] **Adım 5: `UniverseMap.tsx` — galaksi effect'ini ikiye ayır**

Mevcut galaksi effect'inden `drawEdges(...)` çağrısı çıkarılır; sprite kurulumu
kalır:

```tsx
useEffect(() => {
  if (!scene.current || !geometry || !galaxyMesh) return;
  systemSprites.current = buildSystems(
    scene.current,
    geometry.nodes,
    cameraScale.current,
  );
}, [sceneReady, geometry, galaxyMesh]);

// The galaxy mesh, coloured by the layer. Its own effect and not part of the
// build above: a layer change must not rebuild 5,241 sprites, and the mesh
// has to be redrawn for a change the sprites would not notice — two systems
// changing hands recolours the gate between them.
//
// Still build-once with respect to the camera: `pixelLine: true` keeps the
// stroke one pixel at every scale, so no zoom touches this.
useEffect(() => {
  if (!scene.current || !galaxyMesh) return;
  drawEdgeGroups(
    scene.current.edgesGalaxy,
    groupSegmentsByTint(galaxyMesh.segments, layer, layerData),
    galaxyMesh.origin,
  );
}, [sceneReady, galaxyMesh, layer, layerData]);
```

- [ ] **Adım 6: `UniverseMap.tsx` — atlas ve işaretler**

Yukarıdaki effect'in altına iki effect daha:

```tsx
// Built the first time the logos are actually wanted, and once per session.
// Someone who looks at the galaxy from far out downloads none of the 80
// images; someone who zooms in downloads them once and keeps them across
// every later crossing of the threshold.
useEffect(() => {
  if (!showLogos || atlas.current || sovOwners.length === 0) return;
  let live = true;

  buildLogoAtlas(
    sovOwners.map((owner) => ({ ownerId: owner.ownerId, kind: owner.kind })),
  ).then((built) => {
    if (!live) {
      built?.destroy();
      return;
    }
    atlas.current = built;
    setAtlasReady(built !== null);
  });

  return () => {
    live = false;
  };
}, [showLogos, sovOwners]);

// The marks. Both passes in one effect and in this order on purpose: the
// layer writes every tint, then the logo pass whitens only the sprites that
// ended up showing a logo of their own. Split in two, a layer-data change
// would rewrite the tints without the second pass running, and every logo
// would be multiplied by its owner's colour.
useEffect(() => {
  if (!scene.current || !geometry || !systemSprites.current) return;

  applyLayer(systemSprites.current, geometry.nodes, layer, layerData);
  applyLogos(
    systemSprites.current,
    geometry.nodes,
    scene.current.dot,
    atlas.current,
    showLogos,
    sovIndex?.ownerBySystem ?? EMPTY_OWNERS,
    cameraScale.current,
  );
}, [sceneReady, geometry, layer, layerData, showLogos, atlasReady, sovIndex]);
```

Dosyanın tepesine, `MapMessage`'ın üstüne:

```tsx
/** Stable empty lookup, so a map with no sovereignty data allocates nothing. */
const EMPTY_OWNERS = new Map<number, number>();
```

Sahne sökümünde atlas da serbest bırakılır — sahne effect'inin cleanup'ında,
`systemSprites.current = null;` satırının yanına:

```tsx
atlas.current?.destroy();
atlas.current = null;
setAtlasReady(false);
```

- [ ] **Adım 7: Doğrula**

```bash
yarn workspace frontend test
yarn workspace frontend typecheck
yarn workspace frontend lint
```

Beklenen: testler yeşil; `lint` sayısı `main`'inkiyle aynı ve girdilerin
hiçbiri bu dalın dosyalarını adlandırmıyor.

- [ ] **Adım 8: Commit**

```bash
npx prettier --check frontend/src/graphql/MapSovereignty.graphql \
  frontend/src/components/UniverseMap/useMapSovereignty.ts \
  frontend/src/components/UniverseMap/UniverseMap.tsx
git add frontend/src
git commit -m "feat(map): colour the scene by sovereignty when the layer is selected"
```

---

## Görev 8: Katman anahtarı ve lejant

**Dosyalar:**

- Oluştur: `frontend/src/components/UniverseMap/MapLayerSwitch.tsx`
- Oluştur: `frontend/src/components/UniverseMap/SovLegend.tsx`
- Oluştur: `frontend/src/components/UniverseMap/SovLegend.spec.tsx`
- Değişiklik: `frontend/src/components/UniverseMap/UniverseMap.tsx`

**Arayüzler:**

- Tüketir: Görev 3'ten `MAP_LAYERS`, `type MapLayerId`, `type LegendSpec`;
  Görev 2'den `SOV_COLORS`; Görev 7'den `layerId`, `setLayerId`, `sovOwners`.
- Üretir: `<MapLayerSwitch value onChange />`, `<SovLegend owners max />`.

- [ ] **Adım 1: Lejantın başarısız testini yaz**

`frontend/src/components/UniverseMap/SovLegend.spec.tsx`:

```tsx
import { MapOwnerKind } from '@/generated/graphql';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SovLegend from './SovLegend';

const owners = [
  {
    ownerId: 1,
    kind: MapOwnerKind.Alliance,
    name: 'A',
    ticker: 'AAA',
    systemCount: 500,
  },
  {
    ownerId: 2,
    kind: MapOwnerKind.Alliance,
    name: 'B',
    ticker: 'BBB',
    systemCount: 300,
  },
  {
    ownerId: 3,
    kind: MapOwnerKind.Faction,
    name: 'C',
    ticker: null,
    systemCount: 100,
  },
];

describe('SovLegend', () => {
  it('lists the biggest holders with their system counts', () => {
    render(<SovLegend owners={owners} max={2} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('collects everything past the cap into one row', () => {
    // A legend with 101 rows is a list, not a legend; the tail is one line
    // that says how much of the map it covers.
    render(<SovLegend owners={owners} max={2} />);

    expect(screen.queryByText('C')).not.toBeInTheDocument();
    expect(screen.getByText('1 other')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('says so rather than drawing an empty box while the data loads', () => {
    render(<SovLegend owners={[]} max={2} />);
    expect(screen.getByText('Loading sovereignty...')).toBeInTheDocument();
  });
});
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace frontend test src/components/UniverseMap/SovLegend.spec.tsx
```

Beklenen: FAIL — `Failed to resolve import "./SovLegend"`.

- [ ] **Adım 3: Lejantı yaz**

`frontend/src/components/UniverseMap/SovLegend.tsx`:

```tsx
'use client';

import type { MapSovereigntyQuery } from '@/generated/graphql';
import { SOV_COLORS } from '@/utils/map/sovColors';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

/**
 * Not a continuous ramp: the colours stand for owners, and an owner is a name
 * rather than a value on a scale. The biggest holders get a row each and the
 * tail is summed into one, because 101 rows is a list and a legend is a key.
 */
export default function SovLegend({
  owners,
  max,
}: {
  owners: readonly Owner[];
  max: number;
}) {
  if (owners.length === 0) {
    return (
      <div className="float px-3 py-2 text-xs text-ink-muted">
        Loading sovereignty...
      </div>
    );
  }

  const shown = owners.slice(0, max);
  const rest = owners.slice(max);
  const restSystems = rest.reduce((sum, owner) => sum + owner.systemCount, 0);

  return (
    <div className="float flex flex-col px-3 py-2 gap-y-1 text-xs">
      {shown.map((owner) => (
        <div key={owner.ownerId} className="flex items-center gap-x-2">
          <span
            className="size-2 shrink-0 rounded-full"
            // The dictionary hex, not a class: 101 colours cannot be Tailwind
            // classes, and this is the same value the canvas tints with.
            style={{ backgroundColor: SOV_COLORS[owner.ownerId] ?? '#475569' }}
          />
          <span className="flex-1 truncate text-gray-100">{owner.name}</span>
          <span className="text-ink-muted tabular-nums">
            {owner.systemCount}
          </span>
        </div>
      ))}

      {rest.length > 0 && (
        <div className="flex items-center gap-x-2">
          <span className="size-2 shrink-0 rounded-full bg-[#475569]" />
          <span className="flex-1 text-ink-muted">
            {rest.length} other{rest.length === 1 ? '' : 's'}
          </span>
          <span className="text-ink-muted tabular-nums">{restSystems}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Adım 4: Anahtarı yaz**

`frontend/src/components/UniverseMap/MapLayerSwitch.tsx`:

```tsx
'use client';

import { MAP_LAYERS, type MapLayerId } from '@/utils/map/layers';

const IDS = Object.keys(MAP_LAYERS) as MapLayerId[];

/**
 * Two buttons, because there are two layers. A select would hide the choice
 * behind a click, and the whole point of a layer is that switching is cheap.
 *
 * No focus ring: this app shows focus the way hover looks (globals.css).
 */
export default function MapLayerSwitch({
  value,
  onChange,
}: {
  value: MapLayerId;
  onChange: (id: MapLayerId) => void;
}) {
  return (
    <div className="float flex p-1 gap-x-1 text-xs">
      {IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={id === value}
          className={`px-2 py-1 transition-colors ${
            id === value
              ? 'bg-white/10 text-gray-100'
              : 'text-ink-muted hover:text-gray-100'
          }`}
        >
          {MAP_LAYERS[id].label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Adım 5: Haritaya yerleştir**

`UniverseMap.tsx`'in döndürdüğü `<div ref={attachHost} ...>` içine, hover
tip'inin **üstüne**:

```tsx
{
  /* Over the canvas, out of the pointer's way: the map's own pan and zoom
          listeners are on the host, so anything drawn here has to stop its
          events from reaching them — hence the wrapper's own pointer-events. */
}
<div className="absolute top-3 left-3 z-10 flex flex-col gap-y-2">
  <MapLayerSwitch value={layerId} onChange={setLayerId} />
  {layer.legend.kind === 'owners' && (
    <SovLegend owners={sovOwners} max={layer.legend.max} />
  )}
</div>;
```

- [ ] **Adım 6: Testleri çalıştır, geçtiğini gör**

```bash
yarn workspace frontend test src/components/UniverseMap
```

Beklenen: `SovLegend` 3 test PASS, `UniverseMap.spec.tsx` hâlâ yeşil.

- [ ] **Adım 7: Katman değişimini ölç**

Spec'in §10'daki tek ölçülmemiş riski bu: en kötü durumda 101 renk + nötr =
102 grup, her biri düz ve kesikli olmak üzere iki `stroke()` çağrısı. Anahtarı
kullanarak ölç — geçici olarak, Görev 7'nin kapı effect'ini saran iki satırla:

```tsx
const t0 = performance.now();
drawEdgeGroups(/* ... */);
console.log('edge groups', performance.now() - t0);
```

Güvenlik ve sov katmanları arasında üç kez gidip gel, en yüksek değeri not et,
sonra iki satırı geri al. **16 ms'i aşıyorsa** spec'in öngördüğü çıkış yolu
uygulanır: renk grupları tek bir `Graphics` yerine grup başına bir
`Graphics`'e bölünür (`scene.edgesGalaxy` bir `Container` olur). Aşmıyorsa
ölçüm PR gövdesine yazılır ve tasarım olduğu gibi kalır.

- [ ] **Adım 8: Tam doğrulama**

```bash
yarn test
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build:check
npx prettier --check .
```

`build:check` — `build` değil: dev sunucusu çalışıyorsa `.next` dizinini
paylaşmak onu düşürür.

- [ ] **Adım 9: Commit**

```bash
npx prettier --check frontend/src/components/UniverseMap/MapLayerSwitch.tsx \
  frontend/src/components/UniverseMap/SovLegend.tsx \
  frontend/src/components/UniverseMap/SovLegend.spec.tsx \
  frontend/src/components/UniverseMap/UniverseMap.tsx
git add frontend/src/components/UniverseMap
git commit -m "feat(map): add the layer switch and the sovereignty legend"
```

---

## Spec'ten sapmalar

Uygulama planı yazılırken spec'in kapamadığı ya da rakamı tutmayan yedi nokta.
Hepsi PR gövdesinde belirtilmeli.

1. **Atlas ölçüsü.** Spec §3.2 `1024 × 1024` doku ve `10 × 10` ızgara diyor;
   bu 102,4 px'lik bir hücre eder ve her logoyu yeniden örnekler. Plan hücreyi
   **128 px** (görsel sunucusunun servis ettiği ikinin kuvveti) sabitliyor,
   sütun sayısını 10'da tutuyor ve **satır sayısını kare sayısından
   türetiyor**: bugünkü 80 kare `1280 × 1024` demek. Sahip sayısı değiştiğinde
   atlas bir satır uzuyor, hücre hiç küçülmüyor.
2. **Logonun çizim boyu.** Spec eşiği 16 px'e göre ölçtü ama işaretin kaç
   piksel çizileceğini söylemiyor. Plan `LOGO_MIN_RADIUS_PX = 8` (16 px
   genişlik) tabanını koyuyor ve yaklaşmada sistemin kendi yarıçapı bunu
   geçtiğinde logonun diskle birlikte büyümesine izin veriyor — nokta için
   yazılmış `systemRadiusPx` kuralının aynısı, yalnızca tabanı farklı.
3. **Sahipli kapının alfası.** Spec rengi söylüyor, alfayı söylemiyor. Plan
   `GATE_ALPHA`'yı koruyor: sov katmanında kapının **rengini** değiştiriyoruz,
   malzemesini değil.
4. **Katman durumu URL'de değil.** `scope`, kamera ve `?focus=` URL'de, çünkü
   paylaşılan bir bağlantının taşıması gereken şeyler onlar. Hangi
   renklendirmeye bakıldığı o listede değil; bileşen state'i.
5. **`drawEdges` yerinde kalıyor.** Yalnızca galaksi mesh'i
   `drawEdgeGroups`'tan geçiyor; yerel mesh ve hover highlight'ı tek renkli ve
   bugünkü yollarında.
6. **Logosuzluk istemcide ölçülüyor.** Spec 2026-09-19 taramasına dayanıyor,
   yani sabit bir listeye. Plan bunun yerine varsayılan amblemi bir kez indirip
   her yanıtı ona **bayt bayt** karşılaştırıyor: yeni sov alan logosuz bir
   alliance listeyi güncellemeden doğru çiziliyor. Maliyet tek bir fazladan
   indirme.
7. **Sistem içi (celestial) katmanı sov'u bilmiyor.** Yakınlaşınca çizilen
   yıldız/gezegen/istasyon işaretleri bugünkü paletlerinde kalıyor; sov
   katmanı galaksi işaretlerini ve kapıları boyuyor. Spec bunu ne istiyor ne
   de yasaklıyor.

## Doğrulama (PR açılmadan önce, bir kez)

```bash
yarn test
yarn workspace backend build
yarn workspace backend codegen      # şema değiştiyse; çıktısı temiz kalmalı
yarn workspace frontend codegen
yarn workspace frontend lint        # sayı main ile karşılaştırılır
yarn workspace frontend build:check
npx prettier --check .
```

Sov verisi doğrudan bir GraphQL sorgusuyla doğrulanır (Görev 1, Adım 9).
**Haritaya bakmak kullanıcının işi:** renklerin ayrışması, logoların
tanınabilirliği ve eşiğin doğru yerde açılması gözle doğrulanacak şeyler.

## PR şekli

Tek dal — `feat/map-sovereignty-layer` — tek PR, sekiz commit; her görev bir
commit. Etiketler: `feat`, `map`. Bölmek anlamsız: katman kaydı olmadan sov
katmanının, sov katmanı olmadan kaydın gideceği bir yer yok, ve yarım göç
haritada iki renklendirme yolu bırakır.

PR gövdesi düzyazı bölümler hâlinde (#195/#196 gibi): ne çizildiği, eşiğin
nereden geldiği, logosuz 22 alliance'ın neden tek kare paylaştığı, ve
yukarıdaki yedi sapma.
