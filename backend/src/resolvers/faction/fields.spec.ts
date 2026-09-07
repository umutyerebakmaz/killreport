import { describe, expect, it } from 'vitest';

import { factionFields } from './fields';

/**
 * This is where the snake_case -> camelCase mapping for Faction actually
 * lives now — see backend/src/resolvers/faction/queries.ts and
 * backend/src/resolvers/leaderboard/queries.ts, both of which now return
 * the raw Prisma row and rely on these resolvers for corporationId /
 * militiaCorporationId.
 */

/** Calls a field resolver with the parent it reads and no other arguments. */
function resolve(
  field: 'corporationId' | 'militiaCorporationId',
  parent: unknown,
) {
  const resolver = factionFields[field] as (parent: unknown) => unknown;
  return resolver(parent);
}

describe('factionFields.corporationId', () => {
  it('maps corporation_id to corporationId', () => {
    expect(resolve('corporationId', { corporation_id: 1000084 })).toBe(1000084);
  });

  it('is null when the faction has no corporation_id', () => {
    expect(resolve('corporationId', { corporation_id: null })).toBeNull();
    expect(resolve('corporationId', {})).toBeNull();
  });
});

describe('factionFields.militiaCorporationId', () => {
  it('maps militia_corporation_id to militiaCorporationId', () => {
    expect(
      resolve('militiaCorporationId', { militia_corporation_id: 1000179 }),
    ).toBe(1000179);
  });

  it('is null when the faction has no militia_corporation_id', () => {
    expect(
      resolve('militiaCorporationId', { militia_corporation_id: null }),
    ).toBeNull();
    expect(resolve('militiaCorporationId', {})).toBeNull();
  });
});
