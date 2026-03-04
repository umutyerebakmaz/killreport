# Rate Limiting Deployment Steps

## 1. Backend Update

```bash
# Navigate to backend directory
cd /root/killreport/backend

# Git pull (if using repo)
git pull origin main

# Or manually copy files
scp -r backend/src/plugins/rate-limit.plugin.ts root@api.killreport.com:/root/killreport/backend/src/plugins/
scp backend/src/server.ts root@api.killreport.com:/root/killreport/backend/src/

# Restart with PM2
pm2 restart killreport-backend
pm2 logs killreport-backend --lines 50
```

## 2. Nginx Config Update

```bash
# Update Nginx config
sudo nano /etc/nginx/sites-available/killreport-backend

# Add the following lines to the /graphql location block:
# (after proxy_set_header lines, before timeout lines)

        # Pass rate limit headers from backend to client
        proxy_hide_header X-RateLimit-Limit;
        proxy_hide_header X-RateLimit-Remaining;
        proxy_hide_header X-RateLimit-Reset;
        add_header X-RateLimit-Limit $upstream_http_x_ratelimit_limit always;
        add_header X-RateLimit-Remaining $upstream_http_x_ratelimit_remaining always;
        add_header X-RateLimit-Reset $upstream_http_x_ratelimit_reset always;

# Nginx syntax check
sudo nginx -t

# Nginx reload
sudo systemctl reload nginx
```

## 3. Test

```bash
# Test rate limit headers
curl -I https://api.killreport.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -i ratelimit

# Expected output:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1737393600000
```

## 4. Redis Check

```bash
# Check rate limit keys in Redis
redis-cli keys "ratelimit:*"

# View specific key value
redis-cli get "ratelimit:ip:YOUR_IP"

# TTL check
redis-cli ttl "ratelimit:ip:YOUR_IP"
```

## 5. Log Check

```bash
# Search for rate limit messages in backend logs
pm2 logs killreport-backend | grep "Rate limit"

# Expected output:
# ✅ Rate limit: ip:123.45.67.89 (1/100)
# ✅ Rate limit: user:eyJhbGci (5/100)
```

## Troubleshooting

### Headers still not showing

1. Verify Nginx config is in the correct location
2. Check for syntax errors with `sudo nginx -t`
3. Did you reload with `sudo systemctl reload nginx`?
4. Clear browser cache (Ctrl+Shift+R)

### Rate limiting not working

1. Check Redis connection: `redis-cli ping`
2. Are there "Rate limit error" messages in backend logs?
3. Are there errors after PM2 restart? `pm2 logs killreport-backend --err`

### Always getting "Rate limit exceeded"

1. Clear Redis keys: `redis-cli keys "ratelimit:*" | xargs redis-cli del`
2. Temporarily increase limit (server.ts: max: 1000)
