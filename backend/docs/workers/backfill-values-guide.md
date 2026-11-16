# Backfill Killmail Values - Queue & Worker System

## 📋 Overview

Retrospective calculation and update system for `total_value`, `destroyed_value`, and `droppedValue` of killmails.

**When to use:**

- To populate values for existing killmails after migration
- To recalculate values for old killmails
- For recalculation after market price updates

## 🚀 Quick Start

```bash
# 1. Records never calculated (NULL)
yarn queue:backfill-values --mode=null --limit=1000
yarn worker:backfill-values

# 2. Records calculated as zero (0)
yarn queue:backfill-values --mode=zero --limit=1000
yarn worker:backfill-values

# 3. Recalculate ALL records
yarn queue:backfill-values --mode=all --limit=1000
yarn worker:backfill-values
```

⚠️ **IMPORTANT:** Mode selection is critical! Records with 0 value added to queue with `--mode=null` will be **skipped** by the worker. To process zero values, **you must use `--mode=zero`**.

- **`null` mode**: Only processes `total_value IS NULL`, skips others
- **`zero` mode**: Only processes `total_value = 0`, skips others
- **`all` mode**: NO records are skipped, all are recalculated

This prevents processing the same killmail multiple times and ensures the correct records are processed according to mode.

## 🚀 Usage

### 1. Add Killmails to Queue

```bash
# Add all NULL value killmails to queue (default)
yarn queue:backfill-values
# or explicitly:
yarn queue:backfill-values --mode=null

# Recalculate only zero-value killmails
yarn queue:backfill-values --mode=zero

# Recalculate ALL killmails
yarn queue:backfill-values --mode=all

# With limit (example: first 10,000 killmails)
yarn queue:backfill-values --limit=10000

# Mode and limit together
yarn queue:backfill-values --mode=zero --limit=5000

# Small batch for testing
yarn queue:backfill-values --mode=null --limit=100
```

### Modes

- **`--mode=null`** (default): Only killmails with `total_value IS NULL` (never calculated)
- **`--mode=zero`**: Only killmails with `total_value = 0` (calculated as zero)
- **`--mode=all`**: ALL killmails (recalculate everything)

**Sample output:**

```
🔄 Backfill Killmail Values - Queue Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Mode: NULL values (not calculated yet)
📊 Found 125,432 killmails matching criteria
📦 Queue: backfill_killmail_values_queue
⚙️  Batch size: 500

⏳ Fetching killmail IDs...
  📤 Queued batch 1 (500/125,432 - 0.4%)
  📤 Queued batch 2 (1,000/125,432 - 0.8%)
  ...
  📤 Queued batch 251 (125,432/125,432 - 100.0%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully queued 125,432 killmails

🚀 Start the worker with:
   yarn worker:backfill-values

💡 Multiple workers can run in parallel for faster processing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Start Worker

**Single worker:**

```bash
yarn worker:backfill-values
```

**Parallel workers (recommended for fast processing):**

```bash
# Run 3 workers simultaneously
yarn worker:backfill-values &
yarn worker:backfill-values &
yarn worker:backfill-values &
```

**Production server with systemd:**

```bash
# Start the 3 worker instances
sudo systemctl start killreport-worker-backfill-values@1 killreport-worker-backfill-values@2 killreport-worker-backfill-values@3

# Monitor progress
journalctl -u killreport-worker-backfill-values@1 -n 50 -f

# Stop when complete
sudo systemctl stop killreport-worker-backfill-values@1 killreport-worker-backfill-values@2 killreport-worker-backfill-values@3
```

**Sample output:**

```
💰 Backfill Killmail Values Worker Started
📦 Queue: backfill_killmail_values_queue
⚡ Prefetch: 5 concurrent
📊 Stats interval: Every 10 killmails

✅ Connected to RabbitMQ
⏳ Waiting for killmails...

📊 [10] Rate: 12.34/sec | Updated: 10 | Skipped: 0 | Errors: 0
📊 [20] Rate: 15.67/sec | Updated: 20 | Skipped: 0 | Errors: 0
📊 [100] Rate: 18.92/sec | Updated: 98 | Skipped: 2 | Errors: 0
...
```

## ⚙️ Configuration

### Mode Behavior (IMPORTANT)

Worker decides based on the `mode` information in each message from the queue:

| Mode   | How It Behaves                                   | Example                           |
| ------ | ------------------------------------------------ | --------------------------------- |
| `null` | Only processes `total_value IS NULL`             | 0 values are **skipped**          |
| `zero` | Only processes `total_value = 0`                 | NULL and non-zero are **skipped** |
| `all`  | **No records are skipped**, all are recalculated | All records are processed         |

**Why is this important?**

- Records with 0 value added to queue with `--mode=null` are considered already calculated by the worker and skipped
- To recalculate zero values, **you must use `--mode=zero`**
- To recalculate all records, use `--mode=all`

### Worker Settings

**Inside `worker-backfill-values.ts`:**

```typescript
const PREFETCH_COUNT = 5; // Number of killmails to process simultaneously
const STATS_INTERVAL = 10; // Print stats every N killmails
```

**Setting Recommendations:**

| Scenario   | PREFETCH_COUNT | Worker Count | Total Throughput |
| ---------- | -------------- | ------------ | ---------------- |
| Test       | 1              | 1            | ~5-10/sec        |
| Normal     | 5              | 3            | ~50-80/sec       |
| Fast       | 10             | 5            | ~150-200/sec     |
| Aggressive | 20             | 10           | ~300-400/sec     |

### Queue Settings

**Inside `queue-backfill-values.ts`:**

```typescript
const BATCH_SIZE = 500; // How many killmails to fetch from DB
```

## 📊 Performance

### Calculation Time

Factors per killmail processing time:

- Database fetch: ~5-10ms
- Market price lookup: ~5-15ms (with batch)
- Value calculation: ~1-2ms
- Database update: ~5-10ms

**Average:** ~20-40ms/killmail

### Total Processing Time Estimate

| Killmail Count | 1 Worker  | 3 Workers | 5 Workers |
| -------------- | --------- | --------- | --------- |
| 10,000         | ~15 min   | ~5 min    | ~3 min    |
| 50,000         | ~1.5 hour | ~30 min   | ~18 min   |
| 100,000        | ~3 hours  | ~1 hour   | ~36 min   |
| 500,000        | ~15 hours | ~5 hours  | ~3 hours  |
| 1,000,000      | ~30 hours | ~10 hours | ~6 hours  |

## 🔍 Monitoring

### Check Queue Status

```bash
# GraphQL query in backend
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### Progress Tracking

