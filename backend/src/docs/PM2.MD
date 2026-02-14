# PM2 Process Management - KillReport

This documentation explains in detail all services, workers, and scheduled tasks managed with PM2 in the KillReport project.

## 📊 Overview

KillReport project uses **15 different PM2 processes**:

- **2** Main Services (Backend + Frontend)
- **8** Continuously Active Workers (runs 7/24)
- **5** Scheduled Tasks (Cron jobs)

---

## 🖥️ Main Services (7/24 Active)

### 1. killreport-backend

```bash
pm2 start ecosystem.config.js --only killreport-backend
pm2 logs killreport-backend
pm2 restart killreport-backend
```

| Property               | Value                                          |
| ---------------------- | ---------------------------------------------- |
| **Command**            | `yarn start`                                   |
| **Port**               | 4000                                           |
| **Description**        | GraphQL Yoga API server                        |
| **Memory Limit**       | 1 GB                                           |
| **Log**                | `/var/www/killreport/logs/backend-*.log`       |
| **Environment Variables** | `NODE_ENV=production`, `USE_REDIS_PUBSUB=true` |

**What it does:**

- Serves GraphQL API endpoints
- WebSocket subscriptions (real-time updates)
- Receives events from workers via Redis pub/sub
- Prevents N+1 problem with DataLoader

---

### 2. killreport-frontend

```bash
pm2 start ecosystem.config.js --only killreport-frontend
pm2 logs killreport-frontend
pm2 restart killreport-frontend
```

| Property          | Value                                     |
| ----------------- | ----------------------------------------- |
| **Command**       | `yarn start`                              |
| **Port**          | 3000                                      |
| **Description**   | Next.js 15 App Router frontend            |
| **Memory Limit**  | 1 GB                                      |
| **Log**           | `/var/www/killreport/logs/frontend-*.log` |

**What it does:**

- React-based user interface
- Server-side rendering (SSR)
- GraphQL integration with Apollo Client
- EVE SSO authentication

---

## ⚙️ Continuously Active Workers (Run 7/24)

These workers continuously listen to RabbitMQ queues and process.

### 3. worker-redisq

```bash
pm2 start ecosystem.config.js --only worker-redisq
pm2 logs worker-redisq
```

| Property           | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Command**        | `yarn worker:redisq`                           |
| **Description**    | RedisQ stream - Real-time killmail ingestion   |
| **Memory Limit**   | 512 MB                                         |
| **Autorestart**    | ✅ Yes                                         |
| **Restart Delay**  | 5 seconds                                      |
| **Log**            | `/var/www/killreport/logs/worker-redisq-*.log` |

**What it does:**

- Listens to live killmail stream from zKillboard RedisQ API
- Saves each new killmail to database
- Adds entities to queue for real-time enrichment
- Sends notification to frontend via Redis pub/sub

**Rate Limit:** 1 request per second (zKillboard limit)

---

### 4. worker-characters

```bash
pm2 start ecosystem.config.js --only worker-characters
pm2 logs worker-characters
```

| Property         | Value                                              |
| ---------------- | -------------------------------------------------- |
| **Command**      | `yarn worker:info:characters`                      |
| **Description**  | Fetches and updates character information from ESI |
| **Queue**        | `esi_character_info_queue`                         |
| **Concurrency**  | 10 (prefetch)                                      |
| **Memory Limit** | 512 MB                                             |
| **Log**          | `/var/www/killreport/logs/worker-characters-*.log` |

**What it does:**

- Gets character IDs from queue
- Fetches character information from ESI API
- Does UPSERT in database (updates or adds)
- Updates information like corporation_id, alliance_id

**Fields Processed:** `name`, `corporation_id`, `alliance_id`, `birthday`, `security_status`, `title`

---

### 5. worker-corporations

```bash
pm2 start ecosystem.config.js --only worker-corporations
pm2 logs worker-corporations
```

| Property         | Value                                                |
| ---------------- | ---------------------------------------------------- |
| **Command**      | `yarn worker:info:corporations`                      |
| **Description**  | Fetches corporation information from ESI             |
| **Queue**        | `esi_corporation_info_queue`                         |
| **Concurrency**  | 5 (prefetch)                                         |
| **Memory Limit** | 512 MB                                               |
| **Log**          | `/var/www/killreport/logs/worker-corporations-*.log` |

**What it does:**

- Gets corporation IDs from queue
- Fetches corporation details from ESI API
- Does UPSERT in database

