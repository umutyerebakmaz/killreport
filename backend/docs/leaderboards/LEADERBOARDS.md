# Leaderboards — Feature & Architecture Documentation

This document describes all leaderboard (ranking table) features in the application, which pages they are used on,
the GraphQL queries behind them, and the database architectures.

---

## Table of Contents

1. [General Architecture](#1-general-architecture)
   - [1.1 Global Leaderboards — Pre-Aggregated Kill Stats](#11-global-leaderboards--pre-aggregated-kill-stats-tables)
   - [1.2 Entity-Specific Leaderboards — killmail_filters](#12-entity-specific-leaderboards--killmail_filters--gin-index)
   - [1.3 Frontend Data Flow](#13-frontend-data-flow)
   - [1.4 Kill Stats Tables Update Architecture](#14-kill-stats-tables-update-architecture)
2. [Killmails Page](#2-killmails-page)
3. [Alliance Page](#3-alliance-page)
4. [Corporation Page](#4-corporation-page)
5. [Character Page](#5-character-page)
6. [Data Sources & Tables](#6-data-sources--tables)
7. [Cache Strategy](#7-cache-strategy)
8. [Comparison Table](#8-comparison-table)
9. [Missing / Planned Features](#9-missing--planned-features)

---

## 1. General Architecture

The leaderboard system is built on two different architectural patterns:

### 1.1 Global Leaderboards — Pre-Aggregated Kill Stats Tables

Global rankings on the Killmails page (`topPilots`, `topLast7DaysPilots`, etc.) read from **pre-aggregated**
tables. These tables are updated **atomically within a transaction** whenever a killmail is saved.

```text
Killmail Saved
       │
       ▼
kill-stats-realtime.ts
       │
       ├─► character_kill_stats  UPSERT (kill_date, character_id)
       ├─► corporation_kill_stats UPSERT (kill_date, corporation_id)
       └─► alliance_kill_stats   UPSERT (kill_date, alliance_id)
```

**Advantages:**

- Queries complete in `<10ms` (index-only scan).
- `GROUP BY` calculations are not repeated for each query.
- Real-time updates; new kills are reflected on the leaderboard instantly.

> For details on the update mechanism, see [section 1.4](#14-kill-stats-tables-update-architecture).

### 1.2 Entity-Specific Leaderboards — `killmail_filters` + GIN Index

"Top targets" queries on Alliance, Corporation, and Character pages use the `killmail_filters` table.
This table is equipped with GIN (Generalized Inverted Index) indexes and provides fast filtering on array columns
such as `attacker_alliance_ids`, `attacker_corporation_ids`, and `attacker_character_ids`.

```
GraphQL Query (e.g., allianceTopAllianceTargets)
       │
       ▼
alliance-stats.service.ts
       │
       ├─► Redis cache check → HIT  → return
       │                     → MISS ↓
       ▼
killmail_filters (filtering with GIN index)
       │
       ▼
Write to Redis (TTL: 2min – 1hr based on filter)
       │
       ▼
Return results
```

### 1.3 Frontend Data Flow

```
Next.js Page (React Client Component)
       │
       ├─► Apollo Client → GraphQL Query → Fastify GraphQL Server
       │                                         │
       │                                   Redis Cache HIT?
       │                                    YES ──► Return JSON
       │                                    NO  ──► PostgreSQL query
       │                                             │
       │                                         Result cached to Redis
       │                                             │
       └────────────────── Data flow to TopXxxCard components
```

---

### 1.4 Kill Stats Tables Update Architecture

`character_kill_stats`, `corporation_kill_stats`, and `alliance_kill_stats` tables are updated in real-time
**within the same PostgreSQL transaction** whenever a new killmail is saved.

**Service:** `src/services/kill-stats-realtime.ts`

Inconsistency is impossible: either everything is saved or nothing is saved.

**Workers that use this:**

| Worker                                | Source                               |
| ------------------------------------- | ------------------------------------ |
| `worker-killmails.ts`                 | RabbitMQ queue (ZKillboard sync)     |
| `worker-redisq-stream.ts`             | ZKillboard RedisQ stream (live feed) |
| `worker-zkillboard-sync.ts`           | Historical killmail backfill         |
| `worker-esi-corporation-killmails.ts` | ESI corporation killmail sync        |

**Functions used:**

```typescript
// Single killmail — separate UPSERT for each attacker
await updateDailyAggregatesRealtime(tx, {
  killmail_time: new Date(detail.killmail_time),
  character_ids: detail.attackers.map((a) => a.character_id || null),
  corporation_ids: detail.attackers.map((a) => a.corporation_id || null),
  alliance_ids: detail.attackers.map((a) => a.alliance_id || null),
});

// Batch import — killmails are grouped first, then UPSERT in one go
await updateDailyAggregatesBatch(tx, killmailsArray);
```

**SQL pattern:**

```sql
INSERT INTO character_kill_stats (kill_date, character_id, kill_count)
VALUES ($date::date, $characterId, 1)
ON CONFLICT (kill_date, character_id)
DO UPDATE SET kill_count = character_kill_stats.kill_count + 1;
```

All three tables (`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`) are updated
**in parallel** (using `Promise.all`); total overhead is `<5ms` per killmail.

---

## 2. Killmails Page

The Killmails page (`/killmails`) displays **global** activity statistics for the last 7 days.
All rankings use a **rolling 7-day window** (today - 6 days).

### 2.1 Most Active Pilots (Killmails)

**Component:** `TopCharacterCard`
**GraphQL Query:** `topLast7DaysPilots`
**Source Table:** `character_kill_stats`

```graphql
query TopLast7DaysPilots($filter: TopLast7DaysPilotsFilter) {
  topLast7DaysPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
    }
  }
}
```

**Database SQL:**

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= (CURRENT_DATE - INTERVAL '6 days')
  AND  kill_date <= CURRENT_DATE
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**Cache TTL:** 5 minutes (rolling window)

---

### 2.2 Most Active Corporations (Killmails)

**Component:** `TopCorporationCard`
**GraphQL Query:** `topLast7DaysCorporations`
**Source Table:** `corporation_kill_stats`

```graphql
query TopLast7DaysCorporations($filter: TopLast7DaysCorporationsFilter) {
  topLast7DaysCorporations(filter: $filter) {
    rank
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
```

**Database SQL:**

```sql
SELECT corporation_id, SUM(kill_count) AS kill_count
FROM   corporation_kill_stats
WHERE  kill_date >= (CURRENT_DATE - INTERVAL '6 days')
  AND  kill_date <= CURRENT_DATE
GROUP  BY corporation_id
ORDER  BY kill_count DESC
LIMIT  100
```

**Cache TTL:** 5 minutes

---

### 2.3 Most Active Alliances (Killmails)

**Component:** `TopAllianceCard`
**GraphQL Query:** `topLast7DaysAlliances`
**Source Table:** `alliance_kill_stats`

```graphql
query TopLast7DaysAlliances($filter: TopLast7DaysAlliancesFilter) {
  topLast7DaysAlliances(filter: $filter) {
    rank
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
```

**Database SQL:**

```sql
SELECT alliance_id, SUM(kill_count) AS kill_count
FROM   alliance_kill_stats
WHERE  kill_date >= (CURRENT_DATE - INTERVAL '6 days')
  AND  kill_date <= CURRENT_DATE
GROUP  BY alliance_id
ORDER  BY kill_count DESC
LIMIT  100
```

**Cache TTL:** 5 minutes

---

### 2.4 Most Used Ships (Killmails)

> Most used ship types by **attackers**.

**Component:** `TopShipsCard` (attacker variant)
**GraphQL Query:** `topLast7DaysAttackerShips`
**Source Table:** `attackers` (via ship_type_id)

```graphql
query TopLast7DaysAttackerShips($filter: TopLast7DaysAttackerShipsFilter) {
  topLast7DaysAttackerShips(filter: $filter) {
    rank
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Cache TTL:** 5 minutes

---

### 2.5 Most Killed Ships (Killmails)

> Most commonly **killed** (victim) ship types.

**Component:** `TopShipsCard` (victim variant)
**GraphQL Query:** `topLast7DaysShips`
**Source Table:** `victims` (via ship_type_id)

```graphql
query TopLast7DaysShips($filter: TopLast7DaysShipsFilter) {
  topLast7DaysShips(filter: $filter) {
    rank
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Cache TTL:** 5 minutes

---

## 3. Alliance Page

The Alliance page (`/alliances/[id]`) displays statistics specific to a particular alliance's activity.
All queries accept an `allianceId` parameter and can be filtered by time period using the optional `TopTargetFilter`.

**`TopTargetFilter` enum values:**

| Value          | Description        |
| -------------- | ------------------ |
| `ALL_TIME`     | All time (default) |
| `LAST_90_DAYS` | Last 90 days       |
| `LAST_7_DAYS`  | Last 7 days        |
| `TODAY`        | Today              |

---

### 3.1 Most Active Pilots (Alliance)

> Characters with the most kills on behalf of this alliance.

**Component:** `TopCharacterCard`
**GraphQL Query:** `allianceTopCharacters(allianceId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[CharacterTopTarget!]!`
**Source:** `attackers` table + `killmail_filters` GIN index

```graphql
query AllianceTopCharacters($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopCharacters(allianceId: $allianceId, filter: $filter) {
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
```

**Service:** `AllianceStatsService.getTopCharacters()`
**Cache Key:** `alliance_stats:{allianceId}:characters:{filter}`

---

### 3.2 Most Used Ships (Alliance)

> Ship types most commonly used by this alliance as attackers.

**GraphQL Query:** `allianceTopShips(allianceId: Int!, filter: TopTargetFilter)`
**Source:** `attackers` table + `killmail_filters` GIN index
**GraphQL Type:** `[ShipTopKill!]!`

```graphql
query AllianceTopShips($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopShips(allianceId: $allianceId, filter: $filter) {
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Service:** `AllianceStatsService.getTopShips()`
**Cache Key:** `alliance_stats:{allianceId}:ships:{filter}`

---

### 3.3 Most Killed Alliances (Alliance)

> Enemy alliances this alliance has killed the most.

**GraphQL Query:** `allianceTopAllianceTargets(allianceId: Int!, filter: TopTargetFilter)`
**Source:** `killmail_filters` table (victim_alliance_id filter)
**GraphQL Type:** `[AllianceTopTarget!]!`

```graphql
query AllianceTopAllianceTargets($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopAllianceTargets(allianceId: $allianceId, filter: $filter) {
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
```

**Service:** `AllianceStatsService.getTopAllianceTargets()`
**Cache Key:** `alliance_stats:{allianceId}:alliances:{filter}`

---

### 3.4 Most Killed Corporations (Alliance)

> Enemy corporations this alliance has killed the most.

**GraphQL Query:** `allianceTopCorporationTargets(allianceId: Int!, filter: TopTargetFilter)`
**Source:** `killmail_filters` table (victim_corporation_id filter)
**GraphQL Type:** `[CorporationTopTarget!]!`

```graphql
query AllianceTopCorporationTargets(
  $allianceId: Int!
  $filter: TopTargetFilter
) {
  allianceTopCorporationTargets(allianceId: $allianceId, filter: $filter) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
```

**Service:** `AllianceStatsService.getTopCorporationTargets()`
**Cache Key:** `alliance_stats:{allianceId}:corporations:{filter}`

---

### 3.5 Most Killed Ships (Alliance)

> Victim ship types most commonly killed by this alliance.

**GraphQL Query:** `allianceTopShipTargets(allianceId: Int!, filter: TopTargetFilter)`
**Source:** `killmail_filters` table (victim_ship_type_id filter)
**GraphQL Type:** `[ShipTopKill!]!`

```graphql
query AllianceTopShipTargets($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopShipTargets(allianceId: $allianceId, filter: $filter) {
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Service:** `AllianceStatsService.getTopShipTargets()`
**Cache Key:** `alliance_stats:{allianceId}:ship_targets:{filter}`

---

## 4. Corporation Page

The Corporation page (`/corporations/[id]`) displays statistics specific to a particular corporation's activity.
It uses the same `TopTargetFilter` enum as the Alliance page.

---

### 4.1 Most Active Pilots (Corporation)

> Characters with the most kills on behalf of this corporation.

**Component:** `TopCharacterCard`
**GraphQL Query:** `corporationTopCharacters(corporationId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[CharacterTopTarget!]!`
**Source:** `attackers` table + `killmail_filters` GIN index

```graphql
query CorporationTopCharacters($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopCharacters(corporationId: $corporationId, filter: $filter) {
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
```

**Service:** `CorporationStatsService.getTopCharacters()`
**Cache Key:** `corporation_stats:{corporationId}:characters:{filter}`

---

### 4.2 Most Used Ships (Corporation)

> Ship types most commonly used by this corporation as attackers.

**GraphQL Query:** `corporationTopShips(corporationId: Int!, filter: TopTargetFilter)`
**Source:** `attackers` table + `killmail_filters` GIN index
**GraphQL Type:** `[ShipTopKill!]!`

```graphql
query CorporationTopShips($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopShips(corporationId: $corporationId, filter: $filter) {
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Service:** `CorporationStatsService.getTopShips()`
**Cache Key:** `corporation_stats:{corporationId}:ships:{filter}`

---

### 4.3 Most Killed Ships (Corporation)

> Victim ship types most commonly killed by this corporation.

**GraphQL Query:** `corporationTopShipTargets(corporationId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[ShipTopKill!]!`

```graphql
query CorporationTopShipTargets(
  $corporationId: Int!
  $filter: TopTargetFilter
) {
  corporationTopShipTargets(corporationId: $corporationId, filter: $filter) {
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Service:** `CorporationStatsService.getTopShipTargets()`
**Cache Key:** `corporation_stats:{corporationId}:ship_targets:{filter}`

---

### 4.4 Most Killed Alliances (Corporation)

> Enemy alliances this corporation has killed the most.

**GraphQL Query:** `corporationTopAllianceTargets(corporationId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[AllianceTopTarget!]!`

```graphql
query CorporationTopAllianceTargets(
  $corporationId: Int!
  $filter: TopTargetFilter
) {
  corporationTopAllianceTargets(
    corporationId: $corporationId
    filter: $filter
  ) {
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
```

**Service:** `CorporationStatsService.getTopAllianceTargets()`
**Cache Key:** `corporation_stats:{corporationId}:alliances:{filter}`

---

### 4.5 Most Killed Corporations (Corporation)

> Enemy corporations this corporation has killed the most.

**GraphQL Query:** `corporationTopCorporationTargets(corporationId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[CorporationTopTarget!]!`

```graphql
query CorporationTopCorporationTargets(
  $corporationId: Int!
  $filter: TopTargetFilter
) {
  corporationTopCorporationTargets(
    corporationId: $corporationId
    filter: $filter
  ) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
```

**Service:** `CorporationStatsService.getTopCorporationTargets()`
**Cache Key:** `corporation_stats:{corporationId}:corporations:{filter}`

---

## 5. Character Page

The Character page (`/characters/[id]`) displays statistics specific to a particular character's activity.

---

### 5.1 Most Killed Alliances (Character)

> Enemy alliances this character has killed the most.

**GraphQL Query:** `characterTopAllianceTargets(characterId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[AllianceTopTarget!]!`

```graphql
query CharacterTopAllianceTargets(
  $characterId: Int!
  $filter: TopTargetFilter
) {
  characterTopAllianceTargets(characterId: $characterId, filter: $filter) {
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
```

**Service:** `CharacterStatsService.getTopAllianceTargets()`
**Cache Key:** `character_stats:{characterId}:alliances:{filter}`

---

### 5.2 Most Killed Corporations (Character)

> Enemy corporations this character has killed the most.

**GraphQL Query:** `characterTopCorporationTargets(characterId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[CorporationTopTarget!]!`

```graphql
query CharacterTopCorporationTargets(
  $characterId: Int!
  $filter: TopTargetFilter
) {
  characterTopCorporationTargets(characterId: $characterId, filter: $filter) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
```

**Service:** `CharacterStatsService.getTopCorporationTargets()`
**Cache Key:** `character_stats:{characterId}:corporations:{filter}`

---

### 5.3 Most Killed Ships (Character)

> Victim ship types most commonly killed by this character.

**GraphQL Query:** `characterTopShipTargets(characterId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[ShipTopKill!]!`

```graphql
query CharacterTopShipTargets($characterId: Int!, $filter: TopTargetFilter) {
  characterTopShipTargets(characterId: $characterId, filter: $filter) {
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Service:** `CharacterStatsService.getTopShipTargets()`
**Cache Key:** `character_stats:{characterId}:ship_targets:{filter}`

---

### 5.4 Most Used Ships (Character)

> Ship types most commonly used by this character as an attacker.

**GraphQL Query:** `characterTopShips(characterId: Int!, filter: TopTargetFilter)`
**GraphQL Type:** `[ShipTopKill!]!`

```graphql
query CharacterTopShips($characterId: Int!, $filter: TopTargetFilter) {
  characterTopShips(characterId: $characterId, filter: $filter) {
    killCount
    shipType {
      id
      name
    }
  }
}
```

**Service:** `CharacterStatsService.getTopShips()`
**Cache Key:** `character_stats:{characterId}:ships:{filter}`

---

## 6. Data Sources & Tables

### 6.1 Pre-Aggregated Kill Stats Tables (Global Leaderboards)

These tables are updated within a transaction by `kill-stats-realtime.ts` whenever a killmail is saved.

| Table                    | Primary Key                   | Index                          |
| ------------------------ | ----------------------------- | ------------------------------ |
| `character_kill_stats`   | `(kill_date, character_id)`   | `(kill_date, kill_count DESC)` |
| `corporation_kill_stats` | `(kill_date, corporation_id)` | `(kill_date, kill_count DESC)` |
| `alliance_kill_stats`    | `(kill_date, alliance_id)`    | `(kill_date, kill_count DESC)` |

**Update mechanism:** For each new killmail, the attacker list is scanned, and for each (kill_date, entity_id) pair,
`INSERT ... ON CONFLICT DO UPDATE SET kill_count = kill_count + 1` is executed.

### 6.2 `killmail_filters` Table (Entity-Specific Leaderboards)

| Column                     | Type          | Index       |
| -------------------------- | ------------- | ----------- |
| `killmail_id`              | `INT`         | Primary Key |
| `killmail_time`            | `TIMESTAMPTZ` | B-tree      |
| `victim_character_id`      | `INT`         | B-tree      |
| `victim_corporation_id`    | `INT`         | B-tree      |
| `victim_alliance_id`       | `INT`         | B-tree      |
| `victim_ship_type_id`      | `INT`         | B-tree      |
| `attacker_character_ids`   | `INT[]`       | GIN         |
| `attacker_corporation_ids` | `INT[]`       | GIN         |
| `attacker_alliance_ids`    | `INT[]`       | GIN         |

Entity-specific leaderboard queries use GIN array containment operators like `attacker_alliance_ids @> ARRAY[$allianceId]`
for filtering; this way only the relevant killmail_id's are found instead of scanning the entire `attackers` table.

---

## 7. Cache Strategy

### 7.1 Global Leaderboard Cache (Killmails Page)

| Situation                     | TTL           |
| ----------------------------- | ------------- |
| Today / current week / month  | **5 minutes** |
| Historical date (static data) | **1 hour**    |
| 90 day rolling                | **5 minutes** |

**Cache key format:** `leaderboard:{queryName}:{dateParam}:{limit}`

Example:

- `leaderboard:topPilots:2026-03-03:100`
- `leaderboard:topLast7DaysPilots:2026-03-03:100`
- `leaderboard:topWeeklyPilots:2026-02-23:100`

### 7.2 Entity-Specific Cache (Alliance/Corporation/Character Pages)

| Filter         | TTL            | Reason           |
| -------------- | -------------- | ---------------- |
| `TODAY`        | **2 minutes**  | Most dynamic     |
| `LAST_7_DAYS`  | **5 minutes**  | Frequent changes |
| `LAST_90_DAYS` | **15 minutes** | Medium frequency |
| `ALL_TIME`     | **1 hour**     | Rarely changes   |

**Cache key format:** `{entity}_stats:{entityId}:{statType}:{filter}`

Example:

- `alliance_stats:99000001:alliances:LAST_7_DAYS`
- `corporation_stats:98000001:ships:ALL_TIME`
- `character_stats:12345678:ship_targets:TODAY`

---

## 8. Comparison Table

| Leaderboard              | Page        | GraphQL Query                      | Source Table                     | Time Filter       | Cache TTL |
| ------------------------ | ----------- | ---------------------------------- | -------------------------------- | ----------------- | --------- |
| Most Active Pilots       | Killmails   | `topLast7DaysPilots`               | `character_kill_stats`           | Rolling 7 days    | 5 min     |
| Most Active Corporations | Killmails   | `topLast7DaysCorporations`         | `corporation_kill_stats`         | Rolling 7 days    | 5 min     |
| Most Active Alliances    | Killmails   | `topLast7DaysAlliances`            | `alliance_kill_stats`            | Rolling 7 days    | 5 min     |
| Most Used Ships          | Killmails   | `topLast7DaysAttackerShips`        | `attackers`                      | Rolling 7 days    | 5 min     |
| Most Killed Ships        | Killmails   | `topLast7DaysShips`                | `victims`                        | Rolling 7 days    | 5 min     |
| Most Active Pilots       | Alliance    | `allianceTopCharacters`            | `attackers` + `killmail_filters` | `TopTargetFilter` | 2min–1hr  |
| Most Used Ships          | Alliance    | `allianceTopShips`                 | `attackers` + `killmail_filters` | `TopTargetFilter` | 2min–1hr  |
| Most Killed Alliances    | Alliance    | `allianceTopAllianceTargets`       | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Corporations | Alliance    | `allianceTopCorporationTargets`    | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Ships        | Alliance    | `allianceTopShipTargets`           | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Active Pilots       | Corporation | `corporationTopCharacters`         | `attackers` + `killmail_filters` | `TopTargetFilter` | 2min–1hr  |
| Most Used Ships          | Corporation | `corporationTopShips`              | `attackers` + `killmail_filters` | `TopTargetFilter` | 2min–1hr  |
| Most Killed Ships        | Corporation | `corporationTopShipTargets`        | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Alliances    | Corporation | `corporationTopAllianceTargets`    | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Corporations | Corporation | `corporationTopCorporationTargets` | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Alliances    | Character   | `characterTopAllianceTargets`      | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Corporations | Character   | `characterTopCorporationTargets`   | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Killed Ships        | Character   | `characterTopShipTargets`          | `killmail_filters`               | `TopTargetFilter` | 2min–1hr  |
| Most Used Ships          | Character   | `characterTopShips`                | `attackers` + `killmail_filters` | `TopTargetFilter` | 2min–1hr  |

---

## 9. Missing / Planned Features

✅ All leaderboard features have been implemented. There are currently no additional planned features.

> **Last Updated:** March 3, 2026
> **Related Documents:** [KILL_STATS_REALTIME.md](KILL_STATS_REALTIME.md) · [LEADERBOARD_QUERIES.MD](../LEADERBOARD_QUERIES.MD) · [CACHE_STRATEGY.MD](../CACHE_STRATEGY.MD) · [ARCHITECTURE.MD](../ARCHITECTURE.MD)
