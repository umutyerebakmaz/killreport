# Leaderboard sorguları: periyot ada değil filtreye

**Tarih:** 2026-09-07
**Durum:** Tasarım — gözden geçirme bekliyor
**Sonraki iş:** [Killmails sidebar: Systems, Regions ve Factions kartları](./2026-09-07-sidebar-top-cards-design.md) bu şeklin üzerine oturur.

## Problem

`backend/src/schemas/Leaderboard.graphql` bugün dokuz sorgu tanımlıyor ve
periyodu her birinin adına gömüyor:

```
topPilots  topWeeklyPilots  topMonthlyPilots  top90DaysPilots  topLast7DaysPilots
topLast7DaysCorporations  topLast7DaysAlliances
topLast7DaysShips  topLast7DaysAttackerShips
```

İki ayrı sorun var.

### Ad, penceresini söylüyor; öznesini söylemiyor

Beş pilot sorgusunun çıktı tipi harfi harfine aynı:
`{ rank, killCount, character }`. Yine de beş ayrı `Top*Pilot` tipi ve beş ayrı
`Top*PilotsFilter` input'u var. Yeni bir periyot eklemek üç yeni şema tanımı
demek; yeni bir özneye beş periyot vermek on beş.

### Ad, verinin hangi taraftan geldiğini söylemiyor

`topLast7DaysShips`, `killmail_filters.victim_ship_type_id` üzerinden **yok
edilen** gemileri sayıyor. `topLast7DaysAttackerShips` ise saldıran gemileri.
Biri tarafını adında belirtiyor, diğeri belirtmiyor — ve UI'da ikisi
"Most Killed Ships" ve "Most Used Ships" olarak geçiyor. Şema adı, UI etiketi ve
okunan kolon üç ayrı şey söylüyor. Bir okuyucunun `topLast7DaysShips`'in nereden
sorguladığını şemaya bakarak bilmesi mümkün değil.

## Hedef

Periyodu filtreye taşımak, sorgu adlarının öznesini ve tarafını söylemesini
sağlamak, ve dokuz çıktı tipini yedi anlamlı tipe indirmek.

## Kapsam dışı

- Yeni kart eklemek. Bu, ardından gelen kart spec'inin işi.
- Resolver'ları servis katmanına taşımak.
- Cache TTL politikasını değiştirmek.
- `character_kill_stats` / `corporation_kill_stats` / `alliance_kill_stats`
  tablolarına dokunmak.

## Tasarım

### Şema

```graphql
enum LeaderboardPeriod {
  TODAY
  WEEK
  MONTH
  LAST_7_DAYS
  LAST_90_DAYS
}

input TopFilter {
  period: LeaderboardPeriod = LAST_7_DAYS
  """
  Periyodun çıpası. TODAY için YYYY-MM-DD, WEEK için haftanın herhangi bir günü
  (Pazartesi'ye yuvarlanır), MONTH için YYYY-MM. LAST_7_DAYS ve LAST_90_DAYS
  yuvarlanan pencerelerdir; onlarda yok sayılır. Boşsa bugün/bu hafta/bu ay.
  """
  anchor: String
  "Max 100; varsayılan 100"
  limit: Int
  systemId: Int
  constellationId: Int
  regionId: Int
}

type TopPilot       { rank: Int!, killCount: Int!, character: Character }
type TopCorporation { rank: Int!, killCount: Int!, corporation: Corporation }
type TopAlliance    { rank: Int!, killCount: Int!, alliance: Alliance }
type TopShip        { rank: Int!, killCount: Int!, shipType: Type }

extend type Query {
  topPilots(filter: TopFilter): [TopPilot!]!
  topCorporations(filter: TopFilter): [TopCorporation!]!
  topAlliances(filter: TopFilter): [TopAlliance!]!
  "Saldıranların kullandığı gemiler"
  topAttackerShips(filter: TopFilter): [TopShip!]!
  "Yok edilen gemiler"
  topDestroyedShips(filter: TopFilter): [TopShip!]!
}
```

Dokuz sorgu beşe, dokuz input tipi bire, dokuz çıktı tipi dörde iner.
`TopShip` iki sorgu tarafından paylaşılır; ikisi de `{rank, killCount, shipType}`
döndürür ve fark sorgunun adında.

