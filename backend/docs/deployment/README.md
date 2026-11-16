# KillReport Deployment

## Nginx site configs

Committed here and copied to `/etc/nginx/sites-available/` during deployment:

- [`killreport-backend`](killreport-backend) — API vhost, including the WebSocket upgrade headers
- [`rabbitmq`](rabbitmq) — RabbitMQ management UI vhost

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
sudo systemctl restart killreport.target
```

### Monitor

```bash
systemd-cgtop                       # Per-unit CPU and memory
journalctl -u killreport-backend -f # View logs
df -h                               # Disk usage
```

### Emergency

```bash
sudo systemctl restart killreport.target       # Restart all services
journalctl -u 'killreport-*' -p err -n 100     # Check errors
systemctl --failed                             # Units that exited non-zero
```
