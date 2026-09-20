# Worker güvenilirlik sözleşmesi — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her RabbitMQ kuyruğunu tek bir güvenilirlik sözleşmesine bağlamak — görünür bir sağlık durumu, tek beyan noktası, gerçek bir dead letter hedefi ve 25 kopya yerine tek bir paylaşılan hata yolu.

**Architecture:** Dört dilim, bağımlılık sırasında. Görünürlük saf bir fonksiyon artı iki GraphQL alanı; beyan açığı iki elle yazılmış listeyi tek kaynağa indiriyor; DLX mevcut kuyruklara `rabbitmqctl set_policy` ile takılıyor (beyan argümanı değiştirmek 406 verir); paylaşılan `handleWorkerError` deneme sayısını `x-death` başlığından okuyup 25 worker'ın kopyalanmış `catch` gövdelerini siliyor.

**Tech Stack:** TypeScript, amqplib, GraphQL Yoga + codegen, Vitest 5, Next.js App Router, RabbitMQ (droplet üzerinde `apt`'tan kurulu, `rabbitmqctl` erişimi var).

**Spec:** `docs/superpowers/specs/2026-09-20-worker-reliability-contract-design.md`

## Global Constraints

- **Yarn, asla npm.** `yarn test`, `yarn workspace backend build`, `yarn workspace backend codegen`.
- **Üretilen dosyalar elle düzenlenmez** — `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`. Kaynak `.graphql` değişir, codegen çalışır.
- **Backend codegen her zaman frontend codegen'den önce.**
- **Her `assertQueue` çağrısı `arguments: { 'x-max-priority': 10 }` taşımak zorunda.** Eksik argüman `406 PRECONDITION_FAILED` verir ve worker anında ölür (#135).
- **Öncelik gerçekten kullanımda:** `resolvers/auth/mutations.ts:109` → 8, `:172` → 7, `queues/queue-missing-groups.ts:75` → 5, `services/user-killmail-cron.ts:155` → 3. Hiçbir adım `x-max-priority`'yi kaldıramaz.
- **`MAX_ATTEMPTS = 5`**, bugünkü değeriyle aynı (`queues/topology-messages.ts:30`).
- **Wait kuyruğu TTL'i 30000 ms**, sabit, üstel değil.
- **Worker'lar `@services/prisma-worker` kullanır** (2 bağlantı), API `@services/prisma` (5). Hiçbir adım bunu karıştırmaz.
- **Türkçe:** spec ve plan Türkçe. **İngilizce:** dal adları, commit mesajları, PR başlık ve gövdeleri, kod yorumları, `backend/docs/` altındaki dokümanlar.
- **Commit mesajlarında Claude atfı yok.**
- **Dal:** hepsi `feat/worker-reliability-contract` üzerinde. `main`'e doğrudan commit yok.
- Her görevin sonunda `npx prettier --check <dokunulan dosyalar>`.

---

## Dosya haritası

**Yeni:**

| Dosya                                       | Sorumluluk                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `backend/src/services/queue-health.ts`      | Bir kuyruk satırından sağlık durumunu çıkaran saf fonksiyon. Yan etkisi yok, amqplib bilmiyor. |
| `backend/src/services/queue-health.spec.ts` | Yukarıdakinin testleri.                                                                        |
| `backend/src/services/queue-names.ts`       | Tek kuyruk adı listesi. `rabbitmq.ts` içindeki iki kopya diziyi değiştiriyor.                  |
| `backend/src/workers/worker-error.ts`       | Her worker'ın paylaştığı hata yolu. 420, 404, deneme sayımı, parking'e publish.                |
| `backend/src/workers/worker-error.spec.ts`  | Yukarıdakinin testleri.                                                                        |
| `backend/docs/ops/rabbitmq.md`              | Poliçe komutu, parking yordamı, dağıtım sırası. İngilizce.                                     |

**Değişen:**

| Dosya                                                   | Ne değişiyor                                                                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/services/rabbitmq.ts`                      | İki elle yazılmış listeyi `queue-names.ts`'e devreder; `publishToQueue`'daki `assertQueue` kalkar; `ensureAllQueuesExist` exchange'leri ve wait/parking kuyruklarını da beyan eder. |
| `backend/src/schemas/Worker.graphql`                    | `QueueStatus.health` alanı ve `QueueHealth` enum'u.                                                                                                                                 |
| `backend/src/resolvers/worker/queries.ts`               | `queueHealth()` çağrısı.                                                                                                                                                            |
| `backend/src/resolvers/worker/subscriptions.ts`         | Aynı, abonelik yolunda.                                                                                                                                                             |
| `frontend/src/graphql/*.graphql` (workerStatus belgesi) | `health` alanı.                                                                                                                                                                     |
| `frontend/src/app/workers/page.tsx`                     | `STALLED` satırını ve dolu parking satırını görsel olarak ayırır.                                                                                                                   |
| `backend/src/workers/*.ts` (25 tüketici)                | `catch` gövdeleri `handleWorkerError` çağrısına iner.                                                                                                                               |
| `backend/src/queues/topology-messages.ts`               | Kendi `handleWorkerError`'ı ve `attempts` zarfı emekli olur.                                                                                                                        |

---

## Faz 1 — Görünürlük

### Task 1: Kuyruk sağlığı, saf fonksiyon

**Files:**

- Create: `backend/src/services/queue-health.ts`
- Test: `backend/src/services/queue-health.spec.ts`

**Interfaces:**

- Consumes: yok. Bu ilk görev.
- Produces: `export type QueueHealth = 'OK' | 'STALLED'` ve
  `export function queueHealth(queue: { name: string; messageCount: number; consumerCount: number }): QueueHealth`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

```ts
// backend/src/services/queue-health.spec.ts
import { describe, expect, it } from 'vitest';
import { HOLDING_QUEUES, queueHealth } from './queue-health';

const q = (over: Partial<Parameters<typeof queueHealth>[0]> = {}) => ({
  name: 'esi_type_info_queue',
  messageCount: 0,
  consumerCount: 1,
  ...over,
});

describe('queueHealth', () => {
  it('is OK when a consumer is attached', () => {
    expect(queueHealth(q({ messageCount: 120 }))).toBe('OK');
  });

  it('is OK when the queue is empty and nobody is listening', () => {
    // Nothing to process is not a fault: most queues sit empty between runs.
    expect(queueHealth(q({ messageCount: 0, consumerCount: 0 }))).toBe('OK');
  });

  it('is STALLED when messages pile up with no consumer', () => {
    // The shape that grew to 465 messages unnoticed on 2026-09-20.
    expect(queueHealth(q({ messageCount: 465, consumerCount: 0 }))).toBe(
      'STALLED',
    );
  });

  it('never calls a holding queue stalled', () => {
    // killreport.wait holds messages on a TTL and HAS no consumer by design,
    // and killreport.parking is where messages are meant to sit until someone
    // looks at them. Both would read as permanently stalled otherwise.
    for (const name of HOLDING_QUEUES) {
      expect(queueHealth(q({ name, messageCount: 12, consumerCount: 0 }))).toBe(
        'OK',
      );
    }
  });

  it('names both holding queues', () => {
    expect([...HOLDING_QUEUES].sort()).toEqual([
      'killreport.parking',
      'killreport.wait',
    ]);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend test queue-health`
Expected: FAIL — `Cannot find module './queue-health'`

- [ ] **Step 3: En küçük uygulamayı yaz**

```ts
// backend/src/services/queue-health.ts

/**
 * What a queue's numbers say about it.
 *
 * `OK` and `STALLED` only: a per-queue count of parked messages is NOT
 * available. `killreport.parking` is one queue and a message's origin lives in
 * its `x-death` header, which a depth query does not carry — so parking shows
 * up as its own row rather than as a field on every other queue.
 */
export type QueueHealth = 'OK' | 'STALLED';

export interface QueueNumbers {
  name: string;
  messageCount: number;
  consumerCount: number;
}

/**
 * Queues whose job is to hold messages, so "full with no consumer" is their
 * working state rather than a fault.
 */
export const HOLDING_QUEUES: readonly string[] = [
  'killreport.wait',
  'killreport.parking',
];

/**
 * A queue with messages and nobody reading them.
 *
 * This is the failure the app could not see before: PM2 stops keeping a worker
 * up, the publisher keeps publishing, and the only evidence is a number nobody
 * was looking at. An empty queue with no consumer is NOT this — most queues sit
 * empty between hand-run enrichment passes.
 */
export function queueHealth(queue: QueueNumbers): QueueHealth {
  if (HOLDING_QUEUES.includes(queue.name)) return 'OK';
  if (queue.messageCount > 0 && queue.consumerCount === 0) return 'STALLED';
  return 'OK';
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `yarn workspace backend test queue-health`
Expected: PASS, 5 test

- [ ] **Step 5: Commit**

```bash
npx prettier --check backend/src/services/queue-health.ts backend/src/services/queue-health.spec.ts
git add backend/src/services/queue-health.ts backend/src/services/queue-health.spec.ts
git commit -m "feat(workers): decide a queue's health from its own numbers"
```

---

### Task 2: Sağlığı `workerStatus`'a bağla

**Files:**

- Modify: `backend/src/schemas/Worker.graphql:85-115` (`QueueStatus`)
- Modify: `backend/src/resolvers/worker/queries.ts:40-55`
- Modify: `backend/src/resolvers/worker/subscriptions.ts` (aynı zenginleştirme bloğu)

**Interfaces:**

- Consumes: Task 1'den `queueHealth()` ve `QueueHealth`.
- Produces: GraphQL'de `QueueStatus.health: QueueHealth!` ve `enum QueueHealth { OK STALLED }`.

- [ ] **Step 1: Şemaya alanı ekle**

`backend/src/schemas/Worker.graphql`, `type QueueStatus` bloğunun içine,
`active` alanından sonra:

```graphql
  """
  Kuyruğun kendi sayılarından çıkan durumu. STALLED = mesaj var, tüketici yok.
  `killreport.wait` ve `killreport.parking` muaf: işleri mesaj tutmak.
  """
  health: QueueHealth!
```

Ve dosyanın sonuna:

```graphql
"Bir kuyruğun sayılarından okunabilen durumu."
enum QueueHealth {
  OK
  STALLED
}
```

- [ ] **Step 2: Backend codegen**

Run: `yarn workspace backend codegen`
Expected: `generated-types.ts` ve `generated-schema.graphql` yeniden yazılır, hata yok.

- [ ] **Step 3: Resolver'da alanı doldur**

`backend/src/resolvers/worker/queries.ts` içindeki `queues = queueStats.map(...)`
bloğunda, dönen nesneye ekle. `QueueHealth` şema enum'u nominal olduğu için
`CELESTIAL_KIND`/`OWNER_KIND` ile aynı desen kullanılır — cast değil, Record:

```ts
import { QueueHealth } from '@generated-types';
import {
  queueHealth,
  type QueueHealth as ServiceQueueHealth,
} from '@services/queue-health';

/**
 * The service speaks a string-literal union and the schema speaks a string
 * enum; TypeScript's string enums are nominal. An exhaustive Record converts
 * without a cast — add a state to the service and this stops compiling.
 */
const QUEUE_HEALTH: Record<ServiceQueueHealth, QueueHealth> = {
  OK: QueueHealth.Ok,
  STALLED: QueueHealth.Stalled,
};
```

ve map gövdesinde:

```ts
return {
  ...queue,
  workerRunning,
  workerPid: undefined,
  workerName,
  health: QUEUE_HEALTH[queueHealth(queue)],
};
```

- [ ] **Step 4: Aynısını abonelik yolunda yap**

`backend/src/resolvers/worker/subscriptions.ts` içinde aynı zenginleştirme
bloğu var. Aynı `QUEUE_HEALTH` Record'unu ve aynı satırı ekle. İki yol da aynı
alanı döndürmeli, yoksa sayfa ilk yüklemede bir şey, 5 saniye sonra başka bir
şey gösterir.

- [ ] **Step 5: Derle**

Run: `yarn workspace backend build`
Expected: hata yok. `health` alanı zorunlu olduğu için iki yoldan birini
atlarsan tip hatası verir — bu istenen davranış.

- [ ] **Step 6: Canlı doğrula**

```bash
yarn workspace backend dev   # arka planda
curl -s -X POST http://localhost:$(grep -m1 '^PORT' backend/.env | cut -d= -f2)/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ workerStatus { queues { name messageCount consumerCount health } } }"}'
```

Expected: her kuyruk bir `health` taşıyor. Mesajı olup tüketicisi olmayan bir
kuyruk varsa `"STALLED"` döner. İşin bitince `yarn workspace backend kill`.

- [ ] **Step 7: Commit**

```bash
npx prettier --check backend/src/schemas/Worker.graphql backend/src/resolvers/worker/queries.ts backend/src/resolvers/worker/subscriptions.ts
git add backend/src/schemas/Worker.graphql backend/src/resolvers/worker/queries.ts backend/src/resolvers/worker/subscriptions.ts backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(workers): report each queue's health through workerStatus"
```

---

### Task 3: `/workers` sayfası durumu göstersin

**Files:**

- Modify: `frontend/src/graphql/Workers.graphql:5-10`
- Modify: `frontend/src/graphql/WorkerStatusUpdates.graphql:12-17`
- Modify: `frontend/src/graphql/WorkerStatusSubscription.graphql:15-23`
- Modify: `frontend/src/app/workers/page.tsx:9-15` (`QueueInfo`), `:463-530` (kuyruk satırı)

**Interfaces:**

- Consumes: Task 2'den `QueueStatus.health`.
- Produces: kullanıcıya dönük çıktı; sonraki görev buna dayanmıyor.

- [ ] **Step 1: Üç belgeye de alanı ekle**

`queues { ... }` seçen **üç** belge var ve üçü de `health` almalı — biri
eksik kalırsa sayfa ilk yüklemede bir şey, abonelik tazelemesinde başka bir şey
gösterir:

| belge                                    | bugünkü seçim                                        |
| ---------------------------------------- | ---------------------------------------------------- |
| `Workers.graphql:5-10`                   | `name messageCount consumerCount active`             |
| `WorkerStatusUpdates.graphql:12-17`      | aynısı                                               |
| `WorkerStatusSubscription.graphql:15-23` | yukarıdakiler + `workerRunning workerPid workerName` |

Üçünde de `active`'den sonra `health` satırını ekle.

- [ ] **Step 2: Frontend codegen**

Run: `yarn workspace frontend codegen`
Expected: `frontend/src/generated/graphql.ts` yeniden yazılır.

- [ ] **Step 3: `QueueInfo` tipine alanı ekle**

`frontend/src/app/workers/page.tsx` başındaki yerel `QueueInfo` arayüzüne:

```ts
health: 'OK' | 'STALLED';
```

- [ ] **Step 4: Satırı işaretle**

Kuyruk satırında (`:464` civarı, `<tr key={queue.name} className="tr-row">`)
sınıfı duruma bağla ve bir rozet ekle. Odak halkası yok — `globals.css:142`
global olarak `:focus-visible { outline: none }` diyor ve bu bir satır, bir
kontrol değil:

```tsx
<tr
  key={queue.name}
  className={`tr-row ${queue.health === 'STALLED' ? 'bg-danger/10' : ''}`}
>
```

ve `messageCount` hücresinin yanına:

```tsx
{
  queue.health === 'STALLED' && (
    <span className="text-xs text-danger" title="Messages waiting, no consumer">
      stalled
    </span>
  );
}
```

- [ ] **Step 5: Doğrula**

Run: `yarn workspace frontend lint && yarn workspace frontend build:check`
Expected: ikisi de geçer. `lint` sayısını `main` ile karşılaştır; dokunulan
dosya listede olmamalı.

**Görsel doğrulama kullanıcıya ait.** Tarayıcı sürme, sayfayı açmasını iste.

- [ ] **Step 6: Commit**

```bash
npx prettier --check frontend/src/app/workers/page.tsx frontend/src/graphql/Workers.graphql frontend/src/graphql/WorkerStatusUpdates.graphql frontend/src/graphql/WorkerStatusSubscription.graphql
git add frontend/src/app/workers/page.tsx frontend/src/graphql/Workers.graphql frontend/src/graphql/WorkerStatusUpdates.graphql frontend/src/graphql/WorkerStatusSubscription.graphql frontend/src/generated/graphql.ts
git commit -m "feat(workers): mark a stalled queue on the workers page"
```

---

## Faz 2 — Beyan açığı

### Task 4: Tek kuyruk listesi

**Files:**

- Create: `backend/src/services/queue-names.ts`
- Modify: `backend/src/services/rabbitmq.ts:14-45` (`ALL_QUEUES`), `:236-275` (`getAllQueueStats` içindeki kopya dizi)

**Interfaces:**

- Consumes: yok.
- Produces: `export const ALL_QUEUES: readonly string[]` — 24 ad. `rabbitmq.ts` bunu hem beyan hem izleme için okur.

- [ ] **Step 1: Listeyi çıkar ve altı adı ekle**

```ts
// backend/src/services/queue-names.ts

/**
 * Every queue this application uses, in one place.
 *
 * It was two places: `ALL_QUEUES` (19 names, which `ensureAllQueuesExist()`
 * declared) and a second hardcoded array inside `getAllQueueStats()` (20 names,
 * which monitoring read). The difference was `esi_type_price_queue` — monitored
 * but never declared — so a queue could be declared and unmonitored, monitored
 * and undeclared, or neither. Six names were in neither list.
 *
 * Declaration equivalence makes this load-bearing: every declaration must pass
 * the same `x-max-priority: 10`, and a second list is a second chance to get
 * that wrong. That is the 406 that took three workers down in #135.
 */
export const ALL_QUEUES: readonly string[] = [
  // ESI info workers (entity enrichment)
  'esi_alliance_info_queue',
  'esi_character_info_queue',
  'esi_corporation_info_queue',
  'esi_type_info_queue',
  'esi_category_info_queue',
  'esi_item_group_info_queue',
  'esi_type_price_queue',
  'esi_type_dogma_queue',
  'esi_dogma_attribute_info_queue',
  'esi_dogma_effect_info_queue',

  // ESI sync workers
  'esi_alliance_corporations_queue',

  // ESI universe workers
  'esi_regions_queue',
  'esi_constellations_queue',
  'esi_solar_systems_queue',

  // ESI universe topology chain
  'esi_stars_queue',
  'esi_planets_queue',
  'esi_moons_queue',
  'esi_asteroid_belts_queue',
  'esi_stargates_queue',
  'esi_stations_queue',
  'esi_topology_dlq',

  // Killmail workers
  'esi_corporation_killmails_queue',
  'esi_user_killmails_queue',

  // zKillboard workers
  'zkillboard_character_queue',

  // Maintenance and backfill workers
  'backfill_killmail_values_queue',
];
```

- [ ] **Step 2: Listeyi kodda geçen adlara karşı doğrula**

Run:

```bash
cd backend && python3 - <<'PY'
import re, subprocess
declared = set(re.findall(r"'([a-z_.]+)'", open('src/services/queue-names.ts').read()))
used = set(re.findall(r"'([a-z_]+_queue)'", subprocess.run(
    ['grep','-rho',"'[a-z_]*_queue'",'src'], capture_output=True, text=True).stdout))
print('kullanılıp beyan edilmeyen:', sorted(used - declared))
PY
```

Expected: `kullanılıp beyan edilmeyen: []`

- [ ] **Step 3: `rabbitmq.ts` iki kopyayı bıraksın**

`ALL_QUEUES` sabitini sil, yerine `import { ALL_QUEUES } from './queue-names';`
koy. `getAllQueueStats()` içindeki yerel `const queues = [...]` dizisini sil ve
döngüyü `for (const queueName of ALL_QUEUES)` yap.

- [ ] **Step 4: Derle ve çalıştır**

Run: `yarn workspace backend build && yarn workspace backend dev`
Expected: açılış logunda `✅ All 24 queues verified in RabbitMQ` — 19 değil.
Sonra `yarn workspace backend kill`.

- [ ] **Step 5: Commit**

```bash
npx prettier --check backend/src/services/queue-names.ts backend/src/services/rabbitmq.ts
git add backend/src/services/queue-names.ts backend/src/services/rabbitmq.ts
git commit -m "feat(workers): declare and monitor every queue from one list"
```

---

### Task 5: Dağınık `assertQueue` çağrılarını kaldır

**Files:**

- Modify: `backend/src/services/rabbitmq.ts:133-141` (`publishToQueue`)
- Modify: Adım 1'in bulduğu publisher ve worker dosyaları

**Interfaces:**

- Consumes: Task 4'ten `ALL_QUEUES`.
- Produces: yok; bu bir kaldırma görevi.

- [ ] **Step 1: Çağrıları bul**

Run: `cd backend && grep -rn "assertQueue" src | grep -v "ensureAllQueuesExist" | grep -v spec`
Expected: bir liste. Her satır ya bir publisher'ın ya bir worker'ın kendi
beyanı.

- [ ] **Step 2: `publishToQueue`'dakini kaldır**

`backend/src/services/rabbitmq.ts` içinde:

```ts
export async function publishToQueue(queueName: string, message: string) {
  try {
    const ch = await getRabbitMQChannel();
    // No assertQueue here. It passed `{ durable: true }` with NO
    // x-max-priority, which disagrees with ensureAllQueuesExist()'s
    // declaration — it only ever worked because the server declares every
    // queue correctly at startup, before this runs. Reverse that order once
    // and it is a 406. Declaration lives in ensureAllQueuesExist() alone.
    ch.sendToQueue(queueName, Buffer.from(message), { persistent: true });
  } catch (error) {
    console.error('Failed to publish message to queue', error);
  }
}
```

- [ ] **Step 3: Worker'lardaki beyanları kaldır**

Her tüketici worker'ın döngüsünde şu şekilde bir blok var:

```ts
await channel.assertQueue(QUEUE_NAME, {
  durable: true,
  arguments: { 'x-max-priority': 10 },
});
```

Bunları sil. Argümanları doğru olanlar bile gitmeli: Faz 3 wait/parking
topolojisini eklerken beyan argümanları yeniden değişecek ve o gün dağınık her
kopya bir 406 adayı.

- [ ] **Step 4: Kalmadığını doğrula**

Run: `cd backend && grep -rn "assertQueue" src | grep -v spec`
Expected: yalnızca `ensureAllQueuesExist()` içindeki tek çağrı.

- [ ] **Step 5: Derle ve bir worker çalıştır**

Run: `yarn workspace backend build`
Expected: hata yok.

Run: sunucuyu aç (kuyrukları beyan etsin), sonra bir worker:
`yarn workspace backend worker:info:alliances`
Expected: `✅ Connected to RabbitMQ`, 406 yok. Ctrl+C ile durdur.

- [ ] **Step 6: Commit**

```bash
npx prettier --check $(cd backend && git diff --name-only | sed 's|^|../|')
git add -A
git commit -m "refactor(workers): declare queues in one place only"
```

---

## Faz 3 — DLX ve poliçe

### Task 6: Retry topolojisini beyan et

**Files:**

- Modify: `backend/src/services/queue-names.ts`
- Modify: `backend/src/services/rabbitmq.ts:147-165` (`ensureAllQueuesExist`)

**Interfaces:**

- Consumes: Task 4'ten `ALL_QUEUES`.
- Produces: `export const RETRY_TOPOLOGY` — exchange ve kuyruk adları, Task 9 bunları okuyor:

  ```ts
  export const RETRY_TOPOLOGY = {
    dlx: 'killreport.dlx',
    retry: 'killreport.retry',
    wait: 'killreport.wait',
    parking: 'killreport.parking',
    waitTtlMs: 30000,
  } as const;
  ```

- [ ] **Step 1: Adları ekle**

`backend/src/services/queue-names.ts` sonuna yukarıdaki `RETRY_TOPOLOGY`
sabitini ve şunu ekle:

```ts
/**
 * The two queues the retry topology owns. They are declared like every other
 * queue but they are not application queues — nothing consumes them.
 */
export const TOPOLOGY_QUEUES: readonly string[] = [
  RETRY_TOPOLOGY.wait,
  RETRY_TOPOLOGY.parking,
];
```

- [ ] **Step 2: `ensureAllQueuesExist` exchange'leri ve kuyrukları beyan etsin**

```ts
export async function ensureAllQueuesExist(): Promise<void> {
  try {
    const ch = await getRabbitMQChannel();

    console.log('📋 Ensuring all RabbitMQ queues exist...');

    // The dead letter exchange is a FANOUT and the retry exchange is a
    // DIRECT, and the pair is the whole trick. A message carries its origin
    // queue's name as its routing key (sendToQueue publishes to the default
    // exchange with the queue name as the key), and RabbitMQ preserves that
    // key across a dead-letter hop. Fanout ignores the key, so one wait queue
    // catches all 24 without a binding per queue; the key survives the wait,
    // so the direct retry exchange sends the message back to exactly the
    // queue it failed in. A direct dlx would route on the origin queue's name,
    // the wait queue is bound under no such name, and every failure would be
    // dropped on its first attempt.
    await ch.assertExchange(RETRY_TOPOLOGY.dlx, 'fanout', { durable: true });
    await ch.assertExchange(RETRY_TOPOLOGY.retry, 'direct', { durable: true });

    // The wait queue has no consumer: the TTL is the delay, and expiry
    // dead-letters the message on to the retry exchange, which routes it back
    // to the queue it came from.
    await ch.assertQueue(RETRY_TOPOLOGY.wait, {
      durable: true,
      arguments: {
        'x-max-priority': 10,
        'x-message-ttl': RETRY_TOPOLOGY.waitTtlMs,
        'x-dead-letter-exchange': RETRY_TOPOLOGY.retry,
      },
    });

    await ch.assertQueue(RETRY_TOPOLOGY.parking, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    // Empty routing key, which is what a fanout binding takes: it binds the
    // wait queue to everything the dead letter exchange receives.
    await ch.bindQueue(RETRY_TOPOLOGY.wait, RETRY_TOPOLOGY.dlx, '');

    for (const queueName of ALL_QUEUES) {
      await ch.assertQueue(queueName, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });
      // Every application queue binds to the retry exchange under its own
      // name, so an expired message returns to exactly where it failed.
      await ch.bindQueue(queueName, RETRY_TOPOLOGY.retry, queueName);
    }

    console.log(`✅ All ${ALL_QUEUES.length} queues verified in RabbitMQ`);
  } catch (error) {
    console.error('❌ Failed to ensure queues exist:', error);
    // Don't throw - server should still start
  }
}
```

**Doğrulanacak nokta:** iki exchange'in türü farklı ve bu bilerek —
`killreport.dlx` **fanout**, `killreport.retry` **direct**. İkisini de direct
yapmak sessizce bozar: wait kuyruğu köken kuyruk adıyla bağlı olmadığı için
hiçbir mesaj ona ulaşmaz ve her başarısızlık ilk denemede kaybolur. Task 9'un
uçtan uca turu bunun çalıştığını gösteren şey.

- [ ] **Step 3: `getAllQueueStats` topoloji kuyruklarını da okusun**

Döngüyü `for (const queueName of [...ALL_QUEUES, ...TOPOLOGY_QUEUES])` yap.
`killreport.parking` böylece `/workers` sayfasında kendi satırı olur — Task 1
zaten onu `STALLED` saymamayı biliyor.

- [ ] **Step 4: Çalıştır ve topolojiyi doğrula**

```bash
yarn workspace backend dev    # arka planda, kuyrukları beyan etsin
curl -s -u guest:guest http://localhost:15672/api/exchanges | \
  python3 -c "import sys,json;print([e['name'] for e in json.load(sys.stdin) if e['name'].startswith('killreport')])"
curl -s -u guest:guest http://localhost:15672/api/queues | \
  python3 -c "import sys,json;print([(q['name'],q.get('arguments')) for q in json.load(sys.stdin) if q['name'].startswith('killreport')])"
yarn workspace backend kill
```

Expected: iki exchange (`killreport.dlx` fanout, `killreport.retry` direct); iki
kuyruk, `killreport.wait` `x-message-ttl: 30000` ve
`x-dead-letter-exchange: killreport.retry` taşıyor.

- [ ] **Step 5: `HOLDING_QUEUES` adları tek yerden okusun**

Task 1 `killreport.wait` ve `killreport.parking` adlarını düz string olarak
yazmıştı, çünkü `RETRY_TOPOLOGY` henüz yoktu. Artık var:

```ts
// backend/src/services/queue-health.ts
import { RETRY_TOPOLOGY } from './queue-names';

export const HOLDING_QUEUES: readonly string[] = [
  RETRY_TOPOLOGY.wait,
  RETRY_TOPOLOGY.parking,
];
```

`queue-health.spec.ts`'teki "names both holding queues" testi aynen geçmeli —
adlar değişmedi, kaynakları değişti.

Run: `yarn workspace backend test queue-health`
Expected: PASS, 5 test

- [ ] **Step 6: Dolu bir parking satırını sayfada işaretle**

`killreport.parking` artık `getAllQueueStats()` üzerinden `/workers` sayfasına
geliyor ve `health` alanı `OK` diyor — doğru, çünkü orada mesaj beklemesi o
kuyruğun işi. Ama dolu bir parking "bir şey pes etti" demek ve bunun
görünmesi gerekiyor. `frontend/src/app/workers/page.tsx`'te, Task 3'te eklenen
`stalled` rozetinin yanına:

```tsx
{
  queue.name === 'killreport.parking' && queue.messageCount > 0 && (
    <span
      className="text-xs text-danger"
      title="Messages that gave up after 5 attempts"
    >
      parked
    </span>
  );
}
```

Run: `yarn workspace frontend lint && yarn workspace frontend build:check`
Expected: ikisi de geçer.

- [ ] **Step 7: Commit**

```bash
npx prettier --check backend/src/services/queue-names.ts backend/src/services/rabbitmq.ts backend/src/services/queue-health.ts frontend/src/app/workers/page.tsx
git add backend/src/services/queue-names.ts backend/src/services/rabbitmq.ts backend/src/services/queue-health.ts frontend/src/app/workers/page.tsx
git commit -m "feat(workers): declare the dead letter, wait and parking topology"
```

---

### Task 7: Ops dokümanı ve poliçe

**Files:**

- Create: `backend/docs/ops/rabbitmq.md` (İngilizce)

**Interfaces:**

- Consumes: Task 6'dan `RETRY_TOPOLOGY` adları.
- Produces: yok; bir doküman.

- [ ] **Step 1: Dokümanı yaz**

`backend/docs/ops/rabbitmq.md` şunları kapsamalı, her biri çalıştırılabilir bir
komutla:

1. **Why a policy and not an argument.** Queue arguments take part in
   declaration equivalence, so adding `x-dead-letter-exchange` to an existing
   durable queue fails with `406 PRECONDITION_FAILED` against the
   `x-max-priority: 10` declaration already made. That is the #135 outage.
2. **Applying the policy:**
   ```bash
   sudo rabbitmqctl set_policy killreport-dlx \
     "^(esi_|zkillboard_|backfill_|alliance_)" \
     '{"dead-letter-exchange":"killreport.dlx"}' \
     --apply-to queues
   sudo rabbitmqctl list_policies
   ```
3. **Checking it covers everything.** The pattern must match every name in
   `backend/src/services/queue-names.ts`. Verify with:
   ```bash
   sudo rabbitmqctl list_queues name policy | grep -c killreport-dlx
   ```
   The count must equal the length of `ALL_QUEUES`.
4. **Deployment order, which is load-bearing.** Apply the policy FIRST, then
   restart the workers. A worker that nacks before the DLX exists drops the
   message on the floor.
5. **Inspecting parking:**
   ```bash
   sudo rabbitmqctl list_queues name messages | grep killreport.parking
   ```
   and reading one message's origin out of its `x-death` header through the
   management UI at `/#/queues/%2F/killreport.parking` → Get messages.
6. **Replaying parking by hand**, and why it is by hand: a parked message
   failed five times, so replaying it without understanding why is how it
   parks a sixth time.
7. **Removing the policy** for a rollback:
   ```bash
   sudo rabbitmqctl clear_policy killreport-dlx
   ```

`backend/docs/ops/pm2.md` ve `crontab.md` bu dizindeki yazım tonunu veriyor;
onlara bak.

- [ ] **Step 2: Bağlantıları doğrula**

Run: `node scripts/check-doc-links.js`
Expected: `backend/docs/ops/rabbitmq.md` için hiçbir "target does not exist"
satırı yok. (Repoda `.github/prompts/` altında önceden var olan tek bir kırık
bağlantı var; o sayılmaz.)

- [ ] **Step 3: Yerel broker'da poliçeyi uygula ve dene**

```bash
sudo rabbitmqctl set_policy killreport-dlx "^(esi_|zkillboard_|backfill_|alliance_)" \
  '{"dead-letter-exchange":"killreport.dlx"}' --apply-to queues
sudo rabbitmqctl list_queues name policy | head -30
```

Expected: her uygulama kuyruğunun yanında `killreport-dlx`.

- [ ] **Step 4: Commit**

```bash
npx prettier --check backend/docs/ops/rabbitmq.md
git add backend/docs/ops/rabbitmq.md
git commit -m "docs(ops): document the dead letter policy and the parking queue"
```

---

## Faz 4 — Paylaşılan hata yolu

### Task 8: `handleWorkerError`

**Files:**

- Create: `backend/src/workers/worker-error.ts`
- Test: `backend/src/workers/worker-error.spec.ts`

**Interfaces:**

- Consumes: Task 6'dan `RETRY_TOPOLOGY`.
- Produces:

  ```ts
  export const MAX_ATTEMPTS = 5;
  export function deathCount(msg: amqp.ConsumeMessage): number;
  export async function handleWorkerError(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    queueName: string,
    error: unknown,
    logger: WorkerLogger,
  ): Promise<void>;
  export interface WorkerLogger {
    warn: (m: string) => void;
    error: (m: string, e?: unknown) => void;
  }
  ```

- [ ] **Step 1: Testi yaz**

```ts
// backend/src/workers/worker-error.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type amqp from 'amqplib';
import { RETRY_TOPOLOGY } from '@services/queue-names';
import { deathCount, handleWorkerError, MAX_ATTEMPTS } from './worker-error';

const channel = {
  nack: vi.fn(),
  ack: vi.fn(),
  publish: vi.fn(),
} as unknown as amqp.Channel;

const logger = { warn: vi.fn(), error: vi.fn() };

/** A delivery, with however many dead-letter hops RabbitMQ has recorded. */
function message(deaths?: number): amqp.ConsumeMessage {
  return {
    content: Buffer.from('4321'),
    fields: {},
    properties: {
      headers:
        deaths === undefined
          ? {}
          : { 'x-death': [{ count: deaths, queue: 'esi_type_info_queue' }] },
    },
  } as unknown as amqp.ConsumeMessage;
}

beforeEach(() => vi.clearAllMocks());

describe('deathCount', () => {
  it('is 0 on a first delivery, which carries no x-death', () => {
    expect(deathCount(message())).toBe(0);
  });

  it('reads the brokers own counter', () => {
    expect(deathCount(message(3))).toBe(3);
  });
});

describe('handleWorkerError', () => {
  it('waits and requeues on 420 without burning an attempt', async () => {
    vi.useFakeTimers();
    const error = { response: { status: 420 } };
    const done = handleWorkerError(
      channel,
      message(4),
      'esi_type_info_queue',
      error,
      logger,
    );
    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    vi.useRealTimers();

    // requeue: true — back to the head of its own queue, no DLX hop, so the
    // attempt counter does not move. Being error-limited is not a defect in
    // the message.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('acks a 404 rather than retrying something that will never exist', async () => {
    await handleWorkerError(
      channel,
      message(),
      'esi_type_info_queue',
      new Error('Request failed with status code 404'),
      logger,
    );

    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('nacks without requeue so the message takes the DLX path', async () => {
    await handleWorkerError(
      channel,
      message(1),
      'esi_type_info_queue',
      new Error('ESI 500'),
      logger,
    );

    // requeue: false is what sends it to killreport.dlx -> wait -> back.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('parks the message once it has used every attempt', async () => {
    await handleWorkerError(
      channel,
      message(MAX_ATTEMPTS),
      'esi_type_info_queue',
      new Error('ESI 500'),
      logger,
    );

    expect(channel.publish).toHaveBeenCalledWith(
      '',
      RETRY_TOPOLOGY.parking,
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('settles the message exactly once on every path', async () => {
    for (const deaths of [0, 1, MAX_ATTEMPTS]) {
      vi.clearAllMocks();
      await handleWorkerError(
        channel,
        message(deaths),
        'esi_type_info_queue',
        new Error('boom'),
        logger,
      );
      const settled =
        (channel.ack as ReturnType<typeof vi.fn>).mock.calls.length +
        (channel.nack as ReturnType<typeof vi.fn>).mock.calls.length;
      // A message settled twice is a channel error; settled zero times is a
      // worker that stops consuming once prefetch fills.
      expect(settled).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend test worker-error`
Expected: FAIL — `Cannot find module './worker-error'`

- [ ] **Step 3: Uygulamayı yaz**

```ts
// backend/src/workers/worker-error.ts
import { RETRY_TOPOLOGY } from '@services/queue-names';
import type amqp from 'amqplib';

/**
 * How many times a message may fail before it is parked.
 *
 * Five, unchanged from the topology chain's own constant — this generalises
 * that path rather than replacing its policy.
 */
export const MAX_ATTEMPTS = 5;

export interface WorkerLogger {
  warn: (m: string) => void;
  error: (m: string, e?: unknown) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * How many times the broker has already dead-lettered this message.
 *
 * RabbitMQ writes `x-death` on every dead-letter hop, so the counter comes for
 * free and the message body never has to carry one. That is what lets the
 * plain-integer queues join this path without changing their wire format — the
 * topology chain needed an `attempts` field in its payload only because it was
 * counting by itself.
 *
 * A first delivery has no `x-death` at all, which is 0.
 */
export function deathCount(msg: amqp.ConsumeMessage): number {
  const deaths = msg.properties.headers?.['x-death'];
  if (!Array.isArray(deaths) || deaths.length === 0) return 0;
  const count = deaths[0]?.count;
  return typeof count === 'number' ? count : 0;
}

function isErrorLimited(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 420;
}

function isNotFound(error: unknown): boolean {
  return String((error as { message?: string })?.message ?? '').includes('404');
}

/**
 * The failure path every worker shares.
 *
 * It replaces ~25 copies of the same try/catch, of which 17 called
 * `nack(msg, false, true)` — an unbounded requeue, so a message that fails
 * deterministically retried forever against the 50 req/sec ESI ceiling and
 * surfaced nowhere.
 *
 * It always settles the message itself: exactly one ack or nack on every path.
 */
export async function handleWorkerError(
  channel: amqp.Channel,
  msg: amqp.ConsumeMessage,
  queueName: string,
  error: unknown,
  logger: WorkerLogger,
): Promise<void> {
  // 420: ESI error limited. Wait, requeue untouched, burn no attempt — being
  // rate limited is not a defect in the message.
  if (isErrorLimited(error)) {
    logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
    await sleep(60_000);
    channel.nack(msg, false, true);
    return;
  }

  // 404: the id names nothing. Retrying cannot make it exist.
  if (isNotFound(error)) {
    logger.warn(`  ! ${queueName}: not found (404), skipping`);
    channel.ack(msg);
    return;
  }

  const attempts = deathCount(msg);

  if (attempts >= MAX_ATTEMPTS) {
    logger.error(
      `☠️  ${queueName}: giving up after ${MAX_ATTEMPTS} attempts, parking`,
      error,
    );
    // The default exchange with the queue's own name as the routing key: no
    // binding needed, and the origin stays readable in the message's own
    // x-death header.
    channel.publish('', RETRY_TOPOLOGY.parking, msg.content, {
      persistent: true,
    });
    channel.ack(msg);
    return;
  }

  logger.error(
    `❌ ${queueName}: attempt ${attempts + 1}/${MAX_ATTEMPTS} failed`,
    error,
  );
  // requeue: false is the whole mechanism — it sends the message to
  // killreport.dlx, which fans it into killreport.wait, whose TTL returns it
  // here through killreport.retry with x-death incremented.
  channel.nack(msg, false, false);
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `yarn workspace backend test worker-error`
Expected: PASS, 6 test

- [ ] **Step 5: Commit**

```bash
npx prettier --check backend/src/workers/worker-error.ts backend/src/workers/worker-error.spec.ts
git add backend/src/workers/worker-error.ts backend/src/workers/worker-error.spec.ts
git commit -m "feat(workers): add the shared failure path every worker will use"
```

---

### Task 9: İlk worker'ı geçir, uçtan uca doğrula

**Files:**

- Modify: `backend/src/workers/worker-info-alliances.ts:141-155` (`catch` bloğu)

**Interfaces:**

- Consumes: Task 8'den `handleWorkerError`.
- Produces: sonraki görevin birebir kopyalayacağı desen.

- [ ] **Step 1: `catch` gövdesini değiştir**

Bugünkü hâli:

```ts
          } catch (error: any) {
            totalErrors++;
            totalProcessed++;

            if (error.message?.includes('404')) {
              logger.warn(
                `  ! [${totalProcessed}] Alliance ${message.entityId} (404)`,
              );
              channel.ack(msg);
            } else {
              logger.error(
                `  × [${totalProcessed}] Alliance ${message.entityId}: ${error.message}`,
              );
              channel.nack(msg, false, true);
            }
          }
```

Yeni hâli:

```ts
          } catch (error) {
            totalErrors++;
            totalProcessed++;
            // 404, the 420 backoff and the attempt count all live in the
            // shared path now; this worker only says which message it was.
            await handleWorkerError(
              channel,
              msg,
              QUEUE_NAME,
              error,
              {
                warn: (m) => logger.warn(`  ${m} (alliance ${allianceId})`),
                error: (m, e) => logger.error(`  ${m} (alliance ${allianceId})`, e),
              },
            );
          }
```

ve dosyanın başına `import { handleWorkerError } from './worker-error';`

- [ ] **Step 2: Derle**

Run: `yarn workspace backend build`
Expected: hata yok.

- [ ] **Step 3: Uçtan uca dene — bu görevin asıl işi**

```bash
# 1. Sunucuyu aç, kuyruklar ve topoloji beyan edilsin
yarn workspace backend dev &

# 2. Poliçe yerel broker'da uygulanmış olmalı (Task 7, Adım 3)
sudo rabbitmqctl list_queues name policy | grep esi_alliance_info_queue

# 3. Var olmayan bir alliance id'si kuyruğa koy — ESI 404 değil 500 döndürsün
#    diye gerçekten var olmayan ama biçimsel olarak geçerli bir id seç.
#    Kolay yol: worker'ı çalıştır ve ESI'yi kesmek için ağ yok say.
yarn workspace backend worker:info:alliances
```

Beklenen davranış, logdan okunacak:

- ilk başarısızlık → `attempt 1/5 failed`
- ~30 saniye sonra aynı mesaj geri gelir → `attempt 2/5`
- beşinci denemeden sonra → `giving up after 5 attempts, parking`
- `sudo rabbitmqctl list_queues name messages | grep killreport.parking` → 1

**Bu adım geçmeden Task 10'a geçme.** 24 worker'ı çalışmayan bir yola
bağlamak, 24 worker'ı tek tek geri almak demek.

- [ ] **Step 4: Commit**

```bash
npx prettier --check backend/src/workers/worker-info-alliances.ts
git add backend/src/workers/worker-info-alliances.ts
git commit -m "feat(workers): route the alliance info worker through the shared failure path"
```

---

### Task 10: Kalan 24 tüketiciyi geçir

**Files:** aşağıdaki 24 dosya, `backend/src/workers/` altında:

```
worker-alliance-corporations.ts   worker-asteroid-belts.ts
worker-backfill-values.ts         worker-constellations.ts
worker-esi-corporation-killmails.ts  worker-esi-user-killmails.ts
worker-info-categories.ts         worker-info-characters.ts
worker-info-corporations.ts       worker-info-dogma-attributes.ts
worker-info-dogma-effects.ts      worker-info-item-groups.ts
worker-info-types.ts              worker-killmails.ts
worker-moons.ts                   worker-planets.ts
worker-prices.ts                  worker-regions.ts
worker-solar-systems.ts           worker-stargates.ts
worker-stars.ts                   worker-stations.ts
worker-type-dogma.ts              worker-zkillboard-sync.ts
```

**Interfaces:**

- Consumes: Task 8'den `handleWorkerError`, Task 9'dan desen.
- Produces: yok.

- [ ] **Step 1: Her dosyada aynı dönüşümü uygula**

Her worker'ın tüketici geri çağrısında şuna benzeyen bir `catch` var — 404
dalı, `nack` çağrısı, bazılarında ayrıca bir 420 dalı:

```ts
          } catch (error: any) {
            totalErrors++;
            totalProcessed++;

            if (error.message?.includes('404')) {
              logger.warn(`  ! [${totalProcessed}] Thing ${id} (404)`);
              channel.ack(msg);
            } else {
              logger.error(`  × [${totalProcessed}] Thing ${id}: ${error.message}`);
              channel.nack(msg, false, true);
            }
          }
