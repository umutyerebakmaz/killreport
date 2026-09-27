import { describe, expect, it, vi } from 'vitest';

import { allianceFields } from './fields';

describe('allianceFields.sovereigntySystemCount', () => {
  it('reads the count through the DataLoader so a page of alliances batches', async () => {
    const load = vi.fn().mockResolvedValue(42);
    const resolver = allianceFields.sovereigntySystemCount as (
      parent: unknown,
      args: unknown,
      context: unknown,
    ) => unknown;

    await expect(
      resolver(
        { id: 99000001 },
        {},
        { loaders: { sovereigntySystemCountByAlliance: { load } } },
      ),
    ).resolves.toBe(42);
    expect(load).toHaveBeenCalledWith(99000001);
  });
});
