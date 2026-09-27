# Header kullanıcı menüsü — tasarım

Tarih: 2026-09-27 · Branch: `feat/header-user-menu`

## Amaç

Header'ın en sağındaki giriş yapmış kullanıcı alanı bugün karakter adını düz
metin olarak ve yanında kırmızı bir `LOGOUT` butonu gösteriyor
(`frontend/src/components/AuthButton/AuthButton.tsx:40-50`). Bunun yerine:

- Header'ın en sağında karakterin **kare** portresi, **32px**, accent
  çerçeveli.
- Portrenin üzerine gelince ya da tıklanınca bir dropdown menü açılır; içinde **Logout** vardır.

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

`PopoverGroup`'taki nav dropdown'larıyla (`NavPopover.tsx`) **aynı yapı**:
Headless UI `Popover`, `PopoverButton`, `PopoverPanel`, `CloseButton`.

- `(hover: hover)` olan cihazda imleç gelince açılır, dokunmatik cihazda
  yalnızca tıklamayla (`NavPopover`'ın touch koruması).
- İmleç `relative` sarmalayıcıdan çıkınca `close()` ve butondan `blur()`.
- Panel `absolute`, 12px boşluk panelin `pt-3`'ü, yüzey `overflow-hidden float
p-4`.
- Satır `NavPopoverLink`'in satırı: `p-4`, kalın etiket + altında
  `text-ink-muted` açıklama, tüm satırı kaplayan `absolute inset-0` tıklama
  alanı.

Tek fark: panel `left-0` değil `right-0`, çünkü portre header'ın son öğesi;
soldan açılsa sayfanın dışına taşar. Genişlik `w-screen max-w-xs`.

Üzerine gelmek yalnızca satırı gösterir; oturumu kapatmak yine bir tıklama
ister.

Tarihçe: ilk uygulama `Menu` + `anchor`, ikincisi `NotificationBell` gibi
yalnızca tıklamayla açılan bir `Popover` idi. Kullanıcı kararıyla header'ın tek
dropdown davranışı olan `NavPopover` yapısına geçildi.

### Avatar (PopoverButton)

- Kutu 32px, 1px çerçeve dahil: buton `size-8 border`, içinde
  `EveImage kind="character" size={30}` — portre 64px çekilir
  (`eveImageUrl.ts` `fetchSize`).
- Kare: `rounded` yok. Uygulama düz ve köşesiz (`buttons.css:7`).
- Çerçeve **accent**: `border-accent`; "giriş yapıldı"yı bir bakışta söyleyen
  şey bu. Hover'da, açıkken ve klavye odağında `border-accent-hover`
  (`globals.css:48`). Outline/ring yok.
- `aria-label`: `"Account menu for {characterName}"`.
- Karakter adı header'da görünmez; menü satırının açıklamasında durur.

### Dropdown (PopoverPanel)

- Tek satır: etiket **`LOGOUT`**, açıklama `Signed in as {characterName}`.
  Tıklanınca panel kapanır ve `onLogout` çağrılır.
- Hover ve klavye odağı **kırmızı ton** alır:
  `hover:bg-danger/20 has-[button:focus-visible]:bg-danger/20`. Nav popover
  satırlarının `hover:bg-cyan-900/50` accent'inin karşılığı, ama oturumu kapatan
  bir eylem olduğu için `danger` token'ından (`globals.css:95`,
  `.button-danger`'ın da kullandığı `bg-danger/20`).
- Açılış/kapanış geçişi `NavPopover`'daki gibi: açılış anında, kapanış 150ms
  fade.

### Header yüksekliği

Header satırı 40px (`.button`: `py-2.5` + `text-sm/5`), `nav`'ın `p-6`'sı ile
toplam **88px**. 32px portre satırdan kısa; header giriş yapınca/çıkınca
değişmez, negatif margin gerekmez. `items-center` (`Header.tsx:64`, `:114`)
portreyi logo, nav ve bell ile aynı orta çizgiye koyar.

Değerlendirilip bırakılan: 64px portre + `-my-3` (header 88px kalıyordu, portre
padding'e taşıyordu) ve `py-6` → `py-3` + `min-h-16`. Kullanıcı kararıyla 32px.

### Mobil çekmece

`AuthButton` mobil çekmecede de render ediliyor (`Header.tsx`, `DialogPanel`
içindeki son blok). Orada dropdown gereksiz — çekmece zaten bir menü. Giriş
yapmış kullanıcı için çekmecede tek satır: header'daki gibi 32px, accent
çerçeveli kare avatar + karakter adı, altında
tam genişlikte `button button-danger` `LOGOUT` — menüdeki kırmızı tonla aynı
dil.

Bunu sağlamak için `AuthButton`'a `variant: 'header' | 'drawer'` prop'u eklenir;
varsayılan `'header'`. Giriş yapmamış ve yükleniyor dalları iki varyantta aynı.

## Testler

`frontend/src/components/Header/UserMenu.spec.tsx` (Vitest + Testing Library,
mevcut `NavPopover.spec.tsx` gibi):

- Avatar `images.evetech.net/characters/{id}/portrait?size=64` ister ve
  `aria-label` karakter adını içerir.
- Tıklanınca açılır, `LOGOUT` ve `Signed in as {characterName}` görünür.
- Hover yapabilen cihazda üzerine gelince açılır, yapamayanda açılmaz.
- İmleç ayrılınca kapanır.
- `LOGOUT` `onLogout`'u bir kez çağırır ve paneli kapatır.

`UserMenu`, `useAuth`'u doğrudan çağırmaz; `user` ve `onLogout` prop olarak
gelir, böylece test hook'u mock'lamadan yazılır.

## Doğrulama

`.tsx` yapı + mantık değişikliği: `yarn workspace frontend test`, ardından
typecheck/`build:check` ve `lint` (lint sayısı `main` ile karşılaştırılır),
`npx prettier --check` değişen dosyalara. Görsel kontrol kullanıcıda: giriş
yapmış ve yapmamış halde header yüksekliği, avatar, menü, mobil çekmece.
