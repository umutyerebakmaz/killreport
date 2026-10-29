import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pkg from '../../package.json';
import { createEsiClient, setEsiMaxWait } from './esi-client';
import { EsiThrottledError, esiRateLimiter } from './rate-limiter';

// rate-limiter builds its singleton from config at import time, and the real
// config exits the process when EVE_CLIENT_ID is unset, as it is in CI.
vi.mock('@config/config', () => ({
  config: { esi: { maxRequestsPerSecond: 50, prefetch: 25 } },
}));

type Reply = {
  status: number;
  headers?: Record<string, string>;
  data?: unknown;
};

/** Test adapter: records every request and answers with `reply` (or a network error). */
function makeAdapter(reply: Reply | 'network-error') {
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter = async (cfg: InternalAxiosRequestConfig) => {
    requests.push(cfg);
    if (reply === 'network-error') {
      throw new AxiosError('socket hang up', 'ECONNRESET', cfg, {
        _header: `GET / HTTP/1.1\r\nAuthorization: ${cfg.headers.get('Authorization')}\r\n`,
      });
    }
    const response = {
      status: reply.status,
      statusText: '',
      headers: reply.headers ?? {},
      data: reply.data ?? {},
      config: cfg,
      request: {
        _header: `Authorization: ${cfg.headers.get('Authorization')}`,
      },
    };
    if (reply.status >= 200 && reply.status < 300) return response;
    throw new AxiosError(
      `status ${reply.status}`,
      AxiosError.ERR_BAD_RESPONSE,
      cfg,
      response.request,
      response,
    );
  };
  return { adapter, requests };
}

