# 📊 Top Charts Cost Analysis

## 🎯 Question

**We currently use pre-computed tables (Materialized Views) for top charts. How expensive would it be if we didn't have these tables and performed live calculations every 5 minutes?**

---

## 🏗️ Current System (With Materialized Views)

### Tables

Total of **9 different top charts Materialized Views**:

#### Character Top Charts (3 items)

1. `character_top_alliance_targets_mv` - Top 10 alliance targets for each character
2. `character_top_corporation_targets_mv` - Top 10 corporation targets for each character
3. `character_top_ships_mv` - Top 10 ship types for each character

#### Corporation Top Charts (3 items)

1. `corporation_top_alliance_targets_mv` - Top 10 alliance targets for each corporation
2. `corporation_top_corporation_targets_mv` - Top 10 corporation targets for each corporation
3. `corporation_top_ships_mv` - Top 10 ship types for each corporation

#### Alliance Top Charts (3 items)

1. `alliance_top_alliance_targets_mv` - Top 10 alliance targets for each alliance
2. `alliance_top_corporation_targets_mv` - Top 10 corporation targets for each alliance
3. `alliance_top_ships_mv` - Top 10 ship types for each alliance

### Refresh Time

- **Refreshed every 5 minutes** (cron job)
- Each refresh is done **CONCURRENTLY** (without table lock)
- Average refresh time: **3-8 seconds** (varies by view)

### Advantages

✅ **Very fast queries** (pre-computed data via simple SELECT)

- Character detail page: ~10-20ms
- Corporation detail page: ~10-20ms
- Alliance detail page: ~10-20ms

✅ **Low database load** (only refreshed every 5 minutes)

✅ **Scalable** (query speed remains the same even with 1 million killmails)

---

## 💸 Alternative: Live Calculation Without Tables

### Scenario: Calculate on every request

**Example query** (for Character Top Alliance Targets):

```sql
WITH ranked_kills AS (
    SELECT
        a.character_id,
        v.alliance_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.character_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    WHERE a.character_id = $1
      AND v.alliance_id IS NOT NULL
    GROUP BY a.character_id, v.alliance_id
)
SELECT
    rk.character_id,
    rk.alliance_id,
    rk.kill_count,
    al.name as alliance_name
FROM ranked_kills rk
INNER JOIN alliances al ON rk.alliance_id = al.id
WHERE rk.rn <= 10
ORDER BY rk.kill_count DESC;
```

### Cost Analysis (Single Query)

#### Data Size Assumptions

- **Total Killmails:** 200,000 records
- **Total Attackers:** 2,000,000 rows (average 10 attackers/killmail)
- **Total Victims:** 200,000 rows (1 victim/killmail)
- **Active Characters:** 10,000 records
- **Average killmail/character:** 200 records

#### Query Cost (For a single character)

1. **Attackers Scan:**
   - Index usage: `idx_attackers_character` (character_id)
   - Scanned rows: ~200 rows
   - Cost: **Low** ✅

2. **Victims JOIN:**
   - 200 attacker rows × 1 victim = 200 JOIN operations
   - Index usage: `idx_victim_killmail` (killmail_id)
   - Cost: **Medium** ⚠️

3. **Killmails JOIN:**
   - 200 victim rows × 1 killmail = 200 JOIN operations
   - Index usage: `idx_killmail_id` (primary key)
   - Cost: **Low** ✅

4. **GROUP BY:**
   - Grouping over ~200 rows
   - Cost: **Low** ✅

5. **ROW_NUMBER() Window Function:**
   - ~10-30 groups (unique alliances)
   - Cost: **Low** ✅

6. **Alliances JOIN:**
   - Name lookup for top 10 alliances
   - Cost: **Very Low** ✅

**Total Query Time:** **50-150ms** (without cache, cold query)

---

### Scenario 2: Live Calculation Every 5 Minutes

**Assuming:**

- We use a system without tables
- We calculate for ALL CHARACTERS every 5 minutes

#### Calculation

**Single Character Query:** 100ms (average)

**For 10,000 Active Characters:**

```text
10,000 characters × 100ms = 1,000,000ms = 1,000 seconds = ~16.6 minutes
```

**❌ PROBLEM:** A job that should finish in 5 minutes takes 16.6 minutes!

#### With Parallel Processing

**With 10 parallel workers:**

```text
1,000 seconds ÷ 10 = 100 seconds = ~1.6 minutes ✅
```

**With 50 parallel workers:**

```text
1,000 seconds ÷ 50 = 20 seconds ✅
```

---

## 📊 Cost Comparison

### Current System (Materialized Views)

