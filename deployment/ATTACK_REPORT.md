# SSH Saldırı Analiz Raporu - 04 Ocak 2026

## 🚨 DURUM: KRİTİK - Aktif Brute-Force Saldırısı Altındasınız

### Log Analizi

Gösterdiğiniz loglardan görünen:

**Saldırgan IP'ler:**

1. `167.99.216.215` - Çok sayıda "oracle" kullanıcı denemesi
2. `64.227.66.81` - "guest" ve "user" kullanıcı denemeleri

**Denenen Kullanıcı Adları:**

- `oracle` - En çok denenen (veritabanı sistemi varsayımı)
- `guest` - Yaygın default kullanıcı
- `user` - Genel kullanıcı adı

### 🔍 Bu Saldırının Özellikleri

#### Saldırı Türü: **Automated Dictionary Attack**

Bot'lar şunları yapıyor:

1. **Kullanıcı adı tarama** - Yaygın kullanıcı adlarını deniyor
2. **Port 22'yi hedef alıyor** - Standart SSH portu
3. **Periyodik denemeler** - Her 30-40 saniyede bir deneme
4. **Birden fazla IP** - Koordineli bot ağı (muhtemelen aynı saldırgan)

#### IP Analizi

**167.99.216.215:**

- DigitalOcean IP aralığı
- Muhtemelen başka bir hacklenmiş droplet
- "oracle" kullanıcısına odaklanmış

**64.227.66.81:**

- Yine DigitalOcean IP aralığı
- "guest" ve "user" deniyorlar
- Daha geniş kullanıcı listesi kullanıyor

### ⚠️ SİZİN SUNUCUNUZ NEDEN HEDEF?

1. **Port 22 açık** - Bot'lar tüm interneti 22. porta saldırıyor
2. **Root login muhtemelen aktif** - Varsayılan Ubuntu ayarı
3. **Fail2ban yok** - Saldırganlar sürekli deneyebiliyor
4. **Parola authentication aktif** - SSH key zorunluluğu yok

### 📊 Tehlike Seviyesi

```
┌─────────────────────────────────────────────┐
│ ⚠️  YÜKSEK RİSK                            │
├─────────────────────────────────────────────┤
│ • Günde binlerce deneme                     │
│ • Zayıf parolalar 24 saat içinde kırılabilir│
│ • Root erişimi ele geçirilebilir            │
│ • Tüm veri kaybı riski                      │
└─────────────────────────────────────────────┘
```

## 🛡️ HEMEN ALINMASI GEREKEN ÖNLEMLER

### 1. Acil Koruma (5 dakika)

```bash
# SSH portunu hemen değiştir
sudo nano /etc/ssh/sshd_config
# Port 22 satırını bul, değiştir:
Port 2222

# SSH'ı yeniden başlat
sudo systemctl restart sshd

# Yeni portu firewall'da aç
sudo ufw allow 2222/tcp
sudo ufw enable
```

**ÖNEMLİ:** Mevcut bağlantınızı AÇIK TUTUN! Yeni terminalde test edin:

```bash
ssh -p 2222 root@YOUR_IP
```

### 2. Root Login'i Kapat

```bash
sudo nano /etc/ssh/sshd_config
# Bu satırı bulup değiştir:
PermitRootLogin no
PasswordAuthentication no

sudo systemctl restart sshd
```

### 3. Fail2ban Kur (Otomatik Ban)

