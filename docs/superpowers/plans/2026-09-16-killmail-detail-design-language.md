# Killmail detay sayfası: tasarım diline hizalama — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Killmail detay sayfasını uygulamanın tasarım diline hizalamak; bu
arada `KillmailSummaryCard`'a grid/tablo görünümü ile patlayan/düşen filtresi
eklemek ve `AttackerRow`'u sadeleştirmek.

**Architecture:** Paylaşılan katman iki dosyada büyüyor — `globals.css`'e üç
anlam jetonu, `cards.css`'e `.tag` — ve `ui/` rafına tek bir `SummaryRow`
primitive'i giriyor. Geri kalan her şey dört bileşen ağacının içinde: sol
kolonun tek kartı ikiye bölünüp yer değiştiriyor, `FittingSection` iki düzen
birden taşıyor, `KillmailSummaryCard` sekme ve görünüm durumunu sahipleniyor.

**Tech Stack:** Next.js 16.3.3 (App Router), React, Tailwind CSS v4 (`@theme`),
Vitest 5 + `@testing-library/react` + `@testing-library/user-event`, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-16-killmail-detail-design-language-design.md`

## Global Constraints

- **Yarn only, asla npm.** `yarn`, `yarn workspace frontend <script>`.
- **Kod yazmadan önce** `node_modules/next/dist/docs/01-app` altındaki ilgili
  bölüm okunur — `frontend/AGENTS.md` bunu şart koşuyor (Next 16.3.3, kök
  `node_modules`'da).
- **Commit ve PR metinleri İngilizce**, `type(scope):` sonrası tamamı küçük
  harf. **Claude atıfı yok** — `Co-Authored-By` veya "Generated with" satırı
  eklenmez.
- **Üretilmiş dosyalar elle düzenlenmez** (`src/generated/graphql.ts`).
- **Doğrulama komutları** (her görevin sonunda ilgili olanlar):
  `yarn workspace frontend typecheck`, `test`, `lint`,
  `build:check` (`NEXT_DIST_DIR=.next-check`, çalışan dev sunucusunu ezmez).
  `build` kullanılmaz.
- **Biçim:** commit öncesi `npx prettier --check <dokunulan dosyalar>`. CI'da
  Format işi tüm repoyu `prettier --check .` ile tarıyor.
- **Derinlik jetonları:** `bg-ground` → `bg-surface` → `bg-surface-inset`.
  Aksan cyan. Yarıçap yok; yarıçap alan tek sınıf `.float`.
- **Sınıf dizesi değişiklikleri test edilemez** (CLAUDE.md): `test` ve `lint`
  bir Tailwind sınıfının değiştiğini göremez. O görevlerde kapı
  `typecheck` + `lint` + `build:check` + plandaki `grep` doğrulamaları;
  görsel doğrulama kullanıcıya ait. Davranış ekleyen görevlerde (8-10) test
  zorunlu ve önce yazılıyor.
- **`lint` temiz çıkmıyor** — repo genelinde önceden var olan uyarılar var.
  Ölçüt sayının `main` ile aynı kalması ve listede dokunulan dosyaların
  bulunmaması.

---

### Task 1: `ui/SummaryRow`

Etiket/değer satırı bugün 10 kopya: `page.tsx`'te 7, `KillmailSummaryCard`'ta 3. Önce paylaşılan primitive, sonra çağrı yerleri.

**Files:**

- Create: `frontend/src/components/ui/SummaryRow.tsx`
- Test: `frontend/src/components/ui/SummaryRow.spec.tsx`

**Interfaces:**

- Consumes: yok.
- Produces: `export default function SummaryRow({ label, children }: SummaryRowProps)`,
  `export interface SummaryRowProps { label: ReactNode; children: ReactNode }`.
  Görev 3 ve 9 bunu `@/components/ui/SummaryRow`'dan import eder.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`frontend/src/components/ui/SummaryRow.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SummaryRow from './SummaryRow';

