-- Fix BigInt autoincrement for snapshot tables
-- AlreadyExecuted: These changes were applied manually before creating this migration

-- Reset alliance_snapshots sequence to prevent unique constraint errors
SELECT setval('alliance_snapshots_id_seq', COALESCE((SELECT MAX(id) FROM alliance_snapshots), 0) + 1, false);

-- Reset corporation_snapshots sequence to prevent unique constraint errors
SELECT setval('corporation_snapshots_id_seq', COALESCE((SELECT MAX(id) FROM corporation_snapshots), 0) + 1, false);

-- Note: This migration records the manual fix for Prisma 7 + PostgreSQL adapter
-- BigInt autoincrement issue where sequences became out of sync with actual data
