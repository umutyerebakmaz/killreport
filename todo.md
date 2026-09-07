# TODO

- [ ] `KillmailFilterForm` lint borcu: 25 `react-hooks/set-state-in-effect`. State'in yeniden tasarimini gerektiriyor (muhtemelen `key` prop yaklasimi) — **davranis karari kullaniciya ait**, o yuzden bekliyor.
- [ ] Ayni dosyada: 12 `react/no-unescaped-entities`, 2 `no-explicit-any`, 62 `no-img-element` (proje geneli).
- [ ] `killmails/page.tsx`: `realtimeTotalCountIncrement` ve `realtimeDateCounts` sayaclari, sorgu yeniden calisirsa ayni killmail'i iki kez sayabiliyor. Satir degil sayac olduklari icin sisme yapmiyorlar; PR #168'in disinda birakildi.

- [x] ~~Alliances ekraninda tarih secicinin stilini gozden kacirmisisz ayrica client language ne olursa olsun her zaman english calisman gerekir.~~ **Kapandi 2026-09-07.** Iki parca halinde: stil PR #174'te (kutu, takvim dugmesi, segment odagi, bos durum; `.select` -> `.input-boxed`), dil ise `0aca9dd`'de — native panelin dili zorlanamadigi icin takvimi kendimiz cizdik. `components/ui/Calendar` + `components/ui/DateInput`, her etiket `'en-US'` + `timeZone: 'UTC'`.

- [x] ~~`<select></select>` elementinin proje boyutunda ui tasarim dilimize uygun bir stile getirilmesi gerekiyor.~~ **Kapandi 2026-09-06** (PR #173). 12 select / 8 dosya Headless UI `Listbox`'a gecti, 17 `✓` hilesi gitti. Yeni paket yok — `@headlessui/react` zaten kuruluydu. Ayrica `html { color-scheme: dark }` eklendi, sistem renginde cizilen butun scrollbar'lar duzeldi.

---

## Date picker'dan artan, kendi PR'ini bekleyen isler

- [ ] Leaderboards'daki tarih seciciden `Clear`'a basmak hicbir sey yapmiyor: `onChange('')` gidiyor ama sayfa `next && setSelectedDate(next)` ile koruyor, yani buton sessizce olu. O ekranda `Clear` ya hic gorunmemeli ya da bugune donmeli.

- [ ] **Localization supurmesi** (2026-09-07'de bilincli olarak ertelendi — Ingilizce zorunlulugu date picker'in kendi isiydi, o kapandi):
  - `app/corporations/[id]/page.tsx:321` — `toLocaleDateString('tr-TR', …)`, herkese sabit Turkce basiyor.
  - `app/alliances/[id]/page.tsx:452` — `toLocaleDateString()`, argumansiz, tarayici locale'ine dusuyor.
  - 26 argumansiz `toLocaleString()` cagrisi: sayi, ama binlik ayraci da locale'e gore degisiyor (`1.234` / `1,234`).
  - Referans: `utils/date.ts` bunu dogru yapiyor — her cagri `'en-US'` **ve** `timeZone: 'UTC'` tasiyor.

- [ ] `CLAUDE.md` duzeltmesi: "There is no test runner and no test files in either workspace" artik dogru degil. Vitest kurulu ve 732 test kosuyor (frontend 250, backend 482); `yarn test`, `yarn test:frontend`, `yarn test:backend`, `yarn workspace frontend test:coverage`.
