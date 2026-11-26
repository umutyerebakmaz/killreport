import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * One statement per page: insert what is new, report how many were. The
 * caller stops walking on a page that adds nothing.
 */

const { prisma } = vi.hoisted(() => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('@services/prisma-worker', () => ({ default: prisma }));

import { recordRefs } from './killmail-refs';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordRefs', () => {
  it('inserts the page and counts the new rows', async () => {
    prisma.$queryRaw.mockResolvedValue([{ killmail_id: 2 }]);

    const inserted = await recordRefs(
      [
        { killmail_id: 1, killmail_hash: 'a' },
        { killmail_id: 2, killmail_hash: 'b' },
      ],
      'corporation',
      new Date('2026-11-26T10:00:00.000Z'),
    );

    expect(inserted).toBe(1);
    const [sql, source, now, ids, hashes] = prisma.$queryRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/ON CONFLICT \(killmail_id\) DO NOTHING/);
    expect(sql.join('?')).toMatch(/RETURNING killmail_id/);
    expect(ids).toEqual([1, 2]);
    expect(hashes).toEqual(['a', 'b']);
    expect(source).toBe('corporation');
    expect(now).toBe('2026-11-26 10:00:00.000');
  });

  it('does not query for an empty page', async () => {
    expect(await recordRefs([], 'character', new Date())).toBe(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
