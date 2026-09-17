# EVE Online marka hizalaması — tasarım

Tarih: 2026-09-17

## Amaç

KillReport'un görsel dili tamamen EVE Online'ın web sitesinin düzenine
çekiliyor: zeminler, aksan, sinyaller, sessiz gri, tipografi ağırlıkları,
satır yüksekliği ve EVE'nin büyük harf + harf aralığı muamelesi.

Bu belge ilk turda "seçmeli hizalama" olarak yazılmıştı. Karar toptan hizalama
yönünde verildi, o yüzden belge yeniden yazıldı: **artık varsayılan EVE'nin
değerini almak, istisna ise gerekçesiyle yazılmak zorunda.** Aşağıda üç istisna
var ve üçü de estetik değil, mekanik.

## Kaynak

`https://www.eveonline.com/` 2026-09-17'de tarayıcıdan okundu — CSS
değişkenleri ve hesaplanmış stiller üzerinden, ekran görüntüsünden değil.

### Renk

| Ne              | Değer                              | Nereden                                                   |
| --------------- | ---------------------------------- | --------------------------------------------------------- |
| Zemin           | `#101010`                          | `body` hesaplanmış                                        |
| Panel           | `#2b2b2c`                          | `--pfg-background-dark`                                   |
| Form zemini     | `#29353a`                          | `--sf-background-color`                                   |
| Aksan           | `#5ccbcb`                          | `--sf-terms-button-color`, `--sf-input-hover-focus-color` |
| Aksan mürekkebi | `#111418`                          | "Play Free" düğmesinin hesaplanmış `color`'ı              |
| Sessiz gri      | `#b0b0b0`                          | `--pfg-dark-chalice`                                      |
| Kırmızı         | `#fe3743`                          | hesaplanmış                                               |
| Yeşil           | `#37ba5b`                          | hesaplanmış                                               |
| Altın           | `#e7b815`                          | hesaplanmış                                               |
| PLEX turuncusu  | `#f67c0f`                          | `--pfg-plex-orange`                                       |
| Ortaklık altını | `#cd923b`                          | `--partnership-accent-color`                              |
| Devre dışı      | `#636363`                          | `--sf-disabled-color`                                     |
| Yarıçap         | Daire (`50%` / `100%`) dışında yok | hesaplanmış                                               |

### Tipografi

| Ne               | Değer                                            |
| ---------------- | ------------------------------------------------ |
| Yığın            | `"Shentox", "Rogan", sans-serif`                 |
| Ağırlıklar       | 300 / 400 / 500 / 600 — **baskın olan 500**      |
| Gövde metni      | 15px / 22.5px / **300**                          |
| Ölçek            | 36 / 24 / 20 / 18 / 16 / 15 / 14                 |
| Satır yüksekliği | Neredeyse her yerde **1.5**; 36px'te 1.06–1.2    |
| Büyük harf       | 59 öğede `uppercase`                             |
| Harf aralığı     | `2.4px` (büyük harf), `0.75px`, `-0.18px` (36px) |

### Ölçü

Dolgu ve boşluklar **5px tabanlı**: 5 / 10 / 15 / 20 / 30 / 40 / 60 / 70.
KillReport Tailwind'in 4px tabanında (`--spacing: 0.25rem`).

### İki teyit

1. **Shentox EVE'nin kendi web fontu.** KillReport onu zaten gönderiyor.
2. **EVE de yarıçapsız.** KillReport'un "sayfada duran hiçbir şey yarıçap
   almaz" kuralı bağımsız bulunmuştu ve aynı yere düşüyor.

Yani bu bir yeniden tasarım değil, zaten örtüşen iki dilin birleşmesi.

## Kararlar

### 1. Zemin — EVE'nin iki değeri, bir türetilmiş

```
ground        #101010   EVE'nin sayfası
surface       #2b2b2c   EVE'nin paneli (--pfg-background-dark)
surface-inset #3d3d3e   türetilmiş
```

**İstisna 1 — `surface-inset` türetildi.** EVE bir pazarlama sitesi; üç adımlı
bir uygulama derinliği yok, kopyalanacak bir üçüncü değer de yok.
`surface`'ın `ground`'a oranı korunarak türetildi.

