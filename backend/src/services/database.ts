import { config } from '@config/config';
import { Pool } from 'pg';

// This file is no longer used - all DB access goes through Prisma
// If you need a pg Pool, you can use it like this:
// const pool = new Pool({ connectionString: config.database.url });

export const pool = new Pool({
  connectionString: config.database.url,
});

pool.on('connect', () => {
  console.log('connected to the database');
});

pool.on('error', (err) => {
  console.error('database connection error', err.stack);
});
