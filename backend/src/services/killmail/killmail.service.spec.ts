import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/esi-client', () => ({ esiClient: { get: vi.fn() } }));

import { esiClient } from '@services/esi-client';
import { KillmailService } from './killmail.service';

const get = vi.mocked(esiClient.get);

describe('KillmailService.getKillmailDetail', () => {
  beforeEach(() => get.mockReset());

  it('returns the response data', async () => {
    get.mockResolvedValueOnce({ data: { killmail_id: 9 } } as never);
    await expect(KillmailService.getKillmailDetail(9, 'abc')).resolves.toEqual({
      killmail_id: 9,
    });
    expect(get).toHaveBeenCalledWith('/killmails/9/abc/');
  });

  it('rejects with the axios error on a 404', async () => {
    const error = new AxiosError('nope', '404', undefined, undefined, {
      status: 404,
    } as never);
    get.mockRejectedValueOnce(error);
    await expect(KillmailService.getKillmailDetail(9, 'abc')).rejects.toBe(
      error,
    );
  });
});
