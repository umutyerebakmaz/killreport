import { afterEach, describe, expect, it, vi } from 'vitest';
import { blurredBackdropUri } from './backdrop';

afterEach(() => vi.unstubAllGlobals());

const decode = (uri: string) =>
  Buffer.from(
    uri.replace('data:image/svg+xml;base64,', ''),
    'base64',
  ).toString();

describe('blurredBackdropUri', () => {
  it('embeds the fetched image in an SVG with a Gaussian blur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    );
    const uri = await blurredBackdropUri('https://images.evetech.net/x');
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = decode(uri!);
    expect(svg).toContain('width="626" height="560"');
    expect(svg).toContain('<feGaussianBlur stdDeviation="28"/>');
    expect(svg).toContain('href="data:image/jpeg;base64,AQID"');
    expect(svg).toContain('filter="url(#b)"');
  });

  it('is null when the fetch fails, so the card still renders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await blurredBackdropUri('https://images.evetech.net/x')).toBeNull();
  });

  it('is null on a non-OK status or a non-image body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 404 })),
    );
    expect(await blurredBackdropUri('https://images.evetech.net/x')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
        ),
    );
    expect(await blurredBackdropUri('https://images.evetech.net/x')).toBeNull();
  });
});