```bash
sudo apt update
sudo apt install fail2ban -y

# Yapılandır
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
findtime = 600
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Otomatik Hardening (ÖNERİLEN)

```bash
# Hazırladığım scripti çalıştır
cd /root/killreport
chmod +x deployment/security-hardening.sh
sudo ./deployment/security-hardening.sh
```

Bu script otomatik olarak:

- ✅ SSH portunu 2222'ye değiştirir
- ✅ Root login'i kapatır
- ✅ Fail2ban kurar ve yapılandırır
- ✅ UFW firewall kurar
- ✅ Otomatik güvenlik güncellemeleri açar
- ✅ Yeni admin kullanıcı oluşturur (killreport)
- ✅ SSH key-only authentication zorunlu kılar

## 📈 Saldırı İstatistikleri (Tahmini)

Sizin gibi bir droplet günde ortalama:

- **5,000-10,000** SSH brute-force denemesi
- **100-200** farklı IP'den saldırı
- **50-100** farklı kullanıcı adı denemesi

### Yaygın Denenen Kullanıcı Adları:

1. `root` (en çok)
2. `admin`
3. `ubuntu`
4. `user`
5. `guest`
6. `oracle`
7. `postgres`
8. `mysql`
9. `test`
10. `administrator`

## 🔐 Uzun Vadeli Öneriler

### A. SSH Key Authentication (Zorunlu)

```bash
# Yerel bilgisayarınızda
ssh-keygen -t ed25519 -C "killreport-admin"

# Public key'i sunucuya kopyala
ssh-copy-id -p 2222 root@YOUR_IP

# Sonra sunucuda password auth'u kapat
```

### B. IP Whitelist (Çok Güvenli)

Eğer sabit bir IP'den bağlanıyorsanız:

```bash
# Sadece sizin IP'niz SSH yapabilsin
sudo ufw delete allow 2222/tcp
sudo ufw allow from YOUR_HOME_IP to any port 2222 proto tcp
```

### C. VPN Kullanımı

En güvenli yöntem:

1. Sunucuya WireGuard VPN kur
2. SSH'ı sadece VPN interface'inde dinlet
3. SSH'ı public internet'ten tamamen kapat

### D. İzleme ve Alert

```bash
# Günlük rapor al
sudo grep "Failed password" /var/log/auth.log | tail -50

# Fail2ban durumunu kontrol et
sudo fail2ban-client status sshd

# Banned IP'leri gör
sudo fail2ban-client status sshd | grep "Banned IP"
```

## 📱 Monitoring Script (Opsiyonel)

Günlük saldırı raporunu mail olarak alın:

```bash
# Cron job ekle
crontab -e

# Her gün saat 09:00'da rapor
0 9 * * * /root/killreport/deployment/analyze-ssh-attacks.sh > /tmp/ssh-report.txt 2>&1
```

## ⚡ HEMEN YAPILMASI GEREKENLER

1. **[ACIL]** Security hardening script'ini çalıştır
2. **[ÖNEMLİ]** SSH port değişikliğini test et
3. **[ÖNEMLİ]** Fail2ban'in çalıştığını doğrula
4. **[ÖNEMLİ]** Root login'i kapat
5. **[ÖNERİLEN]** SSH key authentication'a geç

## 🔗 Kaynaklar

- Güvenlik scripti: `deployment/security-hardening.sh`
- Detaylı guide: `deployment/SECURITY.md`
- Analiz scripti: `deployment/analyze-ssh-attacks.sh`

---

## ❓ Sık Sorulan Sorular

**S: Sunucum zaten hacklenmiş olabilir mi?**
C: Şu an loglar sadece başarısız giriş gösteriyor. Ancak hemen önlem almazsan risk yüksek.

**S: Port değiştirmek gerçekten işe yarıyor mu?**
C: Evet! Bot'ların %95'i sadece port 22'yi tarar. Port değişikliği saldırıları %90+ azaltır.

**S: Fail2ban ne kadar etkili?**
C: Çok etkili. 3 başarısız denemeden sonra IP'yi 2 saat ban ediyor. Bot'lar başka hedeflere geçiyor.

**S: SSH key kullanmak zorunda mıyım?**
C: Production'da mutlaka. Parolalar kırılabilir, SSH key'ler neredeyse imkansız.

---

**Son Güncelleme:** 2026-01-04
**Aciliyet:** 🔴 KRİTİK - 24 Saat İçinde Aksiyon Alın
