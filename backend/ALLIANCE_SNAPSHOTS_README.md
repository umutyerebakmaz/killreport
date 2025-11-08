# 📊 Alliance Snapshot & Metrics System

> **Track alliance growth and decline trends over time with automated daily snapshots and delta calculations.**

## ✨ Features

- 📸 **Daily Snapshots**: Automatically captures alliance member count and corporation count every day
- 📈 **Delta Metrics**: Shows changes over 7-day and 30-day periods
- 📊 **Growth Rates**: Calculates percentage-based growth/decline rates
- 🕰️ **Historical Data**: Query snapshot history for any time period
- 🎯 **Unique Guarantee**: One snapshot per alliance per day (enforced by database constraint)
- 🔍 **Audit Trail**: Both `snapshot_date` (business logic) and `created_at` (debugging) timestamps

## 🗄️ Database Schema

### AllianceSnapshot Table

```sql
CREATE TABLE alliance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  member_count INTEGER NOT NULL,
  corporation_count INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,              -- Business logic (YYYY-MM-DD)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Audit trail (exact time)
  UNIQUE(alliance_id, snapshot_date)        -- One snapshot per alliance per day
);

CREATE INDEX idx_alliance_snapshots_snapshot_date ON alliance_snapshots(snapshot_date);
CREATE INDEX idx_alliance_snapshots_alliance_id ON alliance_snapshots(alliance_id);
```

**Key Design Decisions:**

| Field             | Type                           | Purpose                                                  |
| ----------------- | ------------------------------ | -------------------------------------------------------- |
| `snapshot_date`   | `DATE`                         | Business logic - Used for delta calculations and queries |
| `created_at`      | `TIMESTAMP`                    | Audit trail - Exact time when snapshot was taken         |
| Unique Constraint | `(alliance_id, snapshot_date)` | Prevents duplicate snapshots for same day                |

## 🔌 GraphQL API

### Alliance Type Extensions

```graphql
type Alliance {
  id: Int!
  name: String!
  memberCount: Int! # ⚡ Current total members
  corporationCount: Int! # ⚡ Current total corporations
  metrics: AllianceMetrics # 📊 Delta and growth rate data
  snapshots(days: Int): [AllianceSnapshot!]! # 🕰️ Historical snapshot data
}

type AllianceMetrics {
  memberCountDelta7d: Int # 📈 Member change (7 days)
  memberCountDelta30d: Int # 📈 Member change (30 days)
  corporationCountDelta7d: Int # 🏢 Corporation change (7 days)
  corporationCountDelta30d: Int # 🏢 Corporation change (30 days)
  memberCountGrowthRate7d: Float # 📊 Growth rate % (7 days)
  memberCountGrowthRate30d: Float # 📊 Growth rate % (30 days)
  corporationCountGrowthRate7d: Float # 📊 Corp growth rate % (7 days)
  corporationCountGrowthRate30d: Float # 📊 Corp growth rate % (30 days)
}

type AllianceSnapshot {
  date: String! # 📅 YYYY-MM-DD format
  memberCount: Int! # 👥 Total members on this date
  corporationCount: Int! # 🏢 Total corporations on this date
}
```

### 📝 Query Examples

#### Get Alliance with Metrics

```graphql
query AllianceWithMetrics {
  alliance(id: 99003214) {
    id
    name
    memberCount
    corporationCount
    metrics {
      memberCountDelta7d
      memberCountDelta30d
      memberCountGrowthRate7d
      memberCountGrowthRate30d
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "alliance": {
      "id": 99003214,
      "name": "Goonswarm Federation",
      "memberCount": 30523,
      "corporationCount": 150,
      "metrics": {
        "memberCountDelta7d": 234,
        "memberCountDelta30d": -1250,
        "memberCountGrowthRate7d": 0.77,
        "memberCountGrowthRate30d": -3.93
      }
    }
  }
}
```

#### Get Historical Snapshots

```graphql
query AllianceHistory {
  alliance(id: 99003214) {
    name
    snapshots(days: 30) {
      date
      memberCount
      corporationCount
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "alliance": {
      "name": "Goonswarm Federation",
      "snapshots": [
        { "date": "2025-10-09", "memberCount": 31773, "corporationCount": 152 },
        { "date": "2025-10-10", "memberCount": 31650, "corporationCount": 151 },
        { "date": "2025-11-08", "memberCount": 30523, "corporationCount": 150 }
      ]
    }
  }
}
```

