# 🌟 Solar System Enhancement Plan - Backend

## Phase 1: Backend Development (1.5-2 hours)

**Objective**: Enhance solar system pages with advanced analytics and risk metrics using `killmail_filters` table data.

---

## 📋 Table of Contents

- [Feature Overview](#feature-overview)
- [Task 1.1: GraphQL Schema Extensions](#task-11-graphql-schema-extensions-15-min)
- [Task 1.2: Backend Services](#task-12-backend-services-45-min)
- [Task 1.3: Resolvers](#task-13-resolvers-30-min)
- [Task 1.4: Generate Types & Test](#task-14-generate-types--test-15-min)
- [Technical Implementation Notes](#technical-implementation-notes)
- [Risk Score Algorithm](#risk-score-algorithm)
- [Completion Checklist](#completion-checklist)

---

## 🎯 Feature Overview

### New Metrics to Add:

1. **🚨 Risk Score** - System danger level based on recent PvP activity
2. **🎯 Top Victim Ships** - Most killed ship types in this system
3. **⚔️ Active Alliances/Corps** - Most active attacking entities
4. **📊 Hourly Activity Chart** - When is the system most dangerous?
5. **💰 ISK Destroyed Trend** - Total value lost over time
6. **📈 Daily Kill Statistics** - Kills per day for the last 30 days

---

## Task 1.1: GraphQL Schema Extensions (15 min)

**File**: `backend/src/schemas/SolarSystem.graphql`

**Add new types**:

```graphql
# System statistics type
type SolarSystemStats {
  totalKills: Int!
  totalValue: Float!
  avgKillsPerDay: Float!
  riskScore: Float! # 0-100 scale
  lastKillAt: String
}

# Hourly activity data
type HourlyActivity {
  hour: Int! # 0-23
  killCount: Int!
}

# Ship statistics
type ShipStats {
  shipTypeId: Int!
  shipTypeName: String!
  killCount: Int!
  totalValue: Float!
}

# Entity statistics (Alliance/Corp)
type EntityStats {
  entityId: Int!
  entityName: String!
  entityType: String! # "alliance" or "corporation"
  killCount: Int!
  isAttacker: Boolean! # true = attacker, false = victim
}

# Daily statistics
type DailyStats {
  date: String!
  killCount: Int!
  totalValue: Float!
}

# Extend SolarSystem type
extend type SolarSystem {
  stats(days: Int = 30): SolarSystemStats
  hourlyActivity(days: Int = 7): [HourlyActivity!]!
  topVictimShips(limit: Int = 10, days: Int = 30): [ShipStats!]!
  topAttackerShips(limit: Int = 10, days: Int = 30): [ShipStats!]!
  activeEntities(limit: Int = 10, days: Int = 30): [EntityStats!]!
  dailyStats(days: Int = 30): [DailyStats!]!
}
```

---

## Task 1.2: Backend Services (45 min)

**File**: `backend/src/services/solar-system/solar-system-stats.service.ts` (CREATE NEW)

**Implement these methods**:

```typescript
export class SolarSystemStatsService {
  // 1. Calculate risk score based on recent activity
  static async calculateRiskScore(
    systemId: number,
    days: number = 7,
  ): Promise<number>;

  // 2. Get hourly activity distribution
  static async getHourlyActivity(
    systemId: number,
    days: number = 7,
  ): Promise<HourlyActivity[]>;

  // 3. Get top victim ships
  static async getTopVictimShips(
    systemId: number,
    limit: number,
    days: number,
  ): Promise<ShipStats[]>;

  // 4. Get top attacker ships
  static async getTopAttackerShips(
    systemId: number,
    limit: number,
    days: number,
  ): Promise<ShipStats[]>;

  // 5. Get active attacking/defending entities
  static async getActiveEntities(
    systemId: number,
    limit: number,
    days: number,
  ): Promise<EntityStats[]>;

  // 6. Get daily statistics
  static async getDailyStats(
    systemId: number,
    days: number,
  ): Promise<DailyStats[]>;

  // 7. Get system overview stats
  static async getSystemStats(
    systemId: number,
    days: number,
  ): Promise<SolarSystemStats>;
}
```

**Implementation Notes**:

- Use `killmail_filters` table with indexes for fast queries
- Cache results with Redis (TTL: 5-15 minutes)
- Use raw SQL for performance on aggregations

---

## Task 1.3: Resolvers (30 min)

**File**: `backend/src/resolvers/solar-system/fields.ts`

**Add field resolvers**:

```typescript
export const solarSystemFields: SolarSystemResolvers = {
  // ... existing resolvers

  stats: async (parent, { days }, context) => {
    return SolarSystemStatsService.getSystemStats(parent.id, days);
  },

  hourlyActivity: async (parent, { days }) => {
    return SolarSystemStatsService.getHourlyActivity(parent.id, days);
  },

  topVictimShips: async (parent, { limit, days }) => {
    return SolarSystemStatsService.getTopVictimShips(parent.id, limit, days);
  },

  topAttackerShips: async (parent, { limit, days }) => {
    return SolarSystemStatsService.getTopAttackerShips(parent.id, limit, days);
  },

  activeEntities: async (parent, { limit, days }) => {
    return SolarSystemStatsService.getActiveEntities(parent.id, limit, days);
  },

  dailyStats: async (parent, { days }) => {
    return SolarSystemStatsService.getDailyStats(parent.id, days);
  },
};
```

---

## Task 1.4: Generate Types & Test (15 min)

```bash
cd backend
yarn codegen
yarn dev  # Test GraphQL playground
```

**Test queries in GraphQL playground**:

```graphql
query TestSolarSystemStats {
  solarSystem(id: 30000142) {
    # Jita
    name
    stats(days: 30) {
      totalKills
      totalValue
      avgKillsPerDay
      riskScore
      lastKillAt
    }
    hourlyActivity(days: 7) {
      hour
      killCount
    }
    topVictimShips(limit: 5, days: 30) {
      shipTypeId
      shipTypeName
      killCount
      totalValue
    }
    topAttackerShips(limit: 5, days: 30) {
      shipTypeId
      shipTypeName
      killCount
    }
    activeEntities(limit: 10, days: 30) {
      entityId
      entityName
      entityType
      killCount
      isAttacker
    }
    dailyStats(days: 30) {
      date
      killCount
      totalValue
    }
  }
}
```

---

## 🔧 Technical Implementation Notes

### Database Queries (killmail_filters):

```sql
-- Risk Score Calculation
-- Calculate risk score from last 7 days activity
SELECT
  COUNT(*) as recent_kills,
  COUNT(DISTINCT DATE(killmail_time)) as active_days,
  AVG(attacker_count) as avg_attackers
FROM killmail_filters
WHERE solar_system_id = $1
  AND killmail_time > NOW() - INTERVAL '$2 days';

-- Hourly Activity Distribution
SELECT
  EXTRACT(HOUR FROM killmail_time) as hour,
  COUNT(*) as kill_count
FROM killmail_filters
WHERE solar_system_id = $1
  AND killmail_time > NOW() - INTERVAL '$2 days'
GROUP BY hour
ORDER BY hour;

-- Top Victim Ships
SELECT
  kf.victim_ship_type_id,
  t.name as ship_type_name,
  COUNT(*) as kill_count,
  COALESCE(SUM(k.total_value), 0) as total_value
FROM killmail_filters kf
INNER JOIN killmails k ON kf.killmail_id = k.killmail_id
LEFT JOIN types t ON kf.victim_ship_type_id = t.type_id
WHERE kf.solar_system_id = $1
  AND kf.killmail_time > NOW() - INTERVAL '$2 days'
  AND kf.victim_ship_type_id IS NOT NULL
GROUP BY kf.victim_ship_type_id, t.name
ORDER BY kill_count DESC
LIMIT $3;

-- Top Attacker Ships (using GIN index)
SELECT
  UNNEST(attacker_ship_type_ids) as ship_type_id,
  COUNT(*) as kill_count
FROM killmail_filters
WHERE solar_system_id = $1
  AND killmail_time > NOW() - INTERVAL '$2 days'
  AND attacker_ship_type_ids IS NOT NULL
GROUP BY ship_type_id
ORDER BY kill_count DESC
LIMIT $3;

-- Active Attacker Alliances (using GIN index)
SELECT
  UNNEST(attacker_alliance_ids) as alliance_id,
  COUNT(*) as kill_count
FROM killmail_filters
WHERE solar_system_id = $1
  AND killmail_time > NOW() - INTERVAL '$2 days'
  AND attacker_alliance_ids IS NOT NULL
GROUP BY alliance_id
ORDER BY kill_count DESC
LIMIT $3;

-- Active Victim Alliances
SELECT
  victim_alliance_id as alliance_id,
  COUNT(*) as kill_count
FROM killmail_filters
WHERE solar_system_id = $1
  AND killmail_time > NOW() - INTERVAL '$2 days'
  AND victim_alliance_id IS NOT NULL
GROUP BY victim_alliance_id
ORDER BY kill_count DESC
LIMIT $3;

-- Daily Statistics
SELECT
  DATE(killmail_time) as date,
  COUNT(*) as kill_count,
  COALESCE(SUM(k.total_value), 0) as total_value
FROM killmail_filters kf
LEFT JOIN killmails k ON kf.killmail_id = k.killmail_id
WHERE kf.solar_system_id = $1
  AND kf.killmail_time > NOW() - INTERVAL '$2 days'
GROUP BY DATE(killmail_time)
ORDER BY date DESC;
```

### Caching Strategy:

```typescript
const CACHE_TTL = {
  SYSTEM_STATS: 300, // 5 minutes
  HOURLY_ACTIVITY: 600, // 10 minutes
  TOP_SHIPS: 900, // 15 minutes
  DAILY_STATS: 1800, // 30 minutes
  ACTIVE_ENTITIES: 900, // 15 minutes
};

// Cache key patterns
const CACHE_KEYS = {
  SYSTEM_STATS: (systemId: number, days: number) =>
    `solar_system:${systemId}:stats:${days}d`,
  HOURLY_ACTIVITY: (systemId: number, days: number) =>
    `solar_system:${systemId}:hourly:${days}d`,
  TOP_VICTIM_SHIPS: (systemId: number, limit: number, days: number) =>
    `solar_system:${systemId}:victim_ships:${limit}:${days}d`,
  TOP_ATTACKER_SHIPS: (systemId: number, limit: number, days: number) =>
    `solar_system:${systemId}:attacker_ships:${limit}:${days}d`,
  ACTIVE_ENTITIES: (systemId: number, limit: number, days: number) =>
    `solar_system:${systemId}:entities:${limit}:${days}d`,
  DAILY_STATS: (systemId: number, days: number) =>
    `solar_system:${systemId}:daily:${days}d`,
};
```

---

## 📊 Risk Score Algorithm

The risk score is calculated based on three key factors:

```typescript
interface RiskData {
  recentKills: number; // Total kills in time period
  activeDays: number; // Days with at least 1 kill
  avgAttackers: number; // Average attackers per killmail
  daysAnalyzed: number; // Total days analyzed
}

function calculateRiskScore(data: RiskData): number {
  // Normalize factors (0-1 scale)
  const killDensity = data.recentKills / data.daysAnalyzed; // kills per day
  const activityConsistency = data.activeDays / data.daysAnalyzed; // activity frequency
  const fleetPresence = Math.min(data.avgAttackers / 10, 1); // fleet size factor

  // Weighted calculation
  const riskScore =
    (killDensity * 0.4 + // 40% weight - kill frequency is most important
      activityConsistency * 0.3 + // 30% weight - consistent activity is dangerous
      fleetPresence * 0.3) * // 30% weight - larger fleets = more danger
    100;

  return Math.min(Math.round(riskScore), 100); // Cap at 100
}
```

**Risk Score Interpretation**:

- **0-30 (Low Risk)**: Quiet system, few kills, safe for travel
- **31-60 (Medium Risk)**: Moderate activity, exercise caution
- **61-100 (High Risk)**: Very dangerous, active PvP, avoid if possible

---

## ✅ Completion Checklist

### Backend Tasks:

- [ ] GraphQL schema updated with new types
- [ ] Service layer implemented (`solar-system-stats.service.ts`)
- [ ] Resolvers connected in `fields.ts`
- [ ] Types generated via `yarn codegen`
- [ ] Queries tested in GraphQL playground
- [ ] Redis caching implemented
- [ ] SQL queries optimized with proper indexes

### Verification:

- [ ] Query returns valid data for Jita (system_id: 30000142)
- [ ] Query returns valid data for null-sec system
- [ ] Query returns valid data for wormhole system
- [ ] Cache keys are properly formatted
- [ ] Error handling is in place
- [ ] Logging added for debugging

---

## 📝 Notes

- **Performance**: All queries use the indexed `killmail_filters` table for fast lookups
- **Caching**: Redis cache prevents database overload
- **Scalability**: Raw SQL queries are optimized for large datasets
- **Flexibility**: All functions accept customizable time ranges

---

**Estimated Time**: 1.5-2 hours

**Next Step**: Proceed to Frontend Development (see SOLAR_SYSTEM_ENHANCEMENT_FRONTEND.md)
