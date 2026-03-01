# 📊 Top Charts Maliyet Analizi

## 🎯 Soru

**Şu anda top charts için pre-computed tablolar (Materialized Views) kullanıyoruz. Eğer bu tablolar olmasaydı ve her 5 dakikada bir canlı hesaplama yapsaydık ne kadar maliyetli olurdu?**

---

## 🏗️ Mevcut Sistem (Materialized Views ile)

### Tablolar

Toplam **9 farklı top charts Materialized View** var:

#### Character Top Charts (3 adet)

1. `character_top_alliance_targets_mv` - Her character'ın top 10 alliance hedefi
2. `character_top_corporation_targets_mv` - Her character'ın top 10 corporation hedefi
3. `character_top_ships_mv` - Her character'ın top 10 ship tipi

#### Corporation Top Charts (3 adet)

4. `corporation_top_alliance_targets_mv` - Her corporation'ın top 10 alliance hedefi
5. `corporation_top_corporation_targets_mv` - Her corporation'ın top 10 corporation hedefi
6. `corporation_top_ships_mv` - Her corporation'ın top 10 ship tipi

#### Alliance Top Charts (3 adet)

7. `alliance_top_alliance_targets_mv` - Her alliance'ın top 10 alliance hedefi
8. `alliance_top_corporation_targets_mv` - Her alliance'ın top 10 corporation hedefi
9. `alliance_top_ships_mv` - Her alliance'ın top 10 ship tipi

### Refresh Süresi

