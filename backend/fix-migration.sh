#!/bin/bash

# Advisory lock'u temizle ve migration'ı düzelt
echo "🔓 Releasing advisory locks..."

psql $DATABASE_URL << EOF
-- Release all advisory locks
SELECT pg_advisory_unlock_all();

-- Check if migration is stuck
SELECT migration_name, finished_at, started_at
FROM "_prisma_migrations"
WHERE migration_name = '20260304000000_add_security_fields_to_killmail_filters';

-- Mark as failed if stuck
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    logs = 'Manually marked as failed due to interrupted migration'
WHERE migration_name = '20260304000000_add_security_fields_to_killmail_filters'
AND finished_at IS NULL;

EOF

echo "✅ Lock released, attempting migration..."
npx prisma migrate deploy
