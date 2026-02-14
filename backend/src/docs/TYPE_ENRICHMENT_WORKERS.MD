# Type Enrichment Workers - Complete Guide

## Overview

This documentation explains the process of enriching EVE Online Types with Dogma information (attributes and effects). The Dogma system defines the properties and behaviors of ships, modules, and other items.

## 📊 Data Structure

### Main Tables

- **`dogma_attributes`**: All dogma attribute definitions (~2000 records)
- **`dogma_effects`**: All dogma effect definitions (~500 records)

### Junction Tables

- **`type_dogma_attributes`**: Type → Attribute relationship (which attributes each type has)
- **`type_dogma_effects`**: Type → Effect relationship (which effects each type has)

### Relationship Schema

```text
Type: Rifter (Ship)
│
├─ dogma_attributes[] (102 attributes)
│  ├─ { attribute_id: 4, value: 1053900 }  → Mass (1,053,900 kg)
│  ├─ { attribute_id: 38, value: 135 }     → Capacity (135 m³)
│  ├─ { attribute_id: 9, value: 1019 }     → Structure HP
│  └─ { attribute_id: 265, value: 1219 }   → Armor HP
│
└─ dogma_effects[] (5 effects)
   ├─ { effect_id: 511, is_default: false }
   ├─ { effect_id: 991, is_default: false }
   └─ { effect_id: 7018, is_default: false }
```

## 🎯 Enrichment Process (Correct Order)

To enrich Type Dogma data, a **3-step process** must be followed. This order is critical due to foreign key constraints.

### Step 1: Populate Dogma Attributes Table

Fetches main attribute definitions from ESI and saves them to the `dogma_attributes` table.

```bash
cd backend

# Queue all dogma attributes (~2000 attributes)
yarn queue:dogma-attributes

# Separate terminal - start worker
yarn worker:info:dogma-attributes
```

**Duration**: 5-10 minutes
**Operation**: ~2000 attribute definitions fetched from ESI

---

### Step 2: Populate Dogma Effects Table

Fetches main effect definitions from ESI and saves them to the `dogma_effects` table.

```bash
# After first worker completes
yarn queue:dogma-effects

# Separate terminal - start worker
yarn worker:info:dogma-effects
```

**Duration**: 5-10 minutes
**Operation**: ~500 effect definitions fetched from ESI

---

### Step 3: Populate Type Dogma Junction Tables

Scans existing Type records and fetches each Type's attributes and effects.

```bash
# After first two workers complete
yarn queue:type-dogma

# Separate terminal - start worker
yarn worker:type-dogma
```

**Duration**: 30-60 minutes (depending on Type count)
**Operation**: Dogma information fetched from ESI for each Type and saved to junction tables

---

## 🚀 Quick Start

To run the entire process in order:

```bash
# 1. Attributes (5-10 minutes)
yarn queue:dogma-attributes
# Separate terminal:
yarn worker:info:dogma-attributes

# 2. After worker completes - Effects (5-10 minutes)
yarn queue:dogma-effects
# Separate terminal:
yarn worker:info:dogma-effects

# 3. After worker completes - Type Junction (30-60 minutes)
yarn queue:type-dogma
# Separate terminal:
yarn worker:type-dogma
```

## 🔍 Worker Behaviors

### worker-type-dogma: Different Scenarios

#### Scenario 1: Both MISSING

```typescript
// ESI Response: { dogma_attributes: [], dogma_effects: [] }
```

**Behavior**: ✅ Skip - transaction not opened
**Log**: `(skipped)`

---

#### Scenario 2: Only Attributes PRESENT

```typescript
// ESI Response: { dogma_attributes: [...], dogma_effects: [] }
```

**Behavior**: ✅ Only attributes inserted
**Log**: `✓ [123] Rifter: 102/102 attrs, 0/0 effects`

---

#### Scenario 3: Only Effects PRESENT

```typescript
// ESI Response: { dogma_attributes: [], dogma_effects: [...] }
```

**Behavior**: ✅ Only effects inserted
**Log**: `✓ [123] Rifter: 0/0 attrs, 5/5 effects`

---

#### Scenario 4: Some Attribute/Effect MISSING from DB

```typescript
// ESI: attribute_id=99999 exists but not in dogma_attributes table
```

**Behavior**: ⚠️ Warning log + partial insert
**Log**:

```text
⚠️  [123] Rifter: 3 missing attributes: 99999, 99998, 99997
✓ [123] Rifter: 99/102 attrs, 5/5 effects
```

---

## 📋 Worker Features

### worker-type-dogma

**Queue**: `esi_type_dogma_queue`
**Concurrency**: 10 (PREFETCH_COUNT)
**Transaction**: ✅ Atomic (per Type)
**Foreign Key Validation**: ✅ Only inserts existing attributes/effects

**Improvements**:

- ✅ Atomicity with transactions (all or nothing)
- ✅ Foreign key validation (warning for missing attributes/effects)
- ✅ Batch logging (progress every 100 operations)
- ✅ Delete + Insert strategy (safe for re-sync)

**Code Flow**:

