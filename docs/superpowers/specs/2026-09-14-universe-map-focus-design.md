# Evren haritası — odak, derin bağlantılar ve sayfalardan girişler (faz 3b) — tasarım

> Faz 1-2 tasarımı: [`2026-09-12-universe-map-design.md`](./2026-09-12-universe-map-design.md).
> Faz 3a: [`2026-09-14-universe-map-picking-design.md`](./2026-09-14-universe-map-picking-design.md).
> Bu dilim 3a'nın tanımladığı "seçili sistem" kavramını URL'e taşıyor ve
> `useMapCamera`'nın URL gidiş-dönüşünü devralıyor — 3a'nın "3b bunu devralıyor"
> dediği şey tam olarak bu.

## Amaç ve kapsam

Faz 3a bir sisteme tıklanabilmesini getirdi ama seçim tuvalin içinde kaldı:
paylaşılamıyor, geri tuşundan sağ çıkmıyor, ve haritaya dışarıdan bir sisteme
bakarak girmenin yolu yok. Bu dilim iki şey getiriyor:

1. **Üç URL parametresi** — `?focus=`, `?region=`, `?constellation=`.
2. **Üç detay sayfasından giriş** — bölge, takımyıldız ve sistem sayfalarındaki
   mevcut yıldız haritası küçük resmi canlı haritaya bağlanıyor.

**Kapsam dışı, bilerek.** Klavyeyle gezinme faz 3c. Celestial'lar hâlâ
tıklanabilir değil. Liste kartlarındaki küçük resimler (11 çağrı yerinin
kalanı) linke dönüşmüyor — gerekçesi aşağıda, _Pochven_ bölümünde.

## Üç parametre, iki mekanizma

| Parametre                 | Ne yapıyor                                                     | Nasıl                                                 |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `?focus=30000142`         | Sistemi **seçiyor** (popup açılıyor) ve kamerayı **ortalıyor** | `SYSTEM_LABEL_ZOOM` = -45,73                          |
| `?region=10000002`        | Kamerayı bölgenin **sınırlarına çerçeveliyor**, seçim yok      | `regionId` eşleşen düğümlerin sınırları → `fitCamera` |
| `?constellation=20000020` | Aynısı takımyıldız için                                        | `constellationId` eşleşen düğümler                    |

Üçü de **istemcide** çözülüyor. `mapGeometry` her düğümün `systemId`,
`constellationId` ve `regionId`'sini taşıyor ve sahneyle birlikte zaten yüklü,
yani bu dilimin **backend'e hiç ihtiyacı yok**: yeni sorgu yok, yeni alan yok,
yeni önbellek anahtarı yok.

### Neden tek mekanizma değil

Üçünü de "şu düğüm kümesinin sınırlarına çerçevele" diye tek kurala indirmek
daha zarif görünüyordu ve yanlış olurdu. `focus` için küme {sistem} ∪ kapı
komşuları olurdu; tek kapısı çok uzağa giden bir sistemde çerçeve o kadar açılır
ki odaklanan sistem bir noktaya döner. Bağlantıyı göstermek istenen şey değil.

Bir **sistem** için ortalama öngörülebilir: her sistem aynı ölçekte
çerçevelenir, ve o ölçek ölçülmüş bir sabittir — `SYSTEM_LABEL_ZOOM`, sistem
adlarının açıldığı ve medyan komşunun **59,9 px** ötede durduğu zoom
(3,4944e15 m × 2^-45,73, `lod.ts`). "Bu sistem nerede" sorusunun cevabı
komşularıyla birlikte görünen bir sistemdir.

Bir **küme** için çerçeveleme doğru, çünkü orada istenen şey kümenin tamamını
görmek. `fitCamera` bunu zaten yapıyor ve `FIT_PADDING` 0,92 ile kenarda pay
bırakıyor.

### Dejenere durumlar

