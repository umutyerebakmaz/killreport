import { describe, expect, it, vi } from 'vitest';
import type { KillmailPage, KillmailRef } from './killmail-refs';
import { MAX_PAGES, walkKillmails } from './killmail-walk';

const refs = (n: number, from = 1): KillmailRef[] =>
  Array.from({ length: n }, (_, i) => ({
    killmail_id: from + i,
    killmail_hash: `h${from + i}`,
  }));

const page = (r: KillmailRef[], pages: number | null = null): KillmailPage => ({
  refs: r,
  pages,
});

describe('walkKillmails', () => {
  it('stops_on_a_fully_known_page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(refs(3)))
      .mockResolvedValueOnce(page(refs(3, 4)))
      .mockResolvedValueOnce(page(refs(3, 7)));
    const record = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    expect(await walkKillmails(fetch, record, false)).toEqual({
      pages: 2,
      found: 6,
      inserted: 2,
      capped: false,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('full_sync_ignores_known_pages', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(refs(3)))
      .mockResolvedValueOnce(page(refs(3, 4)))
      .mockResolvedValueOnce(null);
    const record = vi.fn().mockResolvedValue(0);

    expect(await walkKillmails(fetch, record, true)).toMatchObject({
      pages: 2,
      found: 6,
      inserted: 0,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('stops_at_x_pages', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(refs(2), 2))
      .mockResolvedValueOnce(page(refs(2, 3), 2));
    const record = vi.fn().mockResolvedValue(2);

    expect(await walkKillmails(fetch, record, false)).toMatchObject({
      pages: 2,
      capped: false,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops_on_404_and_empty', async () => {
    const record = vi.fn().mockResolvedValue(1);

    const notFound = vi.fn().mockResolvedValueOnce(null);
    expect(await walkKillmails(notFound, record, false)).toEqual({
      pages: 0,
      found: 0,
      inserted: 0,
      capped: false,
    });

    const empty = vi.fn().mockResolvedValueOnce(page([]));
    expect((await walkKillmails(empty, record, true)).pages).toBe(0);
    expect(record).not.toHaveBeenCalled();
  });

  it('caps_at_14_pages', async () => {
    const fetch = vi.fn(async (n: number) => page(refs(1, n)));
    const record = vi.fn().mockResolvedValue(1);

    expect(MAX_PAGES).toBe(14);
    expect(await walkKillmails(fetch, record, false)).toMatchObject({
      pages: 14,
      capped: true,
    });
    expect(fetch).toHaveBeenCalledTimes(14);
  });

  it('failure_mid_walk_keeps_refs_and_no_stamp', async () => {
    // The pages before the failure are already recorded; the error reaches
    // the worker, which then writes no stamp.
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(refs(1, 1)))
      .mockResolvedValueOnce(page(refs(1, 2)))
      .mockRejectedValueOnce(new Error('ESI 502'));
    const record = vi.fn().mockResolvedValue(1);

    await expect(walkKillmails(fetch, record, false)).rejects.toThrow(
      'ESI 502',
    );
    expect(record).toHaveBeenCalledTimes(2);
  });
});
