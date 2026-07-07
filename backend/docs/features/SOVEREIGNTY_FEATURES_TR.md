# Sovereignty Veri Özellikleri - Detaylı Dokümantasyon

## 🎯 **Temel Özellikler:**

### 1. **Sovereignty Savaş Paneli**

New Eden'daki devam eden sovereignty çatışmalarının gerçek zamanlı görselleştirilmesi.

**Ana Bileşenler:**

- Tüm aktif sovereignty kampanyalarını gerçek zamanlı göster
- Her kampanya için saldırgan/savunucu skorlarını göster
- Hangi alliance'ların hangi sistemler için savaştığını görselleştir
- Skor farklılıklarıyla savaş ilerleme çubukları
- Kampanya süresini gösteren zaman çizelgesi görselleştirmesi
- Kampanya etkinlik türü dökümü:
  - TCU Savunması (Territorial Claim Unit)
  - IHUB Savunması (Infrastructure Hub)
  - İstasyon Savunması
  - İstasyon Freeport etkinlikleri
- Katılımcı alliance listesi ve bireysel skorları
- Kampanyalar için tahmini kalan süre
- Sistem/takımyıldız/bölge detaylarına hızlı linkler

**Teknik Uygulama:**

- `/sovereignty/campaigns` endpoint'inden veri çek
- Her 5-10 dakikada bir gerçek zamanlı güncellemeler
- Canlı skor güncellemeleri için WebSocket veya polling
- Kısa TTL (5 dakika) ile kampanya verilerini önbellekle

---

### 2. **Bölge Kontrol Haritası**

New Eden genelinde sovereignty dağılımının kapsamlı görselleştirilmesi.

**Ana Bileşenler:**

- Hangi alliance'ın hangi sistemleri kontrol ettiğini gösteren interaktif harita
- Alliance'lara göre renk kodlu görselleştirme
- Takımyıldız/bölge bazlı hakimiyet istatistikleri
- Bölge değişim geçmişi takibi:
  - Sovereignty değişikliklerinin günlük anlık görüntüleri
  - Zaman içinde kimin hangi sistemleri kaybettiği/kazandığı
  - Bölge el değiştirme takibi (sistem el değiştirdi)
- Faction kontrollü vs Alliance kontrollü karşılaştırmaları
- NPC null-sec vs oyuncu sovereignty bölgeleri
- Corporation seviyesinde sovereignty (nadir durumlar)

**Gösterilen İstatistikler:**

- Alliance başına kontrol edilen toplam sistemler
- Bölge başına kontrol edilen sistemler
- Kontrol edilen null-sec yüzdesi
- Bölge yoğunlaşma metrikleri
- Bitişik sistem kümeleme analizi

**Teknik Uygulama:**

- `/sovereignty/map` endpoint'inden veri çek
- Günlük geçmiş anlık görüntüleri sakla
- Anlık görüntüler arasındaki deltaları hesapla
- Alliance/corporation/faction bazında topla
- Bölge/takımyıldız özetleri oluştur

---

### 3. **Alliance Güç Sıralamaları**

Sovereignty sahipliği ve aktiviteye dayalı kapsamlı sıralama sistemi.

**Sıralama Kategorileri:**

- **Kontrol Edilen Toplam Sistemler**: Genel sovereignty gücü
- **Aktif Savaş Sayısı**: Taarruzi/savunma katılım seviyesi
- **Bölge Kazanımları (24s/7g/30g)**: Genişleme metrikleri
- **Bölge Kayıpları (24s/7g/30g)**: Savunma metrikleri
- **Net Bölge Değişimi**: Genel büyüme/düşüş
- **Sovereignty İstikrarı**: Sistemlerin ne kadar süre tutulduğu
- **Savaş Kazanma Oranı**: Başarılı kampanyalar vs toplam kampanyalar
- **Savunma Başarı Oranı**: Başarıyla savunulan yapılar
- **Saldırı Başarı Oranı**: Başarıyla ele geçirilen yapılar

**Lider Tabloları:**

- Kontrol edilen sistemlere göre en iyi 25 alliance
- En agresif saldırganlar (aktif taarruz kampanyaları)
- En iyi savunucular (başarılı savunma oranı)
- En hızlı büyüyen alliance'lar (bölge kazanımları)
- Güç kaybeden devletler (bölge kayıpları)
- En istikrarlı imparatorluklar (en uzun tutulan sistemler)

**Teknik Uygulama:**

- Sovereignty verilerinin günlük toplanması
- Geçmiş karşılaştırma hesaplamaları
- Kampanyalar için kazanma/kaybetme takibi
- Alliance seviyesinde istatistik toplanması
- Çok faktörlü sıralama algoritması

---

### 4. **Killmail + Sovereignty Entegrasyonu** ⭐ **(En Değerli Özellik)**

**Bu sizin benzersiz satış noktanızdır - bunu başka kimse yapamaz!**

**Temel İşlevsellik:**
Benzeri görülmemiş savaş istihbaratı sağlamak için kapsamlı killmail veritabanınızı sovereignty kampanya verileriyle ilişkilendirin.

**Özellikler:**

**A. Savaş Bölgesi Kill Takibi:**

- Aktif sov kampanyaları olan sistemlerdeki tüm killmail'leri vurgula
- İlgili killmail'lerde özel "Savaş Kill'i" rozeti
- Kampanya ID'sine veya savaş bölgesine göre killmail'leri filtrele
- Savaşla ilgili vs normal kill'ler için ayrı istatistikler

