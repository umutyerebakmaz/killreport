// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchGraphQL, ImageResponse } = vi.hoisted(() => ({
  fetchGraphQL: vi.fn(),
  ImageResponse: vi.fn(),
}));
vi.mock('@/lib/shareCard/fetchGraphQL', () => ({ fetchGraphQL }));
vi.mock('next/og', () => ({ ImageResponse }));

import Image, { dynamic } from './opengraph-image';

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe('character opengraph-image', () => {
  it('is ISR, rendered on demand and then cached', () => {
    expect(dynamic).toBe('force-static');
  });

  it('answers 404 without rendering when the character is null', async () => {
    fetchGraphQL.mockResolvedValue({
      character: null,
      characterKillLossTotals: { kills: 0, losses: 0 },
    });
    const res = await Image(params('365974960'));
    expect(res.status).toBe(404);
    expect(ImageResponse).not.toHaveBeenCalled();
  });

  it('answers 404 for a malformed id without asking the backend', async () => {
    const res = await Image(params('abc'));
    expect(res.status).toBe(404);
    expect(fetchGraphQL).not.toHaveBeenCalled();
  });

  it('throws instead of answering 404 when the backend fails', async () => {
    fetchGraphQL.mockRejectedValue(new Error('GraphQL errors: pool timeout'));
    await expect(Image(params('365974960'))).rejects.toThrow('pool timeout');
    expect(ImageResponse).not.toHaveBeenCalled();
  });

  it('keeps the response out of the data cache', async () => {
    fetchGraphQL.mockResolvedValue({
      character: null,
      characterKillLossTotals: { kills: 0, losses: 0 },
    });
    await Image(params('365974960'));
    expect(fetchGraphQL.mock.calls[0][2]).toBe(0);
  });
});
