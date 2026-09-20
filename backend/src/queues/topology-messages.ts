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
} as const;

export type TopologyQueueName =
  (typeof TOPOLOGY_QUEUES)[keyof typeof TOPOLOGY_QUEUES];

export interface Envelope {
  queuedAt: string; // ISO 8601
  source: string; // 'worker-solar-systems' | 'queue-planets' | ...
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

export function publishTopology(
  channel: amqp.Channel,
  queueName: string,
  payload: TopologyMessage,
): void {
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

/** Returns null for malformed content; the caller acks and counts an error. */
export function parseTopologyMessage<T extends Envelope>(
  msg: amqp.ConsumeMessage,
): T | null {
  try {
    const parsed = JSON.parse(msg.content.toString());
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as T;
  } catch {
    return null;
  }
}