**B. Kampanya Savaş Analizi:**

- Kampanya başına yok edilen toplam ISK (her iki taraf)
- Kampanya sırasında katılan alliance başına kill sayıları
- Gemi türü analizi (sov savaşlarında ne kullanılıyor)
- Pilot katılım takibi (kim savaşıyor)
- Zamana dayalı kill aktivitesi (yoğun savaş zamanları)

**C. Savaş Sonucu Tahmini:**

- Kampanya sonuçlarını tahmin etmek için kill oranlarını kullan
- "Gerçek savaşa göre hangi taraf kazanıyor"
- Kampanyalar sırasında alliance başına ISK verimliliği
- Savaş performans metrikleri vs kampanya skorları

**D. Yapı Kill Atfı:**

- TCU/IHUB yapı kill'lerini takip et
- Yapı kill'lerini kampanyalara atfet
- Yapı değiştirme maliyetlerini hesapla
- Yakındaki kill'lerle yapı savunma başarısı korelasyonu

**E. Katılımcı Performans Metrikleri:**

- Kampanya başarısına bireysel alliance katkısı
- Kampanyalar sırasında kill katılım oranı
- Katılımcı başına yok edilen ISK katkısı
- Savaş etkinliği skorları
- Kampanya başına en iyi performans gösterenler

**F. Alliance Savaş Yetenekleri:**

- Geçmiş savaş performans analizi
- Kampanyalarda yok edilen ortalama ISK
- Sov savaşlarında tipik filo kompozisyonları
- Her alliance için yoğun aktivite zamanları
- Savaş sürdürülebilirlik metrikleri

**Teknik Uygulama:**

```typescript
// Oluşturabileceğiniz örnek sorgular:
-getWarZoneKillmails(campaignId, dateRange) -
  getCampaignCombatStats(campaignId) -
  getAllianceWarPerformance(allianceId, dateRange) -
  predictCampaignOutcome(campaignId) -
  getStructureKillHistory(allianceId, structureType) -
  getCampaignParticipantStats(campaignId, participantId);
```

**Veri Gereksinimleri:**

