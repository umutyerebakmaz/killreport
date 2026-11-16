# ESI User Killmail Sync System

## Overview

This system **fetches killmails for users who have logged in via SSO directly from the ESI API** and saves them to the database. **It has no dependency on zKillboard** - it works completely independently.

## How It Works?

```
1. User logs in via SSO → Token saved to database
2. Queue script runs → Adds active users to queue
3. Worker consumes → Fetches killmails from ESI for each user
4. Saves to database → Triggers GraphQL subscription
```

## Features

- ✅ **ESI-only**: No zKillboard dependency
- ✅ **Token-based**: Uses the user's own access token
- ✅ **Auto-refresh**: Expired tokens are automatically renewed
- ✅ **Token validation**: Only users with valid tokens are added to queue
- ✅ **Pagination**: Up to 50 pages (2,500 killmails max, 50 per page)
- ✅ **Automatic enrichment**: Character/corp/alliance/type information automatic
- ✅ **Real-time updates**: GraphQL subscription events
- ✅ **Duplicate handling**: Skips killmails that already exist
- ✅ **Rate limit safe**: Respects ESI limits

## Setup and Usage

### Development Environment

#### 1. Add Users to Queue

```bash
cd backend
yarn queue:user-killmails
```

This command:

- Finds all users in the database with non-expired tokens
- Adds a message to the `esi_user_killmails_queue` for each user
- Makes them ready for worker processing

**Output:**

```
📡 Queueing users for ESI killmail sync...

✓ Found 3 active user(s) with valid tokens
📤 Adding to queue: esi_user_killmails_queue

  ⏳ Queued: General XAN (ID: 365974960)
  ⏳ Queued: Jane Smith (ID: 123456789)
  ⏳ Queued: Bob Wilson (ID: 987654321)

✅ Successfully queued 3 user(s)!

💡 Now run the worker to process them:
   yarn worker:user-killmails
```

#### 2. Start Worker

**Open a new terminal:**

```bash
cd backend
yarn worker:user-killmails
```

Worker does the following:

- Consumes messages from queue
- Fetches killmail list from ESI API for each user
- Gets details for each killmail
- Saves to database (killmail, victim, attackers, items)
- Triggers GraphQL subscription event

**Output:**

```
🔄 ESI User Killmail Worker Started
📦 Queue: esi_user_killmails_queue
⚡ Prefetch: 3 concurrent users
🌐 Data Source: ESI API (direct, no zKillboard)

✅ Connected to RabbitMQ
⏳ Waiting for user killmail jobs...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: General XAN (ID: 365974960)
🆔 User ID: 1
📅 Queued at: 2025-12-24T10:30:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📡 [General XAN] Fetching killmails from ESI...
     📄 Page 1: 50 killmails
     📄 Page 2: 50 killmails
     📄 Page 3: 12 killmails
     ✓ Last page (12 < 50)
     ✅ Total: 112 killmails from ESI
  📥 Total killmails found: 112
  💾 Processing killmails...

     📊 Progress: 50/112 (Saved: 45, Skipped: 5, Errors: 0)
     📊 Progress: 100/112 (Saved: 92, Skipped: 8, Errors: 0)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Saved: 100 new killmails
  ⏭️  Skipped: 12 (already in database)
  ❌ Errors: 0
  📊 Total processed: 112
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Completed: General XAN
```

### Production Environment (systemd)

#### Start Worker

```bash
# Start only the user-killmails worker
sudo systemctl start killreport-worker-user-killmails

# Watch logs
journalctl -u killreport-worker-user-killmails -f

# Check status
systemctl list-units 'killreport-*'
```

#### Queueing Users

The API server queues users itself every 10 minutes (`KillmailSyncCron` in [`killmail-sync-cron.ts`](../../src/services/killmail-sync-cron.ts)), so no timer is needed (see [systemd.md](../ops/systemd.md)). To queue them by hand now:

```bash
cd backend && yarn queue:user-killmails
```

## Technical Details

### Queue Message Format

```typescript
interface UserKillmailMessage {
  userId: number; // Database user ID
  characterId: number; // EVE character ID
  characterName: string; // Character name (for logging)
  accessToken: string; // ESI access token
  queuedAt: string; // ISO timestamp
}
```

### ESI Endpoints

Worker uses these endpoints:

1. **Character Killmails** (Authenticated):

   ```
   GET /characters/{character_id}/killmails/recent/?page={page}
   Headers: Authorization: Bearer {access_token}
   Returns: Array of {killmail_id, killmail_hash}
   Rate: 50 killmails per page, max 50 pages = 2,500 total
   ```

2. **Killmail Details** (Public):
   ```
   GET /killmails/{killmail_id}/{killmail_hash}/
   No authentication needed
   Returns: Full killmail details (victim, attackers, items)
   ```