```

Hepsi şuna iniyor:

```ts
          } catch (error) {
            totalErrors++;
            totalProcessed++;
            // 404, the 420 backoff and the attempt count all live in the
            // shared path now; this worker only says which message it was.
            await handleWorkerError(channel, msg, QUEUE_NAME, error, {
              warn: (m) => logger.warn(`  ${m} (${id})`),
              error: (m, e) => logger.error(`  ${m} (${id})`, e),
            });
          }
```

ve dosyanın başına `import { handleWorkerError } from './worker-error';`.

`id` her worker'ın kendi değişkeni — `allianceId`, `typeId`, `systemId` gibi;
o dosyada ne deniyorsa o. Sayaç artırmaları (`totalErrors++`,
`totalProcessed++`) worker'ın kendi muhasebesi, kalır. `channel.ack(msg)`
başarı yolunda kalır; `handleWorkerError` yalnızca başarısızlık yolunu
devralıyor ve mesajı kendisi settle ediyor, o yüzden `catch` içinde başka
hiçbir `ack`/`nack` kalmamalı.

**Tek PR, tek commit değil — dosya başına bir commit de olabilir, ama hepsi bu
görevde bitmeli.** Yarım göç edilmiş bir kod tabanı ikisinden de kötü: kalan
worker'lar hâlâ sonsuza kadar requeue ederken parking kuyruğu dolu görünür ve
kimse hangisinin hangisi olduğunu bilemez.

- [ ] **Step 2: Hiç kalmadığını doğrula**

Run:

```bash
cd backend && grep -rn "nack(msg, false, true)\|nack(message, false, true)" src | grep -v worker-error
```

Expected: boş çıktı. Tek meşru `requeue: true` `worker-error.ts`'in 420 dalında.

Run:

```bash
cd backend && grep -rn "nack(msg, false, false)\|nack(message, false, false)" src | grep -v worker-error
```

Expected: boş çıktı.

- [ ] **Step 3: Derle ve test et**

Run: `yarn workspace backend build && yarn test`
Expected: ikisi de geçer.

- [ ] **Step 4: Bir worker daha canlı dene**

Task 9'daki turu farklı bir worker'la tekrarla — `worker:info:types` iyi bir
seçim, çünkü prefetch'i yüksek ve 404'ü sık.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workers
git commit -m "refactor(workers): route every worker through the shared failure path"
```