Bu değişim bugünkü kurulumu iyileştiriyor. README "gölge olmadığı için bir
yüzeyin sayfanın üstünde durduğunu söyleyen tek şey ondan bir ton açık olması"
diyor, ama bugün o fark `1.13:1`:

|       | ground → surface | surface → inset |
| ----- | ---------------- | --------------- |
| Bugün | 1.13             | 1.21            |
| Sonra | **1.35**         | **1.30**        |

Uygulama gözle görülür biçimde açılıyor ve mavi tonunu kaybediyor. Toptan
hizalamanın asıl bedeli bu.

Form alanları için EVE'nin `#29353a`'sı da var, ama `.input` bugün kendi zemini
yerine `wash` (beyaz %5) kullanıyor ve bu "alanlar arasındaki alanın kenarı
olmaz" kuralından geliyor. `#29353a` design system'e `eve-form` olarak
referansla girer, `@theme`'e girmez — kuralı bozmadan alınacak yeri yok.

### 2. Aksan `#5ccbcb` — ve mürekkebin dönmesi

`.button-primary` bugün `text-white bg-accent`. Aksan teal olunca beyaz
mürekkep **1.93:1**'e düşüyor. EVE'nin kendi cevabı zaten koyu mürekkep.

|                                | Kontrast | 14px metin |
| ------------------------------ | -------- | ---------- |
| Beyaz / `cyan-600` (**bugün**) | 3.60     | ✗          |
| Beyaz / EVE teal               | 1.93     | ✗          |
| `#111418` / EVE teal           | **9.55** | ✓          |

**Bugünkü birincil düğme de geçmiyor.** Hizalama var olan bir hatayı düzeltiyor.

```
.button-primary   @apply text-white bg-accent hover:bg-cyan-500
→                 @apply text-accent-ink bg-accent hover:bg-accent-hover
```

Aynısı `.button[aria-pressed='true']` için de geçerli.

Yeni token `accent-ink: #111418`. Rozetin bugünkü `accent-ink`'i (`cyan-700`)
`badge-ink` oluyor. İsimlendirme `ink` / `ink-strong` / `ink-muted` ailesiyle
tutarlı olsun diye `on-accent` yerine `accent-ink` seçildi.

### 3. Sinyaller — hepsi EVE'nin, biri uyarı notuyla

| Token       | Değer     | surface `#2b2b2c` | inset `#3d3d3e` |
| ----------- | --------- | ----------------- | --------------- |
| `destroyed` | `#fe3743` | **3.93 ✗**        | **3.02 ✗**      |
| `dropped`   | `#37ba5b` | 5.62 ✓            | 4.31 ✗          |
| `isk`       | `#e7b815` | 7.59 ✓            | 5.82 ✓          |

Toptan hizalama kararı gereği üçü de EVE'nin değerine geçiyor — ilk turda
`destroyed`'ı `red-400`'de tutmayı önermiştim, o öneri düştü.

Ama sonucu gizlemiyorum: **`destroyed` 4.5:1'i geçmiyor.** Hasar rakamları ve
modül adları düz gövde metni; EVE'nin kırmızısıyla bunlar WCAG AA'nın altında
kalıyor. Design system'in kendi kuralı bu durumu şöyle çözüyor — "kaynağın
geçmeyen çiftini koru, notuna işaretle" — ve burada da öyle yapılacak:
`destroyed` ile `dropped` token'larının kullanım notuna hangi zeminde kaç
ölçtüğü yazılır.

Geri almak istersen tek satır: `destroyed` → `#ff6467`, ölçüm 4.90 ✓.

`destroyed-fill` ve `dropped-fill` — bütün bir satırın arkasındaki zemin —
EVE'nin renklerinin koyulaştırılmış hâline geçiyor, bugünkü `red-700` /
`green-700` mantığıyla aynı.

PLEX turuncusu ve ortaklık altını `@theme`'e girmiyor: uygulamada karşılığı
olan bir anlam yok. Design system'e referans olarak girerler.

