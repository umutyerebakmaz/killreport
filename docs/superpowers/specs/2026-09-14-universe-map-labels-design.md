# Evren haritası etiketleri — tasarım

> Harita şu an isimsiz: 5.241 isimsiz nokta. Bu dilim ona yön duygusu veriyor —
> zoom'a göre üç kademe isim, her kademe bir öncekinin üstüne binerek.

## Amaç ve kapsam

Kullanıcı `/map`'i açtığında nereye baktığını bilsin.

**Üç kademe, zoom'la açılıyor ve birikiyor:**

| Kademe | Ne                 |  Adet |
| ------ | ------------------ | ----: |
| 1      | Bölge adları       |   114 |
| 2      | Takımyıldız adları | 1.184 |
| 3      | Sistem adları      | 5.241 |

**Kapsam dışı, kendi dilimleri:** gezegen adları (dördüncü kademe, −32,75;
verisi `mapCelestials`'ta hazır ama sistem içi bambaşka bir görsel bağlam),
picking/hover/popup (faz 3), renk katmanı ve sovereignty (faz 4), görsel dil.

## Ölçülmüş bulgular (2026-09-14, üretim veritabanı)

### Veri tamlığı

| Büyüklük                                       | Değer        |
| ---------------------------------------------- | ------------ |
| Konumu null takımyıldız                        | **0**        |
| `region_id`'si null takımyıldız                | **0**        |
| Takımyıldızı null sistem                       | **0**        |
| Takımyıldız konumu ↔ üye sistemlerinin merkezi | 0,06–0,23 ly |

Zincir eksiksiz: sistem → takımyıldız → bölge yolunda tek null yok. Etiket
üretimi hiçbir yerde "verisi yok" durumunu ele almak zorunda değil. Ve
takımyıldız konumları sistemlerle **aynı metre uzayında**, üyelerinin merkezine
0,23 ly'den yakın — doğrudan kullanılabilirler, hesap gerekmiyor.

### Merdiven

| Kademe      | Medyan en yakın komşu |         |       Eşik | Payload                                 |
| ----------- | --------------------: | ------: | ---------: | --------------------------------------- |
| Bölge       |           7,4114e16 m | 7,83 ly | **−50,13** | 3 KB gzip                               |
| Takımyıldız |           1,3129e16 m | 1,39 ly | **−47,64** | 31 KB gzip                              |
| Sistem      |           3,4944e15 m | 0,37 ly | **−45,73** | **0** — `MapNode.name` zaten payload'da |

Eşikler bu tasarımın geri kalanı gibi türetildi, seçilmedi: bir ismin okunabilmesi
için komşusundan **~60 px** ayrılması gerekiyor, ve eşik o mesafenin 60 px'e
ulaştığı zoom. Aralar 2,4 ve 1,9 seviye — merdiven kendiliğinden eşit dağılmış.

Galaksi fit'i 1400×900'de −50,04, 2560×1440'ta −49,36. Yani **bölge adları ilk
kareden itibaren okunuyor**; diğer ikisi zoom'la geliyor.

**60 px bir yargıdır, ölçüm değil.** Ölçülen şey mesafeler. Okunabilirlik eşiği
bizim seçimimiz ve tek satırlık bir sabit; bakınca değiştirilir.

## Kademeli çekim

**Kural: bir veri kümesi ancak belirli bir zoom'un üstünde gösteriliyorsa, o
eşiğin altında çekilmemeli de.**

Bu desen bu depoda yeni değil — faz 2'nin `mapCelestials`'ı tam olarak böyle
çalışıyor: `streamsInteriors(bucket)` doğru olana kadar sorgu atılmıyor. Bu
belge onu bir kural olarak adlandırıyor, çünkü faz 4'ün aktivite ve sovereignty
verisi statik değil ve çok daha büyük olacak.

Burada uygulanışı:

| Kademe      | Ne zaman çekilir                            |
| ----------- | ------------------------------------------- |
| Bölge       | Mount'ta, `mapGeometry` ile birlikte — 3 KB |
| Takımyıldız | **−47,64 eşiğinde** — 31 KB                 |
| Sistem      | Hiç. `mapGeometry` zaten taşıyor.           |

İlk boyamanın maliyeti 175 + 3 = **178 KB**, `mapGeometry`'nin 200 KB bütçesinin
içinde. Hepsini önden çekmek 209 KB ederdi ve bütçeyi aşardı.

Haritayı açıp sadece bakan biri 31 KB'ı hiç indirmiyor: takımyıldız eşiği
fit'ten 2,4 seviye uzakta.

**Bedeli, eşiği geçerken kısa bir gecikme** — etiketler ~100 ms sonra biniyor.
`mapCelestials` bunu komşuları önceden çekerek yumuşatıyor; burada komşu kavramı
yok, ama sorgu eşikten biraz önce tetiklenerek aynı şey yapılabilir. Uygulamada
ölçülecek; gerekmezse eklenmez.

## Backend: `mapLabels(scope, kind)`

Etiketler `mapGeometry`'ye eklenmiyor. O sorgu gönderildi, önbelleklendi ve
bütçesi ölçüldü; kademeli çekim de zaten kademe başına ayrı bir istek gerektiriyor.

```graphql
"Bir etiketin kademesi. Sistem adları mapGeometry'den geldiği için burada yok."
enum MapLabelKind {
  REGION
  CONSTELLATION
}

"""
Haritada bir isim. Koordinat **galaktik metre**, düğümlerle aynı uzayda ve aynı
1e9 m ızgarasına yuvarlanmış — etiket bir noktanın yanında duruyor, ondan daha
hassas olmasının anlamı yok.
"""
type MapLabel {
  "Bölgede `region_id`, takımyıldızda `constellation_id`. İki uzay çakışmıyor (bölgeler 10000001+, takımyıldızlar 20000001+) ama tek anahtar isteyen bir tüketici yine de `kind` ile birlikte anahtarlamalı."
  id: Int!
  name: String!
  kind: MapLabelKind!
  x: Float!
  z: Float!
}

extend type Query {
  """
  Verilen sahnenin bir kademesinin adları. Statik evren verisi; servis Redis'te
  86400 s tutuyor, response cache'te STATIC_GAME_DATA.
  """
  mapLabels(scope: MapScope! = NEW_EDEN, kind: MapLabelKind!): [MapLabel!]!
}
```

**Kademe başına tek `kind`**, liste değil. Liste esnek görünür ama kısmi örtüşen
istekler önbellek anahtarını bölerdi — `mapCelestials`'ın sistem başına
anahtarlamayı seçmesinin sebebiyle aynı sorun. Tek `kind` tam isabet ediyor.

**Takımyıldız konumu** `constellations.position_x/z`'den doğrudan geliyor.

**Bölge konumu yok ve hesaplanıyor: üye sistemlerinin ortalaması.** Alternatifler
takımyıldızların ortalaması ve sınırlayıcı kutunun merkeziydi. Sistemlerin
ortalaması seçildi çünkü etiketin oturması gereken yer bölgenin _görsel_ ağırlık
merkezi. Takımyıldız ortalaması her takımyıldıza eşit ağırlık verir ve
seyrek/yoğun karışık bölgelerde etiketi sistemlerin göründüğü yerden kaydırır;
kutu merkezi ise uç noktalardaki birkaç sistem yüzünden etiketi boş uzaya çeker.

**Sahne filtresi `mapGeometry` ile aynı yüklemi kullanır.** Bir bölge ya da
takımyıldız, o sahnede sistemi varsa listeye girer. İki sorgunun sahne tanımı
ayrışırsa harita, üzerinde hiç nokta olmayan bir isim çizer.

## Frontend: etiketler ekran uzayında

**Etiketler `world`'ün içine girmiyor; `stage`'e doğrudan biniyor.**

Pixi geçişinden devreden bir not vardı: dünya konteynerinin y ölçeği negatif
(Pixi'nin ekran y'si aşağı akıyor, haritanın +z'si yukarı), sprite ölçekleri
pozitif. Oraya konan ilk `BitmapText` aynada çıkar. Ekran uzayı bunu yamamak
yerine üç problemi birden kapatıyor:

|                   | `world` içinde                 | `stage` üzerinde        |
| ----------------- | ------------------------------ | ----------------------- |
| Aynalanma         | Her etikette elle ters çevirme | **Doğmuyor**            |
| Piksel boyutu     | Her zoom'da counter-scale      | **Kendiliğinden sabit** |
| Çarpışma filtresi | Metreden piksele çevir         | **Zaten piksel**        |

Çarpışma filtresi ekran uzayında çalışmak zorunda — iki ismin çakışması piksel
sorusudur, metre sorusu değil.

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

### Kademeler birikiyor, silinmiyor

Bir kademe açılınca bir önceki **kapanmıyor**. −47,64'te takımyıldızlar gelir ve
bölgeler kalır; −45,73'te sistemler gelir ve ikisi de kalır.

İlk taslak sert devir teslim öngörüyordu, gerekçesi "114 + 1.184 isim gürültü
olur"du. Eksik muhakemeydi: **viewport kırpması işin çoğunu zaten yapıyor.**
−47,64'te ekran çok daha küçük bir alan kapsıyor, bölge merkezlerinin neredeyse
hepsi dışarıda kalıyor, ekranda bir-iki bölge adı kalıyor — ki o da tam olarak
işe yarayan şey. Haritalar da böyle davranır: şehre zoom yapınca ülke adı
kaybolmaz, geri plana çekilir.

**Ayrışma stille yapılıyor, görünürlükle değil.** Kademe başına bir stil:

| Kademe      | Rol       | Ayırt edici                                                      |
| ----------- | --------- | ---------------------------------------------------------------- |
| Bölge       | Geri plan | En büyük punto, en düşük opaklık, geniş harf aralığı, büyük harf |
| Takımyıldız | Orta      | Orta punto, orta opaklık                                         |
| Sistem      | Ön plan   | En küçük punto, tam opaklık                                      |

Somut değerler uygulamada belirlenip gözle ayarlanacak; tasarımın bağlayıcı
kıldığı şey **sıralama** — geri plandaki kademe daha sönük, daha büyük ve daha
seyrek okunur olmalı.

**Bilinen kusur, kabul ediliyor:** bölge etiketi merkezde durduğu için bir
bölgenin kenarına zoom yapıldığında merkez ekran dışında kalabilir ve o bölgenin
adı görünmez. Yani "bazen var bazen yok". Bunu çözmenin yolu bölge adını haritaya
değil sabit bir köşe göstergesine koymaktır; o da faz 3'ün popup'ına daha yakın
bir iş ve bu dilimde yapılmıyor.

### Çarpışma filtresi

Açgözlü, tek geçiş, ekran uzayında:

1. Viewport dışındaki adaylar düşer.
2. Kalanlar önceliğe göre sıralanır: **bölge > takımyıldız > sistem.** Geri
   plandaki kademe önce yerleşir; kalabalıkta feda edilen ince kademedir.
3. Her aday için ekran kutusu hesaplanır; kabul edilmişlerden biriyle kesişiyorsa
   düşer.
4. Tavan: **300 görünür etiket**, kademeler toplamı.

O(n·k), n aday ve k kabul edilen. k ≤ 300 olduğu için en kötü hâl bir karede
önemsiz, ve viewport kırpması n'i çok önce düşürüyor.

## Metin

`BitmapText`. `Text` her benzersiz dizgi için bir texture rasterize eder; 1.184
takımyıldız artı 5.241 sistem adı, binlerce texture demek. `BitmapText` tek bir
font atlasından quad çizer.

Kademeler farklı puntoda olduğu için atlas ya kademe başına bir boyutta üretilir
ya da tek boyutta üretilip ölçeklenir. İkincisi daha az bellek, birincisi daha
keskin; uygulamada ölçülecek.

Font projenin tipografisinden geliyor — Shentox kalıyor, bu dilim onu
değiştirmiyor.

## Test ve doğrulama

**Testli:** `mapLabels` servisi (önbellek isabeti/ıskası, `kind` başına anahtar,
sahne filtresi, bölge merkezi hesabı), çarpışma filtresi (viewport kırpması,
öncelik sırası, kesişme reddi, 300 tavanı), eşik fonksiyonları, ve **kademeli
çekimin tetiklenmesi** — eşiğin altında sorgu atılmadığı.

**Testsiz, gözle:** `scene/labels.ts`'in `BitmapText` yazması.

**Ajan doğrulaması:** birim testleri, `typecheck`, `lint` (`main`'in sayısına
karşı sıfır fark), `build:check`, `prettier`, ve `mapLabels`'a canlı sorgu —
NEW_EDEN'de `REGION` 114, `CONSTELLATION` 1.184 satır, hepsinin adı dolu.

**Kullanıcı doğrulaması:**

- `/map` açıldığında bölge adları okunuyor mu
- Zoom'la takımyıldızlar, sonra sistemler biniyor mu — ve **öncekiler kalıyor mu**
- Kademeler stille ayrışıyor mu: bölge geri planda mı duruyor
- İsimler üst üste biniyor mu
- Devreden tuzağın kontrolü: **yazılar düz mü, ayna görüntüsü değil mi**
- Takımyıldız eşiğini geçerken gecikme göze batıyor mu

## Riskler

**Font atlası bu depoda ilk kez üretiliyor.** Boyutu, karakter kümesi ve build'e
girişi uygulamada çözülecek. EVE bölge, takımyıldız ve sistem adları ASCII
dışına çıkmıyor gibi görünüyor ama bu doğrulanmalı — çıkıyorsa atlas büyür.

**Eşikteki gecikme ölçülmedi.** 31 KB'lık isteğin eşiği geçerken göze batıp
batmayacağı uygulamada görülecek; batıyorsa çözüm eşikten önce tetiklemek.
