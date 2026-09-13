# Sürekli evren haritası, Faz 2 — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Noktayı diske dönüştürmek. Eşikten sonra odaklanılan sistemin içi
akıyor — yıldız, gezegenler, istasyonlar, geçitler, sonra aylar ve asteroit
kuşakları — ve gate hatlarının yüklü uçları merkez yerine **gerçek
stargate'in** konumuna oturuyor.

**Architecture:** Faz 1'in iskeleti duruyor; bu faz ona üç şey ekliyor. Backend
tarafında ikinci bir okuma servisi: `mapCelestials`, **sistem başına** Redis
anahtarı ve `mget` ile, çünkü panning'in akıcılığı istek başına anahtarla
mümkün değil. Frontend tarafında zoom'dan **ayrık bir LOD kovası** türetiliyor
ve kayan orijin sahne merkezinden **odaklı sistemin merkezine** geçiyor — bu
fazın tek sert gereksinimi, çünkü sahne merkezi en dipte 299 px titreme demek.
Üçüncüsü katman yığınına iki katman ekliyor ve gate uçlarını yeniden çapalıyor.

**Tech Stack:** Faz 1'in aynısı — TypeScript, GraphQL Yoga, Prisma `$queryRaw`
(`@services/prisma`), Redis, Next.js App Router + React 19, deck.gl 9.4,
Vitest 5. **Yeni bağımlılık yok.**

**Spec:** [`../specs/2026-09-12-universe-map-design.md`](../specs/2026-09-12-universe-map-design.md)

**Önkoşul:** Faz 1 (#202) `main`'e merge olmuş olmalı. Bu fazın dalı ondan
sonra `main`'den açılıyor; açık bir PR'ın üstüne yığmak, squash-merge sonrası
tekrarlanan geçmiş bırakır.

---

## Global Constraints

Faz 1'in kısıtlarının tamamı geçerli. Değişmeyenler kısaca, değişenler açıkça:

- **Yarn, asla npm.** **Migration yok** — `prisma migrate dev` beş tabloyu
  düşürür. **Üretilmiş dosyalar elle düzenlenmez**; bu faz `.graphql`
  değiştirdiği için **codegen gerekiyor**, sırası sabit: backend → frontend.
- **`.env`'e dokunulmaz.** Backend portu sabit değil; `backend/.env`'deki
  `PORT`'tan türetilir (bu checkout'ta 4010).
- **API `@services/prisma`** (5 bağlantı), asla `prisma-worker`.
- **Ham SQL'de eşlenmiş kolon adları**: `solar_systems.system_id`,
  `planets.planet_id`, `moons.moon_id`, `asteroid_belts.asteroid_belt_id`,
  `stations.station_id`, `stargates.stargate_id`. Çıplak `id` patlar.
- **`numeric` dönen her ifade `::DOUBLE PRECISION` ile geri çevrilir**, yoksa
  Prisma `Prisma.Decimal` döndürür ve GraphQL `Float!` alanına nesne gider.
- **Resolver yalnızca orkestrasyon.** Sorgu ve önbellek servis katmanında.
- **TypeScript ve TSX yorumları İngilizce**, `Phase 2` (asla `Faz 2`). GraphQL
  şema açıklamaları komşuları gibi Türkçe.
- **Commit ve PR metinleri İngilizce**, `type(scope):` sonrası küçük harf,
  **Claude atfı yok**.
- **`npx prettier --check`** her dokunulan dosyada. `lint` kabul kriteri
  `main`'in sayısı, **sıfır fark**.
- **Frontend'de `build` yerine `typecheck` + `test`**; gerçek build gerekirse
  `build:check`.
- **Görsel doğrulama kullanıcıda.** Tarayıcı sürülmüyor.

Faz 2'ye özel iki sert kural:

- **Celestial koordinatları yuvarlanmıyor.** Düğümler 1e9 m ızgarasında,
  celestial'lar ham. Sebep ölçülü: en iç gezegenin yörüngesi 2,41e10 m, yani
  1e9'luk ızgara onu %4 kaydırırdı.
- **GPU'ya giden hiçbir dizi sahne merkezine göre değil.** Eşiğin üstünde
  orijin odaklı sistemin merkezi; aşağıdaki tablo neden zorunlu olduğunu
  gösteriyor.

### Ölçülmüş sabitler (2026-09-13, üretim veritabanı)

Hepsi bu plan yazılırken `psql` ile yeniden ölçüldü. Spec'in sayılarıyla
birebir uyuştular; iki tanesi spec'te yoktu.

