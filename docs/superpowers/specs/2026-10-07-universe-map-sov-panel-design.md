# Evren haritası — sov paneli, campaign timer'ları ve `/sovereignty/map`'in emekliliği

**Tarih:** 2026-10-07
**Durum:** tasarım, incelemeye hazır
**Üzerine kurulduğu iş:** #232 (katman sistemi ve sovereignty katmanı), #233 (popup'ta sahip ve stargate'ler)

---

## 1. Neden

İki sov haritası var ve biri geride kaldı.

- **`/sovereignty/map`** ECharts ile çizilmiş düz bir nokta grafiği: yalnızca
  sov tutulan sistemler, ilk 15 alliance'a kendi paletinden renk, gerisi gri
  "Other", bir region seçici ve legend'dan izolasyon. Gate yok, logo yok, popup
  yok; renkleri `sovColors.ts`'teki 101 renklik tabloyla uyuşmuyor.
- **`/map`**'in sov katmanı (#232) bunların neredeyse hepsini daha iyi yapıyor:
  101 sahibin rengi, yakınlaşınca logolar, iç gate'lerin sahip rengi, sahip
  legend'ı, popup'ta sahip.

Hedef kullanıcı FC: bir CTA ya da stratejik fleet öncesinde **hangi sistemde ne
zaman timer düşüyor** haritada tek bakışta görülsün, geri sayım haritanın
üstünde aksın, ve FC o timer'ın linkini kopyalayıp ping'e yapıştırabilsin.

Bu iş o özellikleri ayrı bir sayfaya değil, **`/map`'in sov katmanına** koyuyor
ve `/sovereignty/map`'i emekliye ayırıyor. İlk düşünülen "ayrı sayfa, aynı
motor" yolu `UniverseMap`'e yalnızca aynı haritayı ikinci bir adreste kurmak
için dış bir API (katman kilidi, kontrollü focus ve seçim) eklemeyi
gerektiriyordu; tek harita hem daha az kod hem daha az kavram.

---

## 2. URL ve giriş noktaları

### 2.1 Katman URL'ye giriyor

`UniverseMap.tsx:85` katmanı bilerek component state'inde tutuyor; gerekçesi
"paylaşılan linkin taşıması gereken şey, gönderenin o an hangi boyamaya
baktığı değil" idi. FC kullanımında bu artık doğru değil: sov katmanı kapalı
açılan bir timer linki işe yaramaz. O satır ve yorumu bu işte değişiyor.

- `utils/map/camera.ts`: `parseLayer(params): MapLayerId`. `sovereignty`
  dışındaki her değer — yokluğu dahil — `security`.
- `utils/map/camera.ts`: `parseOwner(params): number | null`, `parseId` ile
  aynı kural (pozitif tam sayı, başka hiçbir şey).
- `cameraQuery(scope, camera, focus, layer, owner)`. `layer` ve `owner`,
  `focus` gibi **zorunlu ve varsayılansız**: kamera her pan'de yazılıyor ve
  bir argümanı unutan bir yazım onu URL'den siler; derleyici bunu engeller.
  - `layer === 'security'` yazılmaz — bugünkü her link aynen kalır.
  - `owner` yalnızca `layer === 'sovereignty'` iken yazılır; security
    katmanında izolasyonun anlamı yok.
- Katman ve sahip state'i `useMapCamera`'ya taşınır; hook `layer`,
  `onLayerChange`, `owner`, `onOwnerChange` da döndürür. Ayrı bir hook olmaz:
  URL'yi iki ayrı yer `router.replace` ile yazarsa biri diğerinin yazdığını
  ezer, ve hook'un "kendi yazdığını başkasınınkinden ayırma" mekanizması
  (`lastWritten`) tam bu yarışı çözmek için var.
- Katman ve sahip değişimi, popup tıklaması gibi **anında** yazılır; debounce
  yalnızca pan için.
- Security katmanına geçiş `owner`'ı temizler.

### 2.2 `/sovereignty/map` kalkıyor

- `app/sovereignty/map/page.tsx` sunucu tarafında
  `redirect('/map?layer=sovereignty')` yapar; eski linkler ve yer imleri
  çalışmaya devam eder.
- `components/Header/navItems.ts`'te SOVEREIGNTY > MAP ve
  `app/sovereignty/page.tsx`'teki düğme doğrudan `/map?layer=sovereignty`'ye
  gider.
- `/map`'te menüde UNIVERSE yanar. Bu doğru: sayfa artık aynı sayfa.
  `navActive` path'e bakar, query'ye bakmaz; değişmiyor.
  `navActive.spec.ts`'teki `/sovereignty/map` örneği sayfa kalmasa da
  geçerli bir path eşleştirme testi olarak kalır.

