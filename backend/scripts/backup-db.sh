#!/bin/bash
set -e

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Create backup directory if it doesn't exist
mkdir -p db_backups

# Create backup
BACKUP_FILE="db_backups/backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $DATABASE_URL > $BACKUP_FILE

echo "✅ Backup created: $BACKUP_FILE"
