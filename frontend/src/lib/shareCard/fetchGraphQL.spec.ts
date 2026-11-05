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

const respond = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    }),
  );

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
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns data whose entity is null, so the caller can answer 404', async () => {
    respond({ data: { ping: null } });
    expect(await fetchGraphQL(doc, { id: 1 }, 60)).toEqual({ ping: null });
  });

  it('throws when the response has errors, even with HTTP 200', async () => {
    respond({ data: { ping: null }, errors: [{ message: 'pool timeout' }] });
    await expect(fetchGraphQL(doc, { id: 1 }, 60)).rejects.toThrow(
      'pool timeout',
    );
  });

  it('throws when the body has no data', async () => {
    respond({});
    await expect(fetchGraphQL(doc, { id: 1 }, 60)).rejects.toThrow('no data');
  });

  it('throws on a non-OK status', async () => {
    respond({}, { ok: false, status: 502 });
    await expect(fetchGraphQL(doc, { id: 1 }, 0)).rejects.toThrow('HTTP 502');
  });

  it('throws on a network error or a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(fetchGraphQL(doc, { id: 1 }, 60)).rejects.toThrow('down');
  });
});
