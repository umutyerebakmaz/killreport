# Sovereignty Cluster C3 — In-App War Alerts — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-c3-alerts-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope:** broadcast in-app SSE alerts (campaign started / ended / territory change) → toasts +
header bell + localStorage recent list; client-side favorite-alliance filter. No migration, no
watchlist table, no email/Discord.

---

## Backend
- [ ] `pubsub.ts`: add `SOVEREIGNTY_ALERT` channel + payload type
- [ ] `src/schemas/SovereigntyAlert.graphql`: `SovereigntyAlert` type + `extend type Subscription`
- [ ] `src/resolvers/sovereignty/subscriptions.ts`: subscribe + resolve (hydrate names, build message)
- [ ] Register `...sovereigntySubscriptions` in `resolvers/index.ts` Subscription map
- [ ] `cd backend && yarn codegen`
- [ ] `worker-sovereignty-campaigns.ts`: emit campaign_started (new ids) + campaign_ended (departing)
- [ ] `worker-sovereignty-map.ts`: emit territory_change per detected change
- [ ] `ecosystem.config.js`: add `USE_REDIS_PUBSUB: 'true'` to the two workers' PM2 env

## Frontend
- [ ] `src/graphql/SovereigntyAlertSubscription.graphql` + codegen
- [ ] `components/Sovereignty/SovereigntyAlertsProvider.tsx` (subscription + toast + localStorage recent + fav filter)
- [ ] `components/Sovereignty/AlertToast.tsx` (styled toast, auto-dismiss)
- [ ] `components/Notifications/NotificationBell.tsx` (bell + unread badge + dropdown) in Header
- [ ] Mount provider in `app/layout.tsx`
- [ ] Verify (synthetic publish + browser)

## Wrap-up
- [ ] `/code-review`
- [ ] Commit + push
