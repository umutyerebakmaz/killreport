import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, multiMock, execMock } = vi.hoisted(() => {
  const execMock = vi.fn();
  const multiMock = { get: vi.fn(), del: vi.fn(), exec: execMock };
  multiMock.get.mockReturnValue(multiMock);
  multiMock.del.mockReturnValue(multiMock);
  return {
    execMock,
    multiMock,
    redisMock: {
      setex: vi.fn(),
      multi: vi.fn(() => multiMock),
    },
  };
});

/** What `multi().get(k).del(k).exec()` resolves to for a key holding `value`. */
const execResult = (value: string | null) => [
  [null, value],
  [null, value === null ? 0 : 1],
];

vi.mock('@services/redis', () => ({ default: redisMock, redis: redisMock }));

import {
  AUTH_STATE_TTL_SECONDS,
  consumeAuthState,
  createAuthState,
  sanitizeReturnTo,
} from './auth-state-store';

beforeEach(() => {
  vi.clearAllMocks();
  multiMock.get.mockReturnValue(multiMock);
  multiMock.del.mockReturnValue(multiMock);
});

describe('sanitizeReturnTo', () => {
  it('keeps a relative path, query string and all', () => {
    expect(sanitizeReturnTo('/killmails?page=2&sort=value')).toBe(
      '/killmails?page=2&sort=value',
    );
  });

  it('keeps the root', () => {
    expect(sanitizeReturnTo('/')).toBe('/');
  });

  it('falls back to the root when nothing was asked for', () => {
    expect(sanitizeReturnTo(undefined)).toBe('/');
    expect(sanitizeReturnTo(null)).toBe('/');
    expect(sanitizeReturnTo('')).toBe('/');
  });

  // Everything below is the open-redirect surface. A browser sent to any of
  // these leaves the site while still looking like it came back from EVE.
  it.each([
    ['a protocol-relative host', '//evil.example'],
    ['a backslash the parser may read as a slash', '/\\evil.example'],
    ['an absolute URL', 'https://evil.example/pwn'],
    ['a scheme with no host', 'javascript:alert(1)'],
    ['a bare path with no leading slash', 'evil.example'],
  ])('rejects %s', (_label, input) => {
    expect(sanitizeReturnTo(input)).toBe('/');
  });

  it('rejects a path carrying a control character', () => {
    expect(sanitizeReturnTo('/killmails\nSet-Cookie: x=1')).toBe('/');
  });

  it('rejects an over-long path rather than storing it', () => {
    expect(sanitizeReturnTo('/' + 'a'.repeat(512))).toBe('/');
  });

  // The auth routes are machinery, not destinations: landing back on one
  // restarts the dance with a state that has already been consumed.
  it('rejects the auth routes themselves', () => {
    expect(sanitizeReturnTo('/auth/callback')).toBe('/');
    expect(sanitizeReturnTo('/auth/success')).toBe('/');
  });
});

describe('createAuthState', () => {
  it('returns an unguessable state and stores the path under it', async () => {
    const state = await createAuthState('/killmails?page=2');

    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(redisMock.setex).toHaveBeenCalledWith(
      `auth:state:${state}`,
      AUTH_STATE_TTL_SECONDS,
      '/killmails?page=2',
    );
  });

  it('is different every time', async () => {
    const a = await createAuthState('/');
    const b = await createAuthState('/');

    expect(a).not.toBe(b);
  });
});

describe('consumeAuthState', () => {
  it('returns the stored path and takes the key with it', async () => {
    execMock.mockResolvedValue(execResult('/killmails'));

    await expect(consumeAuthState('abc')).resolves.toBe('/killmails');
    expect(multiMock.get).toHaveBeenCalledWith('auth:state:abc');
    expect(multiMock.del).toHaveBeenCalledWith('auth:state:abc');
  });

  it('returns null for a state that was never issued', async () => {
    execMock.mockResolvedValue(execResult(null));

    await expect(consumeAuthState('abc')).resolves.toBeNull();
  });

  // The GET and the DEL travel in one MULTI, which is what makes the state
  // single-use: the second callback carrying the same state finds nothing, so
  // a replayed URL cannot mint a session.
  it('returns null the second time the same state arrives', async () => {
    execMock
      .mockResolvedValueOnce(execResult('/killmails'))
      .mockResolvedValue(execResult(null));

    await expect(consumeAuthState('abc')).resolves.toBe('/killmails');
    await expect(consumeAuthState('abc')).resolves.toBeNull();
  });

  it('rejects a missing state without asking Redis', async () => {
    await expect(consumeAuthState('')).resolves.toBeNull();
    expect(redisMock.multi).not.toHaveBeenCalled();
  });

  // A path that was somehow written past the sanitiser must not be trusted on
  // the way out either - the value leaves this process as a Location header.
  it('re-checks the stored path on the way out', async () => {
    execMock.mockResolvedValue(execResult('//evil.example'));

    await expect(consumeAuthState('abc')).resolves.toBe('/');
  });

  // A MULTI can come back with a per-command error, or null if it was
  // discarded, and neither is a usable return path.
  it('returns null when the transaction reports an error', async () => {
    execMock.mockResolvedValue([
      [new Error('READONLY'), null],
      [null, 0],
    ]);

    await expect(consumeAuthState('abc')).resolves.toBeNull();
  });

  it('returns null when the transaction was discarded', async () => {
    execMock.mockResolvedValue(null);

    await expect(consumeAuthState('abc')).resolves.toBeNull();
  });

  // Redis being unreachable is a refused login, never a thrown error: the
  // caller is an HTTP handler, and its rejection would end the process.
  it('returns null instead of throwing when Redis is unreachable', async () => {
    execMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(consumeAuthState('abc')).resolves.toBeNull();
  });
});
