import { config } from '@config/config';
import { Pool } from 'pg';

// Bu dosya artık kullanılmıyor - tüm DB işlemleri Prisma üzerinden yapılıyor
// Eğer pg Pool'a ihtiyaç duyarsanız şu şekilde kullanabilirsiniz:
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