describe('esiClient', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    vi.spyOn(esiRateLimiter, 'acquire').mockImplementation(async () => {
      calls.push('acquire');
    });
    vi.spyOn(esiRateLimiter, 'observe').mockImplementation(() => {
      calls.push('observe');
    });
    vi.spyOn(esiRateLimiter, 'release').mockImplementation(() => {
      calls.push('release');
    });
    setEsiMaxWait(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends User-Agent with the package version and the repo URL', async () => {
    const { adapter, requests } = makeAdapter({ status: 200 });
    await createEsiClient(adapter).get('/universe/types/34/');
    expect(requests[0].headers.get('User-Agent')).toBe(
      `KillReport/${pkg.version} (+https://github.com/umutyerebakmaz/killreport)`,
    );
  });

  it('sends X-Compatibility-Date 2020-01-01', async () => {
    const { adapter, requests } = makeAdapter({ status: 200 });
    await createEsiClient(adapter).get('/universe/types/34/');
    expect(requests[0].headers.get('X-Compatibility-Date')).toBe('2020-01-01');
  });

  it('prefixes https://esi.evetech.net', async () => {
    const { adapter, requests } = makeAdapter({ status: 200 });
    await createEsiClient(adapter).get('/universe/types/34/', {
      params: { page: 2 },
    });
    expect(requests[0].baseURL).toBe('https://esi.evetech.net');
    expect(requests[0].url).toBe('/universe/types/34/');
    expect(requests[0].params).toEqual({ page: 2 });
  });

  it('forwards caller headers', async () => {
    const { adapter, requests } = makeAdapter({ status: 200 });
    await createEsiClient(adapter).get('/characters/1/', {
      headers: { Authorization: 'Bearer abc' },
    });
    expect(requests[0].headers.get('Authorization')).toBe('Bearer abc');
  });

  it('acquires before sending and releases after a 2xx', async () => {
    const { adapter } = makeAdapter({ status: 200 });
    const send = vi.fn(adapter);
    const res = await createEsiClient(async (cfg) => {
      calls.push('send');
      return send(cfg);
    }).get('/universe/types/34/');
    expect(res.status).toBe(200);
    expect(calls).toEqual(['acquire', 'send', 'observe', 'release']);
  });

  it('releases after a network error and after a 500', async () => {
    const net = makeAdapter('network-error');
    await expect(
      createEsiClient(net.adapter).get('/universe/types/34/'),
    ).rejects.toThrow('socket hang up');
    // no response, so nothing to observe
    expect(calls).toEqual(['acquire', 'release']);

    calls.length = 0;
    const err500 = makeAdapter({ status: 500 });
    await expect(
      createEsiClient(err500.adapter).get('/universe/types/34/'),
    ).rejects.toMatchObject({ response: { status: 500 } });
    expect(calls).toEqual(['acquire', 'observe', 'release']);
  });

  it('sets a 30 s request timeout on the instance', async () => {
    const { adapter, requests } = makeAdapter({ status: 200 });
    await createEsiClient(adapter).get('/universe/types/34/');
    expect(requests[0].timeout).toBe(30_000);
  });

  it('releases once and rethrows an axios error when a request times out', async () => {
    const timedOut = async (cfg: InternalAxiosRequestConfig) => {
      throw new AxiosError(
        'timeout of 30000ms exceeded',
        AxiosError.ECONNABORTED,
        cfg,
      );
    };
    const err = await createEsiClient(timedOut)
      .get('/universe/types/34/')
      .catch((e) => e);
    expect(err).toBeInstanceOf(AxiosError);
    expect(err).not.toBeInstanceOf(EsiThrottledError);
    expect(err.code).toBe('ECONNABORTED');
    expect(calls).toEqual(['acquire', 'release']);
  });

  it('does not release when acquire itself rejects', async () => {
    vi.spyOn(esiRateLimiter, 'acquire').mockRejectedValue(new Error('maxWait'));
    const { adapter, requests } = makeAdapter({ status: 200 });
    await expect(
      createEsiClient(adapter).get('/universe/types/34/'),
    ).rejects.toThrow('maxWait');
    expect(requests).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it('reports status and lower-case headers to the limiter on success and on error', async () => {
    const ok = makeAdapter({
      status: 200,
      headers: {
        'X-Ratelimit-Group': 'killmail',
        'X-ESI-Error-Limit-Remain': '99',
      },
    });
    await createEsiClient(ok.adapter).get('/killmails/1/abc/');
    expect(esiRateLimiter.observe).toHaveBeenLastCalledWith(
      { path: '/killmails/1/abc/', bucketKey: undefined },
      200,
      expect.objectContaining({
        'x-ratelimit-group': 'killmail',
        'x-esi-error-limit-remain': '99',
      }),
    );

    const bad = makeAdapter({ status: 500, headers: { 'Retry-After': '7' } });
    await expect(
      createEsiClient(bad.adapter).get('/killmails/1/abc/'),
    ).rejects.toBeTruthy();
    expect(esiRateLimiter.observe).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/killmails/1/abc/' }),
      500,
      expect.objectContaining({ 'retry-after': '7' }),
    );
    expect(esiRateLimiter.observe).toHaveBeenCalledTimes(2);
  });

  it('turns a 429 with a group header into a rate-limit EsiThrottledError', async () => {
    const { adapter } = makeAdapter({
      status: 429,
      headers: { 'x-ratelimit-group': 'killmail' },
    });
    const err = await createEsiClient(adapter)
      .get('/killmails/1/abc/')
      .catch((e) => e);
    expect(err).toBeInstanceOf(EsiThrottledError);
    expect(err.status).toBe(429);
    expect(err.kind).toBe('rate-limit');
    expect(err.cause).toBeInstanceOf(AxiosError);
    expect(calls).toEqual(['acquire', 'observe', 'release']);
  });

  it('turns a 429 without a group header into a deep-limit EsiThrottledError', async () => {
    const { adapter } = makeAdapter({ status: 429 });
    const err = await createEsiClient(adapter)
      .get('/universe/types/34/')
      .catch((e) => e);
    expect(err).toBeInstanceOf(EsiThrottledError);
    expect(err.status).toBe(429);
    expect(err.kind).toBe('deep-limit');
  });

  it('turns a 420 into EsiThrottledError with status 420', async () => {
    const { adapter } = makeAdapter({ status: 420 });
    const err = await createEsiClient(adapter)
      .get('/universe/types/34/')
      .catch((e) => e);
    expect(err).toBeInstanceOf(EsiThrottledError);
    expect(err.status).toBe(420);
    expect(err.kind).toBe('error-limit');
  });

  it('leaves a 404 as an axios error with response.status 404', async () => {
    const { adapter } = makeAdapter({ status: 404 });
    const err = await createEsiClient(adapter)
      .get('/universe/types/0/')
      .catch((e) => e);
    expect(err).toBeInstanceOf(AxiosError);
    expect(err).not.toBeInstanceOf(EsiThrottledError);
    expect(err.response.status).toBe(404);
  });

  it('passes bucketKey and the process maxWait to acquire', async () => {
    const { adapter } = makeAdapter({ status: 200 });
    const client = createEsiClient(adapter);

    setEsiMaxWait(10_000);
    await client.get('/characters/9/', { bucketKey: '9' });
    expect(esiRateLimiter.acquire).toHaveBeenLastCalledWith(
      { path: '/characters/9/', bucketKey: '9' },
      { maxWaitMs: 10_000 },
    );

    setEsiMaxWait(undefined);
    await client.get('/characters/9/');
    expect(esiRateLimiter.acquire).toHaveBeenLastCalledWith(
      { path: '/characters/9/', bucketKey: undefined },
      {},
    );
  });

  describe('bearer token', () => {
    const headers = { Authorization: 'Bearer secret' };
    const leaks = (e: unknown) =>
      JSON.stringify(e).includes('secret') ||
      inspect(e, { depth: 8 }).includes('secret');

    it.each([500, 404])('is redacted from a %i error', async (status) => {
      const { adapter } = makeAdapter({ status });
      const err = await createEsiClient(adapter)
        .get('/characters/1/', { headers })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AxiosError);
      expect(err.response.status).toBe(status);
      expect(err.config.headers.Authorization).not.toBe('Bearer secret');
      expect(leaks(err)).toBe(false);
    });

    it('is redacted from the cause of an EsiThrottledError', async () => {
      const { adapter } = makeAdapter({ status: 429 });
      const err = await createEsiClient(adapter)
        .get('/characters/1/', { headers })
        .catch((e) => e);
      expect(err).toBeInstanceOf(EsiThrottledError);
      expect(err.cause.response.status).toBe(429);
      expect(leaks(err)).toBe(false);
    });

    it('is redacted from a network error', async () => {
      const { adapter } = makeAdapter('network-error');
      const err = await createEsiClient(adapter)
        .get('/characters/1/', { headers })
        .catch((e) => e);
      expect(err.code).toBe('ECONNRESET');
      expect(leaks(err)).toBe(false);
    });
  });
});
