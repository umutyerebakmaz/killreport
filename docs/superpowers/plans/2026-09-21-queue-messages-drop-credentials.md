# Kuyruk mesajı kimlik bilgisi taşımasın — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `esi_user_killmails_queue` ve `esi_corporation_killmails_queue` mesajları EVE SSO token'ı taşımayı bıraksın; token'ı worker, kullanacağı anda veritabanından okusun.

**Architecture:** Mesaj `{ userId, fullSync?, queuedAt }` şekline iner ve iki kuyruk için tek bir yerde tanımlanır. Token okuma ve yenileme, bugün iki worker'da birebir kopyalanmış olan blok yerine tek bir servise (`services/user-credentials.ts`) taşınır; servis atmak yerine ayrıştırılmış bir sonuç döndürür, çünkü çağıranların üçü de aynı şeyi yapacak: logla, ack'le, geç.

**Tech Stack:** TypeScript, Prisma (`prisma-worker` istemcisi), amqplib, Vitest 5.

**Spec:** [`docs/superpowers/specs/2026-09-21-queue-messages-drop-credentials-design.md`](../specs/2026-09-21-queue-messages-drop-credentials-design.md)

## Global Constraints

- **Ön koşul:** #237 (`b0f5048d`) `main`'e birleşmiş olmalı. Bu plan `services/user-killmail-cron.ts`'in #237 sonrası hâline dokunuyor ve satır atıfları ona göre. Dal `main`'den açılır.
- **Yarn, asla npm.** `yarn workspace backend test`, `yarn workspace backend build`.
- **Generated dosyalara dokunulmaz:** `src/generated-types.ts`, `src/generated-schema.graphql`. Bu planda hiçbir `.graphql` değişmiyor, yani codegen çalıştırılmıyor.
- **İki Prisma istemcisi:** worker ve queue script'leri `@services/prisma-worker`, resolver ve API `@services/prisma`. `user-credentials.ts` yalnızca worker'lardan çağrılıyor, yani `prisma-worker` kullanır.
- **Servis içi import'lar alias ile:** `@services/logger`, `@services/prisma-worker` (emsal: `services/kill-stats-realtime.ts:21-22`).
- **Kuyruk davranışı değişmiyor:** kuyruk adları, `ALL_QUEUES`, retry topolojisi, `prefetch` değerleri, rate limit, `--force` / `--full` bayraklarının dışarıdan görünen anlamı aynı kalır.
- **Her `assertQueue` `arguments: { 'x-max-priority': 10 }` taşır.** Bu planda yeni kuyruk beyanı yok; mevcut `ensureAllQueuesExist()` çağrıları olduğu gibi kalır.
- **Commit mesajları İngilizce, Claude attribution yok.**
- Her task sonunda `npx prettier --check <değişen dosyalar>` temiz olmalı.

---

### Task 1: Kimlik bilgisi servisi

Token okuma ve yenileme tek bir yere çıkar. Bugün bu mantık `worker-esi-user-killmails.ts:118-158` ve `worker-esi-corporation-killmails.ts:106-147`'de birebir aynı duruyor.

**Files:**

- Create: `backend/src/services/user-credentials.ts`
- Test: `backend/src/services/user-credentials.spec.ts`

**Interfaces:**

