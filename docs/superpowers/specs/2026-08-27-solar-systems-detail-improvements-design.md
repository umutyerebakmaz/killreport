# Solar System Detay Sayfası İyileştirmeleri — Tasarım

Tarih: 2026-08-27
Durum: Taslak — inceleme bekliyor
Kapsam: `frontend/src/app/solar-systems/[id]/page.tsx` ve onu besleyen GraphQL katmanı

## 1. Bağlam

Solar system detay sayfası uzamsal hiyerarşinin (Region → Constellation → Solar
System) en derin düğümü. Killmail tablosundan, sovereignty haritasından, sistem
listesinden ve sitedeki her breadcrumb'dan erişilebiliyor; bu da onu uygulamanın
en çok link alan sayfalarından biri yapıyor. Bugün iki sekme render ediyor:

- **Attributes** — üç kart: System Information (system ID, security status, star
  ID), Location Hierarchy (region → constellation → system linkleri) ve Position
  in Space (ham x/y/z koordinatları, üstel gösterimle).
- **Killmails** — sayfalanmış bir `KillmailsTable` ve dört kartlık bir sidebar
  (`TopCharacterCard`, `TopCorporationCard`, `TopAllianceCard`, `TopShipsCard`),
  hepsi bu sistem için son 7 güne kapsamlanmış.

Sayfa başlığında sistem adı, bir `SecurityBadge`, üst constellation ve region
linkleri, ve tek satırlık `latestKills` özeti (ship / pod / NPC kill sayıları ve
göreli zaman) var.

Sayfanın tamamı tek bir 572 satırlık client component.

## 2. Problemler

**P1 — Varsayılan sekme en boş olanı.** Ziyaretçi `Attributes` sekmesine
düşüyor ve orada işe yarar neredeyse hiçbir şey yok: `System ID` ve `Star ID`
oyuncuya hiçbir şey ifade etmeyen ham ESI tanımlayıcıları, x/y/z koordinatları
ise `-1.2345e+17` metre olarak basılıyor — kimsenin okuyup kullanabileceği bir
biçim değil. Location Hierarchy kartı da breadcrumb'da ve header'da zaten var
olan linkleri tekrarlıyor.

**P2 — Backend'de hazır olan veri gösterilmiyor.** İki yetenek sunucu tarafında
tamamen implement edilmiş ve frontend tarafından hiç sorgulanmıyor:

- `systemKillsHistory(filter: { system_id, hours })`, `system_kills` tablosundan
  saatlik ship / pod / NPC kill snapshot'ları döndürüyor
  (`backend/src/resolvers/system-kills/queries.ts:9`). Frontend bunun yalnızca
  en son satırını `latestKills` üzerinden okuyor.
- `sovereigntyStructures(systemId:)`, bir sistemdeki TCU/IHub yapıları için
  sahip alliance'ı, ADM karşılığını (`occupancyLevel`) ve vulnerability
  penceresini döndürüyor (`backend/src/schemas/Sovereignty.graphql:214`). Sistem
  sayfası sovereignty'den hiç söz etmiyor — oysa sovereignty uygulamanın başka
  yerlerinde birinci sınıf bir özellik.

**P3 — Sistem düzeyinde toplu istatistik yok.** Sayfa son 7 günde ne olduğunu ve
son killmail'in ne olduğunu söyleyebiliyor, ama bir sistem sayfasını
yer imine eklemeye değer kılan toplamları söyleyemiyor: toplam kill, yok edilen
ISK, son 24 saatteki hareket, ya da sistemin en yoğun olduğu saat.

**P4 — URL senkronizasyon effect'i her render'da yazıyor.**
`frontend/src/app/solar-systems/[id]/page.tsx:128-137`'daki effect, Next.js'in
referans kararlılığını garanti etmediği `router`'a bağımlı ve `router.push`'u
koşulsuz çağırıyor — mount anında da. Yani kullanıcı hiçbir şeye dokunmadan önce
gereksiz bir history kaydı ekleniyor. Aynı kalıp killmails sayfasından yeni geri
alındı; burada yeniden üretilmemeli.

**P5 — Sekme değişimi sayfalamayı sıfırlamıyor.** `activeTab` ve `currentPage`
bağımsız state'ler. Killmails'in 7. sayfasına gidip Attributes'a geçip geri
dönünce URL'de ve state'te `page=7` kalıyor, ama sekme yeni açılmış gibi
okunuyor.

