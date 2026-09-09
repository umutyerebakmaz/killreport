# Constellation harita görselleri

**Tarih:** 2026-09-09
**Durum:** Tasarım — gözden geçirme bekliyor
**Bağlam:** Issue #138 faz 2. Faz 1 (region harita küçük görselleri) PR #193 ile
main'e `52abcca` olarak girdi ve constellation görsellerini "kendi tasarım işini
istiyor" gerekçesiyle bilinçli olarak dışarıda bıraktı.

## Problem

Region'ların yıldız haritası var, constellation'ların yok. Bu bir boşluktan
fazlası: `constellations/[id]/page.tsx:72` bugün 96px'lik bir kutuda mor bir
`MapIcon` gösteriyor ve aynı sayfanın 80. satırında, sekiz satır aşağıda, ait
olduğu region'ın gerçek haritası 20px olarak duruyor. Aynı sayfada bir alan
kendi topolojisiyle, komşusu jenerik bir ikonla temsil ediliyor.

`solar-systems/[id]/page.tsx` aynı asimetriyi taşıyor: "Constellation:" satırı
mor bir `MapIcon` ile (192. satır), hemen altındaki "Region:" satırı gerçek
haritayla (205. satır) çiziliyor. İkisi de ikonlu; biri o alanın topolojisi,
diğeri her constellation için aynı olan bir sembol.

## Hedef

1.184 constellation için, region'lardakiyle aynı üretim hattından geçen bir
yıldız haritası SVG'si üretmek, repoya commit etmek ve dört yerde göstermek.

## Ölçüler

Yerel topoloji verisinden (2026-09-09):

|                                | Region |        Constellation |
| ------------------------------ | -----: | -------------------: |
| Dosya sayısı                   |    114 |                1.184 |
| Sistem                         |  8.490 |                8.490 |
| Ortalama sistem / harita       |   74,5 | 7,2 (min 1, maks 19) |
| İç bağlantı (tekilleştirilmiş) |  6.619 |                5.704 |
| Dışa çıkan kapı                |    740 |                2.570 |
| İç : dış oranı                 | ~9 : 1 |               ~2 : 1 |

Oranın 9:1'den 2:1'e kayması bu spec'in ana teknik gerçeği: constellation
haritasında yeşil — burada lacivert — stub'lar region'dakinin dört katı ağırlıkta.

## Kapsam dışı

- **Sistem görselleri** (8.490 adet, yörünge halkaları, `planets` tablosu hazır)
  ve **killmail satır ikonu**. Her biri kendi işi.
- **R2 / object storage**. Aşağıda gerekçesiyle birlikte reddedildi; tartışma
  sistem görselleriyle açılmalı.
- **Region görsellerinin görünümünü değiştirmek.** Refactor sonrası 114 region
  SVG'sinin byte'ı bile değişmemeli.
- **`GATE_LENGTH`'in region tarafında yeniden kalibre edilmesi** ve
  `region-map-images.md`'de açık bırakılan "64px'te jump çizgisi 0,4 piksel"
  sorusu. Constellation paleti kendi opaklığını getiriyor, region'ınki elleniyor
  değil.
- Constellation haritalarını herhangi bir zamanlayıcıya bağlamak. Statik evren
  verisi; projenin kuralı gereği yalnızca değişen veri zamanlanır.

## Kararlar ve gerekçeleri

### 1. Görsel dil: constellation kendi paletini alır

Region'ın dili — EVE'in security ramp'i, `#94a3b8` iç bağlantı, `#4CC94C` dış
kapı — constellation'a taşınmıyor. Constellation paleti:

| Rol             | Değer                |
| --------------- | -------------------- |
| Sistem noktası  | `#FFFFFF`, düz beyaz |
| İç bağlantı     | `#DC2626`            |
| Dışa çıkan kapı | `#1D4ED8`            |

Bu, tasarım turunda gerçek veriyle karşılaştırılarak seçildi. İki paletin yan
yana durduğu kalibrasyon sayfası, dokuz yerine on constellation'a — dördü Jita,
Amarr, Dodixie ve Rens'in bulunduğu tanıdık high-sec constellation'larına —
genişletilerek karar verildi.

Kayıt için, tasarım sırasında dile getirilen ve kullanıcı tarafından tartıldıktan
sonra reddedilen üç itiraz:

- Beyaz nokta, security bilgisini haritadan kaldırıyor. Karşılığı: constellation
  kartlarında ortalama security ayrı bir alan olarak zaten yazılabiliyor.
- Lacivert, `#111827` kart zemininde region'ın yeşilinden zayıf okunuyor.
  Karşılığı: `#1D4ED8` (blue-700), denenen dört tondan bu zeminde en okunaklısı.
- Kırmızı çizgi, ramp'ın kırmızı ucuyla çakışıyordu — beyaz noktaya geçilince
  bu itiraz kendiliğinden düştü.

Kırmızının koyu zeminde `0.55` opaklıkta bulanıklaşması nedeniyle
`jumpOpacity` region'ın `0.55`'i yerine **`0.7`** alınır. Geometrinin geri kalanı
region'la aynı.

