# Killmails sidebar: Systems, Regions ve Factions kartları

**Tarih:** 2026-09-07
**Durum:** Tasarım — gözden geçirme bekliyor
**Önkoşul:** [Leaderboard sorguları: periyot ada değil filtreye](./2026-09-07-leaderboard-query-shape-design.md). Bu spec o refactor
tamamlandıktan sonra, onun bıraktığı `TopFilter` şeklinin üzerine uygulanır.

## Problem

`/killmails` sayfasının sidebar'ında beş kart var: Most Active Pilots,
Most Active Corporations, Most Active Alliances, Most Used Ships,
Most Killed Ships. Rakip site aynı yerde yedi kart gösteriyor:
TOP CHARACTERS, TOP CORPORATIONS, TOP ALLIANCES, TOP FACTIONS, TOP SHIPS,
TOP SYSTEMS, TOP REGIONS.

Eşleştirme:

| Rakip | Bizde | Durum |
| --- | --- | --- |
| TOP CHARACTERS | Most Active Pilots | var |
| TOP CORPORATIONS | Most Active Corporations | var |
| TOP ALLIANCES | Most Active Alliances | var |
| TOP SHIPS | Most Used Ships + Most Killed Ships | var, bizde saldıran/ölen ayrımıyla |
| TOP FACTIONS | — | eksik |
| TOP SYSTEMS | — | eksik |
| TOP REGIONS | — | eksik |

## Hedef

Üç kart eklemek: Most Active Factions, Most Active Systems, Most Active Regions.

## Kapsam dışı

- Mevcut beş kartın görünümünü değiştirmek.
- `killmail_filters` tablosunun şemasını değiştirmek (aşağıda gerekçesi var).
- Faction'ları herhangi bir zamanlayıcıya bağlamak.
- `topAttackerShips`'in mekânsal filtre hatası ve `TopFilter`'a geçiş — bunlar
  önkoşul spec'in işi.
- Resolver'ları servis katmanına taşıyan refactor.

## Kararlar ve gerekçeleri

### Kart sırası

Rakiple aynı sıra, iki gemi kartımız araya girerek:

```
Most Active Pilots
Most Active Corporations
Most Active Alliances
Most Active Factions
Most Used Ships
Most Killed Ships
Most Active Systems
Most Active Regions
```

`TopEntitySidebar` hangi kartların render edileceğini `cards` dizisinden alıyor,
yani sayfa başına seçim zaten mümkün. Bu sekizli sıra `/killmails` sayfasına
aittir. `/solar-systems/[id]` sayfasında "Most Active Systems" ve
"Most Active Regions" gösterilmez — tek sistemle sınırlı bir sayfada ikisi de
tek satırlık liste üretir; oraya yalnızca "Most Active Factions" eklenir.

### Mevcut faction verisi: referans yok, referans veren kolonlar var

`factions` tablosu yok (`to_regclass('public.factions')` boş döndürüyor). Yani
bugün hiçbir faction'ın adı, açıklaması veya logosu çözülemiyor; frontend'de
üretilmiş dosyalar dışında `faction` geçen tek satır yok.

Buna karşılık `faction_id` dokuz kolonda duruyor ve dördü dolduruluyor:

| Tablo | Dolu | Toplam |
| --- | --- | --- |
| `corporations.faction_id` | 363 | 20.149 |
| `attackers.faction_id` | 106 | 134.743 |
| `alliances.faction_id` | 76 | 3.619 |
| `victims.faction_id` | 18 | 27.859 |
| `characters.faction_id` | 0 | 50.953 |
| `sovereignty_map_current.faction_id` | 0 | 0 (tablo boş) |

Yani worker'lar ESI'den geleni yazıyor, okuyan kimse yok. `factions` tablosu
geldiğinde kart dışında da işe yarar — 363 corporation ve 76 alliance'ın
faction'ı adıyla gösterilebilir hale gelir. Bu tur o sayfalara dokunmuyor,
sadece tablonun tek bir kart için kurulmadığı not ediliyor.

