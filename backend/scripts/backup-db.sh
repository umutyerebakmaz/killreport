#!/bin/bash
set -e

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Create backup directory if it doesn't exist
mkdir -p db_backups

# Create backup (data only, no schema)
BACKUP_FILE="db_backups/backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $DB_URL --data-only --column-inserts > $BACKUP_FILE

echo "✅ Backup created: $BACKUP_FILE"
echo "💡 This is a data-only backup (no CREATE TABLE commands)"
