# `<img>` yerine `next/image`: `ui/EveImage` — tasarım

Tarih: 2026-09-17

## Amaç

`yarn lint` bugün **58 `@next/next/no-img-element`** uyarısı veriyor; toplam
201 sorunun (121 hata, 80 uyarı) dörtte biri tek bir kuraldan, uyarıların ise
yaklaşık dörtte üçü geliyor. Kuralın işaret ettiği şey
gerçek: uygulamadaki `<img>`lerin çoğu ölçüsüz, dolayısıyla her görsel
yüklendiğinde satırı kaydırıyor (CLS), ve hiçbiri lazy loading almıyor.

Bu iş uygulamadaki **59 `<img>`i 31 dosyada** `next/image`'a taşır. Taşıma
mekanik değil: görsellerin çoğu URL'ini elle kuruyor, beş yer aynı fallback
mantığını kopyalamış ve dört yer artık kullanılmayan bir URL şemasında kalmış.
Ortak bir bileşen bunların üçünü de tek yerde çözer.

## Bugünkü durum

59 `<img>`, üç aileye ayrılıyor:

| Aile                 | Adet | Dosya | Kaynak                                               |
| -------------------- | ---: | ----: | ---------------------------------------------------- |
| evetech uzak görseli |   50 |    27 | `images.evetech.net/...`                             |
| yerel asset          |    6 |     3 | `/icons/t*.svg`, `/icons/slot-*.png`, partner PNG'si |
| harita               |    3 |     3 | `/images/{regions,constellations,…}/{id}.svg`        |

Ayrıca 5 dosya **zaten** `next/image` kullanıyor (`Card/AllianceCard`,
`Card/CorporationCard`, `Card/CharacterCard`, `Sovereignty/SovereigntyLogo`,
`app/killmails/[id]/page.tsx`) ve `next.config.ts:11-22`'de bunlar için
`images.remotePatterns` tanımlı. Yani desen mevcut, eksik olan yaygınlığı.

Ölçümler:

- **URL kurma üç ayrı yerde.** 50 evetech görselinin çoğu şablon dizesini
  elinde kuruyor; `utils/itemImageUrl.ts` bunu item'lar için yapıyor;
  `TopTargetsCard.tsx:36-47` kendi `getImageUrl` switch'ini yazmış.
- **Beş yol şeması:** `/types/{id}/render`, `/types/{id}/icon`,
  `/characters/{id}/portrait`, `/corporations/{id}/logo`,
  `/alliances/{id}/logo`. Blueprint'ler için ayrıca `/bp` ve `/bpc`.
- **Dört çağrı yeri eski şemada:** `app/alliances/[id]/page.tsx:335`,
  `CharactersTable.tsx:43`, `AttackersCard.tsx:194`,
  `CorporationsTable.tsx:51` — `/Alliance/{id}_128.png` biçiminde, büyük
  harfli ve `_128.png` son ekli. Uygulama aynı logoyu iki farklı URL'den
  istiyor.
- **Fallback beş kopya:** `render` 404 verirse `icon`'a düşme mantığı
  `FitScreen.tsx:52`, `TopShipsCard.tsx:82`, `KillmailToast.tsx:62`,
  `KillmailRow.tsx:88`, `KillmailSummaryCard.tsx:219`'da birebir tekrarlıyor.
- **Ölçü ikili.** `?size=128` 26 kez çekiliyor ama ekranda `size-16` (64px)
  çiziliyor — zaten 2× retina çekimi, sadece yazılı değil. 59 `<img>`in
  yalnızca 3'ünde (üç harita) `width`/`height` var.
- **Görsel sunucusu yalnızca ikinin kuvvetlerini kabul ediyor.** 2026-09-17'de
  doğrulandı: `?size=` 32/64/128/256/512/1024 → 200, `?size=100` → **400**.
  Uygulamanın bugün istediği en büyük ölçü 512.

## Kararlar

1. **Optimizer kapalı — her görsel `unoptimized`.** evetech zaten istenen
   ölçüde servis ediyor; yeniden boyutlandıracak bir şey yok. Optimizer açıkken
   her istek droplet üzerinden geçer, her deploy'da cache soğuk başlar ve disk
   yer. `next/image`'ın buradaki asıl kazancı olan açık `width`/`height`
   (CLS yok) ve lazy loading, `unoptimized` ile de elde.

