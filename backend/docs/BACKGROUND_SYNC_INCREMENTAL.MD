# Background Sync & Incremental Optimization

## Overview

This document explains the **automatic background synchronization** and **incremental sync optimization** features.

## 🕐 Background Cron Job (10-Minute Automatic Sync)

### Features

- ✅ **Automatic execution**: Starts automatically when server starts
- ✅ **10-minute interval**: Runs every 10 minutes
- ✅ **Smart filtering**: Only users not synced in the last 15+ minutes
- ✅ **Low priority**: Background sync messages added to queue with low priority (priority: 3)
- ✅ **Concurrent-safe**: Prevents multiple simultaneous executions

### How It Works

```
Server starts → Cron starts → Every 10 minutes:
  1. Find active users (valid token + not synced in 15+ minutes)
  2. Add to queue (priority: 3)
  3. Worker automatically processes
```

### Usage

Starts **automatically** when the server starts:

```bash
cd backend
yarn dev  # or in production: node dist/server.js
```

Console output:

```
🚀 Server is running on http://localhost:4000/graphql
...
🕐 Starting user killmail background sync...
   📅 Interval: Every 10 minutes
   📦 Queue: esi_user_killmails_queue

✅ User killmail cron started
```

On each execution:

```
──────────────────────────────────────────────────────────────────────
🕐 [25.12.2025 14:30:00] Running background sync...
──────────────────────────────────────────────────────────────────────
   📊 Found 3 user(s) to sync
   ⏳ John Doe (last: 20m ago)
   ⏳ Jane Smith (never)
   ⏳ Bob Wilson (last: 45m ago)

   ✅ Queued 3 user(s) in 125ms
──────────────────────────────────────────────────────────────────────
```

### Code Structure

**Service:** `/backend/src/services/user-killmail-cron.ts`

```typescript
export class UserKillmailCron {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    /* Start */
  }
  stop() {
    /* Stop */
  }
  private async syncUsers() {
    /* Sync operation */
  }
  getStatus() {
    /* Status info */
  }
}

export const userKillmailCron = new UserKillmailCron();
```

**Integration:** `/backend/src/server.ts`

```typescript
import { userKillmailCron } from "./services/user-killmail-cron";

server.listen(port, () => {
  // ...
  userKillmailCron.start().catch((error) => {
    console.error("❌ Failed to start user killmail cron:", error);
  });
});
```

## 🚀 Incremental Sync Optimization

### Problem

Previously, on each sync:

- **50 pages** (2500 killmails) were fetched
- **API call for each page** was made
- **Already existing killmails** were processed repeatedly
- **Unnecessary ESI rate limit** usage

### Solution: Incremental Sync

ESI API returns killmails in **reverse chronological order** (newest → oldest). Using this feature:

1. **Save the last synced killmail ID** (`last_killmail_id`)
2. **In new sync** stop as soon as you see this ID
3. **Only fetch new killmails**

### Performance Improvement

| Scenario                               | Before   | After    | Improvement        |
| -------------------------------------- | -------- | -------- | ------------------ |
| **Initial sync**                       | 50 pages | 50 pages | Same               |
| **15 minutes later (1-2 killmails)**   | 50 pages | 1 page   | **50x faster**     |
| **Daily (5-10 killmails)**             | 50 pages | 1 page   | **50x faster**     |
| **Weekly (50+ killmails)**             | 50 pages | 2-3 pages| **~20x faster**    |

### How It Works

#### 1. Database Schema

```prisma
model User {
  // ...
  last_killmail_id       Int?      // Last synchronized killmail ID
  last_killmail_sync_at  DateTime? // Last sync time

  @@index([last_killmail_id])
  @@index([last_killmail_sync_at])
}
```

#### 2. Queue Message

```typescript
interface UserKillmailMessage {
  userId: number;
  characterId: number;
  // ...
  lastKillmailId?: number; // 🔥 New field
}
```

**Queue script:** `/backend/src/queues/queue-user-esi-killmails.ts`

```typescript
const message: UserKillmailMessage = {
  // ...
  lastKillmailId: user.last_killmail_id ?? undefined, // Include last ID
};
```

#### 3. Worker Logic

**Worker:** `/backend/src/workers/worker-esi-user-killmails.ts`

```typescript
await syncUserKillmailsFromESI(
  message,
  message.lastKillmailId // Pass last known ID
);
```

#### 4. CharacterService Optimization

**Service:** `/backend/src/services/character/character.service.ts`

```typescript
static async getCharacterKillmails(
  characterId: number,
  token: string,
  maxPages: number = 50,
  stopAtKillmailId?: number // 🔥 New parameter
): Promise<EsiKillmail[]> {
  for (let page = 1; page <= maxPages; page++) {
    const killmails = await fetchPage(page);

    // 🔥 Incremental sync optimization
    if (stopAtKillmailId) {
      const stopIndex = killmails.findIndex(
        km => km.killmail_id === stopAtKillmailId
      );

      if (stopIndex !== -1) {
        // Found last synced killmail - stop here!
        const newKillmails = killmails.slice(0, stopIndex);
        allKillmails.push(...newKillmails);
        console.log(`✅ Found last synced ID: ${stopAtKillmailId}`);
        break; // 🔥 Stop early, don't fetch unnecessary pages
      }
    }

    allKillmails.push(...killmails);
  }
}
```