`sec-*` skalası da değişmiyor. O EVE'nin marka renklerinden değil, oyunun
güvenlik bantlarından geliyor; `utils/security.ts` onu eşiklerden türetiyor.

### 3b. Kalan anlamlar da adlandırılıyor — `danger`, `success`, `caution`

Bu madde ilk onaydan sonra eklendi. Uygulama kırmızı, yeşil ve sarıyı **sekiz**
ayrı iş için kullanıyor ve tasarım sistemi bunlardan üçünü adlandırmıştı.
Sadece o üçünü taşımak, ekranda birbirine yakın ama eşit olmayan iki kırmızı
bırakıyordu — hasar rakamı EVE'nin, yanındaki hata mesajı Tailwind'in. Karar:
kalan anlamların çoğunu da adlandırıp birlikte taşımak.

Üç yeni jeton, üçü de mevcut üçlüyle **aynı değeri** taşıyor:

| Jeton     | Anlam                                                                                    | Değer     |
| --------- | ---------------------------------------------------------------------------------------- | --------- |
| `danger`  | Hata mesajı, `.button-danger`, kaybedilen egemenlik, eksi üye değişimi                   | `#fe3743` |
| `success` | Servis sağlığı, auth başarısı, changelog feature, kazanılan egemenlik, artı üye değişimi | `#37ba5b` |
| `caution` | Uyarı, devredilen egemenlik, bekleyen durum                                              | `#e7b815` |

Aynı değeri taşıyan iki jeton israf değil: `destroyed` ile `danger` bugün aynı
kırmızı ama farklı şeyler söylüyor, ve yarın biri değişirse diğeri yerinde
kalır. Sistemin `sec-null`'u zaten `destroyed`'ın kırmızısını böyle paylaşıyor.

**Adlandırılmayanlar** — bunlar ham palette kalıyor, çünkü ya kendi skalası var
ya da bir çiftin yarısı:

- `sec-*` güvenlik bandı — kendi skalası, `utils/security.ts`'ten geliyor.
- **Ticker** — ittifak sarısı ve kurum yeşili; EVE'nin oyun içi karşılığı var.
- **`.eve-description` bağlantısı** — EVE'nin oyun içi bağlantı rengi.
- **Saldıran/savunan çiftleri** — `IskWarBar`, `ScoreBar`, egemenlik geçmişi.
  Saldıran kırmızı, savunan cyan; ikisi de taraf işareti, anlam değil. Cyan
  tarafı bu dalda zaten aynı gerekçeyle ham palete geri alındı, kırmızı tarafı
  da onunla aynı yerde kalmalı.
- **Kategori paletleri** — `workers` sayfasının dokuz renkli anahtarı gibi.

### 3c. Kontrast: `danger` hangi zeminde okunuyor

`#fe3743` `surface` üstünde **3.93**, `surface-inset` üstünde **3.02** ölçüyor
— gövde metni için gereken 4.5'in altında. `destroyed` için bu bilerek kabul
edildi. `danger` için aynı şeyi söylemek daha ağır, çünkü okunması gereken şey
bir hata mesajı.

Ölçüm zemine bağlı ve uygulamadaki hata mesajlarının çoğu **sayfa zemininde**
duruyor, kart içinde değil — `<div className="p-8 text-danger">Error: …</div>`
kalıbı. `ground` (`#101010`) üstünde `#fe3743` **5.29** ölçüyor ve geçiyor.

Yani kural şu: **`danger` sayfa zemininde serbest, kart yüzeyinde değil.**
Uygulama görevinde hata mesajlarının hangi zeminde durduğu tek tek
doğrulanacak; kart içinde kalan varsa ya zemini `ground`'a alınacak ya da o
site not düşülerek `#ff6467`'de (4.90) bırakılacak. Jetonun kullanım notuna
her iki ölçüm de yazılır.

### 3d. Karar: kırmızı ölçeğinin tamamı EVE'ninki

3c'de `danger`'ın kart yüzeyinde 3.93 ölçtüğünü ve gövde metni sınırının
altında kaldığını yazmıştım. Uygulamada `destroyed`'ın da neredeyse yalnızca
o yüzeylerde yaşadığı sonradan ölçüldü — killmail satırları `.tr-row`, yani
`bg-surface`. Yani seçim "EVE'nin kırmızısı okunmuyor" ile "EVE'nin kırmızısı
kullanılmıyor" arasındaydı.