- **Tek düğümlü küme, ve bu varsayımsal değil.** NEW_EDEN sahnesinde tek
  sistemli **iki** takımyıldız var, ölçüldü: `20010000` Duzna Kah (yalnız
  Zarzakh, `30100000`) ve `20010001` Manifest District (yalnız Manifest,
  `30100032`). Böyle bir kümenin açıklığı sıfır ve `fitZoom` `FALLBACK_FIT_ZOOM`'a
  (-49,92) düşer ki o galaksi fitidir — çerçeveleme isteğini sessizce yok saymak
  olur. Sıfır açıklıkta `SYSTEM_LABEL_ZOOM` kullanılıyor, `focus` ile aynı
  sabit. İkisi test verisi olarak da kullanılacak.
- **Yüklü sahnede bulunmayan id**: parametre sessizce yok sayılıyor ve autofit
  uygulanıyor. Harita bir doğrulayıcı değil, ve 404 göstermek için sahnenin
  tamamını beklemek gerekirdi.

## URL'in tek yazarı olmak zorunda

`cameraQuery(scope, camera)` bugün sıfırdan bir `URLSearchParams` kuruyor ve
yalnız `scope/x/z/zoom` koyuyor. Bu hâliyle **bir kamera yazımı `focus`'u
silerdi** — ve kamera her pan'de yazılıyor, yani popup ilk sürüklemede URL'den
düşerdi.

O yüzden imza `cameraQuery(scope, camera, focus)` oluyor ve `focus` null ise
parametre hiç yazılmıyor. Bu, boşluğa tıklamanın onu URL'den silmesi demek de
oluyor — ayrı bir kod yoluna gerek kalmadan.

`useMapCamera`'nın kendi yazdığını başkasının yazdığından ayırması aynı
fonksiyonun çıktısını karşılaştırmaya dayanıyor (`cameraQuery(scope, fromUrl)
=== cameraQuery(scope, lastWritten.current)`), yani focus bedavaya kapsanıyor.
O karşılaştırmanın saf bir fonksiyon olması gerektiği hâlâ geçerli.

### `region` ve `constellation` yazılmıyor

Onlar **talimat**, durum değil: "haritayı şuraya kur". Kamera bir kez kurulup
ilk yazım gerçekleştikten sonra URL `?scope=&x=&z=&zoom=` hâline düşüyor, ve o
kare paylaşılabilir. Parametrenin kendisini URL'de tutmak, kullanıcı başka bir
yere pan yaptıktan sonra hâlâ "bu bölgeye bak" diyen bir URL bırakırdı.

`focus` farklı ve yazılıyor, çünkü o bir durum: popup açık **mı**.

## Öncelik

```text
URL'de açık kamera (x/z/zoom)  →  o kazanır
yoksa  focus  →  constellation  →  region
hiçbiri yoksa                  →  autofit (bugünkü davranış)
```

Açık kameranın kazanması geri-tuşu durumu için şart. Popup'tan "Open the
system"e gidip geri dönüldüğünde URL hem `focus` hem `x/z/zoom` taşıyor;
`focus`'un kamerayı yeniden ortalaması, kullanıcının ayrıldığı kareyi çalardı.
`focus` o durumda yalnızca **seçiyor**, kamerayı kurmuyor.

Kalan sıra en özgülden geneline. Üçü birlikte gelen bir URL elle yazılmış
demektir; bir kural gerekiyor ve en özgül olan en az şaşırtıcı.

### `useMapCamera` çağrısındaki tek satırlık yer

Bu öncelik sırası `useMapCamera`'nın içine yeni bir dal olarak girmiyor. O hook
zaten `camera ?? fit` döndürüyor, yani "URL'de kamera yoksa sana verdiğim şey".
Çerçeveleme de tam olarak o: URL'de kamera yokken kullanılacak kamera. Yani
çağrı yeri `useMapCamera(scope, framing ?? fit)` oluyor.

