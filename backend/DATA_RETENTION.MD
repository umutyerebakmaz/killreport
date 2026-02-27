# Data Retention System

Automatic data cleanup mechanism to optimize database size and performance.

## 📋 Overview

The retention system automatically removes data older than your configured period. Benefits include:

- 💾 Database size remains manageable
- ⚡ Query performance stays optimized
- 📊 Backup times are reduced
- 💰 Storage costs decrease

## 🎯 What Gets Cleaned Up?

The retention mechanism **only cleans daily aggregation tables** - your base data and critical caches are preserved:

### Cleaned Tables

- ✅ `daily_pilot_kills` - Daily pilot kill statistics
- ✅ `daily_corporation_kills` - Daily corporation kill statistics
- ✅ `daily_alliance_kills` - Daily alliance kill statistics

### Protected Tables (Never Deleted)

- 🔒 `killmails` - Base killmail data is **never deleted**
- 🔒 `killmail_filters` - **Critical cache table** for query performance (never deleted)
- 🔒 `characters` - Character information is **preserved**
- 🔒 `corporations` - Corporation information is **preserved**
- 🔒 `alliances` - Alliance information is **preserved**
- 🔒 All static game data (ships, items, systems, etc.) is **preserved**

## ⚙️ Configuration

### Setting in .env File

```bash
# How many days of data to keep? (default: 1825 days = 5 years)
RETENTION_DAYS=1825
```

### Recommended Values

| Retention Period | Days | Use Case                      |
| ---------------- | ---- | ----------------------------- |
| 6 Months         | 180  | Minimum recommended           |
| 1 Year (Default) | 365  | Balanced choice (most common) |
| 2 Years          | 730  | Long-term analysis            |
| 3 Years          | 1095 | Maximum historical data       |

> ⚠️ **Important:** Minimum 180 days is recommended. Shorter periods may affect data integrity.

## 🚀 Usage

### 1. Automatic Execution (PM2)

Runs automatically every Sunday at 2:00 AM UTC via PM2:

```bash
# Start the worker
pm2 start ecosystem.config.js --only worker-retention-cleanup

# Check status
pm2 info worker-retention-cleanup

# View logs
pm2 logs worker-retention-cleanup
```

### 2. Manual Execution

To perform immediate cleanup:

```bash
# From backend directory
cd backend
yarn cleanup:retention
```

or

```bash
# One-time execution via PM2
pm2 start ecosystem.config.js --only worker-retention-cleanup
```

### 3. Dry Run (Test Mode)

To preview what will be deleted:

```bash
cd backend

# Status check (doesn't delete anything, only reports)
yarn cleanup:retention
# Check the "Will Delete" lines in the output, then press Ctrl+C to cancel
```

## 📊 Monitoring and Reporting

### Logs During Cleanup

```bash
🚀 Starting Data Retention Cleanup Process...
📅 Retention Period: 5 years (1825 days)
🗓️  Cutoff Date: 2021-02-27
ℹ️  Data older than this date will be deleted from aggregated tables

🧹 Cleaning daily_pilot_kills...
📊 daily_pilot_kills: Found 1,234,567 rows to delete
✅ daily_pilot_kills: Deleted 1,234,567 rows in 2500ms

═══════════════════════════════════════════════════
📊 Retention Cleanup Summary
═══════════════════════════════════════════════════
✅ daily_pilot_kills: 1,234,567 rows deleted (2500ms)
✅ daily_corporation_kills: 456,789 rows deleted (1800ms)
✅ daily_alliance_kills: 123,456 rows deleted (1200ms)

🎯 Total Rows Deleted: 2,114,856
⏱️  Total Duration: 5500ms (5s)
✅ Retention cleanup completed successfully
═══════════════════════════════════════════════════
```

## 🔧 Advanced Usage

### Changing PM2 Cron Schedule

In `ecosystem.config.js`:

```javascript
{
    name: 'worker-retention-cleanup',
    cron_restart: '0 2 * * 0',  // Every Sunday at 2 AM UTC
    env: {
        RETENTION_DAYS: '1825',  // Default: 5 years
    },
}
```

#### Popular Cron Examples

| Schedule               | Cron Expression | Description     |
| ---------------------- | --------------- | --------------- |
| Every Sunday 2 AM UTC  | `0 2 * * 0`     | Default         |
| Daily at 3 AM UTC      | `0 3 * * *`     | Daily cleanup   |
| 1st of month 2 AM UTC  | `0 2 1 * *`     | Monthly cleanup |
| Every Friday 11 PM UTC | `0 23 * * 5`    | Before weekend  |

