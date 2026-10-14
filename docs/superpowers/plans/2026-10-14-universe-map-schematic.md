# Evren haritası — şematik yerleşim ve galaktik morph: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/map` CCP'nin şematik 2D yerleşimiyle (SDE `position2D`) açılsın; bir düğme bugünkü galaktik yerleşime 600 ms'lik bir morph ile geçsin.

**Architecture:** `solar_systems`'e iki kolon, #279'un `sde:meta-groups` kalıbıyla bir SDE import'u. `mapGeometry` ve `mapLabels` bir `projection` argümanı alır ve `x/z`'yi o yerleşimde döner; `x/z` okuyan hiçbir frontend modülü değişmez. Frontend'de projeksiyon URL durumu (`view=galactic`); geçişte yalnızca sistem sprite'ları Pixi ticker'ında kayar, gerisi gizlenip sonda yeni geometriyle normal yoldan kurulur.

**Tech Stack:** Prisma + PostgreSQL (`$queryRaw`), GraphQL Yoga + codegen, Redis, Next.js App Router, Apollo Client 3, Pixi.js 8, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-universe-map-schematic-design.md`

## Global Constraints

- Yarn, asla npm. `prisma migrate dev` asla; migration diff-and-deploy ile, elle (CLAUDE.md, _Database migrations_).
- Üretilmiş dosyalar elle düzenlenmez: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`. Kaynak `.graphql` değişir, codegen çalışır; backend codegen frontend'den önce.
- Kolonlar: `position_2d_x Float?`, `position_2d_y Float?`. `position2D.y` haritanın `z`'sidir, işaret çevirmesi yok.
- Enum: `MapProjection { SCHEMATIC GALACTIC }`, varsayılan `SCHEMATIC`. WORMHOLE her zaman `GALACTIC`.
- Cache anahtarları: `map:geometry:${scope}:${projection}`, `map:labels:v3:${scope}:${kind}:${projection}`; TTL 86400 s değişmez.
- URL: `view=galactic` yalnızca galaktikte ve WORMHOLE dışında yazılır; varsayılan şematikte parametre yok.
- `MORPH_DURATION_MS = 600`, ease-in-out. `prefers-reduced-motion` → morph yok, anlık geçiş.
- Düğme etiketleri İngilizce: `Schematic`, `Galactic`. Yeni CSS sınıfı yok: `button button-ghost button-sm` + `aria-pressed`.
- Import betiği `prismaWorker` kullanır, Redis'te desen taraması (`KEYS`) yapmaz, yalnızca adı bilinen anahtarları siler.
- Commit mesajları ve koddaki yorumlar İngilizce; Claude imzası yok.

## Review Focus

- **Morph sırasında pan/zoom/tıklama:** kullanıcı 600 ms içinde sürükler, tekerlek çevirir ya da tıklarsa hiçbir şey olmamalı; kamera ve seçim morph bitince tutarlı kalmalı. → Task 10'da "morph sırasında pointer devre dışı" testi.
- **Morph bitişi ile URL commit arası:** `router.replace` geç commit eder; bu arada sahne eski geometriye geri sıçramamalı, etiketler eski konumlarda çizilmemeli. → Task 10'da "URL commit edilene kadar katmanlar gizli kalır" testi.
- **Morph sürerken başka bir yere gidiş:** morph bir projeksiyondan çıkarken URL dışarıdan (link, scope değişimi) değişirse harita gizli katmanlarla takılı kalmamalı. → Task 10'da "scope değişince morph düşer" testi.
- **Düğmeye morph sırasında yeniden basma / zaten seçili olana basma:** ikinci bir morph başlamamalı. → Task 10'da test.
- **Import'u iki kez çalıştırma:** ikinci çalıştırma hiçbir satırı değiştirmemeli (0 güncelleme) ve hata vermemeli. → Task 4 Step 7'de elle doğrulama.

---

## Dosya haritası

