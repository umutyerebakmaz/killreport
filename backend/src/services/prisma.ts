import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma 7+ configuration with pg adapter and SSL support
// For DigitalOcean Managed PostgreSQL with CA certificate
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

// Read CA certificate for DigitalOcean Managed PostgreSQL
const caCertPath = path.join(__dirname, '../../certs/ca-certificate.crt');
const ca = fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath).toString() : undefined;

// Configure pg Pool with SSL options using CA certificate
const pool = new Pool({
    connectionString,
    ssl: ca
        ? {
            ca, // Use DigitalOcean's CA certificate
            rejectUnauthorized: true, // Verify the certificate
        }
        : {
            rejectUnauthorized: false, // Fallback if no CA cert (development only)
        },
    // CRITICAL: DigitalOcean allows 22 connections total
    // Architecture:
    // - 1 Backend API server (max: 5 connections)
    // - Multiple workers can share remaining connections (17 total for workers)
    // - Aggressive idle timeout to release connections quickly
    max: 5, // Maximum 5 connections for main API server
    min: 1, // Keep 1 connection alive
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
    allowExitOnIdle: false, // Keep pool alive for API server
});

console.log(`✅ PostgreSQL pool configured: max=5 connections, min=1, idleTimeout=30s, pid=${process.pid}`);

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
