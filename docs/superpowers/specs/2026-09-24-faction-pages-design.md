# Faction sayfaları — tasarım

**Tarih:** 2026-09-24
**Durum:** incelemede
**İlgili:** `TopFactionsCard` (killmail sayfası sağ kenar çubuğu), ENTITIES menüsü
(ayrı PR, bu spec'in dışında)

Killmail sayfasındaki Top Factions kartı bugün hiçbir yere link vermiyor, çünkü
bir faction sayfası yok. Bu spec `/factions` liste sayfasını ve `/factions/[id]`
detay sayfasını tanımlıyor. Detay sayfası alliance sayfasıyla aynı seviyede
olacak: **Attributes**, **Killmails**, **Members** sekmeleri.

---

## 1. Bugünkü durum

2026-09-24'te okundu.

**Var olan:**

- `Faction` modeli (`backend/prisma/schema/faction.prisma`): `id`, `name`,
  `description`, `corporation_id`, `militia_corporation_id`. Tabloda 27 satır.
- `worker-factions.ts`, `GET /universe/factions` çağırıp bu beş alanı upsert
  ediyor; elle, bir kez çalıştırılan statik veri worker'ı. ESI'nin döndüğü
  `solar_system_id`, `station_count`, `station_system_count` kaydedilmiyor.
- GraphQL: `faction(id)` ve `factions` (`backend/src/schemas/Faction.graphql`),
  resolver'ları `backend/src/resolvers/faction/`.
- `faction_id` kolonu `attackers`, `victims`, `characters`, `corporations` ve
  `alliances` üzerinde var, hiçbirinde index yok.

**Veri miktarı:**

| Ölçüm                                       | Sayı    |
| ------------------------------------------- | ------- |
| `killmail_filters` / `victims` satırı       | 110.993 |
| `victims.faction_id` dolu                   | 12.014  |
| `attackers` satırı                          | 627.249 |
| `attackers.faction_id` dolu                 | 52.443  |
| `corporations.faction_id` dolu (FW militia) | 457     |
| `characters.faction_id` dolu                | 8.643   |

**Eksik olan:**

- `killmail_filters`'ta faction kolonu yok. `KillmailFilter` girdisinde
  `factionId` yok.
- `TopFactionsCard.tsx:82` satırları link değil, düz `span`.
- `frontend/src/app/factions/` yok.

---

## 2. Tanım: "faction killmail'i"

Bir killmail, **killmail'in kendi `faction_id` alanlarına** göre bir faction'a
aittir: victim'ın `faction_id`'si o faction'sa ya da attacker'lardan en az
birinin `faction_id`'si o faction'sa.

ESI bu değeri kill anındaki haliyle veriyor. Bir pilot militia'dan ayrılsa bile
eski kill'leri faction'ında kalır. `topFactions` da aynı tanımı kullandığı için
karttaki sayı ile sayfadaki liste tutarlıdır.

Corporation'ın **bugünkü** `faction_id`'si yalnızca Members sekmesinde ve üye
sayaçlarında kullanılır.

---

## 3. Veri katmanı

### 3.1 Migration

Tek bir elle yazılmış migration. CLAUDE.md'deki prosedür: satır sayıları →
`prisma migrate diff` → elle yönetilen beş tablonun `DROP`'larını sil →
`prisma migrate deploy` → satır sayıları tekrar.

`killmail_filters` Prisma şemasında değil, bu yüzden yeni kolonları da Prisma
şemasına **girmiyor**; migration'a elle eklenir.

**`killmail_filters`:**

```sql
ALTER TABLE killmail_filters
  ADD COLUMN victim_faction_id    int,
  ADD COLUMN attacker_faction_ids int[];

CREATE INDEX idx_kmfilters_victim_faction
  ON killmail_filters(victim_faction_id);
CREATE INDEX idx_kmfilters_attacker_factions
  ON killmail_filters USING GIN(attacker_faction_ids);
```

Kolon tanımları mevcut `victim_alliance_id` / `attacker_alliance_ids` ile
birebir aynı: nullable, default yok. Index adları mevcut `idx_kmfilters_*`
kalıbını izler.

**Backfill** (aynı migration'da):

```sql
UPDATE killmail_filters kf
SET    victim_faction_id = v.faction_id
FROM   victims v
WHERE  v.killmail_id = kf.killmail_id
  AND  v.faction_id IS NOT NULL;

UPDATE killmail_filters kf
SET    attacker_faction_ids = COALESCE(a.ids, '{}')
FROM   (SELECT killmail_id,
               array_agg(DISTINCT faction_id)
                 FILTER (WHERE faction_id IS NOT NULL) AS ids
        FROM   attackers
        GROUP  BY killmail_id) a
WHERE  a.killmail_id = kf.killmail_id;
```

Faction'ı olmayan killmail'in dizisi `'{}'` olur; `insertKillmailFilter` yeni
satırlara da boş dizi yazıyor, iki yol aynı sonucu verir.

500021 (ESI'nin "Unknown" yer tutucusu) diziye olduğu gibi yazılır. Kolon ham
veriyi tutar; ayıklamak okuyanın işidir (4.2'deki `factionTopFactionTargets`,
`topFactions`'ın bugün yaptığı gibi `<> 500021` ile ayıklar).

**`factions`:**

```sql
ALTER TABLE factions
  ADD COLUMN solar_system_id      int,
  ADD COLUMN station_count        int,
  ADD COLUMN station_system_count int;
```

Bu tablo Prisma şemasında; `faction.prisma` aynı alanlarla güncellenir ve
`prisma migrate diff` bu üç `ADD COLUMN`'u zaten üretir.

**Üye sayaçları için index:**

```sql
CREATE INDEX corporations_faction_id_idx ON corporations(faction_id);
CREATE INDEX characters_faction_id_idx   ON characters(faction_id);
```

İkisi de `corporation.prisma` ve `character.prisma`'ya `@@index([faction_id])`
olarak eklenir; diff bunları da üretir.

### 3.2 Yeni killmail'ler

`insertKillmailFilter` her killmail kaydında çağrılıyor
(`services/killmail-writer.ts:136`, `workers/repair-killmail-derived.ts:131`).
Değişen yerler:

- `services/killmail-derived.ts` → `toFilterInput`: `victim_faction_id` ve
  `attacker_faction_ids` alanlarını `KillmailDetail`'den doldurur.
- `services/killmail-filters-realtime.ts` → `KillmailFilterData` iki alanı
  kazanır; `insertKillmailFilter` diziyi diğer diziler gibi `null`'dan arındırıp
  tekilleştirir ve iki kolonu `INSERT`'e ekler.

`ON CONFLICT` davranışı değişmez: dizi kolonları hiçbir zaman yeniden yazılmaz.
Eski satırları 3.1'deki backfill kapsar.

### 3.3 Faction verisi

- `FactionService` ve `worker-factions.ts` üç yeni alanı da upsert eder.
- Migration'dan sonra `worker-factions` bir kez elle çalıştırılır. Statik veri,
  zamanlamaya eklenmez.

---

## 4. Backend API

### 4.1 `Faction` tipi

`backend/src/schemas/Faction.graphql`'a eklenen alanlar:

```graphql
type Faction {
  # mevcut: id, name, description, corporationId, militiaCorporationId
  solarSystem: SolarSystem
  stationCount: Int
  stationSystemCount: Int
  corporation: Corporation
  militiaCorporation: Corporation
  memberCorporationCount: Int!
  memberCharacterCount: Int!
  sovereigntySystemCount: Int!
}
```

- `solarSystem`, `corporation`, `militiaCorporation` mevcut DataLoader'larla
  çözülür (`services/dataloaders.ts`).
- Üç sayaç `faction-stats.service.ts`'deki fonksiyonlara delege edilir.
  `sovereigntySystemCount`, `sovereignty_map_current.faction_id` üzerinden sayar;
  o kolonda index zaten var.

### 4.2 `FactionStats.graphql` (yeni)

`AllianceStats.graphql` ile aynı kalıp:

```graphql
extend type Query {
  factionTopCharacters(
    factionId: Int!
    filter: TopTargetFilter
  ): [CharacterTopTarget!]!
  factionTopCorporations(
    factionId: Int!
    filter: TopTargetFilter
  ): [CorporationTopTarget!]!
  factionTopShips(factionId: Int!, filter: TopTargetFilter): [ShipTopKill!]!
  factionTopFactionTargets(
    factionId: Int!
    filter: TopTargetFilter
  ): [FactionTopTarget!]!
  factionTopShipTargets(
    factionId: Int!
    filter: TopTargetFilter
  ): [ShipTopKill!]!
}
```

`FactionTopTarget` yeni tip, `FactionTopTarget.graphql` dosyasında,
`AllianceTopTarget` ile aynı şekil: `{ faction: Faction!, killCount: Int! }`.

| Sorgu                      | Kaynak                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `factionTopCharacters`     | `kf` → `X = ANY(attacker_faction_ids)`, `attackers` join, `a.faction_id = X` |
| `factionTopCorporations`   | aynı, `a.corporation_id`'ye göre gruplanır                                   |
| `factionTopShips`          | aynı, `a.ship_type_id`'ye göre gruplanır                                     |
| `factionTopFactionTargets` | yalnızca `kf`, `victim_faction_id`'ye göre gruplanır                         |
| `factionTopShipTargets`    | yalnızca `kf`, `victim_ship_type_id`'ye göre gruplanır                       |

İlk üçündeki `attackers` join'i alliance'taki `getTopShips` / `getTopCharacters`
ile aynı: dizi "bu killmail'de hangi faction'lar var"ı söyler, "hangi pilot hangi
faction adına ateş etti"yi söylemez. Killmail kümesi önce GIN index'le daraltılır.

`factionTopFactionTargets` victim'ın kendi faction'ını (`victim_faction_id = X`)
ve 500021'i dışarıda bırakır.

Resolver'lar `backend/src/resolvers/faction/stats-queries.ts`'te, yalnızca
servise delege eder; `resolvers/index.ts`'e bağlanır.

### 4.3 `services/faction/faction-stats.service.ts` (yeni)

- Düz `async function`'lar; her biri `redis.get` → `$queryRaw` → `redis.setex`.
- Top sorguları: anahtar `faction_stats:${factionId}:${statType}:${filter ?? 'ALL_TIME'}`,
  TTL alliance'la aynı (TODAY 120, LAST_7_DAYS 300, LAST_90_DAYS 900,
  ALL_TIME 3600 sn). Zaman filtresi alliance'taki gibi `kf.killmail_time`
  üzerinden.
- Sayaçlar: anahtar `faction_stats:${factionId}:${counter}`, TTL 7200 sn.
- `::BIGINT` değerler `Number()` ile çevrilir.

### 4.4 Filtreler

- `KillmailFilter`'a `factionId: Int`.
  - `resolvers/killmail/queries.ts`'deki `hasKillmailFiltersCompatibleFilter`
    listesine eklenir.
  - `resolvers/killmail/filters-materialized.ts`'e alliance dalının kopyası:
    `(victim_faction_id = $n OR $n = ANY(attacker_faction_ids))`.
  - Aynı girdi `killmailsDateCounts`'u da besliyor; gün sayaçları da çalışır.
  - `killmails` cache anahtarı `JSON.stringify({ ...args.filter, ... })` ile
    üretiliyor (`resolvers/killmail/queries.ts:70`); `factionId` kendiliğinden
    girer, değişiklik gerekmez.
- `CorporationFilter`'a `factionId: Int`; `corporations` resolver'ında
  `allianceId` ile aynı biçimde `where`'e girer.

---

## 5. Frontend

### 5.1 `/factions`

- `frontend/src/app/factions/page.tsx`, `factions` sorgusu.
- 27 faction, filtre ve sayfalama yok.
- Alliances sayfasındaki kart ızgarası. `AllianceCard` alliance'a özel olduğu
  için aynı görünümde `components/FactionCard/FactionCard.tsx`: logo, ad,
  corporation sayısı, karakter sayısı, sovereignty sistemi sayısı.

### 5.2 `/factions/[id]`

`frontend/src/app/alliances/[id]/page.tsx` iskeleti:

- **Header:** `EveImage kind="corporation" id={faction.id}` (images.evetech.net'te
  faction yolu yok; `TopFactionsCard.tsx:62-78`'deki gerekçe), ad, üç rozet:
  Corporations, Characters, Sov Systems.
- **Sekmeler:** `?tab=` parametresi, `useTabList` ile klavye gezinmesi,
  varsayılan `attributes`.

| Sekme      | İçerik                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Attributes | açıklama, merkez sistem (`/solar-systems/[id]`), istasyon / istasyonlu sistem sayısı, corporation ve militia corporation (`/corporations/[id]`) |
| Killmails  | `lg:grid-cols-4`: solda `KillmailsTable` + gün sayaçları (`killmails` ve `killmailsDateCounts`, `factionId` ile); sağda beş kart                |
| Members    | `CorporationTable` + sayfalama, `corporations(filter: { factionId })`, sekme açık değilken `skip`                                               |

Killmails sekmesinin kartları, sırasıyla, hepsi `LAST_7_DAYS`:

1. Top Characters — `TopCharacterCard`
2. Top Corporations — `TopTargetsCard` (`linkPrefix="/corporations"`)
3. Top Ships — `TopShipsCard`
4. Top Target Factions — `TopTargetsCard` (`targetType="corporation"`,
   `linkPrefix="/factions"`). `targetType` yalnızca logonun `EveImage` türünü
   seçiyor, link'i `linkPrefix` kuruyor; faction logosu `corporation` yolundan
   geldiği için bileşende değişiklik gerekmez.
5. Top Target Ships — `TopShipsCard`

Belgeler: `frontend/src/graphql/Faction.graphql` (sayfa, liste, killmails,
members) ve `frontend/src/graphql/FactionStats.graphql` (beş kart).

### 5.3 Link'ler ve gezinme

- `TopFactionsCard` satırları `/factions/${id}?tab=killmails`'e link olur;
  diğer Top kartlarıyla aynı.
- Footer'ın "Explore" listesine "Factions".
- Header: **ENTITIES** menüsü (Factions, Alliances, Corporations, Characters)
  ayrı bir PR'da açılır. Bu iş o menüye yalnızca FACTIONS satırını ekler ve
  `match` listesine `/factions`'ı koyar. Menü PR'ı önce merge edilmemişse FACTIONS
  satırı o PR merge edilene kadar bekler.

---

## 6. Kapsam dışı

- Growth ve War History sekmeleri.
- ENTITIES menüsünün kendisi (ayrı PR).
- `TopCorporationCard.tsx:84`'teki `?=tab=killmails` yazım hatası (ayrı küçük PR).
- `topFactions` sorgusu. Bugünkü `attackers` join'iyle çalışmaya devam eder;
  yeni kolonları kullanmaya geçirilmez, servise de taşınmaz.
- Elle yönetilen beş tabloyu Prisma şemasına almak.
- `alliances.faction_id` (bugün hiçbir yerde okunmuyor).

---

## 7. Test ve doğrulama

### 7.1 Birim testleri (Vitest, TDD)

- `killmail-derived.spec.ts`: `toFilterInput` victim ve attacker faction'larını
  taşır; `null`'lar ayıklanır, tekrarlar tekilleşir.
- `killmail-filters-realtime.spec.ts`: iki yeni kolon `INSERT`'e girer.
- `faction-stats.service.spec.ts` (yeni): cache anahtarı `factionId`, `statType`
  ve `filter`'ın hepsini içerir; hit'te SQL'e gidilmez; `BigInt` → `Number`;
  TTL filtreye göre seçilir.
- `filters-materialized.spec.ts` (yeni): `factionId` dalı doğru koşulu üretir.
- `TopFactionsCard.spec.tsx` (yeni): satır `/factions/${id}?tab=killmails`'e
  link verir.

### 7.2 Veri doğrulaması

1. Migration'dan önce ve sonra beş elle yönetilen tablonun satır sayısı; hiçbiri
   azalmaz.
2. Backfill:
   - `attacker_faction_ids <> '{}'` olan `kf` satırları =
     `attackers`'ta `faction_id`'si dolu farklı `killmail_id` sayısı.
   - `victim_faction_id` dolu `kf` satırları = `victims.faction_id` dolu satır
     sayısı (12.014).
   - `attacker_faction_ids IS NULL` olan satır kalmaz.

### 7.3 API

Backend'e doğrudan GraphQL, en az 500003 (Amarr Empire) için: `faction` (tüm
yeni alanlarla), beş stats sorgusu, `killmails(filter: { factionId })`,
`killmailsDateCounts(filter: { factionId })`, `corporations(filter: { factionId })`.

### 7.4 PR öncesi

`yarn test`, `yarn workspace backend build`, backend ve frontend codegen,
`yarn workspace frontend lint` (sayı main ile karşılaştırılır, 141),
`yarn workspace frontend build`, `npx prettier --check` değişen dosyalarda.

### 7.5 Kullanıcının bakacakları

`/factions` ızgarası; detay sayfasının üç sekmesi; killmail sayfasındaki Top
Factions kartının link'leri.