**P6 — Dört kartlık "top entities" sidebar'ı kopyala-yapıştır.** Aynı blok —
dört `Top*Card` bileşeni, her birinde `Last 7 days` + `ROLLING` rozetli
subtitle, her birinde bir leaderboard satırını kart prop'larına çeviren mapping —
`solar-systems/[id]/page.tsx`, `killmails/page.tsx`, `alliances/[id]/page.tsx`
ve `corporations/[id]/page.tsx` dosyalarında, mapping mantığı her seferinde
tekrarlanarak duruyor.

**P7 — Detay sorgusu yanlış dosyada.** `SolarSystem($id:)` sorgusu
`frontend/src/graphql/SolarSystems.graphql` içinde tanımlı. Repodaki diğer tüm
varlıklar bunları ayırmış (`Alliance.graphql` / `Alliances.graphql`,
`Corporation.graphql` / `Corporations.graphql`, `Region.graphql` /
`Regions.graphql`).

## 3. Hedefler

1. Açılış sekmesini okumaya değer hale getirmek: ham tanımlayıcılar yerine toplu
   istatistikler, bir aktivite grafiği ve sovereignty durumu.
2. Yeni bir şey inşa etmeden önce, zaten var olan `systemKillsHistory` ve
   `sovereigntyStructures`'ı yüzeye çıkarmak.
3. Yalnızca bir tane yeni backend sorgusu eklemek — o da mevcut veriden
   türetilemeyen toplu istatistikler için.
4. P4–P7'yi bu işin parçası olarak düzeltmek, sonraya bırakmamak.

## Hedef olmayanlar

- Yeni ESI ingest yok. Stargate / komşu sistemler, gezegenler, aylar,
  istasyonlar ve NPC faction sahipliği veritabanında **yok**
  (`backend/prisma/schema/solarSystem.prisma` yalnızca id, name,
  constellation_id, security_status, security_class, star_id, position x/y/z
  içeriyor). Bunları eklemek yeni bir worker, yeni bir tablo ve tam bir backfill
  demek — ayrı bir proje.
- `KillmailsTable`, `Paginator` veya `Top*Card` bileşenlerinin kendilerinde
  yeniden tasarım yok. Bu iş onları olduğu gibi kullanıyor.
- Sovereignty ingest worker'larında değişiklik yok.

## 4. Varsayımlar

Bu kararlar bir gereksinim görüşmesi yapılmadan alındı. Her biri, uygulamaya
geçmeden önce itiraz edilebilecek bir nokta.

- **V1** — "İyileştirme" derken önce içerik derinliği, sonra yerleşim, sonra
  teknik borç anlaşıldı. Plan bu sırayla ilerliyor ve her faz bağımsız olarak
  sahaya çıkabiliyor.
- **V2** — İki sekmeli yapı kalıyor, ama `Attributes` yerine `Overview` geliyor.
  Üç sekme (Overview / Sovereignty / Killmails) olsaydı, sovereignty sekmesi her
  high-sec ve low-sec sistemde — yani New Eden'ın büyük çoğunluğunda — boş
  kalırdı.
- **V3** — Ham tanımlayıcılar (`System ID`, `Star ID`, üstel koordinatlar)
  sayfada kalıyor ama Overview'ün altında katlanmış bir "Technical details"
  bloğuna taşınıyor. Geliştiriciler ve API kullanıcıları için değerliler; tümden
  silmek o kitle için kayıp olur.
- **V4** — "En yoğun saat" son 7 gün üzerinden ve UTC olarak hesaplanıyor; EVE
  Online timer'ları ve uygulamanın geri kalanı zaten UTC tabanlı.
- **V5** — Yok edilen ISK toplamları `killmails.total_value`'dan okunuyor.
  Değeri henüz backfill edilmemiş killmail'ler hariç tutulmak yerine 0 sayılıyor
  — `KillmailOrderBy.ValueDesc`'in başka yerlerde zaten davrandığı gibi.

## 5. Değerlendirilen yaklaşımlar

**A seçeneği — Yalnızca frontend.** `systemKillsHistory` ve
`sovereigntyStructures` tüketilir, sekmeler yeniden kurgulanır, toplu
istatistikler tamamen atlanır. En ucuzu, tek geçişte çıkar, migration yok. Ama
P3 çözümsüz kalıyor ve sayfayı link'lenmeye değer kılan şey tam olarak o
toplamlar.

**B seçeneği — Frontend + tek yeni istatistik sorgusu (önerilen).** A
seçeneğindeki her şey, artı cache'li bir raw SQL aggregate ile beslenen tek bir
`solarSystemStats(systemId:)` sorgusu ve `sovereigntyActiveCampaigns`'a eklenen
opsiyonel bir `systemId` argümanı. Bir yeni tip, bir yeni resolver, şema
migration'ı yok.

