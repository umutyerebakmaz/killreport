# Killmail Writer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Killmail'i veritabanına yazan tek bir modül olsun; bugün aynı işi kendi
yöntemiyle yapan altı canlı yol onu çağırsın, ölü yedinci silinsin.

**Architecture:** `worker-redisq-stream.ts:672`'deki `saveKillmail`
`backend/src/services/killmail-writer.ts`'e taşınır — yeni soyutlama icat
edilmez, altı yoldan en eksiksizi ve aylardır üretimde olanı yukarı çekilir.
Yazıcı varlık kontrolü, değer hesabı, transaction (killmail → victim → attacker
→ günlük agregatlar → item), filtre satırı ve `NEW_KILLMAIL` yayınından sorumlu.
Zenginleştirme, ESI çağrısı ve çağıranın kendi defteri dışarıda kalır.

**Tech Stack:** TypeScript, Prisma (`prismaWorker`), Vitest 5, RabbitMQ
(dokunulmuyor), graphql-yoga pubsub.

**Spec:** `docs/superpowers/specs/2026-09-22-killmail-writer-design.md`

## Global Constraints

- **Yarn only, never npm.** Workspace çözümlemesi bozulur.
- **Kuyruk topolojisi değişmez.** Yeni kuyruk, yeni worker, `queue-names.ts`
  düzenlemesi yok.
- **Zenginleştirme yazıcıya girmez.** `enrichMissingEntities`
  `worker-redisq-stream.ts`'te kalır.
- **Agregat çağrısı transaction'ın içinde kalır.** CLAUDE.md > Leaderboards:
  killmail'i kaydeden transaction'ın içinde güncellenir, arkasında cron yok.
- **Filtre satırı transaction'dan sonra ve `await`li.**
  `insertKillmailFilter` hatayı kendi içinde yutar; `.catch` zinciri ölü koddur,
  taşınmaz.
- **Agregat ve filtre girdileri `services/killmail-derived.ts`'teki
  `toAggregateInput` / `toFilterInput` ile kurulur.** Satır içi eşleme kopyası
  yazılmaz.
- **Yayın seçeneği:** `publish` varsayılanı `true`; toplu yollar `false` geçer.
- Her görev sonunda `npx prettier --check` edilen dosyalar temiz olmalı; CI
  `prettier --check .` koşuyor.

## Review Focus

Spec'in ima ettiği, ama hiçbir görevin doğal akışında test edilmeyecek beş
durum. Her biri sahibi olan görevin adımlarına test olarak eklendi:

1. **`attackers` boş gelen killmail** — `attacker_count` 0 yazılır ve agregat
   kimseyi saymaz; yazıcı bunu sessizce kabul etmemeli (Görev 1, Adım 13).
2. **`item_type_id` null olan item** — ESI gerçek veride gönderiyor; bugünkü
   filtreleme davranışı taşınmazsa transaction patlar (Görev 1, Adım 11).
3. **Eşzamanlı ikinci yazıcı** — varlık kontrolünü geçip `P2002` alır; hata
   değil `false` olmalı (Görev 1, Adım 9).
4. **`killmail` satırı var ama `victim` satırı yok** — bugünkü kontrol
   `victim`'e bakıyor, yani bu killmail yeniden işlenmeye çalışılır ve
   `killmail.create` patlar (Görev 1, Adım 7).
5. **`insertKillmailFilter` sessizce başarısız** — servis yutar; yazıcı yine de
   `true` döner ve yayın yapar. Bu kabul edilen davranış, ama test edilerek
   kayda geçer (Görev 1, Adım 15).

---

## Task 1: Yazıcı modülü

**Files:**

- Create: `backend/src/services/killmail-writer.ts`
- Test: `backend/src/services/killmail-writer.spec.ts`

**Interfaces:**

