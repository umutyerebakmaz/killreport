# Merkezi ESI limiter — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Node ve Rust'taki her ESI isteği, Redis'te tutulan tek bir ortak fren
ve hız bütçesinden geçsin. Canlı istekler öncelikli olsun, Redis'e
ulaşılamazsa bugünkü yerel limiter devreye girsin.

**Architecture:** Ortak kural iki Lua script'inde (`acquire.lua`,
`observe.lua`). Node ve Rust bunları aynı dosyadan yükler, Redis atomik
çalıştırır. Her dilde bir "store" katmanı script'leri çağırır, onun üstünde
bir "shared limiter" süreç içi kuyruğu, `maxWaitMs`'i, eşzamanlılık tavanını
ve yerel moda dönüşü yönetir. Bugünkü `RateLimiter` (Node) ve `RateLimiter`
(Rust) dönüş yolu olarak olduğu gibi kalır.

**Tech Stack:** Redis + Lua, Node (`ioredis`, vitest), Rust (`redis` crate,
tokio, `cargo test`).

**Spec:** `docs/superpowers/specs/2026-11-14-shared-esi-limiter-design.md`

## Global Constraints

- Sabitler `rate-limiter.ts` ile birebir: `ERROR_LIMIT_FLOOR = 20`,
  `DEFAULT_PAUSE_MS = 60_000`, `DEEP_LIMIT_PAUSE_MS = 15_000`,
  `RATE_DECREASE = 0.75`, `MAX_PAUSE_MS = 15 * 60_000`,
  `RATE_CLIMB_INTERVAL_MS = 10_000`, `LOW_TOKEN_SHARE = 0.2`,
  `SUCCESS_TOKEN_COST = 2`.
- `FLOOR = 5`. Kova kapasitesi `max(FLOOR + 1, currentRate)`.
- `bulk` alır: `tokens - 1 >= FLOOR`. `live` alır: `tokens >= 1`.
- `currentRate = min(maxRps, rateBase + floor((now - max(loweredAt, pausedUntil)) / 10_000))`.
- Hız düşüşü bütün route'lara uygulanır (spec §4.2).
- Anahtar öneki üretimde `esi-limiter:`, küçük harf. Testler kendi rastgele
  önekini kullanır ve **yalnızca kendi anahtarlarını** siler. `FLUSHDB`,
  `FLUSHALL`, `SCRIPT FLUSH` ve `KEYS *` silme **yasak**: Redis yerelde
  başka verilerle paylaşılıyor.
- Grup bucket anahtarlarına TTL `windowMs + 60_000` ms. `global` ve `groups`
  TTL'siz.
- Zaman, `now` argümanı boşsa Redis `TIME`'ından. `now` yalnızca testler için.
- Redis çağrı zaman aşımı 200 ms. Yerel moddan çıkış denemesi 10 sn'de bir.
  Yerel moda giriş ve çıkış birer kez loglanır.
- `ESI_MAX_RPS` toplam tavan, varsayılan 50.
- `REDIS_URL` varsayılanı iki dilde de `redis://localhost:6379`.
- `live`: yalnızca `server.ts` ve `worker-redisq-stream.ts`. Diğer her şey
  ve bütün Rust worker'ları `bulk`.
- `esi-client.ts`'i çağıran 27 dosyaya ve Rust worker'larının koduna
  dokunulmaz.
- Kod, yorum ve commit mesajları İngilizce. Commit'lerde Claude imzası yok.
- `.env` okunabilir, asla düzenlenmez.

## Review Focus

1. **Redis yavaş ama açık:** bir script çağrısı asılı kalırsa `acquire`
   200 ms sonra yerel limiter'a geçmeli, sonsuza kadar beklememeli. Test:
   Task 2 ve Task 4.
2. **Başka sürecin kurduğu uzun fren ve `maxWaitMs`'li canlı çağıran:**
   fren 10 sn'den uzunsa çağıran beklemeden `EsiThrottledError` almalı.
   Test: Task 2.
