import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const caCertPath = path.join(__dirname, 'certs/ca-certificate.crt');
const ca = fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath).toString() : undefined;

const pool = new Pool({
  connectionString,
  ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  max: 1,
});

async function checkConnections() {
  try {
    const result = await pool.query(`
      SELECT datname, usename, application_name, client_addr, state, query 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    console.log(`\n📊 Active Connections: ${result.rows.length}/22\n`);
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. App: ${row.application_name || 'unknown'} | State: ${row.state} | User: ${row.usename}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkConnections();
