# Harita etiketleri: DOM/CSS katmanı — tasarım

Tarih: 2026-09-15

## Amaç

Evren haritasının isimleri bugün Pixi `BitmapText`. Onları gerçek HTML
elemanlarına taşımak: her isim bir `<span>`, biçimi CSS, ölçüsü tarayıcının
kendi metin ölçümü. Kazanç üç yerde — tipografi (gerçek kerning, halo, geçiş),
kesinlik (çakışma kutusu tahmin değil ölçüm) ve ismin kendisinin bir hedef
olması (fare ile üzerine gelinip tıklanabiliyor).

Üçüncü kalem bilinçli olarak "erişilebilirlik" değil. Bu faz ismi yalnızca
**fare hedefi** yapıyor: `pointer-events: auto` ve bir `data-map-system`
damgası, yani odaklanabilirlik, tab sırası, `role`, erişilebilir ad ve
klavyeyle tetikleme yok. Kazanç, DOM'a taşımanın bunların hepsini **ulaşılabilir
mesafeye getirmesi**; teslim etmesi değil. Klavyeyle gezinme kendi fazında
(`2026-09-14-universe-map-focus-design.md`, "Klavyeyle gezinme faz 3c") ele
alınıyor ve bir etiket dalında yapılması o fazı hem tekrar eder hem de kendi
incelemesinden yoksun bırakırdı.

Etiketler dünyaya çapalı, **punto sabit**: kamera hareket edince isim sistemiyle
birlikte gider, ama 16/12/8 px'te kalır. Zoom'la büyüyen bir isim istenmedi.

## Bugünkü durum

| Parça       | Yer                                                   | Durum                                                                  |
| ----------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Çizim       | `frontend/src/components/UniverseMap/scene/labels.ts` | `BitmapText`, üç atlas, `tier:id` havuzu                               |
| Yerleştirme | `frontend/src/utils/map/labels.ts`                    | Saf fonksiyon, açgözlü tek geçiş, `MAX_VISIBLE_LABELS = 300`           |
| Genişlik    | `LABEL_CHAR_WIDTH`                                    | **Tahmin**: kademe başına ortalama glif ilerlemesi                     |
| Eşikler     | `frontend/src/utils/map/lod.ts`                       | `REGION_LABEL_ZOOM` / `CONSTELLATION_LABEL_ZOOM` / `SYSTEM_LABEL_ZOOM` |
| Veri        | `backend/src/services/universe/map-labels.service.ts` | Bölge = `AVG(position_x/z)`, takımyıldız = kendi konumu                |

Bilinen sınırlar: genişlik tahmini "IIII" ile "WWWW" için aynı kutuyu ayırıyor;
bölge merkezi kendi bölgesinin dışına düşebiliyor; centroid viewport'tan çıkınca
isim tamamen kayboluyor; her kamera hareketinde yerleştirme sıfırdan hesaplandığı
için isimler zoom'da yanıp sönüyor.

## Kararlar

1. **Pixi sahnesi kalıyor.** Nokta, hat ve gök cisimleri Pixi'de; yalnızca
   etiket katmanı DOM'a taşınıyor.
2. **Katman imperatif ve havuzlu.** React kapsayıcıyı sahipleniyor, pointermove
   başına render yapmıyor.
3. **Genişlik `canvas.measureText` ile ölçülüyor**, `offsetWidth` ile değil:
   çakışma filtresi genişliği eleman doğmadan önce istiyor.
4. **Bölge merkezi medoid**, extent (`MIN`/`MAX`) ile birlikte döndürülüyor.
5. **İsimler fare olayı alıyor.**

## Mimari

Host `div` zaten `relative` (`UniverseMap.tsx:512`). Canvas'ın üstüne kardeş bir
katman geliyor: `absolute inset-0 overflow-hidden`, kökü `pointer-events: none`,
elemanları `auto`.

| Birim                                                  | Sorumluluk                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `utils/map/labelStyle.ts` _(yeni)_                     | Kademe metrikleri: fontSize, fontWeight, letterSpacing, uppercase. Tek kaynak.            |
| `utils/map/measure.ts` _(yeni)_                        | `canvas.measureText` ile hafızalı genişlik ölçer; font string'ini `labelStyle`'dan kurar. |
| `utils/map/labels.ts` _(değişiyor)_                    | Aday üretimi + çakışma filtresi. Saf kalıyor; ölçer enjekte ediliyor.                     |
| `components/UniverseMap/labels/labelLayer.ts` _(yeni)_ | Havuz, `style.transform` yazımı, `data-map-system` damgası. DOM'un tamamı burada.         |
| `app/map.css` _(yeni)_                                 | Renk, halo, geçiş, `white-space`. Metrik yok.                                             |

