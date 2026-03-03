# 🚀 Production Auth Callback Deployment Steps

## Status

- ✅ `/auth/callback` route added to frontend
- ⏳ Needs to be deployed to production

## Production Deployment Steps

### 1. Push Changes to Git

```bash
git add frontend/src/app/auth/callback/page.tsx
git commit -m "Add frontend /auth/callback route for EVE SSO"
git push origin main
```

### 2. Connect to Production Server

```bash
ssh root@YOUR_DROPLET_IP
# or
ssh YOUR_USER@YOUR_DOMAIN
```

### 3. Pull Code

```bash
cd /var/www/killreport
git pull origin main
```

### 4. Rebuild Frontend

```bash
cd frontend
yarn install  # If there are new dependencies
yarn build
```

### 5. Restart Frontend with PM2

```bash
pm2 restart frontend
# or restart all services
pm2 restart all
```

### 6. Check Environment Variables

Check backend `.env` file:

```bash
cd /var/www/killreport/backend
cat .env | grep EVE_CALLBACK
```

Should have these values:

```bash
EVE_CALLBACK_URL=https://killreport.com/auth/callback
FRONTEND_URL=https://killreport.com
```

Check frontend `.env.local` file:

```bash
cd /var/www/killreport/frontend
cat .env.local | grep BACKEND
```

Should have this value:

```bash
NEXT_PUBLIC_BACKEND_URL=https://api.killreport.com
```

### 7. Check EVE Developer Application

Go to <https://developers.eveonline.com/applications> and check callback URL:

**Callback URL should be:**

```
https://killreport.com/auth/callback
```

**OR for both environments:**

```
http://localhost:4000/auth/callback
https://killreport.com/auth/callback
```

### 8. Test

1. Open `https://killreport.com` in browser
2. Click "Login" button
3. Select your character in EVE SSO
4. Callback should succeed and redirect to `/killmails` page

### 9. Check Logs (If Error)

```bash
# Frontend logs
pm2 logs frontend --lines 50

# Backend logs
pm2 logs backend --lines 50

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## Alternative: Deploy Using PM2 Ecosystem

If you're using PM2 ecosystem file:

```bash
cd /var/www/killreport
git pull origin main
cd frontend
yarn build
cd ..
pm2 restart ecosystem.config.js --env production
```

## Troubleshooting

### 404 Still Persists

1. **Check if frontend built:**

```bash
ls -la /var/www/killreport/frontend/.next
```

2. **Is frontend running in PM2:**

```bash
pm2 list
pm2 info frontend
```

3. **Is frontend port correct:**

```bash
# Frontend port should be 3000 in ecosystem.config.js
cat ecosystem.config.js | grep -A 10 frontend
```

4. **Is Nginx proxying to frontend:**

```bash
# There should be nginx config for frontend (usually default Next.js standalone is used)
curl http://localhost:3000/auth/callback
```

### CORS Error

Check if frontend URL is added to CORS origin in backend `server.ts`:

```typescript
cors: {
  origin: [config.eveSso.frontendUrl, 'http://localhost:3000'],
  credentials: true,
}
```

### Environment Variables Not Loaded

If env vars not loaded after PM2 restart:

```bash
pm2 delete all
pm2 start ecosystem.config.js --env production
pm2 save
```

## Summary Commands (Quick Deploy)

```bash
# On server
cd /var/www/killreport
git pull origin main
cd frontend && yarn build && cd ..
pm2 restart frontend
pm2 logs frontend --lines 20
```

## Conclusion

After completing these steps, auth callback will work in production! 🎉
