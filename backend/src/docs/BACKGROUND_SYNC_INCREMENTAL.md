# Background Sync & Incremental Optimization

## Overview

Bu döküman, **otomatik arka plan senkronizasyonu** ve **incremental sync optimizasyonu** özelliklerini açıklar.

## 🕐 Background Cron Job (10 Dakikalık Otomatik Sync)

### Özellikler

- ✅ **Otomatik çalışma**: Sunucu başladığında otomatik başlar
- ✅ **10 dakikalık interval**: Her 10 dakikada bir çalışır
- ✅ **Akıllı filtreleme**: Sadece 15+ dakika önce sync edilmemiş kullanıcılar
- ✅ **Düşük öncelik**: Background sync mesajları düşük öncelikle queue'ya eklenir (priority: 3)
- ✅ **Concurrent-safe**: Aynı anda birden fazla çalışma önlenir

### Nasıl Çalışır?

```
Server starts → Cron başlatılır → Her 10 dakikada bir:
  1. Aktif kullanıcıları bul (geçerli token + 15+ dakika önce sync)
  2. Queue'ya ekle (priority: 3)
  3. Worker otomatik işler
```

### Kullanım

Sunucu başladığında **otomatik olarak** başlar:

```bash
cd backend
yarn dev  # veya production'da: node dist/server.js
```

Console output:

```
🚀 Server is running on http://localhost:4000/graphql
...
🕐 Starting user killmail background sync...
   📅 Interval: Every 10 minutes
   📦 Queue: esi_user_killmails_queue

✅ User killmail cron started
```

Her çalışmada:

```
──────────────────────────────────────────────────────────────────────
🕐 [25.12.2025 14:30:00] Running background sync...
──────────────────────────────────────────────────────────────────────
   📊 Found 3 user(s) to sync
   ⏳ John Doe (last: 20m ago)
   ⏳ Jane Smith (never)
   ⏳ Bob Wilson (last: 45m ago)

   ✅ Queued 3 user(s) in 125ms
──────────────────────────────────────────────────────────────────────
```

### Kod Yapısı

**Servis:** `/backend/src/services/user-killmail-cron.ts`

```typescript
export class UserKillmailCron {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    /* Başlat */
  }
  stop() {
    /* Durdur */
  }
  private async syncUsers() {
    /* Sync işlemi */
  }
  getStatus() {
    /* Durum bilgisi */
  }
}

export const userKillmailCron = new UserKillmailCron();
```

**Entegrasyon:** `/backend/src/server.ts`

```typescript
import { userKillmailCron } from "./services/user-killmail-cron";

server.listen(port, () => {
  // ...
  userKillmailCron.start().catch((error) => {
    console.error("❌ Failed to start user killmail cron:", error);
  });
});
```

## 🚀 Incremental Sync Optimization

### Problem

Önceden her sync'te:

- **50 sayfa** (2500 killmail) fetch ediliyordu
- **Her sayfa için API call** yapılıyordu
- **Zaten var olan killmail'ler** tekrar tekrar işleniyordu
- **Gereksiz ESI rate limit** kullanımı

### Çözüm: Incremental Sync

ESI API killmail'leri **reverse chronological order** (en yeni → en eski) döndürür. Bu özelliği kullanarak:

1. **Son sync'teki killmail ID'yi** kaydet (`last_killmail_id`)
2. **Yeni sync'te** bu ID'yi gör görmez **dur**
3. **Sadece yeni killmail'leri** al

### Performans İyileştirmesi

| Senaryo                            | Öncesi   | Sonrası   | İyileştirme         |
| ---------------------------------- | -------- | --------- | ------------------- |
| **İlk sync**                       | 50 sayfa | 50 sayfa  | Aynı                |
| **15 dakika sonra (1-2 killmail)** | 50 sayfa | 1 sayfa   | **50x daha hızlı**  |
| **Günlük (5-10 killmail)**         | 50 sayfa | 1 sayfa   | **50x daha hızlı**  |
| **Haftalık (50+ killmail)**        | 50 sayfa | 2-3 sayfa | **~20x daha hızlı** |