Metrikler neden TS'te: ölçer ile çizen aynı sayılara bakmak zorunda. CSS
`font-size: 12px` derken ölçer 16 varsayarsa çakışma kutusu yalan söyler ve bunu
hiçbir test yakalamaz. `labelStyle.ts` sayıları tutuyor, katman eleman yaratılırken
bir kez `el.style`'a yazıyor, `map.css` yalnızca görünüşü alıyor. Bugünkü
`TIER_STYLE` (`scene/labels.ts:50`) gerekçe yorumlarıyla birlikte oraya taşınıyor.

Veri akışı değişmiyor:

```
kamera değişimi → labelCandidates(measure) → placeLabels(sticky) → drawLabels(layer, placed)
```

`UniverseMap.tsx:316`'daki efekt yerinde kalıyor; `drawLabels`'ın ilk argümanı
`MapScene` yerine `LabelLayer` oluyor.

Havuz, bugünkü `BitmapText` havuzunun (`scene/labels.ts:203`) birebir karşılığı ve
aynı gerekçeyle var: sürüklemenin her karesinde 300 düğüm yaratıp yok etmemek.
Anahtar yine `tier:id`, metin bir kez yazılıyor, sonraki karelerde yalnızca
`transform` ve sınıf değişiyor.

## Yerleştirme filtresi

### Ölçüm enjeksiyonu

`labelCandidates` yeni bir argüman alıyor:

```ts
measure: (tier: LabelTier, name: string) => number; // px, kerning dahil
```

`halfWidth = measure(tier, name) / 2`. `LABEL_CHAR_WIDTH` ve onun ortalama-glif
gerekçesi siliniyor; `LABEL_LINE_HEIGHT` elle yazılmaktan çıkıp `labelStyle`'ın
fontSize'ından türüyor (bugünkü 1.15 çarpanı, aynı gerekçe: Shentox'un çıkan ve
inen uzantıları birlikte ~1.2 em).

Testler sahte bir ölçer geçiyor, böylece jsdom'da `measureText` olmaması spec'leri
etkilemiyor ve fonksiyon saf kalıyor.

### Bölge görünürlüğü: extent eşiği

Katı bir "isim bölgeye sığmalı" kuralı bölge katmanını öldürür:
`REGION_LABEL_ZOOM` (-50.13) bölgeler arası medyan mesafenin 60 px'e ulaştığı
zoom, bölgenin kendi genişliği de o civarda, oysa "Sinq Laison" 16 px'te ~129 px.
Eşik anında hiçbir isim sığmaz.

Onun yerine extent eşiğin kendisi oluyor:

```
bölge ismi görünür  ⟺  (max_x - min_x) × scaleX  ≥  REGION_FIT_RATIO × isim genişliği
```

Sonucu: büyük bölgeler erken, küçük bölgeler geç isimleniyor — hepsi aynı anda
değil. Kartografik olarak doğrusu bu ve ancak extent elde olduğu için mümkün.
`REGION_LABEL_ZOOM` silinmiyor, **taban** olarak kalıyor: galaksi fit'inde hiçbir
isim çıkmasın diye.

`bounds` `LabelSource`'ta opsiyonel. Takımyıldızın kendi koordinatı var, bounds'u
yok, kural onda çalışmıyor; istenirse sonradan aynı sorgudan gelir.

### Viewport kenetleme

Bugün centroid ekrandan çıkınca isim komple düşüyor (`labels.ts:180`, clip). Yeni
kural kesişimin ortası değil, kenetleme:

```
anchor = clamp(centroid, bölgeKutusu ∩ viewport, halfWidth/halfHeight kadar içeri)
```

Centroid ekrandaysa hiçbir şey değişmiyor; dışarıdaysa isim görünen parçanın en
yakın kenarına kayıyor. Ortaya kenetleme pan sırasında sıçrar, `clamp` monoton —
isim kayar, zıplamaz.

### Histerezis

`placeLabels(candidates, sticky)` — `sticky`, bir önceki karede yerleşmiş
anahtarların kümesi. İki geçiş: önce sticky adaylar (yine kademe sırasıyla), sonra
kalanlar. İki isim başa baş yarıştığında ekranda zaten olan kazanıyor; bugünkü
titremenin kaynağı bu berabere hallerinin her karede farklı çözülmesi.

