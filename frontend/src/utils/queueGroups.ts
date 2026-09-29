export interface QueueGroup<T> {
  title: string;
  subtitle?: string;
  queues: T[];
}

interface GroupRule {
  title: string;
  subtitle?: string;
  match: (name: string) => boolean;
}

const UNIVERSE = [
  'regions',
  'constellations',
  'solar_systems',
  'stars',
  'planets',
  'moons',
  'asteroid_belts',
  'stargates',
  'stations',
];

// First match wins, so order matters: backfill_killmail_values_queue has to be
// claimed before anything that looks for "killmail".
const RULES: GroupRule[] = [
  {
    title: 'zKillboard Workers',
    subtitle: 'Killmail streaming and historical sync',
    match: (name) =>
      name.startsWith('zkillboard_') || name.startsWith('redisq_'),
  },
  {
    title: 'Maintenance & Backfill Workers',
    subtitle: 'Historical data processing and value recalculation',
    match: (name) => name.startsWith('backfill_'),
  },
  {
    title: 'Killmail Workers',
    subtitle: 'Killmail details and ESI killmail history',
    match: (name) => name.startsWith('esi_') && name.includes('killmail'),
  },
  {
    title: 'ESI Info Workers',
    subtitle:
      'Entity enrichment (characters, corporations, alliances, types, dogma)',
    match: (name) =>
      name.startsWith('esi_') && /_(info|price|dogma)_queue$/.test(name),
  },
  {
    title: 'ESI Sync Workers',
    subtitle: 'Alliance corporation synchronization',
    match: (name) => name === 'esi_alliance_corporations_queue',
  },
  {
    title: 'ESI Universe Workers',
    subtitle: 'Regions, constellations, solar systems and their contents',
    match: (name) => UNIVERSE.some((part) => name === `esi_${part}_queue`),
  },
];

// Display order on the page, independent of the matching order above.
const ORDER = [
  'zKillboard Workers',
  'Killmail Workers',
  'ESI Info Workers',
  'ESI Sync Workers',
  'ESI Universe Workers',
  'Maintenance & Backfill Workers',
  'Other Workers',
];

/**
 * Sort queues into the workers page sections. A queue no rule claims lands in
 * Other rather than disappearing, which is how ten queues went missing before.
 * Empty groups are left out.
 */
export function groupQueues<T extends { name: string }>(
  queues: readonly T[],
): QueueGroup<T>[] {
  const groups = new Map<string, QueueGroup<T>>();

  for (const queue of queues) {
    const rule = RULES.find((r) => r.match(queue.name));
    const title = rule?.title ?? 'Other Workers';
    const group = groups.get(title) ?? {
      title,
      subtitle: rule?.subtitle,
      queues: [],
    };
    group.queues.push(queue);
    groups.set(title, group);
  }

  return ORDER.flatMap((title) => groups.get(title) ?? []);
}
