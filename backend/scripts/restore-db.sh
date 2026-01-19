#!/bin/bash
set -e

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "❌ Usage: yarn db:restore <backup_file>"
  echo "Example: yarn db:restore db_backups/backup_20251208_120000.sql"
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
echo "🔄 Restoring with proper transaction handling..."

# Restore backup with proper error handling
# Use single transaction to ensure atomicity
psql $DATABASE_URL -v ON_ERROR_STOP=1 --single-transaction < $BACKUP_FILE

echo "✅ Database restored successfully with all foreign key constraints intact!"
