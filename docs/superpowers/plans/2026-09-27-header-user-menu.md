# Header kullanıcı menüsü — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header'ın en sağındaki karakter adı + `LOGOUT` butonunu, tıklanınca
yalnızca Logout içeren bir menü açan 64px kare karakter portresiyle
değiştirmek; header yüksekliği (88px) ve padding'i değişmeden.

**Architecture:** Yeni `Header/UserMenu.tsx` saf bir sunum bileşeni: `user` ve
`onLogout` prop alır, `useAuth`'u çağırmaz. `AuthButton` giriş yapmış dalda
header'da `UserMenu`'yü, mobil çekmecede avatar + ad + `LOGOUT` satırını render
eder (`variant` prop'u). `Header.tsx` yalnızca çekmecedeki çağrıya
`variant="drawer"` ekler.

**Tech Stack:** Next.js App Router, `@headlessui/react` 2.2 (`Popover`),
`@heroicons/react` 2.2, Tailwind, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-27-header-user-menu-design.md`

> **Sonradan değişti:** Görev 2 aşağıda `Menu` / `MenuItems` + `anchor` ile
> 64px portre olarak yazıldı ve öyle uygulandı. Review'da iki adımda değişti:
> önce `NotificationBell` gibi yalnızca tıklamayla açılan bir `Popover`'a, sonra
> `PopoverGroup`'taki `NavPopover` yapısına (hover ile açılma, touch koruması,
> `NavPopoverLink` satırı). Portre 32px ve accent çerçeveli oldu, `-my-3`
> kalktı. Aşağıdaki kod blokları ilk uygulamanın kaydıdır; güncel hali spec'te ve
> `frontend/src/components/Header/UserMenu.tsx`'te.

## Global Constraints

- `nav`'ın `p-6`'sı ve `Header.tsx`'teki diğer hiçbir boşluk değişmez. Avatar
  `-my-3` ile satıra 40px katkı verir; kutusu çerçeve dahil tam 64px
  (`size-16 border`, `EveImage size={62}`).
- Avatar kare: `rounded-*` yok.
- Menü yalnızca tıklamayla açılır; hover ile açan kod eklenmez.
- Menüde tek satır: Logout. Hover ve klavye odağı `data-focus:bg-danger/20`.
  Cyan/accent yok.
- Outline ve `ring-*` yok; focus hover'ın görünümünü alır
  (`data-focus:border-white/25`).
- `@headlessui/react` React bileşenleri; `@tailwindplus/elements` değil.
- `useAuth.ts`'ye dokunulmaz.
- Yarn, asla npm. Commit mesajları İngilizce, `type(scope):` sonrası küçük harf,
  Claude atfı yok. Branch: `feat/header-user-menu`.
- Dev sunucusu çalışırken `build` değil `build:check`.

## Review Focus

1. **Header yüksekliği 88px kalmalı.** Çerçeve 64px'in dışına eklenirse kutu
   66px olur ve header giriş yapınca 2px zıplar. → Görev 2, sınıf listesi;
   kullanıcı gözle doğrular.
2. **Kırmızı ton hem hover'da hem klavyede.** `.menu-row`'un kendi
   `hover:bg-white/5`'i components katmanında; utility `data-focus:bg-danger/20`
   onu ezmeli. → Görev 2, `data-focus` testi.
3. **`characterId` string.** `UserData.characterId` string, `EveImage.id`
   number. `Number()` unutulursa portre URL'i yine doğru görünür ama tip
   hatası verir. → Görev 2, typecheck.

---

### Görev 1: Spec ve planı commit et

**Files:** `docs/superpowers/specs/2026-09-27-header-user-menu-design.md`,
`docs/superpowers/plans/2026-09-27-header-user-menu.md`

- [ ] `npx prettier --check` iki dosyaya; gerekiyorsa `--write`.
- [ ] Commit: `docs(frontend): spec and plan for the header user menu`

### Görev 2: `UserMenu` bileşeni (TDD)

**Files:**

- Create: `frontend/src/components/Header/UserMenu.spec.tsx`
- Create: `frontend/src/components/Header/UserMenu.tsx`

- [ ] **Adım 1 — başarısız testi yaz**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from './UserMenu';

const user = { characterId: '95465499', characterName: 'Umut Yerebakmaz' };

function renderUserMenu() {
  const onLogout = vi.fn();
  render(<UserMenu user={user} onLogout={onLogout} />);
  return {
    onLogout,
    button: screen.getByRole('button', { name: /account menu for umut/i }),
  };
}

describe('UserMenu', () => {
  it('draws the character portrait', () => {
    renderUserMenu();
    expect(screen.getByAltText('Umut Yerebakmaz')).toHaveAttribute(
      'src',
      'https://images.evetech.net/characters/95465499/portrait?size=128',
    );
  });

  it('is closed until clicked, then shows the name and Logout', async () => {
    const { button } = renderUserMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(button);

    expect(screen.getByRole('menu')).toHaveTextContent('Umut Yerebakmaz');
    expect(
      screen.getByRole('menuitem', { name: /logout/i }),
    ).toBeInTheDocument();
  });

  it('does not open on hover', async () => {
    const { button } = renderUserMenu();
    await userEvent.hover(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onLogout once when Logout is chosen', async () => {
    const { button, onLogout } = renderUserMenu();
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('menuitem', { name: /logout/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('marks the Logout row focused from the keyboard', async () => {
    const { button } = renderUserMenu();
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /logout/i })).toHaveAttribute(
      'data-focus',
    );
  });
});
```

- [ ] **Adım 2 — çalıştır, başarısız olduğunu gör**

`yarn workspace frontend test src/components/Header/UserMenu.spec.tsx`
Beklenen: `Failed to resolve import "./UserMenu"`.

- [ ] **Adım 3 — bileşeni yaz**

```tsx
'use client';

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';

import EveImage from '@/components/ui/EveImage';
import type { UserData } from '@/hooks/useAuth';

/**
 * The signed-in character, drawn as the header's right-hand edge.
 *
 * Opens on click only. The one row inside ends the session, and a pointer
 * sweeping past must not put it under the cursor — the reason the
 * notification bell does not open on hover either.
 *
 * The box is 64px with its border, and `-my-3` lets it spill 12px into the
 * nav's padding on each side: it counts as 40px in the row, the height the
 * LOGIN button it replaces already had, so the header stays 88px whether
 * anyone is signed in or not, and the portrait sits on the row's centre line.
 */
export function UserMenu({
  user,
  onLogout,
}: {
  user: UserData;
  onLogout: () => void;
}) {
  return (
    <Menu>
      <MenuButton
        aria-label={`Account menu for ${user.characterName}`}
        className="block -my-3 transition-colors border size-16 border-white/10 hover:border-white/25 focus:outline-none data-focus:border-white/25 data-open:border-white/25"
      >
        <EveImage
          kind="character"
          id={Number(user.characterId)}
          name={user.characterName}
          size={62}
        />
      </MenuButton>
      {/* Red where the nav popovers use cyan: the row is not a place to go,
          it ends the session. `data-focus` is set for pointer and arrow keys
          alike, and as a utility it outranks `.menu-row`'s own neutral hover. */}
      <MenuItems
        transition
        anchor="bottom end"
        className="z-50 w-56 float [--anchor-gap:12px] focus:outline-none transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in"
      >
        <div className="px-4 py-3 text-sm font-medium text-white truncate border-b border-white/10">
          {user.characterName}
        </div>
        <MenuItem>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 text-white menu-row data-focus:bg-danger/20"
          >
            <ArrowRightStartOnRectangleIcon
              aria-hidden="true"
              className="size-5 text-ink-muted"
            />
            Logout
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
```

- [ ] **Adım 4 — testler geçmeli**

`yarn workspace frontend test src/components/Header/UserMenu.spec.tsx`
Beklenen: 5 passed. Anchor.lı `MenuItems` jsdom.da `ResizeObserver` ister;
`vitest.setup.ts` Listbox için zaten stub veriyor (`vitest.setup.ts:8`).

- [ ] **Adım 5 — commit**
      `feat(frontend): add a square portrait menu for the signed-in user`

### Görev 3: `AuthButton` — header'da menü, çekmecede satır

**Files:** Modify `frontend/src/components/AuthButton/AuthButton.tsx`

- [ ] Prop ekle: `{ variant = 'header' }: { variant?: 'header' | 'drawer' }`.
- [ ] Giriş yapmış dalı (`AuthButton.tsx:40-50`) değiştir:

```tsx
if (user) {
  if (variant === 'header') {
    return <UserMenu user={user} onLogout={logout} />;
  }

  // The drawer is already a menu, so a second one inside it would only be a
  // click in the way: the name and the action sit in plain view.
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <EveImage
          kind="character"
          id={Number(user.characterId)}
          name={user.characterName}
          size={40}
          className="border border-white/10"
        />
        <span className="text-sm font-medium text-white">
          {user.characterName}
        </span>
      </div>
      <button onClick={logout} className="w-full button button-danger">
        LOGOUT
      </button>
    </div>
  );
}
```

- [ ] Import'lar: `UserMenu` (`@/components/Header/UserMenu`), `EveImage`
      (`@/components/ui/EveImage`).
- [ ] Giriş yapmamış ve yükleniyor dalları değişmez.
- [ ] `yarn workspace frontend typecheck`.
- [ ] Commit: `feat(frontend): show the user menu in the header and a logout row in the drawer`

### Görev 4: `Header.tsx` — çekmece varyantı

**Files:** Modify `frontend/src/components/Header/Header.tsx`

- [ ] Çekmecedeki `<AuthButton />` → `<AuthButton variant="drawer" />`.
      Masaüstündeki çağrı olduğu gibi kalır (varsayılan `header`).
- [ ] Başka hiçbir satır değişmez — özellikle `nav`'ın `p-6`'sı.
- [ ] Commit: `feat(frontend): render the drawer variant of the auth button`

### Görev 5: Doğrulama ve PR

- [ ] `qa` agent'ına arka planda: `yarn workspace frontend test`, typecheck,
      `lint` (sayı `main` ile karşılaştırılır, değişen dosyalar listede yok),
      `build:check`, değişen dosyalara `npx prettier --check`.
- [ ] Kullanıcıya bakması gerekenleri söyle: giriş yapmış/yapmamış header
      yüksekliği aynı mı, avatar dikey ortada mı, menü kırmızı hover'ı, klavye
      ile Enter/↓, mobil çekmecede avatar + LOGOUT.
- [ ] Push, PR (#195/#196 tarzı düz metin gövde, küçük harf başlık):
      `feat(frontend): replace the header logout button with a portrait menu`
