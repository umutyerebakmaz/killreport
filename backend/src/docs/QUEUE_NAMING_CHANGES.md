# Queue İsimlendirme Standardizasyonu

## 🎯 Amaç

Tüm queue isimlerini **kaynak** (`esi_` veya `zkillboard_`) ve **amaç** (`info` veya `all`) ile standartlaştırarak maksimum anlaşılırlık sağlamak.

## 📋 Final İsimlendirme

### ESI Entity Info Queue'ları (Tek tek entity bilgisi)

| Eski İsim                      | Yeni İsim                    | Açıklama                   |
| ------------------------------ | ---------------------------- | -------------------------- |
| `alliance_enrichment_queue`    | `esi_alliance_info_queue`    | Alliance bilgisi çek       |
| `character_enrichment_queue`   | `esi_character_info_queue`   | Karakter bilgisi çek       |
| `corporation_enrichment_queue` | `esi_corporation_info_queue` | Corporation bilgisi çek    |
| `type_enrichment_queue`        | `esi_type_info_queue`        | Ship/item tipi bilgisi çek |

### ESI Bulk/List Queue'ları (TÜM entity listesi)

| Eski İsim                | Yeni İsim                    | Açıklama                 |
| ------------------------ | ---------------------------- | ------------------------ |
| `alliance_queue`         | `esi_all_alliances_queue`    | TÜM alliance'ları çek    |
| `corporation_sync_queue` | `esi_all_corporations_queue` | TÜM corporation'ları çek |

### Diğer ESI Queue'ları

| Eski İsim                    | Yeni İsim                         | Açıklama                        |
| ---------------------------- | --------------------------------- | ------------------------------- |
| `alliance_corporation_queue` | `esi_alliance_corporations_queue` | Bir alliance'ın corp'larını çek |

### zKillboard Queue'ları

| Eski İsim             | Yeni İsim                    | Açıklama                     |
| --------------------- | ---------------------------- | ---------------------------- |
| `killmail_sync_queue` | `zkillboard_character_queue` | Karakter killmail'lerini çek |

## 💡 İsimlendirme Mantığı

### Prefix (Kaynak):

- **`esi_`**: EVE ESI API'den veri çeken queue'lar
- **`zkillboard_`**: zKillboard API'den veri çeken queue'lar

### Suffix (Amaç):

- **`_info_queue`**: Tek bir entity'nin detay bilgisini çek (eski: enrichment)
- **`_all_*_queue`**: TÜM entity'lerin listesini toplu çek (eski: sync/bulk)
- **`_*_queue`**: Özel işlemler (alliance_corporations gibi)

## 🎨 Örnekler

```typescript
// Tek entity bilgisi al (eksik entity'leri tamamla)
esi_alliance_info_queue; // Bir alliance'ın bilgilerini ESI'den çek
esi_character_info_queue; // Bir karakterin bilgilerini ESI'den çek

// TÜM entity listesini al (toplu işlem)
esi_all_alliances_queue; // ESI'deki TÜM alliance'ları çek ve kaydet
esi_all_corporations_queue; // ESI'deki TÜM corporation'ları çek ve kaydet

// Özel işlemler
esi_alliance_corporations_queue; // Bir alliance'ın corporation'larını çek
zkillboard_character_queue; // Bir karakterin killmail'lerini çek
```

## 📦 Kullanım Örnekleri

### Info Queue'ları (Enrichment):

```bash
# Eksik entity'leri tara ve queue'ya ekle
yarn scan:entities

# Info worker'ları başlat (entity bilgilerini çeker)
yarn worker:info:alliances      # esi_alliance_info_queue
yarn worker:info:characters     # esi_character_info_queue
yarn worker:info:corporations   # esi_corporation_info_queue
yarn worker:info:types          # esi_type_info_queue
```

### All Queue'ları (Bulk/List):

```bash
# TÜM entity'leri queue'ya ekle
yarn queue:alliances        # ESI'den tüm alliance ID'lerini çek
yarn queue:corporations     # ESI'den tüm NPC corporation'ları çek

# Bulk worker'ları başlat
yarn worker:alliances       # esi_all_alliances_queue
yarn worker:corporations    # esi_all_corporations_queue
```

### Özel Queue'lar:

```bash
# Alliance corporation'larını queue'ya ekle
yarn queue:alliance-corporations

# Worker'ı başlat
yarn worker:alliance-corporations  # esi_alliance_corporations_queue

# zKillboard character queue
yarn queue:character 95465499
yarn worker:zkillboard             # zkillboard_character_queue
```

## ✨ Faydalar

1. **Kaynak Açık**: `esi_` veya `zkillboard_` - hangi API'den veri çekildiği anlaşılıyor
2. **Amaç Açık**:
   - `_info_` = Tek entity bilgisi çek (enrichment)
   - `_all_` = Tüm entity'leri toplu çek (sync)
3. **Kısa ve Net**: "enrichment" ve "sync" yerine "info" ve "all" - daha az karışıklık
4. **Tutarlı**: Tüm ESI queue'ları `esi_` ile başlıyor, pattern tutarlı

## 📊 Queue Listesi (Güncel)

```typescript
const queues = [
  // ESI Entity Info Queues (tek tek entity bilgisi)
  "esi_alliance_info_queue",
  "esi_character_info_queue",
  "esi_corporation_info_queue",
  "esi_type_info_queue",

  // ESI Bulk/List Queues (tüm entity listesi)
  "esi_all_alliances_queue",
  "esi_all_corporations_queue",

  // ESI Special Queues
  "esi_alliance_corporations_queue",

  // zKillboard Queues
  "zkillboard_character_queue",
];
```

## 🔄 Migration Notları

- ✅ Tüm worker dosyaları güncellendi
- ✅ Tüm queue dosyaları güncellendi
- ✅ Tüm dokümantasyon güncellendi
- ⚠️ **RabbitMQ'da eski queue'lar varsa silinmeli**
- ✅ Worker'ları yeniden başlattığınızda yeni queue isimleri ile çalışacaklar

## 🎓 Neden Bu İsimlendirme?

**Eski Sorun**: "enrichment" ve "sync" kelimeleri kafayı karıştırıyordu

- `esi_alliance_enrichment_queue` - Ne yapar?
- `esi_alliance_sync_queue` - Farkı ne?

**Yeni Çözüm**: "info" ve "all" çok daha net

- `esi_alliance_info_queue` - Bir alliance'ın bilgisini çek ✅
- `esi_all_alliances_queue` - TÜM alliance'ları çek ✅

Artık isminden ne yaptığı anlaşılıyor! 🎯