- Killmail'leri kampanyalara şu şekilde bağla:
  - Sistem ID + zaman damgası eşleştirmesi
  - Katılımcı alliance eşleştirmesi
  - Yapı türü eşleştirmesi (yapı kill'leri için)
- ML/tahmin modelleri için kampanya sonuçlarını sakla
- Kampanya başına istatistikleri topla

---

### 5. **Savaş Uyarıları & Bildirimler**

Sovereignty olayları için gerçek zamanlı bildirim sistemi.

**Uyarı Türleri:**

**A. Yeni Kampanya Uyarıları:**

- "[Sistem]'de yeni sovereignty kampanyası başladı"
- Etkinlik türü ve katılan alliance'lar
- Saldırgan vs Savunucu tanımlaması
- Risk altındaki yapı bilgisi

**B. Yapı Güvenlik Açığı Uyarıları:**

- "TCU/IHUB güvenlik açığı penceresine giriyor"
- Güvenlik açığı penceresine geri sayım
- Haftalık zamanlayıcı programları
- Alliance'a özel yapı takibi

**C. Favori Alliance Takibi:**

- "Favori alliance'ınız [Sistem]'de saldırı altında"
- "Alliance'ınız [Bölge]'de bir sistem ele geçirdi"
- Önemli bölge değişikliği bildirimleri
- Alliance savaş performans özetleri

**D. Kampanya Sonuç Uyarıları:**

- "[Sistem]'de kampanya tamamlandı"
- Kazanan/kaybeden tanımlaması
- Yapının kaderi (yok edildi/kurtarıldı)
- İstatistik özeti

**E. Bölge Değişikliği Uyarıları:**

- "[Sistem]'de sistem sovereignty değişti"
- Eski vs yeni sahip
- Bölgesel kontrol üzerindeki etki

**Teslimat Yöntemleri:**

- Uygulama içi bildirimler
- E-posta bildirimleri (isteğe bağlı)
- Discord webhook entegrasyonu
- RSS beslemesi
- Üçüncü taraf entegrasyonları için API webhook'ları

**Teknik Uygulama:**

- Sovereignty değişikliklerini kontrol eden arka plan worker'ı
- Önceki durumla karşılaştırma
- Kullanıcı tercih yönetimi
- Bildirim kuyruk sistemi
- Hız sınırlama ve toplu işleme

---

### 6. **Geçmiş Analizler**

Zaman içinde sovereignty dinamiklerinin derin geçmiş analizi.

**Analiz Özellikleri:**

**A. Kampanya Geçmiş Veritabanı:**

- Tüm kampanyaların tam arşivi
- Kampanya sonuçları (kazanan/kaybeden)
- Süre istatistikleri
- Skor ilerlemeleri
- Katılımcı geçmişleri

**B. Bölge Zaman Çizelgesi:**

- Zaman içinde sistem sahipliği (animasyonlu harita)
- Alliance bölge büyüme/düşüş grafikleri
- Zaman içinde bölge kontrol yüzdesi
- Takımyıldız hakimiyet değişimleri
- "Kim ne zaman neyi kontrol etti" sorgulamaları

**C. Aylık/Yıllık Raporlar:**

- "Bu ay en fazla bölge kazanan 10 alliance"
- "Bu ay en fazla bölge kaybeden 10 alliance"
- En çok çekişmeli sistemler/bölgeler
- Kampanya sıklığı trendleri
- Aktif savaş dönemleri vs sakin dönemler

**D. Alliance Savaş Geçmişi:**

- Alliance başına tam savaş kaydı
- Kazanma/kaybetme kayıtları
- Geçmişte kazanılan/kaybedilen bölgeler
- Savaş katılım sıklığı
- Zaman içinde başarı oranları

**E. Sistem Geçmişi:**

- Sistem başına sahiplik geçmişi
- Sistemin kaç kez el değiştirdiği
- Ortalama sahiplik süresi
- Şimdiye kadarki en çok çekişmeli sistemler
- İstikrar skorları

**F. Mevsimsel Trendler:**

- Kış/yaz savaş aktivitesi farklılıkları
- Tatil döneminin etkileri
- Patch/genişleme sovereignty üzerindeki etkisi
- Oyuncu aktivite korelasyonu

**Teknik Uygulama:**

- Günlük anlık görüntüler kalıcı olarak saklanır
- Kampanya sonuçları takip edilir
- Verimli zaman serisi sorguları
- Performans için toplama tabloları
- Geçmiş analiz için veri ambarı

---

### 7. **Yapı Takibi**

Sovereignty yapılarının ve güvenlik açıklarının detaylı takibi.

**Özellikler:**

**A. Yapı Envanteri:**

- Tüm TCU ve IHUB'ların tam listesi
- Yapı başına sahip alliance
- Sistem/takımyıldız/bölge gruplandırması
- Yapı türü dökümü
- Kurulum tarihleri (takip edilebilirse)

**B. Güvenlik Açığı Programları:**

- Tüm yapılar için güvenlik açığı pencerelerini göster
- Haftalık program görünümü
- Günlük yaklaşan zamanlayıcılar
- Saat dilimine göre ayarlanmış görüntüler
- Takvim entegrasyonu

**C. Zamanlayıcı Panosu:**

- "Sonraki 24 saat" zamanlayıcı listesi
- Bölge/alliance/zamana göre sıralanabilir
- Geri sayım zamanlayıcıları
- Yapı önem puanlaması
- Geçmiş zamanlayıcı takibi

**D. Doluluk Takibi:**

- Yapı doluluk seviyeleri
- Güvenlik açığı seviye göstergeleri
- ADM (Activity Defense Multiplier) tahmini
- Doluluk trend takibi

**E. Yapı Geçmişi:**

- Yapı kurulum/yıkım olayları
- Sahiplik değişim geçmişi
- Bakım takibi
- Ömür boyu istatistikler

**Teknik Uygulama:**

- `/sovereignty/structures` endpoint'inden çek
- Güvenlik açığı pencere verilerini ayrıştır
- Yaklaşan zamanlayıcıları hesapla
- Yapı yaşam döngüsü olaylarını sakla
- Gerçek zamanlı geri sayım hesaplamaları

---

### 8. **Bölge/Takımyıldız Sıcak Bölgeler**

Null-sec uzayının çatışma ağırlıklı alanlarını tanımla ve analiz et.

**Özellikler:**

**A. Çatışma Yoğunluğu Haritalama:**

- En aktif kampanyalara sahip bölgeleri tanımla
- Takımyıldız seviyesinde çatışma takibi
- Sistem tehlike derecelendirmeleri
- Çatışma yoğunluğu ısı haritaları

**B. En Çok Çekişmeli Alanlar:**

- Sık sovereignty değişiklikleri olan bölgeler
- Sık el değiştiren sistemler
- Büyük güçler arasındaki sınır bölgeleri
- Kıvılcım noktası tanımlama

**C. Aktivite Korelasyonu:**

- Sovereignty savaşları + killmail aktivitesi
- Aktif kampanyalara sahip yüksek kill sistemleri
- Savaş yoğunluğu vs sovereignty istikrarı
- Güvenli vs tehlikeli null-sec bölgeleri

**D. Stratejik Önem:**

- Boğaz noktası sistem tanımlama
- Bölgesel kapılar ve bağlantılar
- Stratejik değer puanlaması
- Alliance hazırlık sistem tanımlama

**E. Risk Değerlendirmesi:**

- Aktiviteye dayalı seyahat güvenlik derecelendirmeleri
- Tehlikeli rota vurgulama
- Güvenli geçiş tanımlama
- Gerçek zamanlı tehlike güncellemeleri

**Teknik Uygulama:**

- Kampanyaları bölge/takımyıldıza göre topla
- Killmail verileriyle birleştir
- Çatışma metriklerini hesapla
- Isı haritası verileri oluştur
- Gerçek zamanlı risk puanlama

---

## 💡 **Hızlı Kazanım Özellikleri:**

Bu özellikler yüksek etkiyle hızlı bir şekilde uygulanabilir:

### 1. **Kontrol Edilen Sistemlere Göre En İyi 10 Alliance**

- Sovereignty harita verilerinin basit toplanması
- Sistem sayısına göre sıralama
- Alliance isimleri ve logoları ile göster
- Günlük güncelleme

### 2. **Bölgeye Göre Aktif Savaş Sayısı**

- Bölge başına kampanyaları say
- Basit görselleştirme (çubuk grafik)
- Gerçek zamanlı güncellemeler
- "Şu anda en sıcak bölgeler"

### 3. **En Agresif Alliance'lar**

- Alliance başına saldıran kampanyaları say
- Taarruzi aktiviteye göre sırala
- "En çok savaş başlatan kim"
- 7 günlük ve 30 günlük görünümler

### 4. **En Savunmacı Alliance'lar**

- Alliance başına savunma kampanyalarını say
- "En çok kim saldırı altında"
- Savunma sıklığı metrikleri

### 5. **Kuşatma Altındaki Sistemler**

- Aktif kampanyalara sahip tüm sistemleri listele
- Basit tablo görünümü
- Skor farkına göre sırala
- Detaylara hızlı erişim

### 6. **Kampanya Katılım Lider Tablosu**

- Alliance'ları kampanya katılımına göre say
- En aktif savaşanlar
- Katılım sıklığı

### 7. **Günlük Bölge Değişiklikleri**

- Bugün ve dün arasında basit fark
- Sahiplik değiştiren sistemleri listele
- Minimum hesaplama gereklidir

### 8. **Yapı Güvenlik Açığı Takvimi**

- Güvenlik açığı pencerelerini ayrıştır
- Takvim formatında göster
- Sonraki 7 gün görünümü
- Temel filtreleme

---

## 🔥 **Benzersiz Değer Teklifi:**

### Bu Özelliği Özel Kılan

**Başka kimsenin bu veri kombinasyonu yok:**
Kapsamlı killmail veritabanınız sovereignty verileriyle birleştirildiğinde, rakiplerin kopyalayamayacağı benzersiz istihbarat fırsatları yaratır.

### Benzersiz Analizler

**1. Savaş Sonucu Tahmin Motoru:**

- Makine öğrenimi modeli kullanarak:
  - Kampanyalar sırasında kill oranları
  - Taraf başına ISK verimliliği
  - Pilot katılım kalıpları
  - Geçmiş kampanya sonuçları
  - Gemi kompozisyon analizi
- Kampanya kazananlarını karar verilmeden önce tahmin et
- Tahminler için güven skorları
- Geçmiş tahmin doğruluğu takibi

**2. Gerçek Savaş Maliyet Hesaplayıcısı:**

- Kampanyalar sırasında kaybedilen gerçek ISK'yi hesapla
- Her iki tarafın kayıpları
- Ele geçirilen/savunulan sistem başına maliyet
- EVE tarihindeki en pahalı savaşlar
- Alliance başına maliyet verimliliği

**3. Savaş Etkinliği Metrikleri:**

- Sadece kampanya skorlarının ötesinde
- Gerçek savaşları kim kazanıyor
- Savaşlar sırasında Kill/death oranları
- Katılımcı başına ISK verimliliği
- Savaş ve sonuçlar arasında korelasyon

**4. Alliance Savaş Yetenek Profilleri:**

- Alliance başına detaylı dosya:
  - Tercih edilen savaş zamanları
  - Tipik filo büyüklükleri
  - Favori gemi kompozisyonları
  - Geçmiş kazanma oranları
  - Yoğun aktivite dönemleri
  - Sürdürülebilir savaş süresi
  - Savaşlardan sonra toparlanma süresi

**5. Katılımcı Etki Puanlama:**

- Kampanyalara bireysel alliance katkısı
- Savaş çabasını kim taşıyor
- Paralı asker etkinlik takibi
- Koalisyon koordinasyon metrikleri

**6. Stratejik İstihbarat:**

- Sistem savunma gücü profilleri
- Güvenlik açığı tanımlama
- İmparatorluk sınırlarındaki zayıf noktalar
- Optimal saldırı zamanlaması analizi

### Rekabet Avantajları

**vs zkillboard:**

- Onların kill'leri var, sizin kill'ler + sovereignty bağlamı var
- Savaşla ilgili kill filtreleme
- Kampanya performans analizleri

**vs EVE-maps siteleri:**

- Onların haritaları var, sizin haritalar + savaş verileri var
- Gerçek sahiplik gücü (sadece sovereignty değil)
- Tahmine dayalı analizler

**vs dotlan:**

- Onların sovereignty'si var, sizin sovereignty + savaş istihbaratı var
- Gerçek savaş etki metrikleri
- Maliyet hesaplamaları

**Sadece siz cevaplayabilirsiniz:**

- "Alliance'ım bu savaşı kazanıyor mu?"
- "Bu kampanyada ne kadar ISK yok ediliyor?"
- "Hangi alliance sov savaşlarında en sert savaşıyor?"
- "Bu sistemi ele geçirmenin yatırım getirisi nedir?"
- "EVE'deki en iyi sov savaş savaşçıları kimler?"

---

## 📊 **Veri Şeması Önerileri:**

### Gerekli Veritabanı Tabloları ve İlişkiler

```prisma
// Sovereignty Kampanya Geçmişi
model SovereigntyCampaign {
  id                  Int       @id @default(autoincrement())
  campaign_id         Int       @unique
  constellation_id    Int
  solar_system_id     Int
  structure_id        BigInt
  defender_id         Int?
  attackers_score     Float
  defender_score      Float
  event_type          String    // tcu_defense, ihub_defense, vb.
  start_time          DateTime
  end_time            DateTime? // hala aktifse null
  outcome             String?   // defender_won, attacker_won, abandoned
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  // İlişkiler
  participants        CampaignParticipant[]
  relatedKillmails    Killmail[] @relation("CampaignKillmails")
  solarSystem         SolarSystem @relation(fields: [solar_system_id], references: [system_id])

  @@index([solar_system_id, start_time])
  @@index([campaign_id])
  @@index([end_time])
}

// Kampanya Katılımcıları
model CampaignParticipant {
  id                  Int       @id @default(autoincrement())
  campaign_id         Int
  alliance_id         Int
  score               Float
  created_at          DateTime  @default(now())

  campaign            SovereigntyCampaign @relation(fields: [campaign_id], references: [campaign_id])
  alliance            Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@unique([campaign_id, alliance_id])
  @@index([alliance_id])
}

// Sovereignty Harita Geçmişi (Günlük Anlık Görüntüler)
model SovereigntyMapSnapshot {
  id                  Int       @id @default(autoincrement())
  system_id           Int
  alliance_id         Int?
  corporation_id      Int?
  faction_id          Int?
  snapshot_date       DateTime
  created_at          DateTime  @default(now())

  solarSystem         SolarSystem @relation(fields: [system_id], references: [system_id])

  @@unique([system_id, snapshot_date])
  @@index([snapshot_date])
  @@index([alliance_id, snapshot_date])
}

// Mevcut Sovereignty Haritası (Sık güncellenir)
model SovereigntyMapCurrent {
  id                  Int       @id @default(autoincrement())
  system_id           Int       @unique
  alliance_id         Int?
  corporation_id      Int?
  faction_id          Int?
  last_updated        DateTime  @updatedAt

  solarSystem         SolarSystem @relation(fields: [system_id], references: [system_id])

  @@index([alliance_id])
}

// Sovereignty Yapıları
model SovereigntyStructure {
  id                              Int       @id @default(autoincrement())
  structure_id                    BigInt    @unique
  solar_system_id                 Int
  structure_type_id               Int
  alliance_id                     Int
  vulnerability_occupancy_level   Float?
  vulnerable_start_time           DateTime?
  vulnerable_end_time             DateTime?
  last_seen                       DateTime  @updatedAt
  created_at                      DateTime  @default(now())
  destroyed_at                    DateTime? // Yapının ne zaman yok edildiğini takip et

  solarSystem                     SolarSystem @relation(fields: [solar_system_id], references: [system_id])
  alliance                        Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@index([solar_system_id])
  @@index([alliance_id])
  @@index([vulnerable_start_time])
}

// Alliance Bölge İstatistikleri (Günlük Toplanmış)
model AllianceTerritoryStats {
  id                      Int       @id @default(autoincrement())
  alliance_id             Int
  date                    DateTime
  systems_controlled      Int
  tcu_count               Int
  ihub_count              Int
  campaigns_attacking     Int
  campaigns_defending     Int
  systems_gained_today    Int
  systems_lost_today      Int
  created_at              DateTime  @default(now())

  alliance                Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@unique([alliance_id, date])
  @@index([date])
  @@index([systems_controlled])
}

// Bölge Değişiklikleri Logu
model TerritoryChange {
  id                  Int       @id @default(autoincrement())
  system_id           Int
  previous_owner_id   Int?      // alliance_id
  new_owner_id        Int?      // alliance_id
  change_type         String    // captured, lost, abandoned
  detected_at         DateTime  @default(now())

  solarSystem         SolarSystem @relation(fields: [system_id], references: [system_id])

  @@index([system_id, detected_at])
  @@index([previous_owner_id])
  @@index([new_owner_id])
}

// Kampanya Savaş İstatistikleri (Kampanya başına toplanmış)
model CampaignCombatStats {
  id                      Int       @id @default(autoincrement())
  campaign_id             Int       @unique
  alliance_id             Int
  total_kills             Int
  total_losses            Int
  isk_destroyed           BigInt
  isk_lost                BigInt
  pilots_participated     Int
  ships_destroyed         Int
  updated_at              DateTime  @updatedAt

  campaign                SovereigntyCampaign @relation(fields: [campaign_id], references: [campaign_id])
  alliance                Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@index([campaign_id])
  @@index([alliance_id])
}
```

### Mevcut Tablolara Ek Değişiklikler

```prisma
// Mevcut Killmail modeline ekle
model Killmail {
  // ... mevcut alanlar ...

  // Sovereignty entegrasyonu için yeni alanlar
  related_campaign_id   Int?
  is_war_related        Boolean @default(false)

  campaign              SovereigntyCampaign? @relation("CampaignKillmails", fields: [related_campaign_id], references: [campaign_id])

  @@index([related_campaign_id])
  @@index([is_war_related])
}
```

---

## 🚀 **Uygulama Önceliği & Yol Haritası:**

### **Faz 1 - Temel (Hafta 1-2):**

**Hedefler:** Veri hattı ve temel altyapıyı kur

**Görevler:**

1. ✅ ESI endpoint'leri ile sovereignty servisi oluştur (TAMAMLANDI)
2. Sovereignty tabloları için veritabanı şeması oluştur
3. Sovereignty verilerini çekmek için cron worker'ları kur:
   - `/sovereignty/campaigns` - Her 5 dakikada
   - `/sovereignty/map` - Her 30 dakikada
   - `/sovereignty/structures` - Her 30 dakikada
4. Geçmiş veriler için günlük anlık görüntü worker'ı oluştur
5. Temel veri modelleri ve Prisma şeması
6. İlk veri doldurma scriptleri

**Teslimatlar:**

- Veritabanına akan sovereignty verileri
- Oluşturulan geçmiş anlık görüntüler
- Temel altyapı hazır

---

### **Faz 2 - Hızlı Kazanımlar (Hafta 3-4):**

**Hedefler:** Kullanıcıya yönelik özellikleri hızlıca gönder

**Uygulanacak Özellikler:**

1. **Alliance Bölge Sıralamaları**
   - Kontrol edilen sistemlere göre en iyi 25 alliance
   - Basit lider tablosu sayfası
   - Günlük güncellemeler

2. **Aktif Kampanya Listesi**
   - Tüm mevcut sovereignty savaşlarını göster
   - Temel bilgiler (sistemler, alliance'lar, skorlar)
   - Basit tablo görünümü

3. **Bölge Haritası Görünümü**
   - Mevcut sovereignty'yi gösteren statik harita
   - Alliance'lara göre renk kodlu
   - Bölge/takımyıldız dökümü

4. **Günlük Bölge Değişiklikleri**
   - "Bugün ne değişti" sayfası
   - El değiştiren sistemler
   - Yeni başlayan kampanyalar

**Teknik:**

- Sovereignty verileri için GraphQL sorguları
- Temel resolver'lar
- Görüntüler için frontend bileşenleri
- Basit önbellekleme stratejisi

**Teslimatlar:**

- 4 yeni kullanıcıya yönelik sayfa
- Temel sovereignty görünürlüğü
- Gelişmiş özellikler için temel

---

### **Faz 3 - Gelişmiş Entegrasyon (Hafta 5-8):**

**Hedefler:** Benzersiz killmail + sovereignty özelliklerini uygula

**Uygulanacak Özellikler:**

1. **Savaş Bölgesi Kill Takibi**
   - Killmail'leri kampanya bağlamıyla etiketle
   - Verileri ilişkilendirmek için arka plan worker'ı
   - Killmail sayfalarında "Savaş kill'leri" filtresi
   - Savaşla ilgili kill'ler için özel rozetler

2. **Kampanya Savaş Panosu**
   - Kampanya başına istatistikler
   - Her tarafça yok edilen ISK
   - Katılımcı performans metrikleri
   - Savaş zaman çizelgesi görselleştirmesi

3. **Alliance Savaş Performansı**
   - Alliance başına geçmiş savaş istatistikleri
   - Kazanma/kaybetme kayıtları
   - Maliyet analizi
   - Savaş etkinliği metrikleri

4. **Yapı Kill Takibi**
   - Yapı kill'leri için ayrı takip
   - Kampanyalara atıf
   - Yapı yıkım geçmişi

**Teknik:**

- Karmaşık toplama sorguları
- Korelasyon için arka plan worker'ları
- Gelişmiş önbellekleme stratejileri
- Performans optimizasyonu

**Teslimatlar:**

- Başka kimsenin olmayan benzersiz analizler
- Killmail veritabanı tamamen entegre
- Savaş istihbarat özellikleri

---

### **Faz 4 - Geçmiş & Tahmine Dayalı (Hafta 9-12):**

**Hedefler:** Gelişmiş analizler ve istihbarat

**Uygulanacak Özellikler:**

1. **Geçmiş Analiz Panosu**
   - Bölge zaman çizelgesi grafikleri
   - Alliance büyüme/düşüş takibi
   - Aylık/yıllık raporlar
   - Kampanya geçmişi tarayıcısı

2. **Bölge Değişikliği Görselleştirmesi**
   - Zaman içinde değişiklikleri gösteren animasyonlu harita
   - Büyük savaşlar için "Tekrar oynat" özelliği
   - Bölgesel kontrol yüzdesi grafikleri

3. **Savaş Sonucu Tahmini** (MVP)
   - Basit tahmin modeli
   - Kill oranlarına dayalı
   - Güven puanlaması
   - Tahmin doğruluğunu takip et

4. **Sıcak Bölgeler & Risk Değerlendirmesi**
   - Çatışma yoğunluğu ısı haritaları
   - Seyahat güvenlik derecelendirmeleri
   - Tehlikeli sistem tanımlama

**Teknik:**

- Zaman serisi veri görselleştirmesi
- Tahminler için temel ML modeli
- Karmaşık toplama sorguları
- Veri görselleştirme kütüphaneleri

**Teslimatlar:**

- Geçmiş veriler tam olarak kullanıldı
- Tahmine dayalı özellikler başlatıldı
- Gelişmiş istihbarat araçları

---

### **Faz 5 - Kullanıcı Katılımı (Hafta 13-16):**

**Hedefler:** Kullanıcıların tekrar gelmesini sağla

**Uygulanacak Özellikler:**

1. **Bildirim Sistemi**
   - Uyarı tercih yönetimi
   - E-posta/uygulama içi bildirimler
   - Favori alliance takibi
   - Kampanya güncellemeleri

2. **İnteraktif Harita**
   - Keşfetmek için tıklama arayüzü
   - Alliance/bölgeye göre filtrele
   - Gerçek zamanlı güncellemeler
   - Sistem detaylarına zoom

3. **Zamanlayıcı Panosu**
   - Yaklaşan yapı zamanlayıcıları
   - Geri sayım gösterileri
   - Takvim entegrasyonu
   - Dışa aktarma işlevselliği

4. **Özel Panolar**
   - Kullanıcı tarafından yapılandırılabilir widget'lar
   - Alliance'a özel görünümler
   - Bölge izleme listeleri
   - Kişisel savaş takipçisi

**Teknik:**

- Bildirim kuyruk sistemi
- Gerçek zamanlı güncellemeler için WebSocket
- İnteraktif harita kütüphanesi (örn. Leaflet)
- Kullanıcı tercih depolama

**Teslimatlar:**

- İlgi çekici kullanıcı deneyimi
- Tekrar ziyaret tetikleyicileri
- Kişiselleştirme özellikleri

---

### **Faz 6 - Cilalama & Para Kazanma (Hafta 17-20):**

**Hedefler:** Özellikleri iyileştir ve gelir oluştur

**Uygulanacak Özellikler:**

1. **Premium Analizler**
   - Gelişmiş savaş tahminleri
   - Daha derin geçmiş veri erişimi
   - Dışa aktarma yetenekleri
   - API erişimi

2. **Alliance Liderlik Araçları**
   - Bölge yönetim panosu
   - Üye savaş katılım takibi
   - Stratejik planlama araçları
   - Performans raporları

3. **Mobil Uygulama**
   - Push bildirimleri
   - Zamanlayıcılara hızlı erişim
   - Savaş durumu kontrolü
   - Çevrimdışı destek

4. **Üçüncü Taraf Entegrasyonları**
   - Discord botu
   - Harici araçlar için API
   - Webhook desteği
   - RSS beslemeleri

**Teknik:**

- Ödeme entegrasyonu
- API hız sınırlama
- Mobil geliştirme
- Discord bot framework'ü

**Teslimatlar:**

- Gelir akışları kuruldu
- Mobil varlık
- Ekosistem entegrasyonları

---

## 💰 **Para Kazanma Fırsatları:**

### **Ücretsiz Katman:**

- Temel sovereignty haritası
- Mevcut kampanya listesi
- En iyi 10 sıralaması
- Son 7 günlük veriler
- Sınırlı bildirimler

### **Premium Katman ($5-10/ay):**

- Gelişmiş savaş analizleri
- Sınırsız geçmiş veriler
- Özel uyarılar ve bildirimler
- Savaş sonucu tahminleri
- Veri dışa aktarma yetenekleri
- Reklamsız deneyim
- Öncelikli veri güncellemeleri

### **Alliance/Corp Katmanı ($20-50/ay):**

- Alliance yönetim panosu
- Üye katılım takibi
- Bölge analizleri
- Stratejik planlama araçları
- Savaş performans raporları
- Özel markalama
- Birden fazla kullanıcı hesabı

### **API Erişim Katmanı ($50-100/ay):**

- REST API erişimi
- Gerçek zamanlı veri beslemeleri
- Webhook entegrasyonları
- Daha yüksek hız limitleri
- Ticari kullanım hakları
- Öncelikli destek

### **Kurumsal/Araç Geliştiriciler:**

- Sınırsız API erişimi
- Özel endpoint'ler
- Özel destek
- Beyaz etiket seçenekleri
- Özel veri işleme

---

## 📈 **Başarı Metrikleri:**

### **Kullanıcı Katılımı:**

- Sovereignty verilerini görüntüleyen günlük aktif kullanıcılar
- Sovereignty sayfalarında geçirilen süre
- Tekrar ziyaret oranı
- Özellik kullanım istatistikleri

### **Teknik Metrikler:**

- API yanıt süreleri
- Veri tazeliği (gecikme süresi)
- Önbellek isabet oranları
- Arka plan iş başarı oranları

### **İş Metrikleri:**

- Premium dönüşüm oranı
- Kullanıcı başına gelir
- Müşteri elde tutma oranı
- API benimseme oranı

### **İçerik Metrikleri:**

- Takip edilen toplam kampanyalar
- Geçmiş veri derinliği
- Tahmin doğruluk oranı
- Kapsama eksiksizliği

---

## 🎯 **Anahtar Performans Göstergeleri (KPI'lar):**

### **Ay 1-3:**

- Sovereignty verilerini görüntüleyen 1.000+ kullanıcı
- %100 veri kapsamı (tüm sistemler takip ediliyor)
- < 10 dakika veri gecikmesi
- 4+ hızlı kazanım özelliği gönderildi

### **Ay 4-6:**

- 5.000+ aktif sovereignty kullanıcısı
- 100+ premium abone
- Killmail entegrasyonu tamamlandı
- %60+ doğrulukta tahmin modeli

### **Ay 7-12:**

- 20.000+ aktif kullanıcı
- 500+ premium abone
- 50+ Alliance katman abonesi
- 10+ API müşterisi
- Mobil uygulama başlatıldı

---

## 🔧 **Teknik Değerlendirmeler:**

### **Veri Hacmi Tahminleri:**

- ~8.000 null-sec sistem
- Herhangi bir zamanda ~50-100 aktif kampanya
- ~15.000-20.000 yapı
- Günlük anlık görüntüler = 8KB/gün
- Kampanya verisi = kampanya başına ~5KB
- Yıllık depolama ≈ 50-100 GB

### **API Hız Sınırlama:**

- ESI 150 istek/saniye (burst) sağlar
- Düzenli olarak yoklanan ~3 endpoint gerekli
- Bütçe: Her 5-10 dakikada sovereignty senkronizasyonu çalıştır
- Hız limitleri içinde rahatça

### **Performans Optimizasyonu:**

- Sovereignty haritasını önbellekle (30 dakika TTL)
- Kampanyaları önbellekle (5 dakika TTL)
- İstatistikleri günlük olarak önceden topla
- Sık sorgulanan alanlarda indeks
- Karmaşık sorgular için materialized view kullan

### **Ölçeklenebilirlik:**

- Sovereignty verileri nispeten küçük
- Killmail korelasyonu ağır işlem
- Toplama için arka plan worker'ları kullan
- Pahalı hesaplamalar için kuyruk sistemi
- Analizler için okuma replikaları düşün

---

## 🚨 **Potansiyel Zorluklar:**

### **Veri Tazeliği vs Performans:**

- **Zorluk:** Gerçek zamanlı güncellemeler pahalı
- **Çözüm:** Aktif kampanyalar için kısa TTL'li, geçmiş veriler için daha uzun akıllı önbellekleme

### **Killmail Korelasyon Karmaşıklığı:**

- **Zorluk:** Milyonlarca killmail'i kampanyalarla eşleştirme
- **Çözüm:** System_id ve timestamp ile indeksle, toplu işleme, artımlı güncellemeler

### **Tahmin Modeli Doğruluğu:**

- **Zorluk:** Kampanya sonuçlarını çok faktör etkiler
- **Çözüm:** Basit başla, sonuçlara göre tekrarla, doğruluk konusunda şeffaf ol

### **Geçmiş Veri Depolama:**

- **Zorluk:** Günlük anlık görüntüler zaman içinde birikir
- **Çözüm:** Eski verileri sıkıştır, cold storage'a arşivle, mümkün olduğunda topla

### **Kullanıcı Gizliliği & Alliance İstihbaratı:**

- **Zorluk:** Hassas savaş bilgileri
- **Çözüm:** Sadece public veriler, hassas özellikleri geciktir, isteğe bağlı özel panolar

---

## 📚 **Dokümantasyon İhtiyaçları:**

### **Kullanıcı Dokümantasyonu:**

- "EVE'de Sovereignty'yi Anlamak"
- "Kampanya İstatistiklerini Nasıl Okursunuz"
- "Savaş Tahminlerini Yorumlama"
- "Alliance Bölge Analitikleri Rehberi"
- SSS ve sözlük

### **API Dokümantasyonu:**

- Endpoint referansı
- Kimlik doğrulama rehberi
- Hız sınırlama politikaları
- Örnek entegrasyonlar
- Webhook kurulum rehberi

### **Geliştirici Dokümantasyonu:**

- Veritabanı şema dokümanları
- Arka plan worker mimarisi
- Cron iş programları
- Önbellekleme stratejisi
- Performans optimizasyon rehberi

---

## 🎓 **Gerekli Öğrenme Kaynakları:**

### **EVE Oyun Mekanikleri:**

- Sovereignty 3.0 sistem derin dalış
- Activity Defense Multiplier (ADM)
- Entosis Link mekanikleri
- Yapı güvenlik açıkları
- Kampanya puanlama sistemi

### **Teknik Kaynaklar:**

- ESI sovereignty endpoint dokümantasyonu
- Hız sınırlama en iyi uygulamaları
- Zaman serisi veri işleme
- Sonuç tahmini için ML
- Gerçek zamanlı bildirim mimarisi

---

## 🤝 **Topluluk Katılımı:**

### **Beta Testi:**

- Aktif null-sec oyuncularını işe al
- Alliance liderlik geri bildirimi
- Savaş koordinatörü girdisi
- Üçüncü taraf geliştirici geri bildirimi

### **Lansman Stratejisi:**

- r/Eve'de duyur
- Alliance forumlarına gönder
- Büyük null-sec alliance'larla iletişime geç
- EVE içerik üreticileriyle koordine ol
- Benzersiz özellikleri vurgula

### **Geri Bildirim Döngüleri:**

- Kullanıcı geri bildirim formu
- Discord topluluğu
- Düzenli özellik anketleri
- Alliance temsilci programı
- Bug bounty programı

---

## 📝 **Sonraki Adımlar:**

1. **İncele ve Önceliklendir**: Bu belgeyi incele ve önce hangi özellikleri uygulayacağını seç
2. **Veritabanı Tasarımı**: Sovereignty tabloları için Prisma şemasını sonlandır
3. **Worker Kurulumu**: ESI veri toplama için arka plan worker'ları oluştur
4. **Hızlı Kazanımlar**: Hızlı kullanıcı değeri için Faz 2 özelliklerini uygula
5. **Entegrasyon**: Killmail + sovereignty korelasyon işine başla
6. **Topluluk**: Geri bildirim için EVE topluluğuyla yol haritasını paylaş

---

Bu kapsamlı plan, mevcut killmail verilerinizi başka kimsenin eşleşemeyeceği şekillerde kullanan dünya standartlarında bir sovereignty takip ve analiz platformu oluşturmak için ihtiyacınız olan her şeyi size vermelidir.
