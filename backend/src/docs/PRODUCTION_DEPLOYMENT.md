# Production Deployment Guide - Killmail Tracking

## Overview

This system allows **real-time killmail tracking WITHOUT zKillboard dependency** for logged-in users. Users grant SSO permissions and the system automatically syncs their killmails from ESI every 15 minutes.

## 🎯 What Works in Production

### ✅ Real-Time Tracking (No zKillboard)

- Users login → Grant SSO permissions → Automatic sync starts
- Every 15 minutes: New killmails are automatically fetched
- **Forward-looking**: All NEW killmails from login onwards are captured
- No manual intervention needed

### ✅ Character Killmails

- Personal kills and losses for logged-in users
- Automatically synced via `esi-killmails.read_killmails.v1` scope
- ~100-150 killmails on first sync (ESI recent limit)
- Incremental sync for new killmails

### ✅ Corporation Killmails (Optional)

- Directors/CEOs can sync entire corporation killmails
- Much larger data set (~2,500 killmails)
- Requires `esi-killmails.read_corporation_killmails.v1` scope
- Perfect for alliance/corp leadership

## ⚠️ Limitations to Communicate to Users

### ESI "Recent" Limitation

```
ESI only provides RECENT killmails:
- Character endpoint: ~100-150 killmails (last 1 month)
- Corporation endpoint: ~2,500 killmails (last 1-2 months)

This means:
❌ Historical data before login is NOT available via ESI
✅ All NEW killmails after login ARE captured
✅ Over time, you build a complete forward-looking database
```

### Historical Data Option

For users who want historical data, you can still use zKillboard:

```bash
# One-time historical sync (optional)
yarn queue:zkillboard <character_id>
yarn worker:zkillboard
```

## 🚀 Production Setup

### 1. Environment Variables

Ensure these are set in production:

```bash
# ESI/EVE SSO
EVE_CLIENT_ID=your_client_id
EVE_CLIENT_SECRET=your_client_secret
EVE_CALLBACK_URL=https://yourdomain.com/auth/callback

# Database
DATABASE_URL=postgresql://user:pass@host:5432/killreport

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672

# Redis (for GraphQL subscriptions)
REDIS_URL=redis://host:6379

# Server
NODE_ENV=production
PORT=4000
```

### 2. Required Workers

Run these workers as background services (PM2, systemd, Docker, etc.):

#### A. User Killmail Worker (REQUIRED)

```bash
yarn worker:user-killmails
```

- **Purpose**: Syncs logged-in users' character killmails
- **Concurrency**: 1 (prefetch=1, respects ESI rate limits)
- **Restart**: Always (should never stop)

#### B. Corporation Killmail Worker (OPTIONAL)

```bash
yarn worker:corporation-killmails
```

- **Purpose**: Syncs corporation killmails for Directors/CEOs
- **Concurrency**: 1 (prefetch=1, respects ESI rate limits)
- **Restart**: Always

#### C. Enrichment Workers (RECOMMENDED)

These populate related data (character names, corp names, ship types, etc.):

```bash
yarn worker:info:characters  # 10 concurrent
yarn worker:info:corporations  # 5 concurrent
yarn worker:info:alliances  # 3 concurrent
yarn worker:info:types  # 10 concurrent (ships, weapons, etc.)
```

### 3. Automated Queue Jobs (Cron/Scheduler)

#### Every 15 Minutes: Queue Users for Sync

```bash
*/15 * * * * cd /path/to/backend && yarn queue:user-killmails
```

- Queues users who haven't been synced in last 15 minutes
- Automatic incremental sync (only fetches NEW killmails)

#### Every 15 Minutes: Queue Corporation Syncs

```bash
*/15 * * * * cd /path/to/backend && yarn queue:corporation-killmails
```

- Only for users with Director/CEO roles
- Much more data per sync

#### Daily: Full Sync (Optional)

```bash
0 0 * * * cd /path/to/backend && yarn queue:user-killmails --force --full
```

- Forces sync for all users regardless of last sync time
- Fetches all available killmails (not just new ones)
- Good for catching any gaps

