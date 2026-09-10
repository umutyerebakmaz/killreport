# Solar system harita görselleri

**Tarih:** 2026-09-10
**Durum:** Tasarım — gözden geçirme bekliyor
**Bağlam:** Issue #138 faz 3. Faz 1 (region) `52abcca0`, faz 2 (constellation)
`7ace12fc` olarak main'de. Faz 2 spec'i sistem görsellerini ve R2 tartışmasını
açıkça bu faza bıraktı: "Sistem görselleri (8.490 adet, yörünge halkaları,
`planets` tablosu hazır) ... her biri kendi işi" ve "Toplam ~9.800 dosyaya
çıkıldığında R2 tartışması".

## Problem

Faz 2 asimetriyi bir yerden kaldırıp başka bir yere taşıdı. Bugün
`solar-systems/[id]/page.tsx`'te sayfa başlığı 96px'lik güvenlik renkli bir
kutuda `MapPinIcon` gösteriyor (173. satır), sekiz satır aşağıda ait olduğu
constellation ve region gerçek haritalarıyla 20px olarak duruyor. Sayfanın
kendisi jenerik bir sembol, komşuları kendi topolojileri.

Dört yerde daha aynı boşluk var:

- `constellations/[id]/page.tsx:311` — Solar Systems sekmesindeki her satır
  8.490 sistem için aynı turuncu `MapPinIcon`'u taşıyor.
- `components/Cards/SolarSystemCard.tsx` — kartta hiç görsel yok. Region ve
  constellation listelerinin ikisi de faz 1 ve 2'den beri 64px harita taşıyor.
- `components/TopSystemsCard/TopSystemsCard.tsx` — yanındaki
  `TopRegionsCard.tsx:63` 64px `RegionMap` gösteriyor, bu hiçbir şey.
- `KillmailsTable/KillmailRow.tsx:121` ve `KillmailCard/KillmailCard.tsx:140` —
  sistem adının yanı boş. Issue #138'in ikinci use case'i.

## Hedef

8.089 sistem için bir yörünge diyagramı SVG'si üretmek, repoya commit etmek ve
beş yerde — altı dosyada — göstermek.

## Ölçüler

Yerel topoloji verisinden (2026-09-10):

|                              |      Region |      Constellation |          Solar system |
| ---------------------------- | ----------: | -----------------: | --------------------: |
| Dosya sayısı                 |         114 |              1.184 |                 8.089 |
| Çizilen nesne                |      sistem |             sistem |  gezegen (+ 1 yıldız) |
| Ortalama nesne / harita      |        74,5 |                7,2 | 8,46 (min 1, maks 18) |
| Toplam byte (ölçülmüş/tahm.) |     1,18 MB |            1,40 MB |      ~6,02 MB (tahm.) |
| Bileşen                      | `RegionMap` | `ConstellationMap` |      `SolarSystemMap` |

Gezegen verisi eksiksiz: 68.407 gezegenin **hepsi** konumlu, hiçbirinin
`type_id`'si boş değil, 8.089 yıldızın hiçbirinin `spectral_class`'ı boş değil.
Bu fazın önündeki tek veri şartı buydu.

## Kapsam dışı

- **Aylar (344.457), kuşaklar (40.928) ve istasyonlar (5.210).** Üçü de
  gezegenlerinin çok yakınında yörüngede; normalize edilmiş 100 birimlik
  çerçevede gezegen noktasının içine düşerler. Dosyayı beş katına çıkarıp
  görselde hiçbir şey kazandırmama riski yüksek.
- **Komşuluk (jump) haritası.** Region ve constellation topolojiyi hâlihazırda
  anlatıyor; sistem başına ortalama 2,65 kapı üç kollu bir yıldıza iner. Faz
  1'in "tek nokta ve dört stub" dediği Yasna Zakh çizimi bunun ne olduğunu
  gösteriyor.
- **`constellations/[id]/page.tsx:104`'teki `MapPinIcon`.** O bir _sayı_
  ikonu ("N Solar Systems"), tek bir sistemi temsil etmiyor; yerinde kalır.
- **Region ve constellation SVG'lerinin görünümü.** İkisinin de byte'ı
  değişmemeli; bu fazın yeni bir modülü var, mevcut olana dokunmuyor.
- **R2 / object storage.** Aşağıda gerekçesiyle birlikte yine reddedildi.
- **GraphQL.** Hiçbir sorgu değişmiyor: beş gösterim yerinin hepsinde sistem
  `id`'si zaten elde.
- Sistem haritalarını herhangi bir zamanlayıcıya bağlamak. Statik evren verisi.

## Kararlar ve gerekçeleri

### 1. Çizim: yörünge diyagramı