- Consumes: `toAggregateInput`, `toFilterInput` (`@services/killmail-derived`);
  `updateDailyAggregatesRealtime` (`@services/kill-stats-realtime`);
  `insertKillmailFilter` (`@services/killmail-filters-realtime`);
  `calculateKillmailValues` (`@helpers/calculate-killmail-values`);
  `KillmailDetail` (`@services/killmail/killmail.service`).
- Produces:

```ts
export interface SaveKillmailOptions {
  /** NEW_KILLMAIL yayınlansın mı. Toplu backfill false geçer. */
  publish?: boolean;
}

export async function saveKillmail(
  detail: KillmailDetail,
  hash: string,
  options?: SaveKillmailOptions,
): Promise<boolean>;
```

`true` = yeni yazıldı, `false` = zaten vardı.

- [ ] **Step 1: Test dosyasının iskeletini yaz**

`backend/src/services/killmail-writer.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KillmailDetail } from '@services/killmail/killmail.service';

const {
  prismaMock,
  txMock,
  updateDailyAggregatesRealtime,
  insertKillmailFilter,
  calculateKillmailValues,
  publish,
  loggerMock,
} = vi.hoisted(() => {
  const txMock = {
    killmail: { create: vi.fn() },
    victim: { create: vi.fn() },
    attacker: { createMany: vi.fn() },
    killmailItem: { createMany: vi.fn() },
  };
  return {
    txMock,
    prismaMock: {
      killmail: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
        fn(txMock),
      ),
    },
    updateDailyAggregatesRealtime: vi.fn(),
    insertKillmailFilter: vi.fn(),
    calculateKillmailValues: vi.fn(async () => ({
      totalValue: 1000,
      destroyedValue: 600,
      droppedValue: 400,
    })),
    publish: vi.fn(),
    loggerMock: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/logger', () => ({ default: loggerMock }));
vi.mock('@services/pubsub', () => ({ pubsub: { publish } }));
vi.mock('@services/kill-stats-realtime', () => ({
  updateDailyAggregatesRealtime,
}));
vi.mock('@services/killmail-filters-realtime', () => ({
  insertKillmailFilter,
}));
vi.mock('@helpers/calculate-killmail-values', () => ({
  calculateKillmailValues,
}));

import { saveKillmail } from './killmail-writer';

const HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

function detail(overrides: Partial<KillmailDetail> = {}): KillmailDetail {
  return {
    killmail_id: 128431979,
    killmail_time: '2026-09-19T14:03:22Z',
    solar_system_id: 30002187,
    victim: {
      character_id: 95465499,
      corporation_id: 98000001,
      alliance_id: 99005338,
      ship_type_id: 670,
      damage_taken: 1200,
      items: [],
    },
    attackers: [
      {
        character_id: 90000001,
        corporation_id: 98000002,
        alliance_id: 99000002,
        ship_type_id: 17738,
        damage_done: 1200,
        final_blow: true,
        security_status: -1.2,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.killmail.findUnique.mockResolvedValue(null);
});
```

- [ ] **Step 2: İlk testi yaz — mevcut killmail hiç iş yaptırmaz**

Aynı dosyanın sonuna:

```ts
describe('already stored', () => {
  it('returns false and writes nothing', async () => {
    prismaMock.killmail.findUnique.mockResolvedValue({
      killmail_id: 128431979,
    });

    const saved = await saveKillmail(detail(), HASH);

    expect(saved).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(calculateKillmailValues).not.toHaveBeenCalled();
    expect(insertKillmailFilter).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Testin düştüğünü gör**

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: FAIL — `Failed to resolve import "./killmail-writer"`

- [ ] **Step 4: Modülü en küçük hâliyle yaz**

`backend/src/services/killmail-writer.ts`:

```ts
import { calculateKillmailValues } from '@helpers/calculate-killmail-values';
import { updateDailyAggregatesRealtime } from '@services/kill-stats-realtime';
import { toAggregateInput, toFilterInput } from '@services/killmail-derived';
import { insertKillmailFilter } from '@services/killmail-filters-realtime';
import type { KillmailDetail } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';

