# Character Killmail Sync Worker

## Overview

Character-specific killmail sync worker allows you to fetch and save **all killmail history** of any EVE Online character from zKillboard to the database. No login required, uses public API.

## Features

✅ **No login required** - Works for any character ID
✅ **Full history** - Access to all killmail history of the character in EVE
✅ **Duplicate check** - Skips killmails that already exist
✅ **Progress tracking** - Real-time progress display
✅ **Rate limiting** - Complies with zKillboard and ESI rate limits
✅ **Error handling** - Skips failed killmails and continues

## Architecture

### Data Flow

```
zKillboard API → ESI API → Database
     (IDs)        (Details)   (Storage)
```

1. **zKillboard**: Killmail list by character ID (ID + hash + metadata)
2. **ESI**: Full details for each killmail (victim, attackers, items)
3. **Database**: Save to PostgreSQL with Prisma

### Files

```
backend/src/workers/
├── sync-character-killmails.ts      # Direct sync (single character)
├── queue-character-killmails.ts     # Queue system (multi-character)
└── worker-zkillboard-sync.ts        # Worker (queue processor)
```

## Usage

### Method 1: Direct Sync (Recommended for single character)

Simplest and most direct method. Used for a single character.

```bash
cd /root/killreport/backend

# Basic usage (default 50 pages = 10,000 killmails)
yarn sync:character <characterId>

# Custom page limit
yarn sync:character <characterId> <maxPages>
```

**Examples:**

```bash
# CCP Falcon's killmails (default 50 pages)
yarn sync:character 95465499

# Only last 1,000 killmails (5 pages)
yarn sync:character 95465499 5

# Last 20,000 killmails (100 pages)
yarn sync:character 95465499 100

# ALL history (use carefully, can take very long)
yarn sync:character 95465499 999
```

**Output:**

```
🚀 Character Killmail Sync Started
==================================
📝 Character ID: 95465499
📄 Max Pages: 50 (10000 killmails max)

📡 Fetching killmails from zKillboard...
  🔍 Fetching from zKillboard (max 50 pages, 200 per page)...
     📄 Page 1: 200 killmails
     📄 Page 2: 200 killmails
     ...
     ✅ Total: 8543 killmails from zKillboard

💾 Processing 8543 killmails...
  ✅ [1/8543] Saved killmail 123456789
  ✅ [11/8543] Saved killmail 123456790
  ⏭️  [100/8543] Already exists, skipping...
  ...

============================================================
🎉 SYNC COMPLETED!
============================================================
✅ Processed: 7234
⏭️  Skipped (already exists): 1309
❌ Errors: 0
📊 Total: 8543
⏱️  Duration: 1234.56s
============================================================
```

---

### Method 2: Queue System (For multiple characters)

Use for multiple characters or when background processing is desired.

**Step 1: Queue character(s)**

```bash
# Single character
yarn queue:character 95465499

# Multiple characters
yarn queue:character 95465499 96621253 94466798

# Alliance/Corporation members (example with multiple IDs)
yarn queue:character 123 456 789 101112 131415
```

**Step 2: Start worker**

```bash
yarn worker:zkillboard
```

The worker will start processing characters from the RabbitMQ queue.

---

### Method 3: Logged-in Users (Existing system)

For logged-in users only:

```bash
# Queue all logged-in users
yarn queue:zkillboard

# Start worker
yarn worker:zkillboard
```

## Configuration

### Page Limits

| Pages | Killmails | Duration (Est.) | Use Case           |
| ----- | --------- | --------------- | ------------------ |
| 5     | ~1,000    | 10-20 min       | Recent activity    |
| 10    | ~2,000    | 20-40 min       | Last few months    |
| 50    | ~10,000   | 2-3 hours       | Default (1+ years) |
| 100   | ~20,000   | 4-6 hours       | Heavy PvP pilots   |
| 999   | All       | Variable        | Complete history   |

### Rate Limits

**zKillboard:**

- 1 request/second
- Automatically handled with `await sleep(1000)`

**ESI:**

- Error limit: 100 errors per window
- Monitored via `x-esi-error-limit-remain` header
- Auto-slowdown when limit < 20

**Processing:**

- 100ms delay between killmails
- ~10 killmails/second maximum

### Worker Configuration

**File:** `worker-zkillboard-sync.ts`

```typescript
const MAX_PAGES = 100; // Default pages for logged-in users
const PREFETCH_COUNT = 1; // Concurrent users to process
```

**File:** `sync-character-killmails.ts`

```typescript
const MAX_PAGES = 50; // Default pages (overridden by CLI arg)
```

## API Reference

### getCharacterKillmailsFromZKill()

**Location:** `src/services/zkillboard.ts`

Fetches killmail list from zKillboard.

```typescript
async function getCharacterKillmailsFromZKill(
  characterId: number,
  options?: {
    page?: number; // Starting page (default: 1)
    limit?: number; // Per-page limit (default: 200, max: 200)
    maxPages?: number; // Max pages to fetch (default: 50)
    characterName?: string; // For logging purposes
  },
): Promise<ZKillPackage[]>;
```

**Returns:**

```typescript
interface ZKillPackage {
  killmail_id: number;
  zkb: {
    hash: string; // Required for ESI
    totalValue: number; // ISK value
    locationID: number;
    fittedValue: number;
    droppedValue: number;
    destroyedValue: number;
    points: number;
    npc: boolean;
    solo: boolean;
    awox: boolean;
  };
}
```

