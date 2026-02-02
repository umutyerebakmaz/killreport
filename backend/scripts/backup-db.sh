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


# Create compressed backup with progress indicator (gzip + pv)
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"


echo "🔄 Creating compressed transactional backup with progress (gzip + pv)..."


# Use pg_dump with serializable transaction to ensure consistency
# Pipe through pv for progress, then gzip for compression
pg_dump $DATABASE_URL \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --serializable-deferrable \
  | pv | gzip > "$BACKUP_FILE"

echo "✅ Backup created: $BACKUP_FILE"
echo "💡 This is a compressed, transactional data-only backup with progress indicator."
echo "⚠️  When restoring, use: gunzip -c $BACKUP_FILE | psql \$DATABASE_URL"
