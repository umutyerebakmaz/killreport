# Evren haritası — sistem seçimi ve popup (faz 3a) — tasarım

> Faz 1-2 tasarımı: [`2026-09-12-universe-map-design.md`](./2026-09-12-universe-map-design.md).
> O belgenin _Picking_ ve _Popup_ paragrafları deck.gl şeklinde ve **mekanizma
> olarak geçersiz**; bu belge onların yerine geçiyor. Davranış tarifi — imlecin
> altındaki sistemi bilmek, hover'da tek satır, tıklamada popup, popup'ın tuvale
> değil üste konumlanan sıradan bir React bileşeni olması — aynen geçerli ve
> burada korunuyor.

## Amaç ve kapsam

Haritanın 5.241 noktası bugün adlarını söylüyor ([#206](https://github.com/umutyerebakmaz/killreport/pull/206)) ama hiçbirine dokunulamıyor. Bu dilim
üç şey getiriyor:

1. İmlecin altındaki sistemi bulmak.
2. Hover'da tek satır: ad ve güvenlik.
3. Tıklamada popup: sistemin son bir saatteki aktivitesi ve detay sayfasına
   çıkış.

**Kapsam dışı, bilerek.** `?focus=` ve mevcut sayfalardan "haritada göster"
girişleri faz 3b; klavyeyle gezinme faz 3c. İkisi de bu dilimin tanımladığı
"seçili sistem" kavramının üstüne kuruluyor, o yüzden sırası bu.

Celestial'lar (gezegen, ay, istasyon, gate) **tıklanabilir değil**. Faz 1-2
tasarımı onları da pickable sayıyordu; bir gezegenin popup'ında gösterilecek şey
adı ve türüdür, gidecek bir sayfası da yok. Karşılığı olmayan bir ekleme, ve 3a'yı
iki ayrı popup tasarımına bölerdi.

## Hit test: ekran uzayında saf fonksiyon

`frontend/src/utils/map/pick.ts`:

```ts
pickSystem({ nodes, transform, width, height, pointerX, pointerY, cameraScale })
  → MapNode | null;
```

Pixi'de GPU picking bedava gelmiyor. Üç yol tartışıldı ve seçilen bu:

| Yol                       | Neden değil                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixi'nin event sistemi    | 5.241 sprite'a `eventMode: 'static'`; sprite'lar karşı-ölçekli olduğu için "en az 6 px tıklanabilir alan" her zoom değişiminde 5.241 `hitArea` yazmak demek. Karar test edilemeyen katmana taşınır. |
| Quadtree / ızgara indeksi | 5.241 düğüm küçük. Faz 1-2 belgesi de "quadtree gerekmeyebilir, önce ölçülmeli" diyor. Ölçmeden indeks yazmak erken.                                                                                |
| **Doğrusal tarama**       | **Seçilen.** Etiket dilimindeki izdüşümün aynısı, Pixi'ye hiç dokunmuyor, testli.                                                                                                                   |

İzdüşüm `cameraTransform`'un zaten tarif ettiği çarp-topla: `screenX = x *
scaleX + tx`, `screenY = z * scaleY + ty`. **`scaleY` negatiftir** ve bu
haritanın +z-yukarı sözleşmesidir; yanlış kopyalanırsa sessizce ters döner. Aynı
uyarı `utils/map/labels.ts`'te de yazılı.

Sıra, `labelCandidates`'ın sırası: **önce viewport kırpması, sonra en yakını.**
Kırpma O(n) ve ucuz; en yakını arama yalnız ekranda kalan düğümler üzerinde
koşuyor. Beraberlik olamaz çünkü en küçük kare mesafe kazanıyor.

### Tıklanabilir yarıçap

```ts
pickRadiusPx = Math.max(
  systemRadiusPx(node.radius, cameraScale),
  MIN_PICK_RADIUS_PX,
);
MIN_PICK_RADIUS_PX = 6;
```

`systemRadiusPx` (`utils/map/marks.ts`) noktanın gerçekte kaç piksel olduğunu
veriyor — galaksi zoom'unda 1,5 px tabanı, derinde gerçek yarıçap. 1,5 px'lik bir
hedef tıklanamaz, o yüzden bir taban gerekiyor.

**6 px bir yargı, ölçüm değil.** Faz 1-2 belgesi deck.gl'in `pickingRadius: 4`'ünü
yazıyordu; burada 6 seçildi çünkü o değer noktanın merkezinden itibaren ek bir
tampon değil, toplam yarıçaptır. Gözle ayarlanacak.

## Etkileşim kuralları

Beşi de `useMapPointer.ts`'e giriyor — pan ve zoom'un zaten oturduğu yer. O hook'un
kendi dosya başı yorumu neden dinleyicilerin tuval başına bir kez bağlandığını ve
en güncel kameranın neden ref'te tutulduğunu anlatıyor; hover ve tıklama aynı
düzeni devralıyor, yoksa ilk pikselden sonra donan drag hatası geri gelir.

- **Hover animation frame'e kısılır.** `pointermove` saniyede onlarca kez gelir;
  hit test ucuz olsa da React state'ini o hızda yazmak boşa render'dır.
- **Drag sırasında hover kapatılır.** Haritayı kaydırırken altından geçen
  sistemlerin adı sırayla yanıp sönmemeli.
- **Tıklama, 4 px'in altında hareketle kapanmış bir `pointerdown`/`pointerup`
  çiftidir.** Eşik olmadan her pan bir popup açar; tuval üstünde başlayan her
  sürükleme bir tıklama sayılırdı.
- **Boşluğa tıklamak popup'ı kapatır.** `pickSystem` `null` döndürürse seçim
  temizlenir.
- **`Escape` popup'ı kapatır ve odağı tuvale döndürür.**

Popup'ın kendi içindeki pointer event'leri `stopPropagation` yapıyor. Yoksa panel
üstünde başlayan bir sürükleme haritayı kaydırır — popup tuvalin kardeşi, çocuğu
değil, ama dinleyiciler tuvalde olduğu için olay yine de yukarı çıkar.

Aynı anda **tek popup**. Hover ipucu ile popup birlikte durabilir; ipucu imleci
takip ettiği için popup'ın altına girmez.

## Popup: düzen ve görsel dil

```text
┌─────────────────────────────────────────────┐
│ Jita                                    0.9 │  ad solda, güvenlik sağda
│ Kimotoro · The Forge                        │  takımyıldız · bölge
│                                             │
│ ┌─────────┬─────────┬─────────┬─────────┐   │
│ │SHIP KIL.│POD KILLS│NPC KILLS│  JUMPS  │   │
│ │    4    │    8    │   77    │  1.745  │   │
│ └─────────┴─────────┴─────────┴─────────┘   │
│ last 1 hour · ESI                           │  küçük, light
│                                             │
│ ┌─────────┐                                 │
│ │  GATES  │                                 │
│ │    6    │                                 │
│ └─────────┘                                 │
│                                             │
│ Open the system →                           │
└─────────────────────────────────────────────┘
```

Hiçbiri yeni bir üslup değil. Depoda karşılıkları var ve popup onları
kullanıyor:

| Parça       | Nereden                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yüzen panel | `.float` (`cards.css:87`) — `bg-surface/80 backdrop-blur-md border-white/10`. Drawer, FilterDialog ve Tooltip de onu kullanıyor                                         |
| Güvenlik    | `components/SecurityStatus` — renk ve etiket zaten orada                                                                                                                |
| Stat kutusu | `SolarSystemDetail/SystemStatsStrip.tsx`'in `Box`'ı: `border bg-white/5 border-white/10`, etiket `text-xs uppercase tracking-wide text-gray-400`, değer `font-semibold` |
| 4'lü grid   | Aynı dosya: `grid grid-cols-2 gap-4 lg:grid-cols-4`                                                                                                                     |
| Yükleniyor  | Aynı dosyanın `SkeletonBox`'ı, `animate-pulse`                                                                                                                          |

Popup sayfa şeridi değil yüzen bir panel olduğu için kutular küçültülüyor:
`p-4` yerine `p-2`, `text-2xl` yerine `text-base`. Zaman satırı 12 px civarı ve
light.

### Zaman satırı yerini kapsamından alıyor

`last 1 hour · ESI` **dört saatlik kutunun hemen altında**, Gates onun altında.
Metin kısa kalıyor ve ne kapsadığını konumu söylüyor: tarif ettiği grubun
dibinde duruyor, Gates görünür şekilde o grubun dışında.

Bu, iki kutu grubunun **tek bir `grid-cols-4` olmadığı** anlamına geliyor — aralarına
bir metin satırı giriyor. Saatlik dörtlü kendi grid'i, Gates kendi tek kutusu ve
dörtlünün ilk kolonuyla aynı genişlikte. Gates'e ayrı bir zaman satırı
yazılmıyor: kapı sayısı saatlik bir ölçüm değil, topolojidir ve bir tarih
taşımıyor.

### Sıfır ve boş durumlar

Bunu popup'ın uydurmasına gerek yok, `SystemStatsStrip` zaten karara bağlamış —
ve dün gece `system_activity`'ye koyduğumuz null ayrımına tam oturuyor:

- **Kills bildirilmemişse `0`.** O dosyanın kendi yorumu: _"a system with no
  killmails shows zeroes, not an empty state."_ `npc_kills`/`pod_kills`/`ship_kills`
  `NOT NULL DEFAULT 0` ve şemada zaten "bildirilmedi" demek sıfırdır.
- **`ship_jumps` null ise `—`.** Aynı dosya `busiestHourUtc` null olduğunda `'—'`
  yazıyor. Null "ESI o sistemi bildirmedi" demek; sıfır "hiç atlama olmadı" demek,
  ve ikisi farklı şeyler ([#208](https://github.com/umutyerebakmaz/killreport/pull/208)).
- **Sistemin hiç satırı yoksa** dört kutu `—` gösteriyor ve alt satır zamanı
  yazmıyor.

### Konum: sisteme çapalı

Popup seçili noktanın yanında duruyor ve pan/zoom sırasında noktayı takip ediyor.
Ait olduğu sistem hiç belirsiz kalmıyor.

Maliyeti her kamera değişiminde **bir** izdüşüm hesabı — etiketler aynı şeyi
zaten 5.241 nokta için yapıyor. Konum viewport'a kırpılıyor: ekranın sağ kenarına
yakın bir sistem popup'ı sola açıyor, alt kenara yakın olan yukarı.

## Veri: `mapSystemDetails(systemId)`

Popup'ın gösterdiği her şey **tek sorgudan** geliyor. Yeni bir okuma yolu, yani
CLAUDE.md'nin şart koştuğu biçimde: `redis.get` → `$queryRaw` → `redis.setex`,
her parametre anahtarda.

```graphql
type MapSystemDetails {
  systemId: Int!
  name: String!
  securityStatus: Float
  constellationName: String!
  regionName: String!
  gateCount: Int!
  shipKills: Int
  podKills: Int
  npcKills: Int
  shipJumps: Int
  snapshotAt: String
}

extend type Query {
  mapSystemDetails(systemId: Int!): MapSystemDetails
}
```

Servis `backend/src/services/universe/map-system.service.ts`, **düz `async
function`** — yanındaki `universe-map.service.ts` de öyle (`getMapGeometry`,
`scopePredicate`, `computeBounds` hepsi düz fonksiyon), ve CLAUDE.md düz
fonksiyon biçimini tercih ediyor; `solar-system-stats.service.ts`'in `static`
metotlu sınıfı depoda istisnadır. Redis anahtarı `map:system:{systemId}`, TTL
**300 s** — içinde saat başı değişen veri var, en kısa ömürlü parça TTL'i belirler.

### Neden mevcut sorgular yetmiyor

Bu dilim ilk bakışta backend'siz görünüyordu; iki şey onu değiştirdi:

- **Takımyıldız adı istemcide yok.** `mapGeometry`'nin düğümleri `constellationId`
  taşıyor, adı değil. Adlar `mapLabels(CONSTELLATION)`'da ve o veri kümesi
  **bilerek** `-47.64` zoom'unun altında hiç çekilmiyor (31 KB). Galaksi
  zoom'unda popup açıldığında ad elde yok. Popup için 763 takımyıldızın adını
  indirmek, etiket diliminin adını koyduğu kuralı — _bir veri kümesi ancak
  belirli bir zoom'un üstünde gösteriliyorsa, o eşiğin altında çekilmemeli de_ —
  ters yönden ihlal ederdi.
- **Gates'i `mapGeometry.edges`'ten saymak eksik sayıyor.**
  `universe-map.service.ts:213` bir kenarın **iki** ucunun da scope içinde
  olmasını şart koşuyor, yani scope dışına çıkan bir kapı kenar listesinde hiç
  yok. Gerçek sayı `stargates` tablosunda.

Üçüncü bir yol daha vardı ve seçilmedi: `solarSystem(id)` bu alanların hepsini
zaten döndürüyor — ad, güvenlik, `constellation { name region { name } }` ve
`latestActivity`. Ama `Query.solarSystem` response cache'te **365 gün** TTL ile
duruyor (`config/cache.ts:122`, `STATIC_GAME_DATA`), ve o koordinattan okunan
saatlik veri bir yıl boyunca donar. Ayrı bir sorgu, o hatayı bu dilimin
kritik yoluna sokmamak demek.

> **Bu arada bulunan, bu dilime ait olmayan bir hata.** Sistem detay sayfasının
> "X ships, Y pods killed · 2 saat önce" satırı da o 365 günlük koordinattan
> geliyor ve killmail mutation'ı olmadığı için hiç invalidate edilmiyor — ilk
> istekten sonra donmuş bir saat gösteriyor. Kendi işi, kendi incelemesi.

`fetchPolicy` override edilmiyor. Deponun varsayılanı `cache-and-network`
(`apolloClient.ts:244`), yani popup ikinci açılışta ilk kareyi önbellekten anında
boyayıp arkada yeniliyor — saatlik veri için doğru davranış.

## Mimari sınır

Etiket diliminin kuralı aynen geçerli ve bu dilim onu devralıyor:

> **Karar `frontend/src/utils/map/`'te saf fonksiyondur ve testlidir; Pixi
> nesnesine atama `components/UniverseMap/scene/`'dedir ve testsizdir.**

Hit test bir karardır → `utils/map/pick.ts`, testli. Popup ve ipucu Pixi nesnesi
değil, sıradan React bileşenleri — tuvalin üstünde, `scene/`'e hiç dokunmuyorlar.
Bu dilim `scene/` altına **hiçbir dosya eklemiyor**.

Dosyalar:

| Dosya                                                          | Ne                                                |
| -------------------------------------------------------------- | ------------------------------------------------- |
| `utils/map/pick.ts` (+ spec)                                   | `pickSystem`, `pickRadiusPx`                      |
| `components/UniverseMap/useMapPointer.ts`                      | hover ve tıklama çıkışları, eşik, rAF kısıtlaması |
| `components/UniverseMap/SystemHoverTip.tsx`                    | tek satır, imleci takip eden overlay              |
| `components/UniverseMap/SystemPopup.tsx`                       | çapalı kart, sorguyu tıklamada açar               |
| `graphql/MapSystemDetails.graphql`                             | tek sorgu                                         |
| `backend/src/schemas/UniverseMap.graphql`                      | `MapSystemDetails` tipi ve sorgu                  |
| `backend/src/services/universe/map-system.service.ts` (+ spec) | Redis + `$queryRaw`                               |
| `backend/src/resolvers/universe-map/queries.ts`                | resolver, servise devrediyor                      |

## Test ve doğrulama

**Saf katman, Vitest:**

- `pick.ts`: viewport kırpması; yarıçap içinde ve dışında; en yakın kazanıyor;
  boş düğüm listesi; negatif `scaleY` ile z ekseninin doğru yönü; `cameraScale`
  büyüdükçe yarıçabın gerçek nokta yarıçapını takip etmesi.
- `map-system.service.ts`: önbellek isabet/ıska yolu, anahtar biçimi, `BIGINT`
  dönüşümü (`$queryRaw`'ın `::BIGINT` kolonları `BigInt` döndürüyor ve
  `JSON.stringify` onlarda patlıyor), satırı olmayan sistem.

**Bileşenler, React Testing Library** (`UniverseMap.spec.tsx` deponun bu
düzendeki örneği): popup içeriği, `—` ve `0` durumları, `Escape` ile kapanma,
`stopPropagation`.

**Testsiz kalan:** WebGL jsdom'da koşmuyor, ve **görsel doğrulama kullanıcıya
ait.** Hover'ın hissi, 6 px'lik yarıçabın yeterliliği ve popup'ın kırpma
davranışı ekrana bakılarak ayarlanacak — spec'le değil.

**Veri doğrulaması** doğrudan GraphQL sorgusuyla: Jita (30000142) için ad,
güvenlik, takımyıldız, bölge, kapı sayısı ve dört sayı.

## Riskler ve açık sorular

1. **6 px yeterli mi, ve fit zoom'unda fazla mı.** Sistemlerin medyan
   en-yakın-komşu mesafesi 3,4944e15 m (`lod.ts`). `SYSTEM_LABEL_ZOOM`'da
   (-45,73) bu **59,9 px**, yani 6 px'lik hedefler rahatça ayrık. Ama galaksi
   fitinde (-50,04) aynı mesafe **3,0 px**: komşu sistemlerin tıklama alanları
   örtüşüyor ve 6 px'lik bir yarıçap medyan komşusunun yarısını da içine alıyor.
   En yakın kazandığı için sonuç deterministik, ama kullanıcı ilk seferde
   istediğini vuramayabilir. Ölçülecek; çözüm gerekirse yarıçabı alt zoom'larda
   daraltmak — sabit 6 px değil, komşu mesafesinin bir oranıyla sınırlamak.
2. **Doğrusal taramanın maliyeti.** 5.241 düğüm × çarp-topla, rAF'a kısılmış.
   Etiket geçişi aynı düğümleri her kamera değişiminde zaten geziyor ve ölçülmüş
   maliyeti sorun değil. Yine de ölçülecek; ızgara indeksi gerekirse sonra gelir.
3. **Popup'ın mobil hâli.** Telefonda hover yok ve dokunma hem pan hem tıklama.
   4 px eşiği dokunma için muhtemelen düşük — parmak hareketi fareden daha
   gürültülü. Ayrı bir dokunma eşiği gerekebilir.
4. **`snapshotAt` hep bir saatin başı**, yani "last 1 hour" ifadesi 59 dakika
   eskiyebilir. Gösterilen zamanın yanına `formatTimeAgo` konacak — detay
   sayfasının zaten yaptığı gibi.
