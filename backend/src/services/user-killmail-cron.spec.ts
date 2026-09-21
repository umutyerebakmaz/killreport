import { describe, expect, it } from 'vitest';
import { skipReason } from './user-killmail-cron';

/**
 * The cron stopped being a retry mechanism in #234.
 *
 * Until then a 429 acked the message and dropped it (cdd4de02), so the cron
 * re-queueing the user ten minutes later WAS the retry — and asking the broker
 * whether work was already pending would always have answered no. Since #234
 * `handleWorkerError` keeps the message instead, so the same question now has a
 * real answer and the cron has to respect it or it publishes a second copy of a
 * retry that is already in flight.
 */
describe('skipReason', () => {
  it('skips when nothing is consuming the queue', () => {
    expect(skipReason({ messageCount: 0, consumerCount: 0 })).toMatch(
      /no worker/i,
    );
  });

  it('skips when the previous batch has not been consumed', () => {
    expect(skipReason({ messageCount: 3, consumerCount: 1 })).toMatch(/3/);
  });

  it('publishes when a worker is idle and the queue is empty', () => {
    expect(skipReason({ messageCount: 0, consumerCount: 1 })).toBeNull();
  });

  it('reports the absent worker even when messages are waiting', () => {
    expect(skipReason({ messageCount: 7, consumerCount: 0 })).toMatch(
      /no worker/i,
    );
  });

  it('treats getQueueStats zeros as a reason to hold off', () => {
    // getQueueStats returns zeros when the queue is missing or the broker is
    // unreachable. Zeros land on consumerCount === 0, so an unreadable broker
    // means "do not publish" rather than "publish blindly".
    expect(skipReason({ messageCount: 0, consumerCount: 0 })).not.toBeNull();
  });
});
