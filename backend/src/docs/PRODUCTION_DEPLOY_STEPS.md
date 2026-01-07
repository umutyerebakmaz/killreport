# 🚀 Production Auth Callback Deploy Adımları

## Durum
- ✅ Frontend'e `/auth/callback` route'u eklendi
- ⏳ Production'a deploy edilmesi gerekiyor

## Production Deploy Adımları

### 1. Değişiklikleri Git'e Push Et

```bash
git add frontend/src/app/auth/callback/page.tsx
git commit -m "Add frontend /auth/callback route for EVE SSO"
git push origin main
```

### 2. Production Server'a Bağlan

```bash
ssh root@YOUR_DROPLET_IP
# veya
ssh YOUR_USER@YOUR_DOMAIN
```

### 3. Kodu Pull Et

```bash
cd /var/www/killreport
git pull origin main
```

### 4. Frontend'i Rebuild Et

```bash
cd frontend
yarn install  # Yeni bağımlılık varsa
yarn build
```

### 5. PM2 ile Frontend'i Restart Et

```bash
pm2 restart frontend
# veya tüm servisleri restart et
pm2 restart all
```

### 6. Environment Variables Kontrol

Backend `.env` dosyasını kontrol et:
```bash
cd /var/www/killreport/backend
cat .env | grep EVE_CALLBACK
```

Şu değerler olmalı:
```bash
EVE_CALLBACK_URL=https://killreport.com/auth/callback
FRONTEND_URL=https://killreport.com
```

Frontend `.env.local` dosyasını kontrol et:
```bash
cd /var/www/killreport/frontend
cat .env.local | grep BACKEND
```

Şu değer olmalı:
```bash
NEXT_PUBLIC_BACKEND_URL=https://api.killreport.com
```

### 7. EVE Developer Application Kontrol

<https://developers.eveonline.com/applications> adresine git ve callback URL'i kontrol et:

**Callback URL şöyle olmalı:**
```
https://killreport.com/auth/callback
```

**VEYA her iki ortam için:**
```
http://localhost:4000/auth/callback
https://killreport.com/auth/callback
```

### 8. Test Et

1. Browser'da `https://killreport.com` aç
2. "Login" butonuna tıkla
3. EVE SSO'da karakterini seç
4. Callback başarılı olmalı ve `/killmails` sayfasına yönlendirmeli

### 9. Logs Kontrol (Hata Varsa)

```bash
# Frontend logs
pm2 logs frontend --lines 50

# Backend logs
pm2 logs backend --lines 50

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## Alternatif: PM2 Ecosystem Kullanarak Deploy

Eğer PM2 ecosystem file kullanıyorsanız:

```bash
cd /var/www/killreport
git pull origin main
cd frontend
yarn build
cd ..
pm2 restart ecosystem.config.js --env production
```

## Troubleshooting

### 404 Hala Devam Ediyorsa

1. **Frontend build oldu mu kontrol et:**
```bash
ls -la /var/www/killreport/frontend/.next
```

2. **PM2'de frontend çalışıyor mu:**
```bash
pm2 list
pm2 info frontend
```

3. **Frontend port'u doğru mu:**
```bash
# ecosystem.config.js'de frontend port 3000 olmalı
cat ecosystem.config.js | grep -A 10 frontend
```

4. **Nginx frontend'e proxy yapıyor mu:**
```bash
# Frontend için nginx config olmalı (genelde default Next.js standalone kullanılır)
curl http://localhost:3000/auth/callback
```

### CORS Hatası

Backend `server.ts`'de CORS origin'e frontend URL ekli mi kontrol et:
```typescript
cors: {
  origin: [config.eveSso.frontendUrl, 'http://localhost:3000'],
  credentials: true,
}
```

### Environment Variable Yüklenmedi

PM2'yi restart ettikten sonra env'ler yüklenmediyse:
```bash
pm2 delete all
pm2 start ecosystem.config.js --env production
pm2 save
```

## Özet Komutlar (Hızlı Deploy)

```bash
# Server'da
cd /var/www/killreport
git pull origin main
cd frontend && yarn build && cd ..
pm2 restart frontend
pm2 logs frontend --lines 20
```

## Sonuç

Bu adımları tamamladıktan sonra production'da auth callback çalışacak! 🎉