describe('SummaryRow', () => {
  it('renders the label and the value', () => {
    render(<SummaryRow label="System">Jita</SummaryRow>);

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Jita')).toBeInTheDocument();
  });

  it('keeps the label muted and the value prominent', () => {
    render(<SummaryRow label="System">Jita</SummaryRow>);

    expect(screen.getByText('System')).toHaveClass('text-gray-400');
    expect(screen.getByText('Jita')).toHaveClass('text-gray-100');
  });

  it('lets the value carry its own colour', () => {
    render(
      <SummaryRow label="Destroyed">
        <span className="text-destroyed">1.2M</span>
      </SummaryRow>,
    );

    expect(screen.getByText('1.2M')).toHaveClass('text-destroyed');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/ui/SummaryRow.spec.tsx`
Expected: FAIL — `Failed to resolve import "./SummaryRow"`.

- [ ] **Step 3: Bileşeni yaz**

`frontend/src/components/ui/SummaryRow.tsx`:

```tsx
import { ReactNode } from 'react';

export interface SummaryRowProps {
  /** Solda duran, sönük etiket. */
  label: ReactNode;
  /** Sağda duran değer. Kendi rengi varsa (ISK, hasar) çağıran verir:
   *  iç içe bir eleman kendi renk sınıfını taşır ve buradaki gri onu
   *  etkilemez. */
  children: ReactNode;
}

/**
 * Bir etiket/değer satırı: solda ne olduğu, sağda değeri.
 *
 * Bu dize 10 kopyada vardı — `app/killmails/[id]/page.tsx`'te 7,
 * `KillmailSummaryCard`'ta 3 — ve her kopyada etiket de değer de aynı griydi,
 * yani blok tek düz bir yüzey gibi okunuyordu.
 */
export default function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-gray-400">{label}</span>
      <span className="text-right text-gray-100">{children}</span>
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `yarn workspace frontend test src/components/ui/SummaryRow.spec.tsx`
Expected: PASS — 3 test.

- [ ] **Step 5: Tipleri doğrula ve commit'le**

```bash
yarn workspace frontend typecheck
npx prettier --check frontend/src/components/ui/SummaryRow.tsx frontend/src/components/ui/SummaryRow.spec.tsx
git add frontend/src/components/ui/SummaryRow.tsx frontend/src/components/ui/SummaryRow.spec.tsx
git commit -m "feat(ui): add a summary row primitive for label/value pairs"
```

---

### Task 2: Anlam jetonları ve `.tag`

**Files:**

- Modify: `frontend/src/app/globals.css` (`@theme` bloğu, ~satır 12-26)
- Modify: `frontend/src/app/cards.css` (dosya sonu, `@layer components` içi)
- Modify: `frontend/src/components/AttackersCard/AttackerRow.tsx:139-158`
- Modify: `frontend/src/app/killmails/[id]/page.tsx` (WAR KILL rozeti)

**Interfaces:**

- Consumes: yok.
- Produces: `text-destroyed`, `text-dropped`, `text-isk` ve `bg-destroyed/N`,
  `bg-dropped/N` yardımcı sınıfları; `.tag` bileşen sınıfı. Görev 3, 6 ve 8
  bunları kullanır.

- [ ] **Step 1: Üç jetonu ekle**

`frontend/src/app/globals.css`, `@theme` bloğunun içine, `--color-accent`
satırından sonra:

```css
/* Anlam renkleri. Aynı anlam iki değerde yazılmıştı: yıkılan hem
   text-red-400 hem bg-red-700/40 idi. Hasar da destroyed'i kullanır —
   ayrı bir --color-damage aynı değerin ikinci adı olurdu. */
--color-destroyed: var(--color-red-400);
--color-dropped: var(--color-green-400);
--color-isk: var(--color-yellow-400);
```

- [ ] **Step 2: `.tag`'i ekle**

`frontend/src/app/cards.css`, `@layer components` bloğunun sonuna, `.chip`
tanımından sonra:

```css
/* Bir durum rozeti: FINAL BLOW, TOP DAMAGE, SOLO, NPC (AttackerRow) ve
   WAR KILL (page.tsx). Beş kopyada vardı, dördü yarıçap taşıyordu ve
   sayfada yarıçap alan tek şey .float. SOLO kopyası text-xs'i de
   düşürmüştü, yani komşularından büyük yazılıyordu. Rengi kendisi
   taşımaz — çağıran anlam jetonunu verir. */
.tag {
  @apply inline-flex items-center px-2 py-0.5 text-xs font-medium;
}
```

- [ ] **Step 3: `AttackerRow`'daki dört rozeti `.tag`'e çevir**

`frontend/src/components/AttackersCard/AttackerRow.tsx`, rozet şeridi
(`{/* Badges for Final Blow, Top Damage, Solo, and NPC */}` altındaki dört
`<span>`):

```tsx
{
  isFinalBlow && !isSolo && (
    <span className="tag text-destroyed bg-destroyed/10">FINAL BLOW</span>
  );
}
{
  isTopDamage && !isSolo && (
    <span className="tag text-orange-400 bg-orange-400/10">TOP DAMAGE</span>
  );
}
{
  isSolo && <span className="tag text-dropped bg-dropped/10">SOLO</span>;
}
{
  isNpcAttackers && (
    <span className="tag text-destroyed bg-destroyed/10">NPC</span>
  );
}
```

TOP DAMAGE turuncu kalıyor: üç anlam jetonu yıkılan / düşen / ISK için, "en
çok hasar" bunların hiçbiri değil.

- [ ] **Step 4: WAR KILL rozetini `.tag`'e çevir**

`frontend/src/app/killmails/[id]/page.tsx`, `km.isWarRelated` bloğundaki
`<span>`:

```tsx
<span className="tag text-orange-400 bg-orange-400/10">
  WAR KILL — sovereignty campaign
</span>
```

Eski dizedeki `border`, `border-orange-400/20` ve `font-semibold` gidiyor:
`.tag` kenarlık taşımıyor ve ağırlığı `font-medium`.

- [ ] **Step 5: Hiç `rounded` kalmadığını doğrula**

```bash
grep -rnE '\brounded(-[a-z0-9]+)?\b' \
  "frontend/src/app/killmails/[id]/page.tsx" \
  frontend/src/components/AttackersCard | grep -v rounded-full
```

Expected: çıktı yok.

- [ ] **Step 6: Doğrula ve commit'le**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend build:check
npx prettier --check frontend/src/app/globals.css frontend/src/app/cards.css \
  frontend/src/components/AttackersCard/AttackerRow.tsx \
  "frontend/src/app/killmails/[id]/page.tsx"
git add frontend/src/app/globals.css frontend/src/app/cards.css \
  frontend/src/components/AttackersCard/AttackerRow.tsx \
  "frontend/src/app/killmails/[id]/page.tsx"
git commit -m "feat(ui): add semantic colour tokens and a tag class for status badges"
```

---

### Task 3: `page.tsx` — iki kart, yer değişimi, `SummaryRow`

**Files:**

- Modify: `frontend/src/app/killmails/[id]/page.tsx`

**Interfaces:**

- Consumes: Görev 1'in `SummaryRow`'u, Görev 2'nin jetonları.
- Produces: yok.

- [ ] **Step 1: Import'u ekle**

```tsx
import SummaryRow from '@/components/ui/SummaryRow';
```

- [ ] **Step 2: Tek kartı ikiye böl ve yerlerini değiştir**

Bugünkü sarmalayıcı (dıştaki `card` + `victim-card` + iç grid) yerine:

```tsx
<div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
  {/* Kurban özeti — solda, 1/3 */}
  <div className="p-2 card lg:col-span-1">
    <div className="space-y-3">{/* …mevcut özet içeriği… */}</div>
  </div>

  {/* Fit ekranı — sağda, 2/3 */}
  <div
    className={
      isStructure
        ? 'px-2 pt-2 pb-24 card lg:col-span-2'
        : 'p-2 card lg:col-span-2'
    }
  >
    {/* …mevcut buton şeridi ve <FitScreen /> … */}
  </div>
</div>
```

Üç şey aynı anda oluyor: dış `card` kalkıyor (zemini grid'in boşluğu
`bg-ground` göstersin diye), ölü `victim-card` siliniyor, ve özet fit'ten önce
geliyor. `isStructure`'ın `pb-24`'ü artık yalnızca fit kartında — özeti
ilgilendirmiyordu.

- [ ] **Step 3: Yedi etiket/değer satırını `SummaryRow`'a çevir**

Ship, System, Time, Damage, Destroyed, Dropped, Total satırları. Örnekler:

```tsx
<SummaryRow label="Ship">
  {victim?.shipType?.name}
  {victim?.shipType?.group && (
    <span className="text-gray-500"> ({victim.shipType.group.name})</span>
  )}
</SummaryRow>

<SummaryRow label="Damage">
  <span className="text-destroyed tabular-nums">
    {victim?.damageTaken?.toLocaleString()}
  </span>
</SummaryRow>

<SummaryRow label="Destroyed">
  <span className="text-destroyed tabular-nums">{formatISK(destroyedValue)}</span>
</SummaryRow>

<SummaryRow label="Dropped">
  <span className="text-dropped tabular-nums">{formatISK(droppedValue)}</span>
</SummaryRow>

<SummaryRow label="Total">
  <span className="font-bold text-isk tabular-nums">{formatISK(totalValue)}</span>
</SummaryRow>
```

System satırındaki güvenlik durumu renkleri (`text-green-400` /
`text-yellow-400` / `text-red-400`) **olduğu gibi kalıyor**: bunlar EVE'nin
kendi güvenlik kodu, anlam jetonu değil.

- [ ] **Step 4: Kalan dil sapmalarını düzelt**

- `bg-gray-800/50` → `bg-surface-inset` (yapı render'ının kutusu)
- Üç `hover:text-blue-400` → `hover:text-cyan-400` (karakter, kurum, ittifak
  bağlantıları)

- [ ] **Step 5: Ölü sınıfın ve eski dizelerin kalmadığını doğrula**

```bash
grep -n 'victim-card\|bg-gray-800\|text-blue-400\|flex justify-between' \
  "frontend/src/app/killmails/[id]/page.tsx"
```

Expected: çıktı yok.

- [ ] **Step 6: Doğrula ve commit'le**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend build:check
npx prettier --check "frontend/src/app/killmails/[id]/page.tsx"
git add "frontend/src/app/killmails/[id]/page.tsx"
git commit -m "refactor(killmail): split the fit and victim surfaces into two cards"
```

---

### Task 4: `AttackersCard` — başlık ve satırlar

**Files:**

- Modify: `frontend/src/components/AttackersCard/AttackersCard.tsx`

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: Başlık barını `.card-header` yap**

```tsx
<div className="flex justify-end card-header">
  <span className="text-lg font-semibold text-gray-100">
    {killmail.attackerCount} ATTACKERS
  </span>
</div>
```

`hover:bg-surface-inset` gidiyor: tıklanamayan bir başlığın hover'ı yoktu
olması gereken. `px-4 py-2 border-b border-white/10 bg-surface` da gidiyor —
hepsi `.card-header`'ın içinde, üstelik doğru zeminle (`bg-surface-inset`).

- [ ] **Step 2: Üç el yazısı satırı `.card-row` yap**

Üç yerde geçen
`flex items-center gap-2 px-3 py-2 transition-colors duration-100 bg-surface hover:bg-surface-inset`
dizesi yerine `flex items-center gap-2 card-row bg-surface`. `py-1.5` olan
kopyada o değer korunur: `flex items-center gap-2 card-row py-1.5 bg-surface`.

- [ ] **Step 3: Değer skalasını uygula**

`text-gray-300` olan isim/etiket alanları değer konumundaysa `text-gray-100`,
etiket konumundaysa `text-gray-400`. `hover:text-blue-400` →
`hover:text-cyan-400`.

- [ ] **Step 4: Doğrula ve commit'le**

```bash
grep -n 'text-blue-400\|hover:bg-surface-inset' frontend/src/components/AttackersCard/AttackersCard.tsx
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend build:check
npx prettier --check frontend/src/components/AttackersCard/AttackersCard.tsx
git add frontend/src/components/AttackersCard/AttackersCard.tsx
git commit -m "refactor(killmail): use the card header and row vocabulary in the attackers card"
```

Step 4'teki `grep` çıktı vermemeli.

---

### Task 5: `AttackerRow` — görsel yuvası

Rozetlerin üç dalda da çalışması için yuva tek bir `relative` sarmalayıcıya
alınıyor; ölçüler 64/32'ye iniyor; NPC yazısı geminin render'ına bırakıyor.

**Files:**

- Modify: `frontend/src/components/AttackersCard/AttackerRow.tsx:34-110`

**Interfaces:**

- Consumes: yok.
- Produces: tek `<div className="relative shrink-0">` yuvası. Görev 6
  rozetleri buraya koyar.

- [ ] **Step 1: Next.js kılavuzunu oku**

Run: `ls /root/killreport/node_modules/next/dist/docs/01-app`
Görsel ve `<img>` ile ilgili bölümü oku. Bu dosyada `next/image` kullanılmıyor,
düz `<img>` var; kılavuz bunun hâlâ geçerli olduğunu doğrulamak için.

- [ ] **Step 2: Üç dalı tek sarmalayıcıya al**

```tsx
<div className="relative shrink-0">
  {attacker.character?.id ? (
    <img
      src={`https://images.evetech.net/characters/${attacker.character.id}/portrait?size=128`}
      alt={attacker.character.name || 'Character'}
      width={64}
      height={64}
      loading="lazy"
    />
  ) : attacker.corporation?.id ? (
    <img
      src={`https://images.evetech.net/corporations/${attacker.corporation.id}/logo?size=128`}
      alt={attacker.corporation.name || 'Corporation'}
      width={64}
      height={64}
      loading="lazy"
    />
  ) : (
    <img
      src={`https://images.evetech.net/types/${attacker.shipType?.id}/render?size=128`}
      alt={attacker.shipType?.name || 'NPC ship'}
      width={64}
      height={64}
      loading="lazy"
    />
  )}

  {attacker.securityStatus !== null &&
    attacker.securityStatus !== undefined && (
      <div className="absolute bottom-0 left-0 px-1.5 py-0.5 text-xs font-semibold bg-black/70 backdrop-blur-sm">
        <span
          className={
            attacker.securityStatus >= 0 ? 'text-dropped' : 'text-destroyed'
          }
        >
          {attacker.securityStatus.toFixed(1)}
        </span>
      </div>
    )}
</div>
```

Kalkan şey `text-2xl font-bold text-red-500">NPC</span>` ve onu saran 96×96
kutu. Güvenlik rozeti bugün yalnızca karakter dalının içindeydi; sarmalayıcıya
çıkınca üç dalda da çalışıyor.

- [ ] **Step 3: Gemi ve silah yuvalarını 32'ye indir**

Aynı dosyadaki gemi render'ı ve silah ikonu: `width={48} height={48}` →
`width={32} height={32}`, kaynak `?size=128` → `?size=64`. Tier rozeti
`className="size-4"` olduğu gibi kalıyor.

Bilinmiyor kutuları: `size-12` ve `w-12 h-12` → `size-8`; içlerindeki
`w-8 h-8` ikon → `size-4`. `bg-gray-800` → `bg-surface-inset`.

- [ ] **Step 4: Eski ölçü kalmadığını doğrula**

```bash
grep -n 'width={96}\|width={48}\|size-12\|w-12 h-12\|bg-gray-800\|>NPC<' \
  frontend/src/components/AttackersCard/AttackerRow.tsx
```

Expected: çıktı yok.

- [ ] **Step 5: Doğrula ve commit'le**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend build:check
npx prettier --check frontend/src/components/AttackersCard/AttackerRow.tsx
git add frontend/src/components/AttackersCard/AttackerRow.tsx
git commit -m "refactor(killmail): size the attacker images 64/32 and show the npc ship"
```

---

### Task 6: `AttackerRow` — rozetler, logolar, isim, `DMG`

Buradaki isim önceliği gerçek bir davranış, o yüzden testle başlıyor.

**Files:**

- Modify: `frontend/src/components/AttackersCard/AttackerRow.tsx`
- Test: `frontend/src/components/AttackersCard/AttackerRow.spec.tsx` (yeni)

**Interfaces:**

- Consumes: Görev 5'in `relative` yuvası, Görev 2'nin `.tag` sınıfı.
- Produces: yok.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`frontend/src/components/AttackersCard/AttackerRow.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AttackerRow from './AttackerRow';

const killmail = { solo: false, npc: false } as any;

const attacker = (overrides: Record<string, unknown> = {}) =>
  ({
    damageDone: 1234,
    finalBlow: false,
    securityStatus: 0.5,
    character: { id: 1, name: 'Pilot One' },
    corporation: { id: 2, name: 'Corp Two' },
    alliance: { id: 3, name: 'Alliance Three' },
    shipType: { id: 587, name: 'Rifter', dogmaAttributes: [] },
    weaponType: { id: 2456, name: 'Rocket Launcher' },
    ...overrides,
  }) as any;

const renderRow = (a: any) =>
  render(
    <AttackerRow
      attacker={a}
      killmail={killmail}
      totalDamage={10000}
      isFinalBlow={false}
      isTopDamage={false}
    />,
  );

describe('AttackerRow', () => {
  it('shows the alliance name and not the corporation name', () => {
    renderRow(attacker());

    expect(screen.getByText('Alliance Three')).toBeInTheDocument();
    expect(screen.queryByText('Corp Two')).toBeNull();
  });

  it('falls back to the corporation name when there is no alliance', () => {
    renderRow(attacker({ alliance: null }));

    expect(screen.getByText('Corp Two')).toBeInTheDocument();
  });

  it('prints the damage without a DMG suffix', () => {
    renderRow(attacker());

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.queryByText(/DMG/)).toBeNull();
  });

  it('drops the alliance and corporation logos', () => {
    const { container } = renderRow(attacker());

    expect(container.querySelector('img[src*="/alliances/"]')).toBeNull();
    expect(container.querySelector('img[src*="/corporations/"]')).toBeNull();
  });

  it('puts the final blow badge inside the portrait slot', () => {
    render(
      <AttackerRow
        attacker={attacker()}
        killmail={killmail}
        totalDamage={10000}
        isFinalBlow={true}
        isTopDamage={false}
      />,
    );

    const badge = screen.getByText('FINAL BLOW');
    expect(badge).toHaveClass('tag');

    // Rozetin bulunduğu konumlandırma kabı, portrenin kendisini tutan kap
    // olmalı. `.relative`i sırayla aramak kırılgan — tier rozeti de relative;
    // onun yerine kabın içinde portre var mı diye soruyoruz.
    const slot = badge.closest('.relative');
    expect(slot?.querySelector('img[src*="/characters/"]')).not.toBeNull();
  });
});
```

Dördüncü test, karakteri olan bir saldıranda kurum logosunun hiç çizilmediğini
doğruluyor — portre yuvasında karakter dalı seçili olduğu için orada da kurum
görseli yok.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/AttackersCard/AttackerRow.spec.tsx`
Expected: FAIL — `Corp Two` hem ittifakla birlikte çiziliyor, `1,234 DMG`
metni `1,234` ile eşleşmiyor, logolar duruyor.

- [ ] **Step 3: Rozetleri portre yuvasına taşı**

Görev 5'te kurulan `relative shrink-0` sarmalayıcısının içine, güvenlik
rozetinden **önce**:

```tsx
<div className="absolute z-10 flex flex-col items-center gap-0.5 -translate-x-1/2 top-1 left-1/2">
  {isFinalBlow && !isSolo && (
    <span className="tag text-destroyed bg-destroyed/10 whitespace-nowrap">
      FINAL BLOW
    </span>
  )}
  {isTopDamage && !isSolo && (
    <span className="tag text-orange-400 bg-orange-400/10 whitespace-nowrap">
      TOP DAMAGE
    </span>
  )}
</div>
```

`whitespace-nowrap` şart: rozet portreden geniş ve sarılırsa iki satıra iner.
`flex-col` ikisi birden varsa alt alta dizer. İsim bloğundaki rozet şeridinden
bu iki `<span>` siliniyor; SOLO ve NPC orada kalıyor.

- [ ] **Step 4: Logoları sil**

`{/* Alliance & Corporation Logos - Bottom Right */}` yorumundan başlayan
`<div className="flex">` bloğunun tamamı siliniyor. Onu saran
`flex flex-col items-end justify-between` artık tek çocuk taşıdığı için
`justify-between` da gidiyor.

- [ ] **Step 5: İsim önceliğini uygula**

Karakter dalındaki kurum bağlantısı ve bloğun altındaki ayrı ittifak bağlantısı
yerine tek bir bağlantı:

```tsx
{
  attacker.alliance?.id ? (
    <Tooltip content="Show Alliance Info">
      <Link
        href={`/alliances/${attacker.alliance.id}`}
        className="text-sm text-gray-400 hover:text-cyan-400"
        prefetch={false}
      >
        {attacker.alliance.name || 'Unknown'}
      </Link>
    </Tooltip>
  ) : attacker.corporation?.id ? (
    <Tooltip content="Show Corporation Info">
      <Link
        href={`/corporations/${attacker.corporation.id}`}
        className="text-sm text-gray-400 hover:text-cyan-400"
        prefetch={false}
      >
        {attacker.corporation.name || 'Unknown'}
      </Link>
    </Tooltip>
  ) : null;
}
```

Bu blok hem karakterli hem NPC dalında aynı; iki dalın ortak kuyruğu olarak bir
kez yazılır. Karakter adı ve gemi adı yerinde kalıyor; karakter adının
`hover:text-blue-400`'ü de `hover:text-cyan-400` oluyor.

- [ ] **Step 6: `DMG` ekini kaldır**

```tsx
<span className="text-destroyed">{attacker.damageDone.toLocaleString()}</span>
```

- [ ] **Step 7: Testleri çalıştır, geçtiklerini gör**

Run: `yarn workspace frontend test src/components/AttackersCard/AttackerRow.spec.tsx`
Expected: PASS — 5 test.

- [ ] **Step 8: Doğrula ve commit'le**

```bash
grep -n 'DMG\|text-blue-400' frontend/src/components/AttackersCard/AttackerRow.tsx
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend lint
yarn workspace frontend build:check
npx prettier --check frontend/src/components/AttackersCard/AttackerRow.tsx \
  frontend/src/components/AttackersCard/AttackerRow.spec.tsx
git add frontend/src/components/AttackersCard/AttackerRow.tsx \
  frontend/src/components/AttackersCard/AttackerRow.spec.tsx
git commit -m "refactor(killmail): quiet the attacker row down to one org name and two badges"
```

Step 8'deki `grep` çıktı vermemeli.

---

### Task 7: `FeaturedAttackerCard`

**Files:**

- Modify: `frontend/src/components/AttackersCard/FeaturedAttackerCard.tsx`

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: Üç düzeltmeyi yap**

- `:22` `p-4 inset-ring inset-ring-white/10` → `p-4 card`. `.card` zaten
  `border bg-surface border-white/10`; `inset-ring` uygulamanın çerçevesi
  değil. İçerik 1px kayar.
- `:112` `font-semibold text-red-400 text-md` → `font-semibold text-destroyed`.
  `text-md` Tailwind'de yok, sessizce hiçbir şey yapmıyordu; kaldırılınca metin
  `text-base`'e (gövde ölçüsü) düşüyor, yani görünen boyut değişmiyor.
- `:113` `{attacker.damageDone.toLocaleString()} DMG` → `DMG` eki kalkıyor.
- `hover:text-blue-400` → `hover:text-cyan-400`.

- [ ] **Step 2: Doğrula ve commit'le**

```bash
grep -n 'text-md\|inset-ring\|DMG\|text-blue-400' frontend/src/components/AttackersCard/FeaturedAttackerCard.tsx
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend build:check
npx prettier --check frontend/src/components/AttackersCard/FeaturedAttackerCard.tsx
git add frontend/src/components/AttackersCard/FeaturedAttackerCard.tsx
git commit -m "fix(killmail): drop the dead text-md class from the featured attacker card"
```

Step 2'deki `grep` çıktı vermemeli.

---

### Task 8: Fitting bölümlerinde grid görünümü

Satır başına ~760px boş pikseli bitiren düzen. Filtre bir sonraki görevde;
burada yalnızca iki düzen ve aralarındaki seçim propu.

**Files:**

- Create: `frontend/src/components/KillmailSummaryCard/types.ts`
- Modify: `frontend/src/components/KillmailSummaryCard/FittingItem.tsx`
- Modify: `frontend/src/components/KillmailSummaryCard/FittingSection.tsx`
- Modify: `frontend/src/components/KillmailSummaryCard/KillmailSummaryCard.tsx`
- Test: `frontend/src/components/KillmailSummaryCard/FittingSection.spec.tsx` (yeni)

**Interfaces:**

- Consumes: Görev 2'nin jetonları.
- Produces:
  - `export type FittingView = 'grid' | 'table'`
  - `export type FittingScope = 'all' | 'destroyed' | 'dropped'` (Görev 9 kullanır)
  - `FittingSection` propları: `{ title, items, keyPrefix, hasCharges?, view }`
  - `FittingItem` propları: `{ item, keyPrefix, index, isCharge?, view }`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`frontend/src/components/KillmailSummaryCard/FittingSection.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FittingSection from './FittingSection';

const item = (id: number, name: string) => ({
  itemType: { id, name, jitaPrice: { sell: 1_000_000 } },
  singleton: 0,
  quantityDestroyed: 1,
  quantityDropped: 0,
});

describe('FittingSection', () => {
  it('lays the items out in a grid in grid view', () => {
    const { container } = render(
      <FittingSection
        title="High Slots"
        items={[item(1, 'Gatling'), item(2, 'Salvager')]}
        keyPrefix="high"
        view="grid"
      />,
    );

    const list = container.querySelector('.grid');
    expect(list).not.toBeNull();
    expect(list).toHaveClass('2xl:grid-cols-3');
    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(screen.getByText('Salvager')).toBeInTheDocument();
  });

  it('keeps the stacked rows in table view', () => {
    const { container } = render(
      <FittingSection
        title="High Slots"
        items={[item(1, 'Gatling')]}
        keyPrefix="high"
        view="table"
      />,
    );

    expect(container.querySelector('.grid')).toBeNull();
    expect(container.querySelector('.divide-y')).not.toBeNull();
  });

  it('renders nothing when it has no items', () => {
    const { container } = render(
      <FittingSection title="Rigs" items={[]} keyPrefix="rig" view="grid" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/KillmailSummaryCard/FittingSection.spec.tsx`
Expected: FAIL — `view` propu yok, `.grid` bulunamıyor.

- [ ] **Step 3: Tipleri yaz**

`frontend/src/components/KillmailSummaryCard/types.ts`:

```ts
/** Fitting listesinin iki düzeni: yeni grid ve korunan klasik tablo. */
export type FittingView = 'grid' | 'table';

/** Patlayan/düşen filtresinin üç hâli. */
export type FittingScope = 'all' | 'destroyed' | 'dropped';
```

- [ ] **Step 4: `FittingItem`'a `view` ekle**

`FittingItemProps`'a `view: FittingView` eklenir. İki sabit kolon görünüme
göre daralır — grid'de hücre ~400px, tabloda satır ~1200px:

```tsx
const priceWidth = view === 'grid' ? 'w-20' : 'w-40';
const quantityWidth = view === 'grid' ? 'w-10' : 'w-16';
```

`renderQuantity` modül düzeyinde bir fonksiyon ve genişliği sabit yazıyor
(dört dalında da `w-16`), o yüzden genişliği parametre alır:

```tsx
const renderQuantity = (
  destroyed: number,
  dropped: number,
  widthClass: string,
) => {
  const hasDestroyed = destroyed > 0;
  const hasDropped = dropped > 0;

  if (hasDestroyed && hasDropped) {
    return (
      <div className={`flex flex-col ${widthClass} leading-tight`}>
        <span>{destroyed}</span>
        <span>{dropped}</span>
      </div>
    );
  } else if (hasDestroyed) {
    return <div className={widthClass}>{destroyed}</div>;
  } else if (hasDropped) {
    return <div className={widthClass}>{dropped}</div>;
  } else {
    return <div className={widthClass}>1</div>;
  }
};
```

Çağrısı: `renderQuantity(item.quantityDestroyed, item.quantityDropped, quantityWidth)`.

`<div className={`flex items-center gap-4 text-right`}>` içindeki fiyat
`<div className={`${priceWidth} pr-2 tabular-nums`}>` olur. İsim alanına
`title` eklenir:

```tsx
<div className="flex-1 min-w-0 pl-2">
  <div className="truncate" title={getItemName(item.itemType, item.singleton)}>
    {getItemName(item.itemType, item.singleton)}
  </div>
</div>
```

Zemin renkleri jetona geçer:

```tsx
const bgColor = isDestroyed
  ? 'hover:bg-destroyed/30 bg-destroyed/20'
  : isDropped
    ? 'hover:bg-dropped/30 bg-dropped/20'
    : '';
```

- [ ] **Step 5: `FittingSection`'a iki düzeni koy**

`FittingSectionProps`'a `view: FittingView` eklenir. Ölü `fitting-section`
sınıfı kalkar. Liste kabı:

```tsx
const listClass =
  view === 'grid'
    ? 'grid grid-cols-1 gap-px sm:grid-cols-2 2xl:grid-cols-3'
    : 'flex flex-col divide-y divide-white/10';
```

```tsx
<div className="border-b border-white/10">
  <h3 className="py-2 pl-2 font-bold text-gray-400 uppercase">{title}</h3>
  <div className={listClass}>
    {groupedModules.map((item, index) => (
      <FittingItem
        key={`${keyPrefix}-module-${item.itemType.id}-${index}`}
        item={item}
        keyPrefix={`${keyPrefix}-module`}
        index={index}
        view={view}
      />
    ))}

    {groupedCharges.map((item, index) => (
      <FittingItem
        key={`${keyPrefix}-charge-${item.itemType.id}-${index}`}
        item={item}
        keyPrefix={`${keyPrefix}-charge`}
        index={index}
        isCharge={true}
        view={view}
      />
    ))}
  </div>
</div>
```

`gap-px` grid'de hücreleri ayıran saç teli — tablo görünümündeki `divide-y`nin
karşılığı.

- [ ] **Step 6: `KillmailSummaryCard`'ı geçici olarak grid'e sabitle**

Her `<FittingSection …>` çağrısına `view="grid"` eklenir. Görev 10 bunu duruma
bağlayacak. Ayrıca `:42`'deki el yazısı yüzey `card` sınıfına çevrilir:

```tsx
<div className="card">
```

- [ ] **Step 7: Testleri çalıştır, geçtiklerini gör**

Run: `yarn workspace frontend test src/components/KillmailSummaryCard`
Expected: PASS — 3 test.

- [ ] **Step 8: Doğrula ve commit'le**

```bash
grep -n 'fitting-section\|bg-red-700\|bg-green-700' frontend/src/components/KillmailSummaryCard/*.tsx
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend build:check
npx prettier --check frontend/src/components/KillmailSummaryCard/
git add frontend/src/components/KillmailSummaryCard/
git commit -m "feat(killmail): lay the fitting sections out as a grid"
```

Step 8'deki `grep` çıktı vermemeli.

---

### Task 9: Patlayan/düşen filtresi

**Files:**

- Modify: `frontend/src/components/KillmailSummaryCard/FittingSection.tsx`
- Modify: `frontend/src/components/KillmailSummaryCard/KillmailSummaryCard.tsx`
- Test: `frontend/src/components/KillmailSummaryCard/KillmailSummaryCard.spec.tsx` (yeni)

**Interfaces:**

- Consumes: Görev 8'in `FittingScope` tipi ve `FittingSection`'ı,
  `hooks/useTabList.ts`.
- Produces: `FittingSection`'a `scope: FittingScope` propu.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`frontend/src/components/KillmailSummaryCard/KillmailSummaryCard.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import KillmailSummaryCard from './KillmailSummaryCard';

const slot = (
  id: number,
  name: string,
  destroyed: number,
  dropped: number,
) => ({
  module: {
    itemType: { id, name, jitaPrice: { sell: 1_000_000 } },
    singleton: 0,
    quantityDestroyed: destroyed,
    quantityDropped: dropped,
  },
});

const props = {
  victim: {
    shipType: {
      id: 587,
      name: 'Rifter',
      group: { name: 'Frigate' },
      dogmaAttributes: [],
    },
  },
  fitting: {
    highSlots: { slots: [slot(1, 'Gatling', 1, 0), slot(2, 'Salvager', 0, 1)] },
  },
  isStructure: false,
  destroyedValue: 5_000_000,
  droppedValue: 2_000_000,
  totalValue: 7_000_000,
} as any;

describe('KillmailSummaryCard', () => {
  it('starts on the All tab with every item shown', () => {
    render(<KillmailSummaryCard {...props} />);

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(screen.getByText('Salvager')).toBeInTheDocument();
  });

  it('shows only destroyed items on the Destroyed tab, ship included', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Destroyed' }));

    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(screen.queryByText('Salvager')).toBeNull();
    expect(screen.getByText('Rifter')).toBeInTheDocument();
  });

  it('hides the ship on the Dropped tab', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Dropped' }));

    expect(screen.getByText('Salvager')).toBeInTheDocument();
    expect(screen.queryByText('Gatling')).toBeNull();
    expect(screen.queryByText('Rifter')).toBeNull();
  });

  it('leaves the ISK totals alone whatever the tab says', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Dropped' }));

    expect(screen.getByText('Destroyed')).toBeInTheDocument();
    expect(screen.getByText('5.00M')).toBeInTheDocument();
    expect(screen.getByText('7.00M')).toBeInTheDocument();
  });
});
```

`userEvent` çağrıları `await` ister: tıklama state güncellemesini tetikliyor ve
beklenmezse iddialar eski DOM'a bakar.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/KillmailSummaryCard/KillmailSummaryCard.spec.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "tab"`.

