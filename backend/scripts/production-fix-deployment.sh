#!/bin/bash

# Production Deployment Script for Alliance & Victim Fixes
# Run this on the DigitalOcean droplet

set -e  # Exit on error

echo "🚀 Starting production deployment..."
echo ""

# Stop workers first to prevent data corruption
echo "⏸️  Stopping workers..."
pm2 stop worker-alliances worker-characters worker-corporations worker-types || true
echo ""

# Backup database first (CRITICAL!)
echo "💾 Creating database backup..."
cd /root/killreport/backend
bash scripts/backup-db-fast.sh
echo ""

# Clean orphaned victim records
echo "🧹 Cleaning orphaned victim records..."
npx tsx scripts/fix-victim-foreign-key.ts
echo ""

# Apply schema changes
echo "📦 Applying schema changes..."
yarn prisma db push --accept-data-loss
echo ""

# Regenerate Prisma client
echo "🔄 Regenerating Prisma client..."
yarn prisma:generate
echo ""

# Restart workers
echo "▶️  Restarting workers..."
pm2 restart worker-alliances worker-characters worker-corporations worker-types
echo ""

# Show worker status
echo "📊 Worker status:"
pm2 list | grep worker
echo ""

echo "✅ Deployment completed successfully!"
echo ""
echo "Monitor workers with: pm2 logs"
