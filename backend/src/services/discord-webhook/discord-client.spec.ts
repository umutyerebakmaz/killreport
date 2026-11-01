import { describe, expect, it, vi } from 'vitest';
import {
  DISCORD_TIMEOUT_MS,
  getWebhookName,
  postWebhook,
  RATE_LIMIT_BUDGET_MS,
} from './discord-client';

const URL_ = 'https://discord.com/api/webhooks/123/secret-token';

function res(status: number, body = ''): Response {
  return new Response(status === 204 ? null : body, { status });
}

function fakeFetch(...responses: (Response | Error)[]) {
  const queue = [...responses];
  return vi.fn(async (..._args: Parameters<typeof fetch>) => {
    const next = queue.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
}

describe('postWebhook', () => {
  it('maps 204 to ok, 404/401/403 to disable, 400 to drop, 502 to transient', async () => {
    const cases: [number, string][] = [
      [204, 'ok'],
      [200, 'ok'],
      [404, 'disable'],
      [401, 'disable'],
      [403, 'disable'],
      [400, 'drop'],
      [422, 'drop'],
      [502, 'transient'],
    ];
    for (const [status, outcome] of cases) {
      const f = fakeFetch(res(status, 'bad'));
      const r = await postWebhook(URL_, { content: 'x' }, { fetch: f });
      expect(r.outcome).toBe(outcome);
      expect(r.status).toBe(status);
    }
  });

  it('returns the first 500 chars of the body on drop', async () => {
    const f = fakeFetch(res(400, 'a'.repeat(900)));
    const r = await postWebhook(URL_, {}, { fetch: f });
    expect(r.body).toBe('a'.repeat(500));
  });

  it('retries 429 after retry_after seconds and returns ok on the next 204', async () => {
    const f = fakeFetch(
      res(429, JSON.stringify({ retry_after: 1.5 })),
      res(204),
    );
    const sleep = vi.fn(async () => {});
    const r = await postWebhook(URL_, {}, { fetch: f, sleep });
    expect(r.outcome).toBe('ok');
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1500);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('gives up after 60s of retry_after', async () => {
    const f = vi.fn(async () => res(429, JSON.stringify({ retry_after: 40 })));
    const sleep = vi.fn(async () => {});
    const r = await postWebhook(URL_, {}, { fetch: f, sleep });
    expect(r.outcome).toBe('transient');
    expect(r.status).toBe(429);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(40_000);
    expect(RATE_LIMIT_BUDGET_MS).toBe(60_000);
  });

  it('treats a thrown fetch (network/timeout) as transient', async () => {
    const f = fakeFetch(new Error('boom'));
    const r = await postWebhook(URL_, {}, { fetch: f });
    expect(r).toEqual({ outcome: 'transient', status: null });
  });

  it('posts to url?wait=false with JSON content-type', async () => {
    const f = fakeFetch(res(204));
    await postWebhook(URL_, { content: 'hi' }, { fetch: f });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`${URL_}?wait=false`);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe(
      'application/json',
    );
    expect(init?.body).toBe(JSON.stringify({ content: 'hi' }));
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(DISCORD_TIMEOUT_MS).toBe(10_000);
  });

  it('never leaks the url in the result', async () => {
    const f = fakeFetch(new Error(`failed ${URL_}`));
    const r = await postWebhook(URL_, {}, { fetch: f });
    expect(JSON.stringify(r)).not.toContain('secret-token');
  });
});

describe('getWebhookName', () => {
  it('returns the name on 200 and found:false on 404/401/403', async () => {
    expect(
      await getWebhookName(URL_, {
        fetch: fakeFetch(res(200, JSON.stringify({ name: 'Hook' }))),
      }),
    ).toEqual({ found: true, name: 'Hook' });
    expect(
      await getWebhookName(URL_, { fetch: fakeFetch(res(200, '{}')) }),
    ).toEqual({ found: true, name: null });
    for (const s of [404, 401, 403]) {
      expect(await getWebhookName(URL_, { fetch: fakeFetch(res(s)) })).toEqual({
        found: false,
      });
    }
  });

  it('throws without the url in the message on other statuses and network errors', async () => {
    await expect(
      getWebhookName(URL_, { fetch: fakeFetch(res(500)) }),
    ).rejects.toThrow(/^(?!.*secret-token)/);
    const err = await getWebhookName(URL_, {
      fetch: fakeFetch(new Error(`x ${URL_}`)),
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain('secret-token');
  });
});
