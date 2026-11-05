# OG paylaşım kartları — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Killmail, karakter, corporation, alliance ve güneş sistemi sayfalarına
1200×630 OG paylaşım kartı ve başlık/açıklama meta etiketleri eklemek.

**Mimari:** Her route'un `[id]` klasörüne Next 16 `opengraph-image.tsx` (kartı
`ImageResponse` ile çizer) ve server `layout.tsx` (`generateMetadata`) eklenir. İkisi de
veriyi backend GraphQL'den sunucu tarafında `fetch` ile çeker. Kart bileşenleri Satori'ye
uygun inline-style JSX'tir ve `src/components/ShareCard/` altında yaşar. Backend'e tek
yeni okuma eklenir: karakter/corp/alliance için kill ve loss toplamları.

**Teknoloji:** Next 16.3 (`next/og`), GraphQL Yoga, Prisma, Redis, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-05-og-share-cards-design.md` — ölçüler,
renkler ve kararlar orada; bu plan onları tekrar etmez, görev başına hangisinin
uygulandığını söyler. Uygulayıcı ikisini birlikte okur.

## Global kısıtlar

- Yarn, asla npm. `prisma migrate dev` yok; bu iş migration içermez.
- Üretilen dosyalar elle düzenlenmez: `backend/src/generated-types.ts`,
  `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
  Backend codegen, frontend codegen'den önce.
- `.env` dosyalarına dokunulmaz. `NEXT_PUBLIC_SITE_URL` satırını kullanıcı ekler.
- Kartlarda karartma/scrim yok; görsel üstü metin
  `textShadow: '0 2px 6px rgba(0,0,0,0.9)'`.
- Ürün metninde em dash yok. Orta nokta yalnızca sistem · region ve
  constellation · region arasında.
- Satori yalnızca flexbox bilir: birden fazla çocuğu olan her `div`
  `display: 'flex'` ister; CSS `filter` desteklenmez.
- Resolver servisi çağırır; servis `redis.get` → sorgu → `redis.setex`; cache key'de
  her parametre. Resolver'lar `@services/prisma` kullanır.
- Dış görseller yalnızca `images.evetech.net`; ESI çağrısı yok.
- Commit mesajları İngilizce, `type(scope):` sonrası küçük harf, Claude atfı yok.
- Her commit öncesi değişen dosyalarda `npx prettier --check <dosyalar>`.

## Review odağı

1. **Uzun isimler** (`Mercenaires Sans Frontieres.`, 37 karakterlik corp adları) panel
   genişliğini aşmamalı, tek satırda `…` ile kesilmeli → Task 3 `NameBlock` testi.
2. **Alliance'sız karakter/corp, karakteri olmayan kurban (yapı, NPC)** kartı kırmamalı;
   eksik satır sadece çizilmez → Task 4 ve Task 5 testleri.
3. **Sıfır kill ve sıfır loss** bölme hatası üretmemeli; bar çizilmez → Task 3
   `killLossBarHeights` testi.
4. **Var olmayan ID** render yapmadan 404 dönmeli, sayfa davranışı değişmemeli → her
   route görevinin `opengraph-image` testi.
5. **Yıldız kaydı veya region haritası olmayan sistem** (Jove/özel sistemler) düz zeminle
   çizilmeli, istisna fırlatmamalı → Task 6 testi.

---

### Task 1: Backend — kill/loss toplamları

**Dosyalar:**

- Değiştir: `backend/src/schemas/CharacterStats.graphql`, `CorporationStats.graphql`,
  `AllianceStats.graphql` (her birine bir query) ve tip için
  `backend/src/schemas/KillLossTotals.graphql` (yeni)
- Değiştir: `backend/src/services/character/character-stats.service.ts`,
  `corporation/corporation-stats.service.ts`, `alliance/alliance-stats.service.ts`
- Değiştir: `backend/src/resolvers/{character,corporation,alliance}/stats-queries.ts`
- Test: `backend/src/services/entity-stats.spec.ts` (üç servisi tek tablodan test eden
  mevcut dosya)

**Arayüzler:**

