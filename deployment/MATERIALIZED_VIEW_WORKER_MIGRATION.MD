# Materialized View Worker Migration Guide

## 🎯 Migration Summary

**Before:** Materialized view refresh runs in the API server process
**After:** Materialized view refresh runs as a separate worker process

## ✅ Benefits

### 1. **Isolation & Stability**

- API server is NOT affected by CPU spikes during MV refresh
- Worker crash → API stays running
- API crash → MV refresh continues

### 2. **Resource Management**

- CPU spikes (30-40%) isolated to worker process
- API remains responsive during refresh cycles
- Better monitoring: Separate PM2 process, logs, metrics

### 3. **Deployment Flexibility**

- Update worker without restarting API
- Scale worker independently
- Can run worker on different server

### 4. **Pattern Consistency**

- Same architecture as other 20+ workers
- Easier to understand and maintain

## 📦 What Changed

### Files Modified

1. **NEW: `backend/src/workers/worker-materialized-views.ts`**
   - Standalone worker for MV refresh
   - Same logic as before, just isolated

2. **MODIFIED: `backend/src/server.ts`**
   - Removed `scheduleMaterializedViewRefresh()` call
   - Added comment explaining worker approach

3. **MODIFIED: `backend/package.json`**
   - Added `worker:materialized-views` script

4. **MODIFIED: `ecosystem.config.js`**
   - Added PM2 config for new worker

### Files Unchanged

- `backend/src/services/materialized-view-refresh.ts` (still used by worker)
- All materialized view queries
- Frontend
- Database

## 🚀 Deployment Steps

### Option A: PM2 (Production - Recommended)

```bash
# 1. Pull latest code
cd /root/killreport
git pull origin main

# 2. Restart backend (will no longer run MV refresh)
pm2 restart killreport-backend

# 3. Start new worker
pm2 start ecosystem.config.js --only worker-materialized-views

# 4. Save PM2 configuration
pm2 save

# 5. Verify worker is running
pm2 list
pm2 logs worker-materialized-views --lines 50
```

### Option B: Manual (Development/Testing)

```bash
# Terminal 1: API server
cd /root/killreport/backend
yarn start

# Terminal 2: MV worker (separate process)
cd /root/killreport/backend
yarn worker:materialized-views
```

## 🔍 Verification

### 1. Check Worker Status

```bash
pm2 list | grep worker-materialized-views
# Should show: online, 0 restarts
```

### 2. Check Worker Logs

```bash
pm2 logs worker-materialized-views --lines 50

# Expected logs:
# ✅ "Materialized View Refresh Worker Starting..."
# ✅ "Refresh interval: 5 minutes (staggered execution)"
# ✅ "Starting initial refresh cycle..."
# ✅ "killmail_filters_mv refreshed in XXXXms"
```

### 3. Verify API Server (No MV Refresh)

```bash
pm2 logs killreport-backend --lines 50 | grep -i "material"

# Should NOT see:
# ❌ "Scheduling materialized view refresh"
# ❌ "Refreshing killmail_filters_mv"

# Should see:
# ✅ "Materialized view refresh is now handled by a separate worker"
```

### 4. Monitor CPU Usage

```bash
htop

# You should see:
# - API server (killreport-backend): Stable CPU ~5-15%
# - Worker (worker-materialized-views): CPU spikes to 30-40% every 5 min
```

### 5. Check Refresh Timing

```bash
# Watch for staggered execution
pm2 logs worker-materialized-views | grep "Refreshing"

# Should see ~30 second delays:
# [14:00:00] Refreshing daily_pilot_kills_mv...
# [14:00:30] Refreshing character_top_alliance_targets_mv...
# [14:01:00] Refreshing character_top_corporation_targets_mv...
```

## 🎯 Success Criteria

- [ ] Worker appears in `pm2 list` with status "online"
- [ ] Worker logs show refresh cycles every 5 minutes
- [ ] API server logs do NOT mention materialized view refresh
- [ ] CPU spikes isolated to worker process (not API)
- [ ] Application remains responsive during refresh
- [ ] No errors in worker or API logs

