import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma configuration specifically for workers
// Workers need fewer connections than the main API server
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

// Read CA certificate for DigitalOcean Managed PostgreSQL
const caCertPath = path.join(__dirname, '../../certs/ca-certificate.crt');
const ca = fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath).toString() : undefined;

// Configure pg Pool with SSL options using CA certificate
// WORKER-SPECIFIC CONFIGURATION
// DigitalOcean allows 22 connections total:
// - Backend API: 5 connections (reserved)
// - All Workers: Share remaining 17 connections
// - Each worker should use max 2-3 connections
const pool = new Pool({
    connectionString,
    ssl: ca
        ? {
            ca,
            rejectUnauthorized: true,
        }
        : true, // Use SSL without CA verification (for Prisma Studio compatibility)
    // CRITICAL: Worker pool settings - EMERGENCY MODE
    max: 1, // EMERGENCY: Only 1 connection per worker
    min: 0, // No minimum - release all idle connections
    idleTimeoutMillis: 2000, // Close idle clients after 2 seconds (very aggressive)
    connectionTimeoutMillis: 30000, // Wait up to 30 seconds for connection (increased for heavy load)
    allowExitOnIdle: true, // Allow pool to completely drain
});

console.log(`✅ [Worker] PostgreSQL pool configured: max=1 connection (EMERGENCY), min=0, idleTimeout=2s, pid=${process.pid}`);

// Monitor pool connections
pool.on('connect', () => {
    console.log(`🔌 [Worker] Pool connection opened - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
});

pool.on('remove', () => {
    console.log(`❌ [Worker] Pool connection closed - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
});

pool.on('error', (err) => {
    console.error('💥 [Worker] Pool error:', err.message);
});

const adapter = new PrismaPg(pool);

const prismaWorker = new PrismaClient({
    adapter,
    // Add query timeout to prevent hanging
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prismaWorker;
