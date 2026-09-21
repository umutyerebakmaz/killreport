import { Plugin } from 'graphql-yoga';

/**
 * Writes whatever a resolver put on `context.setCookies` out as `Set-Cookie`.
 *
 * Yoga has no cookie support of its own at 5.21.2 and this needs two headers
 * at most — the sliding refresh and the logout clear — so a dependency would
 * be more moving parts than the problem has. Reading happens in the context
 * factory; this half only writes.
 *
 * `onResponse`'s `serverContext` and the GraphQL execution context are the
 * same object here, not two objects that happen to agree: `createServerAdapter`
 * (`@whatwg-node/server`) threads one `serverContext` reference through
 * `onRequest`, the request handler and `onResponse`, and Yoga's non-batched
 * `handle()` passes that exact reference into context building unchanged
 * (`getResultForParams({ params, request }, serverContext)` in
 * `graphql-yoga/esm/server.js`). Envelop's `useExtendContext` — which wraps
 * this server's `context` option — then does `Object.assign(initialContext,
 * result)` (`@envelop/core/esm/orchestrator.js`), mutating that same object in
 * place rather than replacing it. So whatever the context factory returns
 * lands on the very object `onResponse` reads here. (Batched requests are the
 * one path where this would break — Yoga builds each operation's context on
 * `Object.create(serverContext)` — but this server has `batching` unset,
 * which defaults to `false`.)
 */
export const createCookiesPlugin = (): Plugin => ({
  onResponse({ response, serverContext }) {
    const cookies = (serverContext as { setCookies?: string[] })?.setCookies;
    if (!cookies?.length) return;

    for (const cookie of cookies) {
      response.headers.append('Set-Cookie', cookie);
    }
  },
});
