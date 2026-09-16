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

**Yerleşim değişmiyor.** Üç kolonluk grid, kolon genişlikleri, kartların
sırası, mobil davranış ve sayfadaki metinlerin hiçbiri bu işin konusu değil.
Değişen yalnızca yüzey, renk, boşluk ve söz dağarcığı. Tek istisna bir yüzey
sınırı: FitScreen ile kurban özeti ayrı kartlara bölünüyor (2. karar,
_Kart sınırı_ bölümü) — grid aynı kalıyor, kartın sınırı düzeliyor.

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
- İki ölü sınıf, ikisi de `cards.css`'te belgelenen `transition-color`
  vakasının aynı türü: `text-md` (`FeaturedAttackerCard.tsx:112`) Tailwind'de
  yok, `victim-card` (`page.tsx:79`) ise hiçbir CSS dosyasında tanımlı değil.
  İkisi de sessizce hiçbir şey yapmıyor.

## Kararlar

1. **Kapsam yalnızca dil.** Bilgi hiyerarşisi ve metinler değişmiyor; sayfada
   yeni bir metin belirmiyor. Kolonların sırası ve genişlikleri de aynı. Tek
   istisna aşağıdaki 2. karar: bir yüzey sınırı düzeliyor, yerleşim değil.
2. **FitScreen ile kurban özeti iki ayrı kart oluyor.** Bugün ikisi tek bir
   `.card`'ın (`page.tsx:75-76`) içindeki `grid ... gap-6`'da duruyor, yani
   aralarındaki boşluk o kartın kendi `bg-surface`'ini gösteriyor ve ikisi tek
   parça gibi okunuyor. `cards.css` bu ayrımı `.tab-shell` yorumunda zaten
   adlandırıyor: `.card` metin ve kontrol tutan **yaprak** yüzey için,
   kendi yüzeylerini tutan **çerçeve** için değil. Bugünkü kart bir çerçeve
   ama yaprak kıyafeti giymiş. İkiye bölününce aradaki `gap-6` `bg-ground`'u
   gösterir — `body` `bg-ground` (`layout.tsx:24`) ve `main`'in kendi zemini
   yok, o yüzden araya ayrıca bir zemin konmuyor.
3. **Kartlar başlıksız kalıyor.** Bugün başlığı olmayan bir kart başlık
   kazanmıyor. Zaten var olan başlıklar (`N ATTACKERS`, `Ship`, fitting bölüm
   adları) metinleriyle kalıyor, yalnızca dile hizalanıyor.
4. **Anlam renkleri jeton oluyor.** `globals.css`'teki `@theme` bloğuna üç
   jeton eklenir; aynı anlam tek bir değerde toplanır.
5. **Hasar da `destroyed` jetonunu kullanır.** Ayrı bir `--color-damage` aynı
   değerin ikinci adı olurdu; tek kırmızı, tek anlam: "bu taraf yok edildi".
6. **`SummaryRow` paylaşılan bir bileşen.** İki tüketicisi var, o yüzden
   `ui/` rafına giriyor — sayfa-yerel bir yardımcı değil.
7. **`cards.css` yalnızca `.tag` ile büyüyor.** Söz dağarcığına yeni sınıf
   eklemenin çıtası `cards.css`'in kendi yorumlarında yazılı ("bu dize altı
   kopyada vardı"); 5 kopyalık rozet bu çıtayı geçiyor, 10 kopyalık
   etiket/değer satırı ise bir React bileşeni olarak daha iyi karşılanıyor.
8. **`FitScreen`'in yuvalarına dokunulmuyor.** `bg-white/5` zemin olarak
   dilin dışında ama `.button-ghost` ve `.menu-row`'da meşru bir vurgu tonu;
   FitScreen kendi içinde tutarlı ve sayfanın en çok bakılan parçası.

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
/* Bir durum rozeti: FINAL BLOW, TOP DAMAGE, NPC, WAR KILL. Beş kopyada
   vardı ve dördü yarıçap taşıyordu; sayfada yarıçap alan tek şey .float.
   Rengi kendisi taşımaz — çağıran anlam jetonunu verir. */
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
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <div className="card card-body lg:col-span-2">…FitScreen…</div>
  <div className="card card-body lg:col-span-1">…özet…</div>
