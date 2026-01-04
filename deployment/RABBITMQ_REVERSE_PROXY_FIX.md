# RabbitMQ Reverse Proxy 404 Hatası Çözümü

## Problem

`api.killreport.com/rabbitmq/` adresinden login olunabiliyor ama management arayüzündeki linkler (queue detayları, delete, clean vs.) 404 hatası veriyor.

## Sebep

RabbitMQ management plugin, reverse proxy arkasında `/rabbitmq/` prefix'i ile çalışırken kendi base path'ini bilmiyor. Bu yüzden JavaScript'teki API çağrıları yanlış URL'lere gidiyor.

## Çözüm

### 1. RabbitMQ Yapılandırması Güncelle

Droplet'inizde `/etc/rabbitmq/rabbitmq.conf` dosyasını düzenleyin:

```bash
sudo nano /etc/rabbitmq/rabbitmq.conf
```

Aşağıdaki satırları ekleyin/güncelleyin:

```conf
# Management plugin için
management.tcp.port = 15672
management.tcp.ip = 127.0.0.1

# Reverse proxy prefix (KRİTİK!)
management.path_prefix = /rabbitmq

# HTTP API için base path
management.http_log_dir = /var/log/rabbitmq
```

### 2. RabbitMQ'yu Yeniden Başlat

```bash
sudo systemctl restart rabbitmq-server
```

### 3. RabbitMQ Durumunu Kontrol Et

```bash
sudo systemctl status rabbitmq-server
sudo rabbitmq-plugins list
```

Management plugin'in aktif olduğundan emin olun:

```bash
sudo rabbitmq-plugins enable rabbitmq_management
```

### 4. Test Et

1. `https://api.killreport.com/rabbitmq/` adresine git
2. Login ol (guest/guest veya belirlediğiniz credentials)
3. Bir queue'ya tıkla
4. "Get messages", "Delete", "Purge" gibi butonlar çalışmalı

## Alternatif Çözüm (Eğer Yukarıdaki İşe Yaramazsa)

RabbitMQ'nun eski versiyonlarında `management.path_prefix` parametresi desteklenmeyebilir.

### Modern RabbitMQ Formatı (3.9+)

`/etc/rabbitmq/rabbitmq.conf`:

```conf
# Modern syntax
management.path_prefix = /rabbitmq
management.tcp.port = 15672
management.tcp.ip = 127.0.0.1
```

### Eski RabbitMQ Formatı (3.7-3.8)

`/etc/rabbitmq/rabbitmq.config` (Erlang formatı):

```erlang
[
  {rabbitmq_management, [
    {path_prefix, "/rabbitmq"},
    {listener, [{port, 15672}, {ip, "127.0.0.1"}]}
  ]}
].
```

## Nginx Config Değişikliği (İsteğe Bağlı İyileştirme)

Mevcut Nginx config'iniz zaten doğru (`X-Forwarded-Prefix` header'ı var). Ama ekstra güvenlik için:

```nginx
location /rabbitmq/ {
    rewrite ^/rabbitmq/(.*) /$1 break;
    proxy_pass http://localhost:15672/;

    # RabbitMQ'ya prefix'i söyle (KRİTİK!)
    proxy_set_header X-Forwarded-Prefix /rabbitmq;

    # Diğer ayarlar...
}
```

## Doğrulama

### 1. RabbitMQ Log Kontrolü

```bash
sudo tail -f /var/log/rabbitmq/rabbit@*.log
```

Şu satırı arayin:

```
Management plugin configured with path prefix: /rabbitmq
```

### 2. API Test

```bash
curl -u guest:guest https://api.killreport.com/rabbitmq/api/overview
```

JSON response dönmeli.

### 3. Browser Test

1. Browser DevTools'u aç (F12)
2. Network tab'inde API çağrılarına bak
3. URL'ler `/rabbitmq/api/...` formatında olmalı (sadece `/api/...` değil)

## Yaygın Hatalar

### Hata: RabbitMQ başlamıyor

```bash
# Config syntax hatası olabilir
sudo rabbitmq-server -detached
sudo tail -f /var/log/rabbitmq/rabbit@*.log
```

### Hata: 404 devam ediyor

1. Browser cache'i temizle (Ctrl+Shift+Delete)
2. Incognito/Private modda dene
3. RabbitMQ versiyonunu kontrol et: `sudo rabbitmqctl version`

## RabbitMQ Versiyon Kontrolü

```bash
sudo rabbitmqctl version
```

- **3.9+ ise**: `rabbitmq.conf` formatını kullan (yukarıdaki gibi)
- **3.7-3.8 ise**: `rabbitmq.config` Erlang formatını kullan
- **3.6 ve altı**: Manuel olarak management UI JavaScript'lerini patch etmek gerekebilir (önerilmez, upgrade yapın)

## Güvenlik Notları

Production'da:

```nginx
location /rabbitmq/ {
    # IP whitelist ekle
    allow YOUR_OFFICE_IP;
    allow YOUR_HOME_IP;
    deny all;

    # ... rest of config
}
```

veya temel auth ekle:

```nginx
location /rabbitmq/ {
    auth_basic "RabbitMQ Management";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # ... rest of config
}
```
