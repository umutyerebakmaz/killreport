# Bölge harita thumbnail'leri

**Tarih:** 2026-09-09
**Durum:** Tasarım — gözden geçirme bekliyor
**Issue:** [#138](https://github.com/umutyerebakmaz/killreport/issues/138)
**Görsel karar:** [artifact, round 11](https://claude.ai/code/artifact/bea164d3-d565-4ad3-91c5-a855fb368989)

## Problem

Karakterin, korporasyonun, ittifakın ve gemi tipinin görseli var; bölgenin yok.
`/regions/[id]` sayfasının başlığında (`page.tsx:65`) `text-4xl` bir isimden
başka hiçbir şey yok, `/regions` tablosunun (`page.tsx:124`) Region kolonunda
düz metin duruyor, `TopRegionsCard` satırı (`TopRegionsCard.tsx:57`) rank + ad +
sayıdan ibaret. Bölgeler birbirinden yalnızca adlarıyla ayrılıyor.

Dışarıda bölge haritası veren bir kaynak yok. Ama üretmek için gereken verinin
tamamı zaten bizde:

|                                  |                     |
| -------------------------------- | ------------------- |
| Bölge / takımyıldız / sistem     | 114 / 1.184 / 8.490 |
| `position_x/y/z` boş olan sistem | 0                   |
| Stargate / hedefi boş olan       | 13.978 / 0          |

Yani issue'nun "topology model stores x/y/z" ve "stargate table exists and is
populated" kabul kriterleri bu spec yazılmadan önce zaten karşılanmıştı.

## Hedef

Her bölge için tek bir SVG üretmek, repoda statik dosya olarak servis etmek ve
dört yerde göstermek: bölge detay başlığı, `/regions` tablosu, `TopRegionsCard`
satırı, sistem ve takımyıldız sayfaları.

## Kapsam dışı

- **Takımyıldız görselleri.** 1.184 adet, ortalama 7,2 sistem. Bu boyutta bir
  haritanın thumbnail olarak bir şey anlatıp anlatmadığı kendi tasarım turunu
  ister. Kendi PR'ında.
- **Sistem görselleri.** Yörünge halkaları tamamen ayrı bir görsel dil; hiç
  tasarlanmadı. `planets` tablosu hazır (68.407 satır, hiçbirinde konum eksik
  değil), yani veri engeli yok — iş tasarımda.
- **Killmail satırındaki ikon.** `KillmailRow.tsx:146`'da bölge adı zaten link.
- **Küçük boy için ayrı dosya** (`{id}-sm.svg`). Aşağıda gerekçesi var.
- **R2 / obje deposu.** Aşağıda gerekçesi var.
- **GraphQL değişikliği.** URL bölge id'sinden türetiliyor; `Region` tipine
  `imageUrl` eklemek şemaya sunucudan hiçbir şey katmayan bir alan koymak olur.
- Mevcut resolver'ları servis katmanına taşıyan refactor.

## Kararlar ve gerekçeleri

### Format: SVG, repoda statik

114 dosya ≈ 1,2 MB ham, ~145 KB gzip. `frontend/public/images/regions/` altına
girer ve Next build'iyle beraber gider.

PNG yerine SVG olmasının sebebi çözünürlük değil, çözünürlüğün **olmaması**:
dosya piksel değil koordinat tutar, tarayıcı hangi kutuya çizeceğini o an
hesaplar. Aynı tek dosya 24px'te de 256px'te de 5K ekranda da tam çıkar. Bu
sayede:

- 64/128/256 diye ayrı çıktı yok, tek dosya var.
- PR #192'nin "kaynağı kutunun 2 katında iste" kuralı uygulanmaz; o raster
  kuralı. `srcset` yok, `2x` yok.

R2 (Cloudflare obje deposu) issue'da öneriliyordu ama bu iş için kurulacak
alettten büyük: projede Cloudflare'den hiç eser yok (`backend/docs/deployment/`
altında geçmiyor, `.env`'de anahtar yok, SDK kurulu değil), deployment
DigitalOcean droplet. 114 dosya repoda durabilir ve orada durması bir şey daha
kazandırır: **SDE güncellemesinden sonra script yeniden çalıştığında hangi
bölgenin haritası değişti, `git diff`'te görünür.** Obje deposunda bu görünürlük
yok.

R2 kararı takımyıldız (1.184) ve sistem (8.490) görselleri geldiğinde, ~9.800
dosyayla verilmeli. O geçiş yalnızca URL üreten helper'ı değiştirmek olur.

### Zemin: şeffaf

`cards.css`'te `.card` → `bg-surface`, `.card-row` → `hover:bg-surface-inset`.
`globals.css:17-19`'da bunlar sırasıyla `gray-900` ve `gray-800`; sayfanın kendisi
`gray-950`. Yani aynı görsel üç ayrı zeminin üstünde duruyor ve
`TopRegionsCard` satırında **fareyle üstüne gelindiğinde zemin değişiyor**.
Görsele zemin gömülürse hover'da altında değişmeyen koyu bir kare kalır.

Sitede tek tema var (`layout.tsx:24` → `text-white bg-ground`; hiç `dark:`
varyantı, `prefers-color-scheme` ya da tema sağlayıcısı yok), o yüzden şeffafın
açık temada okunurluk riski de yok.

### Çizim parametreleri

Round 11'de onaylanan hâli. Hepsi haritanın kendi 0–100 koordinat uzayında:

| Öğe                 | Değer                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| Sistem noktası      | `<circle r="1.3">`, güvenlik rengiyle dolu                                         |
| Bölge içi atlama    | `<line>` `#94a3b8`, `stroke-width 0.75`, `stroke-opacity 0.55`                     |
| Bölgeden çıkan gate | `<line>` `#4CC94C`, `stroke-width 0.9`, `stroke-opacity 0.9`, **uzunluk 10 birim** |
| Çerçeve payı        | her yönde `7.3` birim (= 5 + 1.3 + 1.0, round 6'dan devralındı)                    |
| Çizim sırası        | önce yeşil stub'lar, sonra gri çizgiler, en üstte noktalar                         |

Yeşil stub 10 birim: 5 birimde nokta yarıçapının 3,8 katı kalıyor ve sistemlerin
sıkıştığı yerde noktanın kendi tırnağı gibi okunuyor; 10'da komşuları geçip "bir
yere gidiyor" diye okunuyor. 25 birim denendi (round 7) ve geri alındı: çerçeveyi
büyütmek haritayı karede %26 küçültüyordu.

Çerçeve payı 7.3'te sabit kaldığı için 10 birimlik stub'ların bir kısmı karenin
kenarından taşıp kesiliyor. Ölçüldü: **740 stub'ın 690'ı tam boyunda görünüyor**,
50'si kesiliyor. Kesilenler, kenardaki bir sistemin gate'inin doğrudan en yakın
çerçeve kenarına bakması durumu. Bu 50 sayısı stub uzunluğundan bağımsız — kesen
şey uzunluk değil çerçeve.

### Güvenlik paleti

EVE'in kendi 11 kademeli rampası. `security_status` bir ondalığa yuvarlanır:

| ≥1.0      | 0.9       | 0.8       | 0.7       | 0.6       | 0.5       | 0.4       | 0.3       | 0.2       | 0.1       | ≤0.0      |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `#2FEFEF` | `#48F0C0` | `#00EF47` | `#00F000` | `#8FEF2F` | `#EFEF00` | `#D77700` | `#F06000` | `#F04800` | `#D73000` | `#F00000` |

`security_status` null olan sistem yok, ama olursa `#F00000` kullanılır.

Bu palet `frontend/src/utils/security.ts`'teki `getSecurityColor` ile **aynı şey
değil**: o dört kademeli Tailwind sınıfı döndürüyor (`text-green-400` gibi) ve
arayüz metni için var. Görsel, oyunun kendi rampasını kullanır. İkisini
birleştirmek bu işin kapsamında değil.

### Projeksiyon

`x → ekran x`, `−z → ekran y`. `position_y` atılır (EVE'de dikey eksen odur).

Sonra tek bir ölçek katsayısıyla normalize edilir: uzun eksen 0–100 aralığına
oturur, kısa eksen oranını korur. Tek katsayı olması önemli — dönüşüm benzerlik
dönüşümü kalır, yani yönler bozulmaz ve stub yönü normalize öncesi de sonrası da
aynı çıkar.

Bu projeksiyon artifact'taki onaylanmış çizimden geri çözüldü (Fade'in 27
sistemi üzerinde ortalama sapma 0,04 birim — SVG'deki tek ondalık yuvarlamanın
kendisi). Gerekçesi: round 1–6'yı üreten script bir elektrik kesintisinde
kayboldu, elimizde yalnızca çizilmiş geometri kaldı. **Yeni script'in çıktısı
artifact'la karşılaştırılarak doğrulanmalı** (bkz. Doğrulama).

### Tek dosya, tek ağırlık

Görsel istenen her kutuda kullanılır. Küçülünce kalite kaybı yok; küçülen tek
şey çizgi kalınlığı, çünkü o da orantılı ölçekleniyor. Gerçek piksel karşılığı:

| Kutu  | 1 birim | `w 0.75` çizgi | `r 1.3` nokta çapı |
| ----- | ------- | -------------- | ------------------ |
| 32px  | 0,28 px | 0,21 px        | 0,73 px            |
| 64px  | 0,56 px | 0,42 px        | 1,45 px            |
| 128px | 1,12 px | 0,84 px        | 2,90 px            |
| 256px | 2,23 px | 1,68 px        | 5,81 px            |

128px ve üstü sağlam; 64px'te çizgi yarım pikselin altında kalıp soluk görünüyor.
Bu bir dosya sayısı meselesi değil, tek bir sayının meselesi: zayıf gelirse
script'te `w 0.75` değişir ve 114 dosya yeniden üretilir. Bu yüzden ikinci bir
dosya (`{id}-sm.svg`) **şimdi üretilmiyor** — gerçek sayfada 64px görüldükten
sonra karar verilir.

### Kenarsız bölgeler

Ölçüldü ve kabul ediliyor:

- **47 bölge hiç çizgi içermiyor** — wormhole ve abyssal bölgelerin sistemlerinde
  stargate yok. Bunlar nokta serpintisi olarak çiziliyor. Doğru olan da bu:
  o bölgelerin gerçekten geçit topolojisi yok.
- **48 bölgede yeşil yok** (46'sında ikisi de yok).
- **3 bölgede tek sistem var** (G-R00031, GPMR-01, Yasna Zakh). Tek nokta,
  14,6 birimlik kare çerçevede; 128px'te ~23px çapında görünür, yani sorun değil.

Bunlar için ayrı bir yedek görsel üretilmiyor.

### Script'in yeri — **gözden geçirmede karar verilecek**

Bu script ne kuyruk yayıncısı ne kuyruk tüketicisi, yani `src/queues/` ve
`src/workers/` tanımlarının ikisine de girmiyor. İki seçenek:

1. **`backend/src/scripts/render-region-maps.ts`** — dizin zaten var:
   `clean-invalid-killmails.ts` 2026-09-03'ten beri orada (PR #139). Ne olduğunu
   doğru anlatır ve yeni bir desen icat etmez.
2. **`backend/src/workers/render-region-maps.ts`** — mevcut tek emsali izler:
   `workers/fetch-single-killmail.ts` de kuyruk tüketmiyor, `tsx` ile elle
   çalıştırılıyor (`fetch:killmail`). Bedeli: `workers/` dizininin anlamı
   ("kuyruk işleme") bulanıklaşır.

Önerim (1), ama bu senin kararın.

`package.json`'a tek satır: `"render:region-maps": "tsx src/<yer>/render-region-maps.ts"`.
CLAUDE.md'nin "önce tek satır `package.json` yeter mi" kuralı burada dosyayı
haklı çıkarıyor: Prisma sorgusu, projeksiyon ve SVG üretimi tek satıra sığmaz.

### Prisma istemcisi

`@services/prisma-worker` (2 bağlantı). CLAUDE.md: API sunucusu `prisma` (5),
worker'lar ve elle çalışan script'ler `prisma-worker`. Bu script API sürecinin
havuzuna girmemeli.

## Tasarım

### Veri

Tüm koşu için iki sorgu; 8.490 + 13.978 satır, gruplama JS'te.

```ts
// sistemler, bölgesiyle birlikte
prismaWorker.$queryRaw`
  SELECT c.region_id, s.system_id, s.position_x, s.position_z, s.security_status
  FROM solar_systems s
  JOIN constellations c ON c.constellation_id = s.constellation_id`;

// geçitler
prismaWorker.$queryRaw`
  SELECT solar_system_id, destination_system_id FROM stargates
  WHERE destination_system_id IS NOT NULL`;
```

`system_id → region_id` map'i kurulur, her geçit ona bakılarak sınıflanır:

- iki uç da aynı bölgede → **bölge içi atlama**. Her atlama iki geçit satırı
  olarak duruyor, `from < to` ile tekilleştirilir.
- uçlar farklı bölgelerde → kaynak bölgede bir **çıkış stub'ı**. Tekilleştirme
  yok: aynı sistemden iki farklı dış sisteme iki stub çizilir.

Stub yönü, hedef sistemin aynı projeksiyondaki konumuna doğru birim vektör;
uzunluk 10 birime kırpılır. Hedef sistem kaynağın bölgesinin 0–100 kutusunun
dışında kalır, bu normaldir.

### Render

Bölge başına saf string üretimi; kütüphane yok, `sharp` yok.

```
viewBox = "{minX-7.3} {minY-7.3} {spanX+14.6} {spanY+14.6}"
```

`minX/minY/spanX/spanY` yalnızca **sistem noktalarından** hesaplanır; stub'lar
hesaba katılmaz, o yüzden taşıp kesilirler.

Kök `<svg>` şunları taşır:

- `xmlns="http://www.w3.org/2000/svg"`
- `viewBox` (yukarıdaki)
- `width="128" height="128"` — kendi doğal boyutu. Kare olması bilinçli: harita
  kutusu kare değil, `preserveAspectRatio="xMidYMid meet"` ile ortalanıp
  letterbox'lanıyor. Böylece 114 dosyanın tamamı kare ve aynı ölçek ilişkisinde.
  `<img>`'e CSS ile verilen boyut bunu ezer.
- Arka plan dikdörtgeni **yok** (şeffaflık).

### Çıktı

`frontend/public/images/regions/{region_id}.svg` — 114 dosya.

Kısmi koşu bırakmamak için: hepsi bellekte üretilir, hepsi üretildikten sonra
diske yazılır. 114 küçük string olduğu için geçici dizin + takas gerekmiyor.

### Frontend

Yeni bir yardımcı, `itemImageUrl.ts` emsaliyle:

```ts
// frontend/src/utils/regionMapUrl.ts
export const regionMapUrl = (regionId: number): string =>
  `/images/regions/${regionId}.svg`;
```

Ve tek bir sunum bileşeni, dört çağrı yerinin ortak dili olsun diye:

```
frontend/src/components/RegionMap/RegionMap.tsx
  props: regionId, regionName, size (px), className?
```

`<img>` döndürür; `alt` = `${regionName} map`, `width`/`height` = `size`.
İş mantığı yok, veri çekmiyor — `components/` tanımına uyuyor.

Çağrı yerleri:

| Yer                             | Dosya                                             | Boyut |
| ------------------------------- | ------------------------------------------------- | ----- |
| Bölge detay başlığı             | `app/regions/[id]/page.tsx:65`                    | 128   |
| Bölge listesi, Region hücresi   | `app/regions/page.tsx:124`                        | 64    |
| Top Regions kartı satırı        | `components/TopRegionsCard/TopRegionsCard.tsx:57` | 64    |
| Sistem ve takımyıldız sayfaları | `/solar-systems/[id]`, `/constellations/[id]`     | 64    |

Son satır için not: o sayfalarda gösterilen görsel sayfanın kendisini değil
**üstünü** anlatıyor — sistemin/takımyıldızın içinde bulunduğu bölgeyi. Etiketi
bunu söylemeli ("Region: Domain" gibi), yoksa yanlış okunur.

64px'lik üç yerde satır yüksekliği artar. Bu bir kısıt değil, sonuç: satırlar
görselin gerektirdiği kadar yükselir.

## Hata yönetimi

Script:

- Konumu olmayan sistem: bugün yok. Çıkarsa o sistem atlanır ve sayısı loglanır.
- Hedefi olmayan geçit: sorguda zaten eleniyor.
- Sistemi olmayan bölge: bugün yok. Çıkarsa dosya üretilmez ve loglanır.
- Koşu sonunda üretilen dosya sayısı yazdırılır.

Frontend: dosyanın olmaması ancak SDE güncellemesiyle yeni bir bölge gelip
script'in çalıştırılmamasıyla mümkün. Issue "kırık görsel ikonu olmadan nötr bir
yedek" istiyor. `RegionMap` `onError` ile kendini gizler — bu bileşeni
`"use client"` yapar. **Gözden geçirmede sorulacak:** dört çağrı yerinin hepsine
bu maliyeti yüklemek yerine, eksik dosyayı çalışma anında dallanılacak bir durum
değil bir hata sayıp doğrulamayı üretim anına bırakmak da mümkün.

## Doğrulama

Script'in çıktısı onaylanmış çizimi yeniden üretmek zorunda; ölçüt bu:

1. `yarn render:region-maps` → `frontend/public/images/regions/` altında **114**
   dosya.
2. Fade (`10000036`) dosyasındaki 27 nokta, artifact'taki `fade-t075` sembolünün
   nokta koordinatlarıyla 0,05 birim toleransla eşleşmeli.
3. Tüm dosyalarda yeşil `<line>` sayısı **740** olmalı.
4. Nokta sayısı toplamı **8.490** olmalı.
5. Hiçbir dosyada arka plan dikdörtgeni olmamalı.

Bunlar bir spec dosyasına (`render-region-maps.spec.ts`) yazılabilir; 2. madde
için artifact'tan çıkarılmış koordinatlar fixture olarak durur.

Ardından her zamanki set:

```bash
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build
npx prettier --check <değişen dosyalar>
```

`lint` sayısı `main`'le karşılaştırılır (2026-09-08 itibarıyla 234) ve
girdilerin hiçbiri branch'in dokunduğu bir dosyayı adlandırmamalı.

Görsel doğrulama sende: dört sayfaya bakıp 64px'in yeterince okunaklı olduğunu
söylemen gerekiyor. Zayıfsa `w 0.75` → `w 1.10` tek satırlık değişiklik.

## Açık sorular

1. Script `src/scripts/` altında mı, `src/workers/` altında mı?
2. `RegionMap` `onError` ile `"use client"` mu olsun, yoksa eksik dosya
   çalışma anında dallanılmayan bir hata mı sayılsın?
3. Script hangi dokümanda anlatılsın? Önerim `backend/docs/ops/region-map-images.md`
   — issue "SDE güncellemesinden sonra çalıştırılacak elle bir adım olarak
   dokümante edilsin" diyor ve `ops/` dizini tam olarak bu tür şeyler için.