---

### Task 11: Eski DLQ yolunu emekli et

**Files:**

- Modify: `backend/src/queues/topology-messages.ts:139-197` (`handleWorkerError`), `:30` (`MAX_ATTEMPTS`), `TopologyMessage.attempts`
- Modify: `backend/src/services/queue-names.ts` (`esi_topology_dlq` çıkar)

**Interfaces:**

- Consumes: Task 8'den `handleWorkerError`.
- Produces: yok.

- [ ] **Step 1: Eski `handleWorkerError`'ı sil**

`backend/src/queues/topology-messages.ts` içindeki `handleWorkerError`,
`MAX_ATTEMPTS` ve `assertTopologyQueue` DLQ yolu siliniyor. Çağıranlar Task
10'da zaten yeni yola geçti.

- [ ] **Step 2: `attempts` zarfını sil**

`TopologyMessage` arayüzünden `attempts` alanını ve onu yazan/okuyan her yeri
kaldır. Deneme sayısı artık `x-death`'te.

- [ ] **Step 3: `esi_topology_dlq`'yu listeden çıkar**

`queue-names.ts`'teki `ALL_QUEUES` dizisinden sil. **Kuyruğu broker'dan
silme** — içinde mesaj olabilir ve bu planın hiçbir adımı veri kaybetmez.
Boş olduğunu doğrula, sonra elle silmeyi ayrı bir ops kararı olarak bırak:

