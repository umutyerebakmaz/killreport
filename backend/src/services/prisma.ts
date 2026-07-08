import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma 7+ configuration with pg adapter and SSL support
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Local development (localhost) Postgres does not support SSL — disable it there.
// Remote Postgres keeps SSL enabled.
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

// Configure pg Pool with SSL options
const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : true, // Local: no SSL; remote: SSL enabled
  // CRITICAL: DigitalOcean allows 22 connections total
  // Optimized connection pool distribution:
  // - Backend API: 5 connections (for parallel GraphQL queries)
  // - All Workers: 16 connections (8 workers × 2 connections)
  // - Total: 21 connections (1 connection buffer)
  max: 5, // API server needs more connections for parallel queries
  min: 1, // Keep 1 connection alive for fast response
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
  allowExitOnIdle: false, // Keep pool alive for API server
});

console.log(`✅ [API] PostgreSQL pool configured: max=5 connections, min=1, idleTimeout=30s, pid=${process.pid}`);

// Monitor pool connections
pool.on('connect', () => {
  console.log(`🔌 Pool connection opened - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
});

pool.on('remove', () => {
  console.log(`❌ Pool connection closed - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
});

pool.on('error', (err) => {
  console.error('💥 Pool error:', err.message);
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
