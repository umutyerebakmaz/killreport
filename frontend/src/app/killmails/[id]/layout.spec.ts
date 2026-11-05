// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchGraphQL } = vi.hoisted(() => ({ fetchGraphQL: vi.fn() }));
vi.mock('@/lib/shareCard/fetchGraphQL', () => ({ fetchGraphQL }));

import { generateMetadata } from './layout';

const params = { params: Promise.resolve({ id: '139681321' }) };

beforeEach(() => vi.clearAllMocks());

describe('killmail layout generateMetadata', () => {
  it('falls back to the generic metadata when the backend fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchGraphQL.mockRejectedValue(new Error('backend down'));
    expect(await generateMetadata(params)).toEqual({});
  });

  it('falls back to the generic metadata for a missing killmail', async () => {
    fetchGraphQL.mockResolvedValue({ killmail: null });
    expect(await generateMetadata(params)).toEqual({});
  });

  it('builds the share title for a killmail', async () => {
    fetchGraphQL.mockResolvedValue({
      killmail: {
        totalValue: 1097930000,
        attackerCount: 5,
        solo: false,
        npc: false,
        victim: {
          character: { id: 1, name: 'Ishtar Pilot' },
          corporation: null,
          alliance: null,
          shipType: { id: 12005, name: 'Ishtar' },
        },
        solarSystem: {
          name: 'Sibot',
          constellation: { region: { name: 'Domain' } },
        },
      },
    });
    const meta = await generateMetadata(params);
    expect(meta.title).toBe('Ishtar Pilot lost an Ishtar');
    expect(meta.twitter).toEqual({ card: 'summary_large_image' });
  });
});