### 2.3 Paylaşım linki

`/map?layer=sovereignty&focus=<systemId>`. `focus` zaten kamerayı sisteme
çerçeveliyor ve popup'ı açıyor; yeni olan yalnızca linki kopyalayan düğme
(§4 ve §3.4). İzole edilmiş bir sahip varsa `&owner=<id>` de taşınır.

Kopyalanan link tam URL'dir (`window.location.origin` + path); kamera
parametreleri (`x`, `z`, `zoom`) **yazılmaz**, böylece link alıcının ekran
boyutuna göre sisteme çerçevelenir.

---

## 3. Haritadaki işaretler

### 3.1 Campaign halkası (Pixi)

- Aktif campaign'i olan her sistemin çevresinde bir halka. Kalınlığı ve
  sistem noktasıyla arasındaki boşluk her zoom'da sabit piksel; yarıçapı
  `systemRadiusPx` ile büyür — label boşluğunun kullandığı kuralın aynısı,
  böylece halka ve label bir sistemin ne kadar büyük çizildiği konusunda
  anlaşır.
- İki durum: `startTime` henüz gelmemişse **accent**, gelmişse (LIVE)
  **danger**.
- Animasyon yok. Pixi ticker'ı bugün sahnede kullanılmıyor; yanıp sönen bir
  halka onu yalnızca bunun için ayağa kaldırırdı.
