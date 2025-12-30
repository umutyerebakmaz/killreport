# Token Refresh System - Implementation Summary

## ✅ Implemented Changes

### 1. Queue Script Token Validation

**File**: [`queue-user-esi-killmails.ts`](backend/src/queues/queue-user-esi-killmails.ts)

**Changes**:

- ✅ Added 5-minute buffer for token expiry check
- ✅ Only queue users with valid tokens (expires more than 5 minutes from now)
- ✅ Require refresh_token to be present
- ✅ Include refresh_token and expires_at in queue message

```typescript
// Before: Simple expiry check
where: {
  expires_at: { gt: new Date() }
}

// After: Buffer + refresh token check
const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
where: {
  expires_at: { gt: fiveMinutesFromNow },
  refresh_token: { not: null }
}
```

### 2. Worker Token Refresh Logic

**File**: [`worker-esi-user-killmails.ts`](backend/src/workers/worker-esi-user-killmails.ts)

**Changes**:

- ✅ Check if token expired before processing
- ✅ Auto-refresh token using refresh_token
- ✅ Update database with new token
- ✅ Continue processing with fresh token
- ✅ Fail gracefully if refresh fails

**Flow**:

```
1. Receive message from queue
2. Check: token expired?
   ├─ NO  → Continue with existing token
   └─ YES → Refresh token
       ├─ Success → Update DB + Continue
       └─ Fail    → Log error + Requeue message
3. Fetch killmails from ESI
4. Save to database
5. Publish subscription event
```

### 3. Message Interface Update

**Before**:

```typescript
interface UserKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
  queuedAt: string;
}
```

**After**:

```typescript
interface UserKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
  refreshToken: string; // ✅ Added
  expiresAt: string; // ✅ Added
  queuedAt: string;
}
```

## 🧪 Test Scenarios

### Scenario 1: Valid Token (No Refresh Needed)

```bash
cd backend
yarn queue:user-killmails
yarn worker:user-killmails
```

**Expected Output**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: General XAN (ID: 365974960)
🆔 User ID: 1
📅 Queued at: 2025-12-24T21:00:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📡 [General XAN] Fetching killmails from ESI...
  ✅ Total: 52 killmails from ESI
```

### Scenario 2: Expired Token (Auto-Refresh)

**Expected Output**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: General XAN (ID: 365974960)
🆔 User ID: 1
📅 Queued at: 2025-12-24T21:00:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  Token expired, refreshing...
  ✅ Token refreshed successfully
  📡 [General XAN] Fetching killmails from ESI...
  ✅ Total: 52 killmails from ESI
```

### Scenario 3: Refresh Token Also Expired

**Expected Output**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: General XAN (ID: 365974960)
🆔 User ID: 1
📅 Queued at: 2025-12-24T21:00:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  Token expired, refreshing...
  ❌ Failed to refresh token: Token refresh failed: invalid_grant
❌ Failed to process message: Token refresh failed: invalid_grant
```

**User Action Required**: User needs to login again via SSO.

## 🔐 Token Lifecycle

```
1. User Login (SSO)
   ↓
2. Token saved to DB (access_token, refresh_token, expires_at)
   ↓
3. Queue Script: Filter users with valid tokens
   ↓
4. Worker: Check expiry
   ├─ Valid → Use token
   └─ Expired → Refresh
       ├─ Success → Update DB
       └─ Fail → Require re-login