3. **Fren sırasında yeniden başlayan süreç:** yeni bağlanan bir istemci
   Redis'teki freni görmeli, 50 req/s'den baştan başlamamalı. Test: Task 1
   senaryo tablosu (`client: "c"`).
4. **Redis yeniden başladı, script önbelleği boş:** `EVALSHA` `NOSCRIPT`
   dönünce `EVAL` ile yüklenip aynı çağrı başarıyla bitmeli. Test: Task 1 ve
   Task 3, `evalsha`'yı `NOSCRIPT` fırlatacak şekilde saptırarak.
5. **Aynı süreçte gruplu bekleyen bir istek diğer route'ları tıkamamalı.**
   Test: Task 2.

---

## Dosya yapısı

| Dosya                                                     | Sorumluluk                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `backend/src/services/esi-limiter/acquire.lua`            | Token alma kararı (yeni)                                   |
| `backend/src/services/esi-limiter/observe.lua`            | Yanıtı okuyup ortak durumu güncelleme (yeni)               |
| `backend/src/services/esi-limiter/scenarios.json`         | Node ve Rust'ın ikisinin de koştuğu senaryo tablosu (yeni) |
| `backend/src/services/esi-limiter/shared-store.ts`        | Node: script'leri yükleyip çağıran katman (yeni)           |
| `backend/src/services/esi-limiter/shared-rate-limiter.ts` | Node: kuyruk, maxWait, yerel moda dönüş (yeni)             |
| `backend/src/services/rate-limiter.ts`                    | Yerel limiter; sınıf ve parse yardımcıları export edilir   |
| `backend/src/services/esi-client.ts`                      | `esiLimiter`'ı kullanır, `setEsiPriority` eklenir          |
| `backend-rs/crates/esi/src/shared.rs`                     | Rust: store (yeni)                                         |
| `backend-rs/crates/esi/src/limiter.rs`                    | Rust: ortak yol + yerel dönüş                              |
| `.github/workflows/ci.yml`                                | `backend` ve `backend-rs` işlerine Redis servisi           |

---

### Task 1: Lua script'leri, senaryo tablosu ve Node store

**Files:**

- Create: `backend/src/services/esi-limiter/acquire.lua`,
  `observe.lua`, `scenarios.json`, `shared-store.ts`
- Test: `backend/src/services/esi-limiter/shared-store.spec.ts`
- Modify: `.github/workflows/ci.yml` (`backend` işi: `redis:7` servisi,
  `REDIS_URL: redis://localhost:6379`)

**Interfaces:**

- Produces (Lua, iki dilin de uyacağı sözleşme):
  - `acquire.lua` ARGV: `[1] prefix, [2] priority ('live'|'bulk'),
[3] template, [4] bucketKey ('' yoksa), [5] maxRps, [6] floor,
[7] now ms ('' ise TIME)`.
    Dönüş: `{1}` ya da `{0, waitMs, reason, detail}`; `reason` ∈
    `'brake'|'group'|'rate'`; `detail` fren için `"<status>:<kind>"`
    (ör. `"420:error-limit"`), grup için bucket anahtarı (`"<grup>:<bucketKey>"`),
    hız için `''`.
  - `observe.lua` ARGV: `[1] prefix, [2] template, [3] bucketKey, [4] status,
[5] group, [6] limit, [7] windowMs, [8] remaining, [9] errorRemain,
[10] errorResetMs, [11] retryAfterMs, [12] maxRps, [13] now`. Boş string
    "değer yok" demek.
    Dönüş: `{brakeMs, brakeStatus, brakeKind, groupKey, groupPauseMs, rate}`.
    `brakeMs` ve `groupPauseMs` yalnızca **yeni** (bugünkü `isNew` kuralı:
    mevcut bitişten en az 1000 ms ileri) bir duraklamada sıfırdan büyük.
  - Anahtarlar: `<prefix>global` (hash: `tokens, refilledAt, pausedUntil,
pauseStatus, pauseKind, rateBase, loweredAt`), `<prefix>groups` (hash:
    template → grup), `<prefix>bucket:<grup>:<bucketKey>` (hash: `limit,
windowMs, remaining, updatedAt, sentAt, nextAllowedAt, pausedUntil`).
    Eksik alanların başlangıcı: `tokens` = kapasite, `rateBase` = `maxRps`,
    `loweredAt` = `-1e15`, diğerleri 0; bucket'ta `limit`, `windowMs`,
    `remaining` "yok", `sentAt` = `-1e15`.