### 2. Çizim modülü paylaşılır

`backend/src/scripts/region-map-svg.ts` → **`star-map-svg.ts`**.

Projeksiyon (`x → ekran x`, `−z → ekran y`), uzun eksenin 0–100'e normalizasyonu,
jump tekilleştirme ve stub kırpma iki harita türü için birebir aynı. Değişen tek
şey palet, o da parametre olur:

```ts
export interface MapPalette {
  dotR: number;
  dotFill: (security: number | null) => string;
  jump: string;
  jumpWidth: number;
  jumpOpacity: number;
  gate: string;
  gateWidth: number;
  gateOpacity: number;
  gateLength: number;
  pad: number;
}

export const REGION_PALETTE: MapPalette = {
  dotR: 1.3,
  dotFill: securityColour,
  jump: '#94a3b8',
  jumpWidth: 0.75,
  jumpOpacity: 0.55,
  gate: '#4CC94C',
  gateWidth: 0.9,
  gateOpacity: 0.9,
  gateLength: 10,
  pad: 7.3,
};

export const CONSTELLATION_PALETTE: MapPalette = {
  dotR: 1.3,
  dotFill: () => '#FFFFFF',
  jump: '#DC2626',
  jumpWidth: 0.75,
  jumpOpacity: 0.7,
  gate: '#1D4ED8',
  gateWidth: 0.9,
  gateOpacity: 0.9,
  gateLength: 10,
  pad: 7.3,
};

export function renderStarMap(input: StarMapInput, palette: MapPalette): string;
```

`securityColour` dışarıya açık kalır; region'ın `dotFill`'i odur.

Alternatifi, geometriyi `constellation-map-svg.ts` adıyla ikinci kez yazmaktı.
150 satır projeksiyon kodunun iki kopyası, ileride biri düzeltilip diğeri
unutulacak bir çift demek. Reddedildi.

Yeniden adlandırmanın yayılma alanı dört referans, hepsi bu işin kendi içinde:

| Dosya                                          | Ne değişir          |
| ---------------------------------------------- | ------------------- |
| `backend/src/scripts/render-region-maps.ts:12` | import              |
| `backend/src/scripts/render-region-maps.ts:6`  | doküman yolu yorumu |
| `backend/src/scripts/region-map-svg.spec.ts:2` | dosya adı ve import |
| `backend/docs/ops/region-map-images.md:48,62`  | link ve dosya adı   |

Repoda `region-map-svg`'ye başka referans, `region-map-images.md`'ye ise
script'in başlık yorumu dışında hiçbir link yok.

### 3. Üretim scripti

`backend/src/scripts/render-constellation-maps.ts`, `render-region-maps.ts`'in
kardeşi. Aynı iki sorgu; gruplama `region_id` yerine `constellation_id`. Bir
stargate'in iki ucu aynı constellation'daysa iç bağlantı, değilse dışa çıkan
stub — region'daki mantığın aynısı, bir seviye aşağıda.

Çıktı: `frontend/public/images/constellations/{constellation_id}.svg`.

Region script'inin iki güvenlik davranışı aynen taşınır:

- Bütün haritalar önce bellekte üretilir, sonra yazılır. Yarıda kesilen bir koşu
  diske eksik set bırakmaz.
- Dizin mutabakatı: bu koşunun yazmadığı `<rakam>.svg` dosyaları silinir, ama
  `MAX_REMOVAL_FRACTION = 0.25` koruması altında
  (`render-region-maps.ts:145`). Silinecek dosya diskteki setin dörtte birinden
  fazlaysa silme adımı atlanır ve nedeni yazdırılır. 1.184 dosyada bu koruma
  region'dakinden daha kritik: bozuk bir `WHERE` bütün seti süpürebilir.

`backend/package.json`'a iki satır:

```json
"render:constellation-maps": "tsx src/scripts/render-constellation-maps.ts",
"render:maps": "yarn render:region-maps && yarn render:constellation-maps"
```

`render:maps` SDE güncellemesinden sonra çalıştırılacak tek komut olsun diye var;
iki ayrı komutun birinin unutulması, region ile constellation'ın birbirinden
farklı topolojiye göre çizilmiş olması demek. Proje kuralı gereği bu ayrı bir
script dosyası değil, tek satırlık bir `package.json` girdisi.

### 4. Frontend

`ConstellationMap` bileşeni ve `constellationMapUrl` yardımcısı, `RegionMap` /
`regionMapUrl`'ün kardeşi olarak eklenir — dosya bulunamazsa kendini kaldıran
aynı `onError` davranışıyla. Bir SDE güncellemesi yeni bir constellation
getirip script çalıştırılmadıysa, kırık görsel ikonu yerine hiçbir şey gösterilir.

