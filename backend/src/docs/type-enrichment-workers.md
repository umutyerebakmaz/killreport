# Type Enrichment Workers - Complete Guide

## Overview

Bu dokümantasyon, EVE Online Type'larının Dogma bilgilerini (attributes ve effects) zenginleştirme sürecini açıklar. Dogma sistemi, gemilerin, modüllerin ve diğer item'ların özelliklerini ve davranışlarını tanımlar.

## 📊 Veri Yapısı

### Ana Tablolar

- **`dogma_attributes`**: Tüm dogma attribute tanımları (~2000 kayıt)
- **`dogma_effects`**: Tüm dogma effect tanımları (~500 kayıt)

### Junction Tablolar

- **`type_dogma_attributes`**: Type → Attribute ilişkisi (her type'ın hangi attribute'lara sahip olduğu)
- **`type_dogma_effects`**: Type → Effect ilişkisi (her type'ın hangi effect'lere sahip olduğu)

### İlişki Şeması

```text
Type: Rifter (Ship)
│
├─ dogma_attributes[] (102 attributes)
│  ├─ { attribute_id: 4, value: 1053900 }  → Mass (1,053,900 kg)
│  ├─ { attribute_id: 38, value: 135 }     → Capacity (135 m³)
│  ├─ { attribute_id: 9, value: 1019 }     → Structure HP
│  └─ { attribute_id: 265, value: 1219 }   → Armor HP
│
└─ dogma_effects[] (5 effects)
   ├─ { effect_id: 511, is_default: false }
   ├─ { effect_id: 991, is_default: false }
   └─ { effect_id: 7018, is_default: false }
```

## 🎯 Zenginleştirme Süreci (Doğru Sıralama)

Type Dogma verilerini zenginleştirmek için **3 adımlı bir süreç** izlenmelidir. Foreign key constraint'ler nedeniyle bu sıralama kritiktir.

### Adım 1: Dogma Attributes Tablosunu Doldur

Ana attribute tanımlarını ESI'dan çeker ve `dogma_attributes` tablosuna kaydeder.

```bash
cd backend

# Tüm dogma attribute'larını queue'ya ekle (~2000 attribute)
yarn queue:dogma-attributes

# Ayrı terminal - worker'ı başlat
yarn worker:info:dogma-attributes
```

**Süre**: 5-10 dakika
**İşlem**: ~2000 attribute tanımı ESI'dan çekilir

---

### Adım 2: Dogma Effects Tablosunu Doldur

Ana effect tanımlarını ESI'dan çeker ve `dogma_effects` tablosuna kaydeder.

```bash
# İlk worker bittikten sonra
yarn queue:dogma-effects

# Ayrı terminal - worker'ı başlat
yarn worker:info:dogma-effects
```

**Süre**: 5-10 dakika
**İşlem**: ~500 effect tanımı ESI'dan çekilir

---

### Adım 3: Type Dogma Junction Tablolarını Doldur

Mevcut Type kayıtlarını tarayıp her Type'ın attribute ve effect'lerini çeker.

```bash
# İlk iki worker bittikten sonra
yarn queue:type-dogma

# Ayrı terminal - worker'ı başlat
yarn worker:type-dogma
```

**Süre**: 30-60 dakika (Type sayısına bağlı)
**İşlem**: Her Type için ESI'dan dogma bilgileri çekilir ve junction tablolara kaydedilir

---

## 🚀 Hızlı Başlangıç

Tüm süreci sırayla çalıştırmak için:

```bash
# 1. Attributes (5-10 dakika)
yarn queue:dogma-attributes
# Ayrı terminal:
yarn worker:info:dogma-attributes

# 2. Worker bitince - Effects (5-10 dakika)
yarn queue:dogma-effects
# Ayrı terminal:
yarn worker:info:dogma-effects

# 3. Worker bitince - Type Junction (30-60 dakika)
yarn queue:type-dogma
# Ayrı terminal:
yarn worker:type-dogma
```