**Fields Processed:** `name`, `ticker`, `member_count`, `ceo_id`, `alliance_id`, `tax_rate`

---

### 6. worker-alliances

```bash
pm2 start ecosystem.config.js --only worker-alliances
pm2 logs worker-alliances
```

| Property         | Value                                             |
| ---------------- | ------------------------------------------------- |
| **Command**      | `yarn worker:info:alliances`                      |
| **Description**  | Fetches alliance information from ESI             |
| **Queue**        | `esi_alliance_info_queue`                         |
| **Concurrency**  | 3 (prefetch)                                      |
| **Memory Limit** | 512 MB                                            |
| **Log**          | `/var/www/killreport/logs/worker-alliances-*.log` |

**What it does:**

- Gets alliance IDs from queue
- Fetches alliance details from ESI API
- Does UPSERT in database

**Fields Processed:** `name`, `ticker`, `executor_corporation_id`, `faction_id`, `date_founded`

---

### 7. worker-alliance-corporations

```bash
pm2 start ecosystem.config.js --only worker-alliance-corporations
pm2 logs worker-alliance-corporations
```

| Property         | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| **Command**      | `yarn worker:alliance-corporations`                           |
| **Description**  | Discovers corporations belonging to alliances                 |
| **Queue**        | `esi_alliance_corporations_queue`                             |
| **Concurrency**  | 5 (prefetch)                                                  |
| **Memory Limit** | 512 MB                                                        |
| **Log**          | `/var/www/killreport/logs/worker-alliance-corporations-*.log` |

**What it does:**

- Gets alliance IDs from queue
- Fetches corporation list of that alliance from ESI
- Adds found corporation IDs to `esi_corporation_info_queue`
- Critical for corporation discovery

**API Endpoint:** `GET /alliances/{alliance_id}/corporations/`

---

### 8. worker-types

```bash
pm2 start ecosystem.config.js --only worker-types
pm2 logs worker-types
```

| Property         | Value                                         |
| ---------------- | --------------------------------------------- |
| **Command**      | `yarn worker:info:types`                      |
| **Description**  | Fetches ship, module, item info from ESI      |
| **Queue**        | `esi_type_info_queue`                         |
| **Concurrency**  | 10 (prefetch)                                 |
| **Memory Limit** | 512 MB                                        |
| **Log**          | `/var/www/killreport/logs/worker-types-*.log` |

**What it does:**

- Gets type IDs (ship, module, etc.) from queue
- Fetches type details from ESI API
- Does UPSERT in database

**Fields Processed:** `name`, `description`, `group_id`, `mass`, `volume`, `capacity`

---

### 9. worker-zkillboard

```bash
pm2 start ecosystem.config.js --only worker-zkillboard
pm2 logs worker-zkillboard
```

| Property         | Value                                              |
| ---------------- | -------------------------------------------------- |
| **Command**      | `yarn worker:zkillboard`                           |
| **Description**  | Character killmail sync from zKillboard            |
| **Queue**        | `zkillboard_character_queue`                       |
| **Concurrency**  | 1 (prefetch)                                       |
| **Memory Limit** | 512 MB                                             |
| **Log**          | `/var/www/killreport/logs/worker-zkillboard-*.log` |

**What it does:**

- Gets character IDs from queue
- Fetches killmail history from zKillboard API (pagination)
- Gets detailed information from ESI for each killmail
- Saves to database

**Rate Limit:** 10 second delay (for same endpoint)

---

### 10. worker-user-killmails

```bash
pm2 start ecosystem.config.js --only worker-user-killmails
pm2 logs worker-user-killmails
```

| Property          | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| **Command**       | `yarn worker:user-killmails`                           |
| **Description**   | Fetches killmails of logged-in users from ESI          |
| **Queue**         | `user_killmail_queue`                                  |
| **Concurrency**   | 1 (prefetch)                                           |
| **Memory Limit**  | 512 MB                                                 |
| **Restart Delay** | 5 seconds                                              |
| **Log**           | `/var/www/killreport/logs/worker-user-killmails-*.log` |

**What it does:**

- Uses ESI authenticated endpoint with user token
- Fetches last 50 killmails (max allowed)
- Incremental sync (adds only new killmails)
- Updates `last_killmail_sync_at` timestamp

**ESI Endpoint:** `GET /characters/{character_id}/killmails/recent/`

---

## ⏰ Scheduled Tasks (PM2 Cron Mode)