- Produces (Node, `shared-store.ts`):

  ```ts
  export const KEY_PREFIX = 'esi-limiter:';
  export const FLOOR = 5;
  export type EsiPriority = 'live' | 'bulk';
  export type AcquireResult =
    | { granted: true }
    | {
        granted: false;
        waitMs: number;
        reason: 'brake' | 'group' | 'rate';
        detail: string;
      };
  export interface ObserveInput {
    template: string;
    bucketKey: string;
    status: number;
    group?: string;
    limit?: number;
    windowMs?: number;
    remaining?: number;
    errorRemain?: number;
    errorResetMs?: number;
    retryAfterMs?: number;
  }
  export interface ObserveResult {
    brake?: { ms: number; status: 420 | 429; kind: EsiThrottleKind };
    groupPause?: { key: string; ms: number };
    rate: number;
  }
  export class SharedLimiterStore {
    constructor(
      redis: Redis,
      opts: { maxRps: number; prefix?: string; floor?: number },
    );
    acquire(
      priority: EsiPriority,
      template: string,
      bucketKey: string,
      now?: number,
    ): Promise<AcquireResult>;
    observe(input: ObserveInput, now?: number): Promise<ObserveResult>;
  }
  ```

  Script'ler `fs.readFileSync(path.join(__dirname, '...lua'))` ile okunur
  (backend her yerde `tsx` ile çalışıyor), `EVALSHA` ile çağrılır,
  `NOSCRIPT` hatasında `EVAL` ile yeniden yüklenir.