### Nasıl Çalışır?

#### 1. Database Schema

```prisma
model User {
  // ...
  last_killmail_id       Int?      // En son senkronize edilen killmail ID
  last_killmail_sync_at  DateTime? // Son sync zamanı

  @@index([last_killmail_id])
  @@index([last_killmail_sync_at])
}
```

#### 2. Queue Message

```typescript
interface UserKillmailMessage {
  userId: number;
  characterId: number;
  // ...
  lastKillmailId?: number; // 🔥 Yeni field
}
```

**Queue script:** `/backend/src/queues/queue-user-esi-killmails.ts`

```typescript
const message: UserKillmailMessage = {
  // ...
  lastKillmailId: user.last_killmail_id ?? undefined, // Include last ID
};
```

#### 3. Worker Logic

**Worker:** `/backend/src/workers/worker-esi-user-killmails.ts`

```typescript
await syncUserKillmailsFromESI(
  message,
  message.lastKillmailId // Pass last known ID
);
```

#### 4. CharacterService Optimization

**Service:** `/backend/src/services/character/character.service.ts`

```typescript
static async getCharacterKillmails(
  characterId: number,
  token: string,
  maxPages: number = 50,
  stopAtKillmailId?: number // 🔥 Yeni parametre
): Promise<EsiKillmail[]> {
  for (let page = 1; page <= maxPages; page++) {
    const killmails = await fetchPage(page);

    // 🔥 Incremental sync optimization
    if (stopAtKillmailId) {
      const stopIndex = killmails.findIndex(
        km => km.killmail_id === stopAtKillmailId
      );

      if (stopIndex !== -1) {
        // Found last synced killmail - stop here!
        const newKillmails = killmails.slice(0, stopIndex);
        allKillmails.push(...newKillmails);
        console.log(`✅ Found last synced ID: ${stopAtKillmailId}`);
        break; // 🔥 Erken dur, gereksiz page fetch etme
      }
    }

    allKillmails.push(...killmails);
  }
}
```

#### 5. Worker Output

**İlk sync (lastKillmailId yok):**

```
📡 [John Doe] Fetching killmails from ESI (full sync)...
   📄 Page 1: 50 killmails
   📄 Page 2: 50 killmails
   ...
   📄 Page 15: 50 killmails
   ✓ Last page (42 < 50)
   ✅ Total: 742 killmails from ESI
```

**İkinci sync (lastKillmailId: 123456789):**

```
📡 [John Doe] Fetching NEW killmails from ESI (incremental sync)...
   🔍 Will stop at killmail ID: 123456789
   📄 Page 1: 50 killmails
   ✅ Incremental sync: Found last synced killmail (ID: 123456789)
   ⏭️  Stopping at page 1 - fetched 3 new killmails
   ✅ Total: 3 killmails from ESI
```

**Sonuç:** 50 sayfa yerine **sadece 1 sayfa** fetch edildi!

#### 6. Database Update

```typescript
// Worker saves highest killmail ID
if (killmailList.length > 0) {
  const latestKillmailId = Math.max(
    ...killmailList.map((km) => km.killmail_id)
  );

  await prisma.user.update({
    where: { id: message.userId },
    data: {
      last_killmail_sync_at: new Date(),
      last_killmail_id: latestKillmailId, // 🔥 Save for next sync
    },
  });
}
```

## 📊 Birlikte Çalışma

### Tam İş Akışı

```
1. Server başlar
   ↓
2. Cron job başlar (her 10 dakika)
   ↓
3. Cron çalışır:
   - Aktif kullanıcıları bul
   - last_killmail_id'yi dahil et
   - Queue'ya ekle (priority: 3)
   ↓
4. Worker işler:
   - lastKillmailId varsa incremental sync
   - Sadece yeni killmail'leri çek
   - Database'e kaydet
   - last_killmail_id güncelle
   ↓
5. Bir sonraki cron çalışması:
   - Güncellenen last_killmail_id'yi kullan
   - Çok daha hızlı sync
```

