import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Multiple schema files in schema directory
  schema: 'prisma/schema',

  // Migrations configuration
  migrations: {
    path: 'prisma/migrations',
  },

  // Database connection
  datasource: {
    url: env('DATABASE_URL'),
  },
});
