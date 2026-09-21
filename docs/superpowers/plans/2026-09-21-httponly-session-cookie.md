# Oturum httpOnly çerezde — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EVE SSO refresh token'ı tarayıcıdan tamamen çıkarmak; yenileme yetkisi `HttpOnly` bir çerezde, çerezin arkasında iptal edilebilir bir `sessions` satırında dursun.

**Architecture:** Çerez 32 baytlık rastgele bir değer taşır; tabloda yalnızca SHA-256 özeti saklanır. Bearer akışına dokunulmaz — tarayıcı EVE access token'ını göndermeye, sunucu onu EVE'in JWKS'ine karşı doğrulamaya devam eder. Değişen tek mekanizma yenileme: argümansız `refreshSession` çerezi okur, oturumu doğrular, 30 günlük ömrü kaydırır ve taze bir access token döner. Callback artık query string'siz yönlendirir.

**Tech Stack:** TypeScript, GraphQL Yoga 5.21.2, Prisma, Next.js App Router, Apollo Client, Vitest 5.

**Spec:** [`docs/superpowers/specs/2026-09-21-httponly-session-cookie-design.md`](../specs/2026-09-21-httponly-session-cookie-design.md)

## Global Constraints

- **Yarn, asla npm.** `yarn workspace backend test`, `yarn workspace backend build`, `yarn workspace frontend lint`, `yarn workspace frontend build`.
- **Codegen sırası:** `.graphql` değişirse önce `yarn workspace backend codegen`, sonra `yarn workspace frontend codegen`. Generated dosyalar elle düzenlenmez: `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
- **Asla veritabanını sıfırlama, asla satır kaybetme.** `prisma migrate reset` yok, `prisma migrate dev` yok (`yarn prisma:migrate` dahil — o da aynı komutun takma adı). Veri kaybı görünen tek yol buysa dur ve sor.
- **İki Prisma istemcisi:** resolver ve API `@services/prisma`, worker ve queue script'leri `@services/prisma-worker`. Karıştırmak 22 bağlantılık havuzu tüketir.
- **`.env` ve hiçbir sır dosyası düzenlenmez.** Gereken satır kullanıcıya söylenir. Bu planda yeni env değişkeni **yok**.
- **Çerez öznitelikleri tam olarak:** `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`, ve yalnızca `config.app.isProduction` ise ek olarak `Secure`.
- **Oturum ömrü 30 gün, kayan:** `SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000`.
- **Çerez adı tam olarak** `kr_session`.
- **`prettier --check`** değişen her dosyada temiz olmalı.
- **Commit mesajları İngilizce, Claude attribution yok** — `Co-Authored-By` yok, "Generated with" yok.
- Frontend'de hook veya state kullanan her bileşen dosyanın başında `"use client"` taşır.

---

### Task 1: Saf oturum ilkelleri

Çerez dizesi ve oturum durumu kararları, veritabanına ve isteğe dokunmayan saf fonksiyonlar olarak. Mock'suz test edilirler ve import zincirleri `config`'e ulaşmaz — emsal `services/queue-health.ts`, ki #237'de tam bu sebeple oraya taşınmıştı (CI'da `.env` yok, `config.ts` `process.exit(1)` çağırıyor).

**Files:**

- Create: `backend/src/services/session-cookie.ts`
- Create: `backend/src/services/session-cookie.spec.ts`
- Create: `backend/src/services/session.ts`
- Create: `backend/src/services/session.spec.ts`

**Interfaces:**

- Consumes: yok.
- Produces:
  - `SESSION_COOKIE_NAME = 'kr_session'`
  - `parseCookieHeader(header: string | null | undefined): Record<string, string>`
  - `serializeSessionCookie(value: string, opts: { secure: boolean }): string`
  - `clearSessionCookie(opts: { secure: boolean }): string`
  - `SESSION_TTL_MS`
  - `type SessionRowState = 'valid' | 'expired' | 'revoked' | 'missing'`
  - `sessionState(row: { expires_at: Date; revoked_at: Date | null } | null, now: Date): SessionRowState`
  - `slidExpiry(now: Date): Date`

- [ ] **Step 1: Çerez testini yaz**

`backend/src/services/session-cookie.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  parseCookieHeader,
  serializeSessionCookie,
} from './session-cookie';

describe('parseCookieHeader', () => {
  it('reads a single cookie', () => {
    expect(parseCookieHeader('kr_session=abc')).toEqual({ kr_session: 'abc' });
  });

  it('reads several and tolerates the spacing browsers actually send', () => {
    expect(parseCookieHeader('a=1; kr_session=abc;b=2')).toEqual({
      a: '1',
      kr_session: 'abc',
      b: '2',
    });
  });

  it('is empty when the header is absent', () => {
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader('')).toEqual({});
  });

  it('ignores a malformed pair rather than throwing', () => {
    expect(parseCookieHeader('novalue; kr_session=abc')).toEqual({
      kr_session: 'abc',
    });
  });

  it('decodes a percent-encoded value', () => {
    expect(parseCookieHeader('kr_session=a%2Bb')).toEqual({
      kr_session: 'a+b',
    });
  });
});