These jobs run automatically at specific times and close when complete.

### 11. queue-characters

```bash
pm2 start ecosystem.config.js --only queue-characters
pm2 trigger queue-characters  # Manual trigger
pm2 logs queue-characters
```

| Property          | Value                                             |
| ----------------- | ------------------------------------------------- |
| **Command**       | `yarn queue:characters`                           |
| **Run Time**      | 1st of every month 00:00 UTC                      |
| **Cron**          | `0 0 1 * *`                                       |
| **Description**   | Adds all characters to queue (monthly)            |
| **Autorestart**   | ❌ No (one-time)                                  |
| **Log**           | `/var/www/killreport/logs/queue-characters-*.log` |

**What it does:**

- Scans all character IDs in database (~93k)
- Adds to `esi_character_info_queue`
- `worker-characters` processes them
- Keeps character information current

**How It Works:**

- Runs on 1st of every month at 00:00 UTC
- Updates all characters at beginning of month
- Adding 93k characters to queue is done in one go

---

### 12. queue-alliances

```bash
pm2 start ecosystem.config.js --only queue-alliances
pm2 trigger queue-alliances
pm2 logs queue-alliances
```

| Property          | Value                                            |
| ----------------- | ------------------------------------------------ |
| **Command**       | `yarn queue:alliances`                           |
| **Run Time**      | Every Sunday 00:00 UTC (weekly)                  |
| **Cron**          | `0 0 * * 0`                                      |
| **Description**   | Fetches all alliances from ESI and adds to queue |
| **Autorestart**   | ❌ No (one-time)                                 |
| **Log**           | `/var/www/killreport/logs/queue-alliances-*.log` |

**What it does:**

- Gets all alliance IDs from ESI (~3,500)
- Adds to `esi_alliance_info_queue`
- `worker-alliances` processes them
- Keeps alliance information current

**How It Works:**

- Starts every Sunday at 00:00
- Alliance list is updated weekly
- Discovers newly created alliances

---

### 13. queue-alliance-corporations

```bash
pm2 start ecosystem.config.js --only queue-alliance-corporations
pm2 trigger queue-alliance-corporations
pm2 logs queue-alliance-corporations
```

| Property          | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| **Command**       | `yarn queue:alliance-corporations`                              |
| **Run Time**      | Every Sunday 00:10 UTC (weekly)                                 |
| **Cron**          | `10 0 * * 0`                                                    |
| **Description**   | Adds to queue to discover corporations of alliances             |
| **Autorestart**   | ❌ No (one-time)                                                |
| **Log**           | `/var/www/killreport/logs/queue-alliance-corporations-*.log`    |

**What it does:**

- Gets all alliance IDs from database
- Adds to `esi_alliance_corporations_queue`
- `worker-alliance-corporations` fetches corporation list for each alliance
- Adds found corporations to `esi_corporation_info_queue`

**How It Works:**

- Starts 10 minutes after queue-alliances
- Discovers corporations belonging to alliances
- Critical for corporation discovery

---

### 14. queue-character-corporations

```bash
pm2 start ecosystem.config.js --only queue-character-corporations
pm2 trigger queue-character-corporations
pm2 logs queue-character-corporations
```

| Property          | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| **Command**       | `yarn queue:character-corporations`                           |
| **Run Time**      | Every day 04:00 UTC                                           |
| **Cron**          | `0 4 * * *`                                                   |
| **Description**   | Detects missing corporations and adds to queue                |
| **Autorestart**   | ❌ No                                                         |
| **Log**           | `/var/www/killreport/logs/queue-character-corporations-*.log` |

**What it does:**

- Collects corporation_ids from characters (~24k unique)
- Finds those not in database
- Adds to `esi_corporation_info_queue`
- `worker-corporations` processes them

**Use Case:** Adding corporations from new killmails

---

### 15. snapshot-alliances

```bash
pm2 start ecosystem.config.js --only snapshot-alliances
pm2 trigger snapshot-alliances
pm2 logs snapshot-alliances
```

| Property          | Value                                               |
| ----------------- | --------------------------------------------------- |
| **Command**       | `yarn snapshot:alliances`                           |
| **Run Time**      | Every day 01:00 UTC                                 |
| **Cron**          | `0 1 * * *`                                         |
| **Description**   | Takes daily snapshot of alliance information        |
| **Autorestart**   | ❌ No                                               |
| **Log**           | `/var/www/killreport/logs/snapshot-alliances-*.log` |