- Consumes: `refreshAccessToken(refreshToken: string): Promise<{ access_token: string; token_type: string; expires_in: number; refresh_token?: string }>` — `services/eve-sso.ts:85-90`.
- Produces:
  - `needsRefresh(expiresAt: Date, now: Date): boolean`
  - `loadUserCredentials(userId: number): Promise<UserCredentials>`
  - `interface UserSyncRow` ve `type UserCredentials` (aşağıdaki gövdede tam hâlleriyle)

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`backend/src/services/user-credentials.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The worker-side credential reader. Tokens live in `users`, never in a queue
 * message, so every sync path asks this module for a valid access token right
 * before it calls ESI.
 */

const { prismaMock, refreshAccessToken, loggerMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
  refreshAccessToken: vi.fn(),
  loggerMock: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/eve-sso', () => ({ refreshAccessToken }));
vi.mock('@services/logger', () => ({ default: loggerMock }));

import { loadUserCredentials, needsRefresh } from './user-credentials';

const ROW = {
  id: 7,
  character_id: 95465499,
  character_name: 'Test Pilot',
  corporation_id: 98000001,
  last_killmail_id: 1234,
  last_corp_killmail_id: null,
};

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    ...ROW,
    access_token: 'current-access',
    refresh_token: 'current-refresh',
    expires_at: new Date('2026-09-21T13:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('needsRefresh', () => {
  const now = new Date('2026-09-21T12:00:00Z');

  it('is false when the token outlives the five minute buffer', () => {
    expect(needsRefresh(new Date('2026-09-21T12:05:01Z'), now)).toBe(false);
  });

  it('is true exactly at the buffer, because the ESI call comes after it', () => {
    expect(needsRefresh(new Date('2026-09-21T12:05:00Z'), now)).toBe(true);
  });

  it('is true for a token that already expired', () => {
    expect(needsRefresh(new Date('2026-09-21T11:00:00Z'), now)).toBe(true);
  });
});

describe('loadUserCredentials', () => {
  it('reports not-found for a user that no longer exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect(await loadUserCredentials(7)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('reports no-refresh-token when the user never granted one', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userRow({ refresh_token: null }),
    );

    expect(await loadUserCredentials(7)).toEqual({
      ok: false,
      reason: 'no-refresh-token',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('returns the stored token without refreshing when it is still valid', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());

    const result = await loadUserCredentials(7);

    expect(result).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'current-access',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('refreshes an expiring token and writes the new pair back', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:58:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    refreshAccessToken.mockResolvedValue({
      access_token: 'fresh-access',
      token_type: 'Bearer',
      expires_in: 1200,
      refresh_token: 'fresh-refresh',
    });

    const result = await loadUserCredentials(7);

    expect(result).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'fresh-access',
    });
    expect(refreshAccessToken).toHaveBeenCalledWith('current-refresh');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        access_token: 'fresh-access',
        refresh_token: 'fresh-refresh',
        expires_at: new Date('2026-09-21T13:18:00Z'),
      },
    });
  });

  it('keeps the old refresh token when EVE does not rotate it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:58:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    refreshAccessToken.mockResolvedValue({
      access_token: 'fresh-access',
      token_type: 'Bearer',
      expires_in: 1200,
    });

    await loadUserCredentials(7);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refresh_token: 'current-refresh' }),
      }),
    );
  });

  it('reports refresh-failed instead of throwing, so the caller can ack and move on', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:58:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));

    expect(await loadUserCredentials(7)).toEqual({
      ok: false,
      reason: 'refresh-failed',
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace backend test src/services/user-credentials.spec.ts
```

Beklenen: `Failed to resolve import "./user-credentials"`.

- [ ] **Step 3: Servisi yaz**

`backend/src/services/user-credentials.ts`:

