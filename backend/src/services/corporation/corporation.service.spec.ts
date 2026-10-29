import { EsiThrottledError } from '@services/rate-limiter';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// rate-limiter builds its singleton from config at import time, and the real
// config exits the process when EVE_CLIENT_ID is unset, as it is in CI.
vi.mock('@config/config', () => ({
  config: { esi: { maxRequestsPerSecond: 50, prefetch: 25 } },
}));
vi.mock('@services/esi-client', () => ({ esiClient: { get: vi.fn() } }));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { esiClient } from '@services/esi-client';
import { CorporationService } from './corporation.service';

const get = vi.mocked(esiClient.get);

const page = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    killmail_id: i + 1,
    killmail_hash: 'h' + i,
  }));

function httpError(status: number) {
  return new AxiosError('failed', String(status), undefined, undefined, {
    status,
  } as never);
}

describe('CorporationService.getCorporationKillmails', () => {
  beforeEach(() => {
    get.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stops paging on a 404 and returns what it has', async () => {
    get
      .mockResolvedValueOnce({ data: page(50) } as never)
      .mockRejectedValueOnce(httpError(404));
    const result = await CorporationService.getCorporationKillmails(
      123,
      'tok',
      777,
    );
    expect(result).toHaveLength(50);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('passes the character id as bucketKey', async () => {
    get.mockResolvedValueOnce({ data: page(1) } as never);
    await CorporationService.getCorporationKillmails(123, 'tok', 777);
    expect(get).toHaveBeenCalledWith(
      '/corporations/123/killmails/recent/',
      expect.objectContaining({
        bucketKey: '777',
        params: { page: 1 },
        headers: { Authorization: 'Bearer tok' },
      }),
    );
  });

  it('lets an EsiThrottledError through instead of retrying', async () => {
    get.mockRejectedValue(
      new EsiThrottledError(429, 'rate-limit', 'throttled'),
    );
    await expect(
      CorporationService.getCorporationKillmails(123, 'tok', 777),
    ).rejects.toBeInstanceOf(EsiThrottledError);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not sleep between pages', async () => {
    vi.useFakeTimers();
    get
      .mockResolvedValueOnce({ data: page(50) } as never)
      .mockResolvedValueOnce({ data: page(50) } as never)
      .mockResolvedValueOnce({ data: page(3) } as never);
    // resolves without advancing the fake clock
    await expect(
      CorporationService.getCorporationKillmails(123, 'tok', 777),
    ).resolves.toHaveLength(103);
    expect(vi.getTimerCount()).toBe(0);
  });
});
