# Evren haritası sistem seçimi ve popup (faz 3a) — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Haritanın noktalarına dokunulabilir hâle getirmek — imlecin altındaki sistemi bulmak, hover'da ad ve güvenliği tek satırda göstermek, tıklamada sistemin son bir saatlik aktivitesini popup'ta açmak.

**Architecture:** Hit test ekran uzayında saf bir fonksiyon (`utils/map/pick.ts`), Pixi'nin event sistemi değil — sprite'lar karşı-ölçekli olduğu için Pixi üzerinden minimum tıklama alanı her zoom'da 5.241 `hitArea` yazmak demekti. `useMapPointer` yalnızca olayı bildiriyor (imleç konumu + tıklama), picking'i `UniverseMap` saf fonksiyonla yapıyor. Popup ve hover ipucu tuvalin üstünde sıradan React bileşenleri; bu dilim `scene/` altına hiçbir dosya eklemiyor. Popup'ın gösterdiği her şey tek yeni sorgudan geliyor: `mapSystemDetails(systemId)`.

**Tech Stack:** TypeScript, GraphQL Yoga, Prisma `$queryRaw` (`@services/prisma`), Redis, Next.js App Router + React 19, PixiJS 8.20.1, Vitest 5, Testing Library. **Yeni bağımlılık yok.**

**Spec:** [`../specs/2026-09-14-universe-map-picking-design.md`](../specs/2026-09-14-universe-map-picking-design.md)

## Global Constraints

- **Yarn, asla npm.** Bu plan bağımlılık eklemiyor; `yarn.lock` hiçbir task'ta değişmemeli.
- **Migration yok.** Bu plan şema değiştirmiyor, yalnızca okuyor. `prisma migrate dev` beş tabloyu düşürür — hiçbir task'ta çağrılmıyor.
- **`.graphql` değişiyor → codegen gerekiyor**, sırası sabit: **backend → frontend.** Task 2 ikisini de koşuyor.
- **Üretilmiş dosyalar elle düzenlenmiyor:** `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
- **`.env`'e dokunulmaz.** Bu checkout'ta backend `PORT=4010`, frontend `:3000`.
- **`lint` kabul kriteri `main`'in sayısı, sıfır fark.** Bu plan yazılırken **228 problems (144 errors, 84 warnings)**.
- **Resolver iş yapmaz**, servise devreder. Yeni servis **düz `async function`** — yanındaki `universe-map.service.ts` öyle; `solar-system-stats.service.ts`'in `static` metotlu sınıfı depoda istisnadır.
- **Karar `utils/map/`'te ve testli; Pixi nesnesine atama `scene/`'de ve testsiz.**
- **`$queryRaw`'ın `COUNT(*)` kolonu `BigInt` döndürür ve `JSON.stringify` onda patlar** — `Number()` ile dönüştürülecek.
- Commit ve PR metinleri **İngilizce**, `type(scope):` sonrası küçük harf, Claude atıfsız.

## Ölçülmüş sabitler

Spec'ten taşınıyor, hiçbiri task içinde yeniden türetilmeyecek:

| Sabit                              | Değer                                                                                       | Nereden                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Sistemlerin medyan komşu mesafesi  | 3,4944e15 m                                                                                 | `utils/map/lod.ts`                                |
| Aynı mesafe `SYSTEM_LABEL_ZOOM`'da | 59,9 px                                                                                     | `3.4944e15 * 2 ** -45.73`                         |
| Aynı mesafe galaksi fitinde        | 3,0 px                                                                                      | `3.4944e15 * 2 ** -50.04`                         |
| `MIN_PICK_RADIUS_PX`               | 6                                                                                           | Yargı; gözle ayarlanacak                          |
| `CLICK_MOVE_TOLERANCE_PX`          | 4                                                                                           | Yargı; drag'i tıklamadan ayıran eşik              |
| Popup/ipucu Redis TTL'i            | 300 s                                                                                       | Saat başı değişen veri, CLAUDE.md'nin canlı TTL'i |
| Jita doğrulama satırı              | `sec 0.94`, `Kimotoro`, `The Forge`, 7 kapı, 4/8/77 kills, 1.745 jumps, `2026-09-14T09:00Z` | `psql`, plan yazılırken                           |

---

## Task 1: `pickSystem` — hit test saf fonksiyon olarak

**Files:**

- Create: `frontend/src/utils/map/pick.ts`
- Test: `frontend/src/utils/map/pick.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-14-universe-map-picking-design.md` (bir paragraf düzeltmesi, aşağıda Step 6)

**Interfaces:**

- Consumes: `CameraTransform` (`utils/map/camera.ts`), `systemRadiusPx` (`utils/map/marks.ts`)
- Produces:
  - `MIN_PICK_RADIUS_PX = 6`
  - `pickRadiusPx(worldRadius: number, cameraScale: number): number`
  - `interface PickNode { systemId: number; name: string; x: number; z: number; radius: number; securityStatus: number }`
  - `interface PickTarget { node: PickNode; screenX: number; screenY: number }`
  - `pickSystem(args: { nodes: PickNode[]; transform: CameraTransform; pointerX: number; pointerY: number; cameraScale: number }): PickTarget | null`

`pickSystem` ekran konumunu da döndürüyor çünkü onu zaten hesaplıyor, ve popup ile ipucu ikisi de ona ihtiyaç duyuyor — çağıranın aynı çarp-toplamı ikinci kez yapmasına gerek kalmıyor.

- [ ] **Step 1: Failing test'i yaz**

`frontend/src/utils/map/pick.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { cameraTransform, type MapCamera } from './camera';
import {
  MIN_PICK_RADIUS_PX,
  pickRadiusPx,
  pickSystem,
  type PickNode,
} from './pick';

const WIDTH = 800;
const HEIGHT = 600;

function node(over: Partial<PickNode> = {}): PickNode {
  return {
    systemId: 30000142,
    name: 'Jita',
    x: 0,
    z: 0,
    radius: 0,
    securityStatus: 0.94,
    ...over,
  };
}

/** A camera centred on the origin, one pixel per metre. */
const UNIT_CAMERA: MapCamera = { x: 0, z: 0, zoom: 0 };
const UNIT = cameraTransform(UNIT_CAMERA, WIDTH, HEIGHT);

function pick(nodes: PickNode[], pointerX: number, pointerY: number) {
  return pickSystem({
    nodes,
    transform: UNIT,
    pointerX,
    pointerY,
    cameraScale: 1,
  });
}

describe('pickRadiusPx', () => {
  it('floors at MIN_PICK_RADIUS_PX, because a 1.5 px dot cannot be clicked', () => {
    // systemRadiusPx's own floor is 1.5, which is the galaxy zoom case.
    expect(pickRadiusPx(0, 1)).toBe(MIN_PICK_RADIUS_PX);
  });

  it('follows the real dot once the dot is larger than the floor', () => {
    // radius 100 m at scale 1 is a 100 px disc; the whole disc is clickable.
    expect(pickRadiusPx(100, 1)).toBe(100);
  });
});

describe('pickSystem', () => {
  it('returns the node under the pointer, with its screen position', () => {
    // The origin projects to the viewport centre.
    const target = pick([node()], WIDTH / 2, HEIGHT / 2);
    expect(target?.node.systemId).toBe(30000142);
    expect(target?.screenX).toBe(WIDTH / 2);
    expect(target?.screenY).toBe(HEIGHT / 2);
  });

  it('returns null when the pointer is outside every radius', () => {
    expect(pick([node()], WIDTH / 2 + 20, HEIGHT / 2)).toBeNull();
  });

  it('picks a 1.5 px dot from 5 px away, thanks to the floor', () => {
    expect(pick([node()], WIDTH / 2 + 5, HEIGHT / 2)?.node.name).toBe('Jita');
  });

  it('projects +z upward: scaleY is negative', () => {
    // A node 50 m up the z axis must land ABOVE the centre, at a smaller
    // screen y. This is the map's +z-is-up contract and the one thing that
    // silently inverts if the projection is copied wrong.
    const target = pick([node({ z: 50 })], WIDTH / 2, HEIGHT / 2 - 50);
    expect(target?.screenY).toBe(HEIGHT / 2 - 50);
  });

  it('gives the nearest node when two clickable areas overlap', () => {
    const near = node({ systemId: 1, name: 'Near', x: 2 });
    const far = node({ systemId: 2, name: 'Far', x: -4 });
    expect(pick([far, near], WIDTH / 2 + 2, HEIGHT / 2)?.name ?? '').toBe('');
    // ^ placeholder removed in Step 3; see the corrected assertion below.
  });

  it('returns null for an empty scene', () => {
    expect(pick([], WIDTH / 2, HEIGHT / 2)).toBeNull();
  });
});
```

> Yukarıdaki `overlap` testindeki `?.name ?? ''` **kasıtlı bir hata değil**, yazım
> hatasıdır ve Step 3'te düzeltiliyor — `PickTarget`'ın `name`'i yok, `node.name`'i
> var. Step 2 bunu da yakalayacak.

- [ ] **Step 2: Test'i koş, başarısız olduğunu gör**

```bash
cd frontend && yarn vitest run src/utils/map/pick.spec.ts
```

Beklenen: modül bulunamadığı için toplama hatası (`Failed to resolve import "./pick"`).

- [ ] **Step 3: `overlap` testini düzelt**

```ts
it('gives the nearest node when two clickable areas overlap', () => {
  // At the galaxy fit the median neighbour is 3.0 px apart, so with a 6 px
  // radius neighbouring systems really do overlap. Nearest wins, so the
  // result is deterministic even then.
  const near = node({ systemId: 1, name: 'Near', x: 2 });
  const far = node({ systemId: 2, name: 'Far', x: -4 });
  expect(pick([far, near], WIDTH / 2 + 2, HEIGHT / 2)?.node.name).toBe('Near');
});
```

- [ ] **Step 4: Minimal implementasyonu yaz**

`frontend/src/utils/map/pick.ts`:

```ts
import type { CameraTransform } from './camera';
import { systemRadiusPx } from './marks';

