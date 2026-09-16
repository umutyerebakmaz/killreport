# Killmail detay sayfası: tasarım diline hizalama — tasarım

Tarih: 2026-09-16

## Amaç

Killmail detay sayfası uygulamanın tasarım dilini kullanmıyor. Dil
`frontend/src/app/` altındaki CSS dosyalarında yazılı ve uygulamanın geri
kalanında geçerli: `globals.css`'teki `@theme` jetonları (üç derinlik adımı,
tek aksan), `cards.css`'teki yüzey söz dağarcığı (`.card`, `.card-header`,
`.card-body`, `.card-row`, `.float`, `.chip`), `buttons.css`'teki yapı +
görünüm + değiştirici kalıbı, yarıçapsızlık ve Shentox.

Bu sayfa ise yüzeylerini elle çiziyor, rengini doğrudan Tailwind paletinden
seçiyor ve bir yerde artık var olmayan bir sınıf kullanıyor. Bu iş o dört
ağacı dile hizalar.

İş iki katmanlı. **Sayfanın tamamında** yapılan şey yalnızca dil hizalaması:
üç kolonluk grid, kolon genişlikleri ve metinler değişmiyor.
**`KillmailSummaryCard` ile `AttackersCard`'da** bunun üstüne dört somut
değişiklik biniyor:

- `KillmailSummaryCard`'ın bölümleri soldan sağa grid'e geçiyor — bugünkü tam
  genişlik satır düzeninde satır başına ~760px boş piksel var (_Bölüm içi
  grid_).
- Aynı karta patlayan/düşen filtresi ekleniyor, `MostValuableCarousel`'ın
  sekme kalıbıyla (_Patlayan/düşen filtresi_).
- Grid tek düzen değil: klasik tablo görünümü korunuyor ve kart bir görünüm
  seçici kazanıyor (_Görünüm seçici_).
- `AttackerRow` sadeleşiyor: 64/32 ölçüleri, NPC yuvasında geminin render'ı,
  FINAL BLOW ile TOP DAMAGE portrenin üstünde, sağ alttaki iki logo yok, kurum
  ve ittifak adı tek satırda, hasarın `DMG` eki yok (_AttackerRow_).

Bir de sol kolonun iki parçası ayrı kartlara bölünüp yer değiştiriyor: kurban
özeti sola, fit ekranı sağa (2. karar, _Kart sınırı_).

## Bugünkü durum