export interface SaveKillmailOptions {
  /**
   * NEW_KILLMAIL yayınlansın mı.
   *
   * Varsayılan true. Toplu backfill'ler false geçer: abonelere 20.000 tarihî
   * killmail'i "yeni" diye göndermek, frontend'in canlı listesini (
   * `frontend/src/app/killmails/page.tsx:158` gelen olayı listenin başına
   * ekliyor) kullanılamaz hâle getirir.
   */
  publish?: boolean;
}

/**
 * Bir killmail'i veritabanına yazmanın tek yeri.
 *
 * `true` = yeni yazıldı, `false` = zaten vardı. "Zaten vardı" bir hata değil
 * sonuçtur; çağıranların P2002 yakalamasının yerine geçer.
 */
export async function saveKillmail(
  detail: KillmailDetail,
  hash: string,
  options: SaveKillmailOptions = {},
): Promise<boolean> {
  const existing = await prismaWorker.killmail.findUnique({
    where: { killmail_id: detail.killmail_id },
    select: { killmail_id: true },
  });
  if (existing) return false;

  return true;
}
```

- [ ] **Step 5: Testin geçtiğini gör**

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/killmail-writer.ts backend/src/services/killmail-writer.spec.ts
git commit -m "feat(workers): add the killmail writer with its existence check"
```

- [ ] **Step 7: Varlık kontrolünün killmail tablosuna baktığını sabitle**

Bu **Review Focus 4**. Bugünkü kod `victim.findUnique`'e bakıyor; `killmail`
satırı olup `victim` satırı olmayan bir kayıt ("zaten var" demesi gerekirken)
yeniden işlenmeye kalkışılıyor ve `killmail.create` patlıyor.

```ts
describe('the existence check', () => {
  it('asks about the killmail row, which is the unique key that would throw', async () => {
    await saveKillmail(detail(), HASH);

    expect(prismaMock.killmail.findUnique).toHaveBeenCalledWith({
      where: { killmail_id: 128431979 },
      select: { killmail_id: true },
    });
  });
});
```

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: PASS (halihazırda doğru; davranışı kilitler)

- [ ] **Step 8: Yazma yolunun testini yaz**

```ts
describe('writing a new killmail', () => {
  it('writes the killmail, victim and attackers in one transaction', async () => {
    const saved = await saveKillmail(detail(), HASH);

    expect(saved).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.killmail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        killmail_id: 128431979,
        killmail_hash: HASH,
        killmail_time: new Date('2026-09-19T14:03:22Z'),
        solar_system_id: 30002187,
        total_value: 1000,
        destroyed_value: 600,
        dropped_value: 400,
        attacker_count: 1,
      }),
    });
    expect(txMock.victim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        killmail_id: 128431979,
        character_id: 95465499,
        corporation_id: 98000001,
        alliance_id: 99005338,
        ship_type_id: 670,
        damage_taken: 1200,
      }),
    });
    expect(txMock.attacker.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('updates the daily aggregates inside that transaction', async () => {
    await saveKillmail(detail(), HASH);

    expect(updateDailyAggregatesRealtime).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        killmail_time: new Date('2026-09-19T14:03:22Z'),
        character_ids: [90000001],
      }),
    );
  });

  it('writes the filter row after the transaction, awaited', async () => {
    await saveKillmail(detail(), HASH);

    expect(insertKillmailFilter).toHaveBeenCalledWith(
      expect.objectContaining({ killmail_id: 128431979n, attacker_count: 1 }),
    );
  });
});
```

- [ ] **Step 9: Yarış durumu testini yaz (Review Focus 3)**

```ts
describe('a second writer that got there first', () => {
  it('turns P2002 into false rather than throwing', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(saveKillmail(detail(), HASH)).resolves.toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  it('rethrows anything else so the shared failure path can route it', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error('pool timeout'));

    await expect(saveKillmail(detail(), HASH)).rejects.toThrow('pool timeout');
  });
});
```

- [ ] **Step 10: Testlerin düştüğünü gör**

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: FAIL — `expected true to be undefined` ve benzerleri; yazma yolu yok.

