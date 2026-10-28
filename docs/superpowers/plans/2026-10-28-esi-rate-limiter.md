# ESI istemcisi ve header'a bakan rate limiter — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Backend'in ESI'ye giden bütün istekleri tek bir `esiClient`
üzerinden gitsin. Limiter ESI'nin yanıt header'larına bakarak kendisi
yavaşlasın ve dursun.

**Mimari:** `rate-limiter.ts` bir _fonksiyon sarmalayıcısı_ olmaktan çıkıyor.
Yerine istek başına çalışan üç metodu oluyor: `acquire`, `release` ve
`observe`. `esi-client.ts` bir axios instance kuruyor ve bu metotları
interceptor'larında çağırıyor. 23 dosya bu istemciye taşınıyor, `execute`
siliniyor.

**Teknoloji:** TypeScript (NodeNext), axios 1.x, Vitest 5 (fake timer),
RabbitMQ (`amqplib`).

**Spec:** `docs/superpowers/specs/2026-10-28-esi-rate-limiter-design.md`.
Executor'lar planı ve spec'i birlikte okur. `§` referansları spec'e işaret
eder.

## Global kısıtlar

- Yarn, asla npm. Testler: `cd backend && yarn vitest run <dosya>`. Tam set:
  `yarn workspace backend test` ve `yarn workspace backend build`.
- `User-Agent: KillReport/<backend/package.json version> (+https://github.com/umutyerebakmaz/killreport)`.
- `X-Compatibility-Date: 2020-01-01`.
- `ESI_MAX_RPS` varsayılanı **50** kalır. Bu uyarlanan hızın tavanı.
- Error limit eşiği: `X-ESI-Error-Limit-Remain` **< 20** olunca fren kurulur.
- Fren için varsayılan süre **60 sn**, üst sınır **15 dk**.
- AIMD: header'sız 429'da hız yarıya iner, en az **1** req/sn. 429 gelmeyen
  her **10 sn**'de **+1** req/sn artar, en fazla `ESI_MAX_RPS`'e kadar.
- Gruplu yavaşlama: `remaining` < limitin **%20**'si ise istekler arasında
  en az `window / (remaining / 2)` bekleme. `remaining` **< 2** ise istek
  gönderilmez, bucket beklenir.
- `maxWaitMs`: worker'larda sınırsız. API sunucusunda ve
  `worker-redisq-stream`'de **10 000**.
- Kod, yorumlar, commit mesajları ve `backend/docs` İngilizce. Commit
  başlıkları `type(scope):`'tan sonra küçük harf. Claude attribution yok.
- Generated dosyalara dokunulmaz. `.env`'ye dokunulmaz.

## Review'da dikkat

Spec'te dile getirilmeyen ama gerçekte karşılaşılacak beş durum:

1. **Patlama halinde gelen 429'lar.** Prefetch 25 ile aynı anda 25 istek
   uçuşta olabilir, hepsi header'sız 429 dönebilir. Hız 25 kez yarıya
   inmemeli (50 → 1). Bir fren süresi içinde gelen ikinci ve sonraki 429'lar
   hızı yeniden düşürmez. Test: Task 1.
2. **Bozuk ya da eksik header'lar.** `Retry-After: abc`, `Retry-After` hiç
   yok, `X-ESI-Error-Limit-Reset: 0`. Bunlarda fren `NaN` olmamalı ve
   sonsuza kadar sürmemeli. Sayı değilse 60 sn kullanılır, 0 ya da negatifse
   fren kurulmaz. Test: Task 1.
3. **Query string ve hash'li path'ler.**
   `/characters/1/killmails/recent/?page=3` ile `?page=1` aynı gruba
   eşlenmeli. 40 haneli hex killmail hash'i `{hash}` olmalı. Aksi halde her
   sayfa ve her killmail ayrı bir "bilinmeyen route" sayılır. Test: Task 2.
4. **Farklı karakterlerin bucket'ları.** `char-killmail`'de A karakterinin
   bucket'ı bitince B'nin istekleri beklememeli. Test: Task 2.