- [ ] **Step 1: Senaryo tablosunu yaz**

  `scenarios.json`: her senaryo `{ name, maxRps, steps[] }`. Adım:
  `{ client: "a"|"b"|"c", op: "acquire"|"observe", now, repeat?, ...argümanlar,
expect }`. `expect` kısmi eşleşme; `repeat` ile `expect: { grantedCount: n }`.
  `client` her biri ayrı bir Redis bağlantısındaki ayrı bir store, yani ayrı
  süreç yerine geçer. Senaryolar (spec §6):

  1. `a`'nın 420'si (`errorResetMs: 30000`) `b`'nin `acquire`'ını
     `reason: brake`, `waitMs ≈ 30000`, `detail: "420:error-limit"` ile bekletir.
  2. Fren sürerken yeni bir `c` de `reason: brake` alır.
  3. Header'sız 429: `a`'nın 429'u `rate`'i `floor(50 × 0.75) = 37`'ye düşürür;
     10 sn içindeki ikinci 429 (`b`'den) ikinci kez düşürmez; fren bittikten
     10 sn sonra `rate` 38.
  4. `errorRemain: 19, errorResetMs: 5000` → fren; `errorRemain: 20` → fren yok.
  5. `group: "killmail"` ile gruplu 429 (`retryAfterMs: 20000`) yalnızca o
     grubun template'ini `reason: group` ile bekletir; başka bir template
     `granted`.
  6. `maxRps: 10`, aynı `now`'da: `bulk` 5 kez alır, 6.'da `reason: rate`;
     `live` 5 kez daha alır, sonra `reason: rate`. 1000 ms sonra kova yine 10.
  7. `maxRps: 10`, `a` ve `b` sırayla aynı `now`'da toplam 20 `bulk`
     `acquire`: toplam verilen 5, yani iki istemci tek bir kovayı paylaşıyor.
  8. `retryAfterMs: 3_600_000` olan header'sız 429'da fren 900000 ms ile kesilir.

- [ ] **Step 2: `shared-store.spec.ts`'i yaz**

  Tabloyu okur, her senaryo için rastgele bir önek (`test:esi-limiter:<uuid>:`)
  ile koşar, `afterEach`'te yalnızca o önekin anahtarlarını `SCAN MATCH` ile
  bulup siler. `describe.skipIf(!process.env.REDIS_URL)`. Ek testler:

  - `now` verilmeden `acquire` `granted` döner (Redis `TIME` yolu).
  - `evalsha` `NOSCRIPT` fırlatacak şekilde saptırılınca `acquire` yine
    `granted` döner (Review Focus 4).
  - `esi-limiter:` önekli bir anahtar, `*Killmail:123*` desenli `KEYS`
    sonucunda yer almaz.
  - Gruplu bucket anahtarının TTL'i `windowMs + 60000` ms civarında.

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

  Run: `cd backend && REDIS_URL=<.env'deki değer> yarn vitest run src/services/esi-limiter`
  Expected: FAIL, `shared-store` modülü yok.

- [ ] **Step 4: Lua script'lerini ve `shared-store.ts`'i yaz**

  Mantık `rate-limiter.ts`'teki `observe`, `observeGroup`, `pause`,
  `lowerRate`, `respace`, `currentRate`'in aynısı. `acquire.lua` sırası:
  fren → grup bucket'ı hazır mı (`max(pausedUntil, nextAllowedAt)`) → kovayı
  doldur → sınıf kontrolü → token düş, bucket varsa `sentAt = now` ve
  `respace`. Hız beklemesi: eksik token / `currentRate` × 1000, yukarı yuvarla.

- [ ] **Step 5: Testlerin geçtiğini gör**

  Run: Step 3'teki komut. Expected: PASS.

- [ ] **Step 6: CI'a Redis'i ekle, commit**

  ```bash
  git add backend/src/services/esi-limiter .github/workflows/ci.yml
  git commit -m "feat(esi): add the shared limiter scripts and the Node store"
  ```

### Task 2: Node shared limiter ve esi-client bağlantısı

**Files:**

- Create: `backend/src/services/esi-limiter/shared-rate-limiter.ts`
- Test: `backend/src/services/esi-limiter/shared-rate-limiter.spec.ts`
- Modify: `backend/src/services/rate-limiter.ts` (`RateLimiter` sınıfını,
  `seconds` ve `parseLimit`'i export et; davranış değişmez),
  `backend/src/services/esi-client.ts`, `backend/src/server.ts:308`,
  `backend/src/workers/worker-redisq-stream.ts:115`

**Interfaces:**

- Consumes: Task 1'deki `SharedLimiterStore`, `EsiPriority`.
- Produces:

  ```ts
  export class SharedRateLimiter {
    constructor(
      store: Pick<SharedLimiterStore, 'acquire' | 'observe'>,
      local: RateLimiter,
      opts?: { timeoutMs?: number; retryMs?: number; now?: () => number },
    );
    setPriority(priority: EsiPriority): void; // varsayılan 'bulk'
    acquire(route: EsiRoute, opts?: { maxWaitMs?: number }): Promise<void>;
    observe(
      route: EsiRoute,
      status: number,
      headers: Record<string, string | undefined>,
    ): Promise<void>;
    release(): void;
    isShared(): boolean; // yerel moddaysa false
  }
  export const esiLimiter: SharedRateLimiter;
  ```

  `esi-client.ts`: `esiRateLimiter` yerine `esiLimiter`; `observe` artık
  `await` edilir. Yeni `export function setEsiPriority(p: EsiPriority): void`.
  `server.ts` ve `worker-redisq-stream.ts` `setEsiMaxWait(10_000)` yanında
  `setEsiPriority('live')` çağırır. `esiLimiter` kendi `ioredis`
  bağlantısını kullanır (`config.redis.url`, `enableOfflineQueue: false`,
  `maxRetriesPerRequest: 0`), cache bağlantısını değil.

- [ ] **Step 1: `shared-rate-limiter.spec.ts`'i yaz** (sahte store ile, Redis gerekmez)

  - `store.acquire` `{granted:false, reason:'rate', waitMs: 50}` sonra
    `{granted:true}` dönünce `acquire` ikinci çağrıdan sonra çözülür.
  - `store.acquire` `reason:'brake', waitMs: 30_000` dönünce
    `acquire(route, { maxWaitMs: 10_000 })` beklemeden `EsiThrottledError`
    (`status` 420, `kind` `error-limit`) ile reddedilir (Review Focus 2).
  - Bir route için `reason:'group'` dönerken başka bir route'un `acquire`'ı
    hemen çözülür (Review Focus 5).
  - `store.acquire` hiç çözülmeyen bir promise dönünce `acquire` 200 ms
    sonra yerel limiter'dan geçer, `isShared()` false olur, "Redis
    unreachable" logu bir kez basılır (Review Focus 1).
  - Yerel moddayken 10 sn dolmadan store çağrılmaz; dolunca çağrılır,
    başarılıysa `isShared()` true ve "Redis back" logu bir kez.
  - `observe` header'ları doğru parse edip `store.observe`'a geçirir
    (`retry-after: '20'` → `retryAfterMs: 20000`, boş
    `x-esi-error-limit-remain` → `errorRemain` yok).
  - `store.observe` `brake: { ms: 30000, status: 420, kind: 'error-limit' }`
    dönünce bugünkü `⏸️  ESI 420 (error-limit): pausing all requests for 30 s`
    logu basılır; `brake` yoksa log yok.
  - `setPriority('live')` sonrası `store.acquire` `'live'` ile çağrılır.
  - Eşzamanlı istek tavanı (`max(50, maxRps)`) aşılmaz.

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

  Run: `cd backend && yarn vitest run src/services/esi-limiter/shared-rate-limiter.spec.ts`
  Expected: FAIL, modül yok.

- [ ] **Step 3: `SharedRateLimiter`'ı yaz**

  Süreç içi kuyruk bugünkü `processQueue` gibi: baştaki bekleyen için store
  sorulur; `granted` → ver; `group` → bugünkü `parked` gibi kenara al, kendi
  zamanlayıcısıyla geri koy; `brake`/`rate` → `min(waitMs, 1000)` +
  0-50 ms jitter uyu, tekrar sor. Her bekleyenin `maxWaitMs` son tarihi
  kontrol edilir. Yerel modda bütün çağrılar `local`'e gider.

- [ ] **Step 4: esi-client, server ve redisq bağlantısını yap**

- [ ] **Step 5: Testlerin ve mevcut setin geçtiğini gör**

  Run: `cd backend && yarn test && yarn workspace backend build`
  Expected: PASS; `rate-limiter.spec.ts`, `esi-client.spec.ts` ve
  `esi-client.guard.spec.ts` değişmeden geçer.

- [ ] **Step 6: Commit**

  ```bash
  git commit -m "feat(esi): route every Node ESI call through the shared limiter"
  ```

### Task 3: Rust store

**Files:**

- Create: `backend-rs/crates/esi/src/shared.rs`
- Test: `backend-rs/crates/esi/tests/shared.rs`
- Modify: `backend-rs/Cargo.toml` (`redis`, `tokio-comp`,
  `connection-manager` ve `script` özellikleriyle; sürümü builder sabitler),
  `crates/esi/Cargo.toml`, `crates/esi/src/lib.rs`,
  `.github/workflows/ci.yml` (`backend-rs` işi: `redis:7`,
  `REDIS_URL: redis://localhost:6379`)

**Interfaces:**

- Consumes: Task 1'deki Lua sözleşmesi ve `scenarios.json`.
- Produces:

  ```rust
  pub const KEY_PREFIX: &str = "esi-limiter:";
  pub const FLOOR: u32 = 5;
  pub enum Priority { Live, Bulk }
  pub enum WaitReason { Brake, Group, Rate }
  pub enum AcquireOutcome { Granted, Wait { wait_ms: f64, reason: WaitReason, detail: String } }
  pub struct ObserveInput { pub template: String, pub bucket_key: String, pub status: u16,
      pub group: Option<String>, pub limit: Option<f64>, pub window_ms: Option<f64>,
      pub remaining: Option<f64>, pub error_remain: Option<f64>,
      pub error_reset_ms: Option<f64>, pub retry_after_ms: Option<f64> }
  pub struct ObserveOutcome { pub brake: Option<(f64, u16, ThrottleKind)>,
      pub group_pause: Option<(String, f64)>, pub rate: f64 }
  pub struct SharedStore;  // redis::aio::ConnectionManager, tembel bağlanır
  impl SharedStore {
      pub fn new(redis_url: &str, max_rps: u32) -> Result<Self, String>;
      pub fn with_prefix(self, prefix: impl Into<String>) -> Self;
      pub async fn acquire(&self, priority: Priority, template: &str, bucket_key: &str,
                           now: Option<f64>) -> Result<AcquireOutcome, redis::RedisError>;
      pub async fn observe(&self, input: &ObserveInput, now: Option<f64>)
                           -> Result<ObserveOutcome, redis::RedisError>;
  }
  ```

  Script'ler `include_str!("../../../../backend/src/services/esi-limiter/acquire.lua")`
  ile gömülür; kopyası yapılmaz. `redis::Script` `EVALSHA`/`NOSCRIPT`
  dönüşünü kendisi yapar.

- [ ] **Step 1: `tests/shared.rs`'i yaz**

  `env!("CARGO_MANIFEST_DIR")/../../../backend/src/services/esi-limiter/scenarios.json`'u
  okur ve Task 1'deki her senaryoyu aynı beklentilerle koşar; rastgele önek,
  yalnızca kendi anahtarlarını siler. `REDIS_URL` yoksa test `eprintln!` ile
  atlanır. Ek: `now: None` ile `acquire` `Granted`; `NOSCRIPT` yolu
  (`SCRIPT FLUSH` kullanmadan; ör. script'i önceden yüklemeden ilk çağrının
  `EVALSHA` başarısızlığı ile).

- [ ] **Step 2: Başarısız olduğunu gör**

  Run: `cd backend-rs && REDIS_URL=<.env'deki değer> cargo test -p esi --test shared`
  Expected: FAIL, `shared` modülü yok.

- [ ] **Step 3: `shared.rs`'i yaz**

- [ ] **Step 4: Geçtiğini gör**

  Run: Step 2'deki komut. Expected: PASS, Node ile aynı senaryolar.

- [ ] **Step 5: CI'a Redis'i ekle, commit**

  ```bash
  git commit -m "feat(backend-rs): add the shared limiter store"
  ```

### Task 4: Rust limiter'ı ortak yola bağla

**Files:**

- Modify: `backend-rs/crates/esi/src/limiter.rs`, `crates/esi/src/client.rs`
- Test: `backend-rs/crates/esi/tests/limiter.rs` (yeni testler, mevcutlar
  değişmez), `crates/esi/tests/shared_limiter.rs`

**Interfaces:**

- Consumes: Task 3'teki `SharedStore`, `Priority`, `AcquireOutcome`, `ObserveInput`.
- Produces:
  - `pub const DEFAULT_REDIS_URL: &str = "redis://localhost:6379";`
  - `RateLimiter::from_env()` `ESI_MAX_RPS`'in yanında `REDIS_URL`'i okur
    (yoksa `DEFAULT_REDIS_URL`) ve ortak yolu açık bir limiter döner.
    `RateLimiter::new(n)` bugünkü gibi yalnızca yerel kalır, mevcut testler
    ona dayanıyor.
  - `pub fn with_shared(self, store: SharedStore) -> Self`,
    `pub fn is_shared(&self) -> bool`. Öncelik her zaman `Priority::Bulk`.
  - `acquire` ve `observe` imzaları değişmez; `EsiClient::get` ve worker'lar
    dokunulmadan çalışır. `observe`'un ortak yolu async'tir, `client.rs`
    gerekiyorsa bekler.
  - Davranış Task 2'deki `SharedRateLimiter` ile aynı: süreç içi kuyruk,
    `max_wait`, gruplu bekleyenin kenara alınması, 200 ms zaman aşımı, 10 sn
    sonra yeniden deneme, giriş/çıkış logu bir kez (`tracing::warn!` /
    `tracing::info!`, metinler Node'dakiyle aynı).

- [ ] **Step 1: Testleri yaz**

  Task 2'deki listenin Rust karşılıkları, sahte bir store ile (store için
  bir trait ya da test yardımcısı; seçim builder'ın). Ek olarak:

  - `DEFAULT_REDIS_URL`, `backend/src/config/config.ts`'teki
    `REDIS_URL: z.string().default('redis://localhost:6379')` satırıyla
    aynı değeri taşır (dosyayı okuyup karşılaştırır).
  - `from_env()` `REDIS_URL` yokken `DEFAULT_REDIS_URL`'i kullanır.

- [ ] **Step 2: Başarısız olduğunu gör**

  Run: `cd backend-rs && cargo test -p esi`
  Expected: FAIL.

- [ ] **Step 3: Uygula**

- [ ] **Step 4: Tüm workspace'in geçtiğini gör**

  Run: `cd backend-rs && cargo fmt --check && SQLX_OFFLINE=true cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`
  (sqlx testleri için `DATABASE_URL`'i `backend/.env`'den export et, yalnızca okuyarak.)
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git commit -m "feat(backend-rs): route the Rust ESI limiter through the shared store"
  ```

### Task 5: Dokümanlar ve gerçek çalıştırma

**Files:**

- Modify: `CLAUDE.md` ("Rate limiting" bölümü),
  `backend/src/services/rate-limiter.ts:28-30` ve
  `backend-rs/crates/esi/src/limiter.rs` dosya başı "per PROCESS"
  paragrafları, `docs/superpowers/specs/2026-10-28-esi-rate-limiter-design.md`
  §4.5 (tarihli not ve bu spec'e göreli bağlantı),
  `docs/superpowers/specs/2026-11-14-shared-esi-limiter-design.md`
  (sonuna "Sonuçlar" bölümü)

- [ ] **Step 1: Dokümanları güncelle**

  `CLAUDE.md`: `ESI_MAX_RPS` artık uygulamanın toplamı; fren ve hız Redis'te
  ortak; Redis'e ulaşılamazsa her süreç yerel limiter'a döner ve tavan o
  sırada süreç başına olur; canlı (`server.ts`, `worker-redisq-stream`) ve
  toplu sınıf; iki checkout farklı `REDIS_URL` veritabanında ayrı bütçe
  demek.

- [ ] **Step 2: Gerçek çalıştırma**

  Yerel servisler açıkken, birkaç bin mesajlık
  `esi_character_corporation_history_queue` ile bir Node ESI worker'ı ve
  `yarn worker:info:corporations:rs` (kuyruğu `yarn queue:corporations` ile
  doldurarak) aynı anda. ESI'ye yalnızca worker'lar üzerinden gidilir,
  doğrudan `curl` yok. Ölçülecekler: iki sürecin toplam hızının tek bir
  değere oturması (beklenen ~17-20 req/s, iki katı değil), 429 sayısı,
  ardışık 429 dizisi. Sonuçlar spec'in "Sonuçlar" bölümüne.

- [ ] **Step 3: Format ve link kontrolü**

  Run: `npx prettier --check CLAUDE.md docs/superpowers/specs/*.md` ve
  CLAUDE.md'deki link grep'i. Expected: temiz.

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "docs: record the shared ESI limiter and its results"
  ```
