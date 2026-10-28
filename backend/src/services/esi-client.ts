/**
 * The single HTTP client for ESI. Every caller goes through `esiClient.get`,
 * which asks `esiRateLimiter` for a slot first, reports the response back to it
 * and always gives the slot up again. See
 * docs/superpowers/specs/2026-10-28-esi-rate-limiter-design.md.
 */

import {
  EsiThrottledError,
  esiRateLimiter,
  type EsiThrottleKind,
} from '@services/rate-limiter';
import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import pkg from '../../package.json';

const ESI_BASE_URL = 'https://esi.evetech.net';
const COMPATIBILITY_DATE = '2020-01-01';

export interface EsiRequestOptions {
  params?: Record<string, string | number>;
  headers?: Record<string, string>; // e.g. Authorization
  bucketKey?: string; // character id for authenticated grouped routes
}

let maxWaitMs: number | undefined;

/** Process-wide; called once at startup by the API server and the live stream. */
export function setEsiMaxWait(ms: number | undefined): void {
  maxWaitMs = ms;
}

/** AxiosHeaders is a class instance; the limiter wants plain lower-case keys. */
function plainHeaders(
  headers: AxiosResponse['headers'] | undefined,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined || value === null) continue;
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

function throttleKind(
  status: 420 | 429,
  headers: Record<string, string | undefined>,
): EsiThrottleKind {
  if (status === 420) return 'error-limit';
  return headers['x-ratelimit-group'] ? 'rate-limit' : 'deep-limit';
}

/** Axios errors carry the outgoing Authorization header; callers log whole errors. */
function redactAuthorization(error: AxiosError): void {
  const headers = error.config?.headers;
  for (const key of Object.keys(headers ?? {})) {
    if (key.toLowerCase() === 'authorization') headers![key] = '[redacted]';
  }
  // the raw request (and its header text) also lives on the response
  delete (error as { request?: unknown }).request;
  if (error.response) delete (error.response as { request?: unknown }).request;
}

export function createEsiClient(adapter?: AxiosAdapter) {
  const instance = axios.create({
    baseURL: ESI_BASE_URL,
    headers: {
      'User-Agent': `KillReport/${pkg.version} (+https://github.com/umutyerebakmaz/killreport)`,
      'X-Compatibility-Date': COMPATIBILITY_DATE,
    },
    // A stalled socket would never reach the finally below and would hold a limiter slot forever.
    timeout: 30_000,
    ...(adapter ? { adapter } : {}),
  });

  return {
    async get<T = unknown>(
      path: string,
      opts: EsiRequestOptions = {},
    ): Promise<AxiosResponse<T>> {
      const route = { path, bucketKey: opts.bucketKey };
      await esiRateLimiter.acquire(
        route,
        maxWaitMs === undefined ? {} : { maxWaitMs },
      );
      try {
        const res = await instance.get<T>(path, {
          params: opts.params,
          headers: opts.headers,
        });
        esiRateLimiter.observe(route, res.status, plainHeaders(res.headers));
        return res;
      } catch (error) {
        if (!(error instanceof AxiosError)) throw error;
        redactAuthorization(error);
        if (!error.response) throw error;
        const { status } = error.response;
        const headers = plainHeaders(error.response.headers);
        esiRateLimiter.observe(route, status, headers);
        if (status === 420 || status === 429) {
          const thrown = new EsiThrottledError(
            status,
            throttleKind(status, headers),
            `ESI ${status} on ${path}`,
          );
          thrown.cause = error;
          throw thrown;
        }
        throw error;
      } finally {
        esiRateLimiter.release();
      }
    },
  };
}

export const esiClient = createEsiClient();
