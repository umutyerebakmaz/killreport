import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `killmails` and its denormalized copy in `killmail_filters` are written
 * in one transaction, so a crash between them cannot leave the copy stale.
 */

const { prisma, tx } = vi.hoisted(() => {
  const tx = { killmail: { update: vi.fn() }, $executeRaw: vi.fn() };
  return { tx, prisma: { $transaction: vi.fn(), $disconnect: vi.fn() } };
});

vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/rabbitmq', () => ({}));

import { saveValues } from './worker-backfill-values';

const VALUES = {
  totalValue: 501500,
  destroyedValue: 501000,
  droppedValue: 500,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn) => fn(tx));
});

describe('saveValues', () => {
  it('writes both tables inside one transaction', async () => {
    await saveValues(133900250, VALUES);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.killmail.update).toHaveBeenCalledWith({
      where: { killmail_id: 133900250 },
      data: {
        total_value: 501500,
        destroyed_value: 501000,
        dropped_value: 500,
      },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [sql, ...params] = tx.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('UPDATE killmail_filters');
    expect(params).toEqual([501500, 133900250]);
  });

  it('fails when the filters update fails', async () => {
    tx.$executeRaw.mockRejectedValueOnce(new Error('boom'));

    await expect(saveValues(133900250, VALUES)).rejects.toThrow('boom');
  });
});
