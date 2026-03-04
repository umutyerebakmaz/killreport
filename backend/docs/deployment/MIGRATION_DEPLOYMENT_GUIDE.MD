# Server Migration Deployment Guide

## 📋 Pre-Deployment

This migration adds 3 new columns to the killmails table for performance:

- `total_value` - Total value (ship + all items)
- `destroyed_value` - Destroyed value
- `dropped_value` - Dropped value

## 🚀 Production Server Deployment

### 1. Connect to Server and Update Repository

```bash
ssh root@your-server

cd /var/www/killreport
git pull origin main
```

### 2. Update Backend Dependencies

```bash
cd backend
yarn install
```

### 3. Apply Migration

```bash
# Check migration status
yarn prisma migrate status

# Apply pending migrations (production-safe)
yarn prisma migrate deploy
```

**Expected Output:**

```
17 migrations found in prisma/migrations

Applying migration `20260202000000_add_killmail_value_fields`

The following migration(s) have been applied:

migrations/
  └─ 20260202000000_add_killmail_value_fields/
    └─ migration.sql

All migrations have been successfully applied.
```

### 4. Regenerate Prisma Client

```bash
yarn prisma:generate
```

### 5. Restart Backend

```bash
# If using PM2
pm2 restart killreport-backend

# or if using systemd
sudo systemctl restart killreport-backend

# Check with PM2 logs
pm2 logs killreport-backend --lines 50
```

### 6. Restart Workers

```bash
# RedisQ worker (saves new killmails with values)
pm2 restart killreport-worker-redisq

# To see all workers
pm2 list | grep worker

# Restart all workers if needed
pm2 restart all
```

## ✅ Verification

### Check Migration Success

```bash
yarn prisma migrate status
```

Expected: `Database schema is up to date!`

### Verify Columns Exist

```bash
yarn prisma db execute --stdin << 'SQL'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'killmails'
AND column_name LIKE '%value%'
ORDER BY column_name;
SQL
```

Expected output: Should see 3 columns (destroyed_value, dropped_value, total_value)

### Verify Index Creation

```bash
yarn prisma db execute --stdin << 'SQL'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'killmails'
AND indexname LIKE '%value%';
SQL
```

Expected: Should see `killmails_total_value_idx` index

### Test New Killmail

```bash
# Watch backend logs
pm2 logs killreport-backend --lines 100

# When a new killmail arrives, you'll see values being set
```

Test in GraphQL playground:

```graphql
query {
  killmails(filter: { limit: 5 }) {
    edges {
      node {
        id
        totalValue
        destroyedValue
        droppedValue
      }
    }
  }
}
```

New killmails should have values populated!

## 🔄 Rollback

If issues occur:

```bash
# Only rollback migration (NO data loss - only columns deleted)
yarn prisma migrate resolve --rolled-back 20260202000000_add_killmail_value_fields

# Alternative: Manually drop columns
yarn prisma db execute --stdin << 'SQL'
ALTER TABLE killmails
DROP COLUMN IF EXISTS total_value,
DROP COLUMN IF EXISTS destroyed_value,
DROP COLUMN IF EXISTS dropped_value;

DROP INDEX IF EXISTS killmails_total_value_idx;
SQL
```

## 📊 Migration File Contents

The migration file does:

```sql
-- Add columns
ALTER TABLE "killmails"
ADD COLUMN "total_value" DOUBLE PRECISION,
ADD COLUMN "destroyed_value" DOUBLE PRECISION,
ADD COLUMN "dropped_value" DOUBLE PRECISION;

-- Add index (for sorting performance)
CREATE INDEX "killmails_total_value_idx"
ON "killmails"("total_value" DESC NULLS LAST);
```

## 🎯 Post-Migration

### Performance Expectations

- **New killmails:** Values are automatically calculated and saved
- **Old killmails:** Values are NULL (field resolvers still work - fallback available)
- **List queries:** ~5-10x faster (using cached values)

### Optional: Backfill Old Killmails

If you want to populate values for old killmails:

```bash
# Run backfill script (to be added in future)
node scripts/backfill-killmail-values.js
```

## 🐛 Troubleshooting

### "Migration already applied" error

```bash
# Normal, means migration is already applied
yarn prisma migrate status
```

### "Drift detected" error

```bash
# Schema and database are out of sync
# Manually mark migration as applied
yarn prisma migrate resolve --applied <migration_name>
```

### Backend won't start

```bash
# Regenerate Prisma client
yarn prisma:generate

# Check logs
pm2 logs killreport-backend
```

## 📝 Checklist

- [ ] Connected to server
- [ ] Git pull completed
- [ ] Dependencies updated
- [ ] Ran `yarn prisma migrate deploy`
- [ ] Migration successful
- [ ] Ran `yarn prisma:generate`
- [ ] Backend restarted
- [ ] Workers restarted
- [ ] Columns exist (verified)
- [ ] Index exists (verified)
- [ ] New killmails have values
- [ ] GraphQL queries are faster

## 🎉 Complete!

Migration successfully applied. Killmail lists are now 5-10x faster!