- [ ] **Step 3: `FittingSection`'a filtre yüklemini koy**

`FittingSectionProps`'a `scope: FittingScope` eklenir. `groupItems`'ın
**sonrasında**, çünkü o fonksiyon her kalemi zaten patlayan ve/veya düşen
kayıtlara bölüyor:

```tsx
const keep = (entry: { quantityDestroyed: number; quantityDropped: number }) =>
  scope === 'all' ||
  (scope === 'destroyed' && entry.quantityDestroyed > 0) ||
  (scope === 'dropped' && entry.quantityDropped > 0);

const groupedModules = groupItems(modules).filter(keep);
const groupedCharges = hasCharges ? groupItems(charges).filter(keep) : [];
```

Bölüm süzme sonrası boşaldıysa hiç çizilmez — mevcut erken dönüş bunu
karşılamıyor (o, gelen `items` boşsa dönüyor), o yüzden süzmeden sonra ikinci
bir kontrol gerekiyor:

```tsx
if (groupedModules.length === 0 && groupedCharges.length === 0) {
  return null;
}
```

- [ ] **Step 4: `KillmailSummaryCard`'a sekmeleri koy**

Dosyanın en başına `'use client';` satırı eklenir — bileşen artık durum
tutuyor.

```tsx
const PANEL_ID = 'killmail-fitting-panel';

interface ScopeTab {
  scope: FittingScope;
  label: string;
}

const TABS: ScopeTab[] = [
  { scope: 'all', label: 'All' },
  { scope: 'destroyed', label: 'Destroyed' },
  { scope: 'dropped', label: 'Dropped' },
];

const TAB_SCOPES: FittingScope[] = TABS.map((tab) => tab.scope);
```