describe('serializeSessionCookie', () => {
  it('carries every attribute the design fixes', () => {
    const header = serializeSessionCookie('abc', { secure: false });

    expect(header).toContain(`${SESSION_COOKIE_NAME}=abc`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=2592000');
  });

  it('omits Secure off production, because dev is plain http', () => {
    expect(serializeSessionCookie('abc', { secure: false })).not.toContain(
      'Secure',
    );
  });

  it('adds Secure in production', () => {
    expect(serializeSessionCookie('abc', { secure: true })).toContain('Secure');
  });

  it('never sets Domain, so the cookie stays host-only', () => {
    expect(serializeSessionCookie('abc', { secure: true })).not.toContain(
      'Domain',
    );
  });
});

describe('clearSessionCookie', () => {
  it('expires the cookie immediately and keeps the same path', () => {
    const header = clearSessionCookie({ secure: false });

    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('Path=/');
    expect(header).toContain('HttpOnly');
  });
});
```

- [ ] **Step 2: Oturum durumu testini yaz**

`backend/src/services/session.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { SESSION_TTL_MS, sessionState, slidExpiry } from './session';

const now = new Date('2026-09-21T12:00:00Z');

describe('sessionState', () => {
  it('is missing when there is no row', () => {
    expect(sessionState(null, now)).toBe('missing');
  });

  it('is revoked when revoked_at is set, even if it has not expired', () => {
    expect(
      sessionState(
        {
          expires_at: new Date('2026-10-21T12:00:00Z'),
          revoked_at: new Date('2026-09-20T12:00:00Z'),
        },
        now,
      ),
    ).toBe('revoked');
  });

  it('is expired once expires_at has passed', () => {
    expect(
      sessionState(
        { expires_at: new Date('2026-09-21T11:59:59Z'), revoked_at: null },
        now,
      ),
    ).toBe('expired');
  });

  it('is expired exactly at expires_at, because the request comes after it', () => {
    expect(sessionState({ expires_at: now, revoked_at: null }, now)).toBe(
      'expired',
    );
  });

  it('is valid one second before it expires', () => {
    expect(
      sessionState(
        { expires_at: new Date('2026-09-21T12:00:01Z'), revoked_at: null },
        now,
      ),
    ).toBe('valid');
  });

  it('reports revoked before expired when a row is both', () => {
    expect(
      sessionState(
        {
          expires_at: new Date('2026-01-01T00:00:00Z'),
          revoked_at: new Date('2026-01-01T00:00:00Z'),
        },
        now,
      ),
    ).toBe('revoked');
  });
});

describe('slidExpiry', () => {
  it('pushes the expiry a full TTL past now', () => {
    expect(slidExpiry(now).getTime()).toBe(now.getTime() + SESSION_TTL_MS);
  });

  it('is thirty days', () => {
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 3: Testleri çalıştır, başarısız olduklarını gör**

```bash
yarn workspace backend test src/services/session-cookie.spec.ts src/services/session.spec.ts
```

Beklenen: iki dosya da `Failed to resolve import` ile FAIL.

- [ ] **Step 4: Çerez modülünü yaz**

`backend/src/services/session-cookie.ts`:

```ts
/**
 * The session cookie, as a string.
 *
 * Nothing here reads the database or the request — the header in, the header
 * out. That keeps the import graph free of `config.ts`, whose `parseEnv` calls
 * `process.exit(1)` when a variable is missing: CI has no `.env`, so a spec
 * that reaches config dies before its first assertion. #237 moved a decision
 * function for exactly this reason.
 */

export const SESSION_COOKIE_NAME = 'kr_session';

/** 30 days, matching the sliding session lifetime. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `Cookie: a=1; b=2` into an object.
 *
 * A pair with no `=` is skipped rather than throwing: this parses input from
 * the network, and one malformed cookie set by anything else on the host must
 * not take the request down.
 */
export function parseCookieHeader(
  header: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;

    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;

    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }

  return out;
}

/**
 * `SameSite=Lax` is enough in both environments and `None` is not needed:
 * SameSite looks at the registrable domain, not the origin, so
 * `killreport.com` and `api.killreport.com` are the same site, and in
 * development both ends are `localhost` (cookies ignore the port). It is also
 * the CSRF answer — a cross-site POST carries no cookie, and GraphQL's
 * `application/json` POST is preflighted, so CORS stops it too.
 *
 * No `Domain`, so the cookie is host-only: in production only
 * `api.killreport.com` ever receives it.
 */
export function serializeSessionCookie(
  value: string,
  opts: { secure: boolean },
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];

  if (opts.secure) parts.push('Secure');

  return parts.join('; ');
}

/** The same cookie with a zero lifetime, which is how a browser is told to drop it. */
export function clearSessionCookie(opts: { secure: boolean }): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];

  if (opts.secure) parts.push('Secure');

  return parts.join('; ');
}
```

- [ ] **Step 5: Oturum durumu modülünü yaz**

`backend/src/services/session.ts`:

```ts
/**
 * What a session row means right now.
 *
 * Kept apart from the database calls so the rules are readable and testable on
 * their own: a row is usable only when it exists, was not revoked, and has not
 * run out. Revocation is reported ahead of expiry because it is the deliberate
 * act — "this device was signed out" is a more useful answer than "it lapsed".
 */

/** 30 days. The session slides: every successful use pushes it out again. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionRowState = 'valid' | 'expired' | 'revoked' | 'missing';

export function sessionState(
  row: { expires_at: Date; revoked_at: Date | null } | null,
  now: Date,
): SessionRowState {
  if (!row) return 'missing';
  if (row.revoked_at) return 'revoked';
  if (row.expires_at.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

export function slidExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}
```

- [ ] **Step 6: Testleri çalıştır, geçtiklerini gör**

```bash
yarn workspace backend test src/services/session-cookie.spec.ts src/services/session.spec.ts
```

Beklenen: 20 test PASS.

- [ ] **Step 7: Biçim, tip, commit**

```bash
cd backend && npx prettier --check src/services/session-cookie.ts src/services/session-cookie.spec.ts src/services/session.ts src/services/session.spec.ts
yarn workspace backend build
git add backend/src/services/session-cookie.ts backend/src/services/session-cookie.spec.ts backend/src/services/session.ts backend/src/services/session.spec.ts
git commit -m "feat(services): pure session cookie and session state primitives"
```

---

### Task 2: `sessions` tablosu ve migration

Planın en riskli parçası. **Dikkatle oku: bu repoda `prisma migrate dev` veri kaybettirir.**

**Files:**

- Create: `backend/prisma/schema/session.prisma`
- Modify: `backend/prisma/schema/user.prisma` — `User` modeline ilişkinin karşı tarafı
- Create: `backend/prisma/migrations/<timestamp>_add_sessions/migration.sql`

**Interfaces:**

- Consumes: yok.
- Produces: Prisma istemcisinde `prisma.session` delegesi; `Session` modeli alanları `id`, `token_hash`, `user_id`, `created_at`, `last_seen_at`, `expires_at`, `user_agent`, `ip`, `revoked_at`.

- [ ] **Step 1: Korunan beş tablonun satır sayılarını kaydet**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
for t in killmail_filters character_kill_stats corporation_kill_stats alliance_kill_stats refresh_log; do
  echo -n "$t: "; psql "$DB" -t -c "SELECT COUNT(*) FROM $t;"
done
```

Çıktıyı rapora yaz. Bu beş tablo şemada bilerek yok; Prisma onları drift sayıp drop etmeyi teklif eder.

- [ ] **Step 2: Modeli yaz**

`backend/prisma/schema/session.prisma`:

```prisma
// Tarayıcı oturumu. Çerez ham değeri taşır, burada yalnızca SHA-256 özeti
// durur: veritabanı sızarsa oradaki değerlerle hiçbir oturum açılamaz.
model Session {
  id           String    @id @default(uuid())
  token_hash   String    @unique
  user_id      Int
  user         User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  created_at   DateTime  @default(now())
  last_seen_at DateTime  @default(now())
  expires_at   DateTime
  user_agent   String?
  ip           String?
  revoked_at   DateTime?

  @@index([user_id])
  @@index([expires_at])
  @@map("sessions")
}
```

`backend/prisma/schema/user.prisma` içinde, `corporation_id` satırının altına ilişkinin karşı tarafı:

```prisma
  sessions                   Session[]
```

- [ ] **Step 3: DDL üret ve incele**

```bash
cd backend
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/sessions-diff.sql
grep -n "^DROP" /tmp/sessions-diff.sql
cat /tmp/sessions-diff.sql
```

Beklenen: bir `CREATE TABLE "sessions"`, iki `CREATE INDEX`, bir `CREATE UNIQUE INDEX`, bir `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. Ayrıca yukarıdaki beş tablo için `DROP TABLE` satırları. **Bundan başka bir şey görürsen dur ve sor.**

- [ ] **Step 4: Migration dosyasını yaz**

`/tmp/sessions-diff.sql`'den beş korunan tabloya ait her `DROP TABLE` satırı silinir; geriye kalan `sessions` DDL'i dosyaya yazılır:

```bash
cd backend
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_sessions
# düzenlenmiş SQL'i o klasördeki migration.sql dosyasına yaz
grep -n "^[^-]*DROP" prisma/migrations/*_add_sessions/migration.sql
```

Son `grep` **boş dönmeli**. Dönmezse migration'ı uygulama.

- [ ] **Step 5: Uygula ve istemciyi üret**

```bash
cd backend && npx prisma migrate deploy && npx prisma generate
```

- [ ] **Step 6: Satır sayılarını tekrar al**

Step 1'deki döngüyü aynen tekrar çalıştır. **Hiçbiri azalmamış olmalı.** Azaldıysa dur ve sor.

- [ ] **Step 7: Tablonun oluştuğunu doğrula**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "\d sessions"
```

- [ ] **Step 8: Tip kontrolü ve commit**

```bash
yarn workspace backend build
git add backend/prisma/schema/session.prisma backend/prisma/schema/user.prisma backend/prisma/migrations
git commit -m "feat(db): add the sessions table"
```

---

### Task 3: `loadUserCredentials` istemciyi parametre alsın

#238'de gelen servis `prisma-worker` istemcisine sabitlenmiş. `refreshSession` bir resolver'dan çağrılacak ve resolver tarafı `@services/prisma` kullanmak zorunda — 22 bağlantılık havuz sınırı. Servisin ikinci bir kopyası çıkmasın diye imza istemci alır.

**Files:**

- Modify: `backend/src/services/user-credentials.ts` — `loadUserCredentials` imzası ve gövdesindeki iki `prismaWorker` kullanımı
- Modify: `backend/src/services/user-credentials.spec.ts` — çağrılar yeni imzaya göre
- Modify: `backend/src/workers/worker-esi-user-killmails.ts` — çağrı
- Modify: `backend/src/workers/worker-esi-corporation-killmails.ts` — çağrı

**Interfaces:**

- Consumes: `UserCredentials`, `UserSyncRow` (mevcut, değişmiyor).
- Produces: `loadUserCredentials(userId: number, client: CredentialClient): Promise<UserCredentials>` ve

```ts
export interface CredentialClient {
  user: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
}
```

- [ ] **Step 1: İmzayı değiştir**

`backend/src/services/user-credentials.ts`: `import prismaWorker from '@services/prisma-worker';` satırı silinir. Dosyaya tip ve yeni imza eklenir:

```ts
/**
 * The two Prisma clients are not interchangeable: workers use
 * `@services/prisma-worker` and the API uses `@services/prisma`, because
 * DigitalOcean PostgreSQL allows 22 connections and sharing one pool exhausts
 * it. Both call this function, so the caller passes its own client rather than
 * the module picking one.
 */
export interface CredentialClient {
  user: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
}
```

`loadUserCredentials(userId: number)` → `loadUserCredentials(userId: number, client: CredentialClient)`; gövdedeki `prismaWorker.user.findUnique` ve `prismaWorker.user.update` → `client.user.findUnique` / `client.user.update`.

- [ ] **Step 2: Testi yeni imzaya taşı**

`backend/src/services/user-credentials.spec.ts`: `vi.mock('@services/prisma-worker', ...)` satırı silinir; her `loadUserCredentials(7)` çağrısı `loadUserCredentials(7, prismaMock)` olur. `prismaMock` tanımı olduğu gibi kalır.

- [ ] **Step 3: İki worker'ın çağrısını güncelle**

Her iki worker'da `loadUserCredentials(message.userId)` → `loadUserCredentials(message.userId, prismaWorker)`. `prismaWorker` her iki dosyada zaten import edilmiş durumda.

- [ ] **Step 4: Testler ve tip kontrolü**

```bash
yarn workspace backend test src/services/user-credentials.spec.ts
yarn workspace backend build
```

Beklenen: 9 test PASS, build temiz. Build, güncellenmemiş bir çağrı kalırsa burada patlar.

- [ ] **Step 5: Bütün testler ve commit**

```bash
yarn workspace backend test
cd backend && npx prettier --check src/services/user-credentials.ts src/services/user-credentials.spec.ts src/workers/worker-esi-user-killmails.ts src/workers/worker-esi-corporation-killmails.ts
git add backend/src/services/user-credentials.ts backend/src/services/user-credentials.spec.ts backend/src/workers/worker-esi-user-killmails.ts backend/src/workers/worker-esi-corporation-killmails.ts
git commit -m "refactor(services): let the caller supply the Prisma client for credentials"
```

---

### Task 4: Oturum deposu

Veritabanına dokunan oturum işlemleri. Kararlar Task 1'deki saf fonksiyonlardan gelir; burası yalnızca okuma/yazma.

**Files:**

- Create: `backend/src/services/session-store.ts`
- Create: `backend/src/services/session-store.spec.ts`

**Interfaces:**

- Consumes: `sessionState`, `slidExpiry` (Task 1); `prisma.session` delegesi (Task 2).
- Produces:
  - `newSessionToken(): string` — 32 bayt, base64url
  - `hashSessionToken(token: string): string` — SHA-256, hex
  - `createSession(userId: number, meta: { userAgent?: string | null; ip?: string | null }): Promise<string>` — ham token döner
  - `resolveSession(token: string | undefined): Promise<{ id: string; userId: number } | null>` — geçerliyse kaydırır ve döner
  - `revokeSessionById(id: string, userId: number): Promise<boolean>`
  - `revokeSessionByToken(token: string): Promise<void>`
  - `listSessions(userId: number): Promise<SessionRow[]>`

- [ ] **Step 1: Testi yaz**

`backend/src/services/session-store.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@services/prisma', () => ({ default: prismaMock }));

import {
  createSession,
  hashSessionToken,
  newSessionToken,
  resolveSession,
  revokeSessionById,
} from './session-store';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('newSessionToken', () => {
  it('is long enough to be unguessable and different every time', () => {
    const a = newSessionToken();
    const b = newSessionToken();

    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('hashSessionToken', () => {
  it('is deterministic', () => {
    expect(hashSessionToken('abc')).toBe(hashSessionToken('abc'));
  });

  it('does not return the token it was given', () => {
    expect(hashSessionToken('abc')).not.toBe('abc');
  });
});

describe('createSession', () => {
  it('stores the hash, never the token, and returns the token', async () => {
    prismaMock.session.create.mockResolvedValue({});

    const token = await createSession(7, { userAgent: 'UA', ip: '1.2.3.4' });

    const written = prismaMock.session.create.mock.calls[0][0].data;
    expect(written.token_hash).toBe(hashSessionToken(token));
    expect(JSON.stringify(written)).not.toContain(token);
    expect(written.user_id).toBe(7);
    expect(written.user_agent).toBe('UA');
    expect(written.ip).toBe('1.2.3.4');
  });
});

describe('resolveSession', () => {
  it('is null without a token, and does not hit the database', async () => {
    expect(await resolveSession(undefined)).toBeNull();
    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });

  it('is null for a token no row matches', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    expect(await resolveSession('nope')).toBeNull();
  });

  it('is null for a revoked row and does not slide it', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 7,
      expires_at: new Date(Date.now() + 1000),
      revoked_at: new Date(),
    });

    expect(await resolveSession('abc')).toBeNull();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('is null for an expired row', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 7,
      expires_at: new Date(Date.now() - 1000),
      revoked_at: null,
    });

    expect(await resolveSession('abc')).toBeNull();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('returns the user and slides the expiry on a valid row', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
    prismaMock.session.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 7,
      expires_at: new Date('2026-10-01T00:00:00Z'),
      revoked_at: null,
    });
    prismaMock.session.update.mockResolvedValue({});

    expect(await resolveSession('abc')).toEqual({ id: 's1', userId: 7 });
    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        last_seen_at: new Date('2026-09-21T12:00:00Z'),
        expires_at: new Date('2026-10-21T12:00:00Z'),
      },
    });
  });

  it('looks the row up by hash, not by the raw token', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    await resolveSession('abc');

    expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
      where: { token_hash: hashSessionToken('abc') },
      select: {
        id: true,
        user_id: true,
        expires_at: true,
        revoked_at: true,
      },
    });
  });
});

