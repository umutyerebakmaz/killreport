# KillReport - Production Ready zKillboard-Free Tracking ✅

## Özet

**EVET!** Projeniz production'a hazır ve zKillboard olmadan killmail tracking yapabilir!

## ✅ Nasıl Çalışır?

### 1. Kullanıcı Girişi

```
Kullanıcı → EVE SSO Login → Yetki Verir → Sistem:
  ✅ Character killmail'lerini sync eder (~100-150 killmail ilk sync)
  ✅ Corporation killmail'lerini sync eder (Director/CEO ise, ~2,500 killmail)
  ✅ Her 15 dakikada YENİ killmail'leri otomatik çeker
```

### 2. Otomatik Sync

- Login olduktan **1-2 dakika** içinde ilk data gelir
- Her **15 dakikada** bir otomatik sync (cron job)
- Kullanıcı hiçbir şey yapmaz, sistem otomatik çalışır
- Token süreleri otomatik yenilenir

### 3. Forward-Looking Data

```
Gün 1:   Login → Son 100 killmail
Gün 7:   +50-200 yeni killmail
Gün 30:  +200-800 yeni killmail
Gün 365: Login'den bu yana TÜM killmail'ler database'de!
```

## 🚀 Production Deployment

### Gerekli Servisler (Sürekli Çalışmalı)

```bash
# 1. GraphQL API Server
yarn dev  # veya production build

# 2. Character Killmail Worker (ZORUNLU)
yarn worker:user-killmails

# 3. Corporation Killmail Worker (Opsiyonel)
yarn worker:corporation-killmails

# 4. Enrichment Workers (Önerilen)
yarn worker:info:characters
yarn worker:info:corporations
yarn worker:info:alliances
yarn worker:info:types
```

### Cron Jobs (Her 15 Dakika)

```bash
# Tüm kullanıcıları queue'ya ekle
*/15 * * * * cd /path/to/backend && yarn queue:user-killmails
*/15 * * * * cd /path/to/backend && yarn queue:corporation-killmails
```

### PM2 Örneği

```bash
# ecosystem.config.js dosyası zaten root'ta var
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 📊 Kullanıcıya Gösterilecek Bilgiler

### Login Sonrası Mesaj

```
Hoş geldin!

✅ Hesabın aktif edildi
📊 İlk sync başladı (~100 killmail yükleniyor)
🔄 Yeni killmail'ler her 15 dakikada otomatik eklenecek

Not: Bugünden itibaren tüm killmail'lerin takip edilecek.
Daha eski killmail'ler için opsiyonel olarak zKillboard
import yapabilirsin (Ayarlar'dan).
```

### FAQ/Yardım Sayfası

```
S: Tüm killmail geçmişimi görebilir miyim?
C: Login'den sonraki TÜM killmail'ler takip edilir.
   Login öncesi ~100 killmail ESI'den gelir.
   Daha eski data için zKillboard import opsiyonu var.

S: Ne sıklıkla güncellenir?
C: Her 15 dakikada otomatik! Hiçbir şey yapman gerekmiyor.

S: zKillboard kullanmak zorunda mıyım?
C: Hayır! Direkt EVE API'den çekiyoruz. zKillboard sadece
   eski data için opsiyonel.

S: Corporation Director/CEO isem ne olur?
C: Tüm corporation killmail'lerini sync edebilirsin!
   (Profil ayarlarından aktif et)
```

## ⚠️ Önemli Limitler

### ESI API Limitleri

```
Character endpoint:  ~100-150 killmail (son 1 ay)
Corporation endpoint: ~2,500 killmail (son 1-2 ay)

Bu limitler sadece İLK SYNC için geçerli!
Sonraki sync'ler sadece YENİ killmail'leri çeker.
```

### Token Yönetimi

- Token süresi: 20 dakika
- Otomatik refresh: ✅ Evet
- Kullanıcı tekrar login: Sadece refresh token geçersiz olursa

## 🎯 Production Checklist

### Backend

- [ ] Environment variables set (.env)
- [ ] Database migrations run (prisma migrate deploy)
- [ ] Workers running (PM2/Docker/systemd)
- [ ] Cron jobs configured (15 dakika sync)
- [ ] Logs monitored (PM2 logs / CloudWatch)

### Frontend

- [ ] EVE_CALLBACK_URL doğru set edilmiş
- [ ] Login flow test edilmiş
- [ ] User feedback mesajları eklenmiş
- [ ] Loading states var (first sync)

### Infrastructure

- [ ] PostgreSQL (production grade)
- [ ] RabbitMQ (message broker)
- [ ] Redis (GraphQL subscriptions)
- [ ] SSL/HTTPS aktif
- [ ] Backup stratejisi var

## 📈 Beklenen Performans

### Tek Kullanıcı

```
İlk login: ~100 killmail, 1-2 dakika
1 hafta:   +50-200 killmail
1 ay:      +200-800 killmail
```

### 100 Kullanıcı

```
Database: ~10,000 killmail/hafta
Storage:  ~50MB/hafta (indexed)
API calls: ~600/saat (ESI rate limit: 150 req/sec)
```

### 1000 Kullanıcı

```
Database: ~100,000 killmail/hafta
Storage:  ~500MB/hafta
Workers:  2-3 user killmail worker instance önerilir
```

## 🔐 Güvenlik

- ✅ Tokens database'de encrypted (opsiyonel ama önerilen)
- ✅ HTTPS zorunlu production'da
- ✅ Rate limiting GraphQL API'de
- ✅ Token auto-refresh (kullanıcı müdahalesi yok)
- ✅ EVE SSO OAuth2 (güvenli authentication)

## 🎨 Kullanıcı Deneyimi

### İyi Yanlar

- ✅ Tek login, otomatik sync
- ✅ Real-time updates (15 dakika)
- ✅ Hiç manuel işlem yok
- ✅ GraphQL subscriptions (canlı feed)
- ✅ zKillboard'a bağımlılık yok

### Dikkat Edilmesi Gerekenler

- ⚠️ İlk sync sınırlı data (mesaj göster)
- ⚠️ Corporation sync için yetki gerekli (403 hata açıkla)
- ⚠️ Token expire durumunda re-login iste

## 📞 Destek & Troubleshooting

### Kullanıcı Login Yapamıyor

1. EVE_CLIENT_ID/SECRET doğru mu?
2. Callback URL doğru mu?
3. Scopes doğru mu? (`esi-killmails.read_killmails.v1`)

### Killmail'ler Gelmiyor

1. Worker çalışıyor mu? (`pm2 status`)
2. Queue'da mesaj var mı? (RabbitMQ UI)
3. Token expired mı? (database kontrol)

### 403 Corporation Hatası

- Kullanıcı Director/CEO değil
- Scope eksik (re-login gerekli)

## 🎉 Sonuç

**EVET, production'a hazırsınız!**

### Çalışan Özellikler

- ✅ Real-time killmail tracking (zKillboard'sız)
- ✅ Character killmails (tüm kullanıcılar)
- ✅ Corporation killmails (Directors/CEOs)
- ✅ Otomatik sync (15 dakika)
- ✅ Token yönetimi (otomatik refresh)
- ✅ Incremental sync (sadece yeni data)

### Opsiyonel Özellikler

- ⭐ zKillboard import (historical data için)
- ⭐ Alliance rollup (corp data → alliance)
- ⭐ Analytics & statistics (custom queries)

### Deployment

1. Workers'ı başlat (PM2)
2. Cron jobs kur (15 dakika)
3. Frontend deploy et
4. Kullanıcılara duyur!

**Kullanıcılar login olsun, sistem geri kalanını halleder! 🚀**
