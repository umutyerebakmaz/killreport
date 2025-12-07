# Daily Workflows (Backend)

## 📋 Simple Daily Sequence

```bash
# 1. Update Alliance & Corporation Data
+yarn queue:alliances              # ESI'dan tüm alliance ID'lerini kuyruğa ekle
+yarn worker:info:alliances        # Alliance detaylarını çek ve GÜNCELLE - 3547

+yarn queue:alliance-corporations  # Alliance'ları kuyruğa ekle (corporation keşfi için)
yarn worker:alliance-corporations # Her alliance'ın corp ID'lerini ESI'dan çek ve kuyruğa ekle - 17,764
yarn worker:info:corporations     # Corporation detaylarını ESI'dan çek ve GÜNCELLE

# 2. Take Snapshots
yarn snapshot:alliances
yarn snapshot:corporations
```

## 📖 What Each Command Does

**`yarn queue:alliances`**

- ESI'dan TÜM alliance ID'lerini çeker
- `esi_alliance_info_queue` kuyruğuna ekler

**`yarn worker:info:alliances`**

- Kuyruktan alliance ID'leri alır
- Her alliance için ESI'dan detay çeker
- Database'de **UPSERT** yapar (var olanları günceller, yoksa ekler)
- Güncellenen alanlar: name, ticker, executor_corporation_id, faction_id

**`yarn queue:alliance-corporations`**

- Database'deki TÜM alliance'ları alır
- Her alliance ID'sini `esi_alliance_corporations_queue` kuyruğuna ekler

**`yarn worker:discover-corporations`**

- Kuyruktan alliance ID'leri alır
- Her alliance için ESI'dan corporation ID'lerini çeker (`GET /alliances/{id}/corporations/`)
- Corporation ID'lerini `esi_corporation_info_queue` kuyruğuna ekler
- **ÖNEMLİ:** Bu olmadan corporation'lar keşfedilemez!

**`yarn worker:info:corporations`**

- Kuyruktan corporation ID'leri alır
- Her corporation için ESI'dan detay çeker
- Database'de **UPSERT** yapar (var olanları günceller, yoksa ekler)
- Güncellenen alanlar: name, ticker, member_count, ceo_id, alliance_id, tax_rate

**`yarn snapshot:corporations`**

- Tüm corporation'ların anlık görüntüsünü alır

**`yarn snapshot:alliances`**

- Tüm alliance'ların anlık görüntüsünü alır
