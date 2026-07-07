# Sovereignty Cluster C3 — In-App War Alerts (Design)

**Date:** 2026-07-05
**Branch:** `feature/sov`
**Status:** Design — awaiting user review
**Parent:** `2026-07-05-sovereignty-remaining-features-design.md` (Cluster C)
**Depends on:** Clusters A + B + C1 + C2 (shipped)

---

## 1. What this is

Real-time **in-app** sovereignty alerts, pushed over the existing SSE pipeline: when a sov worker
detects an event (a campaign starts, a campaign resolves, a system changes hands), it publishes an
alert that streams live to every open browser and surfaces as a toast + a header notification bell.

Channel decision (from the user): **in-app SSE** — reuse the existing PubSub → SSE → Apollo path.
No email/Discord/web-push this cycle.

### Infra facts (verified)

- `pubsub` (`services/pubsub.ts`) is **Redis-backed** (`USE_REDIS_PUBSUB=true` in `.env`), so a
  publish from a **cron worker process** reaches subscribers on the **API-server process** — this
  is exactly how `NEW_KILLMAIL` already works (the redisq worker publishes; browsers receive).
- Subscriptions ride GraphQL Yoga's SSE transport; the frontend already wires an `SSELink` via
  `split()` in `lib/apolloClient.ts`, so a new subscription op is routed to SSE automatically.
- Subscription resolver `context.user` is available (EVE SSO Bearer), but see §2 — we do **not**
  need it this cycle.
- No notification bell exists today; `KillmailToastContainer` exists (per-page, currently
  disabled) as a style reference. Both bell and a global mount are net-new.

---

## 2. Scope & key decisions

**In scope**

- A **broadcast** alert stream (`sovereigntyAlert` subscription) — every subscriber gets every sov
  alert. Three event types, emitted by the workers that already detect them:
  - `campaign_started` — a new campaign appears (campaigns worker).
  - `campaign_ended` — a campaign resolves, with its inferred `outcome` (campaigns worker).
  - `territory_change` — a system changes sovereignty (map worker).
- **Global delivery UI:** a client `SovereigntyAlertsProvider` mounted in the root layout runs the
  subscription on every page, shows a **toast** per new alert, and keeps a rolling recent list
  (last 30, in `localStorage`) behind a **header notification bell** with an unread count +
  dropdown.
- **Favorite-alliance filter, client-side:** a small "favorite alliances" set kept in
  `localStorage` (togglable from the existing `AllianceLink`/alliance pages later, or a simple
  input for now); when non-empty, toasts fire only for alerts involving a favorited alliance
  (the bell still logs all). This delivers "favorite alliance under attack" **without a backend
  watchlist table**.

**Deferred (own spec, with reason)**

- **Server-side per-user watchlists** (a `UserWatchlist` table + auth-scoped subscription
  filtering) — needs a migration and per-user server state; the client-side localStorage filter
  covers the need for now.
- **Persisted notification inbox** (a `notifications` table / history across devices) — bigger;
  the localStorage recent-list is the lean version.
- **Email / Discord / web-push** delivery, and **structure-vulnerability-timer** alerts
  (timer-based, not a discrete worker-detected event).

---

## 3. Backend

### 3.1 PubSub channel + payload

`services/pubsub.ts` — add to `PubSubChannels`:

```ts
'SOVEREIGNTY_ALERT': [SovereigntyAlertPayload];
// { type: 'campaign_started' | 'campaign_ended' | 'territory_change',
//   systemId: number, defenderId?: number|null, outcome?: string|null,
//   previousOwnerId?: number|null, newOwnerId?: number|null, changeType?: string|null }
```

The worker publishes ids + type (like `NEW_KILLMAIL` publishes only an id); the subscription
`resolve` hydrates names and builds the message.

### 3.2 Schema + subscription resolver

New `src/schemas/SovereigntyAlert.graphql`:

