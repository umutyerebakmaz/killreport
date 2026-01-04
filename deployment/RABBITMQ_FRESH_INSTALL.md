# RabbitMQ Complete Reinstall & Reverse Proxy Setup Guide

## 🚀 Hızlı Çözüm: Otomatik Script (Önerilen)

Droplet'inizde şu komutu çalıştırın:

```bash
cd /var/www/killreport
sudo bash deployment/rabbitmq-fresh-install.sh
```

Script şunları yapar:

- ✅ RabbitMQ'yu tamamen kaldırır (config, data, logs dahil)
- ✅ En son versiyonu yükler
- ✅ Reverse proxy için doğru yapılandırır
- ✅ Admin kullanıcı oluşturur
- ✅ Test eder

**İşlem süresi:** ~5 dakika

---

## 📋 Manuel Kurulum (Adım Adım)

### Step 1: RabbitMQ'yu Tamamen Kaldır

```bash
# Service'i durdur
sudo systemctl stop rabbitmq-server
sudo systemctl disable rabbitmq-server

# Package'ı kaldır
sudo apt-get remove --purge -y rabbitmq-server
sudo apt-get autoremove -y

# Tüm config ve data dosyalarını sil
sudo rm -rf /etc/rabbitmq/
sudo rm -rf /var/lib/rabbitmq/
sudo rm -rf /var/log/rabbitmq/
sudo rm -rf /usr/lib/rabbitmq/
```

### Step 2: Repository'leri Güncelle

```bash
# Update package list
sudo apt-get update

# Install prerequisites
sudo apt-get install -y curl gnupg apt-transport-https
```

### Step 3: RabbitMQ Repository Ekle

```bash
# Add RabbitMQ signing key
curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" | \
  sudo gpg --dearmor | \
  sudo tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null

# Add RabbitMQ APT repository
sudo tee /etc/apt/sources.list.d/rabbitmq.list > /dev/null <<EOF
deb [signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-erlang/deb/ubuntu jammy main
deb [signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-server/deb/ubuntu jammy main
EOF

# Update package list
sudo apt-get update -y
```

### Step 4: Erlang ve RabbitMQ Yükle

```bash
# Install Erlang
sudo apt-get install -y erlang-base \
                        erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
                        erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
                        erlang-runtime-tools erlang-snmp erlang-ssl \
                        erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl

# Install RabbitMQ
sudo apt-get install -y rabbitmq-server
```

### Step 5: Reverse Proxy için Config Oluştur

**KRİTİK ADIM:** Bu adımı atlarsanız 404 hatası alırsınız!

```bash
# Config dosyası oluştur
sudo tee /etc/rabbitmq/rabbitmq.conf > /dev/null <<EOF
# Basic configuration
loopback_users.guest = false

# Management plugin configuration
management.tcp.port = 15672
management.tcp.ip = 127.0.0.1

# CRITICAL: Path prefix for reverse proxy
management.path_prefix = /rabbitmq

# Logging
log.file.level = info
log.console = true
EOF

# Doğru permissions ayarla
sudo chown rabbitmq:rabbitmq /etc/rabbitmq/rabbitmq.conf
sudo chmod 644 /etc/rabbitmq/rabbitmq.conf
```

### Step 6: RabbitMQ Başlat

```bash
# Enable and start service
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server

# Status kontrol
sudo systemctl status rabbitmq-server
```

### Step 7: Management Plugin Aktif Et

```bash
sudo rabbitmq-plugins enable rabbitmq_management
```

### Step 8: Admin Kullanıcı Oluştur

```bash
# Admin user oluştur (şifreyi değiştirin!)
sudo rabbitmqctl add_user admin YourSecurePassword123!
sudo rabbitmqctl set_user_tags admin administrator
sudo rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"

# Guest kullanıcıyı güvenlik için kaldır
sudo rabbitmqctl delete_user guest
```

### Step 9: RabbitMQ'yu Yeniden Başlat

```bash
sudo systemctl restart rabbitmq-server
```

### Step 10: Nginx'i Yeniden Yükle

```bash
# Nginx config test
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## ✅ Test Etme

### 1. Local API Test

```bash
curl -u admin:YourSecurePassword123! http://localhost:15672/api/overview
```

✅ JSON response gelirse: **Local API çalışıyor**

### 2. Reverse Proxy Test

```bash
curl -u admin:YourSecurePassword123! https://api.killreport.com/rabbitmq/api/overview
```

✅ JSON response gelirse: **Reverse proxy çalışıyor**

### 3. Browser Test

1. `https://api.killreport.com/rabbitmq/` adresine git
2. Admin credentials ile login ol
3. Bir queue'ya tıkla
4. "Get messages", "Delete", "Purge" butonlarına tıkla

