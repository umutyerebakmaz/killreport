# KillReport Deployment

## Documentation

### Setup & Configuration

- [Digital Ocean Setup](digitalocean-setup.md) - Initial server setup and configuration
- [Deployment Steps](deployment-steps.md) - Step-by-step deployment guide
- [Production Deployment](production-deployment.md) - Production environment setup
- [Production Deploy Steps](production-deploy-steps.md) - Detailed deployment procedures
- [Production Ready](production-ready.md) - Production readiness checklist

### Planning & Migration

- [Cost Comparison](cost-comparison.md) - Infrastructure cost analysis
- [Expenses](expenses.md) - Monthly cost tracking (Jan-Mar 2026)
- [Deployment Checklist](deployment-checklist.md) - Pre-deployment verification

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