| Büyüklük                                   | Değer                                                |
| ------------------------------------------ | ---------------------------------------------------- |
| Celestial / sistem                         | medyan **59**, p95 **103**, maks **159**             |
| **16 sistemlik sert sınırın en kötü hâli** | **2.329 nesne** (spec'te yoktu)                      |
| Gezegen yörüngesi (x/z)                    | min 2,4145e10 m, medyan 3,6018e11 m                  |
| Ay → gezegen (x/z)                         | p05 1,0943e8 m, medyan 9,5389e8 m                    |
| Sistem yarıçapı                            | medyan 3,8809e12 m, maks 3,0384e13 m                 |
| Gate komşusu / sistem                      | maks **8**, ortalama 2,65, p95 5                     |
| **(sistem, hedef) çifti**                  | 13.978, **sıfır belirsiz**, aynı hedefe maks 1 geçit |
| Konumsuz stargate                          | 0                                                    |
| `star_id`'si olmayan sistem                | 401 — tam olarak celestial'ı olmayan küme            |

İki ölçüm bu fazın iki tasarım kararını doğrudan taşıyor:

- **(sistem, hedef) eşlemesi gerçekten birebir.** 13.978 çiftin hiçbirinde bir
  sistemin aynı komşuya iki geçidi yok. Gate ucunu "komşuya giden geçit"e
  çapalamak bu yüzden belirsiz değil; olmasa hangi geçide oturacağını seçmek
  gerekirdi.
- **Gate komşusu maks 8**, yani odak + komşuları en fazla 9 sistem. 16'lık sert
  sınır bunun iki katı ve en kötü hâlde 2.329 nesne — tek `ScatterplotLayer`
  için önemsiz.

### float32 bütçesi: orijin neden taşınmak zorunda

`piksel = metre × 2^zoom`. En dipte (`z₀+22,8`) 1 px = 9,54e7 m.

| Orijin                                   | En büyük yerel koordinat | float32 adımı |     En dipte |
| ---------------------------------------- | -----------------------: | ------------: | -----------: |
| Sahne merkezi (Faz 1)                    |              4,7866e17 m |    2,853e10 m |   **299 px** |
| Odaklı sistemin merkezi, en büyük sistem |              3,0384e13 m |     1,811e6 m | **0,019 px** |
| Odaklı sistemin merkezi, medyan sistem   |              3,8809e12 m |     2,313e5 m |    0,0024 px |

299 px, haritanın çalışmadığı anlamına gelir. Bu tablo Faz 2'nin neden orijini
taşımak zorunda olduğunun tamamı.

---

## Spec'in sessiz kaldığı yerler ve verdiğim kararlar

Spec Faz 2'nin **ne** olduğunu söylüyor, beş yerde **nasıl**'ını söylemiyor.
Kararları burada, gerekçeleriyle veriyorum; uygulama #202 merge olmadan
başlamıyor, yani itiraz etmek için zaman var.

**1. Orijin eşikte geçiyor, her pan'da değil.** Spec "orijin kameranın
odaklandığı sistemin merkezi" diyor, ama ne zaman geçtiğini söylemiyor. Her
pan'da en yakın sisteme geçmek 5.241 nokta + 6.959 hattın GPU
attribute'larını sürekli yeniden kurmak demek. Karar: **LOD kovası `interior`
veya `fine` ise orijin odaklı sistemin merkezi, değilse sahne merkezi.** Eşiğin
üstünde ekranda pratikte tek sistem olduğu için orijin orada kendiliğinden
kararlı, ve galaksi zoomunda sahne merkezi zaten 2,7e-5 px veriyor. Tek geçiş
noktası, spec'in kendi eşiği.

**2. "Odak" = kamera hedefine en yakın sistemin merkezi.** Spec "odaklanılan
sistem" diyor, tanımını vermiyor. Alternatif viewport'un ortasındaki sistemi
picking ile bulmaktı; gereksiz — `nodes` dizisi elimizde ve en yakını bulmak
5.241 elemanlık tek bir tarama, LOD kovası değiştiğinde ve kamera eşiğin
üstünde hareket ettiğinde yeniden hesaplanıyor.

**3. Yarı çapalanmış hat kasıtlı.** Bir hattın yalnızca yüklü ucu gerçek
stargate'e kayıyor, öteki uç komşunun merkezinde kalıyor. Spec bunu ima ediyor
("hattın **bu** uçtaki düğümü") ama sonucunu yazmıyor: eşiğin üstünde odağın
komşuları da çekildiği için pratikte iki uç da çapalanmış oluyor; çekilmemiş
bir komşuya giden hat merkeze gidiyor ve bu doğru davranış — bilmediğimiz bir
geçidin yerini uydurmaktan iyidir.

**4. Aylar ve kuşaklar ayrı katman.** Spec'in katman yığını onları ayrı satırda
listeliyor ve `z ≥ z₀+22,8` diyor. Aynı katmanı filtrelemek yerine ayrı
tutuyorum: `fine` kovasına girmeden `data` dizisi hiç kurulmuyor, yani 235.843
ayın hiçbiri o kovanın altında belleğe bile girmiyor.

**5. Etiketler bu fazda yok — ve spec'te hiçbir faza ait değil.** Ladder'da
`z₀+4…+9` sistem etiketleri ve `z₀+16,5` gezegen etiketleri var, katman
yığınında `TextLayer` + `CollisionFilterExtension` var, ama Fazlar tablosunun
hiçbir satırı onları sahiplenmiyor. Bu bir spec boşluğu. **Kararım: etiketler
Faz 2'ye girmiyor**, çünkü spec'in kendi risk listesinde "tek gerçek performans
kalemi" onlar ve kendi ölçümünü hak ediyorlar; Faz 2'yi şişirmek yerine kendi
dilimi olsun. Spec'in Fazlar tablosuna eklenmesi gereken bir satır — bunu sana
ayrıca soruyorum.

**6. `mapCelestials` mevcut DataLoader'ları çoğaltıyor, ve bu bilinçli.** Depoda
bu altı tabloyu okuyan altı DataLoader zaten var
(`planetsBySystem`, `moonsByPlanet`, `stargatesBySystem`, `stationsBySystem`,
`asteroidBeltsByPlanet`, `starBySystem`) ve `SolarSystem`/`Planet` üzerinde
alan resolver'ları. Mevcut yolu kullanmamanın üç ölçülebilir sebebi var:

- **Şekil.** Harita tek bir düz dizi istiyor, `kind` ayırıcısıyla, çünkü hepsi
  tek `ScatterplotLayer`'a gidiyor. Mevcut yol iç içe bir ağaç veriyor.
- **Tur sayısı.** Aylar `moonsByPlanet` ile geliyor, yani gezegen anahtarlı —
  bir sistemin aylarını mevcut yoldan almak önce gezegenleri çekmeyi
  gerektiriyor, sistem başına iki tur.
- **Önbellek.** DataLoader'lar istek başına; Redis katmanı yok. Panning'in
  akıcılığı **sistem başına** kalıcı bir anahtara bağlı, ki bu bu fazın asıl
  mekanizması.

Mevcut yol solar system detay sayfasının; dokunulmuyor. İki okuma yolu aynı
tabloları farklı şekilde ve farklı önbellekle okuyor, ikisi de servis
katmanında.

**7. Eşikler mutlak zoom, fit'e göre değil — spec bu plan yazılırken düzeltildi.**
Her eşiğin fiziksel tanımı mutlak ("medyan sistem çapı 100 px"), ama `z₀` tuvalin
genişliğine göre değişiyor. Spec'in ilk merdiveni (`z₀+13,1 / +16,5 / +20,4 /
+22,8`) 2560 × 1440'a oturuyordu; 1400 × 900'de aynı fiziksel eşikler 0,7 seviye
kayıyor ve sistem içleri diskler 100 px değil ~59 px'ken akmaya başlıyordu. Spec
artık mutlak yazıyor:

| Eşik                                | Mutlak zoom | Dayanak                                 |
| ----------------------------------- | ----------: | --------------------------------------- |
| diskler büyümeye başlıyor           |         −40 | —                                       |
| **sistem içi akar**                 |  **−36,18** | medyan sistem çapı 7,7618e12 m → 100 px |
| gezegen etiketleri (bu fazda değil) |      −32,75 | medyan yörünge 3,6018e11 m → 50 px      |
| en iç yörünge okunur                |      −28,85 | min yörünge 2,4145e10 m → 50 px         |
| **aylar + kuşaklar**                |  **−26,51** | medyan ay ayrımı 9,5389e8 m → 10 px     |

Bunun Faz 1'e dokunan bir sonucu var: `camera.ts`'teki `ZOOM_ABOVE_FIT = 13`
mutlak eşikle aynı dili konuşmuyor. Tesadüfen iki ekranda da −36,18'in altında
kalıyor (1400×900'de −37,04, 2560×1440'ta −36,36), yani Faz 1 doğru çalışıyor
ama gerekçesi yanlış. Task 3 onu mutlak tavanla değiştiriyor.

**8. Tavan ince eşiğin iki seviye üstünde, tam üstünde değil.** Spec −26,51'i "en
dip" diye adlandırıyor, ama o sayı ayların **ayrışmaya başladığı** yer: 10 px. Tavanı
oraya koymak, aylara ancak maksimum zoom'da ve ancak 10 px'lik ayrımla bakılabilir
demek. `MAX_ZOOM = −24,51` (ince eşik + 2) medyan ay ayrımını 40 px'e çıkarıyor ve
float32 bütçesi hâlâ rahat: orada 1 px = 2,39e7 m, en büyük sistemin kenarında
float32 adımı 1,81e6 m, yani **0,076 px**.

**9. Celestial'lar işaret, ölçekli gövde değil.** Bunu dünya birimi yarıçaplarla
yazmaya çalışıp hesap tutmadı, o yüzden kayda geçiyor. Ölçülen mesafelerden
türetilen bir dünya yarıçapı (gezegen = medyan yörüngenin %5'i = 1,8e10 m)
sistem içi eşiğinde 0,23 px veriyor — yani görünmez — ve tavanda **753 px**,
yıldız ise **1507 px**. Aradaki hiçbir tek değer iki uçta da makul değil.

Sebep basit: gerçek bir gezegenin yarıçapı ~1e7 m, bu zoom'ların hiçbirinde bir
pikseli bulmuyor. Yani "ölçekli gövde" diye bir seçenek hiç yoktu; ölçeği
**geometri** taşıyor (yörünge yarıçapları gerçek), işaretler ise türü taşıyor.

Karar: `radiusUnits: 'pixels'`, tür başına sabit bir hiyerarşi — yıldız 7,
gezegen 4,5, istasyon ve geçit 3, ay 2, kuşak 1,5 px. Hiçbiri ötekini
bastırmıyor ve zoom'la büyümüyorlar, ki bir harita işareti için doğrusu bu.

---

## Dosya yapısı

| Dosya                                                             | Sorumluluk                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `backend/src/services/universe/map-celestials.service.ts`         | `getMapCelestials(systemIds)` — `mget`, eksikleri sorgula, sistem başına `setex` |
| `backend/src/services/universe/map-celestials.service.spec.ts`    | Önbellek isabeti/ıskası, 16 sınırı, null koruması, kind eşlemesi                 |
| `backend/src/services/universe/index.ts`                          | Barrel'a ekleme (değişiklik)                                                     |
| `backend/src/schemas/UniverseMap.graphql`                         | `MapCelestialKind`, `MapCelestial`, `Query.mapCelestials` (değişiklik)           |
| `backend/src/resolvers/universe-map/queries.ts`                   | Tek satırlık orkestrasyon daha (değişiklik)                                      |
| `backend/src/config/cache.ts`                                     | `'MapCelestials'` + `Query.mapCelestials` TTL (değişiklik)                       |
| `frontend/src/graphql/MapCelestials.graphql`                      | Tek sorgu dokümanı                                                               |
| `frontend/src/utils/map/lod.ts` + `.spec.ts`                      | zoom + fit → ayrık LOD kovası, ve eşik sabitleri                                 |
| `frontend/src/utils/map/origin.ts` + `.spec.ts`                   | `nearestNode`, `originFor` (değişiklik)                                          |
| `frontend/src/components/UniverseMap/useMapCelestials.ts`         | odak + komşuları → `mapCelestials`, 16 sınırı                                    |
| `frontend/src/components/UniverseMap/layers/celestials.ts` + spec | iç katman ve ince katman prop'ları                                               |
| `frontend/src/components/UniverseMap/layers/edges.ts` + spec      | gate uçlarının çapalanması (değişiklik)                                          |
| `frontend/src/components/UniverseMap/UniverseMap.tsx` + spec      | tavan +22,8, orijin geçişi, katman yığını (değişiklik)                           |

---

## Task 1: `mapCelestials` servisi

Deponun altıncı okuma servisi, ve Faz 1'in beşincisiyle aynı sade
`async function` biçiminde. Tek farkı önbellek şekli: **sistem başına** anahtar.

**Files:**

- Create: `backend/src/services/universe/map-celestials.service.ts`
- Create: `backend/src/services/universe/map-celestials.service.spec.ts`
- Modify: `backend/src/services/universe/index.ts`

**Interfaces:**

- Consumes: `@services/prisma`, `@services/redis` (ioredis — `mget` ve
  `pipeline` var, depoda ilk kez kullanılıyor), `Prisma` (`@generated/prisma/client`).
- Produces:
  ```ts
  export type MapCelestialKind =
    'STAR' | 'PLANET' | 'MOON' | 'BELT' | 'STATION' | 'GATE';
  export interface MapCelestial {
    id: number;
    systemId: number;
    name: string | null;
    kind: MapCelestialKind;
    x: number;
    z: number;
    orbitIndex: number | null;
    planetId: number | null;
    destinationSystemId: number | null;
  }
  export const MAX_CELESTIAL_SYSTEMS = 16;
  export const CELESTIALS_CACHE_TTL_SECONDS = 86400;
  export function celestialsCacheKey(systemId: number): string;
  export async function getMapCelestials(
    systemIds: number[],
  ): Promise<MapCelestial[]>;
  ```

### Bu task'ın üç kararı

**Anahtar sistem başına, istek başına değil.** Spec'in bu konudaki cümlesi
tasarımın kalbi: istek başına anahtarla `[A,B]` ve `[B,C]` ayrı anahtar olur ve
B iki kez sorgulanır. Panning odağı bir komşuya kaydırdığında istek kümesi her
adımda değişiyor, yani istek başına anahtar pratikte hiç isabet etmez. `mget`
ile hepsi tek turda okunuyor ve yalnızca ıskalar sorgulanıyor.

**Tek `UNION ALL`, altı ayrı sorgu değil.** Altı tablo tek turda okunuyor ve
sonuç zaten düz bir dizi — haritanın istediği şekil. Kolonlar farklı olduğu için
eksik olanlar `NULL::int` ile dolduruluyor.

**Null konumlar baştan filtreleniyor.** Bugün beş tabloda da sıfır null var, ama
`MapCelestial.x` şemada `Float!`. Faz 1 bu dersi pahalı öğrendi: tek null satır
`data: null` döndürür **ve** `setex` serileştirmeden önce çalıştığı için
zehirli gövde bir gün önbellekte kalır. Ölçüme değil yapıya bağlıyoruz.

- [ ] **Step 1: Testi yaz (kırmızı)**

`backend/src/services/universe/map-celestials.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The sixth read service. Its shape is the fifth's — Redis, $queryRaw, Redis —
 * with one difference that is the whole point: the cache key is per system, so
 * panning the focus one neighbour along reuses everything it already had.
 */

// The service writes its per-system entries through a pipeline — one round trip
// for up to sixteen keys instead of sixteen — so the mock has to hand back a
// pipeline object and the assertions count calls on ITS setex.
const { prisma, redis, pipelineSetex } = vi.hoisted(() => {
  const pipelineSetex = vi.fn();
  return {
    pipelineSetex,
    prisma: { $queryRaw: vi.fn() },
    redis: {
      mget: vi.fn(),
      get: vi.fn(),
      pipeline: vi.fn(() => ({
        setex: pipelineSetex,
        exec: vi.fn().mockResolvedValue([]),
      })),
    },
  };
});

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import {
  celestialsCacheKey,
  getMapCelestials,
  MAX_CELESTIAL_SYSTEMS,
} from './map-celestials.service';

/** A row as the UNION ALL returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'PLANET',
    id: 40009077,
    solar_system_id: 30000142,
    name: 'Jita I',
    x: 4.1e10,
    z: -2.2e10,
    orbit_index: 1,
    planet_id: null,
    destination_system_id: null,
    ...overrides,
  };
}

function querySql(call = 0) {
  const [strings, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...{ strings?: string[] }[],
  ];
  return strings
    .map((part, i) => part + (values[i]?.strings?.join('') ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

beforeEach(() => {
  redis.mget.mockResolvedValue([null]);
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('celestialsCacheKey', () => {
  it('keys on the system, so two requests can share a system', () => {
    expect(celestialsCacheKey(30000142)).toBe('map:celestials:30000142');
  });
});

describe('getMapCelestials', () => {
  it('returns nothing for an empty request without touching redis or the database', async () => {
    await expect(getMapCelestials([])).resolves.toEqual([]);
    expect(redis.mget).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects more than sixteen systems rather than silently truncating', async () => {
    const tooMany = Array.from(
      { length: MAX_CELESTIAL_SYSTEMS + 1 },
      (_, i) => i + 1,
    );

    await expect(getMapCelestials(tooMany)).rejects.toThrow(/16/);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('accepts exactly sixteen', async () => {
    const exactly = Array.from(
      { length: MAX_CELESTIAL_SYSTEMS },
      (_, i) => i + 1,
    );
    redis.mget.mockResolvedValue(exactly.map(() => null));

    await expect(getMapCelestials(exactly)).resolves.toEqual([]);
  });

  it('reads every requested system in one mget round trip', async () => {
    redis.mget.mockResolvedValue([null, null]);

    await getMapCelestials([30000142, 30000144]);

    expect(redis.mget).toHaveBeenCalledTimes(1);
    expect(redis.mget).toHaveBeenCalledWith([
      'map:celestials:30000142',
      'map:celestials:30000144',
    ]);
  });

  it('queries only the systems the cache missed', async () => {
    const cached = [row({ solar_system_id: 30000142 })];
    redis.mget.mockResolvedValue([JSON.stringify(cached), null]);

    await getMapCelestials([30000142, 30000144]);

    // The one miss is the only id spliced into the query.
    const [, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(JSON.stringify(values)).toContain('30000144');
    expect(JSON.stringify(values)).not.toContain('30000142');
  });

  it('skips the database entirely when every system is cached', async () => {
    redis.mget.mockResolvedValue([
      JSON.stringify([row({ solar_system_id: 30000142 })]),
      JSON.stringify([row({ solar_system_id: 30000144, id: 2 })]),
    ]);

    const result = await getMapCelestials([30000142, 30000144]);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.pipeline).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('caches each missed system separately, under its own key', async () => {
    redis.mget.mockResolvedValue([null, null]);
    prisma.$queryRaw.mockResolvedValue([
      row({ solar_system_id: 30000142 }),
      row({ solar_system_id: 30000144, id: 40009078 }),
    ]);

    await getMapCelestials([30000142, 30000144]);

    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(pipelineSetex).toHaveBeenCalledTimes(2);
    expect(pipelineSetex).toHaveBeenCalledWith(
      'map:celestials:30000142',
      86400,
      expect.any(String),
    );
    expect(pipelineSetex).toHaveBeenCalledWith(
      'map:celestials:30000144',
      86400,
      expect.any(String),
    );
  });

  it('caches an empty list for a system that has nothing, so it is not re-queried', async () => {
    redis.mget.mockResolvedValue([null]);
    prisma.$queryRaw.mockResolvedValue([]);

    await getMapCelestials([30000001]);

    expect(pipelineSetex).toHaveBeenCalledWith(
      'map:celestials:30000001',
      86400,
      '[]',
    );
  });

  it('maps snake_case rows to the camelCase celestial shape', async () => {
    redis.mget.mockResolvedValue([null]);
    prisma.$queryRaw.mockResolvedValue([
      row({
        kind: 'GATE',
        id: 50001248,
        orbit_index: null,
        destination_system_id: 30000144,
      }),
    ]);

    const [celestial] = await getMapCelestials([30000142]);

    expect(celestial).toEqual({
      id: 50001248,
      systemId: 30000142,
      name: 'Jita I',
      kind: 'GATE',
      x: 4.1e10,
      z: -2.2e10,
      orbitIndex: null,
      planetId: null,
      destinationSystemId: 30000144,
    });
  });

  it('reads all six kinds in one query', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    for (const table of [
      'stars',
      'planets',
      'moons',
      'asteroid_belts',
      'stations',
      'stargates',
    ]) {
      expect(sql).toContain(`FROM ${table}`);
    }
    expect(sql.match(/UNION ALL/g)).toHaveLength(5);
  });

  it('uses the mapped primary key names, never a bare id', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    expect(sql).toContain('star_id');
    expect(sql).toContain('planet_id');
    expect(sql).toContain('moon_id');
    expect(sql).toContain('asteroid_belt_id');
    expect(sql).toContain('station_id');
    expect(sql).toContain('stargate_id');
  });

  it('puts the star at the system centre, because ESI gives it no position', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    expect(sql).toMatch(/'STAR'[\s\S]*0::DOUBLE PRECISION AS x/);
  });

  it('filters null positions on every kind that carries one', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    // Five of the six tables have nullable positions; the star is synthesised.
    // MapCelestial.x is Float!, and setex runs before GraphQL serialisation, so
    // one null would poison the system's cache entry for a day.
    expect(
      sql.match(/position_x IS NOT NULL AND \w*\.?position_z IS NOT NULL/g),
    ).toHaveLength(5);
  });

  it('does not round celestial coordinates', async () => {
    redis.mget.mockResolvedValue([null]);
    prisma.$queryRaw.mockResolvedValue([row({ x: 24144560860, z: -1 })]);

    const [celestial] = await getMapCelestials([30000142]);

    // The innermost planet orbits at 2.41e10 m; the node grid of 1e9 m would
    // move it by 4%.
    expect(celestial.x).toBe(24144560860);
    expect(celestial.z).toBe(-1);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

```bash
yarn workspace backend test src/services/universe/map-celestials.service.spec.ts
```

Beklenen: `Failed to resolve import "./map-celestials.service"`.

- [ ] **Step 3: Servisi yaz**

`backend/src/services/universe/map-celestials.service.ts`:

```ts
/**
 * Celestials for a handful of systems, in metres, relative to the system centre.
 *
 * The cache key is per system rather than per request, and that is the design
 * rather than an optimisation: panning the focus one neighbour along changes the
 * requested set every step, so a per-request key would practically never hit.
 * Measured 2026-09-13: 59 celestials per system at the median, 103 at p95, 159
 * at the worst, and 2,329 for the hard cap of 16 systems.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

export type MapCelestialKind =
  'STAR' | 'PLANET' | 'MOON' | 'BELT' | 'STATION' | 'GATE';

export interface MapCelestial {
  id: number;
  systemId: number;
  name: string | null;
  kind: MapCelestialKind;
  /** Metres, relative to the system centre. Deliberately NOT rounded. */
  x: number;
  z: number;
  orbitIndex: number | null;
  planetId: number | null;
  destinationSystemId: number | null;
}