Bileşenin içinde:

```tsx
const [scope, setScope] = useState<FittingScope>('all');
const { onKeyDown } = useTabList(TAB_SCOPES, scope, setScope);
const tabId = (value: FittingScope) => `killmail-fitting-tab-${value}`;
```

Kartın en üstüne şerit:

```tsx
<div className="card-band">
  <div role="tablist" aria-label="Fitting items" className="flex gap-1">
    {TABS.map((tab) => (
      <button
        key={tab.scope}
        id={tabId(tab.scope)}
        role="tab"
        aria-selected={tab.scope === scope}
        aria-controls={PANEL_ID}
        tabIndex={tab.scope === scope ? 0 : -1}
        onClick={() => setScope(tab.scope)}
        onKeyDown={onKeyDown}
        className="button button-secondary button-sm"
      >
        {tab.label}
      </button>
    ))}
  </div>
</div>
```

Panel tek bir id taşır — sekme başına ayrı id verilse etkin olmayan sekmelerin
`aria-controls`'u DOM'da olmayan bir elemanı gösterirdi:

```tsx
<div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(scope)}>
  {/* Ship bloğu ve bütün FittingSection'lar */}
</div>
```

Ship bloğu filtreye uyar — gövde her zaman patlar, hiç düşmez:

```tsx
{victim?.shipType && scope !== 'dropped' && (
  /* …mevcut Ship bloğu… */
)}
```

