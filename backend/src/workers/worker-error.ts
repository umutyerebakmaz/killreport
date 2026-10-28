import { RETRY_TOPOLOGY } from '@services/queue-names';
import { EsiThrottledError } from '@services/rate-limiter';
import type amqp from 'amqplib';

/**
 * How many times a message may be delivered before it is parked.
 *
 * Five, unchanged from the topology chain's own constant — this generalises
 * that path rather than replacing its policy. A message gets `MAX_ATTEMPTS`
 * deliveries in total: deliveries 1 through 4 retry, delivery 5 parks. That
 * is what makes "gave up after 5 attempts" — the `/workers` tooltip and
 * `backend/docs/ops/rabbitmq.md` both say it — literally true rather than an
 * off-by-one.
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

/**
 * The first line of an error's message, which is where a status belongs.
 *
 * The status detectors below fall back to the message text because four
 * services — `zkillboard.ts`, `killmail.service.ts`, `character.service.ts`
 * and `corporation.service.ts` — use `fetch` and throw a plain `Error` that
 * carries the status only there. Every one of them puts it on the first line.
 *
 * A Prisma failure, by contrast, embeds `file.ts:LINE:COL` and a numbered code
 * frame in its message, so matching the whole text meant a database error
 * raised at or near line 404, 420 or 429 of a worker file was classified as an
 * HTTP one — and an unrelated edit that shifts line numbers was enough to
 * trigger it. A false rate limit requeues without burning an attempt, so the
 * message loops forever and never reaches parking; a false 404 acks the
 * message and drops the work. Both are silent (#235).
 */
function messageHead(error: unknown): string {
  return String((error as { message?: string })?.message ?? '').split('\n')[0];
}

/**
 * The throttling status, if any: 420 (ESI's own error-limit status) or 429
 * (the generic rate limit status, used by ESI, zKillboard and any plain-HTTP
 * caller), else null. Both mean the caller is being throttled, not that the
 * message is bad, so the wait-and-requeue branch below treats them alike and
 * only its log line tells them apart.
 *
 * Checking the status first means this does not rest on a particular message
 * string once the next task moves ~25 workers, not all of them Axios-shaped,
 * onto this function — same reasoning as `isNotFound` below. `zkillboard.ts`,
 * `killmail.service.ts`, `character.service.ts` and `corporation.service.ts`
 * all use `fetch` and throw a plain `Error` carrying the status only in its
 * message text, so without the fallback a 420/429 from any of those workers
 * reads as an ordinary message defect and burns an attempt instead of waiting.
 * The word boundary keeps "1420" from matching, and `messageHead` keeps
 * anything below the first line — a Prisma code frame — out of it entirely.
 */
function throttleStatus(error: unknown): 420 | 429 | null {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status === 420 || status === 429) return status;
  const match = /\b(420|429)\b/.exec(messageHead(error));
  return match ? (Number(match[1]) as 420 | 429) : null;
}

/**
 * True for a 404, whether it arrives as a status code on the error's
 * `response` or only on the first line of its `message`. Axios attaches
 * `response.status`; some workers instead throw a plain `Error` whose message
 * carries the code. Checking the status first means this does not rest on a
 * particular message string once the next task moves ~25 workers, not all of
 * them Axios-shaped, onto this function.
 *
 * This branch acks, so a false positive drops the work rather than retrying
 * it. That is why the text match is a word-boundary one against `messageHead`
 * and not the `includes('404')` it started as: that version matched "4040",
 * an id, and any line of a Prisma code frame.
 */
function isNotFound(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status === 404) return true;
  return /\b404\b/.test(messageHead(error));
}

/**
 * True for a 403, detected the same two ways as the statuses above.
 *
 * This function only recognises the status; it deliberately routes nothing.
 * Whether a 403 is permanent depends on the caller: for a token-authenticated
 * endpoint it means this user may not read this resource and retrying cannot
 * change that, while elsewhere it can be a transient authorisation failure
 * worth another attempt. `handleWorkerError` therefore keeps treating a 403 as
 * an ordinary message defect, and the one worker that knows better —
 * `worker-esi-corporation-killmails`, where 403 means "not a Director" — acts
 * on it before handing the error over. The detection is shared so that the
 * status-then-message shape lives in one place; the policy is not.
 */
export function isForbidden(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status === 403) return true;
  return /\b403\b/.test(messageHead(error));
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
  // esiClient already put the process-wide brake in the limiter when it threw
  // this, so there is nothing to sleep for here: requeue at once, untouched,
  // and the message waits in the limiter's brake when it comes back. Being
  // throttled is not a defect in the message, so no attempt is burnt.
  if (error instanceof EsiThrottledError) {
    logger.warn(`⏸ esi throttled (${error.kind}), requeueing`);
    channel.nack(msg, false, true);
    return;
  }

  // 420/429: throttled. Wait, requeue untouched, burn no attempt — being
  // throttled is not a defect in the message. The log names which one: 420 is
  // ESI's error limit (too many failed requests), 429 a plain rate limit (too
  // many requests), and they call for different fixes.
  const throttled = throttleStatus(error);
  if (throttled) {
    logger.warn(
      throttled === 420
        ? '🛑 error limited (420)! waiting 60 seconds...'
        : '🛑 rate limited (429)! waiting 60 seconds...',
    );
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
  const attemptNumber = attempts + 1;

  if (attemptNumber >= MAX_ATTEMPTS) {
    logger.error(
      `☠️  ${queueName}: giving up after ${MAX_ATTEMPTS} attempts, parking`,
      error,
    );
    // The default exchange with the queue's own name as the routing key: no
    // binding needed, and the origin stays readable in the message's own
    // x-death header — which is why that header rides along on the parking
    // publish rather than being dropped.
    channel.publish('', RETRY_TOPOLOGY.parking, msg.content, {
      persistent: true,
      headers: msg.properties.headers,
    });
    channel.ack(msg);
    return;
  }

  logger.error(
    `❌ ${queueName}: attempt ${attemptNumber}/${MAX_ATTEMPTS} failed`,
    error,
  );
  // requeue: false is the whole mechanism — it sends the message to
  // killreport.dlx, which fans it into killreport.wait, whose TTL returns it
  // here through killreport.retry with x-death incremented.
  channel.nack(msg, false, false);
}