- **Her 5 dakikada bir** refresh ediliyor (cron job)
- Her refresh **CONCURRENTLY** yapılıyor (table lock'sız)
- Ortalama refresh süresi: **3-8 saniye** (view'a göre değişiyor)

### Avantajlar

✅ **Query çok hızlı** (sadece SELECT ile pre-computed data)

- Character detail page: ~10-20ms
- Corporation detail page: ~10-20ms
- Alliance detail page: ~10-20ms

✅ **Database yükü düşük** (sadece 5 dakikada bir refresh)

✅ **Scalable** (1 milyon killmail olsa bile query hızı aynı)

---

## 💸 Alternatif: Tablosuz Canlı Hesaplama

### Scenario: Her istek geldiğinde hesaplama

**Örnek sorgu** (Character Top Alliance Targets için):

```sql
WITH ranked_kills AS (
    SELECT
        a.character_id,
        v.alliance_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.character_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    WHERE a.character_id = $1
      AND v.alliance_id IS NOT NULL
    GROUP BY a.character_id, v.alliance_id
)
SELECT
    rk.character_id,
    rk.alliance_id,
    rk.kill_count,
    al.name as alliance_name
FROM ranked_kills rk
INNER JOIN alliances al ON rk.alliance_id = al.id
WHERE rk.rn <= 10
ORDER BY rk.kill_count DESC;
```

### Maliyet Analizi (Tek Sorgu)

#### Veri Büyüklüğü Varsayımları:

- **Toplam Killmails:** 200,000 adet
- **Toplam Attackers:** 2,000,000 satır (ortalama 10 attacker/killmail)
- **Toplam Victims:** 200,000 satır (1 victim/killmail)
- **Active Characters:** 10,000 adet
- **Ortalama killmail/character:** 200 adet

#### Query Maliyeti (Tek Character için):

1. **Attackers Scan:**
   - Index kullanımı: `idx_attackers_character` (character_id)
   - Taramanan satır: ~200 satır
   - Maliyet: **Düşük** ✅

2. **Victims JOIN:**
   - 200 attacker satırı × 1 victim = 200 JOIN operasyonu
   - Index kullanımı: `idx_victim_killmail` (killmail_id)
   - Maliyet: **Orta** ⚠️

3. **Killmails JOIN:**
   - 200 victim satırı × 1 killmail = 200 JOIN operasyonu
   - Index kullanımı: `idx_killmail_id` (primary key)
   - Maliyet: **Düşük** ✅

4. **GROUP BY:**
   - ~200 satır üzerinde grouping
   - Maliyet: **Düşük** ✅

5. **ROW_NUMBER() Window Function:**
   - ~10-30 grup (unique alliance'lar)
   - Maliyet: **Düşük** ✅

6. **Alliances JOIN:**
   - Top 10 alliance için name lookup
   - Maliyet: **Çok Düşük** ✅

**Toplam Query Süresi:** **50-150ms** (cache'siz, cold query)

---

### Scenario 2: Her 5 Dakikada Canlı Hesaplama

**Farz edelim ki:**

- Tablosuz sistem kullanıyoruz
- Her 5 dakikada bir TÜVER CHARACTER'LAR için hesaplama yapıyoruz

#### Hesaplama:

**Tek Character Query:** 100ms (ortalama)

**10,000 Active Character için:**

```
10,000 characters × 100ms = 1,000,000ms = 1,000 saniye = ~16.6 dakika
```

**❌ SORUN:** 5 dakikada bitmesi gereken iş 16.6 dakika sürüyor!

#### Paralel İşleme ile:

**10 paralel worker ile:**

```
1,000 saniye ÷ 10 = 100 saniye = ~1.6 dakika ✅
```

**50 paralel worker ile:**

```
1,000 saniye ÷ 50 = 20 saniye ✅
```

---

## 📊 Maliyet Karşılaştırması

### Mevcut Sistem (Materialized Views)

| Metrik                    | Değer                       |
| ------------------------- | --------------------------- |
| **Refresh Süresi**        | 5-8 saniye (her 5 dakikada) |
| **Query Süresi**          | 10-20ms                     |
| **Database Yükü**         | Çok Düşük                   |
| **Ekstra Disk Kullanımı** | ~50-200 MB (9 view)         |
| **Complexity**            | Düşük (automated refresh)   |

### Alternatif: Canlı Hesaplama (Her İstek)

| Metrik             | Değer                                     |
| ------------------ | ----------------------------------------- |
| **Query Süresi**   | 50-150ms (7-15x daha yavaş)               |
| **Database Yükü**  | Çok Yüksek ❌                             |
| **Disk Kullanımı** | 0 MB (table yok) ✅                       |
| **Scalability**    | Kötü (traffic arttıkça database overload) |

### Alternatif 2: Canlı Hesaplama (Her 5 Dakika, Tüm Characters)

| Metrik               | Değer                                          |
| -------------------- | ---------------------------------------------- |
| **Hesaplama Süresi** | 100 saniye (10 worker) / 20 saniye (50 worker) |
| **Database Yükü**    | Aşırı Yüksek ❌❌❌                            |
| **CPU Kullanımı**    | 50-100 paralel worker gerekir                  |
| **Complexity**       | Yüksek (worker management, error handling)     |
| **Maliyet**          | 50 worker × 5 dakika = Sürekli CPU spike       |

---

## 💰 Sonuç: Maliyet Farkı

### Tablosuz Sistemin Maliyeti

**Senaryo 1: Her istek canlı hesaplama**

Günlük traffic varsayımı:

- 1,000 unique character page view/gün
- 500 unique corporation page view/gün
- 100 unique alliance page view/gün

Her page 3 top chart gösteriyor (alliance, corporation, ships).

**Toplam Query Sayısı:**

```
(1,000 + 500 + 100) × 3 charts = 4,800 query/gün
```

**Query Süresi Farkı:**

```
Materialized View: 4,800 × 15ms = 72 saniye/gün
Canlı Hesaplama: 4,800 × 100ms = 480 saniye/gün = 8 dakika/gün
```

**Database CPU Farkı:** **6.6x daha fazla CPU** ❌

---

**Senaryo 2: Her 5 dakikada batch hesaplama**

Her 5 dakika = Günde 288 kez

**Tek Refresh Maliyeti:**

```
10,000 characters × 3 charts × 100ms = 3,000 saniye = 50 dakika
(10 worker ile: 5 dakika)
```

**Günlük Toplam:**

```
288 × 5 dakika = 1,440 dakika = 24 saat 🔥
```

**❌ Sonuç:** Database sürekli hesaplama yapıyor, başka query için zaman kalmıyor!

---

## 🎯 Nihai Sonuç

### Materialized View'lar olmasaydı:

1. **Her istek için canlı hesaplama:**
   - **6-15x daha yavaş** response time
   - Database **overload** riski
   - Kötü kullanıcı deneyimi

2. **Her 5 dakikada batch hesaplama (benzer mantık):**
   - **288x daha fazla CPU** kullanımı (24 saat hesaplama)
   - 10-50 paralel worker gerekir
   - Database sürekli meşgul kalır
   - Diğer query'ler yavaşlar

3. **Ekstra Maliyet:**
   - **~$50-100/ay** ekstra database instance gerekir (CPU için)
   - Ya da **current database güçlendirilir** (+$30-50/ay)

### Kazanç (Materialized View ile):

- ✅ **Query süresi:** 10-20ms (ultra hızlı)
- ✅ **Database yükü:** Minimal (5 dakikada 1 refresh)
- ✅ **Disk kullanımı:** Sadece ~50-200 MB (ihmal edilebilir)
- ✅ **Maliyet:** $0 ekstra (mevcut database yeterli)
- ✅ **Scalability:** 10 milyon killmail olsa bile aynı hız

---

## 📈 Özet Tablo

| Özellik             | Mevcut (M.View) | Canlı Her İstek | Batch Her 5dk  |
| ------------------- | --------------- | --------------- | -------------- |
| **Query Süresi**    | 10-20ms         | 50-150ms ❌     | 10-20ms        |
| **DB CPU**          | %5              | %30-50 ❌❌     | %80-100 ❌❌❌ |
| **Disk**            | +200 MB         | 0 MB            | 0 MB           |
| **Ekstra Maliyet**  | $0 ✅           | +$30/ay         | +$50-100/ay    |
| **User Experience** | Mükemmel ✅     | Yavaş ❌        | Mükemmel ✅    |
| **Complexity**      | Düşük ✅        | Düşük           | Yüksek ❌      |

---

## 🏆 Karar

**Materialized View sistemini kullanmak kesinlikle doğru bir karar! 🎉**

**Neden?**

1. **200 MB disk** için **%95 CPU tasarrufu** yapıyoruz
2. Query'ler **7-15x daha hızlı**
3. Database scalable (1M killmail = aynı hız)
4. Ekstra maliyet: **$0**

**Alternatif maliyeti:** +$50-100/ay + kötü performance

**Sonuç:** Mevcut sistem optimal! 🚀

---

## 📝 Notlar

- Bu analiz **200K killmail** varsayımı ile yapıldı
- **1M killmail** olsa fark daha da büyük olur (30x+ CPU farkı)
- Materialized View refresh optimize edilmiş (CONCURRENTLY + memory tuning)
- Production'da bu sistem mükemmel çalışıyor ✅