Her `<FittingSection …>` çağrısına `scope={scope}` eklenir.

- [ ] **Step 5: Alttaki üç ISK satırını `SummaryRow`'a çevir**

Bu satırlar `tabpanel`'in **dışında** kalır: killmail'in toplamı, görünümün
değil.

```tsx
<div className="px-2 py-2 space-y-1">
  <SummaryRow label="Destroyed">
    <span className="text-destroyed tabular-nums">
      {formatISK(destroyedValue)}
    </span>
  </SummaryRow>
  <SummaryRow label="Dropped">
    <span className="text-dropped tabular-nums">{formatISK(droppedValue)}</span>
  </SummaryRow>
  <SummaryRow label="Total Value">
    <span className="font-bold text-isk tabular-nums">
      {formatISK(totalValue)}
    </span>
  </SummaryRow>
</div>
```

- [ ] **Step 6: Testleri çalıştır, geçtiklerini gör**

Run: `yarn workspace frontend test src/components/KillmailSummaryCard`
Expected: PASS — 7 test (3 `FittingSection` + 4 `KillmailSummaryCard`).

- [ ] **Step 7: Doğrula ve commit'le**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend lint
yarn workspace frontend build:check
npx prettier --check frontend/src/components/KillmailSummaryCard/
git add frontend/src/components/KillmailSummaryCard/
git commit -m "feat(killmail): filter the fitting list by destroyed or dropped"
```

---

### Task 10: Görünüm seçici ve hatırlanan tercih

**Files:**

- Modify: `frontend/src/components/KillmailSummaryCard/KillmailSummaryCard.tsx`
- Modify: `frontend/src/components/KillmailSummaryCard/KillmailSummaryCard.spec.tsx`

**Interfaces:**

- Consumes: Görev 8'in `FittingView` tipi, `components/RadioGroup/RadioGroup`.
- Produces: `localStorage` anahtarı `killmail_fitting_view`.

- [ ] **Step 1: Testleri ekle (başarısız olacaklar)**

`KillmailSummaryCard.spec.tsx` içine, mevcut `describe` bloğuna:

```tsx
it('starts in grid view', () => {
  const { container } = render(<KillmailSummaryCard {...props} />);

  expect(container.querySelector('.grid')).not.toBeNull();
});