```bash
# How many killmails remaining?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM killmails WHERE total_value IS NULL;"

# Total vs filled
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total,
    COUNT(total_value) as with_values,
    COUNT(*) - COUNT(total_value) as remaining
  FROM killmails;
"
```

### Worker Logs

```bash
# With systemd
journalctl -u killreport-worker-backfill-values@1 -n 100

# If running directly
# Visible in terminal
```

## ⚠️ Important Notes

### 1. Mode Selection Is Very Important!

**Wrong:**

```bash
# Adding 0 value records with null mode
yarn queue:backfill-values --mode=null
# Worker will skip them because 0 !== NULL
```

**Correct:**

```bash
# Adding 0 value records with zero mode
yarn queue:backfill-values --mode=zero
# Worker will process them because 0 === 0
```

### 2. Database Lock

- Workers update individual killmails with `UPDATE`
- Too many parallel workers can slow down database
- **Recommendation:** 3-5 workers is optimal

### 2. Market Price Dependency

- Market prices must exist in `market_prices` table
- Otherwise value = 0 is calculated
- **Prevention:** First run `yarn queue:prices` and `yarn worker:prices`

### 3. Memory Usage

- Each worker uses ~50-100MB RAM
- RAM usage increases if prefetch increases
- **Consider server resources**

### 4. Idempotency

- No problem even if the same killmail is processed by multiple workers
- Update operation is atomic
- Race condition protection exists

### 5. Graceful Shutdown

- Safe closing with CTRL+C
- Processed killmails are committed
- Remaining tasks stay in queue

## 🐛 Troubleshooting

### "Queue is empty" but killmails exist

```bash
# Check queue
rabbitmqctl list_queues name messages consumers

# Create queue if doesn't exist
yarn queue:backfill-values --limit=10
```

### Worker not running

```bash
# Check RabbitMQ connection
echo $RABBITMQ_URL

# Increase log level
# logger.level = 'debug' in worker-backfill-values.ts
```

### Processing too slowly

```bash
# Are market prices loaded?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM market_prices;"

# Increase parallel worker count
# systemd runs instances @1, @2 and @3; start more by hand with
# `yarn worker:backfill-values` in extra shells

# Check database connection pool
# Connection limit can be increased in prisma-worker.ts
```

### Memory leak

```bash
# Restart workers
sudo systemctl restart killreport-worker-backfill-values@1 killreport-worker-backfill-values@2 killreport-worker-backfill-values@3

# Reduce prefetch (worker-backfill-values.ts)
const PREFETCH_COUNT = 2;
```

## 📝 Example Workflow

### Production Backfill Scenario

```bash
# 1. Ensure market prices are current
yarn queue:prices
yarn worker:prices &

# Wait for market prices to load (15-30min)

# 2. How many killmails need backfill?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM killmails WHERE total_value IS NULL;"
# Sample output: 250,000

# 3. Test with first 1000
yarn queue:backfill-values --limit=1000
yarn worker:backfill-values

# Stop with CTRL+C if test is successful

# 4. Add all killmails to queue
yarn queue:backfill-values
# 250,000 killmails queued

# 5. Start the 3 worker instances (estimated ~5 hours)
sudo systemctl start killreport-worker-backfill-values@1 killreport-worker-backfill-values@2 killreport-worker-backfill-values@3

# 6. Monitor progress
watch -n 30 'psql $DATABASE_URL -c "SELECT COUNT(*) FROM killmails WHERE total_value IS NULL;"'

# 7. Stop workers when complete
sudo systemctl stop killreport-worker-backfill-values@1 killreport-worker-backfill-values@2 killreport-worker-backfill-values@3
```

## ✅ Verification

### Success Check

```bash
# Do all killmails have values?
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total_killmails,
    COUNT(total_value) as with_values,
    COUNT(*) - COUNT(total_value) as missing_values
  FROM killmails;
"
```

Expected:

```
 total_killmails | with_values | missing_values
-----------------+-------------+----------------
          250000 |      250000 |              0
```

### Value Distribution

```bash
# Check value distribution
psql $DATABASE_URL -c "
  SELECT
    CASE
      WHEN total_value < 1000000 THEN '< 1M ISK'
      WHEN total_value < 10000000 THEN '1-10M ISK'
      WHEN total_value < 100000000 THEN '10-100M ISK'
      WHEN total_value < 1000000000 THEN '100M-1B ISK'
      ELSE '> 1B ISK'
    END as value_range,
    COUNT(*) as count
  FROM killmails
  WHERE total_value IS NOT NULL
  GROUP BY value_range
  ORDER BY MIN(total_value);
"
```

## 🎯 Conclusion

✅ Value backfill system for retrospective killmails is ready
✅ Fast processing with parallel worker support
✅ Progress tracking and error handling
✅ Production-ready and tested

**Estimated speedup:** 5-10x faster list queries!