describe('revokeSessionById', () => {
  it('will not revoke a session belonging to someone else', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 });

    expect(await revokeSessionById('s1', 7)).toBe(false);
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', user_id: 7, revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });
  });

  it('is true when a row was actually revoked', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 });
    expect(await revokeSessionById('s1', 7)).toBe(true);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

```bash
yarn workspace backend test src/services/session-store.spec.ts
```

Beklenen: `Failed to resolve import "./session-store"`.

- [ ] **Step 3: Depoyu yaz**

`backend/src/services/session-store.ts`:

```ts
import { createHash, randomBytes } from 'crypto';

import prisma from '@services/prisma';
import { sessionState, slidExpiry } from '@services/session';

/**
 * Session rows, and the token that points at one.
 *
 * The cookie carries 32 random bytes; the table stores only their SHA-256.
 * A database leak therefore yields nothing usable — the values in `token_hash`
 * cannot be presented as cookies. This is why there is no signature: once a row
 * grants the authority, a signature adds a second secret to lose.
 */

export interface SessionRow {
  id: string;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  user_agent: string | null;
  ip: string | null;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<string> {
  const token = newSessionToken();

  await prisma.session.create({
    data: {
      token_hash: hashSessionToken(token),
      user_id: userId,
      expires_at: slidExpiry(new Date()),
      user_agent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return token;
}

/**
 * The session this token names, sliding its lifetime as a side effect.
 *
 * Returns null for every unusable case — absent, unknown, revoked, expired —
 * because the caller does the same thing with all four: answer
 * `UNAUTHENTICATED`. Distinguishing them in the response would tell an attacker
 * whether a token ever existed.
 */
export async function resolveSession(
  token: string | undefined,
): Promise<{ id: string; userId: number } | null> {
  if (!token) return null;

  const row = await prisma.session.findUnique({
    where: { token_hash: hashSessionToken(token) },
    select: { id: true, user_id: true, expires_at: true, revoked_at: true },
  });

  if (sessionState(row, new Date()) !== 'valid') return null;

  const now = new Date();
  await prisma.session.update({
    where: { id: row!.id },
    data: { last_seen_at: now, expires_at: slidExpiry(now) },
  });

  return { id: row!.id, userId: row!.user_id };
}

/** Scoped to the owner: another user's id simply revokes nothing. */
export async function revokeSessionById(
  id: string,
  userId: number,
): Promise<boolean> {
  const { count } = await prisma.session.updateMany({
    where: { id, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });

  return count > 0;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { token_hash: hashSessionToken(token), revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function listSessions(userId: number): Promise<SessionRow[]> {
  return prisma.session.findMany({
    where: { user_id: userId, revoked_at: null },
    select: {
      id: true,
      created_at: true,
      last_seen_at: true,
      expires_at: true,
      user_agent: true,
      ip: true,
    },
    orderBy: { last_seen_at: 'desc' },
  });
}
```