2. **Tek ortak bileşen: `components/ui/EveImage.tsx`.** Yerinde dönüşüm
   50 çağrı yerinde aynı kodu tekrarlardı; ince bir sarmalayıcı URL kurmayı ve
   fallback'i çağrı yerlerinde bırakırdı. Net bakiye çıkarma yönünde: 50 elle
   yazılmış URL, iki URL helper'ı ve beş fallback kopyası gider, bir bileşen
   ile bir saf util gelir.

3. **Tek `size` prop'u = çizim ölçüsü; çekim ölçüsü türetilir.** Retina kararı
   50 yerde değil tek yerde yaşar.

4. **URL kurma, bileşenden ayrı bir saf fonksiyonda.** `utils/` katmanı saf
   fonksiyon katmanı (CLAUDE.md, _Separation of concerns_); React olmadan test
   edilir.

## `utils/eveImageUrl.ts` — yeni

`utils/itemImageUrl.ts`'ten yalnızca `getItemImageUrl`'ü devralır —
`kind="type"` olarak — ve onunla birlikte **üretimde her blueprint'te çalışan
`console.log` debug bloğunu** (`itemImageUrl.ts:39-48`) siler.

`isBlueprint` ve `getItemName` yerinde kalır: ikisi de URL kurmuyor, bir item
tipi hakkında olgu söylüyor ve `FittingItem.tsx:34,89` ile
`KillmailSummaryCard.tsx:95` onları bu amaçla kullanıyor. `eveImageUrl`,
`/bp` ile `/bpc` arasında seçim yapmak için `isBlueprint`'i oradan çağırır.

Geriye kalan dosya artık hiçbir görsel URL'i kurmadığı için adı yanlış olur;
`utils/itemType.ts` olarak yeniden adlandırılır. Maliyeti iki import satırı ve
spec dosyasının adı.

```ts
export type EveImageKind =
  | 'ship' // /types/{id}/render, 404'te /icon'a düşer
  | 'type' // /types/{id}/icon — blueprint'te /bp veya /bpc
  | 'character' // /characters/{id}/portrait
  | 'corporation' // /corporations/{id}/logo
  | 'alliance'; // /alliances/{id}/logo
```

**Çekim ölçüsü kuralı:**

```ts
const fetchSize = (size: number) =>
  Math.min(512, Math.max(32, 2 ** Math.ceil(Math.log2(size * 2))));
```

2× retina, ikinin kuvvetine yuvarlanmış, sunucunun kabul ettiği aralığa
kısılmış. Üst sınır 1024 değil **512**, çünkü uygulamanın bugün istediği en
büyük ölçü o ve kural böylece mevcut her eşleşmeyi birebir üretiyor:

| Çizim ölçüsü             |     Türetilen | Bugün         |
| ------------------------ | ------------: | ------------- |
| `size-8` → 32px          |            64 | `?size=64` ✓  |
| `size-16` → 64px         |           128 | `?size=128` ✓ |
| 128px                    |           256 | `?size=256` ✓ |
| FitScreen gövdesi ~480px | 512 (kısıldı) | `?size=512` ✓ |

## `components/ui/EveImage.tsx` — yeni

`ui/SummaryRow`'un yanına; #224'te açılan `ui/` klasörünün ikinci sakini.

```tsx
type EveImageProps = {
  kind: EveImageKind;
  id: number;
  /** alt metni — varlığın adı. */
  name: string;
  className?: string;
  /** Yalnızca LCP görselinde. */
  priority?: boolean;
  /** Yalnızca kind="type": 2 ise BPC, değilse BPO. */
  singleton?: number;
} & ({ size: number; fill?: never } | { fill: true; size?: never });
```

`size` sabit kare kutu — 50 çağrı yerinin 49'u bu. `fill` tek istisna:
`FitScreen`'in gövde görseli `.hull` içinde `width: 80%; height: 80%` ile
duruyor (`globals.css`), yani kutusu piksel değil yüzde; `fill` bunun için var
ve çekim ölçüsünü 512'ye sabitler — bugün istediğinin aynısı.

