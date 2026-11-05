import { gql } from '@apollo/client';
import { print } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGraphQL } from './fetchGraphQL';

const doc = gql`
  query Ping($id: Int!) {
    ping(id: $id)
  }
`;

afterEach(() => vi.unstubAllGlobals());

describe('fetchGraphQL', () => {
  it('posts the printed document and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ping: 1 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGraphQL(doc, { id: 7 }, 60);

    expect(result).toEqual({ ping: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      query: print(doc),
      variables: { id: 7 },
    });
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it('returns null when the response has errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: null, errors: [{ message: 'x' }] }),
      }),
    );
    expect(await fetchGraphQL(doc, { id: 1 }, 60)).toBeNull();
  });

  it('returns null on a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    expect(await fetchGraphQL(doc, { id: 1 }, false)).toBeNull();
  });

  it('returns null on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await fetchGraphQL(doc, { id: 1 }, 60)).toBeNull();
  });
});