5. **Yarıda kalan istekler slot sızdırmamalı.** `acquire`'dan sonra network
   hatası, timeout ya da axios iptali olsa da `release` çağrılmalı, yoksa
   `maxConcurrent` yavaş yavaş dolar ve worker kilitlenir. Test: Task 3.

---

### Task 1: Limiter — fren, AIMD, `maxWaitMs`

**Dosyalar:**

- Değiştir: `backend/src/services/rate-limiter.ts` (bütün dosya)
- Test: `backend/src/services/rate-limiter.spec.ts` (mevcut `execute`
  testleri kalır, yenileri eklenir)

**Arayüzler:**

- Üretir (`rate-limiter.ts`'den export):

```ts
export type EsiThrottleKind = 'error-limit' | 'rate-limit' | 'deep-limit';

export class EsiThrottledError extends Error {
  readonly status: 420 | 429;
  readonly kind: EsiThrottleKind;
  /** worker-error.ts reads `response.status`; keep that shape. */
  readonly response: { status: 420 | 429 };
  constructor(status: 420 | 429, kind: EsiThrottleKind, message: string);
}

export interface EsiRoute {
  /** request path, e.g. '/killmails/123/abc.../' — query string allowed */
  path: string;
  /** separates per-character buckets (authenticated routes); omit for public */
  bucketKey?: string;
}

class RateLimiter {
  acquire(route: EsiRoute, opts?: { maxWaitMs?: number }): Promise<void>;
  release(): void;
  observe(
    route: EsiRoute,
    status: number,
    headers: Record<string, string | undefined>,
  ): void;
  execute<T>(fn: () => Promise<T>): Promise<T>; // kept until Task 7
  getStats(): {
    queueLength: number;
    currentRate: number;
    pausedUntil: number;
    maxRequestsPerSecond: number;
  };
}
export const esiRateLimiter: RateLimiter;
```

- `headers` anahtarları küçük harfli gelir (axios öyle veriyor):
  `x-esi-error-limit-remain`, `x-esi-error-limit-reset`, `retry-after`,
  `x-ratelimit-group`, `x-ratelimit-limit`, `x-ratelimit-remaining`.
- Bu task'ta `observe` gruplu header'ları (`x-ratelimit-*`) **yok sayar**.
  Onları Task 2 ekliyor. Ama 429 + `x-ratelimit-group` varsa process freni
  kurmaz, yalnızca fren kurmadan döner. Task 2 o yolu dolduracak.

- [ ] **Adım 1: Failing testleri yaz.** Mevcut `limiterAt(rps)` helper'ı
      kullanılır, zaman `vi.advanceTimersByTimeAsync` ile ilerletilir.
      `acquire` hemen çözülüyor mu, `await` ile ölçülür.

```ts
describe('esiRateLimiter brake', () => {
  it('a 420 holds every acquire until X-ESI-Error-Limit-Reset elapses', ...);
  //   observe(route, 420, { 'x-esi-error-limit-reset': '30' })
  //   acquire() not settled at 29_999 ms, settled by 30_000 ms
  it('a 420 without a reset header pauses 60 s', ...);
  it('error-limit-remain 19 pauses for the reset; 20 does not', ...);
  it('error-limit-reset 0 or negative never pauses', ...);
  it('a header-less 429 pauses for Retry-After, 60 s if missing or not a number', ...);
  //   'retry-after': 'abc' → 60_000
  it('caps any pause at 15 minutes', ...);
  //   'x-esi-error-limit-reset': '99999' → settled by 900_000 ms
  it('a shorter pause never shortens a longer one already in force', ...);
  it('a 429 that carries x-ratelimit-group does not set the process brake', ...);
});

describe('esiRateLimiter adaptive rate', () => {
  it('a header-less 429 halves the rate', ...);
  //   limiterAt(50); observe 429 → getStats().currentRate === 25
  it('never goes below 1 req/s', ...);
  it('429s that arrive while a pause is in force halve only once', ...);
  //   25 observe(429) calls in a row → currentRate === 25, not 0/1
  it('climbs +1 req/s per 10 s without a 429, up to ESI_MAX_RPS', ...);
  //   after halving to 25: +10 s → 26, +250 s → 50, +∞ → 50
});

describe('esiRateLimiter maxWaitMs', () => {
  it('rejects with EsiThrottledError when the brake outlasts maxWaitMs', ...);
  //   pause 60 s; acquire(route, { maxWaitMs: 10_000 }) rejects immediately,
  //   error.status === 429 (420 if the brake came from a 420),
  //   error.response.status matches
  it('waits when the brake ends within maxWaitMs', ...);
  it('without maxWaitMs waits out the whole brake', ...);
});
```

- [ ] **Adım 2: Failing olduğunu gör.**
      `cd backend && yarn vitest run src/services/rate-limiter.spec.ts`
      Beklenen: yeni testler FAIL (`acquire is not a function` ya da
      benzeri), eski `execute` testleri PASS.

- [ ] **Adım 3: Uygula.** Mevcut dağıtım döngüsü (`processQueue`) kalır.
      Değişenler şunlar:
  - Döngü `queue`'dan önce `pausedUntil`'e bakar. Fren varsa
    `pausedUntil - now` kadar uyur.
  - Saniyedeki tavan sabit `maxRequestsPerSecond` değil, artık
    `currentRate`.
  - `acquire`, `execute`'un kuyruğuna bir "slot verildi" callback'i koyar.
    `execute` de `acquire` + `fn` + `finally release` olarak yeniden yazılır.
    Böylece Task 7'ye kadar eski çağıranlar çalışmaya devam eder.
  - `maxWaitMs` kontrolü `acquire`'ın girişinde yapılır: fren
    `now + maxWaitMs`'ten sonra bitiyorsa hemen `EsiThrottledError` fırlatılır.
  - AIMD artışı, ayrı bir timer kurulmadan döngünün içinde hesaplanır: son
    429'dan bu yana geçen tam 10 sn sayısı kadar +1.
  - Fren kaynağı (420 mi, 429 mu), `EsiThrottledError`'ın `status`'u için
    saklanır.
  - Dosyanın başındaki "150 requests per second" yorumu §2'ye göre yeniden
    yazılır: iki sistem, header'lar.

- [ ] **Adım 4: Geçtiğini gör.** Aynı komut. Beklenen: hepsi PASS.

- [ ] **Adım 5: Commit.**
      `feat(esi): brake and adapt the esi limiter on throttling responses`

---

### Task 2: Limiter — route grubu bucket'ları

**Dosyalar:**

- Değiştir: `backend/src/services/rate-limiter.ts`
- Test: `backend/src/services/rate-limiter.spec.ts`

**Arayüzler:**

- Kullanır: Task 1'deki `acquire` / `observe` / `EsiRoute`.
- Üretir: `export function routeTemplate(path: string): string`. Query
  string'i atar, sayısal segmentleri `{id}`'ye, `/^[0-9a-f]{40}$/`
  segmentini `{hash}`'e çevirir. Sondaki `/` korunur.

- [ ] **Adım 1: Failing testleri yaz.**

```ts
describe('routeTemplate', () => {
  it('maps ids and the killmail hash', () =>
    expect(routeTemplate('/killmails/123/0a1b...(40 hex)/')).toBe(
      '/killmails/{id}/{hash}/',
    ));
  it('drops the query string', () =>
    expect(routeTemplate('/characters/9/killmails/recent/?page=3')).toBe(
      '/characters/{id}/killmails/recent/',
    ));
});

describe('esiRateLimiter group buckets', () => {
  // headers: { 'x-ratelimit-group': 'killmail',
  //            'x-ratelimit-limit': '3600/15m', 'x-ratelimit-remaining': N }
  it('above 20% remaining, a grouped route is not spaced', ...);
  it('below 20% remaining, spaces requests window / (remaining / 2) apart', ...);
  //   limit 3600/15m, remaining 600 → 900_000 / 300 = 3_000 ms between acquires
  it('remaining below 2 holds the request until a token is due back', ...);
  //   remaining 1 → acquire not settled at once; settled after window/limit*2 = 500 ms
  it('a grouped 429 pauses only that group for Retry-After', ...);
  //   group A paused 30 s; acquire on group B and on an ungrouped path settle at once
  it('a fresh response replaces the remembered remaining', ...);
  it('separates buckets by bucketKey', ...);
  //   char-killmail, bucketKey '1' at remaining 0; bucketKey '2' settles at once
  it('an unseen route template is not spaced', ...);
  it('parses limits in hours as well as minutes', ...);
  //   '150/1h' → window 3_600_000
});
```

- [ ] **Adım 2: Failing olduğunu gör.** Aynı komut. Beklenen: yeni testler
      FAIL.

- [ ] **Adım 3: Uygula.** State iki `Map`'te tutulur:
  - `template → group`. `observe`'de `x-ratelimit-group` görülünce
    öğrenilir.
  - `group + ':' + (bucketKey ?? '')` → `{ limit, windowMs, remaining,
updatedAt, nextAllowedAt, pausedUntil }`.
  - `acquire`, process freni ve taban hızın yanında bu bucket'ın
    `nextAllowedAt` / `pausedUntil` değerlerine de bakar. Gruplu bir route
    beklerken kuyruktaki diğer route'ları bloklamamalı. Bu yüzden bekleyen
    istek kuyruğun başında tutulmaz, kendi timer'ıyla yeniden kuyruğa girer.
  - `maxWaitMs` gruplu beklemelere de uygulanır. Aşılırsa
    `EsiThrottledError(429, 'rate-limit')`.

- [ ] **Adım 4: Geçtiğini gör.** Beklenen: hepsi PASS.

- [ ] **Adım 5: Commit.**
      `feat(esi): pace grouped esi routes by their token bucket`

---

### Task 3: `esiClient`

**Dosyalar:**

- Oluştur: `backend/src/services/esi-client.ts`
- Test: `backend/src/services/esi-client.spec.ts`

**Arayüzler:**

- Kullanır: Task 1–2'deki `esiRateLimiter`, `EsiThrottledError`.
- Üretir:

```ts
export interface EsiRequestOptions {
  params?: Record<string, string | number>;
  headers?: Record<string, string>; // e.g. Authorization
  bucketKey?: string; // character id for authenticated grouped routes
}
export const esiClient: {
  get<T = unknown>(
    path: string,
    opts?: EsiRequestOptions,
  ): Promise<AxiosResponse<T>>;
};
/** process-wide; called once at startup by the API server and the live stream */
export function setEsiMaxWait(ms: number | undefined): void;
```

- `path` `/` ile başlar, base URL'yi içermez:
  `esiClient.get('/universe/types/34/')`.
- 420 ve 429 axios hataları `EsiThrottledError`'a çevrilerek fırlatılır.
  Diğer hatalar axios hatası olarak kalır (`response.status` dolu).

- [ ] **Adım 1: Failing testleri yaz.** Gerçek ağa çıkılmaz. Axios
      instance'ına test adapter'ı verilir: `esiClient`'ı oluşturan iç
      fonksiyon `createEsiClient(adapter?)` olarak export edilir, ya da
      `axios-mock-adapter` gibi yeni bir bağımlılık eklenmeden
      `config.adapter` mock'lanır.

```ts
it('sends User-Agent with the package version and the repo URL', ...);
//   expect(req.headers['User-Agent']).toBe(`KillReport/${pkg.version} (+https://github.com/umutyerebakmaz/killreport)`)
it('sends X-Compatibility-Date 2020-01-01', ...);
it('prefixes https://esi.evetech.net', ...);
it('acquires before sending and releases after a 2xx', ...);
it('releases after a network error and after a 500', ...);  // Review focus 5
it('reports status and headers to the limiter on success and on error', ...);
it('turns a 429 into EsiThrottledError with status 429', ...);
it('turns a 420 into EsiThrottledError with status 420', ...);
it('leaves a 404 as an axios error with response.status 404', ...);
it('passes bucketKey and the process maxWait to acquire', ...);
//   setEsiMaxWait(10_000) → acquire called with { maxWaitMs: 10_000 }
```

- [ ] **Adım 2: Failing olduğunu gör.**
      `cd backend && yarn vitest run src/services/esi-client.spec.ts`
      Beklenen: FAIL, modül bulunamıyor.

- [ ] **Adım 3: Uygula.** `axios.create({ baseURL: 'https://esi.evetech.net',
headers: {...} })`. Sürüm `../../package.json`'dan import edilir
      (`resolveJsonModule` açık). `acquire`'ı istekten önce çağırmak için
      interceptor yerine `get`'in içinde açık bir `try/finally` kullanılır:
      `acquire` → `instance.get` → `observe` → `finally release`. Bu, Review
      Focus 5'i kendiliğinden garanti eder.

- [ ] **Adım 4: Geçtiğini gör.** Beklenen: PASS.

- [ ] **Adım 5: Commit.**
      `feat(esi): add a single esi client with user agent and compatibility date`

---

### Task 4: `handleWorkerError` — ESI freninde uyuma

**Dosyalar:**

- Değiştir: `backend/src/workers/worker-error.ts:145-158`
- Test: `backend/src/workers/worker-error.spec.ts`

**Arayüzler:**

- Kullanır: `EsiThrottledError` (`@services/rate-limiter`).

- [ ] **Adım 1: Failing testleri yaz.** Mevcut 420/429 testleri (60 sn
      bekleme) ESI dışı throttle için kalır.

```ts
it('requeues an EsiThrottledError at once, without sleeping or burning an attempt', ...);
//   handleWorkerError(channel, message(2), q, new EsiThrottledError(429,'deep-limit','x'), logger)
//   resolves without advancing timers; nack(msg, false, true); no publish to parking
it('still sleeps 60 s for a 429 that did not come from esiClient', ...);
//   plain { response: { status: 429 } } — zKillboard's shape
```

- [ ] **Adım 2: Failing olduğunu gör.**
      `cd backend && yarn vitest run src/workers/worker-error.spec.ts`

- [ ] **Adım 3: Uygula.** `throttleStatus`'tan önce bir `instanceof
EsiThrottledError` dalı: tek satır log (`⏸ esi throttled (<kind>),
requeueing`), `nack(msg, false, true)`, return. Yorum bunun nedenini
      söyler: fren limiter'da, mesaj geri gelince orada bekler.

- [ ] **Adım 4: Geçtiğini gör.**

- [ ] **Adım 5: Commit.**
      `feat(workers): requeue esi-throttled messages without sleeping`

---

### Task 5: Public servisleri `esiClient`'a taşı

**Dosyalar (değiştir):**
`services/{alliance,category,constellation,dogma/dogma-attribute,dogma/dogma-effect,faction,item-group,market,race,region,solar-system,sovereignty,type,universe}/*.service.ts`
— 14 dosya, hepsi `axios.get`.

**Arayüzler:**

- Kullanır: `esiClient.get` (Task 3).

Her dosyada aynı mekanik değişiklik yapılır:

- `esiRateLimiter.execute(async () => { ... axios.get(`${ESI_BASE_URL}/x`) ... })`
  → `esiClient.get('/x')`.
- `ESI_BASE_URL` sabiti ve `axios` import'u silinir. Dönüş tipleri ve
  davranış aynı kalır. Path'ler olduğu gibi taşınır, `/latest/...`
  önekleri dahil (§3 kapsam dışı).
- **Yutan döngüler (§4.3):** `catch` içinde loglayıp devam eden ve ESI
  çağıran her döngüye, `catch`'in başında
  `if (error instanceof EsiThrottledError) throw error;` eklenir. Bilinen
  örnek `type.service.ts:28-45`. Diğerlerini bulmak için:
  `grep -n "catch" <dosya>`. Liste commit mesajına yazılır.

- [ ] **Adım 1: Failing test yaz.**
      `backend/src/services/type/type.service.spec.ts` (yeni):
      `esiClient.get` mock'lanır. İkinci grup için `EsiThrottledError`
      fırlatılır. `TypeService.getTypeIds()` reject etmeli, eksik bir liste
      döndürmemeli. Grup yolunda düz bir 500 hatası alınırsa ise bugünkü gibi
      loglanıp devam edilmeli.

- [ ] **Adım 2: Failing olduğunu gör.**
      `cd backend && yarn vitest run src/services/type/type.service.spec.ts`

- [ ] **Adım 3: 14 dosyayı taşı.**

- [ ] **Adım 4: Doğrula.**
      `yarn workspace backend build`: tip hatası yok.
      `yarn workspace backend test`: hepsi PASS.
      `grep -n "ESI_BASE_URL\|esiRateLimiter" <14 dosya>`: boş.

- [ ] **Adım 5: Commit.**
      `refactor(esi): move the public esi services onto the esi client`

---

### Task 6: `fetch` kullanan servisleri taşı

**Dosyalar (değiştir):**

- `services/character/character.service.ts`: `fetch` 83 ve 174. Beklemeler
  74, 77, 168. Retry 160-175.
- `services/corporation/corporation.service.ts`: `fetch` 52 ve 154. Bekleme 135. Retry 138-150.
- `services/killmail/killmail.service.ts:75`: `getKillmailDetail`.

**Arayüzler:**

- Kullanır: `esiClient.get(path, { headers: { Authorization }, bucketKey })`.
- `killmails/recent` çağrılarında `bucketKey` olarak karakterin id'si
  (`String(characterId)`) verilir. Corporation tarafında token'ın
  karakteri hangisiyse onun id'si verilir. Fonksiyonun bugünkü
  parametrelerinde bu bilgi yoksa çağıran zinciri buna göre genişletilir.

- [ ] **Adım 1: Failing testleri yaz.**
      `character.service.spec.ts` ve `corporation.service.spec.ts` (yeni).
      `esiClient.get` mock'lanır.

```ts
it('stops paging on a 404 and returns what it has', ...);          // bugünkü davranış korunur
it('passes the character id as bucketKey', ...);
it('lets an EsiThrottledError through instead of retrying', ...);  // eski 5 sn retry yok
it('does not sleep between pages', ...);                           // fake timers: resolves without advancing
```

      `killmail.service.spec.ts`: 404 axios hatası olarak gelir, 200
      `data`'yı döndürür.

- [ ] **Adım 2: Failing olduğunu gör.**

- [ ] **Adım 3: Taşı.** `fetch` yerine `esiClient.get` gelir.
      `response.ok` kontrolleri `try/catch` + `error.response?.status ===
404` olur. Elle yazılmış beklemeler ve retry'lar silinir.
      `worker-error.ts:46-49`'daki yorumda bu üç servis `fetch` kullanıcısı
      olarak geçiyor. Yorum yalnızca `zkillboard.ts`'i sayacak şekilde
      güncellenir, fallback kodu kalır.

- [ ] **Adım 4: Doğrula.** İlgili spec'ler, `build`, `test`.

- [ ] **Adım 5: Commit.**
      `refactor(esi): move the fetch-based esi services onto the esi client`

---

### Task 7: Kalan çağıranlar, `execute`'un silinmesi, koruma testi

**Dosyalar:**

- Değiştir: `workers/worker-{bloodlines,constellations,regions}.ts`
  (`worker-constellations.ts:34-40` ve `worker-regions.ts:34-40`'daki elle
  error-limit kontrolü silinir). `worker-bloodlines.ts:4`'teki URL yorumu da
  düzeltilir.
- Değiştir: `resolvers/{region,alliance,constellation}/mutations.ts`
  (yalnızca çağrı `esiClient.get` olur, akış aynı kalır, §3 kapsam dışı).
- Değiştir: `server.ts`: `ensureAllQueuesExist()`'ten önce
  `setEsiMaxWait(10_000)`. Ayrıca `workers/worker-redisq-stream.ts`'in
  başlangıcına da `setEsiMaxWait(10_000)`.
- Değiştir: `services/rate-limiter.ts`: `execute` ve testleri silinir.
- Oluştur: `backend/src/services/esi-client.guard.spec.ts`.

**Arayüzler:**

- Kullanır: `esiClient`, `setEsiMaxWait`.

- [ ] **Adım 1: Koruma testini yaz.** `backend/src` altındaki her `.ts`
      dosyası `fs.readdirSync(..., { recursive: true })` ile okunur.
      `*.spec.ts`, `generated-*` ve `src/generated/` hariç tutulur.

```ts
it('only esi-client.ts names esi.evetech.net', () =>
  expect(filesContaining('esi.evetech.net')).toEqual([
    'services/esi-client.ts',
  ]));
it('nothing calls esiRateLimiter.execute', () =>
  expect(filesContaining('esiRateLimiter.execute')).toEqual([]));
```

- [ ] **Adım 2: Failing olduğunu gör.** Beklenen: 6 dosya listelenir.

- [ ] **Adım 3: Taşı, `setEsiMaxWait`'i bağla, `execute`'u sil.**

- [ ] **Adım 4: Doğrula.** `yarn workspace backend build`, `yarn workspace
backend test`: hepsi PASS.

- [ ] **Adım 5: Commit.**
      `refactor(esi): route every esi call through the esi client`

---

### Task 8: Config ve dokümanlar

**Dosyalar (değiştir):**

- `backend/src/config/config.ts:37-40`: varsayılan `50` kalır. Yorum
  yeniden yazılır: "Upper bound for the adaptive rate; the limiter finds the
  real rate from ESI's responses. ESI publishes no single req/sec ceiling —
  see services/rate-limiter.ts."
- `CLAUDE.md`, "Rate limiting" bölümü ve "Every worker copies the same
  error handling" paragrafı (§6). "Never call ESI directly…" cümlesine
  "every request goes through `esiClient`" eklenir.
- `backend/docs/`: `ops/universe-topology-run.md`,
  `workers/alliance-corporation.md`, `redis-cache/redisq-stream.md`,
  `esi/esi-user-killmails-queue.md`, `workers/type-enrichment-workers.md`,
  `workers/character-corporation-history.md`,
  `workers/alliance-corporation-character-enrichment.md`,
  `workers/worker-documentation.md`. Yalnızca 50 req/sec, 150 req/sec ve
  `esiRateLimiter.execute` geçen cümleler düzeltilir.

- [ ] **Adım 1: Düzenle.**
- [ ] **Adım 2: Doğrula.**
      `grep -rn "150 req\|50 req/sec\|esiRateLimiter.execute" CLAUDE.md backend/docs backend/src`:
      boş. `npx prettier --check` değişen dosyalarda geçmeli. CLAUDE.md'deki
      link komutu yeni kırık link göstermemeli.
- [ ] **Adım 3: Commit.**
      `docs(esi): describe the esi client and header-driven limiter`

---

### Task 9: Gerçek çalıştırma (kullanıcıyla birlikte)

Kod değişmez, ölçüm yapılır (§7). Kullanıcının local ortamında yapılır.

- [ ] **Adım 1:** `ESI_MAX_RPS` ve `ESI_PREFETCH` verilmeden,
      `esi_character_corporation_history_queue`'ya birkaç bin karakter
      kuyruğa alınır ve worker çalıştırılır.
- [ ] **Adım 2:** Loglardan şunlar sayılır: 429 sayısı, ardışık 429
      dizileri, limiter'ın oturduğu hız (`getStats().currentRate`, fren
      log'larında). Beklenen: hız ~15-20 req/s civarına oturur, 429'lar seyrek
      ve tek tek gelir.
- [ ] **Adım 3:** Aynı anda ikinci bir ESI worker'ı (`worker:info:types`
      gibi) çalıştırılır. İki process de error limit header'ını görüp fren
      kurabilmeli (§4.5).
- [ ] **Adım 4:** Sonuçlar PR gövdesinin `## Verification` bölümüne,
      gerçek sayılarla yazılır.
