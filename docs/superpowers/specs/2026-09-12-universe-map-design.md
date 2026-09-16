# Sürekli evren haritası — galaksiden gezegene tek sahne

**Tarih:** 2026-09-12
**Durum:** Onaylandı (2026-09-13) — uygulama faz faz yürüyor
**Bağlam:** Issue #176 (#175'i kapatıp devralıyor). Bu spec #176'nın önerisini
olduğu gibi almıyor: her sayısı 2026-09-12'de üretim veritabanında yeniden
ölçüldü ve ölçüm dört yerde tasarımı değiştirdi. Ayrıldığımız yerler aşağıda
ayrı bir bölümde, gerekçeleriyle listeli.

## Problem

Killmail verisi coğrafi, ama bugün yalnızca tablo olarak okunabiliyor. Mevcut
tek harita `/sovereignty/map`: ECharts scatter, alliance başına bir seri, 5.383
nokta, gate hattı yok, seçim legend'dan yapılıyor. İki kusuru var.

Birincisi ölçülebilir: paletinin ilk altı rengi veri-görselleştirme
doğrulayıcısının beş testinden üçünde başarısız — `#22d3ee`, `#f97316`,
`#22c55e`, `#eab308` lightness bandının dışında, sarı↔yeşil protan ΔE 4,2,
kırmızı↔turuncu normal görüşte ΔE 10,4 (15 tabanının altı). Palette ayrıca iki
ayrı camgöbeği var (`#22d3ee` ve `#06b6d4`). Yani "harita tasarımı kötü" bir
zevk meselesi değil.

İkincisi yapısal: sistemin içi diye bir şey yok. Sistem noktasına tıkladığında
gezegenleri, istasyonları, geçitlerini göremiyorsun — oysa o veri
veritabanında tam.

## Hedef

Tek sahne, tek render, tek sürekli zoom: New Eden'ın tamamından bir gezegene
kadar. Sistem bir noktayken diske dönüşüyor, içinde gezegenleri, ayları,
asteroit kuşaklarını, istasyonlarını ve geçitlerini gerçek konumlarında
taşıyor. Mod değiştirme yok, ayrı "sistem görünümü" sayfası yok.

Üzerine analitik katmanlar biniyor: güvenlik, kill yoğunluğu, sovereignty.

**Kapsam dışı:** oyun içi haritanın düzleştirilmiş yerleşimi (yalnızca SDE'de
var, ESI vermiyor; metrik olmadığı için gerçek ölçekli yuvalamayla
bağdaşmıyor), 3B harita (`y` kolonu veritabanında duruyor, ileride açık),
Abyssal ve Proving sahneleri (gerekçe aşağıda), `/sovereignty/map`'in
kaldırılması (ayrı karar).

## Ölçümler

2026-09-12'de üretim veritabanında. Tasarımın tamamı bunlara dayanıyor.

### Sahne başına

| Sahne               |        Sistem | Kenar (tek yön) | Gezegen |      Ay | İstasyon | Kill (7g) | Extent       |
| ------------------- | ------------: | --------------: | ------: | ------: | -------: | --------: | ------------ |
| New Eden (+Zarzakh) | 5.241 geçitli |           6.959 |  46.398 | 235.843 |    5.152 |    14.466 | 89 × 101 ly  |
| Wormhole            |         2.604 |               0 |  21.789 | 107.519 |        4 |     6.634 | 152 × 120 ly |
| Pochven             |            27 |              30 |     220 |   1.095 |       53 |       506 | 24 × 28 ly   |
| Abyssal             |           200 |               0 |   **0** |       0 |        0 |       320 | 244 × 399 ly |
| Proving             |           201 |               0 |   **0** |       0 |        0 |         0 | 588 × 890 ly |

Toplam 8.490 sistem, 13.978 stargate (hepsinde `destination_system_id` dolu),
6.989 tek yönlü kenar, 5.383 sov satırı, sıfır null pozisyon.

Kapsamlar arası geçit: yalnızca New Eden ↔ Zarzakh (4 çift). Pochven'in 30
kenarının tamamı kendi içinde — kapalı bir bileşen, dışarı çıkan tek geçit yok.

### Geometri

|                                     |                                                           |
| ----------------------------------- | --------------------------------------------------------- |
| Sistem yarıçapı (en uzak celestial) | medyan 3,88e12 m (25,9 AU), maks 3,04e13 m (203 AU)       |
| Gezegen yörüngesi                   | min 2,41e10 m (0,161 AU), medyan 3,60e11 m (2,41 AU)      |
| Ay → gezegen                        | p05 1,09e8 m, medyan 9,54e8 m, p95 1,48e10 m              |
| Celestial / sistem                  | medyan 59, p95 103, maks 159                              |
| Sov sahibi                          | 79 alliance, 22 faction, 89 corporation (≤190 ayrı sahip) |
| Kill / sistem (24s)                 | 640 sistemde kill var; medyan 2, p90 9, p99 41, maks 105  |

### Payload

|                                                   |     ham |       gzip |
| ------------------------------------------------- | ------: | ---------: |
| Düğümler (5.241)                                  | 1,03 MB |     229 KB |
| Düğümler, 1e9 m yuvarlamayla                      | 1,01 MB |     159 KB |
| Kenarlar (6.959)                                  |  264 KB |  **39 KB** |
| Düğümler + kenarlar, iki ayrı JSON belgesi olarak | 1,28 MB |     197 KB |
| **`mapGeometry(NEW_EDEN)` yanıt gövdesi**         | 1,10 MB | **175 KB** |

