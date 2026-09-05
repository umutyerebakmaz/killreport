# Tasarım Sistemi — Temel ve Sözlük (Uygulama Planı)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasarım sisteminin temelini (token'lar + tipografi) ve sözlüğünü (buton, sekme, girdi, kart, cam katman sınıfları) kurmak — 111 dosyalık uygulama göçünün üstüne yazılacağı zemin.

**Architecture:** İki PR. Birincisi `@theme` token'larını ve InterVariable'ı yerleştirir; tek başına görünür bir değişiklik yapar (font + sayfa zemini). İkincisi CSS bileşen sınıflarını tanımlar ve **her sınıfı aynı PR içinde en az bir gerçek kullanıcıya bağlar**, böylece kimsenin kullanmadığı CSS ortada kalmaz. Renk kararları `@theme` token'ında, görünüm kararları `@apply` ile CSS sınıfında toplanır.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, `next/font/local`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-05-tasarim-sistemi-design.md`

## Global Constraints

- **Yarn, asla npm.** `yarn workspace frontend <script>`.
- **`yarn workspace frontend build` çalıştırma** — `build` scripti `yarn kill` ile 3000 portunu öldürüyor, kullanıcının dev sunucusunu düşürür. Her PR'ın **en sonunda bir kez**, kullanıcıya haber vererek.
- Ara doğrulama: `yarn workspace frontend typecheck`, `lint`, `test`.
- **Üretilen dosyalara dokunma:** `frontend/src/generated/graphql.ts`.
- **Radius kuralı:** sayfada duran hiçbir şey radius almaz. Yalnızca `.float` `rounded-md` alır.
- **Semantik renkler kapsam dışı:** `utils/securityStatus.ts` ve `utils/security.ts` içindeki renkler değişmez.
- **`rounded-full` kapsam dışı:** 52 kullanım; avatar ve durum noktaları, stil kararı değil.
- **Commit mesajları İngilizce**, `type(scope): küçük harfle başlayan özet`. Claude attribution yok.
- **Kod yorumları İngilizce.** `CLAUDE.md`: GitHub'a giden her şey — yorumlar dahil — İngilizce.
  Bu plan ve spec Türkçe, ama içlerindeki kod blokları İngilizce yorum taşır.
- Görsel doğrulama kullanıcıda. Bu plandaki hiçbir adım tarayıcı açmaz.

---

## Bu planın kapsamı

Spec §9'daki yedi PR'ın **ilk ikisi**. Kalan beşi (butonların, sekmelerin, girdilerin, 249 satır içi zeminin, cam katmanın ve görsel ölçeğinin göçü) sözlük incelemeden geçtikten sonra kendi planını alır.

Sebebi spec'in kendi gerekçesi: _"1 ve 2 onaylanmadan 3-6'yı yazmak, sözlük değişirse hepsini yeniden yazmak demek."_ Bir `.button-secondary` tanımı incelemede değişirse, ona dayanan 68 çağrı noktasının adım adım planı çöpe gider.

### Spec'ten iki sapma

**1. `.card` göçü PR 2'ye alındı.** Spec §9 kart sınıflarının tanımını PR 2'ye, kullanımını PR 5'e koyuyordu. Ölçüm bunu gereksiz kıldı: silinecek sekiz sınıftan **ikisinin hiç kullanıcısı yok** (`items-card`, `corporation-detail-card`), kalan altısının toplam **8 çağrı noktası** var. Altı satır, PR 2'nin içinde biter ve `.card` kullanıcısız kalmaz.

**2. `FilterBar`'ın `aria-pressed`'i PR 2'ye alındı.** Spec §9 bunu PR 3'e koyuyordu. Tek bir öznitelik ve tek bir className değişikliği; PR 2'ye alınınca `.button[aria-pressed='true']` kuralı yazıldığı anda gerçek bir kullanıcıya bağlanıyor ve test edilebiliyor.

İkisi de aynı ilkeden: **hiçbir CSS kuralı kullanıcısı olmadan merge edilmez.**

---

## Dosya yapısı

### PR 1 — Temel

| Dosya                                                      | Sorumluluk                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `frontend/src/fonts/inter.ts` _(yeni)_                     | `next/font/local` tanımı. Roman ve italik yüzleri tek yerde.          |
| `frontend/src/fonts/InterVariable.woff2` _(mevcut)_        | Zaten commit'li (`323f7321`).                                         |
| `frontend/src/fonts/InterVariable-Italic.woff2` _(mevcut)_ | Zaten commit'li.                                                      |
| `frontend/src/app/globals.css`                             | `@theme` bloğu; Mona Sans `@import`'u ve `fonts.css` import'u kalkar. |
| `frontend/src/app/fonts.css` _(silinir)_                   | 162 satır Shentox `@font-face`.                                       |
| `frontend/public/fonts/shentox/` _(silinir)_               | 56 dosya, 5.9 MB.                                                     |
| `frontend/src/app/layout.tsx`                              | Font değişkeni `<html>`'e; `bg-black` → `bg-ground`.                  |

