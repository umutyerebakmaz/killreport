import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@config/config', () => ({ default: {}, config: {} }));
vi.mock('@services/tracker/tracker.service', () => {
  class TrackerError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TrackerError,
    getTrackerRefs: vi.fn(),
    trackEntity: vi.fn(),
    untrackEntity: vi.fn(),
  };
});

import {
  getTrackerRefs,
  TrackerError,
  trackEntity,
  untrackEntity,
} from '@services/tracker/tracker.service';
import { trackerMutations } from './mutations';
import { trackerQueries } from './queries';

const loaderOf = (rows: Record<number, any>) => ({
  load: vi.fn(async (id: number) => rows[id] ?? null),
});

const makeContext = (loaders: any = {}, user: any = { characterId: 1 }) =>
  ({ user, loaders }) as any;

const myTracker = (ctx: any) =>
  (trackerQueries.myTracker as any)({}, {}, ctx, {});

describe('myTracker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unauthenticated caller', async () => {
    await expect(myTracker(makeContext({}, null))).rejects.toMatchObject({
      extensions: { code: 'UNAUTHENTICATED' },
    });
  });

  it('skips refs whose entity the loader cannot find', async () => {
    vi.mocked(getTrackerRefs).mockResolvedValue([
      { type: 'ALLIANCE', id: 1, automatic: false },
      { type: 'ALLIANCE', id: 2, automatic: false },
    ]);
    const ctx = makeContext({
      alliance: loaderOf({
        1: { id: 1, name: 'A', date_founded: new Date(0) },
      }),
    });
    const result = await myTracker(ctx);
    expect(result.alliances).toHaveLength(1);
    expect(result.alliances[0].alliance.date_founded).toBe(
      '1970-01-01T00:00:00.000Z',
    );
  });

  it('orders automatic first, then by name', async () => {
    vi.mocked(getTrackerRefs).mockResolvedValue([
      { type: 'CHARACTER', id: 1, automatic: false },
      { type: 'CHARACTER', id: 2, automatic: true },
      { type: 'CHARACTER', id: 3, automatic: false },
    ]);
    const ctx = makeContext({
      character: loaderOf({
        1: { id: 1, name: 'Zed', birthday: new Date(0), updated_at: null },
        2: { id: 2, name: 'Yan', birthday: null, updated_at: null },
        3: { id: 3, name: 'Abe', birthday: null, updated_at: null },
      }),
    });
    const result = await myTracker(ctx);
    expect(result.characters.map((c: any) => c.character.name)).toEqual([
      'Yan',
      'Abe',
      'Zed',
    ]);
    expect(result.characters[2].character.birthday).toBe(
      '1970-01-01T00:00:00.000Z',
    );
  });
});

describe('track / untrack', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps a TrackerError to BAD_USER_INPUT with a reason', async () => {
    vi.mocked(trackEntity).mockRejectedValue(new TrackerError('LIMIT', 'full'));
    await expect(
      (trackerMutations.track as any)(
        {},
        { type: 'CHARACTER', id: 5 },
        makeContext(),
        {},
      ),
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT', reason: 'LIMIT' },
    });
  });

  it('untrack returns true', async () => {
    vi.mocked(untrackEntity).mockResolvedValue(undefined as any);
    const ok = await (trackerMutations.untrack as any)(
      {},
      { type: 'CHARACTER', id: 5 },
      makeContext(),
      {},
    );
    expect(ok).toBe(true);
    expect(untrackEntity).toHaveBeenCalledWith(1, 'CHARACTER', 5);
  });

  it('rejects an unauthenticated caller', async () => {
    await expect(
      (trackerMutations.track as any)(
        {},
        { type: 'CHARACTER', id: 5 },
        makeContext({}, null),
        {},
      ),
    ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
  });
});
