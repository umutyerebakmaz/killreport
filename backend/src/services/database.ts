import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool(config.database);

pool.on('connect', () => {
  console.log('Connected to the database');
});

pool.on('error', (err) => {
  console.error('Database connection error', err.stack);
});