**C seçeneği — Tam sistem profili.** B seçeneğine ek olarak, bir worker
tarafından beslenen yeni bir `system_stats` rollup tablosu ve sayfanın komşu
sistemleri ve jump rotalarını gösterebilmesi için stargate ESI ingest'i.
zKillboard'ın sistem sayfasıyla yarışan sürüm bu, ama backfill'i, `ecosystem.config.js`'e
girecek yeni bir worker'ı ve kendi operasyonel riski olan çok haftalık bir iş.

**Seçilen: B.** Bölüm 2'deki her problemi, getirisiyle orantılı bir maliyetle
kapatıyor. C seçeneğini ayırt eden şey — stargate grafiği — kendi başına tutarlı
bir ikinci proje ve bu tasarım onu bilinçli olarak ayrı bırakıyor.

## 6. Tasarım

### 6.1 Sayfa yapısı

```
Breadcrumb (değişmiyor)
Header
  ├─ security tonlu ikon, sistem adı, SecurityBadge
  ├─ constellation / region linkleri
  ├─ sovereignty sahibi çipi          ← yeni, yalnızca sov tutulan sistemlerde
  └─ latestKills özeti (değişmiyor)
İstatistik şeridi                     ← yeni: 4 kutu, sekmelerin üstünde hep görünür
Sekmeler: [ Overview | Killmails ]
  Overview
    ├─ SystemActivityChart            ← yeni, tam genişlik
    ├─ SolarSystemSovereigntyPanel    ← yeni, yalnızca sov tutulan sistemlerde
    └─ Technical details (katlanmış)  ← eski Attributes kartlarından dönüştürüldü
  Killmails
    └─ değişmiyor: tablo + Paginator + TopEntitySidebar
```

İstatistik şeridi sekme çubuğunun **üstünde** duruyor, böylece başlık sayılar
sekme değişiminde kaybolmuyor. Kutular: `Total kills`, `ISK destroyed`,
`Kills (24h)`, `Busiest hour (UTC)`.

### 6.2 Backend değişiklikleri

**Yeni sorgu.** `backend/src/schemas/SolarSystem.graphql`:

```graphql
"""
Aggregate kill statistics for a single solar system.
"""
type SolarSystemStats {
  systemId: Int!
  "All killmails ever recorded in this system."
  totalKills: Int!
  "Sum of killmails.total_value over all recorded kills; unvalued kills count as 0."
  totalIskDestroyed: Float!
  kills24h: Int!
  kills7d: Int!
  iskDestroyed7d: Float!
  "Timestamp of the most recent killmail, or null if the system has none."
  lastKillTime: String
  "UTC hour (0-23) with the most kills over the last 7 days; null when there are none."
  busiestHourUtc: Int
}

extend type Query {
  solarSystemStats(systemId: Int!): SolarSystemStats!
}
```

Resolver: `backend/src/resolvers/solar-system/queries.ts`,
`backend/src/resolvers/leaderboard/queries.ts:140`'daki `topLast7DaysPilots`
kalıbını izleyerek — `killmails` üzerinde `prisma.$queryRaw`, Redis'te
`solarSystemStats:{systemId}` anahtarıyla 300 saniyelik TTL. İki ifade: biri
yaşam boyu toplam, diğeri `EXTRACT(HOUR FROM killmail_time)` ile gruplanmış
7 günlük toplam.

`killmail_filters` burada bilinçli olarak **kullanılmıyor**: tabloda
`total_value` kolonu yok (bkz.
`backend/prisma/migrations/20260215010000_add_killmail_filters_materialized_view/migration.sql`),
dolayısıyla ISK toplamlarının doğrudan `killmails`'ten gelmesi gerekiyor.

**İndeks.** `killmails` bugün `solar_system_id` ve `killmail_time` üzerinde tekil
indekslere sahip (`backend/prisma/schema/killmail.prisma:19-20`), bileşik indeks
yok. Yaşam boyu toplam tek başına `solar_system_id` ile rahat karşılanıyor;
7 günlük ve 24 saatlik toplamlar iki kolonu birlikte filtreliyor ve
`@@index([solar_system_id, killmail_time])` ile bir migration gerektiriyor.
Merge'den önce üretim ölçeğindeki veriyle `EXPLAIN ANALYZE` ile doğrulanmalı —
Jita gibi bir sistemde fark, yüz binlerce satır üzerinde bitmap heap scan ile
index range scan arasındaki fark.