/**
 * The focus plus its gate neighbours is at most 9 systems (out-degree maxes at
 * 8, measured). 16 is twice that, and rejecting rather than truncating is the
 * point: a silently shortened list would draw a scene with holes in it.
 */
export const MAX_CELESTIAL_SYSTEMS = 16;

export const CELESTIALS_CACHE_TTL_SECONDS = 86400;

export function celestialsCacheKey(systemId: number): string {
  return `map:celestials:${systemId}`;
}

interface CelestialRow {
  kind: MapCelestialKind;
  id: number;
  solar_system_id: number;
  name: string | null;
  x: number;
  z: number;
  orbit_index: number | null;
  planet_id: number | null;
  destination_system_id: number | null;
}

function toCelestial(row: CelestialRow): MapCelestial {
  return {
    id: row.id,
    systemId: row.solar_system_id,
    name: row.name,
    kind: row.kind,
    x: row.x,
    z: row.z,
    orbitIndex: row.orbit_index,
    planetId: row.planet_id,
    destinationSystemId: row.destination_system_id,
  };
}

export async function getMapCelestials(
  systemIds: number[],
): Promise<MapCelestial[]> {
  if (systemIds.length === 0) return [];

  if (systemIds.length > MAX_CELESTIAL_SYSTEMS) {
    throw new Error(
      `mapCelestials accepts at most ${MAX_CELESTIAL_SYSTEMS} systems, got ${systemIds.length}`,
    );
  }

  const unique = [...new Set(systemIds)];
  const cached = await redis.mget(unique.map(celestialsCacheKey));

  const hits: MapCelestial[] = [];
  const misses: number[] = [];

  unique.forEach((systemId, index) => {
    const entry = cached[index];
    if (entry === null || entry === undefined) {
      misses.push(systemId);
      return;
    }
    hits.push(...(JSON.parse(entry) as MapCelestial[]));
  });

  if (misses.length === 0) return hits;

  // One round trip for six tables. The columns differ, so the ones a kind does
  // not have are filled with typed NULLs — the result is the flat array the map
  // wants, with `kind` as the discriminator.
  //
  // Every position is filtered for null. Today there are zero null positions
  // across all five positioned tables, but MapCelestial.x is Float! and the
  // setex below runs before GraphQL serialisation, so a single null would
  // return data: null AND sit in that system's cache entry for a day.
  const ids = Prisma.join(misses);

  const rows = await prisma.$queryRaw<CelestialRow[]>`
    SELECT 'STAR' AS kind, st.star_id AS id, st.solar_system_id, st.name,
           0::DOUBLE PRECISION AS x, 0::DOUBLE PRECISION AS z,
           NULL::INT AS orbit_index, NULL::INT AS planet_id,
           NULL::INT AS destination_system_id
    FROM stars st
    WHERE st.solar_system_id IN (${ids})
    UNION ALL
    SELECT 'PLANET', p.planet_id, p.solar_system_id, p.name,
           p.position_x, p.position_z, p.orbit_index, NULL, NULL
    FROM planets p
    WHERE p.solar_system_id IN (${ids})
      AND p.position_x IS NOT NULL AND p.position_z IS NOT NULL
    UNION ALL
    SELECT 'MOON', m.moon_id, m.solar_system_id, m.name,
           m.position_x, m.position_z, m.orbit_index, m.planet_id, NULL
    FROM moons m
    WHERE m.solar_system_id IN (${ids})
      AND m.position_x IS NOT NULL AND m.position_z IS NOT NULL
    UNION ALL
    SELECT 'BELT', b.asteroid_belt_id, b.solar_system_id, b.name,
           b.position_x, b.position_z, b.orbit_index, b.planet_id, NULL
    FROM asteroid_belts b
    WHERE b.solar_system_id IN (${ids})
      AND b.position_x IS NOT NULL AND b.position_z IS NOT NULL
    UNION ALL
    SELECT 'STATION', s.station_id, s.solar_system_id, s.name,
           s.position_x, s.position_z, NULL, NULL, NULL
    FROM stations s
    WHERE s.solar_system_id IN (${ids})
      AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL
    UNION ALL
    SELECT 'GATE', g.stargate_id, g.solar_system_id, g.name,
           g.position_x, g.position_z, NULL, NULL, g.destination_system_id
    FROM stargates g
    WHERE g.solar_system_id IN (${ids})
      AND g.position_x IS NOT NULL AND g.position_z IS NOT NULL
    ORDER BY solar_system_id, kind, id
  `;

  // Group before caching: each system gets its own entry, including the empty
  // list for a system that has nothing, so it is not re-queried tomorrow.
  const bySystem = new Map<number, MapCelestial[]>(
    misses.map((systemId) => [systemId, []]),
  );
  for (const row of rows) {
    bySystem.get(row.solar_system_id)?.push(toCelestial(row));
  }

  const writes = redis.pipeline();
  for (const [systemId, celestials] of bySystem) {
    writes.setex(
      celestialsCacheKey(systemId),
      CELESTIALS_CACHE_TTL_SECONDS,
      JSON.stringify(celestials),
    );
  }
  await writes.exec();

  return [...hits, ...[...bySystem.values()].flat()];
}
```

- [ ] **Step 4: Barrel'a ekle**

`backend/src/services/universe/index.ts`:

```ts
export * from './universe-map.service';
export * from './map-celestials.service';
export { UniverseService } from './universe.service';
```

- [ ] **Step 5: Testi çalıştır**

```bash
yarn workspace backend test src/services/universe/map-celestials.service.spec.ts
```

Beklenen: PASS, 14 test.

- [ ] **Step 6: Gerçek veritabanına karşı doğrula**

Mock'lu testler sayıların doğruluğunu göstermiyor. Bu adım gösteriyor.

```bash
cd backend && npx tsx -e "
import { getMapCelestials, MAX_CELESTIAL_SYSTEMS } from './src/services/universe/map-celestials.service';
(async () => {
  // Jita and its gate neighbours.
  const focus = 30000142;
  const t0 = Date.now();
  const first = await getMapCelestials([focus]);
  const t1 = Date.now();
  const second = await getMapCelestials([focus]);
  const t2 = Date.now();

  const kinds = first.reduce((acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }), {} as Record<string, number>);
  console.log('Jita celestials', first.length, kinds);
  console.log('cold ms', t1 - t0, 'warm ms', t2 - t1, 'identical', JSON.stringify(first) === JSON.stringify(second));

  const stars = first.filter((c) => c.kind === 'STAR');
  console.log('exactly one star at the centre:', stars.length === 1 && stars[0].x === 0 && stars[0].z === 0);
  console.log('no null coordinate:', first.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z)));
  console.log('gates carry a destination:', first.filter((c) => c.kind === 'GATE').every((c) => c.destinationSystemId !== null));

  const tooMany = Array.from({ length: MAX_CELESTIAL_SYSTEMS + 1 }, (_, i) => 30000000 + i);
  await getMapCelestials(tooMany).then(
    () => console.log('CAP NOT ENFORCED — stop and report'),
    (e) => console.log('cap rejected:', e.message),
  );
  process.exit(0);
})();
"
```

Beklenen: tam bir yıldız merkezde, null koordinat yok, her geçidin hedefi var,
ikinci çağrı birinciyle birebir aynı ve belirgin biçimde hızlı, ve 17 sistem
reddediliyor. Jita'nın celestial sayısı medyan 59'un civarında olmalı; bir şey
tutmuyorsa dur ve sor.

- [ ] **Step 7: Prettier ve commit**

```bash
npx prettier --check backend/src/services/universe/*.ts
git add backend/src/services/universe/
git commit -m "feat(backend): add the map celestials service with a per-system cache"
```

---

## Task 2: Şema, resolver ve response cache kaydı

**Files:**

- Modify: `backend/src/schemas/UniverseMap.graphql`
- Modify: `backend/src/resolvers/universe-map/queries.ts`
- Modify: `backend/src/config/cache.ts`
- Regenerate: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`

**Interfaces:**

- Consumes: Task 1'in `getMapCelestials` ve `MapCelestialKind`'ı.
- Produces: `Query.mapCelestials(systemIds: [Int!]!)`.

### Enum asimetrisi yine çıkıyor, ve bu kez geri yazacak argüman yok

Faz 1'de `mapGeometry`'nin `scope`'u argümandan geri yazılarak çözüldü. Burada
`kind` servisten geliyor, yani o hile yok. Denendi ve doğrulandı: string union
enum tipli alana **atanamıyor** (TS reddediyor), ama tür başına eksiksiz bir
`Record` derleniyor. Cast yerine o kullanılıyor — bir tür eklenirse `Record`
derlenmez, yani dönüşüm hem açık hem tam.

- [ ] **Step 1: Şemayı genişlet**

`backend/src/schemas/UniverseMap.graphql`'in sonuna, mevcut `extend type Query`
bloğunun **içine** `mapCelestials` ekleyerek:

```graphql
"Sistem içindeki çizilebilir nesnenin türü."
enum MapCelestialKind {
  STAR
  PLANET
  MOON
  BELT
  STATION
  GATE
}

"""
Sistemin içindeki tek bir nesne. Koordinat **sistemin merkezine göre**, metre,
ve düğümlerin aksine **yuvarlanmamış**: en iç gezegenin yörüngesi 2,4145e10 m,
1e9'luk ızgara onu %4 kaydırırdı.
"""
type MapCelestial {
  id: Int!
  systemId: Int!
  name: String
  kind: MapCelestialKind!
  x: Float!
  z: Float!
  "ESI'nın 1 tabanlı sırası; gezegen, ay ve kuşakta dolu, diğerlerinde null."
  orbitIndex: Int
  "Ay ve kuşağın bağlı olduğu gezegen; diğerlerinde null."
  planetId: Int
  "Yalnızca GATE'te dolu: hattın öteki ucundaki sistem. Gate ucunun çapalanması buna dayanıyor."
  destinationSystemId: Int
}
```

ve `extend type Query` bloğuna:

```graphql
  """
  Verilen sistemlerin içi. En fazla **16 sistem**; fazlası reddediliyor,
  sessizce kesilmiyor — kısaltılmış bir liste delikli bir sahne çizer.
  Önbellek sistem başına, 86400 s.
  """
  mapCelestials(systemIds: [Int!]!): [MapCelestial!]!
```

- [ ] **Step 2: Codegen, sırasıyla**

```bash
yarn workspace backend codegen && yarn workspace frontend codegen
grep -n "export enum MapCelestialKind" -A 8 backend/src/generated-types.ts
```

Beklenen üyeler: `Star = 'STAR'`, `Planet = 'PLANET'`, `Moon = 'MOON'`,
`Belt = 'BELT'`, `Station = 'STATION'`, `Gate = 'GATE'`.

- [ ] **Step 3: Resolver'ı genişlet**

`backend/src/resolvers/universe-map/queries.ts`:

```ts
import { MapCelestialKind, QueryResolvers } from '@generated-types';
import {
  getMapCelestials,
  getMapGeometry,
  type MapCelestialKind as ServiceCelestialKind,
} from '@services/universe';

/**
 * The service speaks a string-literal union and the schema speaks a string enum.
 * TypeScript's string enums are nominal, so the union does not flow into the
 * enum-typed field — verified, not assumed. An exhaustive Record converts it
 * without a cast: add a kind to the service and this stops compiling, which is
 * exactly what a cast would have hidden.
 */