- [ ] **Step 4: Testleri çalıştır ve commit**

```bash
yarn workspace backend test src/services/session-store.spec.ts
yarn workspace backend build
cd backend && npx prettier --check src/services/session-store.ts src/services/session-store.spec.ts
git add backend/src/services/session-store.ts backend/src/services/session-store.spec.ts
git commit -m "feat(services): session store keyed by a hash of the cookie value"
```

Beklenen: 11 test PASS.

---

### Task 5: Çerez eklentisi, context ve CORS

Yoga 5.21.2'de çerez eklentisi yok ve yeni bağımlılık eklemiyoruz. Okuma context'te, yazma `onResponse` içinde.

**Files:**

- Create: `backend/src/plugins/cookies.plugin.ts`
- Modify: `backend/src/server.ts` — `ServerContext` (`29-32`), CORS bloğu (`60-88`), `plugins` dizisi (`90-`), `context` fonksiyonu (`126-`)

**Interfaces:**

- Consumes: `parseCookieHeader`, `SESSION_COOKIE_NAME` (Task 1).
- Produces: context üzerinde iki alan —
  - `sessionToken?: string` — isteğin çerezindeki ham değer
  - `setCookies: string[]` — resolver'ların yazdığı `Set-Cookie` başlıkları
  - ve `createCookiesPlugin(): Plugin`