- [ ] **Step 11: Yazma yolunu uygula (Review Focus 2 dahil)**

`saveKillmail` gövdesinde `return true;` satırını şununla değiştir:

```ts
const { victim, attackers, killmail_time, solar_system_id } = detail;

try {
  const values = await calculateKillmailValues({
    victim: { ship_type_id: victim.ship_type_id },
    items:
      victim.items?.map((item) => ({
        item_type_id: item.item_type_id,
        quantity_destroyed: item.quantity_destroyed,
        quantity_dropped: item.quantity_dropped,
        singleton: item.singleton,
      })) || [],
  });

  await prismaWorker.$transaction(async (tx) => {
    await tx.killmail.create({
      data: {
        killmail_id: detail.killmail_id,
        killmail_hash: hash,
        killmail_time: new Date(killmail_time),
        solar_system_id,
        total_value: values.totalValue,
        destroyed_value: values.destroyedValue,
        dropped_value: values.droppedValue,
        attacker_count: attackers.length,
      },
    });

    await tx.victim.create({
      data: {
        killmail_id: detail.killmail_id,
        character_id: victim.character_id || null,
        corporation_id: victim.corporation_id,
        alliance_id: victim.alliance_id || null,
        ship_type_id: victim.ship_type_id,
        damage_taken: victim.damage_taken,
        position_x: victim.position?.x || null,
        position_y: victim.position?.y || null,
        position_z: victim.position?.z || null,
        faction_id: victim.faction_id ?? null,
      },
    });

    if (attackers.length > 0) {
      await tx.attacker.createMany({
        skipDuplicates: true,
        data: attackers.map((attacker) => ({
          killmail_id: detail.killmail_id,
          character_id: attacker.character_id || null,
          corporation_id: attacker.corporation_id || null,
          alliance_id: attacker.alliance_id || null,
          ship_type_id: attacker.ship_type_id || null,
          weapon_type_id: attacker.weapon_type_id || null,
          damage_done: attacker.damage_done,
          final_blow: attacker.final_blow,
          security_status: attacker.security_status ?? null,
          faction_id: attacker.faction_id ?? null,
        })),
      });
    }

    await updateDailyAggregatesRealtime(tx, toAggregateInput(detail));

    // ESI gerçek veride item_type_id'si null olan item gönderiyor; bunlar
    // yazılmaya kalkılırsa transaction patlar.
    const validItems = (victim.items ?? []).filter(
      (item) => item.item_type_id != null,
    );
    const skipped = (victim.items?.length ?? 0) - validItems.length;
    if (skipped > 0) {
      logger.warn(
        `   ⚠️  Skipping ${skipped} invalid items (null item_type_id) for killmail ${detail.killmail_id}`,
      );
    }
    if (validItems.length > 0) {
      await tx.killmailItem.createMany({
        skipDuplicates: true,
        data: validItems.map((item) => ({
          killmail_id: detail.killmail_id,
          item_type_id: item.item_type_id,
          flag: item.flag,
          quantity_dropped: item.quantity_dropped || null,
          quantity_destroyed: item.quantity_destroyed || null,
          singleton: item.singleton,
        })),
      });
    }
  });

  await insertKillmailFilter(toFilterInput(detail));

  if (options.publish ?? true) {
    await pubsub.publish('NEW_KILLMAIL', { killmailId: detail.killmail_id });
  }

  return true;
} catch (error: unknown) {
  if ((error as { code?: string })?.code === 'P2002') return false;
  logger.error(`❌ Failed to write killmail ${detail.killmail_id}`, error);
  throw error;
}
```

- [ ] **Step 12: Testlerin geçtiğini gör**

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: PASS

- [ ] **Step 13: Geçersiz item ve boş attacker testlerini yaz (Review Focus 1, 2)**

