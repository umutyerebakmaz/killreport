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
