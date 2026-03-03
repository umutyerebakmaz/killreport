# Capsule (Pod) Value Calculation

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

The backfill worker now uses the same Capsule handling when recalculating values:

```typescript
// Calculate ship value
// Special case: Capsule (pod) has fixed value of 10 ISK
const shipPrice =
  killmail.victim.ship_type_id === CAPSULE_TYPE_ID
    ? CAPSULE_VALUE
    : priceMap.get(killmail.victim.ship_type_id) || 0;
```

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

Added `--capsules-only` flag to process only Capsule killmails:

```bash
# Original behavior - all killmails with zero value
yarn queue:backfill-values --mode=zero

# New - only Capsule killmails with zero value
yarn queue:backfill-values --mode=zero --capsules-only
```

## Usage

### Queuing Capsule Killmails for Processing

```bash
# Process Capsule killmails where total_value = 0
yarn queue:backfill-values --mode=zero --capsules-only

# Process Capsule killmails where total_value = NULL
yarn queue:backfill-values --mode=null --capsules-only

# Recalculate all Capsule killmails
yarn queue:backfill-values --mode=all --capsules-only

# With limit
yarn queue:backfill-values --mode=all --capsules-only --limit=10000
```

### Running the Worker

```bash
# Single worker
yarn worker:backfill-values

# Multiple workers in parallel (recommended)
yarn worker:backfill-values &
yarn worker:backfill-values &
yarn worker:backfill-values
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

- **Type ID:** 670
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
- **Workers:** `src/services/prisma-worker.ts` (2 connections per worker)

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
yarn queue:backfill-values --mode=all --capsules-only --limit=100

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
WHERE v.ship_type_id = 670 AND km.total_value < 10;
```
