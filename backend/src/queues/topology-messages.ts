/**
 * Universe Topology Message Contracts
 *
 * The celestial chain (solar system -> planet -> moon / asteroid belt, plus the
 * star, stargate and station leaves) carries JSON messages rather than the plain
 * integers the old enrichment queues used. The reason is structural: a leaf
 * worker now creates its own row, so it needs the parent IDs that only the
 * system response holds.
 *
 * `esi_solar_systems_queue` is deliberately NOT in here. It is a root scan fed by
 * queue-solar-systems.ts and stays a plain integer.
 */

import type amqp from 'amqplib';

export const TOPOLOGY_QUEUES = {
  stars: 'esi_stars_queue',
  stargates: 'esi_stargates_queue',
  stations: 'esi_stations_queue',
  planets: 'esi_planets_queue',
  moons: 'esi_moons_queue',
  asteroidBelts: 'esi_asteroid_belts_queue',
  dlq: 'esi_topology_dlq',
} as const;

export type TopologyQueueName = (typeof TOPOLOGY_QUEUES)[keyof typeof TOPOLOGY_QUEUES];

/** A message is dead-lettered rather than retried once attempts exceeds this. */
export const MAX_ATTEMPTS = 5;

export interface Envelope {
  queuedAt: string; // ISO 8601
  source: string; // 'worker-solar-systems' | 'queue-planets' | ...
  attempts?: number; // absent means 0
}

export interface StarMessage extends Envelope {
  starId: number;
  solarSystemId: number;
}

export interface StargateMessage extends Envelope {
  stargateId: number;
  solarSystemId: number;
}

export interface StationMessage extends Envelope {
  stationId: number;
  solarSystemId: number;
}

export interface PlanetMessage extends Envelope {
  planetId: number;
  solarSystemId: number;
  orbitIndex: number;
  /** Carried for the chain only. Never written to a table. */
  moonIds: number[];
  /** Carried for the chain only. Never written to a table. */
  asteroidBeltIds: number[];
}

export interface MoonMessage extends Envelope {
  moonId: number;
  solarSystemId: number;
  planetId: number;
  orbitIndex: number;
}

export interface AsteroidBeltMessage extends Envelope {
  beltId: number;
  solarSystemId: number;
  planetId: number;
  orbitIndex: number;
}

export type TopologyMessage =
  | StarMessage
  | StargateMessage
  | StationMessage
  | PlanetMessage
  | MoonMessage
  | AsteroidBeltMessage;

export function envelope(source: string): Envelope {
  return { queuedAt: new Date().toISOString(), source };
}

/**
 * x-max-priority is mandatory: server.ts's ensureAllQueuesExist() declares every
 * queue with it, and omitting it fails with 406 PRECONDITION_FAILED.
 */
export async function assertTopologyQueue(
  channel: amqp.Channel,
  queueName: string
): Promise<void> {
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: { 'x-max-priority': 10 },
  });
}

export function publishTopology(
  channel: amqp.Channel,
  queueName: string,
  payload: TopologyMessage
): void {
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

/** Returns null for malformed content; the caller acks and counts an error. */
export function parseTopologyMessage<T extends Envelope>(
  msg: amqp.ConsumeMessage
): T | null {
  try {
    const parsed = JSON.parse(msg.content.toString());
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Prisma throws P2003 when a foreign key constraint fails. */
export function isForeignKeyViolation(error: any): boolean {
  return error?.code === 'P2003';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The shared failure path for every topology worker.
 *
 * The old workers called nack(msg, false, false) on an unexpected error, which
 * discards the message outright. That was survivable while worker-solar-systems
 * had already written a skeleton row. In the chain design the row does not exist
 * yet, so a discarded message is a celestial object that never gets created.
 *
 * Returns nothing; it always settles the message (ack or nack) itself.
 */
export async function handleWorkerError(
  channel: amqp.Channel,
  msg: amqp.ConsumeMessage,
  payload: TopologyMessage,
  queueName: string,
  error: any,
  logger: { warn: (m: string) => void; error: (m: string, e?: any) => void }
): Promise<void> {
  // 420: ESI error limited. Keep the existing behaviour - wait a minute, requeue
  // untouched, do not burn an attempt.
  if (error?.response?.status === 420) {
    logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
    await sleep(60000);
    channel.nack(msg, false, true);
    return;
  }

  const attempts = (payload.attempts ?? 0) + 1;

  if (attempts > MAX_ATTEMPTS) {
    logger.error(
      `☠️  ${queueName}: giving up after ${MAX_ATTEMPTS} attempts, dead-lettering`,
      error?.message
    );
    // The DLQ is written by an explicit publish, NOT x-dead-letter-exchange.
    // Changing a queue's arguments would collide with the x-max-priority: 10
    // declaration ensureAllQueuesExist() already made and produce the
    // 406 PRECONDITION_FAILED that took down three workers in PR #135.
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.dlq);
    publishTopology(channel, TOPOLOGY_QUEUES.dlq, {
      ...payload,
      attempts,
      source: `${payload.source} -> ${queueName}`,
    });
    channel.ack(msg);
    return;
  }

  if (isForeignKeyViolation(error)) {
    logger.warn(
      `↩️  ${queueName}: parent row not written yet (P2003), retry ${attempts}/${MAX_ATTEMPTS}`
    );
  } else {
    logger.error(
      `❌ ${queueName}: retry ${attempts}/${MAX_ATTEMPTS} - ${error?.message}`,
      error?.message
    );
  }

  // Republish rather than nack(requeue): requeueing cannot carry the incremented
  // attempts counter, so the message would retry forever.
  await assertTopologyQueue(channel, queueName);
  publishTopology(channel, queueName, { ...payload, attempts });
  channel.ack(msg);
}