| Yer                               | Boyut | Bugün ne var                           |
| --------------------------------- | ----- | -------------------------------------- |
| `constellations/[id]/page.tsx:72` | 96px  | `MapIcon`, `w-12 h-12 text-purple-500` |
| `constellations/page.tsx:158`     | 64px  | ikon yok, sadece `<Link>`              |
| `regions/[id]/page.tsx:256`       | 24px  | `MapIcon`, `w-5 h-5 text-purple-400`   |
| `solar-systems/[id]/page.tsx:192` | 20px  | `MapIcon`, `w-4 h-4 text-purple-500`   |

Dördünden üçünde jenerik mor `MapIcon` var ve harita onun yerine geçer;
`constellations/page.tsx`'te satırda ikon yok, harita eklenir. `MapIcon`
importu, dosyada başka kullanımı kalmayan yerlerden düşer.

`RegionMap` ile ortak bir `StarMap` bileşenine indirmek değerlendirildi ve
alınmadı: mevcut beş `RegionMap` çağrı yerinin hepsini değiştirmeyi gerektiriyor
ve projenin alan başına bir bileşen düzenine ters. İki bileşen arasındaki
tekrar 30 satır ve bilinçli.

### 5. Depolama: repoda kalır

1.184 dosya, tahminî **~1,5 MB**. Tahmin ölçülmüş orandan geliyor: region seti
15.849 çizim elemanını 1.233.736 byte'ta tutuyor, eleman başına ~77 byte.
Constellation seti 16.764 eleman (8.490 nokta + 5.704 iç bağlantı + 2.570 stub)
artı 1.184 SVG başlığı ≈ 1,47 MB.

Yani dosya sayısı on katına çıkarken toplam boyut halihazırda commit'li olanla
aynı mertebede kalıyor. Faz 1'de R2 bu gerekçeyle reddedilmişti; gerekçe hâlâ
geçerli. Diff'in SDE güncellemesinin haritaya ne yaptığının kaydı olması da
aynen sürüyor.

### 6. Çizilecek bir şeyi olmayan constellation'lar

- **418 constellation'ın hiç stargate'i yok** (3.222 sistem) — wormhole ve
  abyssal uzay. Yalnızca beyaz noktalar olarak çizilirler. Region tarafında 46
  bölge için verilen karar buydu: yedek görsel yok, çünkü o alanların gerçekten
  kapı topolojisi yok.
- **420 constellation'ın hiç iç bağlantısı yok** — 418'i yukarıdakiler, ikisi
  yalnızca dışa çıkan kapıya sahip.
- **8 constellation tek sistemli.** Tek nokta, varsa stub'larıyla. `span = 0`
  yolu modülde zaten var (`region-map-svg.ts:90`, ölçek katsayısı 1'e sabitlenir).

## Dosya haritası

**Eklenen**

- `backend/src/scripts/render-constellation-maps.ts`
- `backend/src/scripts/star-map-svg.spec.ts` (yeniden adlandırılan spec'e
  constellation paleti testleri eklenir)
- `frontend/src/components/ConstellationMap/ConstellationMap.tsx` + `.spec.tsx`
- `frontend/src/utils/constellationMapUrl.ts` + `.spec.ts`
- `frontend/public/images/constellations/*.svg` (1.184 dosya)

**Yeniden adlandırılan**

- `backend/src/scripts/region-map-svg.ts` → `star-map-svg.ts`
- `backend/src/scripts/region-map-svg.spec.ts` → `star-map-svg.spec.ts`
- `backend/docs/ops/region-map-images.md` → `star-map-images.md` (ikisini birden
  anlatacak şekilde genişletilir)

**Değişen**

- `backend/src/scripts/render-region-maps.ts` — import ve palet parametresi
- `backend/package.json` — iki script satırı
- `frontend/src/app/constellations/page.tsx`
- `frontend/src/app/constellations/[id]/page.tsx`
- `frontend/src/app/regions/[id]/page.tsx`
- `frontend/src/app/solar-systems/[id]/page.tsx`

## Doğrulama

1. `yarn workspace backend test` — `star-map-svg.spec.ts` iki paleti de kapsar.
2. **Region regresyon kontrolü:** `yarn render:region-maps` sonrası
   `git status --porcelain frontend/public/images/regions` boş olmalı. Refactor
   region çıktısını byte düzeyinde değiştirmediyse bu böyle olur; değiştirdiyse
   refactor yanlıştır.
3. `yarn render:constellation-maps` — beklenen çıktı 1.184 dosya, 8.490 sistem,
   5.704 iç bağlantı, 2.570 dışa çıkan kapı, 0 stale dosya.
4. `yarn workspace backend build`, `yarn workspace frontend lint`,
   `yarn workspace frontend build`.
5. `npx prettier --check` — değişen dosyalar üzerinde.
6. Görsel doğrulama kullanıcıya ait: dört sayfa gözle kontrol edilir.

## Sonraya bırakılanlar

- Sistem görselleri ve killmail satır ikonu.
- 64px altındaki boyutlar için ikinci, daha kalın bir dosya.
- Toplam ~9.800 dosyaya çıkıldığında R2 tartışması.