const CELESTIAL_KIND: Record<ServiceCelestialKind, MapCelestialKind> = {
  STAR: MapCelestialKind.Star,
  PLANET: MapCelestialKind.Planet,
  MOON: MapCelestialKind.Moon,
  BELT: MapCelestialKind.Belt,
  STATION: MapCelestialKind.Station,
  GATE: MapCelestialKind.Gate,
};

/**
 * UniverseMap Query Resolvers
 *
 * Orchestration only; the queries, the scope predicate and the caches all live
 * in the services.
 *
 * `mapGeometry` echoes `scope` back from the argument for the same nominal-enum
 * reason, which costs nothing at runtime — it is the same string.
 */
export const universeMapQueries: QueryResolvers = {
  mapGeometry: async (_, { scope }) => {
    const geometry = await getMapGeometry(scope);
    return { ...geometry, scope };
  },

  mapCelestials: async (_, { systemIds }) => {
    const celestials = await getMapCelestials(systemIds);
    return celestials.map((c) => ({ ...c, kind: CELESTIAL_KIND[c.kind] }));
  },
};
```

- [ ] **Step 4: Response cache'e kaydet**

`backend/src/config/cache.ts`, `PUBLIC_CACHE_QUERIES`'e `'MapGeometry'`'nin
yanına:

```ts
  'MapCelestials',
```

ve `TTL_PER_SCHEMA_COORDINATE`'e `'Query.mapGeometry'`'nin yanına:

```ts
  'Query.mapCelestials': CACHE_TTL.STATIC_GAME_DATA,
```

Frontend dokümanının operasyon adı bu yüzden **`MapCelestials`** olmak zorunda.

- [ ] **Step 5: Derle ve test et**

```bash
yarn workspace backend build
yarn workspace backend test
```

- [ ] **Step 6: Canlı sorguyla doğrula**

```bash
yarn dev:backend   # ayrı terminalde; .graphql değiştiği için yeniden başlaması şart
PORT=$(grep -m1 '^PORT=' backend/.env | cut -d= -f2)
```

```bash
curl -s "http://localhost:$PORT/graphql" -H 'Content-Type: application/json' \
  -d '{"operationName":"MapCelestials","query":"query MapCelestials($ids:[Int!]!){ mapCelestials(systemIds:$ids){ id systemId name kind x z orbitIndex planetId destinationSystemId } }","variables":{"ids":[30000142]}}' \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'errors' in d: print(d['errors']); sys.exit(1)
cs=d['data']['mapCelestials']
kinds={}
for c in cs: kinds[c['kind']]=kinds.get(c['kind'],0)+1
print('count', len(cs), kinds)
print('one star at the centre:', [ (c['x'],c['z']) for c in cs if c['kind']=='STAR' ] == [(0,0)])
print('every gate has a destination:', all(c['destinationSystemId'] is not None for c in cs if c['kind']=='GATE'))
print('no gate destination on anything else:', all(c['destinationSystemId'] is None for c in cs if c['kind']!='GATE'))
print('coordinate types:', {type(c['x']).__name__ for c in cs})
"
```

Beklenen: tek yıldız (0, 0)'da, her geçidin hedefi dolu, geçit olmayanların
hedefi null, koordinat tipleri yalnızca `int`/`float`.

Sonra sert sınırın **GraphQL üzerinden de** reddedildiğini gör:

```bash
IDS=$(python3 -c "print(','.join(str(30000000+i) for i in range(17)))")
curl -s "http://localhost:$PORT/graphql" -H 'Content-Type: application/json' \
  -d "{\"operationName\":\"MapCelestials\",\"query\":\"query MapCelestials{ mapCelestials(systemIds:[$IDS]){ id } }\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('rejected:', 'errors' in d, d.get('errors',[{}])[0].get('message',''))"
```

Beklenen: `rejected: True` ve mesajda 16 geçiyor. Sunucuyu kendin başlattıysan
kapat.

- [ ] **Step 7: Prettier ve commit**

```bash
npx prettier --check backend/src/schemas/UniverseMap.graphql backend/src/resolvers/universe-map/queries.ts backend/src/config/cache.ts
git add backend/src/schemas backend/src/resolvers backend/src/config/cache.ts backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(backend): expose the map celestials query"
```

---

## Task 3: LOD kovaları, odak ve mutlak tavan

Bu fazın aritmetiği. Üç saf util, hiçbiri React veya deck.gl görmüyor.

**Files:**

- Create: `frontend/src/utils/map/lod.ts` + `lod.spec.ts`
- Create: `frontend/src/utils/map/topology.ts` + `topology.spec.ts`
- Modify: `frontend/src/utils/map/origin.ts` + `origin.spec.ts`
- Modify: `frontend/src/utils/map/camera.ts` + `camera.spec.ts`

**Interfaces:**

```ts
// lod.ts — absolute zooms, never fit-relative
export type LodBucket = 'galaxy' | 'approach' | 'interior' | 'fine';
export const APPROACH_ZOOM: number; // -40
export const INTERIOR_ZOOM: number; // -36.18
export const FINE_ZOOM: number; // -26.51
export const MAX_ZOOM: number; // -24.51
export function lodBucket(zoom: number): LodBucket;
export function streamsInteriors(bucket: LodBucket): boolean;
export function showsMoonsAndBelts(bucket: LodBucket): boolean;

// topology.ts
export function gateNeighbours(
  edges: Pick<MapEdge, 'from' | 'to'>[],
  systemId: number,
): number[];

// origin.ts — additions
export function nearestNode<T extends Pick<MapNode, 'x' | 'z'>>(
  nodes: T[],
  x: number,
  z: number,
): T | null;
export function originFor(
  bounds: MapBounds,
  focus: Pick<MapNode, 'x' | 'z'> | null,
): MapOrigin;

// camera.ts — changed
export function zoomLimits(fit: number): { minZoom: number; maxZoom: number }; // maxZoom is now absolute
```

- [ ] **Step 1: `lod.spec.ts`'i yaz (kırmızı)**

```ts
import { describe, expect, it } from 'vitest';
import {
  APPROACH_ZOOM,
  FINE_ZOOM,
  INTERIOR_ZOOM,
  lodBucket,
  MAX_ZOOM,
  showsMoonsAndBelts,
  streamsInteriors,
} from './lod';

/**
 * The thresholds are absolute zooms, not offsets from the galaxy fit, and that
 * is the whole point of this module. Each is a measured physical distance
 * reaching a pixel count: pixels = metres * 2 ** zoom. Expressed as fit
 * offsets they would mean a different thing on every canvas — on 1400x900 the
 * interior threshold is fit + 13.86, on 2560x1440 it is fit + 13.18.
 */

/** metres * 2 ** zoom = pixels */
function pixels(metres: number, zoom: number) {
  return metres * 2 ** zoom;
}

const MEDIAN_SYSTEM_DIAMETER = 2 * 3.8809e12;
const MEDIAN_MOON_SEPARATION = 9.5389e8;
const BIGGEST_SYSTEM_RADIUS = 3.0384e13;

