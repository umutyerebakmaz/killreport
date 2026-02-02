#!/bin/bash
set -e

# Load environment variables
export $(grep -v '^#' .env | xargs)



# Create backup directory in user home for cross-platform compatibility
BACKUP_DIR="$HOME/backups/killreport_db_backups"
mkdir -p "$BACKUP_DIR"

# Create backup with proper transaction isolation and serializable snapshot
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

echo "🔄 Creating transactional backup with proper dependency order..."

# Use pg_dump with serializable transaction to ensure consistency
# --disable-triggers will be added in restore, not backup
# --no-owner --no-acl for portability
pg_dump $DATABASE_URL \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --serializable-deferrable \
  > $BACKUP_FILE

echo "✅ Backup created: $BACKUP_FILE"
echo "💡 This is a transactional data-only backup with proper ordering"
echo "⚠️  When restoring, use: psql \$DATABASE_URL < $BACKUP_FILE"