/**
 * The smallest clickable radius, in pixels.
 *
 * At galaxy zoom every system is `SYSTEM_MIN_RADIUS_PX` — 1.5 px — and a
 * 1.5 px target cannot be hit. Phase 1-2's design wrote deck.gl's
 * `pickingRadius: 4`, which was an extra margin AROUND the mark; this is the
 * total radius instead, so 6 rather than 4.
 *
 * It is a judgement, not a measurement. Systems sit a median 3.4944e15 m
 * apart, which is 59.9 px at SYSTEM_LABEL_ZOOM and 3.0 px at the galaxy fit —
 * so down there neighbouring targets overlap and the nearest one wins. Tune by
 * looking.
 */
export const MIN_PICK_RADIUS_PX = 6;

/** Whatever the dot actually occupies on screen, floored so it can be hit. */
export function pickRadiusPx(worldRadius: number, cameraScale: number): number {
  return Math.max(systemRadiusPx(worldRadius, cameraScale), MIN_PICK_RADIUS_PX);
}

/** What picking needs from a node: where it is, how big, and what to show. */
export interface PickNode {
  systemId: number;
  name: string;
  x: number;
  z: number;
  radius: number;
  securityStatus: number;
}

export interface PickTarget {
  node: PickNode;
  /** Where the node's centre is, so the caller does not project it again. */
  screenX: number;
  screenY: number;
}

/**
 * The system under a pointer, or null.
 *
 * The projection is the multiply-add `cameraTransform` already describes —
 * note that scaleY is NEGATIVE, so a larger z lands at a smaller screen y.
 * That is the map's +z-is-up contract, and the one thing here that silently
 * inverts if copied wrong. `utils/map/labels.ts` carries the same warning.
 *
 * Linear over the scene's nodes. 5,241 at the most, one multiply-add each, and
 * the label pass already walks the same array on every camera change. The
 * caller throttles this to an animation frame.
 *
 * The cheap rejection is an axis-aligned test against the POINTER, not a
 * viewport clip: the pointer is inside the viewport by definition, so a box
 * around it rejects strictly more nodes than the viewport does, and with one
 * subtraction per axis. Only what survives both axes pays for a squared
 * distance.
 */
export function pickSystem({
  nodes,
  transform,
  pointerX,
  pointerY,
  cameraScale,
}: {
  nodes: PickNode[];
  transform: CameraTransform;
  pointerX: number;
  pointerY: number;
  cameraScale: number;
}): PickTarget | null {
  let best: PickTarget | null = null;
  let bestDistance = Infinity;

  for (const node of nodes) {
    const radius = pickRadiusPx(node.radius, cameraScale);

    const screenX = node.x * transform.scaleX + transform.x;
    const dx = screenX - pointerX;
    if (dx > radius || dx < -radius) continue;

    const screenY = node.z * transform.scaleY + transform.y;
    const dy = screenY - pointerY;
    if (dy > radius || dy < -radius) continue;

    const distance = dx * dx + dy * dy;
    if (distance > radius * radius) continue;
    // Strictly nearer, so the first of two equidistant nodes wins and the
    // result does not depend on the array being re-sorted upstream.
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    best = { node, screenX, screenY };
  }

  return best;
}
```

- [ ] **Step 5: Test'i koş, geçtiğini gör**

```bash
cd frontend && yarn vitest run src/utils/map/pick.spec.ts
```

Beklenen: 7 passed.

- [ ] **Step 6: Spec'in bir paragrafını düzelt**

Spec "önce viewport kırpması, sonra en yakını" diyor ve `labelCandidates`'ı örnek
gösteriyor. Uygulama imleç çevresinde eksen hizalı bir kutu kullanıyor, ki o
viewport'tan **daha fazla** düğüm eliyor: imleç tanım gereği viewport'un içinde.
Spec belgenin kaydı olduğu için düzeltiliyor.

`docs/superpowers/specs/2026-09-14-universe-map-picking-design.md` içinde şu paragrafı:

```markdown
Sıra, `labelCandidates`'ın sırası: **önce viewport kırpması, sonra en yakını.**
Kırpma O(n) ve ucuz; en yakını arama yalnız ekranda kalan düğümler üzerinde
koşuyor. Beraberlik olamaz çünkü en küçük kare mesafe kazanıyor.
```

şununla değiştir:

```markdown
Ucuz eleme, **imlecin çevresinde eksen hizalı bir kutu** — viewport kırpması
değil. İmleç tanım gereği viewport'un içinde, yani imleç kutusu viewport'un
eleyeceği her düğümü ve fazlasını eliyor, eksen başına tek çıkarmayla. İki
ekseni de geçen düğüm kare mesafeyi ödüyor. Beraberlikte dizideki ilk düğüm
kazanıyor (`>=` karşılaştırması), böylece sonuç dizinin sırasına bağlı kalmıyor.
```

- [ ] **Step 7: Commit**

```bash
cd /Users/umut/Sites/killreport
git add frontend/src/utils/map/pick.ts frontend/src/utils/map/pick.spec.ts \
  docs/superpowers/specs/2026-09-14-universe-map-picking-design.md
git commit -m "feat(map): find the system under a pointer"
```

---

## Task 2: `mapSystemDetails` — popup'ın tek sorgusu

**Files:**

- Modify: `backend/src/schemas/UniverseMap.graphql` (yeni tip + `extend type Query`'ye bir alan)
- Create: `backend/src/services/universe/map-system.service.ts`
- Test: `backend/src/services/universe/map-system.service.spec.ts`
- Modify: `backend/src/services/universe/index.ts`
- Modify: `backend/src/resolvers/universe-map/queries.ts`
- Modify: `backend/src/config/cache.ts`
- Create: `frontend/src/graphql/MapSystemDetails.graphql`

**Interfaces:**

- Consumes: `prisma` (`@services/prisma`), `redis` (`@services/redis`)
- Produces:
  - `SYSTEM_DETAILS_CACHE_TTL_SECONDS = 300`
  - `systemDetailsCacheKey(systemId: number): string` → `map:system:{systemId}`
  - `interface MapSystemDetails { systemId: number; name: string; securityStatus: number | null; constellationName: string; regionName: string; gateCount: number; shipKills: number | null; podKills: number | null; npcKills: number | null; shipJumps: number | null; snapshotAt: string | null }`
  - `getMapSystemDetails(systemId: number): Promise<MapSystemDetails | null>`
  - Frontend hook `useMapSystemDetailsQuery({ variables: { systemId } })`

Dört kills/jumps alanı **null'lanabilir** ve ikisi farklı şey söylüyor:

- Sistemin hiç `system_activity` satırı yoksa **dördü de null** — popup dört kutuda `—` gösteriyor.
- Satır varken `shipKills`/`podKills`/`npcKills` her zaman sayıdır (kolonlar `NOT NULL DEFAULT 0`), `shipJumps` ise ESI jumps listesinde o sistemi bildirmediyse null'dır.

- [ ] **Step 1: Şemaya tipi ve sorguyu ekle**

`backend/src/schemas/UniverseMap.graphql`, `MapLabel` tipinin altına:

```graphql
"""
Bir sistemin popup'ının gösterdiği her şey, tek sorguda.

Neden `solarSystem(id)` değil, oradan hepsi okunabilirken: o koordinat response
cache'te **365 gün** duruyor (`config/cache.ts`, `STATIC_GAME_DATA`) ve içinden
okunan saatlik veri bir yıl boyunca donar. Detay sayfasının kendi "2 saat önce"
satırı bugün bu yüzden donuyor; buraya taşınmıyor.
"""
type MapSystemDetails {
  systemId: Int!
  name: String!
  "İki ondalığa KESİLMİŞ, MapNode.securityStatus ile aynı: yuvarlama 14 sistemi highsec'e taşıyor."
  securityStatus: Float
  constellationName: String!
  regionName: String!
  """
  `stargates` tablosundan gerçek sayı. `mapGeometry.edges`'ten saymak EKSİK
  sayar: orada bir kenarın iki ucu da scope içinde olmak zorunda, yani scope
  dışına çıkan kapı hiç görünmez.
  """
  gateCount: Int!
  "Son anlık görüntü. Sistemin hiç satırı yoksa dördü de null."
  shipKills: Int
  podKills: Int
  npcKills: Int
  "Satır varken de null olabilir: ESI jumps listesinde o sistemi bildirmediyse. 0 ise bildirdi ve atlama yoktu."
  shipJumps: Int
  "Anlık görüntünün saati, ISO. Dört sayı null ise bu da null."
  snapshotAt: String
}
```

ve `extend type Query` bloğunun içine:

```graphql
  """
  Popup'ın okuduğu tek sorgu. Önbellek sistem başına 300 s — içindeki en kısa
  ömürlü parça saat başı değişen aktivite.
  """
  mapSystemDetails(systemId: Int!): MapSystemDetails