**Karar: markaya tam bağlılık.** Uygulamadaki her kırmızı EVE'ninki olur,
kontrast bedeli bilerek kabul edilir.

Bunu jeton katmanında yapmak yetmiyordu: güvenlik bandının kırmızısı, savaş
çubuğunun saldıran yarısı ve kategori paletlerindeki kırmızı jeton taşımıyor ve
taşımamalı. O yüzden **palet ölçeğinin kendisi** değişiyor:

```
red-400  #ff6467 → #fe3743   (eveonline.com'un kırmızısı, birebir)
red-500  #fb2c36 → #e50e2e
red-600  #e7000b → #cf0019
red-700  #c10007 → #b50000
```

`red-400` bilerek çıpa: uygulamanın yazdığı adım o, ve EVE'nin değerinin
birebir kendisi olması gereken yer orası. Daha koyu üç adım, EVE'nin tonu ve
doygunluğunda, Tailwind'in açıklık aralıkları korunarak türetildi — böylece
ölçek eşit adımlarla inmeye devam ediyor.

Palet adını ezmek bu belgede daha önce reddedilmişti (`gray-400` artık
gray-400 olmazdı). Burada gerekçe farklı ve açık: proje kırmızısının EVE'nin
kırmızısı **olması** isteniyor. `globals.css`'te bunu söyleyen bir yorum
duruyor, yani kimse sürprize uğramıyor.