```ts
describe('data ESI really sends', () => {
  it('skips items with a null item_type_id instead of failing the write', async () => {
    const saved = await saveKillmail(
      detail({
        victim: {
          character_id: 95465499,
          corporation_id: 98000001,
          ship_type_id: 670,
          damage_taken: 1200,
          items: [
            { item_type_id: 34, flag: 5, singleton: 0, quantity_dropped: 3 },
            {
              item_type_id: null as unknown as number,
              flag: 5,
              singleton: 0,
            },
          ],
        },
      }),
      HASH,
    );

    expect(saved).toBe(true);
    expect(txMock.killmailItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ item_type_id: 34 })],
      }),
    );
  });

  it('refuses a killmail with no attackers', async () => {
    // attacker_count 0 yazmak ve kimseyi saymamak, sessizce yanlış bir
    // killmail üretir; kaynağın onu yeniden çekmesi gerekir.
    await expect(saveKillmail(detail({ attackers: [] }), HASH)).rejects.toThrow(
      /no attackers/i,
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 14: Boş attacker kontrolünü uygula**

`saveKillmail`'in başına, varlık kontrolünden **önce**:

```ts
if (detail.attackers.length === 0) {
  throw new Error(
    `killmail ${detail.killmail_id} has no attackers; refusing to write it`,
  );
}
```

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: PASS

- [ ] **Step 15: Yayın seçeneği ve filtre hatası testlerini yaz (Review Focus 5)**

```ts
describe('the publish option', () => {
  it('publishes by default', async () => {
    await saveKillmail(detail(), HASH);

    expect(publish).toHaveBeenCalledWith('NEW_KILLMAIL', {
      killmailId: 128431979,
    });
  });

  it('stays quiet when the caller is backfilling', async () => {
    await saveKillmail(detail(), HASH, { publish: false });

    expect(publish).not.toHaveBeenCalled();
    // Yazma yolu aynen işler; sessiz olan yalnızca duyuru.
    expect(txMock.killmail.create).toHaveBeenCalled();
    expect(insertKillmailFilter).toHaveBeenCalled();
  });
});

describe('a filter row that could not be written', () => {
  it('still reports the killmail as saved', async () => {
    // insertKillmailFilter kendi hatasını loglayıp yutuyor; yazıcı bunu
    // göremez. Kabul edilen davranış: killmail yazıldı, filtre satırı
    // eksik kaldı ve repair:killmail-derived onu bulur.
    insertKillmailFilter.mockResolvedValueOnce(undefined);

    await expect(saveKillmail(detail(), HASH)).resolves.toBe(true);
  });
});
```

Run: `cd backend && npx vitest run src/services/killmail-writer.spec.ts`
Expected: PASS

- [ ] **Step 16: Tam backend testi ve tip kontrolü**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: hepsi PASS, tsc çıktısı boş

- [ ] **Step 17: Commit**

```bash
npx prettier --write backend/src/services/killmail-writer.ts backend/src/services/killmail-writer.spec.ts
git add backend/src/services/killmail-writer.ts backend/src/services/killmail-writer.spec.ts
git commit -m "feat(workers): write a killmail in one place

Lifted from worker-redisq-stream's saveKillmail, which is the most complete of
the six live paths. The writer owns the existence check, the value calculation,
the transaction, the daily aggregates, the filter row and the subscription
publish; enrichment, ESI fetching and the caller's own bookkeeping stay out.