**Ama `fit` iki iş yapıyor ve ikisi ayrılmak zorunda.** `zoomLimits(fit.zoom)`
zoom tabanını `fit - 2` olarak veriyor; oraya çerçeveleme geçerse derin bir
çerçeveleme kullanıcının galaksiye geri zoom'lamasını **yasaklar**. Limitler
galaksi autofitinden, `useMapCamera`'nın yedeği ise `framing ?? autofit`'ten
gelecek.

## Scope, ve Pochven

Link doğru `scope`'u taşımak zorunda: `?focus=30000142` NEW_EDEN sahnesine
girerse ve sistem Pochven'deyse, id yüklü sahnede bulunmaz ve parametre sessizce
yok sayılır — hata vermeyen, yanlış davranan bir link.

`scope` **bölge id'sinden kesin çıkıyor** ve kural backend'de zaten yazılı
(`universe-map.service.ts`'in `scopePredicate`'i):

| Bölge id                              | Scope      |
| ------------------------------------- | ---------- |
| 10000001–10999999, **10000070 hariç** | `NEW_EDEN` |
| 10000070                              | `POCHVEN`  |
| 11000001–11999999                     | `WORMHOLE` |

Bu `scopeForRegionId(regionId)` olarak `utils/map/camera.ts`'e, `parseScope`'un
yanına giriyor — saf ve testli. Backend'in kuralını ayna tutuyor; iki yerde
durmasının sebebi birinin SQL predicate'i, diğerinin bir link kurucusu olması,
ve spec'in bu satırı ikisinin birbirine işaret etmesi için var.

**Takımyıldız ve sistem id'sinden `scope` çıkarılamıyor.** Pochven'in 27 sistemi
ve 3 takımyıldızı `30000021–30045329` aralığında, yani k-space id bandının tam
içinde — CCP onları mevcut sistemlerden dönüştürdü ve id'lerini korudular.
Ölçüldü, tahmin değil.

### Bu yüzden link sayfanın işi, bileşenin değil

`RegionMap`, `ConstellationMap` ve `SolarSystemMap` **11 yerde** kullanılıyor ve
çoğunda (`KillmailRow`, `TopSystemsCard`, `SolarSystemCard`…) bölge id'si
yok. Bileşenin kendisi linki kurarsa o çağrı yerleri scope'u id aralığından
tahmin etmek zorunda kalır ve Pochven sessizce yanlış çalışır.

O yüzden **link üç detay sayfasının işi**: sayfa mevcut küçük resmi bir `<Link>`
ile sarıyor, bileşenlerin hiçbirine dokunulmuyor. Üçünün üçü de gereken bölge
id'sine sahip — sistem sayfası `constellation { region { id } }`, takımyıldız
sayfası `region { id }`, bölge sayfası kendi route parametresi. Faz tablosunun
vaat ettiği de tam bu: "bölge/takımyıldız/sistem sayfalarından girişler".

Liste kartlarındaki küçük resimler değişmiyor. Bir gün linklenirlerse ihtiyaç
duyacakları şey bölge id'si, yeni bir mekanizma değil.

## Mimari sınır

3a'nın kuralı aynen devam ediyor ve bu dilim ona dokunmuyor:

> **Karar `frontend/src/utils/map/`'te saf fonksiyondur ve testlidir; Pixi
> nesnesine atama `components/UniverseMap/scene/`'dedir ve testsizdir.**

Bu dilim `scene/` altına **hiçbir dosya eklemiyor** ve hiçbirini değiştirmiyor.
URL çözümlemesi ve çerçeveleme aritmetiği karardır, dolayısıyla saf katmanda.

| Dosya                                    | Ne                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `utils/map/camera.ts`                    | `cameraQuery` üçüncü argüman alıyor; `parseFocus`, `parseFraming`, `scopeForRegionId` |
| `utils/map/framing.ts` (yeni)            | `nodeBounds(nodes)`, `framingFor(...)` → `MapCamera \| null`                          |
| `components/UniverseMap/useMapCamera.ts` | focus durumu ve serileştirme                                                          |
| `components/UniverseMap/UniverseMap.tsx` | `selected`'ı URL'den okuyup URL'e yazma; `framing ?? fit`                             |
| `app/regions/[id]/page.tsx`              | `RegionMap`'i `<Link>` ile sarma                                                      |
| `app/constellations/[id]/page.tsx`       | `ConstellationMap`'i sarma                                                            |
| `app/solar-systems/[id]/page.tsx`        | `SolarSystemMap`'i sarma                                                              |