### PR 2 — Sözlük

| Dosya                                                    | Sorumluluk                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `frontend/src/app/buttons.css`                           | `.button` ailesi ve `.tab`. Tek sorumluluk: tıklanabilir şeylerin görünümü. |
| `frontend/src/app/inputs.css`                            | `.input`, `.search-input`, ve `globals.css`'ten taşınan `.select` ailesi.   |
| `frontend/src/app/cards.css` _(yeni)_                    | `.card`, `.card-header`, `.card-body`, `.float`, `.menu-row`. Yüzeyler.     |
| `frontend/src/app/tables.css`                            | `.table` kendi zeminini bırakır.                                            |
| `frontend/src/app/globals.css`                           | `cards.css` import'u; `.select` ailesi ve 8 kart sınıfı çıkar.              |
| `frontend/src/components/ui/Card.tsx`                    | `header` slotu.                                                             |
| `frontend/src/components/ui/Card.spec.tsx` _(yeni)_      | Header'ın kart yüzeyinin **içinde** olduğunun testi — madde 8'in kanıtı.    |
| `frontend/src/components/ui/FilterBar.tsx`               | `aria-pressed`; `active-filter-button` className'i kalkar.                  |
| `frontend/src/components/ui/FilterBar.spec.tsx` _(yeni)_ | Rozet taşıyan butonun `aria-pressed` aldığının testi.                       |
| 6 çağrı noktası                                          | `*-detail-card` sınıfları → `.card`.                                        |

**Sıra kuralı — CSS'te önemli:** `.button-icon` ve `.button-sm`, `.button`'ın dolgusunu ezer ve ikisi de tek sınıf özgüllüğünde (0,1,0). Kazananı kaynak sırası belirler, bu yüzden **değiştiriciler dosyada görünüm varyantlarından sonra gelmeli.**

---

# PR 1 — Temel

### Task 1: Shentox'tan InterVariable'a geçiş

**Files:**

- Create: `frontend/src/fonts/inter.ts`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/globals.css:1-16`
- Delete: `frontend/src/app/fonts.css`
- Delete: `frontend/public/fonts/shentox/` (56 dosya)

**Interfaces:**

- Produces: `inter` — `next/font/local` dönüşü. `inter.variable` CSS sınıf adını verir (`--font-inter` değişkenini tanımlar). Task 2 `@theme` içinde `var(--font-inter)` olarak tüketir.

- [ ] **Step 1: Font modülünü yaz**

`frontend/src/fonts/inter.ts`:

```ts
import localFont from 'next/font/local';

/**
 * InterVariable, the face Tailwind Plus self-hosts (rsms.me, v4.66).
 *
 * Both faces are needed: the app sets `italic` in six places, and with the
 * roman alone the browser synthesises an oblique. One file covers every
 * weight because it is variable — Shentox needed 56.
 */