#### 5. Worker Output

**Initial sync (no lastKillmailId):**

```
📡 [John Doe] Fetching killmails from ESI (full sync)...
   📄 Page 1: 50 killmails
   📄 Page 2: 50 killmails
   ...
   📄 Page 15: 50 killmails
   ✓ Last page (42 < 50)
   ✅ Total: 742 killmails from ESI
```

**Second sync (lastKillmailId: 123456789):**

```
📡 [John Doe] Fetching NEW killmails from ESI (incremental sync)...
   🔍 Will stop at killmail ID: 123456789
   📄 Page 1: 50 killmails
   ✅ Incremental sync: Found last synced killmail (ID: 123456789)
   ⏭️  Stopping at page 1 - fetched 3 new killmails
   ✅ Total: 3 killmails from ESI
```

**Result:** Only **1 page** fetched instead of 50 pages!

#### 6. Database Update

```typescript
// Worker saves highest killmail ID
if (killmailList.length > 0) {
  const latestKillmailId = Math.max(
    ...killmailList.map((km) => km.killmail_id)
  );

  await prisma.user.update({
    where: { id: message.userId },
    data: {
      last_killmail_sync_at: new Date(),
      last_killmail_id: latestKillmailId, // 🔥 Save for next sync
    },
  });
}
```

## 📊 Working Together

### Complete Workflow

```
1. Server starts
   ↓
2. Cron job starts (every 10 minutes)
   ↓
3. Cron runs:
   - Find active users
   - Include last_killmail_id
   - Add to queue (priority: 3)
   ↓
4. Worker processes:
   - If lastKillmailId exists, perform incremental sync
   - Fetch only new killmails
   - Save to database
   - Update last_killmail_id
   ↓
5. Next cron execution:
   - Use updated last_killmail_id
   - Much faster sync
```

### Advantages

| Feature                    | Benefit                                  |
| -------------------------- | ---------------------------------------- |
| **Automatic sync**         | Up-to-date data without user action      |
| **10-minute interval**     | Frequent enough but doesn't spam API     |
| **15-minute buffer**       | Prevents unnecessary re-sync             |
| **Incremental sync**       | 50x fewer API calls                      |
| **Rate limit friendly**    | Doesn't exceed ESI limits                |
| **Background priority**    | Manual syncs have priority               |
| **Concurrent-safe**        | No collision risk                        |

## 🧪 Testing

### 1. Start Server

```bash
cd backend
yarn dev
```

You'll see in console:

```
🕐 Starting user killmail background sync...
✅ User killmail cron started
```

### 2. Start Worker

```bash
cd backend
yarn worker:user-killmails
```

### 3. Watch Initial Sync

Initial sync: **Full sync** (no lastKillmailId)

```
📡 [John Doe] Fetching killmails from ESI (full sync)...
   📄 Page 1: 50 killmails
   📄 Page 2: 50 killmails
   ...
```

### 4. Wait 10 Minutes

Cron will run automatically:

```
──────────────────────────────────────────────────────────────────────
🕐 [25.12.2025 14:40:00] Running background sync...
──────────────────────────────────────────────────────────────────────
   📊 Found 1 user(s) to sync
   ⏳ John Doe (last: 10m ago)
```

### 5. Watch Second Sync

Second sync: **Incremental sync** (lastKillmailId exists)

```
📡 [John Doe] Fetching NEW killmails from ESI (incremental sync)...
   🔍 Will stop at killmail ID: 123456789
   📄 Page 1: 50 killmails
   ✅ Incremental sync: Found last synced killmail (ID: 123456789)
   ⏭️  Stopping at page 1 - fetched 2 new killmails
```

**Result:** 50 pages → 1 page = **50x faster/tmp/postgresql_en.md /root/killreport/backend/src/docs/POSTGRESQL_QUERY_CACHE_ANALYSIS.MD* 🚀

## 📝 Important Notes

### Cron Job

- ✅ **Starts automatically**: When server starts
- ✅ **Graceful shutdown**: Stops properly when process is killed
- ✅ **Error handling**: Logs errors, doesn't crash
- ✅ **Status checking**: Check status with `userKillmailCron.getStatus()`

### Incremental Sync

- ✅ **Initial sync always full**: No lastKillmailId yet
- ✅ **Trust ESI order**: Reverse chronological order guaranteed
- ✅ **Edge case handling**: Full sync if killmail not found
- ✅ **Database index**: last_killmail_id indexed for performance

### Rate Limiting

- ✅ **ESI limit: 150 req/sec** - our usage is far below
- ✅ **Background priority: 3** - manual syncs have priority: 5
- ✅ **Worker prefetch: 1** - processes 1 user at a time
- ✅ **Page delay: 100ms** - wait between pages

## 🎯 Conclusion

With these two features:

1. **Automatic sync**: Users get synced every 10 minutes without doing anything
2. **50x performance**: Much faster with incremental sync
3. **Rate limit friendly**: We don't exceed ESI limits
4. **User experience**: Real-time data, no manual sync needed

**Both user experience and system performance dramatically improved/tmp/postgresql_en.md /root/killreport/backend/src/docs/POSTGRESQL_QUERY_CACHE_ANALYSIS.MD* 🎉
