module.exports = {
  apps: [
    // Backend GraphQL API
    {
      name: 'killreport-backend',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        LOG_LEVEL: 'debug',
        USE_REDIS_PUBSUB: 'true',
        REDIS_URL: 'redis://localhost:6379',
      },
      max_memory_restart: '1G',
      error_file: '/var/www/killreport/logs/backend-error.log',
      out_file: '/var/www/killreport/logs/backend-out.log',
      time: true,
    },

    // Frontend Next.js
    {
      name: 'killreport-frontend',
      cwd: '/var/www/killreport/frontend',
      script: 'yarn',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      error_file: '/var/www/killreport/logs/frontend-error.log',
      out_file: '/var/www/killreport/logs/frontend-out.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },

    // RedisQ Stream Worker (Real-time killmail ingestion)
    {
      name: 'worker-redisq',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:redisq',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      restart_delay: 5000,
      error_file: '/var/www/killreport/logs/worker-redisq-error.log',
      out_file: '/var/www/killreport/logs/worker-redisq-out.log',
      time: true,
    },

    // Alliance Info Worker (prefetch: 3)
    {
      name: 'worker-alliances',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:info:alliances',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-alliances-error.log',
      out_file: '/var/www/killreport/logs/worker-alliances-out.log',
      time: true,
    },

    // Corporation Info Worker (prefetch: 5)
    {
      name: 'worker-corporations',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:info:corporations',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-corporations-error.log',
      out_file: '/var/www/killreport/logs/worker-corporations-out.log',
      time: true,
    },

    // Alliance Corporations Discovery Worker (prefetch: 5)
    {
      name: 'worker-alliance-corporations',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:alliance-corporations',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-alliance-corporations-error.log',
      out_file: '/var/www/killreport/logs/worker-alliance-corporations-out.log',
      time: true,
    },

    // Type Info Worker (Ships, modules - prefetch: 10)
    {
      name: 'worker-types',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:info:types',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-types-error.log',
      out_file: '/var/www/killreport/logs/worker-types-out.log',
      time: true,
    },

    // zKillboard Character Sync Worker (prefetch: 1)
    {
      name: 'worker-zkillboard',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:zkillboard',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-zkillboard-error.log',
      out_file: '/var/www/killreport/logs/worker-zkillboard-out.log',
      time: true,
    },

    // User Killmail Worker - ESI Direct (prefetch: 1)
    {
      name: 'worker-user-killmails',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:user-killmails',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      restart_delay: 5000,
      error_file: '/var/www/killreport/logs/worker-user-killmails-error.log',
      out_file: '/var/www/killreport/logs/worker-user-killmails-out.log',
      time: true,
    },

    // Queue Characters - Monthly (1st of every month at 00:00 UTC)
    {
      name: 'queue-characters',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'queue:characters',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 0 1 * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/queue-characters-error.log',
      out_file: '/var/www/killreport/logs/queue-characters-out.log',
      time: true,
    },

    // Queue Alliances - Daily at 01:00 Turkey Time (22:00 UTC)
    {
      name: 'queue-alliances',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'queue:alliances',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 22 * * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/queue-alliances-error.log',
      out_file: '/var/www/killreport/logs/queue-alliances-out.log',
      time: true,
    },

    // Queue Alliance Corporations - Daily at 01:05 Turkey Time (22:05 UTC)
    {
      name: 'queue-alliance-corporations',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'queue:alliance-corporations',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '5 22 * * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/queue-alliance-corporations-error.log',
      out_file: '/var/www/killreport/logs/queue-alliance-corporations-out.log',
      time: true,
    },

    // Character Info Worker (High concurrency - prefetch: 10)
    {
      name: 'worker-characters',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:info:characters',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-characters-error.log',
      out_file: '/var/www/killreport/logs/worker-characters-out.log',
      time: true,
    },

    // Alliance Snapshot (Daily at 01:00 UTC)
    {
      name: 'snapshot-alliances',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'snapshot:alliances',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 1 * * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/snapshot-alliances-error.log',
      out_file: '/var/www/killreport/logs/snapshot-alliances-out.log',
      time: true,
    },

    // Update Alliance Counts (Daily at 01:00 UTC)
    {
      name: 'update-alliance-counts',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'update:alliance-counts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 1 * * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/update-alliance-counts-error.log',
      out_file: '/var/www/killreport/logs/update-alliance-counts-out.log',
      time: true,
    },

    // Corporation Snapshot (Daily at 01:00 UTC)
    {
      name: 'snapshot-corporations',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'snapshot:corporations',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 1 * * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/snapshot-corporations-error.log',
      out_file: '/var/www/killreport/logs/snapshot-corporations-out.log',
      time: true,
    },

    // Queue Prices - Daily at 09:00 Turkey Time (06:00 UTC)
    {
      name: 'queue-prices',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'queue:prices',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 6 * * *',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: '/var/www/killreport/logs/queue-prices-error.log',
      out_file: '/var/www/killreport/logs/queue-prices-out.log',
      time: true,
    },

    // Price Worker (prefetch: 10)
    {
      name: 'worker-prices',
      cwd: '/var/www/killreport/backend',
      script: 'yarn',
      args: 'worker:prices',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'debug',
      },
      max_memory_restart: '512M',
      autorestart: true,
      error_file: '/var/www/killreport/logs/worker-prices-error.log',
      out_file: '/var/www/killreport/logs/worker-prices-out.log',
      time: true,
    },
  ],
};
