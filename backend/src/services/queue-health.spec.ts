import { describe, expect, it } from 'vitest';
import { HOLDING_QUEUES, queueHealth, skipReason } from './queue-health';

const q = (over: Partial<Parameters<typeof queueHealth>[0]> = {}) => ({
  name: 'esi_type_info_queue',
  messageCount: 0,
  consumerCount: 1,
  ...over,
});

describe('queueHealth', () => {
  it('is OK when a consumer is attached', () => {
    expect(queueHealth(q({ messageCount: 120 }))).toBe('OK');
  });

  it('is OK when the queue is empty and nobody is listening', () => {
    // Nothing to process is not a fault: most queues sit empty between runs.
    expect(queueHealth(q({ messageCount: 0, consumerCount: 0 }))).toBe('OK');
  });

  it('is STALLED when messages pile up with no consumer', () => {
    // The shape that grew to 465 messages unnoticed on 2026-09-20.
    expect(queueHealth(q({ messageCount: 465, consumerCount: 0 }))).toBe(
      'STALLED',
    );
  });

  it('never calls a holding queue stalled', () => {
    // killreport.wait holds messages on a TTL and HAS no consumer by design,
    // and killreport.parking is where messages are meant to sit until someone
    // looks at them. Both would read as permanently stalled otherwise.
    for (const name of HOLDING_QUEUES) {
      expect(queueHealth(q({ name, messageCount: 12, consumerCount: 0 }))).toBe(
        'OK',
      );
    }
  });

  it('names both holding queues', () => {
    expect([...HOLDING_QUEUES].sort()).toEqual([
      'killreport.parking',
      'killreport.wait',
    ]);
  });
});

/**
 * The publisher side of the same numbers.
 *
 * The cron stopped being a retry mechanism in #234. Until then a 429 acked the
 * message and dropped it (cdd4de02), so the cron re-queueing the user ten
 * minutes later WAS the retry — and asking the broker whether work was already
 * pending would always have answered no. Since #234 `handleWorkerError` keeps
 * the message instead, so the same question now has a real answer and the cron
 * has to respect it or it publishes a second copy of a retry already in flight.
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