`topPilots` adı korunuyor ama anlamı genişliyor: bugüne kadar "bugün", artık
`filter.period`. Varsayılan `LAST_7_DAYS` olduğu için argümansız çağrı
davranış değiştirir — bu bilinçli, aşağıdaki geçiş bölümünde ele alınıyor.

### Tek `anchor` alanı, üç ayrı alan yerine

`date` / `weekStart` / `month` üç ayrı opsiyonel alan olsaydı her sorguda ikisi
zorunlu olarak boş dururdu ve geçersiz kombinasyonlar (`period: MONTH` +
`weekStart`) şemada engellenemezdi. `period` zaten çıpanın nasıl okunacağını
söylüyor; tek alan yeterli ve biçimi alanın açıklamasında belgeleniyor.

### Periyot çözümleyici

`backend/src/resolvers/leaderboard/period.ts` — tek saf fonksiyon:

```typescript
resolvePeriod(period, anchor) => {
  startDate: string;   // YYYY-MM-DD, dahil
  endDate: string;     // YYYY-MM-DD, dahil
  isLive: boolean;     // pencere bugünü kapsıyor mu
  cacheTtl: number;    // isLive ? 300 : 3600
  cacheAnchor: string; // cache anahtarına giren normalize çıpa
}
```

Mevcut dokuz resolver'ın tarih mantığı buraya taşınır, davranış birebir korunur:

| period | aralık | isLive |
| --- | --- | --- |
| `TODAY` | `anchor` (boşsa bugün), tek gün | çıpa == bugün |
| `WEEK` | `getWeekMonday(anchor)` → +6 gün | pencere bugünü kapsıyorsa |
| `MONTH` | ayın 1'i → ayın son günü | pencere bugünü kapsıyorsa |
| `LAST_7_DAYS` | bugün − 6 gün → bugün | her zaman |
| `LAST_90_DAYS` | bugün − 89 gün → bugün | her zaman |

`getWeekMonday` bugün `queries.ts` içinde; buraya taşınır. UTC hesabı değişmez.

TTL kuralı CLAUDE.md'nin tablosuyla aynı kalır: canlı pencere 300 sn, kapanmış
geçmiş pencere 3600 sn. Bugün `topPilots`'ın `isToday ? 300 : 3600` ve
`topWeeklyPilots`'ın `isCurrentWeek` mantığı tam olarak budur.

### Üç SQL şekli

Refactor sonrası bütün sorgular üç şekilden birine düşer. Hangisinin
kullanılacağı **özneye** bağlıdır, periyoda değil:

**A — günlük toplama tablosu.** Mekânsal filtre yokken pilots / corporations /
alliances:

```sql
SELECT <id_kolonu>, SUM(kill_count) AS kill_count
FROM   <character|corporation|alliance>_kill_stats
WHERE  kill_date >= ${startDate}::date AND kill_date <= ${endDate}::date
GROUP  BY <id_kolonu>
ORDER  BY kill_count DESC
LIMIT  ${limit}
```

**B — `attackers ⋈ killmail_filters`.** Mekânsal filtre varken pilots /
corporations / alliances, ve her zaman `topAttackerShips`:

```sql
SELECT a.<kolon>, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
FROM   attackers a
INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
WHERE  kf.killmail_time >= ${startDate}::date
  AND  kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
  AND  a.<kolon> IS NOT NULL
  -- opsiyonel: AND kf.solar_system_id / kf.constellation_id / kf.region_id
GROUP  BY a.<kolon>
ORDER  BY kill_count DESC
LIMIT  ${limit}
```

**`topAttackerShips` bir istisnadır ve `COUNT(*)` kullanır**, `COUNT(DISTINCT)`
değil. Bugünkü davranış budur: beş kişilik bir Raven filosu beş sayılır, çünkü
soru "kaç pilot bu gemiyi kullandı". Pilot/corp/alliance tarafında ise aynı
killmail'de aynı varlık iki kez sayılmamalı, o yüzden `DISTINCT`. Bu fark
korunur ve resolver'da yorumla işaretlenir.

**C — yalnız `killmail_filters`.** `topDestroyedShips`:

```sql
SELECT victim_ship_type_id, COUNT(*)::BIGINT AS kill_count
FROM   killmail_filters
WHERE  killmail_time >= ${startDate}::date
  AND  killmail_time <  ${endDate}::date + INTERVAL '1 day'
  AND  victim_ship_type_id IS NOT NULL
  -- opsiyonel mekânsal filtreler
GROUP  BY victim_ship_type_id
ORDER  BY kill_count DESC
LIMIT  ${limit}
```