</div>
```

Kolon genişlikleri (2/3 + 1/3), sıra ve `gap-6` aynı; değişen tek şey
boşluğun altında ne olduğu. Grid'in kendi zemini olmadığı için boşluk
`bg-ground`'u gösterir ve iki kart ayrı okunur. Grid varsayılan olarak
`stretch` hizaladığından iki kart aynı yüksekliğe gelir.

`isStructure` dalının fazladan alt dolgusu (`pb-24`, bugün `px-6 pt-6 pb-24`)
artık yalnızca FitScreen kartına ait — özet kartını ilgilendirmiyordu, tek
kart olduğu için ona da uygulanıyordu.

## Altı kural

Dört ağaç bu kurallarla hizalanır:

| #   | Kural                                 | Uygulaması                                                              |
| --- | ------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Yüzey elle yazılmaz                   | `.card`, `.card-body`, `.card-row`, `.card-header` sınıfları kullanılır |
| 2   | Derinlik üç adım                      | `bg-gray-800`, `bg-gray-800/50` → `bg-surface-inset`                    |
| 3   | Aksan cyan                            | `hover:text-blue-400` → `hover:text-cyan-400` (8 yer)                   |
| 4   | Yarıçap yok                           | `AttackerRow`'daki 4 `rounded` kalkar; yarıçapı olan tek şey `.float`   |
| 5   | Anlam rengi jetondan                  | `text-red-400`/`bg-red-700/40` → `text-destroyed`/`bg-destroyed/20`     |
| 6   | Etiket ile değer aynı ağırlıkta olmaz | Etiket `text-gray-400`, değer `text-gray-100`                           |

Sayfadaki en görünür değişiklik son kural: bugün etiket de değer de
`text-gray-400` olduğu için özet blok tek düz bir yüzey gibi okunuyor. Ayrıca
`text-gray-300` ile `text-gray-400` bu ağaçta aynı işi iki değerde yapıyor;
ikisi de skalaya girer.

## Dosya dosya

| Dosya                      | Değişiklik                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `globals.css`              | Üç anlam jetonu                                                                                                                                                                                             |
| `cards.css`                | `.tag`                                                                                                                                                                                                      |
| `ui/SummaryRow.tsx`        | Yeni, ~15 satır                                                                                                                                                                                             |
| `ui/SummaryRow.spec.tsx`   | Yeni; `ui/Card.spec.tsx`'in kalıbı                                                                                                                                                                          |
| `page.tsx`                 | Tek kart ikiye bölünür (bkz. _Kart sınırı_); 7 satır → `SummaryRow`; kural 6; `bg-gray-800/50` → `bg-surface-inset`; 3× cyan; ISK jetonları; WAR KILL → `.tag`; ölü `victim-card` kalkar. ~362 → ~295 satır |
| `AttackersCard.tsx`        | Başlık barı `.card-header` olur, metni aynı kalır, anlamsız `hover:bg-surface-inset` gider; 3 el yazısı `.card-row`                                                                                         |
| `AttackerRow.tsx`          | 4 rozet → `.tag`; `bg-gray-800` → `bg-surface-inset`; el yazısı `.card-row`; 4× cyan                                                                                                                        |
| `FeaturedAttackerCard.tsx` | `text-md` → `text-base`; `inset-ring inset-ring-white/10` → `.card`'ın `border border-white/10`'u (içerik 1px kayar)                                                                                        |
| `KillmailSummaryCard.tsx`  | `:42` el yazısı `.card` → `card`; 3 satır → `SummaryRow`                                                                                                                                                    |
| `FittingItem.tsx`          | `bg-red-700/40` → `bg-destroyed/20`, hover `/30`; yeşil aynısı. Tonun gözle görülür değiştiği tek yer                                                                                                       |
| `FittingSection.tsx`       | Değer/etiket skalası                                                                                                                                                                                        |
| `FitScreen/*`              | İki `text-gray-500` skalaya girer, başka dokunuş yok                                                                                                                                                        |

### Boşluk uyarısı

Kural 1 gereği kart içi dolgu `.card-body`'ye geçiyor ve o `p-4`. Sayfa bugün
kendi `p-6`'sını yazıyor, yani kartların iç boşluğu bir adım daralıyor. Kart
sınırı bölünmesiyle birlikte bu, FitScreen ile özet arasındaki toplam mesafeyi
artırıyor: bugün tek kartın içinde `p-6` + `gap-6` + `p-6` var; sonrasında iki
ayrı `p-4`, aralarında zemin gören `gap-6` ve iki kenarlık olacak. Gözle
bakıldıktan sonra dolgu geri istenirse bir sınıfla geri gelir.

## Kapsam dışı

**Aynı üç ISK değeri sayfada iki kez çiziliyor.** `page.tsx`'te özet bloğun
altında (Destroyed / Dropped / Total, renkli) ve `KillmailSummaryCard.tsx:348-360`'ta
fitting listesinin altında (aynı üç etiket, renksiz); ikisi de aynı
`destroyedValue` / `droppedValue` / `totalValue` prop'larından besleniyor. Bu bir
dil sorunu değil, bilgi kurgusu sorunu — hangisinin kalacağı yerleşim kararı,
bu işin dışında. İkisi de olduğu yerde kalıp dile hizalanıyor. Kendi PR'ını
hak ediyor.

Ayrıca bu işe katılmayanlar:

- `AttackersCard` (273 satır) ve `KillmailSummaryCard` (367 satır) bölünmeyi
  hak ediyor; ayrı bir iş.
- `FitScreen`'in `globals.css`'teki sabit 600×600 kabı.
- `.tag` söz dağarcığının uygulama geneline taranması: bu PR yalnızca bu
  sayfadaki 5 kopyayı toplar.

## Doğrulama

Bu iş çoğunlukla sınıf dizesi, ama bir bileşen ekliyor ve TSX yapısına
dokunuyor — `typecheck` ve `test` gerçekten iş görüyor.

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

Tek PR. Dokunulan 13 dosyanın tamamı tek bir sayfanın parçası ve üç bileşen
ağacı yalnızca bu sayfadan kullanılıyor; bölmek incelemeyi kolaylaştırmaz,
yarım geçmiş bir dil bırakır.
