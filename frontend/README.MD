# KillReport Frontend

Next.js 16 App Router client for the KillReport GraphQL API.

## Quick Start

```bash
# From the repo root (Yarn workspaces — install once for both packages)
yarn install

cd frontend
cp .env.example .env.local
# Edit .env.local if the backend is not on http://localhost:4000

yarn dev   # http://localhost:3000
```

The backend must be running for anything to render — see the
[backend README](../backend/README.MD).

## Environment Variables

Copy `.env.example` to `.env.local`. Only `NEXT_PUBLIC_*` variables reach the
browser, and everything in that file is bundled into client-side JavaScript, so it
must never contain secrets.

| Variable                  | Default                         | Purpose                                                                                             |
| ------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GRAPHQL_URL` | `http://localhost:4000/graphql` | Queries and mutations. The subscription WebSocket URL is derived from this by swapping `http`→`ws`. |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000`         | Backend origin, used by the EVE SSO callback page.                                                  |

## Scripts

```bash
yarn dev            # Dev server with Turbopack on port 3000
yarn build          # Production build
yarn start          # Serve the production build
yarn lint           # ESLint
yarn codegen        # Regenerate GraphQL types and hooks
yarn codegen:watch  # Same, in watch mode
yarn kill:port      # Free port 3000 if a stale dev server is holding it
```

`yarn dev` and `yarn build` kill any lingering `next dev` process first — running
two dev servers against the same `.next` directory corrupts the build cache.

## Project Structure

```text
src/
├── app/          # App Router routes (see below)
├── components/   # 40 component directories + a few standalone .tsx files
├── graphql/      # .graphql documents — the source for codegen
├── generated/    # Auto-generated types and Apollo hooks (do not edit)
├── hooks/        # useAuth, useDebounce
├── lib/          # apolloClient.ts — HTTP + WebSocket link setup
└── utils/        # ISK/date formatting, security status, ship tier helpers
```

### Routes

| Route                                                                                                          | Purpose                                       |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `/killmails`, `/killmails/[id]`                                                                                | Killmail list and detail                      |
| `/characters/[id]`, `/corporations/[id]`, `/alliances/[id]`                                                    | Entity profiles and stats                     |
| `/regions/[id]`, `/constellations/[id]`, `/solar-systems/[id]`                                                 | Universe browsing                             |
| `/leaderboards`                                                                                                | Top pilots, corporations, alliances and ships |
| `/sovereignty`, `/sovereignty/map`, `/sovereignty/history`, `/sovereignty/hotspots`, `/sovereignty/structures` | Sovereignty tracking                          |
| `/workers`                                                                                                     | Live background worker and queue status       |
| `/auth/callback`, `/auth/success`                                                                              | EVE SSO login flow                            |
| `/legal`, `/privacy`, `/terms`, `/changelog`                                                                   | Static pages                                  |

## GraphQL Workflow

Operations are written as `.graphql` documents in `src/graphql/`, never inline in
components. Codegen reads them together with the backend schema and produces typed
hooks.

```bash
# 1. Add or edit a document, e.g. src/graphql/Killmails.graphql
# 2. Regenerate (the backend schema must be up to date first)
yarn codegen
# 3. Import the generated hook
```

```tsx
import { useKillmailsQuery } from '@/generated/graphql';

const { data, loading, error } = useKillmailsQuery({
  variables: { limit: 20 },
});
```

Codegen reads the schema from `../backend/src/generated-schema.graphql`. If a new
backend field is missing from the generated types, regenerate the backend schema
first (`cd backend && yarn codegen`), then run `yarn codegen` here.

Config: [`codegen.ts`](./codegen.ts).

## Apollo Client

[`src/lib/apolloClient.ts`](./src/lib/apolloClient.ts) builds a single lazily
initialised client with a split link:

- **Queries and mutations** go over HTTP, through an auth link that attaches the
  EVE access token and a session ID, and an error link that transparently refreshes
  an expired token and retries the operation once.
- **Subscriptions** go over WebSocket via `graphql-ws`. Browsers cannot set headers
  on a WebSocket handshake, so auth and session ID travel in `connectionParams`.

WebSocket rather than SSE is deliberate: SSE hit the browser's ~6-connections-per-origin
HTTP/1.1 limit and starved regular GraphQL queries, leaving them stuck pending. See
[WebSocket deployment](../backend/docs/deployment/websocket-deployment.md) for the
Nginx upgrade headers this requires in production.

## Conventions

- Components live in `src/components/<ComponentName>/` — a directory per component is
  the dominant pattern; a handful of small ones are still bare `.tsx` files
- Never edit anything in `src/generated/` — it is overwritten by `yarn codegen`
- Keep GraphQL operations in `src/graphql/`, not inline in components

See [CONTRIBUTING.md](../.github/CONTRIBUTING.md) for the full coding guidelines.

## Documentation

The bulk of the project documentation lives on the backend side:
**[backend documentation index](../backend/docs/README.md)**.
