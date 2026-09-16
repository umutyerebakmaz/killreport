# Evren haritasının PixiJS'e taşınması — tasarım

> Faz 1 (#202) ve faz 2 (#203) `main`'de, deck.gl 9.4 ile. Bu belge o iki fazın
> **frontend'ini** PixiJS 8 üzerinde yeniden yazmanın tasarımı. Backend'e tek
> satır dokunulmuyor.
>
> Önceki belgeler, ölçümlerin türetildiği yer olarak hâlâ geçerli:
> [faz 1–2 tasarımı](2026-09-12-universe-map-design.md),
> [faz 1 planı](../plans/2026-09-13-universe-map-phase-1.md),
> [faz 2 planı](../plans/2026-09-13-universe-map-phase-2.md).
> Bu belge onların **render katmanına dair** kararlarını geçersiz kılar;
> ölçülmüş sabitlerini ve backend tasarımını korur.

## Amaç ve kapsam

**Bu dilim `main`'in bugün yaptığının aynısını yapar.** Aynı görünüm, aynı LOD
davranışı, aynı URL sözleşmesi, aynı sorgular. Tek değişen şey pikselleri neyin
çizdiği.

Kabul kriteri buradan doğuyor ve kasıtlı olarak serttir: **`/map` ekranda
`main`'inkinden farklı görünmüyorsa geçiş doğrudur.** Fark görünüyorsa ya hata
vardır ya da yazılmamış bir karar.

**Kapsam dışı, her biri kendi dilimi:**

| Konu                                      | Nereye                                  |
| ----------------------------------------- | --------------------------------------- |
| Görsel dil (parlama, derinlik, hareket)   | Kendi dilimi — kullanıcı erteledi       |
| Etiketler (sistem, takımyıldız, bölge)    | Kendi dilimi, bu geçişin hemen ardından |
| Picking, hover, popup, `?focus=`          | Faz 3                                   |
| Renk katmanı kaydı, aktivite, sovereignty | Faz 4                                   |
| Backend servisleri, şema, Redis önbelleği | Değişmiyor                              |

### "Aynı görünüm" tam olarak ne

Kabul kriteri buna dayandığı için tanımı belirsiz bırakılamaz. Bugünkü
görünümü tanımlayan sabitler, `main`'deki yerleriyle:

| Ne               | Değer                                                | Nerede                       |
| ---------------- | ---------------------------------------------------- | ---------------------------- |
| Security rampası | EVE'in 11 duraklı rampası, `#F00000` … `#2FEFEF`     | `utils/map/colorScales.ts`   |
| Sistem yarıçapı  | `node.radius`, dünya biriminde; **taban 1,5 px**     | `layers/systems.ts:14`       |
| Gate hattı       | `#94A3B8`, alfa 140/255; genişlik 1 px, taban 0,5 px | `layers/edges.ts:7,14`       |
| Yıldız           | 7 px, `#FFF4EA`                                      | `layers/celestials.ts:40,68` |
| Gezegen          | 4,5 px, `#9CA3AF`                                    | aynı                         |
| İstasyon         | 3 px, `#38BDF8`                                      | aynı                         |
| Geçit            | 3 px, `#4CC94C`                                      | aynı                         |
| Ay               | 2 px, `#64748B`                                      | aynı                         |
| Kuşak            | 1,5 px, `#A16207`                                    | aynı                         |
| Zemin            | `bg-ground`                                          | `UniverseMap.tsx`            |
| Yön              | `flipY: false` — **+z ekranda yukarı**               | `UniverseMap.tsx:23`         |

Son satır sessizce bozulması en kolay olanıdır: bölge ve takımyıldız SVG'leri
"x ekran x, −z ekran y" ile üretiliyor, ve kendi küçük resimleriyle
anlaşmayan bir harita kimsenin adını koyamayacağı bir hatadır. Pixi'nin kendi
ekran koordinatı +y aşağı olduğu için bu, kamerada açıkça ele alınması gereken
bir karardır — kendiliğinden doğru gelmez.

## Neden taşınıyor

Karar kullanıcınındır ve dört gerekçeyle alınmıştı. Spike ikisini değiştirdi;
gerekçenin dürüst hâli şudur:

| Gerekçe                                           | Durum                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| deck.gl'in layer/accessor/`updateTriggers` modeli | **Geçerli.** Bu dilimin asıl kazancı.                             |
| Etiketler için daha iyi zemin                     | **Geçerli.** `TextLayer` yerine `BitmapText`.                     |
| Bundle boyutu                                     | **Düştü.** Ölçüldü: deck.gl 197 KB gzip, pixi 204 KB. Kazanç yok. |
| Görsel his                                        | **Ertelendi.** Kullanıcı bugünkü görünümün kalmasını istedi.      |

Spike sırasında ikisi eklendi ve bunlar tek başlarına geçişi haklı çıkarır:

- **Sprite'larda kayan orijine gerek kalmıyor.** Aşağıdaki float32 bölümüne bak.
- **Orijin taşındığında 5.241 attribute'un yeniden yüklenmesi kayboluyor.**
  deck.gl'de `updateTriggers: { getPosition: [origin.x, origin.z] }` bunu her
  odak değişiminde tetikliyordu.

## Ölçülmüş bulgular (spike, 2026-09-13)

Spike atılacak koddu; dalı `spike/pixi-universe-map`'ti ve 2026-09-16'da
kaldırıldı. Commit `probe/pixi-universe-map` tag'inde duruyor. Ölçümler:

| Büyüklük                                     | Değer                        | Nasıl                              |
| -------------------------------------------- | ---------------------------- | ---------------------------------- |
| Counter-scale geçişi, 5.241 sprite           | **maks 0,60 ms**             | Kullanıcının makinesi, gerçek veri |
| Pan/zoom akıcılığı, 5.241 sprite + 6.959 hat | **Sorunsuz**                 | Kullanıcının gözü; ms not alınmadı |
| deck.gl + luma.gl izi olan chunk'lar         | 702 KB ham / **197 KB gzip** | `.next-check/static/chunks`        |
| pixi.js izi olan chunk'lar                   | 704 KB ham / **204 KB gzip** | aynı yöntem                        |

Bundle sayıları **üst sınırdır**: chunk'lar başka kod da taşır, ve probe
`pixi.js`'in tamamını import eder. Gerçek uygulamada bir miktar düşebilir; ama
"Pixi daha hafif" varsayımı bu ölçümle ayakta durmuyor.

0,60 ms şu demek: 60 fps'te kare bütçesinin %3,6'sı, üstelik her karede değil
yalnızca zoom değiştiğinde. Sistem katmanını shader'a indirmek için bir sebep
yok.

### Çürütülmüş varsayım: dünya birimi

Tasarımın ilk hâlinde koordinatı `metre / 1e12` tutmak "float32'ye pay açar"
diye geçiyordu. **Yanlıştır ve tekrar türetilmemesi için buraya yazılıyor.**
float32 göreli hassasiyetlidir; adım daima değerin ~2⁻²⁴'üdür. 4,79e17 m için
adım 3,44e10 m; aynı sayı 4,79e5 birim olduğunda adım 0,031 birim, yani yine
3,13e10 m. Sabit bölme ölçeği kaydırır, hassasiyeti değil.

Koordinat **metre** kalır, faz 1 ve 2'deki gibi.

## float32, ve orijinin neden küçüldüğü

Pixi'nin batcher'ı köşe konumunu şöyle yazıyor
(`node_modules/pixi.js/lib/rendering/batcher/shared/DefaultBatcher.js:45`):

```js
float32View[index++] = a * x + c * y + tx;
```

`a`, `c`, `tx` dünya matrisinin bileşenleri ve **JavaScript sayısı, yani
float64**. Çarpım float64'te yapılıyor, float32 tampona yazılan şey sonucun
kendisi — ekran koordinatı, 0–2000 mertebesinde. Yani büyük galaktik koordinat
float32'ye hiç inmiyor.

Bunun bir bedeli var ve seçim buradan çıkıyor:

|                       | Dönüşüm nerede         | float32'ye yazılan             | Kamera hareketinde CPU       |
| --------------------- | ---------------------- | ------------------------------ | ---------------------------- |
| Normal `Container`    | JS'te, **float64**     | ekran koordinatı (~0–2000)     | her karede yeniden paketleme |
| `enableRenderGroup()` | GPU'da, uniform matris | **dünya koordinatı** (~4,8e17) | yok                          |

**Karar: render group kullanılmıyor.** Sebebi ölçüm — probe bu pahalı yolu
kullanıyordu ve FPS sorunsuzdu. Karşılığında sprite'lar için kayan orijin diye
bir şey kalmıyor; deck.gl'in en dipte ölçtüğü 299 px titreme hiç doğmuyor.

### Tek istisna: gate hatları

`Graphics` tek bir geometri tamponu kurar ve o tampon float32'dir; sprite'ların
aksine her karede yeniden paketlenmez. Yani 6.959 hattın köşeleri dünya
koordinatında float32'de durur ve **kayan orijin yalnızca burada gereklidir.**

Cevabı LOD'dan doğal olarak çıkar:

- **Galaksi zoom'unda** tam hat geometrisi, sahne merkezine göre. float32 adımı
  3,4e10 m, ki faz 1'in ölçtüğü gibi o zoom'da **0,22 px**. Sorun yok.
- **Sistem içi zoom'da** tam geometri gizlenir; ekranda zaten bir avuç hat
  vardır. Yerine odaklı sistemin **ve gate komşularının** uçlarından geçen
  hatlar — faz 2'nin `mapCelestials` için kullandığı komşuluğun aynısı, en
  fazla 9 sistem — odaklı sistemin merkezine göre küçük bir `Graphics` olarak
  kurulur. Sayılar küçük, hassasiyet tam.

Böylece deck.gl'de mecbur olduğumuz şey — orijin her değiştiğinde bütün sahnenin
yeniden yüklenmesi — hiç yaşanmaz. Yeniden kurulan tek şey bir avuç hattır.

## Mimari sınır

**Kural:** bir şey **karar** ise `utils/map/`'te saf fonksiyondur ve testi
vardır; bir Pixi nesnesine **atama** ise `scene/`'dedir ve testi yoktur.

deck.gl'de her şey "layer prop'u üreten fonksiyon" biçimindeydi, çünkü test
edilebilirliğin tek yolu oydu. Rahatsız edici accessor modeli oradan geliyordu.
Pixi'de sınır başka yere düşüyor: karar verilecek her şey saf fonksiyonlarda
hesaplanır, Pixi tarafı yalnızca uygular. Bir hata ya matematiktedir — test
yakalar — ya da çizimdedir, gözle görülür.

`scene/` katmanının testsiz olması ihmal değil, projenin kendi kuralıdır:
görsel doğrulama kullanıcıya aittir.

## Sahne ağacı

```
stage
├── (kamera dışı katmanlar — bu dilimde yok)
└── world                      kamera: position = pan, scale = zoom
    ├── edgesGalaxy   Graphics   6.959 hat, sahne merkezine göre
    ├── edgesLocal    Graphics   odaklı komşuluk, odağa göre
    ├── systems       Container  5.241 Sprite, tek paylaşılan texture
    └── celestials    Container
        └── sys:<id>  Container  ← sistemin dünya konumunda
             └── yıldız, gezegen, istasyon, geçit, ay, kuşak (Sprite)
```

Sistem başına ara `Container`, float64 kompozisyonunun doğal sonucudur:
çocuklar sistemin merkezine göre durur, büyük koordinat ebeveynin transform'unda
kalır. deck.gl'de bu elle yapılıyordu — `celestialsLayerProps`'un `getPosition`'ı
her nesne için `system.x + celestial.x` topluyordu. O fonksiyon tamamen kaybolur;
hiyerarşi işi görür.

Kova değişimi `container.visible` iledir; nesne yaratılıp yok edilmez.

## LOD

Eşikler faz 2'den **olduğu gibi** taşınır. deck.gl'in zoom'u logaritmikti
(`piksel = metre × 2^zoom`); Pixi'de kamera `world.scale`, yani doğrusal.
Dönüşüm birebir: `scale = 2^zoom`. İkisi de aynı fiziksel mesafenin piksele
ulaşmasını tarif ettiği için ölçülmüş eşikler geçerliliğini korur.

| Kova       | zoom            | Sahnede ne var                                                            |
| ---------- | --------------- | ------------------------------------------------------------------------- |
| `galaxy`   | < −40           | `edgesGalaxy`, `systems`                                                  |
| `approach` | −40 … −36,18    | aynısı; diskler büyümeye başlar                                           |
| `interior` | −36,18 … −26,51 | `edgesGalaxy` gizlenir, `edgesLocal` gelir; yıldız/gezegen/istasyon/geçit |
| `fine`     | ≥ −26,51        | + aylar ve kuşaklar                                                       |

`MAX_ZOOM` = −24,51 (ince eşik + 2), faz 2'deki gibi mutlak.

**URL sözleşmesi değişmez** — `?x=&z=&zoom=`, `zoom` logaritmik. Faz 1 ve 2 ile
paylaşılmış bağlantılar çalışmaya devam etsin diye; bedeli tek satırlık bir
`2 ** zoom`.

**Counter-scale** zoom değiştiğinde çalışır, her karede değil. Debounce
edilmez: diskin sürekli büyümesi bu tasarımın hissidir, kademelendirmek mod
geçişi gibi görünür.

## Dosya yapısı

```
frontend/src/utils/map/          saf, Pixi bilmez, testli
├── camera.ts        zoom↔scale, autofit, URL serileştirme, limitler
├── lod.ts           mutlak eşikler, kova, kovada ne görünür
├── origin.ts        kayan orijin — yalnızca hat geometrisi için
├── topology.ts      gate komşuları
├── colors.ts        security rampası, celestial renkleri
├── marks.ts         tür → piksel yarıçapı, counter-scale çarpanı
└── webgl.ts         yetenek kontrolü (Pixi de WebGL ister)

frontend/src/components/UniverseMap/
├── UniverseMap.tsx       React kabuğu: sorgu, ölçü, mount, temizlik
├── useMapCamera.ts       URL kamerası
├── useMapCelestials.ts   sorgu hook'u — olduğu gibi kalır
└── scene/                Pixi'nin kendisi, testsiz
    ├── createScene.ts    container ağacını bir kez kurar
    ├── systems.ts        5.241 sprite
    ├── edges.ts          iki Graphics
    ├── celestials.ts     sistem başına container
    └── camera.ts         pan/zoom/counter-scale uygular
```

**Silinen:** `frontend/src/components/UniverseMap/layers/` tamamen, ve dört
deck.gl paketi (`@deck.gl/core`, `/layers`, `/react`, `/widgets`).
`@deck.gl/widgets` zaten hiç kullanılmıyordu.

**Eklenen:** `pixi.js` 8.20.1. **Yarn ile, asla npm.**

## Veri akışı

Değişmez. `useMapGeometryQuery` ve `useMapCelestialsQuery` aynı dokümanları
aynı `cache-first` politikasıyla çağırır, 16 sistem sınırı aynıdır, backend'e
dokunulmaz. `/map/page.tsx`'in `ssr: false` dinamik import'u da kalır — Pixi de
deck.gl gibi modül kapsamında `window` arar.

## Test ve doğrulama

Test sayısı düşmez, taşınır. Bugünkü `layers.spec.ts` (28 test) ve
`UniverseMap.spec.tsx` (17 test) silinir, ama içlerindeki gerçek mantık —
gate uçlarının çapalanması, tür filtreleme, marka boyut hiyerarşisi, kamera URL
gidiş-dönüşü, kovada hangi katmanın görüneceği — `utils/map/`'te saf fonksiyon
olarak kalır ve testleri onlarla gelir. Testsiz kalan tek şey `sprite.x = ...`
satırlarıdır.

**Doğrulama iki ayaklıdır.**

Ajan tarafı: birim testleri, `yarn workspace frontend typecheck`, `lint`
(`main`'in sayısına karşı **sıfır fark**), `build:check` (`/map` rota
listesinde), `prettier --check .`, ve `mapGeometry` / `mapCelestials`'a canlı
sorgu. Backend değişmediği için üç sahne (5241/6959, 27/30, 2604/0) ve Jita'nın
67 nesnesi aynı çıkmalıdır — değişirse geçişin dışında bir şey bozulmuştur.

Kullanıcı tarafı: `/map`'i açıp `main`'inkiyle karşılaştırmak. Kapsam "aynısını
yap" olduğu için kriter nettir.

## Riskler

**Bilinen tek açık soru `Graphics`'in gerçek davranışıdır.** 6.959 segmentlik
tek bir `Graphics`'in batch'lenmediği ve dolayısıyla köşelerinin yerel
float32'de kaldığı kod okunarak çıkarıldı, çalıştırılarak değil. Uygulama
sırasında doğrulanacak; yanlışsa hat geometrisinin kayan orijine ihtiyacı
kalmaz ve tasarım yalnızca **basitleşir**.

İkinci kalem, `systems` için düz `Container` + `Sprite` yerine
`ParticleContainer` gerekip gerekmeyeceğidir. Spike düz Container ile ölçüldü ve
yetti; `ParticleContainer` yalnızca ölçüm gerektirirse gündeme gelir.

## Bu dilimden sonra

1. **Etiketler** — `BitmapText` ve kendi çarpışma filtremiz. deck.gl'in
   `CollisionFilterExtension`'ına dayanan eski plan geçersiz; filtre saf
   fonksiyon olarak `utils/map/`'e yazılır ve testlenir.
2. **Görsel dil** — parlama, derinlik, hareket. Spike'ta dört muamele gerçek
   veri üzerinde denendi; kullanıcı şimdilik bugünkü görünümü seçti.
3. **Faz 3** — picking, hover, popup, `?focus=`. Pixi'de GPU picking bedava
   gelmez; `utils/map/`'te bir quadtree ya da doğrudan tarama gerekir. Faz 2
   `nearestNode`'u 5.241 düğüm üzerinde doğrusal tarıyordu ve yetiyordu.
4. **Faz 4** — renk katmanı kaydı, aktivite, sovereignty.
