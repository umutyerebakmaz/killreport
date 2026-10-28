import { EsiThrottledError } from '@services/rate-limiter';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/esi-client', () => ({ esiClient: { get: vi.fn() } }));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { esiClient } from '@services/esi-client';
import { CharacterService } from './character.service';

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

describe('CharacterService.getCharacterKillmails', () => {
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
    const result = await CharacterService.getCharacterKillmails(777, 'tok');
    expect(result).toHaveLength(50);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('passes the character id as bucketKey', async () => {
    get.mockResolvedValueOnce({ data: page(1) } as never);
    await CharacterService.getCharacterKillmails(777, 'tok');
    expect(get).toHaveBeenCalledWith(
      '/characters/777/killmails/recent/',
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
      CharacterService.getCharacterKillmails(777, 'tok'),
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
      CharacterService.getCharacterKillmails(777, 'tok'),
    ).resolves.toHaveLength(103);
    expect(vi.getTimerCount()).toBe(0);
  });
});