**Eklenen tek argüman.** `sovereigntyActiveCampaigns(limit: Int)` opsiyonel bir
`systemId: Int` kazanıyor; mevcut resolver'ın where koşulunda `solarSystemId`
üzerinden filtreleniyor. Yeni tip yok.

### 6.3 Yeni frontend bileşenleri

| Dosya | Sorumluluk |
|-------|------------|
| `components/SystemActivityChart/SystemActivityChart.tsx` | Saatlik ship / pod / NPC kill'lerin ECharts çizgi grafiği, 24s / 7g aralık düğmesiyle. `AllianceGrowthChart`'ı birebir izliyor: `echarts-for-react`'in `ssr: false` ile `next/dynamic` import'u, aralık state'i, `useMemo` ile seri türetimi. |
| `components/SolarSystemDetail/SystemStatsStrip.tsx` | Dört sunum amaçlı istatistik kutusu. Bir `SolarSystemStatsQuery` sonucu ve `loading` alıyor; yüklenirken iskelet gösteriyor. |
| `components/SolarSystemDetail/SolarSystemSovereigntyPanel.tsx` | Sahip alliance (linkli), yapı tipi, ADM (`occupancyLevel`), vulnerability penceresi ve bu sistemdeki aktif kampanya. Sistemde sovereignty yapısı yoksa hiçbir şey render etmiyor. |
| `components/SolarSystemDetail/SystemTechnicalDetails.tsx` | Katlanmış `<details>` bloğu: system ID, star ID, `security_class`, tam security status ve x/y/z — hem üstel metre hem AU'ya çevrilmiş halde. |
| `components/TopEntitySidebar/TopEntitySidebar.tsx` | Dört kartlık leaderboard sidebar'ı, tek seferde çıkarılmış. Prop'ları: bir konum filtresi (`{ systemId }` / `{ regionId }` / `{ constellationId }` / yok) ve dört `topLast7Days*` sorgusunu kendisi çalıştırıyor. |

### 6.4 Refactor'lar

- **P4** — URL senkronizasyon effect'i açık handler'larla değiştiriliyor. State
  değişimi ve karşılık gelen `router.replace` aynı callback içinde oluyor
  (`handleTabChange`, `goToPage`, `handlePageSizeChange`); hiçbir effect URL'e
  yazmıyor. `push` yerine `replace`, böylece sekme değiştirmek geri düğmesini ara
  durumlarla doldurmuyor.
- **P5** — `handleTabChange`, `currentPage`'i 1'e çekiyor.
- **P6** — Dört çağrı yeri de `TopEntitySidebar`'a geçiyor. Net satır azalmasının
  büyük kısmı buradan geliyor.
- **P7** — `SolarSystem($id:)` dokümanı yeni bir
  `frontend/src/graphql/SolarSystem.graphql` dosyasına taşınıyor, liste sorgusu
  `SolarSystems.graphql`'de kalıyor. Detay sorgusunun seçim setine
  `security_class` ekleniyor; tipte zaten var ve zaten ingest ediliyor.
- Sayfa bileşeni bir kabuğa iniyor: param'ları çöz, detay sorgusunu çalıştır,
  sekme state'ini tut, header + istatistik şeridi + aktif sekmeyi render et.
  Hedef 200 satırın altı; `OverviewTab` ve `KillmailsTab`
  `components/SolarSystemDetail/` altında kardeş dosyalar olarak duruyor.

### 6.5 Yeni GraphQL dokümanları

- `frontend/src/graphql/SolarSystem.graphql` — detay sorgusu (taşındı,
  genişletildi).
- `frontend/src/graphql/SolarSystemStats.graphql` — yeni istatistik sorgusu.
- `frontend/src/graphql/SystemKillsHistory.graphql` — yeni, grafik için.
- `frontend/src/graphql/SolarSystemSovereignty.graphql` —
  `sovereigntyStructures(systemId:)` ve `sovereigntyActiveCampaigns(systemId:)`
  tek dokümanda, böylece panel tek istek atıyor.

Her `.graphql` değişikliğinden sonra iki workspace de `yarn codegen` çalıştırıyor;
üretilen `frontend/src/generated/graphql.ts` bugün olduğu gibi commit'leniyor.

## 7. Veri akışı

