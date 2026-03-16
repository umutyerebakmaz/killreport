# 🎮 KillReport - Benzersiz Özellikler Önerisi

## Hedef: zkillboard'dan farklılaşmak ve ciddi EVE oyuncularını çekmek

---

## 📊 Tier 1: Hemen Etkili Özellikler (2-4 hafta)

### 1. **Filo Savaşı Rekonstrüksiyonu** 🔥

**Problem:** Killmail'ler izole olaylar - büyük savaşları görmek zor
**Çözüm:** Aynı sistem + zaman aralığındaki killmail'leri otomatik grupla

**Özellikler:**

- Savaş tespiti: Aynı solar sistemde 15 dakika içinde 10+ öldürme → Savaş Oluştur
- Savaş özet sayfası:
  - Toplam yok edilen ISK (saldırgan vs kurban tarafı)
  - İlgili ittifaklar/korporasyonlar
  - En çok öldürenler ve en çok kaybedenler
  - Gemi kompozisyonu (pasta grafikleri)
  - Öldürme zaman çizelgesi (kronolojik gemi kayıpları)
- Savaş lider tablosu: En büyük savaşlar (ISK/gemi sayısına göre)

**Neden önemli:**
FC'ler (Filo Komutanları) ve ittifak liderliği savaş sonuçlarını analiz etmek ister. Bu özellik zkillboard'da yok!

**Örnek UI:**

```text
⚔️ M-OEE8 Savaşı
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 2026-02-24 14:30 - 15:45 EVE Zamanı
📍 M-OEE8, Delve
⏱️ Süre: 1s 15dk

💀 Toplam Yok Edilen: 145 gemi, 234.5B ISK

🔵 Saldırganlar (Kazandı):
   Goonswarm Federation: 89 pilot
   The Initiative: 23 pilot
   → Yok Etti: 24 gemi, 31.2B ISK

🔴 Savunucular (Kaybetti):
   Pandemic Legion: 67 pilot
   Northern Coalition: 45 pilot
   → Kaybetti: 121 gemi, 203.3B ISK

📊 Gemi Kompozisyonu:
   [Pasta grafik: Titan'lar, Dread'ler, Carrier'lar, vb.]

⏰ Öldürme Zaman Çizelgesi:
   [Her geminin ne zaman öldüğünü gösteren interaktif zaman çizelgesi]
```

---

### 2. **Karakter Savaş Verimliliği Metrikleri** 📈

**Problem:** Öldürme sayısı sadece bir metrik - yetenek göstermiyor
**Çözüm:** Gelişmiş PvP analitiği

**Metrikler:**

- **K/D Oranı**: Öldürme sayısı / Ölüm sayısı (7/30/90 gün)
- **ISK Verimliliği**: Yok edilen ISK / Kaybedilen ISK (yüzde)
- **Solo Öldürme Oranı**: Solo killmail yüzdesi
- **Final Blow Oranı**: Son darbe yüzdesi
- **Ortalama Gemi Değeri**: Yok edilen gemilerin ortalama değeri
- **Tehlike Derecesi**: Yüksek değerli hedefleri öldürme skoru
- **Aktivite Isı Haritası**: Aktif saatler/günler görselleştirmesi

**Karakter Profiline eklenecek:**

```text
🎯 Savaş Verimliliği Skoru: 87/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Son 90 Gün İstatistikleri:

K/D Oranı:           412 / 23  →  17.9  ⭐⭐⭐⭐⭐
ISK Verimliliği:     84.2%             ⭐⭐⭐⭐
Solo Öldürmeler:     34% (140/412)     ⭐⭐⭐
Son Darbeler:        28% (115/412)     ⭐⭐⭐
Ort. Hedef Değeri:   1.2B ISK          ⭐⭐⭐⭐

🏆 Elit PvP Derecesi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 En Aktif: Syndicate (145 öldürme)
🎯 Favori Gemi: Cruor (78 öldürme)
⏰ Yoğun Saatler: 18:00-22:00 EVE Zamanı
```

**Neden önemli:**
İşe alım için kritik! Korporasyonlar yetenekli pilotlar arar - verimlilik önemli, sadece öldürme sayısı değil.

---

### 3. **Korporasyon/İttifak İstihbarat Panosu** 🔍

**Problem:** Korporasyon işe alımı ve ittifak savaşı için yetersiz veri
**Çözüm:** Kapsamlı istihbarat panosu

**Korporasyon Profiline eklenecek:**

- **Aktivite Trendleri**: Son 30 gün öldürme sayısı trendleri (grafik)
- **PvP Odak Alanları**: En aktif bölgeler (ısı haritası)
- **Üye Aktivite Dağılımı**: Aktif pilot sayısı (günlük/haftalık/aylık)
- **Saat Dilimi Dağılımı**: Üyelerin aktif saatleri
- **Gemi Doktrin Analizi**: En çok kullanılan gemi kompozisyonları
- **Savaş Geçmişi**: Son savaşlar ve kazanma oranı
- **En İyi Üyeler**: En aktif ve başarılı pilotlar

