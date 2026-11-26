import { describe, expect, it } from 'vitest';
import { isSessionGone } from './authErrors';

describe('isSessionGone', () => {
  it('is true when the server says the session is not authenticated', () => {
    expect(
      isSessionGone([
        {
          message: 'Not authenticated',
          extensions: { code: 'UNAUTHENTICATED' },
        },
      ]),
    ).toBe(true);
  });

  it('is false while EVE SSO is down: the session is still good', () => {
    expect(
      isSessionGone([
        {
          message: 'EVE SSO is unavailable, try again shortly',
          extensions: { code: 'SERVICE_UNAVAILABLE' },
        },
      ]),
    ).toBe(false);
  });

  it('is false for an error without a code', () => {
    expect(isSessionGone([{ message: 'Unexpected error.' }])).toBe(false);
    expect(isSessionGone([])).toBe(false);
  });
});
