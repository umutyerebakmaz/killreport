# WebSocket Subscriptions — Deployment Steps

GraphQL subscriptions moved from SSE to WebSocket (`graphql-ws`). Subscriptions
now connect to `wss://api.killreport.com/graphql`. The Nginx reverse proxy must
forward the WebSocket upgrade on `/graphql`, otherwise subscriptions fail while
queries/mutations keep working.

## Why

Each SSE subscription held its own long-lived HTTP/1.1 connection. Browsers cap
~6 connections per origin, so the always-on subscriptions (active users,
sovereignty alerts, new killmails) exhausted the pool and left regular GraphQL
queries stuck "pending". A single WebSocket multiplexes all subscriptions, so
the HTTP connection budget stays free for queries.

## 1. Nginx

The updated site config is committed at `backend/docs/deployment/killreport-backend`.
Two changes vs. the old SSE config:

1. A `map` block (http context, before `server {}`) that sets the `Connection`
   header conditionally — `upgrade` for WS handshakes, `close` for normal HTTP:

   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       ''      close;
   }
   ```

2. Inside `location /graphql`, forward the upgrade:

   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection $connection_upgrade;   # was: Connection '';
   ```

> A hard-coded `Connection "upgrade"` would break normal HTTP GraphQL requests —
> the `map` is required because `/graphql` serves both HTTP and WS on one path.
> The existing 24h `proxy_read_timeout`/`proxy_send_timeout` keep long-lived WS
> connections alive.

Apply on the server:

```bash
sudo cp /var/www/killreport/backend/docs/deployment/killreport-backend \
        /etc/nginx/sites-available/killreport-backend
sudo nginx -t          # syntax check
sudo systemctl reload nginx
```

## 2. Frontend

No new env var is needed. The Apollo client derives the WS URL from the existing
`NEXT_PUBLIC_GRAPHQL_URL` (`https://…` → `wss://…`). Just rebuild/redeploy the
frontend with the new code.

## 3. Backend

No PM2 change. The WS server runs on the same process/port (4000) as the HTTP
server (`WebSocketServer({ server, path: '/graphql' })`). Just restart the
backend with the new build:

```bash
pm2 restart killreport-backend
```

## 4. Verify

```bash
# WS handshake should return HTTP/1.1 101 Switching Protocols
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: $(head -c16 /dev/urandom | base64)" \
  https://api.killreport.com/graphql
```

In the browser: DevTools → Network → filter `graphql` → one `websocket` entry
with status `101`, and no queries stuck pending.
