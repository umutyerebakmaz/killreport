A victim ship in a capsule group (`CAPSULE_GROUP_IDS`, group 29) is priced at
10 ISK. Group, not type 670, so the Genolution variant counts as well:

```typescript
const CAPSULE_VALUE = 10;

const victimGroupId = typeGroupMap.get(killmailData.victim.ship_type_id);
const shipPrice =
  victimGroupId !== undefined && CAPSULE_GROUP_IDS.includes(victimGroupId)
    ? CAPSULE_VALUE
    : priceMap.get(killmailData.victim.ship_type_id) || 0;
```

The Rust workers use the same formula from
[killmail-value](../../../backend-rs/crates/killmail-value/src/lib.rs).# Capsule (Pod) Value Calculation

## Overview

Capsules (pods) in EVE Online killmails now have a fixed ship value of **10 ISK** in value calculations. This ensures consistent pricing across all calculations while implants and other items are still calculated based on market prices.

## Changes Made

### 1. Value Calculation Functions

**File:** `src/helpers/calculate-killmail-values.ts`

Added special handling for Capsule (type_id: 670):

```typescript
// Constants
const CAPSULE_TYPE_ID = 670;
const CAPSULE_VALUE = 10;

// Usage in calculateKillmailValues()
const shipPrice =
  killmailData.victim.ship_type_id === CAPSULE_TYPE_ID
    ? CAPSULE_VALUE
    : priceMap.get(killmailData.victim.ship_type_id) || 0;
```

**Functions Updated:**

- `calculateKillmailValues()` - Single killmail calculation
- `calculateKillmailValuesBatch()` - Batch calculation for multiple killmails

### 2. Backfill Worker

**File:** `src/workers/worker-backfill-values.ts`

The backfill worker recalculates with `calculateKillmailValues`, so it uses
the same capsule rule. See [backfill-values-guide.md](./backfill-values-guide.md).

### 3. GraphQL Field Resolvers

**File:** `src/resolvers/killmail/fields.ts`

GraphQL resolvers for `totalValue` and `destroyedValue` also check for Capsules:

```typescript
// Special case: Capsule (pod) has fixed value of 10 ISK
if (victim?.ship_type_id) {
  const shipPrice =
    victim.ship_type_id === CAPSULE_TYPE_ID
      ? CAPSULE_VALUE
      : priceMap.get(victim.ship_type_id) || 0;
  totalValue += shipPrice;
}
```

### 4. Queue Script Enhancement

**File:** `src/queues/queue-backfill-values.ts`

`--capsules-only` queues only killmails whose victim ship is in group 29:

```bash
yarn queue:backfill-values --capsules-only
```

## Usage

### Queuing Capsule Killmails for Processing

```bash
# Recalculate every Capsule killmail
yarn queue:backfill-values:rs --capsules-only

# With limit
yarn queue:backfill-values:rs --capsules-only --limit=10000
```

### Running the Worker

```bash
yarn worker:backfill-values:rs
```

## Value Calculation Example

For a Capsule killmail with implants:

| Item                  | Quantity Destroyed | Unit Price     | Value              |
| --------------------- | ------------------ | -------------- | ------------------ |
| Capsule               | 1                  | 10 ISK         | 10 ISK             |
| Mid-Grade Halo Alpha  | 1                  | 5,000,000 ISK  | 5,000,000 ISK      |
| High-Grade Halo Alpha | 1                  | 15,000,000 ISK | 15,000,000 ISK     |
| **TOTAL**             |                    |                | **20,000,010 ISK** |

**Before:** Only implants were counted (~20M ISK)
**After:** Capsule (10 ISK) + implants (~20M ISK) = 20,000,010 ISK

## Technical Details

### Affected Fields

- `Killmail.totalValue` - Total destroyed + dropped value
- `Killmail.destroyedValue` - Only destroyed items (includes Capsule)
- `Killmail.droppedValue` - Only dropped items (no ship value)

### Capsule Characteristics

- **Group ID:** 29 (Capsule 670, Genolution variants)
- **Fixed Ship Value:** 10 ISK
- **Applies to:** All Capsule kills regardless of implants
- **Retroactive:** Worker can update historical killmails

### Special Cases

- Empty Capsule (no implants): `destroyedValue = 10 ISK`
- Capsule with implants: `destroyedValue = 10 ISK + implant values`
- Dropped implants: Only counted in `droppedValue`, not added to Capsule value

## Implementation Notes

### Connection Pool Management

The value calculation uses appropriate Prisma clients:

- **Resolvers/API:** `src/services/prisma.ts` (5 connections)
- **Workers:** `src/services/prisma-worker.ts` (10 connections per worker)

This prevents connection pool exhaustion when multiple workers run in parallel.

### Performance

- Single Capsule lookup: Uses cached `totalValue` if available (~0ms)
- Batch calculation: Single market price query for all items + Capsule
- Worker processing: 3 concurrent killmails per worker by default

### Future Enhancements

- Consider other special ship types that might need fixed values
- Add statistics dashboard for Capsule kills
- Implement automated Capsule killmail sync with zKillboard

## Troubleshooting

### Queue Stuck

If Capsule killmails queue up but don't process:

```bash
# Check queue status
yarn queue:check backfill_killmail_values_queue

# Restart worker
yarn worker:backfill-values
```

### Value Still Wrong

If killmail still shows wrong value after backfill:

```bash
# Force recalculation
yarn queue:backfill-values:rs --capsules-only --limit=100

# Verify specific killmail
yarn worker:backfill-values
```

### Database Consistency

To check Capsule killmails with incorrect values:

```sql
-- Find Capsules with low values (likely not updated)
SELECT km.killmail_id, km.total_value, v.ship_type_id
FROM killmails km
JOIN victims v ON v.killmail_id = km.killmail_id
JOIN types t ON t.id = v.ship_type_id
WHERE t.group_id = 29 AND km.total_value < 10;
```