## 🔍 Worker Davranışları

### worker-type-dogma: Farklı Senaryolar

#### Senaryo 1: Her ikisi de YOK

```typescript
// ESI Response: { dogma_attributes: [], dogma_effects: [] }
```

**Davranış**: ✅ Skip - transaction açılmaz
**Log**: `(skipped)`

---

#### Senaryo 2: Sadece Attributes VAR

```typescript
// ESI Response: { dogma_attributes: [...], dogma_effects: [] }
```

**Davranış**: ✅ Sadece attribute'lar insert edilir
**Log**: `✓ [123] Rifter: 102/102 attrs, 0/0 effects`

---

#### Senaryo 3: Sadece Effects VAR

```typescript
// ESI Response: { dogma_attributes: [], dogma_effects: [...] }
```

**Davranış**: ✅ Sadece effect'ler insert edilir
**Log**: `✓ [123] Rifter: 0/0 attrs, 5/5 effects`

---

#### Senaryo 4: Bazı Attribute/Effect DB'de YOK

```typescript
// ESI: attribute_id=99999 var ama dogma_attributes tablosunda yok
```

**Davranış**: ⚠️ Warning log + partial insert
**Log**:

```text
⚠️  [123] Rifter: 3 missing attributes: 99999, 99998, 99997
✓ [123] Rifter: 99/102 attrs, 5/5 effects
```

---

## 📋 Worker Özellikleri

### worker-type-dogma

**Queue**: `esi_type_dogma_queue`
**Concurrency**: 10 (PREFETCH_COUNT)
**Transaction**: ✅ Atomic (her Type için)
**Foreign Key Validation**: ✅ Sadece var olan attribute/effect'leri insert eder

**İyileştirmeler**:

- ✅ Transaction ile atomicity (ya hepsi ya hiçbiri)
- ✅ Foreign key validation (eksik attribute/effect için warning)
- ✅ Batch logging (her 100 işlemde bir progress)
- ✅ Delete + Insert stratejisi (re-sync güvenli)

**Kod Akışı**:

```typescript
1. Type DB'de var mı kontrol et
2. Daha önce sync edilmiş mi kontrol et (skip)
3. ESI'dan Type detaylarını çek (dogma bilgileri dahil)
4. Attribute/effect yoksa skip
5. Transaction başlat:
   a. Eski kayıtları sil (re-sync için)
   b. Attribute validation (DB'de var mı?)
   c. Effect validation (DB'de var mı?)
   d. Valid olanları insert et
6. Success log
```

---

## 🔧 Production Deployment

### PM2 ile Çalıştırma

```bash
# Production'da PM2 ile worker'ları başlat
pm2 start ecosystem.config.js --only worker-info-dogma-attributes
pm2 start ecosystem.config.js --only worker-info-dogma-effects
pm2 start ecosystem.config.js --only worker-type-dogma

# Log'ları izle
pm2 logs worker-type-dogma --lines 50
```

### Migration Deploy

```bash
cd /var/www/killreport/backend

# Git pull
git pull origin main

# Dependencies
yarn install

# Prisma generate (önemli!)
yarn prisma generate

# Migration deploy
yarn prisma migrate deploy

# PM2 restart
pm2 restart all
```

---

## 📊 Monitoring & Debugging

### Queue Durumu

```bash
# RabbitMQ queue'ları kontrol et
sudo rabbitmqctl list_queues name messages consumers

# Specific queue
sudo rabbitmqctl list_queues | grep dogma
```

### Worker Status

```bash
# PM2 status
pm2 status | grep dogma

# PM2 logs
pm2 logs worker-type-dogma --lines 100

# Error logs
pm2 logs worker-type-dogma --err
```

### Database Verification

```bash
# Prisma Studio'da kontrol et
cd backend
yarn prisma studio

# SQL ile kontrol
SELECT COUNT(*) FROM dogma_attributes;
SELECT COUNT(*) FROM dogma_effects;
SELECT COUNT(*) FROM type_dogma_attributes;
SELECT COUNT(*) FROM type_dogma_effects;
```