```
page.tsx
  ├─ useSolarSystemQuery({ id })                    → header, technical details
  ├─ useSolarSystemStatsQuery({ systemId })         → istatistik şeridi
  └─ Overview sekmesi (mount edilmişse)
       ├─ useSystemKillsHistoryQuery({ system_id, hours })  → aktivite grafiği
       └─ useSolarSystemSovereigntyQuery({ systemId })      → sovereignty paneli
  └─ Killmails sekmesi (mount edilmişse)
       ├─ useKillmailsQuery({ systemId, page, limit })
       ├─ useKillmailsDateCountsQuery({ systemId })
       └─ TopEntitySidebar → dört topLast7Days* sorgusu
```

Sekmeye bağlı sorgular `skip: activeTab !== "..."` korumalarını koruyor — sayfa
bunu zaten doğru yapıyor. İstatistik şeridi skip edilmiyor, çünkü sekmelerin
üstünde render ediliyor.

## 8. Yükleme, boş ve hata durumları

- **İstatistik şeridi** — yüklenirken iskelet kutular. Hiç killmail'i olmayan
  bir sistem boş durum değil sıfır gösteriyor; sıfır kill gerçek ve anlamlı bir
  cevap.
- **Aktivite grafiği** — mevcut grafik yükleme davranışını kullanıyor.
  `systemKillsHistory` boş dizi döndürdüğünde grafik yerine "No kill activity
  recorded in this window" geliyor, çünkü serisi olmayan bir eksen bozuk gibi
  okunuyor.
- **Sovereignty paneli** — sistemde sov yapısı yoksa hiçbir şey render etmiyor.
  High-sec sistemlerde boş bir sovereignty kartı görünmemeli.
- **Hatalar** — üst düzey sistem sorgusu mevcut tam sayfa hatasını koruyor.
  İstatistik, grafik veya sovereignty sorgusundaki bir hata yalnızca o bölümü
  düşürüyor; sayfanın geri kalanı render olmaya devam ediyor. Bunlar tamamlayıcı
  paneller ve başarısız tek bir Redis okuması killmail tablosunu karartmamalı.

## 9. Doğrulama

Repoda test runner yok ve iki workspace'te de test dosyası yok. Bu tasarım bir
tane eklemiyor; o kendi başına bir karar ve kendi başına bir iş. Dolayısıyla
doğrulama şu:

- `yarn workspace backend build` — `tsc --noEmit`, geçmeli.
- `yarn workspace frontend lint` ve `yarn workspace frontend build`, geçmeli.
- `yarn workspace backend codegen` / `yarn workspace frontend codegen` beklenmedik
  diff üretmemeli.
- Ayakta bir stack'e karşı, dalları kapsayacak şekilde seçilmiş dört sistemde
  manuel kontrol: aktif kampanyası olan sov tutulan bir null-sec sistemi,
  kampanyasız bir null-sec sistemi, Jita (yüksek hacim, sovereignty yok) ve hiç
  killmail kaydı olmayan bir sistem.
- Merge'den önce, üretim ölçeğindeki veritabanına karşı iki istatistik ifadesinde
  `EXPLAIN ANALYZE` ile indeks kullanımının doğrulanması.

## 10. Riskler

- **R1 — Yüksek hacimli sistemlerde istatistik sorgusunun maliyeti.** 300
  saniyelik Redis cache'i ve indeks kontrolüyle hafifletiliyor. İndeksten sonra
  bile Jita üzerindeki yaşam boyu toplam yavaş kalırsa, çare `totalKills` /
  `totalIskDestroyed`'ı bir rollup tablosuna taşımak olur ki bu da bu parçayı C
  seçeneğinin tasarımına terfi ettirir.
- **R2 — `system_kills` kapsamı.** Grafik ancak `worker:system-kills` kadar iyi.
  Snapshot'lar seyrekse veya boşluklar varsa grafik bunu gösterecek. 7 günlük
  aralığa karar vermeden önce `system_kills` tablosunun saklama süresi ve
  periyodu doğrulanmalı; saklama daha kısaysa aralık düğmesi yalnızca 24 saatle
  çıkar.
- **R3 — `TopEntitySidebar` çıkarımı dört sayfaya dokunuyor.** Mapping'ler çağrı
  yerleri arasında neredeyse aynı ama tam olarak aynı değil. Çıkarım kendi
  fazında, solar system işi doğrulandıktan sonra yapılıyor; böylece oradaki bir
  regresyon yeni panellerdeki bir regresyonla karıştırılamaz.

## 11. Kapsam dışı

Komşu sistemler ve jump rotaları, gezegenler / aylar / istasyonlar, NPC faction
sahipliği, sistem düzeyinde realtime killmail subscription'ı ve sistem
istatistikleri için herhangi bir rollup tablosu.
