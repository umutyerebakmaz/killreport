#!/bin/bash
set -e

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Create backup directory if it doesn't exist
mkdir -p db_backups

# Create binary format backup (much faster, but not human-readable)
BACKUP_FILE="db_backups/backup_$(date +%Y%m%d_%H%M%S).dump"

echo "🔄 Creating binary format backup (faster)..."

# Use custom format (-Fc) for best compression and flexibility
# Includes proper transaction isolation
pg_dump $DATABASE_URL \
  -Fc \
  --data-only \
  --no-owner \
  --no-acl \
  --file=$BACKUP_FILE

echo "✅ Binary backup created: $BACKUP_FILE"
echo "💡 Restore with: pg_restore -d \$DATABASE_URL --data-only --disable-triggers $BACKUP_FILE"
echo "⚠️  Binary format is NOT human-readable but 10x faster"
