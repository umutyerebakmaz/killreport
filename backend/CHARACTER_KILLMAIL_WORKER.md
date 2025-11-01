# Character Killmail Sync Worker

## Overview

Character-specific killmail sync worker'ı, herhangi bir EVE Online character'ının **tüm killmail geçmişini** zKillboard'dan çekip database'e kaydetmenizi sağlar. Login gerektirmez ve public API kullanır.

## Features

✅ **Login gerektirmez** - Herhangi bir character ID için çalışır
✅ **Tüm geçmiş** - Character'ın EVE'deki tüm killmail history'sine erişim
✅ **Duplicate check** - Zaten var olan killmail'leri skip eder
✅ **Progress tracking** - Real-time progress gösterimi
✅ **Rate limiting** - zKillboard ve ESI rate limit'lerine uygun
✅ **Error handling** - Hatalı killmail'leri skip edip devam eder

## Architecture

### Data Flow

```
zKillboard API → ESI API → Database
     (IDs)        (Details)   (Storage)
```

1. **zKillboard**: Character ID'ye göre killmail listesi (ID + hash + metadata)
2. **ESI**: Her killmail için tam detaylar (victim, attackers, items)
3. **Database**: Prisma ile PostgreSQL'e kaydetme

### Files

```
backend/src/workers/
├── sync-character-killmails.ts      # Direct sync (tek character)
├── queue-character-killmails.ts     # Queue sistemi (multi-character)
└── worker-killmails.ts              # Worker (queue processor)
```

## Usage

### Method 1: Direct Sync (Recommended for single character)

En basit ve direkt yöntem. Tek bir character için kullanılır.

```bash
cd /root/killreport/backend

# Basic usage (default 50 pages = 10,000 killmails)
yarn sync:character <characterId>

# Custom page limit
yarn sync:character <characterId> <maxPages>
```

**Examples:**

```bash
# CCP Falcon'un killmail'leri (default 50 sayfa)
yarn sync:character 95465499

# Sadece son 1,000 killmail (5 sayfa)
yarn sync:character 95465499 5

# Son 20,000 killmail (100 sayfa)
yarn sync:character 95465499 100

# TÜM geçmiş (dikkatli kullanın, çok uzun sürebilir)
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

Birden fazla character için veya background processing istiyorsan.

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
yarn worker:killmails
```

Worker RabbitMQ queue'dan character'ları alıp işlemeye başlar.

---

### Method 3: Logged-in Users (Existing system)

Sadece login olmuş kullanıcılar için:

```bash
# Queue all logged-in users
yarn queue:killmails

# Start worker
yarn worker:killmails
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

**File:** `worker-killmails.ts`

```typescript
const MAX_PAGES = 50; // Default pages for logged-in users
const PREFETCH_COUNT = 2; // Concurrent users to process
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
  }
): Promise<ZKillPackage[]>;
```

**Returns:**

```typescript
interface ZKillPackage {
  killmail_id: number;
  zkb: {
    hash: string; // ESI için gerekli
    totalValue: number; // ISK değeri
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
  hash: string
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
docker ps | grep rabbitmq

# Check queue
# Management UI: http://localhost:15672
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
yarn worker:killmails
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

- [Alliance Worker](./ALLIANCE_WORKER_README.md)
- [Corporation Worker](./CORPORATION_WORKER_README.md)
- [Queue System](./MODULAR_ARCHITECTURE.md)
- [ESI Integration](./EVE_SSO_README.md)

## Support

For issues or questions:

- Check logs for error details
- Verify API status: https://esi.evetech.net/
- Check zKillboard: https://zkillboard.com/

## License

Part of the Killreport project.