- Üretir (GraphQL):
  ```graphql
  type KillLossTotals {
    kills: Int!
    losses: Int!
  }
  characterKillLossTotals(characterId: Int!): KillLossTotals!
  corporationKillLossTotals(corporationId: Int!): KillLossTotals!
  allianceKillLossTotals(allianceId: Int!): KillLossTotals!
  ```
- Üretir (servis, her üç dosyada aynı ad):
  `getKillLossTotals(id: number): Promise<{ kills: number; losses: number }>`

- [ ] **Adım 1: Başarısız testleri yaz** — `entity-stats.spec.ts`'deki üç-servis
      tablosuna, mock'lara `prisma.victim.count` eklenerek:
  - `getKillLossTotals serves a cache hit without touching the database`
  - `getKillLossTotals keys the cache as <domain>_stats:<id>:kill_loss_totals:ALL_TIME
with TTL 3600` (`alliance_stats:`, `corporation_stats:`, `character_stats:` önekleri
    mevcut `getCacheKey` ile aynı)
  - `getKillLossTotals sums the domain's kill_stats table and counts victims` — `$queryRaw`
    `[{ kills: 11861n }]` döner, `victim.count` `9593`; sonuç
    `{ kills: 11861, losses: 9593 }` (BigInt → Number); SQL `<domain>_kill_stats` ve
    `<domain>_id` içerir; `victim.count` `{ where: { <domain>_id: id } }` ile çağrılır.
  - `getKillLossTotals returns zeros when the entity has no rows` — `$queryRaw`
    `[{ kills: null }]`, `count` `0` → `{ kills: 0, losses: 0 }`.
- [ ] **Adım 2:** `yarn workspace backend test src/services/entity-stats.spec.ts` — yeni
      testler FAIL (`getKillLossTotals is not a function`).
- [ ] **Adım 3: `getKillLossTotals` üç serviste.** Kill: `SELECT COALESCE(SUM(kill_count), 0)
AS kills FROM <domain>_kill_stats WHERE <domain>_id = ${id}`; loss:
      `prisma.victim.count`. İkisi `Promise.all` ile; sonuç `Number()`'lanıp 3600 s
      cache'lenir.
- [ ] **Adım 4:** Testler PASS.
- [ ] **Adım 5: Şema ve resolver.** Tip `KillLossTotals.graphql`'de, query'ler ilgili
      `*Stats.graphql`'de `extend type Query` içinde; resolver'lar mevcut
      `*StatsQueries` nesnelerine, servisi çağırarak.
      `yarn workspace backend codegen`, ardından `yarn workspace backend build` temiz.
- [ ] **Adım 6: Canlı doğrulama** (backend çalışırken):
      `allianceKillLossTotals(allianceId: 99003581)` sorgusu, `psql` ile
      `alliance_kill_stats` toplamı ve `victims` sayımıyla aynı sayıları döner.
- [ ] **Adım 7: Commit** — `feat(stats): add kill and loss totals for characters,
corporations and alliances`

### Task 2: Frontend temeli — font, veri çekme, renkler, site adresi

**Dosyalar:**

- Oluştur: `frontend/assets/fonts/RobotoCondensed-{Regular,Medium,Bold}.ttf` ve
  `frontend/assets/fonts/OFL.txt` (googlefonts/RobotoCondensed deposundaki lisans)
- Oluştur: `frontend/src/lib/shareCard/fetchGraphQL.ts`, `fonts.ts`, `assets.ts`,
  `palette.ts`
- Değiştir: `frontend/src/app/layout.tsx` (`metadataBase`)
- Değiştir: `frontend/src/components/ShipTierBadge/ShipTierBadge.tsx` (ikon tablosunu
  dışa aç)
- Test: `frontend/src/lib/shareCard/fetchGraphQL.spec.ts`, `palette.spec.ts`,
  `assets.spec.ts`

**Arayüzler:**