The publish option defaults to true and exists for backfills: the frontend
prepends NEW_KILLMAIL events to its live list, so a 20,000-killmail sync would
push that much history to the top of every open page."
```

---

## Task 2: RedisQ kendi kopyasını bıraksın

**Files:**

- Modify: `backend/src/workers/worker-redisq-stream.ts` (`saveKillmail`
  fonksiyonu ve artık kullanılmayan importlar)

**Interfaces:**

- Consumes: `saveKillmail` (Görev 1).
- Produces: yok.

Kaynağın kendisi ilk geçen olmalı: taşınan kod onunki, davranış farkı çıkarsa
en erken burada görülür.

- [ ] **Step 1: Yerel `saveKillmail`'i sil**

`worker-redisq-stream.ts:672-851` arasındaki `async function saveKillmail(...)`
tamamen silinir.

- [ ] **Step 2: Modülden import et**

Dosyanın import bloğuna:

```ts
import { saveKillmail } from '@services/killmail-writer';
```

`processKillmail` içindeki çağrı (`const isNew = await saveKillmail(killmail, zkb.hash);`)
olduğu gibi kalır — imza aynı, RedisQ canlı akış olduğu için `publish`
varsayılanı doğru.

- [ ] **Step 3: Artık kullanılmayan importları temizle**

`calculateKillmailValues`, `updateDailyAggregatesRealtime`,
`insertKillmailFilter` ve (yalnızca `saveKillmail` kullanıyorsa) `pubsub`
artık bu dosyada kullanılmıyor. `enrichMissingEntities` kullandıklarına
dokunma.

Run: `cd backend && npx tsc --noEmit`
Expected: boş çıktı. Kullanılmayan import kalırsa lint değil tsc sessiz kalır;
bu yüzden bir sonraki adım var.

- [ ] **Step 4: Ölü import kalmadığını doğrula**

Run: `cd backend && grep -n "calculateKillmailValues\|updateDailyAggregatesRealtime\|insertKillmailFilter" src/workers/worker-redisq-stream.ts`
Expected: çıktı yok

- [ ] **Step 5: Testler ve tip kontrolü**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: hepsi PASS

- [ ] **Step 6: Commit**

```bash
npx prettier --write backend/src/workers/worker-redisq-stream.ts
git add backend/src/workers/worker-redisq-stream.ts
git commit -m "refactor(workers): point the RedisQ stream at the shared writer"
```

---

## Task 3: İki ESI sync worker'ı

**Files:**

- Modify: `backend/src/workers/worker-esi-user-killmails.ts:269-354` — değer
  hesabından `pubsub.publish` bloğunun sonuna kadar
- Modify: `backend/src/workers/worker-esi-corporation-killmails.ts:305-387` —
  aynı aralık, aynı sırayla

**Interfaces:**

- Consumes: `saveKillmail` (Görev 1).
- Produces: yok.

İkisi kardeş worker ve kayıt blokları birbirinin kopyası; bir arada geçmeleri
diff'i okunur kılıyor.

- [ ] **Step 1: User worker'ın kayıt bloğunu değiştir**

`worker-esi-user-killmails.ts` içinde, `const detail = await KillmailService.getKillmailDetail(...)`
sonrasındaki `calculateKillmailValues` çağrısından `pubsub.publish` bloğunun
sonuna kadar olan her şey şununla değişir:

```ts
const isNew = await saveKillmail(detail, km.killmail_hash);
if (isNew) {
  savedCount++;
} else {
  skippedCount++;
}
```

`P2002` yakalayan `catch` bloğu da gider: "zaten vardı" artık `false`.

- [ ] **Step 2: Import'ları düzelt**

Ekle:

```ts
import { saveKillmail } from '@services/killmail-writer';
```

Sil: `calculateKillmailValues`, `updateDailyAggregatesRealtime`,
`toAggregateInput`, `toFilterInput`, `insertKillmailFilter`, `pubsub`.

- [ ] **Step 3: Aynısını corporation worker'a uygula**

`worker-esi-corporation-killmails.ts` içinde aynı değişiklik. Bu dosyada
`settleForbidden` ve `handleWorkerError` yolları **aynen kalır** — 403
politikası yazıcının işi değil.

- [ ] **Step 4: Tip kontrolü ve testler**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: hepsi PASS. `worker-esi-corporation-killmails.spec.ts` (403
politikası) değişmeden geçmeli.

- [ ] **Step 5: Ölü import kalmadığını doğrula**

Run: `cd backend && grep -n "calculateKillmailValues\|insertKillmailFilter" src/workers/worker-esi-user-killmails.ts src/workers/worker-esi-corporation-killmails.ts`
Expected: çıktı yok

- [ ] **Step 6: Commit**

```bash
npx prettier --write backend/src/workers/worker-esi-user-killmails.ts backend/src/workers/worker-esi-corporation-killmails.ts
git add backend/src/workers/worker-esi-user-killmails.ts backend/src/workers/worker-esi-corporation-killmails.ts
git commit -m "refactor(workers): point both ESI killmail syncs at the shared writer"
```

---

## Task 4: zKillboard toplu sync'i

**Files:**

- Modify: `backend/src/workers/worker-zkillboard-sync.ts:205-305` — değer
  hesabından `insertKillmailFilter` çağrısının sonuna kadar

**Interfaces:**

- Consumes: `saveKillmail` (Görev 1).
- Produces: yok.

Bu görev ayrı, çünkü tek `publish: false` geçen yol burası ve reddedilirse
diğer geçişler ayakta kalmalı.

- [ ] **Step 1: Kayıt bloğunu değiştir**

```ts
// Toplu geçmiş taraması: abonelere tarihî killmail "yeni" diye
// gönderilmez. Bugün bu worker hiç yayın yapmıyordu; sessizliği
// koruyoruz, ama artık bilerek.
const isNew = await saveKillmail(detail, km.killmail_hash, {
  publish: false,
});
```

- [ ] **Step 2: Import'ları düzelt**

Ekle `saveKillmail`; sil `calculateKillmailValues`,
`updateDailyAggregatesRealtime`, `insertKillmailFilter`.

- [ ] **Step 3: Tip kontrolü ve testler**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: hepsi PASS

- [ ] **Step 4: Commit**

```bash
npx prettier --write backend/src/workers/worker-zkillboard-sync.ts
git add backend/src/workers/worker-zkillboard-sync.ts
git commit -m "refactor(workers): point the zKillboard sync at the shared writer