**What it does:**

- Saves current state of all alliances to snapshot table
- Used for historical data
- Tracks member count, ticker changes

**Snapshot Table:** `alliance_snapshots`

---

### 16. snapshot-corporations

```bash
pm2 start ecosystem.config.js --only snapshot-corporations
pm2 trigger snapshot-corporations
pm2 logs snapshot-corporations
```

| Property          | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| **Command**       | `yarn snapshot:corporations`                           |
| **Run Time**      | Every day 01:00 UTC                                    |
| **Cron**          | `0 1 * * *`                                            |
| **Description**   | Takes daily snapshot of corporation information        |
| **Autorestart**   | ❌ No                                                  |
| **Log**           | `/var/www/killreport/logs/snapshot-corporations-*.log` |

**What it does:**

- Saves current state of all corporations to snapshot table
- Tracks member count, CEO, alliance changes

**Snapshot Table:** `corporation_snapshots`

---

### 17. update-alliance-counts

```bash
pm2 start ecosystem.config.js --only update-alliance-counts
pm2 trigger update-alliance-counts
pm2 logs update-alliance-counts
```

| Property          | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| **Command**       | `yarn update:alliance-counts`                           |
| **Run Time**      | Every day 01:00 UTC                                     |
| **Cron**          | `0 1 * * *`                                             |
| **Description**   | Updates alliance statistics                             |
| **Autorestart**   | ❌ No                                                   |
| **Log**           | `/var/www/killreport/logs/update-alliance-counts-*.log` |

**What it does:**

- Calculates killmail counts for each alliance
- Updates cached statistics
- Critical for API performance

---

## 📋 PM2 Commands

### Managing All Services

```bash
# Start all services
pm2 start ecosystem.config.js

# Restart all services (with downtime)
pm2 restart all

# Reload all services (without downtime)
pm2 reload all

# Stop all services
pm2 stop all

# Delete all services
pm2 delete all

# View status
pm2 list

# Detailed info
pm2 show killreport-backend

# Save configuration (persistent after reboot)
pm2 save

# Create startup script (automatic start)
pm2 startup
```

### Managing Single Service

```bash
# Start specific service
pm2 start ecosystem.config.js --only worker-redisq

# Restart
pm2 restart worker-redisq

# Stop
pm2 stop worker-redisq

# Delete
pm2 delete worker-redisq

# Manually trigger cron job
pm2 trigger queue-characters
```

### Log Management

```bash
# Watch all logs live
pm2 logs

# Watch specific service logs
pm2 logs worker-redisq

# Show last 100 lines
pm2 logs worker-redisq --lines 100

# Show only errors
pm2 logs --err

# Clear logs
pm2 flush
```

### Monitoring

```bash
# Monitor resource usage (CPU, Memory)
pm2 monit

# Status in JSON format
pm2 jlist

# Simple table view
pm2 list

# PM2 Plus (Web dashboard - optional)
pm2 plus
```

---

## 📊 Service Categories - Summary Table

### Main Services (2)

| PM2 Name              | Command      | Port | Memory | Description |
| --------------------- | ------------ | ---- | ------ | ----------- |
| `killreport-backend`  | `yarn start` | 4000 | 1GB    | GraphQL API |
| `killreport-frontend` | `yarn start` | 3000 | 1GB    | Next.js UI  |

### Continuously Active Workers (8)

| PM2 Name                       | Command                             | Queue                             | Concurrency | Description                  |
| ------------------------------ | ----------------------------------- | --------------------------------- | ----------- | ---------------------------- |
| `worker-redisq`                | `yarn worker:redisq`                | RedisQ Stream                     | 1           | Real-time killmail ingestion |
| `worker-characters`            | `yarn worker:info:characters`       | `esi_character_info_queue`        | 10          | Character info sync          |
| `worker-corporations`          | `yarn worker:info:corporations`     | `esi_corporation_info_queue`      | 5           | Corporation info sync        |
| `worker-alliances`             | `yarn worker:info:alliances`        | `esi_alliance_info_queue`         | 3           | Alliance info sync           |
| `worker-alliance-corporations` | `yarn worker:alliance-corporations` | `esi_alliance_corporations_queue` | 5           | Corp discovery               |
| `worker-types`                 | `yarn worker:info:types`            | `esi_type_info_queue`             | 10          | Item/ship info               |
| `worker-zkillboard`            | `yarn worker:zkillboard`            | `zkillboard_character_queue`      | 1           | zKillboard sync              |
| `worker-user-killmails`        | `yarn worker:user-killmails`        | `user_killmail_queue`             | 1           | User ESI sync                |