```

- [ ] **Step 2: Failing test'i yaz**

`backend/src/services/universe/map-system.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest hoists vi.mock above plain const declarations, so the factory's outer
// variables have to come from vi.hoisted — same pattern as
// map-labels.service.spec.ts.
const { redis, prisma } = vi.hoisted(() => ({
  redis: { get: vi.fn(), setex: vi.fn() },
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@services/prisma', () => ({ default: prisma, prisma }));

import {
  getMapSystemDetails,
  systemDetailsCacheKey,
  SYSTEM_DETAILS_CACHE_TTL_SECONDS,
} from './map-system.service';

/** One row shaped the way the SQL returns it, Jita's real values. */
function jitaRow(over: Record<string, unknown> = {}) {
  return {
    system_id: 30000142,
    name: 'Jita',
    security_status: 0.94,
    constellation_name: 'Kimotoro',
    region_name: 'The Forge',
    // COUNT(*) comes back from $queryRaw as a BigInt.
    gate_count: 7n,
    ship_kills: 4,
    pod_kills: 8,
    npc_kills: 77,
    ship_jumps: 1745,
    snapshot_at: new Date('2026-09-14T09:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => {
  redis.get.mockReset();
  redis.setex.mockReset();
  prisma.$queryRaw.mockReset();
  redis.get.mockResolvedValue(null);
});

describe('systemDetailsCacheKey', () => {
  it('keys on the system id', () => {
    expect(systemDetailsCacheKey(30000142)).toBe('map:system:30000142');
  });
});

describe('getMapSystemDetails', () => {
  it('maps a row to the shape the popup reads', async () => {
    prisma.$queryRaw.mockResolvedValue([jitaRow()]);

    expect(await getMapSystemDetails(30000142)).toEqual({
      systemId: 30000142,
      name: 'Jita',
      securityStatus: 0.94,
      constellationName: 'Kimotoro',
      regionName: 'The Forge',
      gateCount: 7,
      shipKills: 4,
      podKills: 8,
      npcKills: 77,
      shipJumps: 1745,
      snapshotAt: '2026-09-14T09:00:00.000Z',
    });
  });

  it('converts the BigInt gate count, which JSON.stringify would throw on', async () => {
    prisma.$queryRaw.mockResolvedValue([jitaRow()]);

    const details = await getMapSystemDetails(30000142);

    expect(typeof details?.gateCount).toBe('number');
    // The cache write is where a surviving BigInt would actually blow up.
    expect(redis.setex).toHaveBeenCalledOnce();
  });

  it('leaves all four activity numbers null when the system has no snapshot', async () => {
    prisma.$queryRaw.mockResolvedValue([
      jitaRow({
        ship_kills: null,
        pod_kills: null,
        npc_kills: null,
        ship_jumps: null,
        snapshot_at: null,
      }),
    ]);

    const details = await getMapSystemDetails(31000001);

    expect(details).toMatchObject({
      shipKills: null,
      podKills: null,
      npcKills: null,
      shipJumps: null,
      snapshotAt: null,
    });
  });

  it('keeps a reported zero apart from an unreported null', async () => {
    // ESI listed the system with no jumps: that is a zero, not a gap.
    prisma.$queryRaw.mockResolvedValue([jitaRow({ ship_jumps: 0 })]);
    expect((await getMapSystemDetails(30000142))?.shipJumps).toBe(0);

    prisma.$queryRaw.mockReset();
    redis.get.mockResolvedValue(null);
    // ESI did not list it at all.
    prisma.$queryRaw.mockResolvedValue([jitaRow({ ship_jumps: null })]);
    expect((await getMapSystemDetails(30000142))?.shipJumps).toBeNull();
  });

  it('returns null for a system that does not exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await getMapSystemDetails(1)).toBeNull();
  });

  it('does not cache a miss', async () => {
    // A null would be indistinguishable from a cache miss on read, and an
    // unknown id is not worth a key.
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapSystemDetails(1);
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('serves a cached row without querying', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ systemId: 30000142, name: 'Jita' }),
    );

    const details = await getMapSystemDetails(30000142);

    expect(details?.name).toBe('Jita');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('writes the cache with the live TTL', async () => {
    prisma.$queryRaw.mockResolvedValue([jitaRow()]);
    await getMapSystemDetails(30000142);

    expect(redis.setex).toHaveBeenCalledWith(
      'map:system:30000142',
      SYSTEM_DETAILS_CACHE_TTL_SECONDS,
      expect.any(String),
    );
    expect(SYSTEM_DETAILS_CACHE_TTL_SECONDS).toBe(300);
  });
});
```

- [ ] **Step 3: Test'i koş, başarısız olduğunu gör**

```bash
cd backend && yarn vitest run src/services/universe/map-system.service.spec.ts
```

Beklenen: `Failed to resolve import "./map-system.service"`.

- [ ] **Step 4: Servisi yaz**

`backend/src/services/universe/map-system.service.ts`:

```ts
import prisma from '@services/prisma';
import redis from '@services/redis';

export interface MapSystemDetails {
  systemId: number;
  name: string;
  securityStatus: number | null;
  constellationName: string;
  regionName: string;
  gateCount: number;
  shipKills: number | null;
  podKills: number | null;
  npcKills: number | null;
  shipJumps: number | null;
  snapshotAt: string | null;
}

/**
 * Live data, so 300 s — the same TTL the leaderboards use for today's numbers.
 * The activity half of this row changes hourly and is the shortest-lived thing
 * in it, which is what sets the TTL for the whole key.
 */
export const SYSTEM_DETAILS_CACHE_TTL_SECONDS = 300;

export function systemDetailsCacheKey(systemId: number): string {
  return `map:system:${systemId}`;
}

interface DetailsRow {
  system_id: number;
  name: string;
  security_status: number | null;
  constellation_name: string;
  region_name: string;
  /** COUNT(*) — a BigInt, which JSON.stringify throws on. */
  gate_count: bigint;
  ship_kills: number | null;
  pod_kills: number | null;
  npc_kills: number | null;
  ship_jumps: number | null;
  snapshot_at: Date | null;
}

/**
 * Everything one system's popup shows, in one round trip.
 *
 * Three things are joined here rather than left to the client:
 *
 * - The constellation and region NAMES. mapGeometry's nodes carry only the ids,
 *   and the names live in mapLabels — which deliberately does not fetch the
 *   31 KB of constellation names below CONSTELLATION_LABEL_ZOOM. At galaxy zoom
 *   the client simply does not have them.
 * - The gate count, from `stargates`. Counting mapGeometry.edges undercounts:
 *   that query requires BOTH ends of an edge to be inside the scope, so a gate
 *   leading out of the scene is absent from the list entirely.
 * - The latest activity snapshot, through a LATERAL so the whole thing stays
 *   one statement. The (system_id, timestamp) index serves the ORDER BY.
 */
export async function getMapSystemDetails(
  systemId: number,
): Promise<MapSystemDetails | null> {
  const key = systemDetailsCacheKey(systemId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapSystemDetails;

  const rows = await prisma.$queryRaw<DetailsRow[]>`
    SELECT
      s.system_id,
      s.name,
      TRUNC(s.security_status::numeric, 2)::DOUBLE PRECISION AS security_status,
      c.name AS constellation_name,
      r.name AS region_name,
      (SELECT COUNT(*) FROM stargates g WHERE g.solar_system_id = s.system_id)
        AS gate_count,
      a.ship_kills,
      a.pod_kills,
      a.npc_kills,
      a.ship_jumps,
      a.timestamp AS snapshot_at
    FROM solar_systems s
    JOIN constellations c ON c.constellation_id = s.constellation_id
    JOIN regions r ON r.region_id = c.region_id
    LEFT JOIN LATERAL (
      SELECT ship_kills, pod_kills, npc_kills, ship_jumps, timestamp
      FROM system_activity
      WHERE system_id = s.system_id
      ORDER BY timestamp DESC
      LIMIT 1
    ) a ON TRUE
    WHERE s.system_id = ${systemId}
  `;

  const row = rows[0];
  // Not cached: a null is indistinguishable from a miss on the way back in,
  // and an id that names no system is not worth a key.
  if (!row) return null;

  const details: MapSystemDetails = {
    systemId: Number(row.system_id),
    name: row.name,
    securityStatus: row.security_status,
    constellationName: row.constellation_name,
    regionName: row.region_name,
    // The one BigInt in the row. Left as it arrives, the JSON.stringify below
    // throws rather than returning a bad value — loud, but still a 500.
    gateCount: Number(row.gate_count),
    shipKills: row.ship_kills,
    podKills: row.pod_kills,
    npcKills: row.npc_kills,
    shipJumps: row.ship_jumps,
    snapshotAt: row.snapshot_at?.toISOString() ?? null,
  };

  await redis.setex(
    key,
    SYSTEM_DETAILS_CACHE_TTL_SECONDS,
    JSON.stringify(details),
  );
  return details;
}
```

- [ ] **Step 5: Test'i koş, geçtiğini gör**

```bash
cd backend && yarn vitest run src/services/universe/map-system.service.spec.ts
```

Beklenen: 9 passed.

- [ ] **Step 6: Servisi dışa aç ve resolver'ı bağla**

`backend/src/services/universe/index.ts` — mevcut satırların altına:

```ts
export * from './map-system.service';
```

`backend/src/resolvers/universe-map/queries.ts` — import listesine `getMapSystemDetails` eklenir ve `universeMapQueries` nesnesinin sonuna:

```ts
  mapSystemDetails: (_, { systemId }) => getMapSystemDetails(systemId),
```

Dönüşüm yok, kind eşlemesi yok: servisin döndürdüğü şekil şemanın tipiyle
birebir aynı, ve `mapGeometry`'nin `scope`'u gibi yeniden damgalanacak bir enum
alanı da yok.

- [ ] **Step 7: Response cache'e kaydet**

`backend/src/config/cache.ts` üç yerde değişiyor.

`CACHE_TTL` içine, `KILLMAIL_LIST`'in altına:

```ts
  /** Hourly ESI snapshots — the map popup's activity numbers */
  LIVE_SYSTEM_DATA: 300_000, // 5 minutes
```

`PUBLIC_CACHE_QUERIES` içindeki harita bloğuna:

```ts
  'MapSystemDetails',
```

`TTL_PER_SCHEMA_COORDINATE` içine:

```ts
  // Not STATIC_GAME_DATA like the rest of the map: this coordinate carries the
  // hourly activity snapshot. Query.solarSystem's 365 days is exactly the bug
  // this query exists to avoid.
  'Query.mapSystemDetails': CACHE_TTL.LIVE_SYSTEM_DATA,
```

- [ ] **Step 8: Backend codegen, sonra frontend dökümanı, sonra frontend codegen**

```bash
cd backend && yarn codegen && yarn build
```

Beklenen: ikisi de hatasız; `build` `tsc --noEmit` ve resolver'ın şemayla
uyuştuğunu orada doğruluyor.

`frontend/src/graphql/MapSystemDetails.graphql` oluştur:

```graphql
# Operasyon adı MapSystemDetails olmak zorunda: backend'in response cache'i
# PUBLIC_CACHE_QUERIES'e operasyon adıyla bakıyor (backend/src/config/cache.ts).
# Adı değiştirmek önbelleği token başına 120 s'ye düşürür.
query MapSystemDetails($systemId: Int!) {
  mapSystemDetails(systemId: $systemId) {
    systemId
    name
    securityStatus
    constellationName
    regionName
    gateCount
    shipKills
    podKills
    npcKills
    shipJumps
    snapshotAt
  }
}
```

```bash
cd frontend && yarn codegen && npx tsc --noEmit
```

- [ ] **Step 9: Canlı doğrulama**

Backend `:4010`'da koşuyorken:

```bash
curl -s -X POST http://localhost:4010/graphql -H 'content-type: application/json' \
  -d '{"query":"query MapSystemDetails($systemId: Int!) { mapSystemDetails(systemId: $systemId) { name securityStatus constellationName regionName gateCount shipKills podKills npcKills shipJumps snapshotAt } }","variables":{"systemId":30000142}}' \
  | python3 -m json.tool
```

Beklenen: `Jita`, `0.94`, `Kimotoro`, `The Forge`, `gateCount: 7`, dört sayı dolu.

Satırı olmayan sistemi de doğrula (`systemId: 31000001`): `gateCount: 0` ve dört
alan `null`.

- [ ] **Step 10: Commit**

```bash
cd /Users/umut/Sites/killreport
git add backend/src/schemas/UniverseMap.graphql \
  backend/src/services/universe/map-system.service.ts \
  backend/src/services/universe/map-system.service.spec.ts \
  backend/src/services/universe/index.ts \
  backend/src/resolvers/universe-map/queries.ts \
  backend/src/config/cache.ts \
  backend/src/generated-types.ts backend/src/generated-schema.graphql \
  frontend/src/graphql/MapSystemDetails.graphql frontend/src/generated/graphql.ts
git commit -m "feat(graphql): read one system's map popup in a single query"
```

---

## Task 3: `useMapPointer` — hover ve tıklama

**Files:**

- Modify: `frontend/src/components/UniverseMap/useMapPointer.ts`
- Modify: `frontend/src/components/UniverseMap/useMapPointer.spec.ts`

**Interfaces:**

- Consumes: mevcut `useMapPointer(canvas, camera, limits, onCameraChange)`
- Produces:
  - `export const CLICK_MOVE_TOLERANCE_PX = 4`
  - `export interface PointerPosition { x: number; y: number }`
  - `useMapPointer(canvas, camera, limits, onCameraChange, pick?: { onHover: (at: PointerPosition | null) => void; onSelect: (at: PointerPosition) => void })`

Hook **picking yapmıyor**, yalnız olayı bildiriyor: konumlar tuvale göre
(`clientX - rect.left`). Hangi sistemin altta olduğunu `UniverseMap` saf
fonksiyonla buluyor, böylece hook geometriden habersiz kalıyor.

`pick` isteğe bağlı: mevcut testlerin dördü hook'u dört argümanla çağırıyor ve
öyle çağırmaya devam edecek.

- [ ] **Step 1: Failing testleri yaz**

`frontend/src/components/UniverseMap/useMapPointer.spec.ts` dosyasının sonuna,
mevcut `describe('useMapPointer', ...)` bloğunun İÇİNE:

```ts
describe('hover and click', () => {
  let onHover: ReturnType<typeof vi.fn>;
  let onSelect: ReturnType<typeof vi.fn>;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    onHover = vi.fn();
    onSelect = vi.fn();
    frames = [];
    // Deterministic rAF: the hook coalesces moves into one frame, and a real
    // rAF would make "how many times was onHover called" depend on timing.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  function flushFrame() {
    const pending = frames;
    frames = [];
    for (const cb of pending) cb(0);
  }

  function mount() {
    return renderHook(() =>
      useMapPointer(canvas, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange, {
        onHover,
        onSelect,
      }),
    );
  }

  it('reports the pointer once per frame, not once per move', () => {
    mount();

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointermove', 10, 20));
      canvas.dispatchEvent(pointerEvent('pointermove', 11, 21));
      canvas.dispatchEvent(pointerEvent('pointermove', 12, 22));
    });
    expect(onHover).not.toHaveBeenCalled();

    act(() => flushFrame());
    expect(onHover).toHaveBeenCalledTimes(1);
    // The LAST position, not the first: the frame reports where the pointer
    // ended up.
    expect(onHover).toHaveBeenCalledWith({ x: 12, y: 22 });
  });

  it('clears the hover while dragging', () => {
    mount();

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
    });
    expect(onHover).toHaveBeenCalledWith(null);

    onHover.mockClear();
    act(() => {
      canvas.dispatchEvent(pointerEvent('pointermove', 140, 100));
      flushFrame();
    });
    // A drag pans; it does not light up every system it passes over.
    expect(onHover).not.toHaveBeenCalledWith({ x: 140, y: 100 });
  });

  it('clears the hover when the pointer leaves the canvas', () => {
    mount();
    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerleave', 0, 0));
    });
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('selects when the pointer goes up within the tolerance', () => {
    mount();

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 200, 150));
      canvas.dispatchEvent(pointerEvent('pointermove', 202, 151));
      canvas.dispatchEvent(pointerEvent('pointerup', 202, 151));
    });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith({ x: 202, y: 151 });
  });

  it('does not select after a drag', () => {
    // Without the tolerance every pan would open a popup.
    mount();

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 200, 150));
      canvas.dispatchEvent(pointerEvent('pointermove', 260, 150));
      canvas.dispatchEvent(pointerEvent('pointerup', 260, 150));
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('measures the tolerance from the pointerdown, not from the last move', () => {
    // Ten moves of 1 px are a 10 px drag, not ten clicks.
    mount();

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 200, 150));
      for (let i = 1; i <= 10; i++) {
        canvas.dispatchEvent(pointerEvent('pointermove', 200 + i, 150));
      }
      canvas.dispatchEvent(pointerEvent('pointerup', 210, 150));
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still works when no pick handlers are given', () => {
    // The four-argument call is what the existing tests and any caller that
    // does not care about picking use.
    renderHook(() =>
      useMapPointer(canvas, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange),
    );

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      canvas.dispatchEvent(pointerEvent('pointerup', 10, 10));
      flushFrame();
    });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