describe('the thresholds are the measurements they claim to be', () => {
  it('starts the interior where the median system disc reaches 100 px', () => {
    expect(pixels(MEDIAN_SYSTEM_DIAMETER, INTERIOR_ZOOM)).toBeCloseTo(100, 0);
  });

  it('starts the fine layer where median moons separate by 10 px', () => {
    expect(pixels(MEDIAN_MOON_SEPARATION, FINE_ZOOM)).toBeCloseTo(10, 0);
  });

  it('puts the ceiling two levels deeper, so moons are 40 px apart rather than 10', () => {
    expect(MAX_ZOOM).toBeCloseTo(FINE_ZOOM + 2, 6);
    expect(pixels(MEDIAN_MOON_SEPARATION, MAX_ZOOM)).toBeCloseTo(40, 0);
  });

  it('keeps the float32 budget comfortable at the ceiling', () => {
    // Largest local coordinate once the origin is the focused system's centre.
    const step = BIGGEST_SYSTEM_RADIUS * 2 ** -24;
    expect(pixels(step, MAX_ZOOM)).toBeLessThan(0.1);
  });

  it('orders the thresholds', () => {
    expect(APPROACH_ZOOM).toBeLessThan(INTERIOR_ZOOM);
    expect(INTERIOR_ZOOM).toBeLessThan(FINE_ZOOM);
    expect(FINE_ZOOM).toBeLessThan(MAX_ZOOM);
  });
});

describe('lodBucket', () => {
  it('is galaxy below the approach threshold', () => {
    expect(lodBucket(-60)).toBe('galaxy');
    expect(lodBucket(APPROACH_ZOOM - 0.01)).toBe('galaxy');
  });

  it('is approach from there to the interior threshold', () => {
    expect(lodBucket(APPROACH_ZOOM)).toBe('approach');
    expect(lodBucket(INTERIOR_ZOOM - 0.01)).toBe('approach');
  });

  it('is interior from the interior threshold to the fine one', () => {
    expect(lodBucket(INTERIOR_ZOOM)).toBe('interior');
    expect(lodBucket(FINE_ZOOM - 0.01)).toBe('interior');
  });

  it('is fine at and above the fine threshold', () => {
    expect(lodBucket(FINE_ZOOM)).toBe('fine');
    expect(lodBucket(MAX_ZOOM)).toBe('fine');
    expect(lodBucket(0)).toBe('fine');
  });

  it('does not depend on the canvas, unlike a fit offset would', () => {
    // Same absolute zoom, two canvases whose fits differ by 0.68 levels.
    expect(lodBucket(INTERIOR_ZOOM)).toBe(lodBucket(INTERIOR_ZOOM));
    expect(lodBucket(-36.18)).toBe('interior');
  });
});

describe('streamsInteriors', () => {
  it('is true exactly for the two deep buckets', () => {
    expect(streamsInteriors('galaxy')).toBe(false);
    expect(streamsInteriors('approach')).toBe(false);
    expect(streamsInteriors('interior')).toBe(true);
    expect(streamsInteriors('fine')).toBe(true);
  });
});

describe('showsMoonsAndBelts', () => {
  it('is true only in the fine bucket', () => {
    expect(showsMoonsAndBelts('interior')).toBe(false);
    expect(showsMoonsAndBelts('fine')).toBe(true);
  });
});
```

- [ ] **Step 2: `lod.ts`'i yaz**

```ts
/**
 * Where each thing appears, as absolute zooms.
 *
 * deck.gl's orthographic zoom is logarithmic and the unit is metres, so
 * `pixels = metres * 2 ** zoom`. Every threshold below is a measured distance
 * reaching a pixel count, which makes it a property of the zoom alone — not of
 * the canvas. The design's first draft expressed them as offsets from the
 * galaxy fit; that was wrong, because the fit moves with the viewport. On
 * 1400x900 the interior threshold is fit + 13.86 and on 2560x1440 it is
 * fit + 13.18, so a single offset would open the interiors with the discs at
 * 59 px on one screen and 100 px on the other.
 */

/** Discs start growing toward their true radius. */
export const APPROACH_ZOOM = -40;

/** The median system diameter (2 x 3.8809e12 m) reaches 100 px. Interiors stream. */
export const INTERIOR_ZOOM = -36.18;

/** The median moon separation (9.5389e8 m) reaches 10 px. Moons and belts appear. */
export const FINE_ZOOM = -26.51;

/**
 * Two levels past FINE_ZOOM, where median moons sit 40 px apart rather than
 * barely-separable 10. The float32 budget is still 0.076 px there, because the
 * origin is the focused system's centre by this depth.
 */
export const MAX_ZOOM = FINE_ZOOM + 2;

export type LodBucket = 'galaxy' | 'approach' | 'interior' | 'fine';

/**
 * A discrete bucket rather than the raw zoom: layer props then change at a
 * bucket boundary instead of on every wheel tick, which is what keeps the
 * layer array memoisable.
 */
export function lodBucket(zoom: number): LodBucket {
  if (zoom >= FINE_ZOOM) return 'fine';
  if (zoom >= INTERIOR_ZOOM) return 'interior';
  if (zoom >= APPROACH_ZOOM) return 'approach';
  return 'galaxy';
}

/** Whether the focused system's interior should be fetched and drawn. */
export function streamsInteriors(bucket: LodBucket): boolean {
  return bucket === 'interior' || bucket === 'fine';
}

/** Whether moons and belts are drawn. 344,457 moons exist; none is built below this. */
export function showsMoonsAndBelts(bucket: LodBucket): boolean {
  return bucket === 'fine';
}
```

- [ ] **Step 3: `topology.spec.ts` ve `topology.ts`'i yaz**

```ts
import { describe, expect, it } from 'vitest';
import { gateNeighbours } from './topology';

const edges = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 1, to: 4 },
  { from: 5, to: 1 },
];

describe('gateNeighbours', () => {
  it('finds neighbours on both sides of the pair, since edges are stored from < to', () => {
    expect(gateNeighbours(edges, 1).sort()).toEqual([2, 4, 5]);
  });

  it('returns an empty list for a system with no gates, like every wormhole system', () => {
    expect(gateNeighbours(edges, 99)).toEqual([]);
  });

  it('never returns the system itself', () => {
    expect(gateNeighbours([{ from: 7, to: 7 }], 7)).toEqual([]);
  });

  it('deduplicates', () => {
    expect(
      gateNeighbours(
        [
          { from: 1, to: 2 },
          { from: 1, to: 2 },
        ],
        1,
      ),
    ).toEqual([2]);
  });
});
```

```ts
import type { MapEdge } from '@/generated/graphql';

/**
 * The systems one gate away. Edges are stored once with `from < to`, so a
 * neighbour can be on either side of the pair.
 *
 * Measured 2026-09-13: out-degree maxes at 8 and averages 2.65, so the focus
 * plus its neighbours is at most 9 systems — comfortably inside mapCelestials'
 * cap of 16.
 */
export function gateNeighbours(
  edges: Pick<MapEdge, 'from' | 'to'>[],
  systemId: number,
): number[] {
  const neighbours = new Set<number>();

  for (const edge of edges) {
    if (edge.from === systemId && edge.to !== systemId) neighbours.add(edge.to);
    else if (edge.to === systemId && edge.from !== systemId)
      neighbours.add(edge.from);
  }

  return [...neighbours];
}
```

- [ ] **Step 4: `origin.ts`'e iki fonksiyon ekle**

Mevcut dosyanın sonuna:

```ts
/**
 * The node whose centre is nearest a point. Linear over the scene's nodes —
 * 5,241 at the most, scanned only when the LOD bucket says interiors stream,
 * which is exactly when there is practically one system on screen anyway.
 */
export function nearestNode<T extends Pick<MapNode, 'x' | 'z'>>(
  nodes: T[],
  x: number,
  z: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;

  for (const node of nodes) {
    const dx = node.x - x;
    const dz = node.z - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }

  return best;
}

/**
 * Which origin to subtract. Phase 1 used the scene centre everywhere, which is
 * fine while the galaxy is on screen and catastrophic once it is not: at the
 * deepest zoom the scene centre puts float32's step at 299 px, against 0.019 px
 * for the focused system's centre. The switch happens at the interior
 * threshold, where there is practically one system on screen, so the origin is
 * stable up there rather than changing under every pan.
 */
export function originFor(
  bounds: MapBounds,
  focus: Pick<MapNode, 'x' | 'z'> | null,
): MapOrigin {
  return focus ? { x: focus.x, z: focus.z } : boundsCenter(bounds);
}
```

- [ ] **Step 5: `origin.spec.ts`'e testleri ekle**

Mevcut dosyanın sonuna:

```ts
describe('nearestNode', () => {
  const nodes = [
    { systemId: 1, x: 0, z: 0 },
    { systemId: 2, x: 1e16, z: 0 },
    { systemId: 3, x: 0, z: -2e16 },
  ];

  it('finds the closest node to a point', () => {
    expect(nearestNode(nodes, 9e15, 1e15)?.systemId).toBe(2);
    expect(nearestNode(nodes, 1e14, -1.9e16)?.systemId).toBe(3);
  });

  it('returns null for an empty scene rather than throwing', () => {
    expect(nearestNode([], 0, 0)).toBeNull();
  });

  it('compares squared distances, so it never needs a square root', () => {
    // A node exactly between two others resolves to the first seen, which is
    // stable across renders because the node order comes from the query.
    expect(nearestNode(nodes, 5e15, 0)?.systemId).toBe(1);
  });
});

describe('originFor', () => {
  const bounds = {
    minX: -508743946216137000,
    maxX: 336522971264518000,
    minZ: -484452845697854000,
    maxZ: 472860102256057000,
  };

  it('is the scene centre while nothing is focused', () => {
    expect(originFor(bounds, null)).toEqual(boundsCenter(bounds));
  });

  it('is the focused system once there is one', () => {
    expect(originFor(bounds, { x: 1e17, z: -2e17 })).toEqual({
      x: 1e17,
      z: -2e17,
    });
  });

  it('is what turns 299 px of jitter into 0.019 px', () => {
    // The numbers that force the switch, asserted rather than left in a comment.
    const sceneHalfSpan = 4.786565e17;
    const biggestSystemRadius = 3.0384e13;
    const deepest = -24.51;

    expect(sceneHalfSpan * 2 ** -24 * 2 ** deepest).toBeGreaterThan(100);
    expect(biggestSystemRadius * 2 ** -24 * 2 ** deepest).toBeLessThan(0.1);
  });
});
```

`origin.spec.ts`'in import satırına `nearestNode` ve `originFor` ekle.

- [ ] **Step 6: `camera.ts`'in tavanını mutlak yap**

`ZOOM_ABOVE_FIT` siliniyor ve `zoomLimits` `lod.ts`'in `MAX_ZOOM`'unu kullanıyor:

```ts
import { MAX_ZOOM } from './lod';
```

```ts
/**
 * The ceiling is absolute, not an offset from the fit. Phase 1 used fit + 13
 * because interiors were out of scope; it happened to land below the interior
 * threshold on every canvas, but for the wrong reason. `Math.max` guards the
 * degenerate case of a scene so small that its own fit is already deeper than
 * the ceiling.
 */
