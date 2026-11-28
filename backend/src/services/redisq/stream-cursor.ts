import { utcTimestamp } from '@helpers/utc-timestamp';
import prismaWorker from '@services/prisma-worker';

/**
 * The R2Z2 stream's durable position: one `stream_cursors` row holding the
 * next sequence to read, and the rule for a file that is not there. Both are
 * the Rust worker's (`backend-rs/workers/worker-redisq/src/{cursor,stream}.rs`)
 * line for line, so the Node and Rust workers can take over from each other
 * without losing a killmail. Never run the two at once: they share the row.
 * See docs/superpowers/specs/2026-11-28-rust-redisq-design.md, §1–§2.
 */

/** This stream's row. */
export const STREAM = 'r2z2';
/** 404s in a row, with the head ahead, before a number is skipped. */
export const TRIES = 3;
/** Skips in a row before jumping to the head. */
export const SKIPS = 10;

export async function loadCursor(): Promise<number | null> {
  const rows = await prismaWorker.$queryRaw<{ sequence: bigint }[]>`
    SELECT sequence FROM stream_cursors WHERE stream = ${STREAM}
  `;
  return rows.length === 0 ? null : Number(rows[0].sequence);
}

/** `now` is stored as UTC. */
export async function saveCursor(sequence: number, now: Date): Promise<void> {
  await prismaWorker.$executeRaw`
    INSERT INTO stream_cursors (stream, sequence, updated_at)
    VALUES (${STREAM}, ${sequence}::bigint, ${utcTimestamp(now)}::timestamp)
    ON CONFLICT (stream) DO UPDATE
    SET sequence = EXCLUDED.sequence, updated_at = EXCLUDED.updated_at
  `;
}

/** The run of misses so far. A found killmail resets it. */
export interface Gap {
  tries: number;
  skipped: number;
}

export type Step =
  | { kind: 'wait' }
  | { kind: 'skip'; next: number }
  | { kind: 'jump'; next: number };

export function emptyGap(): Gap {
  return { tries: 0, skipped: 0 };
}

/**
 * A 404 at `current`, with `head` as sequence.json gave it. A missing file
 * may be a gap, an expired file, or one not readable yet; a skipped number
 * leaves no trace, so it is skipped only after `TRIES` answers with the head
 * ahead. `SKIPS` skips in a row mean the saved number has fallen out of what
 * R2Z2 keeps: jump to the head.
 */
export function onNotFound(gap: Gap, current: number, head: number): Step {
  if (head <= current) {
    gap.tries = 0;
    return { kind: 'wait' };
  }
  gap.tries += 1;
  if (gap.tries < TRIES) return { kind: 'wait' };
  gap.tries = 0;
  gap.skipped += 1;
  if (gap.skipped === SKIPS) {
    gap.skipped = 0;
    return { kind: 'jump', next: head };
  }
  return { kind: 'skip', next: current + 1 };
}

/** A file was there: the misses are over. */
export function onFound(gap: Gap): void {
  gap.tries = 0;
  gap.skipped = 0;
}