`characters.faction_id`'nin 50.953'te tam sıfır olması ayrıca bakılacak bir
konu. ESI karakter endpoint'i bu alanı yalnızca militia'daki karakterler için
döndürdüğünden düşük olması beklenir, ama sıfır şüphelidir. Kart bu kolonu
kullanmıyor (sayım `attackers.faction_id` üzerinden), yani işi bloke etmiyor.

### Faction sayımı: saldıran taraf, NPC dahil, 500021 hariç

Kart "bu faction kaç kill yaptı"yı sayar — diğer "Most Active" kartlarının
mantığıyla aynı. Kurban tarafı için ayrı bir kart açılmaz.

NPC faction'ları (Guristas, Angel Cartel, Triglavian, ...) listeye dahildir.
Tek istisna **500021**: ESI'de adı düz `"Unknown"` olan, `corporation_id`'si
bile bulunmayan bir placeholder. Sorguda `a.faction_id <> 500021` ile dışlanır.

Bugünkü veri incedir — 106 satır, 13 farklı faction. Kart yine de diğerleriyle
aynı boş-durum metnini kullanır (`No faction data available`); eşik koyup
gizlenmez.

### Faction verisi: queue'suz worker

ESI'de `/universe/factions/{id}/` **yoktur**; yalnızca 27 nesnenin tamamını tek
çağrıda döndüren `GET /universe/factions` vardır (2026-09-07'de
`https://esi.evetech.net/meta/openapi.json` üzerinde doğrulandı). Fan-out
edilecek bir ID listesi olmadığı için queue → worker zinciri boşa dönerdi:
kuyruğa yazan script veriyi zaten elinde tutuyor olurdu.

Kod tabanında bu şeklin kalıbı zaten var. `worker-races.ts` ve
`worker-bloodlines.ts` küçük bir ESI liste endpoint'ini çeker, upsert eder,
**queue kullanmaz**, elle çalıştırılır. Faction aynı kalıbı izler.

Zamanlayıcıya girmez. CLAUDE.md'nin kuralı: değişen veri zamanlanır, statik
referans verisi elle bir kez çalıştırılır. Faction listesi çok seyrek değişir
(Deathless Circle son eklenendi), `worker:races` gibi elle çalıştırılır.

Logo kaynağı: `https://images.evetech.net/factions/{id}/logo` HTTP 400 döner —
böyle bir yol yok. Faction ID'leri image server'da alliance uzayındadır ve
`https://images.evetech.net/alliances/{faction_id}/logo` çalışır; 500021 dahil
test edildi.

### `killmail_filters`'a faction kolonu eklenmez

İlk düşünülen tasarım `killmail_filters`'a `attacker_faction_ids INTEGER[]` ve
`victim_faction_id INTEGER` eklemek, backfill etmek ve
`killmail-filters-realtime.ts`'in INSERT'üne dahil etmekti. İki ölçümle
vazgeçildi:

1. **Diziler `DISTINCT`.** `attacker_ship_type_ids` ve kardeşleri
   `array_agg(DISTINCT …)` ile kuruluyor (orijinal MV migration'ı,
   `20260215010000_add_killmail_filters_materialized_view/migration.sql:18-21`)
   ve realtime insert de `new Set(...)` uyguluyor
   (`backend/src/services/killmail-filters-realtime.ts:49-52`). Bu kolonlar
   üzerinden sayarsak 20 kişilik bir Amarr filosu 1 sayılır — kart için bu
   doğru olabilirdi, ama aynı kolonlara taşınacak `topAttackerShips`'in mevcut
   sayılarını bozardı.
2. **Kalıp zaten var.** Önkoşul spec'in tanımladığı üç SQL şeklinden B
   (`attackers ⋈ killmail_filters`) tam olarak bu iş için duruyor.

Ölçüm: `killmail_filters` 27.859 satırla `killmails`'in %100'ünü kapsıyor,
eksik satır yok. Son 7 günde 2.438 satır, 3.330 farklı sistem, 109 farklı
bölge. Bu hacimde `GROUP BY` 300 sn'lik cache'in arkasında; ayrı bir toplama
tablosu gerekmiyor.