- [ ] **Step 1: Eklentiyi yaz**

`backend/src/plugins/cookies.plugin.ts`:

```ts
import { Plugin } from 'graphql-yoga';

/**
 * Writes whatever a resolver put on `context.setCookies` out as `Set-Cookie`.
 *
 * Yoga has no cookie support of its own at 5.21.2 and this needs two headers
 * at most — the sliding refresh and the logout clear — so a dependency would
 * be more moving parts than the problem has. Reading happens in the context
 * factory; this half only writes.
 */
export const createCookiesPlugin = (): Plugin => ({
  onResponse({ response, serverContext }) {
    const cookies = (serverContext as { setCookies?: string[] })?.setCookies;
    if (!cookies?.length) return;

    for (const cookie of cookies) {
      response.headers.append('Set-Cookie', cookie);
    }
  },
});
```

- [ ] **Step 2: Context'i genişlet**

`backend/src/server.ts`, `ServerContext` arayüzü:

```ts
interface ServerContext extends ReturnType<typeof createDataLoaders> {
  user?: VerifiedCharacter;
  token?: string;
  /** Raw value of the kr_session cookie on this request, if any. */
  sessionToken?: string;
  /** Set-Cookie headers a resolver wants on the response. */
  setCookies: string[];
}
```

`context` fonksiyonunun başında, `dataLoaders` satırının hemen ardından:

```ts
const cookies = parseCookieHeader(request?.headers.get('cookie'));
const sessionToken = cookies[SESSION_COOKIE_NAME];
const setCookies: string[] = [];
```

ve fonksiyonun **her** `return` ifadesine `sessionToken` ile `setCookies` eklenir — üç dönüş noktası var (doğrulanmış kullanıcı, doğrulama hatası sonrası düşüş, ve token yok hâli).

Import satırı:

```ts
import {
  SESSION_COOKIE_NAME,
  parseCookieHeader,
} from '@services/session-cookie';
```

- [ ] **Step 3: Eklentiyi kaydet**

`plugins` dizisinde, `createDepthLimitPlugin(12)` satırının hemen üstüne:

```ts
    // Emits Set-Cookie for anything a resolver queued on context.setCookies.
    createCookiesPlugin(),
```

- [ ] **Step 4: CORS'u düzelt**

Dev tarafındaki `origin: '*'`, `credentials: true` ile birlikte **geçersiz**: tarayıcı `Access-Control-Allow-Origin: *` gördüğünde kimlik bilgisi taşıyan isteği reddeder. İki dal tek bir açık listeye iner:

```ts
  cors: {
    origin: config.app.isProduction
      ? [
          'https://killreport.com',
          'https://www.killreport.com',
          'https://api.killreport.com',
        ]
      : ['http://localhost:3000', config.eveSso.frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Accept',
      'x-session-id',
    ],
  },
```

