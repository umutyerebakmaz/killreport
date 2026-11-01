import type { DiscordPayload } from './discord-webhook.helpers';

/**
 * Minimal Discord webhook HTTP client. Not an ESI call, so it uses the global
 * `fetch`. It never logs, never throws from `postWebhook`, and never puts the
 * webhook URL in a return value or an error message.
 */

export type PostOutcome = 'ok' | 'disable' | 'drop' | 'transient';
export const RATE_LIMIT_BUDGET_MS = 60_000;
export const DISCORD_TIMEOUT_MS = 10_000;

const BODY_LIMIT = 500;
const DEFAULT_RETRY_AFTER_MS = 1_000;
const MIN_RETRY_AFTER_MS = 250;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, BODY_LIMIT);
  } catch {
    return '';
  }
}

async function readRetryAfterMs(response: Response): Promise<number> {
  try {
    const parsed: unknown = JSON.parse(await response.text());
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'retry_after' in parsed
    ) {
      const seconds = Number((parsed as { retry_after: unknown }).retry_after);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.ceil(seconds * 1000);
      }
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_RETRY_AFTER_MS;
}

export async function postWebhook(
  url: string,
  payload: DiscordPayload,
  deps: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ outcome: PostOutcome; status: number | null; body?: string }> {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  let waited = 0;

  for (;;) {
    let response: Response;
    try {
      response = await doFetch(`${url}?wait=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
      });
    } catch {
      return { outcome: 'transient', status: null };
    }

    const status = response.status;
    if (status === 200 || status === 204) return { outcome: 'ok', status };
    if (status === 401 || status === 403 || status === 404) {
      return { outcome: 'disable', status };
    }
    if (status === 429) {
      const delay = Math.max(
        await readRetryAfterMs(response),
        MIN_RETRY_AFTER_MS,
      );
      if (waited + delay > RATE_LIMIT_BUDGET_MS) {
        return { outcome: 'transient', status };
      }
      waited += delay;
      await sleep(delay);
      continue;
    }
    if (status >= 400 && status < 500) {
      return { outcome: 'drop', status, body: await readBody(response) };
    }
    return { outcome: 'transient', status };
  }
}

export async function getWebhookName(
  url: string,
  deps: { fetch?: typeof fetch } = {},
): Promise<{ found: true; name: string | null } | { found: false }> {
  const doFetch = deps.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
  } catch {
    throw new Error('Discord webhook lookup failed');
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404
  ) {
    return { found: false };
  }
  if (response.status !== 200) {
    throw new Error('Discord webhook lookup failed');
  }
  try {
    const body = (await response.json()) as { name?: unknown };
    return {
      found: true,
      name: typeof body.name === 'string' ? body.name : null,
    };
  } catch {
    throw new Error('Discord webhook lookup failed');
  }
}
