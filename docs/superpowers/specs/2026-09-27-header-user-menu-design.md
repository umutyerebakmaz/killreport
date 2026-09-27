# Header kullanıcı menüsü — tasarım

Tarih: 2026-09-27 · Branch: `feat/header-user-menu`

## Amaç

Header'ın en sağındaki giriş yapmış kullanıcı alanı bugün karakter adını düz
metin olarak ve yanında kırmızı bir `LOGOUT` butonu gösteriyor
(`frontend/src/components/AuthButton/AuthButton.tsx:40-50`). Bunun yerine:

- Header'ın en sağında karakterin **kare** portresi, **64px**.
- Portreye tıklanınca bir dropdown menü açılır; içinde **Logout** vardır.

Giriş yapmamış durum (`LOGIN` butonu, hata mesajı) ve yükleniyor durumu
(`Loader`) değişmez.

## Kapsam dışı

- Header'ın sağ tarafındaki readout'lar (TQ oyuncu sayısı, EVE saati, aktif
  kullanıcılar) ve `Header.tsx` içindeki ESI status `fetch`'i. Bunlar header
  sadeleştirmesinin 3. adımı ve ayrı tasarlanacak.
- Menüye Logout dışında satır (ör. `/characters/{id}`). Kullanıcı kararı:
  yalnızca Logout.
- `mySessions` / `revokeSession` için bir "oturumlar" sayfası. Menüye bağlanacak
  bir sayfa bugün yok; ileride olursa menüye bir satır eklenir.
- `useAuth` içindeki mantık. Yalnızca `user` ve `logout` okunur.

## Tasarım

### Bileşen

`AuthButton` giriş yapmış dalda yeni bir `UserMenu` bileşeni render eder:
`frontend/src/components/Header/UserMenu.tsx`. Header'a ait olduğu için
`NavPopover`, `NavLink`, `MobileNav` ile aynı klasörde durur.

Headless UI'ın **`Menu`** bileşeni (`Menu`, `MenuButton`, `MenuItems`,
`MenuItem`) kullanılır, `Popover` değil. Sebep: içerik bir eylem listesi, ve
`Menu` ok tuşlarıyla gezinme, `role="menu"` / `menuitem` ve Escape ile kapanmayı
kendisi veriyor. `@headlessui/react` zaten bağımlılık; yeni paket yok.

`NavPopover`'dan farklı olarak **hover ile açılmaz**, yalnızca tıklamayla. Menüde
oturumu kapatan bir eylem var; imlecin üzerinden geçmesiyle açılması istenmez
(NotificationBell'in hover'da açılmama gerekçesiyle aynı,
`NavPopover.tsx:55-56`).

### Avatar (MenuButton)

- Kutu 64px, 1px çerçeve dahil: buton `size-16 border`, içinde
  `EveImage kind="character" size={62}` — portre 128px çekilir
  (`eveImageUrl.ts` `fetchSize`). Çerçeve kutunun dışına eklenseydi 66px olur,
  `-my-3` ile satıra 42px katkı verir ve header 2px büyürdü.
- Kare: `rounded` yok. Uygulama düz ve köşesiz (`buttons.css:7`).
- Çerçeve: `border border-white/10`, hover'da `border-white/25` — `.map-card`
  ile aynı dil (`cards.css`). Focus hover'ın aynısı:
  `focus-visible:border-white/25`, outline/ring yok.
- `aria-label`: `"Account menu for {characterName}"`.
- Karakter adı artık header'da görünmez; menünün başlığında durur.

### Dropdown (MenuItems)

- Avatarın sağ kenarına hizalı, altında 12px boşluk:
  `anchor="bottom end"` ve `[--anchor-gap:12px]`. Yüzey `.float`, genişlik
  `w-56`.
- İçerik yukarıdan aşağı:
  1. **Başlık** — karakter adı (`text-sm font-medium text-white`), altında
     `border-b border-white/10`. Tıklanamaz, `MenuItem` değildir.
  2. **Logout** — `MenuItem` içinde `button.menu-row`, sol tarafta
     `ArrowRightStartOnRectangleIcon` (heroicons 20/solid), metin `Logout`.
     Menüdeki tek eylem budur.