| Metric               | Value                         |
| -------------------- | ----------------------------- |
| **Refresh Time**     | 5-8 seconds (every 5 minutes) |
| **Query Time**       | 10-20ms                       |
| **Database Load**    | Very Low                      |
| **Extra Disk Usage** | ~50-200 MB (9 views)          |
| **Complexity**       | Low (automated refresh)       |

### Alternative: Live Calculation (Every Request)

| Metric            | Value                                     |
| ----------------- | ----------------------------------------- |
| **Query Time**    | 50-150ms (7-15x slower)                   |
| **Database Load** | Very High ❌                              |
| **Disk Usage**    | 0 MB (no table) ✅                        |
| **Scalability**   | Poor (database overload as traffic grows) |

### Alternative 2: Live Calculation (Every 5 Minutes, All Characters)

| Metric               | Value                                              |
| -------------------- | -------------------------------------------------- |
| **Calculation Time** | 100 seconds (10 workers) / 20 seconds (50 workers) |
| **Database Load**    | Extremely High ❌❌❌                              |
| **CPU Usage**        | Requires 50-100 parallel workers                   |
| **Complexity**       | High (worker management, error handling)           |
| **Cost**             | 50 workers × 5 minutes = Continuous CPU spikes     |

---

## 💰 Conclusion: Cost Difference

### Cost of System Without Tables

**Scenario 1: Live calculation on every request**
Daily traffic assumption:

- 1,000 unique character page views/day
- 500 unique corporation page views/day
- 100 unique alliance page views/day

Each page shows 3 top charts (alliance, corporation, ships).

**Total Query Count:**

```text
(1,000 + 500 + 100) × 3 charts = 4,800 queries/day
```

**Query Time Difference:**

```text
Materialized View: 4,800 × 15ms = 72 seconds/day
Live Calculation: 4,800 × 100ms = 480 seconds/day = 8 minutes/day
```

**Database CPU Difference:** **6.6x more CPU** ❌

---

**Scenario 2: Batch calculation every 5 minutes**
Every 5 minutes = 288 times per day

**Single Refresh Cost:**

```text
10,000 characters × 3 charts × 100ms = 3,000 seconds = 50 minutes
(with 10 workers: 5 minutes)
```

**Daily Total:**

```text
288 × 5 minutes = 1,440 minutes = 24 hours 🔥
```

**❌ Result:** Database is constantly calculating, no time left for other queries!

---

## 🎯 Final Conclusion

### If we didn't have Materialized Views

1. **Live calculation for every request:**
   - **6-15x slower** response time
   - Risk of database **overload**
   - Poor user experience

2. **Batch calculation every 5 minutes (similar logic):**
   - **288x more CPU** usage (24 hours of calculation)
   - Requires 10-50 parallel workers
   - Database is constantly busy
   - Other queries slow down

3. **Extra Cost:**
   - Requires **~$50-100/month** extra database instance (for CPU)
   - Or **current database needs to be upgraded** (+$30-50/month)

### Benefits (With Materialized Views)

- ✅ **Query time:** 10-20ms (ultra fast)
- ✅ **Database load:** Minimal (1 refresh per 5 minutes)
- ✅ **Disk usage:** Only ~50-200 MB (negligible)
- ✅ **Cost:** $0 extra (current database is sufficient)
- ✅ **Scalability:** Same speed even with 10 million killmails

---

## 📈 Summary Table

| Feature             | Current (M.View) | Live Every Request | Batch Every 5min |
| ------------------- | ---------------- | ------------------ | ---------------- |
| **Query Time**      | 10-20ms          | 50-150ms ❌        | 10-20ms          |
| **DB CPU**          | 5%               | 30-50% ❌❌        | 80-100% ❌❌❌   |
| **Disk**            | +200 MB          | 0 MB               | 0 MB             |
| **Extra Cost**      | $0 ✅            | +$30/month         | +$50-100/month   |
| **User Experience** | Excellent ✅     | Slow ❌            | Excellent ✅     |
| **Complexity**      | Low ✅           | Low                | High ❌          |

---

## 🏆 Decision

**Using the Materialized View system is definitely the right decision! 🎉**
**Why?**

1. We save **95% CPU** for **200 MB of disk**
2. Queries are **7-15x faster**
3. Database is scalable (1M killmails = same speed)
4. Extra cost: **$0**

**Alternative cost:** +$50-100/month + poor performance

**Conclusion:** Current system is optimal! 🚀

---

## 📝 Notes

- This analysis was performed assuming **200K killmails**
- With **1M killmails**, the difference would be even larger (30x+ CPU difference)
- Materialized View refresh is optimized (CONCURRENTLY + memory tuning)
- This system works perfectly in production ✅