### Scheduled Tasks (5)

| PM2 Name                       | Command                             | Run Time           | Description                           |
| ------------------------------ | ----------------------------------- | ------------------ | ------------------------------------- |
| `queue-characters`             | `yarn queue:characters`             | 1st of month 00:00 UTC | Add characters to queue (monthly)     |
| `queue-alliances`              | `yarn queue:alliances`              | Sunday 00:00 UTC   | Add alliances to queue (weekly)       |
| `queue-alliance-corporations`  | `yarn queue:alliance-corporations`  | Sunday 00:10 UTC   | Discover alliance corps (weekly)      |
| `queue-character-corporations` | `yarn queue:character-corporations` | Daily 04:00 UTC    | Add missing corps to queue            |
| `snapshot-alliances`           | `yarn snapshot:alliances`           | Daily 01:00 UTC    | Alliance snapshot                     |
| `snapshot-corporations`        | `yarn snapshot:corporations`        | Daily 01:00 UTC    | Corporation snapshot                  |
| `update-alliance-counts`       | `yarn update:alliance-counts`       | Daily 01:00 UTC    | Alliance statistics                   |

---

## 🔄 Daily/Weekly Workflow

### Sunday (Weekly)

```
00:00 UTC ─────▶ queue-alliances runs
                  └─▶ ~3,500 alliances fetched from ESI
                       └─▶ Added to esi_alliance_info_queue
                            └─▶ worker-alliances processes

00:10 UTC ─────▶ queue-alliance-corporations runs
                  └─▶ Alliance corporation lists fetched
                       └─▶ Added to esi_alliance_corporations_queue
                            └─▶ worker-alliance-corporations processes
                                 └─▶ Corporation IDs added to esi_corporation_info_queue
```

### Every Day (01:00 UTC - Runs in Parallel)

```
01:00 UTC ─────▶ 3 JOBS START IN PARALLEL:
                  ├─▶ snapshot-alliances
                  │    └─▶ Alliance state snapshotted
                  │
                  ├─▶ snapshot-corporations
                  │    └─▶ Corporation state snapshotted
                  │
                  └─▶ update-alliance-counts
                       └─▶ Alliance statistics updated
```

### Every Day (04:00 UTC)

```
04:00 UTC ─────▶ queue-character-corporations runs
                  └─▶ Missing corps detected from characters
                       └─▶ Added to esi_corporation_info_queue
                            └─▶ worker-corporations processes
```

### 1st of Month (Monthly)

```
00:00 UTC ─────▶ queue-characters runs (ONLY ON 1ST OF MONTH)
                  └─▶ ~93k characters scanned from database
                       └─▶ Added to esi_character_info_queue
                            └─▶ worker-characters processes (~31 minutes)
```

### 7/24 Continuously Running Workers

```
Continuous ──────▶ worker-redisq (real-time killmail stream)
              └─▶ worker-characters (character info queue)
              └─▶ worker-corporations (corporation info queue)
              └─▶ worker-alliances (alliance info queue)
              └─▶ worker-alliance-corporations (corp discovery queue)
              └─▶ worker-types (item/ship info queue)
              └─▶ worker-zkillboard (zkillboard sync queue)
              └─▶ worker-user-killmails (user ESI sync queue)
```

---

## 📅 Scheduled Tasks - Weekly Calendar

| Day          | Time (UTC) | Job                          | Description                               |
| ------------ | ---------- | ---------------------------- | ----------------------------------------- |
| **Sunday**   | 00:00      | queue-alliances              | Fetches all alliances from ESI, adds to queue |
| **Sunday**   | 00:10      | queue-alliance-corporations  | Discovers alliance corporations           |
| **Every day** | 01:00     | snapshot-alliances           | Takes alliance snapshot (parallel)        |
| **Every day** | 01:00     | update-alliance-counts       | Updates alliance killmail counts (parallel) |
| **Every day** | 01:00     | snapshot-corporations        | Takes corporation snapshot (parallel)     |
| **Every day** | 04:00     | queue-character-corporations | Detects missing corporations              |
| **Monthly**  | 00:00      | queue-characters (1st day)   | Adds all characters to queue              |

---

## 🔧 Typical Use Scenarios