export function zoomLimits(fit: number): { minZoom: number; maxZoom: number } {
  return { minZoom: fit - ZOOM_BELOW_FIT, maxZoom: Math.max(MAX_ZOOM, fit) };
}
```

`camera.spec.ts`'te `zoomLimits` testini değiştir:

```ts
describe('zoomLimits', () => {
  it('opens down to two levels below the fit and up to the absolute ceiling', () => {
    expect(zoomLimits(-50)).toEqual({ minZoom: -52, maxZoom: MAX_ZOOM });
  });

  it('gives the same ceiling on every canvas, which a fit offset would not', () => {
    expect(zoomLimits(-50.04).maxZoom).toBe(zoomLimits(-49.36).maxZoom);
  });

  it('never returns a ceiling below the floor for a tiny scene', () => {
    const limits = zoomLimits(-10);
    expect(limits.maxZoom).toBeGreaterThanOrEqual(limits.minZoom);
  });
});
```

ve import satırına `MAX_ZOOM`'u `./lod`'dan ekle.

- [ ] **Step 7: Testleri çalıştır**

```bash
yarn workspace frontend test src/utils/map
yarn workspace frontend typecheck
```

Beklenen: PASS. `lod` 12, `topology` 4, `origin` 10 + 7 = 17, `camera` 16 − 1 + 3 = 18,
`colorScales` 7 → toplam **58**.

- [ ] **Step 8: Prettier ve commit**

```bash
npx prettier --check frontend/src/utils/map/*.ts
git add frontend/src/utils/map/
git commit -m "feat(frontend): derive lod buckets and the focused origin from absolute zooms"
```

---

## Task 4: Sorgu dokümanı ve celestial hook'u

**Files:**

- Create: `frontend/src/graphql/MapCelestials.graphql`
- Create: `frontend/src/components/UniverseMap/useMapCelestials.ts`
- Regenerate: `frontend/src/generated/graphql.ts`

**Interfaces:**

```ts
export const MAX_CELESTIAL_SYSTEMS = 16; // mirrors the service's cap
export function useMapCelestials(systemIds: number[]): MapCelestialFragment[];
```

### Neden istemci tarafında ayrı bir önbellek yok

Backend'in anahtarı sistem başına, çünkü orada `[A,B]` ve `[B,C]` ayrı anahtar
olsa B iki kez sorgulanırdı. İstemcide aynı şeyi kurmak cazip ama gereksiz:
Apollo bütün değişken kümesini anahtarlıyor, yani yeni bir komşuluk yeni bir
istek — ama o istek backend'de `mget`'e düşüyor ve komşuların çoğu zaten
Redis'te, yani veritabanına gitmiyor. **İd'ler artan sırada gönderiliyor**, ki
aynı komşuluğa geri dönmek Apollo'nun kendi cache'ine isabet etsin.

İstemcide biriktiren bir `Map` ileride ölçümle gelir; şimdi eklemek kendi
testlerini ve kendi bayat-veri sorusunu getirirdi.

- [ ] **Step 1: Dokümanı yaz**

`frontend/src/graphql/MapCelestials.graphql`:

```graphql
# Operasyon adı MapCelestials olmak zorunda: backend'in response cache'i
# PUBLIC_CACHE_QUERIES'e operasyon adıyla bakıyor.
query MapCelestials($systemIds: [Int!]!) {
  mapCelestials(systemIds: $systemIds) {
    id
    systemId
    name
    kind
    x
    z
    orbitIndex
    planetId
    destinationSystemId
  }
}
```

- [ ] **Step 2: Codegen**

```bash
yarn workspace backend codegen && yarn workspace frontend codegen
grep -n "useMapCelestialsQuery" frontend/src/generated/graphql.ts | head -2
```

- [ ] **Step 3: Hook'u yaz**

`frontend/src/components/UniverseMap/useMapCelestials.ts`:

```ts
'use client';

import { useMapCelestialsQuery } from '@/generated/graphql';
import { useMemo } from 'react';

/**
 * Mirrors the service's cap. Rejecting rather than truncating is the service's
 * job; this only keeps a runaway caller from making the request at all.
 */
export const MAX_CELESTIAL_SYSTEMS = 16;

/**
 * The interiors of a handful of systems: the focus plus its gate neighbours, so
 * panning one system along already has what it needs.
 *
 * The ids are sorted before they become variables. Apollo keys its cache on the
 * whole variable set, so an unsorted list would miss on a neighbourhood it had
 * already fetched simply because the order differed. A genuinely new
 * neighbourhood still costs one request, but the backend answers it out of its
 * per-system Redis keys rather than the database.
 */
export function useMapCelestials(systemIds: number[]) {
  const variables = useMemo(
    () => ({ systemIds: [...new Set(systemIds)].sort((a, b) => a - b) }),
    [systemIds],
  );

  const { data } = useMapCelestialsQuery({
    variables,
    skip:
      variables.systemIds.length === 0 ||
      variables.systemIds.length > MAX_CELESTIAL_SYSTEMS,
    fetchPolicy: 'cache-first',
  });

  return data?.mapCelestials ?? [];
}
```

- [ ] **Step 4: Typecheck ve commit**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/graphql/MapCelestials.graphql frontend/src/components/UniverseMap/useMapCelestials.ts
git add frontend/src/graphql frontend/src/components/UniverseMap/useMapCelestials.ts frontend/src/generated/graphql.ts
git commit -m "feat(frontend): fetch the focused system's interior and its neighbours"
```

---

## Task 5: Celestial katmanları

**Files:**

- Create: `frontend/src/components/UniverseMap/layers/celestials.ts`
- Modify: `frontend/src/components/UniverseMap/layers/index.ts`
- Modify: `frontend/src/components/UniverseMap/layers/layers.spec.ts`

**Interfaces:**

```ts
export const CELESTIALS_LAYER_ID = 'map-celestials';
export const FINE_LAYER_ID = 'map-celestials-fine';
export const INTERIOR_KINDS: readonly MapCelestialKind[]; // Star Planet Station Gate
export const FINE_KINDS: readonly MapCelestialKind[]; // Moon Belt
export const CELESTIAL_RADIUS_PIXELS: Record<MapCelestialKind, number>;
export const CELESTIAL_COLOR: Record<MapCelestialKind, Rgba>;
export interface CelestialsLayerProps extends ScatterplotLayerProps<MapCelestial> {
  id: string;
  getPosition: (c: MapCelestial) => [number, number];
  getRadius: (c: MapCelestial) => number;
  getFillColor: (c: MapCelestial) => Rgba;
}
export function celestialsLayerProps(input: {
  id: string;
  celestials: MapCelestial[];
  kinds: readonly MapCelestialKind[];
  systemById: Map<number, Pick<MapNode, 'x' | 'z'>>;
  origin: MapOrigin;
}): CelestialsLayerProps;
```

### Koordinat iki toplama, ve ikisi de float64'te

Bir celestial'ın koordinatı **kendi sisteminin merkezine** göre. Orijin ise
odaklı sistemin merkezi. Yani GPU'ya giden değer
`(sistem.x + celestial.x) − orijin.x`. Odaklı sistemin kendi celestial'larında
bu `celestial.x`'e sadeleşiyor — 1e10 mertebesi, float32'de tamamen rahat.
Komşu sistemin celestial'larında ise ~1 ly'lik bir fark kalıyor, ki kabul
edilen köşe: o nesneler ekranın dışında ve yönü belirlemekten başka iş
yapmıyorlar.

- [ ] **Step 1: `layers.spec.ts`'e testleri ekle**

```ts
import {
  CELESTIAL_COLOR,
  CELESTIAL_RADIUS_PIXELS,
  celestialsLayerProps,
  FINE_KINDS,
  INTERIOR_KINDS,
} from './index';

function celestial(
  kind: MapCelestialKind,
  x: number,
  z: number,
  extra: Partial<MapCelestial> = {},
): MapCelestial {
  return {
    __typename: 'MapCelestial',
    id: 1,
    systemId: 30000142,
    name: 'x',
    kind,
    x,
    z,
    orbitIndex: null,
    planetId: null,
    destinationSystemId: null,
    ...extra,
  } as MapCelestial;
}

describe('celestialsLayerProps', () => {
  // The focused system sits at 1.5e17; the origin is its centre, so its own
  // celestials reduce to their in-system offsets.
  const systemById = new Map([
    [30000142, { x: 1.5e17, z: -2.5e17 }],
    [30000144, { x: 1.6e17, z: -2.5e17 }],
  ]);
  const origin = { x: 1.5e17, z: -2.5e17 };

  const celestials = [
    celestial('STAR', 0, 0),
    celestial('PLANET', 4e10, -2e10, { id: 2, orbitIndex: 1 }),
    celestial('MOON', 4.1e10, -2e10, { id: 3, planetId: 2 }),
    celestial('GATE', -8e10, 1e10, { id: 4, destinationSystemId: 30000144 }),
    celestial('STATION', 1e10, 1e10, { id: 5 }),
    celestial('BELT', 5e10, -2e10, { id: 6, planetId: 2 }),
  ];

  const interior = celestialsLayerProps({
    id: 'map-celestials',
    celestials,
    kinds: INTERIOR_KINDS,
    systemById,
    origin,
  });

  it('keeps only the kinds it was asked for', () => {
    expect((interior.data as MapCelestial[]).map((c) => c.kind)).toEqual([
      'STAR',
      'PLANET',
      'GATE',
      'STATION',
    ]);
  });

  it('adds the system centre to the in-system offset, then subtracts the origin', () => {
    // The focus is the origin, so its own celestials come through unchanged.
    expect(interior.getPosition(celestials[0])).toEqual([0, 0]);
    expect(interior.getPosition(celestials[1])).toEqual([4e10, -2e10]);
  });

  it('places a neighbour celestial one system-gap away, not at its own offset', () => {
    const neighbourGate = celestial('GATE', 1e10, 0, {
      id: 9,
      systemId: 30000144,
      destinationSystemId: 30000142,
    });
    const props = celestialsLayerProps({
      id: 'map-celestials',
      celestials: [neighbourGate],
      kinds: INTERIOR_KINDS,
      systemById,
      origin,
    });

    // 1.6e17 + 1e10 - 1.5e17
    expect(props.getPosition(neighbourGate)[0]).toBeCloseTo(1e16 + 1e10, -6);
  });

  it('drops a celestial whose system is not in the index rather than drawing it at the origin', () => {
    const orphan = celestial('PLANET', 1e10, 0, { id: 8, systemId: 99999 });
    const props = celestialsLayerProps({
      id: 'map-celestials',
      celestials: [orphan],
      kinds: INTERIOR_KINDS,
      systemById,
      origin,
    });

    expect(props.data).toEqual([]);
  });

  it('draws marks in pixels, not world metres', () => {
    // A world radius derived from the median orbit reads 0.23 px at the interior
    // threshold and 753 px at the ceiling; there is no single world value that
    // works at both ends, because a real planet is ~1e7 m and never spans a
    // pixel. The geometry carries the scale, the marks carry the kind.
    expect(interior.radiusUnits).toBe('pixels');
    expect(interior.getRadius(celestials[0])).toBe(
      CELESTIAL_RADIUS_PIXELS.STAR,
    );
    expect(interior.getRadius(celestials[1])).toBe(
      CELESTIAL_RADIUS_PIXELS.PLANET,
    );
  });

  it('orders the mark hierarchy star > planet > station = gate > moon > belt', () => {
    const r = CELESTIAL_RADIUS_PIXELS;
    expect(r.STAR).toBeGreaterThan(r.PLANET);
    expect(r.PLANET).toBeGreaterThan(r.STATION);
    expect(r.STATION).toBe(r.GATE);
    expect(r.GATE).toBeGreaterThan(r.MOON);
    expect(r.MOON).toBeGreaterThan(r.BELT);
  });

  it('inherits the three colours the shipped SVGs already define', () => {
    // solar-system-map-svg.ts: UNKNOWN_STAR, UNKNOWN_PLANET.
    // star-map-svg.ts: REGION_PALETTE.gate.
    expect(CELESTIAL_COLOR.STAR).toEqual(hexToRgba('#FFF4EA'));
    expect(CELESTIAL_COLOR.PLANET).toEqual(hexToRgba('#9CA3AF'));
    expect(CELESTIAL_COLOR.GATE).toEqual(hexToRgba('#4CC94C'));
  });

  it('is not pickable yet — picking is Phase 3', () => {
    expect(interior.pickable).toBe(false);
  });

  it('rebuilds positions when the origin moves', () => {
    expect(interior.updateTriggers?.getPosition).toEqual([origin.x, origin.z]);
  });

  it('builds the fine layer from moons and belts only', () => {
    const fine = celestialsLayerProps({
      id: 'map-celestials-fine',
      celestials,
      kinds: FINE_KINDS,
      systemById,
      origin,
    });

    expect((fine.data as MapCelestial[]).map((c) => c.kind)).toEqual([
      'MOON',
      'BELT',
    ]);
  });
});
```