**İttifak Profiline eklenecek (mevcut büyüme metriklerine ek olarak):**

- **Koalisyon İlişkileri**: En sık müttefik olunan korporasyonlar
- **Düşman Analizi**: En çok savaşılan varlıklar
- **Sov Kampanyası Takibi**: Bölge kontrol değişiklikleri (eğer null-sec ise)
- **Stratejik Varlık Takibi**: Keepstar/Fortizar öldürmeleri/kayıpları

**Neden önemli:**
İttifak liderliği ve istihbarat görevlileri bu verilere bayılır. İşe alım ve savaş planlaması için kullanılır.

---

## 📊 Tier 2: Gelişmiş Özellikler (1-2 ay)

### 4. **Gemi Donanımı Analizi** 🛠️

**Özellik:** Killmail'lerden gemi donanımlarını çıkar ve analiz et

- Popüler donanımlar (Meta Fit'ler)
- Donanım başarı oranı (bu donanımla K/D oranı)
- Gemi karşı önerileri (Y gemisi X gemisine karşı daha iyi)
- Donanımı EVE'e aktar (ESI ile)

### 5. **Gerçek Zamanlı Uyarı Sistemi** 🔔

**Özellik:** Önemli olaylar için bildirimler

Uyarılar:

- Korporasyonunuz/ittifakınızdan bir üye öldürüldü
- Yüksek değerli hedef yok edildi (10B+ ISK)
- ŞU ANDA büyük bir savaş oluyor (100+ katılımcı)
- İzlediğiniz karakterin aktivitesi
- Korporasyona/ittifaka savaş ilan edildi

Bildirim kanalları:

- Uygulama içi bildirimler
- E-posta (opsiyonel)
- Discord webhook (opsiyonel)

### 6. **PvP Bölge Isı Haritası** 🗺️

**Özellik:** EVE haritasında aktivite göster

- İnteraktif harita: Sistem başına öldürme sayısı
- Son 24s / 7g / 30g filtreleri
- Gemi tipi filtresi (sadece battleship öldürmelerini göster)
- İttifak aktivitesi katmanı
- "Tehlikeli bölgeler" vurgusu

### 7. **Korporasyon İşe Alım İlanları** 📢

**Özellik:** Korporasyon işe alım duyuruları

- Korporasyon profilinde "İşe alıyoruz" rozeti
- Gereksinimler formu (min SP, saat dilimi, aktivite)
- Başvur butonu → Discord linki
- Öne çıkan korporasyonlar (opsiyonel premium özellik)

---

## 📊 Tier 3: Premium/Topluluk Özellikleri (2-3 ay)

### 8. **Savaş VOD Entegrasyonu** 🎥

**Özellik:** Büyük savaşlara Twitch/YouTube VOD linkleri ekle

- Savaş sayfasında "VOD İzle" butonu
- Topluluk tarafından gönderilen linkler
- Upvote/downvote sistemi

### 9. **Karakter Notları & Etiketleme** 🏷️

**Özellik:** Kullanıcılar karakterlere not ekleyebilir

- "Bilinen dolandırıcı" / "İyi FC" / "Dost pilot" etiketleri
- Özel notlar (sadece siz görebilirsiniz)
- Halka açık itibar sistemi (opsiyonel)

### 10. **Tarihsel Clone İstatistikleri** ⚰️

**Özellik:** Karakterin implant kayıp geçmişi

- Toplam kaybedilen implant değeri
- En pahalı pod kaybı
- Clone verimliliği (ucuz clone'lar mı kullanıyor?)

### 11. **Kill Mail Hikaye Üreteci** 📝

**Özellik:** AI destekli savaş özeti üreteci

- GPT-4 kullanarak killmail'den hikaye üret
- "Bugün M-OEE8'de, Goonswarm Federation filosu..."
- Paylaşım için ideal

---

## 🎯 Öncelik Sırası (Etki/Efor)

### ⚡ Hemen Başla (Yüksek Etki, Orta Efor)

1. **Filo Savaşı Rekonstrüksiyonu** - Bu sizin en önemli özelliğiniz olabilir
2. **Karakter Savaş Verimliliği Metrikleri** - İşe alım için kritik
3. **Korporasyon/İttifak İstihbarat Panosu** - Liderliği çeker

### 🔥 Hızlı Kazançlar (Yüksek Etki, Düşük Efor)

1. **Aktivite Isı Haritası** (karakter/korporasyon için)
2. **K/D Oranı & ISK Verimliliği** (basit hesaplama)
3. **Karakter başına En İyi Gemi/Sistem istatistikleri**

### 🚀 Orta Vade (Orta Etki, Orta Efor)

1. **Gerçek Zamanlı Uyarı Sistemi**
2. **PvP Bölge Isı Haritası**
3. **Gemi Donanımı Analizi**

### 💎 Uzun Vade (Yüksek Etki, Yüksek Efor)

1. **Savaş VOD Entegrasyonu**
2. **İtibar/Notlar Sistemi**
3. **AI Hikaye Üreteci**

---

## 💬 Topluluk Oluşturma Stratejisi

### Reddit/Discord Stratejisi

1. **r/Eve subreddit'inde paylaş:**
   - "Savaş rekonstrüksiyonu olan modern bir killboard yaptık"
   - Büyük savaşlardan hemen sonra savaş özetleri paylaş
   - "XXX Savaşı - 234B ISK yok edildi" gibi başlıklar kullan

2. **Discord topluluğu oluştur:**
   - EVE topluluğuna adanmış Discord
   - Bot: Gerçek zamanlı büyük öldürme bildirimleri
   - #battles kanalı: Büyük savaşları otomatik paylaş

3. **Influencer erişimi:**
   - EVE YouTube/Twitch içerik üreticilerine ulaş
   - Onlara savaş analiz aracı sun
   - Yayıncılar için özel savaş sayfaları: "KillReport tarafından desteklenmektedir"

4. **İttifak ortaklıkları:**
   - Büyük ittifaklara özel panolar sun
   - İstihbarat aracı olarak ücretsiz premium özellikler
   - İttifaklar üyelerine önerir

### İçerik Fikirleri

- **Haftalık Savaş Raporu**: "Bu haftanın en büyük 10 savaşı"
- **Aylık Korporasyon Sıralaması**: "En aktif korporasyonlar"
- **Öne Çıkan Pilot**: "Bu ayın en ölümcül pilotu"
- **Meta Analizi**: "Killmail'lerden mevcut gemi meta analizi"

---

## 💰 Monetizasyon (Opsiyonel)

### Ücretsiz Tier (Her Şey)

- Tüm temel özellikler
- Karakter/korporasyon takibi
- Savaş rekonstrüksiyonu
- Lider tabloları

### Premium Tier ($5/ay)

- Gelişmiş uyarılar (Discord/e-posta)
- Tarihsel veri dışa aktarma (CSV)
- Özel savaş analizi
- Reklamsız deneyim
- Öne çıkan korporasyon profili
- Özel korporasyon markalaşması

### API Erişimi

- Üçüncü parti geliştiriciler için API
- Hız limiti: 100 istek/dk (ücretsiz) → 1000 istek/dk (ücretli)

---

## 🎯 Başarı Metrikleri

### 3 aylık hedef

- 1000+ kayıtlı kullanıcı
- 500+ günlük aktif kullanıcı
- 10+ büyük ittifak aktif olarak kullanıyor
- r/Eve'de 3+ viral gönderi
- Discord: 500+ üye

### 6 aylık hedef

- 5000+ kayıtlı kullanıcı
- 2000+ günlük aktif kullanıcı
- EVE topluluğunda "başvurulacak savaş takipçisi" olarak bilinmek
- Büyük EVE haber sitelerinde öne çıkmak (INN, Talking in Stations)

---

## ⚠️ Önemli Notlar

### zkillboard Karşılaştırması Hakkında

- "zkillboard alternatifi" demeyin → "modern analitik platformu" deyin
- "Sadece veri toplama değil, istihbarat ve analitiğe odaklanıyoruz"
- "Tarihçiler için değil, aktif oyuncular için yapıldı"

### Konumlandırma

- **zkillboard:** Tarihsel öldürme arşivi, temel istatistikler
- **KillReport:** Gerçek zamanlı istihbarat & analitik platformu
- **Değer önerisi:** "Veriden kararlara"

### Topluluk oluşturma

- Reddit/Discord'da aktif ol
- İçerik oluştur (haftalık raporlar)
- Büyük savaşları hemen analiz et ve paylaş
- EVE topluluğuna değer kat

---

## 🚀 İlk Adım: Savaş Rekonstrüksiyonu

Bu özelliği uygularsanız, zkillboard'da olmayan bir şeye sahip olursunuz. Bu, EVE topluluğunun istediği ama kimsenin yapmadığı bir özelliktir.

**Uygulama planı:**

1. Killmail'leri solar_system_id + zaman damgasına göre grupla
2. Savaş tespit algoritması (eşik: 15 dk pencerede 10+ öldürme)
3. Savaş özet sayfası (React bileşeni)
4. Savaş lider tablosu
5. Paylaşım işlevselliği (Twitter/Reddit önizleme kartları)

Bu özellikle başlamanızı öneririm! 🚀