`allowedHeaders` değişmiyor — çerez bir header izni gerektirmiyor.

- [ ] **Step 5: Tip kontrolü, testler, commit**

```bash
yarn workspace backend build
yarn workspace backend test
cd backend && npx prettier --check src/plugins/cookies.plugin.ts src/server.ts
git add backend/src/plugins/cookies.plugin.ts backend/src/server.ts
git commit -m "feat(server): read the session cookie into context and emit Set-Cookie"
```

---

### Task 6: GraphQL yüzeyi

**Files:**

- Modify: `backend/src/schemas/Auth.graphql`
- Modify: `backend/src/resolvers/auth/mutations.ts`
- Modify: `backend/src/resolvers/auth/queries.ts`
- Generated (elle düzenlenmez): `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`

**Interfaces:**

- Consumes: `createSession`, `resolveSession`, `revokeSessionById`, `revokeSessionByToken`, `listSessions` (Task 4); `serializeSessionCookie`, `clearSessionCookie` (Task 1); `loadUserCredentials(userId, client)` (Task 3).
- Produces: `refreshSession`, `logout`, `revokeSession(id)` mutation'ları ve `mySessions` sorgusu.

- [ ] **Step 1: Şemayı değiştir**

`backend/src/schemas/Auth.graphql`: `AuthPayload`'dan `refreshToken` alanı silinir, `refreshToken(refreshToken: String!)` ve `authenticateWithCode(...)` mutation'ları silinir, yerine:

```graphql
type Session {
  id: ID!
  createdAt: String!
  lastSeenAt: String!
  expiresAt: String!
  userAgent: String
  ip: String
  """
  Bu isteği taşıyan çerezin oturumu mu
  """
  current: Boolean!
}

extend type Query {
  """
  Kullanıcının açık oturumları
  """
  mySessions: [Session!]!
}

extend type Mutation {
  """
  Oturum çerezini kullanarak taze bir EVE access token alır
  """
  refreshSession: AuthPayload!

  """
  Bu oturumu kapatır ve çerezi siler
  """
  logout: Boolean!

  """
  Kullanıcının başka bir oturumunu kapatır
  """
  revokeSession(id: ID!): Boolean!
}
```

`login: AuthUrl!` ve `me: User` olduğu gibi kalır.

- [ ] **Step 2: Codegen**

```bash
yarn workspace backend codegen
```

- [ ] **Step 3: Mutation'ları yaz**

`backend/src/resolvers/auth/mutations.ts`: `authenticateWithCode` ve `refreshToken` resolver'ları tamamen silinir (ikisi de `AuthPayload` içinde token çifti dönen yerlerdi; `authenticateWithCode` ayrıca frontend'in hiç çağırmadığı ölü bir ikinci login yoluydu). `login` kalır. Eklenenler:

```ts
  refreshSession: async (_parent, _args, context: any) => {
    const session = await resolveSession(context.sessionToken);
    if (!session) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const credentials = await loadUserCredentials(session.userId, prisma);
    if (!credentials.ok) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // The value does not change; only its lifetime, so the browser's copy
    // slides in step with the row.
    context.setCookies.push(
      serializeSessionCookie(context.sessionToken, {
        secure: config.app.isProduction,
      }),
    );

    const { user, accessToken } = credentials;

    return {
      accessToken,
      expiresIn: Math.max(
        0,
        Math.floor((credentials.expiresAt.getTime() - Date.now()) / 1000),
      ),
      user: {
        id: user.character_id.toString(),
        name: user.character_name,
        email: '',
        createdAt: new Date().toISOString(),
      },
    };
  },

  logout: async (_parent, _args, context: any) => {
    if (context.sessionToken) {
      await revokeSessionByToken(context.sessionToken);
    }

    context.setCookies.push(
      clearSessionCookie({ secure: config.app.isProduction }),
    );

    return true;
  },

  revokeSession: async (_parent, { id }: { id: string }, context: any) => {
    const session = await resolveSession(context.sessionToken);
    if (!session) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    return revokeSessionById(id, session.userId);
  },
```

`expiresIn` hesabı `loadUserCredentials`'ın dönüşünde bir `expiresAt` olmasını gerektiriyor; bugün dönmüyor. `services/user-credentials.ts`'te `{ ok: true }` dalına `expiresAt: Date` eklenir (geçerli daldaki `expires_at`, yenilenen dalda hesaplanan yeni tarih) ve `user-credentials.spec.ts`'teki iki `toEqual` iddiası bu alanı içerecek şekilde güncellenir.

- [ ] **Step 4: `me` ve `mySessions`**

`backend/src/resolvers/auth/queries.ts`'e eklenir:

```ts
  mySessions: async (_parent, _args, context: any) => {
    const session = await resolveSession(context.sessionToken);
    if (!session) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const rows = await listSessions(session.userId);

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      userAgent: row.user_agent,
      ip: row.ip,
      current: row.id === session.id,
    }));
  },
```

- [ ] **Step 5: Tip kontrolü ve testler**

```bash
yarn workspace backend build
yarn workspace backend test
```

- [ ] **Step 6: Commit**

```bash
cd backend && npx prettier --check src/schemas/Auth.graphql src/resolvers/auth/mutations.ts src/resolvers/auth/queries.ts src/services/user-credentials.ts src/services/user-credentials.spec.ts
git add backend/src/schemas backend/src/resolvers/auth backend/src/generated-types.ts backend/src/generated-schema.graphql backend/src/services/user-credentials.ts backend/src/services/user-credentials.spec.ts
git commit -m "feat(auth): renew the session from a cookie instead of a refresh token"
```

---

### Task 7: Callback handler

**Files:**

- Modify: `backend/src/handlers/auth-callback.handler.ts` — `66-80`

**Interfaces:**

- Consumes: `createSession` (Task 4), `serializeSessionCookie` (Task 1).
- Produces: query string'siz bir yönlendirme.

