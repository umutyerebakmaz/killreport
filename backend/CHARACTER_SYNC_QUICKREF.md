# Character Killmail Sync - Quick Reference

## One-Line Commands

```bash
# Sync specific character (default 50 pages = 10k killmails)
yarn sync:character <characterId>

# Custom page count
yarn sync:character <characterId> <pages>

# Queue multiple characters
yarn queue:character <id1> <id2> <id3>
yarn worker:killmails
```

## Common Use Cases

### 1. Sync a Single Character (Fastest)

```bash
cd /root/killreport/backend
yarn sync:character 95465499
```

### 2. Recent Activity Only (5 pages = 1k killmails)

```bash
yarn sync:character 95465499 5
```

### 3. Complete History (999 pages = all)

```bash
yarn sync:character 95465499 999
```

### 4. Multiple Characters

```bash
yarn queue:character 123 456 789
yarn worker:killmails
```

## Page Guide

| Pages | Killmails | Time (Est.) | Use For          |
| ----- | --------- | ----------- | ---------------- |
| 1     | 200       | 2-3 min     | Testing          |
| 5     | 1,000     | 15-20 min   | Recent           |
| 10    | 2,000     | 30-40 min   | Last months      |
| 50    | 10,000    | 2-3 hours   | Default          |
| 100   | 20,000    | 4-6 hours   | Heavy PvP        |
| 999   | All       | Variable    | Complete history |

## Output Example

```
🚀 Character Killmail Sync Started
==================================
📝 Character ID: 95465499
📄 Max Pages: 10 (2000 killmails max)

📡 Fetching from zKillboard...
     📄 Page 1: 200 killmails
     📄 Page 2: 200 killmails
     ...
     ✅ Total: 1843 killmails

💾 Processing 1843 killmails...
  ✅ [1/1843] Saved killmail 123456
  ✅ [10/1843] Saved killmail 123457
  ⏭️  [100/1843] Already exists...

============================================================
🎉 SYNC COMPLETED!
============================================================
✅ Processed: 1234
⏭️  Skipped: 609
❌ Errors: 0
📊 Total: 1843
⏱️  Duration: 234.56s
============================================================
```

## Troubleshooting

| Problem               | Solution                                     |
| --------------------- | -------------------------------------------- |
| No killmails found    | Verify character ID at zkillboard.com        |
| 420 Error Limited     | Worker auto-waits 60s                        |
| Worker not processing | Check RabbitMQ: `docker ps \| grep rabbitmq` |
| Duplicate errors      | Normal, worker skips them                    |

## Famous Pilots

```bash
# CCP Falcon
yarn sync:character 95465499

# The Mittani
yarn sync:character 443630591

# Chribba
yarn sync:character 196379789
```

## Full Documentation

See [CHARACTER_KILLMAIL_WORKER.md](./CHARACTER_KILLMAIL_WORKER.md) for complete documentation.
