# Buton Göçü (Uygulama Planı)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `todo.md` maddeleri 4 ve 5 — uygulamadaki 68 butonun tamamını, bir önceki PR'da tanımlanan CSS sözlüğüne taşımak.

**Architecture:** Sözlük hazır ve bu planda değişmiyor; yalnızca çağrı noktaları ona bağlanıyor. Seçili ve basılı durumlar sınıf ternary'sinden ARIA özniteliklerine geçiyor, böylece görünüm ile ekran okuyucunun duyduğu şey birbirinden ayrı düşemiyor.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-05-tasarim-sistemi-design.md` §4 — merge öncesi silindi, `git show 139cfefa^:docs/superpowers/specs/2026-09-05-tasarim-sistemi-design.md` ile okunur.

## Global Constraints

- **Yarn, asla npm.** `yarn workspace frontend <script>`.
- **`build` çalıştırma** — `yarn kill` ile 3000 portunu, yani kullanıcının dev sunucusunu öldürüyor. Controller PR sonunda bir kez çalıştırır.
- Ara doğrulama: `typecheck`, `lint`, `test`.
- **Kod yorumları ve string literal'leri İngilizce.**
- **Radius yok.** Sayfada duran hiçbir şey radius almaz; yol üstünde `rounded`, `rounded-md`, `rounded-xl` görürsen sil. `rounded-full` istisna — o biçim değil şekil (avatar, durum noktası).
- Yalnızca görevin dosyalarını stage'le. `yarn.lock` ve `todo.md` asla.
- Commit: İngilizce, `type(scope):` sonrası küçük harf, attribution yok.
- Üretilen dosyalara dokunma: `frontend/src/generated/graphql.ts`.

## Sözlük — değişmez, sadece tüketilir

```
.button              yapı; her buton alır
.button-primary      accent dolgu
.button-secondary    yüzey zemini + hairline
.button-ghost        zeminsiz, hover'da white/5
.button-danger       kırmızı
.button-icon         kare dolgu          (değiştirici)
.button-sm           px-3 py-1 text-xs   (değiştirici)
.button-block        tam genişlik        (değiştirici)
.tab                 alt çizgili sekme; .tab[aria-selected='true'] seçili hâli verir
.menu-row            buton etiketli liste satırı
```

Değiştirici tek başına kullanılmaz: `button button-secondary button-icon`.

---

### Task 1: İkon-only butonlar (23)

**Files:**

- `app/leaderboards/page.tsx:253`
- `app/leaderboards/page.tsx:275`
- `app/leaderboards/page.tsx:340`
- `app/leaderboards/page.tsx:355`
- `app/leaderboards/page.tsx:471`
- `app/leaderboards/page.tsx:486`
- `components/Filters/KillmailFilters.tsx:768`
- `components/Filters/KillmailFilters.tsx:897`
- `components/Filters/KillmailFilters.tsx:1021`
- `components/Filters/KillmailFilters.tsx:1165`
- `components/Filters/KillmailFilters.tsx:1293`
- `components/Filters/KillmailFilters.tsx:1426`
- `components/Filters/SolarSystemFilters.tsx:442`
- `components/Filters/SolarSystemFilters.tsx:483`
- `components/Filters/SolarSystemFilters.tsx:534`
- `components/KillmailToast/KillmailToast.tsx:147`
- `components/MostValuableCarousel/MostValuableCarousel.tsx:150`
- `components/MostValuableCarousel/MostValuableCarousel.tsx:162`
- `components/Paginator/Paginator.tsx:45`
- `components/Paginator/Paginator.tsx:57`
- `components/Paginator/Paginator.tsx:69`
- `components/Paginator/Paginator.tsx:81`
- `components/ui/FilterDialog.tsx:42`

- [ ] **Step 1: Her birini oku ve ayır**

Bunlar ikon taşıyan, metinsiz butonlar. İkiye ayrılıyorlar ve ayrımı **okuyarak** yapman gerekiyor — grep güvenilir ayırmıyor:

- Kenarlık taşıyanlar (`border border-white/10` gibi) → `button button-secondary button-icon`
- Kenarlıksız, yalnızca hover zemini olanlar → `button button-ghost button-icon`

Dolgu (`p-1`, `p-2`, `p-2.5`) `.button-icon`'a devrediliyor, satır içinde kalmıyor. `-m-2.5` gibi negatif marjlar **kalıyor** — onlar yerleşim, görünüm değil. Yol üstünde `rounded-md` görürsen sil.

