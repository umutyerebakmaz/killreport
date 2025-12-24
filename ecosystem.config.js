module.exports = {
    apps: [
        // Backend GraphQL API
        {
            name: 'backend',
            cwd: './backend',
            script: 'dist/server.js',
            instances: 1,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 4000,
            },
            max_memory_restart: '1G',
            error_file: './logs/backend-error.log',
            out_file: './logs/backend-out.log',
            time: true,
        },

        // Frontend Next.js
        {
            name: 'frontend',
            cwd: './frontend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start -p 3000',
            instances: 1,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            max_memory_restart: '1G',
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            time: true,
        },

        // RedisQ Stream Worker (Real-time killmail ingestion)
        {
            name: 'worker-redisq',
            cwd: './backend',
            script: 'dist/workers/worker-redisq-stream.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            restart_delay: 5000,
            error_file: './logs/worker-redisq-error.log',
            out_file: './logs/worker-redisq-out.log',
            time: true,
        },

        // Character Info Worker (High concurrency)
        {
            name: 'worker-characters',
            cwd: './backend',
            script: 'dist/workers/worker-info-characters.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            error_file: './logs/worker-characters-error.log',
            out_file: './logs/worker-characters-out.log',
            time: true,
        },

        // Corporation Info Worker
        {
            name: 'worker-corporations',
            cwd: './backend',
            script: 'dist/workers/worker-info-corporations.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            error_file: './logs/worker-corporations-error.log',
            out_file: './logs/worker-corporations-out.log',
            time: true,
        },

        // Alliance Info Worker
        {
            name: 'worker-alliances',
            cwd: './backend',
            script: 'dist/workers/worker-info-alliances.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            error_file: './logs/worker-alliances-error.log',
            out_file: './logs/worker-alliances-out.log',
            time: true,
        },

        // Type Info Worker (Ships, modules, etc.)
        {
            name: 'worker-types',
            cwd: './backend',
            script: 'dist/workers/worker-info-types.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            error_file: './logs/worker-types-error.log',
            out_file: './logs/worker-types-out.log',
            time: true,
        },

        // zKillboard Character Sync Worker (Low priority)
        {
            name: 'worker-zkillboard',
            cwd: './backend',
            script: 'dist/workers/worker-zkillboard-character.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            error_file: './logs/worker-zkillboard-error.log',
            out_file: './logs/worker-zkillboard-out.log',
            time: true,
        },

        // ESI User Killmails Worker (For logged-in users, no zKillboard dependency)
        {
            name: 'worker-user-killmails',
            cwd: './backend',
            script: 'dist/workers/worker-esi-user-killmails.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            error_file: './logs/worker-user-killmails-error.log',
            out_file: './logs/worker-user-killmails-out.log',
            time: true,
        },

        // Bulk Alliance Sync Worker (Runs periodically)
        {
            name: 'worker-bulk-alliances',
            cwd: './backend',
            script: 'dist/workers/worker-alliances.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: false, // Manuel başlat/durdur
            error_file: './logs/worker-bulk-alliances-error.log',
            out_file: './logs/worker-bulk-alliances-out.log',
            time: true,
        },

        // Bulk Corporation Sync Worker (Runs periodically)
        {
            name: 'worker-bulk-corporations',
            cwd: './backend',
            script: 'dist/workers/worker-corporations.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: false, // Manuel başlat/durdur
            error_file: './logs/worker-bulk-corporations-error.log',
            out_file: './logs/worker-bulk-corporations-out.log',
            time: true,
        },
    ],
};
