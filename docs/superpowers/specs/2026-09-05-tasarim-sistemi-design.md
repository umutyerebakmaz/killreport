# Tasarım Sistemi (Design)

**Tarih:** 2026-09-05
**Branch:** `feature/design-system`
**Durum:** Tasarım — kullanıcı incelemesi bekliyor
**Kaynak:** `todo.md` maddeleri 4-10

---

## 1. Kapsam

`todo.md`'nin ilk üç maddesi (Popover davranışı) PR #165 ile tamamlandı ve bu spec'in
dışında. Buradaki iş kalan yedi madde:

| Madde | Konu                                             |
| ----- | ------------------------------------------------ |
| 4     | Buton stilleri stil dosyasında isimlendirilsin   |
| 5     | Buton, input, option — hepsi ortak dili konuşsun |
| 6     | Tailwind Plus koyu palet; flat/rounded kararı    |
| 7     | Kartlar glassmorphism                            |
| 8     | Kart header'ı kartın zeminine dahil olsun        |
| 9     | Shentox → InterVariable                          |
| 10    | Görsel boyutları 16/32/64 skalasına otursun      |

Bunlar bağımsız işler değil, tek bir sistemin katmanları: token → sözlük → uygulama.
Bu yüzden tek spec, ama birden çok uygulama PR'ı (bkz. §9).

### Bugünün ölçümü

Sayılar `frontend/src` üzerinde ölçüldü, tahmin değil.

- **Dört gri ailesi karışık:** `gray` 681, `neutral` 142, `stone` 23, `slate` 3.
  Bunlar farklı tonlar — `gray` maviye, `stone` sıcağa çalar. Yan yana geldiklerinde
  yüzeyler tutmuyor. Maddede 5'te tarif edilen "uniform problemi"nin kaynağı bu.
- **Dört farklı kart zemini:** `bg-white/5` (65), `bg-neutral-900` (51),
  `bg-neutral-800` (50), `bg-stone-900` (23). Hangisinin ne anlama geldiği belli değil.
- **Kenarlıklar zaten tutarlı:** `border-white/10` 120 kullanım. Buna dokunulmayacak.
- **Radius dağınık:** 52 `rounded-full` (avatar, durum noktası — bunlar biçim değil şekil,
  kapsam dışı) artı beş ayrı boyuta yayılmış 31 gerçek köşe kararı.
- **Birincil rengin üç cebi var:** `cyan` 153 kullanımla fiilî birincil; ama filtre
  butonları `indigo`, `Checkbox` beş yerde `indigo-500`.
- **Butonlar:** 68 `<button>`, bunların yalnızca **5'i** `.button` sınıfını kullanıyor.
  30 `<input>`, 12 `<select>`.
- **Kartlar:** 16 adet `*Card` bileşeni, `ui/Card`'ı yalnızca **4'ü** kullanıyor —
  `Card/` klasöründeki dördü. Kalan 12'si kendi yüzeyini kendi yazıyor.
- **Satır içi yüzey zeminleri:** 249 kullanım, 73 dosya. Bunların ~40'ı aynı anda
  `border` de taşıyor, yani `.card`'a dönüşebilecek kart kökleri; kalan ~209'u iç
  kutular ve sayfa sarmalayıcıları.

---

## 2. Alınan kararlar

Bu beş karar tasarımın omurgası. Her biri kullanıcı tarafından onaylandı.

### 2.1 Cam bir katman sinyalidir, dekorasyon değil

Madde 6 "flat'a saygı göstereceğim" derken madde 7 "glassmorphism kartlar" istiyor.
Bu ikisi aynı yüzeyde birlikte olamaz: flat opak zemin ve keskin kenar demek,
glassmorphism yarı saydamlık, blur, yumuşak kenar demek.

**Karar:** ayrım katmana göre yapılır.

- **Sayfada duran her şey** — kartlar, tablolar, paneller — opak ve keskin kalır.
- **İçeriğin üstünde yüzen her şey** — popover panelleri, mobil çekmece, `FilterDialog`,
  `Tooltip` — cam olur: yarı saydam zemin, `backdrop-blur`, küçük radius.

Gerekçe: cam ancak arkasında bir şey varken anlamlıdır. Sayfa zemininin üstünde duran
opak bir kartı yarı saydam yapmak yalnızca metni okunaksızlaştırır. Yüzen katmanlarda
ise blur hem güzel hem işlevsel — "bu şey geçici, altındaki içerik hâlâ orada" der.

