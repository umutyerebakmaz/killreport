import { RETRY_TOPOLOGY } from '@services/queue-names';
import type amqp from 'amqplib';

/**
 * How many times a message may fail before it is parked.
 *
 * Five, unchanged from the topology chain's own constant — this generalises
 * that path rather than replacing its policy.
 */
export const MAX_ATTEMPTS = 5;

export interface WorkerLogger {
  warn: (m: string) => void;
  error: (m: string, e?: unknown) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * How many times the broker has already dead-lettered this message.
 *
 * RabbitMQ writes `x-death` on every dead-letter hop, so the counter comes for
 * free and the message body never has to carry one. That is what lets the
 * plain-integer queues join this path without changing their wire format — the
 * topology chain needed an `attempts` field in its payload only because it was
 * counting by itself.
 *
 * A first delivery has no `x-death` at all, which is 0.
 */
export function deathCount(msg: amqp.ConsumeMessage): number {
  const deaths = msg.properties.headers?.['x-death'];
  if (!Array.isArray(deaths) || deaths.length === 0) return 0;
  const count = deaths[0]?.count;
  return typeof count === 'number' ? count : 0;
}

function isErrorLimited(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 420;
}

function isNotFound(error: unknown): boolean {
  return String((error as { message?: string })?.message ?? '').includes('404');
}

/**
 * The failure path every worker shares.
 *
 * It replaces ~25 copies of the same try/catch, of which 17 called
 * `nack(msg, false, true)` — an unbounded requeue, so a message that fails
 * deterministically retried forever against the 50 req/sec ESI ceiling and
 * surfaced nowhere.
 *
 * It always settles the message itself: exactly one ack or nack on every path.
 */
export async function handleWorkerError(
  channel: amqp.Channel,
  msg: amqp.ConsumeMessage,
  queueName: string,
  error: unknown,
  logger: WorkerLogger,
): Promise<void> {
  // 420: ESI error limited. Wait, requeue untouched, burn no attempt — being
  // rate limited is not a defect in the message.
  if (isErrorLimited(error)) {
    logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
    await sleep(60_000);
    channel.nack(msg, false, true);
    return;
  }

  // 404: the id names nothing. Retrying cannot make it exist.
  if (isNotFound(error)) {
    logger.warn(`  ! ${queueName}: not found (404), skipping`);
    channel.ack(msg);
    return;
  }

  const attempts = deathCount(msg);

  if (attempts >= MAX_ATTEMPTS) {
    logger.error(
      `☠️  ${queueName}: giving up after ${MAX_ATTEMPTS} attempts, parking`,
      error,
    );
    // The default exchange with the queue's own name as the routing key: no
    // binding needed, and the origin stays readable in the message's own
    // x-death header.
    channel.publish('', RETRY_TOPOLOGY.parking, msg.content, {
      persistent: true,
    });
    channel.ack(msg);
    return;
  }

  logger.error(
    `❌ ${queueName}: attempt ${attempts + 1}/${MAX_ATTEMPTS} failed`,
    error,
  );
  // requeue: false is the whole mechanism — it sends the message to
  // killreport.dlx, which fans it into killreport.wait, whose TTL returns it
  // here through killreport.retry with x-death incremented.
  channel.nack(msg, false, false);
}
