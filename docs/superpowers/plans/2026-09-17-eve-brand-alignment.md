# EVE Online marka hizalaması — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KillReport'un görsel dilini EVE Online'ın yayımlanmış marka
değerlerine çekmek — zeminler, aksan, sinyaller, gri tonları, tipografi
ağırlıkları ve büyük harf muamelesi.

**Architecture:** İş iki katmanda. Önce **jeton benimseme**: uygulama bugün
anlam jetonlarını değil ham Tailwind paletini yazıyor (`text-isk` 2 yerde,
`text-yellow-400` 22 yerde), o yüzden `@theme`'i değiştirmek tek başına
uygulamanın azınlığını taşır ve yarı göçmüş bir ekran bırakır. Görevler 1–4 bu
boşluğu **görsel değişiklik olmadan** kapatır: jetonlar bugün zaten aynı palet
adımlarına diğer adla bağlı. Sonra **tek dosyada değer çevirme** (Görev 5): o
an her şey birden değişir ve tek `git revert` ile geri alınır. Görev 6–9
jetonla ifade edilemeyen artıkları toplar.

**Tech Stack:** Next.js 16.3.3 (App Router), Tailwind CSS v4 (`@theme`),
Vitest 5, Prettier.

**Spec:** `docs/superpowers/specs/2026-09-17-eve-brand-alignment-design.md`

## Global Constraints

- **Yarn only, asla npm.** `yarn workspace frontend <script>`.
- **Commit ve PR metinleri İngilizce**, `type(scope):` sonrası küçük harf.
  **Claude atıfı yok** — `Co-Authored-By` veya "Generated with" satırı yok.
- **Üretilmiş dosyalar elle düzenlenmez** (`src/generated/graphql.ts`).
- **Doğrulama:** `yarn workspace frontend typecheck`, `test`, `lint`,
  `build:check` (`NEXT_DIST_DIR=.next-check`, çalışan dev sunucusunu ezmez).
  `build` kullanılmaz.
- **Biçim:** commit öncesi `npx prettier --check <dokunulan dosyalar>`.
- **Sınıf dizesi değişiklikleri test edilemez** (CLAUDE.md): `test` ve `lint`
  bir Tailwind sınıfının değiştiğini göremez. Bu planda kapı
  `typecheck` + `lint` + `build:check` + her görevdeki **grep sayımları**;
  görsel doğrulama kullanıcıya ait.
