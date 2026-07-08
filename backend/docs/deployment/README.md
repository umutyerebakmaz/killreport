# KillReport Deployment

## Documentation

### Setup & Configuration

- [Digital Ocean Setup](digitalocean-setup.md) - Initial server setup and configuration
- [Production Deployment](production-deployment.md) - Production environment setup
- [Production Ready](production-ready.md) - Production readiness checklist
- [Auth Callback Deployment](auth-callback-deployment.md) - Deploy the EVE SSO auth callback
- [Rate Limiting Deployment](rate-limiting-deployment.md) - Deploy rate limiting + Nginx config

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
