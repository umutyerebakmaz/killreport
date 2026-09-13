# Evren haritası etiketleri: bölge ve takımyıldız — tasarım

> Harita şu an isimsiz. Bu dilim ona yön duygusu veriyor: galaksi zoom'unda
> bölge adları, biraz yaklaşınca takımyıldız adları. Sistem ve gezegen
> etiketleri **kapsam dışı** — verileri zaten payload'da, kendi dilimlerinde
> gelecekler.

## Amaç

Kullanıcı `/map`'i açtığında nereye baktığını bilsin. Bugün 5.241 isimsiz nokta
görüyor.

**Kapsam:** bölge etiketleri ve takımyıldız etiketleri. Backend'e yeni bir
sorgu, frontend'e ekran uzayında bir etiket katmanı ve saf bir çarpışma
filtresi.

**Kapsam dışı, her biri kendi dilimi:**

| Konu                                | Nereye                                          |
| ----------------------------------- | ----------------------------------------------- |
| Sistem etiketleri                   | Kendi dilimi — veri hazır (`MapNode.name`)      |
| Gezegen etiketleri                  | Kendi dilimi — veri hazır (`MapCelestial.name`) |
| Picking, hover, popup               | Faz 3                                           |
| Renk katmanı, aktivite, sovereignty | Faz 4                                           |
| Görsel dil                          | Kendi dilimi                                    |

## Ölçülmüş bulgular (2026-09-14, üretim veritabanı)

| Büyüklük                                       | Değer                     |
| ---------------------------------------------- | ------------------------- |
| Bölge                                          | **114**                   |
| Takımyıldız                                    | **1.184**                 |
| Konumu null takımyıldız                        | **0**                     |
| `region_id`'si null takımyıldız                | **0**                     |
| Takımyıldızı null sistem                       | **0**                     |
| Takımyıldız konumu ↔ üye sistemlerinin merkezi | 0,06–0,23 ly              |
| Medyan en yakın komşu, bölge                   | 7,4114e16 m (**7,83 ly**) |
| Medyan en yakın komşu, takımyıldız             | 1,3129e16 m (**1,39 ly**) |
| Takımyıldız etiketi payload'ı                  | **31 KB gzip**            |
| Bölge etiketi payload'ı                        | **3 KB gzip**             |

Üç ölçüm doğrudan birer karar taşıyor:

- **Zincir eksiksiz.** Sistem → takımyıldız → bölge yolunda tek null yok, yani
  etiket üretimi hiçbir yerde "verisi olmayan" durumunu ele almak zorunda değil.
- **Takımyıldız konumları kullanılabilir.** Sistemlerle aynı metre uzayındalar
  ve üyelerinin merkezine 0,23 ly'den yakınlar. Hesaplamaya gerek yok.
- **34 KB, `mapGeometry`'yi bütçesinin dışına iter.** Faz 1'in bütçesi 200 KB'dı
  ve `mapGeometry` 175 KB'da duruyor. Payload'ın ayrı bir sorguya binmesinin
  sebebi bu, mimari zarafet değil.

## Backend: `mapLabels(scope)`

Etiketler `mapGeometry`'ye eklenmiyor, kendi sorgusuna biniyor. Aynı statik
evren verisi, aynı 24 saatlik Redis anahtarı, aynı `STATIC_GAME_DATA` response
cache'i, aynı `MapScope` parametresi — ama kendi payload'ı, kendi anahtarı.

Sebebi ölçüm: 175 + 34 = 209 KB, 200 KB bütçesinin dışı. Etiketler sahnenin
çizilmesi için gerekli de değil; aynı isteğe bağlamak ikisini gereksizce
birbirine kilitlerdi.

