import { EsiThrottledError } from '@services/rate-limiter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/esi-client', () => ({ esiClient: { get: vi.fn() } }));

import { esiClient } from '@services/esi-client';
import { TypeService } from './type.service';

const get = vi.mocked(esiClient.get);

describe('TypeService.getTypeIds', () => {
  beforeEach(() => {
    get.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('collects the types of every group', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/latest/universe/groups/') return { data: [1, 2] } as never;
      if (path === '/latest/universe/groups/1/')
        return { data: { types: [10, 11] } } as never;
      return { data: { types: [20] } } as never;
    });
    await expect(TypeService.getTypeIds()).resolves.toEqual([10, 11, 20]);
  });

  it('rejects instead of returning a short list when ESI throttles a group', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/latest/universe/groups/') return { data: [1, 2] } as never;
      if (path === '/latest/universe/groups/1/')
        return { data: { types: [10] } } as never;
      throw new EsiThrottledError(429, 'rate-limit', 'throttled');
    });
    await expect(TypeService.getTypeIds()).rejects.toBeInstanceOf(
      EsiThrottledError,
    );
  });

  it('logs and carries on when a group fails with a plain 500', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/latest/universe/groups/') return { data: [1, 2] } as never;
      if (path === '/latest/universe/groups/1/')
        throw Object.assign(new Error('boom'), { response: { status: 500 } });
      return { data: { types: [20] } } as never;
    });
    await expect(TypeService.getTypeIds()).resolves.toEqual([20]);
  });
});