**Kayda geçen bedel:** `red-400` `surface` üstünde **3.93**, `surface-inset`
(satır hover'ı) üstünde **3.02** ölçüyor. Hasar rakamları ve kart içi hata
metinleri WCAG AA'nın altında. Daha koyu üç adım yalnızca dolgu ve kenarlık
olarak kullanılıyor, metin olarak değil, o yüzden onların ölçümü bağlayıcı
değil. Hover durumu bugün de geçmiyor; bu değişiklik onu bozmuyor.

Yeşil ve sarı değişmiyor: EVE'nin yeşili `surface` üstünde 5.62, altını 7.59
ölçüyor, ikisi de geçiyor.

### 4. Sessiz gri EVE'ninkine geçiyor

`ink-muted`: `#99a1af` → `#b0b0b0`. Yeni inset üstünde bugünkü gri **4.17**,
EVE'ninki **5.00**. Bu da bir düzeltme.

`ink-faint` EVE'nin `--sf-disabled-color: #636363`'üne geçiyor.

### 5. Tipografi — ağırlıklar ve satır yüksekliği EVE'ye

Toptan hizalamanın en görünür parçası bu.

|                  | Bugün                         | EVE     | Sonuç                  |
| ---------------- | ----------------------------- | ------- | ---------------------- |
| Gövde            | 400                           | **300** | `body` 300'e iner      |
| Başlık / ad      | 600 (215 yerde)               | **500** | 500'e iner             |
| Kontrol          | 500                           | 500     | değişmiyor             |
| Satır yüksekliği | Tailwind'in ölçeği (1.43–1.5) | **1.5** | ölçek 1.5'e sabitlenir |

`font-semibold` 215 yerde yazılı. Bunların hepsini elle değiştirmek yerine
`@theme`'de `--font-weight-semibold: 500` demek mümkün — ama o zaman sınıf adı
yalan söyler. Bu yüzden **mekanik bir tarama** olarak yapılır: `font-semibold`
→ `font-medium`, tek commit, kendi başına okunabilir.

**Büyük harf + `2.4px` harf aralığı** EVE'nin imzası ve KillReport'ta bugün
sadece `.tag` büyük harf. EVE'nin kullandığı yerlerin karşılığı bizde
`.th-cell` (tablo başlıkları) ve `.card-header` başlıkları. İkisi de büyük
harfe ve `0.15em` aralığa geçer.

### 6. Ölçü — **istisna 2: 4px tabanında kalıyor**

EVE 5px tabanında. `--spacing: 0.25rem` → `0.3125rem` demek teknik olarak tek
satır, ama sonucu şu: uygulamadaki **her** dolgu, boşluk ve genişlik aynı anda
%25 büyür. Bunun görsel kazancı yok — kimse 4px ile 5px tabanı ayırt etmiyor,
ayırt edilen şey renk ve tipografi — buna karşılık yoğun bir veri tablosunda
%25 daha fazla boşluk, ekrana sığan satır sayısını düşürür.

Minimalizm kuralı burada net: bu bir boşluk eklemesi ve karşılığında hiçbir şey
görünmüyor. **4px tabanı kalıyor.** İstersen ayrı bir iş olarak denenir.

### 7. Düzen — **istisna 3: kopyalanacak bir düzen yok**

EVE'nin sitesi hero görselleri, tam genişlik bölümleri ve pazarlama akışı olan
bir tanıtım sitesi. KillReport yoğun bir veri uygulaması. "Düzeni almak" burada
karşılığı olmayan bir cümle: killmail tablosunun hero'su yok.

Alınabilecek olan — koyu zemin, yarıçapsızlık, dar kontrast aralığı, büyük harf
muamelesi — zaten yukarıdaki maddelerde. Sayfa iskeleti (`max-w-480`, dört
adımlı gutter) değişmiyor.

### 8. Rogan alınıyor, `--font-sans` değişmiyor

Dört kesim indirildi. Ama **ana sayfada Rogan ile çizilen tek bir öğe yok** —
yığında yedek sırada duruyor, Shentox her şeyi karşılıyor. Dosyalar design
system'e girer; `--font-sans` bugünkü gibi kalır. Kullanılmayan dört font
yüklemek karşılığı olmayan bir ekleme olur.

### 9. Logo

EVE Online kelime markası (130×55 SVG) design system'e `Brand` grubunda girer.
**Uygulamaya girmez** — başlık Heroicons `HomeIcon` olarak kalır. Başka birinin
markasını uygulamanın kimliği yapmak hizalama değil, taklit olur. CCP'nin
üçüncü taraf geliştirici lisansı kapsamında, kaynağı not düşülerek.

## Değişmeyenler

- Üç derinlik adımı, dört değil.
- Yarıçapsızlık — EVE de yarıçapsız, teyit.
- Durumun ARIA'dan gelmesi.
- Boşluk ölçeği (madde 6), sayfa iskeleti (madde 7).
- `edge` / `wash` alfa değerleri.
- `sec-*` güvenlik skalası.
- Gölgesizlik ve `.float` camı.

## Dokunulan dosyalar

| Dosya                          | Ne                                                                   |
| ------------------------------ | -------------------------------------------------------------------- |
| `frontend/src/app/globals.css` | `@theme` — zeminler, aksan, `accent-ink`, sinyaller, gri, ağırlıklar |
| `frontend/src/app/buttons.css` | `.button-primary` ve `[aria-pressed]` mürekkebi, `.badge` token adı  |
| `frontend/src/app/tables.css`  | `.th-cell` büyük harf + aralık                                       |
| `frontend/src/app/cards.css`   | `.card-header` büyük harf + aralık                                   |
| `frontend/src/**/*.tsx`        | `font-semibold` → `font-medium` taraması (ayrı commit)               |
| Design system artifact         | token'lar, Rogan, logo, EVE bölümü                                   |

`blue-400`'ün hâlâ yazıldığı ~56 yer bu işin kapsamında **değil**.

## Maliyet, tek cümlede

Uygulama açılıyor, mavi tonunu kaybediyor, tipografisi hafifliyor ve birincil
düğmesi koyu yazılı teal oluyor; karşılığında bugün geçmeyen üç kontrast
ölçümü geçiyor ve dil, verisini gösterdiği oyunun markasına oturuyor.

## Onay bekleyen tek şey

Yukarıdaki üç istisna (türetilmiş `surface-inset`, 4px tabanı, düzen) kabul
mü? Kabulse uygulama planı yazılır. `destroyed`'ın kontrast notu da bilerek
alınmış bir karar olarak kayda geçer.
