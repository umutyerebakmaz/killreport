# Evren haritası — katman sistemi ve sovereignty katmanı

**Tarih:** 2026-09-20
**Durum:** tasarım, incelemeye hazır
**Yerine geçtiği işler:** #219 (faz 4 overlay'ler), #220 (faz 3 artıkları)

---

## 1. Neden

`/map` bugün geometri çiziyor: güvenlik durumuna göre renklenmiş sistem
noktaları, kapı çizgileri, adlar ve yakınlaşınca sistem içi. Üzerine hiçbir şey
boyanmıyor. Bu iş haritaya **bir katman sistemi** ekliyor ve o sistemin ilk
katmanı olarak **sovereignty**'yi çiziyor: harita "kim nereyi tutuyor" sorusunu
cevaplayacak.

#219 bu işi grid + marching squares ile hesaplanmış toprak poligonları olarak
tasarlamıştı. Bu tasarım poligon kullanmıyor. Sahiplik zaten sistem başına
biliniyor (`sovereignty_map_current`), işaretin kendisi sahibi anlatabilir, ve
noktaların arasını kapı çizgileri dolduruyor — poligon üretmeden alan okuması
çıkıyor. Böylece `d3-contour` bağımlılığı, sunucu tarafı contour servisi, 100 KB
poligon bütçesi ve #219'un çözülmemiş bıraktığı "galaksi zoom'unda tanınabilir
mi" spike'ı ortadan kalkıyor.