it('remembers the table view', async () => {
  const { container } = render(<KillmailSummaryCard {...props} />);

  await userEvent.click(screen.getByRole('radio', { name: 'Table' }));

  expect(container.querySelector('.grid')).toBeNull();
  expect(localStorage.getItem('killmail_fitting_view')).toBe('table');
});

it('opens in the remembered view', () => {
  localStorage.setItem('killmail_fitting_view', 'table');

  const { container } = render(<KillmailSummaryCard {...props} />);

  expect(container.querySelector('.grid')).toBeNull();
});
```

Ve dosyanın başına, `describe`'ın içine:

```tsx
beforeEach(() => {
  localStorage.clear();
});
```

`beforeEach` importu: `import { beforeEach, describe, expect, it } from 'vitest';`

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `yarn workspace frontend test src/components/KillmailSummaryCard/KillmailSummaryCard.spec.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "radio"`.

- [ ] **Step 3: Durumu ve kalıcılığı ekle**

```tsx
const VIEW_STORAGE_KEY = 'killmail_fitting_view';

const VIEW_OPTIONS = [
  { value: 'grid' as FittingView, label: 'Grid' },
  { value: 'table' as FittingView, label: 'Table' },
];
```

Bileşenin içinde:

```tsx
const [view, setView] = useState<FittingView>('grid');

