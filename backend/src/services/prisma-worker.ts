import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma configuration specifically for workers
// Workers need fewer connections than the main API server
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Local development (localhost) Postgres does not support SSL — disable it there.
// Remote Postgres keeps SSL enabled.
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

// Each worker process gets its own pool. Prefetched messages queue here for a
// connection after ESI answers, so the pool has to keep up with the ESI rate,
// or a deep prefetch waits past connectionTimeoutMillis. Idle connections are
// released, so only busy workers hold any: busy workers × MAX_CONNECTIONS
// plus the API's pool (prisma.ts) must stay under PostgreSQL's
// max_connections (default 100).
// Mirrored by backend-rs/crates/db/src/lib.rs.
const MAX_CONNECTIONS = 10;

const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : true, // Local: no SSL; remote: SSL enabled
  max: MAX_CONNECTIONS,
  min: 0, // No minimum - release all idle connections
  idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
  connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
  allowExitOnIdle: true, // Allow pool to completely drain
});

console.log(
  `✅ [worker] PostgreSQL pool configured: max=${MAX_CONNECTIONS} connections, min=0, idleTimeout=10s, pid=${process.pid}`,
);

// Monitor pool connections
pool.on('connect', () => {
  console.log(
    `🔌 [worker] pool connection opened - total: ${pool.totalCount}, idle: ${pool.idleCount}, waiting: ${pool.waitingCount}`,
  );
});

pool.on('remove', () => {
  console.log(
    `❌ [worker] pool connection closed - total: ${pool.totalCount}, idle: ${pool.idleCount}, waiting: ${pool.waitingCount}`,
  );
});

pool.on('error', (err) => {
  console.error('💥 [worker] pool error:', err.message);
});

const adapter = new PrismaPg(pool);

const prismaWorker = new PrismaClient({
  adapter,
  // Add query timeout to prevent hanging
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prismaWorker;
