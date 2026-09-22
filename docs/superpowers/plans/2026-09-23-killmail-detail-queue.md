# Killmail Detail Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Çeken kaynaklar killmail'i tek mesajın içinde işlemeyi bıraksın;
killmail başına bir mesaj yayınlasınlar ve kaynaktan bağımsız tek bir worker
onları tüketsin.

**Architecture:** İki aşama. Liste aşaması bugünkü worker'ların kendisidir —
mesajları ve kuyrukları aynı kalır — ama iç döngüleri detay çekip yazmak yerine
`{ killmailId, killmailHash, announce }` yayınlar, ve yayınlamadan önce
veritabanında olan id'leri eler. `esi_killmail_detail_queue`'yu tüketen
`worker-killmail-detail` public detay ucundan çeker ve `saveKillmail`'i çağırır.
Artımlı sync'in imleci `killmail_filters`'tan türetilir. RedisQ boruya girmez.

**Tech Stack:** TypeScript, RabbitMQ (amqplib), Prisma (`prismaWorker`),
Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-23-killmail-detail-queue-design.md`

## Global Constraints

- **Yarn only, never npm.**
- **Her `assertQueue` `arguments: { 'x-max-priority': 10 }` geçer.** Kuyruk
  `ALL_QUEUES`'a eklenir ve `ensureAllQueuesExist()` üzerinden tanımlanır;
  ikinci bir liste yoktur (`services/queue-names.ts`).
- **Mesaj kimlik bilgisi taşımaz.** `/killmails/{id}/{hash}/` public uçtur;
  token gerektiren liste çağrısı liste aşamasında kalır (#238).
- **Öncelikler:** toplu backfill `1`, canlı sync `5`.
- **`PREFETCH_COUNT = 10`**, `ESI_PREFETCH` ile ayarlanabilir; gerçek tavan
  `esiRateLimiter`.
- **`saveKillmail`'e dokunulmaz.** #248'de yerleşti.
- **RedisQ değişmez.** `worker-redisq-stream` doğrudan yazmaya devam eder.
- Her görev sonunda `npx prettier --check` temiz.

## Review Focus

Spec'in ima ettiği, hiçbir görevin doğal akışında test edilmeyecek beş durum;
her biri sahibi olan görevin adımına test olarak eklendi:

1. **Liste boş dönerse** — yayıncı sıfır mesaj atmalı ve imleci bozmamalı
   (Görev 2, Adım 7).
2. **Sayfadaki id'lerin tamamı zaten veritabanındaysa** — tek `findMany` ile
   elenmeli, kuyruğa hiçbir şey gitmemeli, ESI detayına hiç çıkılmamalı
   (Görev 2, Adım 5).
3. **Karakterin veritabanında hiç killmail'i yoksa** — türetilen imleç
   `undefined` olmalı, `0` değil; `0` verilirse liste ucu erken kesilir
   (Görev 3, Adım 5).
4. **Aynı killmail iki kaynaktan yayınlanırsa** — ikinci mesaj yazıcının varlık
   kontrolüne takılır ve `false` döner; worker bunu hata saymamalı (Görev 1,
   Adım 9).
5. **Attacker'sız killmail** — yazıcı fırlatır, mesaj beş denemeden sonra
   parking'e gider; worker onu ack'leyip yutmamalı (Görev 1, Adım 11).

---

## Task 1: Kuyruk, mesaj tipi ve detay worker'ı

**Files:**

- Modify: `backend/src/services/queue-names.ts` — `ALL_QUEUES`'a bir satır
- Create: `backend/src/services/killmail-detail-message.ts`
- Create: `backend/src/services/killmail-detail-message.spec.ts`
- Create: `backend/src/workers/worker-killmail-detail.ts`
- Create: `backend/src/workers/worker-killmail-detail.spec.ts`
- Modify: `backend/package.json` — `worker:killmail-detail` script
- Modify: `ecosystem.config.js` — PM2 girdisi

**Interfaces:**

- Consumes: `saveKillmail` (`@services/killmail-writer`),
  `KillmailService.getKillmailDetail`, `handleWorkerError`,
  `ensureAllQueuesExist`, `getRabbitMQChannel`.
- Produces:

```ts
export const KILLMAIL_DETAIL_QUEUE = 'esi_killmail_detail_queue';

export interface KillmailDetailMessage {
  killmailId: number;
  killmailHash: string;
  /** NEW_KILLMAIL yayınlansın mı; toplu backfill false geçer. */
  announce: boolean;
}

export function buildDetailMessage(
  killmailId: number,
  killmailHash: string,
  announce: boolean,
): KillmailDetailMessage;

/** Tek mesajı işler; worker'ın consumer callback'i bunu çağırır. */
export async function processDetailMessage(
  message: KillmailDetailMessage,
): Promise<boolean>;
```

`processDetailMessage` `worker-killmail-detail.ts`'ten export edilir ve
`saveKillmail`'in dönüşünü aynen döndürür.

- [ ] **Step 1: Mesaj tipinin testini yaz**

`backend/src/services/killmail-detail-message.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDetailMessage,
  KILLMAIL_DETAIL_QUEUE,
} from './killmail-detail-message';

