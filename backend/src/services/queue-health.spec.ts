import { describe, expect, it } from 'vitest';
import { HOLDING_QUEUES, queueHealth } from './queue-health';

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