Dosyanın başındaki import satırına `afterEach` gerekmiyor; `vi.stubGlobal`
Vitest'in `unstubGlobals` varsayılanıyla test dosyası bitiminde geri alınıyor.
`vitest.config.mts`'te `unstubGlobals` açık değilse `afterEach(() =>
vi.unstubAllGlobals())` ekle — Step 2'de hangisinin geçerli olduğu görülecek.

- [ ] **Step 2: Testleri koş, başarısız olduklarını gör**

```bash
cd frontend && yarn vitest run src/components/UniverseMap/useMapPointer.spec.ts
```

Beklenen: yeni yedi test başarısız (`onHover` hiç çağrılmıyor), mevcut testler
geçiyor.

- [ ] **Step 3: Hook'u genişlet**

`frontend/src/components/UniverseMap/useMapPointer.ts`:

İmzayı ve tipleri ekle:

```ts
/**
 * How far the pointer may travel between down and up and still count as a
 * click. Without it every pan would open a popup, because a drag that starts
 * on the canvas ends with a pointerup on the canvas.
 *
 * Measured from the pointerdown, not from the previous move: ten 1 px moves
 * are a 10 px drag, not ten clicks.
 */
export const CLICK_MOVE_TOLERANCE_PX = 4;

/** Canvas-relative, which is what a hit test in screen space needs. */
export interface PointerPosition {
  x: number;
  y: number;
}

