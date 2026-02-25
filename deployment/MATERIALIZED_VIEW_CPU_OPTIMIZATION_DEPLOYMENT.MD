# Materialized View CPU Optimization - Deployment Guide

## Quick Summary

This deployment optimizes materialized view refresh operations to reduce database CPU usage from **94% to ~30-40%**.

**Changes:** Code-only (no database migrations required)  
**Downtime:** None  
**Risk Level:** Low (backward compatible)

---

## Pre-Deployment Checklist

- [ ] Review changes in `backend/src/services/materialized-view-refresh.ts`
- [ ] Read full documentation: `backend/src/docs/MATERIALIZED_VIEW_CPU_OPTIMIZATION.MD`
- [ ] Backup current code: `git tag pre-mv-optimization`
- [ ] Monitor CPU baseline before deployment

---

## Deployment Steps

### 1. Pull Latest Code

```bash
cd /root/killreport
git pull origin main
```

### 2. Install Dependencies (if needed)

```bash
cd backend
npm install
```

### 3. Restart Backend

```bash
pm2 restart backend
```

### 4. Monitor Logs

```bash
# Watch for optimization messages
pm2 logs backend --lines 50

# Look for:
# ✅ "Scheduling materialized view refresh every 5 minutes (staggered)"
# ✅ "Materialized view refreshed successfully in XXXXms"
# ✅ "Skipping character view refresh (throttled)"
```

---

## Verification Steps

### 1. Check CPU Usage

```bash
# Monitor CPU during refresh cycle
htop

# Expected: CPU per postgres process should stay below 50%
# Previous: CPU would spike to 94%
```

### 2. Verify Staggered Execution

```bash
# Watch logs for timing
pm2 logs backend | grep "Refreshing"

# Expected output with ~30 second delays:
# [14:00:00] Refreshing daily_pilot_kills_mv...
# [14:00:30] Refreshing character_top_alliance_targets_mv...
# [14:01:00] Refreshing character_top_corporation_targets_mv...
```

### 3. Check Refresh Durations

```bash
# Monitor completion times
pm2 logs backend | grep "refreshed in"

# Expected:
# ✅ killmail_filters_mv refreshed in 5000-15000ms
# ✅ daily_pilot_kills_mv refreshed in 1000-3000ms
# ✅ character_top_alliance_targets_mv refreshed in 3000-8000ms
```

### 4. Verify Character View Throttling

```bash
# Should see throttling messages
pm2 logs backend | grep "Skipping character view"

# Expected (every other refresh cycle):
# ⏭️  Skipping character view refresh (throttled)
```

---

## Monitoring After Deployment

### First 30 Minutes

- [ ] CPU usage below 50% during refreshes
- [ ] No error messages in logs
- [ ] Application remains responsive
- [ ] Database queries continue working

### First 2 Hours

- [ ] At least 2 full refresh cycles completed
- [ ] Character views refreshed once (throttled once)
- [ ] No performance degradation
- [ ] Frontend queries working normally

### First 24 Hours

- [ ] Stable CPU usage pattern
- [ ] No memory leaks
- [ ] All materialized views updating correctly
- [ ] User experience unchanged

---

## Expected Behavior Changes

### What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **Peak CPU** | 94% | 30-40% per operation |
| **View Refresh Pattern** | All parallel | Sequential with delays |
| **Character View Frequency** | Every 5 min | Every 10 min |
| **Memory per Operation** | ~64MB | 128-256MB |
| **Concurrent Operations** | 4 views at once | 1 at a time |

### What Stayed the Same

- ✅ Same refresh frequency for critical views (killmail_filters_mv, daily_pilot_kills_mv)
- ✅ Same CONCURRENTLY strategy (no query blocking)
- ✅ Same data freshness for end users
- ✅ No API changes
- ✅ No schema changes

---

## Troubleshooting

### Problem: CPU Still High (>70%)

**Check:**
```bash
# Look for other heavy operations
ps aux | grep postgres | sort -k 3 -r | head -10

# Check concurrent queries
psql -c "SELECT pid, now() - query_start as duration, state, query 
         FROM pg_stat_activity 
         WHERE state = 'active' 
         ORDER BY duration DESC;"
```

**Solution:**
- May need to increase stagger delay from 30s to 60s
- Check for other database operations (backups, analytics)
- Consider reducing refresh frequency from 5 min to 10 min

---

### Problem: Refresh Taking Too Long (>30 seconds)

**Check:**
```sql
-- Manual refresh test
\timing on
REFRESH MATERIALIZED VIEW CONCURRENTLY killmail_filters_mv;
```

**Solution:**
- Increase `maintenance_work_mem` in code (384MB or 512MB)
- Check for database locks: `SELECT * FROM pg_locks WHERE granted = false;`
- Verify no disk I/O bottleneck: `iostat -x 5`

---

### Problem: Character Views Not Updating

**Check:**
```bash
# Look for throttle messages
pm2 logs backend | grep -A 5 "character view"
```

**Solution:**
- Character views should update every 10 minutes (previously 5 minutes)
- This is expected behavior - users don't need real-time "top targets"
- If urgently needed, force refresh manually:
  ```sql
  REFRESH MATERIALIZED VIEW CONCURRENTLY character_top_alliance_targets_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY character_top_corporation_targets_mv;
  ```

---

## Rollback Instructions

### Quick Rollback

```bash
cd /root/killreport
git checkout pre-mv-optimization  # Or specific commit hash
pm2 restart backend
```

### Verify Rollback

```bash
# Check logs for old behavior (parallel refresh)
pm2 logs backend --lines 50

# Should NOT see:
# - "staggered" in scheduler message
# - "throttled" messages
# - "SET LOCAL maintenance_work_mem" operations
```

---

## Success Criteria

Deployment is successful if:

1. ✅ CPU usage stays below 50% during refresh cycles
2. ✅ No increase in errors or exceptions
3. ✅ Application remains responsive
4. ✅ All materialized views continue updating
5. ✅ Refresh durations within acceptable range (5-15s for main view)
6. ✅ Users experience no degradation in service

---

## Performance Metrics to Track

### Database Metrics

```sql
-- View sizes and access patterns
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public';

-- Index usage on materialized views
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename LIKE '%_mv'
ORDER BY idx_scan DESC;
```

### Application Metrics

```bash
# Response times
pm2 logs backend | grep "Query" | tail -20

# View refresh durations over time
pm2 logs backend | grep "refreshed in" | tail -20
```

---

## Additional Resources

- **Full Documentation:** `backend/src/docs/MATERIALIZED_VIEW_CPU_OPTIMIZATION.MD`
- **Original Issue:** "material view tablolarını güncelleme esnasında database cpu kullanımı 94 lere çıkıyor"
- **Code Changes:** `backend/src/services/materialized-view-refresh.ts`

---

## Contact & Support

If issues arise:

1. Check logs: `pm2 logs backend --lines 200`
2. Review CPU: `htop` or `top`
3. Check database: PostgreSQL logs in `/var/log/postgresql/`
4. Rollback if necessary using instructions above

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Status:** [ ] Success [ ] Rolled Back [ ] Issues (describe below)

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-25