`layers.spec.ts`'in import satırına `MapCelestial` ve `MapCelestialKind`'ı
`@/generated/graphql`'dan, `hexToRgba`'yı `@/utils/map/colorScales`'dan ekle.

- [ ] **Step 2: `celestials.ts`'i yaz**

```ts
import { MapCelestialKind } from '@/generated/graphql';
import type { MapCelestial, MapNode } from '@/generated/graphql';
import { hexToRgba, type Rgba } from '@/utils/map/colorScales';
import { toLocal, type MapOrigin } from '@/utils/map/origin';
import type { ScatterplotLayerProps } from '@deck.gl/layers';

export const CELESTIALS_LAYER_ID = 'map-celestials';
export const FINE_LAYER_ID = 'map-celestials-fine';

/**
 * What the interior bucket draws.
 *
 * The enum members, not the string literals: `MapCelestialKind` is a string
 * enum and TypeScript's string enums are nominal, so `'STAR'` is not assignable
 * to it. Same asymmetry the resolver handles with an exhaustive Record.
 */
export const INTERIOR_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Star,
  MapCelestialKind.Planet,
  MapCelestialKind.Station,
  MapCelestialKind.Gate,
];

/** What the fine bucket adds. 344,457 moons exist; none is built below it. */
export const FINE_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Moon,
  MapCelestialKind.Belt,
];

/**
 * Marks, in pixels, not bodies in metres.
 *
 * A world radius derived from the measured geometry (a planet at 5% of the
 * median orbit, 1.8e10 m) is 0.23 px where the interior opens and 753 px at the
 * ceiling — and a star would be 1,507 px. No single world value works at both
 * ends, because a real planet is ~1e7 m and never spans a pixel at any zoom the
 * design reaches. So the geometry carries the scale (orbit radii are real) and
 * the mark carries the kind.
 */
export const CELESTIAL_RADIUS_PIXELS: Record<MapCelestialKind, number> = {
  STAR: 7,
  PLANET: 4.5,
  STATION: 3,
  GATE: 3,
  MOON: 2,
  BELT: 1.5,
};

/**
 * Three of these are inherited rather than chosen, so the map agrees with the
 * diagrams already shipped under frontend/public/images:
 *
 *   STAR   #FFF4EA  solar-system-map-svg.ts UNKNOWN_STAR
 *   PLANET #9CA3AF  solar-system-map-svg.ts UNKNOWN_PLANET
 *   GATE   #4CC94C  star-map-svg.ts REGION_PALETTE.gate
 *
 * The star and planet defaults are used rather than the per-class and per-type
 * tables because `MapCelestial` carries neither `spectralClass` nor `typeId`.
 * Adding them so planets can be coloured by type belongs with Phase 4's colour
 * registry, not here.
 *
 * The other three are chosen: the shipped SVGs draw no stations, moons or
 * belts, so there was nothing to inherit. Station blue for the man-made thing,
 * a dimmer slate for moons so they read as subordinate to their planet, amber
 * for ore. None is one of the four the design's palette audit failed.
 */
export const CELESTIAL_COLOR: Record<MapCelestialKind, Rgba> = {
  STAR: hexToRgba('#FFF4EA'),
  PLANET: hexToRgba('#9CA3AF'),
  STATION: hexToRgba('#38BDF8'),
  GATE: hexToRgba('#4CC94C'),
  MOON: hexToRgba('#64748B'),
  BELT: hexToRgba('#A16207'),
};

export interface CelestialsLayerProps extends ScatterplotLayerProps<MapCelestial> {
  id: string;
  getPosition: (celestial: MapCelestial) => [number, number];
  getRadius: (celestial: MapCelestial) => number;
  getFillColor: (celestial: MapCelestial) => Rgba;
}

export function celestialsLayerProps({
  id,
  celestials,
  kinds,
  systemById,
  origin,
}: {
  id: string;
  celestials: MapCelestial[];
  kinds: readonly MapCelestialKind[];
  systemById: Map<number, Pick<MapNode, 'x' | 'z'>>;
  origin: MapOrigin;
}): CelestialsLayerProps {
  const wanted = new Set<string>(kinds);

  // A celestial whose system is not in the index is dropped rather than drawn
  // at the origin — the same rule the gate edges follow, for the same reason.
  const data = celestials.filter(
    (celestial) =>
      wanted.has(celestial.kind) && systemById.has(celestial.systemId),
  );

  return {
    id,
    data,
    getPosition: (celestial: MapCelestial) => {
      // Two additions, both in float64: the celestial is relative to its own
      // system's centre, and the origin is the focused system's centre.
      const system = systemById.get(celestial.systemId)!;
      return toLocal(origin, system.x + celestial.x, system.z + celestial.z);
    },
    getRadius: (celestial: MapCelestial) =>
      CELESTIAL_RADIUS_PIXELS[celestial.kind],
    getFillColor: (celestial: MapCelestial) => CELESTIAL_COLOR[celestial.kind],
    radiusUnits: 'pixels',
    // Picking, hover and the popup are Phase 3.
    pickable: false,
    updateTriggers: { getPosition: [origin.x, origin.z] },
  };
}
```

- [ ] **Step 3: Barrel'a ekle**

```ts
export {
  CELESTIAL_COLOR,
  CELESTIAL_RADIUS_PIXELS,
  CELESTIALS_LAYER_ID,
  celestialsLayerProps,
  FINE_KINDS,
  FINE_LAYER_ID,
  INTERIOR_KINDS,
  type CelestialsLayerProps,
} from './celestials';
```

- [ ] **Step 4: Testleri çalıştır ve commit**

```bash
yarn workspace frontend test src/components/UniverseMap
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap/layers/*.ts
git add frontend/src/components/UniverseMap/layers/
git commit -m "feat(frontend): draw system interiors as kind-coded marks"
```

Beklenen: Task 5'in 11 testi Faz 1'in 13'ünün üstüne biniyor → `layers.spec.ts` 24.

---

## Task 6: Gate uçlarının çapalanması

Bu fazın imza anı: nokta diske dönüşürken hatlar merkezden gerçek geçitlere
kayıyor.

**Files:**

- Modify: `frontend/src/components/UniverseMap/layers/edges.ts`
- Modify: `frontend/src/components/UniverseMap/layers/layers.spec.ts`

**Interfaces:**

```ts
// edgeSegments gains a fourth parameter, defaulted so Phase 1's callers still compile
export function edgeSegments(
  edges: MapEdge[],
  nodes: MapNode[],
  origin: MapOrigin,
  gates?: Pick<MapCelestial, 'systemId' | 'destinationSystemId' | 'x' | 'z'>[],
): EdgeSegment[];
```

Çapalama ölçüme dayanıyor: **13.978 (sistem, hedef) çiftinin hiçbirinde bir
sistemin aynı komşuya iki geçidi yok**, yani `${systemId}->${destinationSystemId}`
anahtarı tek bir geçidi gösteriyor. Olmasa hangi geçide oturacağını seçmek
gerekirdi.

- [ ] **Step 1: Testleri ekle**

```ts
describe('edgeSegments with loaded gates', () => {
  const nodes = [node(1, 1.5e17, -2.5e17), node(2, 1.6e17, -2.5e17)];
  const edges: MapEdge[] = [
    { __typename: 'MapEdge', from: 1, to: 2 } as MapEdge,
  ];
  const origin = { x: 1.5e17, z: -2.5e17 };

  const gateFrom1 = {
    systemId: 1,
    destinationSystemId: 2,
    x: 3e10,
    z: 0,
  };
  const gateFrom2 = {
    systemId: 2,
    destinationSystemId: 1,
    x: -3e10,
    z: 0,
  };

  it('leaves both ends at the system centres when no interior is loaded', () => {
    expect(edgeSegments(edges, nodes, origin)).toEqual([
      { from: [0, 0], to: [1e16, 0] },
    ]);
  });

  it('moves the loaded end onto the real stargate', () => {
    const [segment] = edgeSegments(edges, nodes, origin, [gateFrom1]);

    expect(segment.from).toEqual([3e10, 0]);
    // The other end is still the neighbour's centre: we do not know where its
    // gate is until its interior is loaded, and inventing one would be worse.
    expect(segment.to).toEqual([1e16, 0]);
  });

  it('anchors both ends once both interiors are loaded', () => {
    const [segment] = edgeSegments(edges, nodes, origin, [
      gateFrom1,
      gateFrom2,
    ]);

    expect(segment.from).toEqual([3e10, 0]);
    expect(segment.to[0]).toBeCloseTo(1e16 - 3e10, -6);
  });

  it('ignores a gate whose destination is not the other end of this edge', () => {
    const elsewhere = {
      systemId: 1,
      destinationSystemId: 999,
      x: 9e10,
      z: 9e10,
    };

    expect(edgeSegments(edges, nodes, origin, [elsewhere])[0].from).toEqual([
      0, 0,
    ]);
  });

  it('ignores a gate with no destination rather than keying on null', () => {
    const nowhere = {
      systemId: 1,
      destinationSystemId: null,
      x: 9e10,
      z: 9e10,
    };

    expect(edgeSegments(edges, nodes, origin, [nowhere])[0].from).toEqual([
      0, 0,
    ]);
  });
});
```

- [ ] **Step 2: `edges.ts`'i değiştir**

`edgeSegments`'in gövdesini şununla değiştir:

```ts
/**
 * Resolves each pair's endpoints once, in float64, into origin-local metres.
 *
 * At galaxy zoom both ends are system centres. Once a system's interior is
 * loaded, the end at that system moves onto the **real stargate** heading for
 * the other one — the signature moment of this phase, and the reason
 * `stargates.destination_system_id` is worth carrying all the way to the
 * layer. The mapping is unambiguous by measurement: across 13,978
 * (system, destination) pairs, no system has two gates to the same neighbour.
 *
 * A half-anchored line is correct, not a bug. If the neighbour's interior is
 * not loaded we do not know where its gate is, and its centre is the honest
 * answer.
 *
 * An edge naming a system that is not in the node list is dropped rather than
 * drawn. The service guarantees that cannot happen, but a silent line to
 * [0, 0] would be the worst possible symptom if the guarantee ever broke.
 */
export function edgeSegments(
  edges: MapEdge[],
  nodes: MapNode[],
  origin: MapOrigin,
  gates: Pick<
    MapCelestial,
    'systemId' | 'destinationSystemId' | 'x' | 'z'
  >[] = [],
): EdgeSegment[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));

  const gateBetween = new Map<string, (typeof gates)[number]>();
  for (const gate of gates) {
    if (gate.destinationSystemId === null) continue;
    gateBetween.set(`${gate.systemId}->${gate.destinationSystemId}`, gate);
  }

  const endpoint = (system: MapNode, towards: number): [number, number] => {
    const gate = gateBetween.get(`${system.systemId}->${towards}`);
    return gate
      ? toLocal(origin, system.x + gate.x, system.z + gate.z)
      : toLocal(origin, system.x, system.z);
  };

  const segments: EdgeSegment[] = [];

  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;

    segments.push({
      from: endpoint(from, edge.to),
      to: endpoint(to, edge.from),
    });
  }

  return segments;
}
```

`edges.ts`'in import satırına `MapCelestial`'ı `@/generated/graphql`'dan ekle.

- [ ] **Step 3: Testleri çalıştır ve commit**

```bash
yarn workspace frontend test src/components/UniverseMap
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap/layers/edges.ts
git add frontend/src/components/UniverseMap/layers/
git commit -m "feat(frontend): anchor loaded gate ends onto their real stargates"
```

---

