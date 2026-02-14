# PM2 Process Management - KillReport

This document contains information about managing the KillReport project with PM2.

## Table of Contents

- [Overview](#overview)
- [Process List](#process-list)
- [PM2 Commands](#pm2-commands)
- [Monitoring](#monitoring)
- [Log Management](#log-management)
- [Cron Jobs](#cron-jobs)

## Overview

KillReport manages 16 different processes using PM2:

- **2 Applications**: Backend API and Frontend
- **8 Workers**: Real-time and queue-based data processing
- **6 Cron Jobs**: Scheduled maintenance and data sync operations

All processes are defined in the `ecosystem.config.js` file.

## Process List

### Web Applications

#### 1. killreport-backend

- **Description**: GraphQL API server
- **Port**: 4000
- **Command**: `yarn start`
- **Memory Limit**: 1GB
- **Logs**: `/var/www/killreport/logs/backend-*.log`

#### 2. killreport-frontend

- **Description**: Next.js frontend application
- **Port**: 3000
- **Command**: `yarn start`
- **Memory Limit**: 1GB
- **Logs**: `/var/www/killreport/logs/frontend-*.log`

### Workers (Always Running)

#### 3. worker-redisq

- **Description**: Real-time killmail ingestion (zKillboard RedisQ)
- **Command**: `yarn worker:redisq`
- **Memory Limit**: 512MB
- **Restart**: Auto restart enabled, 5 second delay
- **Logs**: `/var/www/killreport/logs/worker-redisq-*.log`

#### 4. worker-alliances

- **Description**: Fetches alliance info from ESI (prefetch: 3)
- **Command**: `yarn worker:info:alliances`
- **Queue**: `esi_alliance_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-alliances-*.log`

#### 5. worker-corporations

- **Description**: Fetches corporation info from ESI (prefetch: 5)
- **Command**: `yarn worker:info:corporations`
- **Queue**: `esi_corporation_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-corporations-*.log`

#### 6. worker-alliance-corporations

- **Description**: Discovers corporations within alliances (prefetch: 5)
- **Command**: `yarn worker:alliance-corporations`
- **Queue**: `esi_alliance_corporations_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-alliance-corporations-*.log`

#### 7. worker-types

- **Description**: Fetches ship and module info (prefetch: 10)
- **Command**: `yarn worker:info:types`
- **Queue**: `esi_type_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-types-*.log`

#### 8. worker-zkillboard

- **Description**: zKillboard character killmail sync (prefetch: 1)
- **Command**: `yarn worker:zkillboard`
- **Queue**: `zkillboard_character_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-zkillboard-*.log`

#### 9. worker-user-killmails

- **Description**: Fetches user killmails from ESI (prefetch: 1)
- **Command**: `yarn worker:user-killmails`
- **Memory Limit**: 512MB
- **Restart**: Auto restart enabled, 5 second delay
- **Logs**: `/var/www/killreport/logs/worker-user-killmails-*.log`

#### 10. worker-characters

- **Description**: Fetches character info with high concurrency (prefetch: 10)
- **Command**: `yarn worker:info:characters`
- **Queue**: `esi_character_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-characters-*.log`

#### 11. worker-prices

- **Description**: Fetches item prices (prefetch: 10)
- **Command**: `yarn worker:prices`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-prices-*.log`

### Cron Jobs (Scheduled)

#### 12. queue-characters

- **Description**: Adds characters to queue
- **Schedule**: 1st of each month, 00:00 UTC (`0 0 1 * *`)
- **Command**: `yarn queue:characters`
- **Logs**: `/var/www/killreport/logs/queue-characters-*.log`

#### 13. queue-alliances

- **Description**: Adds alliances to queue
- **Schedule**: Daily at 22:00 UTC / 01:00 Turkey Time (`0 22 * * *`)
- **Command**: `yarn queue:alliances`
- **Logs**: `/var/www/killreport/logs/queue-alliances-*.log`

#### 14. queue-alliance-corporations

- **Description**: Adds alliance corporations to queue
- **Schedule**: Daily at 22:05 UTC / 01:05 Turkey Time (`5 22 * * *`)
- **Command**: `yarn queue:alliance-corporations`
- **Logs**: `/var/www/killreport/logs/queue-alliance-corporations-*.log`

#### 15. snapshot-alliances

- **Description**: Takes alliance snapshots
- **Schedule**: Daily at 01:00 UTC (`0 1 * * *`)
- **Command**: `yarn snapshot:alliances`
- **Logs**: `/var/www/killreport/logs/snapshot-alliances-*.log`

#### 16. update-alliance-counts

- **Description**: Updates alliance counts
- **Schedule**: Daily at 01:00 UTC (`0 1 * * *`)
- **Command**: `yarn update:alliance-counts`
- **Logs**: `/var/www/killreport/logs/update-alliance-counts-*.log`

#### 17. snapshot-corporations

- **Description**: Takes corporation snapshots
- **Schedule**: Daily at 01:00 UTC (`0 1 * * *`)
- **Command**: `yarn snapshot:corporations`
- **Logs**: `/var/www/killreport/logs/snapshot-corporations-*.log`

#### 18. queue-prices

- **Description**: Adds prices to queue
- **Schedule**: Daily at 06:00 UTC / 09:00 Turkey Time (`0 6 * * *`)
- **Command**: `yarn queue:prices`
- **Logs**: `/var/www/killreport/logs/queue-prices-*.log`

## PM2 Commands

### Installation and Startup

```bash
# Install PM2 globally
npm install -g pm2

# Start all processes
pm2 start ecosystem.config.js

# Auto-start PM2 on system boot
pm2 startup
pm2 save
```

### Process Management

```bash
# Show all processes
pm2 list
pm2 status

# Manage a specific process
pm2 restart killreport-backend
pm2 stop worker-redisq
pm2 delete worker-alliances

# Manage all processes
pm2 restart all
pm2 stop all
pm2 delete all

# Reload a specific process (reload configuration)
pm2 reload killreport-backend

# Restart processes based on memory limit
pm2 reload all --max-memory-restart 500M
```

### Cron Job Management

```bash
# Trigger cron jobs immediately (for testing)
pm2 trigger queue-alliances

# Reschedule a specific cron job
pm2 restart queue-alliances
```

## Monitoring

### Real-time Monitoring

```bash
# Real-time dashboard
pm2 monit

# Process list and resource usage
pm2 list

# Detailed process information
pm2 describe killreport-backend

# Real-time CPU and memory usage
pm2 monit
```

### Memory and CPU Monitoring

```bash
# Show memory usage
pm2 list | grep -E 'name|memory'

# Show CPU usage
pm2 list | grep -E 'name|cpu'

# Detailed info for a specific process
pm2 describe worker-redisq
```

## Log Management

### Viewing Logs

```bash
# Watch all logs
pm2 logs

# Watch logs for a specific process
pm2 logs killreport-backend

# Show only error logs
pm2 logs --err

# Show last 100 lines
pm2 logs --lines 100

# Clear logs
pm2 flush
```

### Log Rotation (Recommended)

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Log rotation settings
pm2 set pm2-logrotate:max_size 100M      # Max 100MB per log
pm2 set pm2-logrotate:retain 7           # Keep 7 days
pm2 set pm2-logrotate:compress true      # Gzip old logs
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Rotate daily
```

### Manual Log Cleanup

```bash
# Delete all logs
pm2 flush

# Delete logs for a specific process
pm2 flush killreport-backend

# Manually delete old log files
rm -rf /var/www/killreport/logs/*.log
```

## Cron Jobs

### Cron Schedule Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of Week (0-6, Sunday = 0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of Month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Current Cron Schedules

| Process                     | Schedule     | UTC                      | Turkey Time              | Description              |
| --------------------------- | ------------ | ------------------------ | ------------------------ | ------------------------ |
| queue-characters            | `0 0 1 * *`  | 1st of each month, 00:00 | 1st of each month, 03:00 | Monthly character sync   |
| queue-alliances             | `0 22 * * *` | Daily at 22:00           | Daily at 01:00           | Daily alliance sync      |
| queue-alliance-corporations | `5 22 * * *` | Daily at 22:05           | Daily at 01:05           | Daily alliance corp sync |
| snapshot-alliances          | `0 1 * * *`  | Daily at 01:00           | Daily at 04:00           | Daily alliance snapshot  |
| update-alliance-counts      | `0 1 * * *`  | Daily at 01:00           | Daily at 04:00           | Daily alliance counts    |
| snapshot-corporations       | `0 1 * * *`  | Daily at 01:00           | Daily at 04:00           | Daily corp snapshot      |
| queue-prices                | `0 6 * * *`  | Daily at 06:00           | Daily at 09:00           | Daily price sync         |

### Testing Cron Jobs

```bash
# Run cron job manually (without waiting for schedule)
cd /var/www/killreport/backend
yarn queue:alliances

# Trigger cron job with PM2
pm2 trigger queue-alliances

# Watch cron job logs
pm2 logs queue-alliances --lines 50
```

## Troubleshooting

### Process Restart Issues

```bash
# Check process status
pm2 describe killreport-backend

# Completely remove and restart process
pm2 delete killreport-backend
pm2 start ecosystem.config.js --only killreport-backend

# Restart all processes
pm2 delete all
pm2 start ecosystem.config.js
```

### Memory Issues

```bash
# Check memory usage
pm2 list

# Restart processes exceeding memory limit
pm2 reload all --max-memory-restart 500M

# Set memory limit for a specific process
pm2 restart worker-redisq --max-memory-restart 512M
```

### Log Issues

```bash
# Check log file sizes
ls -lh /var/www/killreport/logs/

# Clean old logs
pm2 flush

# Check if log rotation is working
pm2 conf pm2-logrotate
```

## Best Practices

1. **Log Rotation**: Always install the PM2 log rotation module
2. **Memory Limits**: Set appropriate memory limits for each process
3. **Monitoring**: Set up monitoring with PM2 Plus or Keymetrics
4. **Auto Restart**: Auto restart should always be active in production
5. **Cron Jobs**: Be careful not to overlap cron jobs (leave 5 minutes between)
6. **Backup**: Save configuration regularly with `pm2 save`
7. **Updates**: Use `pm2 reload` when updating processes (zero-downtime)

## Environment Variables

All processes run with `NODE_ENV=production`. Additional environment variables:

- `PORT`: Backend (4000), Frontend (3000)
- `LOG_LEVEL`: `debug` (workers), `info` (cron jobs)
- `USE_REDIS_PUBSUB`: `true` (for backend Redis pub/sub)
- `REDIS_URL`: `redis://localhost:6379`

## Security

- Log files are stored under `/var/www/killreport/logs/`
- Prevent disk filling with log rotation
- Mask sensitive data in logs
- Start PM2 itself at system boot with `pm2 startup`

## Related Files

- [`ecosystem.config.js`](ecosystem.config.js): PM2 configuration
- [`backend/package.json`](backend/package.json): Backend script definitions
- [`frontend/package.json`](frontend/package.json): Frontend script definitions
- [`deployment/`](deployment/): Deployment documentation
