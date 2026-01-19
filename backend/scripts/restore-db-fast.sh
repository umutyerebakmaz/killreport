#!/bin/bash
set -e

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "❌ Usage: yarn db:restore:fast <backup_file>"
  echo "Example: yarn db:restore:fast db_backups/backup_20251208_120000.dump"
  exit 1
fi

BACKUP_FILE=$1

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

echo "⚠️  This will restore data from: $BACKUP_FILE"
echo "🔄 Restoring with parallel processing..."

# Restore using pg_restore with proper options
# --disable-triggers: Temporarily disable triggers for faster import
# --single-transaction: All-or-nothing restore
# -j 4: Use 4 parallel jobs (adjust based on CPU cores)
pg_restore -d $DATABASE_URL \
  --data-only \
  --disable-triggers \
  --single-transaction \
  --no-owner \
  --no-acl \
  -j 4 \
  -v \
  $BACKUP_FILE

echo "✅ Database restored successfully with all relations intact!"