```ts
import { refreshAccessToken } from '@services/eve-sso';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

/**
 * Tokens live in `users` and nowhere else.
 *
 * They used to ride inside the queue message, which put a refresh token on the
 * broker's disk once per publish and kept a copy in `killreport.parking`
 * forever. It was also wrong in a quieter way: EVE rotates the refresh token,
 * the worker writes the new one here, and every message still holding the old
 * snapshot then failed to refresh and acked its user out of sync entirely.
 *
 * So a sync message names a user and this module answers with a token that is
 * valid right now.
 */

/** The five minute buffer the publishers have always used. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Everything a sync worker needs about a user, minus the credentials. */
export interface UserSyncRow {
  id: number;
  character_id: number;
  character_name: string;
  corporation_id: number | null;
  last_killmail_id: number | null;
  last_corp_killmail_id: number | null;
}

export type UserCredentials =
  | { ok: true; user: UserSyncRow; accessToken: string }
  | { ok: false; reason: 'not-found' | 'no-refresh-token' | 'refresh-failed' };

/**
 * True when the token is gone or close enough to gone that the ESI calls
 * following this check would run out mid-sync.
 */
export function needsRefresh(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime() + REFRESH_BUFFER_MS;
}

/**
 * A valid access token for `userId`, refreshing and persisting first if needed.
 *
 * Returns a reason rather than throwing: none of the three failures is worth a
 * retry, because no number of attempts fixes a user who has to log in again.
 * Routing them through `handleWorkerError` would requeue work that can never
 * succeed, which is the contract #234 set up.
 */
export async function loadUserCredentials(
  userId: number,
): Promise<UserCredentials> {
  const row = await prismaWorker.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      character_id: true,
      character_name: true,
      corporation_id: true,
      last_killmail_id: true,
      last_corp_killmail_id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!row) return { ok: false, reason: 'not-found' };
  if (!row.refresh_token) return { ok: false, reason: 'no-refresh-token' };

  const { access_token, refresh_token, expires_at, ...user } = row;

  if (!needsRefresh(expires_at, new Date())) {
    return { ok: true, user, accessToken: access_token };
  }

  try {
    const fresh = await refreshAccessToken(refresh_token);

    await prismaWorker.user.update({
      where: { id: userId },
      data: {
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token ?? refresh_token,
        expires_at: new Date(Date.now() + fresh.expires_in * 1000),
      },
    });

    return { ok: true, user, accessToken: fresh.access_token };
  } catch (error) {
    logger.error(`Token refresh failed for user ${userId}`, { error });
    return { ok: false, reason: 'refresh-failed' };
  }
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

```bash
yarn workspace backend test src/services/user-credentials.spec.ts
```

Beklenen: 9 test PASS.

- [ ] **Step 5: Biçim ve tip kontrolü**

```bash
cd backend && npx prettier --check src/services/user-credentials.ts src/services/user-credentials.spec.ts && yarn workspace backend build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/user-credentials.ts backend/src/services/user-credentials.spec.ts
git commit -m "feat(services): read sync credentials from the database, not the message"
```

---

### Task 2: Mesaj kontratı

İki kuyruğun mesajı tek bir yerde tanımlanır. Bugün aynı `interface` dört dosyada elle tekrarlanıyor (`services/user-killmail-cron.ts:7-16`, `queues/queue-user-esi-killmails.ts:7-16`, `queues/queue-corporation-esi-killmails.ts:7-18`, iki worker).

**Files:**

- Create: `backend/src/services/killmail-sync-message.ts`
- Test: `backend/src/services/killmail-sync-message.spec.ts`

**Interfaces:**

- Consumes: yok.
- Produces:
  - `interface KillmailSyncMessage { userId: number; fullSync?: boolean; queuedAt: string }`
  - `buildSyncMessage(userId: number, fullSync?: boolean): KillmailSyncMessage`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`backend/src/services/killmail-sync-message.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildSyncMessage } from './killmail-sync-message';