## 🔧 Troubleshooting

### Problem: Worker Not Starting

```bash
# Check logs for errors
pm2 logs worker-materialized-views --err --lines 50

# Common issues:
# - Database connection: Check POSTGRES_URL env var
# - Permissions: Check log file write permissions
# - Dependencies: Run `yarn install` in backend/
```

**Solution:**

```bash
cd /root/killreport/backend
yarn install
pm2 restart worker-materialized-views
```

---

### Problem: Worker Keeps Restarting

```bash
# Check restart count
pm2 list | grep worker-materialized-views

# If restarts > 5, check logs
pm2 logs worker-materialized-views --err --lines 100
```

**Common causes:**

- Database connection timeout
- View doesn't exist (run migrations)
- Out of memory (increase `max_memory_restart`)

---

### Problem: Views Not Refreshing

```bash
# Check if worker is actually running
pm2 logs worker-materialized-views --lines 50

# Should see refresh cycles every 5 minutes
# If not, check for errors
```

**Solution:**

```bash
# Restart worker
pm2 restart worker-materialized-views

# Check database connectivity
pm2 logs worker-materialized-views --lines 50 | grep -i "error\|fail"
```

---

### Problem: API Still Running MV Refresh

This means code wasn't updated properly.

```bash
# Check server.ts
cat /root/killreport/backend/src/server.ts | grep -i "scheduleMaterializedViewRefresh"

# Should NOT find the function call
# If it exists, you need to:
git pull origin main
pm2 restart killreport-backend
```

## ↩️ Rollback Plan

If worker causes issues, revert to old approach:

### 1. Stop Worker

```bash
pm2 stop worker-materialized-views
pm2 delete worker-materialized-views
pm2 save
```

### 2. Revert Code Changes

```bash
cd /root/killreport
git revert HEAD  # or specific commit
```

### 3. Restart API (Will Resume MV Refresh)

```bash
pm2 restart killreport-backend
```

### 4. Verify

```bash
pm2 logs killreport-backend | grep "Scheduling materialized view refresh"
# Should see the scheduler message
```

## 📊 Performance Comparison

### Before (Server-Based)

```
API Server Process:
├── GraphQL API (65% CPU)
├── MV Refresh (30-40% CPU spike every 5 min)
└── Total: 95-105% CPU (overloaded)

Issues:
- API slows down during refresh
- Single point of failure
- Hard to monitor
```

### After (Worker-Based)

```
API Server Process:
└── GraphQL API (5-15% CPU)
    ✅ Consistent, responsive

MV Worker Process:
└── MV Refresh (30-40% CPU spike every 5 min)
    ✅ Isolated, doesn't affect API

Benefits:
- API always responsive
- Better fault isolation
- Clear monitoring
```

## 💡 Operational Tips

### Monitor Worker Health

```bash
# Add to cron (check every hour)
0 * * * * pm2 list | grep "worker-materialized-views" | grep -q "online" || pm2 restart worker-materialized-views
```

### View Refresh Stats

```bash
# Get timing statistics
pm2 logs worker-materialized-views --lines 1000 | grep "refreshed in" | awk '{print $NF}' | sort -n | tail
```

### Stop Worker Temporarily

```bash
# During maintenance or high-load periods
pm2 stop worker-materialized-views

# Resume when ready
pm2 start worker-materialized-views
```

### Scale to Multiple Workers

Not recommended! Only run ONE instance of this worker. Multiple instances would cause conflicts and duplicate refresh operations.

## 📚 Related Documentation

- Worker implementation: `backend/src/workers/worker-materialized-views.ts`
- MV service: `backend/src/services/materialized-view-refresh.ts`
- PM2 config: `ecosystem.config.js`
- CPU optimization: `backend/src/docs/MATERIALIZED_VIEW_CPU_OPTIMIZATION.MD`

---

**Migration Date:** ********\_********
**Deployed By:** ********\_********
**Status:** [ ] Success [ ] Rolled Back [ ] Issues

**Notes:**

```
_________________________________________________________________
_________________________________________________________________
```