Bileşen `unoptimized`, `width`/`height` (ya da `fill`), `alt={name}` ve
`loading="lazy"` (Next'in varsayılanı, `priority` verilmedikçe) yazar.

### Fallback

`kind="ship"` için: `/render` hata verirse `/icon`'a düşülür. `next/image`
`src`'yi kendi yönettiği için bugünkü `target.src` ataması geçersiz —
bileşen içinde `useState` ile tutulur, ve orası tek yer olur.

Fallback'i tetikleyen bir tip bulamadım: 587, 35832, 670 ve 2488 için hem
`render` hem `icon` 200 dönüyor. Yine de davranış aynen taşınıyor; kaldırmak
ayrı bir karar ve bu işin parçası değil.

### Eski URL şeması

Dört çağrı yeri `/Alliance/{id}_128.png` biçimini bırakır, modern şemaya
geçer. Bu bir yan etki değil, bileşenin zorunlu sonucu: `EveImage` tek bir
şema biliyor.

## Diğer iki aile

**Haritalar** (`RegionMap`, `ConstellationMap`, `SolarSystemMap`) `EveImage`'a
girmez — kaynakları yerel SVG, URL helper'ları ve spec'leri zaten var, ve
`width`/`height`'i zaten taşıyorlar. Düz `<img>` → `<Image unoptimized>`
takası.

**Yerel asset'ler** de öyle: `ShipTierBadge`'in dört SVG'si,
`FitScreen/Slot`'un `slot-*.png`'si ve Footer'ın partner PNG'si.

`ShipTierBadge`'de bir ayrıntı var: ölçü `className` ile geliyor (`size-4`,
`size-5`, `size-10`, varsayılan `size-6`). `next/image`'a sabit bir
`width`/`height` verilir ve `className` üstüne yazar — dört ikon da kare
olduğu için Next'in "biri değişti diğeri değişmedi" uyarısı çıkmaz. Bileşenin
API'si değişmez. Dördü de aynı şeyi döndürdüğü için gövdesi bir eşlemeye
inebilir; aynı dosyada, isteğe bağlı bir çıkarma.

## Bilinçli sapmalar

- **`images.remotePatterns` silinir** (`next.config.ts:11-22`). Yalnızca
  optimizer okur; her görsel `unoptimized` olunca ölü yapılandırma kalır.
  İleride optimizasyon istenirse tek blok geri gelir, ve eksikken Next
  optimize edilmiş bir uzak görselde ne yapılacağını söyleyen açık bir hata
  veriyor — sessiz bir bozulma yok.
- **`priority` yalnızca killmail detay sayfasındaki kurban gövdesinde.**
  Diğer her görsel lazy. Listelerde `priority` vermek tarayıcının önceliklendirme
  sırasını bozar.

## Doğrulama

Yeni testler:

- `utils/eveImageUrl.spec.ts` — beş aile, çekim ölçüsü türetme (tablo satırı
  başına bir vaka + 32 altı ve 512 üstü sınırlar), blueprint BPO/BPC ayrımı.
- `components/ui/EveImage.spec.tsx` — `size`'dan `width`/`height` yazması,
  `fill` dalı, `unoptimized` olması, ve `kind="ship"` için `onError` sonrası
  `src`'nin `/icon`'a dönmesi.

Komutlar (CLAUDE.md, _Verifying work_ tablosuna göre — `.graphql` değişmiyor,
`codegen` gerekmiyor):

```bash
yarn test
yarn workspace frontend build
yarn workspace frontend lint      # no-img-element: 58 → 0
npx prettier --check .
```

Kabul ölçütü sayı: `no-img-element` **0**, toplam lint sorunu **201 → 143**
(121 hata, 22 uyarı), ve `main`'e göre yeni bir uyarı türü eklenmemiş olması.

CLAUDE.md'nin _Verifying work_ bölümü bu sayıyı 2026-09-10 itibarıyla 237
veriyor; bugün 201. Bu iş birleşince o satır da güncellenir.

## Kapsam dışı

- Optimizer'ı açmak. Kararı 1 kapatıyor; açmak ayrı bir iş.
- `render`/`icon` fallback'ini kaldırmak.
- `FittingItem`, `FittingSection` ve `FitScreen`'in slot bileşenlerindeki
  `itemType: any` tiplemeleri. Aynı dosyalara dokunuluyor ama başka bir iş;
  #225'in devamı olarak ayrı gider.
- Görsellerin görünümünde herhangi bir değişiklik. Bu iş bittiğinde sayfalar
  bugünküyle piksel piksel aynı görünmeli.

## PR şekli

Tek dal, tek PR, üç sıralı commit:

1. `utils/eveImageUrl.ts` + `components/ui/EveImage.tsx` + testleri.
   `getItemImageUrl` buraya taşınır, `itemImageUrl.ts` → `itemType.ts` olur.
2. 50 evetech çağrı yeri, 27 dosyada. Beş fallback kopyası ve dört eski URL
   burada gider; halihazırda `next/image` kullanan 5 dosya da `EveImage`'a
   geçer.
3. Haritalar, yerel asset'ler ve `next.config.ts`'ten `images.remotePatterns`.

Yarım göç uygulamada iki konvansiyon bırakır, o yüzden üçü tek PR'da.
Etiketler: `refactor`, `frontend`.
