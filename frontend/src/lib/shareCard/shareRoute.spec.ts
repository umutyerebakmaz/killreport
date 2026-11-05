import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseShareId, shareMetadata } from './shareRoute';

afterEach(() => vi.restoreAllMocks());

describe('parseShareId', () => {
  it('accepts positive integers', () => {
    expect(parseShareId('139681321')).toBe(139681321);
    expect(parseShareId('2147483647')).toBe(2147483647);
  });

  it.each([
    '',
    'abc',
    '0',
    '-1',
    '1.5',
    '1e3',
    ' 1',
    '2147483648',
    '999999999999',
  ])('rejects %j', (raw) => expect(parseShareId(raw)).toBeNull());
});

describe('shareMetadata', () => {
  const text = (name: string) => ({ title: name, description: `${name}!` });

  it('builds the title, Open Graph and large-image card', async () => {
    expect(await shareMetadata(async () => 'Amamake', text)).toEqual({
      title: 'Amamake',
      description: 'Amamake!',
      openGraph: { title: 'Amamake', description: 'Amamake!' },
      twitter: { card: 'summary_large_image' },
    });
  });

  it('keeps the generic metadata for a missing entity', async () => {
    expect(await shareMetadata(async () => null, text)).toEqual({});
  });

  it('keeps the generic metadata when the backend fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = () => Promise.reject(new Error('backend down'));
    expect(await shareMetadata(load, text)).toEqual({});
    expect(log).toHaveBeenCalled();
  });
});