2026-09-13'te yeniden ölçüldü ve bir madde değişti. İlk ölçümün 142 KB'si
düğümleri gigametre tamsayısı olarak sayıyordu; metre sözleşmesiyle gerçek
sayı 159 KB, kenarlarla birlikte **206 KB** — yani 200 KB bütçesi kendi
tasarımıyla aşılıyordu. (Son iki satırın ayrı olması önemli: 197 KB'lik ölçüm
düğümleri ve kenarları iki ayrı JSON belgesi olarak sıkıştırıyordu; tek bir
GraphQL yanıt gövdesi daha iyi sıkışıyor ve gerçek sayı **175 KB**. Bütçenin
payı iddia edilenden fazla, az değil.) Açığı kapatan tek değişiklik `securityStatus`'un iki
ondalığa indirilmesi (197 KB), ve bunun **yuvarlamayla değil kesmeyle**
yapılması gerekiyor: `ROUND(security_status, 2)` gerçek değeri 0,495–0,5
arasında olan **14 sistemi** 0,50'ye taşıyor ve
`frontend/src/utils/security.ts:11`'in `>= 0.5` eşiği onları highsec ilan
ediyor. `TRUNC(security_status, 2)` her iki eşikte de sıfır kayma veriyor ve
`security.ts:90` zaten tek ondalık gösterdiği için görünürde hiçbir şey
değişmiyor.

## Sahne modeli

Üç ayrı sahne, aynı bileşen, farklı veri. Hepsini tek sahneye sıkıştırmıyoruz.

| Kapsam     | Bölge yüklemi                                                       | Geçitsiz sistemler                            |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------- |
| `NEW_EDEN` | `region_id BETWEEN 10000001 AND 10999999 AND region_id <> 10000070` | dışarıda (217 Jove sistemi autofit'i bozuyor) |
| `POCHVEN`  | `region_id = 10000070`                                              | —                                             |
| `WORMHOLE` | `region_id BETWEEN 11000001 AND 11999999`                           | hepsi içeride; geçit zaten yok                |

- **Pochven ayrı olmak zorunda**, tercih değil: kapalı bileşen. K-space
  sahnesine konsa koordinatları New Eden bulutunun ortasına düşer ve hiçbir
  yere bağlanmayan 27 ada gibi görünür.
- **Zarzakh New Eden'da kalıyor**: 4 geçidi doğrudan K-space'e bağlı.
- **Wormhole sahnesi hak ediyor**: geçit yok ama 2.604 sistemin içi dolu ve 7
  günde 6.634 kill var (New Eden'ın %46'sı). Değeri topolojide değil,
  aktiviteyle renklenen bulut + zoom'da açılan sistem içlerinde. Sov katmanı
  orada kapalı.
- **Abyssal ve Proving sahne almıyor**: 401 sistemin içinde sıfır gezegen,
  sıfır ay, sıfır istasyon var. Çizilecek bir şey yok. Bölge id bantları
  servis içinde belgeli sabit olarak duruyor (sınır kodda açık), ama enum'da
  yer almıyor — boş dönen bir kapsam tuzaktır. ESI'dan abyssal celestial'ları
  gelirse sahne bedavaya eklenir.

Kamera başlangıcı sahneye göre: New Eden medyan sıçrama 13 px'e oturacak
şekilde, Wormhole ve Pochven kendi extent'lerine fit.

## Koordinat sistemi ve hassasiyet

**Birim metre, baştan sona.** Veritabanı metre, ESI metre, servis metre, GPU'ya
giden `nesne − orijin` metre. Işık yılına çevirmiyoruz: çeviri hassasiyete
hiçbir şey katmıyor (sabit çarpan float32'nin bağıl hassasiyetini
değiştirmez), kazancı yalnızca zoom sayılarının okunaklılığı, bedeli ise iki
ayrı çeviri noktası (galaksi düğümleri ve sistem içi ofsetler) — 22,8 zoom
seviyeli bir sahnede birim uyuşmazlığı en zor görülen hata türü. Çeviri sadece
gösterim kenarında: ölçek çubuğu uzakta ly, sistem içinde AU yazıyor.

**Kayan orijin, tek sert kural.** GPU'ya hiçbir zaman ham galaktik koordinat
gitmiyor. Her katman `nesne − orijin` alıyor, çıkarma JS'te float64'te
yapılıyor, orijin kameranın odaklandığı sistemin merkezi.

| GPU'ya giden                                                | float32 adımı | en derin zoomda |
| ----------------------------------------------------------- | ------------: | --------------: |
| Ham galaktik konum (9,57e17 m)                              |    ≈5,70e10 m |      **598 px** |
| Sistem merkezine göre, en büyük sistemin kenarı (3,04e13 m) |     ≈1,81e6 m |    **0,019 px** |
| Sistem merkezine göre, medyan sistem (3,88e12 m)            |     ≈2,31e5 m |        0,002 px |

Yani tek piksele 52× pay (en derin zoomda 1 px = 9,54e7 m). Bilinen ve
kabul edilen köşe: derin zoomda komşu
sistem (~1 ly) orijine göre float32'de ~11 px oynuyor, ama o nokta ekranın 190
milyon piksel dışında ve gate hattının yalnızca açısını belirliyor — açısal
hata 6e-8 radyan.

**Celestial'lar zaten göreli.** Veritabanındaki `planets`, `moons`,
`asteroid_belts`, `stations`, `stargates` pozisyonları sistem merkezine göre
duruyor (ölçüm: gezegen yarıçapları 0,16–203 AU çıkıyor, 1e17 m değil). Yani
sunucuda hiç aritmetik yok; "düğümler galaktik, celestial'lar göreli, ikisi
karışmaz" bir dönüşüm değil, şemada yazılı bir sözleşme.

## Zoom merdiveni ve LOD

`zoom`, deck.gl'in ortografik tanımıyla `piksel = birim × 2^zoom`. Birim metre
olduğu için zoom negatif çıkar.

**Eşikler mutlak zoom olarak yazılıyor, galaksi fit'ine göre değil.** Bu ilk
yazımdan bir düzeltme ve gerekçesi ölçüm: her eşiğin fiziksel tanımı mutlak
("medyan sistem çapı 100 px", "medyan ay ayrımı 10 px"), oysa `z₀` tuvalin
genişliğine göre değişiyor. İlk yazımın `z₀+13,1 / +16,5 / +20,4 / +22,8`
merdiveni 2560 × 1440'ta doğru; 1400 × 900'de aynı fiziksel eşikler
`fit + 13,86 / +17,29 / +21,19 / +23,53`'e düşüyor, yani 0,7 seviye kayıyor ve
sistem içleri diskler 100 px değil ~59 px'ken akmaya başlıyordu. Mutlak
yazıldığında eşiğin adı ne diyorsa o oluyor, ekran ne olursa olsun.

| Mutlak zoom  | Ne görünür                                                           | Dayanak                                                               |
| ------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| galaksi fit  | 5.241 sistem + 6.959 gate hattı, bölge etiketleri                    | medyan sıçrama 13 px; `z₀` = −50,04 (1400×900), −49,36 (2560×1440)    |
| fit … −40    | takımyıldız ve sistem etiketleri (çarpışma filtreli), noktalar büyür | —                                                                     |
| −40 … −36,18 | sistem diski gerçek yarıçapına ulaşıyor                              | yarıçap medyanı 3,8809e12 m                                           |
| **−36,18**   | **sistem içi akar**: yıldız, gezegenler, istasyonlar, geçitler       | medyan sistem çapı 100 px'e ulaşıyor; viewport'ta pratikte tek sistem |
| −32,75       | gezegen etiketleri                                                   | medyan yörünge 3,6018e11 m, 50 px'i geçiyor                           |
| −28,85       | en iç gezegenin yörüngesi rahat okunuyor                             | min yörünge 2,4145e10 m, 50 px                                        |
| **−26,51**   | **aylar ve asteroit kuşakları** (en dip)                             | medyan ay ayrımı 9,5389e8 m, 10 px'e ulaşıyor; 1 px = 9,54e7 m        |

Toplam aralık tuvale göre: 1400 × 900'de 23,5 seviye, 2560 × 1440'ta 22,8.
İlk yazımın "22,8 seviye"si bir tanım değil, geniş ekranın sonucuydu.

Ölçümün getirdiği dürüstlük maddesi: **ayların en yakın %5'i hiçbir zoomda
gezegeninden ayrılmıyor** (p05 1,09e8 m; 10 px için aralığın dışında bir zoom
gerekir; p05 için gereken z₀+25,9, en dipten 3,1 seviye daha derin).
`radiusMinPixels` tabanının doğal sonucu olarak kabul ediliyor; log
ölçekle kurtarılmıyor, yoksa iç içe geçme bozulur.

Sistem içi veri akışı: eşikten (z = −36,18) sonra viewport'ta pratikte tek sistem
olduğu
için "viewport'taki sistemleri çek" = "odaklı sistemi çek". Odağın gate
komşuları da çekiliyor (≤8 sistem, en kötü 159 nesne), böylece o yöne pan
hazır. Sert üst sınır 16 sistem.

**Gate uçlarının yeniden çapalanması.** Galaksi zoomunda hatlar merkez-merkez.
Bir sistemin içi yüklendiği anda hattın bu uçtaki düğümü komşuya giden
**gerçek stargate'in konumuna** kayıyor (`stargates.destination_system_id` her
satırda dolu, eşleme birebir). Nokta diske dönüşürken hatların asıl geçitlerine
oturması, bu işin imza anı.