### Avantajlar

| Özellik                   | Fayda                                     |
| ------------------------- | ----------------------------------------- |
| **Otomatik sync**         | Kullanıcı hiçbir şey yapmadan güncel veri |
| **10 dakikalık interval** | Yeterince sık ama API'yi spam'lemiyor     |
| **15 dakikalık buffer**   | Gereksiz tekrar sync önlenir              |
| **Incremental sync**      | 50x daha az API call                      |
| **Rate limit friendly**   | ESI limitlerini aşmaz                     |
| **Background priority**   | Manuel sync'ler öncelikli                 |
| **Concurrent-safe**       | Çakışma riski yok                         |

## 🧪 Test Etme

### 1. Sunucuyu Başlat

```bash
cd backend
yarn dev
```

Console'da göreceksin:

```
🕐 Starting user killmail background sync...
✅ User killmail cron started
```

### 2. Worker'ı Başlat

```bash
cd backend
yarn worker:user-killmails
```

### 3. İlk Sync'i İzle

İlk sync: **Full sync** (lastKillmailId yok)

```
📡 [John Doe] Fetching killmails from ESI (full sync)...
   📄 Page 1: 50 killmails
   📄 Page 2: 50 killmails
   ...
```

### 4. 10 Dakika Bekle

Cron otomatik çalışacak:

```
──────────────────────────────────────────────────────────────────────
🕐 [25.12.2025 14:40:00] Running background sync...
──────────────────────────────────────────────────────────────────────
   📊 Found 1 user(s) to sync
   ⏳ John Doe (last: 10m ago)
```

### 5. İkinci Sync'i İzle

İkinci sync: **Incremental sync** (lastKillmailId var)

```
📡 [John Doe] Fetching NEW killmails from ESI (incremental sync)...
   🔍 Will stop at killmail ID: 123456789
   📄 Page 1: 50 killmails
   ✅ Incremental sync: Found last synced killmail (ID: 123456789)
   ⏭️  Stopping at page 1 - fetched 2 new killmails
```

**Sonuç:** 50 sayfa → 1 sayfa = **50x hızlı!** 🚀

## 📝 Önemli Notlar

### Cron Job

- ✅ **Otomatik başlar**: Server başladığında
- ✅ **Graceful shutdown**: Process kill edildiğinde düzgün durur
- ✅ **Error handling**: Hata oluşursa log'lar, crash etmez
- ✅ **Status checking**: `userKillmailCron.getStatus()` ile durum kontrolü

### Incremental Sync

- ✅ **İlk sync her zaman full**: lastKillmailId yok
- ✅ **ESI order'a güven**: Reverse chronological order garantisi
- ✅ **Edge case handling**: Killmail bulunamazsa full sync
- ✅ **Database index**: last_killmail_id indexed for performance

### Rate Limiting

- ✅ **ESI limit: 150 req/sec** - bizim kullanımımız çok altında
- ✅ **Background priority: 3** - manuel sync'ler priority: 5
- ✅ **Worker prefetch: 1** - aynı anda 1 user işlenir
- ✅ **Page delay: 100ms** - sayfa aralarında bekleme

## 🎯 Sonuç

Bu iki özellik sayesinde:

1. **Otomatik sync**: Kullanıcılar hiçbir şey yapmadan her 10 dakikada sync
2. **50x performans**: Incremental sync sayesinde çok daha hızlı
3. **Rate limit friendly**: ESI limitlerini aşmıyoruz
4. **User experience**: Gerçek zamanlı veri, manuel sync gerekmez

**Hem kullanıcı deneyimi hem de sistem performansı dramatik şekilde iyileşti!** 🎉