```bash
sudo rabbitmqctl list_queues name messages | grep esi_topology_dlq
```

- [ ] **Step 4: Derle ve test et**

Run: `yarn workspace backend build && yarn test`
Expected: ikisi de geçer.

- [ ] **Step 5: Ops dokümanına not düş**

`backend/docs/ops/rabbitmq.md`'ye bir bölüm: `esi_topology_dlq` is retired;
`killreport.parking` replaces it. The old queue is left in place because it may
hold messages; drain it, then delete it by hand.

- [ ] **Step 6: Commit**

```bash
npx prettier --check backend/src/queues/topology-messages.ts backend/src/services/queue-names.ts backend/docs/ops/rabbitmq.md
git add -A
git commit -m "refactor(workers): retire the topology dead letter queue and its attempt envelope"
```

---

## Kapanış

- [ ] **Tam doğrulama seti**

```bash
yarn test
yarn workspace backend build
yarn workspace backend codegen
yarn workspace frontend codegen
yarn workspace frontend lint     # sayıyı main ile karşılaştır
yarn workspace frontend build:check
npx prettier --check $(git diff --name-only main)
```

- [ ] **PR'ı aç**

Gövde düzyazı bölümler hâlinde (#195/#196 gibi), checkbox şablonu değil.
Kapsam dışı bırakılan publisher confirms'i ve nedenini yaz. `Closes #172`.

- [ ] **`esi_type_price_queue` kontrolü**

Bu ad bugüne kadar izleniyor ama beyan edilmiyordu. PR açmadan önce
`/workers` sayfasında göründüğünü ve `health` döndürdüğünü doğrula.