## Backend

### Şema — `backend/src/schemas/UniverseMap.graphql`

```graphql
enum MapScope {
  NEW_EDEN
  POCHVEN
  WORMHOLE
}

"Galaktik koordinat, metre, 1e9 m'ye yuvarlanmış. Asla ham GPU'ya gitmez."
type MapNode {
  systemId: Int!
  name: String!
  x: Float!
  z: Float!
  radius: Float! # en uzak celestial'a mesafe; LOD geçişini veri belirler
  # İki ondalığa KESİLMİŞ, yuvarlanmamış: yuvarlama 14 sistemi highsec'e taşıyor.
  securityStatus: Float!
  constellationId: Int!
  regionId: Int!
}

"Her çift bir kez, from < to."
type MapEdge {
  from: Int!
  to: Int!
}

type MapBounds {
  minX: Float!
  maxX: Float!
  minZ: Float!
  maxZ: Float!
}

type MapGeometry {
  scope: MapScope!
  nodes: [MapNode!]!
  edges: [MapEdge!]!
  bounds: MapBounds!
}

enum MapCelestialKind {
  STAR
  PLANET
  MOON
  BELT
  STATION
  GATE
}

"Koordinat sistemin merkezine göre, metre, yuvarlanmamış."
type MapCelestial {
  id: Int!
  systemId: Int!
  name: String
  kind: MapCelestialKind!
  x: Float!
  z: Float!
  orbitIndex: Int
  planetId: Int
  destinationSystemId: Int
}

type MapActivity {
  systemId: Int!
  kills: Int!
  iskDestroyed: Float!
}

enum MapOwnerKind {
  ALLIANCE
  FACTION
  CORPORATION
}

type MapSovOwner {
  ownerId: Int!
  kind: MapOwnerKind!
  name: String!
  ticker: String
  systemCount: Int!
  rings: [[Float!]!]! # galaktik metre, düğümlerle aynı yuvarlama
}

extend type Query {
  mapGeometry(scope: MapScope! = NEW_EDEN): MapGeometry!
  mapCelestials(systemIds: [Int!]!): [MapCelestial!]!
  mapActivity(scope: MapScope! = NEW_EDEN, hours: Int! = 24): [MapActivity!]!
  mapSovereignty(scope: MapScope! = NEW_EDEN): [MapSovOwner!]!
}
```

`MapNode.radius` sihirli sabiti kaldırıyor: deck.gl'de `getRadius` dünya
biriminde ve `radiusMinPixels` taban olduğu için ikisi birlikte "nokta
kendiliğinden diske dönüşür" davranışını veriyor — galaksi zoomunda 1,5 px,
eşikte gerçek yarıçap. Payload'a ~15 KB gzip ekliyor.

`MapEdge.external` **yok**: #176 onu kapsam dışına çıkan geçitler için
koymuştu, ölçüm kapsamlar arası geçit sayısını sıfır gösteriyor (New
Eden↔Zarzakh aynı sahnenin içinde), yani alan her zaman `false` dönecekti.

### Servis — `backend/src/services/universe/universe-map.service.ts`