- Hover ve klavye odağı **kırmızı ton** alır: `data-focus:bg-danger/20`. Nav
  popover satırlarının `hover:bg-cyan-900/50` accent'inin karşılığı, ama
  oturumu kapatan bir eylem olduğu için `danger` token'ından
  (`globals.css:95`, `.button-danger`'ın da kullandığı `bg-danger/20`).
  Headless UI `MenuItem`'ı hem imleçle hem ok tuşlarıyla `data-focus` verir, iki
  yol aynı görünür. Utilities katmanı `.menu-row`'un (components katmanı)
  nötr `hover:bg-white/5`'ini ezer.
- Açılış/kapanış geçişi NotificationBell'deki gibi: açılış anında,
  kapanış 150ms fade.

### Header yüksekliği

Bugün header satırı 40px (`.button`: `py-2.5` + `text-sm/5`), `nav`'ın `p-6`'sı
ile toplam **88px**. 64px avatar bu satıra konursa header **112px**'e çıkar ve
giriş yapınca/çıkınca 24px zıplar.

Çözüm: `nav`'ın `p-6`'sı **değişmez**; avatar butonu `-my-3` alır. Negatif
margin elemanın kutusunu küçültmez, yalnızca satırda kapladığı yeri: avatar 64px
çizilir ama satır yüksekliğine 64 − 24 = 40px katkı verir — LOGIN butonuyla aynı.
Header giriş durumundan bağımsız olarak **88px** kalır, avatar dikey padding'in
12px'ine taşar ve header'ın üst/alt kenarına 12px mesafede durur.

Avatar header'da **dikey olarak ortalıdır**: `nav` ve sağ kapsayıcı
`items-center` (`Header.tsx:64`, `:114`) ve `-my-3` iki yöne eşit, dolayısıyla
12 + 64 + 12 = 88px. Orta çizgisi logo, nav etiketleri ve bell ile aynıdır. Diğer
öğelerin (logo, nav, bell) konumu hiç değişmez.

`MenuItems`'ın `anchor`'ı butonun gerçek kutusunu ölçer; margin konumlandırmayı
etkilemez, 12px'lik `--anchor-gap` avatarın alt kenarından sayılır.

Değerlendirilip bırakılan: `py-6` → `py-3` + `min-h-16`. Header yine 88px
kalıyordu ama logo ve nav da kenara yaklaşıyordu; değişiklik avatarla sınırlı
kalmalı.

### Mobil çekmece

`AuthButton` mobil çekmecede de render ediliyor (`Header.tsx`, `DialogPanel`
içindeki son blok). Orada dropdown gereksiz — çekmece zaten bir menü. Giriş
yapmış kullanıcı için çekmecede tek satır: 40px kare avatar + karakter adı, altında
tam genişlikte `button button-danger` `LOGOUT` — menüdeki kırmızı tonla aynı
dil.

Bunu sağlamak için `AuthButton`'a `variant: 'header' | 'drawer'` prop'u eklenir;
varsayılan `'header'`. Giriş yapmamış ve yükleniyor dalları iki varyantta aynı.

## Testler

`frontend/src/components/Header/UserMenu.spec.tsx` (Vitest + Testing Library,
mevcut `NavPopover.spec.tsx` gibi):

- Avatar `images.evetech.net/characters/{id}/portrait?size=128` ister ve
  `aria-label` karakter adını içerir.
- Menü başlangıçta kapalı; tıklanınca karakter adı ve `Logout` görünür.
- `Logout`'a tıklamak verilen `onLogout`'u bir kez çağırır.
- Hover menüyü açmaz.

`UserMenu`, `useAuth`'u doğrudan çağırmaz; `user` ve `onLogout` prop olarak
gelir, böylece test hook'u mock'lamadan yazılır.

## Doğrulama

`.tsx` yapı + mantık değişikliği: `yarn workspace frontend test`, ardından
typecheck/`build:check` ve `lint` (lint sayısı `main` ile karşılaştırılır),
`npx prettier --check` değişen dosyalara. Görsel kontrol kullanıcıda: giriş
yapmış ve yapmamış halde header yüksekliği, avatar, menü, mobil çekmece.

## Açık sorular

1. Avatarın header kenarına 12px'e taşması gözle kabul edilebilir mi? Kontrol
   uygulamadan sonra kullanıcıda; olmazsa avatar küçültülür, padding değil.
