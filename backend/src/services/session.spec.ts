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