```typescript
1. Check if Type exists in DB
2. Check if already synced (skip)
3. Fetch Type details from ESI (including dogma info)
4. Skip if no attributes/effects
5. Start transaction:
   a. Delete old records (for re-sync)
   b. Attribute validation (exists in DB?)
   c. Effect validation (exists in DB?)
   d. Insert valid ones
6. Success log
```

---

## 🔧 Production Deployment

### Running with PM2

```bash
# Start workers with PM2 in production
pm2 start ecosystem.config.js --only worker-info-dogma-attributes
pm2 start ecosystem.config.js --only worker-info-dogma-effects
pm2 start ecosystem.config.js --only worker-type-dogma

# Watch logs
pm2 logs worker-type-dogma --lines 50
```

### Migration Deploy

```bash
cd /var/www/killreport/backend

# Git pull
git pull origin main

# Dependencies
yarn install

# Prisma generate (important!)
yarn prisma generate

# Migration deploy
yarn prisma migrate deploy

# PM2 restart
pm2 restart all
```

---

## 📊 Monitoring & Debugging

### Queue Status

```bash
# Check RabbitMQ queues
sudo rabbitmqctl list_queues name messages consumers

# Specific queue
sudo rabbitmqctl list_queues | grep dogma
```

### Worker Status

```bash
# PM2 status
pm2 status | grep dogma

# PM2 logs
pm2 logs worker-type-dogma --lines 100

# Error logs
pm2 logs worker-type-dogma --err
```

### Database Verification

```bash
# Check in Prisma Studio
cd backend
yarn prisma studio

# Check with SQL
SELECT COUNT(*) FROM dogma_attributes;
SELECT COUNT(*) FROM dogma_effects;
SELECT COUNT(*) FROM type_dogma_attributes;
SELECT COUNT(*) FROM type_dogma_effects;
```

---

## 🐛 Common Issues & Solutions

### Issue 1: `prismaWorker is undefined`

**Error**: `Cannot read properties of undefined (reading 'findUnique')`

**Solution**: Prisma Client not generated

```bash
yarn prisma generate
pm2 restart worker-type-dogma
```

---

### Issue 2: Foreign Key Constraint Violation

**Error**: `Foreign key constraint failed`

**Reason**: Main tables (dogma_attributes/dogma_effects) are empty

**Solution**: Run in correct order (Steps 1-2-3)

```bash
yarn queue:dogma-attributes && yarn worker:info:dogma-attributes
yarn queue:dogma-effects && yarn worker:info:dogma-effects
yarn queue:type-dogma && yarn worker:type-dogma
```

---

### Issue 3: ESI Rate Limit (429 Too Many Requests)

**Error**: `ESI rate limit exceeded`

**Solution**: Worker automatically retries, please wait

- Reduce worker's `PREFETCH_COUNT` value
- `esiRateLimiter.execute()` automatically enforces 50 req/sec limit

---

### Issue 4: Database Connection Pool Exhausted

**Error**: `Connection pool timeout`

**Solution**:

- Ensure `prisma-worker.ts` is being used (max: 2 connections)
- Don't run too many workers simultaneously
- DigitalOcean limit: 22 connections total

---

## 📖 GraphQL Query Example

Usage in frontend after enrichment is complete:

```graphql
query KillmailWithDogma($id: ID!) {
  killmail(id: $id) {
    victim {
      shipType {
        name
        # Ship's dogma properties
        dogmaAttributes {
          attribute_id
          value
          attribute {
            name
            display_name
            description
            unit_id
          }
        }
        # Ship's effects
        dogmaEffects {
          effect_id
          is_default
          effect {
            name
            display_name
            description
          }
        }
      }
    }
    items {
      itemType {
        name
        # Module properties
        dogmaAttributes {
          value
          attribute {
            name
            display_name
          }
        }
      }
    }
  }
}
```

---

## 🎓 Best Practices

1. **Sequential Execution**: Main tables first, then junction tables
2. **Use Transactions**: Always use transactions for atomic operations
3. **Foreign Key Validation**: Check before insert
4. **Monitoring**: Regularly monitor logs
5. **Re-sync**: Junction tables can be safely re-synced
6. **Rate Limiting**: Be mindful of ESI limits (50 req/sec max)

---

## 📚 Related Documentation

- **Dogma Services**: [`backend/src/services/dogma/README.MD`](../services/dogma/README.MD)
- **ESI Dogma Hierarchy**: [`ESI_DOGMA_HIERARCHY.MD`](ESI_DOGMA_HIERARCHY.MD)
- **Worker Documentation**: [`WORKER_DOCUMENTATION.MD`](WORKER_DOCUMENTATION.MD)
- **Database Schema**: [`backend/prisma/schema.prisma`](../../prisma/schema.prisma)

---

## 🔗 Useful Commands

```bash
# Queue commands
yarn queue:dogma-attributes
yarn queue:dogma-effects
yarn queue:type-dogma

# Worker commands
yarn worker:info:dogma-attributes
yarn worker:info:dogma-effects
yarn worker:type-dogma

# Database
yarn prisma studio
yarn prisma migrate deploy
yarn prisma generate

# Production
pm2 restart all
pm2 logs worker-type-dogma
sudo rabbitmqctl list_queues
```

---

**Last Updated**: January 7, 2026
**Version**: 1.0.0
