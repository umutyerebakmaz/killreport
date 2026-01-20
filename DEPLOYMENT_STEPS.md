# Rate Limiting Deployment Steps

## 1. Backend Güncellemesi

```bash
# Backend dizinine git
cd /root/killreport/backend

# Git pull (eğer repo kullanıyorsanız)
git pull origin main

# Veya dosyaları manuel kopyala
scp -r backend/src/plugins/rate-limit.plugin.ts root@api.killreport.com:/root/killreport/backend/src/plugins/
scp backend/src/server.ts root@api.killreport.com:/root/killreport/backend/src/

# PM2 ile restart
pm2 restart killreport-backend
pm2 logs killreport-backend --lines 50
```

## 2. Nginx Config Güncellemesi

```bash
# Nginx config'i güncelle
sudo nano /etc/nginx/sites-available/killreport-backend

# Aşağıdaki satırları /graphql location bloğuna ekle:
# (proxy_set_header satırlarından sonra, timeout satırlarından önce)

        # Pass rate limit headers from backend to client
        proxy_hide_header X-RateLimit-Limit;
        proxy_hide_header X-RateLimit-Remaining;
        proxy_hide_header X-RateLimit-Reset;
        add_header X-RateLimit-Limit $upstream_http_x_ratelimit_limit always;
        add_header X-RateLimit-Remaining $upstream_http_x_ratelimit_remaining always;
        add_header X-RateLimit-Reset $upstream_http_x_ratelimit_reset always;

# Nginx syntax check
sudo nginx -t

# Nginx reload
sudo systemctl reload nginx
```

## 3. Test

```bash
# Rate limit header'larını test et
curl -I https://api.killreport.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -i ratelimit

# Beklenen output:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1737393600000
```

## 4. Redis Kontrolü

```bash
# Redis'te rate limit key'lerini kontrol et
redis-cli keys "ratelimit:*"

# Belirli bir key'in değerini gör
redis-cli get "ratelimit:ip:YOUR_IP"

# TTL kontrolü
redis-cli ttl "ratelimit:ip:YOUR_IP"
```

## 5. Log Kontrolü

```bash
# Backend loglarında rate limit mesajlarını ara
pm2 logs killreport-backend | grep "Rate limit"

# Beklenen output:
# ✅ Rate limit: ip:123.45.67.89 (1/100)
# ✅ Rate limit: user:eyJhbGci (5/100)
```

## Troubleshooting

### Header'lar hala görünmüyor

1. Nginx config'in doğru location'da olduğunu kontrol et
2. `sudo nginx -t` ile syntax hatası yok mu kontrol et
3. `sudo systemctl reload nginx` ile reload yaptın mı?
4. Browser cache'i temizle (Ctrl+Shift+R)

### Rate limiting çalışmıyor

1. Redis bağlantısını kontrol et: `redis-cli ping`
2. Backend loglarında "Rate limit error" var mı?
3. PM2 restart sonrası hata var mı? `pm2 logs killreport-backend --err`

### Her zaman "Rate limit exceeded" alıyorum

1. Redis key'leri temizle: `redis-cli keys "ratelimit:*" | xargs redis-cli del`
2. Limit'i geçici olarak artır (server.ts: max: 1000)
