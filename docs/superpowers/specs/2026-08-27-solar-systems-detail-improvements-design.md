# Solar System Detay Sayfası İyileştirmeleri — Tasarım

Tarih: 2026-08-27
Durum: Taslak — inceleme bekliyor
Kapsam: `frontend/src/app/solar-systems/[id]/page.tsx`, onu besleyen GraphQL katmanı
ve evren topolojisi için yeni bir ESI ingest hattı

## 1. Bağlam

Solar system detay sayfası uzamsal hiyerarşinin (Region → Constellation → Solar
System) en derin düğümü ve sitedeki en çok link alan sayfalardan biri. Bugün iki
sekmesi var: `Attributes` (system ID, security status, star ID, konum hiyerarşisi
ve ham x/y/z koordinatları) ve `Killmails` (sayfalanmış tablo + dört kartlık
"son 7 gün" sidebar'ı). Sayfanın tamamı tek bir 572 satırlık client component.

Kullanıcı dört sekmeyi zorunlu olarak istedi: **Adjacent Solar Systems**,
**Orbital Bodies** (gezegenler altında aylar ve asteroid belt'ler katlanabilir
şekilde), **Structures** ve **Sovereignty**. Bu dördünün üçü veritabanında
bulunmayan veriye dayanıyor, dolayısıyla bu tasarım bir sayfa iyileştirmesi
değil, aynı zamanda yeni bir evren topolojisi ingest'i.

## 2. Bugün elde ne var, ne yok

**Var:**

- `SolarSystem` modeli: id, name, constellation_id, security_status,
  security_class, star_id, position x/y/z. Başka hiçbir şey yok
  (`backend/prisma/schema/solarSystem.prisma`).
- Sovereignty: `sovereigntyStructures(systemId:)` sahip alliance'ı, ADM
  karşılığını (`occupancyLevel`) ve vulnerability penceresini döndürüyor;
  `sovereigntyActiveCampaigns` aktif kampanyaları veriyor
  (`backend/src/schemas/Sovereignty.graphql`). Sistem sayfası ikisine de
  dokunmuyor.
- `systemKillsHistory(filter: { system_id, hours })` saatlik ship / pod / NPC
  kill snapshot'ları döndürüyor (`backend/src/resolvers/system-kills/queries.ts:9`).
  Frontend bunun sadece en son satırını `latestKills` üzerinden okuyor.
- `Type` verisi ingest ediliyor, yani type_id → isim çözümü mevcut.

**Yok:** stargate, planet, moon, asteroid belt, station için hiçbir Prisma
modeli, worker, resolver ya da GraphQL tipi. Repo genelinde tek bir referans
bile yok.

**Kritik bulgu:** `backend/src/workers/worker-solar-systems.ts:29` zaten
`/universe/systems/{id}/` endpoint'ini çağırıyor. Bu endpoint yanıtında
`stargates[]`, `stations[]`, `planets[]` (her gezegen altında `moons[]` ve
`asteroid_belts[]` ID dizileriyle) ve `star_id` dönüyor. Worker bunların hepsini
atıyor, yalnızca name / constellation_id / security_status / position kaydediyor.

Yani **topolojinin tamamı — hangi sistemde hangi stargate, hangi gezegen, o
gezegenin hangi ayları ve belt'leri, hangi istasyonlar — zaten yapılan çağrının
içinden, ek bir ESI maliyeti olmadan çıkarılabilir.** Ek çağrı gereken tek şey
bu ID'lerin isimleri ve tipleri.

## 3. Problemler

**P1 — Zorunlu dört sekmenin üçü için veri yok.** Adjacent Solar Systems,
Orbital Bodies ve Structures sekmeleri, ingest edilmemiş veri olmadan
render edilemez.

**P2 — Varsayılan sekme en boş olanı.** `Attributes` sekmesinde işe yarar
neredeyse hiçbir şey yok: `System ID` ve `Star ID` ham ESI tanımlayıcıları,
koordinatlar `-1.2345e+17` metre olarak basılıyor, Location Hierarchy kartı ise
breadcrumb'da ve header'da zaten var olan linkleri tekrarlıyor.

**P3 — Backend'de hazır olan veri gösterilmiyor.** `systemKillsHistory` ve
`sovereigntyStructures` sunucu tarafında tamamen implement edilmiş, frontend
tarafından hiç sorgulanmıyor.

**P4 — Sistem düzeyinde toplu istatistik yok.** Toplam kill, yok edilen ISK, son
24 saatteki hareket, en yoğun saat — hiçbiri yok.

**P5 — URL senkronizasyon effect'i her render'da yazıyor.**
`frontend/src/app/solar-systems/[id]/page.tsx:128-137`'daki effect,
referans kararlılığı garanti olmayan `router`'a bağımlı ve `router.push`'u mount
anında da koşulsuz çağırıyor; kullanıcı hiçbir şeye dokunmadan gereksiz bir
history kaydı ekleniyor. Aynı kalıp killmails sayfasından yeni geri alındı.

**P6 — Sekme değişimi sayfalamayı sıfırlamıyor.** Killmails'in 7. sayfasından
başka sekmeye geçip dönünce `page=7` state'te ve URL'de kalıyor.

**P7 — Dört kartlık "top entities" sidebar'ı dört sayfada kopyalanmış**
(`solar-systems/[id]`, `killmails`, `alliances/[id]`, `corporations/[id]`),
mapping mantığı her seferinde tekrar yazılmış.

**P8 — Detay sorgusu yanlış dosyada.** `SolarSystem($id:)` sorgusu
`SolarSystems.graphql` içinde; repodaki diğer tüm varlıklar detay ve liste
sorgularını ayırmış.

## 4. Hedefler

1. İstenen dört sekmeyi gerçek veriyle çalışır hale getirmek.
2. Bunun için gereken evren topolojisini, ESI maliyetini minimumda tutan bir
   ingest hattıyla veritabanına almak.
3. Açılış sekmesini okumaya değer hale getirmek.
4. P5–P8'i bu işin parçası olarak düzeltmek, sonraya bırakmamak.

## Hedef olmayanlar

- **Upwell yapıları (Astrahus, Fortizar, Athanor, Tatara, Keepstar vb.) kapsam
  dışı.** Public ESI bunları sistem bazında vermiyor; yalnızca corp director
  scope'lu `/corporations/{id}/structures/` ile ya da killmail'lerden çıkarımla
  elde edilebilir. Kullanıcı bunu bilerek kapsam dışı bıraktı.
- Jump rotası hesaplama / rota bulma. Adjacency saklanıyor ama üzerinde graf
  araması yapılmıyor.
- Market verisi, endüstri indeksleri, sistem maliyet indeksleri.
- `KillmailsTable`, `Paginator` ve `Top*Card` bileşenlerinin kendilerinde
  yeniden tasarım.

## 5. Varsayımlar

Bunlar bir gereksinim görüşmesi olmadan alınmış kararlar; her biri itiraz
edilebilir.

- **V1 — Structures sekmesi NPC istasyonlarını gösteriyor.** Upwell kapsam dışı
  olduğuna göre geriye public ESI'da bulunan `stations[]` kalıyor. Sovereignty
  yapıları (TCU/IHub) burada tekrarlanmıyor; kendi sekmelerinde duruyorlar.
- **V2 — Her gök cismi ESI'dan otoriter olarak çekiliyor.** Ay ve asteroid belt
  isimleri kalıptan türetilmiyor. Bunlar sabit veri; tek seferlik çağrı sayısı
  repo için bir engel değil (alliance ve type ingest'leri zaten aynı büyüklükte)
  ve türetilen isim shattered sistemlerde ya da özel isimli cisimlerde sessizce
  yanlış olabilir. Ingest, repodaki mevcut `queue-*` / `worker-*` çiftleri
  kalıbıyla yazılıyor.
- **V3 — Gezegenler için `type_id` de saklanıyor.** `/universe/planets/{id}/`
  isim yanında `type_id` veriyor (Barren, Gas, Temperate, Storm…); listede
  gösterilecek değerli bir bilgi.
- **V4 — Overview sekmesi kalıyor.** Zorunlu dört sekmeye ek olarak bir Overview
  ve mevcut Killmails sekmesi duruyor; toplam altı sekme. Overview'de istatistik
  şeridi, kill aktivite grafiği ve katlanmış "Technical details" var.
- **V5 — Ham tanımlayıcılar silinmiyor, katlanıyor.** `System ID`, `Star ID` ve
  koordinatlar Overview altındaki `<details>` bloğuna taşınıyor; koordinatlar
  ayrıca AU'ya çevriliyor. Geliştiriciler ve API kullanıcıları için değerliler.
- **V6 — "En yoğun saat" son 7 gün üzerinden ve UTC.** EVE timer'ları ve
  uygulamanın geri kalanı zaten UTC tabanlı.
- **V7 — Değeri backfill edilmemiş killmail'ler ISK toplamında 0 sayılıyor**,
  hariç tutulmuyor — `KillmailOrderBy.ValueDesc`'in zaten davrandığı gibi.

## 6. Değerlendirilen yaklaşımlar

Asıl karar sekmelerin *ne* olacağı değil (kullanıcı söyledi), topolojinin
**nasıl** ingest edileceği.

**A — Topoloji bedava + tam ESI ingest (seçilen).** Aşama 1'de
`worker-solar-systems` genişletilir: zaten alınan `/universe/systems/{id}/`
yanıtından stargate, gezegen, ay, belt ve istasyon ID'leri ile aralarındaki
ilişkiler kaydedilir — ek ESI maliyeti sıfır. Aşama 2'de her nesne tipi için
repodaki `queue-*` / `worker-*` kalıbında bir çift yazılır ve isimler ile
tipler otoriter olarak ESI'dan çekilir. Aylar ve belt'ler dahil, istisnasız.

**B — İsim türetimi.** Ay ve belt isimlerini `<Gezegen Adı> - Moon <n>`
kalıbından üretmek çağrı sayısını sıfıra indirirdi, ama shattered sistemlerde ve
özel isimli cisimlerde sessizce yanlış isim üretme riski taşıyor ve doğruluğu
ancak yine ESI'ya sorarak ölçülebiliyor. Kullanıcı bu takası reddetti: veri
sabit, çağrı sayısı sorun değil.

**C — SDE ithalatı.** EVE Static Data Export'u içe aktarmak tüm bu veriyi tek
seferde verir, ama repoda SDE hattı yok; yeni bir indirme, ayrıştırma ve sürüm
takibi mekanizması gerekir ve mevcut mimari tamamen ESI + RabbitMQ üzerine
kurulu.

**Seçilen: A.** Mevcut ingest mimarisiyle birebir aynı kalıp, otoriter veri,
tahmin yok. Aşama 1 topolojiyi bedavaya aldığı için Aşama 2'nin kuyrukları
ESI'nın liste endpoint'lerine değil doğrudan veritabanına dayanabiliyor — ki
aylar ve belt'ler için ESI'da zaten liste endpoint'i yok.

## 7. Tasarım

### 7.1 Sayfa yapısı

```
Breadcrumb (değişmiyor)
Header
  ├─ security tonlu ikon, sistem adı, SecurityBadge
  ├─ constellation / region linkleri
  ├─ sovereignty sahibi çipi              ← yeni, yalnızca sov tutulan sistemlerde
  └─ latestKills özeti (değişmiyor)
İstatistik şeridi                         ← yeni: 4 kutu, sekmelerin üstünde hep görünür
Sekmeler: [ Overview | Adjacent | Orbital Bodies | Structures | Sovereignty | Killmails ]
  Overview          → aktivite grafiği + katlanmış technical details
  Adjacent          → komşu sistemler tablosu
  Orbital Bodies    → gezegen listesi, her gezegen katlanabilir (aylar + belt'ler)
  Structures        → NPC istasyonları
  Sovereignty       → sahip, ADM, timer, aktif kampanya
  Killmails         → mevcut tablo + Paginator + TopEntitySidebar
```

Sekme sayısı altıya çıktığı için sekme çubuğu dar ekranlarda yatay kaydırılabilir
olmalı (`overflow-x-auto`); mevcut `flex gap-4` bu genişlikte taşar.

Sekme etiketleri sayı taşıyor — `Adjacent (7)`, `Orbital Bodies (12)`,
`Structures (3)` — `Region` detay sayfasındaki `Constellations (n)` kalıbıyla
aynı. Sayılar detay sorgusundan `_count` olarak geliyor, sekme açılmasını
beklemeden.

### 7.2 Veri modeli

Beş yeni Prisma modeli, `backend/prisma/schema/` altında ayrı dosyalarda
(repodaki mevcut düzen: model başına bir dosya).

```prisma
model Stargate {
  id                      Int         @id @map("stargate_id")
  name                    String?
  solar_system_id         Int
  destination_system_id   Int
  destination_stargate_id Int?
  type_id                 Int?
  position_x              Float?
  position_y              Float?
  position_z              Float?

  solar_system            SolarSystem @relation("SystemStargates", fields: [solar_system_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@index([destination_system_id])
  @@map("stargates")
}

model Planet {
  id              Int            @id @map("planet_id")
  name            String?
  solar_system_id Int
  type_id         Int?
  position_x      Float?
  position_y      Float?
  position_z      Float?

  solar_system    SolarSystem    @relation("SystemPlanets", fields: [solar_system_id], references: [id], onDelete: Cascade)
  moons           Moon[]
  asteroid_belts  AsteroidBelt[]

  @@index([solar_system_id])
  @@map("planets")
}

model Moon {
  id              Int         @id @map("moon_id")
  name            String?
  solar_system_id Int
  planet_id       Int?
  /// ESI'nın planets[].moons dizisindeki 1 tabanlı sırası; listede sıralama için.
  orbit_index     Int?

  solar_system    SolarSystem @relation("SystemMoons", fields: [solar_system_id], references: [id], onDelete: Cascade)
  planet          Planet?     @relation(fields: [planet_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@index([planet_id])
  @@map("moons")
}

model AsteroidBelt {
  id              Int         @id @map("asteroid_belt_id")
  name            String?
  solar_system_id Int
  planet_id       Int?
  orbit_index     Int?

  solar_system    SolarSystem @relation("SystemAsteroidBelts", fields: [solar_system_id], references: [id], onDelete: Cascade)
  planet          Planet?     @relation(fields: [planet_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@index([planet_id])
  @@map("asteroid_belts")
}

model Station {
  id                       Int         @id @map("station_id")
  name                     String?
  solar_system_id          Int
  type_id                  Int?
  owner_corporation_id     Int?
  race_id                  Int?
  reprocessing_efficiency  Float?
  max_dockable_ship_volume Float?
  services                 String[]
  position_x               Float?
  position_y               Float?
  position_z               Float?

  solar_system             SolarSystem @relation("SystemStations", fields: [solar_system_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@map("stations")
}
```

`SolarSystem` modeline karşılık gelen beş ters ilişki alanı ekleniyor.

`name` alanlarının hepsi nullable ve bu bilinçli: Aşama 1 ID'leri isimsiz
yazıyor, Aşama 2 dolduruyor. Sayfa isimsiz kaydı ID'siyle gösterebildiği için
ingest tamamlanmadan da çalışıyor. Aynı nullable alan, Aşama 2'nin kuyruk
scriptlerine `WHERE name IS NULL` ile doğal bir "kalan iş" sorgusu veriyor.

### 7.3 Ingest hattı

Bu proje ESI'dan veri çekerken her zaman aynı üç adımı izliyor: önce ID'leri
kuyruğa yazan bir `queue-*` scripti, sonra o kuyruğu tüketen domain worker'ı,
sonra iş periyodikse `ecosystem.config.js`'e bir cron girdisi. Aşağıdaki hat bu
kalıba birebir uyuyor.

**Aşama 1 — topoloji (ek ESI maliyeti yok).**
`backend/src/workers/worker-solar-systems.ts` genişletiliyor. Zaten elde olan
`/universe/systems/{id}/` yanıtından, tek bir Prisma transaction'ı içinde:

- `data.stargates[]` → `Stargate` satırları (`destination_system_id` henüz boş)
- `data.stations[]` → `Station` satırları
- `data.planets[]` → `Planet` satırları; her gezegenin `moons[]` ve
  `asteroid_belts[]` dizileri `Moon` / `AsteroidBelt` satırlarına, dizi sırası
  `orbit_index` olarak yazılıyor
- `data.star_id` → mevcut alana

Worker'ın bugünkü "zaten varsa atla" davranışı bir sorun: mevcut ~8 bin sistem
zaten kayıtlı, dolayısıyla hiçbiri yeniden işlenmez. Bu yüzden worker'a bir
`--force-topology` bayrağı ekleniyor; topoloji backfill'i bu bayrakla bir kez
çalıştırılıyor.

**Aşama 2 — isim ve tip çözümü.** Beş `queue-*` / `worker-*` çifti, repodaki
mevcut kalıpla birebir aynı yapıda (`backend/src/queues/queue-solar-systems.ts`
ve `backend/src/workers/worker-solar-systems.ts` referans alınıyor):

| Kuyruk scripti | Worker | Kuyruk adı | ESI endpoint'i |
|---|---|---|---|
| `queue-stargates.ts` | `worker-stargates.ts` | `esi_stargates_queue` | `/universe/stargates/{id}/` |
| `queue-stations.ts` | `worker-stations.ts` | `esi_stations_queue` | `/universe/stations/{id}/` |
| `queue-planets.ts` | `worker-planets.ts` | `esi_planets_queue` | `/universe/planets/{id}/` |
| `queue-moons.ts` | `worker-moons.ts` | `esi_moons_queue` | `/universe/moons/{id}/` |
| `queue-asteroid-belts.ts` | `worker-asteroid-belts.ts` | `esi_asteroid_belts_queue` | `/universe/asteroid_belts/{id}/` |

Mevcut `queue-*` scriptleri ID listelerini ESI'dan alıyor. Buradaki fark: Aşama 1
topolojiyi zaten yazdığı için kuyruk scriptleri ID'leri **veritabanından**
okuyor — `SELECT id FROM <tablo> WHERE name IS NULL`. Bu hem tekrar çalıştırmayı
doğal olarak idempotent yapıyor (yalnızca eksikler kuyruğa giriyor), hem de
zorunlu: ESI'da aylar ve asteroid belt'ler için liste endpoint'i yok.

Her worker, mevcut worker'ların rate limit davranışını birebir kopyalıyor:
istekler arası `RATE_LIMIT_DELAY`, `x-esi-error-limit-remain` 20'nin altına
inince yavaşlama, 420 yanıtında 60 saniye bekleyip mesajı yeniden kuyruğa alma,
404'te uyarıp geçme.

Kaydedilen alanlar:

- **stargate** → `name`, `destination.system_id`, `destination.stargate_id`,
  `type_id`, `position`. Adjacency bu worker olmadan çalışmaz.
- **station** → `name`, `type_id`, `owner`, `race_id`, `services`,
  `reprocessing_efficiency`, `max_dockable_ship_volume`, `position`.
- **planet** → `name`, `type_id`, `position`.
- **moon** → `name`, `position`.
- **asteroid_belt** → `name`, `position`.

`package.json`'a on yeni script ekleniyor (`queue:stargates`, `worker:stargates`
ve diğerleri), mevcut adlandırmayla aynı.

**Sıra.** Çalıştırma sırası stargate → station → planet → moon → asteroid belt.
Küçük ve sekme açan kümeler önce; aylar ve belt'ler en sonda, çünkü Orbital
Bodies sekmesinde katlanmış halde duruyorlar ve gezegen listesi onlarsız da
anlamlı.

**Aşama 3 — periyodik tazeleme (`ecosystem.config.js`).** Gök cisimleri sabit
veri; değişmelerinin tek yolu CCP'nin yeni sistem, gezegen veya stargate
eklediği bir güncelleme. Dolayısıyla bu ingest sürekli çalışan bir worker değil,
ayda bir çalışan bir iş.

`ecosystem.config.js`'e altı yeni PM2 girdisi ekleniyor, mevcut sovereignty
girdileriyle aynı biçimde (`autorestart: false`, `exec_mode: 'fork'`,
`cron_restart`, ayrı `error_file` / `out_file`):

| PM2 adı | args | cron_restart |
|---|---|---|
| `queue-universe-topology` | `queue:solar-systems --force-topology` | `0 3 1 * *` |
| `queue-stargates` | `queue:stargates` | `10 3 1 * *` |
| `queue-stations` | `queue:stations` | `20 3 1 * *` |
| `queue-planets` | `queue:planets` | `30 3 1 * *` |
| `queue-moons` | `queue:moons` | `40 3 1 * *` |
| `queue-asteroid-belts` | `queue:asteroid-belts` | `50 3 1 * *` |

Worker'lar mevcut `worker-info-*` girdileri gibi sürekli ayakta duruyor ve
kuyruk boşken bekliyor.

Aylık çalışma neredeyse bedava: kuyruk scriptleri `WHERE name IS NULL` ile
çalıştığı için, ilk backfill'den sonra kuyruğa yalnızca yeni eklenmiş cisimler
giriyor. Normal bir ayda bu sıfır mesaj demek.

### 7.4 GraphQL yüzeyi

`backend/src/schemas/SolarSystem.graphql` içine, `SolarSystem` tipine beş yeni
alan ve `SolarSystemStats` için yeni bir tip:

```graphql
type AdjacentSystem {
  "Bu sistemdeki stargate."
  stargateId: Int!
  stargateName: String
  system: SolarSystem!
}

type OrbitalBody {
  id: Int!
  name: String
  "Yalnızca gezegenlerde dolu; ESI type_id."
  typeId: Int
  typeName: String
}

type PlanetWithSatellites {
  id: Int!
  name: String
  typeId: Int
  typeName: String
  moons: [OrbitalBody!]!
  asteroidBelts: [OrbitalBody!]!
}

type StationInfo {
  id: Int!
  name: String
  typeId: Int
  typeName: String
  ownerCorporationId: Int
  ownerCorporationName: String
  raceId: Int
  services: [String!]!
  reprocessingEfficiency: Float
  maxDockableShipVolume: Float
}

type SolarSystemCounts {
  adjacentSystems: Int!
  planets: Int!
  moons: Int!
  asteroidBelts: Int!
  stations: Int!
  sovereigntyStructures: Int!
}

type SolarSystemStats {
  systemId: Int!
  totalKills: Int!
  totalIskDestroyed: Float!
  kills24h: Int!
  kills7d: Int!
  iskDestroyed7d: Float!
  lastKillTime: String
  "Son 7 günde en çok kill olan UTC saati (0-23)."
  busiestHourUtc: Int
}

extend type SolarSystem {
  adjacentSystems: [AdjacentSystem!]!
  planets: [PlanetWithSatellites!]!
  stations: [StationInfo!]!
  counts: SolarSystemCounts!
}

extend type Query {
  solarSystemStats(systemId: Int!): SolarSystemStats!
}
```

`adjacentSystems`, `planets`, `stations` ve `counts` alan resolver'ı olarak
`backend/src/resolvers/solar-system/fields.ts` içine giriyor; sekme açılmadan
sorgulanmıyorlar çünkü frontend her sekme için ayrı doküman kullanıyor. `counts`
ise sekme etiketleri için detay sorgusuyla birlikte geliyor.

`typeName` ve `ownerCorporationName` mevcut `Type` ve `Corporation` tablolarından
DataLoader ile çözülüyor (`backend/src/services/dataloaders.ts` zaten var).

**Ayrıca eklenen tek argüman:** `sovereigntyActiveCampaigns(limit: Int)`
opsiyonel bir `systemId: Int` kazanıyor, mevcut resolver'ın where koşuluna
`solar_system_id` filtresi giriyor. `sovereignty_campaigns` tablosundaki
`solar_system_id, start_time` indeksi bunu zaten karşılıyor.

**`solarSystemStats` resolver'ı** `backend/src/resolvers/leaderboard/queries.ts:140`
kalıbını izliyor: `killmails` üzerinde `prisma.$queryRaw`, Redis'te 300 saniye
TTL. `killmail_filters` kullanılmıyor çünkü o tabloda `total_value` kolonu yok.
`killmails` tablosunda bugün `solar_system_id` ve `killmail_time` üzerinde tekil
indeksler var, bileşik yok; 24 saat ve 7 gün pencereleri için
`@@index([solar_system_id, killmail_time])` ve bir migration gerekiyor.

### 7.5 Frontend bileşenleri

| Dosya | Sorumluluk |
|-------|------------|
| `components/SolarSystemDetail/SystemStatsStrip.tsx` | Dört istatistik kutusu: Total Kills, ISK Destroyed, Kills (24h), Busiest Hour. |
| `components/SystemActivityChart/SystemActivityChart.tsx` | Saatlik ship/pod/NPC kill'lerin ECharts çizgi grafiği, 24s / 7g aralık düğmesiyle. `AllianceGrowthChart`'ı birebir izliyor: `echarts-for-react`'in `ssr: false` ile `next/dynamic` import'u. |
| `components/SolarSystemDetail/OverviewTab.tsx` | Grafik + technical details. |
| `components/SolarSystemDetail/SystemTechnicalDetails.tsx` | Katlanmış `<details>`: system ID, star ID, security_class, tam security status, koordinatlar (üstel metre + AU). |
| `components/SolarSystemDetail/AdjacentSystemsTab.tsx` | Komşu sistem tablosu: sistem adı (link), security status rozeti, constellation, region, son 7 gün kill sayısı. |
| `components/SolarSystemDetail/OrbitalBodiesTab.tsx` | Gezegen listesi; her satır `<details>` ile katlanabilir, açılınca aylar ve asteroid belt'ler iki ayrı grup halinde listeleniyor. |
| `components/SolarSystemDetail/StructuresTab.tsx` | NPC istasyonları: isim, tip, sahip corporation (link), reprocessing verimliliği, servisler. |
| `components/SolarSystemDetail/SovereigntyTab.tsx` | Sahip alliance (link), yapı tipi, ADM, vulnerability penceresi, aktif kampanyalar. |
| `components/SolarSystemDetail/KillmailsTab.tsx` | Mevcut killmails bloğu, sayfadan olduğu gibi taşınmış. |
| `components/TopEntitySidebar/TopEntitySidebar.tsx` | Dört kartlık leaderboard sidebar'ı, tek seferde çıkarılmış. |

`frontend/src/app/solar-systems/[id]/page.tsx` bir kabuğa iniyor: param'ları
çöz, detay sorgusunu çalıştır, sekme state'ini tut, header + istatistik şeridi +
aktif sekmeyi render et. Hedef 200 satırın altı.

### 7.6 Refactor'lar

- **P5** — URL senkronizasyon effect'i siliniyor. State değişimi ve
  `router.replace` aynı callback içinde (`handleTabChange`, `handlePageChange`,
  `handlePageSizeChange`). `push` yerine `replace`, böylece sekme değiştirmek
  geri düğmesini ara durumlarla doldurmuyor. Bitmiş dosyada hiç `useEffect`
  kalmıyor.
- **P6** — `handleTabChange`, `currentPage`'i 1'e çekiyor.
- **P7** — Dört çağrı yeri de `TopEntitySidebar`'a geçiyor.
- **P8** — `SolarSystem($id:)` dokümanı yeni bir
  `frontend/src/graphql/SolarSystem.graphql` dosyasına taşınıyor; seçim setine
  `security_class` ve `counts` ekleniyor.

### 7.7 GraphQL dokümanları

- `SolarSystem.graphql` — detay sorgusu (taşındı, `counts` eklendi)
- `SolarSystemStats.graphql`
- `SystemKillsHistory.graphql`
- `SolarSystemAdjacent.graphql`
- `SolarSystemOrbitalBodies.graphql`
- `SolarSystemStations.graphql`
- `SolarSystemSovereignty.graphql` — `sovereigntyStructures(systemId:)` ve
  `sovereigntyActiveCampaigns(systemId:)` tek dokümanda

Her `.graphql` değişikliğinden sonra önce `yarn workspace backend codegen`, sonra
`yarn workspace frontend codegen`; frontend codegen'i
`../backend/src/generated-schema.graphql` dosyasını okuyor.

## 8. Veri akışı

```
page.tsx
  ├─ useSolarSystemQuery({ id })              → header, counts, technical details
  ├─ useSolarSystemStatsQuery({ systemId })   → istatistik şeridi
  └─ aktif sekme (yalnızca mount edilmişse sorgulanıyor)
       Overview       → useSystemKillsHistoryQuery
       Adjacent       → useSolarSystemAdjacentQuery
       Orbital Bodies → useSolarSystemOrbitalBodiesQuery
       Structures     → useSolarSystemStationsQuery
       Sovereignty    → useSolarSystemSovereigntyQuery
       Killmails      → useKillmailsQuery + useKillmailsDateCountsQuery + TopEntitySidebar
```

## 9. Yükleme, boş ve hata durumları

Bu sayfanın alışılmadık bir durumu var: **ingest tamamlanmadan da çalışması
gerekiyor.** Aşama 2 arka planda ilerlerken sayfa isimsiz kayıtlarla karşılaşacak.

- **İsimsiz kayıt** — `name` null ise nesne ID'siyle gösteriliyor
  (`Stargate 50000056`), gri ve italik. Satır gizlenmiyor: topoloji doğru,
  yalnızca etiket eksik.
- **Boş sekme** — hiç kaydı olmayan sekme için o sekmeye özel metin: "Bu
  sistemde NPC istasyonu yok", "Bu sistemde asteroid belt yok". Wormhole
  sistemlerinde stargate olmaması normal bir durum, hata değil.
- **Sovereignty** — sistemde sov yapısı yoksa sekme içeriği "Bu sistem
  sovereignty tutmuyor" diyor. Sekme yine de görünür kalıyor, çünkü kullanıcı
  onu zorunlu istedi; header'daki sovereignty çipi ise yalnızca sov varsa
  çıkıyor.
- **İstatistik şeridi** — yüklenirken iskelet kutular; hiç killmail'i olmayan
  sistem boş durum değil sıfır gösteriyor.
- **Aktivite grafiği** — `systemKillsHistory` boş dizi döndürdüğünde grafik
  yerine "No kill activity recorded in this window"; serisi olmayan bir eksen
  bozuk gibi okunuyor.
- **Hatalar** — üst düzey sistem sorgusu mevcut tam sayfa hatasını koruyor. Bir
  sekmenin sorgusundaki hata yalnızca o sekmeyi düşürüyor.

## 10. Doğrulama

Repoda test runner yok ve iki workspace'te de test dosyası yok. Bu tasarım bir
tane eklemiyor; o kendi başına bir karar ve kendi başına bir iş. Doğrulama şu:

- `yarn workspace backend build` (`tsc --noEmit`), `yarn workspace frontend lint`,
  `yarn workspace frontend build` — hepsi geçmeli.
- İki workspace'in codegen'i beklenmedik diff üretmemeli.
- **Ingest tamlığı:** her tablo için `SELECT COUNT(*) WHERE name IS NULL`
  sıfırlanmalı. Sıfırlanmayan satırlar ya 404 veren ölü ID'ler ya da yarım kalmış
  bir worker demek; ikisi de kuyruk yeniden çalıştırılarak ayırt ediliyor.
- **Adjacency'nin simetri kontrolü:** A sistemi B'yi komşu gösteriyorsa B de A'yı
  göstermeli. Tek yönlü kenar, eksik ya da hatalı stargate ingest'i demek.
- Manuel kontrol, dalları kapsayacak sistemlerde: Jita (yüksek hacim, çok
  istasyon, sovereignty yok), aktif kampanyası olan sov tutulan bir null-sec
  sistemi, bir wormhole sistemi (stargate yok, istasyon yok), ve hiç killmail
  kaydı olmayan bir sistem.
- Merge'den önce istatistik sorgularında `EXPLAIN ANALYZE` ile indeks kullanımı.

## 11. Riskler

- **R1 — Aşama 1 backfill'i mevcut worker'ın davranışını değiştiriyor.** Worker
  bugün "sistem zaten varsa atla" diyor; topoloji için bu atlamanın devre dışı
  bırakılması gerekiyor. Bayrak yanlış kullanılırsa ~8 bin sistem gereksiz yere
  yeniden ESI'dan çekilir. Bayrak yalnızca topolojiyi yeniden yazmalı, sistem
  alanlarını değil.
- **R2 — Aşama 2 uzun sürüyor ve yarım kalabilir.** Aylar ve belt'ler en büyük
  küme. Kuyruk scriptleri `WHERE name IS NULL` ile çalıştığı için kesinti sonrası
  yeniden çalıştırmak kaldığı yerden devam etmek anlamına geliyor; ayrıca sayfa
  isimsiz kayıtlarla çalışacak şekilde tasarlandı (§9), yani ingest bitmeden
  yayına alınabilir.
- **R3 — Adjacent sekmesi Aşama 2 olmadan hiç çalışmıyor.** Komşuluk bilgisi
  `destination_system_id` alanından geliyor ve o alan yalnızca
  `worker-stargates` ile doluyor; diğer sekmeler Aşama 1'den sonra kısmen
  çalışırken bu sekme çalışmaz. Bu yüzden stargate'ler çalıştırma sırasında ilk
  sırada.
- **R4 — Yüksek hacimli sistemlerde istatistik sorgusunun maliyeti.** 300
  saniyelik Redis cache'i ve bileşik indeksle hafifletiliyor. Yetmezse çare
  `totalKills` / `totalIskDestroyed`'ı bir rollup tablosuna taşımak.
- **R5 — Altı sekme dar ekranda taşıyor.** Sekme çubuğu `overflow-x-auto`
  olmalı; mevcut `flex gap-4` bu genişlikte kırılır.
- **R6 — `TopEntitySidebar` çıkarımı dört sayfaya dokunuyor.** Mapping'ler
  neredeyse aynı ama tam olarak aynı değil. Çıkarım kendi fazında, solar system
  işi doğrulandıktan sonra yapılıyor.
- **R7 — `system_kills` kapsamı.** Aktivite grafiği ancak `worker:system-kills`
  kadar iyi. Saklama süresi 7 günden kısaysa aralık düğmesi yalnızca 24 saatle
  çıkar; uygulama sırasında ilk adımda kontrol ediliyor.

## 12. Kapsam dışı

Upwell yapıları, jump rotası / rota bulma, market ve endüstri verisi, sistem
düzeyinde realtime killmail subscription'ı, sistem istatistikleri için rollup
tablosu, ve gök cisimleri için SDE tabanlı bir ingest hattı.

## 13. Dokunulan dosyalar (özet)

**Backend — yeni:** `prisma/schema/stargate.prisma`, `planet.prisma`,
`moon.prisma`, `asteroidBelt.prisma`, `station.prisma`; beş `queue-*` scripti ve
beş `worker-*` scripti; `resolvers/solar-system/fields.ts` içine dört alan
resolver'ı.

**Backend — değişen:** `workers/worker-solar-systems.ts` (topoloji + bayrak),
`schemas/SolarSystem.graphql`, `schemas/Sovereignty.graphql`,
`resolvers/solar-system/queries.ts`, `resolvers/sovereignty/queries.ts`,
`prisma/schema/solarSystem.prisma` (ters ilişkiler),
`prisma/schema/killmail.prisma` (bileşik indeks), `package.json` (on script),
`ecosystem.config.js` (altı cron girdisi).

**Frontend — yeni:** yedi GraphQL dokümanı; `SolarSystemDetail/` altında sekiz
bileşen; `SystemActivityChart/`; `TopEntitySidebar/`.

**Frontend — değişen:** `app/solar-systems/[id]/page.tsx` (kabuğa iniyor),
`graphql/SolarSystems.graphql`, ve `TopEntitySidebar`'ı benimseyen üç sayfa
(`killmails`, `alliances/[id]`, `corporations/[id]`).