| Dosya                                                    | Satır | Dilden sapması                                                                                                          |
| -------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------- |
| `app/killmails/[id]/page.tsx`                            |   362 | Tek bir `card` elemanı (`:75-76`, ternary'nin iki dalı); kart iskeleti yok, kendi `p-6`'sını yazıyor; 7 el yazısı satır |
| `components/AttackersCard/AttackersCard.tsx`             |   273 | Başlık barı elle yazılmış ve tıklanamazken `hover:` taşıyor; 3 el yazısı `.card-row`                                    |
| `components/AttackersCard/AttackerRow.tsx`               |   273 | 4 `rounded`, `bg-gray-800`, 4 `hover:text-blue-400`                                                                     |
| `components/AttackersCard/FeaturedAttackerCard.tsx`      |   119 | `text-md` (Tailwind'de yok), `.card` yerine `inset-ring`                                                                |
| `components/KillmailSummaryCard/KillmailSummaryCard.tsx` |   367 | `:42` `.card`'ın dizesini birebir elle yazıyor; 3 el yazısı satır                                                       |
| `components/KillmailSummaryCard/FittingItem.tsx`         |    97 | Aynı anlam için ikinci bir kırmızı/yeşil (`bg-red-700/40`)                                                              |
| `components/KillmailSummaryCard/FittingSection.tsx`      |   116 | Değer/etiket skalası                                                                                                    |
| `components/FitScreen/*`                                 |   283 | Neredeyse temiz; iki `text-gray-500`                                                                                    |

Üç bileşen ağacının üçü de yalnızca bu sayfadan kullanılıyor — başka bir ekrana
yansıması yok, dolayısıyla dördü tek bütün olarak revize edilebilir.

Ölçümler:

- `hover:text-blue-400`: 8 yer. Uygulamanın aksanı cyan
  (`globals.css` `.character-name`, `cards.css` `.map-card-name`).
- Etiket/değer satırı (`flex justify-between`): `page.tsx`'te 7,
  `KillmailSummaryCard.tsx:348-360`'ta 3 — toplam 10 kopya, iki dosyada.
- Durum rozeti: `AttackerRow.tsx:140,145,150,155` ve `page.tsx`'in WAR KILL
  rozeti — 5 kopya, 5 farklı değer.
- `.card-row`'un dizesi elle: 5 kopya.
- Üç ölü sınıf, üçü de `cards.css`'te belgelenen `transition-color`
  vakasının aynı türü: `text-md` (`FeaturedAttackerCard.tsx:112`) Tailwind'de
  yok; `victim-card` (`page.tsx:79`) ve `fitting-section`
  (`FittingSection.tsx:92`) hiçbir CSS dosyasında tanımlı değil. Üçü de
  sessizce hiçbir şey yapmıyor.

## Kararlar

1. **Sayfanın geneli için kapsam yalnızca dil.** Kolon genişlikleri aynı,
   yeni metin belirmiyor. Üç istisna: sol kolonun iki kartı yer değiştiriyor
   (2. karar), `KillmailSummaryCard` ve `AttackerRow` ise bilgi düzenini de
   değiştiriyor (10-13. kararlar).
2. **FitScreen ile kurban özeti iki ayrı kart oluyor ve yer değiştiriyor.**
   Özet sola (1/3), fit sağa (2/3) geçiyor — okuma kimden başlayıp gemiye
   gidiyor; mobilde de özet üste çıkıyor. Bugün ikisi tek bir
   `.card`'ın (`page.tsx:75-76`) içindeki `grid ... gap-6`'da duruyor, yani
   aralarındaki boşluk o kartın kendi `bg-surface`'ini gösteriyor ve ikisi tek
   parça gibi okunuyor. `cards.css` bu ayrımı `.tab-shell` yorumunda zaten
   adlandırıyor: `.card` metin ve kontrol tutan **yaprak** yüzey için,
   kendi yüzeylerini tutan **çerçeve** için değil. Bugünkü kart bir çerçeve
   ama yaprak kıyafeti giymiş. İkiye bölününce aradaki boşluk `bg-ground`'u
   gösterir — `body` `bg-ground` (`layout.tsx:24`) ve `main`'in kendi zemini
   yok, o yüzden araya ayrıca bir zemin konmuyor.
3. **İçerik arası mesafe 24px'te sabit kalıyor.** Bugün FitScreen ile özetin
   içerikleri arasında `gap-6` yani 24px var. İki ayrı kartta o 24px'in içine
   iki iç dolgu da giriyor, o yüzden dolgu ve boşluk buna göre seçiliyor:
   her kart `p-2`, aralarında `gap-2` — 8 + 8 + 8 = 24px, değişmiyor. Zemin
   şeridi 8px.
4. **Kartlar başlıksız kalıyor.** Bugün başlığı olmayan bir kart başlık
   kazanmıyor. Zaten var olan başlıklar (`N ATTACKERS`, `Ship`, fitting bölüm
   adları) metinleriyle kalıyor, yalnızca dile hizalanıyor.
5. **Anlam renkleri jeton oluyor.** `globals.css`'teki `@theme` bloğuna üç
   jeton eklenir; aynı anlam tek bir değerde toplanır.
6. **Hasar da `destroyed` jetonunu kullanır.** Ayrı bir `--color-damage` aynı
   değerin ikinci adı olurdu; tek kırmızı, tek anlam: "bu taraf yok edildi".
7. **`SummaryRow` paylaşılan bir bileşen.** İki tüketicisi var, o yüzden
   `ui/` rafına giriyor — sayfa-yerel bir yardımcı değil.
8. **`cards.css` yalnızca `.tag` ile büyüyor.** Söz dağarcığına yeni sınıf
   eklemenin çıtası `cards.css`'in kendi yorumlarında yazılı ("bu dize altı
   kopyada vardı"); 5 kopyalık rozet bu çıtayı geçiyor, 10 kopyalık
   etiket/değer satırı ise bir React bileşeni olarak daha iyi karşılanıyor.
9. **`FitScreen`'in yuvalarına dokunulmuyor.** `bg-white/5` zemin olarak
   dilin dışında ama `.button-ghost` ve `.menu-row`'da meşru bir vurgu tonu;
   FitScreen kendi içinde tutarlı ve sayfanın en çok bakılan parçası.
10. **`KillmailSummaryCard`'ın bölümleri grid oluyor.** Her bölüm tam
    genişlikte kalır, içindeki kalemler soldan sağa akar. Bölümlerin kendisi
    yan yana dizilmiyor — kalem sayıları çok farklı (Rig 3, Cargo 40) ve
    kolonlar tırtıklı biterdi.
11. **Aynı karta patlayan/düşen filtresi giriyor.** Sekme kalıbı
    `MostValuableCarousel`'dan birebir alınır; yeni bir etkileşim icat
    edilmiyor.
12. **Grid tek düzen değil, iki görünümden biri.** Klasik tablo görünümü
    bugünkü ölçüleriyle korunuyor; varsayılan grid, seçim `localStorage`'da
    saklanıyor. Kontrol `RadioGroup` — aynı şeritte ikinci bir `tablist`
    olmuyor, çünkü bu bir tercih, gezinme değil.
13. **`AttackerRow` sadeleşiyor.** Görseller 64/32 ölçüsüne geçiyor, NPC
    yuvası geminin render'ını gösteriyor, FINAL BLOW ile TOP DAMAGE portrenin
    üstüne taşınıyor, sağ alttaki iki logo kalkıyor, kurum ve ittifak adı tek
    satıra iniyor (ittifak öncelikli) ve hasar sayısının `DMG` eki gidiyor.

## Paylaşılan katman

### `globals.css` — üç jeton

```css
@theme {
  --color-destroyed: var(--color-red-400);
  --color-dropped: var(--color-green-400);
  --color-isk: var(--color-yellow-400);
}
```

Tailwind v4 bu jetonlardan `text-destroyed`, `bg-destroyed/20`,
`text-dropped`, `text-isk` gibi sınıfları üretir.

### `cards.css` — `.tag`

```css
/* Bir durum rozeti: FINAL BLOW, TOP DAMAGE, SOLO, NPC (AttackerRow) ve
   WAR KILL (page.tsx). Beş kopyada vardı, dördü yarıçap taşıyordu ve
   sayfada yarıçap alan tek şey .float. SOLO kopyası text-xs'i de
   düşürmüştü, yani bugün komşularından büyük yazılıyor; tek sınıfa
   çıkınca o da hizalanır. Rengi kendisi taşımaz — çağıran anlam
   jetonunu verir. */
.tag {
  @apply inline-flex items-center px-2 py-0.5 text-xs font-medium;
}
```

Kullanımı: `<span className="tag text-destroyed bg-destroyed/10">`.

`.chip` bu işi görmüyor: o, kaldırma düğmesi taşıyan bir filtre çipi
(`py-1 pl-2 pr-1`, `bg-surface-inset`).

### `ui/SummaryRow.tsx` — yeni

```tsx
<SummaryRow label="System">…</SummaryRow>
```

Solda etiket (`text-gray-400`), sağda değer (`text-gray-100`), arada
`justify-between`. Değerin kendi rengi varsa (ISK, hasar) çağıran verir.
`ui/` rafının kalıbına uyar: `Card`, `SectionTitle`, `RankNumber` gibi tek
işli, iş mantığı taşımayan bir primitive.

## Kart sınırı

Bugün (`page.tsx:75-79`) dıştaki `.card` bir çerçeve ama yaprak kılığında, ve
onun içinde tanımsız `victim-card` sarmalayıcısı duruyor:

```tsx
<div className="flex flex-col gap-6 p-6 card">
  <div className="victim-card">
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">…FitScreen…</div>
      <div className="lg:col-span-1">…özet…</div>
    </div>
  </div>
</div>
```

Sonrası — grid dışarı çıkıyor, iki dal kendi kartını giyiyor, sarmalayıcılar
gidiyor:

```tsx
<div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
  <div className="p-2 card lg:col-span-1">…özet…</div>
  <div className="p-2 card lg:col-span-2">…FitScreen…</div>
</div>
```

**Sıra değişiyor: kurban özeti fit ekranından önce geliyor.** Bugün fit solda
(2/3) ve özet sağda (1/3); yeni düzende özet solda (1/3), fit sağda (2/3) —
yani okuma kimden başlayıp gemiye gidiyor. Kolon genişlikleri aynı kalıyor,
yalnızca yerleri değişiyor.

Mobilde grid tek kolona indiği için sıra DOM sırası olur: özet üstte, fit
altında. Bugün tersi.

Grid'in kendi zemini olmadığı için aradaki 8px `bg-ground`'u gösterir ve iki
kart ayrı okunur; grid varsayılan olarak `stretch` hizaladığından ikisi aynı
yüksekliğe gelir.

Fit kolonunun üstündeki dış bağlantı düğmeleri (zKillboard, EVE Tools, ESI
Verified, Share) fit ile birlikte gidiyor, yani sağ karta geçiyorlar. Bunlar
killmail'in tamamına ait eylemler; sayfanın üstüne alınmaları düşünülebilir
ama o ayrı bir yerleşim kararı, bu işte fit kartında kalıyorlar.

Ölçü (3. karar): bugün içerikler arasında yalnızca `gap-6` var, 24px. İki
kartta aynı 24px `p-2` + `gap-2` + `p-2` olarak dağılıyor — 8 + 8 + 8.
İçerik arası mesafe değişmiyor, 8px'i zemin şeridine dönüşüyor.

`isStructure` dalının fazladan alt dolgusu (`pb-24`, bugün `px-6 pt-6 pb-24`)
artık yalnızca FitScreen kartına ait — özet kartını ilgilendirmiyordu, tek
kart olduğu için ona da uygulanıyordu.

## Altı kural

Dört ağaç bu kurallarla hizalanır:

| #   | Kural                                 | Uygulaması                                                            |
| --- | ------------------------------------- | --------------------------------------------------------------------- |
| 1   | Yüzey elle yazılmaz                   | `.card`, `.card-row`, `.card-header` sınıfları kullanılır             |
| 2   | Derinlik üç adım                      | `bg-gray-800`, `bg-gray-800/50` → `bg-surface-inset`                  |
| 3   | Aksan cyan                            | `hover:text-blue-400` → `hover:text-cyan-400` (8 yer)                 |
| 4   | Yarıçap yok                           | `AttackerRow`'daki 4 `rounded` kalkar; yarıçapı olan tek şey `.float` |
| 5   | Anlam rengi jetondan                  | `text-red-400`/`bg-red-700/40` → `text-destroyed`/`bg-destroyed/20`   |
| 6   | Etiket ile değer aynı ağırlıkta olmaz | Etiket `text-gray-400`, değer `text-gray-100`                         |

Sayfadaki en görünür değişiklik son kural: bugün etiket de değer de
`text-gray-400` olduğu için özet blok tek düz bir yüzey gibi okunuyor. Ayrıca
`text-gray-300` ile `text-gray-400` bu ağaçta aynı işi iki değerde yapıyor;
ikisi de skalaya girer.

### 1. kuraldan bilinçli sapma: `.card-body` kullanılmıyor

`.card-body` `p-4`, ama FitScreen ve özet kartları `p-2` alıyor — 3. karar
içerik arası mesafeyi 24px'te sabitlediği için dolgu bütçesi kart başına 8px.
Bu iki kart uygulamadaki diğer kartlardan dar nefes alır; ödenen bedel bu,
kazanılan şey aradaki zemin şeridi.

Sayfadaki başka hiçbir yer `.card-body` istemiyor zaten: `AttackersCard` ve
`KillmailSummaryCard` birer liste kartı, yani dolguyu kart değil `.card-row`
ve bölüm satırları taşıyor.

## Bölüm içi grid

Bugünkü düzende her kalem tam genişlikte bir satır. Kart sol kolonda, 1920px
ekranda **~1200px** geniş. Satırın sabit parçaları: 32 ikon + 8 + adet 64 +
fiyat 160 + boşluklar = **304px**; kalan ~900px `flex-1` ile isme gidiyor ve
"Warp Disruptor II" oraya ~130px kaplıyor. Yani **satır başına ~760px boş
piksel**, satırın üçte ikisi. 25-40 kalemlik bir fit'te görülen şey bu.

Sabit kolonlar da fazla: `formatISK` en uzun hâlde `999.99B` üretiyor, yani
7-8 karakter (~70px), ama fiyat kolonu `w-40` — 160px.

Hücre:

```text
▣  Warp Disruptor II            1    4.44M
32  flex-1 truncate + title   adet   w-20 sağa yaslı
```

Sabit parçalar ~150px'e iniyor: fiyat `w-40` → `w-20`, adet bloğu `w-16` →
içeriğine göre, ikon `size-8` aynı.

Grid: `grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3`. Hücre genişlikleri —
1920px'te 3 kolon ≈ 400px, 1536px'te 3 kolon ≈ 312px, 1280px'te 2 kolon ≈
398px, mobilde tek kolon. `truncate` uzun isimleri keser, `title` tam adı
taşır. Kırılma noktaları gözle bakıldıktan sonra tek satırda ayarlanır.

Yıkıldı/düştü rengi artık satırın değil hücrenin: her hücre kendi tonunu
taşır (`bg-destroyed/20` / `bg-dropped/20`), düzen envanter gibi okunur.

**Ship bölümü grid'e girmiyor.** Tek kalem olduğu için 3 kolonluk grid'de
üçte ikisi boş kalırdı — düzeltilmeye çalışılan şeyin ta kendisi. Kartın
başlığı gibi tam genişlikte, 64px render'ı ve tier rozetiyle kalıyor.

Bölüm başlıkları (`HIGH SLOTS`, `MID SLOTS` …) ve bölümler arası `border-b`
yerinde. `FittingSection.tsx:92`'deki ölü `fitting-section` sınıfı kalkıyor —
`text-md` ve `victim-card` ile aynı tür, hiçbir CSS dosyasında tanımlı değil.

## Patlayan/düşen filtresi

```text
┌─ card-band ──────────────────────────────┐
│ [ All ] [ Destroyed ] [ Dropped ]        │  role="tablist"
├──────────────────────────────────────────┤
│ SHIP                                     │  role="tabpanel"
│ ▣ Rifter  Frigate            1    0.65M  │
│ HIGH SLOTS                               │
│ ▣ 125mm Gatling 1 2.1M │ ▣ Small … │ …   │
└──────────────────────────────────────────┘
```

Kalıp `MostValuableCarousel`'dan birebir: `TABS` sabiti (`scope`, `label`,
`emptyText`), `role="tablist"` + `aria-label`, her sekme
`button button-secondary button-sm` giyip `aria-selected` / `aria-controls` /
`tabIndex` taşır, ok tuşları `hooks/useTabList.ts` ile — o hook zaten var ve
kendi spec dosyası var. Panel **tek** bir `role="tabpanel"`: sekme başına ayrı
id verilse etkin olmayan sekmelerin `aria-controls`'u DOM'da olmayan bir
elemanı gösterirdi (`MostValuableCarousel.tsx:22-25`'teki gerekçe).

Tek sapma yerleşimde: `MostValuableCarousel` bir kartın içinde değil,
sekmelerini `SectionTitle`'ın altına koyuyor. Bu şerit kartın içinde, o yüzden
`.card-band` — `cards.css` onu zaten "gövdenin üstündeki kontrol şeridi,
kartın kendi yüzeyini korur" diye tanımlıyor.

Filtre `FittingSection`'daki `groupItems`'ın **sonrasında** bir yüklem:
o fonksiyon her kalemi zaten patlayan ve/veya düşen kayıtlara bölüyor, yani
süzme ucuz ve birebir doğru. Kalemi kalmayan bölüm hiç çizilmiyor
(`FittingSection` boş listede zaten `null` dönüyor).

Sekme etiketlerinde sayı yok — `MostValuableCarousel` da koymuyor.

İki davranış kararı:

- **Ship bloğu filtreye uyar.** Gövde her zaman patlar, hiç düşmez; "Dropped"
  sekmesinde gizlenir. Aksi hâlde o görünüm patlamış bir kalem gösterir ve
  sekme yalan söyler. Varsayılan sekme "All", yani kartın normal hâli
  değişmiyor.
- **Alttaki Destroyed / Dropped / Total ISK satırları filtrelenmez.** Onlar
  killmail'in toplamı, görünümün değil.

`KillmailSummaryCard` durum tuttuğu için dosyanın başına `'use client'`
giriyor (CLAUDE.md: hook veya state kullanan her bileşen).

## Görünüm seçici: tablo / grid

Grid, tek düzen değil — iki görünümden biri. Kart iki modu birden taşır:

- **Grid** (varsayılan): yukarıdaki _Bölüm içi grid_.
- **Klasik tablo**: bugünkü düzenin **birebir** korunmuş hâli — tam genişlik
  satırlar, `w-16` adet ve `w-40` fiyat kolonları. Ölçüleri değişmiyor;
  "klasik" olmasının anlamı bu. Dar hücre (`w-20` fiyat) yalnızca grid'e ait.

Yani _Bölüm içi grid_'de sayılan ~760px boş piksel tablo görünümünde duruyor.
Artık bir kusur değil, seçenek.

Kontrol `RadioGroup` — uygulamanın "tam olarak birini seç" kalıbı, gerçek
radio'lar, `.button-secondary:has(:checked)` ile boyanıyor. İkinci bir
`tablist` olmuyor: filtre zaten bir `tablist` ve aynı şeritte ikincisi ekran
okuyucuda iki ayrı sekme kümesi gibi duyurulurdu, oysa bu bir tercih, gezinme
değil.

İkisi aynı `.card-band` içinde, `justify-between` ile: solda filtre sekmeleri,
sağda görünüm seçici.

Seçim `localStorage`'da `killmail_fitting_view` anahtarıyla saklanıyor
(uygulamanın kalıbı snake_case: `eve_access_token`, `eve_token_expiry`), yani
sonraki killmail'lerde de geçerli. Okuma **`useEffect` içinde**: sunucuda
`localStorage` yok, ilk çizimde okunursa sunucu ile istemci farklı değer
üretir ve hidrasyon uyuşmazlığı çıkar. Yani ilk kare her zaman varsayılanla
(grid) çiziliyor, saklanmış tercih hemen ardından uygulanıyor.

## AttackerRow

Bir saldıran satırı bugün şöyle: 96'lık portre, yanında 48+48 gemi/silah
sütunu, sonra dört satırlık isim bloğu (gemi adı, karakter, kurum, ittifak) ve
sağda hasar ile sağ altta iki 32'lik logo. Bu bölüm beş değişiklik topluyor.

### Ölçüler

Bugünkü ölçü 96/48 üzerine kurulu: iki tane 48 üst üste gelip 96'lık portreyle
aynı yüksekliği tutuyor. 64/32 aynı ilişkiyi korur — iki 32, 64 eder.

| Yuva                        | Bugün                      | Sonra                    | Kaynak                   |
| --------------------------- | -------------------------- | ------------------------ | ------------------------ |
| Portre / kurum logosu / NPC | 96                         | 64                       | `?size=128` (2×, aynı)   |
| Gemi render                 | 48                         | 32                       | `?size=128` → `?size=64` |
| Silah ikonu                 | 48                         | 32                       | `?size=128` → `?size=64` |
| Bilinmiyor kutusu           | `size-12` + `w-8 h-8` ikon | `size-8` + `size-4` ikon | —                        |

NPC yuvası (`AttackerRow.tsx:73-79`) bugün 96×96 bir kutuda
`text-2xl font-bold text-red-500">NPC</span>` yazıyor; yerine `shipType`'ın
render'ı 64px'te geliyor. Bu, satırın **NPC rozetiyle** karıştırılmamalı
(`AttackerRow.tsx:153-157`): o bir `.tag` ve yerinde kalıyor. Kalkan şey
portre yuvasındaki iri yazı. Bu yuva karakteri de kurumu da olmayan saldıran için
çiziliyor ve `Killmail.graphql`'deki attacker bloğunda `faction` yok — yani
elde başka görsel zaten yok.

Yan etki: aynı render hemen sağındaki 32'lik gemi yuvasında da var, yani NPC
satırı gemisini iki ölçüde iki kez gösterir. 64'lük yuva "kim", 32'lik "hangi
gemi" ve NPC'de ikisi aynı şey olduğu için kabul ediliyor. Gözle bakıldıktan
sonra fazla gelirse alternatif tek satır: NPC satırında 32'lik gemi yuvasını
atlayıp yalnızca silahı bırakmak.

### FINAL BLOW ve TOP DAMAGE portreye taşınıyor

İki rozet isim bloğundaki rozet şeridinden çıkıp portrenin üstüne, ortalanmış
ve birkaç piksel içeriden konumlanıyor.

**Portre yuvası tek bir `relative` sarmalayıcıya alınıyor.** Bugün üç dalın
(karakter portresi `:36`, kurum logosu `:62`, NPC yuvası `:73`) her biri kendi
`relative shrink-0` div'ini yazıyor. Rozetin üçünde de çalışması için yuva tek
sarmalayıcı olur; dallar onun içinde yalnızca görseli seçer. Güvenlik durumu
rozeti (`absolute bottom-0 left-0`) de o sarmalayıcıya taşınır — bugün
yalnızca karakter dalında var.

**Rozet portreden geniş, öyle kalıyor.** "FINAL BLOW" 10 karakter,
`text-xs` + `px-2` ile kabaca 80px; portre 64px. Ortalanıp iki yandan ~8px
taşıyor, şerit gibi duruyor, etiket tam okunuyor. İkisi aynı anda
bulunabildiği için (bir saldıran hem son vuruşu yapıp hem en çok hasarı
verebilir) alt alta iki şerit olur ve portrenin üst yarısı kapanır. Kısaltma
(FB/TD) ve ikon alternatifleri elendi: anlamı yalnızca tooltip'e bırakıyorlar.

`isFinalBlow && !isSolo` koşulu olduğu gibi kalıyor — solo bir kayıpta bu iki
rozet bugün de çizilmiyor.

**SOLO ve NPC rozetleri yerinde kalıyor**, isim bloğundaki şeritte. Taşınması
istenen iki rozet bunlar değil.

### İttifak ve kurum logoları kalkıyor

Sağ alttaki 32'lik çift (`:236-266`) siliniyor. Aynı bilgi zaten isim bloğunda
yazıyla duruyor.

### İsim önceliği: ittifak, yoksa kurum

Bugün kurum adı (`:177-186` karakter dalında, `:198-206` NPC dalında) ve
ittifak adı (`:210-221`) ayrı ayrı, ikisi birden çiziliyor. Yerine tek satır:
ittifak varsa ittifak adı, yoksa kurum adı. Karakter adı ve gemi adı yerinde.

İkisi birlikte satırdan iki isim satırı ve iki logo eksiltiyor; portrenin
96'dan 64'e inmesiyle birlikte satır belirgin şekilde alçalıyor, yani
`AttackersCard` aynı yükseklikte daha çok saldıran gösteriyor.

### `DMG` eki kalkıyor

`{attacker.damageDone.toLocaleString()} DMG` → yalnızca sayı. İki kopyası var
ve ikisinden de kalkıyor: `AttackerRow.tsx:229` ve
`FeaturedAttackerCard.tsx:113`. Altındaki yüzde satırı yerinde kalıyor.

Güvenlik durumu rozeti (`absolute bottom-0 left-0 ... text-xs`) 96 yerine 64px
portrenin üstünde duracak; `text-xs` artı dolgu ~20px, yani portrenin üçte
biri. Dar ama okunur; gözle bakılacak yerlerden biri.

## Dosya dosya

| Dosya                      | Değişiklik                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `globals.css`              | Üç anlam jetonu                                                                                                                                                                                                              |
| `cards.css`                | `.tag`                                                                                                                                                                                                                       |
| `ui/SummaryRow.tsx`        | Yeni, ~15 satır                                                                                                                                                                                                              |
| `ui/SummaryRow.spec.tsx`   | Yeni; `ui/Card.spec.tsx`'in kalıbı                                                                                                                                                                                           |
| `page.tsx`                 | Tek kart ikiye bölünür, `p-2` + `gap-2` (bkz. _Kart sınırı_); 7 satır → `SummaryRow`; kural 6; `bg-gray-800/50` → `bg-surface-inset`; 3× cyan; ISK jetonları; WAR KILL → `.tag`; ölü `victim-card` kalkar. ~362 → ~295 satır |
| `AttackersCard.tsx`        | Başlık barı `.card-header` olur, metni aynı kalır, anlamsız `hover:bg-surface-inset` gider; 3 el yazısı `.card-row`                                                                                                          |
| `KillmailSummaryCard.tsx`  | `'use client'`; `.card-band`'de filtre sekmeleri + görünüm seçici, `localStorage` tercihi; `:42` el yazısı `.card` → `card`; 3 satır → `SummaryRow`                                                                          |
| `FeaturedAttackerCard.tsx` | `DMG` eki kalkar; `text-md` → `text-base`; `inset-ring inset-ring-white/10` → `.card`'ın `border border-white/10`'u (içerik 1px kayar)                                                                                       |
| `FittingItem.tsx`          | Grid görünümünde dar hücre (fiyat `w-40` → `w-20`, `title`); tablo görünümünde bugünkü ölçüler; `bg-red-700/40` → `bg-destroyed/20`, hover `/30`; yeşil aynısı. Tonun gözle görülür değiştiği tek yer                        |
| `FittingSection.tsx`       | İki görünüm: bugünkü `flex flex-col divide-y` korunur, yanına `grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3` eklenir; filtre yüklemi; ölü `fitting-section` kalkar; değer/etiket skalası                                       |
| `FittingItem.tsx`          | Satır → grid hücresi: fiyat `w-40` → `w-20`, `title` özniteliği; `bg-red-700/40` → `bg-destroyed/20`, hover `/30`; yeşil aynısı. Tonun gözle görülür değiştiği tek yer                                                       |
| `FittingSection.tsx`       | `flex flex-col divide-y` → `grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3`; filtre yüklemi; ölü `fitting-section` kalkar; değer/etiket skalası                                                                                  |
| `FitScreen/*`              | İki `text-gray-500` skalaya girer, başka dokunuş yok                                                                                                                                                                         |

### Boşluk uyarısı

FitScreen ile özet arasındaki içerik mesafesi 24px'te sabit (3. karar), ama
içerik kart kenarına **yaklaşıyor**: bugün dıştaki kartın `p-6`'sı ikisinin
etrafını 24px sarıyor, sonrasında her kartın kendi `p-2`'si 8px sarıyor. Kart
kenarları bugün de sol kolonun tam genişliğinde, o hizalama değişmiyor;
değişen, içeriğin kenardan 24px yerine 8px içeride durması.

Gözle bakıldıktan sonra dolgu ayarlanmak istenirse iki sınıfla ayarlanır;
`p-2`/`gap-2` çifti birlikte değişmeli, yoksa 24px bozulur.

## Kapsam dışı

**Aynı üç ISK değeri sayfada iki kez çiziliyor.** `page.tsx`'te özet bloğun
altında (Destroyed / Dropped / Total, renkli) ve `KillmailSummaryCard.tsx:348-360`'ta
fitting listesinin altında (aynı üç etiket, renksiz); ikisi de aynı
`destroyedValue` / `droppedValue` / `totalValue` prop'larından besleniyor. Bu bir
dil sorunu değil, bilgi kurgusu sorunu — hangisinin kalacağı yerleşim kararı,
bu işin dışında. İkisi de olduğu yerde kalıp dile hizalanıyor. Kendi PR'ını
hak ediyor.

**SOLO ve NPC rozetleri satır başına değil killmail başına.** `AttackerRow.tsx:29-30`
ikisini de killmail'den okuyor (`killmail.solo`, `killmail.npc`), ama rozet her
saldıran satırında ayrı ayrı çiziliyor — yani NPC işaretli bir killmail'de o
rozet her satırda tekrar ediyor. Bu da bir gürültü kaynağı, ama giderilmesi
"rozeti nereye koyalım" sorusunu açıyor (kartın başlığı? hiç göstermeyelim mi?)
ve bu PR'ın taşıdığı karar sayısını aşıyor. Rozetler bu işte olduğu yerde
kalıp yalnızca `.tag` giyiyor.

**Distance alanı (en yakın gök cismi) kendi PR'ında.** Fizibilitesi bu oturumda
ölçüldü, sonuç: ucuz. Veriler yerinde — 95.648 / 95.781 kurbanın konumu var
(%99,86; 133 eksik) ve beş gök cismi tablosunun tamamı koordinatlı (~473.000
satır: 344k ay, 68k gezegen, 41k asteroit kuşağı, 14k yıldız geçidi, 5k
istasyon). Beşinde de `solar_system_id` indeksi var, sorgu beş Index Scan artı
~58 satırlık bir sıralama: **0,248 ms** ortalama sistemde, **0,3 ms** en
kalabalık sistemde (Aulbres, 158 gök cismi). Killmail'in konumu değişmediği ve
gök cisimleri statik olduğu için sonuç statik TTL'e (86400) uygun.

Yine de kendi işi: GraphQL şemasına alan, `redis.get` → `$queryRaw` →
`redis.setex` biçiminde bir okuma servisi, backend ve frontend codegen. Kendi
spec'inde çözülecek üç tasarım noktası: birim eşiği (km ↔ AU; mesafeler 6 km
ile milyonlarca km arasında geziniyor), konumu olmayan 133 killmail'de satırın
hiç çizilmemesi, ve yıldızın hesaba katılıp katılmayacağı — `stars` tablosunda
`position_*` sütunu yok, çünkü ESI vermiyor: yıldız tanım gereği sistemin
merkezinde.

Ayrıca bu işe katılmayanlar:

- `AttackersCard` (273 satır) ve `KillmailSummaryCard` (367 satır) bölünmeyi
  hak ediyor; ayrı bir iş.
- `FitScreen`'in `globals.css`'teki sabit 600×600 kabı.
- `.tag` söz dağarcığının uygulama geneline taranması: bu PR yalnızca bu
  sayfadaki 5 kopyayı toplar.

## Doğrulama

Bu iş artık yalnızca sınıf dizesi değil: iki bileşen ekliyor, bir bileşene
durum ve klavyeyle gezinme koyuyor, bir bölümün düzenini değiştiriyor. Yani
`test` ve `typecheck` asıl güvenceyi veren yer.

Yazılacak testler:

- `ui/SummaryRow.spec.tsx` — etiket ve değer doğru yerde, `ui/Card.spec.tsx`
  kalıbında.
- `KillmailSummaryCard.spec.tsx` — üç sekme çizilir; "Destroyed" seçiliyken
  yalnızca patlayan kalemler kalır ve Ship bloğu görünür; "Dropped" seçiliyken
  Ship gizlenir; kalemi kalmayan bölüm hiç çizilmez; alttaki üç ISK satırı
  sekmeden etkilenmez. Görünüm seçici: varsayılan grid; tabloya geçilince
  `localStorage`'a yazılır; saklanmış tercihle açılınca o görünüm uygulanır;
  filtre ile görünüm birbirinden bağımsız. `useTabList`'in kendi spec'i zaten
  var, ok tuşları orada kapsanıyor.

```bash
yarn workspace frontend typecheck     # tsc --noEmit
yarn workspace frontend test          # vitest run
yarn workspace frontend lint          # sayı main ile karşılaştırılır
yarn workspace frontend build:check   # NEXT_DIST_DIR=.next-check
npx prettier --check <dokunulan dosyalar>
```

`build:check`, `build` yerine: `NEXT_DIST_DIR=.next-check` ile çalışan dev
sunucusunun `.next` dizinini ezmiyor.

Kod yazmadan önce `node_modules/next/dist/docs/01-app` altındaki ilgili bölüm
okunur — `frontend/AGENTS.md` bunu şart koşuyor (Next 16.3.3).

**Görsel doğrulama kullanıcıya ait.** Tarayıcı sürülmez; teslimde hangi
sayfaya bakılacağı ve neyin değişmiş olması gerektiği yazılır.

## PR şekli

Tek PR. Dokunulan 15 dosyanın tamamı tek bir sayfanın parçası ve üç bileşen
ağacı yalnızca bu sayfadan kullanılıyor; bölmek incelemeyi kolaylaştırmaz,
yarım geçmiş bir dil bırakır.
