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
        : {
            rejectUnauthorized: false,
        },
    // CRITICAL: Worker pool settings
    max: 2, // Maximum 2 connections per worker
    min: 0, // No minimum - release all idle connections
    idleTimeoutMillis: 3000, // Close idle clients after 3 seconds (aggressive)
    connectionTimeoutMillis: 2000, // Return error after 2 seconds
    allowExitOnIdle: true, // Allow pool to completely drain
});

console.log(`✅ [Worker] PostgreSQL pool configured: max=2 connections, min=0, idleTimeout=3s, pid=${process.pid}`);

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

const prismaWorker = new PrismaClient({ adapter });

export default prismaWorker;
