import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ALL_QUEUES } from '@services/queue-names';
import { QUEUE_WORKER_MAP } from './helpers';

const scripts = Object.keys(
  JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8'))
    .scripts,
);
const workerFiles = readdirSync(join(__dirname, '../../workers'));

describe('QUEUE_WORKER_MAP', () => {
  it('names a worker for every queue', () => {
    // A queue without an entry reads Stopped on the workers page even while its
    // worker runs, because checkWorkerProcess is never asked about it.
    const missing = ALL_QUEUES.filter((name) => !QUEUE_WORKER_MAP[name]);
    expect(missing).toEqual([]);
  });

  it('leads every entry with a real yarn script', () => {
    for (const [queue, names] of Object.entries(QUEUE_WORKER_MAP)) {
      expect(scripts, queue).toContain(names[0]);
    }
  });

  it('lets checkWorkerProcess find the worker file for every entry', () => {
    // checkWorkerProcess greps `ps` for `workers/<name>` with the colons turned
    // into dashes, so at least one name has to be a prefix of the file name.
    // worker:user-killmails alone would never match worker-esi-user-killmails.ts.
    for (const [queue, names] of Object.entries(QUEUE_WORKER_MAP)) {
      const found = names.some((name) => {
        const prefix = name.replace('worker:', 'worker-').replace(/:/g, '-');
        return workerFiles.some((file) => file.startsWith(prefix));
      });
      expect(found, queue).toBe(true);
    }
  });
});