describe('buildDetailMessage', () => {
  it('names the killmail and nothing about who found it', () => {
    const message = buildDetailMessage(128431979, 'abc123', true);

    expect(message).toEqual({
      killmailId: 128431979,
      killmailHash: 'abc123',
      announce: true,
    });
    // The detail endpoint is public; a credential here would be #238 undone.
    expect(Object.keys(message)).not.toContain('accessToken');
    expect(Object.keys(message)).not.toContain('userId');
  });

  it('carries the announce decision, because the publisher makes it and the worker acts on it', () => {
    expect(buildDetailMessage(1, 'h', false).announce).toBe(false);
  });

  it('names the queue in one place', () => {
    expect(KILLMAIL_DETAIL_QUEUE).toBe('esi_killmail_detail_queue');
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd backend && npx vitest run src/services/killmail-detail-message.spec.ts`
Expected: FAIL — `Failed to resolve import "./killmail-detail-message"`

- [ ] **Step 3: Mesaj modülünü yaz**

`backend/src/services/killmail-detail-message.ts`:

```ts
/**
 * `esi_killmail_detail_queue`'nun taşıdığı mesaj.
 *
 * Bir killmail'i adlandırır ve başka hiçbir şey söylemez. Detay ucu
 * (`/killmails/{id}/{hash}/`) public olduğu için worker'ın token'a ihtiyacı
 * yoktur; token gerektiren liste çağrısı yayıncıda kalır (#238).
 *
 * `announce` bir politika taşır, kimlik değil: yayını yapıp yapmama kararını
 * yayıncı verir (toplu backfill vermez), ama çağrıyı yapan worker'dır.
 */
export const KILLMAIL_DETAIL_QUEUE = 'esi_killmail_detail_queue';

export interface KillmailDetailMessage {
  killmailId: number;
  killmailHash: string;
  announce: boolean;
}

export function buildDetailMessage(
  killmailId: number,
  killmailHash: string,
  announce: boolean,
): KillmailDetailMessage {
  return { killmailId, killmailHash, announce };
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `cd backend && npx vitest run src/services/killmail-detail-message.spec.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Kuyruğu ALL_QUEUES'a ekle**

`backend/src/services/queue-names.ts` içinde, `// Killmail workers` bloğuna:

```ts
  'esi_killmail_detail_queue',
```

Run: `cd backend && grep -n "esi_killmail_detail_queue" src/services/queue-names.ts`
Expected: bir satır

- [ ] **Step 6: Commit**

```bash
npx prettier --write backend/src/services/killmail-detail-message.ts backend/src/services/killmail-detail-message.spec.ts backend/src/services/queue-names.ts
git add backend/src/services/killmail-detail-message.ts backend/src/services/killmail-detail-message.spec.ts backend/src/services/queue-names.ts
git commit -m "feat(workers): declare the killmail detail queue and its message"
```

- [ ] **Step 7: Worker'ın test iskeletini yaz**

`backend/src/workers/worker-killmail-detail.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveKillmail, getKillmailDetail, loggerMock } = vi.hoisted(() => ({
  saveKillmail: vi.fn(async () => true),
  getKillmailDetail: vi.fn(async () => ({
    killmail_id: 128431979,
    killmail_time: '2026-09-19T14:03:22Z',
    solar_system_id: 30002187,
    victim: { corporation_id: 1, ship_type_id: 670, damage_taken: 1 },
    attackers: [{ damage_done: 1, final_blow: true, security_status: 0 }],
  })),
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@services/killmail-writer', () => ({ saveKillmail }));
vi.mock('@services/killmail/killmail.service', () => ({
  KillmailService: { getKillmailDetail },
}));
vi.mock('@services/logger', () => ({ default: loggerMock }));
vi.mock('@services/prisma-worker', () => ({ default: {} }));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getRabbitMQChannel: vi.fn(),
}));

import { processDetailMessage } from './worker-killmail-detail';

beforeEach(() => vi.clearAllMocks());
```

- [ ] **Step 8: İlk worker testini yaz**

Aynı dosyanın sonuna:

```ts
describe('processDetailMessage', () => {
  it('fetches the detail by id and hash, then writes it', async () => {
    await processDetailMessage({
      killmailId: 128431979,
      killmailHash: 'abc123',
      announce: true,
    });

    expect(getKillmailDetail).toHaveBeenCalledWith(128431979, 'abc123');
    expect(saveKillmail).toHaveBeenCalledWith(
      expect.objectContaining({ killmail_id: 128431979 }),
      'abc123',
      { publish: true },
    );
  });

  it('carries announce: false through to the writer', async () => {
    await processDetailMessage({
      killmailId: 1,
      killmailHash: 'h',
      announce: false,
    });

    expect(saveKillmail).toHaveBeenCalledWith(expect.anything(), 'h', {
      publish: false,
    });
  });
});
```

- [ ] **Step 9: Duplicate testini yaz (Review Focus 4)**

```ts
describe('a killmail two sources both found', () => {
  it('reports the writer’s false without treating it as a failure', async () => {
    saveKillmail.mockResolvedValueOnce(false);

    await expect(
      processDetailMessage({
        killmailId: 1,
        killmailHash: 'h',
        announce: true,
      }),
    ).resolves.toBe(false);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Testlerin düştüğünü gör**

Run: `cd backend && npx vitest run src/workers/worker-killmail-detail.spec.ts`
Expected: FAIL — `processDetailMessage is not a function`

- [ ] **Step 11: Worker'ı yaz**

`backend/src/workers/worker-killmail-detail.ts`:

```ts
import type amqp from 'amqplib';
import { saveKillmail } from '@services/killmail-writer';
import {
  KILLMAIL_DETAIL_QUEUE,
  type KillmailDetailMessage,
} from '@services/killmail-detail-message';
import { KillmailService } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = KILLMAIL_DETAIL_QUEUE;

/**
 * Kaç mesajın aynı anda elde tutulacağı. Gerçek ESI tavanı `esiRateLimiter`
 * tarafından tutulur (50 req/sn); bu sayı yalnızca unacked mesaj sayısıdır ve
 * bu worker'ın yazma yolu tek killmail'lik küçük bir transaction.
 */
const PREFETCH_COUNT = Number(process.env.ESI_PREFETCH ?? 10);

/**
 * Tek mesaj: public detay ucundan çek, yazıcıya ver.
 *
 * Dönüş, yazıcının dönüşüdür — `false` "zaten vardı" demektir ve bir hata
 * değildir: aynı killmail'i iki kaynak birden bulabilir.
 */
export async function processDetailMessage(
  message: KillmailDetailMessage,
): Promise<boolean> {
  const detail = await KillmailService.getKillmailDetail(
    message.killmailId,
    message.killmailHash,
  );

  return saveKillmail(detail, message.killmailHash, {
    publish: message.announce,
  });
}

/**
 * Killmail detay worker'ı.
 *
 * Kaynaktan bağımsızdır: mesajı hangi liste aşamasının yayınladığını bilmez.
 * Kimlik bilgisi taşımaz, çünkü `/killmails/{id}/{hash}/` public bir uçtur.
 *
 * Usage: yarn worker:killmail-detail
 */
export async function killmailDetailWorker() {
  logger.info('🔄 Killmail Detail Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT}`);

  await ensureAllQueuesExist();
  const channel = await getRabbitMQChannel();
  channel.prefetch(PREFETCH_COUNT);

  await channel.consume(
    QUEUE_NAME,
    async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;

      let message: KillmailDetailMessage | undefined;
      try {
        message = JSON.parse(msg.content.toString()) as KillmailDetailMessage;
        const saved = await processDetailMessage(message);
        logger.debug(
          `${saved ? '✅ saved' : '⏭️  already stored'}: ${message.killmailId}`,
        );
        channel.ack(msg);
      } catch (error) {
        // 404, the 420/429 backoff, the attempt count and parking all live in
        // the shared path. A killmail the writer refuses — no attackers —
        // lands there too and parks after five attempts, which is right: it
        // needs re-fetching, and parking is what makes it visible.
        await handleWorkerError(channel, msg, QUEUE_NAME, error, {
          warn: (m) => logger.warn(`  ${m} (killmail ${message?.killmailId})`),
          error: (m, e) =>
            logger.error(`  ${m} (killmail ${message?.killmailId})`, e),
        });
      }
    },
    { noAck: false },
  );

  logger.info(`📊 Ready to process messages from ${QUEUE_NAME}\n`);
}

if (require.main === module) {
  killmailDetailWorker().catch((error) => {
    logger.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
```

- [ ] **Step 12: Testlerin geçtiğini gör**

Run: `cd backend && npx vitest run src/workers/worker-killmail-detail.spec.ts`
Expected: PASS (3 test)

- [ ] **Step 13: Attacker'sız killmail testini yaz (Review Focus 5)**

```ts
describe('a killmail the writer refuses', () => {
  it('lets the throw reach the shared failure path instead of acking it away', async () => {
    saveKillmail.mockRejectedValueOnce(
      new Error('killmail 1 has no attackers; refusing to write it'),
    );

    await expect(
      processDetailMessage({
        killmailId: 1,
        killmailHash: 'h',
        announce: true,
      }),
    ).rejects.toThrow(/no attackers/i);
  });
});
```

Run: `cd backend && npx vitest run src/workers/worker-killmail-detail.spec.ts`
Expected: PASS (4 test) — `processDetailMessage` hatayı yutmuyor, bu testin
kanıtladığı şey bu.

- [ ] **Step 14: package.json script'ini ekle**

`backend/package.json`, `"worker:corporation-killmails"` satırının altına:

```json
    "worker:killmail-detail": "tsx src/workers/worker-killmail-detail.ts",
```

- [ ] **Step 15: PM2 girdisini ekle**

`ecosystem.config.js`, `worker-corporation-killmails` bloğunun ardına, aynı
şekille:

```js
    // Killmail Detail Worker - one message per killmail, source-agnostic
    {
      name: 'worker-killmail-detail',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:killmail-detail',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      restart_delay: 5000,
      error_file: '/var/www/killreport/logs/worker-killmail-detail-error.log',
      out_file: '/var/www/killreport/logs/worker-killmail-detail-out.log',
      time: true,
    },
```

- [ ] **Step 16: Tip kontrolü ve tam test**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: tsc boş, testlerin hepsi PASS

- [ ] **Step 17: Commit**

```bash
npx prettier --write backend/src/workers/worker-killmail-detail.ts backend/src/workers/worker-killmail-detail.spec.ts backend/package.json ecosystem.config.js
git add backend/src/workers/worker-killmail-detail.ts backend/src/workers/worker-killmail-detail.spec.ts backend/package.json ecosystem.config.js
git commit -m "feat(workers): add the killmail detail worker

One message, one killmail, no credentials: the detail endpoint is public, so
the only call that needs a token stays in the list stage. It is
source-agnostic — it never learns which publisher found the killmail — and its
failure path is the shared one, including for a killmail the writer refuses."
```

---

## Task 2: Yayıncı yardımcısı

**Files:**

- Create: `backend/src/queues/publish-killmail-details.ts`
- Create: `backend/src/queues/publish-killmail-details.spec.ts`

**Interfaces:**

- Consumes: `buildDetailMessage`, `KILLMAIL_DETAIL_QUEUE` (Görev 1);
  `prismaWorker`, `getRabbitMQChannel`.
- Produces:

```ts
export interface KillmailRef {
  killmail_id: number;
  killmail_hash: string;
}

export interface PublishOptions {
  announce: boolean;
  /** Toplu backfill 1, canlı sync 5. */
  priority: number;
}

/** Veritabanında olmayanları yayınlar; yayınlanan sayısını döner. */
export async function publishKillmailDetails(
  refs: KillmailRef[],
  options: PublishOptions,
): Promise<number>;
```

Dört liste aşamasının tamamı bunu çağırır; eleme ve yayın mantığı tek yerde
kalır.

- [ ] **Step 1: Test iskeletini yaz**

`backend/src/queues/publish-killmail-details.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, channel, getRabbitMQChannel, loggerMock } = vi.hoisted(
  () => {
    const channel = { sendToQueue: vi.fn() };
    return {
      channel,
      prismaMock: { killmail: { findMany: vi.fn() } },
      getRabbitMQChannel: vi.fn(async () => channel),
      loggerMock: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  },
);

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/rabbitmq', () => ({ getRabbitMQChannel }));
vi.mock('@services/logger', () => ({ default: loggerMock }));

import { publishKillmailDetails } from './publish-killmail-details';

const REFS = [
  { killmail_id: 1, killmail_hash: 'h1' },
  { killmail_id: 2, killmail_hash: 'h2' },
  { killmail_id: 3, killmail_hash: 'h3' },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.killmail.findMany.mockResolvedValue([]);
});
```

- [ ] **Step 2: Yayın testini yaz**

```ts
describe('publishing', () => {
  it('publishes one message per killmail, on the detail queue', async () => {
    const published = await publishKillmailDetails(REFS, {
      announce: true,
      priority: 5,
    });

    expect(published).toBe(3);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(3);
    const [queue, content, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe('esi_killmail_detail_queue');
    expect(JSON.parse(content.toString())).toEqual({
      killmailId: 1,
      killmailHash: 'h1',
      announce: true,
    });
    expect(options).toMatchObject({ persistent: true, priority: 5 });
  });

  it('marks a backfill as quiet and low priority', async () => {
    await publishKillmailDetails(REFS, { announce: false, priority: 1 });

    const [, content, options] = channel.sendToQueue.mock.calls[0];
    expect(JSON.parse(content.toString()).announce).toBe(false);
    expect(options).toMatchObject({ priority: 1 });
  });
});
```

- [ ] **Step 3: Eleme testini yaz (Review Focus 2)**

```ts
describe('killmails already in the database', () => {
  it('asks once for the whole page and publishes only what is missing', async () => {
    prismaMock.killmail.findMany.mockResolvedValue([{ killmail_id: 2 }]);

    const published = await publishKillmailDetails(REFS, {
      announce: true,
      priority: 5,
    });

    expect(prismaMock.killmail.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.killmail.findMany).toHaveBeenCalledWith({
      where: { killmail_id: { in: [1, 2, 3] } },
      select: { killmail_id: true },
    });
    expect(published).toBe(2);
    const ids = channel.sendToQueue.mock.calls.map(
      ([, content]) => JSON.parse(content.toString()).killmailId,
    );
    expect(ids).toEqual([1, 3]);
  });

  it('publishes nothing, and opens no channel, when the page is all duplicates', async () => {
    prismaMock.killmail.findMany.mockResolvedValue([
      { killmail_id: 1 },
      { killmail_id: 2 },
      { killmail_id: 3 },
    ]);

    const published = await publishKillmailDetails(REFS, {
      announce: true,
      priority: 5,
    });

    expect(published).toBe(0);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
    // This is the whole point: a re-sync of a stored character costs one
    // query per page and no ESI detail calls at all.
    expect(getRabbitMQChannel).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Testlerin düştüğünü gör**

Run: `cd backend && npx vitest run src/queues/publish-killmail-details.spec.ts`
Expected: FAIL — `Failed to resolve import "./publish-killmail-details"`

- [ ] **Step 5: Yardımcıyı yaz**

`backend/src/queues/publish-killmail-details.ts`:

```ts
import {
  buildDetailMessage,
  KILLMAIL_DETAIL_QUEUE,
} from '@services/killmail-detail-message';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

export interface KillmailRef {
  killmail_id: number;
  killmail_hash: string;
}

export interface PublishOptions {
  announce: boolean;
  /** Toplu backfill 1, canlı sync 5. */
  priority: number;
}

/**
 * Liste aşamasının kuyruğa koyma adımı.
 *
 * Veritabanında olan id'ler **yayınlanmaz**: CLAUDE.md'nin enrichment kalıbı —
 * kaynak veritabanından okur, çözülmüş olanı eler, yalnızca eksik olanı
 * kuyruğa koyar. Bu, "önce detayı çek, sonra duplicate'e takıl" sırasını
 * tersine çevirir; zaten kayıtlı bir karakterin yeniden sync'i sayfa başına
 * tek sorguya iner ve hiç ESI detayı çekmez.
 */
export async function publishKillmailDetails(
  refs: KillmailRef[],
  options: PublishOptions,
): Promise<number> {
  if (refs.length === 0) return 0;

  const known = await prismaWorker.killmail.findMany({
    where: { killmail_id: { in: refs.map((r) => r.killmail_id) } },
    select: { killmail_id: true },
  });
  const stored = new Set(known.map((k) => k.killmail_id));

  const missing = refs.filter((r) => !stored.has(r.killmail_id));
  if (missing.length === 0) return 0;

  const channel = await getRabbitMQChannel();
  for (const ref of missing) {
    channel.sendToQueue(
      KILLMAIL_DETAIL_QUEUE,
      Buffer.from(
        JSON.stringify(
          buildDetailMessage(
            ref.killmail_id,
            ref.killmail_hash,
            options.announce,
          ),
        ),
      ),
      { persistent: true, priority: options.priority },
    );
  }

  logger.debug(
    `📤 queued ${missing.length}/${refs.length} killmail(s) for detail fetch`,
  );
  return missing.length;
}
```

- [ ] **Step 6: Testlerin geçtiğini gör**

Run: `cd backend && npx vitest run src/queues/publish-killmail-details.spec.ts`
Expected: PASS (4 test)

- [ ] **Step 7: Boş liste testini yaz (Review Focus 1)**

```ts
describe('an empty list', () => {
  it('touches neither the database nor the broker', async () => {
    const published = await publishKillmailDetails([], {
      announce: true,
      priority: 5,
    });

    expect(published).toBe(0);
    expect(prismaMock.killmail.findMany).not.toHaveBeenCalled();
    expect(getRabbitMQChannel).not.toHaveBeenCalled();
  });
});
```

Run: `cd backend && npx vitest run src/queues/publish-killmail-details.spec.ts`
Expected: PASS (5 test)

- [ ] **Step 8: Commit**

```bash
npx prettier --write backend/src/queues/publish-killmail-details.ts backend/src/queues/publish-killmail-details.spec.ts
git add backend/src/queues/publish-killmail-details.ts backend/src/queues/publish-killmail-details.spec.ts
git commit -m "feat(workers): add the publisher every list stage shares

It drops the ids already in the database before queueing anything, which turns
a re-sync of a stored character from one ESI detail call per killmail into one
database query per page."
```

---

## Task 3: Türetilen imleç

**Files:**

- Create: `backend/src/services/killmail-cursor.ts`
- Create: `backend/src/services/killmail-cursor.spec.ts`

**Interfaces:**

- Consumes: `prismaWorker.$queryRaw`.
- Produces:

```ts
export async function lastStoredKillmailId(scope: {
  characterId?: number;
  corporationId?: number;
}): Promise<number | undefined>;
```

Artımlı sync'in nerede duracağını söyler. `undefined` = bu varlık için hiç
killmail yok, yani liste ucu erken kesilmemeli.

- [ ] **Step 1: Test iskeletini ve ilk testi yaz**

`backend/src/services/killmail-cursor.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));

import { lastStoredKillmailId } from './killmail-cursor';

beforeEach(() => vi.clearAllMocks());

describe('lastStoredKillmailId', () => {
  it('returns the highest killmail id stored for a character', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max: 128431979n }]);

    await expect(lastStoredKillmailId({ characterId: 95465499 })).resolves.toBe(
      128431979,
    );
  });

  it('converts the BIGINT Postgres returns, which JSON.stringify would throw on', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max: 42n }]);

    const id = await lastStoredKillmailId({ characterId: 1 });

    expect(typeof id).toBe('number');
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `cd backend && npx vitest run src/services/killmail-cursor.spec.ts`
Expected: FAIL — `Failed to resolve import "./killmail-cursor"`

- [ ] **Step 3: Modülü yaz**

`backend/src/services/killmail-cursor.ts`:

```ts
import prismaWorker from '@services/prisma-worker';

/**
 * Artımlı sync'in nerede duracağı, veritabanından türetilir.
 *
 * Eskiden bu bir kolondu (`users.last_killmail_id`) ve worker killmail'leri
 * yazdıktan sonra ilerletirdi. Yayınlamak ile yazmak ayrılınca o defter
 * yalan söylemeye başlar: yayıncı imleci ilerletirse "sync'lendi" artık
 * "kuyruğa kondu" demektir, ve parking'e düşen bir killmail'in üzerinden
 * geçilmiş olur — bir daha hiç denenmez.
 *
 * Buradan okunduğunda "sync'lendi" yeniden "yazıldı" anlamına gelir: düşen bir
 * mesaj bir sonraki turda yeniden listelenir.
 *
 * `killmail_filters` seçilir çünkü aradığımız indeksler orada: attacker
 * dizileri GIN'li, victim kolonu btree'li. Ölçüldü (2026-09-23, 108.890
 * satır): karakter için 4.8 ms, korporasyon için 4.7 ms — ikisi de bitmap
 * index scan.
 */
export async function lastStoredKillmailId(scope: {
  characterId?: number;
  corporationId?: number;
}): Promise<number | undefined> {
  const rows = scope.characterId
    ? await prismaWorker.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(killmail_id) AS max FROM killmail_filters
        WHERE attacker_character_ids @> ARRAY[${scope.characterId}]::int[]
           OR victim_character_id = ${scope.characterId}
      `
    : await prismaWorker.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(killmail_id) AS max FROM killmail_filters
        WHERE attacker_corporation_ids @> ARRAY[${scope.corporationId}]::int[]
           OR victim_corporation_id = ${scope.corporationId}
      `;

  const max = rows[0]?.max;
  // ::BIGINT comes back as a JavaScript BigInt and JSON.stringify throws on
  // those; every caller passes this straight into a query string or a message.
  return max == null ? undefined : Number(max);
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `cd backend && npx vitest run src/services/killmail-cursor.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Boş sonuç testini yaz (Review Focus 3)**

```ts
describe('an entity with no killmails yet', () => {
  it('answers undefined, not 0', async () => {
    // 0 would be read by the list endpoints as "stop at killmail 0", which
    // truncates the very first sync of a new user to nothing.
    prismaMock.$queryRaw.mockResolvedValue([{ max: null }]);

    await expect(
      lastStoredKillmailId({ characterId: 1 }),
    ).resolves.toBeUndefined();
  });

  it('answers undefined when the query returns no row at all', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(
      lastStoredKillmailId({ characterId: 1 }),
    ).resolves.toBeUndefined();
  });
});
```

Run: `cd backend && npx vitest run src/services/killmail-cursor.spec.ts`
Expected: PASS (4 test)

- [ ] **Step 6: Gerçek veritabanına karşı doğrula**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
CID=$(psql "$DB" -tA -c "SELECT character_id FROM users LIMIT 1")
psql "$DB" -c "EXPLAIN (ANALYZE, COSTS OFF) SELECT MAX(killmail_id) FROM killmail_filters WHERE attacker_character_ids @> ARRAY[$CID]::int[] OR victim_character_id = $CID;"
```

Expected: bitmap index scan (`idx_kmfilters_attacker_chars` +
`idx_kmfilters_victim_char`; korporasyon tarafında `idx_kmfilters_attacker_corps`

- `idx_kmfilters_victim_corp`), tek haneli ms. Seq scan'e düşerse indeks
  eksiktir —
  o zaman devam etmeden önce nedenini bul.

* [ ] **Step 7: Commit**

```bash
npx prettier --write backend/src/services/killmail-cursor.ts backend/src/services/killmail-cursor.spec.ts
git add backend/src/services/killmail-cursor.ts backend/src/services/killmail-cursor.spec.ts
git commit -m "feat(workers): derive the incremental sync cursor from the database

A cursor the publisher advances would mean 'synced' becomes 'queued': a detail
message that parks would be stepped over and never retried. Read from
killmail_filters it means 'written' again, and it repairs itself."
```

---

## Task 4: `sync-character-killmails` liste aşamasına dönsün

**Files:**

- Modify: `backend/src/workers/sync-character-killmails.ts:59-95` — `for (let i = 0; i < zkillmails.length; i++)` döngüsünün tamamı

**Interfaces:**

- Consumes: `publishKillmailDetails` (Görev 2).
- Produces: yok.

Elle koşulan script, en düşük riskli geçiş: kimse ona bağlı değil ve
`announce: false` zaten doğru cevap.

- [ ] **Step 1: İşleme döngüsünü yayınla değiştir**

Bugünkü `for` döngüsünün tamamı — varlık kontrolü, ESI detay çağrısı,
`saveKillmail` — şununla değişir:

```ts
const queued = await publishKillmailDetails(
  zkillmails.map((z) => ({
    killmail_id: z.killmail_id,
    killmail_hash: z.zkb.hash,
  })),
  // Hand-run historical backfill: quiet, and behind anything live.
  { announce: false, priority: 1 },
);

logger.info(
  `📤 Queued ${queued} killmail(s) for detail fetch; ${zkillmails.length - queued} already stored`,
);
logger.info('Now run the worker to process them:');
logger.info('  yarn worker:killmail-detail');
```

`processedCount` / `skippedCount` / `errorCount` sayaçları ve `sleep(100)`
gecikmesi gider: artık bu script killmail işlemiyor, yalnızca yayınlıyor.

- [ ] **Step 2: Import'ları düzelt**

Ekle `publishKillmailDetails`; sil `saveKillmail`, `KillmailService`,
`prismaWorker` (yalnızca `$disconnect` için kullanılıyorsa kalır — kontrol et).

- [ ] **Step 3: Tip kontrolü ve testler**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: tsc boş, testler PASS

- [ ] **Step 4: Uçtan uca dene**

```bash
cd backend
yarn sync:character 95465499 1
```

Expected: "Queued N killmail(s)" satırı; `yarn worker:killmail-detail` ayrı bir
terminalde koşarken killmail'lerin yazıldığı görülür. Sonra:

```sql
SELECT COUNT(*) FROM killmails WHERE killmail_id IN (/* loglanan id'lerden 2-3 tanesi */);
```

- [ ] **Step 5: Commit**

```bash
npx prettier --write backend/src/workers/sync-character-killmails.ts
git add backend/src/workers/sync-character-killmails.ts
git commit -m "refactor(workers): make the hand-run character sync a publisher"
```

---

## Task 5: `worker-zkillboard-sync` liste aşamasına dönsün

**Files:**

- Modify: `backend/src/workers/worker-zkillboard-sync.ts:184` — `for (const zkillPkg of zkillPackages)` döngüsünün gövdesi

**Interfaces:**

- Consumes: `publishKillmailDetails` (Görev 2).
- Produces: yok.

- [ ] **Step 1: İşleme döngüsünü yayınla değiştir**

Killmail döngüsünün gövdesi — detay çağrısı ve `saveKillmail` — şununla
değişir:

```ts
const queued = await publishKillmailDetails(
  killmails.map((k) => ({
    killmail_id: k.killmail_id,
    killmail_hash: k.zkb.hash,
  })),
  // Bulk history: quiet, and behind anything live.
  { announce: false, priority: 1 },
);
savedCount += queued;
skippedCount += killmails.length - queued;
```

- [ ] **Step 2: Import'ları düzelt**

Ekle `publishKillmailDetails`; sil `saveKillmail` ve `KillmailService` (detay
çağrısı kalmadıysa).

- [ ] **Step 3: Tip kontrolü ve testler**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: tsc boş, testler PASS

- [ ] **Step 4: Commit**

```bash
npx prettier --write backend/src/workers/worker-zkillboard-sync.ts
git add backend/src/workers/worker-zkillboard-sync.ts
git commit -m "refactor(workers): make the zKillboard sync a publisher"
```

---

## Task 6: İki ESI sync'i liste aşamasına dönsün

**Files:**

- Modify: `backend/src/workers/worker-esi-corporation-killmails.ts:276` — `for (let i = 0; i < killmailList.length; i++)` döngüsü ve onu saran ilerleme logları
- Modify: `backend/src/workers/worker-esi-user-killmails.ts:241` — `for (const km of batch)` döngüsü ve batch mekanizması

**Interfaces:**

- Consumes: `publishKillmailDetails` (Görev 2), `lastStoredKillmailId`
  (Görev 3).
- Produces: yok.

Canlı yollar en son geçer ve `announce: true` kullanır.

- [ ] **Step 1: Corporation worker'ın imlecini türetilene çevir**

`user.last_corp_killmail_id` okuması şununla değişir:

```ts
const lastKillmailId = message.fullSync
  ? undefined
  : await lastStoredKillmailId({
      corporationId: user.corporation_id,
    });
```

- [ ] **Step 2: Corporation worker'ın döngüsünü yayınla değiştir**

```ts
const queued = await publishKillmailDetails(
  killmailList.map((k) => ({
    killmail_id: k.killmail_id,
    killmail_hash: k.killmail_hash,
  })),
  { announce: true, priority: 5 },
);
logger.info(
  `  📤 Queued ${queued}/${killmailList.length} killmail(s) for detail fetch`,
);
```

Sonundaki `last_corp_killmail_sync_at` damgası **kalır** — o imleç değil, "bu
kullanıcı en son ne zaman ele alındı" bilgisidir ve `killmail-sync-cron`'un 15
dakikalık penceresi ona bakar. `last_corp_killmail_id` yazması **gider**.

- [ ] **Step 3: Aynısını user worker'a uygula**

`lastStoredKillmailId({ characterId: user.character_id })`, aynı yayın bloğu,
`last_killmail_sync_at` kalır, `last_killmail_id` yazması gider.

- [ ] **Step 4: Import'ları düzelt**

Her ikisinde: ekle `publishKillmailDetails` ve `lastStoredKillmailId`; sil
`saveKillmail` ve `KillmailService`.

- [ ] **Step 5: 403 politikasının bozulmadığını doğrula**

`worker-esi-corporation-killmails.spec.ts` (`settleForbidden`) değişmeden
geçmeli: 403 liste çağrısından gelir ve liste aşamasında kalır.

Run: `cd backend && npx vitest run src/workers/worker-esi-corporation-killmails.spec.ts`
Expected: PASS (3 test)

- [ ] **Step 6: Tip kontrolü ve tam test**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: tsc boş, testlerin hepsi PASS

- [ ] **Step 7: Commit**

```bash
npx prettier --write backend/src/workers/worker-esi-corporation-killmails.ts backend/src/workers/worker-esi-user-killmails.ts
git add backend/src/workers/worker-esi-corporation-killmails.ts backend/src/workers/worker-esi-user-killmails.ts
git commit -m "refactor(workers): make both ESI syncs publishers

Their cursor now comes from killmail_filters instead of a column they
advanced themselves, so a killmail whose detail message parks is listed again
on the next tick rather than stepped over."
```

---

## Task 7: Dokümanlar ve tam doğrulama

**Files:**

- Modify: `backend/docs/ops/pm2.md`
- Modify: `CLAUDE.md` — "Established ESI queues and their consumers" tablosu

- [ ] **Step 1: PM2 dokümanına yeni worker'ı ekle**

`worker-corporation-killmails` bölümünün ardından aynı şekilde: komut, kuyruk
(`esi_killmail_detail_queue`), prefetch 10, log yolları, ve "kaynaktan bağımsız,
kimlik taşımaz" notu.

- [ ] **Step 2: CLAUDE.md kuyruk tablosuna satırı ekle**

```markdown
| `esi_killmail_detail_queue` | `worker:killmail-detail` |
```

- [ ] **Step 3: Link kontrolü**

Run: `cd /root/killreport && yarn docs:check-links`
Expected: yalnızca önceden var olan
`.github/prompts/add-killmail-filter.prompt.md:11` kırığı

- [ ] **Step 4: Tam set**

Run: `cd /root/killreport && yarn test && yarn workspace backend build && npx prettier --check .`
Expected: hepsi temiz

- [ ] **Step 5: Frontend lint'i main ile karşılaştır**

Run: `cd /root/killreport && yarn workspace frontend lint 2>&1 | tail -2`
Expected: main'deki sayı (2026-09-23'te 137)

- [ ] **Step 6: Uçtan uca ölçüm**

İki terminal: `yarn worker:killmail-detail` ve `yarn dev:backend`. Cron'un bir
turu geçtikten sonra:

```sql
SELECT (SELECT COUNT(*) FROM killmails) km,
       (SELECT COUNT(*) FROM killmail_filters) f,
       (SELECT COUNT(*) FROM killmails k
          LEFT JOIN killmail_filters kf ON kf.killmail_id = k.killmail_id
        WHERE kf.killmail_id IS NULL) eksik;
```

Expected: `eksik` 0; killmail sayısı artıyor. Ayrıca `workerStatus` sorgusunda
`esi_killmail_detail_queue` derinliğinin gerçek işi gösterdiği görülmeli —
bugün tek mesaj olan yerde artık killmail başına bir mesaj var.

- [ ] **Step 7: PR aç**

Başlık: `refactor(workers): queue killmails one at a time`

Gövde: spec'e ve #244'e atıf; iki aşamanın gerekçesi; türetilen imleç ve
ölçülen 4.8 ms; RedisQ'nun neden dışarıda kaldığı; üretimde `repair:killmail-derived`
koşmadan çıkılmaması gerektiği (bölüm 4'teki bağımlılık).