| Dosya                                                                                | Sorumluluk                                                          | Görev |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----- |
| `backend/prisma/schema/solarSystem.prisma`                                           | iki kolon                                                           | 1     |
| `backend/prisma/migrations/<ts>_add_solar_systems_position_2d/migration.sql`         | `ADD COLUMN`                                                        | 1     |
| `backend/src/services/universe/map-cache-keys.ts` (yeni)                             | iki cache anahtarı, Prisma'sız                                      | 2     |
| `backend/src/services/universe/universe-map.service.ts`                              | `MapProjection`, `effectiveProjection`, `positionColumns`, geometri | 2     |
| `backend/src/schemas/UniverseMap.graphql`                                            | enum ve argümanlar                                                  | 2     |
| `backend/src/resolvers/universe-map/queries.ts`                                      | argümanı servise geçirir                                            | 2, 3  |
| `backend/src/services/universe/map-labels.service.ts`                                | projeksiyonlu etiketler                                             | 3     |
| `backend/src/helpers/sde-map-2d.ts` (yeni)                                           | JSONL satır ayrıştırıcı                                             | 4     |
| `backend/src/scripts/import-sde-map-2d.ts` (yeni)                                    | import                                                              | 4     |
| `backend/package.json`                                                               | `sde:map-2d`                                                        | 4     |
| `frontend/src/graphql/MapGeometry.graphql`, `MapLabels.graphql`                      | `$projection`                                                       | 5     |
| `frontend/src/utils/map/camera.ts`                                                   | `parseProjection`, `projectionsFor`, URL yazımı                     | 5     |
| `frontend/src/components/UniverseMap/useMapCamera.ts`                                | projeksiyon state'i, `onProjectionChange`                           | 6     |
| `frontend/src/components/UniverseMap/MapSwitch.tsx` (`MapLayerSwitch.tsx`'in yerine) | jenerik segmentli kontrol                                           | 7     |
| `frontend/src/utils/map/morph.ts` (yeni)                                             | saf morph matematiği                                                | 8     |
| `frontend/src/components/UniverseMap/useReducedMotion.ts` (yeni)                     | `useRingSpin`'den çıkarılan medya sorgusu                           | 9     |
| `frontend/src/components/UniverseMap/useProjectionMorph.ts` (yeni)                   | ticker'a bağlı morph                                                | 9     |
| `frontend/src/components/UniverseMap/useMapLabels.ts`                                | projeksiyon argümanı                                                | 10    |
| `frontend/src/components/UniverseMap/UniverseMap.tsx`                                | bağlama                                                             | 10    |

---

### Task 1: Kolonlar ve migration

**Bu görev `database` agent'ına verilir.** CLAUDE.md'deki diff-and-deploy prosedürü harfiyen izlenir.

**Files:**

- Modify: `backend/prisma/schema/solarSystem.prisma`
- Create: `backend/prisma/migrations/<UTC timestamp>_add_solar_systems_position_2d/migration.sql`

**Interfaces:**

- Produces: `solar_systems.position_2d_x DOUBLE PRECISION NULL`, `solar_systems.position_2d_y DOUBLE PRECISION NULL`; Prisma alanları `position_2d_x`, `position_2d_y`.

- [ ] **Step 1: Beş elle yönetilen tablonun satır sayısını kaydet**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
for t in killmail_filters character_kill_stats corporation_kill_stats alliance_kill_stats refresh_log; do
  psql "$DB" -tAc "SELECT '$t', COUNT(*) FROM $t;"
done
```

Çıktıyı not et.

- [ ] **Step 2: Modele iki alanı ekle**

`backend/prisma/schema/solarSystem.prisma`'da `position_z Float?` satırının altına:

```prisma
  /// CCP's schematic 2D map, from the SDE's mapSolarSystems.jsonl position2D.
  /// ESI does not serve it; `yarn sde:map-2d` fills it. position_2d_y is the
  /// map's z axis. Null for every wormhole, Abyssal and Proving system.
  position_2d_x    Float?
  position_2d_y    Float?
```

- [ ] **Step 3: DDL'i üret, DROP'ları ayıkla, migration'ı yaz**

```bash
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/diff.sql
grep -n "^DROP" /tmp/diff.sql
```

`migration.sql` yalnızca şunu içerir (yorum, `20261001235419_add_types_meta_group_id`'deki gibi):

```sql
-- CCP's schematic 2D map position, from the SDE (yarn sde:map-2d). ESI has no
-- such field. Nullable: wormhole, Abyssal and Proving systems have none.
ALTER TABLE "solar_systems" ADD COLUMN "position_2d_x" DOUBLE PRECISION,
ADD COLUMN "position_2d_y" DOUBLE PRECISION;
```

```bash
grep -n "^[^-]*DROP" prisma/migrations/*_add_solar_systems_position_2d/migration.sql
```

Beklenen: boş çıktı.

- [ ] **Step 4: Uygula ve client'ı üret**

```bash
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 5: Satır sayılarını yeniden kontrol et**

Step 1'deki döngüyü tekrar çalıştır. Hiçbir sayı düşmemiş olmalı.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema/solarSystem.prisma backend/prisma/migrations/*_add_solar_systems_position_2d
git commit -m "feat(db): add the schematic 2D position to solar systems"
```

---

### Task 2: Geometri servisi, şema ve resolver

**Files:**

- Create: `backend/src/services/universe/map-cache-keys.ts`
- Modify: `backend/src/services/universe/universe-map.service.ts`
- Modify: `backend/src/services/universe/index.ts`
- Modify: `backend/src/schemas/UniverseMap.graphql`
- Modify: `backend/src/resolvers/universe-map/queries.ts:65-68`
- Test: `backend/src/services/universe/universe-map.service.spec.ts`

**Interfaces:**

- Consumes: Task 1'in kolonları.
- Produces:
  - `type MapProjection = 'SCHEMATIC' | 'GALACTIC'` (`universe-map.service.ts`)
  - `effectiveProjection(scope: MapScope, projection: MapProjection): MapProjection`
  - `positionColumns(projection: MapProjection): { x: Prisma.Sql; z: Prisma.Sql }` — her zaman `s.` takma adıyla
  - `geometryCacheKey(scope: MapScope, projection: MapProjection): string` (`map-cache-keys.ts`; Task 3 `labelsCacheKey`'i buraya taşır)
  - `getMapGeometry(scope: MapScope, projection: MapProjection): Promise<MapGeometry>`
  - GraphQL: `enum MapProjection`, `mapGeometry(scope, projection: MapProjection! = SCHEMATIC)`

- [ ] **Step 1: Failing testleri yaz**

`universe-map.service.spec.ts`'de mevcut her `getMapGeometry('X')` çağrısına ikinci argüman olarak `'GALACTIC'` ekle (mevcut testler bugünkü davranışı, yani galaktiği sabitliyor). Anahtar beklentilerini güncelle: `'map:geometry:POCHVEN'` → `'map:geometry:POCHVEN:GALACTIC'`, `'map:geometry:WORMHOLE'` → `'map:geometry:WORMHOLE:GALACTIC'`. Ardından `describe('getMapGeometry')` içine:

```ts
it('reads the schematic columns for SCHEMATIC, in both queries', async () => {
  await getMapGeometry('NEW_EDEN', 'SCHEMATIC');

  for (const call of [0, 1]) {
    const sql = querySql(call);
    expect(sql).toContain('s.position_2d_x');
    expect(sql).toContain('s.position_2d_y');
    expect(sql).not.toContain('s.position_x');
  }
});

it('reads the galactic columns for GALACTIC', async () => {
  await getMapGeometry('NEW_EDEN', 'GALACTIC');

  const sql = querySql(0);
  expect(sql).toContain('s.position_x');
  expect(sql).toContain('s.position_z');
  expect(sql).not.toContain('position_2d');
});

it('keys the cache on the projection as well as the scope', async () => {
  await getMapGeometry('NEW_EDEN', 'SCHEMATIC');
  expect(redis.get).toHaveBeenCalledWith('map:geometry:NEW_EDEN:SCHEMATIC');
});

it('answers WORMHOLE in GALACTIC whatever is asked, under the GALACTIC key', async () => {
  await getMapGeometry('WORMHOLE', 'SCHEMATIC');

  expect(redis.get).toHaveBeenCalledWith('map:geometry:WORMHOLE:GALACTIC');
  expect(querySql(0)).not.toContain('position_2d');
});

it('takes bounds from the projection it drew', async () => {
  prisma.$queryRaw
    .mockResolvedValueOnce([
      nodeRow({ system_id: 1, x: 6.9e16, z: -7.1e16 }),
      nodeRow({ system_id: 2, x: 7.0e16, z: -6.5e16 }),
    ])
    .mockResolvedValueOnce([]);

  const { bounds } = await getMapGeometry('NEW_EDEN', 'SCHEMATIC');
  expect(bounds).toEqual({
    minX: 6.9e16,
    maxX: 7.0e16,
    minZ: -7.1e16,
    maxZ: -6.5e16,
  });
});
```

- [ ] **Step 2: Testlerin kırıldığını gör**

Run: `yarn workspace backend vitest run src/services/universe/universe-map.service.spec.ts`
Expected: FAIL — yeni testler `position_2d` bulamıyor, anahtar beklentileri tutmuyor.

- [ ] **Step 3: `map-cache-keys.ts`'i yaz**

```ts
/**
 * The map's Redis keys, in a module with no Prisma import.
 *
 * The SDE import script deletes these by name after it writes, and it runs on
 * the worker client: importing them from the services would construct the
 * API's Prisma client in a worker process.
 */
import type { MapProjection, MapScope } from './universe-map.service';

export function geometryCacheKey(
  scope: MapScope,
  projection: MapProjection,
): string {
  return `map:geometry:${scope}:${projection}`;
}
```

`index.ts`'e `export * from './map-cache-keys';` ekle.

- [ ] **Step 4: Servisi değiştir**

`universe-map.service.ts`'de `MapScope` tipinin altına:

```ts
export type MapProjection = 'SCHEMATIC' | 'GALACTIC';

/**
 * WORMHOLE has no schematic layout: the SDE gives position2D to every k-space
 * and Pochven system and to no wormhole (build 3607705, measured 2026-10-14).
 * Asked for one, the scene answers in the only layout it has.
 */
export function effectiveProjection(
  scope: MapScope,
  projection: MapProjection,
): MapProjection {
  return scope === 'WORMHOLE' ? 'GALACTIC' : projection;
}

/**
 * The two columns a layout reads its x and z from, on the `s` alias every map
 * query gives solar_systems. position2D's y is the map's z: it correlates with
 * position.z at r=0.98, same sign, so nothing is negated here — cameraTransform
 * stays the one place that flips an axis.
 */
export function positionColumns(projection: MapProjection): {
  x: Prisma.Sql;
  z: Prisma.Sql;
} {
  return projection === 'SCHEMATIC'
    ? { x: Prisma.raw('s.position_2d_x'), z: Prisma.raw('s.position_2d_y') }
    : { x: Prisma.raw('s.position_x'), z: Prisma.raw('s.position_z') };
}
```

`getMapGeometry`'nin başı:

```ts
export async function getMapGeometry(
  scope: MapScope,
  projection: MapProjection,
): Promise<MapGeometry> {
  const resolved = effectiveProjection(scope, projection);
  const cacheKey = geometryCacheKey(scope, resolved);
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const predicate = scopePredicate(scope);
  const gateless = gatelessFilter(scope);
  const { x, z } = positionColumns(resolved);
```

Düğüm sorgusunun `scoped` CTE'sinde `s.position_x, s.position_z` → `${x} AS px, ${z} AS pz`; filtre satırları `AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL` → `AND ${x} IS NOT NULL AND ${z} IS NOT NULL`; son `SELECT`'te `scoped.position_x AS x, scoped.position_z AS z` → `scoped.px AS x, scoped.pz AS z`. Kenar sorgusunun `scoped` CTE'sindeki filtre de aynı biçimde `${x}`/`${z}`'ye geçer (yorumdaki "the same predicate" sözü böylece doğru kalır). Dosyanın başına `import { geometryCacheKey } from './map-cache-keys';` ekle.

Dosya başındaki modül yorumuna bir paragraf:

```ts
 * Two layouts per scope since the schematic map: SCHEMATIC is CCP's own 2D map
 * (solar_systems.position_2d_x/y, from the SDE), GALACTIC the real position seen
 * from above. Both are metres of the same magnitude, so nothing downstream of
 * x/z changes with the projection.
```

- [ ] **Step 5: Şema ve resolver**

`UniverseMap.graphql`'de `enum MapScope`'un altına:

```graphql
"""
Which layout a scene is drawn in. Both are flat: SCHEMATIC is CCP's own 2D map
from the SDE's position2D, GALACTIC the real position seen from above. WORMHOLE
has no schematic layout and is always GALACTIC, whatever is asked.
"""
enum MapProjection {
  SCHEMATIC
  GALACTIC
}
```

`mapGeometry(scope: MapScope! = NEW_EDEN): MapGeometry!` →

```graphql
  mapGeometry(
    scope: MapScope! = NEW_EDEN
    projection: MapProjection! = SCHEMATIC
  ): MapGeometry!
```

`queries.ts`:

```ts
  mapGeometry: async (_, { scope, projection }) => {
    const geometry = await getMapGeometry(scope, projection);
    return { ...geometry, scope };
  },
```

- [ ] **Step 6: Codegen, testler, tip kontrolü**

```bash
yarn workspace backend codegen
yarn workspace backend vitest run src/services/universe/universe-map.service.spec.ts
yarn workspace backend build
```

Expected: codegen `MapProjection`'ı üretir; testler PASS; `build` temiz (resolver `mapLabels`'a henüz `projection` geçirmiyor, şemada da henüz yok).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/universe backend/src/schemas/UniverseMap.graphql backend/src/resolvers/universe-map/queries.ts backend/src/generated-types.ts backend/src/generated-schema.graphql backend/src/generated-schema.ts
git commit -m "feat(map): serve the scene geometry in the schematic or the galactic layout"
```

---

### Task 3: Etiket servisi

**Files:**

- Modify: `backend/src/services/universe/map-labels.service.ts`
- Modify: `backend/src/schemas/UniverseMap.graphql`
- Modify: `backend/src/resolvers/universe-map/queries.ts:75-78`
- Test: `backend/src/services/universe/map-labels.service.spec.ts`

**Interfaces:**

- Consumes: `effectiveProjection`, `positionColumns`, `MapProjection` (Task 2); `labelsCacheKey(scope, kind, projection)` (`map-cache-keys.ts`, Task 2).
- Produces: `getMapLabels(scope: MapScope, kind: MapLabelKind, projection: MapProjection): Promise<MapLabel[]>`; GraphQL `mapLabels(scope, kind, projection: MapProjection! = SCHEMATIC)`.

- [ ] **Step 1: Failing testleri yaz**

Spec'te `labelsCacheKey`'i `./map-cache-keys`'ten import et. Mevcut her `getMapLabels(a, b)` çağrısına üçüncü argüman `'GALACTIC'` ekle; `labelsCacheKey(a, b)` çağrılarına da `'GALACTIC'` ve beklenen anahtarları `'map:labels:v3:NEW_EDEN:REGION:GALACTIC'` biçimine çevir (satır 42-52 ve 91). Sonra:

```ts
it('keys the labels on the projection', () => {
  expect(labelsCacheKey('NEW_EDEN', 'REGION', 'SCHEMATIC')).toBe(
    'map:labels:v3:NEW_EDEN:REGION:SCHEMATIC',
  );
  expect(labelsCacheKey('NEW_EDEN', 'REGION', 'SCHEMATIC')).not.toBe(
    labelsCacheKey('NEW_EDEN', 'REGION', 'GALACTIC'),
  );
});

it('anchors SCHEMATIC regions on the schematic columns', async () => {
  await getMapLabels('NEW_EDEN', 'REGION', 'SCHEMATIC');
  const sql = querySql(0);
  expect(sql).toContain('s.position_2d_x');
  expect(sql).toContain('s.position_2d_y');
  expect(sql).not.toContain('s.position_x');
});

it('puts a SCHEMATIC constellation at the mean of its systems', async () => {
  await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'SCHEMATIC');
  const sql = querySql(0);
  expect(sql).toContain('AVG(s.position_2d_x)');
  expect(sql).toContain('AVG(s.position_2d_y)');
  expect(sql).not.toContain('c.position_x');
});

it('keeps the constellation own position for GALACTIC', async () => {
  await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'GALACTIC');
  expect(querySql(0)).toContain('c.position_x AS x');
});

it('answers WORMHOLE labels in GALACTIC', async () => {
  await getMapLabels('WORMHOLE', 'REGION', 'SCHEMATIC');
  expect(redis.get).toHaveBeenCalledWith(
    'map:labels:v3:WORMHOLE:REGION:GALACTIC',
  );
});
```

Spec dosyasında `querySql` yardımcısı yoksa `universe-map.service.spec.ts`'dekini (satır 39-52) aynen kopyala; mock'lanan `$queryRaw` burada tek bir `Prisma.Sql` argümanıyla çağrılıyor, bu yüzden kopyalanan sürümde `strings`/`values`'ı `call[0].strings` ve `call[0].values`'tan oku:

```ts
function querySql(call: number) {
  const sql = prisma.$queryRaw.mock.calls[call][0] as {
    strings: string[];
    values: { strings?: string[] }[];
  };
  return sql.strings
    .map((part, i) => part + (sql.values[i]?.strings?.join('') ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
```

(Spec'te zaten bir SQL okuma yardımcısı varsa onu kullan, ikincisini ekleme.)

- [ ] **Step 2: Kırıldığını gör**

Run: `yarn workspace backend vitest run src/services/universe/map-labels.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Servisi değiştir**

`labelsCacheKey`'i ve `v2` yorumunu `map-labels.service.ts`'den sil, `map-cache-keys.ts`'e şu hâliyle ekle:

```ts
import type { MapLabelKind } from './map-labels.service';

/**
 * `v3` because the key grew a projection. Without the bump a deploy would keep
 * serving yesterday's `v2` rows, which are galactic, under a schematic request
 * for up to a day.
 */
export function labelsCacheKey(
  scope: MapScope,
  kind: MapLabelKind,
  projection: MapProjection,
): string {
  return `map:labels:v3:${scope}:${kind}:${projection}`;
}
```

(`import type` iki modül arasında döngü kurmaz: derlemede silinir.) `map-labels.service.ts`'e import'ları ekle:

```ts
import { labelsCacheKey } from './map-cache-keys';
import {
  effectiveProjection,
  gatelessFilter,
  positionColumns,
  scopePredicate,
  type MapProjection,
  type MapScope,
} from './universe-map.service';
```

`labelQuery(scope, kind)` → `labelQuery(scope, kind, projection: MapProjection)`; başına `const { x, z } = positionColumns(projection);`. Takımyıldız dalı:

```ts
if (kind === 'CONSTELLATION') {
  if (projection === 'SCHEMATIC') {
    // The SDE gives a constellation no position2D. Its schematic name sits at
    // the mean of its drawn systems — the galactic branch below is the same
    // idea, since a constellation's own position is within 0.23 ly of that.
    return Prisma.sql`
        SELECT c.constellation_id AS id, c.name AS name,
               AVG(${x}) AS x, AVG(${z}) AS z
        FROM constellations c
        JOIN solar_systems s ON s.constellation_id = c.constellation_id
        WHERE ${scene}
          AND ${x} IS NOT NULL AND ${z} IS NOT NULL
          ${gateless}
        GROUP BY c.constellation_id, c.name
        ORDER BY id
      `;
  }
  // ...mevcut galaktik sorgu aynen kalır
}
```

Bölge sorgusunun `scene` CTE'sinde `s.position_x AS x, s.position_z AS z` → `${x} AS x, ${z} AS z`, filtre `AND ${x} IS NOT NULL AND ${z} IS NOT NULL`. Medoid ve extent sorgunun kalanı değişmez; artık seçilen yerleşimde hesaplanırlar.

`getMapLabels`:

```ts
export async function getMapLabels(
  scope: MapScope,
  kind: MapLabelKind,
  projection: MapProjection,
): Promise<MapLabel[]> {
  const resolved = effectiveProjection(scope, projection);
  const key = labelsCacheKey(scope, kind, resolved);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapLabel[];

  const rows = await prisma.$queryRaw<LabelRow[]>(
    labelQuery(scope, kind, resolved),
  );
```

- [ ] **Step 4: Şema ve resolver**

```graphql
  mapLabels(
    scope: MapScope! = NEW_EDEN
    kind: MapLabelKind!
    projection: MapProjection! = SCHEMATIC
  ): [MapLabel!]!
```

```ts
  mapLabels: async (_, { scope, kind, projection }) => {
    const labels = await getMapLabels(scope, kind, projection);
    return labels.map((l) => ({ ...l, kind: LABEL_KIND[l.kind] }));
  },
```

- [ ] **Step 5: Codegen, test, build**

```bash
yarn workspace backend codegen
yarn workspace backend vitest run src/services/universe
yarn workspace backend build
```

Expected: hepsi PASS, `build` temiz.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/universe backend/src/schemas/UniverseMap.graphql backend/src/resolvers/universe-map/queries.ts backend/src/generated-types.ts backend/src/generated-schema.graphql backend/src/generated-schema.ts
git commit -m "feat(map): place region and constellation names in either layout"
```

---

### Task 4: SDE import

**Files:**

- Create: `backend/src/helpers/sde-map-2d.ts`
- Create: `backend/src/helpers/sde-map-2d.spec.ts`
- Create: `backend/src/scripts/import-sde-map-2d.ts`
- Modify: `backend/package.json` (`sde:meta-groups`'un altına)

**Interfaces:**

- Consumes: `geometryCacheKey`, `labelsCacheKey` (`@services/universe/map-cache-keys`), tipler `MapScope`, `MapProjection`, `MapLabelKind` (yalnızca `import type`).
- Produces: `parseMap2dLine(line: string): [number, number, number] | null`; `yarn sde:map-2d`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { parseMap2dLine } from './sde-map-2d';

describe('parseMap2dLine', () => {
  it('reads the id and the schematic position', () => {
    const line =
      '{"_key": 30000001, "position": {"x": -8.8e16, "y": 4.2e16, "z": -4.4e16}, "position2D": {"x": 6.985182150795389e+16, "y": -7.190628684642312e+16}}';
    expect(parseMap2dLine(line)).toEqual([
      30000001, 6.985182150795389e16, -7.190628684642312e16,
    ]);
  });

  it('skips a system with no schematic position, as every wormhole is', () => {
    const line = '{"_key": 31000005, "position": {"x": 1, "y": 2, "z": 3}}';
    expect(parseMap2dLine(line)).toBeNull();
  });

  it('skips a blank line, malformed JSON and a bare null', () => {
    expect(parseMap2dLine('')).toBeNull();
    expect(parseMap2dLine('   ')).toBeNull();
    expect(parseMap2dLine('{"_key": 1, "position2D"')).toBeNull();
    expect(parseMap2dLine('null')).toBeNull();
  });

  it('skips a non-numeric coordinate rather than writing NaN', () => {
    const line =
      '{"_key": 30000001, "position2D": {"x": "6.9e16", "y": -7.1e16}}';
    expect(parseMap2dLine(line)).toBeNull();
  });

  it('skips a non-integer id', () => {
    const line = '{"_key": "30000001", "position2D": {"x": 1, "y": 2}}';
    expect(parseMap2dLine(line)).toBeNull();
  });
});
```

- [ ] **Step 2: Kırıldığını gör**

Run: `yarn workspace backend vitest run src/helpers/sde-map-2d.spec.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Ayrıştırıcıyı yaz**

```ts
/**
 * One line of the SDE's mapSolarSystems.jsonl as [systemId, x, y], or null for
 * a system with no schematic position — every wormhole, Abyssal and Proving
 * system — and for a blank or malformed line, which is skipped rather than
 * allowed to abort an import of 8,490 lines.
 */
export function parseMap2dLine(line: string): [number, number, number] | null {
  if (!line.trim()) return null;

  let record: unknown;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof record !== 'object' || record === null) return null;

  const { _key: id, position2D } = record as {
    _key?: unknown;
    position2D?: { x?: unknown; y?: unknown };
  };
  const x = position2D?.x;
  const y = position2D?.y;
  if (!Number.isInteger(id)) return null;
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  return [id as number, x, y];
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `yarn workspace backend vitest run src/helpers/sde-map-2d.spec.ts`
Expected: PASS.

- [ ] **Step 5: Betiği ve package.json satırını yaz**

`backend/src/scripts/import-sde-map-2d.ts`:

```ts
/**
 * Fill solar_systems.position_2d_x/y from CCP's Static Data Export.
 *
 * The schematic 2D map — the layout of the in-game 2D map, which /map opens on
 * — is in the SDE's mapSolarSystems.jsonl as position2D and nowhere in ESI.
 *
 * Reads mapSolarSystems.jsonl on stdin; `yarn sde:map-2d` downloads the archive
 * and pipes the file in. Only systems already in the table are updated, and
 * only where the value changes. Static data: run by hand, again whenever a new
 * SDE build adds systems, never on a schedule.
 *
 * Run it before deploying code that reads these columns: until it has run the
 * schematic scene is empty, and /map opens on it. A re-run with a new build
 * reaches the API only once the response cache drops MapGeometry and
 * MapLabels, which it keeps as STATIC_GAME_DATA.
 */

import { createInterface } from 'node:readline';

import { parseMap2dLine } from '@helpers/sde-map-2d';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import redis from '@services/redis';
import {
  geometryCacheKey,
  labelsCacheKey,
} from '@services/universe/map-cache-keys';
import type { MapLabelKind } from '@services/universe/map-labels.service';
import type {
  MapProjection,
  MapScope,
} from '@services/universe/universe-map.service';

const CHUNK = 1_000;

const SCOPES: MapScope[] = ['NEW_EDEN', 'POCHVEN', 'WORMHOLE'];
const PROJECTIONS: MapProjection[] = ['SCHEMATIC', 'GALACTIC'];
const LABEL_KINDS: MapLabelKind[] = ['REGION', 'CONSTELLATION'];

async function importMap2d() {
  const rows: [number, number, number][] = [];
  let lines = 0;

  for await (const line of createInterface({ input: process.stdin })) {
    lines++;
    const row = parseMap2dLine(line);
    if (row) rows.push(row);
  }

  if (lines === 0) {
    throw new Error('no input on stdin: pipe the SDE mapSolarSystems.jsonl in');
  }
  logger.info(
    `read ${lines.toLocaleString()} systems, ${rows.length.toLocaleString()} with a schematic position`,
  );

  let updated = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const ids = chunk.map(([id]) => id);
    const xs = chunk.map(([, x]) => x);
    const ys = chunk.map(([, , y]) => y);

    // Existing rows only, and only where the value changes, so a re-run after
    // a new SDE build writes just the new and the moved systems.
    const result = await prismaWorker.$queryRaw<{ system_id: number }[]>`
      UPDATE solar_systems s
      SET position_2d_x = v.x, position_2d_y = v.y
      FROM unnest(${ids}::int[], ${xs}::float8[], ${ys}::float8[]) AS v(id, x, y)
      WHERE s.system_id = v.id
        AND (s.position_2d_x IS DISTINCT FROM v.x
             OR s.position_2d_y IS DISTINCT FROM v.y)
      RETURNING s.system_id
    `;
    updated += result.length;
  }

  // Every key the map services can have written, by name: no pattern scan over
  // a database another checkout may share.
  const keys = SCOPES.flatMap((scope) =>
    PROJECTIONS.flatMap((projection) => [
      geometryCacheKey(scope, projection),
      ...LABEL_KINDS.map((kind) => labelsCacheKey(scope, kind, projection)),
    ]),
  );
  await redis.del(...keys);

  logger.info(
    `updated the schematic position of ${updated.toLocaleString()} systems`,
  );
}

importMap2d()
  .then(async () => {
    await prismaWorker.$disconnect();
    redis.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('sde map 2d import failed:', error);
    await prismaWorker.$disconnect();
    redis.disconnect();
    process.exit(1);
  });
```

`backend/package.json`, `sde:meta-groups` satırının altına:

```json
    "sde:map-2d": "curl -fsSL https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip -o /tmp/killreport-sde.zip && unzip -p /tmp/killreport-sde.zip mapSolarSystems.jsonl | tsx src/scripts/import-sde-map-2d.ts",
```

`@services/universe/map-cache-keys` yolunun çözüldüğünü `build` doğrular; `@services/*` alias'ı `tsconfig`'te tanımlı değilse `meta-groups` betiğinin kullandığı biçime uy.

- [ ] **Step 6: Build**

Run: `yarn workspace backend build`
Expected: temiz.

- [ ] **Step 7: Yerelde çalıştır ve doğrula**

```bash
yarn workspace backend sde:map-2d
```

Expected log: `read 8,490 systems, 5,485 with a schematic position`, ardından `updated the schematic position of N systems` (N = yerel veritabanındaki K-space + Pochven sistem sayısı).

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT COUNT(*) FILTER (WHERE position_2d_x IS NOT NULL) AS with_2d, COUNT(*) AS total FROM solar_systems;"
psql "$DB" -c "SELECT system_id, position_2d_x, position_2d_y FROM solar_systems WHERE system_id = 30000001;"
```

Expected: Tanoo için `69851821507953890`, `-71906286846423120` civarı (float8 yazımı farklı olabilir).

İkinci kez çalıştır: `updated the schematic position of 0 systems` (Review Focus, satır 5).

- [ ] **Step 8: Commit**

```bash
git add backend/src/helpers/sde-map-2d.ts backend/src/helpers/sde-map-2d.spec.ts backend/src/scripts/import-sde-map-2d.ts backend/package.json
git commit -m "feat(map): import each system's schematic position from the SDE"
```

---

### Task 5: Frontend dokümanları ve URL yardımcıları

**Files:**

- Modify: `frontend/src/graphql/MapGeometry.graphql`, `frontend/src/graphql/MapLabels.graphql`
- Modify: `frontend/src/utils/map/camera.ts`
- Test: `frontend/src/utils/map/camera.spec.ts`

**Interfaces:**

- Consumes: backend'in `generated-schema.graphql`'i (Task 2-3).
- Produces:
  - `DEFAULT_PROJECTION: MapProjection` (`MapProjection.Schematic`)
  - `projectionsFor(scope: MapScope): readonly MapProjection[]`
  - `parseProjection(params: URLSearchParams, scope: MapScope): MapProjection`
  - `cameraQuery(scope, camera, focus, layer, owner, projection: MapProjection): string`
  - `sharedMapUrl({ origin, scope, focus, layer, owner, projection })`

- [ ] **Step 1: Dokümanlar ve codegen**

`MapGeometry.graphql`:

```graphql
query MapGeometry($scope: MapScope!, $projection: MapProjection!) {
  mapGeometry(scope: $scope, projection: $projection) {
```

(gövde aynı). `MapLabels.graphql`:

```graphql
query MapLabels(
  $scope: MapScope!
  $kind: MapLabelKind!
  $projection: MapProjection!
) {
  mapLabels(scope: $scope, kind: $kind, projection: $projection) {
```

Operasyon adları değişmez (response cache onlara bakıyor).

Run: `yarn workspace frontend codegen`
Expected: `MapProjection` enum'u `frontend/src/generated/graphql.ts`'te.

- [ ] **Step 2: Failing testler**

`camera.spec.ts`'de import'a `MapProjection`, `parseProjection`, `projectionsFor` ekle. Mevcut her `cameraQuery(...)` çağrısına altıncı argüman `MapProjection.Schematic`, her `sharedMapUrl({...})` çağrısına `projection: MapProjection.Schematic` ekle. Sonra:

```ts
describe('parseProjection', () => {
  it('opens on the schematic layout when the URL says nothing', () => {
    expect(parseProjection(new URLSearchParams(''), MapScope.NewEden)).toBe(
      MapProjection.Schematic,
    );
  });

  it('reads view=galactic', () => {
    expect(
      parseProjection(new URLSearchParams('view=galactic'), MapScope.NewEden),
    ).toBe(MapProjection.Galactic);
  });

  it('treats anything else as the default', () => {
    expect(
      parseProjection(new URLSearchParams('view=3d'), MapScope.Pochven),
    ).toBe(MapProjection.Schematic);
  });

  it('is always galactic in wormhole space, which has no schematic layout', () => {
    expect(parseProjection(new URLSearchParams(''), MapScope.Wormhole)).toBe(
      MapProjection.Galactic,
    );
  });
});

describe('projectionsFor', () => {
  it('offers both layouts in k-space and Pochven, one in wormhole space', () => {
    expect(projectionsFor(MapScope.NewEden)).toHaveLength(2);
    expect(projectionsFor(MapScope.Pochven)).toHaveLength(2);
    expect(projectionsFor(MapScope.Wormhole)).toEqual([MapProjection.Galactic]);
  });
});

describe('cameraQuery and the projection', () => {
  const camera = { x: 0, z: 0, zoom: -50 };

  it('leaves the default out of the URL', () => {
    const params = new URLSearchParams(
      cameraQuery(
        MapScope.NewEden,
        camera,
        null,
        'security',
        null,
        MapProjection.Schematic,
      ),
    );
    expect(params.has('view')).toBe(false);
  });

  it('writes view=galactic', () => {
    const params = new URLSearchParams(
      cameraQuery(
        MapScope.NewEden,
        camera,
        null,
        'security',
        null,
        MapProjection.Galactic,
      ),
    );
    expect(params.get('view')).toBe('galactic');
  });

  it('never writes it in wormhole space', () => {
    const params = new URLSearchParams(
      cameraQuery(
        MapScope.Wormhole,
        camera,
        null,
        'security',
        null,
        MapProjection.Galactic,
      ),
    );
    expect(params.has('view')).toBe(false);
  });

  it('parses back to what it wrote', () => {
    const query = cameraQuery(
      MapScope.NewEden,
      camera,
      30000142,
      'security',
      null,
      MapProjection.Galactic,
    );
    expect(parseProjection(new URLSearchParams(query), MapScope.NewEden)).toBe(
      MapProjection.Galactic,
    );
  });
});

describe('sharedMapUrl and the projection', () => {
  it('carries view=galactic so the receiver opens the same layout', () => {
    const url = sharedMapUrl({
      origin: 'https://killreport.com',
      scope: MapScope.NewEden,
      focus: 30000142,
      layer: 'security',
      owner: null,
      projection: MapProjection.Galactic,
    });
    expect(new URL(url).searchParams.get('view')).toBe('galactic');
  });

  it('stays short on the default layout', () => {
    const url = sharedMapUrl({
      origin: 'https://killreport.com',
      scope: MapScope.NewEden,
      focus: 30000142,
      layer: 'security',
      owner: null,
      projection: MapProjection.Schematic,
    });
    expect(url).toBe('https://killreport.com/map?focus=30000142');
  });
});
```

- [ ] **Step 3: Kırıldığını gör**

Run: `yarn workspace frontend vitest run src/utils/map/camera.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Uygula**

`camera.ts`'de import: `import { MapProjection, MapScope, type MapBounds } from '@/generated/graphql';`. `DEFAULT_SCOPE`'un altına:

```ts
export const DEFAULT_PROJECTION: MapProjection = MapProjection.Schematic;

/**
 * The layouts a scene can be drawn in. Wormhole space has no schematic one —
 * the SDE gives no wormhole a position2D — and the backend answers it in
 * GALACTIC whatever is asked, so the switch is not offered there.
 */
export function projectionsFor(scope: MapScope): readonly MapProjection[] {
  return scope === MapScope.Wormhole
    ? [MapProjection.Galactic]
    : [MapProjection.Schematic, MapProjection.Galactic];
}

/**
 * The layout the URL asks for. Anything but `view=galactic` — its absence
 * included — is the default.
 *
 * A URL written before the schematic layout existed carries galactic x/z with
 * no `view`, so it now opens somewhere else in the schematic map. Accepted:
 * shared links carry no camera (`sharedMapUrl`), and a `?focus=` frames its
 * system in either layout.
 */
export function parseProjection(
  params: URLSearchParams,
  scope: MapScope,
): MapProjection {
  if (scope === MapScope.Wormhole) return MapProjection.Galactic;
  return params.get('view') === 'galactic'
    ? MapProjection.Galactic
    : DEFAULT_PROJECTION;
}

function writesView(scope: MapScope, projection: MapProjection): boolean {
  return scope !== MapScope.Wormhole && projection === MapProjection.Galactic;
}
```

`cameraQuery`'nin imzasına `projection: MapProjection` (altıncı parametre) ekle, doc yorumundaki "`focus`, `layer` and `owner` are required" cümlesine `projection`'ı da kat, ve `params.set('scope', scope);`'un hemen altına:

```ts
if (writesView(scope, projection)) params.set('view', 'galactic');
```

`sharedMapUrl`'in parametre tipine `projection: MapProjection;` ekle; `if (scope !== DEFAULT_SCOPE) params.set('scope', scope);`'un altına aynı satır.

- [ ] **Step 5: Test**

Run: `yarn workspace frontend vitest run src/utils/map/camera.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

`useMapCamera.ts` ve `UniverseMap.tsx` bu noktada derlenmez (yeni zorunlu parametre); bunlar Task 6 ve 10'da kapanır. Commit yine de yalnızca bu görevin dosyalarını içerir:

```bash
git add frontend/src/graphql/MapGeometry.graphql frontend/src/graphql/MapLabels.graphql frontend/src/generated/graphql.ts frontend/src/utils/map/camera.ts frontend/src/utils/map/camera.spec.ts
git commit -m "feat(map): carry the layout in the map URL"
```

---

### Task 6: `useMapCamera` projeksiyonu sahiplenir

**Files:**

- Modify: `frontend/src/components/UniverseMap/useMapCamera.ts`
- Test: `frontend/src/components/UniverseMap/useMapCamera.spec.ts`

**Interfaces:**

- Consumes: `parseProjection`, `cameraQuery` (Task 5).
- Produces: hook dönüşüne `projection: MapProjection` ve `onProjectionChange(next: MapProjection, camera: MapCamera): void`.

- [ ] **Step 1: Failing testler**

`useMapCamera.spec.ts`'in mevcut kurulumunu (router mock'u, `renderHook`) kullanarak:

```ts
it('reads the layout from the URL', () => {
  searchParams = new URLSearchParams('view=galactic');
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FALLBACK));
  expect(result.current.projection).toBe(MapProjection.Galactic);
});

it('writes the layout and the camera in one immediate write', () => {
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FALLBACK));
  act(() =>
    result.current.onProjectionChange(MapProjection.Galactic, {
      x: 1e17,
      z: 2e17,
      zoom: -50,
    }),
  );

  expect(result.current.projection).toBe(MapProjection.Galactic);
  expect(result.current.camera).toEqual({ x: 1e17, z: 2e17, zoom: -50 });
  const written = new URLSearchParams(
    routerReplace.mock.calls.at(-1)![0].slice(1),
  );
  expect(written.get('view')).toBe('galactic');
  expect(written.get('x')).toBe('100000000000000000');
});

it('keeps the layout on a later layer change', () => {
  const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FALLBACK));
  act(() =>
    result.current.onProjectionChange(MapProjection.Galactic, FALLBACK),
  );
  act(() => result.current.onLayerChange('sovereignty'));
  const written = new URLSearchParams(
    routerReplace.mock.calls.at(-1)![0].slice(1),
  );
  expect(written.get('view')).toBe('galactic');
});
```

(`searchParams`, `routerReplace` ve `FALLBACK` spec'teki mevcut adlarla değiştirilir; yoksa dosyanın başındaki mock kurulumunda tanımlananlar kullanılır.)

- [ ] **Step 2: Kırıldığını gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useMapCamera.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Uygula**

- `WrittenUrl`'e `projection: MapProjection;` ekle; yorumdaki "The layer and the owner are here" cümlesine projeksiyonu kat.
- `queryOf`: `cameraQuery(scope, url.camera, url.focus, url.layer, url.owner, url.projection)`.
- State:

```ts
const [projection, setProjection] = useState<MapProjection>(() =>
  parseProjection(searchParams, scope),
);
```

- URL effect'i: `const nextProjection = parseProjection(searchParams, scope);`, `cameraQuery(...)` karşılaştırmasına altıncı argüman olarak geçir, `setOwner(nextOwner);`'un altına `setProjection(nextProjection);`. Effect yorumundaki "The focus, the layer and the owner are primitives" cümlesine projeksiyonu ekle.
- Mevcut her `write({...})` çağrısına `projection` ekle ve ilgili `useCallback` bağımlılık dizilerine `projection` koy (`onCameraChange`, `onFocusChange`, `onLayerChange`, `onOwnerChange`, `jumpTo`).
- Yeni callback:

```ts
// The layout and the camera as ONE write, for the same reason jumpTo is one:
// the morph ends on a camera framed for the new layout, and a camera written
// without the layout — or the other way round — would put galactic x/z on a
// schematic map for the length of a debounce.
const onProjectionChange = useCallback(
  (next: MapProjection, nextCamera: MapCamera) => {
    setProjection(next);
    setCamera(nextCamera);
    write({ camera: nextCamera, focus, layer, owner, projection: next }, true);
  },
  [write, focus, layer, owner],
);
```

- Dönüşe `projection,` ve `onProjectionChange,` ekle.

- [ ] **Step 4: Test**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useMapCamera.spec.ts`
Expected: PASS (eski testler dahil).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UniverseMap/useMapCamera.ts frontend/src/components/UniverseMap/useMapCamera.spec.ts
git commit -m "feat(map): let the camera hook own the layout in the URL"
```

---

### Task 7: `MapSwitch`

`MapLayerSwitch.tsx` jenerik `MapSwitch.tsx` olur (`git mv`); tek kullanıcısı `UniverseMap.tsx`.

**Files:**

- Rename/Modify: `frontend/src/components/UniverseMap/MapLayerSwitch.tsx` → `MapSwitch.tsx`
- Create: `frontend/src/components/UniverseMap/MapSwitch.spec.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx` (import ve katman kullanımı)

**Interfaces:**

- Produces:

```ts
export interface MapSwitchOption<T extends string> {
  id: T;
  label: string;
}
export default function MapSwitch<T extends string>(props: {
  label: string;
  options: readonly MapSwitchOption<T>[];
  value: T;
  onChange: (id: T) => void;
}): JSX.Element;
```

- [ ] **Step 1: Failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MapSwitch from './MapSwitch';

const OPTIONS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
] as const;

describe('MapSwitch', () => {
  it('names the group and presses the selected segment only', () => {
    render(
      <MapSwitch
        label="Layout"
        options={OPTIONS}
        value="b"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('group', { name: 'Layout' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Alpha' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('reports the segment clicked', () => {
    const onChange = vi.fn();
    render(
      <MapSwitch
        label="Layout"
        options={OPTIONS}
        value="b"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Kırıldığını gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/MapSwitch.spec.tsx`
Expected: FAIL — modül yok.

- [ ] **Step 3: Uygula**

```bash
git mv frontend/src/components/UniverseMap/MapLayerSwitch.tsx frontend/src/components/UniverseMap/MapSwitch.tsx
```

```tsx
'use client';

export interface MapSwitchOption<T extends string> {
  id: T;
  label: string;
}

/**
 * A row of buttons, one per choice — the layer and the layout today. A select
 * would hide the choice behind a click, and the point of both is that
 * switching is cheap.
 *
 * The app's own button vocabulary rather than classes invented here:
 * `button-ghost` with `aria-pressed` is exactly the case buttons.css calls
 * "one segment of a group where something is always selected", so the
 * selected segment takes the subtle fill and not the accent one reserved for
 * an engaged toggle. The pressed state comes from ARIA, so what a screen
 * reader announces and what the panel looks like cannot drift apart. The
 * group is named because there are two of them, and a screen reader would
 * otherwise read both as the same row of buttons.
 */
export default function MapSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly MapSwitchOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="float flex gap-x-1 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={option.id === value}
          className="button button-ghost button-sm"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

`UniverseMap.tsx`'de `import MapLayerSwitch from './MapLayerSwitch';` → `import MapSwitch from './MapSwitch';`; modül seviyesinde:

```ts
const LAYER_OPTIONS = (Object.keys(MAP_LAYERS) as MapLayerId[]).map((id) => ({
  id,
  label: MAP_LAYERS[id].label,
}));
```

(`MapLayerId`'yi `@/utils/map/layers`'tan import et) ve satır 966:

```tsx
<MapSwitch
  label="Colouring"
  options={LAYER_OPTIONS}
  value={layerId}
  onChange={setLayerId}
/>
```

- [ ] **Step 4: Test**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/MapSwitch.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UniverseMap/MapSwitch.tsx frontend/src/components/UniverseMap/MapSwitch.spec.tsx frontend/src/components/UniverseMap/UniverseMap.tsx
git commit -m "refactor(map): turn the layer switch into a switch for any choice"
```

---

### Task 8: Morph matematiği

**Files:**

- Create: `frontend/src/utils/map/morph.ts`
- Create: `frontend/src/utils/map/morph.spec.ts`

**Interfaces:**

- Consumes: `MapCamera` (`./camera`), `nearestNode` (`./origin`).
- Produces:

```ts
export const MORPH_DURATION_MS = 600;
export interface MorphPoint {
  x: number;
  z: number;
}
export interface MorphNode extends MorphPoint {
  systemId: number;
}
export function easeInOut(t: number): number;
export function lerpPoint(a: MorphPoint, b: MorphPoint, t: number): MorphPoint;
export function lerpCamera(a: MapCamera, b: MapCamera, t: number): MapCamera;
export function pairNodes(
  from: readonly MorphNode[],
  to: readonly MorphNode[],
): (MorphPoint | null)[];
export function morphAnchor(args: {
  focus: number | null;
  camera: MapCamera;
  from: readonly MorphNode[];
  to: readonly MorphNode[];
}): { from: MorphPoint; to: MorphPoint } | null;
export function morphTarget(args: {
  camera: MapCamera;
  atFit: boolean;
  toFit: MapCamera;
  anchor: { from: MorphPoint; to: MorphPoint } | null;
}): MapCamera;
```

- [ ] **Step 1: Failing testler**

```ts
import { describe, expect, it } from 'vitest';
import {
  easeInOut,
  lerpCamera,
  lerpPoint,
  morphAnchor,
  morphTarget,
  pairNodes,
} from './morph';

describe('easeInOut', () => {
  it('starts at 0, ends at 1 and passes the middle at 0.5', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });

  it('clamps outside the run, so a late frame lands exactly on the end', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(1.7)).toBe(1);
  });
});

describe('lerpPoint and lerpCamera', () => {
  it('returns the ends at 0 and 1', () => {
    const a = { x: 1e17, z: -2e17 };
    const b = { x: 3e17, z: 4e17 };
    expect(lerpPoint(a, b, 0)).toEqual(a);
    expect(lerpPoint(a, b, 1)).toEqual(b);
    expect(lerpPoint(a, b, 0.5)).toEqual({ x: 2e17, z: 1e17 });
  });

  it('moves the zoom with the position', () => {
    expect(
      lerpCamera({ x: 0, z: 0, zoom: -50 }, { x: 10, z: 20, zoom: -48 }, 0.5),
    ).toEqual({ x: 5, z: 10, zoom: -49 });
  });
});

describe('pairNodes', () => {
  it('pairs by system id, in the order of the layout being left', () => {
    const from = [
      { systemId: 2, x: 0, z: 0 },
      { systemId: 1, x: 5, z: 5 },
    ];
    const to = [
      { systemId: 1, x: 10, z: 10 },
      { systemId: 2, x: 20, z: 20 },
    ];
    expect(pairNodes(from, to)).toEqual([
      { x: 20, z: 20 },
      { x: 10, z: 10 },
    ]);
  });

  it('leaves a system the new layout lacks unpaired', () => {
    expect(
      pairNodes([{ systemId: 9, x: 0, z: 0 }], [{ systemId: 1, x: 1, z: 1 }]),
    ).toEqual([null]);
  });
});

describe('morphAnchor', () => {
  const from = [
    { systemId: 1, x: 0, z: 0 },
    { systemId: 2, x: 100, z: 100 },
  ];
  const to = [
    { systemId: 1, x: 1000, z: 1000 },
    { systemId: 2, x: 5000, z: 5000 },
  ];

  it('anchors on the selected system when both layouts hold it', () => {
    expect(
      morphAnchor({ focus: 2, camera: { x: 0, z: 0, zoom: -45 }, from, to }),
    ).toEqual({ from: { x: 100, z: 100 }, to: { x: 5000, z: 5000 } });
  });

  it('falls back to the system nearest the centre of the screen', () => {
    expect(
      morphAnchor({
        focus: null,
        camera: { x: 10, z: 10, zoom: -45 },
        from,
        to,
      }),
    ).toEqual({ from: { x: 0, z: 0 }, to: { x: 1000, z: 1000 } });
  });

  it('is null when the nearest system has nowhere to go', () => {
    expect(
      morphAnchor({
        focus: null,
        camera: { x: 0, z: 0, zoom: -45 },
        from,
        to: [{ systemId: 2, x: 1, z: 1 }],
      }),
    ).toBeNull();
  });
});

describe('morphTarget', () => {
  const toFit = { x: 7, z: 8, zoom: -50.2 };
  const anchor = { from: { x: 100, z: 100 }, to: { x: 400, z: 700 } };

  it('goes from one fit to the other when the camera sat at the fit', () => {
    expect(
      morphTarget({
        camera: { x: 0, z: 0, zoom: -50 },
        atFit: true,
        toFit,
        anchor,
      }),
    ).toBe(toFit);
  });

  it('keeps the anchor where it was on screen, and the zoom, otherwise', () => {
    expect(
      morphTarget({
        camera: { x: 110, z: 90, zoom: -45 },
        atFit: false,
        toFit,
        anchor,
      }),
    ).toEqual({ x: 410, z: 690, zoom: -45 });
  });

  it('fits when there is no anchor to keep', () => {
    expect(
      morphTarget({
        camera: { x: 1, z: 1, zoom: -45 },
        atFit: false,
        toFit,
        anchor: null,
      }),
    ).toBe(toFit);
  });
});
```

- [ ] **Step 2: Kırıldığını gör**

Run: `yarn workspace frontend vitest run src/utils/map/morph.spec.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Uygula**

```ts
import type { MapCamera } from './camera';
import { nearestNode } from './origin';

/**
 * The switch between the schematic and the galactic layout, as numbers.
 *
 * Only the system dots move: the gate mesh is built once, 14,400 segments, and
 * rebuilding it every frame would stutter. Everything else is hidden for the
 * run and built again in the new layout once it ends (useProjectionMorph).
 */
export const MORPH_DURATION_MS = 600;

export interface MorphPoint {
  x: number;
  z: number;
}

export interface MorphNode extends MorphPoint {
  systemId: number;
}

/** Quadratic ease-in-out, clamped so a frame that runs late lands on the end. */
export function easeInOut(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}

export function lerpPoint(a: MorphPoint, b: MorphPoint, t: number): MorphPoint {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/** The zoom is already logarithmic, so a straight line in it is an even zoom. */
export function lerpCamera(a: MapCamera, b: MapCamera, t: number): MapCamera {
  return { ...lerpPoint(a, b, t), zoom: a.zoom + (b.zoom - a.zoom) * t };
}

/**
 * Where each system of the layout being left goes, index for index — the
 * sprites were built in that order. Null for a system the new layout does not
 * hold, such as one ESI added after the last SDE import: it fades instead.
 */
export function pairNodes(
  from: readonly MorphNode[],
  to: readonly MorphNode[],
): (MorphPoint | null)[] {
  const target = new Map(to.map((node) => [node.systemId, node]));
  return from.map((node) => {
    const next = target.get(node.systemId);
    return next ? { x: next.x, z: next.z } : null;
  });
}

/**
 * The system the camera follows across the switch: the selected one, else the
 * one nearest the centre of the screen. Null when it is not in the new layout.
 */
export function morphAnchor({
  focus,
  camera,
  from,
  to,
}: {
  focus: number | null;
  camera: MapCamera;
  from: readonly MorphNode[];
  to: readonly MorphNode[];
}): { from: MorphPoint; to: MorphPoint } | null {
  const start =
    (focus !== null && from.find((node) => node.systemId === focus)) ||
    nearestNode([...from], camera.x, camera.z);
  if (!start) return null;
  const end = to.find((node) => node.systemId === start.systemId);
  if (!end) return null;
  return { from: { x: start.x, z: start.z }, to: { x: end.x, z: end.z } };
}

/**
 * Where the camera ends. Looking at the whole galaxy, it ends looking at the
 * whole galaxy. Looking at a corner of it, the anchor stays where it was on
 * screen at the same zoom: the camera moves by exactly the anchor's own
 * displacement.
 */
export function morphTarget({
  camera,
  atFit,
  toFit,
  anchor,
}: {
  camera: MapCamera;
  atFit: boolean;
  toFit: MapCamera;
  anchor: { from: MorphPoint; to: MorphPoint } | null;
}): MapCamera {
  if (atFit || !anchor) return toFit;
  return {
    x: camera.x + (anchor.to.x - anchor.from.x),
    z: camera.z + (anchor.to.z - anchor.from.z),
    zoom: camera.zoom,
  };
}
```

- [ ] **Step 4: Test**

Run: `yarn workspace frontend vitest run src/utils/map/morph.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/map/morph.ts frontend/src/utils/map/morph.spec.ts
git commit -m "feat(map): add the arithmetic of the layout morph"
```

---

### Task 9: `useReducedMotion` ve `useProjectionMorph`

**Files:**

- Create: `frontend/src/components/UniverseMap/useReducedMotion.ts`
- Modify: `frontend/src/components/UniverseMap/useRingSpin.ts` (medya sorgusunu yeni hook'a bırakır)
- Create: `frontend/src/components/UniverseMap/useProjectionMorph.ts`
- Create: `frontend/src/components/UniverseMap/useProjectionMorph.spec.ts`

**Interfaces:**

- Consumes: `MORPH_DURATION_MS`, `easeInOut`, `lerpPoint`, `lerpCamera`, `MorphPoint` (Task 8); `cameraTransform`, `zoomToScale`, `MapCamera` (`camera.ts`); `scaleSystems`, `SystemSprites` (`scene/systems`); `MapScene`.
- Produces:

```ts
export function useReducedMotion(): boolean;

export interface MorphRun {
  scene: MapScene;
  sprites: SystemSprites;
  from: readonly MorphPoint[]; // sprite i starts here
  to: readonly (MorphPoint | null)[]; // and ends here; null fades out
  fromCamera: MapCamera;
  toCamera: MapCamera;
  width: number;
  height: number;
  onDone: () => void;
}
export function useProjectionMorph(): { run(run: MorphRun): void };
```

- [ ] **Step 1: `useReducedMotion`'ı çıkar**

`useReducedMotion.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  // jsdom, and nothing else this site runs in, has no matchMedia.
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION).matches
  );
}

/** Whether the viewer asked for less motion. Two things on the map move. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
```

`useRingSpin.ts`'den `REDUCED_MOTION`, `subscribeReducedMotion`, `prefersReducedMotion` ve `useSyncExternalStore` import'unu sil; `useRingSpin` içinde `const reducedMotion = useReducedMotion();`.

Run: `yarn workspace frontend vitest run src/components/UniverseMap`
Expected: PASS (salt refactor; ring testleri değişmeden geçer).

- [ ] **Step 2: Failing morph testi**

```ts
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scene/systems', () => ({ scaleSystems: vi.fn() }));
const reduced = vi.fn(() => false);
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => reduced() }));

import { useProjectionMorph, type MorphRun } from './useProjectionMorph';

function fakeRun(overrides: Partial<MorphRun> = {}) {
  const ticks: (() => void)[] = [];
  const ticker = {
    add: vi.fn((fn: () => void) => ticks.push(fn)),
    remove: vi.fn((fn: () => void) => ticks.splice(ticks.indexOf(fn), 1)),
  };
  const sprite = () => ({ position: { set: vi.fn() }, alpha: 1 });
  const sprites = {
    sprites: [sprite(), sprite()],
    radii: [],
    logos: [],
    discs: [],
  };
  const run = {
    scene: {
      app: { ticker },
      world: { scale: { set: vi.fn() }, position: { set: vi.fn() } },
    },
    sprites,
    from: [
      { x: 0, z: 0 },
      { x: 10, z: 10 },
    ],
    to: [{ x: 100, z: 200 }, null],
    fromCamera: { x: 0, z: 0, zoom: -50 },
    toCamera: { x: 50, z: 50, zoom: -49 },
    width: 800,
    height: 600,
    onDone: vi.fn(),
    ...overrides,
  } as unknown as MorphRun;
  return { run, ticks, ticker, sprites };
}

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  reduced.mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

describe('useProjectionMorph', () => {
  it('moves each dot to its new place and ends exactly there', () => {
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticks, sprites } = fakeRun();
    result.current.run(run);

    now = 600;
    ticks[0]();

    expect(sprites.sprites[0].position.set).toHaveBeenLastCalledWith(100, 200);
    expect(run.onDone).toHaveBeenCalledTimes(1);
    expect(ticks).toHaveLength(0);
  });

  it('fades a dot with nowhere to go', () => {
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticks, sprites } = fakeRun();
    result.current.run(run);

    now = 600;
    ticks[0]();
    expect(sprites.sprites[1].alpha).toBe(0);
  });

  it('is half way at half time', () => {
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticks, sprites } = fakeRun();
    result.current.run(run);

    now = 300;
    ticks[0]();
    expect(sprites.sprites[0].position.set).toHaveBeenLastCalledWith(50, 100);
    expect(run.onDone).not.toHaveBeenCalled();
  });

  it('skips the motion for a viewer who asked for less', () => {
    reduced.mockReturnValue(true);
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticker } = fakeRun();
    result.current.run(run);

    expect(ticker.add).not.toHaveBeenCalled();
    expect(run.onDone).toHaveBeenCalledTimes(1);
  });

  it('comes off the ticker when the map unmounts mid-run', () => {
    const { result, unmount } = renderHook(() => useProjectionMorph());
    const { run, ticker } = fakeRun();
    result.current.run(run);
    unmount();
    expect(ticker.remove).toHaveBeenCalled();
    expect(run.onDone).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Kırıldığını gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useProjectionMorph.spec.ts`
Expected: FAIL — modül yok.

- [ ] **Step 4: Uygula**

```ts
'use client';

import {
  cameraTransform,
  zoomToScale,
  type MapCamera,
} from '@/utils/map/camera';
import {
  easeInOut,
  lerpCamera,
  lerpPoint,
  MORPH_DURATION_MS,
  type MorphPoint,
} from '@/utils/map/morph';
import { useEffect, useRef, useState } from 'react';
import type { MapScene } from './scene/createScene';
import { scaleSystems, type SystemSprites } from './scene/systems';
import { useReducedMotion } from './useReducedMotion';

export interface MorphRun {
  scene: MapScene;
  sprites: SystemSprites;
  /** Where sprite i starts: the layout being left, in sprite order. */
  from: readonly MorphPoint[];
  /** Where it ends; null fades it out instead. */
  to: readonly (MorphPoint | null)[];
  fromCamera: MapCamera;
  toCamera: MapCamera;
  width: number;
  height: number;
  /** Called once, on the frame that lands. Never after an unmount. */
  onDone: () => void;
}

/**
 * The switch between layouts, run on the Pixi ticker like the ring spin.
 *
 * Every frame writes the sprites and the world transform directly — no React
 * state, no URL — because 36 renders of a 1,000-line component for one
 * animation would cost more than the animation. The caller hides everything
 * else for the run and builds it again in the new layout from `onDone`.
 */
export function useProjectionMorph(): { run(run: MorphRun): void } {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const [morph] = useState(() => {
    let stop: (() => void) | null = null;

    return {
      run(r: MorphRun) {
        stop?.();
        if (reducedRef.current) {
          r.onDone();
          return;
        }

        const start = performance.now();
        const ticker = r.scene.app.ticker;
        const tick = () => {
          const raw = (performance.now() - start) / MORPH_DURATION_MS;
          const t = easeInOut(raw);

          for (let i = 0; i < r.sprites.sprites.length; i++) {
            const sprite = r.sprites.sprites[i];
            const end = r.to[i];
            if (end) {
              const p = lerpPoint(r.from[i], end, t);
              sprite.position.set(p.x, p.z);
            } else {
              sprite.alpha = 1 - t;
            }
          }

          const camera = lerpCamera(r.fromCamera, r.toCamera, t);
          const transform = cameraTransform(camera, r.width, r.height);
          r.scene.world.scale.set(transform.scaleX, transform.scaleY);
          r.scene.world.position.set(transform.x, transform.y);
          scaleSystems(r.sprites, zoomToScale(camera.zoom));

          if (raw >= 1) {
            ticker.remove(tick);
            stop = null;
            r.onDone();
          }
        };

        ticker.add(tick);
        stop = () => {
          // A destroyed app has already dropped its ticker, and the tick with it.
          ticker?.remove(tick);
          stop = null;
        };
      },
      dispose() {
        stop?.();
      },
    };
  });

  useEffect(() => morph.dispose, [morph]);
  return morph;
}
```

- [ ] **Step 5: Test**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/useProjectionMorph.spec.ts src/components/UniverseMap/useRingSpin`
Expected: PASS. (`useRingSpin`'in spec'i yoksa ikinci yol "no test files" der; o kabul.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UniverseMap/useReducedMotion.ts frontend/src/components/UniverseMap/useRingSpin.ts frontend/src/components/UniverseMap/useProjectionMorph.ts frontend/src/components/UniverseMap/useProjectionMorph.spec.ts
git commit -m "feat(map): run the layout morph on the Pixi ticker"
```

---

### Task 10: `UniverseMap`'e bağlama

**Files:**

- Modify: `frontend/src/components/UniverseMap/useMapLabels.ts`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Test: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: Task 5-9'un hepsi.
- Produces: kullanıcıya görünen özellik.

**Neden projeksiyon sorgu için URL'den okunur:** `useMapCamera(scope, framing ?? fit)` fallback olarak geometrinin `fit`'ini ister; geometri sorgusu da projeksiyonu ister. Hook'un `projection` state'i sorguya verilirse döngü olur. Sorgu bu yüzden `parseProjection(searchParams, scope)` okur. Morph biter bitmez `onProjectionChange` URL'i hemen yazar; o yazım commit edilene kadar sahne morph'un son karesinde "bekler" (katmanlar gizli, sprite'lar yeni yerlerinde). URL commit edilince sorgu değişkeni yeni projeksiyona geçer, Apollo cache'ten (hedef sorgu onu az önce getirdi) aynı veriyi verir ve normal efektler sahneyi yeni geometriyle kurar.

- [ ] **Step 1: `useMapLabels` projeksiyon alır**

```ts
export function useMapLabels(
  scope: MapScope,
  projection: MapProjection,
  zoom: number | null,
) {
  const { data: regionData } = useMapLabelsQuery({
    variables: { scope, kind: MapLabelKind.Region, projection },
    fetchPolicy: 'cache-first',
  });

  const { data: constellationData } = useMapLabelsQuery({
    variables: { scope, kind: MapLabelKind.Constellation, projection },
    fetchPolicy: 'cache-first',
    skip: zoom === null || zoom < CONSTELLATION_LABEL_ZOOM,
  });
```

(`MapProjection` tipini import et.)

- [ ] **Step 2: Failing testler**

`UniverseMap.spec.tsx`'deki `@/generated/graphql` mock'una ekle:

```ts
  MapProjection: { Schematic: 'SCHEMATIC', Galactic: 'GALACTIC' },
```

ve `useMapGeometryQuery`'yi seçenekleri kaydedecek şekilde değiştir:

```ts
/** Every geometry query: which layout it asked for and whether it was skipped. */
let geometryQueries: { projection: string; skip: boolean }[] = [];
// ...
  useMapGeometryQuery: (options: {
    variables: { projection: string };
    skip?: boolean;
  }) => {
    geometryQueries.push({
      projection: options.variables.projection,
      skip: !!options.skip,
    });
    return options.skip ? { data: undefined, loading: false } : useMapGeometryQuery();
  },
```

`beforeEach`'e `geometryQueries = [];` ekle. `./useProjectionMorph`'u mock'la ki morph testte anında bitsin ve çağrıldığı görülsün:

```ts
const morphRun = vi.fn();
vi.mock('./useProjectionMorph', () => ({
  useProjectionMorph: () => ({ run: morphRun }),
}));
```

`beforeEach`'e `morphRun.mockReset();`. Morph'un başlaması sprite ister; `./scene/systems` mock'unda `buildSystems: vi.fn()` → `buildSystems: vi.fn(() => ({ sprites: [], radii: [], logos: [], discs: [] }))`. `drawLabels`'a erişmek için spec'in import bloğuna `import { drawLabels } from './labels/labelLayer';` ekle (modül mock'lu, `vi.fn` döner). Sahne boyutu `fakeScene()`'in `app.screen`'inden gelir; morph testleri sahnenin kurulduğunu spec'in mevcut kalıbıyla bekler: `await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());`. Sonra `describe('UniverseMap')` içine yeni bir `describe('layout')`:

```tsx
describe('layout', () => {
  it('opens on the schematic layout', () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(geometryQueries.find((q) => !q.skip)?.projection).toBe('SCHEMATIC');
    expect(
      screen
        .getByRole('button', { name: 'Schematic' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('opens on the galactic layout when the URL names it', () => {
    searchParams = new URLSearchParams('view=galactic');
    render(<UniverseMap scope={MapScope.NewEden} />);
    expect(geometryQueries.find((q) => !q.skip)?.projection).toBe('GALACTIC');
  });

  it('offers no layout switch in wormhole space', () => {
    render(<UniverseMap scope={MapScope.Wormhole} />);
    expect(screen.queryByRole('group', { name: 'Layout' })).toBeNull();
  });

  it('fetches the other layout and morphs to it when the switch is pressed', async () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Galactic' }));

    expect(geometryQueries.at(-1)).toEqual({
      projection: 'GALACTIC',
      skip: false,
    });
    await waitFor(() => expect(morphRun).toHaveBeenCalledTimes(1));
  });

  it('starts no second morph when pressed again mid-run, or on the selected layout', async () => {
    render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Schematic' }));
    expect(morphRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Galactic' }));
    await waitFor(() => expect(morphRun).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Schematic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Galactic' }));
    expect(morphRun).toHaveBeenCalledTimes(1);
  });

  it('writes the layout and the camera once the morph lands', async () => {
    morphRun.mockImplementation((run: { onDone: () => void }) => run.onDone());
    render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Galactic' }));

    await waitFor(() => {
      const last = new URLSearchParams(
        routerReplace.mock.calls.at(-1)![0].slice(1),
      );
      expect(last.get('view')).toBe('galactic');
      expect(last.has('x')).toBe(true);
    });
  });

  it('keeps the labels and the pointer off until the URL has the new layout', async () => {
    // onDone writes the URL, but the mocked router never hands it back: the
    // map is held on the morph's last frame.
    morphRun.mockImplementation((run: { onDone: () => void }) => run.onDone());
    render(<UniverseMap scope={MapScope.NewEden} />);
    await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());
    vi.mocked(drawLabels).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Galactic' }));
    await waitFor(() => expect(morphRun).toHaveBeenCalled());

    for (const call of vi.mocked(drawLabels).mock.calls) {
      expect(call[1]).toEqual([]);
    }
  });
});
```

`fireEvent`'i `@testing-library/react` import'una ekle.

Review Focus satır 3 için (scope değişince morph düşer):

```tsx
it('drops a morph in flight when the scope changes', async () => {
  const { rerender } = render(<UniverseMap scope={MapScope.NewEden} />);
  await waitFor(() => expect(scene.world.position.set).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Galactic' }));

  rerender(<UniverseMap scope={MapScope.Pochven} />);

  expect(
    screen
      .getByRole('button', { name: 'Schematic' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});
```

- [ ] **Step 3: Kırıldığını gör**

Run: `yarn workspace frontend vitest run src/components/UniverseMap/UniverseMap.spec.tsx`
Expected: FAIL.

- [ ] **Step 4: `UniverseMap.tsx`'i bağla**

İmportlar: `MapProjection` (`@/generated/graphql`), `parseProjection`, `projectionsFor` (`@/utils/map/camera`), `morphAnchor`, `morphTarget`, `pairNodes` (`@/utils/map/morph`), `useProjectionMorph` (`./useProjectionMorph`). Modül seviyesinde:

```ts
const PROJECTION_LABEL: Record<MapProjection, string> = {
  [MapProjection.Schematic]: 'Schematic',
  [MapProjection.Galactic]: 'Galactic',
};

/** A switch of layout under way: requested, loading, or running. */
interface Morph {
  scope: MapScope;
  from: MapProjection;
  to: MapProjection;
}
```

**4a — sorgular.** `const searchParams = useSearchParams();` satırını geometri sorgusunun üstüne taşı, ardından mevcut sorguyu şununla değiştir:

```ts
// The layout the query draws comes from the URL, not from useMapCamera: that
// hook takes the geometry's fit as its fallback, so its state cannot also
// decide which geometry to load. useMapCamera writes the URL the moment a
// morph lands, and the morph holds its last frame until the URL arrives here.
const urlProjection = parseProjection(searchParams, scope);
const [morph, setMorph] = useState<Morph | null>(null);

const { data, loading, error } = useMapGeometryQuery({
  variables: { scope, projection: urlProjection },
  fetchPolicy: 'cache-first',
});
// The layout being switched to. Same variables the main query moves to once
// the URL commits, so that query is then answered from this one's cache entry.
const targetQuery = useMapGeometryQuery({
  variables: { scope, projection: morph?.to ?? urlProjection },
  fetchPolicy: 'cache-first',
  skip: morph === null,
});
const targetGeometry = morph ? targetQuery.data?.mapGeometry : undefined;

// Dropped during render, not in an effect, once the URL has the new layout
// and the main query has its data — or the scope it ran in is gone. React's
// "adjust state while rendering" pattern: an effect would draw one frame of
// the new geometry with every layer still hidden.
if (
  morph &&
  (morph.scope !== scope || (urlProjection === morph.to && data?.mapGeometry))
) {
  setMorph(null);
}

// The target's own copy stands in while the main query catches up with the
// URL. Without it a query that did not answer from cache on the very render
// its variables changed would put up the Loader — which unmounts the host
// and with it the whole scene.
const geometry =
  data?.mapGeometry ??
  (morph && urlProjection === morph.to ? targetGeometry : undefined);
const morphing = morph !== null;
```

Mevcut `const searchParams = useSearchParams();` satırını (satır 174) sil, çünkü yukarı taşındı.

**4b — hook.** `useMapCamera` dönüşünden `onProjectionChange`'i de al. `useMapLabels(scope, camera?.zoom ?? null)` → `useMapLabels(scope, urlProjection, camera?.zoom ?? null)`.

**4c — istek.** `useMapCamera`'dan sonra:

```ts
const requestProjection = useCallback(
  (next: MapProjection) => {
    if (morph !== null || next === urlProjection) return;
    setMorph({ scope, from: urlProjection, to: next });
  },
  [morph, urlProjection, scope],
);
```

**4d — morph'u başlat.** `buildSystems` effect'inin altına:

```ts
// Once per morph, when the layout being switched to has loaded and there are
// sprites to move. The ref, not the state, remembers it ran: a render in the
// middle of the run must not start it again.
const morphRunner = useProjectionMorph();
const morphStarted = useRef<Morph | null>(null);
useEffect(() => {
  if (!morph || morphStarted.current === morph) return;
  if (!targetGeometry || !geometry || !camera || !fit) return;
  if (!scene.current || !systemSprites.current || !size.width) return;
  morphStarted.current = morph;

  const toFit = fitCamera(targetGeometry.bounds, size.width, size.height);
  const toCamera = morphTarget({
    camera,
    // The camera is the fit object itself until anything moves it.
    atFit: camera === fit,
    toFit,
    anchor: morphAnchor({
      focus: selected,
      camera,
      from: geometry.nodes,
      to: targetGeometry.nodes,
    }),
  });

  morphRunner.run({
    scene: scene.current,
    sprites: systemSprites.current,
    from: geometry.nodes,
    to: pairNodes(geometry.nodes, targetGeometry.nodes),
    fromCamera: camera,
    toCamera,
    width: size.width,
    height: size.height,
    onDone: () => onProjectionChange(morph.to, toCamera),
  });
}, [
  morph,
  targetGeometry,
  geometry,
  camera,
  fit,
  selected,
  sceneReady,
  size.width,
  size.height,
  morphRunner,
  onProjectionChange,
]);
```

**4e — morph sırasında gizle.**

- Görünürlük effect'i (`layerVisibility(bucket)` olan):

```ts
useEffect(() => {
  if (!scene.current) return;
  const v = layerVisibility(bucket);
  // Everything but the dots is hidden for a morph: none of it moves with them.
  scene.current.edgesGalaxy.visible = v.edgesGalaxy && !morphing;
  scene.current.edgesHighlight.visible = v.edgesHighlight && !morphing;
  scene.current.edgesLocal.visible = v.edgesLocal && !morphing;
  scene.current.discs.visible = !morphing;
  scene.current.systems.visible = v.systems;
  scene.current.celestials.visible = v.celestials && !morphing;
  if (celestialSprites.current) {
    setFineVisible(celestialSprites.current, v.fine);
  }
}, [sceneReady, bucket, celestials, morphing]);
```

- Etiket effect'i: `tiers: visibleLabelTiers(camera.zoom)` → `tiers: morphing ? [] : visibleLabelTiers(camera.zoom)`; bağımlılıklara `morphing`.
- Halka effect'i: `transform && layerId === 'sovereignty'` → `transform && layerId === 'sovereignty' && !morphing`; bağımlılıklara `morphing`.
- Pointer: `useMapPointer(host, camera, limits, onCameraChange, pick);` →

```ts
// A null camera and no pick are how the pointer hook stands down: a drag or
// a click during the morph would act on positions that are mid-flight.
useMapPointer(
  host,
  morphing ? null : camera,
  limits,
  onCameraChange,
  morphing ? undefined : pick,
);
```

- JSX: `{hovered && camera && showHoverTip(...)` → `{!morphing && hovered && camera && ...`; `{selectedNode && transform && camera && (` → `{!morphing && selectedNode && transform && camera && (`.

**4f — paylaşılan link.** `shareUrlFor` içindeki `sharedMapUrl({...})`'a `projection: urlProjection,` ekle, bağımlılıklara `urlProjection`.

**4g — düğme.** `MapSwitch` (katman) satırının altına:

```tsx
{
  projectionsFor(scope).length > 1 && (
    <MapSwitch
      label="Layout"
      options={projectionsFor(scope).map((id) => ({
        id,
        label: PROJECTION_LABEL[id],
      }))}
      // The pressed segment is the one asked for, so the press is
      // answered at once even while that layout is still loading.
      value={morph?.to ?? urlProjection}
      onChange={requestProjection}
    />
  );
}
```

- [ ] **Step 5: Testler ve tip kontrolü**

```bash
yarn workspace frontend vitest run src/components/UniverseMap
yarn workspace frontend build
```

Expected: testler PASS; `build` temiz. `lint` `react-hooks/set-state-in-effect` ya da `react-hooks/refs` uyarısı verirse 4a'daki render-sırası `setMorph` ve 4d'deki `morphStarted` ref'i bunun nedenidir; kural ihlali yoksa dokunma, varsa uyarının metnini rapora koy.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UniverseMap
git commit -m "feat(map): open on the schematic layout and morph to the galactic one"
```

---

### Task 11: Son doğrulama

Bu iş "serious" sınıfında (resolver, servis, `.graphql`, Prisma şeması, migration): tam set çalışır. CLAUDE.md'ye göre `qa` agent'ına arka planda verilir.

- [ ] **Step 1: Tam set (`qa` agent)**

```bash
yarn test
yarn workspace backend build
yarn workspace backend codegen
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
npx prettier --check $(git diff --name-only main...HEAD)
```

`lint` sayısı `main`'deki sayıyla karşılaştırılır; hiçbir giriş bu dalın dokunduğu bir dosyayı adlandırmamalı.

- [ ] **Step 2: Veriyi backend'e doğrudan sor**

Backend `yarn dev:backend` ile ayaktayken (port `backend/.env`'deki `PORT`):

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2)
for p in SCHEMATIC GALACTIC; do
  curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
    -d "{\"query\":\"{ mapGeometry(scope: NEW_EDEN, projection: $p) { bounds { minX maxX minZ maxZ } nodes { systemId } } }\"}" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const g=JSON.parse(s).data.mapGeometry;console.log(process.argv[1],g.nodes.length,JSON.stringify(g.bounds))})' $p
done
```

Expected: iki projeksiyonda aynı node sayısı; SCHEMATIC'in genişliği ~1.09e18 × 1.26e18 m, GALACTIC'inki ~8.45e17 × 9.57e17 m.

`mapLabels(scope: NEW_EDEN, kind: REGION, projection: SCHEMATIC)` için de aynı biçimde 67 civarı bölge dönmeli.

- [ ] **Step 3: Kullanıcıya bakması gerekenleri yaz**

`/map` açılışta şematik mi; `Galactic`'e basınca noktalar ~0.6 s'de kayıyor mu, çizgiler ve isimler sonunda geri geliyor mu; bir bölgeye yakınlaşıp geçince o bölge ekranda kalıyor mu; bir sistem seçiliyken geçişte popup sonunda aynı sistemde mi; `?scope=WORMHOLE`'da düğme yok mu. Görsel doğrulama kullanıcının.

---

## Dağıtım (spec §7)

1. Migration: `npx prisma migrate deploy`.
2. `yarn workspace backend sde:map-2d`.
3. Backend ve frontend.

4. adım atlanırsa şematik sahne boştur ve harita boş açılır.