Merkezde yıldız, dışa doğru log ölçekli yarıçapta gezegenler, her biri **gerçek
yörünge açısında**. Açının gerçek olması kararın yarısı: aksi hâlde eşit
aralıklı bir nokta dizisi çıkar ve iki sistem birbirinden yalnızca gezegen
sayısıyla ayrılır. Gerçek açıyla her sistemin kendi parmak izi oluyor.

Region ve constellation haritalarının anlattığı şey topoloji; bu onun bir alt
ölçeği değil, farklı bir bilgi. Issue #138 sistem görselini zaten böyle
tanımlıyor: "planet orbit rings (log-scaled distance to star) with dots for
planets".

### 2. Yeni modül: `solar-system-map-svg.ts`

`star-map-svg.ts`'e katılmıyor. O modülün girdisi `{ systems, jumps, gates }` ve
paleti `MapPalette`; buranın girdisi bir yıldız artı gezegen listesi ve palet
gezegen türünden renge giden bir eşleme. İkisini tek imzada birleştirmek her iki
tarafın da okunmasını zorlaştırır — faz 2'nin `MapPalette`'i iki _aynı_ çizimin
iki paletiydi, bu ise ikinci bir çizim.

Değişmeyen şey boru hattı, ve uyum oradan geliyor: veritabanından habersiz saf
bir render modülü + unit testleri, tek bir sorgu script'i, aynı %25'lik
mutabakat koruması, `{id}.svg` düzeninde tek dizin, tek `<img>` bileşeni + url
util'i, tek dokümanda anlatım. Faz 1 ve faz 2 bu hattın kendisi; faz 3 onu
üçüncü kez kullanıyor.

### 3. Ölçek: sistem içi log normalizasyonu

En iç yörünge 2,44e10 m, en dış 3,04e13 m — **1.246 kat**. Lineer ölçekte
Jita'nın ilk beş gezegeni yıldızın içine çöker. Formül, `r` yarıçap olmak üzere:

```text
lo = o sistemin en küçük yarıçapı
hi = o sistemin en büyük yarıçapı
yarıçap(r) = INNER + (OUTER − INNER) × (ln r − ln lo) / (ln hi − ln lo)
```

Yarıçap `sqrt(x² + z²)` ile ölçülüyor: `position_y` düşüyor, tıpkı faz 1 ve
2'de olduğu gibi — EVE'de dikey eksen o. Açı `atan2(−z, x)`, yine aynı
dönüşümle: ekran x'i `x`, ekran y'si `−z`.

**Sistem içi**, evrensel değil: her harita çerçeveyi doldurur, 20px'te bu
belirleyici. Evrensel ölçek sistemleri birbiriyle karşılaştırılabilir kılardı
ama kompakt sistemler küçücük kalırdı; bir kimlik görselinden istenen bu değil.
`hi = lo` olan tek gezegenli 14 sistemde payda sıfır: yarıçap
`(INNER + OUTER) / 2`'ye sabitlenir.

### 4. Palet

Gezegen noktası türüne göre, yıldız Harvard sınıfına göre renklenir. Türler
`types` tablosundan, dokuz yayımlanmış tür artı bir tek örnek:

| `type_id` | Tür             | Gezegen | Renk      |
| --------: | --------------- | ------: | --------- |
|        13 | Gas             |  20.402 | `#a78bfa` |
|      2016 | Barren          |  19.859 | `#9ca3af` |
|        11 | Temperate       |   7.240 | `#4ade80` |
|      2015 | Lava            |   6.651 | `#f97316` |
|      2017 | Storm           |   5.599 | `#22d3ee` |
|        12 | Ice             |   3.345 | `#e0f2fe` |
|      2014 | Oceanic         |   3.056 | `#2563eb` |
|      2063 | Plasma          |   1.541 | `#e879f9` |
|     30889 | Shattered       |     713 | `#f43f5e` |
|     73911 | Scorched Barren |       1 | Barren'ın |

Bilinmeyen bir `type_id` Barren'ın grisine düşer: SDE yeni bir gezegen türü
getirirse harita bozulmaz, o gezegen gri çizilir.

Yıldız rengi Harvard sınıfının ilk harfinden. Evrende yalnızca beş sınıf var —
O ve B hiç yok:

| Sınıf | Yıldız | Renk      |
| ----- | -----: | --------- |
| K     |  3.385 | `#ffd2a1` |
| G     |  2.160 | `#fff4ea` |
| M     |  1.282 | `#ffcc6f` |
| F     |  1.156 | `#f8f7ff` |
| A     |    106 | `#cad7ff` |