`aria-label` taşımayan varsa ekle: ikon-only bir butonun erişilebilir adı başka türlü oluşmuyor.

- [ ] **Step 2: Doğrula**

Run: `yarn workspace frontend typecheck && yarn workspace frontend lint && yarn workspace frontend test`
Expected: typecheck 0 hata; lint 245'i geçmiyor; 173 test geçiyor.

- [ ] **Step 3: Commit**

`refactor(frontend): move the icon buttons onto the vocabulary`

---

### Task 2: Menü satırları (12)

**Files:**

- `components/AttackersCard/AttackersCard.tsx:147`
- `components/AttackersCard/AttackersCard.tsx:158`
- `components/Filters/AllianceFilters.tsx:169`
- `components/Filters/CharacterFilters.tsx:164`
- `components/Filters/CorporationFilters.tsx:170`
- `components/Filters/KillmailFilters.tsx:693`
- `components/Filters/KillmailFilters.tsx:834`
- `components/Filters/KillmailFilters.tsx:966`
- `components/Filters/KillmailFilters.tsx:1103`
- `components/Filters/KillmailFilters.tsx:1238`
- `components/Filters/KillmailFilters.tsx:1360`
- `components/Filters/SolarSystemFilters.tsx:380`

- [ ] **Step 1: `.menu-row`'a taşı**

Bunlar `<button>` etiketi taşıyor ama görsel olarak buton değil — panel ve liste satırları. `.menu-row` şunu veriyor: `relative flex items-center w-full gap-x-3 p-3 text-sm/6 transition-colors hover:bg-cyan-900/50`.

**Dikkat:** `group` sınıfı `@apply` içinde yaşayamaz, bu yüzden `.menu-row` onu taşımıyor. Bir satır `group` taşıyorsa ve içinde `group-hover:` kullanan bir çocuk varsa, `group` çağrı noktasında kalmalı: `className="menu-row group"`. Silersen o çocuğun hover'ı sessizce ölür.

Hover rengi farklı olan (`hover:bg-white/5` gibi) satırlar varsa **sınıfı zorlama** — raporunda listele, controller karar verir.

- [ ] **Step 2: Doğrula ve commit**

Aynı üç komut. `refactor(frontend): move the panel rows onto menu-row`

---

### Task 3: Sekmeler (6) — ARIA ile

**Files:**

- `app/alliances/[id]/page.tsx:359`
- `app/characters/[id]/page.tsx:336`
- `app/constellations/[id]/page.tsx:141`
- `app/corporations/[id]/page.tsx:381`
- `app/regions/[id]/page.tsx:129`
- `app/solar-systems/[id]/page.tsx:236`

- [ ] **Step 1: Her sekme çubuğunu oku**

Altı detay sayfası da aynı deseni ayrı ayrı yazmış: `activeTab === tab.id` ternary'si ile `border-cyan-500 text-cyan-500` / `border-transparent text-gray-400`.

- [ ] **Step 2: `.tab` artı ARIA**

Her buton şu hâle gelir:

```tsx
<button
  role="tab"
  aria-selected={activeTab === tab.id}
  className="tab"
  onClick={handler}
>
```

Koşullu className tamamen kalkar — seçili görünümü `.tab[aria-selected='true']` veriyor. Sekmeleri saran elemana `role="tablist"` ekle.

**Bilinen görsel değişiklik, kullanıcı onayladı:** seçili sekmenin yazısı `text-cyan-500`'den `text-white`'a, alt çizgisi `border-cyan-500`'den `border-accent`'e (cyan-600) geçiyor.

- [ ] **Step 3: Doğrula ve commit**

`refactor(frontend): drive the detail page tabs from aria-selected`

---

### Task 4: Segment seçiciler (4) — ARIA ile

**Files:**

- `components/AllianceGrowthChart/AllianceGrowthChart.tsx:224`
- `components/CorporationGrowthChart/CorporationGrowthChart.tsx:181`
- `components/MostValuableCarousel/MostValuableCarousel.tsx:131`
- `components/SystemActivityChart/SystemActivityChart.tsx:91`

- [ ] **Step 1: `aria-pressed` ile boyat**

Üç grafiğin aralık seçicisi ve carousel'in kapsam sekmeleri. Hepsi bugün ternary ile boyanıyor.

Grafik seçicileri bir grup içinde tek seçim yapıyor, `aria-pressed` doğru öznitelik:

