# Crontab Configuration - KillReport

## 📅 Scheduled Jobs

### Character & Corporation Sync Jobs

```bash
# Her Pazartesi 16:10'da - Tüm character'ları güncelleme kuyruğuna ekle
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1

# Her Pazartesi 17:00'da - Eksik corporation'ları tespit et ve kuyruğa ekle
0 17 * * 1 cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1
```

## 📖 Cron Format Açıklaması

```
┌───────────── Dakika (0 - 59)
│ ┌───────────── Saat (0 - 23)
│ │ ┌───────────── Ayın Günü (1 - 31)
│ │ │ ┌───────────── Ay (1 - 12)
│ │ │ │ ┌───────────── Haftanın Günü (0 - 6) (0=Pazar, 1=Pazartesi, 6=Cumartesi)
│ │ │ │ │
│ │ │ │ │
* * * * *  komut
```

### Örnek Zaman Formatları

```bash
# Her gün 03:00'da
0 3 * * *

# Her Pazartesi 16:10'da
10 16 * * 1

# Her Cuma 23:30'da
30 23 * * 5

# Her ayın 1'i saat 00:00'da
0 0 1 * *

# Her 6 saatte bir (00:00, 06:00, 12:00, 18:00)
0 */6 * * *

# Her 30 dakikada bir
*/30 * * * *

# Hafta içi her gün 09:00'da (Pazartesi-Cuma)
0 9 * * 1-5

# Hafta sonu her gün 10:00'da (Cumartesi-Pazar)
0 10 * * 6,0
```

## 🚀 Kurulum

### 1. Droplet'a SSH ile Bağlan

```bash
ssh root@your-droplet-ip
```

### 2. Crontab'ı Düzenle

```bash
crontab -e
```

### 3. Cron Job'ları Ekle

Yukarıdaki job'ları kopyala yapıştır ve kaydet (`:wq` veya `Ctrl+X` > `Y` > `Enter`)

### 4. Crontab'ı Kontrol Et

```bash
crontab -l
```

### 5. Cron Servisinin Çalıştığını Doğrula

```bash
systemctl status cron
# veya
service cron status
```

## 📊 Önerilen Cron Schedule

### Üretim Ortamı (Production)

```bash
# Character güncelleme - Haftada 1 kez (Pazartesi 16:10)
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1

# Corporation taraması - Haftada 1 kez (Pazartesi 17:00)
0 17 * * 1 cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1

# Log dosyalarını temizle - Her Pazar 02:00
0 2 * * 0 find /var/www/killreport/logs -name "*.log" -type f -mtime +30 -delete

# Database backup - Her gün 04:00
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1

# PM2 logs rotate - Her gün 05:00
0 5 * * * pm2 flush && pm2 reloadLogs
```

### Development/Test Ortamı

```bash
# Daha sık test için - Her gün 09:00
0 9 * * * cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1

# Her gün 10:00
0 10 * * * cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1
```

## 🔍 Monitoring ve Troubleshooting

### Cron Log'larını Kontrol Et

```bash
# System cron logs
tail -f /var/log/cron
# veya
tail -f /var/log/syslog | grep CRON

# Custom log dosyaları
tail -f /var/www/killreport/logs/queue-characters.log
tail -f /var/www/killreport/logs/queue-corporations.log
```

### Cron Job'ı Manuel Test Et

```bash
# Komutun tam halini terminalden çalıştır
cd /var/www/killreport/backend && yarn queue:characters
```

### Cron Job Çalışıyor mu Kontrol Et

```bash
# Son çalışan cron job'ları gör
grep CRON /var/log/syslog | tail -20
```

### Environment Variables Sorunu

Cron job'lar minimal environment ile çalışır. Eğer komut terminalden çalışıp cron'dan çalışmıyorsa:

```bash
# PATH ve diğer env var'ları crontab başına ekle
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_ENV=production

# Sonra job'ları ekle
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
```

### Yarn Command Bulunamıyor Hatası

```bash
# Yarn'ın tam path'ini bul
which yarn
# Örnek çıktı: /usr/bin/yarn

# Crontab'da tam path kullan
10 16 * * 1 cd /var/www/killreport/backend && /usr/bin/yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
```