CLAUDE.md'nin yeni okuma yolları için tarif ettiği sade `async function`
biçimi, `@services/prisma` (API'nin 5 bağlantısı), `redis.get` → `$queryRaw` →
`redis.setex`, her parametre anahtarda.

| Anahtar                        | TTL     | Not                                   |
| ------------------------------ | ------- | ------------------------------------- |
| `map:geometry:{scope}`         | 86400 s | statik evren verisi                   |
| `map:celestials:{systemId}`    | 86400 s | **sistem başına**, istek başına değil |
| `map:activity:{scope}:{hours}` | 300 s   | canlı                                 |
| `map:sov:{scope}`              | 900 s   | türetme; gerekçe aşağıda              |

Celestial önbelleğinin sistem başına olması panning'in akıcılığının şartı:
servis `redis.mget` ile hepsini bir turda alıp yalnızca eksikleri sorguluyor.
İstek başına anahtarla `[A,B]` ve `[B,C]` ayrı anahtar olur, B iki kez
sorgulanır.

`map:sov` 900 s, CLAUDE.md'nin TTL tablosunda olmayan bir değer. Gerekçe: bu
bir okuma değil bir türetme (ızgara + marching squares), ve ESI'nın sov
haritası gün ölçeğinde değişiyor; 15 dakikalık tazelik görünmez.

Aktivite `killmails`'ten, `solar_system_id` ile gruplanıp pencereye göre
filtrelenerek. `system_kills` tablosu şimdilik kullanılmıyor: içinde 2.868
satır var, saatlik bir haritayı besleyemez. NPC kill ve jump katmanları o
tablo dolduğunda eklenir.

Migration yok. Mevcut sorgulara ve tiplere dokunan yok; ekleme.

### Sovereignty territory — `sovereignty-territory.service.ts`

Sunucuda hesaplanıyor: bir kez hesaplanıp herkese aynı şekil gidiyor, her
ziyaretçinin cihazında tekrar hesaplanmıyor, ve çıktı girdisinden çok daha
küçük.

1. Girdi: kapsamdaki sahipli sistemler + gate kenarları.
2. Izgara: kapsam sınırları, hücre 0,25 ly → New Eden'da 360 × 410 = 148 bin
   hücre.
3. Her hücre: yarıçap R içindeki en yakın sahip; mesafe hem sistemlere hem
   **aynı sahibe ait kenarlara** ölçülüyor (zincir koridor oluyor, nokta
   bulutu değil), uzak iki tutuşun köprü kurmaması için kenar uzunluğu üst
   sınırı var. Kaba kuvvet 148k × 5,4k ≈ 8e8 işlem; sistemler ve kenarlar aynı
   ızgaraya kovalanıp hücre başına ±6 kova taranıyor → ~20 aday, toplam ~3e6
   işlem.
4. Sahip başına ikili maske → `d3-contour` (backend'e tek yeni bağımlılık) →
   ring yumuşatma → minimum alanın altındakiler atılıyor, delikler korunuyor.
5. Çıktı ring'leri düğümlerle aynı 1e9 m yuvarlamasında.

Payload bütçesi **≤100 KB gzip**; aşılırsa sırayla ring sadeleştirme
(tolerans ızgara hücresine bağlı) ve sahip başına ring sayısı sınırı. Bütçe
kabul kriteri, tahmin değil.

## Frontend

### Route ve yerleşim

`frontend/src/app/map/page.tsx`, `"use client"` + `dynamic(..., { ssr: false })`.
Kök layout'a dokunulmuyor: harita sayfası `main`'in dolgusunu negatif margin'le
geri alıyor, yüksekliği `100dvh − header`, footer altta kalıyor. Ön koşul
header'ın sabit yüksekliği — şu anda içeriğinden doğuyor; `Header`'a tek satır
yükseklik ve `globals.css`'e `--header-h` token'ı.

### Dosya yapısı

```
frontend/src/components/UniverseMap/
├── UniverseMap.tsx        # deck.gl tuvali: view, layer dizisi, picking
├── useMapCamera.ts        # viewState ↔ URL
├── useMapCelestials.ts    # viewport → mapCelestials
├── layers/{systems,edges,celestials,labels,territories,logos}.ts
└── MapControls.tsx · MapLegend.tsx · MapScaleBar.tsx
frontend/src/utils/map/
├── lod.ts          # zoom → ne görünür
├── colorScales.ts  # değer → renk
└── origin.ts       # kayan orijin seçimi ve çıkarma
```

Testler saf util'lere gidiyor; deponun mevcut alışkanlığı bu.

### İki tür state, iki ayrı kural

2026-09-12'de düzeltilen `#201` bu ayrımın bedelini gösterdi: killmails sayfası
filtreleri URL'den yalnızca mount'ta okuyordu, App Router query string
değişiminde bileşeni mount'ta tuttuğu için menüdeki POCHVEN linki sessizce
yutuluyordu.

- **`scope` ve katman seçimleri** düşük frekanslı ve link'le geliyor → her
  render'da URL'den türetiliyor.
- **Kamera** yüksek frekanslı ve pointer'ın yetkisinde → React state'inde
  yaşıyor, URL'e 250 ms debounce ile `router.replace` ediliyor. Harici
  değişimi ayırt etmek için son yazılan query string bir ref'te tutuluyor;
  URL ondan farklıysa değişim harici sayılıp kameraya uygulanıyor.

Böylece ne drag sırasında saniyede 60 history girdisi olur, ne de bir link
yutulur.

### Katman yığını

| Katman                                   | Görünürlük           | Not                                               |
| ---------------------------------------- | -------------------- | ------------------------------------------------- |
| `LineLayer` gate hatları                 | her zaman            | `widthMinPixels: 0.5`                             |
| `PolygonLayer` territory                 | sov açık + uzak zoom | nötr dolgu, parlak kontur                         |
| `IconLayer` sahip logoları               | sov açık             | çakışma filtreli, ≤200                            |
| `ScatterplotLayer` sistemler             | her zaman            | `radiusMinPixels: 1.5`, `getRadius = node.radius` |
| `ScatterplotLayer` celestial             | z ≥ −36,18           | yıldız, gezegen, istasyon, geçit                  |
| `LineLayer` çapalanmış gate uçları       | z ≥ −36,18           |                                                   |
| aylar + kuşaklar                         | z ≥ −26,51           |                                                   |
| `TextLayer` + `CollisionFilterExtension` | kademeli             | görünür etiket ≤300                               |

### Renk katmanı kaydı

Geometri bir kez çekiliyor ve bir daha çekilmiyor. Renk saf fonksiyon:

```ts
export interface MapColorLayer {
  id: string;
  label: string;
  value: (node: MapNode, data: MapLayerData) => number | string | null;
  color: (v: number | string | null) => [number, number, number, number];
  legend: LegendSpec;
}
```

Katman değiştirmek = `updateTriggers.getFillColor` ile 5.241 öğelik bir GPU
attribute'unu yeniden kurmak; ağ trafiği sıfır. Yeni analitik katman = kayda
bir giriş + bir sorgu; sahneye dokunulmuyor.

### Performans

5.241 nokta + 6.959 hat deck.gl için önemsiz; mevcut ECharts haritasının derdi
17 ayrı seri ve her karede DOM/canvas işiydi. Üç kural: zoom'dan **ayrık LOD
kovası** türetiliyor (galaksi / yaklaşma / iç / ince), böylece layer prop'ları
sürekli değil kova sınırında değişiyor; layer dizisi `useMemo` ile
`[geometry, renkDurumu, lodKovası]`'na bağlı; etiketler viewport'a kırpılıp
sayıları sınırlanıyor — tek gerçek maliyet kalemi onlar.

### Hata ve boş durumlar

Geometri hatası → tuval alanında mesaj, boş sayfa değil. Celestial hatası →
galaksi kullanılabilir kalıyor, bir kez sessiz tekrar, sonra küçük uyarı.
WebGL yoksa açık mesaj.

## Etkileşim

**Picking.** GPU picking, `pickable: true` sistemlerde ve celestial'larda,
`pickingRadius: 4` (1,5 px'lik nokta aksi halde tıklanamaz). Gate hatları
pickable değil. Hover animation frame'e kısılıyor, drag sırasında kapatılıyor.
Hover'da tek satır tooltip, tıklamada popup.

**Popup.** Tuvalin içine çizilmiyor: deck.gl'in React child callback'i
viewport'u veriyor, `viewport.project([x − originX, z − originZ])` ile sıradan
bir React bileşeni üste konumlanıyor. Mevcut CSS, `next/link`, `SecurityStatus`
ve `AllianceLink` doğrudan kullanılabiliyor. Üç şart: pointer event'leri
`stopPropagation` (yoksa panel üstünde başlayan drag haritayı kaydırır), konum
viewport'a kırpılıyor, Escape kapatıp odağı tuvale döndürüyor.

Tuval klavyeye açık: `tabIndex`, ok tuşlarıyla pan, `+`/`−` zoom.

**Detay sayfalarına geçiş — #176'dan ayrılıyoruz.** Issue parallel +
intercepting route'lar öneriyor (`@modal/(..)solar-systems/[id]`). Gerek yok,
çünkü kamera zaten URL'de: popup'taki link normal gidiyor, geri dönüldüğünde
`/map?scope=…&x=…&z=…&zoom=…` aynı kareyi kuruyor. Dönüşün maliyeti bir HTTP
turu + layer'ların yeniden kurulması; sorgu Redis'ten dönüyor, veritabanına
gitmiyor (aşağıya bakın). Intercepting route'lar ancak remount ölçülüp gözle
görülür biçimde yavaş çıkarsa gelir — deponun hiç kullanmadığı iki
konvansiyonu kritik yola sokmanın karşılığı yok.

**Dönüşte ne oluyor, tam olarak.** Cache bizim Redis'imiz; Apollo'nun
in-memory cache'i bu depoda ağ trafiğini kesmiyor.
`frontend/src/lib/apolloClient.ts:244` `watchQuery` varsayılanını
`cache-and-network` yapıyor ve `useQuery` watchQuery'dir — cache'te veri olsa
bile her mount'ta istek çıkar, cache yalnızca ilk kareyi anında boyar.
`:248`'deki `query` varsayılanı ise `network-only`. Depoda hiçbir çağrı
`fetchPolicy` override etmiyor. Yani remount'ta istek **çıkıyor**; ucuz olması
sunucu tarafındaki iki Redis katmanı sayesinde:

1. Servisin `map:geometry:{scope}` anahtarı, 86400 s.
2. Envelop response cache (`backend/src/plugins/response-cache.plugin.ts`) —
   resolver'a hiç girmeden tüm yanıtı döner, ama ancak operasyon
   `PUBLIC_CACHE_QUERIES`'e (`backend/src/config/cache.ts:36`) ve TTL'i
   `TTL_PER_SCHEMA_COORDINATE`'e (`backend/src/config/cache.ts:80`) yazılırsa.
   Faz 1 ikisini de yapıyor: `'MapGeometry'` listeye, `'Query.mapGeometry'`
   `CACHE_TTL.STATIC_GAME_DATA` ile tabloya. Yazılmazsa 120 s
   `DEFAULT_PUBLIC`'e ve token başına session anahtarına düşer — statik evren
   verisi için ikisi de yanlış.

Geometri sorgusu **tek istisna olarak `fetchPolicy: 'cache-first'`** ile
çağrılıyor, çağrı yerinde, global varsayılana dokunmadan (varsayılanı
değiştirmek her sayfayı etkiler). Gerekçe veri: evren geometrisi statik,
tazelenecek bir şeyi yok. Aktivite ve sov sorguları varsayılanda kalıyor.

**Dışarıdan girmek.** `/map?focus=30000142` → kamera açılışta o sistemin içine
uçuyor. Killmail, solar system sayfası ve arama sonucundan "haritada göster"
girişleri buradan bağlanıyor.

## Overlay'ler

### Sovereignty: kimlik renkte değil, işarette

New Eden'da ~70 sahip aynı anda ekranda. Doğrulayıcı bizim zeminde (`#111827`)
tüm-çift testini **üç** renkte geçiyor; dördüncü (sarı) geçmiyor (sarı↔turuncu
deutan ΔE 4,8, normal görüşte 10,6). Yani 70 sahibi renkle ayırt etmek
imkânsız — ve mevcut haritanın 15 renkli paleti bu yüzden kusurlu.

Çözüm kimliği renkten almak:

- Territory dolguları **tek nötr ton** (düşük alfa) + bir tık parlak kontur.
- Kimlik **sahibin logosu**: `IconLayer`, ≤190 URL'den otomatik paketlenen tek
  atlas, tek draw call. Üç gösterim: uzak zoomda poligon merkezine bir logo;
  orta/yakın zoomda sistem noktasının üstünde, çakışma filtreli ve ≤200 üst
  sınırlı (sıra önceliği sahibin sistem sayısı); derin zoomda logo popup'a
  taşınıyor, nokta sistemin kendisi oluyor. Logo yüklenmezse yedek ticker
  yazısı.
- **Karşılaştırma**: en fazla 3 alliance iğnelenebiliyor — `#3987e5`,
  `#d95926`, `#199e70`, bizim zeminde tüm-çift testini geçen üçlü. Dördüncü
  istek en eskisini düşürüyor ve nedeni kullanıcıya yazılıyor.
- Legend her zaman açık: iğnelenenler swatch + ticker, bir de nötr "diğer
  territory".

**Ölçülmüş tuzak:** logo yolu sahibin türüne göre kurulmak zorunda. Alliance →
`/alliances/{id}/logo`, faction ve corporation → `/corporations/{id}/logo`.
Çünkü `images.evetech.net/alliances/{factionId}/logo` **200 dönüyor** ama içi
3.377 baytlık genel yer tutucu — `alliances/1` de aynı dosyayı veriyor, gerçek
bir alliance 8.807 bayt. "Logo yok" durumu HTTP durumuyla anlaşılmıyor; 22
faction sahibi aksi halde boş kutu olarak çizilir.

Zoom eşiği yerine çakışma filtresi kullanılıyor: medyan sıçrama galaksi
zoomunda 13 px ve logo+boşluk için gereken 28 px'e bir zoom seviyesi sonra
ulaşıyor, ama yoğun takımyıldızlar medyandan çok daha sıkı — eşikle açmak
kalabalık bölgeleri lapa yapar.

### Aktivite

Ölçüm (24 s): 8.490 sistemin 640'ında kill var, toplam 2.763, medyan 2, p90 9,
p99 41, maks 105. Ağır çarpık, doğrusal ramp anlamsız. Tek hue, ayrık bin'ler,
ve koyu zeminde yön ters: en düşük değer zemine gömülen en koyu adım.

| kill  | renk                                          |
| ----- | --------------------------------------------- |
| 0     | boya yok — "veri yok" ile "az" aynı şey değil |
| 1–2   | `#184f95`                                     |
| 3–5   | `#1c5cab`                                     |
| 6–11  | `#2a78d6`                                     |
| 12–29 | `#3987e5`                                     |
| 30–59 | `#6da7ec`                                     |
| 60+   | `#9ec5f4`                                     |

Legend sürekli gradyan değil, sınırları yazılı swatch şeridi.

### Katmanlama sözleşmesi

Aynı anda tek büyüklük kodlaması: base (geography / security) **veya**
aktivite. Sov territory ikisiyle de yaşıyor ama aktivite açıkken dolgusunu
bırakıp kontur + logoya düşüyor.

## #176'dan ayrıldığımız yerler

| #   | Issue                                    | Bu spec                                         | Gerekçe                                                                        |
| --- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Tek sahne, kapsamlar enum'da             | Üç ayrı sahne; Abyssal ve Proving sahne almıyor | Pochven kapalı bileşen; Abyssal/Proving içinde sıfır celestial                 |
| 2   | `MapEdge.external`                       | Yok                                             | Kapsamlar arası geçit sayısı sıfır                                             |
| 3   | Parallel + intercepting route'lar        | Kamera URL'de; normal gezinme                   | Aynı sonucu sıfır yeni konvansiyonla veriyor; intercipting ancak ölçümle gelir |
| 4   | Sovereignty `ContourLayer` ile client'ta | Sunucuda, `d3-contour` ile                      | Bir kez hesaplanıp paylaşılıyor; çıktı girdisinden küçük; deterministik        |
| 5   | Payload ~500 KB tahmini                  | Ölçüldü: 181 KB gzip (yuvarlamayla)             | —                                                                              |
| 6   | En kötü sistem 218 celestial             | Ölçüldü: 159                                    | —                                                                              |
| 7   | Sovereignty alliance renkleriyle         | Nötr dolgu + logo; renk yalnızca ≤3 iğnelenmiş  | Doğrulayıcı tüm-çift testinde üçten fazlasını geçirmiyor                       |
| 8   | Birim konuşulmamış                       | Metre, baştan sona                              | Çeviri hassasiyete katkısız, iki hata noktası ekliyor                          |

## Test ve kabul kriterleri

- Hiçbir katmana ham galaktik koordinat girmiyor; test GPU'ya verilen dizilerin
  büyüklüğünü kontrol ediyor.
- Her kenar bir kez, `from < to`: New Eden 6.959, Pochven 30, Wormhole 0.
- Düğüm koordinatları 1e9 m'ye yuvarlanmış; celestial koordinatları
  yuvarlanmamış.
- `securityStatus` iki ondalığa kesilmiş; kesilmiş değerle hesaplanan güvenlik
  sınıfı, ham değerle hesaplananla 8.490 sistemin tamamında aynı.
- Kapsam yüklemleri: NEW_EDEN 5.241, POCHVEN 27, WORMHOLE 2.604.
- `mapCelestials` 16 sistemden fazlasını reddediyor (sessizce kesmiyor).
- Payload: galaksi ≤200 KB gzip (2026-09-13 ölçümü 197 KB), territory ≤100 KB gzip.
- `MapGeometry` `PUBLIC_CACHE_QUERIES`'de ve `Query.mapGeometry`
  `TTL_PER_SCHEMA_COORDINATE`'de `STATIC_GAME_DATA` ile; geometri sorgusu çağrı
  yerinde `cache-first`, global Apollo varsayılanları değişmemiş.
- LOD kova sınırları ölçülen eşiklerle birebir.
- Territory üretimi küçük bir girdide deterministik; kenar köprüleme sınırı
  uzak tutuşları birleştirmiyor.
- Aktivite bin sınırları ölçülen dağılımla uyumlu.
- Komut seti, CLAUDE.md sırasıyla: `backend codegen` → `frontend codegen` →
  `yarn test` → `backend build` → `frontend lint` + `build` → `prettier
--check`. `lint` sayısı main'le karşılaştırılıyor.

**Görsel ve his doğrulaması kullanıcıda:** galaksiden gezegene kesintisiz
zoom'da titreme/kayma, nokta diske dönüşürken hatların gerçek stargate'lere
oturması, derin zoomda pan akıcılığı, territory şekillerinin tanıdıklığı,
etiket yoğunluğu.

## Fazlar

Her faz kendi PR'ı ve kendi incelemesi.

> **Durum, 2026-09-16.** Bu bölüm belgenin geri kalanından daha sonra yazıldı ve
> nerede kalındığının **tek güncel kaydı** budur. Issue #176 2026-09-16'da
> tamamlandı sayılıp kapatıldı: başlığının vaat ettiği şey — galaksiden gezegene
> tek sahne, tek sürekli zoom — teslim edildi. Kalan iş iki issue'ya taşındı:
> faz 4 **#219**, faz 3'ün artıkları **#220**. Aşağıdaki faz 3 ve faz 4
> açıklamaları ise yazıldıkları hâliyle duruyor ve **bir kısmı geçersizdir**;
> hangi kısmı olduğu aşağıda yazılı.

| Faz | İçerik                                                                                                                                            | Durum                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Şema + servis + `mapGeometry`, üç sahne, kayan orijin, kamera ve scope URL'de, `/map`                                                             | **Bitti** — #202                           |
| 2   | `mapCelestials`, sistem başına önbellek, LOD eşikleri, sistem içleri, gate uçlarının çapalanması                                                  | **Bitti** — #203                           |
| —   | **Renderer deck.gl 9.4 → PixiJS 8.** Faz değil: faz 1-2'nin frontend'ini "`/map` `main`'deki gibi görünsün ve davransın" kriteriyle yeniden yazdı | **Bitti** — #204                           |
| —   | Harita yüksekliği: uzun footer `main`'i sıkıştırıyordu, haritanın yüzde yüksekliği onunla çöküyordu                                               | **Bitti** — #205                           |
| —   | Etiketler: bölge, takımyıldız ve sistem adları; zoom'la açılan ve **biriken** üç kademe                                                           | **Bitti** — #206                           |
| —   | Etiketler Pixi `BitmapText`'ten havuzlanmış DOM katmanına taşındı; üç font atlası ve onunla gelen her şey silindi                                 | **Bitti** — f50b077d                       |
| —   | Okunabilirlik: piksel oranı, noktaların büyümesi, etiket hiyerarşisi, overlay yerleşimi                                                           | **Bitti** — #211                           |
| —   | Alan adı alanının ekranda kalan parçasının üstünde duruyor; projeksiyon tek yerde hesaplanıyor                                                    | **Bitti** — #213, #214                     |
| —   | Bölgesinden çıkan geçit kesikli; imleç bir sistemin ya da bir alan adının üstündeyken o alanın kendi gate hatları parlıyor                        | **Bitti** — #216, #217, #218               |
| 3   | Picking, popup, `?focus=`, klavye, mevcut sayfalardan girişler                                                                                    | 3a ve 3b'nin yarısı bitti; kalanı **#220** |
| 4   | Base katmanlar, aktivite, sunucuda territory, sahip logoları                                                                                      | Başlanmadı — **#219**                      |

### Faz 3 üçe bölündü

Beş işi tek dilime sıkıştırmak ikisini de kötü yapardı. Bağımlılık sırasıyla:

| Dilim  | Ne                                                                                                                                                                           | Neye bağlı                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **3a** | İmlecin altındaki sistem, hover ipucu, tıklamada popup — **bitti**, kendi spec'i: [`2026-09-14-universe-map-picking-design.md`](./2026-09-14-universe-map-picking-design.md) | —                                                     |
| **3b** | `?focus=30000142` **bitti** (#210); bölge/takımyıldız/sistem sayfalarından "haritada göster" girişleri hâlâ yok — #220                                                       | 3a — var olmayan bir odak durumuna bağlantı verilemez |
| **3c** | Klavyeyle pan, zoom ve sistemler arası gezinme — #220                                                                                                                        | 3a                                                    |

**Başlangıç 3a'ydı.** Haritayı kullanışlı yapan o, ve diğer ikisi onun
tanımladığı "seçili sistem" kavramının üstüne kuruluyor. 3b'nin `?focus=` yarısı
onun hemen ardından geldi; giriş bağlantıları ve klavye #220'de bekliyor.

### Bu belgenin faz 3 ve 4 metni deck.gl şeklinde ve o kısmı geçersiz

Yukarıdaki _Picking_ ve _Popup_ paragrafları `pickable: true`,
`pickingRadius: 4` ve deck.gl'in React child callback'iyle
`viewport.project(...)` diyor. **Bunların hiçbiri artık yok.** Faz 3, etiketler
diliminin yaptığı gibi Pixi için yeniden tasarlandı — Pixi'de GPU picking bedava
gelmediği için 3a kendi spec'ini yazdı. Faz 4'ün katman yığını da aynı yoldan
geçecek: _Katman yığını_ tablosundaki `ScatterplotLayer`, `PolygonLayer` ve
`IconLayer` deck.gl'in sözlüğü, bizimki değil.

Geçersiz olan yalnızca _nasıl_ yapılacağı. _Ne_ yapılacağı — imlecin altındaki
sistemi bilmek, hover'da tek satır, tıklamada popup, popup'ın tuvale değil üste
konumlanan sıradan bir React bileşeni olması — aynen geçerli.

### 3a'nın sıfırdan yazmayacağı üç şey

- **`nearestNode`** (`frontend/src/utils/map/origin.ts`) — 5.241 düğüm üzerinde
  doğrusal tarama, faz 2'de odak bulmak için yazıldı ve yetti. Quadtree
  gerekmeyebilir; önce ölçülmeli.
- **Ekran projeksiyonu ve viewport kırpması**
  (`frontend/src/utils/map/labels.ts`) — etiket diliminin son düzeltmesinden
  sonra bir `LabelCandidate`'in koordinatları **piksellerin gerçekten olduğu
  yeri** gösteriyor, ki hit test'in istediği tam budur.
- **`useMapCamera`** — URL gidiş-dönüşü, debounce, ve kendi yazdığını başkasının
  yazdığından ayırma. 3b bunu devralıyor.

### Faz 4 öncesi kapanmamış küçük işler

İlk ikisi #220'ye alındı; üçüncüsü kimsenin işi değil, bir kayıt.

- **Gezegen adları** — dördüncü etiket kademesi. Verisi `mapCelestials`'ta hazır
  (`name`), yani payload'ı sıfır. Sistem içi ayrı bir görsel bağlam olduğu için
  etiket diliminden ayrı tutuldu.
- **Kademe başına etiket stili** — `TIER_STYLE`'daki punto, opaklık ve harf
  aralığı bilerek ayarlanmadı: ilk değerler yanlış tipografinin metriklerine
  bakılarak seçilmişti. Gözle ayarlanacak, ve yanındaki yorumun dediği gibi
  `LABEL_CHAR_WIDTH` da birlikte güncellenmeli.
- **Görsel dil** — parlama, derinlik, hareket. Dört muamele gerçek veri üzerinde
  denendi ve kullanıcı şimdilik bugünkü görünümü seçti; probe `spike/pixi-universe-map`
  dalında duruyor.

### İki kural, sonraki fazların devraldığı

- **Karar `frontend/src/utils/map/`'te saf fonksiyondur ve testlidir; Pixi
  nesnesine atama `components/UniverseMap/scene/`'dedir ve testsizdir.** WebGL
  jsdom'da koşmuyor ve görsel doğrulama kullanıcıya ait; ama _ne_ çizileceğine
  karar veren hiçbir şey testsiz tarafta durmuyor.
- **Bir veri kümesi ancak belirli bir zoom'un üstünde gösteriliyorsa, o eşiğin
  altında çekilmemeli de.** Faz 2'nin `mapCelestials`'ı bunu zaten yapıyordu;
  etiket dilimi kural olarak adlandırdı. Faz 4'ün aktivite ve sovereignty
  verisi statik değil ve çok daha büyük olacak.

## Riskler ve açık sorular

1. **Etiket maliyeti** — tek gerçek performans kalemi; viewport kırpma + 300
   sınırı ile karşılanıyor, ölçülecek.
2. **Territory payload'ı** — bütçe aşılırsa ring sadeleştirme.
3. **Popup linkinden dönüşteki remount** — ölçülecek; yavaşsa intercepting
   route'lar faz 5.
4. **Logo atlası** — 190 logo ≈ 1 MB en kötü durum, sov katmanı açıldığında
   tembel yükleniyor; atlas doku sınırı aşılırsa sunucuda önceden paketlenmiş
   bir sprite (R2, #138'in boru hattı zaten var) faz 5.
5. **Wormhole sahnesinin anlamı** — geçitsiz bir bulut; aktivite ve sistem içi
   için değerli, topoloji için değil. Sınıf/statik bazlı alternatif bir
   yerleşim ileride ayrı iş.

## Faz 1 bitti — sonraki fazın devraldıkları

Faz 1 #202'de kapandı. Aşağıdakiler o fazın incelemelerinde bulunup bilerek
ertelendi: hiçbiri Faz 1'de erişilebilir değil, ve her biri onları erişilebilir
kılan fazın işi. Buraya yazılıyorlar ki yeniden keşfedilmek yerine devralınsınlar.

1. **`useMapCamera` `scope` değişince kamerayı sıfırlamıyor.** Hook kamerayı bir
   kez kuruyor ve sonrasında yalnızca **kamera taşıyan** bir URL'i benimsiyor
   (`if (!fromUrl) return`). Elinde başka bir sahnenin galaktik koordinatları
   varken `?scope=` değişirse doğru kurulmuş ama tamamen ekran dışı bir görünüm
   çıkıyor — Pochven'in extent'i 24,5 ly, New Eden'ın 89,3. Aynı kökten ikinci
   yüz: bekleyen 250 ms'lik timer eski `scope`'u kapatıyor, yani 250 ms içinde
   yapılan bir geçiş eski scope'u URL'e geri yazıyor. **Faz 3'ün işi**, çünkü
   giriş noktalarını ekleyen faz bu.
2. **Bozuk URL kamerasından dönüş yolu yok.** `parseCamera` sonlu her sayıyı
   kabul ediyor, yani `?x=1e300` geçerli ama boş bir kare çiziyor ve Faz 1'de
   sıfırlama kontrolü yok. Hedefi sahne sınırlarına kelepçelemek ya da merkezden
   birkaç span'dan uzak bir kamerayı yok saymak kapatır; Faz 3'ün kontrolleri de.
3. **`cameraQuery` query string'i sıfırdan kuruyor**, yani `router.replace`
   bilmediği her parametreyi düşürüyor. Dört parametreyle zararsız; Faz 2/3'ün
   `?focus=`'u ve katman anahtarları için tuzak.
4. **Zoom tavanı `z₀ + 12,88`, `z₀ + 13` değil.** `zoomLimits`, `FIT_PADDING`'in
   `log2(0,92)`'sini zaten içeren `fit.zoom`'u alıyor. Faz 1'in 13,1 eşiğine
   karşı önemsiz, ama Faz 2 tavanı +22,8'e çıkardığında aynı kayma duruyor.
5. **Soğuk önbellekte stampede.** İki Redis katmanı da boşken N eşzamanlı
   `/map` yüklemesi iki sorguyu da ayrı ayrı çalıştırıyor; uçuştaki isteği
   tekilleştiren bir şey yok. Pratikte sahne başına günde bir, ve dört kardeş
   okuma servisinin hepsi aynı şekilde — yani depo çapında bir iş.
6. **Geniş ekranda harita ortalanıyor.** `main`'in `mx-auto max-w-480`'ini bir
   çocuk eleman iptal edemiyor, o yüzden ~1920px üstünde harita kenardan kenara
   değil. `main` altındaki her sayfanın mevcut davranışı; iptal etmek `fixed`
   ya da `w-screen` gibi ayrı bir mekanizma gerektiriyor.