- Üretir:
  - `SHARE_CARD_SIZE = { width: 1200, height: 630 }`
  - `fetchGraphQL<TData, TVars>(doc: DocumentNode, variables: TVars, revalidate: number |
false): Promise<TData | null>` — `print(doc)` ile POST, adres
    `process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'`,
    `next: { revalidate }`; HTTP hatası veya `errors` varsa `null`.
  - `loadShareCardFonts(): Promise<ImageResponseOptions['fonts']>` — üç TTF, ad `'RC'`,
    400/500/700; modül düzeyinde bir kez okunur.
  - `fileDataUri(publicPath: string): Promise<string | null>` — `public/` altındaki bir
    dosyayı (`/images/regions/10000030.svg`, `/icons/t2.svg`) data URI'ye çevirir; dosya
    yoksa `null`.
  - `SHARE` renk sabitleri (spec'teki hex'ler: `ground`, `surface`, `red`, `accent`,
    `faint`, `muted`, `ship`, `region`, `isk`, `dropped`, `text`, `date`) ve
    `securityHex(sec: number | null | undefined): string` — `getSecurityLevel`'e göre
    high `#4ade80`, low `#facc15`, null `#f87171`, wormhole `#c084fc`.
  - `SHIP_TIER_ICONS` (`ShipTierBadge`'deki `ICONS`, aynı içerik, `export` edilmiş).

- [ ] **Adım 1: Testleri yaz.**
  - `securityHex`: `0.5 → #4ade80`, `0.2 → #facc15`, `-0.8 → #f87171`, `null → #c084fc`.
  - `fetchGraphQL`: `fetch` mock'u; gövdede `query` (basılmış doküman) ve `variables`
    gider, `next.revalidate` iletilir, `{ data }` döner; `errors` varsa ve status 500'de
    `null`.
  - `fileDataUri('/icons/t2.svg')` `data:image/svg+xml;base64,` ile başlar;
    `fileDataUri('/images/regions/1.svg')` `null`.
- [ ] **Adım 2:** `yarn workspace frontend test src/lib/shareCard` — FAIL.
- [ ] **Adım 3: Uygula.** Fontlar bu oturumda indirilen statik TTF'lerdir
      (Google Fonts, `fonts.gstatic.com/s/robotocondensed/v31/…`); woff2 kullanılmaz.
      `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')`.
- [ ] **Adım 4:** Testler PASS; `yarn workspace frontend build:check` temiz.
- [ ] **Adım 5: Commit** — `feat(og): add share card fonts, data fetching and palette`

### Task 3: Ortak kart parçaları

**Dosyalar:**

- Oluştur: `frontend/src/components/ShareCard/ShareCardFrame.tsx`, `NameBlock.tsx`,
  `StatNumber.tsx`, `KillLossBars.tsx`, `ShareAttackerBadge.tsx`, `index.ts`
- Değiştir: `frontend/src/components/ui/Logo.tsx` (yorum: çizimin üçüncü kopyası
  `ShareCardFrame`'de)
- Test: `frontend/src/components/ShareCard/ShareCard.spec.tsx`,
  `ShareCard.render.spec.tsx` (`// @vitest-environment node`)

**Arayüzler:**

- Tüketir: Task 2'nin `SHARE`, `loadShareCardFonts`.
- Üretir:
  - `ShareCardFrame({ bar: 'red' | 'accent', left: ReactNode, right: ReactNode,
footerRight: ReactNode })` — spec "Ortak çerçeve" tablosu (şerit, iki panel, footer,
    logo + `KILLREPORT`).
  - `NameBlock({ title: ReactNode, memberships?: { logo: string; name: string }[],
subtitle?: ReactNode })` — spec "İsim bloğu"; isimler tek satır, taşan `…`.
  - `StatNumber({ value: string; label: string; color: string; size: number })` —
    spec "İstatistik etiketi".
  - `killLossBarHeights(kills: number, losses: number): { kills: number; losses: number }
| null` (0–1 oranlar) ve `KillLossBars({ kills, losses, top, height })`.
  - `ShareAttackerBadge({ solo, npc, attackerCount })` — `attackerBadge()` dört hali,
    spec'teki `IconBadge` ölçüleri; ikonlar heroicons 16/solid (`UsersIcon`,
    `UserIcon`, `CpuChipIcon`), inline `<svg>` olarak.
  - `blurredBackdrop(src: string)` — `filter` yerine: görsel `size=32` istenip paneli
    kaplayacak şekilde büyütülür, üstüne `rgba(16,16,16,0.55)` katman.

- [ ] **Adım 1: Testleri yaz** (`ShareCard.spec.tsx`, RTL ile):
  - `killLossBarHeights(252, 58)` → `{ kills: 1, losses: 58/252 }`;
    `(9593, 11861)` → `{ kills: 9593/11861, losses: 1 }`; `(0, 0)` → `null`.
  - `ShareAttackerBadge`: `{solo:true,npc:false}` metni `SOLO`;
    `{solo:true,npc:true}` `NPC`; `{solo:false,npc:false,attackerCount:5}` `5`;
    `{solo:false,npc:true,attackerCount:3}` `3`.
  - `NameBlock`: uzun isimli üyelik satırının stilinde `textOverflow: 'ellipsis'` ve
    `whiteSpace: 'nowrap'`; `memberships` boşken üyelik satırı yok.
  - `ShareCardFrame` footer'da `KILLREPORT` ve `footerRight` içeriği.
- [ ] **Adım 2: Render smoke testi** (`ShareCard.render.spec.tsx`, node ortamı): içi
      `NameBlock`, `StatNumber`, `KillLossBars` ve dört rozetle dolu bir
      `ShareCardFrame`'i `new ImageResponse(..., { ...SHARE_CARD_SIZE, fonts })` ile
      çiz; görseller küçük data-URI PNG; sonuç PNG imzasıyla başlar, IHDR genişlik 1200 /
      yükseklik 630. Satori'nin "display: flex" hataları burada yakalanır.
- [ ] **Adım 3:** İki dosya FAIL.
- [ ] **Adım 4: Uygula.**
- [ ] **Adım 5:** PASS; `build:check` temiz.
- [ ] **Adım 6: Commit** — `feat(og): add the shared share card frame and parts`

### Task 4: Killmail kartı ve route

**Dosyalar:**

- Oluştur: `frontend/src/graphql/ShareKillmail.graphql`
- Oluştur: `frontend/src/components/ShareCard/KillmailShareCard.tsx`
- Oluştur: `frontend/src/lib/shareCard/killmailShare.ts` (veri → kart props + metin)
- Oluştur: `frontend/src/app/killmails/[id]/opengraph-image.tsx`, `layout.tsx`
- Test: `frontend/src/lib/shareCard/killmailShare.spec.ts`,
  `frontend/src/app/killmails/[id]/opengraph-image.spec.ts`

**Arayüzler:**

- Tüketir: Task 2 ve Task 3'ün tamamı; `getShipTier`, `formatISK`,
  `formatEveDateTime`, `attackerBadge`, `eveImageUrl`.
- Üretir:
  - Sorgu `ShareKillmail($id: ID!)`: `killmail(id)` → `killmailTime totalValue
destroyedValue droppedValue attackerCount solo npc`, `victim { character { id name }
corporation { id name } alliance { id name } shipType { id name dogmaAttributes {
attribute_id value } } }`, `solarSystem { name securityStatus constellation { region
{ name } } }`.
  - `killmailShareProps(km: ShareKillmailQuery['killmail']): KillmailShareCardProps`
  - `killmailShareText(km): { title: string; description: string }`
  - Görseller `eveImageUrl({ …, size: 256 })` (512 fetch). Kurbanın karakteri yoksa sol
    panelde corp logosu.

- [ ] **Adım 1: Testleri yaz** (`killmailShare.spec.ts`), spec örneği (#139681321)
      fixture'ıyla:
  - `killmailShareText` → `{ title: "Den'orm lost a Kronos", description: '1.10B ISK,
Sibot (Domain), 5 attackers' }`; solo'da `…, solo`; NPC'de `…, NPC`.
  - `killmailShareProps`: `total === '1.10B ISK'`, `destroyed === '982.44M destroyed'`,
    `dropped === '115.49M dropped'`, `secColor === '#facc15'`, `tierIcon` T2 için
    `/icons/t2.svg`, T1 için `null`; karakteri olmayan kurbanda `portrait` corp logosu
    URL'i, `memberships` alliance'sız tek satır.
  - `opengraph-image.spec.ts`: `fetchGraphQL` mock'u `null` dönünce varsayılan export
    status 404'lü bir `Response` döner ve `ImageResponse` oluşturulmaz.
- [ ] **Adım 2:** FAIL.
- [ ] **Adım 3: Uygula.** `opengraph-image.tsx`: `export const size =
SHARE_CARD_SIZE`, `contentType = 'image/png'`, `alt`, `export const revalidate =
false`; `fetchGraphQL(..., false)`. `layout.tsx`: `generateMetadata` aynı sorguyla
      `{ title, description, openGraph: { title, description }, twitter: { card:
'summary_large_image' } }`; veri yoksa `{}`, `notFound()` çağrılmaz; `children`'ı
      olduğu gibi döner.
- [ ] **Adım 4:** `yarn workspace frontend codegen`; testler PASS; `build:check` temiz.
- [ ] **Adım 5: Canlı doğrulama:**
      `curl -s -o <scratchpad>/km.png -w '%{http_code} %{content_type}'
http://localhost:3000/killmails/139681321/opengraph-image` → `200 image/png`; PNG'yi
      açıp spec'le karşılaştır. `curl -s http://localhost:3000/killmails/139681321 | grep
og:` başlık, açıklama ve mutlak `og:image` adresini gösterir. Var olmayan ID → 404.
- [ ] **Adım 6: Commit** — `feat(og): add the killmail share card`

### Task 5: Karakter, corporation ve alliance kartları

**Dosyalar:**

- Oluştur: `frontend/src/graphql/ShareCharacter.graphql`, `ShareCorporation.graphql`,
  `ShareAlliance.graphql`
- Oluştur: `frontend/src/components/ShareCard/{Character,Corporation,Alliance}ShareCard.tsx`
- Oluştur: `frontend/src/lib/shareCard/entityShare.ts`
- Oluştur: `frontend/src/app/{characters,corporations,alliances}/[id]/opengraph-image.tsx`
  ve `layout.tsx`
- Test: `frontend/src/lib/shareCard/entityShare.spec.ts`,
  `frontend/src/app/characters/[id]/opengraph-image.spec.ts`

**Arayüzler:**

- Tüketir: Task 1 query'leri; Task 2–3.
- Üretir:
  - Sorgular: `ShareCharacter($id: Int!)` → `character(id) { name corporation { id name }
alliance { id name } }` + `characterKillLossTotals(characterId: $id) { kills losses }`;
    `ShareCorporation` → `corporation(id) { name member_count alliance { id name } }` +
    `corporationKillLossTotals`; `ShareAlliance` → `alliance(id) { name memberCount
corporationCount sovereigntySystemCount }` + `allianceKillLossTotals`.
  - `characterShareText`, `corporationShareText`, `allianceShareText` → spec'teki metin
    tablosu; sayılar `toLocaleString('en-US')`.
  - Footer sağ: `Character`, `Corporation`, `Alliance`. Şerit `accent`. `revalidate =
3600`.
  - Yerleşim spec'teki ilgili bölümlerden: karakter ve corp tam boy barlar (üst 60,
    yükseklik 440), alliance kısa barlar (üst 190, yükseklik 300); corp'ta ticker yok;
    alliance etiketi `SOV`.

- [ ] **Adım 1: Testleri yaz** (`entityShare.spec.ts`), spec örnekleriyle:
  - `characterShareText` → `{ title: 'General XAN', description: 'Clown Swords.,
Fraternity. 252 kills, 58 losses' }`; alliance'sız → `'Clown Swords. 252 kills, 58
losses'`.
  - `corporationShareText` → `'Fraternity. 185 members, 439 kills, 92 losses'`;
    alliance'sız → `'185 members, 439 kills, 92 losses'`.
  - `allianceShareText` → `'54,429 members, 228 corporations, 329 sov systems'`.
  - Karakter/corp/alliance props: `losses: 0, kills: 0` iken `bars === null`.
  - `characters/[id]/opengraph-image.spec.ts`: veri `null` → 404.
- [ ] **Adım 2:** FAIL.
- [ ] **Adım 3: Uygula.**
- [ ] **Adım 4:** codegen; PASS; `build:check` temiz.
- [ ] **Adım 5: Canlı doğrulama:** 365974960, 98814817, 99003581 için Task 4 Adım 5'teki
      `curl` kontrolleri; PNG'ler spec'le karşılaştırılır.
- [ ] **Adım 6: Commit** — `feat(og): add character, corporation and alliance share
cards`

### Task 6: Güneş sistemi kartı

**Dosyalar:**

- Oluştur: `frontend/src/graphql/ShareSolarSystem.graphql`
- Oluştur: `frontend/src/components/ShareCard/SolarSystemShareCard.tsx`
- Oluştur: `frontend/src/lib/shareCard/solarSystemShare.ts`
- Oluştur: `frontend/src/app/solar-systems/[id]/opengraph-image.tsx`, `layout.tsx`
- Test: `frontend/src/lib/shareCard/solarSystemShare.spec.ts`

**Arayüzler:**

- Tüketir: Task 2–3; mevcut `solarSystemStats` ve `systemActivityHistory`.
- Üretir:
  - Sorgu `ShareSolarSystem($id: Int!)` → `solarSystem(id) { name securityStatus star {
typeId } constellation { name region { id name } } }`, `solarSystemStats(systemId:
$id) { kills24h }`, `systemActivityHistory(filter: { system_id: $id, hours: 24 }) {
npc_kills }`.
  - `solarSystemShareProps(data)` — `npcKills24h` = `npc_kills` toplamı; yıldız
    `eveImageUrl({ kind: 'ship', id: typeId, size: 256 })`, `transform: 'scaleY(-1)'`;
    region haritası `fileDataUri(regionMapUrl(regionId))`.
  - `solarSystemShareText(data)` → spec tablosu.
  - Footer sağ `Solar System`, şerit `accent`, `revalidate = 900`.

- [ ] **Adım 1: Testleri yaz** (Amamake örneği):
  - `solarSystemShareText` → `{ title: 'Amamake', description: '0.4, Hed, Heimatar. 119
kills in the last 24 hours' }`.
  - `npcKills24h`: `[{npc_kills: 20}, {npc_kills: 29}]` → `49`; boş liste → `0`.
  - `star: null` → `starImage === null`; region haritası dosyası yok → `regionMap ===
null` (kart düz zeminle çizilir).
- [ ] **Adım 2:** FAIL.
- [ ] **Adım 3: Uygula.**
- [ ] **Adım 4:** codegen; PASS; `build:check` temiz.
- [ ] **Adım 5: Canlı doğrulama:** 30002537 için `curl` kontrolleri. Local'de
      `system_activity` 2026-09-20'den beri güncel değil; NPC sayısının `0` çıkması
      beklenen durum, hata değil.
- [ ] **Adım 6: Commit** — `feat(og): add the solar system share card`

### Task 7: Doğrulama ve PR

- [ ] **Adım 1:** Tam set `qa` agent'ına, arka planda: `yarn test`,
      `yarn workspace backend build`, iki codegen, `yarn workspace frontend lint` (sayı
      main ile karşılaştırılır, dokunulan dosya listede olmamalı), `yarn workspace frontend
build:check`, `npx prettier --check` değişen dosyalar.
- [ ] **Adım 2:** Beş PNG'nin yolu ve kullanıcıya bakması gerekenler (uzun isimli bir
      corp, alliance'sız bir karakter, yıldızı mavi bir sistem) raporlanır.
- [ ] **Adım 3:** Kullanıcının `.env.local`'e ekleyeceği satır söylenir:
      `NEXT_PUBLIC_SITE_URL="http://localhost:3000"` (production'da gerçek domain).
- [ ] **Adım 4:** Push ve PR — başlık
      `feat(og): add open graph share cards for killmails, characters, corporations,
alliances and solar systems`; gövde #195/#196 tarzı düz yazı.