Sonuç: `killmail_filters` üzerinde migration yok, backfill yok,
`killmail-filters-realtime.ts` değişmiyor. Tek migration yeni `factions`
tablosu için.

## Tasarım

### Veri katmanı

`backend/prisma/schema/faction.prisma` — `Race` modelinin kardeşi:

```prisma
model Faction {
  id                     Int      @id
  name                   String
  description            String?
  corporation_id         Int?
  militia_corporation_id Int?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  @@map("factions")
}
```

Migration CLAUDE.md'deki prosedürle üretilir: `prisma migrate diff` ile DDL
alınır, çıktıdaki beş korumalı tablonun (`killmail_filters`,
`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`,
`refresh_log`) `DROP TABLE` satırları silinir, kalanı elle yazılmış migration
olarak kaydedilir, `migrate deploy` ile uygulanır. `prisma migrate dev`
kullanılmaz.

### ESI istemcisi ve worker

- `backend/src/services/faction/faction.service.ts` — `FactionService.getFactions()`,
  `esiRateLimiter.execute()` arkasında `GET /universe/factions`.
- `backend/src/workers/worker-factions.ts` — `worker-races.ts`'in şablonu:
  listeyi çeker, `prismaWorker.faction.upsert` ile 27 satırı yazar, loglar,
  `process.exit`.
- `backend/package.json`: `"worker:factions": "tsx src/workers/worker-factions.ts"`.

Queue yok, `ecosystem.config.js`'e giriş yok, crontab'a giriş yok.

### GraphQL şeması

Yeni dosya `backend/src/schemas/Faction.graphql`:

```graphql
type Faction {
  id: Int!
  name: String!
  description: String
  corporationId: Int
  militiaCorporationId: Int
}

extend type Query {
  faction(id: Int!): Faction
  factions: [Faction!]!
}
```

`backend/src/schemas/Leaderboard.graphql`'e üç çıktı tipi ve üç sorgu. Filtre
tipi yeni tanımlanmaz — önkoşul spec'in bıraktığı `TopFilter` kullanılır:

```graphql
type TopFaction { rank: Int!, killCount: Int!, faction: Faction }
type TopSystem  { rank: Int!, killCount: Int!, solarSystem: SolarSystem }
type TopRegion  { rank: Int!, killCount: Int!, region: Region }

extend type Query {
  topFactions(filter: TopFilter): [TopFaction!]!
  topSystems(filter: TopFilter): [TopSystem!]!
  topRegions(filter: TopFilter): [TopRegion!]!
}
```

`TopFilter` `systemId` / `constellationId` / `regionId` alanlarını taşıdığı için
bazı kombinasyonlar dejenere olur — `topRegions`'a `regionId` vermek tek satır
döndürür. Resolver'lar filtreleri koşulsuz uygular; özel durum yazılmaz.

Bu üç sorgu geçerli (özne, periyot) kombinasyonlarını 25'ten **40**'a çıkarır.
Önkoşul spec'teki maliyet ölçümü bunları da kapsıyor: üçü de aynı iki SQL
şeklini kullanıyor ve en pahalısı 90 günlük bir `GROUP BY`, yani bugünkü 27.859
satırlık tabloda tam tarama — 300 sn'lik cache'in arkasında.

### Resolver'lar

Üçü de `backend/src/resolvers/leaderboard/queries.ts` içinde, önkoşul spec'in
kurduğu yedi adımlı iskeletle: `limit` sınırlama → `resolvePeriod` →
tam parametreli cache anahtarı → `$queryRaw` → boşsa erken dönüş →
`findMany` + `Map` lookup → `redis.setex(key, cacheTtl, ...)`.

`topSystems` — şekil C, yalnız `killmail_filters`:

```sql
SELECT solar_system_id, COUNT(*)::BIGINT AS kill_count
FROM   killmail_filters
WHERE  killmail_time >= ${startDate}::date
  AND  killmail_time <  ${endDate}::date + INTERVAL '1 day'
  AND  solar_system_id IS NOT NULL
  -- opsiyonel: AND constellation_id = ..., AND region_id = ...
GROUP  BY solar_system_id
ORDER  BY kill_count DESC
LIMIT  ${limit}
```