## Test ve doğrulama

**Saf katman, Vitest:**

- `cameraQuery`: focus verildiğinde yazıyor, null iken parametreyi hiç
  yazmıyor, ve mevcut `scope/x/z/zoom` biçimini bozmuyor (mevcut spec'i
  koruyor).
- `parseFocus`/`parseFraming`: geçerli id, sayı olmayan değer, negatif,
  eksik parametre.
- `scopeForRegionId`: üç bandın sınırları, 10000070'in NEW_EDEN'den
  çıkarılması, banda düşmeyen bir id.
- `framing.ts`: bölge çerçevelemesi beklenen sınırları veriyor; takımyıldız
  aynısı; bulunmayan id null döndürüyor; tek düğümlü küme
  `SYSTEM_LABEL_ZOOM`'a düşüyor; `focus` sisteme ortalanıyor ve komşularının
  sınırlarına **çerçevelenmiyor**.

**Hook, Testing Library:** `useMapCamera` focus'u URL'e yazıyor; null focus onu
siliyor; dışarıdan gelen bir focus değişimi state'e geçiyor; kendi yazdığı
focus'u kendine geri okumuyor (mevcut `lastWritten` karşılaştırmasının focus'la
birlikte çalıştığı).

**Bileşen:** `UniverseMap.spec.tsx` genişliyor — `?focus=` ile mount edilen
harita popup'ı açıyor; `?region=` kamerayı o bölgenin sınırlarına kuruyor ve
popup açmıyor; açık kamera `focus` ile birlikte geldiğinde kamera korunuyor.

**Testsiz kalan:** üç sayfadaki `<Link>` sarması — `build` ve gözle. Ve **görsel
doğrulama kullanıcıya ait**: `SYSTEM_LABEL_ZOOM`'un "bu sistem nerede" için
doğru ölçek olup olmadığı ekrana bakılarak ayarlanacak.

## Riskler ve açık sorular

1. **`SYSTEM_LABEL_ZOOM` odak için doğru derinlik mi.** Ölçüm sağlam — medyan
   komşu 59,9 px — ama "bu sistem nerede" sorusunun cevabının kaç komşu
   göstermesi gerektiği bir yargı. Yoğun bir highsec kümesinde 59,9 px kalabalık,
   seyrek bir nullsec bölgesinde ıssız görünebilir. Tek sabit, gözle ayarlanacak.
2. **`focus` ile gelen bir sistem galaksi fitinde seçili kalıyor mu.** Popup
   sisteme çapalı ve kamera ona ortalandığı için ekranın ortasında açılıyor. Ama
   kullanıcı oradan uzağa pan yaparsa popup ekran dışına çıkıyor ve `focus` URL'de
   kalıyor. Kapatma yolu var (Escape, boşluğa tıklama) ama "seçili ama görünmez"
   bir durum mümkün. Ölçülecek; rahatsız ederse popup viewport'tan çıktığında
   seçim temizlenir.
3. **Üç parametrenin birlikte geldiği URL** elle yazılmış demektir ve öncelik
   sırası onu sessizce çözüyor. Alternatif reddetmek olurdu, ama bir harita
   bağlantısının hata mesajı göstermesi için sebep yok.
4. **`scopeForRegionId` backend'in kuralını ayna tutuyor.** CCP yeni bir bölge
   bandı açarsa iki yerin birlikte güncellenmesi gerekiyor. Tek gerçek çözüm
   scope'u sunucudan okumak olurdu, ki bu dilimin backend'siz olma özelliğini
   kaybettirir — bilerek seçilen takas, ve ikisinin birbirine işaret eden
   yorumları bu yüzden var.
