# KillReport Deployment

## Documentation

### Setup & Configuration

- [Digital Ocean Setup](/Users/umut/Sites/killreport/backend/docs/deployment/DIGITALOCEAN_SETUP.MD) - Initial server setup and configuration
- [Deployment Steps](/Users/umut/Sites/killreport/backend/docs/deployment/DEPLOYMENT_STEPS.MD) - Step-by-step deployment guide
- [Production Deployment](/Users/umut/Sites/killreport/backend/docs/deployment/PRODUCTION_DEPLOYMENT.MD) - Production environment setup
- [Production Deploy Steps](/Users/umut/Sites/killreport/backend/docs/deployment/PRODUCTION_DEPLOY_STEPS.MD) - Detailed deployment procedures
- [Production Ready](/Users/umut/Sites/killreport/backend/docs/deployment/PRODUCTION_READY.MD) - Production readiness checklist

### Planning & Migration

- [Cost Comparison](/Users/umut/Sites/killreport/backend/docs/deployment/COST_COMPARISON.MD) - Infrastructure cost analysis
- [Expenses](/Users/umut/Sites/killreport/backend/docs/deployment/EXPENSES.MD) - Monthly cost tracking (Jan-Mar 2026)
- [Deployment Checklist](/Users/umut/Sites/killreport/backend/docs/deployment/DEPLOYMENT_CHECKLIST.MD) - Pre-deployment verification
- [Migration Deployment Guide](/Users/umut/Sites/killreport/backend/docs/deployment/MIGRATION_DEPLOYMENT_GUIDE.MD) - Database migration procedures

## Quick Reference

### Deploy

```bash
cd /var/www/killreport
git pull origin main
yarn install
cd backend && yarn build
cd ../frontend && yarn build
pm2 restart all
```

### Monitor

```bash
pm2 monit           # Real-time monitoring
pm2 logs backend    # View logs
df -h               # Disk usage
```

### Emergency

```bash
pm2 restart all     # Restart all services
pm2 logs --err      # Check errors
pm2 flush           # Clear logs
```