### Different Retention for Different Environments

Longer for production, shorter for development:

```javascript
// ecosystem.config.js
env: {
    NODE_ENV: 'production',
    RETENTION_DAYS: '730',  // Production: 2 years
}

// development.config.js
env: {
    NODE_ENV: 'development',
    RETENTION_DAYS: '180',   // Dev: 6 months
}
```

## 🛡️ Safety and Rollback

### Backup Before First Run

**Always take a backup before running cleanup for the first time:**

```bash
# Database backup
yarn db:backup

# or
pg_dump -h localhost -U username killreport > backup_before_retention.sql
```

### Recovering Deleted Data

Retention only cleans aggregated tables; base data is preserved. You can rebuild aggregated data:

```bash
# Full refresh materialized views
cd backend
yarn worker:materialized-views

# or rebuild a specific table
psql -h localhost -U username -d killreport -c "
  -- Rebuild entire history for daily_pilot_kills
  TRUNCATE TABLE daily_pilot_kills;
  INSERT INTO daily_pilot_kills (kill_date, character_id, kill_count)
  SELECT DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
         a.character_id,
         COUNT(*)::int AS kill_count
  FROM attackers a
  INNER JOIN killmails k ON a.killmail_id = k.killmail_id
  WHERE a.character_id IS NOT NULL
  GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.character_id;
"
```

## 📈 Performance Tips

### For Large Databases

1. **Run cleanup during off-peak hours**
   - Ideal: 2-4 AM for production
   - When user traffic is low

2. **First run may take longer**
   - First cleanup: 15-30 minutes (if millions of rows)
   - Subsequent cleanups: 1-5 minutes (only last week's data)

3. **Database maintenance after cleanup**

   ```bash
   # Optimize indexes after cleanup
   psql -d killreport -c "VACUUM ANALYZE daily_pilot_kills;"
   psql -d killreport -c "VACUUM ANALYZE daily_corporation_kills;"
   psql -d killreport -c "VACUUM ANALYZE daily_alliance_kills;"
   ```

## ❓ Frequently Asked Questions

### Q: Are killmails deleted?

**A:** No! Only daily aggregation tables are cleaned. Base killmail data and the critical `killmail_filters` cache are preserved.

### Q: Why isn't killmail_filters cleaned?

**A:** The `killmail_filters` table is a critical denormalized cache that powers all killmail queries. Rebuilding it would take hours and cause severe performance degradation. It's designed to hold all killmail data indefinitely.

### Q: How can I recover old data?

**A:** Aggregated data can be rebuilt from base killmails (see Rollback section above).

### Q: What happens if I change RETENTION_DAYS?

**A:** The new value will be used in the next cleanup run. It doesn't take effect immediately.

### Q: Can I disable retention completely?

**A:** Yes, you can stop the worker in PM2:

```bash
pm2 stop worker-retention-cleanup
pm2 delete worker-retention-cleanup
```

### Q: How much disk space will I save?

**A:** Depends on your database size. Since we only clean daily aggregation tables (not killmail_filters), savings are modest:

- 1 year retention (default): 5-10% disk savings on aggregation tables
- 6 month retention: 10-20% disk savings on aggregation tables
- 3 month retention: 20-30% disk savings on aggregation tables
- Gradual decrease as old daily stats are removed weekly
- Noticeable decrease in database size after first cleanup

## 🔍 Troubleshooting

### Worker not running

```bash
# Check PM2 status
pm2 list

# Check logs
pm2 logs worker-retention-cleanup --lines 100

# Restart worker
pm2 restart worker-retention-cleanup
```

### "Permission denied" error

Database user must have DELETE permissions:

```sql
GRANT DELETE ON daily_pilot_kills TO your_user;
GRANT DELETE ON daily_corporation_kills TO your_user;
GRANT DELETE ON daily_alliance_kills TO your_user;
```

### Cleanup taking too long

Check if indexes exist on date columns:

```sql
-- Date columns should have indexes
\d daily_pilot_kills
\d daily_corporation_kills
\d daily_alliance_kills
```

## 📞 Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs worker-retention-cleanup`
2. Verify database connection
3. Ensure RETENTION_DAYS value is valid (minimum 90)

---

**Last Updated:** 2026-02-27
**Version:** 1.0.0