### getKillmailDetail()

**Location:** `src/services/eve-esi.ts`

Fetches full killmail details from ESI.

```typescript
async function getKillmailDetail(
  killmailId: number,
  hash: string,
): Promise<KillmailDetail>;
```

**Returns:** Complete killmail with victim, attackers, items, location, etc.

## Database Schema

### Killmail Table

```prisma
model Killmail {
  killmail_id      Int      @id
  killmail_hash    String
  killmail_time    DateTime
  solar_system_id  Int

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  victim    Victim?
  attackers Attacker[]
  items     KillmailItem[]
}
```

### Relations

- **Victim**: 1-to-1 (one victim per killmail)
- **Attackers**: 1-to-many (multiple attackers)
- **Items**: 1-to-many (dropped/destroyed items)

## Error Handling

### Common Errors

**404 - Killmail not found**

```
⚠️  Killmail 123456789 not found (404)
```

→ Skip and continue (normal for deleted/private killmails)

**420 - Error Limited**

```
🛑 Error limited (420)! Waiting 60 seconds...
```

→ Auto-wait 60 seconds and retry

**Network errors**

```
❌ Error fetching page 5: Network timeout
```

→ Stop fetching and process what we have

### Duplicate Handling

```typescript
// Check if already exists
const existing = await prisma.killmail.findUnique({
  where: { killmail_id: zkill.killmail_id },
});

if (existing) {
  skippedCount++;
  continue; // Skip to next
}
```

## Performance

### Benchmarks

Based on real-world testing:

| Killmails | Pages | Time      | Rate     |
| --------- | ----- | --------- | -------- |
| 200       | 1     | 2-3 min   | ~1/sec   |
| 1,000     | 5     | 15-20 min | ~1/sec   |
| 5,000     | 25    | 1-2 hrs   | ~1.5/sec |
| 10,000    | 50    | 2-3 hrs   | ~1/sec   |

### Optimization Tips

1. **Start small**: Test with 5 pages first
2. **Monitor errors**: Check `x-esi-error-limit-remain`
3. **Use queue system**: For multiple characters
4. **Run overnight**: For large history syncs

## Monitoring

### Progress Indicators

```bash
# Real-time progress
[42/1000] Saved killmail 987654321

# Every 10th killmail
✅ [10/1000] Saved killmail ...
✅ [20/1000] Saved killmail ...

# Skip notifications every 100th
⏭️  [100/1000] Already exists, skipping...
```

### Final Summary

```
============================================================
🎉 SYNC COMPLETED!
============================================================
✅ Processed: 7234    # New killmails saved
⏭️  Skipped: 1309     # Already in database
❌ Errors: 0          # Failed killmails
📊 Total: 8543        # Total attempted
⏱️  Duration: 1234s   # Time taken
============================================================
```

## Troubleshooting

### Problem: No killmails found

```
⚠️  No killmails found for this character
```

**Solutions:**

- Verify character ID is correct
- Character might be very new (no kills)
- Check zKillboard manually: https://zkillboard.com/character/{id}/

### Problem: Worker not processing

**Check RabbitMQ:**

```bash
# Is RabbitMQ running?
sudo systemctl status rabbitmq-server

# Check queue status
sudo rabbitmqctl list_queues

# Check queue via Management UI
# Open: http://localhost:15672
# Username: guest / Password: guest
```

### Problem: Rate limited

```
🛑 Error limited (420)!
```

**Solutions:**

- Worker automatically waits 60 seconds
- Reduce `PREFETCH_COUNT` in worker
- Increase delay between requests

### Problem: Database errors

```
❌ Prisma error: Unique constraint violation
```

**Solutions:**

```bash
# Regenerate Prisma client
yarn prisma:generate

# Check database connection
yarn prisma:studio
```

## Examples

### Example 1: Sync a famous pilot

```bash
# CCP Falcon
yarn sync:character 95465499 10

# The Mittani
yarn sync:character 443630591 50
```

### Example 2: Sync entire alliance

```bash
# Get member list first (from ESI or alliance page)
# Then queue all members
yarn queue:character 123 456 789 ... (all member IDs)
yarn worker:zkillboard
```

### Example 3: Re-sync with updates

```bash
# Run again - will skip existing and only add new
yarn sync:character 95465499 5
```

### Example 4: Full history sync

```bash
# For a very active pilot (10+ years)
# Warning: Can take 12+ hours
yarn sync:character 95465499 999
```

## Best Practices

1. ✅ **Start small**: Test with 5-10 pages first
2. ✅ **Monitor logs**: Watch for errors and rate limits
3. ✅ **Use queue system**: For bulk operations
4. ✅ **Run during off-hours**: Less load on APIs
5. ✅ **Check duplicates**: Worker handles this automatically
6. ⚠️ **Avoid 999 pages**: Unless you really need ALL history
7. ⚠️ **One character at a time**: For direct sync method

## Related Documentation

- [Alliance Worker](./ALLIANCE_WORKER_README.MD)
- [Corporation Worker](./CORPORATION_WORKER_README.MD)
- [Queue System](./MODULAR_ARCHITECTURE.MD)
- [ESI Integration](./EVE_SSO_README.MD)

## Support

For issues or questions:

- Check logs for error details
- Verify API status: https://esi.evetech.net/
- Check zKillboard: https://zkillboard.com/

## License

Part of the Killreport project.
