import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The queueing step every list stage shares.
 *
 * Its whole reason for existing is the order it enforces: ask the database
 * first, publish only what is missing. The workers used to fetch the ESI
 * detail and discover the duplicate afterwards, at the writer's existence
 * check — which cost one ESI call per already-stored killmail.
 */

const { prismaMock, channel, getRabbitMQChannel, loggerMock } = vi.hoisted(
  () => {
    const channel = { sendToQueue: vi.fn() };
    return {
      channel,
      prismaMock: { killmail: { findMany: vi.fn() } },
      getRabbitMQChannel: vi.fn(async () => channel),
      loggerMock: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  },
);

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/rabbitmq', () => ({ getRabbitMQChannel }));
vi.mock('@services/logger', () => ({ default: loggerMock }));

import { publishKillmailDetails } from './publish-killmail-details';

const REFS = [
  { killmail_id: 1, killmail_hash: 'h1' },
  { killmail_id: 2, killmail_hash: 'h2' },
  { killmail_id: 3, killmail_hash: 'h3' },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.killmail.findMany.mockResolvedValue([]);
});

describe('publishing', () => {
  it('publishes one message per killmail, on the detail queue', async () => {
    const published = await publishKillmailDetails(REFS, {
      announce: true,
      priority: 5,
    });

    expect(published).toBe(3);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(3);
    const [queue, content, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe('esi_killmail_detail_queue');
    expect(JSON.parse(content.toString())).toEqual({
      killmailId: 1,
      killmailHash: 'h1',
      announce: true,
    });
    expect(options).toMatchObject({ persistent: true, priority: 5 });
  });

  it('marks a backfill as quiet and low priority', async () => {
    await publishKillmailDetails(REFS, { announce: false, priority: 1 });

    const [, content, options] = channel.sendToQueue.mock.calls[0];
    expect(JSON.parse(content.toString()).announce).toBe(false);
    expect(options).toMatchObject({ priority: 1 });
  });
});

describe('killmails already in the database', () => {
  it('asks once for the whole page and publishes only what is missing', async () => {
    prismaMock.killmail.findMany.mockResolvedValue([{ killmail_id: 2 }]);

    const published = await publishKillmailDetails(REFS, {
      announce: true,
      priority: 5,
    });

    expect(prismaMock.killmail.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.killmail.findMany).toHaveBeenCalledWith({
      where: { killmail_id: { in: [1, 2, 3] } },
      select: { killmail_id: true },
    });
    expect(published).toBe(2);
    const ids = channel.sendToQueue.mock.calls.map(([, content]) =>
      JSON.parse(content.toString()),
    );
    expect(ids.map((m) => m.killmailId)).toEqual([1, 3]);
  });

  it('publishes nothing, and opens no channel, when the page is all duplicates', async () => {
    prismaMock.killmail.findMany.mockResolvedValue([
      { killmail_id: 1 },
      { killmail_id: 2 },
      { killmail_id: 3 },
    ]);

    const published = await publishKillmailDetails(REFS, {
      announce: true,
      priority: 5,
    });

    expect(published).toBe(0);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
    // This is the whole point: a re-sync of a stored character costs one
    // query per page and no ESI detail calls at all.
    expect(getRabbitMQChannel).not.toHaveBeenCalled();
  });
});

describe('an empty list', () => {
  it('touches neither the database nor the broker', async () => {
    const published = await publishKillmailDetails([], {
      announce: true,
      priority: 5,
    });

    expect(published).toBe(0);
    expect(prismaMock.killmail.findMany).not.toHaveBeenCalled();
    expect(getRabbitMQChannel).not.toHaveBeenCalled();
  });
});

describe('a list bigger than one query can carry', () => {
  it('chunks the lookup so PostgreSQL never sees more parameters than it accepts', async () => {
    // `yarn sync:character <id> 999` lists ~199,800 killmails, and the
    // extended protocol caps bind parameters at 65,535. One IN (…) with the
    // whole list is rejected and the script dies having queued nothing.
    const many = Array.from({ length: 12_000 }, (_, i) => ({
      killmail_id: i + 1,
      killmail_hash: `h${i}`,
    }));
    prismaMock.killmail.findMany.mockResolvedValue([]);

    const published = await publishKillmailDetails(many, {
      announce: false,
      priority: 1,
    });

    expect(published).toBe(12_000);
    for (const [args] of prismaMock.killmail.findMany.mock.calls) {
      expect(args.where.killmail_id.in.length).toBeLessThanOrEqual(5_000);
    }
    expect(prismaMock.killmail.findMany.mock.calls.length).toBeGreaterThan(1);
  });

  it('still drops the stored ones when the lookup is chunked', async () => {
    const many = Array.from({ length: 7_000 }, (_, i) => ({
      killmail_id: i + 1,
      killmail_hash: `h${i}`,
    }));
    // Every id in the second chunk is already stored.
    prismaMock.killmail.findMany.mockImplementation(async ({ where }) => {
      const ids: number[] = where.killmail_id.in;
      return ids
        .filter((id) => id > 5_000)
        .map((killmail_id) => ({
          killmail_id,
        }));
    });

    const published = await publishKillmailDetails(many, {
      announce: false,
      priority: 1,
    });

    expect(published).toBe(5_000);
  });
});