export interface MapPick {
  /** Null means "nothing to hover": the pointer left, or a drag started. */
  onHover: (at: PointerPosition | null) => void;
  onSelect: (at: PointerPosition) => void;
}
```

`useMapPointer`'ın imzasına beşinci parametre:

```ts
export function useMapPointer(
  canvas: SceneCanvas | null,
  camera: MapCamera | null,
  limits: ZoomLimits | null,
  onCameraChange: (next: MapCamera) => void,
  pick?: MapPick,
): void {
```

Mevcut üç ref'in yanına dördüncüsü — aynı gerekçeyle, dinleyiciler tuval başına
bir kez bağlandığı için:

```ts
const pickRef = useRef(pick);
useEffect(() => {
  pickRef.current = pick;
}, [pick]);
```

Bağlama effect'inin içinde, `let dragging = false;` satırlarının yanına:

```ts
let downX = 0;
let downY = 0;
let movedBeyondTolerance = false;
// The pointer's latest canvas-relative position, and the frame that will
// report it. `pointermove` fires dozens of times a second; the hit test is
// cheap but writing React state at that rate is not.
let hoverAt: PointerPosition | null = null;
let hoverFrame: number | null = null;
```

Yardımcılar, `down`'dan önce:

```ts
const canvasPosition = (e: PointerEvent): PointerPosition => {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

const scheduleHover = (at: PointerPosition) => {
  hoverAt = at;
  if (hoverFrame !== null) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = null;
    if (hoverAt) pickRef.current?.onHover(hoverAt);
  });
};

const cancelHover = () => {
  if (hoverFrame !== null) {
    cancelAnimationFrame(hoverFrame);
    hoverFrame = null;
  }
  hoverAt = null;
  pickRef.current?.onHover(null);
};
```

`down`, `up`, `move` ve `pointerleave` şöyle oluyor — mevcut pan aritmetiği
aynen kalıyor:

```ts
const down = (e: PointerEvent) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  downX = e.clientX;
  downY = e.clientY;
  movedBeyondTolerance = false;
  // A press is the start of either a drag or a click, and neither wants a
  // hover tip in the way.
  cancelHover();
};

const up = (e: PointerEvent) => {
  const wasDragging = dragging;
  dragging = false;
  if (wasDragging && !movedBeyondTolerance) {
    pickRef.current?.onSelect(canvasPosition(e));
  }
};

const leave = () => {
  dragging = false;
  cancelHover();
};

const move = (e: PointerEvent) => {
  if (!dragging) {
    scheduleHover(canvasPosition(e));
    return;
  }
  if (
    Math.abs(e.clientX - downX) > CLICK_MOVE_TOLERANCE_PX ||
    Math.abs(e.clientY - downY) > CLICK_MOVE_TOLERANCE_PX
  ) {
    movedBeyondTolerance = true;
  }
  if (!cameraRef.current) return;
  const next = panCamera(
    cameraRef.current,
    e.clientX - lastX,
    e.clientY - lastY,
  );
  lastX = e.clientX;
  lastY = e.clientY;
  cameraRef.current = next;
  onCameraChangeRef.current(next);
};
```

Dinleyici kaydı: `pointerup` artık olayı kullanıyor ve `pointerleave` ayrı bir
handler'a gidiyor. Temizlik fonksiyonuna bekleyen frame'in iptali eklenir:

```ts
canvas.addEventListener('pointerdown', down);
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointerleave', leave);
canvas.addEventListener('pointermove', move);
canvas.addEventListener('wheel', wheel, { passive: false });

return () => {
  if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
  canvas.removeEventListener('pointerdown', down);
  canvas.removeEventListener('pointerup', up);
  canvas.removeEventListener('pointerleave', leave);
  canvas.removeEventListener('pointermove', move);
  canvas.removeEventListener('wheel', wheel);
};
```

- [ ] **Step 4: Testleri koş, geçtiğini gör**

```bash
cd frontend && yarn vitest run src/components/UniverseMap/useMapPointer.spec.ts
```

Beklenen: mevcut testler + yeni yedi test, hepsi geçiyor. `up` artık
`(e: PointerEvent)` aldığı için mevcut "drag freeze" regresyon testinin
`pointerup`'ı da olayla çağrılıyor; `pointerEvent` yardımcısı bunu zaten
sağlıyor.

- [ ] **Step 5: Commit**

```bash
cd /Users/umut/Sites/killreport
git add frontend/src/components/UniverseMap/useMapPointer.ts \
  frontend/src/components/UniverseMap/useMapPointer.spec.ts
git commit -m "feat(map): report hover and click from the map's pointer hook"
```

---

## Task 4: Overlay konumlandırma — `clampOverlay`

**Files:**

- Create: `frontend/src/utils/map/overlay.ts`
- Test: `frontend/src/utils/map/overlay.spec.ts`

**Interfaces:**

- Produces:
  - `interface OverlayBox { left: number; top: number }`
  - `clampOverlay(args: { anchorX: number; anchorY: number; overlayWidth: number; overlayHeight: number; viewportWidth: number; viewportHeight: number; offset: number }): OverlayBox`

Hem hover ipucu hem popup viewport'a kırpılıyor, ve ikisi de aynı kararı
veriyor: çapaya göre sağ-alta aç, sığmıyorsa diğer tarafa çevir. Bir karar, bir
saf fonksiyon, iki tüketici.

- [ ] **Step 1: Failing test'i yaz**

`frontend/src/utils/map/overlay.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { clampOverlay } from './overlay';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };
const SIZE = { overlayWidth: 200, overlayHeight: 100 };

function clamp(anchorX: number, anchorY: number, offset = 12) {
  return clampOverlay({ anchorX, anchorY, ...SIZE, ...VIEWPORT, offset });
}

describe('clampOverlay', () => {
  it('opens down and to the right of the anchor', () => {
    expect(clamp(100, 100)).toEqual({ left: 112, top: 112 });
  });

  it('flips to the left when the right edge would be crossed', () => {
    // 700 + 12 + 200 = 912 > 800, so the overlay goes to the anchor's left.
    expect(clamp(700, 100).left).toBe(700 - 12 - 200);
  });

  it('flips upward when the bottom edge would be crossed', () => {
    expect(clamp(100, 550).top).toBe(550 - 12 - 100);
  });

  it('flips both at once in the bottom-right corner', () => {
    expect(clamp(700, 550)).toEqual({ left: 488, top: 438 });
  });

  it('never goes negative, even when the flip does not fit either', () => {
    // A viewport narrower than the overlay: pinned to 0 rather than off-screen.
    expect(
      clampOverlay({
        anchorX: 10,
        anchorY: 10,
        overlayWidth: 900,
        overlayHeight: 700,
        ...VIEWPORT,
        offset: 12,
      }),
    ).toEqual({ left: 0, top: 0 });
  });
});
```

- [ ] **Step 2: Test'i koş, başarısız olduğunu gör**

```bash
cd frontend && yarn vitest run src/utils/map/overlay.spec.ts
```

Beklenen: `Failed to resolve import "./overlay"`.

- [ ] **Step 3: İmplementasyonu yaz**

`frontend/src/utils/map/overlay.ts`:

```ts
export interface OverlayBox {
  left: number;
  top: number;
}

/**
 * Where a floating overlay goes, given the thing it belongs to.
 *
 * Down and to the right of the anchor by `offset`, flipping to the other side
 * of the anchor on either axis when that edge would be crossed — so a system
 * near the right edge of the canvas opens its popup to the left, and one near
 * the bottom opens upward. The flip is per-axis: a corner flips both.
 *
 * Pinned to zero as a last resort, for a viewport too small to hold the
 * overlay on either side. Off-screen would be worse than overlapping.
 *
 * One function for the hover tip and the popup both: it is the same decision,
 * and it is a decision, so it belongs in the tested layer rather than in two
 * components' style attributes.
 */
export function clampOverlay({
  anchorX,
  anchorY,
  overlayWidth,
  overlayHeight,
  viewportWidth,
  viewportHeight,
  offset,
}: {
  anchorX: number;
  anchorY: number;
  overlayWidth: number;
  overlayHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset: number;
}): OverlayBox {
  let left = anchorX + offset;
  if (left + overlayWidth > viewportWidth) {
    left = anchorX - offset - overlayWidth;
  }

  let top = anchorY + offset;
  if (top + overlayHeight > viewportHeight) {
    top = anchorY - offset - overlayHeight;
  }

  return { left: Math.max(left, 0), top: Math.max(top, 0) };
}
```

- [ ] **Step 4: Test'i koş, geçtiğini gör**

```bash
cd frontend && yarn vitest run src/utils/map/overlay.spec.ts
```

Beklenen: 5 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/umut/Sites/killreport
git add frontend/src/utils/map/overlay.ts frontend/src/utils/map/overlay.spec.ts
git commit -m "feat(map): place a floating overlay inside the viewport"
```

---

## Task 5: `SystemHoverTip` — tek satır

**Files:**

- Create: `frontend/src/components/UniverseMap/SystemHoverTip.tsx`
- Test: `frontend/src/components/UniverseMap/SystemHoverTip.spec.tsx`

