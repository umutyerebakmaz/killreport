import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    // Main schema location
    schema: 'prisma/schema.prisma',

    // Migrations configuration
    migrations: {
        path: 'prisma/migrations',
    },

    // Database connection
    datasource: {
        url: env('DATABASE_URL'),
    },
});