export const inter = localFont({
  src: [
    { path: './InterVariable.woff2', weight: '100 900', style: 'normal' },
    {
      path: './InterVariable-Italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
});
```

- [ ] **Step 2: `layout.tsx`'te `<html>`'e bağla**

`--font-inter`'in `:root` düzeyinde görünmesi gerekiyor, çünkü Task 2'de `@theme`'in ürettiği `--font-sans` onu `:root`'ta okuyacak. Bu yüzden sınıf `<body>`'ye değil `<html>`'e gider.

```tsx
import { inter } from '../fonts/inter';
```

```tsx
<html lang="en" className={inter.variable} suppressHydrationWarning>
```

- [ ] **Step 3: `globals.css`'i temizle**

Şu üç satır gider — ilki render-blocking bir dış istek, ikincisi artık boş olacak dosya, üçüncüsü Shentox'a bakan token:

```css
@import url('https://fonts.googleapis.com/css2?family=Mona+Sans:...'); /* satır 1 */
@import './fonts.css'; /* satır 4 */
```

`@theme` içindeki `--font-sans` ve `body`'deki `font-family` şimdilik olduğu gibi bırakılır; Task 2'de token bloğuyla birlikte yazılır. Bu adımda yalnızca iki `@import` silinir.

- [ ] **Step 4: Shentox'u sil**

```bash
git rm -r frontend/public/fonts/shentox
git rm frontend/src/app/fonts.css
```

- [ ] **Step 5: Hiçbir yerde Shentox kalmadığını doğrula**

Run: `cd /root/killreport && grep -rn "Shentox\|shentox\|Mona Sans" frontend/src frontend/public 2>/dev/null`
Expected: `globals.css` dışında hiçbir eşleşme yok (`--font-sans` ve `body` satırları Task 2'de temizlenecek).

- [ ] **Step 6: Typecheck ve lint**

Run: `yarn workspace frontend typecheck && yarn workspace frontend lint`
Expected: typecheck 0 hata; lint'in mevcut hata sayısı artmamış.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/fonts/inter.ts frontend/src/app/layout.tsx frontend/src/app/globals.css
git commit -m "feat(frontend): replace shentox with intervariable"
```

---

### Task 2: Token bloğu ve sayfa zemini

**Files:**

- Modify: `frontend/src/app/globals.css:6-20`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**

- Consumes: `--font-inter` (Task 1)
- Produces: `bg-ground`, `bg-surface`, `bg-surface-inset`, `bg-accent` yardımcı sınıfları ve `text-*` / `border-*` karşılıkları. PR 2'nin tamamı bunları `@apply` ile tüketir.

- [ ] **Step 1: `@theme` bloğunu yaz**

`globals.css`'teki mevcut `@theme` bloğunun yerine:

```css
@theme {
  /* Typography */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;

  /* Depth — three steps, no more. Four grounds are in use today
     (bg-white/5, neutral-900, neutral-800, stone-900) and nothing says
     which one means what. */
  --color-ground: var(--color-gray-950); /* the page */
  --color-surface: var(--color-gray-900); /* cards, tables, panels */
  --color-surface-inset: var(--color-gray-800); /* a box inside a card */

  /* Accent — the primary action fill. It sits in three separate
     pockets today: cyan, indigo and blue. */
  --color-accent: var(--color-cyan-600);
}
```

- [ ] **Step 2: `body`'nin sabit `font-family`'sini kaldır**

`globals.css`'te şu blok duruyor ve artık `--font-sans` ile çakışıyor:

```css
body {
  font-family: 'Shentox', 'Mona Sans', sans-serif;
  font-weight: 400;
}
```

`font-family` satırı silinir (`layout.tsx` zaten `font-sans` sınıfını taşıyor), `font-weight: 400` kalır:

```css
body {
  font-weight: 400;
}
```

- [ ] **Step 3: Sayfa zeminini token'a bağla**

`layout.tsx`'te `<body>` sınıfında `bg-black` → `bg-ground`.

Gerekçe yoruma yazılır, çünkü bu görünür bir değişiklik ve sebebi tasarım kararının kendisi:

```tsx
{
  /* Not pure black: with no shadows, the only thing telling a surface it
     sits above the page is being a shade lighter than it. On black, a
     gray-900 card barely separated. */
}
```

- [ ] **Step 4: Shentox kalıntısı kalmadığını doğrula**

Run: `grep -rn "Shentox\|Mona Sans" frontend/src`
Expected: hiçbir eşleşme.

- [ ] **Step 5: Typecheck, lint, test**

Run: `yarn workspace frontend typecheck && yarn workspace frontend lint && yarn workspace frontend test`
Expected: typecheck 0 hata; lint hatası artmamış; 167 test geçiyor.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/app/layout.tsx
git commit -m "feat(frontend): add the depth and accent theme tokens"
```

- [ ] **Step 7: PR 1'in tek build'i**

Kullanıcıya **önce haber ver** — bu komut dev sunucusunu düşürür.

Run: `yarn workspace frontend build`
Expected: derleme başarılı.

Sonra üretilen CSS'te token'ların gerçekten çıktığını doğrula:

Run: `grep -o '\-\-color-surface:[^;]*' frontend/.next/static/chunks/*.css | head -2`
Expected: `--color-surface:` ile başlayan en az bir eşleşme. Boş dönerse `@theme` bloğu Tailwind tarafından okunmamıştır.

---

# PR 2 — Sözlük

### Task 3: Buton ailesi

**Files:**

- Modify: `frontend/src/app/buttons.css` (tamamı yeniden yazılır)

**Interfaces:**

- Consumes: `bg-accent`, `bg-surface`, `bg-surface-inset` (Task 2)
- Produces: `.button`, `.button-primary`, `.button-secondary`, `.button-ghost`, `.button-danger`, `.button-icon`, `.button-sm`, `.button-block`. Task 9 `.button[aria-pressed='true']`'yu tüketir; sonraki planın buton göçü hepsini tüketir.

- [ ] **Step 1: `buttons.css`'i yeniden yaz**

Mevcut `.button`, `.apply-filter-button`, `.clear-filter-button`, `.active-filter-button` ve `.badge` yerine. Dosyanın sonundaki `@layer base` imleç bloğu **olduğu gibi kalır** — 85 butonun 24'ünün imleç eksikliğini çözen kural odur.

```css
/*
 * The button vocabulary. A button wears a structure class (.button), an
 * appearance (.button-primary and friends) and optional modifiers:
 *
 *   <button className="button button-secondary button-icon">
 *
 * No radius: nothing sitting on the page takes one. Only .float does.
 */

.button {
  @apply inline-flex items-center justify-center gap-x-1.5 px-4 py-2.5 text-sm font-medium
    transition-colors focus:outline-none focus-visible:outline-1 focus-visible:outline-white/40
    disabled:opacity-50 disabled:cursor-not-allowed;
}

/* --- Appearances --- */

.button-primary {
  @apply text-white bg-accent hover:bg-cyan-500;
}

.button-secondary {
  @apply text-white border bg-surface border-white/10 hover:bg-surface-inset hover:border-white/20;
}

.button-ghost {
  @apply text-gray-400 hover:bg-white/5 hover:text-white;
}

.button-danger {
  @apply border text-red-400 bg-red-600/20 border-red-500/30 hover:bg-red-600/30;
}

/*
 * The pressed state comes from ARIA, not from a class. .active-filter-button
 * used to do this with five !important declarations; [aria-pressed] is
 * (0,2,0) and already outranks the appearance classes at (0,1,0), so none
 * are needed. The appearance can no longer drift from what a screen reader
 * announces.
 */
.button[aria-pressed='true'] {
  @apply text-white bg-accent border-cyan-500/50;
}

.button[aria-pressed='true']:hover {
  @apply bg-cyan-500;
}

.button-ghost[aria-selected='true'] {
  @apply text-white bg-white/10;
}

/* --- Modifiers ---
 * These must come AFTER the appearances: they match .button's specificity
 * (0,1,0), so source order is the only thing letting them win on padding. */

.button-icon {
  @apply p-2;
}

.button-sm {
  @apply px-3 py-1 text-xs;
}

/* .button already sets justify-center; this only needs the width. */
.button-block {
  @apply w-full;
}

/* The count bubble on a filter button. */
.badge {
  @apply inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold rounded-full text-cyan-700 bg-white;
}
```

- [ ] **Step 2: Eski sınıfların kullanıcısı kalmadığını doğrula**

Run: `grep -rn "apply-filter-button\|clear-filter-button\|active-filter-button" frontend/src --include='*.tsx'`
Expected: tam olarak yedi satır (altı çağrı noktası; `FilterBar` iki farklı sınıf taşıyor) —

| Dosya                            | Sınıf                  | Ne zaman göç ediyor |
| -------------------------------- | ---------------------- | ------------------- |
| `ui/FilterBar.tsx`               | `active-filter-button` | Task 9, bu PR       |
| `ui/FilterBar.tsx`               | `clear-filter-button`  | Task 10, bu PR      |
| `Filters/SolarSystemFilters.tsx` | `apply-filter-button`  | Task 10, bu PR      |
| `Filters/CharacterFilters.tsx`   | `apply-filter-button`  | Task 10, bu PR      |
| `Filters/CorporationFilters.tsx` | `apply-filter-button`  | Task 10, bu PR      |
| `Filters/KillmailFilters.tsx`    | `apply-filter-button`  | Task 10, bu PR      |
| `Filters/AllianceFilters.tsx`    | `apply-filter-button`  | Task 10, bu PR      |

Altısı da bu PR içinde göç ediyor, yani silinen sınıflar hiçbir çağrı noktasını stilsiz bırakmıyor. Bu adımda yalnızca listeyi doğrula, dosyaları henüz değiştirme.

- [ ] **Step 3: Lint**

Run: `yarn workspace frontend lint`
Expected: hata sayısı artmamış.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/buttons.css
git commit -m "feat(frontend): define the button vocabulary"
```

---

### Task 4: Sekme sınıfı

**Files:**

- Modify: `frontend/src/app/buttons.css` (sona eklenir)

**Interfaces:**

- Produces: `.tab`. Sonraki planda 6 detay sayfası tüketir.

- [ ] **Step 1: `.tab`'ı ekle**

`buttons.css`'in sonuna, `@layer base` bloğundan **önce**:

```css
/*
 * The underlined tab. Six detail pages (regions, alliances, solar-systems,
 * corporations, characters, constellations) each write this bar out
 * separately today. The selected state is read from ARIA here too.
 */
.tab {
  @apply px-4 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
    border-transparent text-gray-400 hover:text-white hover:border-white/20;
}

.tab[aria-selected='true'] {
  @apply text-white border-accent;
}
```

- [ ] **Step 2: Lint**

Run: `yarn workspace frontend lint`
Expected: hata sayısı artmamış.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/buttons.css
git commit -m "feat(frontend): define the underlined tab class"
```

---

### Task 5: Girdi sözlüğü ve `.select`'in taşınması

**Files:**

- Modify: `frontend/src/app/inputs.css`
- Modify: `frontend/src/app/globals.css` (`.select` ailesi çıkarılır)

**Interfaces:**

- Produces: `.input`, `.search-input`, `.select`, `.select-option-container`. 20 `.select` ve 12 `.select-option-container` çağrı noktası **değişmez** — sınıf adları aynı kalıyor, yalnızca dosya değişiyor.

- [ ] **Step 1: `.select` ailesini `globals.css`'ten kes**

`globals.css`'ten şu kurallar çıkarılır: `.select-option-container`, `.select`, `.select:disabled`, `.select option`, `.select option:hover`, `.select option:checked`, `.select::-webkit-scrollbar*` (üç kural), `.character-dropdown-scroll::-webkit-scrollbar*` (üç kural), `.select-option-container .chevron-down-icon`, `.select-option-container:hover .chevron-down-icon`.

- [ ] **Step 2: `inputs.css`'e yapıştır ve token'lara bağla**

`inputs.css`'in sonuna. Renkler `gray-900/70` yerine `surface`, `gray-700/70` yerine `white/10` olur; geri kalan yapı korunur:

```css
/*
 * Moved out of globals.css, which was 293 lines of mostly unrelated rules.
 * The class names are unchanged, so all 32 call sites stay as they are.
 */
.select-option-container {
  @apply relative;
}

.select {
  @apply px-4 py-2.5 pr-10 text-sm font-medium text-white transition-colors border appearance-none
    cursor-pointer bg-surface border-white/10 hover:bg-surface-inset hover:border-white/20
    focus:outline-none focus-visible:outline-1 focus-visible:outline-white/40;
}

.select:disabled {
  @apply text-gray-500 opacity-50 cursor-not-allowed bg-surface hover:bg-surface hover:border-white/10;
}

.select option {
  @apply px-3 py-3 text-sm font-medium text-gray-200 transition-colors bg-surface;
}

.select option:checked {
  @apply font-semibold text-white bg-surface-inset;
}

.select::-webkit-scrollbar,
.character-dropdown-scroll::-webkit-scrollbar {
  width: 8px;
}

.select::-webkit-scrollbar-track,
.character-dropdown-scroll::-webkit-scrollbar-track {
  @apply bg-surface;
}

.select::-webkit-scrollbar-thumb,
.character-dropdown-scroll::-webkit-scrollbar-thumb {
  @apply rounded-full bg-gray-700 hover:bg-gray-600;
}

.select-option-container .chevron-down-icon {
  @apply absolute w-5 h-5 text-gray-400 transition-colors pointer-events-none right-3 top-2.5;
}

.select-option-container:hover .chevron-down-icon {
  @apply text-gray-300;
}
```

`.select option:hover` kuralı düşürüldü: tarayıcılar yerel `<option>` üstünde hover stilini uygulamıyor, kural hiçbir zaman çalışmıyordu.

- [ ] **Step 3: `.input` ve `.search-input`'u token'a bağla**

`inputs.css`'in başındaki iki kural; `bg-white/5` korunuyor (zaten cam dilinde), yalnızca focus davranışı sözlükle hizalanıyor:

```css
.search-input {
  @apply block w-full py-2.5 pl-10 pr-3 text-white border-0 bg-white/5
    placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6;
}

.input {
  @apply block w-full px-3 py-2 text-white border-0 bg-white/5
    placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6 scheme-dark;
}
```

- [ ] **Step 4: Taşımanın eksiksiz olduğunu doğrula**

Run: `grep -c "^\.select" frontend/src/app/globals.css`
Expected: `0`

Run: `grep -c "^\.select" frontend/src/app/inputs.css`
Expected: `0` değil (en az 4).

- [ ] **Step 5: Lint ve test**

Run: `yarn workspace frontend lint && yarn workspace frontend test`
Expected: hata artmamış; 167 test geçiyor.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/inputs.css frontend/src/app/globals.css
git commit -m "feat(frontend): move the select family into inputs.css and put inputs on tokens"
```

---

### Task 6: Kart ve cam katman sınıfları

**Files:**

- Create: `frontend/src/app/cards.css`
- Modify: `frontend/src/app/globals.css` (import eklenir, 8 kart sınıfı çıkarılır)

**Interfaces:**

- Produces: `.card`, `.card-header`, `.card-body`, `.float`, `.menu-row`. Task 7 `.card` ve `.card-header`'ı tüketir; `.float` ve `.menu-row` sonraki planda tüketilir.

- [ ] **Step 1: `cards.css`'i yaz**

```css
/*
 * Surfaces.
 *
 * Everything sitting on the page is opaque and sharp; everything floating
 * above it is glass with a small radius. Glass is a layer signal rather
 * than decoration — it only means anything with content behind it.
 */

/* .card holds no padding of its own — every caller lays out its own
   insides. That decision was already made in ui/Card.tsx; it stands. */
.card {
  @apply border bg-surface border-white/10;
}

/* The header lives INSIDE the card. In five components (TopShipsCard,
   TopTargetsCard, TopCharacterCard, TopCorporationCard, TopAllianceCard)
   the root element had no background, so the header read as a separate
   thing sitting on the page. */
.card-header {
  @apply px-4 py-3 border-b border-white/10;
}

.card-body {
  @apply p-4;
}

/* The floating layer: popover panels, the mobile drawer, FilterDialog, Tooltip. */
.float {
  @apply border rounded-md bg-gray-900/80 backdrop-blur-md border-white/10;
}

/* A list row that carries a <button> tag but is not visually a button.
   Forcing it into the button vocabulary would have been wrong. */
.menu-row {
  @apply relative flex items-center w-full p-3 transition-colors gap-x-3 text-sm/6 hover:bg-cyan-900/50;
}
```

- [ ] **Step 2: `globals.css`'e import ekle**

Diğer import'ların yanına, `tables.css`'ten sonra:

```css
@import './cards.css';
```

- [ ] **Step 3: Ölü sınıfları sil**

`globals.css`'ten şu blok tamamen çıkarılır:

```css
.fit-and-victim,
.items-card {
  @apply border bg-neutral-900 border-neutral-800;
}
```

İkisi ölü: `items-card` 0 kullanıcı, `corporation-detail-card` 0 kullanıcı.
`fit-and-victim` ise **ölü değil** — `app/killmails/[id]/page.tsx:75-76`'da bir ternary
içinde kuruluyor ve ilk taramam bunu kaçırdı. O iki çağrı noktası da `card`'a geçer.

`corporation-detail-card`'ın neden ölü olduğu ilginç: `app/corporations/[id]/page.tsx`
kendi sınıfını değil **`alliance-detail-card`**'ı kullanıyor. İkisi zaten aynı kuralı
yazdığı için fark edilmemiş. `.card`'a geçince mesele kendiliğinden kapanıyor.

- [ ] **Step 4: Kalan beş kart sınıfını da sil**

`globals.css`'ten:

```css
.alliance-detail-card,
.region-detail-card,
.constellation-detail-card,
.system-detail-card,
.corporation-detail-card,
.character-detail-card {
  @apply border bg-neutral-900 border-neutral-800 p-6 flex flex-col;
}
```

- [ ] **Step 5: Altı çağrı noktasını `.card`'a taşı**

Bu sınıfları kullanan tam olarak altı yer var. Bul:

Run: `grep -rn "alliance-detail-card\|region-detail-card\|constellation-detail-card\|system-detail-card\|character-detail-card" frontend/src --include='*.tsx'`
Expected: 6 satır.

Her birinde sınıf adı `card` ile değiştirilir ve eski kuralın taşıdığı yerleşim satır içine alınır, çünkü `.card` yerleşim taşımıyor:

```
alliance-detail-card   →   card p-6 flex flex-col
```

- [ ] **Step 6: Hiç kalıntı kalmadığını doğrula**

Run: `grep -rn "detail-card\|fit-and-victim\|items-card" frontend/src`
Expected: hiçbir eşleşme.

- [ ] **Step 7: Lint ve test**

Run: `yarn workspace frontend lint && yarn workspace frontend test`
Expected: hata artmamış; 167 test geçiyor.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/cards.css frontend/src/app/globals.css frontend/src
git commit -m "feat(frontend): define the surface vocabulary and retire the eight card classes"
```

---

### Task 7: `ui/Card` header slotu

Madde 8'in kanıtlanabilir kısmı bu. Test, header'ın kart yüzeyinin **içinde** olduğunu doğrular — bugünkü arıza tam olarak dışında olması.

**Files:**

- Create: `frontend/src/components/ui/Card.spec.tsx`
- Modify: `frontend/src/components/ui/Card.tsx`

**Interfaces:**

- Consumes: `.card`, `.card-header` (Task 6)
- Produces: `CardProps` artık `header?: ReactNode` taşır. Sonraki planda beş `*Card` bileşeni bunu kullanır.

- [ ] **Step 1: Başarısız testi yaz**

`frontend/src/components/ui/Card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Card from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>gövde</Card>);

    expect(screen.getByText('gövde')).toBeInTheDocument();
  });

  it('puts the header inside the card surface', () => {
    render(<Card header={<h2>TOP SHIPS</h2>}>gövde</Card>);

    const heading = screen.getByRole('heading', { name: 'TOP SHIPS' });
    expect(heading.closest('.card')).not.toBeNull();
  });

  it('leaves out the header element when no header is given', () => {
    const { container } = render(<Card>gövde</Card>);

    expect(container.querySelector('.card-header')).toBeNull();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/ui/Card.spec.tsx`
Expected: FAIL — `header` prop'u `CardProps` üzerinde tanımlı olmadığı için TypeScript hatası, ve header testi başarısız.

- [ ] **Step 3: `Card.tsx`'i güncelle**

```tsx
import { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /**
   * The card's heading. Rendered INSIDE the card — in five `*Card`
   * components the header sat on a root with no background, so it read as
   * a separate element outside the card.
   */
  header?: ReactNode;
  /**
   * Extra classes appended after the base ones. Tailwind utilities resolve
   * by generated-CSS source order, not by where they appear in the
   * `className` string, so a conflicting utility here is not reliably
   * overridden.
   */
  className?: string;
}

/**
 * The shared card surface: flat border, dark ground, no radius.
 *
 * The card holds no padding of its own — every caller lays out its own
 * insides, so a `padded` prop only ever got switched off.
 */
export default function Card({ header, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {header && <div className="card-header">{header}</div>}
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `yarn workspace frontend test src/components/ui/Card.spec.tsx`
Expected: PASS, 3 test.

- [ ] **Step 5: Typecheck**

Run: `yarn workspace frontend typecheck`
Expected: 0 hata. `Card`'ı kullanan dört bileşen (`Card/AllianceCard`, `CharacterCard`, `CorporationCard`, `RegionCard`) `header` vermiyor ve prop isteğe bağlı olduğu için etkilenmiyorlar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/Card.tsx frontend/src/components/ui/Card.spec.tsx
git commit -m "feat(frontend): give card a header slot inside its own surface"
```

---

### Task 8: Tablo kendi zeminini bırakıyor

**Files:**

- Modify: `frontend/src/app/tables.css`

- [ ] **Step 1: `.table`'ı güncelle**

`.table` bugün `bg-black` taşıyor. `.card` içinde yaşayacağı için kendi zeminini bırakıyor, yoksa kartın yüzeyini deler:

```css
/*
 * No ground of its own: the table lives inside a .card, and carrying one
 * would punch a hole in the card's surface. It used to be bg-black.
 */
.table {
  @apply min-w-full divide-y divide-white/5;
}

.th-cell {
  @apply px-4 py-4 text-base font-semibold tracking-wider text-gray-400;
}
```

- [ ] **Step 2: Lint ve test**

Run: `yarn workspace frontend lint && yarn workspace frontend test`
Expected: hata artmamış; 167 test geçiyor.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/tables.css
git commit -m "feat(frontend): drop the table's own ground"
```

---

### Task 9: `FilterBar` basılı durumu ARIA'ya geçiyor

`.button[aria-pressed='true']` kuralını (Task 3) gerçek bir kullanıcıya bağlayan adım. Aynı zamanda beş `!important`'ı emekli ediyor.

**Files:**

- Create: `frontend/src/components/ui/FilterBar.spec.tsx`
- Modify: `frontend/src/components/ui/FilterBar.tsx:66`

**Interfaces:**

- Consumes: `.button`, `.button-secondary`, `.button[aria-pressed='true']` (Task 3)

- [ ] **Step 1: Başarısız testi yaz**

Önce bileşenin prop'larını oku (`sed -n 1,40p frontend/src/components/ui/FilterBar.tsx`) ve `renderFilterBar` yardımcısını gerçek imzaya göre yaz. Test edilecek davranış:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FilterBar from './FilterBar';

describe('FilterBar', () => {
  it('marks a filter button pressed when it carries a badge', () => {
    // ...bileşenin gerçek prop'larıyla, rozet taşıyan bir filtre ile render et
    expect(screen.getByRole('button', { name: /.../ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('leaves a filter button unpressed when it has no badge', () => {
    // ...rozetsiz filtre
    expect(screen.getByRole('button', { name: /.../ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/ui/FilterBar.spec.tsx`
Expected: FAIL — `aria-pressed` özniteliği yok.

- [ ] **Step 3: `FilterBar.tsx:66`'yı değiştir**

Eski:

```tsx
className={`button ${hasBadge ? 'active-filter-button' : ''}`}
```

Yeni — durum artık className'de değil, ARIA'da:

```tsx
aria-pressed={hasBadge}
className="button button-secondary"
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `yarn workspace frontend test src/components/ui/FilterBar.spec.tsx`
Expected: PASS.

- [ ] **Step 5: `active-filter-button`'ın öldüğünü doğrula**

Run: `grep -rn "active-filter-button" frontend/src`
Expected: hiçbir eşleşme.

- [ ] **Step 6: Tüm test paketi, typecheck, lint**

Run: `yarn workspace frontend typecheck && yarn workspace frontend lint && yarn workspace frontend test`
Expected: typecheck 0 hata; lint artmamış; tüm testler geçiyor (167 + Task 7'nin 3'ü + buradaki 2'si).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ui/FilterBar.tsx frontend/src/components/ui/FilterBar.spec.tsx
git commit -m "fix(frontend): drive the pressed filter state from aria-pressed"
```

---

### Task 10: Filtre butonlarının göçü

Task 3'te silinen son iki sınıfın çağrı noktalarını kapatır. Bundan sonra
`buttons.css`'te kullanıcısı olmayan hiçbir kural kalmaz.

**Files:**

- Modify: `frontend/src/components/ui/FilterBar.tsx` (`clear-filter-button`)
- Modify: `frontend/src/components/Filters/SolarSystemFilters.tsx`
- Modify: `frontend/src/components/Filters/CharacterFilters.tsx`
- Modify: `frontend/src/components/Filters/CorporationFilters.tsx`
- Modify: `frontend/src/components/Filters/KillmailFilters.tsx`
- Modify: `frontend/src/components/Filters/AllianceFilters.tsx`

**Interfaces:**

- Consumes: `.button`, `.button-primary`, `.button-danger` (Task 3)

- [ ] **Step 1: Beş `apply-filter-button`'ı taşı**

Beş `Filters/*.tsx` dosyasının her birinde:

```
className="apply-filter-button"   →   className="button button-primary"
```

Eski kural `bg-indigo-600 hover:bg-indigo-500` idi; `.button-primary` `bg-accent`
(cyan-600) kullanıyor. Bu bilinçli: birincil eylemin üç ayrı rengi vardı
(cyan, indigo, blue) ve tek renge iniyor.

- [ ] **Step 2: `clear-filter-button`'ı taşı**

`ui/FilterBar.tsx` içinde:

```
className="clear-filter-button"   →   className="button button-danger"
```

- [ ] **Step 3: Eski sınıfların tamamen öldüğünü doğrula**

Run: `grep -rn "apply-filter-button\|clear-filter-button\|active-filter-button" frontend/src`
Expected: hiçbir eşleşme.

- [ ] **Step 4: Typecheck, lint, test**

Run: `yarn workspace frontend typecheck && yarn workspace frontend lint && yarn workspace frontend test`
Expected: typecheck 0 hata; lint artmamış; tüm testler geçiyor.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/FilterBar.tsx frontend/src/components/Filters
git commit -m "feat(frontend): move the filter buttons onto the button vocabulary"
```

- [ ] **Step 6: PR 2'nin tek build'i**

Kullanıcıya **önce haber ver** — dev sunucusunu düşürür.

Run: `yarn workspace frontend build`
Expected: derleme başarılı.

Sonra sözlüğün gerçekten CSS'e girdiğini doğrula:

Run: `grep -o '\.button-primary{[^}]*}\|\.card{[^}]*}\|\.float{[^}]*}' frontend/.next/static/chunks/*.css | head -5`
Expected: üçü de eşleşiyor. Boş dönen olursa `globals.css`'teki `@import` zincirini kontrol et — Tailwind erişemediği dosyanın kurallarını yaymaz.

---

## PR açıklamalarına yazılacaklar

**PR 1 — Temel.** Görsel kontrol: her sayfada yazı tipi (Inter), ve sayfa zemininin saf siyahtan `gray-950`'e geçişi. Kartlar henüz eski renklerinde, ayrışma bir sonraki PR'da tamamlanacak.

**PR 2 — Sözlük.** Görsel kontrol: altı detay sayfası (`/alliances/[id]`, `/regions/[id]`, `/constellations/[id]`, `/solar-systems/[id]`, `/characters/[id]`) — kart yüzeyleri `.card`'a geçti. Filtre çubuğunda basılı buton rengi.

**Stilsiz kalan hiçbir yer yok.** Task 3'te silinen `apply-filter-button`, `clear-filter-button` ve `active-filter-button` sınıflarının altı çağrı noktasının tamamı aynı PR içinde göç ediyor (Task 9 ve Task 10).

---

## Öz-inceleme

**Spec kapsamı.** Bu plan spec §3 (token seti), §4 (buton sözlüğü, `.tab` dahil), §5.1-5.4 (kart, cam katman, girdiler, tablo), §6 (tipografi) ve §2.5'in yarısını (`FilterBar`'ın `aria-pressed`'i) karşılıyor.

**Kapsanmayan ve bilerek sonraki plana bırakılan:** §4'ün kalan 62 çağrı noktasına uygulanması (6'sı Task 10'da bitiyor), `.tab`'ın 6 detay sayfasına uygulanması, amber CTA'nın indirilmesi, `MostValuableCarousel`'ın koşullu className'inin kaldırılması, `Checkbox`'ın beş `indigo-500`'ü, §5.2'nin dört tüketicisi, §7'nin tamamı (görsel ölçeği), ve §1'de sayılan 249 satır içi zemin.

**Tip tutarlılığı.** `CardProps.header` Task 7'de tanımlanıyor ve bu plan içinde başka yerde tüketilmiyor. `inter.variable` Task 1'de üretiliyor, Task 2'de `var(--font-inter)` olarak tüketiliyor — adlar eşleşiyor.

**Bilinen zayıflık.** Task 9 Step 1 tam test kodunu içermiyor, çünkü `FilterBar`'ın prop imzası okunmadan `renderFilterBar` yardımcısı doğru yazılamaz. Adım, imzayı okumayı ve doğrulanacak iki davranışı açıkça söylüyor; iddialar tam. Bu plandaki tek yer.
