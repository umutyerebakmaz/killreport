# zKillboard RedisQ Real-Time Stream

## Overview

**Real-time killmail sync** using zKillboard's RedisQ service. This worker continuously polls RedisQ and automatically saves new killmails to the database as they happen in EVE Online.

### What is RedisQ?

RedisQ is zKillboard's public killmail streaming service. It provides a simple HTTP polling interface that delivers killmails in real-time without needing authentication.

- **Official Docs**: <https://github.com/zKillboard/RedisQ>
- **Endpoint**: `https://zkillredisq.stream/listen.php`
- **Method**: HTTP polling (not actual Redis Pub/Sub despite the name)

## Features

- 🔄 **Real-Time Sync**: Get killmails as they happen (usually within seconds)
- 🌊 **Continuous Stream**: Polls RedisQ every 500ms for new killmails
- 🚀 **No Auth Required**: Public service, no API keys needed
- 💾 **Auto Deduplication**: Skips killmails already in database
- ⚡ **Rate Limited**: Respects CloudFlare's 2 req/sec limit
- 🛡️ **Error Recovery**: Auto-reconnects on failures
- 📊 **Live Statistics**: Real-time stats on received/saved/skipped

## Architecture

```
┌─────────────────┐
│  zKillboard     │  New killmail detected
│  RedisQ         │──────┐
└─────────────────┘      │
                         │
                         ▼
                ┌────────────────┐
                │  RedisQ Poll   │  HTTP GET every 500ms
                │  (Our Worker)  │
                └────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  Package         │  Contains:
              │  - killID        │  - Killmail ID
              │  - hash          │  - ESI hash
              │  - zkb metadata  │  - Value, labels
              └──────────────────┘
                         │
                         ▼
                ┌────────────────┐
                │  ESI API       │  Fetch full killmail
                │  (Rate Limited)│
                └────────────────┘
                         │
                         ▼
                ┌────────────────┐
                │  PostgreSQL    │  Save killmail + attackers
                └────────────────┘
```

## How It Works

### 1. Polling Loop

Worker continuously polls RedisQ endpoint:

```
GET https://zkillredisq.stream/listen.php?queueID=killreport-stream&ttw=1
```

**Parameters:**

- `queueID`: Unique identifier for our service (remembers position for 3 hours)
- `ttw`: Time to wait (1-10 seconds) - how long to wait for next killmail

### 2. Response Format (After Dec 1, 2025)

RedisQ now returns **only metadata** (no full killmail):

```json
{
  "package": {
    "killID": 130678514,
    "zkb": {
      "locationID": 40030969,
      "hash": "145c457c34ce9c9e8d67e942e764d8f439b22271",
      "fittedValue": 3373417589.45,
      "totalValue": 3375084389.45,
      "points": 13,
      "npc": false,
      "solo": false,
      "labels": ["tz:ru", "cat:6", "pvp"],
      "href": "https://esi.evetech.net/v1/killmails/130678514/145c457c34ce9c9e8d67e942e764d8f439b22271/"
    }
  }
}
```

If no killmail available:

```json
{
  "package": null
}
```

### 3. Fetch Full Killmail from ESI

Using the `killID` and `hash`, we fetch complete data from ESI:

```
GET https://esi.evetech.net/latest/killmails/{killID}/{hash}/
```

This returns the full killmail with victim and attackers.

### 4. Save to Database

Worker saves:

- **Killmail** record (victim, location, time)
- **Attackers** records (all attackers with damage, final blow, etc.)

Automatic deduplication via unique constraint on `killmailId`.

## Usage

### Start the Worker

```bash
cd backend
yarn worker:redisq
```

**Output:**

```
🌊 RedisQ Stream Worker Started
📡 Endpoint: https://zkillredisq.stream/listen.php
🆔 Queue ID: killreport-stream
⏱️  Poll Rate: 500ms (~2 req/sec)
⏳ Timeout: 1 seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Listening for killmails...

📥 Fetching: 130678514 (3.38B ISK)
✅ Saved: 130678514 | Stats: 1 saved, 0 skipped, 0 errors (5s runtime)
⏭️  Skipped: 130678515 (already exists)
```

### Stop the Worker

Press `Ctrl+C` to gracefully shutdown:

```
🛑 Shutting down RedisQ stream worker...

📊 Final Statistics:
   Received: 142
   Saved: 89
   Skipped: 53
   Errors: 0
   Runtime: 3600 seconds
```

## Rate Limits & Performance

### CloudFlare Limit (RedisQ)

- **Rate**: 2 requests per second per IP
- **Response**: HTTP 429 if exceeded
- **Our Config**: 500ms delay = 2 req/sec (exactly at limit)

### ESI Limit

- **Rate**: 150 requests per second (official)
- **Our Config**: 50 req/sec (conservative, via `esiRateLimiter`)
- **Impact**: RedisQ is the bottleneck (2 req/sec), not ESI

### Typical Performance

- **Latency**: Killmails appear within 1-5 seconds of in-game event
- **Throughput**: ~2 killmails per second max (RedisQ limit)
- **Database**: ~1-2ms insert time per killmail
- **ESI Fetch**: ~100-300ms per killmail

## Error Handling

### Automatic Retries

1. **RedisQ 429 (Rate Limited)**: Back off for 5 seconds
2. **Network Errors**: Retry up to 3 times with 5s delay
3. **ESI Errors**: Skip killmail, log error, continue
4. **Database Errors**: Log error, continue (deduplication handles retries)

### Consecutive Errors

If 5+ consecutive errors occur, worker backs off for 5 seconds to prevent spam.

### Graceful Shutdown