Not: B ve C'de üst sınır `<= endDate + INTERVAL '1 day'` yerine
`< endDate + INTERVAL '1 day'` olur. Mevcut kod `<=` kullanıyor, yani ertesi
günün tam 00:00:00'ındaki bir killmail'i içeri alıyor. Sınır hatası; bu
refactor'da düzeltilir.

### Resolver'lar

`backend/src/resolvers/leaderboard/queries.ts` beş resolver'a iner. Her biri:

1. `limit = Math.min(filter?.limit ?? 100, 100)`
2. `resolvePeriod(filter?.period ?? 'LAST_7_DAYS', filter?.anchor)`
3. Cache anahtarı — **her** parametre dahil:
   `leaderboard:{özne}:{period}:{cacheAnchor}:{limit}:{systemId}:{constellationId}:{regionId}`
4. `$queryRaw` ile A / B / C şekillerinden biri
5. Satır yoksa erken `[]` dönüşü
6. `findMany` + `Map` ile toplu lookup, `BigInt` → `Number`
7. `redis.setex(key, cacheTtl, ...)`

Ortak adımlar tek bir yardımcıya çıkarılmaz. Beş resolver'ın gövdesi kısa kalır
ve SQL'i görünür olur; sorguyu bir jenerik oluşturucunun arkasına saklamak
okunabilirlik hedefinin tersine çalışır.

### Yeni geçerli kombinasyonlar

Bugün 13 (özne, periyot) kombinasyonu var: pilots'ın beşi, diğer dört öznenin
yalnız `LAST_7_DAYS`'i. Yeni şemada beş özne × beş periyot = **25** kombinasyon
geçerli olur. GraphQL "bu özne yalnız şu periyotları destekler" diye bir kısıt
ifade edemez, dolayısıyla hepsi çalışmak zorundadır.

Bu ek iş değil, ölçü meselesi: üç SQL şekli de tarih aralığıyla
parametrelendiği için 25 kombinasyonun tamamı aynı kod yolundan geçer.

Maliyet ölçüldü. `killmail_filters` bugün **27.859** satır ve `killmails`'in
%100'ünü kapsıyor. En pahalı yeni kombinasyon `LAST_90_DAYS` + ship/attacker
öznesi, yani 90 günlük bir `GROUP BY` — bu hacimde tablonun tamamına yakınını
tarar ve yine de 300 sn'lik cache'in arkasındadır. Ayrı bir toplama tablosu
gerekmiyor.

Bunun ne zaman yeniden ele alınacağı: `killmail_filters` cache-miss'te 90
günlük `GROUP BY`'ın kabul edilebilir süresini aşacak kadar büyüdüğünde. O
noktada çözüm ship/system/region için de günlük `*_kill_stats` kardeşleri
eklemektir — ama bugün spekülatif olur.

### Frontend

Dokuz doküman beşe iner (`frontend/src/graphql/`):

| Silinen | Yerine |
| --- | --- |
| `TopPilots.graphql`, `TopWeeklyPilots.graphql`, `TopMonthlyPilots.graphql`, `Top90DaysPilots.graphql`, `TopLast7DaysPilots.graphql` | `TopPilots.graphql` |
| `TopLast7DaysCorporations.graphql` | `TopCorporations.graphql` |
| `TopLast7DaysAlliances.graphql` | `TopAlliances.graphql` |
| `TopLast7DaysAttackerShips.graphql` | `TopAttackerShips.graphql` |
| `TopLast7DaysShips.graphql` | `TopDestroyedShips.graphql` |

Hepsi `$filter: TopFilter` alır.

Üç dosya güncellenir:

- `frontend/src/app/leaderboards/page.tsx` — bugün dört ayrı hook kullanıyor
  (`useTopPilotsQuery`, `useTopWeeklyPilotsQuery`, `useTop90DaysPilotsQuery`,
  `useTopMonthlyPilotsQuery`). Dördü de tek `useTopPilotsQuery`'nin farklı
  `period` değerleriyle çağrılmasına dönüşür. Apollo (sorgu, değişkenler)
  ikilisiyle cache'lediği için dört ayrı çağrı sorunsuzdur.
- `frontend/src/components/WeeklyTopCharCard/WeeklyTopCharCard.tsx` —
  `useTopWeeklyPilotsQuery` → `useTopPilotsQuery({ period: WEEK })`.