## 🤖 Worker Usage

### Manual Snapshot Creation

Take snapshots for all alliances right now:

```bash
cd backend
yarn snapshot:alliances
```

**Output:**

```
📸 Alliance Snapshot Worker başlatıldı...
✓ 3540 alliance bulundu
  ⏳ İşlenen: 50/3540 (50 yeni, 0 mevcut)
  ⏳ İşlenen: 100/3540 (100 yeni, 0 mevcut)
✅ Snapshot alma tamamlandı!
   • Toplam işlenen: 3540
   • Yeni snapshot: 3540
   • Zaten mevcut: 0
   • Süre: 45.23 saniye
   • Tarih: 2025-11-08
```

### ⏰ Automated Cron Job Setup

Set up a cron job to run snapshots automatically every day:

```bash
# Edit crontab
crontab -e

# Run every day at midnight (00:00)
0 0 * * * cd /root/killreport/backend && yarn snapshot:alliances >> /var/log/alliance-snapshots.log 2>&1
```

### 📅 Cron Schedule Examples

| Schedule          | Cron Expression | Description       |
| ----------------- | --------------- | ----------------- |
| Daily at midnight | `0 0 * * *`     | Most recommended  |
| Daily at 2 AM     | `0 2 * * *`     | Off-peak hours    |
| Daily at 6 AM     | `0 6 * * *`     | Before peak usage |
| Every 12 hours    | `0 */12 * * *`  | Twice daily       |

### 🛡️ Worker Behavior

**First run of the day:**

```bash
yarn snapshot:alliances
# ✅ Creates 3540 new snapshots
```

**Second run same day:**

```bash
yarn snapshot:alliances
# ✅ Skips 3540 existing snapshots (duplicate check)
```

**Next day:**

```bash
yarn snapshot:alliances
# ✅ Creates 3540 new snapshots for the new date
```

## ⚙️ Implementation Details

### Delta Calculation Logic

```typescript
// Get current values
const currentMemberCount = await getTotalMembers(allianceId);

// Find snapshot from 7 days ago (or closest before that)
const snapshot7d = await prisma.allianceSnapshot.findFirst({
  where: {
    alliance_id: allianceId,
    snapshot_date: { lte: date7dAgo },
  },
  orderBy: { snapshot_date: "desc" },
});

// Calculate delta (difference)
const delta7d = currentMemberCount - snapshot7d.member_count;

// Calculate growth rate (percentage)
const growthRate7d = (delta7d / snapshot7d.member_count) * 100;
```

### 🔒 Unique Constraint Protection

The database enforces one snapshot per alliance per day:

```prisma
@@unique([alliance_id, snapshot_date])
```

**What happens on duplicate attempt:**

```typescript
// First run today - SUCCESS ✅
await prisma.allianceSnapshot.create({
  data: {
    alliance_id: 99003214,
    member_count: 30523,
    corporation_count: 150,
    snapshot_date: new Date('2025-11-08')
  }
});

// Second run today - SKIPPED ⏭️
// Worker checks if snapshot exists before creating
const existing = await prisma.allianceSnapshot.findUnique({
  where: {
    alliance_id_snapshot_date: {
      alliance_id: 99003214,
      snapshot_date: new Date('2025-11-08')
    }
  }
});
if (existing) {
  console.log('Snapshot already exists, skipping...');
}
```

## 🧪 Testing

### Run Test Script

```bash
cd backend
./test-alliance-metrics.sh
```

**Expected Output:**
```json
{
  "data": {
    "alliances": {
      "edges": [{
        "node": {
          "id": 99003214,
          "name": "Goonswarm Federation",
          "metrics": {
            "memberCountDelta30d": -1250,
            "memberCountGrowthRate30d": -3.93
          }
        }
      }]
    }
  }
}
```

### Manual GraphQL Test

```bash
# Start backend server
yarn dev

# In another terminal, test the API
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { alliances(filter: { limit: 1 }) { edges { node { id name metrics { memberCountDelta30d memberCountGrowthRate30d } } } } }"
  }'
```

### Test Data Verification

```bash
# Check if snapshots exist in database
cd backend
yarn prisma:studio

# Navigate to alliance_snapshots table
# Verify:
# - ✅ One snapshot per alliance per day
# - ✅ snapshot_date is DATE type (YYYY-MM-DD)
# - ✅ created_at is TIMESTAMP (with time)
```