describe('buildSyncMessage', () => {
  it('names a user and nothing else', () => {
    const message = buildSyncMessage(7);

    expect(Object.keys(message).sort()).toEqual(['queuedAt', 'userId']);
    expect(message.userId).toBe(7);
    expect(Date.parse(message.queuedAt)).not.toBeNaN();
  });

  it('carries fullSync only when a full resync was asked for', () => {
    expect(buildSyncMessage(7, true).fullSync).toBe(true);
    expect('fullSync' in buildSyncMessage(7, false)).toBe(false);
  });

  // The regression this whole change exists to prevent: a credential must
  // never reach the broker again, where it would be written to disk once per
  // publish and kept in killreport.parking indefinitely.
  it('serialises without anything token-shaped', () => {
    const wire = JSON.stringify(buildSyncMessage(7, true)).toLowerCase();

    expect(wire).not.toContain('token');
    expect(wire).not.toContain('expires');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace backend test src/services/killmail-sync-message.spec.ts
```

Beklenen: `Failed to resolve import "./killmail-sync-message"`.

- [ ] **Step 3: Kontratı yaz**

`backend/src/services/killmail-sync-message.ts`:

```ts
/**
 * The message both killmail sync queues carry: `esi_user_killmails_queue` and
 * `esi_corporation_killmails_queue`.
 *
 * It names a user and says nothing else. The worker reads the character, the
 * corporation, the last synced killmail and a valid access token from the
 * database through `loadUserCredentials`, because all of it is already there
 * and the message's copy could only ever be a staler version of it.
 */
export interface KillmailSyncMessage {
  userId: number;
  /** `--full`: ignore last_killmail_id and fetch from scratch. */
  fullSync?: boolean;
  queuedAt: string;
}

export function buildSyncMessage(
  userId: number,
  fullSync = false,
): KillmailSyncMessage {
  return {
    userId,
    ...(fullSync ? { fullSync: true } : {}),
    queuedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

```bash
yarn workspace backend test src/services/killmail-sync-message.spec.ts
```

Beklenen: 3 test PASS.

- [ ] **Step 5: Biçim ve tip kontrolü**

```bash
cd backend && npx prettier --check src/services/killmail-sync-message.ts src/services/killmail-sync-message.spec.ts && yarn workspace backend build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/killmail-sync-message.ts backend/src/services/killmail-sync-message.spec.ts
git commit -m "feat(services): one message contract for both killmail sync queues"
```

---

### Task 3: Character killmail worker

Worker'lar publisher'lardan **önce** geliyor, çünkü yeni worker eski mesajı da işleyebiliyor (eski mesajda `userId` zaten var, fazla alanları görmezden gelir); tersi doğru değil.

**Files:**

- Modify: `backend/src/workers/worker-esi-user-killmails.ts` — `interface UserKillmailMessage` (`22-30`), token doğrulama ve yenileme bloğu (`102-163`), `syncUserKillmailsFromESI` imzası (`217-220`) ve gövdesindeki `message.*` kullanımları (`224-241`, `434-455`)

**Interfaces:**

- Consumes: `loadUserCredentials`, `UserSyncRow` (Task 1); `KillmailSyncMessage` (Task 2).
- Produces: `interface UserSyncContext { userId: number; characterId: number; characterName: string; accessToken: string }` — dosya içi, dışa açılmıyor.

- [ ] **Step 1: Import'ları ve mesaj tipini değiştir**

`interface UserKillmailMessage { ... }` bloğunu (satır `22-30`) tamamen sil. Dosyanın import bloğuna ekle:

```ts
import { type KillmailSyncMessage } from '@services/killmail-sync-message';
import { loadUserCredentials } from '@services/user-credentials';
```

Consumer içindeki `let message: UserKillmailMessage | undefined;` satırını `let message: KillmailSyncMessage | undefined;` yap, `JSON.parse(...) as UserKillmailMessage` ifadesini `as KillmailSyncMessage` yap.

- [ ] **Step 2: Token bloğunu servise devret**

`// Validate token exists` yorumundan (satır `102`) başlayıp `Token is valid` else bloğunun kapanışına (satır `163`) kadar olan her şeyi sil. Yerine:

```ts
const credentials = await loadUserCredentials(message.userId);

if (!credentials.ok) {
  // None of these is retryable: the user has to log in again
  // before any attempt can succeed. Ack and move on.
  logger.error(`  ❌ ${credentials.reason} for user ${message.userId}`);
  logger.error(`  ⏭️  Skipping user - requires re-login via SSO`);
  channel.ack(msg);
  return;
}

const { user, accessToken } = credentials;

logger.info(`👤 Processing: ${user.character_name} (ID: ${user.character_id})`);

const lastKillmailId = message.fullSync
  ? undefined
  : (user.last_killmail_id ?? undefined);

await syncUserKillmailsFromESI(
  {
    userId: user.id,
    characterId: user.character_id,
    characterName: user.character_name,
    accessToken,
  },
  lastKillmailId,
);
```

Satır `95-97`'deki `👤 Processing: ${message.characterName}` logu silinir — karakter adı artık kullanıcı satırından geliyor ve yukarıda basılıyor. `🆔 User ID` ve `📅 Queued at` logları (`98-99`) olduğu gibi kalır. Eski `await syncUserKillmailsFromESI(message, message.lastKillmailId);` satırı (`168`) silinir.

- [ ] **Step 3: `syncUserKillmailsFromESI` imzasını daralt**

Dosyanın üst tarafına, silinen `interface` yerine:

```ts
/** What one character sync needs, resolved from the database up front. */
interface UserSyncContext {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
}
```

İmzayı değiştir:

```ts
async function syncUserKillmailsFromESI(
  ctx: UserSyncContext,
  lastKillmailId?: number,
): Promise<void> {
```

Gövdedeki tüm `message.characterName` → `ctx.characterName`, `message.characterId` → `ctx.characterId`, `message.accessToken` → `ctx.accessToken`, `message.userId` → `ctx.userId`. (`224`, `232`, `240-241`, `434`, `446`, `455`.) Hata yolundaki `message?.characterId` (satır `171-173`) `message?.userId` olur — o noktada karakter kimliği elde olmayabilir.

- [ ] **Step 4: Tip kontrolü**

```bash
yarn workspace backend build
```

Beklenen: temiz. `message.accessToken` gibi kalan bir kullanım varsa burada patlar.

- [ ] **Step 5: Bütün testler**

```bash
yarn workspace backend test
```

Beklenen: hepsi PASS (bu worker'ın kendi spec'i yok; bu adım regresyon kontrolü).

- [ ] **Step 6: Commit**

```bash
git add backend/src/workers/worker-esi-user-killmails.ts
git commit -m "refactor(workers): character sync reads its credentials from the database"
```

---

### Task 4: Corporation killmail worker

Task 3'ün birebir aynısı, corporation tarafında. Kod tekrarı kasıtlı: iki worker bu projede ayrı dosyalar ve her biri kendi kuyruğunun tek sahibi.

**Files:**

- Modify: `backend/src/workers/worker-esi-corporation-killmails.ts` — `interface CorporationKillmailMessage` (`15-26`), token bloğu (`92-152`), `syncCorporationKillmailsFromESI` imzası (`192-194`) ve gövdesi (`198-215`, `438-461`)

**Interfaces:**

- Consumes: `loadUserCredentials` (Task 1), `KillmailSyncMessage` (Task 2).
- Produces: `interface CorporationSyncContext { userId: number; characterName: string; corporationId: number; corporationName: string; accessToken: string }` — dosya içi.

- [ ] **Step 1: Import'ları ve mesaj tipini değiştir**

`interface CorporationKillmailMessage { ... }` (satır `15-26`) silinir. Eklenen import'lar:

```ts
import { type KillmailSyncMessage } from '@services/killmail-sync-message';
import { loadUserCredentials } from '@services/user-credentials';
```

`let message: CorporationKillmailMessage | undefined;` → `let message: KillmailSyncMessage | undefined;`, `as CorporationKillmailMessage` → `as KillmailSyncMessage`.

- [ ] **Step 2: Token bloğunu servise devret, corporation'ı veritabanından oku**

Satır `92`'deki `if (!message.accessToken || !message.refreshToken)` kontrolünden `Token is valid` else bloğunun kapanışına (`152`) kadar her şey silinir. Yerine:

```ts
const credentials = await loadUserCredentials(message.userId);

if (!credentials.ok) {
  logger.error(`  ❌ ${credentials.reason} for user ${message.userId}`);
  logger.error(`  ⏭️  Skipping user - requires re-login via SSO`);
  channel.ack(msg);
  return;
}

const { user, accessToken } = credentials;

if (!user.corporation_id) {
  // The publishers filter these out, but the filter is a shortcut,
  // not the rule: a user can leave a corporation between publish and
  // consume.
  logger.warn(`  ⏭️  ${user.character_name} has no corporation, skipping`);
  channel.ack(msg);
  return;
}

const corporation = await prismaWorker.corporation.findUnique({
  where: { id: user.corporation_id },
  select: { name: true },
});
const corporationName =
  corporation?.name ?? `Corporation ${user.corporation_id}`;

logger.info(`🏢 Processing: ${corporationName} (ID: ${user.corporation_id})`);
logger.info(`👤 User: ${user.character_name} (ID: ${user.character_id})`);

const lastKillmailId = message.fullSync
  ? undefined
  : (user.last_corp_killmail_id ?? undefined);

await syncCorporationKillmailsFromESI(
  {
    userId: user.id,
    characterName: user.character_name,
    corporationId: user.corporation_id,
    corporationName,
    accessToken,
  },
  lastKillmailId,
);
```

Satır `81-85`'teki eski `🏢 Processing` / `👤 User` logları silinir (yenileri yukarıda). Eski `await syncCorporationKillmailsFromESI(message, message.lastKillmailId);` satırı (`155-158`) silinir.

- [ ] **Step 3: `syncCorporationKillmailsFromESI` imzasını daralt**

Silinen `interface` yerine:

```ts
/** What one corporation sync needs, resolved from the database up front. */
interface CorporationSyncContext {
  userId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  accessToken: string;
}
```

İmza:

```ts
async function syncCorporationKillmailsFromESI(
  ctx: CorporationSyncContext,
  lastKillmailId?: number,
): Promise<void> {
```

Gövdede `message.corporationName` → `ctx.corporationName`, `message.corporationId` → `ctx.corporationId`, `message.accessToken` → `ctx.accessToken`, `message.userId` → `ctx.userId`. (`198`, `206`, `214-215`, `438`, `450`, `461`.) Hata yolundaki `message?.corporationId` (`171-173`) `message?.userId` olur.

- [ ] **Step 4: Tip kontrolü**

```bash
yarn workspace backend build
```

- [ ] **Step 5: Bütün testler**

```bash
yarn workspace backend test
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/workers/worker-esi-corporation-killmails.ts
git commit -m "refactor(workers): corporation sync reads its credentials from the database"
```

---

### Task 5: Cron ve queue script'leri

Üç publisher. Hepsinde `select` listesinden token sütunları çıkar, `where` koşulları **kalır** — süresi dolmuş ya da refresh token'ı olmayan bir kullanıcıyı kuyruğa koymanın anlamı yok; bu bir filtre, yetki kontrolü değil.

**Files:**

- Modify: `backend/src/services/user-killmail-cron.ts` — `interface UserKillmailMessage` (`7-16`), `select` (`140-149`), mesaj kurulumu ve publish (`169-184`)
- Modify: `backend/src/queues/queue-user-esi-killmails.ts` — `interface` (`7-16`), `select` (`73-85`), mesaj kurulumu (`110-127`)
- Modify: `backend/src/queues/queue-corporation-esi-killmails.ts` — `interface` (`7-18`), `select` (`80-91`), corporation adı sorgusu (`116-135`), mesaj kurulumu (`137-157`)

**Interfaces:**

- Consumes: `buildSyncMessage` (Task 2).
- Produces: davranış değişikliği yok; `skipReason` (#237) olduğu gibi kalır.

- [ ] **Step 1: Cron'u daralt**

`services/user-killmail-cron.ts`: `interface UserKillmailMessage` bloğu silinir, yerine import:

```ts
import { buildSyncMessage } from '@services/killmail-sync-message';
```

`select` içinden `access_token: true,` ve `refresh_token: true,` satırları silinir. Döngüdeki mesaj kurulumu:

```ts
const message = buildSyncMessage(user.id);

channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
  persistent: true,
  priority: 3, // Lower priority for background sync
});
```

`last_killmail_id: true` de `select`'ten çıkar — cron artık onu mesaja koymuyor. `expires_at`, `last_killmail_sync_at`, `character_name` kalır: ilki `where` için, diğer ikisi log satırı için.

- [ ] **Step 2: Queue script'lerini daralt**

`queues/queue-user-esi-killmails.ts`: aynı import, aynı `select` temizliği (`access_token`, `refresh_token`, `last_killmail_id` çıkar), mesaj:

```ts
const message = buildSyncMessage(user.id, fullSync);
```

`syncMode` log satırı `user.last_killmail_id`'ye bakıyordu; `fullSync ? ' [FULL SYNC]' : ' [INCREMENTAL]'` hâline iner — artımlı mı tam mı olduğunu artık worker belirliyor, script'in bildiği tek şey bayrak.

`queues/queue-corporation-esi-killmails.ts`: aynısı, `last_corp_killmail_id` için. Ek olarak satır `116-135`'teki corporation adı toplu sorgusu ve `corpMap` tamamen silinir; log satırı `Queued: ${user.character_name} (Corp ID: ${user.corporation_id})` olur.

- [ ] **Step 3: Tip kontrolü ve testler**

```bash
yarn workspace backend build && yarn workspace backend test
```

Beklenen: temiz; `user-killmail-cron.spec.ts` (#237) hâlâ PASS — `skipReason` bu taskta değişmiyor.

- [ ] **Step 4: Biçim**

```bash
cd backend && npx prettier --check src/services/user-killmail-cron.ts src/queues/queue-user-esi-killmails.ts src/queues/queue-corporation-esi-killmails.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/user-killmail-cron.ts backend/src/queues/queue-user-esi-killmails.ts backend/src/queues/queue-corporation-esi-killmails.ts
git commit -m "refactor(queues): publish a user id instead of a credential"
```

---

### Task 6: Login publisher

Son publish noktası. Resolver `@services/prisma` kullanıyor (API istemcisi) — bu değişmiyor.

**Files:**

- Modify: `backend/src/resolvers/auth/mutations.ts` — character mesajı (`87-104`), corporation adı sorgusu (`129-136`), corporation mesajı (`141-160`)

**Interfaces:**

- Consumes: `buildSyncMessage` (Task 2).
- Produces: yok. `AuthPayload` dönüşü (`176-180`, `218-222`) bu planda **değişmiyor** — spec'in 8. bölümü.

- [ ] **Step 1: İki mesajı da daralt**

Import ekle:

```ts
import { buildSyncMessage } from '@services/killmail-sync-message';
```

Character bloğunda `charMessage` nesnesi:

```ts
const charMessage = buildSyncMessage(user.id);
```

Corporation bloğunda, satır `129-136`'daki `// Fetch corporation name` sorgusu ve `corporationName` değişkeni tamamen silinir (worker artık kendisi okuyor), `corpMessage`:

```ts
const corpMessage = buildSyncMessage(user.id);
```

`console.log` satırlarındaki `${corporationName}` kullanımı `${corporationId}` ile değiştirilir.

- [ ] **Step 2: Tip kontrolü ve testler**

```bash
yarn workspace backend build && yarn workspace backend test
```

- [ ] **Step 3: Token alanı kalmadığını doğrula**

```bash
cd backend && grep -rn "accessToken\|refreshToken" src/queues src/workers src/services/user-killmail-cron.ts
```

Beklenen: hiçbir çıktı yok. (`src/resolvers/auth/mutations.ts` hâlâ `AuthPayload` için token döndürüyor — orası kapsam dışı ve bu grep'e dahil değil.)

- [ ] **Step 4: Biçim ve commit**

```bash
cd backend && npx prettier --check src/resolvers/auth/mutations.ts
git add backend/src/resolvers/auth/mutations.ts
git commit -m "refactor(auth): queue a user id on login instead of the SSO token pair"
```

---

### Task 7: Ops dokümanı, tam doğrulama, PR

**Files:**

- Modify: `backend/docs/ops/rabbitmq.md` — yayına alma sırası ve purge adımı

**Interfaces:**

- Consumes: Task 1-6'nın tamamı.
- Produces: birleşmeye hazır PR.

- [ ] **Step 1: Ops adımını yaz**

`backend/docs/ops/rabbitmq.md` sonuna yeni bölüm:

````markdown
## Sync mesajları artık kimlik bilgisi taşımıyor

`esi_user_killmails_queue` ve `esi_corporation_killmails_queue` mesajları
kullanıcının EVE SSO access ve refresh token'ını taşıyordu. Broker bunları
`persistent: true` ile diske yazıyordu ve `killreport.parking` bir kopyayı
süresiz saklıyordu, çünkü o kuyruğu hiçbir şey tüketmiyor. Mesaj artık yalnızca
`{ userId, fullSync?, queuedAt }`; token'ı worker `loadUserCredentials` ile
veritabanından okuyor.

**Yayına alma sırası tek yönlü: önce worker'lar, sonra publisher'lar.** Yeni
worker eski mesajı da işleyebilir — `userId` eski mesajda da var, fazla alanları
görmezden gelir. Tersi doğru değil: eski worker yeni mesajda `accessToken`
bulamaz ve kullanıcıyı ack'leyip atar.

Yayına aldıktan sonra, bir kez, elle:

```bash
rabbitmqctl purge_queue esi_user_killmails_queue
rabbitmqctl purge_queue esi_corporation_killmails_queue
rabbitmqctl purge_queue killreport.parking
```

Kaybedilen tek şey "şu kullanıcıyı senkronize et" isteği; cron on dakika içinde
yenisini yayınlıyor. `yarn rabbitmq:purge` bu iş için **kullanılmaz** — o bütün
kuyrukları boşaltıyor.
````

- [ ] **Step 2: Markdown linklerini doğrula**

```bash
cd /Users/umut/Sites/killreport && grep -rn --include='*.md' -oE '\]\([^)#][^)]*\)' backend/docs/ops/rabbitmq.md
```

Beklenen: yeni bölüm link eklemiyor, mevcut linkler bozulmamış.

- [ ] **Step 3: Tam doğrulama seti**

```bash
cd /Users/umut/Sites/killreport
yarn test
yarn workspace backend build
npx prettier --check .
```

Üçü de temiz olmadan PR açılmaz. `yarn workspace frontend lint/build` bu planda çalıştırılmıyor: frontend'de değişen dosya yok.

- [ ] **Step 4: Commit ve PR**

```bash
git add backend/docs/ops/rabbitmq.md
git commit -m "docs(ops): record the sync message contract and its purge step"
git push -u origin <dal-adı>
gh pr create --title "refactor(workers): stop putting SSO credentials on the queue" \
  --body-file <hazırlanan gövde> \
  --label refactor --label backend --label workers --label ops
```

PR gövdesinde mutlaka bulunacaklar: üç sonuç (diskte kalıcı kopya, parking'in süresiz saklaması, eskiyen kopyanın kullanıcıyı sync dışına atması), yayına alma sırası, purge adımının PR birleştikten **sonra** elle çalıştırılacağı, ve kapsam dışı bırakılan `AuthPayload` maddesi.

---

## Self-Review

**Spec kapsamı.** Spec'in 2. bölümü (yeni mesaj şekli) → Task 2. 3. bölüm (ortak servis) → Task 1. 4. bölüm (değişen dosyalar) → Task 3-6. 6. bölüm (test) → Task 1 Step 1, Task 2 Step 1. 7. bölüm (sıra ve temizlik) → Task 7. 8. bölüm (kapsam dışı) → Task 6'da `AuthPayload`'ın değişmediği açıkça yazılı. 9. bölümün beş kabul kriteri sırasıyla Task 6 Step 3, Task 2, Task 1, Task 7 Step 3, Task 7 Step 1 ile karşılanıyor.

**Tip tutarlılığı.** `loadUserCredentials` Task 1'de `{ ok, user, accessToken }` döndürüyor; Task 3 ve 4 tam olarak bu adlarla açıyor. `UserSyncRow` alan adları veritabanı sütunlarıyla aynı snake_case — worker'larda `user.character_name`, `user.last_killmail_id`, `user.corporation_id` olarak okunuyor, tutarlı. `buildSyncMessage(userId, fullSync?)` Task 2'de tanımlı, Task 5 ve 6'da aynı imzayla çağrılıyor.

**Bir bilinçli boşluk.** İki worker'ın kendi spec dosyası yok ve bu plan onlara test eklemiyor; değişikliği tutan şey `build` (tip kontrolü token alanı kalan her kullanımı yakalar) ve Task 6 Step 3'teki grep. Worker'lara test yazmak kendi işi.
