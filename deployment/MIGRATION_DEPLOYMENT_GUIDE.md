# Sunucu Migration Deployment Rehberi

## 📋 Ön Hazırlık

Bu migration killmails tablosuna performans için 3 yeni kolon ekler:

- `total_value` - Toplam değer (gemi + tüm itemlar)
- `destroyed_value` - Yok edilen değer
- `dropped_value` - Düşen değer

## 🚀 Production Sunucuda Deployment

### 1. Sunucuya Bağlan ve Repository'yi Güncelle

```bash
ssh root@your-server

cd /var/www/killreport
git pull origin main
```

### 2. Backend Dependencies'i Güncelle

```bash
cd backend
yarn install
```

### 3. Migration'ı Uygula

```bash
# Migration durumunu kontrol et
yarn prisma migrate status

# Bekleyen migration'ları uygula (production-safe)
yarn prisma migrate deploy
```

**Beklenen Çıktı:**

```
17 migrations found in prisma/migrations

Applying migration `20260202000000_add_killmail_value_fields`

The following migration(s) have been applied:

migrations/
  └─ 20260202000000_add_killmail_value_fields/
    └─ migration.sql

All migrations have been successfully applied.
```

### 4. Prisma Client'ı Regenerate Et

```bash
yarn prisma:generate
```

### 5. Backend'i Yeniden Başlat

```bash
# PM2 kullanıyorsanız
pm2 restart killreport-backend

# veya systemd kullanıyorsanız
sudo systemctl restart killreport-backend

# PM2 logs ile kontrol edin
pm2 logs killreport-backend --lines 50
```

### 6. Worker'ları Yeniden Başlat

```bash
# RedisQ worker (yeni killmail'leri value'larla kaydediyor)
pm2 restart killreport-worker-redisq

# Tüm worker'ları görmek için
pm2 list | grep worker

# Gerekirse tüm worker'ları restart et
pm2 restart all
```

## ✅ Doğrulama

### Migration'ın Başarılı Olduğunu Kontrol Et

```bash
yarn prisma migrate status
```

Beklenen: `Database schema is up to date!`

### Kolonların Var Olduğunu Kontrol Et

```bash
yarn prisma db execute --stdin << 'SQL'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'killmails'
AND column_name LIKE '%value%'
ORDER BY column_name;
SQL
```

Beklenen çıktı: 3 kolon görünmeli (destroyed_value, dropped_value, total_value)

### Index'in Oluştuğunu Kontrol Et

```bash
yarn prisma db execute --stdin << 'SQL'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'killmails'
AND indexname LIKE '%value%';
SQL
```

Beklenen: `killmails_total_value_idx` index'i görünmeli

### Yeni Killmail Test Et

```bash
# Backend loglarını izle
pm2 logs killreport-backend --lines 100

# Yeni bir killmail geldiğinde value'ların set edildiğini göreceksiniz
```

GraphQL playground'da test:

```graphql
query {
  killmails(filter: { limit: 5 }) {
    edges {
      node {
        id
        totalValue
        destroyedValue
        droppedValue
      }
    }
  }
}
```

Yeni killmail'lerde value'lar dolu olmalı!

## 🔄 Geri Alma (Rollback)

Eğer sorun çıkarsa:

```bash
# Sadece migration'ı geri al (veri kaybı YOK - sadece kolonlar silinir)
yarn prisma migrate resolve --rolled-back 20260202000000_add_killmail_value_fields

# Alternatif: Manuel olarak kolonları sil
yarn prisma db execute --stdin << 'SQL'
ALTER TABLE killmails
DROP COLUMN IF EXISTS total_value,
DROP COLUMN IF EXISTS destroyed_value,
DROP COLUMN IF EXISTS dropped_value;

DROP INDEX IF EXISTS killmails_total_value_idx;
SQL
```

## 📊 Migration Dosyası İçeriği

Migration dosyası şunu yapar:

```sql
-- Kolonları ekle
ALTER TABLE "killmails"
ADD COLUMN "total_value" DOUBLE PRECISION,
ADD COLUMN "destroyed_value" DOUBLE PRECISION,
ADD COLUMN "dropped_value" DOUBLE PRECISION;

-- Index ekle (sıralama performansı için)
CREATE INDEX "killmails_total_value_idx"
ON "killmails"("total_value" DESC NULLS LAST);
```

## 🎯 Migration Sonrası

### Performans Beklentileri

- **Yeni killmail'ler:** Value'lar otomatik hesaplanıp kaydediliyor
- **Eski killmail'ler:** Value'lar NULL (field resolver'lar hala çalışıyor - fallback var)
- **Liste sorguları:** ~5-10x daha hızlı (cached value'ları kullanıyor)

### Opsiyonel: Eski Killmail'leri Backfill Et

Eğer eski killmail'lerin de value'larını doldurmak isterseniz:

```bash
# Backfill script'i çalıştır (ileride eklenecek)
node scripts/backfill-killmail-values.js
```

## 🐛 Sorun Giderme

### "Migration already applied" hatası

```bash
# Normal, migration zaten uygulanmış demek
yarn prisma migrate status
```

### "Drift detected" hatası

```bash
# Schema ile database senkronizasyonu bozuk
# Migration'ı manuel mark et
yarn prisma migrate resolve --applied <migration_name>
```

### Backend başlamıyor

```bash
# Prisma client'ı regenerate et
yarn prisma:generate

# Logs kontrol et
pm2 logs killreport-backend
```

## 📝 Checklist

- [ ] Sunucuya bağlandım
- [ ] Git pull yaptım
- [ ] Dependencies güncel
- [ ] `yarn prisma migrate deploy` çalıştırdım
- [ ] Migration başarılı oldu
- [ ] `yarn prisma:generate` çalıştırdım
- [ ] Backend'i restart ettim
- [ ] Worker'ları restart ettim
- [ ] Kolonlar var (doğruladım)
- [ ] Index var (doğruladım)
- [ ] Yeni killmail'lerde value'lar geliyor
- [ ] GraphQL query'ler hızlandı

## 🎉 Tamamlandı!

Migration başarıyla uygulandı. Artık killmail listeleri 5-10x daha hızlı!
