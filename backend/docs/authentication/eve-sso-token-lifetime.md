# EVE Online SSO Token Lifetime

## Token Expiry Times

### Access Token

- **Lifetime**: 1200 seconds (20 minutes)
- **Standard**: Set by EVE Online SSO API
- **Renewal**: Automatic via refresh token before expiry

### Refresh Token

- **Lifetime**: No expiry (until revoked by user)
- **Usage**: Used to obtain new access tokens
- **Revocation**: User can revoke via EVE Online account settings

## Token Lifecycle in KillReport

```
User Login (SSO)
    ↓
Access Token: 20 minutes
Refresh Token: Unlimited
    ↓
Database Storage
    ↓
Queue Script (runs every 5-15 min)
    ├─ Check: expires_at > now + 5min
    └─ Filter: Only users with valid tokens
    ↓
Worker Processing
    ├─ Check: Token expiring in 5 min?
    ├─ YES → Auto-refresh with refresh_token
    └─ NO → Use existing access_token
    ↓
ESI API Request (authenticated)
```

## Buffer Strategy

### Queue Script

```typescript
// Don't queue users whose token expires in < 5 minutes
const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
where: {
  expires_at: {
    gt: fiveMinutesFromNow;
  }
}
```

### Worker

```typescript
// Refresh if token expires in < 5 minutes
const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
if (tokenExpiresAt <= fiveMinutesFromNow) {
  await refreshAccessToken(refreshToken);
}
```

## Why 5-Minute Buffer?

1. **Processing Time**: Queue → Worker may take 1-5 minutes
2. **ESI Requests**: Multiple pages may take 2-3 minutes
3. **Rate Limiting**: Delays between requests add time
4. **Safety Margin**: Prevent mid-request token expiry

## Token Expiry Calculation

```typescript
// On login or refresh
const expiresAt = new Date(Date.now() + expires_in * 1000);

// Example:
// Login: 2025-12-24 10:00:00
// expires_in: 1200 seconds
// expiresAt: 2025-12-24 10:20:00
```

## Database Schema

```sql
CREATE TABLE "user" (
  access_token TEXT NOT NULL,        -- Valid for 20 minutes
  refresh_token TEXT,                -- Valid until revoked
  expires_at TIMESTAMP NOT NULL,     -- When access_token expires
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Monitoring Token Health

### Check Token Status

```sql
-- Users with expired tokens
SELECT
  character_name,
  expires_at,
  expires_at < NOW() as is_expired,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining
FROM "user"
ORDER BY expires_at ASC;

-- Users needing refresh (< 5 min remaining)
SELECT
  character_name,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining
FROM "user"
WHERE expires_at < NOW() + INTERVAL '5 minutes';
```

### Auto-Refresh Statistics

```sql
-- Last token refresh times
SELECT
  character_name,
  updated_at as last_refresh,
  expires_at,
  NOW() - updated_at as time_since_refresh
FROM "user"
ORDER BY updated_at DESC;
```

## Error Scenarios

### Scenario 1: Access Token Expired

- **Detection**: `expires_at` < now + 5min
- **Action**: Auto-refresh using refresh_token
- **Result**: New access_token (20 min), continue processing

### Scenario 2: Refresh Token Invalid

- **Detection**: Refresh request returns 400/401
- **Action**: Skip user, acknowledge message
- **Result**: User must re-login via SSO
- **Reason**: User revoked access or token rotated

### Scenario 3: Both Tokens Missing

- **Detection**: No access_token or refresh_token in message
- **Action**: Skip immediately, don't attempt refresh
- **Result**: User must re-login via SSO

## Best Practices

1. **Never Hardcode Token Lifetime**: Always use `expires_in` from API response
2. **Always Use Buffer**: 5-minute buffer prevents edge cases
3. **Update expires_at on Refresh**: Don't forget to update after refresh
4. **Log Token Events**: Log refresh success/failure for debugging
5. **Don't Retry Auth Errors**: Auth errors won't fix themselves

## EVE Online SSO Documentation

- **Token Endpoint**: https://login.eveonline.com/v2/oauth/token
- **Documentation**: https://docs.esi.evetech.net/docs/sso/
- **JWT Verification**: https://login.eveonline.com/oauth/jwks

## Refresh Token Request

```http
POST https://login.eveonline.com/v2/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=refresh_token&refresh_token={refresh_token}
```

**Response**:

```json
{
  "access_token": "new_token...",
  "token_type": "Bearer",
  "expires_in": 1200, // Always 1200 seconds (20 minutes)
  "refresh_token": "new_refresh_token..."
}
```

## Summary

- **Access Token**: 20 minutes (1200 seconds)
- **Refresh Token**: Unlimited (until revoked)
- **Buffer**: 5 minutes for safety
- **Auto-Refresh**: Happens before token expires
- **User Action**: Only needed if refresh token invalid

**The system handles token refresh automatically!** 🔄