It passes publish: false. The worker never published before, which was
probably an omission, but the result was right: the frontend prepends
NEW_KILLMAIL events to its live list and a 20,000-killmail backfill would
bury it in history."
```

---

## Task 5: Elle koşulan iki script

**Files:**

- Modify: `backend/src/workers/fetch-single-killmail.ts:61-130`
- Modify: `backend/src/workers/sync-character-killmails.ts:86-142` — değer
  hesabından `pubsub.publish` çağrısının sonuna kadar

**Interfaces:**

- Consumes: `saveKillmail` (Görev 1).
- Produces: yok.

**Düzeltme (2026-09-23):** `sync-character-killmails` attacker satırlarını
Prisma'nın iç içe `attackers: { create: ... }` yazımıyla yazıyor; "yazmıyor"
iddiası yalnızca `attacker.createMany` biçimini tanıyan bir aramadan geldi.
Yazıcıya geçmesiyle kazandıkları agregat ve filtre satırı.

- [ ] **Step 1: `fetch-single-killmail`'i geçir**

`prismaWorker.$transaction(...)` bloğu ve onu izleyen `insertKillmailFilter`
çağrısı şununla değişir:

```ts
const isNew = await saveKillmail(detail, killmailHash);
if (!isNew) {
  console.log(`⚠️  Killmail ${killmailId} already exists in database`);
  return;
}
```

Baştaki `existing` kontrolü de silinir — yazıcı onu zaten yapıyor.

- [ ] **Step 2: `sync-character-killmails`'i geçir**

`prismaWorker.killmail.create(...)` ve çevresindeki kısmi yazım şununla değişir:

```ts
const isNew = await saveKillmail(detail, km.killmail_hash);
```

Sonrasındaki `pubsub.publish` çağrısı silinir; yazıcı yapıyor.

- [ ] **Step 3: Tip kontrolü ve testler**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: hepsi PASS

- [ ] **Step 4: Commit**

```bash
npx prettier --write backend/src/workers/fetch-single-killmail.ts backend/src/workers/sync-character-killmails.ts
git add backend/src/workers/fetch-single-killmail.ts backend/src/workers/sync-character-killmails.ts
git commit -m "refactor(workers): point the two hand-run scripts at the shared writer