```

## 📊 Database Schema

```sql
CREATE TABLE "user" (
  id SERIAL PRIMARY KEY,
  character_id INTEGER UNIQUE NOT NULL,
  character_name TEXT NOT NULL,
  access_token TEXT NOT NULL,      -- Updated on refresh
  refresh_token TEXT,               -- Used for auto-refresh
  expires_at TIMESTAMP NOT NULL,    -- Updated on refresh
  character_owner_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Deployment

### Environment Variables

No new environment variables needed. System uses existing:

- `EVE_CLIENT_ID`
- `EVE_CLIENT_SECRET`
- `DB_URL`
- `RABBITMQ_URL`

### Enable Worker in Server

**File**: `backend/.env`

```env
ENABLE_USER_KILLMAIL_WORKER=true
```

**Server will**:

1. Start ESI User Killmails worker in same process
2. Enable real-time subscription support
3. Auto-refresh expired tokens

### Production PM2

```bash
# Option 1: Run as separate worker
pm2 start ecosystem.config.js --only worker-user-killmails

# Option 2: Run embedded in server
# Set ENABLE_USER_KILLMAIL_WORKER=true in .env
pm2 restart backend
```

## 📝 API Flow

### ESI Token Refresh

**Endpoint**: `https://login.eveonline.com/v2/oauth/token`

**Request**:

```http
POST /v2/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=refresh_token&refresh_token={refresh_token}
```

**Response**:

```json
{
  "access_token": "new_access_token",
  "token_type": "Bearer",
  "expires_in": 1200,
  "refresh_token": "new_refresh_token"
}
```

## 🐛 Debugging

### Check Token Expiry

```sql
-- Users with expired tokens
SELECT character_name, expires_at,
       expires_at < NOW() as is_expired,
       expires_at - NOW() as time_remaining
FROM "user"
WHERE expires_at < NOW() + INTERVAL '5 minutes';

-- Users with no refresh token
SELECT character_name, expires_at, refresh_token IS NULL as missing_refresh
FROM "user"
WHERE refresh_token IS NULL;
```

### Force Token Refresh

```bash
# Queue a user with expired token
cd backend
yarn queue:user-killmails

# Watch worker logs
yarn worker:user-killmails
```

### Manual Token Refresh Test

```bash
# Using Node.js
cd backend
node -e "
const { refreshAccessToken } = require('./dist/services/eve-sso.js');
const refreshToken = 'YOUR_REFRESH_TOKEN';
refreshAccessToken(refreshToken)
  .then(data => console.log('✅ Success:', data))
  .catch(err => console.error('❌ Error:', err));
"
```

## ⚠️ Edge Cases

### 1. Token Refreshed While In Queue

- ✅ **Handled**: Worker uses token from message, checks expiry, refreshes if needed
- ✅ **Database**: Updated with latest token after refresh

### 2. Multiple Workers Processing Same User

- ✅ **Handled**: Each worker checks and refreshes independently
- ⚠️ **Caveat**: May result in multiple refresh calls (not a problem, EVE SSO allows)

### 3. Refresh Token Rotated

- ✅ **Handled**: New refresh_token saved to database
- ✅ **Next Sync**: Will use new refresh_token

### 4. User Deletes Character/Revokes Access

- ❌ **Not Handled**: Refresh will fail, user needs to re-login
- 🔄 **Retry**: Message requeued for retry (will fail again until user logs in)

## 📈 Metrics to Monitor

- Token refresh success rate
- Average token lifetime before refresh
- Failed refresh attempts (require user re-login)
- Queue processing time (including refresh overhead)

## 🎯 Future Improvements

- [ ] **Proactive Refresh**: Refresh tokens before they expire (in queue script)
- [ ] **Batch Refresh**: Refresh multiple user tokens before queueing
- [ ] **Token Health Dashboard**: Show users with expiring/invalid tokens
- [ ] **Notification System**: Alert users when re-login required
- [ ] **Refresh Rate Limiting**: Prevent excessive refresh calls

---

**Related Files**:

- Queue: [`queue-user-esi-killmails.ts`](backend/src/queues/queue-user-esi-killmails.ts)
- Worker: [`worker-esi-user-killmails.ts`](backend/src/workers/worker-esi-user-killmails.ts)
- SSO Service: [`eve-sso.ts`](backend/src/services/eve-sso.ts)
- Docs: [`esi-user-killmail-sync.md`](backend/src/docs/esi-user-killmail-sync.md)

**Status**: ✅ Implemented and Ready for Testing