```graphql
"Bir etiketin türü. Sistem ve gezegen kendi dilimlerinde eklenecek."
enum MapLabelKind {
  REGION
  CONSTELLATION
}

"""
Haritada bir isim. Koordinat **galaktik metre**, düğümlerle aynı uzayda ve
aynı yuvarlamayla (1e9 m ızgara) — etiket bir noktanın yanında duruyor,
ondan daha hassas olmasının anlamı yok.
"""
type MapLabel {
  "Bölgede `region_id`, takımyıldızda `constellation_id`. İki uzay çakışmıyor — bölgeler 10000001+, takımyıldızlar 20000001+ — ama tek anahtar isteyen bir tüketici yine de `kind` ile birlikte anahtarlamalı."
  id: Int!
  name: String!
  kind: MapLabelKind!
  x: Float!
  z: Float!
}

extend type Query {
  """
  Verilen sahnenin bölge ve takımyıldız adları. Statik evren verisi; servis
  Redis'te 86400 s tutuyor, response cache'te STATIC_GAME_DATA.
  """
  mapLabels(scope: MapScope! = NEW_EDEN): [MapLabel!]!
}
```

**Takımyıldız konumu** `constellations.position_x/z`'den doğrudan geliyor.

**Bölge konumu yok ve hesaplanıyor: üye sistemlerinin ortalaması.** Alternatifler
takımyıldızların ortalaması ve sınırlayıcı kutunun merkeziydi. Sistemlerin
ortalaması seçildi çünkü etiketin oturması gereken yer bölgenin _görsel_ ağırlık
merkezi — sistem yoğunluğunun olduğu yer. Takımyıldız ortalaması her takımyıldıza
eşit ağırlık verir ve seyrek/yoğun karışık bölgelerde etiketi sistemlerin
göründüğü yerden kaydırır; kutu merkezi ise uç noktalardaki birkaç sistem
yüzünden etiketi boş uzaya çeker.

**Sahne filtresi `mapGeometry` ile aynı yüklemi kullanır.** Bir bölge ya da
takımyıldız, o sahnede sistemi varsa listeye girer — yoksa girmez. İki sorgunun
sahne tanımı ayrışırsa harita, üzerinde hiç nokta olmayan bir isim çizer.

## Frontend: etiketler ekran uzayında

**Etiketler `world`'ün içine girmiyor; `stage`'e doğrudan biniyor.**