### 2.2 Radius de aynı sinyalin parçasıdır

Madde 6'da kararsız kalınan yer. §2.1'in doğal sonucu:

- **Sayfa yüzeyleri: radius yok.** Kart, tablo, panel, buton, input — hepsi keskin.
- **Yüzen yüzeyler: küçük radius** (`rounded-md`, 0.375rem).

Tek kural: _sayfada olan keskin, üstte yüzen yumuşak._ Alternatifi olan "etkileşimli
elemanlar yuvarlak" kuralı işe yaramaz, çünkü bir buton hem sayfada hem panelde geçer
ve kural her seferinde yeniden yorumlanır.

**Bu kural yüzen katmanın _kendisi_ için geçerlidir.** Panelin içindeki butonlar,
girdiler, satırlar keskin kalır. Yoksa "yüzen katmanın içindeyim, yumuşayayım mı"
sorusu her elemanda yeniden sorulur.

**Gerekçeli istisna:** mobil çekmece (`DialogPanel`) ekranın sağ kenarına yapışık ve tam
yükseklikte. Dört köşesini yuvarlamak, ekran kenarına değen iki köşede yanlış görünür.
Ona `rounded-l-md` verilir.

### 2.3 Dört token, gerisi düz Tailwind

Token'lar yalnızca **derinlik** ve **vurgu** için. Metin renkleri, çizgiler, köşeler ve
saydamlıklar düz Tailwind sınıflarıyla yazılır — `text-gray-400`, `border-white/10`,
`rounded-md`, `bg-gray-900/80`. Bunların hepsinde token yalnızca bir arama adımı
eklerdi: `border-white/10` okuyunca ne olduğu bilinir, `border-line` okuyunca bakmak
gerekir.

Token'ın gerekçesi "ileride palet değişebilir" değil — **bu paleti bakarak
ayarlayacağız.** Görsel doğrulama kullanıcıda; "kartlar biraz daha açık olsun" denecek.
Token varsa tek satır, yoksa 73 dosyalık tarama.

`@apply` bunun alternatifi değil, tamamlayıcısı. Bileşen sınıfına giren yüzeyleri
`@apply` merkeze alır (~40 kart kökü), satır içinde kalanları token toplar (~209).
İkisi farklı nüfusa çalışır ve birlikte kullanılır:

```css
.card {
  @apply bg-surface border border-white/10;
}
```

### 2.4 Semantik renkler kapsam dışı

Kırmızı, turuncu, yeşil, sarı ve mor kullanımlarının çoğu dekoratif değil, veriye bağlı:

- `utils/securityStatus.ts` — sec status merdiveni: `blue-400` (≥5) → `green-400` (≥0)
  → `yellow-400` (≥-2) → `orange-400` (≥-5) → `red-400`.
- `utils/security.ts` — uzay tipi: yeşil/sarı/kırmızı/mor, mor = wormhole.

**Bunlar zaten iki dosyada merkezî.** Token vermek kalabalık eder, hiçbir şey kazandırmaz.
Palet göçü bunlara dokunmaz.

### 2.5 Görünüm sınıfla değil, ARIA durumuyla

İki yerde uygulanır:

- `.active-filter-button` bugün `.button`'ı **beş `!important`** ile eziyor
  (`buttons.css`; taban kuralda üç, `:hover` kuralında iki). Yerine `ui/FilterBar.tsx:66`'ya `aria-pressed={hasBadge}` eklenir ve
  CSS `.button[aria-pressed='true']` ile boyar.
- `MostValuableCarousel.tsx:135`'te `aria-selected` **zaten var**. `.button-ghost[aria-selected='true']`
  yazınca oradaki koşullu className tamamen kalkar.

Kazanç: `!important` gider, ve görünüm ile ekran okuyucunun duyduğu şey birbirinden
ayrı düşemez hâle gelir.

---

## 3. Token seti

`frontend/src/app/globals.css` içindeki `@theme` bloğuna. Tailwind v4 bunlardan
`bg-*`, `text-*`, `border-*` yardımcılarını kendisi üretir.

```css
@theme {
  --color-ground: var(--color-gray-950); /* sayfa zemini */
  --color-surface: var(--color-gray-900); /* kart, tablo, panel */
  --color-surface-inset: var(--color-gray-800); /* kartın içindeki kutu */
  --color-accent: var(--color-cyan-600); /* birincil eylem dolgusu */
}
```

**Üç derinlik, fazlası yok.** Bugünkü dört zeminin hepsi bu üçüne oturur.