## 🛡️ Best Practices

### 1. Log Dosyalarını Her Zaman Oluştur

```bash
# STDOUT ve STDERR'ı aynı dosyaya yönlendir
>> /path/to/logfile.log 2>&1

# Sadece hataları logla
2>> /path/to/error.log

# Hiçbir şey loglama (önerilmez)
> /dev/null 2>&1
```

### 2. Absolute Path Kullan

```bash
# ✅ Doğru
cd /var/www/killreport/backend && yarn queue:characters

# ❌ Yanlış (cron environment'ında çalışmayabilir)
cd ~/killreport/backend && yarn queue:characters
```

### 3. Lock File Kullan (Concurrent Execution Önleme)

```bash
# Aynı script'in aynı anda birden fazla çalışmasını önle
10 16 * * 1 flock -n /tmp/queue-characters.lock -c 'cd /var/www/killreport/backend && yarn queue:characters' >> /var/www/killreport/logs/queue-characters.log 2>&1
```

### 4. Email Notification (Opsiyonel)

```bash
# Crontab başına email adresi ekle
MAILTO=admin@yourdomain.com

# Job başarısız olursa email gelir
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters
```

### 5. Timeout Kullan

```bash
# 30 dakika sonra timeout olsun
10 16 * * 1 timeout 30m bash -c 'cd /var/www/killreport/backend && yarn queue:characters' >> /var/www/killreport/logs/queue-characters.log 2>&1
```

## 📈 Performans Considerations

### Character Queue Job

- **Süre:** ~2-5 dakika (93K character)
- **Memory:** ~100MB
- **Önerilen Sıklık:** Haftada 1-2 kez
- **Zamanı:** Düşük trafik saati (gece/hafta sonu)

### Corporation Queue Job

- **Süre:** ~1-3 dakika (1.4K corporation)
- **Memory:** ~80MB
- **Önerilen Sıklık:** Haftada 1 kez
- **Zamanı:** Character sync'den sonra

## 🔄 Güncelleme ve Maintenance

### Crontab'ı Yedekle

```bash
# Yedek al
crontab -l > ~/crontab-backup-$(date +%Y%m%d).txt

# Geri yükle
crontab ~/crontab-backup-20260105.txt
```

### Tüm Cron Job'ları Sil

```bash
crontab -r
```

### Belirli Kullanıcının Crontab'ını Düzenle

```bash
# Root kullanıcısı için
sudo crontab -u root -e

# Başka bir kullanıcı için
sudo crontab -u username -e
```

## 📝 Job Açıklamaları

### `yarn queue:characters`

- **Amaç:** Database'deki tüm character'ları ESI güncelleme kuyruğuna ekler
- **Etki:** worker:info:characters işleri alıp ESI'dan güncel bilgileri çeker
- **Beklenen Sonuç:** 93K+ character kuyruğa eklenir
- **İşlem Süresi:** ~2 dakika (queue ekleme), ~4-8 saat (worker processing)

### `yarn queue:character-corporations`

- **Amaç:** Character'larda eksik olan corporation'ları tespit edip kuyruğa ekler
- **Etki:** worker:info:corporations işleri alıp ESI'dan corporation bilgilerini çeker
- **Beklenen Sonuç:** ~1.4K eksik corporation bulunup kuyruğa eklenir
- **İşlem Süresi:** ~1 dakika (scan + queue), ~30-60 dakika (worker processing)

## 🎯 Sonuç

**Minimal Setup (Başlangıç):**

```bash
# Sadece haftalık sync
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
0 17 * * 1 cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1
```

**Üretim Setup (Tam Özellikli):**

```bash
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_ENV=production

# Weekly sync jobs
10 16 * * 1 cd /var/www/killreport/backend && /usr/bin/yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
0 17 * * 1 cd /var/www/killreport/backend && /usr/bin/yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1

# Daily maintenance
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1
0 2 * * 0 find /var/www/killreport/logs -name "*.log" -type f -mtime +30 -delete
0 5 * * * pm2 flush && pm2 reloadLogs
```