// Okuma effect içinde: sunucuda localStorage yok, ilk çizimde okunursa
// sunucu ile istemci farklı değer üretir ve hidrasyon uyuşmazlığı çıkar.
useEffect(() => {
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  if (stored === 'grid' || stored === 'table') {
    setView(stored);
  }
}, []);

const changeView = (next: FittingView) => {
  setView(next);
  localStorage.setItem(VIEW_STORAGE_KEY, next);
};
```

- [ ] **Step 4: Seçiciyi şeride koy**

`.card-band`'i iki gruba böl:

```tsx
<div className="justify-between card-band">
  <div role="tablist" aria-label="Fitting items" className="flex gap-1">
    {/* …sekmeler… */}
  </div>

  <RadioGroup
    name="killmail-fitting-view"
    options={VIEW_OPTIONS}
    value={view}
    onChange={changeView}
  />
</div>
```

Her `<FittingSection …>` çağrısındaki `view="grid"` sabiti `view={view}`
olur.

- [ ] **Step 5: Testleri çalıştır, geçtiklerini gör**

Run: `yarn workspace frontend test src/components/KillmailSummaryCard`
Expected: PASS — 10 test.

- [ ] **Step 6: Doğrula ve commit'le**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend lint
yarn workspace frontend build:check
npx prettier --check frontend/src/components/KillmailSummaryCard/
git add frontend/src/components/KillmailSummaryCard/
git commit -m "feat(killmail): let the fitting list switch between grid and table"
```

