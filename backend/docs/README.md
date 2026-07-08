# KillReport Backend Documentation

Reference and operational docs for the KillReport backend. Start with the
[architecture overview](architecture.md), then dive into a section below.

## Architecture

- [Architecture](architecture.md) — independent-process architecture and how the pieces fit together

## API

- [Rate Limiting](api/rate-limiting.md) — GraphQL API rate limiting

## Authentication

- [Auth Setup](authentication/auth-setup.md) — complete authentication flow setup
- [EVE SSO Integration](authentication/eve-sso-readme.md) — EVE Online SSO integration
- [EVE SSO Token Lifetime](authentication/eve-sso-token-lifetime.md) — token lifetime behavior
- [Token Refresh](authentication/token-refresh-implementation.md) — token refresh system

## ESI

- [Dogma Hierarchy](esi/esi-dogma-hierarchy.md) — EVE ESI type dogma hierarchy
- [User Killmail Sync](esi/esi-user-killmail-sync.md) — ESI user killmail sync system
- [User Killmails Queue](esi/esi-user-killmails-queue.md) — `esi_user_killmails_queue` details

## Workers

- [Workers Documentation](workers/worker-documentation.md) — full worker system reference
- [Worker: Killmail](workers/worker-killmail.md) — killmail background worker
- [Worker Status Monitoring](workers/worker-status-monitoring.md) — monitoring worker health
- [Enrichment](workers/enrichment.md) — killmail enrichment system
- [Type Enrichment](workers/type-enrichment-workers.md) — type enrichment workers
- [Alliance](workers/alliance.md) — alliance sync workflow
- [Alliance–Corporation](workers/alliance-corporation.md) — alliance corporation enrichment
- [Alliance–Corporation–Character Enrichment](workers/alliance-corporation-character-enrichment.md) — combined enrichment
- [Alliance Snapshots](workers/alliance-snapshots.md) — alliance snapshot & metrics
- [Corporation Killmail Sync](workers/corporation-killmail-sync.md) — corporation killmails via ESI
- [Character Killmail Worker](workers/character-killmail-worker.md) — character killmail sync worker
- [Character Sync (Quick Reference)](workers/character-sync.md) — one-line sync commands
- [Character Refresh Cost Analysis](workers/character-refresh-cost-analysis.md) — refresh cost & performance
- [Capsule Value Calculation](workers/capsule-value-calculation.md) — pod (capsule) value calculation
- [Background Sync (Incremental)](workers/background-sync-incremental.md) — incremental background sync
- [Sovereignty Workers](workers/sovereignty-workers.md) — sovereignty worker flow & how to run
- [Backfill System](workers/backfill-system-ready.md) — backfill system readiness
- [Backfill Values Guide](workers/backfill-values-guide.md) — backfill killmail values

## Leaderboards

- [Leaderboards](leaderboards/leaderboards.md) — feature & architecture overview
- [Leaderboard Queries](leaderboards/leaderboard-queries.md) — query architecture
- [Kill Stats Realtime](leaderboards/kill-stats-realtime.md) — real-time kill stats updates
- [Real-time Daily Aggregates](leaderboards/real-time-daily-aggregates.md) — daily aggregate system
- [Top Charts Cost Analysis](leaderboards/top-charts-cost-analysis.md) — top charts cost analysis

## Redis & Caching

- [Cache Strategy](redis-cache/cache-strategy.md) — GraphQL response cache strategy
- [Cache Optimization Guide](redis-cache/cache-optimization.md) — cache performance guide
- [Cache Optimization Summary](redis-cache/cache-optimization-summary.md) — implementation summary
- [PostgreSQL Query Cache Analysis](redis-cache/postgresql-query-cache-analysis.md) — query cache analysis
- [Redis Memory Planning](redis-cache/redis-memory-planning.md) — memory planning
- [RedisQ Stream](redis-cache/redisq-stream.md) — zKillboard RedisQ real-time stream

## Operations

- [PM2](ops/pm2.md) — PM2 process management
- [Crontab](ops/crontab.md) — crontab configuration
- [Daily Workflows](ops/daily.md) — daily backend workflows
- [Performance Improvements](ops/performance-improvements.md) — killmail query performance

## Deployment

See the [deployment index](deployment/README.md) for the full list. Key docs:

- [Deployment Checklist](deployment/deployment-checklist.md) — DigitalOcean setup runbook
- [Production Deployment](deployment/production-deployment.md) — what works, limits, monitoring
- [Production Ready](deployment/production-ready.md) — zKillboard-free readiness
- [DigitalOcean Setup](deployment/digitalocean-setup.md) — server setup guide
- [WebSocket Deployment](deployment/websocket-deployment.md) — WebSocket subscriptions deploy
- [Auth Callback Deployment](deployment/auth-callback-deployment.md) — EVE SSO auth callback deploy
- [Rate Limiting Deployment](deployment/rate-limiting-deployment.md) — rate limiting + Nginx config
- [Cost Comparison](deployment/cost-comparison.md) · [Expenses](deployment/expenses.md) — cost planning
