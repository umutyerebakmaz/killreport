# Query Optimization Deployment - Quick Checklist

## 📋 Pre-Deployment

- [ ] Kod değişiklikleri review edildi
- [ ] Database backup alındı
- [ ] Deployment zamanı belirlendi (sakin saatler tercih edilir)
- [ ] Rollback planı hazır

---

## 🚀 Deployment Steps

### 1. Kod Deploy

```bash
cd /root/killreport
git pull origin main
cd backend
npm install
npm run build
```

**Status:** [ ] Tamamlandı

---

### 2. Database Migration

```bash
cd /root/killreport/backend
npx prisma migrate deploy
```

**Beklenen süre:** 30-60 saniye
**Status:** [ ] Tamamlandı

---

### 3. Verify Materialized View

**Navicat SQL Console'da çalıştır:**

```sql
-- View var mı?
SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'killmail_filters_mv') as exists;

-- Kaç kayıt var?
SELECT COUNT(*) as records FROM killmail_filters_mv;
```

**Beklenen:** `exists = t` (true), `records > 0`
**Status:** [ ] Tamamlandı

---

### 4. Backend Restart

```bash
pm2 restart backend
pm2 logs backend --lines 50
```

**Check for:** Error yok, "🎯 Using Materialized View" log var
**Status:** [ ] Tamamlandı

---

### 5. Test Alliance Query

```bash
curl -X POST https://api.killreport.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query{killmails(filter:{allianceId:99000006,page:1,limit:25}){items{id}pageInfo{totalCount}}}"}'
```

**Beklenen:** 200 OK, data döndü, error yok
**Status:** [ ] Tamamlandı

---

## ✅ Post-Deployment Verification

### Immediate Checks (0-10 dakika sonra)

- [ ] Frontend killmail sayfası çalışıyor
- [ ] Alliance filtresi error vermiyor
- [ ] PM2 logs temiz (error yok)
- [ ] Response times < 2 saniye

### Short-term Checks (1-2 saat sonra)

- [ ] Kullanıcı şikayeti yok
- [ ] Error rate normal
- [ ] Materialized view refresh çalışıyor (log kontrol)
- [ ] Cache hit rate iyi

### Long-term Checks (24 saat sonra)

- [ ] Performance metrics stabile
- [ ] Database disk kullanımı normal
- [ ] Query patterns expected
- [ ] No memory leaks

---

## ⚠️ Rollback Triggers

Aşağıdaki durumlardan biri oluşursa ROLLBACK yap:

- [ ] Alliance queries hala error veriyor
- [ ] Response time > 5 saniye consistently
- [ ] Database CPU > 90% sürekli
- [ ] Backend crash ediyor

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