- Tek bir `Graphics`, `scene/campaignRings.ts`'te. Yalnızca sov katmanı
  açıkken görünür. Campaign verisi değişince yeniden çizilir; kamera
  değişince yalnızca ölçeği güncellenir (sistem sprite'larının
  counter-scale'iyle aynı effect sırasında).

### 3.2 Geri sayım çipleri (DOM)

Label katmanı (`labels/labelLayer.ts`) her ismi bir kez yazıp havuzdan yeniden
kullanıyor — "bir key'in metni değişmez". Her saniye değişen metin oraya
girmez; çipler **kendi overlay'inde** (`labels/chipLayer.ts`) yaşar, label
katmanıyla aynı teknikle: havuzlanmış elementler, kamera değişiminde yalnızca
`transform` yazılır.

**Metin**, `utils/map/countdown.ts`'te saf fonksiyon:

| Kalan süre       | Biçim                        |
| ---------------- | ---------------------------- |
| ≥ 24 saat        | `1DQ1-A · IHub · 1d 4h`      |
| 1 saat – 24 saat | `1DQ1-A · IHub · 2h 14m`     |
| < 1 saat         | `1DQ1-A · IHub · 42:10`      |
| başladı          | `1DQ1-A · IHub · LIVE 62–38` |

- Tür adı `eventType`'tan: `ihub_defense` → `IHub`, `tcu_defense` → `TCU`,
  `station_defense` → `Station`, tanınmayan → ham değer.
- LIVE skorları `defenderScore`–`attackersScore`, yüzde olarak, tam sayıya
  yuvarlanmış. Skor yoksa yalnızca `LIVE`.
- **Saat:** 1 saatten fazla kalan çiplerin metni dakikada bir, 1 saatten az
  kalanlarınki saniyede bir yenilenir. Bir `setInterval` (1 s) yeter; dakikalık
  biçimin metni zaten dakikada bir değişir ve değişmeyen metni yazmak bir
  `textContent` karşılaştırmasıyla atlanır.

**Yerleştirme**, `utils/map/campaignChips.ts`'te saf fonksiyon:

- Öncelik timer'a kalan süre: en yakın önce, LIVE olanlar en önde.
- Çipler sistem isimlerinden **önce** yerleşir. Çakışan çip gizlenir; halkası
  kalır, ve panel (§4) her timer'ı listeler. Aynı region'daki timer'ları tek
  çipte toplamak değerlendirildi ve reddedildi.
- Çipi yerleşen sistemin kendi isim label'ı çizilmez — çip ismi taşıyor.
- Yerleşen çiplerin kutuları `placeLabels`'a dolu alan olarak verilir;
  sistem, constellation ve region isimleri çiplerin üstüne binmez.
- Çipler her zoom'da görünür (galaksi dahil); timer'ın varlığı zoom'dan
  bağımsız bir bilgi.

### 3.3 Sahip izolasyonu

- `MapLayerData` bir `isolatedOwner: number | null` alanı kazanır.
- Sov katmanının `tint` ve `edgeTint` fonksiyonları (`utils/map/layers.ts`)
  buna bakar: izole edilen sahibin sistemleri ve iç gate'leri kendi renginde,
  diğer sahiplerinkiler `SOV_UNOWNED_TINT`'e söner.
- Logo geçişi izole edilmeyen sahiplerin sistemlerinde logo çizmez, noktada
  kalır (`applyLogos`'a geçen sahip haritası filtrelenir).
- Kamera izolasyonla **kendiliğinden gitmez**. Sahibin sistemlerini çerçeveleme
  Owners satırında ayrı bir eylem (§4.1): izole edip kendi bölgende kalmak
  isteyebilirsin.
- Halkalar ve çipler izolasyondan etkilenmez — kendi alliance'ını izole etmiş
  bir FC başkasının timer'ını kaçırmamalı.

### 3.4 Popup

`SystemPopup`'a:

- Sistemde aktif bir campaign varsa bir campaign satırı: tür, geri sayım ya da
  LIVE skorları — §3.2'deki aynı `countdown` fonksiyonu.
- **Linki kopyala** düğmesi, her sistemde (campaign'i olmayanlarda da),
  `navigator.clipboard.writeText` ile; kopyalandığında kısa bir "Copied"
  geri bildirimi. Link §2.3'teki biçimde, haritanın o anki katmanı ve sahibiyle.

---

## 4. Sov paneli

**Yeri:** bugün `SovLegend`'ın durduğu yer — sol üstteki overlay'de, katman
düğmesinin altında. Panel legend'ın yerini alır (`SovPanel.tsx`); haritada iki
sahip listesi olmaz. Genişlik `w-56` yerine `w-72`: timer satırları daha
uzun. Daraltılabilir yapı, "harita üstünde kendi içinde kayan liste" davranışı
ve `data-map-overlay` işareti aynen korunur.

**Varsayılan sekme Timers.** Sekme component state'inde, URL'de değil:
paylaşılan link sistemi ve sahibi taşır, panelin hangi sekmede olduğu bir
tercih. Mobilde (`sm` altı) panel daraltılmış başlar.

### 4.1 Owners

- Bugünkü legend satırı (renk diski, arma, isim) ve sağında sistem sayısı.
  Sıralama `systemCount`'a göre, çok olan üstte.
- Satıra tıklamak sahibi izole eder; izole edilmiş satıra tekrar tıklamak
  kaldırır. Satır bir toggle olduğu için `aria-pressed` taşır ve `buttons.css`'teki `.button[aria-pressed='true']` görünümünü alır.
- Satırın sağında küçük bir düğme sahibin sistemlerini çerçeveler: kamera,
  sahibin tüm sistemlerinin sınır kutusuna `fitCamera` ile oturur.
- Veri kaynağı `mapSovereignty.owners`, **`allianceTerritoryRankings` değil**:
  liste haritanın boyadığı sahiplerle — faction'lar dahil — birebir aynı olmalı.

### 4.2 Timers

- Aktif campaign'ler, timer'ı en yakın olan üstte; LIVE olanlar en üstte.
- Satır: sistem adı, region, savunan (ticker), tür, geri sayım ya da LIVE
  skorları, linki kopyala düğmesi.
- Satıra tıklamak `focus`'u o sisteme yazar: kamera gider, popup açılır.
- Boşsa: "No active campaigns".

### 4.3 Changes

- `recentTerritoryChanges`, en yeni üstte.
- Satır: sistem adı, eski → yeni sahip, ne kadar önce (`calculateAge` /
  mevcut tarih yardımcıları).
- Satıra tıklamak o sisteme odaklar.
- Boşsa: "No recent changes".

### 4.4 Bayat veri

Campaign worker'ı dakikada bir çalışır. En yeni `updatedAt` **10 dakikadan**
eskiyse Timers sekmesinin başında küçük bir not görünür:
"Data as of 2026-09-12 14:33 EVE". Geri sayımlar yine gösterilir — not,
FC'ye onlara ne kadar güvenebileceğini söyler. Eşik `countdown.ts`'te bir
sabit ve test edilir.

---

## 5. Veri ve backend

### 5.1 Backend

- `SovereigntyCampaign` tipine `updatedAt: String!`; `enrichCampaigns`
  mevcut `updated_at` sütununu ISO string'e eşler. Ardından backend ve
  frontend codegen.
- `config/cache.ts`: `'Query.sovereigntyActiveCampaigns': 60_000`. Bugün
  2 dakikalık `DEFAULT_PUBLIC`'e düşüyor; LIVE skorları için fazla.
- `sovereigntyMapPoints` sorgusu, şemadaki `SovMapPoint` tipi ve resolver'ı
  silinir — tek kullanıcısı ECharts haritasıydı.
- Campaign ve değişim resolver'ları Prisma'yı doğrudan çağırıyor. CLAUDE.md'ye
  göre bu bir borç, ama ilgisiz bir değişikliğin içinde servise taşınmaz;
  olduğu gibi kullanılır.

### 5.2 Frontend

- `useSovCampaigns(enabled)` ve `useSovChanges(enabled)`, `useMapSovereignty`
  ile aynı kalıpta: yalnızca sov katmanı açıkken sorgu atılır — security
  katmanındaki kullanıcı hiçbir şey indirmez.
- Campaign'ler sov katmanı açıkken `pollInterval: 60_000` ile yenilenir;
  yeni ve biten campaign'ler de, LIVE skorları da böyle güncel kalır.
  `SOVEREIGNTY_ALERT` subscription'ına bağlanmak değerlendirildi ve
  bırakıldı: response cache 60 saniyeye kadar eskiyi döndüreceği için anlık
  bir kazanç getirmiyor.
- Changes yalnızca sekme ilk açıldığında çekilir, poll edilmez.
- Yeni `.graphql` dokümanları `frontend/src/graphql/` altında.

### 5.3 Silinenler

- `frontend/src/components/Sovereignty/TerritoryMap.tsx`
- `frontend/src/graphql/SovereigntyMap.graphql`
- `frontend/src/components/UniverseMap/SovLegend.tsx` ve spec'i — içeriği
  `SovPanel`'in Owners sekmesine taşınır, testleri onunla birlikte.
- `echarts` paketi **kalır**: dört grafik bileşeni daha kullanıyor.

---

## 6. Dosya düzeni

`UniverseMap.tsx` bugün 841 satır; bu iş onu büyütmemeli. Mevcut kural
korunur: **karar veren her şey `utils/map/`'te saf ve testli, Pixi'ye yapılan
atamalar `scene/`'de ve testsiz.**

| Dosya                                           | İçerik                                                         |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `utils/map/camera.ts`                           | `parseLayer`, `parseOwner`, `cameraQuery`'nin yeni argümanları |
| `utils/map/layers.ts`                           | `isolatedOwner` ile tint ve edgeTint                           |
| `utils/map/countdown.ts`                        | metin biçimi, LIVE, bayatlık eşiği                             |
| `utils/map/campaignChips.ts`                    | çip yerleştirme, öncelik, bastırılan isim label'ları           |
| `components/UniverseMap/scene/campaignRings.ts` | halka `Graphics`'i                                             |
| `components/UniverseMap/labels/chipLayer.ts`    | çip overlay'i, havuz, `transform`                              |
| `components/UniverseMap/SovPanel.tsx`           | üç sekme                                                       |
| `components/UniverseMap/useSovCampaigns.ts`     | sorgu + poll                                                   |
| `components/UniverseMap/useSovChanges.ts`       | sorgu                                                          |
| `components/UniverseMap/useMapCamera.ts`        | layer ve owner'ı URL'de tutar                                  |

`UniverseMap.tsx`'e yalnızca hook çağrıları ve bu parçaların bağlanması
eklenir.

---

## 7. Test

Vitest:

- `countdown`: 24 saat, 1 saat ve 0 eşikleri; LIVE, skor yokken LIVE; tür
  adları; bayatlık eşiği.
- `campaignChips`: yakınlık önceliği, LIVE önceliği, çakışmada gizleme,
  çipi olan sistemin isim label'ının bastırılması, dolu alanların çıktısı.
- `layers`: izolasyonda nokta ve gate renkleri; izolasyon yokken bugünkü
  davranış aynen.
- `camera`: `layer` ve `owner` için parse ve serialize gidiş-dönüşü;
  `security`'nin ve security katmanında `owner`'ın yazılmadığı; geçersiz
  değerlerin düştüğü.
- `useMapCamera`: katman değişiminin anında yazıldığı, security'ye geçişin
  `owner`'ı temizlediği.
- `SovPanel`: sekmeler, varsayılan Timers, satır tıklamasıyla focus ve
  izolasyon, boş ve bayat durumlar.
- `/sovereignty/map` yönlendirmesi.

Pixi atamaları (`campaignRings.ts`) bugünkü kurala uygun olarak test
edilmez. Görsel doğrulama kullanıcıda.

---

## 8. Bilerek dışarıda bırakılanlar

- Halkada animasyon.
- Aynı region'daki çiplerin tek çipte toplanması.
- Campaign geçmişi, hotspot'lar ve outcome istatistiklerinin haritaya
  taşınması — `/sovereignty` sayfalarında kalıyor.
- Activity ve geography katmanları, klavye, gezegen etiketleri.
- Campaign ve değişim resolver'larının servis katmanına taşınması.
- Seçili panel sekmesinin URL'de tutulması.
