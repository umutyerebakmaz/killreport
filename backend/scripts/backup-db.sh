#!/bin/bash
set -e


# Use DATABASE_URL from argument if provided, else from .env
if [ -n "$1" ]; then
  DATABASE_URL="$1"
  echo "ℹ️  Using DATABASE_URL from command line argument."
else
  # Load environment variables from .env
  export $(grep -v '^#' .env | xargs)
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Pass as argument or set in .env."
    exit 1
  fi
  echo "ℹ️  Using DATABASE_URL from .env file."
fi



# Create backup directory in user home for cross-platform compatibility
BACKUP_DIR="$HOME/backups/killreport_db_backups"
mkdir -p "$BACKUP_DIR"


# Create plain SQL backup (no compression, no progress)
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"


echo "🔄 Creating transactional backup (plain SQL, no compression, no progress)..."


# Use pg_dump with serializable transaction to ensure consistency
pg_dump $DATABASE_URL \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --serializable-deferrable \
  > "$BACKUP_FILE"

echo "✅ Backup created: $BACKUP_FILE"
echo "💡 This is a transactional data-only backup (plain SQL)."
echo "⚠️  When restoring, use: psql \$DATABASE_URL < $BACKUP_FILE"