## Task 7: Tuvale bağlama

**Files:**

- Modify: `frontend/src/components/UniverseMap/UniverseMap.tsx`
- Modify: `frontend/src/components/UniverseMap/UniverseMap.spec.tsx`

**Interfaces:** yeni export yok; bileşen Task 3-6'nın parçalarını birleştiriyor.

- [ ] **Step 1: Bileşeni değiştir**

`UniverseMap.tsx`'e eklenen kısımlar — mevcut `origin`/`layers`/`viewState`
`useMemo`'ları bunlarla değişiyor:

```tsx
const bucket = useMemo(
  () => (camera ? lodBucket(camera.zoom) : 'galaxy'),
  [camera],
);

// The focus only exists above the interior threshold. Below it the origin is
// the scene centre, and recomputing a focus on every pan would rebuild all
// 5,241 node attributes for nothing.
const focus = useMemo(() => {
  if (!geometry || !camera || !streamsInteriors(bucket)) return null;
  return nearestNode(geometry.nodes, camera.x, camera.z);
}, [geometry, camera, bucket]);

const origin = useMemo(
  () => (geometry ? originFor(geometry.bounds, focus) : { x: 0, z: 0 }),
  [geometry, focus],
);

const systemById = useMemo(
  () => new Map((geometry?.nodes ?? []).map((node) => [node.systemId, node])),
  [geometry],
);

// The focus plus its gate neighbours: at most 9 systems, measured. Asking for
// the neighbours is what makes panning one system along instant.
const celestialSystemIds = useMemo(() => {
  if (!focus || !geometry) return [];
  return [focus.systemId, ...gateNeighbours(geometry.edges, focus.systemId)];
}, [focus, geometry]);

const celestials = useMapCelestials(celestialSystemIds);

const layers = useMemo(() => {
  if (!geometry) return [];

  const gates = celestials.filter((c) => c.kind === MapCelestialKind.Gate);

  const stack: Layer[] = [
    new LineLayer(
      edgesLayerProps({
        segments: edgeSegments(geometry.edges, geometry.nodes, origin, gates),
      }),
    ),
    new ScatterplotLayer(systemsLayerProps({ nodes: geometry.nodes, origin })),
  ];

  if (streamsInteriors(bucket)) {
    stack.push(
      new ScatterplotLayer(
        celestialsLayerProps({
          id: CELESTIALS_LAYER_ID,
          celestials,
          kinds: INTERIOR_KINDS,
          systemById,
          origin,
        }),
      ),
    );
  }

  if (showsMoonsAndBelts(bucket)) {
    stack.push(
      new ScatterplotLayer(
        celestialsLayerProps({
          id: FINE_LAYER_ID,
          celestials,
          kinds: FINE_KINDS,
          systemById,
          origin,
        }),
      ),
    );
  }

  return stack;
}, [geometry, origin, celestials, bucket, systemById]);
```

Import bloğuna eklenenler:

```tsx
import type { Layer } from '@deck.gl/core';
import { MapCelestialKind } from '@/generated/graphql';
import {
  FINE_KINDS,
  INTERIOR_KINDS,
  CELESTIALS_LAYER_ID,
  celestialsLayerProps,
  FINE_LAYER_ID,
} from './layers';
import { useMapCelestials } from './useMapCelestials';
import {
  lodBucket,
  showsMoonsAndBelts,
  streamsInteriors,
} from '@/utils/map/lod';
import { gateNeighbours } from '@/utils/map/topology';
import { nearestNode, originFor } from '@/utils/map/origin';
```

`boundsCenter` artık doğrudan kullanılmıyor (`originFor` onu sarıyor) — import'tan çıkar.

- [ ] **Step 2: Spec'e testleri ekle**

```tsx
it('keeps the origin at the scene centre while the galaxy is on screen', () => {
  render(<UniverseMap scope={MapScope.NewEden} />);

  // Autofit zoom is far below the interior threshold, so no focus exists and
  // the target is the scene centre itself.
  expect(currentViewState().target).toEqual([0, 0, 0]);
  const { layers } = deckProps.at(-1) as { layers: { id: string }[] };
  expect(layers.map((l) => l.id)).toEqual(['map-gates', 'map-systems']);
});

it('adds the interior layer once the zoom passes the interior threshold', () => {
  // -36.18 is the absolute threshold; the URL carries it directly.
  searchParams = new URLSearchParams('x=3e17&z=2e17&zoom=-36');
  render(<UniverseMap scope={MapScope.NewEden} />);

  const { layers } = deckProps.at(-1) as { layers: { id: string }[] };
  expect(layers.map((l) => l.id)).toEqual([
    'map-gates',
    'map-systems',
    'map-celestials',
  ]);
});

it('adds moons and belts only in the fine bucket', () => {
  searchParams = new URLSearchParams('x=3e17&z=2e17&zoom=-26');
  render(<UniverseMap scope={MapScope.NewEden} />);

  const { layers } = deckProps.at(-1) as { layers: { id: string }[] };
  expect(layers.map((l) => l.id)).toEqual([
    'map-gates',
    'map-systems',
    'map-celestials',
    'map-celestials-fine',
  ]);
});

it('moves the origin onto the focused system above the threshold', () => {
  // The fixture has one node at (3e17, 2e17). Focused, it becomes the origin,
  // so the target it sits at is [0, 0] — with the scene centre as origin the
  // same camera would be 2e17 away.
  searchParams = new URLSearchParams('x=3e17&z=2e17&zoom=-36');
  render(<UniverseMap scope={MapScope.NewEden} />);

  const { target } = currentViewState();
  expect(target[0]).toBeCloseTo(0, -6);
  expect(target[1]).toBeCloseTo(0, -6);
});

it('asks for the focused system and its gate neighbours, sorted', () => {
  searchParams = new URLSearchParams('x=3e17&z=2e17&zoom=-36');
  render(<UniverseMap scope={MapScope.NewEden} />);

  expect(lastCelestialsVariables).toEqual({ systemIds: [30000142] });
});

it('raises the ceiling to the absolute maximum, not thirteen levels above the fit', () => {
  render(<UniverseMap scope={MapScope.NewEden} />);

  expect(currentViewState().maxZoom).toBeCloseTo(MAX_ZOOM, 6);
});
```

Spec'in `@/generated/graphql` mock'una `MapCelestialKind` ve
`useMapCelestialsQuery` eklenmesi gerekiyor; `useMapCelestialsQuery` çağrıldığı
değişkenleri `lastCelestialsVariables`'a yazıyor ve `GEOMETRY`'nin tek düğümüne
karşılık gelen boş bir liste döndürüyor:

```tsx
let lastCelestialsVariables: unknown;
// inside the existing vi.mock('@/generated/graphql', ...) factory:
  MapCelestialKind: {
    Star: 'STAR', Planet: 'PLANET', Moon: 'MOON',
    Belt: 'BELT', Station: 'STATION', Gate: 'GATE',
  },
  useMapCelestialsQuery: (options: { variables: unknown; skip?: boolean }) => {
    lastCelestialsVariables = options.skip ? undefined : options.variables;
    return { data: { mapCelestials: [] } };
  },
```

`beforeEach`'e `lastCelestialsVariables = undefined;` ekle.

- [ ] **Step 3: Testleri çalıştır ve commit**

```bash
yarn workspace frontend test src/components/UniverseMap
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/UniverseMap/*.tsx
git add frontend/src/components/UniverseMap/
git commit -m "feat(frontend): stream system interiors and follow the focused origin"
```

---

## Task 8: Tam doğrulama

Faz 1'in Task 8'iyle aynı sıra ve aynı kurallar. Değişen beklentiler:

- Test sayıları: Faz 1'in tabanı backend 656 / frontend 342. Bu faz backend'e
  **14** ekliyor (`map-celestials.service`), frontend'e **47**:

  | Dosya                  |                             Ekleniyor |
  | ---------------------- | ------------------------------------: |
  | `lod.spec.ts`          |                                    12 |
  | `topology.spec.ts`     |                                     4 |
  | `origin.spec.ts`       |                                     7 |
  | `camera.spec.ts`       |           3 yeni − 1 değişen = **+2** |
  | `layers.spec.ts`       | Task 5'ten 11 + Task 6'dan 5 = **16** |
  | `UniverseMap.spec.tsx` |                                     6 |
  | **toplam**             |                                **47** |

  Beklenen: **670 / 389**.

- `lint` kabul kriteri `main`'in sayısı, **sıfır fark**.
- `frontend build:check` çalışıyor ve `/map` rota listesinde.
- `prettier --check .` temiz.
- Canlı doğrulama: `mapGeometry` üç sahne değişmemiş (5241/6959, 27/30,
  2604/0) **ve** `mapCelestials([30000142])` medyan 59 civarı nesne, tek
  yıldız (0,0)'da, her geçidin hedefi dolu, 17 sistem reddediliyor.

- [ ] **Step 9: Kullanıcıya ne bakacağını söyle**

Bu fazda gözle doğrulanacaklar:

- Zoom'un dibine inerken **nokta diskin içine açılıyor**: yıldız merkezde,
  gezegenler yörüngelerinde, istasyonlar ve geçitler yerlerinde.
- **Gate hatları merkezden gerçek geçitlere kayıyor** — bu fazın imza anı.
  Komşusu henüz yüklenmemiş bir hattın öteki ucu merkezde kalıyor, bu doğru.
- Bir komşuya pan yapmak takılmıyor (komşular önceden çekiliyor).
- En dipte aylar ve kuşaklar görünüyor, gezegenlerinden ayrışmış.
- Ayların en yakın %5'i hiçbir zoomda gezegeninden ayrılmıyor — spec'in
  dürüstlük maddesi, bir kusur değil.
- Eşik **ekran genişliğinden bağımsız**: pencereyi daraltıp genişletince sistem
  içi aynı zoom'da açılıyor.

---

## Self-review

| Spec bölümü                       | Faz 2 kapsamı                  | Task |
| --------------------------------- | ------------------------------ | ---- |
| `mapCelestials` şeması ve servisi | Tamamı                         | 1, 2 |
| Sistem başına önbellek            | Tamamı (`mget` + `pipeline`)   | 1    |
| Zoom merdiveni ve LOD             | Tamamı, mutlak eşiklerle       | 3    |
| Kayan orijin (odaklı sistem)      | Tamamı                         | 3, 7 |
| Sistem içi veri akışı, 16 sınırı  | Tamamı                         | 1, 4 |
| Gate uçlarının çapalanması        | Tamamı                         | 6    |
| Katman yığını: celestial + ince   | Tamamı                         | 5, 7 |
| Etiketler (`TextLayer`)           | **Kapsam dışı** — kendi dilimi | —    |
| Picking, popup, `?focus=`         | **Kapsam dışı** — faz 3        | —    |
| Aktivite, sovereignty             | **Kapsam dışı** — faz 4        | —    |

Kabul kriterleri:

| Kriter                                            | Nerede                                   |
| ------------------------------------------------- | ---------------------------------------- |
| Hiçbir katmana ham galaktik koordinat girmiyor    | `layers.spec.ts`, `origin.spec.ts`       |
| Celestial koordinatları yuvarlanmamış             | Task 1 spec + Step 6                     |
| `mapCelestials` 16'dan fazlasını reddediyor       | Task 1 spec + Task 2 Step 6              |
| LOD eşikleri ölçülen fiziksel mesafelerle birebir | `lod.spec.ts`                            |
| Orijin eşiğin üstünde odaklı sisteme geçiyor      | `origin.spec.ts`, `UniverseMap.spec.tsx` |
| Gate ucu yüklü uçta gerçek stargate'e oturuyor    | `layers.spec.ts`                         |
| Eşikler ekran genişliğinden bağımsız              | `lod.spec.ts` + gözle                    |
