import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * checkWorkerProcess finds a worker in `ps`. A Rust worker is no `node`
 * process and has no `workers/` in its path — it runs as
 * `backend-rs/target/<profile>/<binary>` — so it needs its own match, or
 * workerStatus reports it down while it runs.
 */

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('child_process', () => ({ exec }));

import { checkWorkerProcess } from './helpers';

/** `ps aux | grep …` answering only the commands that contain `match`. */
function psAnswers(match: string, line: string) {
  exec.mockImplementation(
    (
      command: string,
      callback: (e: Error | null, r?: { stdout: string }) => void,
    ) => {
      if (command.includes(match)) callback(null, { stdout: `${line}\n` });
      else callback(new Error('grep: no match'));
    },
  );
}

beforeEach(() => vi.clearAllMocks());

describe('checkWorkerProcess', () => {
  it('finds a Rust worker binary by its target path', async () => {
    psAnswers(
      'target/',
      'killreport  4242  1.0  0.5 /var/www/killreport/backend-rs/target/release/worker-redisq',
    );
    expect(
      await checkWorkerProcess(['worker:redisq', 'worker-redisq']),
    ).toEqual({ running: true, pid: 4242, matchedName: 'worker:redisq' });
  });

  it('still finds a Node worker by its file', async () => {
    psAnswers(
      'grep node',
      'killreport  77  1.0  0.5 node tsx src/workers/worker-redisq-stream.ts',
    );
    expect(await checkWorkerProcess(['worker:redisq'])).toEqual({
      running: true,
      pid: 77,
      matchedName: 'worker:redisq',
    });
  });

  it('reports a worker that is not running', async () => {
    psAnswers('nothing matches this', '');
    expect(await checkWorkerProcess(['worker:redisq'])).toEqual({
      running: false,
    });
  });
});