- [ ] **Step 1: Oturumu yarat, çerezi yaz, çıplak yönlendir**

`params` bloğu ve `redirectUrl` satırı silinir; yerine:

```ts
// The redirect used to carry the token pair in its query string, which
// wrote a refresh token into whatever serves the frontend, its access log
// and the user's browser history. Nothing travels in the URL now: the
// browser leaves with a cookie and asks for an access token separately.
const forwarded = req.headers['x-forwarded-for'];
const ip = Array.isArray(forwarded)
  ? forwarded[0]
  : (forwarded?.split(',')[0].trim() ?? null);

const sessionToken = await createSession(user.id, {
  userAgent: req.headers['user-agent'] ?? null,
  ip,
});

res.writeHead(302, {
  'Set-Cookie': serializeSessionCookie(sessionToken, {
    secure: config.app.isProduction,
  }),
  Location: `${config.eveSso.frontendUrl}/auth/success`,
});
res.end();
```

- [ ] **Step 2: Tip kontrolü, biçim, commit**

```bash
yarn workspace backend build
cd backend && npx prettier --check src/handlers/auth-callback.handler.ts
git add backend/src/handlers/auth-callback.handler.ts
git commit -m "feat(auth): hand the browser a cookie, not a token in the URL"
```

---

### Task 8: Frontend

**Files:**

- Modify: `frontend/src/graphql/Auth.graphql`
- Modify: `frontend/src/app/auth/success/page.tsx` — `13-50`
- Modify: `frontend/src/lib/apolloClient.ts` — `27-79` (`refreshAccessToken`), `92` (`credentials`), `176-183` (çıkış temizliği)
- Modify: `frontend/src/hooks/useAuth.ts` — `16-90` (`refreshToken`), `180-183` (`logout`)
- Modify: `frontend/src/app/privacy/page.tsx` — `193-205`
- Generated (elle düzenlenmez): `frontend/src/generated/graphql.ts`

**Interfaces:**

- Consumes: `refreshSession`, `logout` (Task 6).
- Produces: `eve_refresh_token` anahtarının repodan tamamen kalkması.

- [ ] **Step 1: Dokümanları değiştir**

`frontend/src/graphql/Auth.graphql` tamamen yeniden yazılır:

```graphql
mutation RefreshSession {
  refreshSession {
    accessToken
    expiresIn
    user {
      id
      name
      email
      createdAt
    }
  }
}

mutation Logout {
  logout
}

query MySessions {
  mySessions {
    id
    createdAt
    lastSeenAt
    expiresAt
    userAgent
    ip
    current
  }
}

mutation RevokeSession($id: ID!) {
  revokeSession(id: $id)
}
```

- [ ] **Step 2: Codegen (backend önce)**

```bash
yarn workspace backend codegen && yarn workspace frontend codegen
```

- [ ] **Step 3: `auth/success` sayfasını çevir**

`useSearchParams` kullanımı ve URL'den okunan beş değer silinir. `useEffect` içinde `refreshSession` çağrılır (`fetch` ile, sayfanın Apollo bağlamına girmesini beklemeden) ve dönen `accessToken`, `expiresIn`, `user` bugünkü üç anahtara yazılır:

```tsx
const run = async () => {
  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
                mutation RefreshSession {
                  refreshSession {
                    accessToken
                    expiresIn
                    user { id name }
                  }
                }
              `,
        }),
      },
    );

    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);

    const data = result.data.refreshSession;
    localStorage.setItem('eve_access_token', data.accessToken);
    localStorage.setItem(
      'eve_token_expiry',
      (Date.now() + data.expiresIn * 1000).toString(),
    );
    localStorage.setItem(
      'eve_user',
      JSON.stringify({
        characterId: data.user.id,
        characterName: data.user.name,
      }),
    );

    window.dispatchEvent(new Event('auth-change'));
    setTimeout(() => router.push('/'), 500);
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Authentication failed');
    setIsLoading(false);
  }
};

