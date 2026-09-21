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
    expect(header).toContain('SameSite=Lax');
  });
});
