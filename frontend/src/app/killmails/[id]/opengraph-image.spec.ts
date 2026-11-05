// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const { fetchGraphQL, ImageResponse } = vi.hoisted(() => ({
  fetchGraphQL: vi.fn(),
  ImageResponse: vi.fn(),
}));
vi.mock('@/lib/shareCard/fetchGraphQL', () => ({ fetchGraphQL }));
vi.mock('next/og', () => ({ ImageResponse }));

import Image from './opengraph-image';

describe('killmail opengraph-image', () => {
  it('answers 404 without rendering when there is no data', async () => {
    fetchGraphQL.mockResolvedValue(null);
    const res = await Image({ params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(404);
    expect(ImageResponse).not.toHaveBeenCalled();
  });

  it('answers 404 when the killmail is null', async () => {
    fetchGraphQL.mockResolvedValue({ killmail: null });
    const res = await Image({ params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(404);
    expect(ImageResponse).not.toHaveBeenCalled();
  });
});
