import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@services/logger', () => ({ default: loggerMock }));
vi.mock('@services/prisma-worker', () => ({ default: {} }));

import {
  updateDailyAggregatesBatch,
  updateDailyAggregatesRealtime,
} from './kill-stats-realtime';

type Table =
  'character_kill_stats' | 'corporation_kill_stats' | 'alliance_kill_stats';

interface Upsert {
  table: Table;
  killDate: string;
  entityId: number;
  insertCount: number;
  incrementBy: number;
}

const TABLES: Table[] = [
  'character_kill_stats',
  'corporation_kill_stats',
  'alliance_kill_stats',
];

function makeTx() {
  const $executeRaw = vi.fn().mockResolvedValue(1);
  return { tx: { $executeRaw } as any, $executeRaw };
}

/**
 * Decode one tagged-template call into the row it upserts. The realtime path
 * hardcodes `1` in the SQL text, the batch path binds the count twice.
 */
function decode(call: unknown[]): Upsert {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const sql = strings.join('?');
  const table = TABLES.find((t) => sql.includes(`INSERT INTO ${t}`));
  if (!table) throw new Error(`Unrecognised statement: ${sql}`);

  const [killDate, entityId, insertCount = 1, incrementBy = 1] = values as [
    string,
    number,
    number?,
    number?,
  ];
  return { table, killDate, entityId, insertCount, incrementBy };
}

function upserts($executeRaw: ReturnType<typeof vi.fn>): Upsert[] {
  return $executeRaw.mock.calls.map(decode);
}

function killmail(
  time: string,
  ids: Partial<
    Record<
      'character_ids' | 'corporation_ids' | 'alliance_ids',
      (number | null)[]
    >
  >,
) {
  return {
    killmail_time: new Date(time),
    character_ids: [],
    corporation_ids: [],
    alliance_ids: [],
    ...ids,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateDailyAggregatesRealtime', () => {
  it('upserts one row per entity in each of the three stats tables', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesRealtime(
      tx,
      killmail('2026-09-03T12:00:00Z', {
        character_ids: [1001, 1002],
        corporation_ids: [2001],
        alliance_ids: [3001],
      }),
    );

    expect(upserts($executeRaw)).toEqual([
      {
        table: 'character_kill_stats',
        killDate: '2026-09-03',
        entityId: 1001,
        insertCount: 1,
        incrementBy: 1,
      },
      {
        table: 'character_kill_stats',
        killDate: '2026-09-03',
        entityId: 1002,
        insertCount: 1,
        incrementBy: 1,
      },
      {
        table: 'corporation_kill_stats',
        killDate: '2026-09-03',
        entityId: 2001,
        insertCount: 1,
        incrementBy: 1,
      },
      {
        table: 'alliance_kill_stats',
        killDate: '2026-09-03',
        entityId: 3001,
        insertCount: 1,
        incrementBy: 1,
      },
    ]);
  });

  it('derives kill_date from the UTC day, not the local one', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesRealtime(
      tx,
      killmail('2026-09-03T23:59:59.999Z', { character_ids: [1001] }),
    );

    expect(upserts($executeRaw)[0].killDate).toBe('2026-09-03');
  });

  it('counts each entity once per killmail and ignores null ids', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesRealtime(
      tx,
      killmail('2026-09-03T12:00:00Z', {
        character_ids: [1001, null, 1001],
        corporation_ids: [2001, 2001, 2001],
        alliance_ids: [null, null],
      }),
    );

    expect(upserts($executeRaw).map((u) => [u.table, u.entityId])).toEqual([
      ['character_kill_stats', 1001],
      ['corporation_kill_stats', 2001],
    ]);
  });

  it('runs no statements when every id is null', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesRealtime(
      tx,
      killmail('2026-09-03T12:00:00Z', {
        character_ids: [null],
        corporation_ids: [null],
        alliance_ids: [],
      }),
    );

    expect($executeRaw).not.toHaveBeenCalled();
  });

  it('logs and swallows a database error so the killmail transaction survives', async () => {
    const { tx, $executeRaw } = makeTx();
    const failure = new Error('deadlock detected');
    $executeRaw.mockRejectedValue(failure);

    await expect(
      updateDailyAggregatesRealtime(
        tx,
        killmail('2026-09-03T12:00:00Z', { character_ids: [1001] }),
      ),
    ).resolves.toBeUndefined();

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('daily aggregates'),
      failure,
    );
  });
});

