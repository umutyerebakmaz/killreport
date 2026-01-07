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
      rejectUnauthorized: true, // Verify the certificate (secure)
    }
    : true, // Use SSL without certificate verification (works but less secure)
  // CRITICAL: DigitalOcean allows 22 connections total
  // EMERGENCY: Reduced to minimum for connection pool exhaustion fix
  // Architecture:
  // - 1 Backend API server (max: 2 connections) - EMERGENCY MINIMUM
  // - Multiple workers can share remaining connections (20 total for workers)
  // - Aggressive idle timeout to release connections quickly
  max: 2, // EMERGENCY: Minimum 2 connections for API server
  min: 0, // No minimum - release idle connections ASAP
  idleTimeoutMillis: 5000, // Close idle clients after 5 seconds (very aggressive)
  connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
  allowExitOnIdle: false, // Keep pool alive for API server
});

console.log(`✅ PostgreSQL pool configured: max=2 connections (EMERGENCY), min=0, idleTimeout=5s, pid=${process.pid}`);

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