**Interfaces:**

- Consumes: `clampOverlay` (Task 4), `formatSecurityStatus` ve `getSecurityColor` (`@/utils/security`)
- Produces: `SystemHoverTip({ name, securityStatus, screenX, screenY, viewportWidth, viewportHeight })`

`SecurityStatus` bileşeni **kullanılmıyor**: o bileşen kendi `Tooltip`'ini
sarıyor, ve imleci takip eden bir ipucunun içinde ikinci bir tooltip olmaz.
Renk ve biçim fonksiyonları doğrudan çağrılıyor — `SecurityStatus`'un kendisi de
onları çağırıyor.

- [ ] **Step 1: Failing test'i yaz**

`frontend/src/components/UniverseMap/SystemHoverTip.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SystemHoverTip from './SystemHoverTip';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };

describe('SystemHoverTip', () => {
  it('shows the name and the security on one line', () => {
    render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        {...VIEWPORT}
      />,
    );

    expect(screen.getByText('Jita')).toBeInTheDocument();
    expect(screen.getByText('0.9')).toBeInTheDocument();
  });

  it('is positioned down and to the right of the dot', () => {
    const { container } = render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        {...VIEWPORT}
      />,
    );

    const tip = container.firstElementChild as HTMLElement;
    expect(tip.style.left).toBe('112px');
    expect(tip.style.top).toBe('112px');
  });

  it('does not take pointer events, so it cannot block a drag', () => {
    const { container } = render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        {...VIEWPORT}
      />,
    );

    expect(container.firstElementChild).toHaveClass('pointer-events-none');
  });

  it('renders a wormhole system whose security is negative', () => {
    render(
      <SystemHoverTip
        name="Sentinel MZ"
        securityStatus={-0.99}
        screenX={10}
        screenY={10}
        {...VIEWPORT}
      />,
    );

    expect(screen.getByText('Sentinel MZ')).toBeInTheDocument();
    expect(screen.getByText('-1.0')).toBeInTheDocument();
  });
});
```

`0.94 → '0.9'` ve `-0.99 → '-1.0'` beklentileri `formatSecurityStatus`'un
davranışıdır; Step 2 bunu doğrulayacak, farklıysa beklenti gerçek çıktıya
göre düzeltilir (fonksiyon değil, test).

- [ ] **Step 2: Test'i koş, başarısız olduğunu gör**

```bash
cd frontend && yarn vitest run src/components/UniverseMap/SystemHoverTip.spec.tsx
```

Beklenen: `Failed to resolve import "./SystemHoverTip"`.

- [ ] **Step 3: Bileşeni yaz**

`frontend/src/components/UniverseMap/SystemHoverTip.tsx`:

```tsx
'use client';

import { clampOverlay } from '@/utils/map/overlay';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';

/** Enough to clear the cursor without drifting away from the dot. */
const TIP_OFFSET_PX = 12;

/**
 * Measured rather than rendered: the tip is one short line, and giving
 * `clampOverlay` a fixed estimate keeps the component from needing a layout
 * pass to know where to be. A long system name overhangs by a few pixels at the
 * right edge; the popup, which is the thing that must never be clipped, is
 * measured for real.
 */
const TIP_WIDTH_PX = 140;
const TIP_HEIGHT_PX = 24;

/**
 * The system under the cursor, in one line.
 *
 * Not `SecurityStatus`: that component wraps its value in a `Tooltip`, and a
 * tooltip inside a tooltip is not a thing. The two functions it formats with
 * are called directly here instead.
 */
export default function SystemHoverTip({
  name,
  securityStatus,
  screenX,
  screenY,
  viewportWidth,
  viewportHeight,
}: {
  name: string;
  securityStatus: number | null;
  screenX: number;
  screenY: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const { left, top } = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: TIP_WIDTH_PX,
    overlayHeight: TIP_HEIGHT_PX,
    viewportWidth,
    viewportHeight,
    offset: TIP_OFFSET_PX,
  });

  return (
    <div
      // pointer-events-none is load-bearing: the tip follows the cursor, so
      // without it every hover would put an element under the pointer and the
      // canvas would stop receiving the moves that placed it there.
      className="absolute z-10 flex items-center px-2 py-1 text-xs float gap-x-2 pointer-events-none"
      style={{ left, top }}
    >
      <span className="text-gray-100">{name}</span>
      <span className={`font-medium ${getSecurityColor(securityStatus)}`}>
        {formatSecurityStatus(securityStatus)}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Test'i koş, geçtiğini gör**

```bash
cd frontend && yarn vitest run src/components/UniverseMap/SystemHoverTip.spec.tsx
```

Beklenen: 4 passed. `toBeInTheDocument`/`toHaveClass` matcher'ları
`@testing-library/jest-dom` üzerinden geliyor; frontend'in vitest setup dosyası
onu zaten yüklüyor (`UniverseMap.spec.tsx` aynı matcher'ları kullanıyor).

- [ ] **Step 5: Commit**

```bash
cd /Users/umut/Sites/killreport
git add frontend/src/components/UniverseMap/SystemHoverTip.tsx \
  frontend/src/components/UniverseMap/SystemHoverTip.spec.tsx
git commit -m "feat(map): name the system under the cursor"
```

---

## Task 6: `SystemPopup` — dört saatlik kutu, Gates, ve çıkış

**Files:**

- Create: `frontend/src/components/UniverseMap/SystemPopup.tsx`
- Test: `frontend/src/components/UniverseMap/SystemPopup.spec.tsx`

**Interfaces:**

- Consumes: `useMapSystemDetailsQuery` (Task 2), `clampOverlay` (Task 4), `formatTimeAgo` (`@/utils/date`), `formatSecurityStatus`/`getSecurityColor` (`@/utils/security`)
- Produces: `SystemPopup({ systemId, screenX, screenY, viewportWidth, viewportHeight, onClose })`

Düzen, spec'teki sırayla: ad + güvenlik / takımyıldız · bölge / dört saatlik
kutu / `last 1 hour · ESI` / Gates kutusu / sistem linki. Zaman satırı dört
kutunun **hemen altında** ve Gates onun altında: metin kısa kalıyor, ne
kapsadığını konumu söylüyor.

- [ ] **Step 1: Failing test'i yaz**

`frontend/src/components/UniverseMap/SystemPopup.spec.tsx`:

```tsx
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MapSystemDetailsDocument } from '@/generated/graphql';
import SystemPopup from './SystemPopup';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };

function detailsMock(
  over: Record<string, unknown> = {},
  systemId = 30000142,
): MockedResponse {
  return {
    request: { query: MapSystemDetailsDocument, variables: { systemId } },
    result: {
      data: {
        mapSystemDetails: {
          __typename: 'MapSystemDetails',
          systemId,
          name: 'Jita',
          securityStatus: 0.94,
          constellationName: 'Kimotoro',
          regionName: 'The Forge',
          gateCount: 7,
          shipKills: 4,
          podKills: 8,
          npcKills: 77,
          shipJumps: 1745,
          snapshotAt: '2026-09-14T09:00:00.000Z',
          ...over,
        },
      },
    },
  };
}

function renderPopup(mocks: MockedResponse[], onClose = vi.fn()) {
  const utils = render(
    <MockedProvider mocks={mocks}>
      <SystemPopup
        systemId={30000142}
        screenX={100}
        screenY={100}
        onClose={onClose}
        {...VIEWPORT}
      />
    </MockedProvider>,
  );
  return { ...utils, onClose };
}