### New Deployment (Initial Setup)

```bash
# 1. Start all services
pm2 start ecosystem.config.js

# 2. Check status
pm2 status
pm2 logs

# 3. Save for automatic startup
pm2 save
pm2 startup
```

### Alliance & Corporation Update (Manual)

```bash
# Sunday workflow (normally runs automatically)
pm2 trigger queue-alliances              # 00:00 UTC
pm2 trigger queue-alliance-corporations  # 00:10 UTC

# Daily workflow (normally runs automatically)
pm2 trigger snapshot-alliances           # 01:00 UTC
pm2 trigger update-alliance-counts       # 01:00 UTC
pm2 trigger snapshot-corporations        # 01:00 UTC
pm2 trigger queue-character-corporations # 04:00 UTC

# Monthly workflow (1st of month - automatic)
pm2 trigger queue-characters             # 00:00 UTC
```

### Initial Setup

```bash
# 1. Connect to server
ssh killreport@YOUR_SERVER -p 7777

# 2. Clone project (skip if already exists)
cd /var/www
git clone https://github.com/umutyerebakmaz/killreport.git
cd killreport

# 3. Install dependencies
yarn install
cd backend && yarn install
cd ../frontend && yarn install
cd ..

# 4. Setup environment variables
cp backend/.env.example backend/.env
# Edit .env file

# 5. Database migrations
cd backend
yarn prisma:migrate:deploy
yarn prisma:generate

# 6. Build
cd ../frontend
yarn build

# 7. Start PM2
cd ..
pm2 start ecosystem.config.js

# 8. Save PM2
pm2 save

# 9. Automatic startup
pm2 startup
# Run the output command (with sudo)
```

### Update

```bash
# 1. Code update
cd /var/www/killreport
git pull

# 2. Update dependencies (if needed)
yarn install

# 3. Database migrations (if needed)
cd backend
yarn prisma:migrate:deploy

# 4. Frontend build (if changes)
cd ../frontend
yarn build

# 5. PM2 reload (without downtime)
cd ..
pm2 reload ecosystem.config.js

# 6. Save
pm2 save
```

### Health Check

```bash
# Status of all services
pm2 list

# Resource usage
pm2 monit

# Check logs
pm2 logs --lines 50

# Status of specific worker
pm2 show worker-redisq

# RabbitMQ queue status
# Via GraphQL query:
# query { workerStatus { queueName messageCount consumerCount } }
```

---

## ⚠️ Troubleshooting

### Worker Not Running

```bash
# 1. Check status
pm2 list

# 2. Examine logs
pm2 logs worker-characters --lines 100

# 3. Restart
pm2 restart worker-characters

# 4. Check RabbitMQ connection
# Is RABBITMQ_URL correct in .env?

# 5. Are there messages in queue?
# GraphQL: query { workerStatus }
```

### Memory Problem

```bash
# Show memory usage
pm2 list

# Increase max memory (in ecosystem.config.js)
max_memory_restart: '1G'

# Reload
pm2 reload ecosystem.config.js
```

### Cron Job Didn't Run

```bash
# Cron job status
pm2 list | grep queue

# Trigger manually
pm2 trigger queue-characters

# Check logs
pm2 logs queue-characters

# Is PM2 daemon running?
pm2 ping
```

### Process Restart Loop

```bash
# Examine error logs
pm2 logs worker-redisq --err --lines 100

# Fix problem (usually connection error)

# Clean process and restart
pm2 delete worker-redisq
pm2 start ecosystem.config.js --only worker-redisq
```

---

## 📚 Related Documentation

- [Daily Workflows](./DAILY.MD) - Daily operations
- [Worker Documentation](./WORKERS_DOCUMENTATION.MD) - Worker details
- [Enrichment System](./ENRICHMENT_README.MD) - Entity enrichment
- [Production Deployment](./PRODUCTION_DEPLOYMENT.MD) - Deployment guide
- [CRON Schedule](../../deployment/CRON_SCHEDULE.MD) - Scheduled tasks

---

## 🔗 Useful Links

- **RabbitMQ Management:** `http://localhost:15672`
- **Backend API:** `http://localhost:4000/graphql`
- **Frontend:** `http://localhost:3000`
- **PM2 Plus:** `https://app.pm2.io` (optional)

---

**Last Updated:** January 8, 2026
**PM2 Version:** 5.x
**Total Processes:** 17 (2 services + 8 workers + 7 cron)