run();
```

`credentials: 'include'` olmadan çerez gitmez ve sayfa her zaman hata verir — bu satır taşıyıcı.

- [ ] **Step 4: Apollo'yu çevir**

`lib/apolloClient.ts`:

- `refreshAccessToken` içindeki `localStorage.getItem('eve_refresh_token')` okuması ve erken dönüş silinir; sorgu argümansız `RefreshSession` olur; `fetch` çağrısına `credentials: 'include'` eklenir; `localStorage.setItem('eve_refresh_token', ...)` silinir.
- Satır 92'deki `credentials: 'same-origin'` → `credentials: 'include'`.
- Satır 176-183'teki temizlikten `localStorage.removeItem('eve_refresh_token');` silinir.

- [ ] **Step 5: `useAuth`'u çevir**

`hooks/useAuth.ts`: `refreshToken` callback'i aynı şekilde argümansız `RefreshSession`'a geçer (`credentials: 'include'` dahil), `eve_refresh_token` okuma ve yazmaları silinir. `logout` fonksiyonu önce `Logout` mutation'ını çağırır (aynı `fetch` biçimi, `credentials: 'include'`), sonra bugünkü `localStorage.removeItem` satırlarını çalıştırır — `eve_refresh_token` satırı hariç.

- [ ] **Step 6: Gizlilik sayfasını güncelle**

`app/privacy/page.tsx:193-205`: `eve_refresh_token` maddesi tamamen silinir. Kalan üç maddeye ek olarak oturum çerezi anlatılır — adı `kr_session`, `HttpOnly` olduğu için JavaScript'in okuyamadığı, oturumu yenilemeye yaradığı ve çıkışta silindiği. Bu sayfa kullanıcıya ne sakladığımızı anlatan yer; yanlış kalması kabul edilemez.

- [ ] **Step 7: Doğrula ve commit**

```bash
grep -rn "eve_refresh_token" frontend/src
yarn workspace frontend lint
yarn workspace frontend build
cd frontend && npx prettier --check src/graphql/Auth.graphql src/app/auth/success/page.tsx src/lib/apolloClient.ts src/hooks/useAuth.ts src/app/privacy/page.tsx
```

İlk `grep` **boş dönmeli**.

```bash
git add frontend/src frontend/src/generated/graphql.ts
git commit -m "feat(frontend): renew the session from the cookie, drop the stored refresh token"
```

---

### Task 9: Dokümantasyon ve tam doğrulama

**Files:**

- Modify: `backend/docs/authentication/eve-sso-readme.md`
- Modify: `docs/superpowers/specs/2026-09-21-queue-messages-drop-credentials-design.md` — rotasyon cümlesi

**Interfaces:**

- Consumes: Task 1-8.
- Produces: birleşmeye hazır dal.

- [ ] **Step 1: Auth dokümanını güncelle**

`backend/docs/authentication/eve-sso-readme.md` içinde akışı anlatan bölüm yeni hâle getirilir: EVE SSO → `/auth/callback` → `sessions` satırı + `kr_session` çerezi → query string'siz `/auth/success` → `refreshSession` → `localStorage`'da access token. Çerez özniteliklerinin neden `SameSite=Lax` olduğu ve `None` gerekmediği bir cümleyle yazılır. Bearer akışının değişmediği ayrıca belirtilir.

- [ ] **Step 2: Önceki spec'teki olgu hatasını düzelt**

`docs/superpowers/specs/2026-09-21-queue-messages-drop-credentials-design.md`, 1. bölümün "c" maddesi "EVE SSO refresh token'ı döndürüyor" diyor. Resmî doküman rotasyonun **henüz açılmadığını**, ileride native uygulamalar için geleceğini söylüyor. Cümle, bunun bugünkü bir arıza değil, rotasyon açıldığında ortaya çıkacak bir kırılmanın önceden kapatılması olduğunu söyleyecek şekilde düzeltilir. CLAUDE.md'nin `**Correction:**` biçimi bu iş için uygun.

- [ ] **Step 3: Tam doğrulama seti**

```bash
cd /Users/umut/Sites/killreport
yarn test
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build
git diff --name-only main...HEAD | xargs npx prettier --check
```

Beşi de temiz olmadan PR açılmaz. `lint` repo genelinde önceden var olan sorunları raporluyor — sayıyı `main` ile karşılaştır ve hiçbirinin bu dalın dokunduğu bir dosyayı adlandırmadığını doğrula.

> Not: `npx prettier --check .` repo genelinde başarısız olabilir; sebebi `.claude/worktrees/` altındaki takip edilmeyen yerel worktree'dir, bu dalla ilgisi yoktur. Yukarıdaki komut yalnızca dalın dosyalarına bakar.

- [ ] **Step 4: Elle duman testi**

Bu adım kullanıcıya bırakılır, sen çalıştırmazsın. Rapora şu listeyi yaz: giriş yap → URL'de query string olmadığını gör → sayfayı yenile, oturumun durduğunu gör → `mySessions`'ın bir satır döndüğünü doğrula → çıkış yap → çerezin silindiğini gör.

- [ ] **Step 5: Commit**

```bash
git add backend/docs/authentication/eve-sso-readme.md docs/superpowers/specs/2026-09-21-queue-messages-drop-credentials-design.md
git commit -m "docs(auth): describe the cookie session and correct the rotation claim"
```

---

## Self-Review

**Spec kapsamı.** Spec §2 (sınır) → Task 5 ve 6, Bearer yolu hiçbir taskta değişmiyor. §3 (çerez) → Task 1. §4 (tablo, migration, ömür) → Task 2 ve Task 1'in `SESSION_TTL_MS`'i. §5 (GraphQL yüzeyi, `loadUserCredentials`'ın istemci alması) → Task 3 ve 6. §6 (çerez okuma/yazma) → Task 5. §7 (callback) → Task 7. §8 (frontend) → Task 8. §9 (CORS) → Task 5 Step 4. §10 (test) → Task 1, 4 ve 6'nın test adımları. §11 (geçiş) → Task 8 Step 3'teki eski parametreleri görmezden gelme davranışı. §12 (kapsam dışı) → cihaz listesi ekranı hiçbir taskta yok, bilerek. §13'ün yedi kabul kriteri sırasıyla Task 8 Step 7, Task 7, Task 6 Step 1-2, Task 1 Step 1, Task 2 Step 4 ve 6, Task 4'ün `revokeSessionById` testi, ve Task 9 Step 3 ile karşılanıyor.

**Tip tutarlılığı.** `serializeSessionCookie(value, { secure })` Task 1'de tanımlı, Task 6 ve 7'de aynı imzayla çağrılıyor. `resolveSession` Task 4'te `{ id, userId } | null` dönüyor; Task 6'daki üç çağrının üçü de bu şekli açıyor. `loadUserCredentials(userId, client)` Task 3'te tanımlanıyor, Task 6'da `prisma` ile çağrılıyor, iki worker'da `prismaWorker` ile. `SESSION_COOKIE_NAME` Task 1'de tanımlı, Task 5'te okunuyor.

**Bir bağımlılık zinciri, sırası bozulamaz.** Task 2 (tablo) Task 4'ten (depo) önce gelmek zorunda, yoksa `prisma.session` tipi yoktur. Task 3 (istemci parametresi) Task 6'dan önce gelmeli. Task 6 (backend codegen) Task 8'den (frontend codegen) önce.

**Bilinçli bir boşluk.** `refreshSession`, `logout`, `revokeSession` ve `mySessions` resolver'larının kendi testi yok; tutan şey Task 4'ün depo testleri, tip kontrolü ve Task 9 Step 4'teki elle duman testi. Bu repoda resolver spec'i yok — mevcut düzen bu — ama `revokeSession`'ın sahiplik kontrolü gibi bir davranışın yalnızca depo seviyesinde test edilmesi gerçek bir sınır ve burada yazılı duruyor.