```tsx
<button aria-pressed={range === r} className="button button-ghost button-sm" onClick={handler}>
```

`MostValuableCarousel` **istisna**: zaten `role="tab"` ve `aria-selected` taşıyor, ona `aria-pressed` ekleme. Yalnızca koşullu className'i sil ve `className="button button-ghost button-sm"` bırak — seçili hâli `.button-ghost[aria-selected='true']` veriyor.

- [ ] **Step 2: Doğrula ve commit**

`refactor(frontend): drive the range selectors from aria-pressed`

---

### Task 5: Kalan 12 buton

**Files:**

- `app/killmails/[id]/page.tsx:113`
- `app/sovereignty/history/page.tsx:258`
- `app/sovereignty/history/page.tsx:269`
- `app/workers/page.tsx:85`
- `components/AuthButton/AuthButton.tsx:48`
- `components/AuthButton/AuthButton.tsx:59`
- `components/Header/Header.tsx:66`
- `components/Header/Header.tsx:199`
- `components/Notifications/NotificationBell.tsx:57`
- `components/Sovereignty/AlertToast.tsx:44`
- `app/auth/success/page.tsx:98`
- `app/auth/success/page.tsx:203`

- [ ] **Step 1: Her birini eşle**

| Ne                                      | Nereye                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `AuthButton` giriş (`bg-cyan-600/80`)   | `button button-primary`                                                                 |
| `AuthButton` çıkış (`bg-red-600/80`)    | `button button-danger`                                                                  |
| `workers/page.tsx` (`bg-blue-600`)      | `button button-primary`                                                                 |
| `auth/success` amber gradient, 2 adet   | `button button-primary`; gradient, `rounded-xl`, `shadow-lg` ve `hover:scale-105` gider |
| `sovereignty/history` sayfalama, 2 adet | `button button-secondary button-sm`                                                     |
| `killmails/[id]` satır 113              | `button button-secondary button-sm`; `rounded` gider                                    |
| `NotificationBell` "Clear"              | `button button-ghost button-sm`                                                         |
| `AlertToast` kapat                      | `button button-ghost button-icon`                                                       |
| `Header` hamburger ve kapat, 2 adet     | `button button-ghost button-icon`; `rounded-md` gider, `-m-2.5` kalır                   |

Amber CTA'nın sözlüğe indirilmesi kullanıcıyla kararlaştırıldı: tek bir sayfa uğruna sistemin dışında ikinci bir dil taşımaya değmiyor.

- [ ] **Step 2: Son envanter**

Run: `grep -rn '<button' frontend/src --include='*.tsx' | wc -l`
Expected: 68 — bu plan buton eklemiyor ve silmiyor.

Sonra sözlük sınıfı taşımayan buton kalmadığını doğrula. Kalan varsa raporunda listele, kendi kafana göre eşleme.

- [ ] **Step 3: Doğrula ve commit**

`refactor(frontend): move the remaining buttons onto the vocabulary`

---

## Doğrulama

Her görev `typecheck`, `lint`, `test` ile kapanır. `build` yalnızca controller tarafından, PR sonunda, kullanıcıya haber verilerek.

Görsel kontrol kullanıcıda. Bakılacaklar: altı detay sayfasının sekme çubuğu (seçili sekme beyazlaşıyor, alt çizgi bir ton koyulaşıyor), üç grafiğin aralık seçicisi, giriş sonrası `auth/success` sayfası (gradient gidiyor), header'ın mobil hamburger'ı.

## Öz-inceleme

**Kapsam.** 68 butonun tamamı hesapta: 11'i önceki PR'da geçti, 57'si burada (23 + 12 + 6 + 4 + 12).

**Spec'ten sapma.** Spec §4.4 menü satırlarını 3 diye sayıyordu; gerçek sayı 12. Sözlük değişmiyor, yalnızca `.menu-row`'un kapsamı beklenenden geniş. İkon-only grubu da spec'te ayrı sayılmamıştı, 23 tane.

**Bilinen zayıflık.** Task 1 ve 2, hangi butonun hangi varyanta gideceğini okumaya bırakıyor; kenarlık taşıyıp taşımadığı grep'le güvenilir ayrılmıyor. Ayrım kuralı her iki adımda da açıkça yazılı.

---

### Task 6: Filtre çipleri — içeriği kadar, butonu içinde, radyosu yanında

