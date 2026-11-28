import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The R2Z2 stream's durable position and its 404 rule, kept identical to the
 * Rust worker's (`backend-rs/workers/worker-redisq/src/stream.rs`) so either
 * worker can pick up where the other stopped. See
 * docs/superpowers/specs/2026-11-28-rust-redisq-design.md, §1–§2.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn(), $executeRaw: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prisma }));

import {
  emptyGap,
  loadCursor,
  onFound,
  onNotFound,
  saveCursor,
  type Gap,
  type Step,
} from './stream-cursor';

beforeEach(() => vi.clearAllMocks());

function skipOnce(gap: Gap, current: number, head: number): Step {
  onNotFound(gap, current, head);
  onNotFound(gap, current, head);
  return onNotFound(gap, current, head);
}

describe('onNotFound', () => {
  it('waits while the head is not ahead', () => {
    const gap = emptyGap();
    for (let i = 0; i < 5; i++) {
      expect(onNotFound(gap, 100, 99)).toEqual({ kind: 'wait' });
      expect(onNotFound(gap, 100, 100)).toEqual({ kind: 'wait' });
    }
  });

  it('waits twice, then skips when the head is ahead', () => {
    const gap = emptyGap();
    expect(onNotFound(gap, 100, 105)).toEqual({ kind: 'wait' });
    expect(onNotFound(gap, 100, 105)).toEqual({ kind: 'wait' });
    expect(onNotFound(gap, 100, 105)).toEqual({ kind: 'skip', next: 101 });
    expect(onNotFound(gap, 101, 105)).toEqual({ kind: 'wait' });
  });

  it('resets the tries when the head falls back', () => {
    const gap = emptyGap();
    onNotFound(gap, 100, 105);
    onNotFound(gap, 100, 105);
    expect(onNotFound(gap, 100, 100)).toEqual({ kind: 'wait' });
    expect(onNotFound(gap, 100, 105)).toEqual({ kind: 'wait' });
    expect(onNotFound(gap, 100, 105)).toEqual({ kind: 'wait' });
    expect(onNotFound(gap, 100, 105)).toEqual({ kind: 'skip', next: 101 });
  });

  it('jumps to the head after ten skips in a row', () => {
    const gap = emptyGap();
    for (let n = 0; n < 9; n++) {
      expect(skipOnce(gap, 100 + n, 5000)).toEqual({
        kind: 'skip',
        next: 101 + n,
      });
    }
    expect(skipOnce(gap, 109, 5000)).toEqual({ kind: 'jump', next: 5000 });
    expect(skipOnce(gap, 5000, 6000)).toEqual({ kind: 'skip', next: 5001 });
  });

  it('starts the skip count again after a found killmail', () => {
    const gap = emptyGap();
    for (let n = 0; n < 9; n++) skipOnce(gap, 100 + n, 5000);
    onFound(gap);
    expect(skipOnce(gap, 110, 5000)).toEqual({ kind: 'skip', next: 111 });
  });
});

describe('the cursor row', () => {
  it('loads null without a row', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await loadCursor()).toBeNull();
  });

  it('loads the saved sequence as a number', async () => {
    prisma.$queryRaw.mockResolvedValue([{ sequence: 96000000n }]);
    expect(await loadCursor()).toBe(96000000);
  });

  it('saves with an upsert stamped in UTC', async () => {
    await saveCursor(96000001, new Date('2026-11-28T12:00:00.000Z'));
    const [strings, ...values] = prisma.$executeRaw.mock.calls[0];
    expect(strings.join('?')).toContain('ON CONFLICT (stream) DO UPDATE');
    expect(values).toEqual(['r2z2', 96000001, '2026-11-28 12:00:00.000']);
  });
});