F ve G neredeyse beyaz ve birbirinden ayırt edilemez; K ve M gözle görülür
şekilde amber. Bu doğru: gerçek yıldız renkleri de öyle. Yıldız gezegenlerden
yarıçapla ayrılıyor (2,6'ya 1,6), renkle değil.

Yörünge halkaları `#475569`, `fill="none"`. Genişliği aşağıda.

### 5. Geometri ve çerçeve

| Sabit             | Değer                            |
| ----------------- | -------------------------------- |
| `viewBox`         | `-50 -50 100 100`                |
| `INNER` / `OUTER` | 9 / 46                           |
| `PAD`             | 4 (46 + 4 = 50; 1,6 nokta + pay) |
| Yıldız yarıçapı   | 2,6                              |
| Gezegen yarıçapı  | 1,6                              |
| Halka genişliği   | 0,6                              |

Çerçeve **100 birim**, region ve constellation'ın 114,6'sı değil. Sebep: bu
çizim merkezli ve dairesel, çerçeveyi kendi yarıçapı belirliyor; kenar boşluğu
dışa çıkan stub'ları taşımak zorunda değil.

Bunun bedeli çizgi kalınlığında: `p` pikselde `w` genişliğindeki bir çizgi
`w × p / 100` piksele iner. Halka 0,6'da 64px'te 0,38 piksel — faz 1'in "zayıf
okunuyor" dediği 0,42 pikselin hemen altı; 256px'te 1,54 piksel; **20px'te
0,12 piksel, yani yok.** 20px ve 24px'te haritayı taşıyan şey noktalar; halka
64px'ten yukarı bir yapı unsuru. Faz 1 ve 2'nin `jumpWidth`'i gibi bu da
yerinde kalibre edilecek tek sayı, ve kalibre etmek 8.089 dosyayı yeniden
üretmek demek.

Bu ölçeklerde ne olduğunu abartmamak gerekir: 20px'te bir sistem haritası
okunur bir diyagram değil, ılık bir noktanın çevresinde renkli bir küme —
faz 1'in region haritası için kabul ettiği şeyin aynısı.

### 6. Depolama: repoda kalır

8.089 dosya, dosya başına ölçülen ~781 byte, toplam **~6,02 MB**. Faz 1 ve
2'nin toplamının (2,65 MB) iki katından biraz fazla.

Git'in depoladığı şey bu değil: constellation setinin 1.465.681 byte'ı
gzip -9 ile 215.889 byte'a iniyor (%15). SVG metni ağırlıklı olarak tekrar
eden öznitelik adlarından oluşuyor. Aynı oranla sistem seti paketlenmiş bir
repoda yaklaşık **0,9 MB** yer tutar.

Faz 1 ve 2'de R2 iki gerekçeyle reddedilmişti; ikisi de duruyor. Boyut
mertebesi aynı kalıyor, ve diff'in SDE güncellemesinin haritaya ne yaptığının
kaydı olması sürüyor — R2'ye taşınan bir set o kaydı kaybeder.

Disk üzerindeki ayak izi ayrı bir sayı ve bunu bilmek gerekiyor: 4 KB'lik blok
boyutuyla 8.089 dosya diskte ~32 MB tutuyor (constellation seti 1,40 MB
içerikle diskte 4,7 MB). Bu bir checkout maliyeti, repo veya transfer maliyeti
değil.

### 7. Çizilecek bir şeyi olmayan sistemler

**401 sistem dosya almaz.** Ne yıldızı ne gezegeni var:

- 200 abyssal sistem (`ADR01`…, id 32.000.000 bandı)
- 200 void sistem (`VR-01`, id 34.000.000 bandı)
- `GPMS-01` (id 36.000.000 bandı)

Boş bir SVG üretmek yerine hiç dosya üretilmiyor; `SolarSystemMap` bileşeni
`onError`'da kendini kaldırıyor, tıpkı faz 1 ve 2'de olduğu gibi. Yedek görsel
yok: o sistemlerin gerçekten çizilecek bir içeriği yok.

**Zarzakh (30100000) tek nokta olarak çizilir.** Yıldızı var (F7 V), gezegeni
yok — evrende bu durumdaki tek sistem. Tersi hiç yok: gezegeni olup yıldızı
olmayan sistem sayısı sıfır.

### 8. Gösterim yerleri

| Yer                                  |      Boyut | Bugün ne var                        |
| ------------------------------------ | ---------: | ----------------------------------- |
| `solar-systems/[id]/page.tsx:173`    | 256 / 96px | güvenlik renkli kutuda `MapPinIcon` |
| `constellations/[id]/page.tsx:311`   |       20px | satır başına `MapPinIcon`           |
| `Cards/SolarSystemCard.tsx`          |       64px | hiçbir şey                          |
| `TopSystemsCard/TopSystemsCard.tsx`  |       64px | hiçbir şey                          |
| `KillmailsTable/KillmailRow.tsx:121` |       20px | hiçbir şey                          |
| `KillmailCard/KillmailCard.tsx:140`  |       20px | hiçbir şey                          |

Detay başlığı `sm` kırılımının altında 96px, üstünde 256px — region ve
constellation detay başlıklarıyla aynı. `TopSystemsCard` 64px alıyor çünkü
yanındaki `TopRegionsCard.tsx:63` 64px; simetri oradan.

`SolarSystemCard`'a harita eklemek kartın iç düzenini değiştiriyor: bugün üç
satır metin (sistem / constellation / region) art arda diziliyor, harita sola
64px'lik bir kolon olarak giriyor ve metinler onun sağında kalıyor.
Tablodaki diğer beş satır doğrudan yer değiştirme.

`MapPinIcon` importu, dosyada başka kullanımı kalmayan yerlerden düşer —
`constellations/[id]/page.tsx`'te 104. satır kaldığı için **düşmez**.

### 9. Killmail satırındaki 8.089 dosya

Bir killmail listesi 25 ile 100 satır arasında; her satır bir `<img>` daha
demek. Faz 2 bunu bilinçli olarak ertelemişti, bu fazda içeride. Gerekçe:

- Dosya ~781 byte ve Next statik dosyaları uzun `Cache-Control` ile veriyor,
  yani ikinci sayfada istek yok.
- Bir killmail listesinde sistemler tekrar ediyor: aynı savaşın 40 killmail'i
  aynı sistemden geliyor ve tarayıcı tek dosyayı bir kez çekiyor.
- HTTP/2 üzerinde 100 küçük istek tek bağlantıda çoğullanıyor.

Yine de bu, bu fazın tek ölçülmemiş iddiası. Yerinde bakıldığında ilk boyama
yavaşlıyorsa geri alınacak yer burası — diğer beş gösterim yerine dokunmadan
iki dosyadan çıkarılabilir.

## Dosya haritası

**Eklenen**

- `backend/src/scripts/solar-system-map-svg.ts` + `.spec.ts`
- `backend/src/scripts/render-solar-system-maps.ts`
- `frontend/src/components/SolarSystemMap/SolarSystemMap.tsx` + `.spec.tsx`
- `frontend/src/utils/solarSystemMapUrl.ts` + `.spec.ts`
- `frontend/public/images/solar-systems/*.svg` (8.089 dosya)

**Değişen**

- `backend/package.json` — `render:solar-system-maps`, ve `render:maps`
  üçüncü adımı alır
- `backend/docs/ops/star-map-images.md` — üçüncü haritayı da anlatır
- `frontend/src/app/solar-systems/[id]/page.tsx`
- `frontend/src/app/constellations/[id]/page.tsx`
- `frontend/src/components/Cards/SolarSystemCard.tsx`
- `frontend/src/components/TopSystemsCard/TopSystemsCard.tsx`
- `frontend/src/components/KillmailsTable/KillmailRow.tsx`
- `frontend/src/components/KillmailCard/KillmailCard.tsx`

Dizin adı `solar-systems`, issue #138'in yazdığı `systems` değil: rota
`/solar-systems/`, tablo `solar_systems`, GraphQL tipi `SolarSystem`.

## Doğrulama

1. `yarn workspace backend test` — `solar-system-map-svg.spec.ts` log
   normalizasyonunu, tek gezegenli sıfır-payda yolunu, gerçek açıyı, bilinmeyen
   `type_id` düşüşünü ve gezegensiz sistemi kapsar.
2. **Regresyon kontrolü:** `yarn workspace backend render:maps` sonrası
   `git status --porcelain frontend/public/images/regions frontend/public/images/constellations`
   boş olmalı. Bu faz o iki modüle dokunmuyor; dokunduysa yanlıştır.
3. `yarn workspace backend render:solar-system-maps` — beklenen çıktı 8.089
   dosya, 68.407 gezegen, 8.089 yıldız, 0 stale dosya.
4. `yarn workspace backend build`, `yarn workspace frontend lint`,
   `yarn workspace frontend build`. Codegen gerekmiyor: `.graphql` değişmiyor.
5. `npx prettier --check` — değişen dosyalar üzerinde.
6. Görsel doğrulama kullanıcıya ait: altı dosyanın dokunduğu beş yer gözle
   kontrol edilir, özellikle 20px'teki iki yer ve killmail listesinin ilk
   boyaması.

## Sonraya bırakılanlar

- Aylar, kuşaklar ve istasyonlar.
- 24px altı için ikinci, daha kalın bir dosya — faz 2'den devreden madde, artık
  üç harita türü için birden geçerli.
- Halka genişliğinin ve region `jumpWidth`'inin yerinde kalibrasyonu.
- Komşuluk (jump) haritası, ayrı bir görsel olarak.
- Issue #138'in üçüncü use case'i: sovereignty kampanya durumu ve kill
  yoğunluğu overlay'leri.