✅ 404 hatası almazsanız: **Tamamen çalışıyor!**

### 4. Otomatik Test Script

```bash
cd /var/www/killreport
bash deployment/test-rabbitmq-proxy.sh
```

---

## 🔍 Sorun Giderme

### Problem: RabbitMQ başlamıyor

```bash
# Detailed logs
sudo journalctl -xeu rabbitmq-server.service --no-pager | tail -100

# Config syntax test
sudo rabbitmq-server -detached
```

**Çözüm:** Config dosyasında syntax hatası olabilir. `management.path_prefix = /rabbitmq` satırını kontrol edin (boşluklar, eşittir işareti).

### Problem: 404 hatası devam ediyor

1. **Browser cache temizle:**

   - Ctrl+Shift+Delete
   - Veya Incognito/Private mode dene

2. **Config dosyasını kontrol et:**

   ```bash
   cat /etc/rabbitmq/rabbitmq.conf | grep path_prefix
   ```

   Şu satırı görmelisiniz:

   ```
   management.path_prefix = /rabbitmq
   ```

3. **RabbitMQ log kontrol:**

   ```bash
   sudo tail -100 /var/log/rabbitmq/rabbit@*.log | grep path
   ```

   Şu satırı arayin:

   ```
   Management plugin configured with path prefix: /rabbitmq
   ```

### Problem: Login sonrası beyaz sayfa

**Sebep:** Browser cache veya RabbitMQ config yüklenmemiş.

**Çözüm:**

```bash
# RabbitMQ'yu tamamen yeniden başlat
sudo systemctl restart rabbitmq-server

# Browser'da:
# 1. Ctrl+Shift+Delete -> Cache temizle
# 2. Sayfayı yenile (Ctrl+F5)
# 3. Tekrar login ol
```

### Problem: Permission denied

```bash
# Config file permissions düzelt
sudo chown rabbitmq:rabbitmq /etc/rabbitmq/rabbitmq.conf
sudo chmod 644 /etc/rabbitmq/rabbitmq.conf

# Directory permissions
sudo chown -R rabbitmq:rabbitmq /var/lib/rabbitmq/
sudo chown -R rabbitmq:rabbitmq /var/log/rabbitmq/
```

---

## 📊 Nginx Config (Referans)

`/etc/nginx/sites-available/killreport-backend` dosyanız şu şekilde olmalı:

```nginx
location /rabbitmq {
    return 301 $scheme://$host/rabbitmq/;
}

location /rabbitmq/ {
    rewrite ^/rabbitmq/(.*) /$1 break;
    proxy_pass http://localhost:15672/;
    proxy_http_version 1.1;

    # Buffering ayarları
    proxy_buffering off;
    proxy_request_buffering off;

    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Standard headers
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # CRITICAL: Tell RabbitMQ about the prefix
    proxy_set_header X-Forwarded-Prefix /rabbitmq;

    # Timeouts
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
}
```

---

## 🔐 Güvenlik Önerileri

### 1. IP Whitelist (Önerilen)

```nginx
location /rabbitmq/ {
    # Only allow your IP
    allow YOUR_IP_ADDRESS;
    deny all;

    # ... rest of config
}
```

### 2. Strong Password

```bash
# Generate strong password
openssl rand -base64 16
```

### 3. Firewall (UFW)

```bash
# RabbitMQ portlarını sadece local'e aç
sudo ufw allow from 127.0.0.1 to any port 15672
sudo ufw allow from 127.0.0.1 to any port 5672
```

---

## 📚 Yararlı Komutlar

```bash
# Service status
sudo systemctl status rabbitmq-server

# Real-time logs
sudo journalctl -u rabbitmq-server -f

# List users
sudo rabbitmqctl list_users

# List queues
sudo rabbitmqctl list_queues

# List plugins
sudo rabbitmq-plugins list

# RabbitMQ version
sudo rabbitmqctl version

# Reset RabbitMQ (DANGER!)
sudo rabbitmqctl stop_app
sudo rabbitmqctl reset
sudo rabbitmqctl start_app
```

---

## 📞 Destek

Eğer sorun devam ederse:

1. **Log dosyasını paylaşın:**

   ```bash
   sudo journalctl -xeu rabbitmq-server.service --no-pager | tail -200 > rabbitmq-error.log
   ```

2. **Config dosyasını paylaşın:**

   ```bash
   cat /etc/rabbitmq/rabbitmq.conf
   ```

3. **Test script çıktısını paylaşın:**
   ```bash
   bash deployment/test-rabbitmq-proxy.sh
   ```