```graphql
type SovereigntyAlert {
  type: String!            # campaign_started | campaign_ended | territory_change
  message: String!         # human-readable, built in resolve
  solarSystemId: Int!
  solarSystemName: String
  regionName: String
  allianceId: Int          # the salient alliance (defender / new owner)
  allianceName: String
  allianceTicker: String
  outcome: String          # for campaign_ended
  changeType: String       # for territory_change
  timestamp: String!
}
extend type Subscription {
  sovereigntyAlert: SovereigntyAlert!
}
```

New `src/resolvers/sovereignty/subscriptions.ts`: `subscribe: () => pubsub.subscribe('SOVEREIGNTY_ALERT')`,
`resolve: async (payload) => …` — enrich system/region/alliance names (reuse the same
`allianceNames`/`systemInfo`/region logic; extract shared helpers if needed), compose `message`
(e.g. "New IHub campaign in EH2I-P (Perrigen Falls)"), stamp `timestamp`. Register
`...sovereigntySubscriptions` in the `resolvers/index.ts` `Subscription:` map.

### 3.3 Worker emit points

- `worker-sovereignty-campaigns.ts`: before upserting, load existing campaign ids; after upsert,
  publish `campaign_started` for ids that were **not** previously present. In the end-marking loop,
  publish `campaign_ended` (with `outcome`) for each departing campaign.
- `worker-sovereignty-map.ts`: for each `TerritoryChange` row it writes, publish `territory_change`.
- Import `pubsub`; publish after the DB write. (Add `USE_REDIS_PUBSUB: 'true'` to those workers'
  PM2 env blocks in `ecosystem.config.js` to be safe — `.env` already sets it, but explicit is
  better.)

No migration (all read/emit; no new tables).

## 4. Frontend

- `src/graphql/SovereigntyAlertSubscription.graphql` → `useSovereigntyAlertSubscription` (SSE routing
  automatic).
- `components/Sovereignty/SovereigntyAlertsProvider.tsx` (`"use client"`) — runs the subscription;
  on each alert: push a toast, prepend to a `localStorage` recent list (cap 30), bump unread count;
  applies the favorite-alliance filter to toasts. Mounted once in the root layout
  (`app/layout.tsx`) so alerts work app-wide.
- `components/Sovereignty/AlertToast.tsx` — a toast styled like `KillmailToast` (auto-dismiss ~8s),
  color-coded by type.
- `components/Notifications/NotificationBell.tsx` — a bell in `Header.tsx` with an unread badge and
  a dropdown of the recent alerts (each linking to the system/region); "mark all read" clears the
  count.

## 5. Verification

Alerts are event-driven; locally there may be no new campaigns/territory-changes during a test
window. Verify by **injecting a synthetic publish** — a tiny script calling
`pubsub.publish('SOVEREIGNTY_ALERT', {...})` (the same technique used to verify war-kill
aggregation earlier) — with a browser open, and confirm the toast appears, the bell count
increments, and the dropdown lists it. Also run the campaigns/map workers to confirm no errors on
the new publish path. `npx playwright` for the screenshot (MCP browsers broken in this WSL env).

## 6. Conventions & build order

Follows the Cluster A conventions reference. Order: (1) pubsub channel + `SovereigntyAlert` schema
+ subscription resolver + register + `yarn codegen`; (2) worker emit points; (3) frontend op +
codegen + provider + toast + bell + layout mount + Header; (4) verify (synthetic publish + browser)
+ `/code-review`. **No migration.**

## 7. Decisions made (user chose in-app SSE; sub-decisions on best judgment — flag for review)

1. **Broadcast stream** (not server-side per-user filtering) — no watchlist table this cycle.
2. **Three alert types:** campaign_started, campaign_ended (outcome), territory_change.
3. **Global provider + header bell + toasts;** recent list + unread count in `localStorage`
   (ephemeral, no backend inbox).
4. **Favorite-alliance filter client-side** (localStorage) so toasts can be narrowed without a DB.
5. **No migration; no email/Discord; no structure-timer alerts** (deferred).

If you'd rather have server-side per-user watchlists or a persisted inbox now, say so — that adds a
migration and changes the shape.
