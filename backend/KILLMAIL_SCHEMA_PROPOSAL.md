# Killmail Schema Normalization Proposal

## 🎯 Goals

1. Normalize killmail data structure
2. Preserve all ESI data (including items)
3. Improve query performance
4. Reduce write locks during bulk imports
5. Enable better analytics

## 📊 Current Problems

### 1. Missing Data

- **Items**: Victim's dropped/destroyed items not stored
- **Attacker faction_id**: Missing from schema

### 2. Denormalization

- Victim data embedded in Killmail table (8 columns)
- Makes victim-based queries inefficient

### 3. Performance Issues

- Large killmail inserts lock entire row
- Bulk import can block other operations
- No separation of hot/cold data

## 🏗️ Proposed Schema

```prisma
// Core killmail metadata (frequently queried)
model Killmail {
  killmailId      Int      @id @map("killmail_id")
  killmailHash    String   @map("killmail_hash")
  killmail_time   DateTime
  solar_system_id Int

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  victim    Victim?
  attackers Attacker[]
  items     KillmailItem[]

  @@index([killmail_time])
  @@index([solar_system_id])
  @@map("killmails")
}

// Victim information (separate table)
model Victim {
  killmail_id       Int     @id @map("killmail_id")
  character_id      Int?
  corporation_id    Int
  alliance_id       Int?
  faction_id        Int?
  ship_type_id      Int
  damage_taken      Int
  position_x        Float?
  position_y        Float?
  position_z        Float?

  created_at DateTime @default(now())

  killmail Killmail @relation(fields: [killmail_id], references: [killmailId], onDelete: Cascade)

  @@index([character_id])
  @@index([corporation_id])
  @@index([alliance_id])
  @@index([ship_type_id])
  @@map("victims")
}

// Attacker information (with faction_id added)
model Attacker {
  killmail_id     Int
  character_id    Int?
  corporation_id  Int?
  alliance_id     Int?
  faction_id      Int?     // ADDED: Missing field
  ship_type_id    Int?
  weapon_type_id  Int?
  damage_done     Int
  final_blow      Boolean
  security_status Float

  created_at DateTime @default(now())

  killmail Killmail @relation(fields: [killmail_id], references: [killmailId], onDelete: Cascade)

  // Handle cases where character_id might be null (NPC attackers)
  @@id([killmail_id, character_id])
  @@index([character_id])
  @@index([corporation_id])
  @@index([alliance_id])
  @@map("attackers")
}

// Items dropped/destroyed (NEW)
model KillmailItem {
  id              BigInt @id @default(autoincrement())
  killmail_id     Int
  item_type_id    Int
  flag            Int
  quantity_dropped   Int?
  quantity_destroyed Int?
  singleton       Int

  created_at DateTime @default(now())

  killmail Killmail @relation(fields: [killmail_id], references: [killmailId], onDelete: Cascade)

  @@index([killmail_id])
  @@index([item_type_id])
  @@map("killmail_items")
}
```

## 🚀 Benefits

### 1. Complete Data Storage

- **All items preserved**: Dropped and destroyed items tracked
- **Faction support**: Attacker faction_id now stored
- **Better analytics**: Can analyze loot values, ship fittings

### 2. Better Performance

- **Smaller main table**: Killmail table only has core metadata
- **Faster queries**: Dedicated indexes on victim/attacker tables
- **Parallel writes**: Items can be inserted separately (less locking)

### 3. Improved Queries

```typescript
// Find all victims flying specific ship
const victims = await prisma.victim.findMany({
  where: { ship_type_id: 12011 },
  include: { killmail: true },
});

// Find killmails with specific loot
const killmails = await prisma.killmail.findMany({
  where: {
    items: {
      some: { item_type_id: 28668 },
    },
  },
});

// Attacker statistics
const attackerStats = await prisma.attacker.groupBy({
  by: ["character_id"],
  _sum: { damage_done: true },
  _count: { killmail_id: true },
});
```

### 4. Reduced Write Locks

**Old approach** (single large transaction):

```typescript
// Locks entire killmail row + all attacker rows
await prisma.killmail.create({
  data: {
    // ... killmail + victim data (12+ fields)
    attackers: {
      create: [...33 attackers]  // 33 rows locked
    }
  }
});
```

**New approach** (can be parallelized):

```typescript
// Step 1: Insert core killmail (4 fields only)
const killmail = await prisma.killmail.create({
  data: { killmailId, killmailHash, killmail_time, solar_system_id },
});

// Step 2-4: Can run in parallel (separate transactions)
await Promise.all([
  prisma.victim.create({ data: victimData }),
  prisma.attacker.createMany({ data: attackersData }),
  prisma.killmailItem.createMany({ data: itemsData }),
]);
```

## 📈 Storage Impact

### Current Schema

- Killmail: ~200 bytes/row
- Attacker: ~80 bytes/row
- **Total for example**: 200 + (33 \* 80) = 2,840 bytes

### Proposed Schema

- Killmail: ~80 bytes/row (↓60%)
- Victim: ~100 bytes/row (new)
- Attacker: ~90 bytes/row (↑10% - faction_id added)
- Items: ~50 bytes/row (new)
- **Total for example**: 80 + 100 + (33 _ 90) + (40 _ 50) = 5,250 bytes

**~85% increase** but includes items data that was previously lost.

## 🔄 Migration Strategy

### Phase 1: Schema Migration

1. Create new tables (victims, killmail_items)
2. Add faction_id to attackers
3. Keep old killmail columns temporarily

### Phase 2: Data Migration

1. Migrate existing killmail victim data → victims table
2. Update worker to write to new schema

### Phase 3: Cleanup

1. Remove old victim\_\* columns from killmails
2. Update all queries/resolvers

### Phase 4: Backfill (optional)

1. Re-fetch killmail details for items data
2. Populate killmail_items table

## 🎯 Recommendation

**Implement this now** because:

1. ✅ You're early in development (easier to migrate)
2. ✅ Prevents data loss (items are valuable)
3. ✅ Better foundation for analytics
4. ✅ Aligns with ESI data structure
5. ✅ Professional normalization

**Performance concerns:**

- Write locks: Minimal impact (can use parallel writes)
- Read performance: Better (dedicated indexes)
- Worker speed: Negligible difference (network is bottleneck)

## 🔧 Worker Impact

The worker will need minimal changes:

- Split single `create()` into 3-4 operations
- Can use `createMany()` for bulk inserts
- Optional: Use transactions for consistency

**No significant performance penalty** because:

- ESI/zKill API calls are the bottleneck (100-200ms each)
- Database writes are fast (<5ms)
- Can parallelize victim/attacker/items inserts