Fonksiyon saf kalıyor: kümeyi çağıran tutuyor (`UniverseMap.tsx`'te bir ref). Zoom
kademe eşiğini geçince adaylar zaten değiştiği için sticky kendiliğinden
temizleniyor.

Üstüne CSS: giren label `opacity 0→1`, çıkan `1→0`, 150 ms. Havuz elemanı
silinmiyor, sınıfı değişiyor.

### Disk boşluğu tek kurala iniyor

Medoid bir yıldız olduğu için bölge ismi artık çizili bir diskin üstüne düşüyor.
Bugün sisteme özel olan kaldırma ifadesi kademe koşulundan çıkıp her kademeye
uygulanıyor:

```ts
max(
  lineHeight,
  halfHeight + systemRadiusPx(radius, scale, floor) + LABEL_DOT_GAP_PX,
);
```

`LabelSource.radius` opsiyonel alanı zaten duruyor (`labels.ts:82`); bölge kademesinde
onu dolduran backend değil, `systemId`'yi `mapGeometry` düğüm haritasında arayan
istemci.

Koşul kademeye değil **veriye** bağlanıyor: `radius === undefined` ise altında
çizili bir işaret yoktur ve kaldırma bir satır yüksekliğidir. `?? 0` ile
yazılamaz — `systemRadiusPx(0, …)` sıfır değil taban yarıçapını döndürür
(`marks.ts:60`), bu da takımyıldız kaldırmasını sessizce 14'ten 15.5'e taşırdı.
Takımyıldız `radius` göndermiyor, yani bugünkü davranışı birebir koruyor; yarıçapı
0 gelen sistem (gök cismi olmayan, `COALESCE(extent.radius, 0)`) bugünkü gibi
tabana düşüyor. Kural sayısı artmıyor, azalıyor.

Kabul edilen yan etki: sistem-ismi zoom'unda medoid sisteminin kendi adı, bölge
adıyla aynı yeri isteyip kademe önceliği gereği kaybedecek. Bir sistem adını bölge
adına feda etmek, filtrenin zaten var olma sebebi.

## Backend

### Ölçümler (2026-09-15, üretim veritabanı)

- 114 bölge, ortalama 74 sistem, en büyüğü 189 — toplam 768.330 çift.
- Tam medoid sorgusu: **191 ms**. Cache TTL'i zaten 86400 sn
  (`map-labels.service.ts:21`), yani 24 saatte bir ödeniyor. **Kolon yok,
  migration yok.**
- Centroid'e en yakın yıldızın başka bir bölgeye ait olduğu bölgeler: 114'te 12.
  New Eden'da 9'u — Delve, Devoid, The Citadel, Kor-Azor, Kador, Curse, Malpais,
  Oasa, Metropolis. En kötü ikisi (2.7 ve 1.7 ly) solucan deliği bölgeleri.
- Medoid çapayı 0.1–1.7 ly kaydırıyor. `REGION_LABEL_ZOOM`'da 1 ly ≈ 7.7 px,
  yani eşikte en fazla ~13 piksel.
- **3 bölgede tek sistem var.** Medoid sorgusunun self-join'i bu yüzden
  `LEFT JOIN` olmak zorunda; düz `JOIN` o üç ismi haritadan sessizce düşürürdü.

Kazanç piksel sayısı değil, garanti: çapa artık tanımı gereği bölgenin kendi
yıldızlarından biri, yani ismin komşu bölgenin üstüne düşmesi mümkün olmaktan
çıkıyor. Kademeler biriktiği için fark zoom'la büyüyor.

### Sorgu

Extent ve medoid tek ifadede, ikisi de sahne predicate'inin içinden
(`scopePredicate` + `gatelessFilter` — centroid'in bugün kullandığı, 217 Jove
sistemini düşüren aynı filtre):

```sql
WITH scene AS (
  SELECT r.region_id, r.name, s.system_id, s.position_x AS x, s.position_z AS z
  FROM regions r
  JOIN constellations c ON c.region_id = r.region_id
  JOIN solar_systems s ON s.constellation_id = c.constellation_id
  WHERE <scene> AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL <gateless>
),
extent AS (
  SELECT region_id, name, MIN(x) AS min_x, MAX(x) AS max_x,
         MIN(z) AS min_z, MAX(z) AS max_z
  FROM scene GROUP BY region_id, name
),
medoid AS (
  SELECT DISTINCT ON (a.region_id) a.region_id, a.system_id, a.x, a.z
  FROM scene a
  LEFT JOIN scene b ON b.region_id = a.region_id AND b.system_id <> a.system_id
  GROUP BY a.region_id, a.system_id, a.x, a.z
  ORDER BY a.region_id,
           COALESCE(SUM(sqrt(power(a.x - b.x, 2) + power(a.z - b.z, 2))), 0)
)
SELECT e.region_id AS id, e.name, m.system_id, m.x, m.z,
       e.min_x, e.max_x, e.min_z, e.max_z
FROM extent e JOIN medoid m ON m.region_id = e.region_id
ORDER BY id
```

Takımyıldız sorgusu değişmiyor: kendi `position_x/z`'si var, bounds'a ihtiyacı
yok, 31 KB'lık yükü büyümüyor.

### Şema

```graphql
type MapLabel {
  id: Int!
  name: String!
  kind: MapLabelKind!
  x: Float!
  z: Float!
  "Yalnızca REGION: ismin çapalandığı medoid sistemi. Yarıçapı istemci mapGeometry'den okur."
  systemId: Int
  "Yalnızca REGION: bölgenin çizilen sistemlerinin sınırları. İsmin görünürlük eşiği buradan."
  bounds: MapBounds
}
```

`radius` yerine `systemId`: medoid zaten `mapGeometry`'de yüklü bir düğüm ve
yarıçapı istemci kendi düğüm haritasından okuyunca label'ın disk boşluğu, çizen
kodun kullandığı sayının aynısı oluyor. Backend'e ikinci bir yarıçap hesabı
(`universe-map.service.ts:196`'daki `MAX(SQRT(x² + z²))`) eklemek, iki yerin
ayrışabileceği bir kopya olurdu.

Cache anahtarı `map:labels:v2:` olarak sürümleniyor — `scope` ve `kind` zaten
içinde, ama bölge satırının **şekli** değişiyor. Sürüm atlanırsa deploy'dan sonra
86400 saniyeye kadar dünkü şekil (ne `systemId` ne `bounds`) servis edilir ve
istemci hiçbir bölge ismini çizmez, çünkü hiçbiri extent kuralından geçemez. TTL
86400 kalıyor: bu statik evren verisi.

## Etkileşim

Pan/zoom dinleyicilerinin hepsi bugün **canvas'a** bağlı
(`useMapPointer.ts:187-191`). Label katmanı canvas'ın üstünde durup fare olayı
alırsa, bir ismin üstünden başlayan sürükleme ve bir ismin üstündeki tekerlek
canvas'a hiç ulaşmaz — harita o noktalarda donar. Bu yüzden:

- Dinleyiciler canvas'tan **host `div`'e** taşınıyor. Canvas host'u doldurduğu için
  `getBoundingClientRect` aynı dikdörtgeni verir; olaylar label'dan host'a kabarır,
  pan ve zoom bozulmaz.
- Seçim tek yoldan gidiyor: `up` handler'ı hit-test'ten önce
  `e.target.closest('[data-map-system]')`'a bakıyor. Bulursa id'yi doğrudan
  kullanıyor, bulamazsa bugünkü `pickSystem` koordinat testine düşüyor. İki picking
  yolu değil, bir yol ve bir kestirme; sürükleme toleransı
  (`CLICK_MOVE_TOLERANCE_PX`) ikisinde de aynı.
- Hover aynı biçimde: id'den `PickTarget` kuran bir `pickById(nodes, id, transform)`
  yardımcısı `pickSystem` ile aynı şekli döndürüyor, böylece `SystemHoverTip` tek
  satır değişmiyor ve tip ismin değil **noktanın** üstünde açılıyor.

## Testler

DOM katmanı jsdom'da gerçekten çalışıyor; bugün `scene/labels.ts`'in spec'i yok,
çünkü `BitmapText` jsdom'da çalışmıyor ve `UniverseMap.spec.tsx` `drawLabels`'ı
komple mock'luyor (`spec:90`). Çizen kod ilk kez test edilebilir hale geliyor.

| Dosya                                                       | Ne eklenir                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `utils/map/measure.spec.ts` _(yeni)_                        | Hafızalama, font string'inin `labelStyle`'dan kurulması, 2d context yokken davranış                                                              |
| `utils/map/labels.spec.ts`                                  | Ölçer enjeksiyonu, `REGION_FIT_RATIO` eşiği, viewport kenetleme, sticky önceliği, birleşen kaldırma ifadesi                                      |
| `components/UniverseMap/labels/labelLayer.spec.ts` _(yeni)_ | Havuz aynı anahtarda aynı elemanı tekrar kullanıyor mu, `transform` string'i, `data-map-system` damgası, giriş/çıkış sınıfı, `destroy` temizliği |
| `useMapPointer.spec.ts`                                     | Dinleyiciler host'ta; label üstünde `pointerup` id ile seçiyor; label'dan başlayan sürükleme pan yapıyor; label üstünde tekerlek zoom yapıyor    |
| `backend .../map-labels.service.spec.ts`                    | Sorguda MIN/MAX ve medoid CTE'si; tek sistemli bölge kendini veriyor; takımyıldız sorgusu değişmemiş                                             |

Son satır için not: mevcut `expect(lastQueryText()).not.toContain('AVG')`
(`spec:151`) yeni şekle göre güncellenecek — `AVG` tamamen gidiyor.

**2d context yoksa** label katmanı kapanıyor, bir kez uyarı düşüyor, harita geri
kalanıyla çalışıyor. Kasıtlı olarak bir "tahmini genişlik" fallback'i yok: o,
silinen `LABEL_CHAR_WIDTH`'i arka kapıdan geri getirirdi. Gerçek tarayıcıda bu yol
hiç çalışmıyor.

## Silinenler

- `scene/labels.ts` dosyasının tamamı: `BitmapFont.install`,
  `BitmapFontManager.ASCII`, atlas çözünürlüğü, `BitmapText` havuzu.
- `LABEL_CHAR_WIDTH` ve `LABEL_LINE_HEIGHT` sabitleri.
- `installLabelFonts` → `whenLabelFontsReady()`: üç yüz için `document.fonts.load`.
  `fontsReady` kapısı (`UniverseMap.tsx:317`) yerinde kalıyor; koruduğu şey
  atlas'tan ölçere dönüyor.
- `pixi.js` import yüzeyinden `BitmapText`, `BitmapFont`, `BitmapFontManager`.

## Doğrulama

```
backend codegen → backend build → frontend codegen → yarn test
→ frontend lint (237 taban ile karşılaştır) → frontend build → prettier --check
```

Veri tarafı doğrudan GraphQL ile: `mapLabels(scope: NEW_EDEN, kind: REGION)`
sorgusunun `bounds` ve `systemId` döndürdüğü, tek sistemli üç bölgenin listede
kaldığı :4000'e sorularak gösterilecek.

Görsel doğrulama kullanıcıda: hangi bölge isimleri hangi zoom'da açılıyor, fade
titriyor mu, ismin üstüne gelince tip noktanın üstünde mi açılıyor, bir isimden
başlayan sürükleme haritayı kaydırıyor mu.

## Bakılarak ayarlanacak sabitler

| Sabit                | Başlangıç | Ne yapar                                           |
| -------------------- | --------- | -------------------------------------------------- |
| `REGION_FIT_RATIO`   | 0.8       | Bölge isminin açılma eşiği, bölge genişliğine oran |
| fade süresi          | 150 ms    | Giriş/çıkış geçişi                                 |
| `MAX_VISIBLE_LABELS` | 300       | Artık bir DOM bütçesi                              |
| `LABEL_DOT_GAP_PX`   | 7         | Değişmiyor; artık üç kademede de geçerli           |

## Riskler

- **300 elemana pointermove başına `transform` yazmak** teoride yalnızca composite,
  ama bu projede ölçülmedi. Kaçış yolu `MAX_VISIBLE_LABELS` ve halo'nun
  (`text-shadow`) düşürülmesi; ikisi de tek sabit.
- **Medoid + extent'in payload'u** 114 satır × 5 sayı büyütüyor — ölçülemez, ama
  takımyıldız kademesine yayılırsa 799 satır olur; bu yüzden şimdilik yayılmıyor.
- **Histerezis yanlış ayarlanırsa** kötü bir yerleşimi kilitleyebilir. Sticky
  yalnızca aday kalmaya devam ettiği sürece yaşıyor, bu da onu zoom değişiminde
  kendiliğinden temizliyor.

## Kapsam dışı

- Çoklu çapa yerleştirme (isim yalnızca noktanın üstünde kalıyor).
- Takımyıldız kademesi için extent.
- İsmin klavyeyle erişilebilir olması: `tabindex`, `role`, erişilebilir ad ve
  keydown yolu. Yukarıdaki `Amaç` ile aynı gerekçe — bunlar klavye fazının işi.
- Bağlantı çizgisi (leader line).
- Pixi'nin kendisinin değiştirilmesi; three.js değerlendirildi ve elendi —
  etiketler ekran uzayında sabit puntoyla çizildiği için SDF metnin çözdüğü sorun
  bu haritada oluşmuyor.