- **`lint` temiz çıkmıyor** — repo genelinde önceden var olan uyarılar var
  (2026-09-10'da 237). Ölçüt: sayı `main` ile aynı kalsın ve listede
  dokunulan dosya bulunmasın.
- **Jeton adları yalan söylemez.** `--color-gray-400: #b0b0b0` gibi bir palet
  ezmesi bu işi tek satıra indirirdi ve reddedildi: `gray-400` artık gray-400
  olmazdı. Bedeli Görev 2–4'ün hacmi.
- **Ölçülen değerler** (spec'ten, birebir):
  `ground #101010` · `surface #2b2b2c` · `surface-inset #3d3d3e` ·
  `accent #5ccbcb` · `accent-hover #71dfdf` · `accent-ink #111418` ·
  `ink-muted #b0b0b0` · `ink-faint #636363` · `destroyed #fe3743` ·
  `dropped #37ba5b` · `isk #e7b815` · `destroyed-fill #c80011` ·
  `dropped-fill #008425`

## Görev sırası — dikkat

Görev **12 ve 13, Görev 5'ten ÖNCE** çalışır. Numaraları sonda, çünkü ilk
onaydan sonra eklendiler ve aradaki numaraları kaydırmak üretilmiş brifingleri
bozardı. Yürütme sırası:

1, 2, 4, 3, 8 (bitti) → **12, 13** → 5 → 6 → 7 → 9 → 10 → 11

## Dosya haritası

| Dosya                            | Sorumluluk                                              |
| -------------------------------- | ------------------------------------------------------- |
| `frontend/src/app/globals.css`   | `@theme` — tek doğru kaynak; Görev 1 ve 5 burada        |
| `frontend/src/app/buttons.css`   | `.button-primary`, `[aria-pressed]`, `.badge` mürekkebi |
| `frontend/src/app/tables.css`    | `.th-cell` büyük harf                                   |
| `frontend/src/app/cards.css`     | `.card-header` büyük harf                               |
| `frontend/src/**/*.tsx`          | jeton benimseme ve ağırlık taramaları                   |
| `frontend/src/utils/contrast.ts` | (Görev 11, isteğe bağlı) kontrast ölçer                 |

---

### Task 1: Eksik anlam jetonlarını bugünkü değerleriyle ekle

`@theme` bugün yedi jeton tanımlıyor. Taramaların hedefleyeceği beş tanesi
yok: `ink-muted`, `ink-faint`, `accent-link`, `accent-hover`, `accent-ink`.
Hepsi **bugünkü palet değerine** bağlanıyor, yani bu görev sonunda ekranda
hiçbir şey değişmiyor.

**Files:**

- Modify: `frontend/src/app/globals.css:11-39`

**Interfaces:**

- Consumes: yok.
- Produces: `--color-ink-muted`, `--color-ink-faint`, `--color-accent-link`,
  `--color-accent-hover`, `--color-accent-ink` — Görev 2–4 bunları yazar,
  Görev 5 değerlerini çevirir.

- [ ] **Step 1: Jetonları ekle**

`globals.css`'te `--color-accent` satırından hemen sonra:

```css
/* The accent's neighbours, named so a sweep has something to sweep to.
     accent-link is an entity name under the pointer; accent-hover is the
     pointer state of an accent fill; accent-ink is what sits ON the fill. */
--color-accent-link: var(--color-cyan-400);
--color-accent-hover: var(--color-cyan-500);
--color-accent-ink: var(--color-cyan-700);

/* Ink. The two greys the app writes most — 251 and 115 times — as raw
     palette steps. */
--color-ink-muted: var(--color-gray-400);
--color-ink-faint: var(--color-gray-500);
```

- [ ] **Step 2: Hiçbir şeyin değişmediğini doğrula**

Run: `cd frontend && yarn build:check`
Expected: başarılı. Bu adım görsel bir değişiklik üretmez — jetonlar
kullanılmıyor, sadece tanımlanıyor.

- [ ] **Step 3: Biçim ve commit**

```bash
cd frontend && npx prettier --check src/app/globals.css
git add frontend/src/app/globals.css
git commit -m "refactor(frontend): name the accent and ink tokens the sweep needs"
```

---

### Task 2: `ink-muted` / `ink-faint` taraması

En büyük tarama: `gray-400` 251, `gray-500` 115 kullanım. İkisi de tek anlam
taşıyor (sessiz etiket / soluk metin), o yüzden makine işi.

**Files:**

- Modify: `frontend/src/**/*.tsx`, `frontend/src/app/*.css`

**Interfaces:**

- Consumes: Görev 1'in `--color-ink-muted`, `--color-ink-faint` jetonları.
- Produces: yok.

- [ ] **Step 1: Bugünkü sayıyı kaydet**

```bash
cd frontend/src
grep -rhoE '(text|bg|border|placeholder|divide)-gray-400\b' --include='*.tsx' --include='*.css' . | wc -l   # 251 bekleniyor
grep -rhoE '(text|bg|border|placeholder|divide)-gray-500\b' --include='*.tsx' --include='*.css' . | wc -l   # 115 bekleniyor
```

- [ ] **Step 2: Taramayı çalıştır**

```bash
cd frontend/src
grep -rlE '(text|bg|border|placeholder|divide)-gray-(400|500)\b' --include='*.tsx' --include='*.css' . \
  | xargs sed -i '' -E 's/\b(text|bg|border|placeholder|divide)-gray-400\b/\1-ink-muted/g; s/\b(text|bg|border|placeholder|divide)-gray-500\b/\1-ink-faint/g'
```

- [ ] **Step 3: Sayımı doğrula**

```bash
cd frontend/src
grep -rhoE '(text|bg|border|placeholder|divide)-gray-(400|500)\b' --include='*.tsx' --include='*.css' . | wc -l   # 0
grep -rhoE '(text|bg|border|placeholder|divide)-ink-muted\b' --include='*.tsx' --include='*.css' . | wc -l        # 251
grep -rhoE '(text|bg|border|placeholder|divide)-ink-faint\b' --include='*.tsx' --include='*.css' . | wc -l        # 115
```

Expected: sırasıyla 0, 251, 115. Sayı tutmuyorsa `git checkout` ile geri al ve
`grep -rn 'gray-40' ` ile kalanı elle bak — `hover:text-gray-400` gibi varyant
önekleri sed'in `\b` sınırına takılmaz ama `text-gray-400` kalıbını içerdikleri
için yakalanır; yakalanmayan tek biçim `gray-400/50` gibi alfa sonekleridir.

- [ ] **Step 4: Alfa sonekli kalıntıları ara**

```bash
cd frontend/src && grep -rn 'gray-400/\|gray-500/' --include='*.tsx' --include='*.css' .
```

Expected: boş. Çıkarsa elle `ink-muted/…` biçimine çevir.

- [ ] **Step 5: Kapı**

Run: `cd frontend && yarn typecheck && yarn lint && yarn build:check`
Expected: typecheck ve build temiz; lint sayısı `main` ile aynı.

- [ ] **Step 6: Biçim ve commit**

```bash
cd frontend && npx prettier --write src && npx prettier --check src
git add -A frontend/src
git commit -m "refactor(frontend): write ink-muted and ink-faint instead of the grey palette steps"
```

---

### Task 3: `destroyed` / `dropped` / `isk` taraması

Bu tarama **kör sed değil.** `yellow-400` üç ayrı anlam taşıyor: ISK rakamı,
ittifak ticker'ı ve `sec-low` güvenlik bandı. `red-400` da hem `destroyed` hem
`sec-null`. Her kullanım yeri tek tek okunup doğru jetona bağlanacak.

**Files:**

- Modify: `frontend/src/**/*.tsx`, `frontend/src/app/globals.css`

**Interfaces:**

- Consumes: mevcut `--color-destroyed`, `--color-dropped`, `--color-isk`.
- Produces: yok.

- [ ] **Step 1: Kullanım yerlerini listele**

```bash
cd frontend/src
grep -rn '\-red-400\b' --include='*.tsx' --include='*.css' .      # 38
grep -rn '\-green-400\b' --include='*.tsx' --include='*.css' .    # 18
grep -rn '\-yellow-400\b' --include='*.tsx' --include='*.css' .   # 22
```

- [ ] **Step 2: Her satırı anlamına göre ayır**

Kural — satırın çevresindeki metne bakılır:

| Görülen                                            | Jeton       |
| -------------------------------------------------- | ----------- |
| Hasar rakamı, patlayan modül, kayıp                | `destroyed` |
| Düşen modül, kazanılan                             | `dropped`   |
| ISK / değer / fiyat                                | `isk`       |
| `utils/security.ts` içindeki dönüşler              | **dokunma** |
| `.alliance-ticker` (`globals.css:96`)              | **dokunma** |
| Egemenlik uyarısı, bildirim rozeti, filtre vurgusu | **dokunma** |

"Dokunma" satırları ham palette kalır; bunlar EVE'ye geçmeyen anlamlar ve
Görev 5'te değeri değişmemeleri gerekiyor. `sec-*` jetonları uygulamada
`utils/security.ts` üzerinden dağıtılıyor ve spec'te kapsam dışı.

- [ ] **Step 3: Değişiklikleri uygula**

Her dosyada ilgili sınıfı elle çevir: `text-red-400` → `text-destroyed`,
`text-green-400` → `text-dropped`, `text-yellow-400` → `text-isk`, ve
`bg-*/10` gibi alfa biçimlerinde aynı kök: `bg-red-400/10` →
`bg-destroyed/10`.

- [ ] **Step 4: Kalanı doğrula**

```bash
cd frontend/src && grep -rn '\-red-400\|\-green-400\|\-yellow-400' --include='*.tsx' --include='*.css' .
```

Expected: yalnızca Step 2'de "dokunma" denen satırlar. Her biri için tek
satırlık bir yorum bırakılır — neden ham palette kaldığı okunur olsun:

```tsx
{
  /* sec-low's yellow, not isk's — see utils/security.ts */
}
```

- [ ] **Step 5: Kapı**

Run: `cd frontend && yarn typecheck && yarn lint && yarn build:check`

- [ ] **Step 6: Biçim ve commit**

```bash
cd frontend && npx prettier --write src && npx prettier --check src
git add -A frontend/src
git commit -m "refactor(frontend): write the meaning tokens instead of the palette they alias"
```

---

### Task 4: `accent-link` / `accent-hover` taraması

`cyan-400` 48, `cyan-500` 23 kullanım. `cyan-400` neredeyse her yerde
"işaretçi altındaki varlık adı", `cyan-500` ise aksan dolgusunun hover'ı.

**Files:**

- Modify: `frontend/src/**/*.tsx`, `frontend/src/app/globals.css`,
  `frontend/src/app/buttons.css`

**Interfaces:**

- Consumes: Görev 1'in `--color-accent-link`, `--color-accent-hover`.
- Produces: yok.

- [ ] **Step 1: Sayımı kaydet**

```bash
cd frontend/src
grep -rhoE '(text|bg|border)-cyan-400\b' --include='*.tsx' --include='*.css' . | wc -l   # 48
grep -rhoE '(text|bg|border)-cyan-500\b' --include='*.tsx' --include='*.css' . | wc -l   # 23
```

- [ ] **Step 2: Taramayı çalıştır**

```bash
cd frontend/src
grep -rlE '(text|bg|border)-cyan-(400|500)' --include='*.tsx' --include='*.css' . \
  | xargs sed -i '' -E 's/\b(text|bg|border)-cyan-400\b/\1-accent-link/g; s/\b(text|bg|border)-cyan-500\b/\1-accent-hover/g'
```

- [ ] **Step 3: Alfa sonekli kalıntılar**

```bash
cd frontend/src && grep -rn 'cyan-400/\|cyan-500/' --include='*.tsx' --include='*.css' .
```

`buttons.css`'te `border-cyan-500/50` var — elle `border-accent-hover/50`
yapılır.

- [ ] **Step 4: `cyan-700` rozette kalıyor**

`.badge`'in `text-cyan-700`'ü Görev 6'da ele alınacak. Şimdi dokunma.

- [ ] **Step 5: Kapı ve commit**

```bash
cd frontend && yarn typecheck && yarn lint && yarn build:check
npx prettier --write src && npx prettier --check src
git add -A frontend/src
git commit -m "refactor(frontend): write accent-link and accent-hover instead of raw cyan"
```

---

### Task 5: Jeton değerlerini EVE'ye çevir

**Değişimin olduğu an.** Tek dosya, tek commit, tek `git revert`.

**Files:**

- Modify: `frontend/src/app/globals.css:11-39`

**Interfaces:**

- Consumes: Görev 1–4'ün benimsettiği jeton adları.
- Produces: EVE değerlerini taşıyan `@theme`.

- [ ] **Step 1: `@theme`'i değiştir**

`globals.css`'teki blok bütünüyle şu olur:

```css
@theme {
  /* Typography — unchanged. Shentox is EVE Online's own web font and the app
     was already shipping it. eveonline.com names Rogan after it in the stack,
     but nothing on that page is drawn with Rogan: Shentox answers everything,
     so adding it here would load a face that is never reached. It lives in
     the design system instead (spec, decision 8). */
  --font-sans: 'Shentox', ui-sans-serif, system-ui, sans-serif;

  /* Depth — three steps, no more. The first two are EVE's own
     (eveonline.com's page ground, and --pfg-background-dark); the third is
     derived, because a marketing site has no third step to copy. The step
     from ground to surface is 1.35:1, up from 1.13:1 when these were
     Tailwind greys — and with no shadows anywhere, that step IS the depth. */
  --color-ground: #101010; /* the page */
  --color-surface: #2b2b2c; /* cards, tables, panels */
  --color-surface-inset: #3d3d3e; /* a box inside a card */

  /* Accent — EVE's own, from --sf-terms-button-color. It is a LIGHT accent,
     so what sits ON the fill is dark ink: white on it measures 1.93:1, and
     accent-ink is the ink EVE's own "Play Free" button uses (9.55:1).
     accent-hover is derived at +0.06 oklch L — EVE's button does not change
     its fill on hover at all, but every other control in this app does, and
     a primary button that alone ignores the pointer reads as broken. */
  --color-accent: #5ccbcb;
  --color-accent-hover: #71dfdf;
  --color-accent-ink: #111418;
  --color-accent-link: #5ccbcb;

  /* Ink — EVE's own greys, --pfg-dark-chalice and --sf-disabled-color.
     ink-muted measures 5.00:1 on surface-inset where the Tailwind grey it
     replaces measured 4.17:1. */
  --color-ink-muted: #b0b0b0;
  --color-ink-faint: #636363;

  /* Meaning, all three EVE's own. Damage uses `destroyed` too.
     CONTRAST, taken deliberately: destroyed measures 3.93:1 on surface and
     3.02:1 on surface-inset, under the 4.5:1 body-text floor. That is EVE's
     red as EVE ships it. #ff6467 measures 4.90:1 if it has to come back. */
  /* EVE's red, as the project's red. red-400 IS eveonline.com's value exactly —
     it is the step this app writes — and the deeper three keep Tailwind's
     lightness intervals at EVE's hue and chroma so the ramp still steps evenly.
     Overriding the palette is deliberate and was asked for: a token layer alone
     would have left the security band, the attacker half of a war bar and the
     category swatches on Tailwind's red. CONTRAST, accepted knowingly:
     red-400 measures 3.93:1 on surface and 3.02:1 on surface-inset, under the
     4.5 body-text floor. The deeper steps are fills and borders, never text. */
  --color-red-400: #fe3743;
  --color-red-500: #e50e2e;
  --color-red-600: #cf0019;
  --color-red-700: #b50000;

  --color-destroyed: var(--color-red-400);
  --color-dropped: #37ba5b;
  --color-isk: #e7b815;

  /* The same three hues under the names the rest of the app needs. Two tokens
     sharing a value is not waste: destroyed and danger are the same red today
     and say different things, so either can move without dragging the other.
     CONTRAST: danger measures 5.29:1 on ground, where nearly every error
     message in this app sits, but 3.93:1 on surface. Page-level error states
     only; see the spec. */
  --color-danger: var(--color-destroyed);
  --color-success: var(--color-dropped);
  --color-caution: var(--color-isk);

  /* The same two meanings as a ground rather than as ink, and deliberately
     a deeper step: a light hue behind a whole row washes it out. EVE's two
     hues taken down to the lightness the Tailwind 700s sat at. */
  --color-destroyed-fill: var(--color-red-700);
  --color-dropped-fill: #008425;
}
```

- [ ] **Step 2: `.badge`'in kırılmadığını kontrol et**

`.badge` hâlâ `text-cyan-700 bg-white`. `cyan-700` artık paletteki tek cyan;
Görev 6 onu kaldırıyor. Bu adımda sadece derlendiğini doğrula.

- [ ] **Step 3: Kapı**

Run: `cd frontend && yarn typecheck && yarn lint && yarn build:check`

- [ ] **Step 4: Kullanıcı bakar**

Bu görev bittiğinde uygulama gözle görülür biçimde açılmış, mavi tonunu
kaybetmiş ve teal olmuş olur. `yarn dev:frontend` ile `/killmails`,
`/leaderboards` ve bir ittifak detayına bakılması istenir. **Görsel doğrulama
kullanıcıya ait** — bu adım onaysız geçilmez.

- [ ] **Step 5: Commit**

```bash
cd frontend && npx prettier --check src/app/globals.css
git add frontend/src/app/globals.css
git commit -m "feat(frontend): align the theme tokens to EVE Online's brand values"
```

---

### Task 6: Aksan dolgusunun mürekkebi ve rozet

Aksan açıldığı için üstündeki beyaz yazı 1.93:1'e düşüyor. Bu görev
`.button-primary`, engaged toggle ve `.badge`'i düzeltir.

**Files:**

- Modify: `frontend/src/app/buttons.css:35-37`, `:62-68`, `:138-140`

**Interfaces:**

- Consumes: Görev 5'in `--color-accent-ink`.
- Produces: yok.

- [ ] **Step 1: `.button-primary`**

```css
.button-primary {
  @apply bg-accent text-accent-ink hover:bg-accent-hover;
}
```

- [ ] **Step 2: Engaged toggle**

```css
.button[aria-pressed='true'] {
  @apply bg-accent text-accent-ink border-accent-hover/50;
}

.button[aria-pressed='true']:hover {
  @apply bg-accent-hover;
}
```

- [ ] **Step 3: `.badge`**

Rozet bugün beyaz daire + `cyan-700` rakam. `cyan-700` aksan teal olunca
paletten kopuyor; teal rakam beyaz üstünde 1.93:1 olacağı için aksan da
yazılamaz. Zemin mürekkebi 19.03:1 veriyor ve rozetin beyaz kimliğini korur:

```css
.badge {
  @apply inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold rounded-full text-ground bg-white;
}
```

Spec bu satırı kapsamıyordu; alternatif `bg-accent text-accent-ink` (teal
daire, 9.55:1) ve tek satırlık değişiklik.

- [ ] **Step 4: Son cyan'ın gittiğini doğrula**

```bash
cd frontend/src && grep -rn 'cyan-' --include='*.tsx' --include='*.css' .
```

Expected: boş.

- [ ] **Step 5: Kapı, görsel onay, commit**

```bash
cd frontend && yarn typecheck && yarn lint && yarn build:check
npx prettier --check src/app/buttons.css
git add frontend/src/app/buttons.css
git commit -m "fix(frontend): put dark ink on the accent fill, which white cannot carry"
```

---

### Task 7: Satır yüksekliği ve gövde ağırlığı

EVE her yerde 1.5 satır yüksekliği ve 300 ağırlıklı gövde kullanıyor.

> **Step 1 geri alındı.** Satır yüksekliği sabitlemesi, dal gözden geçirilirken
> kullanıcının kararıyla kaldırıldı — `text-xs` ve `text-sm` Tailwind'in kendi
> ölçeğine döndü. Step 2'deki 300 ağırlığı yerinde duruyor.

**Files:**

- Modify: `frontend/src/app/globals.css` (`@theme` ve `body`)

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: Satır yüksekliklerini 1.5'e sabitle**

`@theme` bloğunun sonuna:

```css
/* EVE sets 1.5 at every size; Tailwind's scale runs 1.33 at xs and 1.43
     at sm. The two smallest sizes are where the difference is visible. */
--text-xs--line-height: 1.5;
--text-sm--line-height: 1.5;
--text-base--line-height: 1.5;
--text-lg--line-height: 1.5;
```

- [ ] **Step 2: Gövde ağırlığını 300'e indir**

`globals.css:82-84`:

```css
body {
  font-weight: 300;
}
```

- [ ] **Step 3: Kapı**

Run: `cd frontend && yarn build:check`

- [ ] **Step 4: Kullanıcı bakar — bu adım ayrı onay ister**

300 ağırlık koyu zeminde ince görünür. EVE bunu 15px pazarlama metninde
kullanıyor; KillReport'ta karşılığı 14–16px tablo metni. Bu görev bilerek
kendi commit'inde: beğenilmezse tek başına geri alınır, Görev 8'i etkilemez.

- [ ] **Step 5: Commit**

```bash
cd frontend && npx prettier --check src/app/globals.css
git add frontend/src/app/globals.css
git commit -m "feat(frontend): take EVE's 1.5 leading and 300 body weight"
```

---

### Task 8: `font-semibold` → `font-medium` taraması

EVE'nin baskın ağırlığı 500; KillReport 215 yerde 600 yazıyor.

**Files:**

- Modify: `frontend/src/**/*.tsx` (54 dosya), `frontend/src/app/*.css`

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: Sayımı kaydet**

```bash
cd frontend/src && grep -rho 'font-semibold' --include='*.tsx' --include='*.css' . | wc -l   # 215
```

- [ ] **Step 2: Taramayı çalıştır**

```bash
cd frontend/src
grep -rl 'font-semibold' --include='*.tsx' --include='*.css' . | xargs sed -i '' 's/font-semibold/font-medium/g'
```

- [ ] **Step 3: Doğrula**

```bash
cd frontend/src
grep -rho 'font-semibold' --include='*.tsx' --include='*.css' . | wc -l   # 0
grep -rho 'font-medium' --include='*.tsx' --include='*.css' . | wc -l     # Step 1'deki sayı + bugünkü font-medium sayısı
```

- [ ] **Step 4: Kapı, görsel onay, commit**

```bash
cd frontend && yarn typecheck && yarn lint && yarn build:check
npx prettier --write src && npx prettier --check src
git add -A frontend/src
git commit -m "feat(frontend): drop headings to 500, the weight EVE leads with"
```

---

### Task 9: Tablo ve kart başlıklarında büyük harf

EVE 59 öğede `uppercase` + `2.4px` harf aralığı kullanıyor. KillReport'taki
karşılığı tablo başlıkları ve kart başlıkları.

> **Bu görev bütünüyle geri alındı.** Dal gözden geçirilirken kullanıcının
> kararıyla hem `uppercase` hem `tracking-[0.15em]` kaldırıldı; `.th-cell` ve
> `.card-header` main'deki harf düzenine döndü. Aşağıdaki adımlar ne yapıldığının
> kaydı olarak duruyor, uygulanacak iş değil.

**Files:**

- Modify: `frontend/src/app/tables.css:49-51`, `frontend/src/app/cards.css:49-51`

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: `.card-header`'ın içinde ne olduğunu gör**

```bash
cd frontend/src && grep -rn 'card-header' --include='*.tsx' . | head -20
```

Büyük harf `.card-header`'ın **tüm** içeriğine uygulanır. Listede metin
dışında bir şey (sayaç, rozet) geçiyorsa, kural başlığa değil kabın kendisine
yazılmalı mı diye burada karar verilir.

- [ ] **Step 2: `.th-cell`**

```css
.th-cell {
  @apply px-4 py-3 text-lg font-medium tracking-[0.15em] uppercase text-white;
}
```

`2.4px`, EVE'nin kullandığı 16px boyutta `0.15em` demek; jeton ölçeğine
bağlansın diye `em` yazıldı.

- [ ] **Step 3: `.card-header`**

```css
.card-header {
  @apply px-4 py-3 border-b bg-surface-inset border-white/10 tracking-[0.15em] uppercase;
}
```

- [ ] **Step 4: Kapı, görsel onay, commit**

```bash
cd frontend && yarn typecheck && yarn lint && yarn build:check
npx prettier --check src/app/tables.css src/app/cards.css
git add frontend/src/app/tables.css frontend/src/app/cards.css
git commit -m "feat(frontend): set table and card headings in caps, as EVE does"
```

---

### Task 10: Design system artifact'ini güncelle

Artifact repoyla otomatik senkron değil; bu görev onu elle taşır.

**Files:**

- Modify: design system artifact — `project/tokens.json`, `project/README.md`,
  `project/components/bundle.css`, ve yeni `project/assets/Brand/`,
  `project/fonts/Rogan-*.woff2`

**Interfaces:**

- Consumes: Görev 5–9'un yerleşmiş değerleri.
- Produces: yok.

- [ ] **Step 1: `bundle.css`'i yeniden derle**

`globals.css` değiştiği için derlenmiş stylesheet eskidi. Artifact'teki
`bundle.css` elle yazılmaz, Tailwind'in kendi derleyicisiyle üretilir:

```js
// node 22 ile çalıştırılır; tailwindcss kökteki node_modules'da
import { compile } from '/Users/umut/Sites/killreport/node_modules/tailwindcss/dist/lib.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP = '/Users/umut/Sites/killreport/frontend/src/app';
const compiler = await compile(
  await fs.readFile(path.join(APP, 'globals.css'), 'utf8'),
  {
    base: APP,
    async loadStylesheet(id, base) {
      const p =
        id === 'tailwindcss'
          ? '/Users/umut/Sites/killreport/node_modules/tailwindcss/index.css'
          : path.resolve(base, id);
      return {
        path: p,
        base: path.dirname(p),
        content: await fs.readFile(p, 'utf8'),
      };
    },
    async loadModule() {
      throw new Error('no modules');
    },
  },
);
await fs.writeFile('compiled.css', compiler.build([])); // aday verilmez: sadece @layer components kalır
```

Çıktıdan 14 `@font-face` kuralı çıkarılır (artifact fontları kendi `fonts/`
klasöründen `tokens.css` ile tanımlar) ve dosyanın sonundaki "derlenip atılan
`@theme` jetonları" bloğu yeni değerlerle korunur. Sonuç
`project/components/bundle.css` olur.

- [ ] **Step 2: `tokens.json`'u güncelle**

Değişen jetonlar yeni değerlerini ve **ölçülmüş kontrast notlarını** alır.
`destroyed` ve `dropped`'ın `usage` alanına hangi zeminde kaç ölçtüğü yazılır —
design system'in "kaynağın geçmeyen çiftini koru, notuna işaretle" kuralı.

- [ ] **Step 3: Rogan ve logo**

Dört Rogan kesimi (`/private/tmp/.../scratchpad/eve/fonts/`) `project/fonts/`
altına yüklenir ve `tokens.json` `type.fonts` listesine eklenir. EVE Online
kelime markası `project/assets/Brand/eve-online.svg` olarak yüklenir, grubun
`README.md`'sine kaynağı ve CCP'nin sahipliği yazılır.

- [ ] **Step 4: README'nin EVE bölümü**

"The five rules" bölümü güncellenir: aksanın artık açık olduğu ve üstüne koyu
mürekkep geldiği, zeminlerin nötrleştiği, Shentox'un EVE'nin kendi fontu
olduğu. Yeni bir bölüm EVE'nin `@theme`'e girmeyen değerlerini referans olarak
listeler (PLEX turuncusu, ortaklık altını, form zemini `#29353a`).

- [ ] **Step 5: Tek publish**

Uploads önce, sonra tek `Artifact` çağrısı; index **son** çağrıda,
yayımlamadan hemen önce yeniden okunarak.

---

### Task 11 (isteğe bağlı): Kontrast testi

**Maliyet:** iki dosya, ~70 satır. Karşılığında bu spec'in bütün kontrast
iddiaları kilitlenir — bir jeton değişince test düşer, kimse gözle fark etmeyi
beklemez.

**Files:**

- Create: `frontend/src/utils/contrast.ts`
- Create: `frontend/src/utils/contrast.spec.ts`

**Interfaces:**

- Consumes: `frontend/src/app/globals.css` (okuyarak).
- Produces: `contrastRatio(hexA, hexB): number`, `readTheme(css): Record<string, string>`.

- [ ] **Step 1: Testi yaz**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readTheme } from './contrast';

const theme = readTheme(
  readFileSync(join(__dirname, '../app/globals.css'), 'utf8'),
);

describe('theme contrast', () => {
  it('puts readable ink on the accent fill', () => {
    // white cannot sit on this accent; accent-ink is why the token exists
    expect(
      contrastRatio(theme['accent-ink'], theme['accent']),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps each depth step visible without shadows', () => {
    expect(
      contrastRatio(theme['surface'], theme['ground']),
    ).toBeGreaterThanOrEqual(1.25);
    expect(
      contrastRatio(theme['surface-inset'], theme['surface']),
    ).toBeGreaterThanOrEqual(1.25);
  });

  it('keeps muted ink readable on every ground', () => {
    for (const g of ['ground', 'surface', 'surface-inset']) {
      expect(
        contrastRatio(theme['ink-muted'], theme[g]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('records destroyed as the one pair taken below the floor', () => {
    // EVE's red, taken deliberately — see the spec. If this ever passes,
    // the value changed and the note in tokens.json is stale.
    expect(contrastRatio(theme['destroyed'], theme['surface'])).toBeLessThan(
      4.5,
    );
  });
});
```

- [ ] **Step 2: Düşmesini doğrula**

Run: `cd frontend && yarn test src/utils/contrast.spec.ts`
Expected: FAIL — `Cannot find module './contrast'`.

- [ ] **Step 3: Ölçeri yaz**

```ts
/** WCAG 2.1 relative luminance and contrast, plus a reader for the @theme block. */
const channel = (v: number): number =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) =>
    channel(parseInt(h.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every `--color-<name>: #rrggbb` inside the @theme block, keyed by <name>. */
export function readTheme(css: string): Record<string, string> {
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
  if (block === null) throw new Error('globals.css has no @theme block');
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(
    /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
  )) {
    out[m[1]] = m[2];
  }
  return out;
}
```

- [ ] **Step 4: Geçmesini doğrula**

Run: `cd frontend && yarn test src/utils/contrast.spec.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
cd frontend && npx prettier --check src/utils/contrast.ts src/utils/contrast.spec.ts
git add frontend/src/utils/contrast.ts frontend/src/utils/contrast.spec.ts
git commit -m "test(frontend): lock the theme's contrast ratios, the failing pair included"
```

---

## Kapanış

- [ ] Tüm doğrulama seti bir kez: `yarn test`,
      `yarn workspace frontend typecheck`, `lint`, `build:check`,
      `npx prettier --check .`
- [ ] `lint` sayısı `main` ile karşılaştırılır; listede dokunulan dosya yok.
- [ ] PR açılır. Etiketler: `feat` + `frontend`.
- [ ] PR gövdesinde spec ve bu plan linklenir; `destroyed`'ın kontrast
      ölçümü bilerek alınmış karar olarak yazılır.

## Umut'a hatırlatılacak

- [ ] **`accent-hover: #71dfdf` türetilmiş bir değerdir, EVE'de karşılığı
      yoktur.** EVE'nin teal düğmesi hover'da dolgusunu hiç değiştirmiyor —
      sadece `color` geçişi var. Bu değer, birincil düğme etrafındaki her
      kontrol işaretçiye cevap verirken tek başına sessiz kalmasın diye
      `+0.06 oklch L` ile üretildi. Uygulama bittiğinde Umut'a sorulacak:
      ekranda görüp EVE'ye birebir sadakat mi isteniyor (hover kalkar), yoksa
      bu mu kalsın? Kullanıcı bu hatırlatmayı açıkça istedi.

---

### Task 12: `danger` / `success` / `caution` jetonlarını bugünkü değerleriyle ekle

> **Sıra: bu görev Görev 5'ten ÖNCE çalışır.** Spec kararı 3b.

Görev 1'in aynısı, üç yeni ad için. Hepsi bugünkü palet değerine bağlanıyor,
yani bu görev sonunda ekranda hiçbir şey değişmiyor.

**Files:**

- Modify: `frontend/src/app/globals.css` (`@theme` bloğu)

**Interfaces:**

- Consumes: yok.
- Produces: `--color-danger`, `--color-success`, `--color-caution` — Görev 13
  bunları yazar, Görev 5 değerlerini çevirir.

- [ ] **Step 1: Jetonları ekle**

`@theme` içinde, `--color-isk` satırından hemen sonra:

```css
/* The other meanings red, green and yellow carry here. Same values as the
     three above for now; named separately because they say different things
     and either can move without dragging the other. */
--color-danger: var(--color-red-400);
--color-success: var(--color-green-400);
--color-caution: var(--color-yellow-400);
```

- [ ] **Step 2: Hiçbir şeyin değişmediğini doğrula**

Run: `cd frontend && yarn build:check`
Expected: başarılı. Jetonlar tanımlanıyor ama henüz kullanılmıyor.

- [ ] **Step 3: Biçim ve commit**

```bash
npx prettier --check .
git add frontend/src/app/globals.css
git commit -m "refactor(frontend): name danger, success and caution"
```

---

### Task 13: `danger` / `success` / `caution` taraması

> **Sıra: bu görev Görev 5'ten ÖNCE çalışır.** Spec kararı 3b.

Görev 3 gibi, **sed değil, tek tek okuma.** Yaklaşık 60 site.

**Files:**

- Modify: `frontend/src/**/*.tsx`, `frontend/src/app/buttons.css`

**Interfaces:**

- Consumes: Görev 12'nin üç jetonu.
- Produces: yok.

- [ ] **Step 1: Kalan ham sinyal sitelerini listele**

```bash
cd frontend/src
grep -rn --include='*.tsx' --include='*.css' -E '(text|bg|border)-(red|green|yellow)-(400|500|600)' .
```

- [ ] **Step 2: Her siteyi anlamına göre ayır**

| Görülen                                                            | Jeton       |
| ------------------------------------------------------------------ | ----------- |
| `Error:` mesajı, hata durumu                                       | `danger`    |
| `.button-danger` görünümü                                          | `danger`    |
| Kaybedilen egemenlik, eksi üye değişimi                            | `danger`    |
| Servis sağlığı (çalışıyor/bağlı), auth başarısı, changelog feature | `success`   |
| Kazanılan egemenlik, artı üye değişimi                             | `success`   |
| Uyarı, bekleyen durum, devredilen egemenlik                        | `caution`   |
| `utils/security.ts` dönüşleri                                      | **dokunma** |
| Ticker (ittifak sarısı, kurum yeşili)                              | **dokunma** |
| `.eve-description` bağlantısı                                      | **dokunma** |
| Saldıran/savunan çiftinin kırmızı yarısı                           | **dokunma** |
| Kategori paleti (ör. `workers` sayfasının dokuz renkli anahtarı)   | **dokunma** |

Son dördü bu dalda cyan tarafında zaten aynı gerekçeyle ham palete geri
alındı; kırmızı tarafı onunla aynı yerde kalmalı.

- [ ] **Step 3: Hata mesajlarının zeminini doğrula**

Spec kararı 3c: `danger` `ground` üstünde 5.29 ölçüyor ve geçiyor, `surface`
üstünde 3.93 ölçüyor ve geçmiyor. Her hata mesajı için hangi zeminde durduğuna
bak. Kart yüzeyinde duran varsa dönüştürme — o siteyi raporda listele, karar
kullanıcıya ait.

- [ ] **Step 4: Değişiklikleri uygula ve bırakılanlara iz bırak**

Dönüştürdüğün satırın yanında kalan ham bir site varsa, tek satırlık bir yorumla
hangi anlamı taşıdığını yaz — Görev 3'teki kalıp.

- [ ] **Step 5: Kapı**

```bash
cd frontend && yarn typecheck && yarn test && yarn lint && yarn build:check
npx prettier --check .    # KÖKTEN, frontend/ içinden değil
```

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(frontend): write danger, success and caution at their call sites"
```