Faz 2'den devreden bir not vardı: dünya konteynerinin y ölçeği negatif
(Pixi'nin ekran y'si aşağı akıyor, haritanın +z'si yukarı), sprite ölçekleri
pozitif. Oraya konan ilk `BitmapText` aynada çıkar. Her etikette `scale.y`'yi
ters çevirmek mümkün ama ekran uzayı üç problemi birden kapatıyor:

|                   | `world` içinde                 | `stage` üzerinde        |
| ----------------- | ------------------------------ | ----------------------- |
| Aynalanma         | Her etikette elle ters çevirme | **Doğmuyor**            |
| Piksel boyutu     | Her zoom'da counter-scale      | **Kendiliğinden sabit** |
| Çarpışma filtresi | Metreden piksele çevir         | **Zaten piksel**        |

Çarpışma filtresi ekran uzayında çalışmak zorunda — iki ismin çakışması piksel
sorusudur, metre sorusu değil. Etiketleri oraya koymak o dönüşümü ortadan
kaldırıyor.

Bedeli, etiket konumlarının kova değişiminde değil **her kamera değişiminde**
yeniden hesaplanması. Görünür etiket tavanlı (≤300) ve hesap `cameraTransform`'un
zaten döndürdüğü çarpımın aynısı; sprite'ların 5.241 elemanlık 0,60 ms'lik
geçişinin yanında ölçülmez.

### Mimari sınır

Faz 2 ve Pixi geçişinin kuralı aynen geçerli: **karar `utils/map/`'te saf
fonksiyondur ve testlidir; Pixi nesnesine atama `scene/`'dedir ve testsizdir.**

`utils/map/labels.ts` hangi etiketin görüneceğine karar verir — girdisi ekran
koordinatlı adaylar, çıktısı hayatta kalanlar. `scene/labels.ts` yalnızca
`BitmapText`'lere yazar.

### Çarpışma filtresi

Açgözlü, tek geçiş, ekran uzayında:

1. Viewport dışındaki adaylar düşer.
2. Kalanlar önceliğe göre sıralanır (bölge > takımyıldız).
3. Her aday için ekran kutusu hesaplanır; kabul edilmişlerden biriyle kesişiyorsa
   düşer.
4. Tavan: **300 görünür etiket.**

O(n·k), n aday ve k kabul edilen sayısı. k ≤ 300 olduğu için en kötü hâl
1.184 × 300, bir karede önemsiz — ve pratikte viewport kırpması n'i çok önce
düşürüyor.

## LOD: hangi zoom'da hangi kademe

Eşikler bu tasarımın geri kalanı gibi **ölçülmüş mesafenin piksele ulaşması**
olarak türetildi, keyfi seçilmedi. Bir ismin okunabilmesi için komşusundan
~60 px ayrılması gerekiyor:

| Kademe      | Medyan komşu | 60 px'e ulaştığı zoom |
| ----------- | ------------ | --------------------- |
| Bölge       | 7,4114e16 m  | **−50,13**            |
| Takımyıldız | 1,3129e16 m  | **−47,64**            |

Galaksi fit'i 1400×900'de −50,04, 2560×1440'ta −49,36. Yani **bölge etiketleri
ilk kareden itibaren okunabilir** — eşik fit'in tam üstüne düşüyor. Takımyıldızlar
fit'ten ~2,4 seviye sonra açılıyor, `APPROACH`'un (−40) epey öncesinde.

İkisi de faz 1 spec'inin "galaksi fit → bölge, fit…−40 → takımyıldız"
satırlarıyla örtüşüyor; fark, artık arkalarında bir ölçüm olması.

**Alt uçta da bir sınır var:** kamera fit'in 2 seviye altına inebiliyor
(`ZOOM_BELOW_FIT = 2`), yani −52'ye kadar. −50,13'ün altında bölge adları da
kapanır — o kadar uzaktan 114 isim birbirinin üstünde durur. Etiketsiz galaksi
en dışarıdaki kare için doğru olan.

**Devir teslim −47,64'te:** takımyıldızlar açılınca bölgeler kapanır. 114 + 1.184
ismi aynı anda yarıştırmak gürültüdür ve çarpışma filtresi bölgelerin çoğunu
zaten düşürürdü. Tek kademe bir anda.

Bu eşikler `utils/map/lod.ts`'e, mevcut dördünün yanına, aynı mutlak zoom
biçiminde ekleniyor. Yeni kova yok — etiket görünürlüğü kovadan değil doğrudan
zoom'dan türüyor, çünkü iki eşik de `galaxy` kovasının içinde kalıyor.

## Metin

`BitmapText`. `Text` her benzersiz dizgi için bir texture rasterize eder;
1.184 takımyıldız adı 1.184 texture demek. `BitmapText` tek bir font atlasından
quad çizer, ve etiketler zaten tek boyutta duruyor.

Font atlası projenin tipografisinden üretilir — Shentox kalıyor, bu dilim onu
değiştirmiyor.

## Test ve doğrulama

**Testli:** `mapLabels` servisi (önbellek isabeti/ıskası, sahne filtresi, bölge
merkezi hesabı, kind eşlemesi), çarpışma filtresi (viewport kırpması, öncelik
sırası, kesişme reddi, 300 tavanı), eşik fonksiyonları.

**Testsiz, gözle:** `scene/labels.ts`'in `BitmapText` yazması.

**Ajan doğrulaması:** birim testleri, `typecheck`, `lint` (`main`'in sayısına
karşı sıfır fark), `build:check`, `prettier`, ve `mapLabels`'a canlı sorgu —
NEW_EDEN'de 114 bölge ve 1.184 takımyıldız, hepsinin adı dolu.

**Kullanıcı doğrulaması:** `/map` açıldığında bölge adları okunuyor mu, biraz
yaklaşınca takımyıldızlara devrediyor mu, isimler üst üste biniyor mu, ve —
devreden tuzağın kontrolü — **yazılar düz mü, ayna görüntüsü değil mi.**

## Riskler

**Font atlası bu depoda ilk kez üretiliyor.** Boyutu, hangi karakter kümesini
kapsayacağı ve build'e nasıl gireceği uygulamada çözülecek. EVE bölge ve
takımyıldız adları ASCII dışına çıkmıyor ama bu doğrulanmalı.

**60 px ayrım varsayımı bir seçim.** Ölçülen şey mesafeler; 60 px'in okunabilir
olduğu yargısı bizim. Kullanıcı ince ayar isteyebilir ve eşikler tek satırlık
sabitler olduğu için bu ucuz.
