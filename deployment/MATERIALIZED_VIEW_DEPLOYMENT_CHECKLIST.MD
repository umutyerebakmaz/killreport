# Materialized View Deployment - Quick Checklist

## 📋 Pre-Deployment

- [ ] Code changes reviewed
- [ ] Database backup completed
- [ ] Deployment time scheduled (prefer off-peak hours)
- [ ] Rollback plan ready

---

## 🚀 Deployment Steps

### 1. Deploy Code

```bash
cd /root/killreport
git pull origin main
cd backend
npm install
npm run build
```

**Status:** [ ] Completed

---

### 2. Database Migration

```bash
cd /root/killreport/backend
npx prisma migrate deploy
```

**Expected duration:** 30-60 seconds
**Status:** [ ] Completed

---

### 3. Verify Materialized View

**Run in Navicat SQL Console:**

```sql
-- Does view exist?
SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'killmail_filters_mv') as exists;

-- How many records?
SELECT COUNT(*) as records FROM killmail_filters_mv;
```

**Expected:** `exists = t` (true), `records > 0`
**Status:** [ ] Completed

---

### 4. Backend Restart

```bash
pm2 restart backend
pm2 logs backend --lines 50
```

**Check for:** No errors, "🎯 Using Materialized View" log present
**Status:** [ ] Completed

---

### 5. Test Alliance Query

```bash
curl -X POST https://api.killreport.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query{killmails(filter:{allianceId:99000006,page:1,limit:25}){items{id}pageInfo{totalCount}}}"}'
```

**Expected:** 200 OK, data returned, no errors
**Status:** [ ] Completed

---

## ✅ Post-Deployment Verification

### Immediate Checks (0-10 minutes after)

- [ ] Frontend killmail page working
- [ ] Alliance filter not throwing errors
- [ ] PM2 logs clean (no errors)
- [ ] Response times < 2 seconds

### Short-term Checks (1-2 hours after)

- [ ] No user complaints
- [ ] Error rate normal
- [ ] Materialized view refresh working (check logs)
- [ ] Cache hit rate good

### Long-term Checks (24 hours after)

- [ ] Performance metrics stable
- [ ] Database disk usage normal
- [ ] Query patterns as expected
- [ ] No memory leaks

---

## ⚠️ Rollback Triggers

If any of the following occur, perform ROLLBACK:

- [ ] Alliance queries still throwing errors
- [ ] Response time > 5 seconds consistently
- [ ] Database CPU > 90% continuously
- [ ] Backend crashing

**Rollback Command:**

```bash
cd /root/killreport
git checkout <previous-commit>
cd backend
npm run build
pm2 restart backend
```

---

## 📊 Success Metrics

| Metric                       | Before     | Target | Actual  |
| ---------------------------- | ---------- | ------ | ------- |
| Alliance Query Success Rate  | 0% (error) | 99%+   | \_\_\_% |
| Alliance Query Response Time | N/A        | <2s    | \_\_\_s |
| Parameter Limit Errors       | Many       | 0      | \_\_\_  |
| Overall Query Performance    | Slow       | Fast   | \_\_\_  |

---

## 📝 Notes

**Deployment Date:** **\*\***\_\_\_**\*\***
**Deployed By:** **\*\***\_\_\_**\*\***
**Start Time:** **\*\***\_\_\_**\*\***
**End Time:** **\*\***\_\_\_**\*\***
**Issues Encountered:** **\*\***\_\_\_**\*\***
**Resolution:** **\*\***\_\_\_**\*\***

---

**Deployment Status:** [ ] SUCCESS [ ] FAILED [ ] ROLLED BACK
