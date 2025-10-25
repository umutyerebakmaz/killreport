# Alliance Sync - Basitleştirilmiş Workflow

## 🎯 Ne Yapar?

1. **ESI'den tüm alliance listesini alır**
2. **RabbitMQ queue'ya ekler**
3. **Worker queue'dan okur**
4. **Her alliance için:**
   - Veritabanında var mı kontrol eder
   - Yoksa ESI'den bilgilerini çeker
   - Veritabanına kaydeder
5. **Rate limite takılmadan çalışır**

## 🚀 Kullanım

### 1. Queue'ya Alliance Ekle

```bash
cd backend
npm run queue
```

Bu komut:

- ESI'den tüm alliance ID'lerini çeker (~4000+ alliance)
- RabbitMQ queue'ya ekler
- Çıkar

### 2. Worker Başlat

```bash
npm run worker
```

Bu komut:

- RabbitMQ'dan alliance ID'lerini okur
- Her birini kontrol eder (veritabanında var mı?)
- Yoksa ESI'den çeker ve kaydeder
- Rate limite dikkat eder (saniyede 10 istek)
- Ctrl+C ile durdurulana kadar çalışır

### 3. İlerlemeyi İzle

Worker çalışırken konsolda göreceksin:

```
✅ Saved alliance 1234567 - Test Alliance
⏭️  Alliance 7654321 already exists, skipping...
📥 Processing alliance 9999999...
```

### 4. Veritabanını Kontrol Et

```bash
npm run prisma:studio
```

Tarayıcıda `http://localhost:5555` açılır ve tablolarını görebilirsin.

## 📊 Workflow

```
ESI API → queue-alliances.ts → RabbitMQ Queue
                                     ↓
                            alliance-worker.ts
                                     ↓
                              PostgreSQL (Alliance tablosu)
```

## 🔧 Ayarlar

### Rate Limit

`alliance-worker.ts` dosyasında:

```typescript
const RATE_LIMIT_DELAY = 100; // 100ms = saniyede 10 istek
```

Daha yavaş yapmak için: `200` (saniyede 5 istek)
Daha hızlı yapmak için: `50` (saniyede 20 istek) - Dikkatli ol!

### Batch Size

`queue-alliances.ts` dosyasında:

```typescript
const BATCH_SIZE = 100; // Her seferde 100 alliance queue'ya ekle
```

## 📝 Notlar

- Worker aynı anda **1 mesaj** işler (prefetch=1)
- Veritabanında varsa **atlar** (gereksiz ESI isteği yapmaz)
- 404 (bulunamadı) hatalarını **görmezden gelir**
- 420 (error limit) hatalarında **60 saniye bekler**
- Ctrl+C ile **graceful shutdown** yapar