### Rate Limiting

- **ESI Limit**: route-group token buckets and an error limit, paced by `esiClient` and the limiter from response headers
- **Worker Delay**: 50ms between killmail fetches
- **Concurrent Users**: 3 (PREFETCH_COUNT)
- **Safe**: ~20 requests/second per worker instance

### Database Schema

Worker updates these tables:

```sql
killmail (killmail_id, killmail_hash, killmail_time, solar_system_id)
victim (killmail_id, character_id, corporation_id, alliance_id, ship_type_id, damage_taken)
attacker (killmail_id, character_id, damage_done, final_blow, ...)
killmail_item (killmail_id, item_type_id, quantity_dropped, quantity_destroyed)
```

## Comparison: ESI-only vs zKillboard

| Feature                   | ESI User Killmails (This System)  | zKillboard Worker        |
| ------------------------- | --------------------------------- | ------------------------ |
| **Data Source**           | ESI API (direct)                  | zKillboard → ESI         |
| **Authentication**        | ✅ SSO Token required             | ❌ Public API            |
| **Killmail Limit**        | 2,500 (50 page × 50)              | Unlimited (full history) |
| **Scope Requirement**     | `esi-killmails.read_killmails.v1` | None                     |
| **Rate Limit**            | ESI: header-driven limiter        | zKillboard: 10s delay    |
| **Target Audience**       | Our own users                     | Any character            |
| **Real-time**             | ❌ (polling required)             | ✅ (RedisQ stream)       |
| **zKillboard Dependency** | ❌ None                           | ✅ Yes                   |

## Troubleshooting

### Problem: "No active users found"

**Cause**: No users with valid tokens in the database.

**Solution**: Users need to log in via SSO. Check the login flow in the frontend.

### Problem: "Failed to fetch killmails: 403"

**Cause**: Token expired or insufficient scope.

**Solution (Automatic)**:

- ✅ Worker automatically refreshes token (using refresh token)
- ✅ Database token is automatically updated
- ⚠️ If refresh token is also invalid, user needs to log in again

**Manual Check**:

- Ensure SSO scope includes `esi-killmails.read_killmails.v1`
- Refresh token must be saved in database

### Problem: Worker processing too slowly

**Cause**: Rate limiting or network latency.

**Solution**:

- Increase `PREFETCH_COUNT` value (carefully, don't exceed ESI rate limit)
- Reduce delay (50ms → 25ms) but don't exceed ESI limit

### Problem: Duplicate key errors (P2002)

**Normal**: Worker handles this automatically. Skips killmails that already exist.

## Monitoring

### Worker Status (GraphQL)

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### systemd Monitoring

```bash
# General status
systemctl list-units 'killreport-*'

# Memory usage
systemd-cgtop

# Logs
journalctl -u killreport-worker-user-killmails -n 100

# Restart
sudo systemctl restart killreport-worker-user-killmails
```

### Database Queries

```sql
-- Recently added killmails
SELECT k.killmail_id, k.killmail_time, c.name as victim_name
FROM killmail k
JOIN victim v ON k.killmail_id = v.killmail_id
JOIN character c ON v.character_id = c.character_id
ORDER BY k.killmail_time DESC
LIMIT 10;

-- Killmail count per user
SELECT u.character_name, COUNT(DISTINCT k.killmail_id) as killmail_count
FROM "user" u
LEFT JOIN victim v ON u.character_id = v.character_id
LEFT JOIN killmail k ON v.killmail_id = k.killmail_id
GROUP BY u.character_name
ORDER BY killmail_count DESC;
```

## Future Improvements

- [ ] **Incremental sync**: Fetch only new killmails (since last sync timestamp)
- [ ] **Priority queue**: Process VIP users first
- [ ] **Webhook notifications**: Send Discord/Slack notifications when killmail is saved
- [ ] **Metrics dashboard**: Queue size, processing speed, error rate
- [ ] **Auto-retry**: Automatically retry failed killmails
- [ ] **Batch processing**: Save multiple killmails in a single transaction

## Related Files

- Queue Script: [`backend/src/queues/queue-user-esi-killmails.ts`](../../src/queues/queue-user-esi-killmails.ts)
- Worker: [`backend/src/workers/worker-esi-user-killmails.ts`](../../src/workers/worker-esi-user-killmails.ts)
- Character Service: [`backend/src/services/character/character.service.ts`](../../src/services/character/character.service.ts)
- Killmail Service: [`backend/src/services/killmail/killmail.service.ts`](../../src/services/killmail/killmail.service.ts)
- systemd units: [`deploy/systemd/`](../../../deploy/systemd/), see [systemd.md](../ops/systemd.md)

## License

This project is licensed under the MIT License.
