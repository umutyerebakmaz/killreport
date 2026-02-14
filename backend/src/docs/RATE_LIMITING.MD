# GraphQL API Rate Limiting

## Overview

KillReport GraphQL API implements Redis-based rate limiting to prevent abuse and ensure fair resource distribution among all users. The rate limiting plugin tracks requests per IP address or authenticated user and enforces configurable limits.

## Configuration

### Default Limits

- **Production**: 100 requests per minute per user/IP
- **Development**: 1000 requests per minute per user/IP

### Implementation

Rate limiting is implemented as a GraphQL Yoga plugin in [plugins/rate-limit.plugin.ts](../plugins/rate-limit.plugin.ts) and enabled in [server.ts](../server.ts).

```typescript
createRateLimitPlugin({
  max: config.app.isProduction ? 100 : 1000,
  windowMs: 60_000, // 1 minute
});
```

## Identifier Strategy

The rate limiter uses different identifiers based on authentication status:

### Authenticated Users

- **Key Format**: `ratelimit:user:{token_prefix}`
- **Token Prefix**: First 8 characters of the JWT token
- **Benefit**: Each logged-in user has their own quota

```typescript
// Example key: ratelimit:user:eyJhbGci
```

### Anonymous Users

- **Key Format**: `ratelimit:ip:{ip_address}`
- **IP Detection**: Checks headers in order:
  1. `x-forwarded-for` (first IP in list)
  2. `x-real-ip`
  3. Fallback to 'unknown'

```typescript
// Example key: ratelimit:ip:192.168.1.100
```

## Response Headers

Every API response includes rate limit information in headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1737393600000
```

| Header                  | Description                               |
| ----------------------- | ----------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed in the window    |
| `X-RateLimit-Remaining` | Remaining requests in current window      |
| `X-RateLimit-Reset`     | Unix timestamp (ms) when the limit resets |

## Rate Limit Exceeded

When a client exceeds the rate limit, the API returns a `429 Too Many Requests` response:

### Response Format

```json
{
  "errors": [
    {
      "message": "Rate limit exceeded. Try again in 45 seconds.",
      "extensions": {
        "code": "RATE_LIMIT_EXCEEDED",
        "retryAfter": 45,
        "limit": 100,
        "windowMs": 60000
      }
    }
  ]
}
```

### HTTP Status & Headers

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1737393600000
```

## Client Implementation

### Handling Rate Limits in Frontend

```typescript
const response = await fetch("https://api.killreport.com/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ query, variables }),
});

// Check rate limit headers
const remaining = response.headers.get("X-RateLimit-Remaining");
const reset = response.headers.get("X-RateLimit-Reset");

if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After");
  console.warn(`Rate limited. Retry after ${retryAfter} seconds`);

  // Wait and retry
  await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  return fetchWithRetry(query, variables);
}
```

### Apollo Client Integration

```typescript
import { ApolloLink } from "@apollo/client";

const rateLimitLink = new ApolloLink((operation, forward) => {
  return forward(operation).map((response) => {
    const context = operation.getContext();
    const remaining = context.response?.headers?.get("X-RateLimit-Remaining");

    if (remaining && parseInt(remaining) < 10) {
      console.warn(`⚠️ Low rate limit: ${remaining} requests remaining`);
    }

    return response;
  });
});
```

## Redis Storage

Rate limit counters are stored in Redis with automatic expiration:

### Key Structure

```
ratelimit:user:eyJhbGci -> "42" (TTL: 45s)
ratelimit:ip:192.168.1.100 -> "15" (TTL: 30s)
```

### Storage Logic

1. **First Request**: Create key with TTL = window duration
2. **Subsequent Requests**: Increment counter (TTL preserved)
3. **After Window**: Key expires automatically, counter resets

## Monitoring & Logging

### Log Levels

**Debug**: Every successful request

```
✅ Rate limit: user:eyJhbGci (42/100)
```

**Warning**: Rate limit exceeded

```
🚫 Rate limit exceeded: ip:192.168.1.100 (101/100)
```

**Error**: Redis connection issues (fails open)

```
Rate limit error (failing open): Connection timeout
```

### Metrics to Monitor

1. **Rate limit hit rate**: `429` responses / total requests
2. **Top offenders**: Users/IPs frequently hitting limits
3. **Redis connection health**: Rate limiter errors

## Fail-Safe Behavior

**Critical**: The rate limiter implements "fail open" behavior:

- ✅ If Redis is unavailable, requests are **allowed through**
- ✅ Prevents complete service outage due to Redis failure
- ⚠️ Logs errors for monitoring

```typescript
try {
  // Rate limit check
} catch (error) {
  logger.error("Rate limit error (failing open):", error);
  // Request continues without rate limiting
}
```

## Adjusting Limits

### Temporary Increase (via Environment)

```bash
# Not currently supported - requires code change
```

### Permanent Change

Edit [server.ts](../server.ts):

```typescript
createRateLimitPlugin({
  max: 200, // Increase to 200 req/min
  windowMs: 60_000,
});
```

### Per-User Override (Future Enhancement)

Consider implementing user-tier based limits:

```typescript
// Premium users: 500 req/min
// Regular users: 100 req/min
// Anonymous: 50 req/min
```

## Best Practices

### For Frontend Developers

1. **Respect Headers**: Monitor `X-RateLimit-Remaining`
2. **Implement Backoff**: Wait before retrying on `429`
3. **Batch Queries**: Use GraphQL query batching to reduce request count
4. **Cache Responses**: Leverage client-side caching

### For API Users

1. **Use Authentication**: Authenticated users get separate quotas
2. **Avoid Polling**: Use subscriptions instead of frequent polling
3. **Handle 429 Gracefully**: Show user-friendly error messages
4. **Optimize Queries**: Fetch only needed fields to stay within limits

## Security Considerations

### DDoS Protection

Rate limiting provides basic DDoS protection but should be combined with:

- Nginx request rate limiting (L7 layer)
- Cloudflare or similar CDN (L3/4 layer)
- IP blocklist for persistent attackers

### IP Spoofing

- Trust `x-forwarded-for` only behind trusted proxy (Nginx)
- Production nginx config should strip/override this header
- Consider implementing IP whitelist for known services

### Token-based Bypass

- Leaked tokens can still abuse the API within user's quota
- Monitor for unusual patterns in authenticated requests
- Implement token rotation on suspicious activity

## Troubleshooting

### Users Complaining About Rate Limits

1. Check logs for their identifier
2. Verify if they're actually exceeding limits
3. Review their query patterns (inefficient queries?)
4. Consider increasing limits for legitimate heavy users

### Redis Performance

Monitor Redis memory usage:

```bash
# Check memory usage
redis-cli info memory

# Check key count
redis-cli dbsize

# Sample rate limit keys
redis-cli keys "ratelimit:*" | head -10
```

### Manual Reset

Clear rate limit for specific user/IP:

```bash
# Clear specific user
redis-cli del "ratelimit:user:eyJhbGci"

# Clear all rate limits (careful!)
redis-cli keys "ratelimit:*" | xargs redis-cli del
```

## Future Enhancements

- [ ] Tiered rate limits based on user subscription
- [ ] Dynamic limits based on server load
- [ ] Per-query complexity scoring
- [ ] Persistent rate limit violations tracking
- [ ] Admin dashboard for monitoring
- [ ] Automatic IP blocking after X violations

## Related Documentation

- [Response Caching](./RESPONSE_CACHING.MD) - How caching reduces rate limit pressure
- [Redis Setup](../../redis/REDIS_SETUP.MD) - Redis configuration
- [GraphQL API](../README.MD) - General API documentation