**`layout.tsx` bugün `bg-black` kullanıyor, `bg-ground` (gray-950) olacak.** Bu görünür
bir değişiklik ve gerekçesi flat tasarımın kendisi: gölge yokken bir yüzeyin "yukarıda"
olduğunu anlatan tek şey zeminden bir ton açık olmasıdır. Saf siyah zeminde `gray-900`
kart zar zor ayrışır. Kullanıcı siyahta ısrar ederse kartların `gray-800`'e çıkması
gerekir — o zaman `--color-surface` ve `--color-surface-inset` birer basamak kayar.

---

## 4. Buton sözlüğü

68 butonun tamamı sayıldı ve şu sözlüğe oturuyor. Değiştiriciler tek başına
kullanılmaz, bir görünümle birleşir: `.button .button-secondary .button-icon`.

### 4.1 Yapı

| Sınıf     | Tanım                                                                | Topladığı                                                                                                                                          |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.button` | Taban: yerleşim, geçiş, `focus-visible`, `disabled`. Her buton alır. | —                                                                                                                                                  |
| `.tab`    | Alt çizgili sekme (`border-b-2`)                                     | **6 detay sayfası** — regions, alliances, solar-systems, corporations, characters, constellations. Altısı da aynı sekme çubuğunu ayrı ayrı yazmış. |

### 4.2 Görünüm

| Sınıf               | Topladığı                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `.button-primary`   | `.apply-filter-button` (5), `AuthButton` cyan (1), başıboş bir `bg-blue-600` (1)                                               |
| `.button-secondary` | bugünkü `.button` (5), `p-1.5 border border-white/10` (6), `px-3 py-1 border` (2)                                              |
| `.button-ghost`     | carousel sekmeleri (2), `p-2 text-gray-400 hover:bg-gray-800/50` (4), `hover:bg-gray-700` (2), çıplak ikon/metin butonları (5) |
| `.button-danger`    | `.clear-filter-button` (1), `bg-red-600/80` (1)                                                                                |

### 4.3 Değiştirici

| Sınıf           | Ne                                          |
| --------------- | ------------------------------------------- |
| `.button-icon`  | Kare dolgu, ikon-only                       |
| `.button-sm`    | `px-3 py-1 text-xs` olanlar (3)             |
| `.button-block` | Tam genişlik alt eylem (`AttackersCard`, 2) |

### 4.4 Sözlüğe girmeyen ikisi

**Amber gradient CTA** — `app/auth/success/page.tsx`, 2 buton:
`bg-linear-to-r from-amber-500 to-amber-600` + `rounded-xl` + `shadow-lg` +
`hover:scale-105`. Gradient, radius, gölge ve ölçek: flat kararının dördünü birden
çiğniyor. **`.button-primary`'ye indirilir.** Tek bir sayfa uğruna sistemin dışında
ikinci bir dil taşımaya değmez.

**Menü satırları** — `relative flex items-center w-full p-3 group hover:bg-cyan-900/50`
(3 yer). `<button>` etiketi taşıyorlar ama görsel olarak buton değil, **liste satırı**.
Buton sözlüğüne sokmak yanlış olur; `.menu-row` diye ayrı bir ada gider.

---

## 5. Yüzey sözlüğü

### 5.1 Kart — `cards.css` (yeni dosya)

```css
.card        /* bg-surface + border border-white/10, radius yok, kendi dolgusu yok */
.card-header /* kartın İÇİNDE: px-4 py-3 border-b border-white/10 */
.card-body   /* p-4 */
```

`.card`'ın kendi dolgusu yoktur — bu `ui/Card.tsx`'te zaten alınmış bir karar
("every caller lays out its own insides") ve korunuyor.

**Madde 8'in cevabı burası.** Beş bileşende — `TopShipsCard`, `TopTargetsCard`,
`TopCharacterCard`, `TopCorporationCard`, `TopAllianceCard` — header
`<div className="py-4 border-b border-white/10">`, ama kök elemanın **arka planı yok**.
Header bu yüzden kartın dışında, sayfanın üstünde duran ayrı bir element gibi
görünüyor. `.card` köke zemin verince header içeri girer.

Yan bulgu: `TopShipsCard`'ın kökü `className="top-ships"` taşıyor ama **`.top-ships`
hiçbir CSS dosyasında tanımlı değil** — ölü sınıf. Göç sırasında silinir.

`WeeklyTopCharCard` ve `KillmailSummaryCard` kökünde zaten `bg-neutral-900` var; onlar
madde 8'den etkilenmiyor, yalnızca palet göçüne giriyor. `SolarSystemDetail` sekmelerinde
`border-b border-white/10` bir **tablo başlık satırı**, kart header'ı değil.

`ui/Card.tsx` bir `header` slotu kazanır.

**Ayrıca `globals.css`'te aynı kuralı yazan sekiz sınıf var** — `.fit-and-victim`,
`.items-card`, `.alliance-detail-card`, `.region-detail-card`,
`.constellation-detail-card`, `.system-detail-card`, `.corporation-detail-card`,
`.character-detail-card`. Sekizi de `.card`'a iner.

### 5.2 Yüzen katman

```css
.float  /* bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-md */
```

Kullanıcıları: `NavPopover` paneli, `NotificationBell` paneli, mobil çekmece
(`rounded-l-md` istisnasıyla), `ui/FilterDialog`, `Tooltip`.

### 5.3 Girdiler — `inputs.css`

- `.input` ve `.search-input` adlarıyla kalır; `bg-white/5` zemini korunur.
- **`.select` `globals.css`'ten `inputs.css`'e taşınır** — `option` ve scrollbar
  kuralları dahil. `globals.css` 293 satır ve içinde bununla ilgisiz çok şey var.
- `Checkbox` bileşenindeki **beş `indigo-500`** `accent`'e gelir.

### 5.4 Tablo — `tables.css`

`.table` bugün `bg-black`. `.card` içinde yaşayacağı için kendi zeminini bırakır,
`bg-transparent` olur.

---

## 6. Tipografi

**Bugün:** `public/fonts/shentox` altında **56 dosya / 5.9 MB**, `fonts.css`'te 14
`@font-face` bloğu (162 satır), artı `globals.css:1`'de Google Fonts'tan Mona Sans
çeken **render-blocking bir `@import`**.

**Hedef:** tek bir `InterVariable.woff2`, `next/font/local` ile yüklenir.

`next/font/google` değil, çünkü madde 9 özellikle **Tailwind Plus'ın kullandığı**
InterVariable'ı istiyor. Google Fonts'un Inter'i yakın ama aynı değil — Tailwind Plus
şablonları rsms.me'nin InterVariable'ını self-host eder ve `cv11`/`ss01` karakter
varyantlarını açar. "Aynı görünsün" isteniyorsa aynı dosya olmalı.

Düz bir `@font-face` yerine `next/font/local` kullanılmasının sebebi: preload ve CLS
önleyen `size-adjust` fallback metriklerini otomatik vermesi.

Sonuç: `fonts.css` 162 satırdan tek bloğa iner, `public/fonts/shentox` silinir,
Mona Sans `@import`'u gider, `--font-sans` güncellenir.

**Ön koşul:** `InterVariable.woff2` dosyasının depoya eklenmesi gerekiyor
(bkz. §10, açık karar).

---

## 7. Görsel ölçeği

### 7.1 Beklenmedik bulgu

**62 `<img>` etiketi var, `<Image>` yalnızca 3 — ve o üçü de `unoptimized`.**
`next.config.ts`'te `images` ayarı hiç yok.

Yani ortada Next görsel optimizasyonu yok: srcset yok, DPR yönetimi yok. `size=` ile ne
istenirse ekrana o gidiyor. Bu kuralı basitleştiriyor ama bir şey ekliyor: retina
ekranda net durması için istenen boyut, kutunun **iki katı** olmalı.

### 7.2 Kural

- **Skala:** 16 / 32 / 64 / 128 (gerektiğinde 256).
- Kutu boyutu skaladan bir değer alır.
- `size=` kutunun **iki katı**, yine skaladan.
- `size=` taşımayan **57 URL** tamamlanır.
- ESI zaten yalnızca ikinin kuvvetlerini servis ediyor, yani skala kendini dayatıyor.

**Not:** madde 10 bunu "altın oran" diye adlandırıyor. 16/32/64 bir **ikiye katlama**
ölçeği; altın oran (1.618) olsaydı 16/26/42 olurdu. Görseller için doğru olan ikiye
katlamadır, çünkü ESI'nin servis ettiği tam olarak odur. Tipografi ve boşlukta ayrı bir
oran tartışılabilir — bu spec'in kapsamında değil.

### 7.3 Bugünkü durum

Kutu boyutları: **32** (`size-8`, 3 yer) ✓ ve **64** (`size-16`, 6 yer) ✓ zaten skalada.
Skala dışı olanlar: **48** (`size-12` 3, `w-12` 1), **56** (`w-14` 1), **80** (`size-20` 1).

`next/image` `width` değerleri: 32 (10), 48 (12), 96 (5), 128 (5), 64 (3), 256 (1), 40 (1).

`size=` değerleri: 128 (32), 64 (28), 256 (2), 512 (2), 32 (1), **eksik (57)**.

### 7.4 Temizlik

`utils/itemImageUrl.ts` içinde iki `console.log` var — her blueprint görselinde konsola
yazıyorlar. Silinir.

---

## 8. Kapsam dışı

- **Popover davranışı** — PR #165'te tamamlandı.
- **Semantik renkler** — §2.4, gerekçesiyle.
- **`rounded-full`** (52 kullanım) — avatar ve durum noktaları; bunlar stil kararı değil,
  şeklin kendisi.
- **Tipografi/boşluk oranı** — §7.2'deki not.
- **`next/image`'a geçiş** — 62 `<img>`'ı `next/image`'a taşımak ve `next.config.ts`'e
  `remotePatterns` eklemek gerçek bir performans işi, ama kendi spec'ini hak ediyor.
  Bu spec yalnızca mevcut `<img>`'ların boyutlarını düzeltir.
- **Backend** — hiçbir dosyaya dokunulmuyor.

---

## 9. Göç sırası

| #   | PR                       | Kapsam                                                                                                                       |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Temel**                | `@theme` token'ları + tipografi. Tek başına görünür değişiklik yapar (font + zemin tonu), erken bakılabilir.                 |
| 2   | **Sözlük**               | `buttons.css`, `inputs.css`, yeni `cards.css`; `ui/Card` header slotu; `globals.css`'teki 8 kart sınıfının `.card`'a inmesi. |
| 3   | **Butonlar**             | 68 buton yeni sınıflara; `aria-pressed`; amber CTA'nın indirilmesi.                                                          |
| 4   | **Sekmeler ve girdiler** | 6 detay sayfasındaki sekme çubuğu `.tab`'a; 30 input, 12 select; Checkbox indigo → accent.                                   |
| 5   | **Yüzeyler**             | 249 satır içi zemin, 73 dosya. En büyüğü — bileşenler ve sayfalar diye ikiye bölünebilir.                                    |
| 6   | **Cam katman**           | `.float`; popover, çekmece, `FilterDialog`, `Tooltip`.                                                                       |
| 7   | **Görseller**            | Skala, `size=`, `console.log`. Diğerlerinden bağımsız.                                                                       |

**Sıra bağlayıcı:** 1 → 2 → sonra 3, 4, 5, 6. 7 bağımsız, araya girebilir.

Neden tek PR değil: 5. adım tek başına 73 dosya. Hepsi birleşirse ne incelenebilir ne de
bir şey ters gittiğinde nereye bakılacağı bilinir. Ayrıca 1 ve 2 onaylanmadan 3-6'yı
yazmak, sözlük değişirse hepsini yeniden yazmak demek.

---

## 10. Açık kalan kararlar

Bu ikisi uygulamadan önce kullanıcı kararı bekliyor.

**1. `InterVariable.woff2` dosyasını kim koyacak?** rsms.me/inter'den indirilecek. Ajan
indirsin mi, yoksa kullanıcı mı ekleyecek?

**2. Skala dışı kutular yukarı mı aşağı mı yuvarlanacak?** 48 → 32 tabloları
sıkılaştırır, 48 → 64 şişirir. 56 ve 80 için aynı soru. Bu görsel bir karar; PR 7'de her
biri için öneri sunulur, kullanıcı bakarak onaylar.

---

## 11. Doğrulama

Her PR için:

```bash
yarn workspace frontend typecheck
yarn workspace frontend lint
yarn workspace frontend test
```

`yarn workspace frontend build` **yalnızca PR kapanmadan önce bir kez**, kullanıcıya
haber verilerek — `build` scripti `yarn kill` ile 3000 portunu öldürüyor, yani
kullanıcının dev sunucusunu düşürüyor.

Görsel doğrulama kullanıcıda (`CLAUDE.md`: "UI and visual verification belong to the
user"). Her PR'da neye bakılacağı açıkça yazılır.

**Regresyon riski en yüksek yer PR 5**: 73 dosyada zemin değişikliği. Bu PR'ın
açıklamasında değişen sayfaların listesi verilir.
