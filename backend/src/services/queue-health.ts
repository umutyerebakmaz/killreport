import { RETRY_TOPOLOGY } from './queue-names';

/**
 * What a queue's numbers say about it.
 *
 * `OK` and `STALLED` only: a per-queue count of parked messages is NOT
 * available. `killreport.parking` is one queue and a message's origin lives in
 * its `x-death` header, which a depth query does not carry — so parking shows
 * up as its own row rather than as a field on every other queue.
 */
export type QueueHealth = 'OK' | 'STALLED';

export interface QueueNumbers {
  name: string;
  messageCount: number;
  consumerCount: number;
}

/**
 * Queues whose job is to hold messages, so "full with no consumer" is their
 * working state rather than a fault.
 */
export const HOLDING_QUEUES: readonly string[] = [
  RETRY_TOPOLOGY.wait,
  RETRY_TOPOLOGY.parking,
];

/**
 * A queue with messages and nobody reading them.
 *
 * This is the failure the app could not see before: PM2 stops keeping a worker
 * up, the publisher keeps publishing, and the only evidence is a number nobody
 * was looking at. An empty queue with no consumer is NOT this — most queues sit
 * empty between hand-run enrichment passes.
 */
export function queueHealth(queue: QueueNumbers): QueueHealth {
  if (HOLDING_QUEUES.includes(queue.name)) return 'OK';
  if (queue.messageCount > 0 && queue.consumerCount === 0) return 'STALLED';
  return 'OK';
}