describe('SystemPopup', () => {
  it('shows the header, the four hourly numbers and the gate count', async () => {
    renderPopup([detailsMock()]);

    expect(await screen.findByText('Jita')).toBeInTheDocument();
    expect(screen.getByText('0.9')).toBeInTheDocument();
    expect(screen.getByText('Kimotoro · The Forge')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByText('1,745')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('says what the time line covers by sitting under the four boxes', async () => {
    renderPopup([detailsMock()]);
    expect(await screen.findByText(/last 1 hour · ESI/)).toBeInTheDocument();
  });

  it('shows an em dash for a jump count ESI did not report', async () => {
    // Null is not zero: #208 kept the distinction in the column precisely so
    // this box can say "not reported" rather than "no traffic".
    renderPopup([detailsMock({ shipJumps: null })]);

    await screen.findByText('Jita');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a reported zero as zero', async () => {
    renderPopup([detailsMock({ shipJumps: 0 })]);

    await screen.findByText('Jita');
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('shows four em dashes and no time line when the system has no snapshot', async () => {
    renderPopup([
      detailsMock({
        shipKills: null,
        podKills: null,
        npcKills: null,
        shipJumps: null,
        snapshotAt: null,
      }),
    ]);

    await screen.findByText('Jita');
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText(/last 1 hour/)).not.toBeInTheDocument();
  });

  it('links to the system page', async () => {
    renderPopup([detailsMock()]);

    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/solar-systems/30000142');
  });

  it('closes on Escape', async () => {
    const { onClose } = renderPopup([detailsMock()]);
    await screen.findByText('Jita');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('stops a pointerdown from reaching the canvas', async () => {
    // Without this, a drag that starts on the panel pans the map underneath.
    const { container } = renderPopup([detailsMock()]);
    await screen.findByText('Jita');

    const onCanvasDown = vi.fn();
    container.addEventListener('pointerdown', onCanvasDown);
    const panel = container.firstElementChild as HTMLElement;
    panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(onCanvasDown).not.toHaveBeenCalled();
  });

  it('renders nothing but a frame while the query is in flight', () => {
    const { container } = renderPopup([detailsMock()]);
    // The skeleton is up before the mock resolves.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    );
  });
});
```

- [ ] **Step 2: Test'i koş, başarısız olduğunu gör**

```bash
cd frontend && yarn vitest run src/components/UniverseMap/SystemPopup.spec.tsx
```

Beklenen: `Failed to resolve import "./SystemPopup"`.

- [ ] **Step 3: Bileşeni yaz**

`frontend/src/components/UniverseMap/SystemPopup.tsx`:

```tsx
'use client';

import { useMapSystemDetailsQuery } from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import { clampOverlay } from '@/utils/map/overlay';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';
import Link from 'next/link';
import { useEffect } from 'react';

const POPUP_OFFSET_PX = 14;
const POPUP_WIDTH_PX = 280;
const POPUP_HEIGHT_PX = 230;

/**
 * One hourly number. The page's own stat box is
 * SolarSystemDetail/SystemStatsStrip's `Box`; this is that box at popup scale —
 * p-2 rather than p-4, and a base value rather than text-2xl.
 *
 * A null value is an em dash, not a zero, the way that file's Busiest Hour box
 * already does it: ESI not reporting a system is not the same as reporting no
 * activity, and #208 kept `ship_jumps` nullable so the difference survives to
 * here.
 */
function Box({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="p-2 border bg-white/5 border-white/10">
      <div className="text-[10px] tracking-wide text-gray-400 uppercase">
        {label}
      </div>
      <div className="text-base font-semibold text-gray-100">
        {value === null ? '—' : value.toLocaleString('en-US')}
      </div>
    </div>
  );
}

function SkeletonBox() {
  return (
    <div className="p-2 border bg-white/5 border-white/10">
      <div className="w-12 h-2 bg-white/10 animate-pulse" />
      <div className="w-8 h-4 mt-1 bg-white/10 animate-pulse" />
    </div>
  );
}

/**
 * The selected system, anchored to its dot.
 *
 * An ordinary React component over the canvas rather than anything drawn into
 * it — which is what phase 1-2's design already called for, and the one part of
 * its Popup paragraph that survived the move off deck.gl.
 *
 * Three things it must do, all of them learned the hard way in that design:
 * stop its own pointer events (a drag starting on the panel would otherwise pan
 * the map), stay inside the viewport, and close on Escape.
 */
export default function SystemPopup({
  systemId,
  screenX,
  screenY,
  viewportWidth,
  viewportHeight,
  onClose,
}: {
  systemId: number;
  screenX: number;
  screenY: number;
  viewportWidth: number;
  viewportHeight: number;
  onClose: () => void;
}) {
  const { data, loading, error } = useMapSystemDetailsQuery({
    variables: { systemId },
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { left, top } = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: POPUP_WIDTH_PX,
    overlayHeight: POPUP_HEIGHT_PX,
    viewportWidth,
    viewportHeight,
    offset: POPUP_OFFSET_PX,
  });

  const details = data?.mapSystemDetails;

  return (
    <div
      className="absolute z-20 p-3 float"
      style={{ left, top, width: POPUP_WIDTH_PX }}
      // The listeners that pan and zoom the map are on the canvas, and this
      // panel is its sibling — but the events still bubble to a common
      // ancestor, so they are stopped here.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {loading && !details ? (
        <div className="grid grid-cols-4 gap-2">
          <SkeletonBox />
          <SkeletonBox />
          <SkeletonBox />
          <SkeletonBox />
        </div>
      ) : error || !details ? (
        <div className="text-xs text-gray-400">
          Could not load this system right now.
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-x-3">
            <span className="text-sm font-semibold text-gray-100">
              {details.name}
            </span>
            <span
              className={`text-sm font-medium ${getSecurityColor(details.securityStatus)}`}
            >
              {formatSecurityStatus(details.securityStatus)}
            </span>
          </div>

          <div className="mt-0.5 text-xs text-gray-400">
            {details.constellationName} · {details.regionName}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <Box label="Ship" value={details.shipKills ?? null} />
            <Box label="Pod" value={details.podKills ?? null} />
            <Box label="NPC" value={details.npcKills ?? null} />
            <Box label="Jumps" value={details.shipJumps ?? null} />
          </div>

          {/* Directly under the four boxes it describes, and above Gates, which
              is topology rather than an hourly measurement. The position is
              what scopes the line, so the line itself stays short. */}
          {details.snapshotAt && (
            <div className="mt-1 text-[11px] font-light text-gray-500">
              last 1 hour · ESI · {formatTimeAgo(details.snapshotAt)}
            </div>
          )}

          <div className="grid grid-cols-4 mt-3">
            <Box label="Gates" value={details.gateCount} />
          </div>

          <Link
            href={`/solar-systems/${details.systemId}`}
            className="inline-block mt-3 text-xs text-gray-300 hover:text-white"
          >
            Open the system →
          </Link>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testleri koş, geçtiğini gör**

```bash
cd frontend && yarn vitest run src/components/UniverseMap/SystemPopup.spec.tsx
```

Beklenen: 10 passed. Bir beklenti tutmazsa — özellikle `formatSecurityStatus`'un
çıktısı ya da `formatTimeAgo`'nun metni — **testi** gerçek çıktıya göre düzelt,
fonksiyonu değil: ikisi de deponun her yerinde kullanılan yerleşik davranış.

- [ ] **Step 5: Commit**

```bash
cd /Users/umut/Sites/killreport
git add frontend/src/components/UniverseMap/SystemPopup.tsx \
  frontend/src/components/UniverseMap/SystemPopup.spec.tsx
git commit -m "feat(map): open a system's hourly activity in a popup"
```

---

## Task 7: `UniverseMap`'e bağlama

**Files:**

- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:**

- Consumes: Task 1'in `pickSystem`/`PickTarget`, Task 3'ün `MapPick`/`PointerPosition`, Task 5'in `SystemHoverTip`, Task 6'nın `SystemPopup`
- Produces: kullanıcıya görünen davranış; başka task bundan bir şey tüketmiyor

`selected` **yalnız `systemId`** olarak tutuluyor, `PickTarget` olarak değil:
popup kamerayı takip ediyor, yani konumu her render'da yeniden hesaplanmalı.
Donmuş bir `screenX` panlerken popup'ı noktasından koparırdı. `hovered` ise
`PickTarget` olarak tutuluyor — ipucu imleçle birlikte zaten yenileniyor.

- [ ] **Step 1: Failing test'i yaz**

`frontend/src/components/UniverseMap/UniverseMap.spec.tsx`'in mevcut yapısını
oku; Pixi mock'u ve `useMapGeometryQuery` mock'u orada kurulu. Dosyanın sonuna,
mevcut en dış `describe`'ın içine:

```tsx
it('clears the selection when the pointer picks nothing', () => {
  // The behaviour, not the internals: clicking empty space closes the popup.
  // Driven through the same pick callbacks UniverseMap hands the hook, so
  // this test needs no WebGL — which is the point, since jsdom has none.
  expect(true).toBe(true);
});
```

> Bu satır **kasıtlı bir yer tutucu değil**: `UniverseMap.spec.tsx`'in Pixi
> mock'unun hover/click callback'lerine erişim verip vermediği dosyayı okumadan
> bilinemiyor. Step 2'de dosya okunacak ve test **ya** gerçek bir assertion'a
> dönüştürülecek **ya da** hiç yazılmayacak. Yazılmaması da bir sonuç: WebGL
> jsdom'da koşmuyor ve bu dilimin görsel doğrulaması kullanıcıya ait; `pickSystem`,
> `clampOverlay`, hook ve iki bileşen zaten kendi spec'leriyle kaplı, ve bu
> task'ın eklediği tek şey onları birbirine bağlayan atamalar.

- [ ] **Step 2: Mevcut spec'i oku ve kararı ver**

```bash
cd frontend && sed -n '1,80p' src/components/UniverseMap/UniverseMap.spec.tsx
```

Pixi mock'u `useMapPointer`'ı gerçek hâliyle mi koşuyor, yoksa onu da mock'luyor
mu? Gerçek hâliyle koşuyorsa yukarıdaki test `canvas.dispatchEvent` ile sürülebilir
ve yazılır; `useMapPointer` mock'lanmışsa placeholder **silinir** ve bu task
test eklemez.

- [ ] **Step 3: `UniverseMap.tsx`'e state ve callback'leri ekle**

Import'lara:

```tsx
import { pickSystem, type PickTarget } from '@/utils/map/pick';
import SystemHoverTip from './SystemHoverTip';
import SystemPopup from './SystemPopup';
import { useMapPointer, type MapPick, type SceneCanvas } from './useMapPointer';
```

`cameraScale` ref'inin altına:

```tsx
// The hovered system is held as a full PickTarget: the tip follows the
// cursor, so its position is refreshed by the next hover anyway.
const [hovered, setHovered] = useState<PickTarget | null>(null);
// The selected one is held as an ID only. The popup is anchored to its dot
// and follows the camera, so its screen position has to be recomputed every
// render — a frozen screenX would tear the popup off its system on the first
// pan.
const [selected, setSelected] = useState<number | null>(null);
```

`labelSystems`'in altına, picking'in girdisi (aynı gerekçeyle memoised — yoksa
her render 5.241 düğümü yeniden eşler):

```tsx
// What pickSystem needs, which is what labelSystems needs plus the radius and
// the security. One array rather than two: the label pass is a different
// shape only because it predates picking.
const pickNodes = useMemo(
  () =>
    (geometry?.nodes ?? []).map((node) => ({
      systemId: node.systemId,
      name: node.name,
      x: node.x,
      z: node.z,
      radius: node.radius,
      securityStatus: node.securityStatus,
    })),
  [geometry],
);
```

`useMapPointer` çağrısının hemen üstüne:

```tsx
// Rebuilt whenever the camera or the viewport moves, which is correct: the
// projection they close over has changed. useMapPointer holds them in a ref,
// so a new identity does not rebind the five listeners.
const pick = useMemo<MapPick>(
  () => ({
    onHover: (at) => {
      if (!at || !camera || !size.width) {
        setHovered(null);
        return;
      }
      setHovered(
        pickSystem({
          nodes: pickNodes,
          transform: cameraTransform(camera, size.width, size.height),
          pointerX: at.x,
          pointerY: at.y,
          cameraScale: cameraScale.current,
        }),
      );
    },
    onSelect: (at) => {
      if (!camera || !size.width) return;
      const target = pickSystem({
        nodes: pickNodes,
        transform: cameraTransform(camera, size.width, size.height),
        pointerX: at.x,
        pointerY: at.y,
        cameraScale: cameraScale.current,
      });
      // Clicking empty space closes the popup.
      setSelected(target ? target.node.systemId : null);
    },
  }),
  [camera, size.width, size.height, pickNodes],
);

useMapPointer(canvas, camera, limits, onCameraChange, pick);
```

`limits` satırı zaten `useMapPointer`'ın üstünde; sırayı bozma.

Tuvalin imleci, hover'ın tek görsel geri bildirimi olarak:

```tsx
// The only thing this slice writes to the canvas element itself. Not a Pixi
// object and not a scene concern, so it stays here.
useEffect(() => {
  if (!canvas) return;
  canvas.style.cursor = hovered ? 'pointer' : 'default';
}, [canvas, hovered]);
```

- [ ] **Step 4: Overlay'leri render et**

Dosyanın sonundaki `return`'ü değiştir:

```tsx
const selectedNode = selected
  ? (geometry?.nodes.find((node) => node.systemId === selected) ?? null)
  : null;
const transform =
  camera && size.width
    ? cameraTransform(camera, size.width, size.height)
    : null;

return (
  <div ref={attachHost} className="relative w-full h-full bg-ground">
    {hovered && hovered.node.systemId !== selected && (
      <SystemHoverTip
        name={hovered.node.name}
        securityStatus={hovered.node.securityStatus}
        screenX={hovered.screenX}
        screenY={hovered.screenY}
        viewportWidth={size.width}
        viewportHeight={size.height}
      />
    )}

    {selectedNode && transform && (
      <SystemPopup
        systemId={selectedNode.systemId}
        screenX={selectedNode.x * transform.scaleX + transform.x}
        screenY={selectedNode.z * transform.scaleY + transform.y}
        viewportWidth={size.width}
        viewportHeight={size.height}
        onClose={() => setSelected(null)}
      />
    )}
  </div>
);
```

İki ayrıntı:

- Seçili sistemin üstünde ipucu gösterilmiyor (`hovered.node.systemId !==
selected`): popup zaten aynı adı daha büyük yazıyor.
- Popup'ın konumu `selectedNode`'dan her render'da yeniden izdüşürülüyor. Aynı
  çarp-toplam, aynı negatif `scaleY`.

- [ ] **Step 5: Tüm frontend testlerini koş**

```bash
cd frontend && yarn test
```

Beklenen: hepsi geçiyor. `UniverseMap.spec.tsx`'in mevcut testleri yeni
`return`'den etkilenmemeli — kök `div` hâlâ `attachHost`'u taşıyor ve overlay'ler
`hovered`/`selected` null olduğu için hiç render edilmiyor.

- [ ] **Step 6: Commit**

```bash
cd /Users/umut/Sites/killreport
git add frontend/src/components/UniverseMap/UniverseMap.tsx \
  frontend/src/components/UniverseMap/UniverseMap.spec.tsx
git commit -m "feat(map): select a system on the map and show its activity"
```

---

## Task 8: Tam doğrulama, plan ve PR

**Files:**

- Create: `docs/superpowers/plans/2026-09-14-universe-map-picking.md` (bu dosya — Task 1'den önce commit edilmiş olmalı)
- Modify: `docs/superpowers/specs/2026-09-12-universe-map-design.md` (faz tablosunda 3a'yı bitti işaretle)

- [ ] **Step 1: Tüm doğrulama setini koş**

```bash
cd /Users/umut/Sites/killreport
yarn test
yarn workspace backend build
yarn workspace backend codegen
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
npx prettier --check .
```

`lint` **228 problems (144 errors, 84 warnings)** vermeli — `main` ile sıfır
fark. Fark varsa, farkı yaratan girdilerin bu dalın dokunduğu dosyaları
adlandırıp adlandırmadığına bak.

`codegen` sonrası `git status` temiz olmalı: üretilmiş dosyalar Task 2'de
commit edildi ve yeniden üretim onları değiştirmemeli.

- [ ] **Step 2: Canlı veri doğrulaması**

```bash
curl -s -X POST http://localhost:4010/graphql -H 'content-type: application/json' \
  -d '{"query":"query MapSystemDetails($systemId: Int!) { mapSystemDetails(systemId: $systemId) { name securityStatus constellationName regionName gateCount shipKills podKills npcKills shipJumps snapshotAt } }","variables":{"systemId":30000142}}' \
  | python3 -m json.tool
```

Beklenen: `Jita`, `0.94`, `Kimotoro`, `The Forge`, `gateCount: 7`.
`extensions.responseCache.ttl` **300000** olmalı — 365 gün değil. Değilse Task
2 Step 7 eksik uygulandı.

- [ ] **Step 3: Faz tablosunu güncelle**

`docs/superpowers/specs/2026-09-12-universe-map-design.md` içindeki "Faz 3 üçe
bölündü" tablosunda `3a` satırının sonuna durumunu ekle ve ana faz tablosundaki
faz 3 satırını "3a bitti, 3b ve 3c başlanmadı" olarak düzelt. Faz 3'ün tamamını
bitti işaretleme.

- [ ] **Step 4: Commit ve PR**

```bash
cd /Users/umut/Sites/killreport
git add docs/superpowers/specs/2026-09-12-universe-map-design.md
git commit -m "docs(superpowers): record phase 3a as shipped"
git push -u origin feat/universe-map-picking
```

PR etiketleri: `feat`, `frontend`, `backend`, `graphql`, `cache`.

PR açıklamasında yer alması gerekenler: hit test'in neden Pixi'nin event
sistemi olmadığı; `mapSystemDetails`'in neden `solarSystem(id)` yerine ayrı bir
sorgu olduğu (365 günlük koordinat); null ile sıfırın popup'ta neden farklı
göründüğü; ve **görsel doğrulamanın kullanıcıya ait olduğu** — 6 px'lik
tıklama yarıçapı ve popup'ın kırpma davranışı ekrana bakılarak ayarlanacak.

---

## Self-review notları

**Spec kapsaması.** Spec'in her bölümü bir task'a düşüyor: hit test → Task 1;
tıklanabilir yarıçap → Task 1; etkileşim kuralları (rAF, drag, eşik, boşluk,
Escape, stopPropagation) → Task 3 ve Task 6; popup düzeni ve görsel dil → Task
6; sıfır/boş durumlar → Task 2 (veri) ve Task 6 (gösterim); çapalı konum → Task
4 ve Task 7; `mapSystemDetails` → Task 2; mimari sınır → her task'ın dosya
listesi, `scene/`'e dokunan yok; test ve doğrulama → Task 8.

**Spec'te olup planda kasıtlı olmayan:** hiçbiri.

**Planda olup spec'te olmayan iki şey**, ikisi de küçük ve gerekçesi yazılı:
`clampOverlay`'in ayrı bir saf fonksiyon olması (spec "viewport'a kırpılıyor"
diyor, kararın nereye ait olduğunu söylemiyor — kural gereği saf katmana
gidiyor), ve tuvalin `cursor: pointer` olması (hover'ın ikinci geri bildirimi,
tek satır).

**Tip tutarlılığı.** `PickNode` Task 1'de tanımlanıyor ve Task 7'de
`pickNodes`'un ürettiği nesne birebir o alanları taşıyor.
`MapPick`/`PointerPosition` Task 3'te tanımlanıyor, Task 7'de tüketiliyor.
`clampOverlay`'in argüman adları Task 4'te sabitleniyor, Task 5 ve 6 aynı
adlarla çağırıyor. `MapSystemDetails`'in alan adları Task 2'nin şemasında ve
servisinde aynı, Task 6 generated hook üzerinden aynı adları okuyor.

**Bilerek bırakılan iki belirsizlik**, ikisi de dosyayı okumadan
çözülemeyeceği için ve ikisinin de çözümü adım içinde yazılı: Task 3 Step 1'in
`unstubGlobals` notu, ve Task 7 Step 2'nin `UniverseMap.spec.tsx` kararı.
