# Corporation Killmail Sync via ESI

This feature allows users with Director/CEO roles to sync their corporation's killmails directly from ESI API.

## Requirements

### User Requirements

1. **Valid SSO Login**: User must be logged in via EVE SSO
2. **Corporation Role**: User must be Director or CEO of their corporation
3. **ESI Scope**: User must have `esi-killmails.read_corporation_killmails.v1` scope

### Technical Requirements

- User's `corporation_id` must be set (automatically fetched during login)
- Valid access token (automatically refreshed if expired)
- User must not be a character-only account (must be in a player corporation)

## How It Works

### 1. Login Process

When a user logs in via EVE SSO:

- Their `corporation_id` is automatically fetched from ESI
- Stored in the `users` table for future use
- This allows the system to identify which corporation to sync

### 2. Queueing Corporation Killmails

**Command:**

```bash
cd backend
yarn queue:corporation-killmails [--force] [--full]
```

**Options:**

- `--force`: Queue all users regardless of last sync time (bypasses 15-minute cooldown)
- `--full`: Disable incremental sync and fetch all killmails from scratch

**What it does:**

- Finds all users with:
  - Valid tokens (not expired)
  - A `corporation_id` set
  - Haven't been synced recently (unless `--force`)
- Queues them for corporation killmail sync

**Example:**

```bash
# Normal sync (only users not synced in last 15 min)
yarn queue:corporation-killmails

# Force sync all users
yarn queue:corporation-killmails --force

# Full sync from scratch (no incremental)
yarn queue:corporation-killmails --full

# Force + Full
yarn queue:corporation-killmails --force --full
```

### 3. Processing Corporation Killmails

**Command:**

```bash
cd backend
yarn worker:corporation-killmails
```

**What it does:**

1. Fetches corporation killmails from ESI endpoint:
   - `/corporations/{corporation_id}/killmails/recent/`
   - Up to 50 pages (2,500 killmails max)
   - Requires user's access token
2. For each killmail:
   - Fetches full details from ESI public endpoint
   - Saves to database (killmails, victims, attackers, items)
   - Publishes GraphQL subscription event
   - Handles duplicates gracefully
3. Updates user's sync info:
   - `last_corp_killmail_sync_at`: Timestamp of last sync
   - `last_corp_killmail_id`: Latest killmail ID (for incremental sync)

### 4. Incremental Sync

By default, the system uses **incremental sync**:

- First sync: Fetches all available killmails (up to 2,500)
- Subsequent syncs: Only fetches NEW killmails since last sync
- Stops when it encounters `last_corp_killmail_id`

To disable incremental sync and fetch everything:

```bash
yarn queue:corporation-killmails --full
```

## ESI Limitations

### Important Notes

1. **ESI only returns recent killmails** (approximately last 1 month)
2. **Maximum 2,500 killmails** (50 pages × 50 per page)
3. **Not all users can access this**: Only Directors/CEOs with correct scope

### Permission Errors (403 Forbidden)

If you see this error:

```
❌ Forbidden: User does not have permission to read corporation killmails
```

**Causes:**

- User is not Director/CEO
- User doesn't have `esi-killmails.read_corporation_killmails.v1` scope
- User needs to re-login with correct permissions

**Solution:**

1. User must logout
2. User must login again (will automatically request all required scopes)
3. Verify user is Director/CEO in-game

## Database Schema

### User Table Updates

```prisma
model User {
  // ... existing fields ...

  // Corporation killmail tracking
  corporation_id                Int?      // User's corporation ID
  last_corp_killmail_sync_at    DateTime? // Last sync timestamp
  last_corp_killmail_id         Int?      // Latest synced killmail ID
}
```

## Queue System

**Queue Name:** `esi_corporation_killmails_queue`

**Message Format:**

```typescript
interface CorporationKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  queuedAt: string;
  lastKillmailId?: number; // For incremental sync
}
```

## Monitoring

### Check Queue Status

```bash
cd backend
node -e "const amqp = require('amqplib'); (async () => { const conn = await amqp.connect(process.env.RABBITMQ_URL); const ch = await conn.createChannel(); const q = await ch.checkQueue('esi_corporation_killmails_queue'); console.log('Queue:', q); await conn.close(); })()"
```

### View Logs

Worker provides detailed logs:

- Token refresh status
- Pagination progress (page by page)
- Saved/skipped/error counts
- Final summary with statistics

## Comparison with Character Killmails

| Feature      | Character Killmails                  | Corporation Killmails                         |
| ------------ | ------------------------------------ | --------------------------------------------- |
| **Endpoint** | `/characters/{id}/killmails/recent/` | `/corporations/{id}/killmails/recent/`        |
| **Scope**    | `esi-killmails.read_killmails.v1`    | `esi-killmails.read_corporation_killmails.v1` |
| **Access**   | All characters                       | Directors/CEOs only                           |
| **Data**     | User's personal kills/losses         | ALL corporation kills/losses                  |
| **Use Case** | Personal tracking                    | Corporation-wide tracking                     |
| **Limit**    | ~52 killmails (1 month)              | ~2,500 killmails (50 pages)                   |

## Use Cases

### 1. Corporation Directors

- Track all corporation losses
- Monitor member activity
- Analyze corporation combat patterns

### 2. Alliance Leadership

- Multiple directors from different corps can sync
- Build comprehensive alliance killmail database
- Cross-reference with character killmails

### 3. Large Scale Tracking

- Automatic sync every 15 minutes (configurable)
- No manual intervention needed
- Real-time updates via GraphQL subscriptions

## Troubleshooting

### No Users Found

```
⚠️  No active users found for sync
```

**Solutions:**

- Users need to login via SSO first
- Check `corporation_id` is set in database
- Use `--force` to ignore cooldown period

### 403 Forbidden Errors

```
❌ Forbidden: User does not have permission
```

**Solutions:**

- Verify user is Director/CEO
- User must re-login to get correct scope
- Check EVE Online corporation roles in-game

### Token Expired

Worker automatically refreshes tokens using `refresh_token`. If refresh fails:

- User must re-login via SSO
- Check `refresh_token` is not null in database

## Best Practices

1. **Regular Syncs**: Run queue every 15 minutes for continuous updates
2. **Full Sync Occasionally**: Use `--full` once a day to ensure no gaps
3. **Monitor Logs**: Check for permission errors and address them
4. **Database Cleanup**: Duplicates are handled automatically, no manual cleanup needed

## Example Workflow

```bash
# 1. User logs in via frontend (corporation_id automatically saved)

# 2. Queue corporation killmails (first time - full sync)
cd backend
yarn queue:corporation-killmails --full

# 3. Start worker (keep running)
yarn worker:corporation-killmails

# 4. Regular updates (incremental sync every 15 min)
# Add to cron or scheduler:
*/15 * * * * cd /path/to/backend && yarn queue:corporation-killmails

# 5. Force full sync daily
0 0 * * * cd /path/to/backend && yarn queue:corporation-killmails --force --full
```

## API Reference

### CorporationService.getCorporationKillmails()

```typescript
static async getCorporationKillmails(
  corporationId: number,
  token: string,
  maxPages: number = 50,
  stopAtKillmailId?: number
): Promise<EsiKillmail[]>
```

**Parameters:**

- `corporationId`: Corporation ID
- `token`: User's access token
- `maxPages`: Maximum pages to fetch (default: 50)
- `stopAtKillmailId`: Stop when this killmail is found (incremental sync)

**Returns:** Array of `{ killmail_id, killmail_hash }`

**Throws:**

- `403 Forbidden`: User lacks permissions
- `404 Not Found`: No more pages available
- Rate limit errors (automatically retried)