---

## 🐛 Common Issues & Solutions

### Issue 1: `prismaWorker is undefined`

**Hata**: `Cannot read properties of undefined (reading 'findUnique')`

**Çözüm**: Prisma Client generate edilmemiş

```bash
yarn prisma generate
pm2 restart worker-type-dogma
```

---

### Issue 2: Foreign Key Constraint Violation

**Hata**: `Foreign key constraint failed`

**Neden**: Ana tablolar (dogma_attributes/dogma_effects) boş

**Çözüm**: Doğru sırayla çalıştır (Adım 1-2-3)

```bash
yarn queue:dogma-attributes && yarn worker:info:dogma-attributes
yarn queue:dogma-effects && yarn worker:info:dogma-effects
yarn queue:type-dogma && yarn worker:type-dogma
```

---

### Issue 3: ESI Rate Limit (429 Too Many Requests)

**Hata**: `ESI rate limit exceeded`

**Çözüm**: Worker otomatik retry yapar, bekleyin

- Worker'ın `PREFETCH_COUNT` değerini azaltın
- `esiRateLimiter.execute()` otomatik 50 req/sec limiti koyar

---

### Issue 4: Database Connection Pool Exhausted

**Hata**: `Connection pool timeout`

**Çözüm**:

- `prisma-worker.ts` kullanıldığından emin olun (max: 2 connections)
- Çok fazla worker aynı anda çalıştırmayın
- DigitalOcean limit: 22 connections total

---

## 📖 GraphQL Query Örneği

Zenginleştirme tamamlandıktan sonra frontend'de kullanım:

```graphql
query KillmailWithDogma($id: ID!) {
  killmail(id: $id) {
    victim {
      shipType {
        name
        # Geminin dogma özellikleri
        dogmaAttributes {
          attribute_id
          value
          attribute {
            name
            display_name
            description
            unit_id
          }
        }
        # Geminin effect'leri
        dogmaEffects {
          effect_id
          is_default
          effect {
            name
            display_name
            description
          }
        }
      }
    }
    items {
      itemType {
        name
        # Module özellikleri
        dogmaAttributes {
          value
          attribute {
            name
            display_name
          }
        }
      }
    }
  }
}
```

---

## 🎓 Best Practices

1. **Sıralı Çalıştırma**: Önce ana tablolar, sonra junction tablolar
2. **Transaction Kullanımı**: Atomic işlemler için her zaman transaction
3. **Foreign Key Validation**: Insert öncesi kontrol et
4. **Monitoring**: Log'ları düzenli takip et
5. **Re-sync**: Junction tablolar güvenli şekilde yeniden sync edilebilir
6. **Rate Limiting**: ESI limitlerine dikkat et (50 req/sec max)

---

## 📚 İlgili Dokümantasyon

- **Dogma Services**: [`backend/src/services/dogma/README.md`](../services/dogma/README.md)
- **ESI Dogma Hierarchy**: [`ESI_DOGMA_HIERARCHY.md`](ESI_DOGMA_HIERARCHY.md)
- **Worker Documentation**: [`worker-documentation.md`](worker-documentation.md)
- **Database Schema**: [`backend/prisma/schema.prisma`](../../prisma/schema.prisma)

---

## 🔗 Useful Commands

```bash
# Queue commands
yarn queue:dogma-attributes
yarn queue:dogma-effects
yarn queue:type-dogma

# Worker commands
yarn worker:info:dogma-attributes
yarn worker:info:dogma-effects
yarn worker:type-dogma

# Database
yarn prisma studio
yarn prisma migrate deploy
yarn prisma generate

# Production
pm2 restart all
pm2 logs worker-type-dogma
sudo rabbitmqctl list_queues
```

---

**Son Güncelleme**: 7 Ocak 2026
**Versiyon**: 1.0.0