#220 ayrıca kapanıyor: üç maddesinden giriş noktaları 743b2aac ile zaten
yapılmış (issue'nun gerekçesi olan `grep "'/map"` backtick'li template
literal'leri ıskalamış), `LABEL_CHAR_WIDTH` kriteri e5ba371b'den sonra
geçersiz. Kalan iki madde — klavye erişimi ve gezegen etiketleri — bu işin
kapsamında değil, kendi issue'larında yaşamaya devam edecek (bkz. §9).

---

## 2. Ne çiziliyor

Sov katmanı açıkken:

| Zoom                     | Sistem işareti     | Kapı çizgisi  |
| ------------------------ | ------------------ | ------------- |
| −46,2'nin altında (uzak) | sahibin **rengi**  | sahibin rengi |
| −46,2 ve üstü (yakın)    | sahibin **logosu** | sahibin rengi |

Renk "bunlar aynı sahip" der; "hangi sahip" sorusunu logo cevaplar. Logolar
yalnızca sığdıkları zoom'da gelir, o yüzden hiçbir zaman üst üste binmezler.
Zoom out'ta işaret sessizce renge geri döner — iki ayrı çizim yolu değil, tek
eşik.

### 2.1 Eşik ölçüldü, seçilmedi

Harita `pixels = metres × 2^zoom` ile çalışır (`utils/map/camera.ts:83`).
Sahipli sistemlerin en yakın komşu mesafeleri 2026-09-19'da üretimde ölçüldü:

|                      | mesafe    | 16 px'in sığdığı zoom |
| -------------------- | --------- | --------------------- |
| p10 (en sıkışık %10) | 1,29e15 m | −46,2                 |
| medyan               | 3,47e15 m | −47,6                 |
| p90                  | 6,40e15 m | −48,5                 |

`SOV_LOGO_ZOOM = -46.2` — sahipli sistemlerin %90'ının komşusuyla arası 16 px'i
geçtiği zoom. Mevcut merdivende `CONSTELLATION_LABEL_ZOOM` (−47,64) ile
`SYSTEM_LABEL_ZOOM` (−45,73) arasına düşüyor: logolar takımyıldız adlarından
sonra, sistem adlarından hemen önce geliyor.

En sıkışık %10'da logolar birbirine değebilir. Etiketlerdeki çakışma filtresi
buraya taşınmıyor: logo, noktanın yerini alıyor, onun üstüne eklenmiyor — yani
iki logonun değmesi bugün iki noktanın değmesinden fazla bir şey bozmuyor.

### 2.2 Kapı çizgileri

**İki ucu da aynı sahibe ait olan kapı, o sahibin rengiyle çizilir. Diğer her
kapı bugünkü nötr griyle kalır.**

Bunun sebebi sadelik değil: farklı sahiplere ait iki sistem arasındaki kapı bir
**sınırdır**, ve gri kalması iki toprağı birbirinden görsel olarak ayırır. İki
ucu farklı renge boyamak sınırı bulanıklaştırırdı. Sahipli–sahipsiz kapılar da
aynı sebeple gri.

Bu, en baştaki "alan olarak okunsun" isteğini poligon üretmeden karşılıyor:
bitişik holdingler renkli bir ağ olarak okunuyor, aralarındaki sınırlar gri
dikiş olarak duruyor.

> **İncelemede karara bağlandı (2026-09-20):** değerlendirilen alternatif, her
> kapıyı ortadan ikiye bölüp her yarıyı kendi ucunun rengine boyamaktı.
> Reddedildi — sahipliği daha eksiksiz gösteriyor ama sınırı kaybediyor ve
> segment sayısını ikiye katlıyor. Sınır kapıları gri kalıyor, §5.2'deki kural
> yukarıda yazıldığı gibi.

### 2.3 Sahipsiz sistemler

Sov katmanında sahipsiz sistemler (8.490'ın 3.107'si) bugünkü güvenlik rengini
**almaz**; nötr bir griyle çizilir. Güvenlik rengi başka bir katmanın anlatımı;
aynı anda iki büyüklük anlatılırsa ikisi de okunmaz olur.

"Nötr" iki ayrı değer, çünkü iki ayrı işaret: sahipsiz sistem noktası
`sovColors.ts` içinde tanımlanan `SOV_UNOWNED_TINT`, sahipsiz ve sınır kapıları
ise bugünkü `GATE_TINT` / `GATE_ALPHA` (`utils/map/colors.ts:42`). Kapı için
yeni bir değer uydurulmuyor: sov katmanında gri kalan kapı, security katmanında
göründüğü gibi görünmeli.

---

## 3. Katman sistemi (frontend)

Karar, node ile katmanın verisinden bir **saf fonksiyon**; Pixi nesnesine
atamak ayrı ve test edilmeyen iş. Bu, faz 2 ve 3'ten devralınan kural ve burada
da geçerli.

`frontend/src/utils/map/layers.ts`:

```ts
export interface MapLayerData {
  sovereignty: SovIndex | null;
}

export interface MapColorLayer {
  id: 'security' | 'sovereignty';
  label: string;
  /** Sistemin işaret rengi. */
  tint: (node: MapNode, data: MapLayerData) => number;
  /** Kapı çizgisinin rengi; null → nötr gri. */
  edgeTint: (edge: MapEdge, data: MapLayerData) => number | null;
  /** Bu zoom'da nokta yerine logo çizilsin mi. */
  usesLogos: (zoom: number) => boolean;
  legend: LegendSpec;
}

export const MAP_LAYERS: Record<MapColorLayer['id'], MapColorLayer>;
```

`security` katmanı bugünkü davranışı olduğu gibi kaydeder: `securityTint`,
nötr kapı rengi, logo yok. Yani mevcut harita, katman sisteminin birinci
vatandaşı oluyor — sov katmanı kenara iliştirilmiş bir özel durum değil.

Katman değiştirmek **geometriyi yeniden çekmez**. `buildSystems` sprite'ları
bir kez kurar; katman değişince yalnızca `sprite.tint` (ve gerekirse
`sprite.texture`) yazılır ve kapı mesh'i yeniden çizilir. `mapGeometry` sorgusu
tekrar çalışmaz.

### 3.1 Renk sözlüğü

`frontend/src/utils/map/sovColors.ts` — `ownerId → hex` sözlüğü, 101 giriş.
Değerler kullanıcı tarafından, haritanın kendi zeminine (`#030712`) karşı
seçildi; 26'sı elle (22 faction ve dört alliance), 75'i sözlükteki diğer
renklerden OKLab'de olabildiğince uzak düşecek şekilde üretildi.

Sözlükte olmayan bir sahip — yeni sov alan bir alliance — **nötr** çizilir ve
kimliğini logosu taşır. Yani özellik sözlük eksikken de doğru çalışır; bir renk
eklemek tek satırlık bir düzenlemedir.

**Kabul edilen kısıt:** 101 renk birbirinden tam ayrışmaz. Harita zemininde
görünür kalan aralıkta ulaşılabilen en iyi ayrışma OKLab'de ΔE 0,073. Rengin
işi tekil kimlik vermek değil, kümeyi göstermek; tekil kimlik −46,2'de logoyla
geliyor. Bu bir eksiklik değil, katmanın okuma sözleşmesi.

### 3.2 Logo atlası

Atlasta **80 kare** var: kendi logosu olan 79 sahip, artı logosu olmayan
herkesin paylaştığı tek bir varsayılan kare (aşağıda). Hepsi tek bir
`1024 × 1024` canvas'a `10 × 10` ızgarada çizilip tek bir doku olarak
yüklenir; her sahip o dokunun bir `Texture` frame'ine bakar — 22 sahip aynı
frame'e. Tek base texture, tek draw call — `buildSystems`'in "hepsi tek
dokuyu paylaşıyor, Pixi topluca batch'liyor" özelliği korunur.

Her frame aynı boyutta olduğu için `spriteScale` tek bir
`LOGO_TEXTURE_RADIUS` sabitiyle çalışır; `DOT_TEXTURE_RADIUS` için yazılmış
ölçekleme kuralı değişmeden kalır.

Logo adresi sahibin türüne bağlı ve bu **ölçülmüş bir tuzak**:

| Sahip türü               | Adres                                       |
| ------------------------ | ------------------------------------------- |
| `ALLIANCE`               | `images.evetech.net/alliances/{id}/logo`    |
| `FACTION`, `CORPORATION` | `images.evetech.net/corporations/{id}/logo` |

`alliances/500003/logo` HTTP **200** döner — içinde 3.377 baytlık (64 px)
**varsayılan alliance amblemi** vardır: saydam zeminde ortada altın bir
yıldız, çevresinde yedi gümüş yıldız. Yani "logo yok" durumu HTTP durumunda
görünmez; 22 faction sahibi bu yoldan çekilirse haritada kendi amblemi yerine
o varsayılan yıldız çizilir. 2026-09-19'da 101 sahibin hepsi tarandı, doğru
yollarla 79'unun kendi logosu var.

**Logosu olmayan 22 alliance varsayılan alliance amblemiyle çizilir** — yani
`usesLogos` zoom'unda onlar da nokta değil logo olur. Görsel yirmi ikisinde de
bayt bayt aynı olduğundan (2026-09-20'de sov tutan 79 alliance'ın logosu tek
tek çekilip md5'leri karşılaştırıldı: 57 kendi logosu, 22 varsayılan) atlasta
22 kare değil **tek bir kare** tutar, yirmi ikisi de o frame'i gösterir ve
istemci görseli 22 kez değil bir kez indirir. Atlas bu yüzden 80 kareyle
`10 × 10` ızgarada kalıyor.

Amblem yirmi ikisinde de aynı olduğu için "hangi alliance" sorusunu onlarda
yine renk cevaplar: **bu 22 sprite logo modunda tint'ini korur**, §5.1'deki
"logo modunda tint beyaza alınır" kuralının tek istisnası olarak. Amblemin
pikselleri gümüş yıldızlarda zaten gri (R=G=B), yani çarpımsal tint sahibin
rengini olduğu gibi taşıyor; yalnızca ortadaki altın yıldız rengi ısıtıyor.
Şekil "bu alliance'ın logosu yok" der, renk hangisi olduğunu söyler — katmanın
"renk küme, logo kimlik" sözleşmesi bu 22'de renge dayanmaya devam eder, ve
sözlükte bir renklerinin olması bu yüzden diğerlerinden daha önemli.

Sahip → frame eşlemesi `frontend/src/utils/map/sovLogos.ts` içinde saf bir
fonksiyon; atlası çizmek ve dokuyu yüklemek ayrı ve test edilmeyen iş.

> **İncelemede karar verilecek:** alternatif, bu 22'yi de diğerleri gibi beyaz
> tint'le, amblemin kendi altın-gümüş renkleriyle çizmek. Amblemi olduğu gibi
> gösterir ama logo zoom'unda 22 sahip birbirinin tıpkısı olur; renk ancak
> zoom out edilince geri gelir.

---

## 4. Backend

Katman verisi, katman sistemi için tek yeni sorgu.

```graphql
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
}

type MapSovSystem {
  systemId: Int!
  ownerId: Int!
}

type MapSovereignty {
  scope: MapScope!
  owners: [MapSovOwner!]!
  systems: [MapSovSystem!]!
  updatedAt: String
}

extend type Query {
  mapSovereignty(scope: MapScope! = NEW_EDEN): MapSovereignty!
}
```

`systems`, sahiplik çiftlerinden ibaret — New Eden'da 5.383 satır, gzip
sonrası birkaç on KB. `owners` 101 satır ve logo yolunu kurmak için gereken her
şeyi taşıyor. Sahip adı `systems` içinde tekrarlanmıyor; iki liste
`ownerId` üzerinden birleşiyor.

**Migration yok.** `sovereignty_map_current` zaten `prisma/schema/` altında
(`sovereigntyMapCurrent.prisma`), sistem başına `alliance_id` /
`corporation_id` / `faction_id` tutuyor.

### 4.1 Servis

`backend/src/services/universe/map-sovereignty.service.ts` — `utils/`
komşularının ikinci biçiminde, düz `async function`, resolver Redis'i bilmez:

```ts
export const SOV_CACHE_TTL_SECONDS = 900;
export function sovCacheKey(scope: MapScope): string {
  return `map:sov:${scope}`;
}
```

`redis.get` → `$queryRaw` → `redis.setex`. Scope anahtarın içinde, CLAUDE.md'nin
"her filtre parametresi anahtarta" kuralı gereği.

900 s, CLAUDE.md'nin TTL tablosundaki bir satır değil ve bilerek değil: sov
haritası `worker-sovereignty-map.ts` tarafından tazeleniyor ve bir sistemin el
değiştirmesi gün ölçeğinde bir olay. Bir çeyrek saatlik bayatlık toprak için
sorun değil, ama "asla değişmez" de değil.

`COUNT(*)` `::BIGINT` olarak döner ve `JSON.stringify` BigInt'te patlar —
`Number()` ile çevrilmeden cache'e yazılmayacak.

### 4.2 Response cache

`mapSovereignty` `PUBLIC_CACHE_QUERIES`'e eklenirse TTL'i
`TTL_PER_SCHEMA_COORDINATE`'a da girmek **zorunda**; girmezse 120 s'lik
`DEFAULT_PUBLIC`'e ve token başına bir oturum anahtarına düşer. Bu tasarım onu
listeye eklemiyor: servisin kendi Redis anahtarı zaten işi görüyor ve iki
katmanlı cache'in ikinci katmanı burada yalnızca bayatlığı ikiye katlar.

---

## 5. Çizim

### 5.1 İşaretler

`scene/systems.ts` bugün `sprite.tint = securityTint(...)` yazıyor. Katman
sistemiyle bu `layer.tint(node, data)` olur ve iki yeni geçiş eklenir:

- `applyLayer(sprites, nodes, layer, data)` — bütün sprite'ların tint'ini
  yazar. Katman değişiminde bir kez çalışır.
- `applyLogos(sprites, nodes, atlas, on)` — `usesLogos` eşiği geçildiğinde
  dokuları logo frame'lerine, geçilmediğinde `scene.dot`'a çevirir; logo
  modunda `tint` beyaza alınır ki logonun kendi renkleri bozulmasın —
  varsayılan amblemi paylaşan 22 sahip hariç, onlarda tint sahibin rengi
  olarak kalır (§3.2).

Eşik geçişi kamera zoom'unda yalnızca bir kez tetiklenir — her wheel tick'inde
değil — yoksa 5.241 sprite'ın dokusu boşuna yazılır.

### 5.2 Kapılar

`drawEdges` bugün bütün mesh'i tek renkle iki geçişte çiziyor (düz ve kesikli).
Sov katmanında segmentler önce renge göre gruplanır ve her grup kendi
`stroke()` çağrısını alır. En kötü durumda 101 renk + nötr = 102 geçiş, grup
başına ortalama ~70 segment.

Bu **build-once** kalır: `pixelLine: true` sayesinde çizgi kalınlığı kamera
ölçeğinden bağımsız, yani mesh zoom'da yeniden çizilmiyor. Yeniden çizim
yalnızca katman değişiminde oluyor.

Gruplama saf fonksiyon — `utils/map/layers.ts` içinde, test edilir; `stroke()`
çağrıları `scene/edges.ts` içinde, edilmez.

### 5.3 Katman anahtarı ve lejant

Haritanın üstünde iki katmanı değiştiren bir anahtar ve sov katmanı açıkken
görünen bir lejant. Lejant sürekli bir gradyan değil: en çok sistem tutan
sahipler, renkleri ve sistem sayılarıyla; geri kalanı "diğer" altında
toplanır.

---

## 6. Veri çekme sözleşmesi

Faz 2 ve 3'ten devralınan kural burada da geçerli ve burada daha çok önemli:
**bir veri, çizilmediği zoom'da çekilmez de.** `mapSovereignty` yalnızca sov
katmanı seçildiğinde çekilir, harita açılışında değil. Logo atlası ise yalnızca
`SOV_LOGO_ZOOM` ilk kez geçildiğinde kurulur — uzaktan bakıp hiç
yakınlaşmayan biri 80 görseli indirmez.

---

## 7. Testler

Saf olan her şey test edilir, Pixi'ye atama edilmez.

| Dosya                                               | Ne doğrulanıyor                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `utils/map/layers.spec.ts`                          | `security` katmanı bugünkü `securityTint` çıktısını verir; `sovereignty` sahipli sistemde sözlük rengini, sözlükte olmayan sahipte ve sahipsiz sistemde nötr verir |
| `utils/map/layers.spec.ts`                          | kapı kuralı: iki ucu aynı sahipte olan kapı o rengi alır; farklı sahipli, sahipli–sahipsiz ve iki ucu da sahipsiz kapılar null döner                               |
| `utils/map/layers.spec.ts`                          | `usesLogos` eşiği −46,2'de açılır, altında kapalıdır                                                                                                               |
| `utils/map/sovColors.spec.ts`                       | sözlükteki her değer geçerli hex; sözlükte olmayan id `null` döner                                                                                                 |
| `utils/map/sovLogos.spec.ts`                        | kendi logosu olan sahip kendi frame'ini alır ve logo modunda beyaza boyanır; logosu olmayan sahip ortak varsayılan frame'i alır ve tint'i sözlük rengi kalır       |
| `services/universe/map-sovereignty.service.spec.ts` | cache anahtarı scope'u taşır; ikinci çağrı Redis'ten döner ve veritabanına gitmez; `systemCount` `Number`, `BigInt` değil                                          |

---

## 8. Doğrulama

```bash
yarn workspace backend codegen      # önce backend
yarn workspace frontend codegen
yarn test
yarn workspace backend build
yarn workspace frontend lint        # sayı main ile karşılaştırılır
yarn workspace frontend build:check
npx prettier --check <değişen dosyalar>
```

Sov verisi doğrudan bir GraphQL sorgusuyla doğrulanır. Haritanın kendisine
bakmak kullanıcının işi.

---

## 9. Kapsam dışı

Hiçbiri bu işin içinde değil, hepsi bilerek dışarıda:

- **Toprak poligonları.** Sahiplik sistem işareti ve kapı çizgisiyle anlatılıyor.
- **Activity katmanı** (1s / 6s / 24s / 7g kill yoğunluğu). Katman sistemi onu
  bir kayıt girdisi + bir sorgu olarak alacak biçimde tasarlandı; işin kendisi
  ayrı.
- **Taban katmanı olarak coğrafya** (takımyıldıza göre renk). Aynı şekilde bir
  kayıt girdisi.
- **Sahip sabitleme / karşılaştırma** (#219'daki "en çok 3 alliance").
- **Klavye erişimi ve gezegen etiketleri** — #220'nin gerçekten kalan iki
  maddesi. Bu iş haritanın çizim yoluna dokunuyor, onlar giriş ve etiket
  yoluna; birlikte gitmeleri için bir sebep yok.
- **`/sovereignty/map`'in kaldırılması.** ECharts scatter sayfası yerinde
  kalıyor; kaldırmak ayrı bir karar.

---

## 10. Riskler

**101 renk ayrışmıyor.** Kabul edilmiş kısıt, §3.1. Katmanın okuma sözleşmesi
buna göre yazıldı: renk küme, logo kimlik.

**Kullanıcının kendi iki seçimi çakışıyor.** Brave Collective `#7cd05d` ile The
Initiative. `#6cdf5d` OKLab'de 0,042 uzaklıkta ve ikisi de 100'den fazla sistem
tutuyor. Haritada yan yana düşerlerse ayırt edilmezler; logoları ayırır.
Değiştirmek renk sayfasından tek hamle.

**102 stroke geçişi.** Ölçülmedi. Build-once olduğu için kare hızını
etkilemiyor, ama katman değişiminde bir gecikme olarak görünebilir. Mevcut
mesh'in tek geçişte 14.400 segment çizdiği biliniyor; uygulama sırasında
ölçülecek ve 16 ms'i aşarsa renk grupları tek `Graphics` yerine kendi
`Graphics`'lerine bölünür.