- `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx` — beş hook
  yeni adlarına geçer, hepsi `period: LAST_7_DAYS`.

`TopEntitySidebar` tek bir `variables` nesnesini bütün sorgulara paylaştırıyor.
Bugün bu bir hata kaynağı: `TopLast7DaysAttackerShipsFilter`'da `systemId`
olmadığı için `/solar-systems/[id]` sayfasında o sorgu değişken doğrulamasında
tümüyle düşüyor ve kart boş çiziliyor:

```
Variable "$f" got invalid value { limit: 3, systemId: 30000142 };
Field "systemId" is not defined by type "TopLast7DaysAttackerShipsFilter".
```

Tek `TopFilter` bu hatayı örneğiyle değil sınıfıyla kapatır: bütün sorgular aynı
input tipini aldığı için paylaşılan-değişken tasarımı yapısı gereği doğru olur.

### Dokümanlar

`backend/docs/leaderboards/leaderboard-queries.md` ve
`backend/docs/leaderboards/leaderboards.md` eski adları anıyor; ikisi de yeni
şekle göre güncellenir.

## Geçiş

Deprecation penceresi açılmaz, adlar tek adımda değişir. Gerekçe: monorepo,
backend ve frontend birlikte dağıtılıyor, ve bu sorguların dışarıdan tüketicisi
yok — `backend/docs/api/` altında yayımlanmış bir sözleşme bulunmuyor.

Redis'te eski anahtar biçimindeki girdiler yetim kalır. Silinmezler; en geç
3600 sn içinde kendi TTL'leriyle düşerler. Elle temizlik yapılmaz —
`response-cache` eklentisinin `invalidate`'i tüm veritabanında `KEYS` taraması
yapıyor (`backend/src/plugins/response-cache.plugin.ts`) ve başka bir
uygulamanın anahtarlarına uzanabilir.

Davranış değişikliği olarak tek dikkat edilecek nokta `topPilots`: bugün
argümansız çağrıldığında "bugün", yeni şemada "son 7 gün" döndürür. Çağıran tek
yer `leaderboards/page.tsx` ve orası `period: TODAY`'i açıkça geçecek şekilde
güncellenir.

## Hata yönetimi

- `resolvePeriod` geçersiz bir `anchor` biçimi alırsa (`period`'un beklediğine
  uymayan bir string) hata fırlatır; GraphQL bunu alan hatası olarak döndürür.
  Sessizce bugüne düşmez — sessiz düşüş yanlış veriyi doğru gibi gösterir.
- Resolver'lar satır bulamazsa `[]` döner.
- Lookup'ta eşleşme yoksa varlık alanı `null` döner; mevcut davranış.

## Doğrulama

```bash
yarn workspace backend codegen
yarn workspace backend build
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
```

Davranış eşitliği, refactor'un asıl riski olduğu için ölçülerek gösterilir.
Değişiklikten **önce** dokuz sorgunun her biri backend'e atılıp çıktıları
kaydedilir; **sonra** yeni karşılıkları aynı parametrelerle atılır ve sıralama
ile `killCount` değerleri karşılaştırılır:

| Eski | Yeni |
| --- | --- |
| `topPilots` | `topPilots(period: TODAY)` |
| `topWeeklyPilots` | `topPilots(period: WEEK)` |
| `topMonthlyPilots` | `topPilots(period: MONTH)` |
| `top90DaysPilots` | `topPilots(period: LAST_90_DAYS)` |
| `topLast7DaysPilots` | `topPilots(period: LAST_7_DAYS)` |
| `topLast7DaysCorporations` | `topCorporations(period: LAST_7_DAYS)` |
| `topLast7DaysAlliances` | `topAlliances(period: LAST_7_DAYS)` |
| `topLast7DaysShips` | `topDestroyedShips(period: LAST_7_DAYS)` |
| `topLast7DaysAttackerShips` | `topAttackerShips(period: LAST_7_DAYS)` |

Tek beklenen fark, gün sınırındaki `<=` → `<` düzeltmesinin ertesi günün tam
00:00:00'ındaki bir killmail'i artık dışarıda bırakmasıdır.

Ayrıca `topAttackerShips` `systemId` ile atılır; giriş bölümündeki doğrulama
hatası yerine sonuç dönmelidir.

Görsel kontrol kullanıcıya aittir.
