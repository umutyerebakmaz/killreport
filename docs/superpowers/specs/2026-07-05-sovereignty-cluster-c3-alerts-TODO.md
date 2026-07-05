# Sovereignty Cluster C3 — In-App War Alerts — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-c3-alerts-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope:** broadcast in-app SSE alerts (campaign started / ended / territory change) → toasts +
header bell + localStorage recent list; client-side favorite-alliance filter. No migration, no
watchlist table, no email/Discord.

---

## Backend
- [x] `pubsub.ts`: add `SOVEREIGNTY_ALERT` channel + payload type
- [x] `src/schemas/SovereigntyAlert.graphql`: `SovereigntyAlert` type + `extend type Subscription`
- [x] `src/resolvers/sovereignty/subscriptions.ts`: subscribe + resolve (hydrate names, build message)
- [x] Register `...sovereigntySubscriptions` in `resolvers/index.ts` Subscription map
- [x] `cd backend && yarn codegen`
- [x] `worker-sovereignty-campaigns.ts`: emit campaign_started (new ids) + campaign_ended (departing)
- [x] `worker-sovereignty-map.ts`: emit territory_change per detected change
- [x] `ecosystem.config.js`: add `USE_REDIS_PUBSUB: 'true'` to the two workers' PM2 env

## Frontend
- [x] `src/graphql/SovereigntyAlertSubscription.graphql` + codegen
- [x] `components/Sovereignty/SovereigntyAlertsProvider.tsx` (subscription + toast + localStorage recent + fav filter)
- [x] `components/Sovereignty/AlertToast.tsx` (styled toast, auto-dismiss)
- [x] `components/Notifications/NotificationBell.tsx` (bell + unread badge + dropdown) in Header
- [x] Mount provider in `app/layout.tsx`
- [x] Verify (synthetic publish + browser)

## Wrap-up
- [ ] `/code-review`
- [ ] Commit + push
