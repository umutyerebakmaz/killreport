# 📦 `esi_user_killmails_queue` - Detailed Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Workflow](#workflow)
3. [File Structure and Responsibilities](#file-structure-and-responsibilities)
4. [Queue Message Format](#queue-message-format)
5. [Working Scenarios](#working-scenarios)
6. [Performance and Rate Limiting](#performance-and-rate-limiting)
7. [Monitoring and Control](#monitoring-and-control)
8. [Troubleshooting](#troubleshooting)
9. [Command Reference](#command-reference)

---

## Overview

### Purpose

`esi_user_killmails_queue` is a RabbitMQ queue that **automatically synchronizes killmails for users who have logged in via SSO**.

### Key Features

- ✅ **ESI-only**: NO dependency on zKillboard
- ✅ **Token-based**: Works with the user's own access token
- ✅ **Automatic**: Runs in the background with a 10-minute cron job
- ✅ **Incremental Sync**: Fetches only new killmails (50x faster)
- ✅ **Priority Messages**: High priority (8) after login, low priority (3) for background
- ✅ **Auto Token Refresh**: Expired tokens are automatically renewed
- ✅ **Real-time Events**: Live notifications via GraphQL subscription

### Data Flow

```
┌─────────────────┐
│  User Login     │
│  (SSO)          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  Auth Resolver  │────────>│  esi_user_       │
│  (High Priority)│         │  killmails_queue │
└─────────────────┘         └────────┬─────────┘
                                     │
┌─────────────────┐                  │
│  Cron Service   │                  │
│  (Every 10min)  │──────────────────┤
│  (Low Priority) │                  │
└─────────────────┘                  │
                                     │
┌─────────────────┐                  │
│  Manual Queue   │                  │
│  Script         │──────────────────┘
└─────────────────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │  Worker        │
                            │  (Consumer)    │
                            └────────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌───────────┐    ┌───────────┐   ┌──────────┐
            │  ESI API  │    │ Database  │   │ GraphQL  │
            │  (Fetch)  │    │  (Save)   │   │  Events  │
            └───────────┘    └───────────┘   └──────────┘
```

---

## Workflow

### 1️⃣ How Messages Get Added to Queue?

#### A) **After Login (Automatic - High Priority)**

**File:** `backend/src/resolvers/auth.resolver.ts`

**Trigger:** When user logs in via SSO

**Process:**

```typescript
// Inside login mutation
authenticateWithCode: async (_parent, { code, state }) => {
  // 1. Get token
  const tokenData = await exchangeCodeForToken(code);

  // 2. Save/update user in database
  const user = await prisma.user.upsert({...});

  // 3. Add to queue (if not synced within 15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const shouldQueue = !user.last_killmail_sync_at ||
                      user.last_killmail_sync_at < fifteenMinutesAgo;

  if (shouldQueue) {
    channel.sendToQueue('esi_user_killmails_queue', message, {
      priority: 8, // 🔥 High priority
    });
  }
}
```

**Priority:** `8/10` (High - User should see results immediately after login)

**Control:** Skip if synced within last 15 minutes

---

#### B) **Cron Job (Automatic - Background - Low Priority)**

**File:** `backend/src/services/user-killmail-cron.ts`

**Trigger:**

- Starts automatically when server starts
- Runs every **10 minutes**
- In `server.ts`: `userKillmailCron.start()`

**Process:**

```typescript
class UserKillmailCron {
  async syncUsers() {
    // 1. Find users with valid tokens
    // 2. Filter those not synced in last 15 minutes
    const users = await prisma.user.findMany({
      where: {
        expires_at: { gt: fiveMinutesFromNow },
        refresh_token: { not: null },
        OR: [
          { last_killmail_sync_at: null },
          { last_killmail_sync_at: { lt: fifteenMinutesAgo } },
        ],
      },
    });

    // 3. Add each user to queue
    for (const user of users) {
      channel.sendToQueue("esi_user_killmails_queue", message, {
        priority: 3, // 🔵 Low priority (background)
      });
    }
  }
}
```

**Priority:** `3/10` (Low - Background sync)

**Control:**

- Token must be valid (expires_at > now + 5 min)
- Must have refresh token (for automatic renewal)
- Must not be synced in last 15 minutes

**Console Output:**

```
──────────────────────────────────────────────────────────────────────
🕐 [06.01.2026 14:30:00] Running background sync...
──────────────────────────────────────────────────────────────────────
   📊 Found 3 user(s) to sync
   ⏳ John Doe (last: 20m ago)
   ⏳ Jane Smith (never)
   ⏳ Bob Wilson (last: 45m ago)

   ✅ Queued 3 user(s) in 125ms
──────────────────────────────────────────────────────────────────────
```

---

#### C) **Manual Script (On Demand)**

**File:** `backend/src/queues/queue-user-esi-killmails.ts`

**Command:**

```bash
cd backend

# Normal (users not synced in last 15 min)
yarn queue:user-killmails

# Force queue all users
yarn queue:user-killmails --force

# Full sync (NO incremental optimization)
yarn queue:user-killmails --full

# Both flags combined
yarn queue:user-killmails --force --full
```

**Parameters:**

- `--force`: Ignore last sync time, queue everyone
- `--full`: Disable incremental sync (fetch all killmails from scratch)

**Console Output:**

```
📡 Queueing users for ESI killmail sync...

✓ Found 5 active user(s) with valid tokens
📤 Adding to queue: esi_user_killmails_queue

  ⏳ Queued: John Doe (ID: 95465499) [INCREMENTAL]
  ⏳ Queued: Jane Smith (ID: 12345678) [FIRST SYNC]
  ⏳ Queued: Bob Wilson (ID: 98765432) [FULL SYNC]

✅ Successfully queued 5 user(s)!

💡 Now run the worker to process them:
   yarn worker:user-killmails
```

---

### 2️⃣ How Messages Get Processed? (Worker)

**File:** `backend/src/workers/worker-esi-user-killmails.ts`

**Start:**

```bash
cd backend
yarn worker:user-killmails
```

**Processing Steps:**

```typescript
async function esiUserKillmailWorker() {
  // 1. Connect to RabbitMQ
  const channel = await getRabbitMQChannel();

  // 2. Assert queue (create if not exists)
  await channel.assertQueue("esi_user_killmails_queue", {
    durable: true,
    arguments: { "x-max-priority": 10 },
  });

  // 3. Set prefetch (how many messages to process simultaneously)
  channel.prefetch(1); // One user at a time

  // 4. Consume messages
  channel.consume("esi_user_killmails_queue", async (msg) => {
    const message = JSON.parse(msg.content.toString());

    // 5. Fetch user's killmails
    await syncUserKillmailsFromESI(message);

    // 6. ACK message (acknowledge)
    channel.ack(msg);
  });
}
```

**Worker Process:**

```
1. Message Received
   ↓
2. Token Check (expired?)
   ├─ Yes → Refresh token
   └─ No  → Continue
   ↓
3. Fetch Killmail List from ESI
   • If incremental sync: use stopAtKillmailId
   • Max 50 pages (2500 killmails)
   • ESI returns: [{killmail_id, killmail_hash}, ...]
   ↓
4. Process in Batches (3 killmails each)
   ├─ Batch 1: [km1, km2, km3]
   │   ├─ Fetch details from ESI
   │   ├─ Save to database (killmail, victim, attackers, items)
   │   ├─ Publish GraphQL event
   │   └─ 150ms delay (rate limit)
   ├─ 500ms delay between batches
   ├─ Batch 2: [km4, km5, km6]
   └─ ...
   ↓
5. Update User Metadata
   • last_killmail_sync_at = NOW
   • last_killmail_id = highest_killmail_id
   ↓
6. ACK Message (delete from RabbitMQ)
```

**Console Output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: John Doe (ID: 95465499)
🆔 User ID: 1
📅 Queued at: 2026-01-06T14:30:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📡 [John Doe] Fetching NEW killmails from ESI (incremental sync)...
     🔍 Will stop at killmail ID: 123456789
     📄 Max pages: 50 (will stop earlier if found)

     📄 Page 1: 50 killmails
     ✅ Incremental sync: Found last synced killmail (ID: 123456789)
     ⏭️  Stopping at page 1 - fetched 3 new killmails from this page
     📊 Total new killmails: 3

  ⏸️  Waiting 1000ms before processing killmails...

  💾 Processing killmails in batches of 3 (500ms delay)...

     📦 Batch 1/1: Processing 3 killmails...
        ✅ Saved: 125467890 (Rifter killed in Jita)
        ✅ Saved: 125467891 (Tristan destroyed)
        ✅ Saved: 125467892 (Atron lost)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Saved: 3 new killmails
  ⏭️  Skipped: 0 (already in database)
  ❌ Errors: 0
  📊 Total processed: 3
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  💾 Updated last sync info (latest killmail ID: 125467892)

✅ Completed: John Doe
```

---

## File Structure and Responsibilities

### 1️⃣ Queue Scripts (Message Sending)

| File                                 | Purpose             | Command                     | Priority   |
| ------------------------------------ | ------------------- | --------------------------- | ---------- |
| `queues/queue-user-esi-killmails.ts` | Manual queue script | `yarn queue:user-killmails` | 5 (Medium) |

**Responsibilities:**

- Find users from database
- Check token validity
- Create queue message
- Send to RabbitMQ

---

### 2️⃣ Worker (Message Processing)

| File                                   | Purpose        | Command                      |
| -------------------------------------- | -------------- | ---------------------------- |
| `workers/worker-esi-user-killmails.ts` | Queue consumer | `yarn worker:user-killmails` |

**Responsibilities:**

- Receive message from queue
- Check / refresh token
- Fetch killmails from ESI
- Save to database
- Publish GraphQL event
- Update user metadata

**Rate Limiting:**

- `PREFETCH_COUNT: 1` (One user at a time)
- `BATCH_SIZE: 3` (Process 3 killmails)
- `BATCH_DELAY_MS: 500` (500ms between batches)
- `PAGE_FETCH_DELAY_MS: 1000` (1s after page fetch)
- `KILLMAIL_DETAIL_DELAY_MS: 150` (150ms after each killmail detail)

---

### 3️⃣ Cron Service (Automatic Execution)

| File                             | Purpose         | Start                       |
| -------------------------------- | --------------- | --------------------------- |
| `services/user-killmail-cron.ts` | Background sync | Automatic on server startup |

**Responsibilities:**

- Run every 10 minutes
- Find users that need sync
- Add to queue with low priority
- Prevent concurrent runs

**Integration:**

```typescript
// backend/src/server.ts
import { userKillmailCron } from "./services/user-killmail-cron";

server.listen(port, () => {
  // ...
  userKillmailCron.start(); // 🔥 Auto start
});
```

---

### 4️⃣ Auth Resolver (Post-Login Queue)

| File                         | Purpose           | Trigger                   |
| ---------------------------- | ----------------- | ------------------------- |
| `resolvers/auth.resolver.ts` | Queue after login | When user logs in via SSO |

**Responsibilities:**

- When user logs in
- If not synced in last 15 min
- Add user to queue (high priority)

**Code:**

```typescript
// auth.resolver.ts - authenticateWithCode mutation
if (shouldQueueChar) {
  channel.sendToQueue("esi_user_killmails_queue", charMessage, {
    priority: 8, // 🔥 High priority
  });
}
```

---

### 5️⃣ Helper Services

| File                                      | Purpose                                |
| ----------------------------------------- | -------------------------------------- |
| `services/character/character.service.ts` | ESI API calls                          |
| `services/rabbitmq.ts`                    | RabbitMQ connection management         |
| `services/prisma-worker.ts`               | Database connection pool (for workers) |
| `services/eve-sso.ts`                     | Token refresh                          |
| `services/logger.ts`                      | Winston logger                         |

---

### 6️⃣ Monitoring Scripts

| File                   | Purpose            | Command                    |
| ---------------------- | ------------------ | -------------------------- |
| `redis/check-queue.ts` | Check queue status | `tsx redis/check-queue.ts` |

---

## Queue Message Format

### TypeScript Interface

```typescript
interface UserKillmailMessage {
  userId: number; // Database user ID
  characterId: number; // EVE character ID
  characterName: string; // EVE character name
  accessToken: string; // ESI access token
  refreshToken: string; // ESI refresh token
  expiresAt: string; // Token expiry (ISO timestamp)
  queuedAt: string; // Queued time (ISO timestamp)
  lastKillmailId?: number; // Last synced killmail ID (for incremental)
}
```

### Example Message

```json
{
  "userId": 1,
  "characterId": 95465499,
  "characterName": "John Doe",
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "dGhpc19pc19hX3JlZnJl...",
  "expiresAt": "2026-01-06T15:30:00.000Z",
  "queuedAt": "2026-01-06T14:30:00.000Z",
  "lastKillmailId": 123456789
}
```

### lastKillmailId Usage

**When absent:**

- First sync
- Full sync (--full flag)
- Max 50 pages fetch (2500 killmails)

**When present:**

- Incremental sync
- STOP when this ID is seen while fetching from ESI
- Much faster (usually 1 page is enough)

---

## Working Scenarios

### Scenario 1: First Login (First Time User)

```
1. User logs in via SSO
   ↓
2. Auth resolver runs:
   • User saved to database
   • last_killmail_sync_at: NULL
   • last_killmail_id: NULL
   ↓
3. Added to queue (priority: 8)
   • lastKillmailId: undefined (full sync)
   ↓
4. Worker processes:
   • Fetch max 50 pages (2500 killmails)
   • Save all to database
   • last_killmail_sync_at: NOW
   • last_killmail_id: 125467892 (highest)
```

---

### Scenario 2: Background Sync (After 10 Minutes)

```
1. Cron job runs (after 10 minutes)
   ↓
2. User found:
   • last_killmail_sync_at: 10 minutes ago
   • last_killmail_id: 125467892
   ↓
3. Added to queue (priority: 3)
   • lastKillmailId: 125467892 (incremental)
   ↓
4. Worker processes:
   • Fetches from ESI
   • Finds killmail_id 125467892 on page 1
   • STOP! (only 2 new killmails found)
   • 1 page instead of 50 = 50x faster!
```

---

### Scenario 3: Login Again (Within 15 Minutes)

```
1. User logs in again
   ↓
2. Auth resolver checks:
   • last_killmail_sync_at: 8 minutes ago
   • Less than 15 minutes!
   ↓
3. NOT added to queue
   • Console: "Skipped character queue (synced 8 minutes ago)"
   ↓
4. Avoids unnecessary API calls
```

---

### Scenario 4: Manual Full Sync

```
1. Admin runs command:
   yarn queue:user-killmails --force --full
   ↓
2. Script runs:
   • Ignores last sync time (--force)
   • Does not send lastKillmailId (--full)
   ↓
3. Worker processes:
   • Behaves like first sync
   • Fetch max 50 pages
   • Re-checks all killmails
```

---

## Performance and Rate Limiting

### ESI API Limits

**EVE ESI:**

- **150 requests/second** (burst)
- Worker: **50 requests/second** (safe mode)

### Worker Configuration

```typescript
const PREFETCH_COUNT = 1; // 1 user at a time
const BATCH_SIZE = 3; // Process 3 killmails
const BATCH_DELAY_MS = 500; // 500ms between batches
const PAGE_FETCH_DELAY_MS = 1000; // 1s after page fetch
const KILLMAIL_DETAIL_DELAY_MS = 150; // 150ms after each killmail
```

### Rate Limiter Service

**File:** `services/rate-limiter.ts`

```typescript
export const esiRateLimiter = {
  execute: async (fn) => {
    // 20ms minimum delay (50 req/sec)
    await delay(20);
    return fn();
  },
};
```

### Calculation

**Full Sync (2500 killmails):**

- 2500 killmails / 3 (batch) = 834 batches
- Each batch: 3 x 150ms = 450ms
- Between batches: 500ms
- **Total:** ~13 minutes

**Incremental Sync (3 killmails):**

- 1 batch (3 killmails)
- 3 x 150ms = 450ms
- **Total:** ~1 second

**50x faster!** 🚀

---

## Monitoring and Control

### 1️⃣ Check Queue Status

```bash
cd backend
tsx redis/check-queue.ts
```

**Output:**

```
🔍 Checking RabbitMQ queue status...

📦 Queue: esi_user_killmails_queue
📊 Messages in queue: 5
👥 Consumers: 1
```

---

### 2️⃣ GraphQL Query (Worker Status)

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

**Response:**

```json
{
  "data": {
    "workerStatus": [
      {
        "queueName": "esi_user_killmails_queue",
        "messageCount": 5,
        "consumerCount": 1
      }
    ]
  }
}
```

---

### 3️⃣ PM2 Monitoring (Production)

```bash
# Worker status
pm2 status

# Watch logs
pm2 logs worker-user-killmails

# Memory usage
pm2 monit

# Restart
pm2 restart worker-user-killmails
```

---

### 4️⃣ RabbitMQ Management UI

**URL:** `http://localhost:15672` (if management plugin is active)

**Queue Information:**

- Message count
- Consumer count
- Message rate
- Priority distribution

---

### 5️⃣ Database Check

```sql
-- Check last sync times
SELECT
  character_name,
  last_killmail_sync_at,
  last_killmail_id,
  expires_at
FROM users
ORDER BY last_killmail_sync_at DESC NULLS LAST;

-- How many killmails saved today
SELECT COUNT(*)
FROM killmails
WHERE created_at > CURRENT_DATE;
```

---

## Troubleshooting

### Problem 1: Queue Empty But Worker Not Running

**Symptoms:**

```
📊 Messages in queue: 0
👥 Consumers: 0
```

**Solution:**

```bash
# Start worker
yarn worker:user-killmails

# Or with PM2
pm2 start ecosystem.config.js --only worker-user-killmails
```

---

### Problem 2: Queue Full, Not Processing

**Symptoms:**

```
📊 Messages in queue: 100
👥 Consumers: 0
```

**Causes:**

- Worker crashed
- Worker never started

**Solution:**

```bash
# Check worker logs
pm2 logs worker-user-killmails --lines 50

# Restart
pm2 restart worker-user-killmails

# If there's an error, fix it and restart
```

---

### Problem 3: "No active users found"

**Symptoms:**

```
⚠️  Queue is empty. No users queued for killmail sync.
```

**Cause:** No users with valid tokens in database

**Solution:**

1. Login via SSO in frontend
2. Make sure tokens haven't expired
3. Check database:
   ```sql
   SELECT character_name, expires_at
   FROM users
   WHERE expires_at > NOW();
   ```

---

### Problem 4: "Failed to fetch killmails: 403"

**Cause:** Token expired or insufficient scope

**Automatic Solution:**

- Worker automatically refreshes token
- Uses refresh token
- Updates database

**Manual Check:**

```typescript
// Scope check (backend/.env)
EVE_CLIENT_SCOPES = "esi-killmails.read_killmails.v1 ...";
```

---

### Problem 5: Worker Too Slow

**Symptoms:** 100 killmails taking 30 minutes

**Causes:**

- Rate limiting too aggressive
- Network latency

**Solution:**

```typescript
// worker-esi-user-killmails.ts
const BATCH_SIZE = 5; // Increase from 3 to 5
const BATCH_DELAY_MS = 300; // Decrease from 500 to 300
const KILLMAIL_DETAIL_DELAY_MS = 100; // Decrease from 150 to 100
```

**CAUTION:** Don't exceed ESI rate limit!

---

### Problem 6: Duplicate Key Errors (P2002)

**Normal:** Worker handles this automatically

**Log:**

```
⏭️  Skipped: 125467890 (already in database)
```

**Cause:** Same killmail can come from multiple sources

**Action Required?** No, this is by design.

---

## Command Reference

### Development

```bash
# Start server (cron auto-starts)
cd backend
yarn dev

# Start worker
yarn worker:user-killmails

# Manual queue
yarn queue:user-killmails

# Force full sync
yarn queue:user-killmails --force --full

# Queue status
tsx redis/check-queue.ts
```

---

### Production

```bash
# Start server
pm2 start ecosystem.config.js

# Only user killmail worker
pm2 start ecosystem.config.js --only worker-user-killmails

# Watch logs
pm2 logs worker-user-killmails

# Restart
pm2 restart worker-user-killmails

# Stop
pm2 stop worker-user-killmails
```

---

### Cron Job (Automatic Queue)

**Manual Cron Setup (Optional):**

```bash
# Edit crontab
crontab -e

# Every 10 minutes (if cron service not running)
*/10 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails

# With logs
*/10 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails >> /var/log/queue-user-killmails.log 2>&1
```

**NOTE:** NO need if cron service in server is already running!

---

## Summary: Complete Process Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESI USER KILLMAILS QUEUE                     │
│                  (esi_user_killmails_queue)                     │
└─────────────────────────────────────────────────────────────────┘

📥 ADDING TO QUEUE (3 METHODS):

1. Login (Automatic)
   • auth.resolver.ts
   • Priority: 8
   • Control: If not synced within 15 min

2. Cron (Automatic - Every 10 min)
   • user-killmail-cron.ts
   • Priority: 3
   • Control: If not synced within 15 min

3. Manual
   • queue-user-esi-killmails.ts
   • yarn queue:user-killmails [--force] [--full]
   • Priority: 5

────────────────────────────────────────────────────────────────────

📤 PROCESSING FROM QUEUE:

Worker: worker-esi-user-killmails.ts
Command: yarn worker:user-killmails

Process:
  1. Receive message
  2. Check/refresh token
  3. Fetch killmail list from ESI (incremental)
  4. Batch fetch details (3 each)
  5. Save to database
  6. Publish GraphQL event
  7. Update user metadata
  8. ACK (delete message)

────────────────────────────────────────────────────────────────────

⚙️ PERFORMANCE:

• Incremental sync: 50x faster
• Rate limiting: 50 req/sec (safe)
• Batch processing: 3 killmails/batch
• Delay: 500ms between batches

────────────────────────────────────────────────────────────────────

🔍 MONITORING:

• tsx redis/check-queue.ts
• GraphQL: workerStatus query
• PM2: pm2 logs worker-user-killmails
• Database: last_killmail_sync_at

────────────────────────────────────────────────────────────────────

📊 RESULT:

✅ Automatic: Cron runs every 10 minutes
✅ Fast: 50x performance with incremental sync
✅ Safe: Rate limiting + retry logic
✅ Monitoring: Multiple monitoring methods
```

---

## Final Notes

### 🎯 To Keep Control

1. **Follow Logs:** `pm2 logs worker-user-killmails`
2. **Watch Queue:** `tsx redis/check-queue.ts` or GraphQL
3. **Check Database:** `last_killmail_sync_at` fields
4. **Stop Cron:** `userKillmailCron.stop()` in server
5. **Manual Queue:** Add yourself with `yarn queue:user-killmails`

### 🚀 Understanding the Workflow

- **Is cron service running?** Check console output (when server starts)
- **Is worker running?** Check with `pm2 status`
- **Is queue full?** Look at RabbitMQ management UI
- **Are users syncing?** Check `last_killmail_sync_at` in database

### 📚 Related Documentation

- [ESI_USER_KILLMAIL_SYNC.MD](./ESI_USER_KILLMAIL_SYNC.MD) - General usage
- [BACKGROUND_SYNC_INCREMENTAL.MD](./BACKGROUND_SYNC_INCREMENTAL.MD) - Cron + Incremental details
- [IMPROVEMENTS.MD](./IMPROVEMENTS.MD) - General backend improvements

---

**Last Updated:** January 6, 2026
**Version:** 1.0.0
