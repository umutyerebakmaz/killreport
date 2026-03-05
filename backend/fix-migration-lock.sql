-- Check current advisory locks
SELECT locktype, database, classid, objid, pid, mode, granted
FROM pg_locks
WHERE locktype = 'advisory';

-- Release the Prisma migration advisory lock (72707369)
SELECT pg_advisory_unlock_all();

-- Check migration status
SELECT * FROM "_prisma_migrations" 
ORDER BY started_at DESC 
LIMIT 5;