describe('updateDailyAggregatesBatch', () => {
  it('does nothing for an empty batch', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesBatch(tx, []);

    expect($executeRaw).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it('collapses killmails on the same day into one upsert per entity with the summed count', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesBatch(tx, [
      killmail('2026-09-03T01:00:00Z', {
        character_ids: [1001],
        corporation_ids: [2001],
        alliance_ids: [3001],
      }),
      killmail('2026-09-03T02:00:00Z', {
        character_ids: [1001, 1002],
        corporation_ids: [2001],
        alliance_ids: [3001],
      }),
      killmail('2026-09-03T03:00:00Z', {
        character_ids: [1002],
        corporation_ids: [2002],
        alliance_ids: [3001],
      }),
    ]);

    expect(upserts($executeRaw)).toEqual([
      {
        table: 'character_kill_stats',
        killDate: '2026-09-03',
        entityId: 1001,
        insertCount: 2,
        incrementBy: 2,
      },
      {
        table: 'character_kill_stats',
        killDate: '2026-09-03',
        entityId: 1002,
        insertCount: 2,
        incrementBy: 2,
      },
      {
        table: 'corporation_kill_stats',
        killDate: '2026-09-03',
        entityId: 2001,
        insertCount: 2,
        incrementBy: 2,
      },
      {
        table: 'corporation_kill_stats',
        killDate: '2026-09-03',
        entityId: 2002,
        insertCount: 1,
        incrementBy: 1,
      },
      {
        table: 'alliance_kill_stats',
        killDate: '2026-09-03',
        entityId: 3001,
        insertCount: 3,
        incrementBy: 3,
      },
    ]);
  });

  it('keeps the same entity on different UTC days as separate rows', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesBatch(tx, [
      killmail('2026-09-03T23:30:00Z', { character_ids: [1001] }),
      killmail('2026-09-04T00:30:00Z', { character_ids: [1001] }),
    ]);

    expect(upserts($executeRaw)).toEqual([
      {
        table: 'character_kill_stats',
        killDate: '2026-09-03',
        entityId: 1001,
        insertCount: 1,
        incrementBy: 1,
      },
      {
        table: 'character_kill_stats',
        killDate: '2026-09-04',
        entityId: 1001,
        insertCount: 1,
        incrementBy: 1,
      },
    ]);
  });

  it('binds the entity id as a number even though the grouping key is a string', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesBatch(tx, [
      killmail('2026-09-03T12:00:00Z', { corporation_ids: [98000001] }),
    ]);

    const [, entityId, count] = $executeRaw.mock.calls[0].slice(1);
    expect(entityId).toBe(98000001);
    expect(count).toBe(1);
  });

  it('counts a corporation or alliance once per killmail however many attackers share it', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesBatch(tx, [
      killmail('2026-09-03T12:00:00Z', {
        corporation_ids: [2001, 2001, null, 2001],
        alliance_ids: [3001, 3001],
      }),
    ]);

    expect(upserts($executeRaw)).toEqual([
      {
        table: 'corporation_kill_stats',
        killDate: '2026-09-03',
        entityId: 2001,
        insertCount: 1,
        incrementBy: 1,
      },
      {
        table: 'alliance_kill_stats',
        killDate: '2026-09-03',
        entityId: 3001,
        insertCount: 1,
        incrementBy: 1,
      },
    ]);
  });

  it('skips null character ids', async () => {
    const { tx, $executeRaw } = makeTx();

    await updateDailyAggregatesBatch(tx, [
      killmail('2026-09-03T12:00:00Z', { character_ids: [null, 1001, null] }),
    ]);

    expect(upserts($executeRaw)).toEqual([
      {
        table: 'character_kill_stats',
        killDate: '2026-09-03',
        entityId: 1001,
        insertCount: 1,
        incrementBy: 1,
      },
    ]);
  });

  it('logs and rethrows a database error, unlike the realtime path', async () => {
    const { tx, $executeRaw } = makeTx();
    const failure = new Error('connection reset');
    $executeRaw.mockRejectedValue(failure);

    await expect(
      updateDailyAggregatesBatch(tx, [
        killmail('2026-09-03T12:00:00Z', { character_ids: [1001] }),
      ]),
    ).rejects.toBe(failure);

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('batch update'),
      failure,
    );
  });
});