sync-character-killmails gains the leaderboard aggregates and the filter row,
which it never wrote. It keeps its pre-ESI duplicate check — the writer answers
the same question, but only after the detail fetch has been paid for."
```

---

## Task 6: Ölü worker'ı sil, dokümanları düzelt

**Files:**

- Delete: `backend/src/workers/worker-killmails.ts`
- Modify: `backend/docs/leaderboards/kill-stats-realtime.md`
- Modify: `backend/docs/leaderboards/real-time-daily-aggregates.md`
- Modify: `backend/docs/leaderboards/leaderboards.md`

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: Hiçbir yerden çağrılmadığını doğrula**

Run: `cd /root/killreport && grep -rn "worker-killmails" --include='*.ts' --include='*.json' --include='*.js' backend/src backend/package.json ecosystem.config.js | grep -v "user-killmails\|corporation-killmails"`
Expected: çıktı yok

- [ ] **Step 2: Dosyayı sil**

```bash
git rm backend/src/workers/worker-killmails.ts
```

- [ ] **Step 3: Üç dokümandaki satırları düzelt**

Her üçünde `worker-killmails.ts` satırı **silinir** ve yerine yazıcı listesi
gelir. `kill-stats-realtime.md`'deki "Integrated in" listesi şu hâle gelir:

```markdown
Her killmail yazan yol tek bir yerden geçer:
[`services/killmail-writer.ts`](../../src/services/killmail-writer.ts).
Kaynaklar killmail'i bulur, yazan odur.
```

`leaderboards.md`'deki tabloda `worker-killmails.ts` satırı silinir.

- [ ] **Step 4: Link kontrolü**

Run: `cd /root/killreport && yarn docs:check-links`
Expected: yalnızca önceden var olan
`.github/prompts/add-killmail-filter.prompt.md:11` kırığı

- [ ] **Step 5: Commit**

```bash
npx prettier --write backend/docs/leaderboards/
git add -A
git commit -m "chore(workers): delete the killmail worker nothing ever started

worker-killmails.ts consumed zkillboard_character_queue but had no
package.json script, no PM2 entry and no importer; the real consumer of that
queue is worker-zkillboard-sync. Three docs linked to it."
```

---

## Task 7: Tam doğrulama ve PR

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: Tam test seti**

Run: `cd /root/killreport && yarn test`
Expected: backend ve frontend, hepsi PASS

- [ ] **Step 2: Tip kontrolü ve biçim**

Run: `cd /root/killreport && yarn workspace backend build && npx prettier --check .`
Expected: ikisi de temiz

- [ ] **Step 3: Lint sayısını main ile karşılaştır**

Run: `cd /root/killreport && yarn workspace frontend lint 2>&1 | tail -3`
Expected: main'deki sayının aynısı (2026-09-22'de 137) — bu dal frontend'e
dokunmuyor

- [ ] **Step 4: Veri doğrulaması**

`yarn dev:backend` ve `yarn worker:redisq` ile canlı akışı birkaç killmail
boyunca izle, sonra:

```sql
SELECT (SELECT COUNT(*) FROM killmails) killmails,
       (SELECT COUNT(*) FROM killmail_filters) filter_rows,
       (SELECT COUNT(*) FROM killmails k
          LEFT JOIN killmail_filters f ON f.killmail_id = k.killmail_id
        WHERE f.killmail_id IS NULL) missing;
```

Expected: `missing` 0 kalır — yeni killmail'ler filtre satırıyla birlikte
yazılıyor.

- [ ] **Step 5: PR aç**

Başlık: `refactor(workers): write a killmail in one place`

Gövde: spec'e ve #244'e atıf; taşınan fonksiyonun nereden geldiği; `publish`
kararının gerekçesi; `sync-character-killmails`'in attacker kazanımı; ölü
worker'ın silinmesi; ölçümler.