`topRegions` aynı şekil, `GROUP BY region_id`.

`topFactions` — şekil B, `attackers ⋈ killmail_filters`:

```sql
SELECT a.faction_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
FROM   attackers a
INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
WHERE  kf.killmail_time >= ${startDate}::date
  AND  kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
  AND  a.faction_id IS NOT NULL
  AND  a.faction_id <> 500021
  -- opsiyonel: AND kf.solar_system_id / kf.constellation_id / kf.region_id
GROUP  BY a.faction_id
ORDER  BY kill_count DESC
LIMIT  ${limit}
```

`COUNT(DISTINCT kf.killmail_id)` bilinçlidir: 20 kişilik bir militia filosu o
killmail için faction'a 1 sayılır, 20 değil.

Lookup'lar: `prisma.faction.findMany`, `prisma.solarSystem.findMany`,
`prisma.region.findMany` — hepsi `where: { id: { in: ids } }` ile. Prisma alan
adı `id`; ham SQL'deki karşılıkları `solar_system_id` / `region_id`.

`backend/src/resolvers/faction/queries.ts` + `index.ts`'e bağlanma.

### Frontend

Yeni dokümanlar `frontend/src/graphql/` altında: `TopFactions.graphql`,
`TopSystems.graphql`, `TopRegions.graphql` — üçü de `$filter: TopFilter` alır.

Sistem kartında bölge adı `solarSystem { constellation { region { id name } } }`
zincirinden gelir; her iki adım da DataLoader'lı
(`resolvers/solar-system/fields.ts:26`, `resolvers/constellation/fields.ts:25`).

Üç yeni bileşen, `TopShipsCard`'ın iskeletiyle (`Card` + `RankNumber` + satır
listesi + loading/empty durumları):

- `TopFactionsCard` — `images.evetech.net/alliances/{id}/logo?size=64` logosu,
  ad, kill sayısı.
- `TopSystemsCard` — sistem adı, `SecurityStatus` bileşeniyle güvenlik statüsü,
  bölge adı, `/solar-systems/{id}` linki.
- `TopRegionsCard` — bölge adı, kill sayısı, `/regions/{id}` linki.

`TopEntitySidebar.tsx`:
- `TopEntityCardKind`'a `'factions' | 'systems' | 'regions'` eklenir.
- Üç yeni hook, mevcutlar gibi `skip: !has(kind)` ile koşulsuz çağrılır.
- `switch` bloğuna üç yeni `case`.

`frontend/src/app/killmails/page.tsx` içindeki `SIDEBAR_CARDS` yukarıdaki sekiz
kartlık sıraya göre yeniden dizilir.
`frontend/src/components/SolarSystemDetail/KillmailsTab.tsx` içindeki
`SIDEBAR_CARDS`'a `factions` eklenir; `systems` ve `regions` eklenmez.

## Hata yönetimi

- `worker-factions.ts`: ESI hatasında logla ve `exit(1)`; tek tek upsert
  hataları loglanıp döngü devam eder (`worker-races.ts` ile aynı).
- Resolver'lar: satır yoksa `[]` döner, kartlar `emptyText` gösterir.
- Faction/sistem/bölge lookup'ında eşleşme yoksa alan `null` döner; kart o
  satırı `Unknown` olarak çizer — mevcut kartların davranışı.

## Doğrulama

Test runner yok. Doğrulama şu komutlarla yapılır ve çıktıları okunur:

```bash
yarn workspace backend codegen
yarn workspace backend build
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
```

Migration öncesi/sonrası beş korumalı tablonun satır sayıları karşılaştırılır;
hiçbiri azalmamalıdır.

Veri doğrulaması: `yarn worker:factions` çalıştırılıp `factions` tablosunda 27
satır olduğu teyit edilir. Ardından backend'e doğrudan GraphQL sorguları atılır:

- `topFactions`, `topSystems`, `topRegions` filtresiz.
- Aynı üçü `systemId` ile — hata değil sonuç dönmeli.
- `topFactions` sonucunda 500021 bulunmamalı.

Görsel kontrol kullanıcıya aittir.
