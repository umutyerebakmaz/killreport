# Production Deployment - Alliance & Victim Foreign Key Fix

## Problem

- `executor_corporation_id` field was required but ESI API returns `null` for some alliances
- `victims` table foreign key to `killmails` was accidentally removed
- 35 orphaned victim records exist in production

## Solution

1. Make `executor_corporation_id` nullable in Alliance schema
2. Clean up orphaned victim records (no corresponding killmail)
3. Restore foreign key constraint on victims table

## Deployment Steps (Production Droplet)

### 1. SSH into Production Server

```bash
ssh root@your-droplet-ip
```

### 2. Pull Latest Changes

```bash
cd /root/killreport
git pull origin main
```

### 3. Run Automated Deployment Script

```bash
cd /root/killreport/backend
bash scripts/production-fix-deployment.sh
```

This script will:

- ✅ Stop all workers to prevent data corruption
- 💾 Backup database automatically
- 🧹 Clean 35 orphaned victim records
- 📦 Apply schema changes (make executor_corporation_id nullable + restore FK)
- 🔄 Regenerate Prisma client
- ▶️ Restart all workers
- 📊 Show worker status

### 4. Monitor Workers

```bash
# Watch logs in real-time
pm2 logs worker-alliances

# Check if workers are running without errors
pm2 list
```

### 5. Verify Alliance Worker

The alliance worker should now process alliances without errors, even when `executor_corporation_id` is null.

---

## Manual Steps (If Script Fails)

If the automated script fails, you can run commands manually:

```bash
# 1. Stop workers
pm2 stop worker-alliances worker-characters worker-corporations worker-types

# 2. Backup database
cd /root/killreport/backend
bash scripts/backup-db-fast.sh

# 3. Clean orphaned victims
npx tsx scripts/fix-victim-foreign-key.ts

# 4. Apply schema changes
yarn prisma db push --accept-data-loss

# 5. Regenerate Prisma client
yarn prisma:generate

# 6. Restart workers
pm2 restart all

# 7. Monitor
pm2 logs worker-alliances
```

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Stop all workers
pm2 stop all

# 2. Restore database from backup
cd /root/killreport/backend
bash scripts/restore-db-fast.sh <backup-file>

# 3. Checkout previous commit
cd /root/killreport
git checkout <previous-commit-hash>

# 4. Regenerate Prisma client
cd backend
yarn prisma:generate

# 5. Restart workers
pm2 restart all
```

---

## Expected Results

After deployment:

- ✅ Worker-alliances processes alliances without `executor_corporation_id` errors
- ✅ Victim records have proper foreign key constraint to killmails
- ✅ No orphaned victim records in database
- ✅ All workers running smoothly

---

## Files Changed

1. `backend/prisma/schema/alliance.prisma` - Made `executor_corporation_id` nullable
2. `backend/scripts/fix-victim-foreign-key.ts` - Script to clean orphaned victims
3. `backend/scripts/production-fix-deployment.sh` - Automated deployment script