## 🎨 Frontend Integration

### AllianceCard Component

Delta verilerini gösterir:

```tsx
const memberDelta30d = alliance.metrics?.memberCountDelta30d ?? null;
const memberGrowthRate30d = alliance.metrics?.memberCountGrowthRate30d ?? null;

// Pozitif: yeşil, Negatif: kırmızı
const deltaColor = memberDelta30d >= 0 ? "text-green-400" : "text-red-400";
```

### Query

```graphql
query Alliances {
  alliances {
    edges {
      node {
        id
        name
        metrics {
          memberCountDelta30d
          memberCountGrowthRate30d
        }
      }
    }
  }
}
```

## Performance Considerations

### N+1 Query Prevention

Metrics field resolver her alliance için ayrı query çalıştırır, ancak:

- Snapshot'lar index'lenmiştir (`@@index([alliance_id])`, `@@index([snapshot_date])`)
- Query'ler optimize edilmiştir (`orderBy: { snapshot_date: 'desc' }`, `findFirst`)
- İlerde DataLoader eklenebilir

### Database Indexes

```sql
CREATE INDEX idx_alliance_snapshots_alliance_id ON alliance_snapshots(alliance_id);
CREATE INDEX idx_alliance_snapshots_snapshot_date ON alliance_snapshots(snapshot_date);
CREATE UNIQUE INDEX idx_alliance_snapshots_unique ON alliance_snapshots(alliance_id, snapshot_date);
```

## Troubleshooting

### Metrics null dönüyor

**Neden:** Henüz snapshot verisi yok.

**Çözüm:**

```bash
yarn snapshot:alliances
```

### Snapshot duplicate key error

**Neden:** Aynı gün için zaten snapshot var.

**Çözüm:** Normal durum, worker zaten kontrol ediyor. Tekrar çalıştırmaya gerek yok.

### Geçmiş veri yok

**Neden:** Yeni kurulan sistem, henüz tarihsel veri yok.

**Çözüm:** Zamana yayarak günlük snapshot alın. Manuel geçmiş veri eklemek için:

```sql
-- 7 gün önceki veriyi manuel ekle (örnek)
INSERT INTO alliance_snapshots (alliance_id, member_count, corporation_count, snapshot_date)
SELECT
  id,
  (SELECT SUM(member_count) FROM corporations WHERE alliance_id = alliances.id),
  (SELECT COUNT(*) FROM corporations WHERE alliance_id = alliances.id),
  CURRENT_DATE - INTERVAL '7 days'
FROM alliances;
```

## Future Improvements

1. **DataLoader Integration**: Batch snapshot queries
2. **More Metrics**:
   - Killmail count delta
   - Activity score delta
   - ISK destroyed delta
3. **Snapshot Retention**: Old snapshot'ları temizle (örn: 1 yıldan eski)
4. **Aggregated Views**: Pre-calculated monthly/yearly averages
5. **Alerting**: Büyük değişimler için bildirim
6. **Graphing**: Frontend'de trend charts

## Architecture

```
┌─────────────────┐
│  Cron Job       │  (Daily 00:00)
│  snapshot:      │
│  alliances      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  worker-alliance-snapshots.ts           │
│  • Tüm alliance'ları oku                │
│  • Her biri için member/corp count al   │
│  • AllianceSnapshot oluştur             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  PostgreSQL: alliance_snapshots         │
│  • alliance_id, member_count,           │
│    corporation_count, snapshot_date     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  GraphQL Resolver: Alliance.metrics     │
│  • Son snapshot'ı al                    │
│  • 7d/30d önceki snapshot'ı al          │
│  • Delta ve growth rate hesapla         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Frontend: AllianceCard                 │
│  • metrics.memberCountDelta30d göster   │
│  • Renk: yeşil/kırmızı                  │
│  • Tooltip: detaylı bilgi               │
└─────────────────────────────────────────┘
```

## Related Files

- `backend/prisma/schema.prisma` - AllianceSnapshot model
- `backend/src/schema/alliance.graphql` - GraphQL types
- `backend/src/resolvers/alliance.resolver.ts` - Metrics logic
- `backend/src/workers/worker-alliance-snapshots.ts` - Snapshot worker
- `frontend/src/components/Card/AllianceCard.tsx` - UI component
- `frontend/src/app/alliances/alliances.graphql` - Frontend query