Kullanıcı isteği, iki parçalı. Bugün çip satırın tamamını kaplıyor (`flex-1`), kapatma
butonu onun **dışında** kardeş eleman olarak duruyor, ve varsa radyo grubu **altına**
iniyor. Olması gereken: çip içeriği kadar yer kaplasın, butonunu içinde taşısın, radyo
grubu da yanına gelsin.

**Envanter — 9 çip, iki tür.** Sayı ve tür ölçüldü, tahmin değil.

Çip **artı RadioGroup** (4):

- `frontend/src/components/Filters/KillmailFilters.tsx:754` — karakter
- `frontend/src/components/Filters/KillmailFilters.tsx:884` — gemi
- `frontend/src/components/Filters/KillmailFilters.tsx:1018` — gemi grubu
- `frontend/src/components/Filters/KillmailFilters.tsx:1426` — takımyıldız

Yalnız çip (5):

- `frontend/src/components/Filters/KillmailFilters.tsx:1163`
- `frontend/src/components/Filters/KillmailFilters.tsx:1292`
- `frontend/src/components/Filters/SolarSystemFilters.tsx:437`
- `frontend/src/components/Filters/SolarSystemFilters.tsx:479`
- `frontend/src/components/Filters/SolarSystemFilters.tsx:530`

Zeminleri üç ayrı renk: `bg-purple-900/30` (6), `bg-gray-700/50` (2), `bg-blue-900/30` (1).
Kullanıcı doğruladı: **renkler anlam taşımıyor**, filtrenin türünü kodlamıyorlar. Hepsi
nötrleşiyor.

- [ ] **Step 1: `.chip`'i `cards.css`'e ekle**

```css
/* A selected-filter chip: hugs its label and holds its own remove button.
   The three grounds it used to carry (purple, blue, grey) meant nothing —
   the user confirmed they were not a code for the filter's type. */
.chip {
  @apply inline-flex items-center gap-2 py-1 pl-2 pr-1 text-sm text-white bg-surface-inset;
}
```

- [ ] **Step 2: Yalnız çipleri (5) yeniden kur**

Bugün — `flex-1` ile tam genişlik, buton dışarıda:

```tsx
<div className="flex items-center gap-2">
  <div className="flex items-center flex-1 gap-2 px-3 py-2 text-sm text-white bg-purple-900/30">
    <span className="font-semibold truncate">{name}</span>
  </div>
  <button
    onClick={remove}
    className="button button-ghost button-icon"
    aria-label="..."
  >
    <XMarkIcon className="w-4 h-4" />
  </button>
</div>
```

Olması gereken — tek eleman, içeriği kadar, buton içinde:

```tsx
<span className="chip">
  <span className="font-semibold truncate">{name}</span>
  <button onClick={remove} className="button button-ghost p-1" aria-label="...">
    <XMarkIcon className="w-4 h-4" />
  </button>
</span>
```

`flex-1` gidiyor, saran `<div>` gereksizleşiyorsa kalkıyor. `.button-icon` yerine `p-1`:
`p-2` çipin içinde fazla şişiriyor. **`aria-label`'lar aynen korunuyor**, önceki görevde
eklendiler.

- [ ] **Step 3: Çip artı RadioGroup olan 4'ünü ikiye böl**

Bugün ikisi alt alta — dış kap `flex-col`:

```tsx
<div className="flex flex-col gap-2 mt-3">
  <div className="flex items-center gap-2">
    <div className="... flex-1 ... bg-gray-700/50">
      <img ... />
      <span className="font-semibold truncate">{shipTypeName}</span>
    </div>
    <button ...>X</button>
  </div>
  <RadioGroup name="ship-type-role" value={shipRole} onChange={setShipRole} options={...} />
</div>
```

Olması gereken — tek satır, solda çip, sağda radyolar:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3 mt-3">
  <span className="chip">
    <img ... />
    <span className="font-semibold truncate">{shipTypeName}</span>
    <button ...>X</button>
  </span>
  <RadioGroup name="ship-type-role" value={shipRole} onChange={setShipRole} options={...} />
