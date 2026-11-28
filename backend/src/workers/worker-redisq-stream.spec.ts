import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * One step of the Node R2Z2 worker: a killmail that cannot be written goes to
 * killmail_refs and the stream moves on; if even that fails, the sequence
 * stays. See docs/superpowers/specs/2026-11-28-rust-redisq-design.md, §3.
 */

const mocks = vi.hoisted(() => ({
  saveKillmail: vi.fn(),
  recordRefs: vi.fn(),
  loadCursor: vi.fn(),
  saveCursor: vi.fn(),
  getKillmailDetail: vi.fn(),
}));

vi.mock('@services/killmail-writer', () => ({
  saveKillmail: mocks.saveKillmail,
}));
vi.mock('@services/killmail-refs', () => ({ recordRefs: mocks.recordRefs }));
vi.mock('@services/redisq/stream-cursor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@services/redisq/stream-cursor')>()),
  loadCursor: mocks.loadCursor,
  saveCursor: mocks.saveCursor,
}));
vi.mock('@services/killmail', () => ({
  KillmailService: { getKillmailDetail: mocks.getKillmailDetail },
}));
vi.mock('@services/prisma-worker', () => ({ default: {} }));
vi.mock('@services/pubsub', () => ({ pubsub: {} }));
vi.mock('@services/esi-client', () => ({
  setEsiMaxWait: vi.fn(),
  setEsiPriority: vi.fn(),
}));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/alliance/alliance.service', () => ({}));
vi.mock('@services/character/character.service', () => ({}));
vi.mock('@services/corporation/corporation.service', () => ({}));
vi.mock('@services/type/type.service', () => ({}));

const SEQ = 96000000;
const ID = 133900250;
const HASH = '8a1b2c';

const esi = {
  killmail_id: ID,
  killmail_time: '2026-11-27T12:00:00Z',
  solar_system_id: 30000142,
  victim: { corporation_id: 98000002, damage_taken: 200, ship_type_id: 587 },
  attackers: [{ corporation_id: 98000001, damage_done: 200, final_blow: true }],
};

function serve(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

/** A fresh module per test: the cursor lives in module state. */
async function freshStep() {
  vi.resetModules();
  process.env.REDISQ_ENABLE_ENRICHMENT = 'false';
  const { step } = await import('./worker-redisq-stream.js');
  return step;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.loadCursor.mockResolvedValue(SEQ);
  mocks.saveCursor.mockResolvedValue(undefined);
});

describe('step', () => {
  it('saves a killmail and moves to the next sequence', async () => {
    serve({ killmail_id: ID, zkb: { hash: HASH, totalValue: 1 }, esi });
    mocks.saveKillmail.mockResolvedValue(true);
    const step = await freshStep();

    await step();

    expect(mocks.saveKillmail).toHaveBeenCalledWith(esi, HASH);
    expect(mocks.recordRefs).not.toHaveBeenCalled();
    expect(mocks.saveCursor).toHaveBeenLastCalledWith(
      SEQ + 1,
      expect.any(Date),
    );
  });

  it('records a killmail the writer refuses in killmail_refs and moves on', async () => {
    serve({ killmail_id: ID, zkb: { hash: HASH, totalValue: 1 }, esi });
    mocks.saveKillmail.mockRejectedValue(new Error('deadlock'));
    mocks.recordRefs.mockResolvedValue(1);
    const step = await freshStep();

    await step();

    expect(mocks.recordRefs).toHaveBeenCalledWith(
      [{ killmail_id: ID, killmail_hash: HASH }],
      'redisq',
      expect.any(Date),
    );
    expect(mocks.saveCursor).toHaveBeenLastCalledWith(
      SEQ + 1,
      expect.any(Date),
    );
  });

  it('throws and stays when the ref cannot be written either', async () => {
    serve({ killmail_id: ID, zkb: { hash: HASH, totalValue: 1 }, esi });
    mocks.saveKillmail.mockRejectedValue(new Error('database down'));
    mocks.recordRefs.mockRejectedValue(new Error('database down'));
    const step = await freshStep();

    await expect(step()).rejects.toThrow('database down');
    expect(mocks.saveCursor).not.toHaveBeenCalled();
  });

  it('saves a package that carries no zkb block', async () => {
    serve({ killmail_id: ID, hash: HASH, esi });
    mocks.saveKillmail.mockResolvedValue(true);
    const step = await freshStep();

    await step();

    expect(mocks.saveKillmail).toHaveBeenCalledWith(esi, HASH);
    expect(mocks.recordRefs).not.toHaveBeenCalled();
  });
});
