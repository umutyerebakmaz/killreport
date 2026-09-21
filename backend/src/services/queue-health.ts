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

/**
 * Why a publisher must not add to this queue right now, or null when it may.
 *
 * Retry belongs to the broker since #234 (`workers/worker-error.ts`): a 429
 * sleeps 60 seconds and requeues the same message rather than acking it away,
 * which is what cdd4de02 did back when the next cron tick was the only retry
 * there was. Nobody took the retry role back off the publisher afterwards, so
 * both layers ran at once and the queue filled with copies of one user's sync.
 *
 * `messageCount` counts ready messages only. A message the worker is holding
 * through that 60-second wait is unacked and invisible here, so a tick landing
 * in the window can still publish one duplicate — bounded by the next tick,
 * which sees it ready and holds off.
 */
export function skipReason(stats: Omit<QueueNumbers, 'name'>): string | null {
  if (stats.consumerCount === 0) return 'no worker is consuming the queue';
  if (stats.messageCount > 0)
    return `${stats.messageCount} message(s) still pending`;
  return null;
}