### 4. PM2 Configuration (Example)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "killreport-api",
      script: "src/server.ts",
      interpreter: "tsx",
      cwd: "./backend",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
    },
    {
      name: "worker-user-killmails",
      script: "src/workers/worker-esi-user-killmails.ts",
      interpreter: "tsx",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: "worker-corp-killmails",
      script: "src/workers/worker-esi-corporation-killmails.ts",
      interpreter: "tsx",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: "worker-characters",
      script: "src/workers/worker-info-characters.ts",
      interpreter: "tsx",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: "worker-corporations",
      script: "src/workers/worker-info-corporations.ts",
      interpreter: "tsx",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
```

Start with:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Initial User Onboarding Flow

When a user first logs in:

1. **Frontend**: User clicks "Login with EVE SSO"
2. **Backend**: Redirects to EVE SSO with required scopes:
   - `esi-killmails.read_killmails.v1` (character killmails)
   - `esi-killmails.read_corporation_killmails.v1` (corp killmails - optional)
3. **User**: Grants permissions
4. **Backend**:
   - Saves user with `access_token`, `refresh_token`, `corporation_id`
   - Automatically queues user for first killmail sync (high priority)
5. **Worker**:
   - Picks up job immediately
   - Fetches ~100-150 recent killmails
   - User sees data within 1-2 minutes

### 6. Ongoing Sync

After initial login:

- Cron job runs every 15 minutes
- Queues all active users (token not expired, synced >15 min ago)
- Workers process incrementally (only NEW killmails)
- Users see real-time updates without any action

## 📈 Expected Data Growth

### Per User

```
Initial sync: ~100 killmails
After 1 week: +50-200 new killmails (active PvP user)
After 1 month: +200-800 new killmails
After 1 year: Complete killmail history from login date
```

### Per Corporation (Director/CEO)

```
Initial sync: ~2,500 killmails
After 1 week: +100-500 new killmails (active corp)
After 1 month: +500-2000 new killmails
After 1 year: Complete corp history from login date
```

## 🎯 User Communication Strategy

### On Homepage/FAQ

```
Q: Do I get my full killmail history?
A: We track all NEW killmails from the moment you login.
   Historical data (before login) is limited by EVE's API to ~100 recent killmails.

Q: How often are killmails updated?
A: Every 15 minutes automatically. No action needed!

Q: Do I need to use zKillboard?
A: No! We sync directly from EVE's API. However, zKillboard is useful
   for one-time historical imports if you want older data.

Q: What if I'm a Corporation Director?
A: You can sync your entire corporation's killmails (up to 2,500 at once)!
   Enable this in your profile settings.
```

### First Login Message (Frontend)

```
Welcome to KillReport!

✅ Your character is now synced
📊 First sync in progress (~100 recent killmails)
🔄 New killmails will be tracked automatically every 15 minutes

Note: We start tracking from today. For older killmails,
you can optionally import from zKillboard in Settings.
```

## 🔍 Monitoring & Health Checks

### Check Worker Status

```bash
# Via GraphQL
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}

# Via RabbitMQ Management UI
http://your-server:15672
```

### Check Sync Health

```bash
# How many users are being synced?
SELECT COUNT(*) FROM users WHERE last_killmail_sync_at > NOW() - INTERVAL '1 hour';

# How many new killmails in last hour?
SELECT COUNT(*) FROM killmails WHERE created_at > NOW() - INTERVAL '1 hour';

# Users with expired tokens
SELECT COUNT(*) FROM users WHERE expires_at < NOW();
```

## 🛡️ Error Handling

### Token Expiry

- Workers automatically refresh tokens using `refresh_token`
- If refresh fails, user is skipped (needs to re-login)
- Frontend should detect expired sessions and prompt re-login

### Permission Errors (403)

- Corporation killmails: User lacks Director/CEO role
- Logged and skipped (don't retry)
- User should see clear message in UI

### Rate Limiting (420)

- Workers automatically retry with backoff
- ESI allows 150 req/sec, we use 50 req/sec per worker
- Multiple workers share the limit safely

## 🎛️ Advanced: Multi-Region Deployment

If deploying to multiple regions (US, EU, Asia):

```
Option 1: Single Database + Workers per Region
- All regions write to same PostgreSQL
- Workers in each region for lower latency
- RabbitMQ shared or regional with replication

Option 2: Regional Databases + Sync
- Each region has own DB
- Background job syncs between regions
- Users routed to nearest region
```

## 📊 Scaling Considerations

### Database

- Killmails table will grow: ~1M rows per year (1000 active users)
- Add partitioning by date if needed
- Regular vacuum and analyze

### Workers

- Each worker type can scale horizontally
- Use different RabbitMQ queues for different priorities
- Monitor queue depth, add workers if backlog grows

### API

- GraphQL server is stateless, scale horizontally
- Use Redis for subscription events
- Consider CDN for frontend assets

## 🔐 Security Checklist

- [ ] Store tokens encrypted at rest (optional but recommended)
- [ ] Rotate `EVE_CLIENT_SECRET` periodically
- [ ] Use HTTPS only in production
- [ ] Implement rate limiting on GraphQL API
- [ ] Monitor for suspicious login patterns
- [ ] Keep dependencies updated (Dependabot/Renovate)

## 📝 Summary

**YES, you can track killmails in production WITHOUT zKillboard!**

✅ Real-time sync every 15 minutes
✅ Automatic token refresh
✅ Forward-looking (captures all new killmails)
✅ Optional corporation-wide tracking
✅ Scales with user base

⚠️ Historical data limited (~100 killmails on first login)
💡 Hybrid approach: ESI for real-time + zKillboard for historical

Users grant SSO once, then forget about it. System handles everything automatically!