</div>
```

`flex-col` yerine `flex-wrap items-center justify-between`: dar ekranda ikisi yan yana
sığmazsa radyolar alt satıra geçer, sığdığı sürece karşılıklı dururlar. `RadioGroup`
bileşenine dokunma — prop'ları ve davranışı aynen kalıyor.

Çipin içindeki `<img>` de kalıyor; `size-8` gibi boyut sınıfları yerleşim, `.chip` onlara
karışmıyor.

- [ ] **Step 4: Doğrula ve commit**

`yarn workspace frontend typecheck && lint && test`. Ardından
`yarn workspace frontend build:check` ile `.chip` kuralının üretilen CSS'e girdiğini
doğrula. Dokuz çipin hiçbirinde `flex-1`, `bg-purple-900/30`, `bg-blue-900/30` veya
`bg-gray-700/50` kalmamalı.

Commit: `feat(frontend): let the filter chips hug their content`

---

### Task 7: Kalan indigo cepleri

`RadioGroup` ve `Checkbox` hâlâ indigo kullanıyor — birincil rengin son iki cebi. Advanced Filter'da altı yerde görünüyorlar.

**Files:**

- `frontend/src/components/RadioGroup/RadioGroup.tsx` — `bg-indigo-500`, `border-indigo-500`, `outline-indigo-500`
- `frontend/src/components/Checkbox/Checkbox.tsx` — beş `indigo-500` kullanımı

- [ ] **Step 1: `accent`'e çevir**

`bg-indigo-500` → `bg-accent`, `border-indigo-500` → `border-accent`, `outline-indigo-500` → `outline-accent`. `checked:` ve `indeterminate:` varyantları dahil.

- [ ] **Step 2: Uygulamada indigo kalmadığını doğrula**

Run: `grep -rn "indigo" frontend/src --include='*.tsx' --include='*.css' | wc -l`
Expected: 0

- [ ] **Step 3: Doğrula ve commit**

Commit: `refactor(frontend): move the radio and checkbox onto the accent`

---

### Task 8: Sekme ARIA'sını tamamla

Task 3 altı sayfaya `role="tab"` ve `aria-selected` koydu, ama hiçbiri bir panele bağlı değil ve ok tuşu gezinmesi yok. Yarım ARIA hiç ARIA'dan kötü olabilir: ekran okuyucu "sekme, 4'ün 1'i, seçili" diye duyuruyor, kullanıcı ok tuşuna basıyor, hiçbir şey olmuyor. `role="tab"` bir vaat; verildiyse tutulmalı.

**Files** — altı detay sayfası, toplam 27 koşullu panel bloğu:

- `frontend/src/app/alliances/[id]/page.tsx` (7 blok)
- `frontend/src/app/corporations/[id]/page.tsx` (6 blok)
- `frontend/src/app/solar-systems/[id]/page.tsx` (6 blok)
- `frontend/src/app/characters/[id]/page.tsx` (4 blok)
- `frontend/src/app/regions/[id]/page.tsx` (2 blok)
- `frontend/src/app/constellations/[id]/page.tsx` (2 blok)

- [ ] **Step 1: Sekme ve panelleri birbirine bağla**

Paneller bugün `{activeTab === 'overview' && (...)}` şeklinde koşullu bloklar; kararlı bir eleman ve `id`'leri yok. Her biri sarılır:

```tsx
{
  activeTab === 'overview' && (
    <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
      ...
    </div>
  );
}
```

Her sekme butonu da karşılığını alır:

```tsx
<button
  role="tab"
  id={`tab-${tab.id}`}
  aria-controls={`panel-${tab.id}`}
  aria-selected={activeTab === tab.id}
  className="tab"
>
```

`id`'ler sayfa içinde benzersiz olmalı. Sayfada başka bir `id` çakışması var mı diye bak.

- [ ] **Step 2: Ok tuşu gezinmesi**

`role="tablist"` bir etkileşim modeli vaat ediyor: sol/sağ ok seçimi taşır, `Home`/`End` uçlara gider. Seçili olmayan sekmeler `tabIndex={-1}` alır, seçili olan `0` — yani `Tab` tuşu çubuğa bir kez girer, içinde oklarla gezilir (roving tabindex).

Altı sayfa aynı mantığı yazmasın: ortak bir kanca çıkar, `frontend/src/hooks/useTabList.ts`. Mevcut kanca stilini görmek için `frontend/src/hooks/useDebounce.ts`'e bak.

- [ ] **Step 3: Kancanın testi**

`frontend/src/hooks/useTabList.spec.ts` — sağ ok bir sonrakine geçiyor, son sekmede başa dönüyor, `Home` ilkine gidiyor. `useDebounce.spec.ts` ev stilini gösteriyor.

- [ ] **Step 4: Doğrula ve commit**

`typecheck`, `lint`, `test` — test sayısı eklediğin kadar artmalı. Commit: `feat(frontend): finish the tab aria on the detail pages`