---

### Task 11: `FitScreen` skalası ve kapanış doğrulaması

**Files:**

- Modify: `frontend/src/components/FitScreen/ImplantSlot.tsx:35`
- Modify: `frontend/src/components/FitScreen/ServiceSlot.tsx:35`

**Interfaces:**

- Consumes: yok.
- Produces: yok.

- [ ] **Step 1: İki metin rengini skalaya al**

Her iki dosyadaki boş yuva kutusunda `text-gray-500` → `text-gray-400`.
`bg-white/5` zeminlerine **dokunulmuyor** — spec'in 9. kararı: FitScreen kendi
içinde tutarlı ve sayfanın en çok bakılan parçası.

- [ ] **Step 2: Bütün takımı çalıştır**

```bash
yarn workspace frontend typecheck
yarn workspace frontend test
yarn workspace frontend lint
yarn workspace frontend build:check
npx prettier --check .
```

`lint` sayısını `main` ile karşılaştır:

```bash
git stash && yarn workspace frontend lint 2>&1 | tail -3 && git stash pop
```

Dokunulan dosyaların listede olmaması gerekir.

- [ ] **Step 3: Dil sapmalarının bittiğini süpür**

```bash
grep -rnE 'text-blue-400|bg-gray-800|text-md|victim-card|fitting-section|\brounded\b|DMG' \
  "frontend/src/app/killmails/[id]/page.tsx" \
  frontend/src/components/AttackersCard \
  frontend/src/components/KillmailSummaryCard \
  frontend/src/components/FitScreen | grep -v rounded-full
```

Expected: çıktı yok.

- [ ] **Step 4: Commit'le ve PR aç**

```bash
git add frontend/src/components/FitScreen/
git commit -m "refactor(killmail): put the fit screen placeholders on the text scale"
git push -u origin refactor/killmail-detail-design-language
```

PR gövdesi düz metin bölümler hâlinde yazılır (onay kutulu şablon değil) ve
şunları taşır: ne değiştiği, `.card-body` yerine `p-2` kullanılmasının gerekçesi
(içerik arası 24px'i korumak), ve kullanıcının gözle bakması gereken yerler —
iki kart arasındaki 8px zemin şeridi, fitting grid'inin kolon sayısı,
`FittingItem`'ın yeni ton değerleri (`bg-destroyed/20`), 64px portrenin üstünde
taşan rozet şeridi, ve 64px portredeki güvenlik durumu rozetinin dar kalıp
kalmadığı.

---

## Kapsam dışı — bu planda yapılmayacaklar

Spec'in _Kapsam dışı_ bölümünün özeti; bir görev yanlışlıkla bunlara uzanmasın:

- **Aynı üç ISK değeri sayfada iki kez çiziliyor** (`page.tsx`'te ve
  `KillmailSummaryCard`'ın altında). İkisi de yerinde kalıp dile hizalanıyor.
- **Distance alanı** (en yakın gök cismi) kendi PR'ında; fizibilite ölçüldü
  (0,25 ms) ve sonuçlar spec'te kayıtlı.
- **SOLO ve NPC rozetleri killmail başına** ama her satırda tekrar ediyor.
  Yerlerinde kalıp yalnızca `.tag` giyiyorlar.
- **`AttackersCard` ve `KillmailSummaryCard`'ın bölünmesi** (273 ve 367 satır).
- **`FitScreen`'in sabit 600×600 kabı** ve `bg-white/5` zeminleri.
- **`.tag`'in uygulama geneline taranması** — bu PR yalnızca bu sayfadaki beş
  kopyayı topluyor.
- **Resolver'ların servise taşınması** — CLAUDE.md bunu ayrı bir iş sayıyor.