Worker responds to `SIGINT` (Ctrl+C):

- Displays final statistics
- Closes database connection
- Exits cleanly

## Comparison: RedisQ vs Character Sync

| Feature           | RedisQ Stream      | Character Sync (`worker:zkillboard`) |
| ----------------- | ------------------ | ------------------------------------ |
| **Speed**         | Real-time (1-5s)   | Manual/scheduled                     |
| **Coverage**      | All EVE killmails  | Specific characters only             |
| **Auth Required** | No                 | Yes (for character API)              |
| **Rate Limit**    | 2 req/sec (RedisQ) | 10s between pages (zKillboard)       |
| **Historical**    | No (only new)      | Yes (can fetch all history)          |
| **Use Case**      | Live dashboard     | Character analysis                   |

### When to Use Each

**Use RedisQ Stream:**

- Live killmail feed
- Dashboard with recent activity
- Monitoring specific regions/alliances
- Public killboard clone

**Use Character Sync:**

- Historical analysis of specific characters
- Personal killmail history
- Targeted data collection
- Alliance/corp member tracking

## Configuration

Edit `backend/src/workers/worker-redisq-stream.ts`:

```typescript
const QUEUE_ID = "killreport-stream"; // Unique ID (change if running multiple instances)
const TIME_TO_WAIT = 1; // 1-10 seconds timeout
const REQUEST_DELAY = 500; // 500ms = 2 req/sec (CloudFlare limit)
const MAX_RETRIES = 3; // Number of retry attempts
const RETRY_DELAY = 5000; // 5s delay between retries
```

### Multiple Instances

You can run multiple workers with **different queue IDs**:

```bash
# Terminal 1: Default stream
QUEUE_ID=killreport-stream-1 yarn worker:redisq

# Terminal 2: Backup stream
QUEUE_ID=killreport-stream-2 yarn worker:redisq
```

Each queue ID maintains its own position in the RedisQ stream.

## Filtering (Optional)

RedisQ supports filters to only receive specific killmails:

```typescript
// Example: Only high-value kills (1B+ ISK)
const url = `${REDISQ_URL}?queueID=${QUEUE_ID}&ttw=${TIME_TO_WAIT}&filter=totalValue>=1000000000`;

// Example: Specific alliance
const url = `${REDISQ_URL}?queueID=${QUEUE_ID}&ttw=${TIME_TO_WAIT}&filter=alliance_id=434243723`;

// Example: Multiple conditions (AND)
const url = `${REDISQ_URL}?queueID=${QUEUE_ID}&ttw=${TIME_TO_WAIT}&filter=totalValue>=1000000000;pvp=true`;
```

See [RedisQ Filter Rules](https://github.com/zKillboard/RedisQ#redisq-filter-rules) for more options.

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start worker
cd backend
pm2 start "yarn worker:redisq" --name "killreport-redisq"

# Monitor
pm2 logs killreport-redisq
pm2 monit

# Auto-restart on crash
pm2 startup
pm2 save
```

### Using systemd

```ini
# /etc/systemd/system/killreport-redisq.service
[Unit]
Description=KillReport RedisQ Stream Worker
After=network.target postgresql.service

[Service]
Type=simple
User=killreport
WorkingDirectory=/opt/killreport/backend
ExecStart=/usr/bin/yarn worker:redisq
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable killreport-redisq
sudo systemctl start killreport-redisq
sudo journalctl -u killreport-redisq -f
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY backend/ ./
CMD ["yarn", "worker:redisq"]
```

## Monitoring

### GraphQL Query (if implemented)

```graphql
query {
  workerStatus {
    name
    status
    killmailsProcessed
    uptime
  }
}
```

### Database Query

```sql
-- Recent killmails from stream
SELECT
  killmailId,
  killmail_time,
  victim_damage_taken,
  (SELECT COUNT(*) FROM attackers WHERE killmail_id = killmails.id) as attacker_count
FROM killmails
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;
```

### Logs

Worker logs include:

- ✅ Saved killmails with ISK value
- ⏭️ Skipped (duplicates)
- ❌ Errors with stack traces
- 📊 Periodic statistics

## Troubleshooting

### No Killmails Appearing

1. **Check worker is running**: `ps aux | grep redisq`
2. **Verify RedisQ is accessible**: `curl https://zkillredisq.stream/listen.php?queueID=test`
3. **Check database connection**: Worker logs show connection errors
4. **Verify ESI is responding**: Check `esiRateLimiter` errors

### Too Many Rate Limit Errors (429)

- **Cause**: Polling too fast
- **Fix**: Increase `REQUEST_DELAY` to 600ms or higher

### Duplicate Killmails

- **Cause**: Multiple workers with same `QUEUE_ID`
- **Fix**: Use unique queue IDs or run single instance

### High Memory Usage

- **Cause**: ESI rate limiter queue growing
- **Fix**: Worker processes ~2 killmails/sec max, memory should stabilize

## Related Documentation

- [Character Killmail Sync](./CHARACTER_SYNC.MD) - Historical sync for specific characters
- [Worker Status Monitoring](./WORKER_STATUS_MONITORING.MD) - Monitor all workers
- [Enrichment System](./ENRICHMENT.MD) - Auto-populate character/corp/alliance data
- [RedisQ Official Docs](https://github.com/zKillboard/RedisQ) - zKillboard documentation

## Future Enhancements

- [ ] WebSocket support (if zKillboard adds it)
- [ ] Filter by region/constellation/system
- [ ] Alert system for high-value kills
- [ ] Statistics dashboard in GraphQL
- [ ] Killmail notifications (Discord/Telegram)
- [ ] Historical backfill mode (combine with character sync)
