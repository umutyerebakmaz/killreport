# Solar System Detay Sayfası İyileştirmeleri — Uygulama Planı

> **Ajan çalışanlar için:** ZORUNLU ALT-SKILL: Bu planı görev görev uygulamak
> için `superpowers:subagent-driven-development` (önerilen) ya da
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox (`- [ ]`)
> sözdizimi kullanıyor.

**Hedef:** Solar system detay sayfasına Adjacent / Orbital Bodies / Structures /
Sovereignty sekmelerini gerçek veriyle eklemek ve bunun için evren topolojisini
ESI'dan veritabanına almak.

**Mimari:** Dört adımlı bir ingest hattı — (1) mevcut `queue-solar-systems` kök
taraması, (2) `worker-solar-systems`'in genişletilerek `/universe/systems/{id}/`
yanıtındaki topolojiyi altı yeni tabloya yazması, (3) altı `queue-*`/`worker-*`
çiftiyle isim ve tip çözümü, (4) elle yeniden çalıştırma (cron yok). Üzerine
tablolarla birebir eşleşen GraphQL tipleri ve altı sekmeli bir detay sayfası.

**Teknoloji:** TypeScript, Prisma 7 + PostgreSQL, Apollo Server + GraphQL
Codegen, RabbitMQ (amqplib), Redis, Next.js 15 (App Router) + Apollo Client,
Tailwind, ECharts.

**Spec:** `docs/superpowers/specs/2026-08-27-solar-systems-detail-improvements-design.md`

---

## Global Kısıtlar

Bu bölüm her görevin gereksinimlerine örtük olarak dahildir.

- **Test runner yok.** Repoda hiçbir workspace'te test dosyası ya da test
  runner'ı yok (spec §10) ve bu iş bir tane eklemiyor. Bu planda "testi yaz →
  kırmızı → yeşil" döngüsünün yerini **doğrulama komutları** alıyor:
  `yarn workspace backend build` (`tsc --noEmit`), `yarn workspace backend codegen`,
  `yarn workspace frontend codegen`, `yarn workspace frontend lint`,
  `yarn workspace frontend build`, ve veri için `psql` sorguları.
- **Doğrulama kanıt ister.** Bir adımı tamamlandı saymadan önce komutu
  çalıştırıp çıktısını görmek zorunludur. Çıktısız "geçti" beyanı yasak.
- **ESI çağrı kuralları.** Her yeni worker şu davranışı birebir taşır: istekler
  arası `RATE_LIMIT_DELAY = 100` ms, `x-esi-error-limit-remain < 20` ise 2 sn
  bekle, HTTP 420'de 60 sn bekleyip mesajı requeue et (throw), HTTP 404'te
  uyarıp mesajı ack'le ve geç.
- **ESI base URL:** `https://esi.evetech.net/latest`.
- **Opsiyonel alan kuralı.** `/universe/systems/{id}/` yanıtında `stargates`,
  `stations`, `security_class` ve gezegen altındaki `moons` / `asteroid_belts`
  anahtarları **tamamen bulunmayabilir** (boş dizi değil, hiç yok). Hepsi
  `?? []` / `?? null` ile okunur.
- **ID'sini döndürmeyen iki endpoint.** `/universe/asteroid_belts/{id}/` ve
  `/universe/stars/{id}/` yanıtta kendi ID'lerini döndürmüyor; bu iki worker
  upsert anahtarını kuyruk mesajından alır.
- **Cron yok.** `ecosystem.config.js` bu iş kapsamında **değiştirilmiyor**.
  Hattın tamamı elle çalıştırılıyor (spec §7.3 Adım 4).
- **Prisma dosya düzeni:** model başına bir dosya, `backend/prisma/schema/`
  altında, dosya adı camelCase (`asteroidBelt.prisma`).
- **`prisma migrate dev` bu repoda ASLA çalıştırılmaz.** `killmail_filters`,
  `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` ve
  `refresh_log` tabloları veritabanında var ama `prisma/schema/` içinde **yok** —
  elle yazılmış SQL migration'larıyla yaratılmışlar ve `$queryRaw` ile
  okunuyorlar. Prisma beşini de şema kayması sanıp silmeyi teklif ediyor;
  2026-08-28'de bu 72.790 satır demekti. `prisma migrate status` bunu
  göstermiyor, yalnızca uygulanmış migration'lara bakıyor. Migration şöyle
  üretilir:
  1. `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema --script`
  2. Çıktıdaki o beş `DROP TABLE` satırı silinir.
  3. Kalanı `prisma/migrations/<UTC damga>_<ad>/migration.sql` olarak yazılır.
  4. `npx prisma migrate deploy` — bekleyen migration'ları uygular, hiçbir şey
     düşürmez.
  5. `npx prisma generate`.
- **Veri kaybı yok.** Hiçbir adım veritabanını sıfırlamaz, tablo düşürmez ya da
  Prisma'nın veri kaybı onayını kabul etmez. Her migration'dan önce ve sonra
  satır sayıları ölçülür ve raporlanır.
- **GraphQL tip adları tablolarla birebir:** `Stargate`, `Star`, `Planet`,
  `Moon`, `AsteroidBelt`, `Station`. `*Info` soneki kullanılmıyor.
- **Skaler değil nesne.** İlişkili varlıklar `type: Type`,
  `ownerCorporation: Corporation`, `solarSystem: SolarSystem` gibi nesne olarak
  döner; ham ID'ler (`typeId`, `ownerCorporationId`) yanlarında kalır. Hepsi
  DataLoader ile çözülür.
- **Commit mesajları İngilizce**, Claude atıfsız (ne `Co-Authored-By` ne
  `Generated with`).
- Her görev kendi commit'iyle biter.

---

## Dosya Yapısı

**Backend — yeni**

| Dosya | Sorumluluk |
|---|---|
| `prisma/schema/stargate.prisma` | `Stargate` modeli |
| `prisma/schema/star.prisma` | `Star` modeli |
| `prisma/schema/planet.prisma` | `Planet` modeli |
| `prisma/schema/moon.prisma` | `Moon` modeli |
| `prisma/schema/asteroidBelt.prisma` | `AsteroidBelt` modeli |
| `prisma/schema/station.prisma` | `Station` modeli |
| `src/workers/lib/celestial-worker.ts` | Altı gök cismi worker'ının paylaştığı RabbitMQ tüketme + rate limit + özet döngüsü |
| `src/queues/queue-{stargates,stars,stations,planets,moons,asteroid-belts}.ts` | Altı zenginleştirme kuyruğu (`WHERE name IS NULL`) |
| `src/workers/worker-{stargates,stars,stations,planets,moons,asteroid-belts}.ts` | Altı worker; her biri yalnızca endpoint + upsert eşlemesi tanımlar |
| `src/schemas/SolarSystemTopology.graphql` | `Stargate`, `StargateDestination`, `Star`, `Planet`, `Moon`, `AsteroidBelt`, `Station`, `SolarSystemCounts`, `SolarSystemStats` tipleri ve `SolarSystem` uzantısı |
| `src/resolvers/solar-system/topology-fields.ts` | `stargates`, `planets`, `stations`, `star`, `counts` alan resolver'ları ve alt tiplerin resolver'ları |

**Backend — değişen**

| Dosya | Değişiklik |
|---|---|
| `prisma/schema/solarSystem.prisma` | Altı ters ilişki alanı |
| `prisma/schema/killmail.prisma` | `@@index([solar_system_id, killmail_time])` |
| `src/workers/worker-solar-systems.ts` | Topoloji yazımı, `security_class` + `star_id`, varlık kontrolünün kaldırılması |
| `src/services/dataloaders.ts` | Yedi yeni loader |
| `src/resolvers/solar-system/fields.ts` | Topoloji alanlarının birleştirilmesi |
| `src/resolvers/solar-system/queries.ts` | `solarSystemStats` |
| `src/resolvers/index.ts` | Yeni tiplerin resolver kaydı |
| `src/schemas/SolarSystem.graphql` | Yinelenen `Position` tanımının silinmesi |
| `src/schemas/Constellation.graphql` | Yinelenen `Position` tanımının silinmesi |
| `src/schemas/Sovereignty.graphql` | `sovereigntyActiveCampaigns(systemId:)` |
| `src/resolvers/sovereignty/queries.ts` | Aynı filtrenin uygulanması |
| `src/server.ts` | GraphQL sorgu derinliği sınırı |
| `package.json` | On iki script |

**Frontend — yeni**

`src/graphql/` altına yedi doküman; `src/components/SolarSystemDetail/` altına
dokuz bileşen; `src/components/SystemActivityChart/SystemActivityChart.tsx`;
`src/components/TopEntitySidebar/TopEntitySidebar.tsx`.

**Frontend — değişen**

`src/app/solar-systems/[id]/page.tsx` (kabuğa iniyor),
`src/graphql/SolarSystems.graphql` (detay sorgusu çıkarılıyor), ve
`TopEntitySidebar`'ı benimseyen üç sayfa.

---

## Spec'ten Sapan Tek Karar

Spec §7.3 altı worker'ın "repodaki mevcut kalıpla birebir aynı yapıda"
yazılmasını söylüyor — yani her biri kendi RabbitMQ döngüsünü, sayaçlarını ve
rate limit mantığını taşıyan ~170 satırlık bağımsız dosyalar. Bu plan bunun
yerine ortak döngüyü `src/workers/lib/celestial-worker.ts`'e çıkarıyor; her
worker ~40 satıra iniyor ve yalnızca kendi endpoint'ini ve upsert eşlemesini
tanımlıyor. Davranış (rate limit, 420/404 işleme, tamamlanma özeti) birebir
korunuyor.

**Gerekçe:** altı kopya × 170 satır = ~1000 satır tekrar, ve bir rate limit
düzeltmesi altı yerde birden yapılmak zorunda kalır. Mevcut worker'lar bu ortak
kodu paylaşmıyor çünkü hiçbir zaman altısı birden aynı anda yazılmadı.

**Bunu istemiyorsanız:** Görev 3'teki `celestial-worker.ts` atlanır ve Görev
4–9'daki her worker `worker-solar-systems.ts` kopyalanarak yazılır. Plandaki
diğer hiçbir şey değişmez.

---

## Faz A — Veri modeli ve topoloji ingest'i

### Görev 1: Prisma modelleri ve migration

**Dosyalar:**
- Oluştur: `backend/prisma/schema/stargate.prisma`, `star.prisma`,
  `planet.prisma`, `moon.prisma`, `asteroidBelt.prisma`, `station.prisma`
- Değiştir: `backend/prisma/schema/solarSystem.prisma`,
  `backend/prisma/schema/killmail.prisma`

**Arayüzler:**
- Tüketir: yok (ilk görev)
- Üretir: Prisma Client üzerinde `prismaWorker.stargate`, `.star`, `.planet`,
  `.moon`, `.asteroidBelt`, `.station` modelleri. Alan adları aşağıdaki
  şemadaki gibi; sonraki tüm backend görevleri bunlara dayanıyor.

- [ ] **Adım 1: Altı model dosyasını oluştur**

`backend/prisma/schema/stargate.prisma`:

```prisma
model Stargate {
  id                      Int         @id @map("stargate_id")
  name                    String?
  solar_system_id         Int
  /// Adım 2 bunu boş bırakır; yalnızca worker-stargates doldurur.
  destination_system_id   Int?
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
```

`backend/prisma/schema/star.prisma`:

```prisma
model Star {
  id              Int         @id @map("star_id")
  name            String?
  solar_system_id Int         @unique
  type_id         Int?
  spectral_class  String?
  temperature     Int?
  radius          Float?
  /// Yıl cinsinden; 4.8e9 gibi değerler Int sınırını aştığı için Float.
  age             Float?
  luminosity      Float?

  solar_system    SolarSystem @relation("SystemStar", fields: [solar_system_id], references: [id], onDelete: Cascade)

  @@map("stars")
}
```

`backend/prisma/schema/planet.prisma`:

```prisma
model Planet {
  id              Int            @id @map("planet_id")
  name            String?
  solar_system_id Int
  type_id         Int?
  /// ESI'nın planets[] dizisindeki 1 tabanlı sıra.
  orbit_index     Int?
  position_x      Float?
  position_y      Float?
  position_z      Float?

  solar_system    SolarSystem    @relation("SystemPlanets", fields: [solar_system_id], references: [id], onDelete: Cascade)
  moons           Moon[]
  asteroid_belts  AsteroidBelt[]

  @@index([solar_system_id])
  @@map("planets")
}
```

`backend/prisma/schema/moon.prisma`:

```prisma
model Moon {
  id              Int         @id @map("moon_id")
  name            String?
  solar_system_id Int
  /// Zorunlu: ESI'da her ay bir gezegenin altındadır ve bu bağ yalnızca
  /// Adım 2'de yakalanabilir — /universe/moons/{id}/ planet_id döndürmüyor.
  planet_id       Int
  /// ESI'nın planets[].moons dizisindeki 1 tabanlı sıra.
  orbit_index     Int?
  position_x      Float?
  position_y      Float?
  position_z      Float?

  solar_system    SolarSystem @relation("SystemMoons", fields: [solar_system_id], references: [id], onDelete: Cascade)
  planet          Planet      @relation(fields: [planet_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@index([planet_id])
  @@map("moons")
}
```

`backend/prisma/schema/asteroidBelt.prisma`:

```prisma
model AsteroidBelt {
  id              Int         @id @map("asteroid_belt_id")
  name            String?
  solar_system_id Int
  /// Zorunlu; Moon.planet_id ile aynı gerekçe.
  planet_id       Int
  orbit_index     Int?
  position_x      Float?
  position_y      Float?
  position_z      Float?

  solar_system    SolarSystem @relation("SystemAsteroidBelts", fields: [solar_system_id], references: [id], onDelete: Cascade)
  planet          Planet      @relation(fields: [planet_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@index([planet_id])
  @@map("asteroid_belts")
}
```

`backend/prisma/schema/station.prisma`:

```prisma
model Station {
  id                         Int         @id @map("station_id")
  name                       String?
  solar_system_id            Int
  type_id                    Int?
  owner_corporation_id       Int?
  race_id                    Int?
  reprocessing_efficiency    Float?
  /// İstasyonun yeniden işlemeden aldığı pay (0.05 = %5).
  reprocessing_stations_take Float?
  /// ISK cinsinden ofis kirası.
  office_rental_cost         Float?
  max_dockable_ship_volume   Float?
  services                   String[]
  position_x                 Float?
  position_y                 Float?
  position_z                 Float?

  solar_system               SolarSystem @relation("SystemStations", fields: [solar_system_id], references: [id], onDelete: Cascade)

  @@index([solar_system_id])
  @@map("stations")
}
```

- [ ] **Adım 2: `SolarSystem`'e altı ters ilişki alanını ekle**

`backend/prisma/schema/solarSystem.prisma` içindeki `system_kills` satırının
hemen altına:

```prisma
  star             Star?          @relation("SystemStar")
  stargates        Stargate[]     @relation("SystemStargates")
  planets          Planet[]       @relation("SystemPlanets")
  moons            Moon[]         @relation("SystemMoons")
  asteroid_belts   AsteroidBelt[] @relation("SystemAsteroidBelts")
  stations         Station[]      @relation("SystemStations")
```

`star` alanı da ilişki adını açıkça taşımak zorunda. Adsız bırakılırsa Prisma
7.10 `P1012` veriyor: *"The relation field `star` on model `SolarSystem` is
missing an opposite relation field on the model `Star`"* — adlandırılmış bir
ilişkinin iki ucu da aynı adı yazmalı, çoğul taraflarda olduğu gibi.

- [ ] **Adım 3: `killmail.prisma`'ya bileşik indeksi ekle**

`backend/prisma/schema/killmail.prisma` içindeki `@@index([solar_system_id])`
satırının hemen altına:

```prisma
  @@index([solar_system_id, killmail_time])
```

Mevcut tekil `@@index([solar_system_id])` **silinmiyor** — başka sorgular onu
kullanıyor olabilir; bileşik indeksi kaldırmak ayrı bir karar.

- [ ] **Adım 4: Şemayı doğrula**

```bash
cd backend && npx prisma validate
```

Beklenen: `The schema at prisma/schema is valid 🚀`. Hata alırsan Adım 2'deki
`star` alanı için yukarıdaki alternatif yazımı dene.

- [ ] **Adım 5: Migration'ı elle üret ve uygula**

`prisma migrate dev` **kullanılmıyor** (Global Kısıtlar). Önce mevcut satır
sayılarını kaydet:

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT 'killmail_filters' t, COUNT(*) FROM killmail_filters
  UNION ALL SELECT 'character_kill_stats', COUNT(*) FROM character_kill_stats
  UNION ALL SELECT 'corporation_kill_stats', COUNT(*) FROM corporation_kill_stats
  UNION ALL SELECT 'alliance_kill_stats', COUNT(*) FROM alliance_kill_stats
  UNION ALL SELECT 'refresh_log', COUNT(*) FROM refresh_log
  UNION ALL SELECT 'killmails', COUNT(*) FROM killmails;"
```

DDL'i üret ve `DROP TABLE` bloğunu at:

```bash
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/topology-diff.sql
grep -n "^DROP" /tmp/topology-diff.sql   # beş satır çıkmalı, hepsi en başta
```

`prisma/migrations/20260828000000_add_universe_topology/migration.sql` dosyasını
oluştur: başına bunun neden elle yazıldığını anlatan bir yorum bloğu, ardından
`/tmp/topology-diff.sql`'in **ilk `CREATE TABLE`'dan itibaren** kalan kısmı.
Sonra hiç çalıştırılabilir `DROP` kalmadığını doğrula:

```bash
grep -n "^[^-]*DROP" prisma/migrations/20260828000000_add_universe_topology/migration.sql
# çıktı boş olmalı
npx prisma migrate deploy
```

Beklenen: `Applying migration 20260828000000_add_universe_topology` ve
`All migrations have been successfully applied.`

Ardından satır sayılarını tekrar ölç — **hiçbiri düşmemeli** (canlı
`worker-redisq` çalışıyorsa artabilir). Yeni tabloları ve kısıtları da doğrula:

```bash
psql "$DB" -c "SELECT 'stargates' t, COUNT(*) FROM stargates
  UNION ALL SELECT 'stars', COUNT(*) FROM stars
  UNION ALL SELECT 'planets', COUNT(*) FROM planets
  UNION ALL SELECT 'moons', COUNT(*) FROM moons
  UNION ALL SELECT 'asteroid_belts', COUNT(*) FROM asteroid_belts
  UNION ALL SELECT 'stations', COUNT(*) FROM stations;"

psql "$DB" -tAc "SELECT table_name||'.'||column_name||' nullable='||is_nullable
  FROM information_schema.columns
  WHERE table_name IN ('moons','asteroid_belts') AND column_name='planet_id';"

psql "$DB" -tAc "SELECT indexname FROM pg_indexes WHERE tablename='killmails'
  AND indexdef LIKE '%solar_system_id, killmail_time%';"
```

Beklenen: altı tablo var ve boş; `planet_id` için `nullable=NO`; bileşik indeks
adı dönüyor.

- [ ] **Adım 6: Client'ı üret ve derle**

```bash
cd backend && npx prisma generate && yarn build
```

Beklenen: ikisi de hatasız. `yarn build` `tsc --noEmit` çalıştırıyor.

- [ ] **Adım 7: Commit**

```bash
git add backend/prisma
git commit -m "feat(db): add universe topology models

Add Stargate, Star, Planet, Moon, AsteroidBelt and Station models plus the
reverse relations on SolarSystem. Moon.planet_id and AsteroidBelt.planet_id are
required: the planet link is only present in the /universe/systems/{id}/
response, and the per-object endpoints do not return it.

Also add a composite index on killmails(solar_system_id, killmail_time) for the
per-system 24h and 7d statistics windows."
```

---

### Görev 2: Topoloji yazımı — `worker-solar-systems`

**Dosyalar:**
- Değiştir: `backend/src/workers/worker-solar-systems.ts`

**Arayüzler:**
- Tüketir: Görev 1'in Prisma modelleri.
- Üretir: `stargates`, `stars`, `planets`, `moons`, `asteroid_belts`,
  `stations` tablolarında **isimsiz** (`name IS NULL`) satırlar ve aralarındaki
  ilişkiler. Görev 4–9'un kuyruk scriptleri bu satırları okuyor.

- [ ] **Adım 1: Varlık kontrolünü kaldır**

`worker-solar-systems.ts` içinden `solarSystemExists` fonksiyonunu (satır 11–19)
**tamamen sil**, ve `channel.consume` gövdesindeki şu bloğu da sil:

```ts
          // Check if solar system already exists in database
          const exists = await solarSystemExists(systemId);

          if (exists) {
            // Skip if already exists - no ESI call needed
            skippedCount++;
            logger.debug(
              `⏭️  Solar system ${systemId} already exists, skipping... (Processed: ${processedCount}, Skipped: ${skippedCount})`
            );
            channel.ack(msg);

            // Check if queue is empty
            const currentQueue = await channel.checkQueue(QUEUE_NAME);
            if (currentQueue.messageCount === 0) {
              printCompletionSummary(processedCount, skippedCount, errorCount, startTime);
            }
            return;
          }
```

Geriye kalan gövde doğrudan `await processSolarSystem(systemId)` ile başlar.
`skippedCount` değişkeni ve `printCompletionSummary`'nin `skipped` parametresi
**duruyor** — hep 0 basacak ve özet biçimi bozulmayacak.

Bu, alliance hattındaki kök tarayıcıyla hizalanmak demek: `queue-alliances` her
ID'yi filtresiz kuyruğa atar, "zaten var mı" filtresi bir alt kattaki
zenginleştirme kuyruğunun işidir.

- [ ] **Adım 2: `processSolarSystem`'i topolojiyi yazacak şekilde değiştir**

Fonksiyonun tamamını şununla değiştir:

```ts
interface EsiPlanet {
  planet_id: number;
  moons?: number[];
  asteroid_belts?: number[];
}

/**
 * Fetches solar system information from ESI and saves it — along with the full
 * celestial topology contained in the same response — to the database.
 */
async function processSolarSystem(systemId: number): Promise<boolean> {
  try {
    const response = await axios.get(`${ESI_BASE_URL}/universe/systems/${systemId}/`);
    const data = response.data;

    // Check rate limit headers
    const errorLimitRemain = response.headers['x-esi-error-limit-remain'];
    if (errorLimitRemain && parseInt(errorLimitRemain) < 20) {
      logger.warn(`⚠️  Error limit low (${errorLimitRemain}/100), slowing down...`);
      await sleep(2000);
    }

    // Every one of these keys can be absent from the response, not merely
    // empty: 4-HWWF has no `stations`, Thera has no `stargates` and no
    // `security_class`, Jita has planets with no `asteroid_belts`.
    const stargateIds: number[] = data.stargates ?? [];
    const stationIds: number[] = data.stations ?? [];
    const planets: EsiPlanet[] = data.planets ?? [];
    const starId: number | null = data.star_id ?? null;

    const systemRow = {
      name: data.name,
      constellation_id: data.constellation_id ?? null,
      security_status: data.security_status ?? null,
      security_class: data.security_class ?? null,
      star_id: starId,
      position_x: data.position?.x ?? null,
      position_y: data.position?.y ?? null,
      position_z: data.position?.z ?? null,
    };

    await prismaWorker.$transaction(
      async (tx) => {
        await tx.solarSystem.upsert({
          where: { id: systemId },
          update: systemRow,
          create: { id: systemId, ...systemRow },
        });

        // NOTE: none of the child upserts touch `name`. Step 2 only writes
        // topology; names arrive in step 3 and must survive a re-run.
        if (starId !== null) {
          await tx.star.upsert({
            where: { id: starId },
            update: { solar_system_id: systemId },
            create: { id: starId, solar_system_id: systemId },
          });
        }

        for (const stargateId of stargateIds) {
          await tx.stargate.upsert({
            where: { id: stargateId },
            update: { solar_system_id: systemId },
            create: { id: stargateId, solar_system_id: systemId },
          });
        }

        for (const stationId of stationIds) {
          await tx.station.upsert({
            where: { id: stationId },
            update: { solar_system_id: systemId },
            create: { id: stationId, solar_system_id: systemId, services: [] },
          });
        }

        for (let p = 0; p < planets.length; p++) {
          const planet = planets[p];
          await tx.planet.upsert({
            where: { id: planet.planet_id },
            update: { solar_system_id: systemId, orbit_index: p + 1 },
            create: { id: planet.planet_id, solar_system_id: systemId, orbit_index: p + 1 },
          });

          const moonIds = planet.moons ?? [];
          for (let m = 0; m < moonIds.length; m++) {
            await tx.moon.upsert({
              where: { id: moonIds[m] },
              update: { solar_system_id: systemId, planet_id: planet.planet_id, orbit_index: m + 1 },
              create: {
                id: moonIds[m],
                solar_system_id: systemId,
                planet_id: planet.planet_id,
                orbit_index: m + 1,
              },
            });
          }

          const beltIds = planet.asteroid_belts ?? [];
          for (let b = 0; b < beltIds.length; b++) {
            await tx.asteroidBelt.upsert({
              where: { id: beltIds[b] },
              update: { solar_system_id: systemId, planet_id: planet.planet_id, orbit_index: b + 1 },
              create: {
                id: beltIds[b],
                solar_system_id: systemId,
                planet_id: planet.planet_id,
                orbit_index: b + 1,
              },
            });
          }
        }
      },
      { timeout: 30000 }
    );

    const moonCount = planets.reduce((n, p) => n + (p.moons?.length ?? 0), 0);
    const beltCount = planets.reduce((n, p) => n + (p.asteroid_belts?.length ?? 0), 0);
    logger.debug(
      `✅ Saved solar system ${systemId} - ${data.name} ` +
        `(${stargateIds.length} gates, ${stationIds.length} stations, ` +
        `${planets.length} planets, ${moonCount} moons, ${beltCount} belts)`
    );

    await sleep(RATE_LIMIT_DELAY);
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.warn(`⚠️  Solar system ${systemId} not found (404)`);
    } else if (error.response?.status === 420) {
      logger.warn(`🛑 Error limited (420)! Waiting 60 seconds...`);
      await sleep(60000);
      throw error; // Requeue the message
    } else {
      logger.error(`❌ Error processing solar system ${systemId}:`, error.message);
    }
    throw error;
  }
}
```

Transaction'ın 30 saniyelik timeout'u bilinçli: 73 aylı bir sistem ~90 upsert
demek ve Prisma'nın 5 saniyelik varsayılanı yetmez.

- [ ] **Adım 3: Derle**

```bash
cd backend && yarn build
```

Beklenen: hatasız. Hata alırsan `prismaWorker` üzerinde `star`/`asteroidBelt`
alanları yoksa Görev 1 Adım 6'daki `npx prisma generate` çalıştırılmamış demektir.

- [ ] **Adım 4: Üç sistemle elle doğrula**

RabbitMQ ve PostgreSQL ayakta olmalı. Ayrı bir terminalde worker'ı başlat:

```bash
cd backend && yarn worker:solar-systems
```

Başka bir terminalde üç test sistemini kuyruğa el ile at:

```bash
cd backend && npx tsx -e "
import { getRabbitMQChannel } from './src/services/rabbitmq';
(async () => {
  const ch = await getRabbitMQChannel();
  await ch.assertQueue('esi_solar_systems_queue', { durable: true });
  for (const id of [30000240, 30000142, 31000005]) {
    ch.sendToQueue('esi_solar_systems_queue', Buffer.from(String(id)), { persistent: true });
  }
  setTimeout(() => process.exit(0), 500);
})();
"
```

Worker log'unda üç satır beklenir. Kritik olan Thera (31000005): `0 gates`
yazmalı ve **hata vermemeli** — `stargates` anahtarı yanıtta hiç yok.

- [ ] **Adım 5: Veritabanında doğrula**

```sql
SELECT id, name, security_class, star_id FROM solar_systems
WHERE id IN (30000240, 30000142, 31000005);

SELECT 'stargates' t, COUNT(*) FROM stargates WHERE solar_system_id = 30000240
UNION ALL SELECT 'stations', COUNT(*) FROM stations WHERE solar_system_id = 30000240
UNION ALL SELECT 'planets',  COUNT(*) FROM planets  WHERE solar_system_id = 30000240
UNION ALL SELECT 'moons',    COUNT(*) FROM moons    WHERE solar_system_id = 30000240
UNION ALL SELECT 'belts',    COUNT(*) FROM asteroid_belts WHERE solar_system_id = 30000240;
```

Beklenen:
- 4-HWWF: `security_class = 'H3'`, `star_id = 40015362`; 4 stargate, **0**
  station, 7 planet, 73 moon, 13 belt.
- Jita: `security_class = 'B'`; 7 stargate, 18 station, 8 planet, 33 moon,
  **0** belt.
- Thera: `security_class` **NULL**; **0** stargate, 4 station, 14 planet,
  0 moon, 0 belt.

Ayrıca ebeveyn bağını doğrula — bu adımın asıl sınavı:

```sql
SELECT p.orbit_index, p.id AS planet_id, COUNT(m.id) AS moons
FROM planets p LEFT JOIN moons m ON m.planet_id = p.id
WHERE p.solar_system_id = 30000240
GROUP BY p.orbit_index, p.id ORDER BY p.orbit_index;
```

Beklenen: yedi satır, `orbit_index` 1'den 7'ye, moon sayıları sırasıyla
0, 0, 0, 11, 21, 18, 23.

- [ ] **Adım 6: Tekrar çalıştırmanın isimleri korumasını doğrula**

```sql
UPDATE moons SET name = 'SENTINEL' WHERE id = 40015369;
```

4-HWWF'yi (30000240) Adım 4'teki komutla tekrar kuyruğa at, worker'ın işlemesini
bekle, sonra:

```sql
SELECT name FROM moons WHERE id = 40015369;
```

Beklenen: `SENTINEL`. Adım 2 çocuk satırların `name` alanına dokunmuyor; bu
Adım 3'ün işini bir sonraki topoloji taramasının silmemesini garanti ediyor.
Sonra temizle:

```sql
UPDATE moons SET name = NULL WHERE id = 40015369;
```

- [ ] **Adım 7: Commit**

```bash
git add backend/src/workers/worker-solar-systems.ts
git commit -m "feat(worker): write universe topology from the system response

The /universe/systems/{id}/ call the worker already makes returns the system's
stargates, stations, planets and — nested under each planet — its moons and
asteroid belts. Persist all of it, along with the security_class and star_id
columns the upsert had never written.

Child rows are written without names; step 3 resolves those and a re-run must
not clobber them, so no child upsert touches \`name\`.

Also drop the solarSystemExists() early return. That filter belongs to the
enrichment queues, not to a root scanner: queue-alliances queues every ID
unfiltered and queue-alliance-corporation-characters is where the
already-in-the-database check lives."
```

---

### Görev 3: Ortak zenginleştirme altyapısı + stargate çifti

**Dosyalar:**
- Oluştur: `backend/src/queues/lib/queue-missing-names.ts`
- Oluştur: `backend/src/workers/lib/celestial-worker.ts`
- Oluştur: `backend/src/queues/queue-stargates.ts`
- Oluştur: `backend/src/workers/worker-stargates.ts`
- Değiştir: `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 2'nin yazdığı isimsiz satırlar.
- Üretir:
  - `queueIdsMissingNames(queueName: string, ids: number[], label: string): Promise<void>`
  - `startCelestialWorker(config: CelestialWorkerConfig): Promise<void>` ve
    `interface CelestialWorkerConfig { label: string; queueName: string; endpoint: string; save: (id: number, data: any) => Promise<void> }`
  - Görev 4–9 bu iki fonksiyonu doğrudan kullanıyor.
  - `stargates.destination_system_id` dolu — Adjacent sekmesinin tek kaynağı.

- [ ] **Adım 1: Kuyruk yardımcısını yaz**

`backend/src/queues/lib/queue-missing-names.ts`:

```ts
import logger from '@services/logger';
import { getRabbitMQChannel } from '@services/rabbitmq';

/**
 * Pushes a list of celestial IDs onto a durable queue.
 *
 * These are enrichment queues, not root scanners: the caller reads the IDs out
 * of the database with `WHERE name IS NULL`, so a re-run naturally queues only
 * what is still missing. ESI has no list endpoint for moons, asteroid belts or
 * stars, so the database is the only possible source anyway.
 */
export async function queueIdsMissingNames(
  queueName: string,
  ids: number[],
  label: string
): Promise<void> {
  logger.info(`${label} queue script started`);
  logger.info('━'.repeat(70));

  if (ids.length === 0) {
    logger.info(`Nothing to do: every ${label.toLowerCase()} row already has a name.`);
    return;
  }

  logger.info(`Found ${ids.length} ${label.toLowerCase()} rows with no name`);

  const channel = await getRabbitMQChannel();
  await channel.assertQueue(queueName, { durable: true });

  for (const id of ids) {
    channel.sendToQueue(queueName, Buffer.from(id.toString()), { persistent: true });
  }

  logger.info(`Queued ${ids.length} messages to ${queueName}`);
  await channel.close();
}
```

- [ ] **Adım 2: Ortak worker döngüsünü yaz**

`backend/src/workers/lib/celestial-worker.ts`:

```ts
import axios from 'axios';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const RATE_LIMIT_DELAY = 100; // 10 requests per second

export interface CelestialWorkerConfig {
  /** Shown in log banners, e.g. "Stargate". */
  label: string;
  /** RabbitMQ queue to consume, e.g. "esi_stargates_queue". */
  queueName: string;
  /** ESI path segment, e.g. "stargates" for /universe/stargates/{id}/. */
  endpoint: string;
  /**
   * Persists one ESI response.
   *
   * `id` comes from the queue message and NOT from the response body:
   * /universe/asteroid_belts/{id}/ and /universe/stars/{id}/ do not echo their
   * own ID.
   */
  save: (id: number, data: any) => Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printCompletionSummary(
  label: string,
  processedCount: number,
  errorCount: number,
  startTime: number
) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info('\n' + '='.repeat(60));
  logger.info(`🎉 ALL ${label.toUpperCase()} TASKS COMPLETED!`);
  logger.info('='.repeat(60));
  logger.info(`✅ Processed: ${processedCount}`);
  logger.info(`❌ Errors: ${errorCount}`);
  logger.info(`📊 Total: ${processedCount + errorCount}`);
  logger.info(`⏱️  Duration: ${duration}s`);
  logger.info('='.repeat(60));
  logger.info('\n💡 Queue is empty, waiting for new messages...');
  logger.info('   Press CTRL+C to stop.\n');
}

/**
 * Shared consume loop for the six celestial enrichment workers.
 *
 * Rate-limit behaviour is copied verbatim from worker-solar-systems.ts:
 * RATE_LIMIT_DELAY between requests, back off when x-esi-error-limit-remain
 * drops below 20, wait 60s and requeue on 420, warn and skip on 404.
 */
export async function startCelestialWorker(config: CelestialWorkerConfig): Promise<void> {
  const { label, queueName, endpoint, save } = config;

  try {
    const channel = await getRabbitMQChannel();

    let processedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    logger.info(`🚀 ${label} Worker Started`);
    logger.info('==========================');
    logger.info(`📡 Listening to queue: ${queueName}`);
    logger.info(`⏱️  Rate limit: ${1000 / RATE_LIMIT_DELAY} requests/second\n`);

    await channel.assertQueue(queueName, { durable: true });

    const queueInfo = await channel.checkQueue(queueName);
    logger.info(`📊 Queue status: ${queueInfo.messageCount} messages waiting\n`);

    channel.prefetch(1);

    channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return;

        const id = parseInt(msg.content.toString());

        if (isNaN(id)) {
          logger.error(`❌ Invalid ${label} ID:`, msg.content.toString());
          channel.ack(msg);
          errorCount++;
          return;
        }

        try {
          const response = await axios.get(`${ESI_BASE_URL}/universe/${endpoint}/${id}/`);

          const errorLimitRemain = response.headers['x-esi-error-limit-remain'];
          if (errorLimitRemain && parseInt(errorLimitRemain) < 20) {
            logger.warn(`⚠️  Error limit low (${errorLimitRemain}/100), slowing down...`);
            await sleep(2000);
          }

          await save(id, response.data);
          logger.debug(`✅ Saved ${label.toLowerCase()} ${id} - ${response.data.name ?? '(unnamed)'}`);

          await sleep(RATE_LIMIT_DELAY);
          processedCount++;
          channel.ack(msg);
        } catch (error: any) {
          if (error.response?.status === 404) {
            // A dead ID. Acking keeps it out of the queue; the row simply keeps
            // its NULL name and shows up in the completeness check.
            logger.warn(`⚠️  ${label} ${id} not found (404)`);
            errorCount++;
            channel.ack(msg);
          } else if (error.response?.status === 420) {
            logger.warn(`🛑 Error limited (420)! Waiting 60 seconds...`);
            await sleep(60000);
            errorCount++;
            channel.nack(msg, false, true); // requeue
          } else {
            logger.error(`❌ Error processing ${label.toLowerCase()} ${id}:`, error.message);
            errorCount++;
            channel.nack(msg, false, false);
          }
        }

        const currentQueue = await channel.checkQueue(queueName);
        if (currentQueue.messageCount === 0) {
          printCompletionSummary(label, processedCount, errorCount, startTime);
        }
      },
      { noAck: false }
    );

    process.on('SIGINT', async () => {
      logger.warn('\n\n🛑 Shutting down worker...');
      await channel.close();
      await prismaWorker.$disconnect();
      logger.info('✅ Worker stopped gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error(`❌ Failed to start ${label} worker:`, error);
    process.exit(1);
  }
}
```

404 davranışı `worker-solar-systems`'ten bilinçli olarak ayrılıyor: orada 404
`throw` edilip mesaj `nack` ile düşürülüyor; burada mesaj `ack`leniyor çünkü ölü
bir ID'nin kuyruğa geri dönmesinin anlamı yok ve satır zaten `name IS NULL`
kalarak tamlık kontrolünde (Görev 22) görünüyor.

- [ ] **Adım 3: Stargate kuyruk scriptini yaz**

`backend/src/queues/queue-stargates.ts`:

```ts
/**
 * Queue Stargates Script
 *
 * Reads stargate IDs that still have no name out of the database and queues
 * them for enrichment. Row creation happens in step 2 (worker-solar-systems).
 *
 * Usage: yarn queue:stargates
 */

import prismaWorker from '@services/prisma-worker';
import { queueIdsMissingNames } from './lib/queue-missing-names';

async function main() {
  const rows = await prismaWorker.stargate.findMany({
    where: { name: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  await queueIdsMissingNames('esi_stargates_queue', rows.map((r) => r.id), 'Stargate');
  await prismaWorker.$disconnect();
  process.exit(0);
}

main();
```

- [ ] **Adım 4: Stargate worker'ını yaz**

`backend/src/workers/worker-stargates.ts`:

```ts
/**
 * Stargate Worker
 *
 * Resolves /universe/stargates/{id}/ into the stargates table. This is the only
 * place destination_system_id is written, so the Adjacent tab does not work
 * until this worker has run.
 *
 * Usage: yarn worker:stargates
 */

import prismaWorker from '@services/prisma-worker';
import { startCelestialWorker } from './lib/celestial-worker';

startCelestialWorker({
  label: 'Stargate',
  queueName: 'esi_stargates_queue',
  endpoint: 'stargates',
  save: async (id, data) => {
    await prismaWorker.stargate.update({
      where: { id },
      data: {
        name: data.name ?? null,
        destination_system_id: data.destination?.system_id ?? null,
        destination_stargate_id: data.destination?.stargate_id ?? null,
        type_id: data.type_id ?? null,
        position_x: data.position?.x ?? null,
        position_y: data.position?.y ?? null,
        position_z: data.position?.z ?? null,
      },
    });
  },
});
```

`update` kullanılıyor, `upsert` değil: satır Görev 2'de yaratılmış olmalı ve
kuyruk zaten veritabanından okuduğu için her zaman var. Satır yoksa Prisma
`P2025` fırlatır ve worker mesajı düşürür — bu doğru davranış, sessiz bir
no-op'tan iyi.

- [ ] **Adım 5: `package.json`'a iki script ekle**

`backend/package.json` içindeki `"queue:solar-systems"` satırının hemen altına:

```json
    "queue:stargates": "tsx src/queues/queue-stargates.ts",
```

ve `"worker:solar-systems"` satırının hemen altına:

```json
    "worker:stargates": "tsx src/workers/worker-stargates.ts",
```

- [ ] **Adım 6: Derle**

```bash
cd backend && yarn build
```

Beklenen: hatasız.

- [ ] **Adım 7: 4-HWWF'nin stargate'leriyle doğrula**

Görev 2 Adım 4'teki üç sistem işlenmiş olmalı. Worker'ı başlat:

```bash
cd backend && yarn worker:stargates
```

Başka bir terminalde:

```bash
cd backend && yarn queue:stargates
```

Beklenen: kuyruk scripti "Found 11 stargate rows with no name" civarı bir sayı
yazar (4 + 7 + 0), worker onları işler ve tamamlanma özetini basar.

```sql
SELECT id, name, destination_system_id, destination_stargate_id, type_id
FROM stargates WHERE solar_system_id = 30000240 ORDER BY id;
```

Beklenen: dört satır, hepsinde isim (`Stargate (...)` biçiminde),
`destination_system_id` dolu. `50001395` satırı için
`destination_system_id = 30000239`, `destination_stargate_id = 50001029`,
`type_id = 16`.

- [ ] **Adım 8: Kuyruğun idempotent olduğunu doğrula**

```bash
cd backend && yarn queue:stargates
```

Beklenen: `Nothing to do: every stargate row already has a name.` — hiç mesaj
üretilmemeli. Bu, zenginleştirme kuyruklarının tekrar çalıştırılabilirliğinin
kanıtı.

- [ ] **Adım 9: Commit**

```bash
git add backend/src/queues backend/src/workers backend/package.json
git commit -m "feat(worker): add the stargate enrichment queue and worker

Introduce the two pieces the remaining five celestial pairs will reuse:
queueIdsMissingNames(), which turns a 'WHERE name IS NULL' result into queue
messages, and startCelestialWorker(), which carries the consume loop and the
rate-limit behaviour copied from worker-solar-systems.

The stargate worker is first in the run order because destination_system_id is
written nowhere else and the Adjacent tab has no other source.

Unlike the root scanner, a 404 here acks the message: a dead ID has no reason to
return to the queue, and the row stays visible in the NULL-name completeness
check."
```

---

### Görev 4: Star çifti

**Dosyalar:**
- Oluştur: `backend/src/queues/queue-stars.ts`, `backend/src/workers/worker-stars.ts`
- Değiştir: `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 3'ün `queueIdsMissingNames` ve `startCelestialWorker`
  fonksiyonları; Görev 2'nin yazdığı isimsiz `stars` satırları.
- Üretir: `stars` tablosunda `name`, `type_id`, `spectral_class`,
  `temperature`, `radius`, `age`, `luminosity`. Görev 12'nin `star` alan
  resolver'ı bunları okuyor.

- [ ] **Adım 1: Kuyruk scriptini yaz**

`backend/src/queues/queue-stars.ts`:

```ts
/**
 * Queue Stars Script
 *
 * Usage: yarn queue:stars
 */

import prismaWorker from '@services/prisma-worker';
import { queueIdsMissingNames } from './lib/queue-missing-names';

async function main() {
  const rows = await prismaWorker.star.findMany({
    where: { name: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  await queueIdsMissingNames('esi_stars_queue', rows.map((r) => r.id), 'Star');
  await prismaWorker.$disconnect();
  process.exit(0);
}

main();
```

- [ ] **Adım 2: Worker'ı yaz**

`backend/src/workers/worker-stars.ts`:

```ts
/**
 * Star Worker
 *
 * Resolves /universe/stars/{id}/ into the stars table.
 *
 * NOTE: the response does NOT contain star_id, so the upsert key comes from the
 * queue message. It also contains no `position` — a star sits at the centre of
 * its system.
 *
 * Usage: yarn worker:stars
 */

import prismaWorker from '@services/prisma-worker';
import { startCelestialWorker } from './lib/celestial-worker';

startCelestialWorker({
  label: 'Star',
  queueName: 'esi_stars_queue',
  endpoint: 'stars',
  save: async (id, data) => {
    await prismaWorker.star.update({
      where: { id },
      data: {
        name: data.name ?? null,
        type_id: data.type_id ?? null,
        spectral_class: data.spectral_class ?? null,
        temperature: data.temperature ?? null,
        radius: data.radius ?? null,
        age: data.age ?? null,
        luminosity: data.luminosity ?? null,
      },
    });
  },
});
```

- [ ] **Adım 3: `package.json`'a iki script ekle**

```json
    "queue:stars": "tsx src/queues/queue-stars.ts",
    "worker:stars": "tsx src/workers/worker-stars.ts",
```

- [ ] **Adım 4: Derle ve çalıştır**

```bash
cd backend && yarn build
```

Bir terminalde `yarn worker:stars`, diğerinde `yarn queue:stars`.

- [ ] **Adım 5: Doğrula**

```sql
SELECT id, name, type_id, spectral_class, temperature, radius
FROM stars WHERE solar_system_id = 30000240;
```

Beklenen: tek satır — `id = 40015362`, `name = '4-HWWF - Star'`,
`type_id = 3800`, `spectral_class = 'M2 V'`, `temperature = 2971`,
`radius = 296900000`.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/queues/queue-stars.ts backend/src/workers/worker-stars.ts backend/package.json
git commit -m "feat(worker): add the star enrichment queue and worker

/universe/stars/{id}/ returns no star_id, so the update key comes from the queue
message rather than the response body. It also returns no position: a star sits
at the centre of its system."
```

---

### Görev 5: Station çifti

**Dosyalar:**
- Oluştur: `backend/src/queues/queue-stations.ts`, `backend/src/workers/worker-stations.ts`
- Değiştir: `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 3'ün iki fonksiyonu; Görev 2'nin isimsiz `stations` satırları.
- Üretir: `stations` tablosunda tam alan seti. Görev 12'nin `stations` alan
  resolver'ı ve Görev 19'un Structures sekmesi bunları okuyor.

- [ ] **Adım 1: Kuyruk scriptini yaz**

`backend/src/queues/queue-stations.ts`:

```ts
/**
 * Queue Stations Script
 *
 * Usage: yarn queue:stations
 */

import prismaWorker from '@services/prisma-worker';
import { queueIdsMissingNames } from './lib/queue-missing-names';

async function main() {
  const rows = await prismaWorker.station.findMany({
    where: { name: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  await queueIdsMissingNames('esi_stations_queue', rows.map((r) => r.id), 'Station');
  await prismaWorker.$disconnect();
  process.exit(0);
}

main();
```

- [ ] **Adım 2: Worker'ı yaz**

`backend/src/workers/worker-stations.ts`:

```ts
/**
 * Station Worker
 *
 * Resolves /universe/stations/{id}/ into the stations table. These are NPC
 * stations only; Upwell structures never appear in the public universe
 * endpoints and are out of scope.
 *
 * Usage: yarn worker:stations
 */

import prismaWorker from '@services/prisma-worker';
import { startCelestialWorker } from './lib/celestial-worker';

startCelestialWorker({
  label: 'Station',
  queueName: 'esi_stations_queue',
  endpoint: 'stations',
  save: async (id, data) => {
    await prismaWorker.station.update({
      where: { id },
      data: {
        name: data.name ?? null,
        type_id: data.type_id ?? null,
        owner_corporation_id: data.owner ?? null,
        race_id: data.race_id ?? null,
        services: data.services ?? [],
        reprocessing_efficiency: data.reprocessing_efficiency ?? null,
        reprocessing_stations_take: data.reprocessing_stations_take ?? null,
        office_rental_cost: data.office_rental_cost ?? null,
        max_dockable_ship_volume: data.max_dockable_ship_volume ?? null,
        position_x: data.position?.x ?? null,
        position_y: data.position?.y ?? null,
        position_z: data.position?.z ?? null,
      },
    });
  },
});
```

Sahip alanının ESI'daki adı `owner`, kolon adı `owner_corporation_id` —
eşleşmiyor, bilerek.

- [ ] **Adım 3: `package.json`'a iki script ekle**

```json
    "queue:stations": "tsx src/queues/queue-stations.ts",
    "worker:stations": "tsx src/workers/worker-stations.ts",
```

- [ ] **Adım 4: Derle ve çalıştır**

```bash
cd backend && yarn build
```

Bir terminalde `yarn worker:stations`, diğerinde `yarn queue:stations`.

- [ ] **Adım 5: Doğrula**

```sql
SELECT id, name, type_id, owner_corporation_id, reprocessing_efficiency,
       reprocessing_stations_take, office_rental_cost, array_length(services, 1) AS service_count
FROM stations WHERE id = 60000361;
```

Beklenen: `name = 'Jita IV - Moon 6 - Ytiri Storage'`, `type_id = 1531`,
`owner_corporation_id = 1000004`, `reprocessing_efficiency = 0.5`,
`reprocessing_stations_take = 0.05`, `office_rental_cost = 6510853`,
`service_count = 12`.

Thera'nın dört istasyonunun da isim aldığını doğrula — wormhole sistemlerinin
istasyonsuz olduğu varsayımı yanlış:

```sql
SELECT COUNT(*) FROM stations WHERE solar_system_id = 31000005 AND name IS NOT NULL;
```

Beklenen: `4`.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/queues/queue-stations.ts backend/src/workers/worker-stations.ts backend/package.json
git commit -m "feat(worker): add the station enrichment queue and worker

Stores office_rental_cost and reprocessing_stations_take alongside
reprocessing_efficiency: the take is what makes the efficiency figure
comparable between stations.

ESI names the owning corporation field \`owner\`; the column is
owner_corporation_id."
```

---

### Görev 6: Planet çifti

**Dosyalar:**
- Oluştur: `backend/src/queues/queue-planets.ts`, `backend/src/workers/worker-planets.ts`
- Değiştir: `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 3'ün iki fonksiyonu; Görev 2'nin isimsiz `planets` satırları
  (`orbit_index` zaten dolu).
- Üretir: `planets` tablosunda `name`, `type_id`, `position`. Görev 12'nin
  `planets` alan resolver'ı ve Görev 18'in Orbital Bodies sekmesi bunları
  okuyor.

- [ ] **Adım 1: Kuyruk scriptini yaz**

`backend/src/queues/queue-planets.ts`:

```ts
/**
 * Queue Planets Script
 *
 * Usage: yarn queue:planets
 */

import prismaWorker from '@services/prisma-worker';
import { queueIdsMissingNames } from './lib/queue-missing-names';

async function main() {
  const rows = await prismaWorker.planet.findMany({
    where: { name: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  await queueIdsMissingNames('esi_planets_queue', rows.map((r) => r.id), 'Planet');
  await prismaWorker.$disconnect();
  process.exit(0);
}

main();
```

- [ ] **Adım 2: Worker'ı yaz**

`backend/src/workers/worker-planets.ts`:

```ts
/**
 * Planet Worker
 *
 * Resolves /universe/planets/{id}/ into the planets table. type_id is what
 * distinguishes Barren / Gas / Temperate / Storm and is worth showing in the
 * Orbital Bodies list.
 *
 * orbit_index is NOT written here: it comes from the ordering of the planets[]
 * array in step 2 and this response has no equivalent.
 *
 * Usage: yarn worker:planets
 */

import prismaWorker from '@services/prisma-worker';
import { startCelestialWorker } from './lib/celestial-worker';

startCelestialWorker({
  label: 'Planet',
  queueName: 'esi_planets_queue',
  endpoint: 'planets',
  save: async (id, data) => {
    await prismaWorker.planet.update({
      where: { id },
      data: {
        name: data.name ?? null,
        type_id: data.type_id ?? null,
        position_x: data.position?.x ?? null,
        position_y: data.position?.y ?? null,
        position_z: data.position?.z ?? null,
      },
    });
  },
});
```

- [ ] **Adım 3: `package.json`'a iki script ekle**

```json
    "queue:planets": "tsx src/queues/queue-planets.ts",
    "worker:planets": "tsx src/workers/worker-planets.ts",
```

- [ ] **Adım 4: Derle ve çalıştır**

```bash
cd backend && yarn build
```

Bir terminalde `yarn worker:planets`, diğerinde `yarn queue:planets`.

- [ ] **Adım 5: Doğrula**

```sql
SELECT orbit_index, id, name, type_id
FROM planets WHERE solar_system_id = 30000240 ORDER BY orbit_index;
```

Beklenen: yedi satır, `orbit_index` 1–7, isimler `4-HWWF I` … `4-HWWF VII`
biçiminde ve **Roma rakamı sırası `orbit_index` ile örtüşüyor**. `40015364`
satırı için `name = '4-HWWF II'`, `type_id = 2016`; `40015368` için
`name = '4-HWWF IV'`, `type_id = 13`.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/queues/queue-planets.ts backend/src/workers/worker-planets.ts backend/package.json
git commit -m "feat(worker): add the planet enrichment queue and worker

orbit_index is deliberately left alone here: it encodes the ordering of the
planets[] array from step 2, and this endpoint has no equivalent field."
```

---

### Görev 7: Moon çifti

**Dosyalar:**
- Oluştur: `backend/src/queues/queue-moons.ts`, `backend/src/workers/worker-moons.ts`
- Değiştir: `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 3'ün iki fonksiyonu; Görev 2'nin isimsiz `moons` satırları
  (`planet_id` ve `orbit_index` zaten dolu).
- Üretir: `moons` tablosunda `name` ve `position`.

- [ ] **Adım 1: Kuyruk scriptini yaz**

`backend/src/queues/queue-moons.ts`:

```ts
/**
 * Queue Moons Script
 *
 * The largest of the six sets, which is why it runs second to last.
 *
 * Usage: yarn queue:moons
 */

import prismaWorker from '@services/prisma-worker';
import { queueIdsMissingNames } from './lib/queue-missing-names';

async function main() {
  const rows = await prismaWorker.moon.findMany({
    where: { name: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  await queueIdsMissingNames('esi_moons_queue', rows.map((r) => r.id), 'Moon');
  await prismaWorker.$disconnect();
  process.exit(0);
}

main();
```

- [ ] **Adım 2: Worker'ı yaz**

`backend/src/workers/worker-moons.ts`:

```ts
/**
 * Moon Worker
 *
 * Resolves /universe/moons/{id}/ into the moons table.
 *
 * NOTE: the response does NOT contain planet_id. The moon-to-planet link exists
 * only in the nesting of the /universe/systems/{id}/ response and is written in
 * step 2; nothing here can recover it.
 *
 * Usage: yarn worker:moons
 */

import prismaWorker from '@services/prisma-worker';
import { startCelestialWorker } from './lib/celestial-worker';

startCelestialWorker({
  label: 'Moon',
  queueName: 'esi_moons_queue',
  endpoint: 'moons',
  save: async (id, data) => {
    await prismaWorker.moon.update({
      where: { id },
      data: {
        name: data.name ?? null,
        position_x: data.position?.x ?? null,
        position_y: data.position?.y ?? null,
        position_z: data.position?.z ?? null,
      },
    });
  },
});
```

- [ ] **Adım 3: `package.json`'a iki script ekle**

```json
    "queue:moons": "tsx src/queues/queue-moons.ts",
    "worker:moons": "tsx src/workers/worker-moons.ts",
```

- [ ] **Adım 4: Derle ve çalıştır**

```bash
cd backend && yarn build
```

Bir terminalde `yarn worker:moons`, diğerinde `yarn queue:moons`.

- [ ] **Adım 5: Doğrula**

```sql
SELECT m.orbit_index, m.id, m.name, p.name AS planet_name
FROM moons m JOIN planets p ON p.id = m.planet_id
WHERE m.solar_system_id = 30000240 AND p.orbit_index = 4
ORDER BY m.orbit_index LIMIT 3;
```

Beklenen: `4-HWWF IV - Moon 1`, `... Moon 2`, `... Moon 3`; hepsinin
`planet_name` değeri `4-HWWF IV`. Ay adındaki gezegen Roma rakamının
`planet_name` ile örtüşmesi, Görev 2'nin `planet_id`'yi doğru yazdığının bağımsız
kanıtı.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/queues/queue-moons.ts backend/src/workers/worker-moons.ts backend/package.json
git commit -m "feat(worker): add the moon enrichment queue and worker

/universe/moons/{id}/ returns no planet_id. The moon-to-planet link exists only
in the nesting of the system response and is written in step 2; this worker
fills in nothing but the name and position."
```

---

### Görev 8: Asteroid belt çifti

**Dosyalar:**
- Oluştur: `backend/src/queues/queue-asteroid-belts.ts`,
  `backend/src/workers/worker-asteroid-belts.ts`
- Değiştir: `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 3'ün iki fonksiyonu; Görev 2'nin isimsiz `asteroid_belts`
  satırları (`planet_id` ve `orbit_index` zaten dolu).
- Üretir: `asteroid_belts` tablosunda `name` ve `position`. Bu, ingest hattının
  son parçası.

- [ ] **Adım 1: Kuyruk scriptini yaz**

`backend/src/queues/queue-asteroid-belts.ts`:

```ts
/**
 * Queue Asteroid Belts Script
 *
 * Last in the run order: belts sit collapsed under a planet in the Orbital
 * Bodies tab, so the tab is meaningful before this finishes.
 *
 * Usage: yarn queue:asteroid-belts
 */

import prismaWorker from '@services/prisma-worker';
import { queueIdsMissingNames } from './lib/queue-missing-names';

async function main() {
  const rows = await prismaWorker.asteroidBelt.findMany({
    where: { name: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  await queueIdsMissingNames('esi_asteroid_belts_queue', rows.map((r) => r.id), 'Asteroid belt');
  await prismaWorker.$disconnect();
  process.exit(0);
}

main();
```

- [ ] **Adım 2: Worker'ı yaz**

`backend/src/workers/worker-asteroid-belts.ts`:

```ts
/**
 * Asteroid Belt Worker
 *
 * Resolves /universe/asteroid_belts/{id}/ into the asteroid_belts table.
 *
 * NOTE: this response contains neither asteroid_belt_id nor planet_id — it
 * returns only name, position and system_id. The update key comes from the
 * queue message and the planet link comes from step 2.
 *
 * Usage: yarn worker:asteroid-belts
 */

import prismaWorker from '@services/prisma-worker';
import { startCelestialWorker } from './lib/celestial-worker';

startCelestialWorker({
  label: 'Asteroid belt',
  queueName: 'esi_asteroid_belts_queue',
  endpoint: 'asteroid_belts',
  save: async (id, data) => {
    await prismaWorker.asteroidBelt.update({
      where: { id },
      data: {
        name: data.name ?? null,
        position_x: data.position?.x ?? null,
        position_y: data.position?.y ?? null,
        position_z: data.position?.z ?? null,
      },
    });
  },
});
```

ESI yolunun alt çizgili olduğuna dikkat (`asteroid_belts`), script adının ise
tireli (`queue:asteroid-belts`).

- [ ] **Adım 3: `package.json`'a iki script ekle**

```json
    "queue:asteroid-belts": "tsx src/queues/queue-asteroid-belts.ts",
    "worker:asteroid-belts": "tsx src/workers/worker-asteroid-belts.ts",
```

- [ ] **Adım 4: Derle ve çalıştır**

```bash
cd backend && yarn build
```

Bir terminalde `yarn worker:asteroid-belts`, diğerinde `yarn queue:asteroid-belts`.

- [ ] **Adım 5: Doğrula**

```sql
SELECT b.id, b.name, p.name AS planet_name
FROM asteroid_belts b JOIN planets p ON p.id = b.planet_id
WHERE b.solar_system_id = 30000240 ORDER BY b.id LIMIT 3;
```

Beklenen: `40015365` → `4-HWWF II - Asteroid Belt 1` (planet `4-HWWF II`),
`40015367` → `4-HWWF III - Asteroid Belt 1`, `40015380` →
`4-HWWF IV - Asteroid Belt 1`.

Jita'nın hiç belt'i olmadığını da doğrula — boş küme normal:

```sql
SELECT COUNT(*) FROM asteroid_belts WHERE solar_system_id = 30000142;
```

Beklenen: `0`.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/queues/queue-asteroid-belts.ts backend/src/workers/worker-asteroid-belts.ts backend/package.json
git commit -m "feat(worker): add the asteroid belt enrichment queue and worker

/universe/asteroid_belts/{id}/ returns neither asteroid_belt_id nor planet_id,
only name, position and system_id. The update key comes from the queue message
and the planet link from step 2.

This completes the six-pair enrichment pipeline."
```

---

## Faz B — GraphQL yüzeyi

### Görev 9: Şema tipleri ve `Position` temizliği

**Dosyalar:**
- Oluştur: `backend/src/schemas/SolarSystemTopology.graphql`
- Değiştir: `backend/src/schemas/SolarSystem.graphql`,
  `backend/src/schemas/Constellation.graphql`

**Arayüzler:**
- Tüketir: Görev 1'in tabloları.
- Üretir: `backend/src/generated-types.ts` içinde `StargateResolvers`,
  `StargateDestinationResolvers`, `StarResolvers`, `PlanetResolvers`,
  `MoonResolvers`, `AsteroidBeltResolvers`, `StationResolvers` ve
  `SolarSystemResolvers` üzerinde `stargates`, `planets`, `stations`, `star`,
  `counts` alanları. Görev 12 bunları implemente ediyor.
  `backend/src/generated-schema.graphql` da güncelleniyor; frontend codegen'i
  (Görev 15) onu okuyor.

- [ ] **Adım 1: Yinelenen `Position` tanımlarını sil**

`type Position` şu anda **üç** dosyada tanımlı: `Position.graphql`,
`Constellation.graphql:1-5` ve `SolarSystem.graphql:1-5`. Tanımlar birebir aynı
olduğu için `mergeTypeDefs` bugün sessizce tekilleştiriyor, ama biri değişirse
çakışma çıkar.

`backend/src/schemas/SolarSystem.graphql` ve
`backend/src/schemas/Constellation.graphql` dosyalarının **başındaki** şu bloğu
her ikisinden de sil:

```graphql
type Position {
  x: Float!
  y: Float!
  z: Float!
}
```

`backend/src/schemas/Position.graphql` tek kaynak olarak kalıyor, dokunulmuyor.

- [ ] **Adım 2: Topoloji şemasını yaz**

`backend/src/schemas/SolarSystemTopology.graphql`:

```graphql
"Sistemdeki stargate. ESI'nin stargates[] dizisini yansıtır, uçları çözülmüş halde."
type Stargate {
  id: Int!
  name: String
  typeId: Int
  type: Type
  destination: StargateDestination
  position: Position
  solarSystem: SolarSystem
}

"""
ESI'nin stargate yanıtındaki destination nesnesi.
Ham ID'ler step 3 çalışmadan önce null; nesneler ayrıca karşılık gelen satır
veritabanında yoksa da null.
"""
type StargateDestination {
  destinationSystemId: Int
  destinationStargateId: Int
  "Karşı uçtaki sistem."
  system: SolarSystem
  "Karşı uçtaki stargate; kendi destination'ı bu sisteme geri işaret eder."
  stargate: Stargate
}

type Star {
  id: Int!
  name: String
  typeId: Int
  type: Type
  "Örn. \"M2 V\"."
  spectralClass: String
  "Kelvin."
  temperature: Int
  "Metre."
  radius: Float
  "Yıl."
  age: Float
  luminosity: Float
  solarSystem: SolarSystem
}

type Planet {
  id: Int!
  name: String
  typeId: Int
  "Barren, Gas, Temperate, Storm…"
  type: Type
  "ESI'nin planets[] dizisindeki 1 tabanlı sıra."
  orbitIndex: Int
  position: Position
  moons: [Moon!]!
  asteroidBelts: [AsteroidBelt!]!
  solarSystem: SolarSystem
}

type Moon {
  id: Int!
  name: String
  "ESI'nin planets[].moons dizisindeki 1 tabanlı sıra."
  orbitIndex: Int
  position: Position
  planet: Planet
  solarSystem: SolarSystem
}

type AsteroidBelt {
  id: Int!
  name: String
  orbitIndex: Int
  position: Position
  planet: Planet
  solarSystem: SolarSystem
}

type Station {
  id: Int!
  name: String
  typeId: Int
  type: Type
  ownerCorporationId: Int
  ownerCorporation: Corporation
  raceId: Int
  services: [String!]!
  reprocessingEfficiency: Float
  "İstasyonun yeniden işlemeden aldığı pay; 0.05 = %5."
  reprocessingStationsTake: Float
  "ISK cinsinden ofis kirası."
  officeRentalCost: Float
  maxDockableShipVolume: Float
  position: Position
  solarSystem: SolarSystem
}

type SolarSystemCounts {
  stargates: Int!
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
  stargates: [Stargate!]!
  planets: [Planet!]!
  stations: [Station!]!
  "Step 3 çalışmadan önce isimsiz; star_id boşsa null."
  star: Star
  counts: SolarSystemCounts!
}

extend type Query {
  solarSystemStats(systemId: Int!): SolarSystemStats!
}
```

- [ ] **Adım 3: Codegen çalıştır**

```bash
cd backend && yarn codegen
```

Beklenen: hatasız. `src/generated-schema.graphql` içinde `type Position` **bir
kez** görünmeli:

```bash
cd backend && grep -c "^type Position {" src/generated-schema.graphql
```

Beklenen: `1`.

- [ ] **Adım 4: Derlemenin kırıldığını gör**

```bash
cd backend && yarn build
```

**Beklenen: HATA.** `SolarSystemResolvers` artık `stargates`, `planets`,
`stations`, `star`, `counts` alanlarını içeriyor ama `fields.ts` onları
implemente etmiyor. Bu, Görev 12'nin işi. Bu adımın amacı codegen'in gerçekten
yeni alanları ürettiğini kanıtlamak.

Hata mesajı `Property 'stargates' is missing` benzeri olmalı. Eğer derleme
**geçerse** codegen yeni şemayı okumamış demektir; Adım 3'ü tekrarla.

- [ ] **Adım 5: Commit**

```bash
git add backend/src/schemas backend/src/generated-schema.graphql backend/src/generated-types.ts
git commit -m "feat(graphql): add the universe topology types

Type names mirror the tables one for one: Stargate, Star, Planet, Moon,
AsteroidBelt, Station. Related entities are returned as objects rather than
scalars — type: Type, ownerCorporation: Corporation, solarSystem, planet,
destination.system, destination.stargate — matching the existing convention in
Corporation.ceo and Constellation.region. DataLoaders cover the cost.

Adjacency is a branch of stargates rather than a separate field: destination
resolves to the system on the other side, so a second projection of the same
rows would only be a chance for the two to drift apart.

Also collapse the three duplicate definitions of type Position down to the one
in Position.graphql.

The build does not compile after this commit; the field resolvers land next."
```

Not: bu commit derlenmiyor. Ara commit'lerin yeşil olması gerektiği bir
kuralınız varsa Görev 9 ile Görev 12'yi tek commit'te birleştirin.

---

### Görev 10: GraphQL sorgu derinliği sınırı

**Dosyalar:**
- Değiştir: `backend/src/server.ts`, `backend/package.json`

**Arayüzler:**
- Tüketir: Görev 9'un şeması.
- Üretir: Sunucu tarafında derinlik sınırı. Sonraki görevlerin sorguları bu
  sınırın altında kalmak zorunda.

Görev 9'un şeması **özyinelemeli**: `Stargate` → `StargateDestination` →
`Stargate`, ve `Planet` → `Moon` → `Planet`. Repoda bugün hiçbir derinlik ya da
karmaşıklık sınırı yok (`src` altında `depthLimit`, `maxDepth`,
`validationRules` araması boş dönüyor), yani özyinelemeli şema sınırsız derin
bir sorguya açık.

- [ ] **Adım 1: Bağımlılığı ekle**

```bash
cd backend && yarn add graphql-depth-limit@^1.1.0 && yarn add -D @types/graphql-depth-limit
```

- [ ] **Adım 2: Apollo Server'a validation rule olarak bağla**

`backend/src/server.ts` içinde `new ApolloServer({...})` çağrısını bul ve
yapılandırmasına ekle:

```ts
import depthLimit from 'graphql-depth-limit';

// ...

const server = new ApolloServer({
  // ...mevcut alanlar korunuyor...
  validationRules: [depthLimit(12)],
});
```

12 sınırı bilinçli: planın en derin sorgusu Görev 15'teki Adjacent dokümanı ve o
7 seviye — `solarSystem → stargates → destination → system → constellation →
region → name`. 12, meşru sorgulara rahat pay bırakıp özyinelemeyi kapatıyor.

`ApolloServer` yapılandırmasında zaten bir `validationRules` alanı varsa yenisini
oluşturma, `depthLimit(12)`'yi mevcut diziye ekle.

- [ ] **Adım 3: Derle**

```bash
cd backend && yarn build
```

Beklenen: Görev 9'dan kalan `fields.ts` hataları duruyor, ama `server.ts` için
**yeni** bir hata olmamalı.

- [ ] **Adım 4: Commit**

```bash
git add backend/src/server.ts backend/package.json backend/yarn.lock
git commit -m "feat(graphql): limit query depth to 12

The topology schema is recursive — Stargate -> StargateDestination -> Stargate,
and Planet -> Moon -> Planet — and the server had no depth or complexity rule of
any kind. The deepest query this feature issues is 7 levels."
```

---

### Görev 11: DataLoader'lar

**Dosyalar:**
- Değiştir: `backend/src/services/dataloaders.ts`

**Arayüzler:**
- Tüketir: Görev 1'in tabloları.
- Üretir: `context.loaders` üzerinde yedi yeni loader:
  `stargatesBySystem`, `planetsBySystem`, `stationsBySystem`,
  `starBySystem`, `moonsByPlanet`, `asteroidBeltsByPlanet`, `stargate`.
  Görev 12 hepsini kullanıyor.

- [ ] **Adım 1: Yedi loader fonksiyonunu ekle**

`backend/src/services/dataloaders.ts` dosyasının sonuna:

```ts
/**
 * Stargates by Solar System DataLoader
 */
export const createStargatesBySystemLoader = () => {
    return new DataLoader<number, any[]>(async (systemIds) => {
        console.log(`🔄 DataLoader: Batching ${systemIds.length} stargates-by-system queries`);

        const rows = await prisma.stargate.findMany({
            where: { solar_system_id: { in: [...systemIds] } },
            orderBy: { id: 'asc' },
        });

        const grouped = new Map<number, any[]>();
        for (const row of rows) {
            const list = grouped.get(row.solar_system_id) ?? [];
            list.push(row);
            grouped.set(row.solar_system_id, list);
        }
        return systemIds.map(id => grouped.get(id) ?? []);
    });
};

/**
 * Single Stargate DataLoader — used by StargateDestination.stargate
 */
export const createStargateLoader = () => {
    return new DataLoader<number, any>(async (stargateIds) => {
        console.log(`🔄 DataLoader: Batching ${stargateIds.length} stargate queries`);

        const rows = await prisma.stargate.findMany({
            where: { id: { in: [...stargateIds] } },
        });

        const map = new Map(rows.map(r => [r.id, r]));
        return stargateIds.map(id => map.get(id) || null);
    });
};

/**
 * Star by Solar System DataLoader
 */
export const createStarBySystemLoader = () => {
    return new DataLoader<number, any>(async (systemIds) => {
        console.log(`🔄 DataLoader: Batching ${systemIds.length} star-by-system queries`);

        const rows = await prisma.star.findMany({
            where: { solar_system_id: { in: [...systemIds] } },
        });

        const map = new Map(rows.map(r => [r.solar_system_id, r]));
        return systemIds.map(id => map.get(id) || null);
    });
};

/**
 * Planets by Solar System DataLoader
 */
export const createPlanetsBySystemLoader = () => {
    return new DataLoader<number, any[]>(async (systemIds) => {
        console.log(`🔄 DataLoader: Batching ${systemIds.length} planets-by-system queries`);

        const rows = await prisma.planet.findMany({
            where: { solar_system_id: { in: [...systemIds] } },
            orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
        });

        const grouped = new Map<number, any[]>();
        for (const row of rows) {
            const list = grouped.get(row.solar_system_id) ?? [];
            list.push(row);
            grouped.set(row.solar_system_id, list);
        }
        return systemIds.map(id => grouped.get(id) ?? []);
    });
};

/**
 * Stations by Solar System DataLoader
 */
export const createStationsBySystemLoader = () => {
    return new DataLoader<number, any[]>(async (systemIds) => {
        console.log(`🔄 DataLoader: Batching ${systemIds.length} stations-by-system queries`);

        const rows = await prisma.station.findMany({
            where: { solar_system_id: { in: [...systemIds] } },
            orderBy: { id: 'asc' },
        });

        const grouped = new Map<number, any[]>();
        for (const row of rows) {
            const list = grouped.get(row.solar_system_id) ?? [];
            list.push(row);
            grouped.set(row.solar_system_id, list);
        }
        return systemIds.map(id => grouped.get(id) ?? []);
    });
};

/**
 * Moons by Planet DataLoader
 */
export const createMoonsByPlanetLoader = () => {
    return new DataLoader<number, any[]>(async (planetIds) => {
        console.log(`🔄 DataLoader: Batching ${planetIds.length} moons-by-planet queries`);

        const rows = await prisma.moon.findMany({
            where: { planet_id: { in: [...planetIds] } },
            orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
        });

        const grouped = new Map<number, any[]>();
        for (const row of rows) {
            const list = grouped.get(row.planet_id) ?? [];
            list.push(row);
            grouped.set(row.planet_id, list);
        }
        return planetIds.map(id => grouped.get(id) ?? []);
    });
};

/**
 * Asteroid Belts by Planet DataLoader
 */
export const createAsteroidBeltsByPlanetLoader = () => {
    return new DataLoader<number, any[]>(async (planetIds) => {
        console.log(`🔄 DataLoader: Batching ${planetIds.length} belts-by-planet queries`);

        const rows = await prisma.asteroidBelt.findMany({
            where: { planet_id: { in: [...planetIds] } },
            orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
        });

        const grouped = new Map<number, any[]>();
        for (const row of rows) {
            const list = grouped.get(row.planet_id) ?? [];
            list.push(row);
            grouped.set(row.planet_id, list);
        }
        return planetIds.map(id => grouped.get(id) ?? []);
    });
};
```

- [ ] **Adım 2: `DataLoaderContext` arayüzüne yedi satır ekle**

`export interface DataLoaderContext` içindeki `loaders` bloğuna,
`marketPrice` satırının altına:

```ts
        stargatesBySystem: DataLoader<number, any[]>;
        stargate: DataLoader<number, any>;
        starBySystem: DataLoader<number, any>;
        planetsBySystem: DataLoader<number, any[]>;
        stationsBySystem: DataLoader<number, any[]>;
        moonsByPlanet: DataLoader<number, any[]>;
        asteroidBeltsByPlanet: DataLoader<number, any[]>;
```

- [ ] **Adım 3: `createDataLoaders`'a yedi satır ekle**

`export const createDataLoaders = (): DataLoaderContext => ({ loaders: {...} })`
içindeki `marketPrice: createMarketPriceLoader(),` satırının altına:

```ts
        stargatesBySystem: createStargatesBySystemLoader(),
        stargate: createStargateLoader(),
        starBySystem: createStarBySystemLoader(),
        planetsBySystem: createPlanetsBySystemLoader(),
        stationsBySystem: createStationsBySystemLoader(),
        moonsByPlanet: createMoonsByPlanetLoader(),
        asteroidBeltsByPlanet: createAsteroidBeltsByPlanetLoader(),
```

- [ ] **Adım 4: Derle**

```bash
cd backend && yarn build
```

Beklenen: Görev 9'dan kalan `fields.ts` hataları duruyor, `dataloaders.ts` için
yeni hata olmamalı.

- [ ] **Adım 5: Commit**

```bash
git add backend/src/services/dataloaders.ts
git commit -m "feat(graphql): add DataLoaders for the topology relations

Seven loaders: stargates / planets / stations / star by system, moons and
asteroid belts by planet, and a single-stargate loader for
StargateDestination.stargate. Grouping loaders return [] rather than null for a
system with none, so an empty tab is an empty list and not an error."
```

---

### Görev 12: Topoloji alan resolver'ları

**Dosyalar:**
- Oluştur: `backend/src/resolvers/solar-system/topology-fields.ts`
- Değiştir: `backend/src/resolvers/solar-system/index.ts`,
  `backend/src/resolvers/index.ts`

**Arayüzler:**
- Tüketir: Görev 9'un üretilmiş tipleri, Görev 11'in loader'ları.
- Üretir: `solarSystemTopologyFields` ve `stargateFields`,
  `stargateDestinationFields`, `starFields`, `planetFields`, `moonFields`,
  `asteroidBeltFields`, `stationFields`. Görev 15'in frontend dokümanları bu
  alanları sorguluyor. **Bu görevden sonra derleme yeşile döner.**

- [ ] **Adım 1: Resolver dosyasını yaz**

`backend/src/resolvers/solar-system/topology-fields.ts`:

```ts
import {
    AsteroidBeltResolvers,
    MoonResolvers,
    PlanetResolvers,
    SolarSystemResolvers,
    StargateDestinationResolvers,
    StargateResolvers,
    StarResolvers,
    StationResolvers,
} from '@generated-types';
import prisma from '@services/prisma';

/**
 * Prisma rows carry position_x/y/z; GraphQL exposes a Position object.
 * Any missing component collapses the whole object to null rather than
 * producing a half-filled Position — the type's fields are non-null.
 */
function toPosition(row: any) {
    if (row.position_x === null || row.position_y === null || row.position_z === null) {
        return null;
    }
    return { x: row.position_x, y: row.position_y, z: row.position_z };
}

/**
 * Fields added to SolarSystem by the topology schema.
 * Merged into solarSystemFields in index.ts.
 */
export const solarSystemTopologyFields: SolarSystemResolvers = {
    stargates: async (parent, _, context) => {
        return context.loaders.stargatesBySystem.load((parent as any).id);
    },

    planets: async (parent, _, context) => {
        return context.loaders.planetsBySystem.load((parent as any).id);
    },

    stations: async (parent, _, context) => {
        return context.loaders.stationsBySystem.load((parent as any).id);
    },

    star: async (parent, _, context) => {
        return context.loaders.starBySystem.load((parent as any).id);
    },

    counts: async (parent) => {
        const systemId = (parent as any).id;
        const [stargates, planets, moons, asteroidBelts, stations, sovereigntyStructures] =
            await Promise.all([
                prisma.stargate.count({ where: { solar_system_id: systemId } }),
                prisma.planet.count({ where: { solar_system_id: systemId } }),
                prisma.moon.count({ where: { solar_system_id: systemId } }),
                prisma.asteroidBelt.count({ where: { solar_system_id: systemId } }),
                prisma.station.count({ where: { solar_system_id: systemId } }),
                prisma.sovereigntyStructure.count({
                    where: { solar_system_id: systemId, destroyed_at: null },
                }),
            ]);

        // The Adjacent tab label reads `stargates`, not a count of resolved
        // destinations: stargate rows exist after step 2 while
        // destination_system_id is only filled in by step 3.
        return { stargates, planets, moons, asteroidBelts, stations, sovereigntyStructures };
    },
};

export const stargateFields: StargateResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    position: (parent) => toPosition(parent),
    solarSystem: async (parent, _, context) => {
        return context.loaders.solarSystem.load((parent as any).solar_system_id);
    },
    // The destination object is shaped from the stargate row itself; its own
    // resolvers below read the same parent.
    destination: (parent) => parent as any,
};

export const stargateDestinationFields: StargateDestinationResolvers = {
    destinationSystemId: (parent) => (parent as any).destination_system_id ?? null,
    destinationStargateId: (parent) => (parent as any).destination_stargate_id ?? null,
    system: async (parent, _, context) => {
        const systemId = (parent as any).destination_system_id;
        if (!systemId) return null;
        return context.loaders.solarSystem.load(systemId);
    },
    stargate: async (parent, _, context) => {
        const stargateId = (parent as any).destination_stargate_id;
        if (!stargateId) return null;
        return context.loaders.stargate.load(stargateId);
    },
};

export const starFields: StarResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    spectralClass: (parent) => (parent as any).spectral_class ?? null,
    solarSystem: async (parent, _, context) => {
        return context.loaders.solarSystem.load((parent as any).solar_system_id);
    },
};

export const planetFields: PlanetResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    orbitIndex: (parent) => (parent as any).orbit_index ?? null,
    position: (parent) => toPosition(parent),
    moons: async (parent, _, context) => {
        return context.loaders.moonsByPlanet.load((parent as any).id);
    },
    asteroidBelts: async (parent, _, context) => {
        return context.loaders.asteroidBeltsByPlanet.load((parent as any).id);
    },
    solarSystem: async (parent, _, context) => {
        return context.loaders.solarSystem.load((parent as any).solar_system_id);
    },
};

export const moonFields: MoonResolvers = {
    orbitIndex: (parent) => (parent as any).orbit_index ?? null,
    position: (parent) => toPosition(parent),
    planet: async (parent) => {
        return prisma.planet.findUnique({ where: { id: (parent as any).planet_id } }) as any;
    },
    solarSystem: async (parent, _, context) => {
        return context.loaders.solarSystem.load((parent as any).solar_system_id);
    },
};

export const asteroidBeltFields: AsteroidBeltResolvers = {
    orbitIndex: (parent) => (parent as any).orbit_index ?? null,
    position: (parent) => toPosition(parent),
    planet: async (parent) => {
        return prisma.planet.findUnique({ where: { id: (parent as any).planet_id } }) as any;
    },
    solarSystem: async (parent, _, context) => {
        return context.loaders.solarSystem.load((parent as any).solar_system_id);
    },
};

export const stationFields: StationResolvers = {
    typeId: (parent) => (parent as any).type_id ?? null,
    type: async (parent, _, context) => {
        const typeId = (parent as any).type_id;
        if (!typeId) return null;
        return context.loaders.type.load(typeId);
    },
    ownerCorporationId: (parent) => (parent as any).owner_corporation_id ?? null,
    ownerCorporation: async (parent, _, context) => {
        const corpId = (parent as any).owner_corporation_id;
        if (!corpId) return null;
        return context.loaders.corporation.load(corpId);
    },
    raceId: (parent) => (parent as any).race_id ?? null,
    reprocessingEfficiency: (parent) => (parent as any).reprocessing_efficiency ?? null,
    reprocessingStationsTake: (parent) => (parent as any).reprocessing_stations_take ?? null,
    officeRentalCost: (parent) => (parent as any).office_rental_cost ?? null,
    maxDockableShipVolume: (parent) => (parent as any).max_dockable_ship_volume ?? null,
    position: (parent) => toPosition(parent),
    solarSystem: async (parent, _, context) => {
        return context.loaders.solarSystem.load((parent as any).solar_system_id);
    },
};
```

`Moon.planet` ve `AsteroidBelt.planet` doğrudan `findUnique` kullanıyor,
DataLoader değil: bu alanlar yalnızca bir ay ya da belt'ten yukarı çıkıldığında
sorgulanıyor ve Orbital Bodies sekmesi zaten gezegenden aşağı iniyor, yani
pratikte hiç çağrılmıyorlar. Bir gün ay listesinden gezegen adı gösterilirse bir
`planet` DataLoader'ı eklenmeli.

- [ ] **Adım 2: Topoloji alanlarını `solarSystemFields` ile birleştir**

`backend/src/resolvers/solar-system/index.ts` dosyasının tamamını şununla
değiştir:

```ts
import { solarSystemFields as baseSolarSystemFields } from './fields';
import { solarSystemTopologyFields } from './topology-fields';

export const solarSystemFields = {
    ...baseSolarSystemFields,
    ...solarSystemTopologyFields,
};

export {
    asteroidBeltFields,
    moonFields,
    planetFields,
    stargateDestinationFields,
    stargateFields,
    starFields,
    stationFields,
} from './topology-fields';

export { solarSystemQueries } from './queries';
```

- [ ] **Adım 3: Yeni tipleri resolver haritasına kaydet**

`backend/src/resolvers/index.ts` içindeki `./solar-system` import'unu genişlet:

```ts
import {
    asteroidBeltFields,
    moonFields,
    planetFields,
    solarSystemFields,
    solarSystemQueries,
    stargateDestinationFields,
    stargateFields,
    starFields,
    stationFields,
} from './solar-system';
```

ve `SolarSystem: solarSystemFields,` satırının altına:

```ts
    Stargate: stargateFields,
    StargateDestination: stargateDestinationFields,
    Star: starFields,
    Planet: planetFields,
    Moon: moonFields,
    AsteroidBelt: asteroidBeltFields,
    Station: stationFields,
```

- [ ] **Adım 4: Derle — bu sefer geçmeli**

```bash
cd backend && yarn build
```

**Beklenen: hatasız.** Görev 9'dan beri kırık olan derleme burada yeşile döner.

- [ ] **Adım 5: Sorguyu canlı çalıştır**

Bir terminalde `cd backend && yarn dev`. Sonra:

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ solarSystem(id: 30000240) { name counts { stargates planets moons asteroidBelts stations } star { name spectralClass temperature } stargates { name destination { destinationSystemId system { id name } } } } }"}' | jq
```

Beklenen:
- `counts` = `{ stargates: 4, planets: 7, moons: 73, asteroidBelts: 13, stations: 0 }`
- `star.name` = `"4-HWWF - Star"`, `spectralClass` = `"M2 V"`, `temperature` = 2971
- `stargates` dört eleman; her birinde `destination.system.name` dolu
- Yanıtta `errors` alanı **olmamalı**

Thera'nın boş kümelerini de dene:

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ solarSystem(id: 31000005) { name counts { stargates stations moons } stargates { id } stations { name } } }"}' | jq
```

Beklenen: `counts.stargates = 0`, `stargates = []` (null değil), `stations`
dört eleman.

- [ ] **Adım 6: Derinlik sınırının çalıştığını doğrula**

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ solarSystem(id: 30000240) { stargates { destination { stargate { destination { stargate { destination { stargate { destination { stargate { id } } } } } } } } } } }"}' | jq '.errors[0].message'
```

Beklenen: `exceeds maximum operation depth of 12` içeren bir hata. Bu, Görev
10'un özyinelemeyi gerçekten kapattığının kanıtı.

- [ ] **Adım 7: Commit**

```bash
git add backend/src/resolvers
git commit -m "feat(graphql): implement the topology field resolvers

Maps the snake_case Prisma rows onto the camelCase schema and resolves type,
ownerCorporation, solarSystem and destination.system / destination.stargate
through DataLoaders.

counts.stargates counts stargate rows rather than resolved destinations, so the
Adjacent tab label is correct as soon as step 2 has run — step 3 only fills in
where each gate leads."
```

---

### Görev 13: `solarSystemStats` sorgusu

**Dosyalar:**
- Değiştir: `backend/src/resolvers/solar-system/queries.ts`

**Arayüzler:**
- Tüketir: Görev 1'in `killmails(solar_system_id, killmail_time)` bileşik
  indeksi, Görev 9'un `SolarSystemStats` tipi.
- Üretir: `Query.solarSystemStats(systemId: Int!)`. Görev 17'nin istatistik
  şeridi bunu okuyor.

- [ ] **Adım 1: Resolver'ı ekle**

`backend/src/resolvers/solar-system/queries.ts` dosyasının başındaki import'lara
`prisma` ve `redis` yoksa ekle:

```ts
import prisma from '@services/prisma';
import redis from '@services/redis';
```

ve `solarSystemQueries` nesnesine şu alanı ekle:

```ts
  solarSystemStats: async (_: unknown, { systemId }: { systemId: number }) => {
    const cacheKey = `solarSystemStats:${systemId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type TotalsRow = {
      total_kills: bigint;
      total_isk: number;
      kills_24h: bigint;
      kills_7d: bigint;
      isk_7d: number;
      last_kill_time: Date | null;
    };

    // killmails, not killmail_filters: that table has no total_value column.
    // Killmails whose value was never backfilled count as 0 rather than being
    // excluded, matching how KillmailOrderBy.ValueDesc already behaves.
    const [totals] = await prisma.$queryRaw<TotalsRow[]>`
      SELECT
        COUNT(*)::BIGINT AS total_kills,
        COALESCE(SUM(total_value), 0)::DOUBLE PRECISION AS total_isk,
        COUNT(*) FILTER (WHERE killmail_time >= NOW() - INTERVAL '24 hours')::BIGINT AS kills_24h,
        COUNT(*) FILTER (WHERE killmail_time >= NOW() - INTERVAL '7 days')::BIGINT AS kills_7d,
        COALESCE(SUM(total_value) FILTER (WHERE killmail_time >= NOW() - INTERVAL '7 days'), 0)::DOUBLE PRECISION AS isk_7d,
        MAX(killmail_time) AS last_kill_time
      FROM killmails
      WHERE solar_system_id = ${systemId}
    `;

    type HourRow = { hour: number; kill_count: bigint };
    const busiest = await prisma.$queryRaw<HourRow[]>`
      SELECT EXTRACT(HOUR FROM killmail_time AT TIME ZONE 'UTC')::INT AS hour,
             COUNT(*)::BIGINT AS kill_count
      FROM killmails
      WHERE solar_system_id = ${systemId}
        AND killmail_time >= NOW() - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY kill_count DESC, hour ASC
      LIMIT 1
    `;

    const result = {
      systemId,
      totalKills: Number(totals?.total_kills ?? 0),
      totalIskDestroyed: totals?.total_isk ?? 0,
      kills24h: Number(totals?.kills_24h ?? 0),
      kills7d: Number(totals?.kills_7d ?? 0),
      iskDestroyed7d: totals?.isk_7d ?? 0,
      lastKillTime: totals?.last_kill_time?.toISOString() ?? null,
      busiestHourUtc: busiest.length > 0 ? busiest[0].hour : null,
    };

    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },
```

`Number()` dönüşümleri zorunlu: `::BIGINT` Prisma'dan JS `BigInt` olarak geliyor
ve `JSON.stringify` `BigInt` üzerinde `TypeError` fırlatıyor.

Saat sıralamasındaki ikincil `hour ASC`, eşitlik durumunda sonucun deterministik
olmasını sağlıyor — aksi halde cache her yenilendiğinde farklı bir saat
görünebilir.

- [ ] **Adım 2: Derle**

```bash
cd backend && yarn build
```

Beklenen: hatasız.

- [ ] **Adım 3: Sorguyu çalıştır**

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ solarSystemStats(systemId: 30000142) { totalKills totalIskDestroyed kills24h kills7d lastKillTime busiestHourUtc } }"}' | jq
```

Beklenen: sayısal alanlar dolu, `errors` yok. Hiç killmail'i olmayan bir sistem
için (örn. 31000005) hepsi `0`, `lastKillTime` ve `busiestHourUtc` `null` —
boş durum değil, sıfır.

- [ ] **Adım 4: İndeks kullanımını doğrula**

```sql
EXPLAIN ANALYZE
SELECT COUNT(*) FILTER (WHERE killmail_time >= NOW() - INTERVAL '24 hours')
FROM killmails WHERE solar_system_id = 30000142;
```

Beklenen: planda `solar_system_id, killmail_time` bileşik indeksi görünmeli.
`Seq Scan on killmails` görürsen Görev 1 Adım 5'teki migration uygulanmamış
demektir.

- [ ] **Adım 5: Commit**

```bash
git add backend/src/resolvers/solar-system/queries.ts
git commit -m "feat(graphql): add solarSystemStats

Two raw queries against killmails behind a 300s Redis cache, following the
leaderboard resolvers. killmail_filters is not usable here: it has no
total_value column.

Busiest hour breaks ties on the lower hour so the cached answer is stable
between refreshes."
```

---

### Görev 14: `sovereigntyActiveCampaigns` sistem filtresi

**Dosyalar:**
- Değiştir: `backend/src/schemas/Sovereignty.graphql`,
  `backend/src/resolvers/sovereignty/queries.ts`

**Arayüzler:**
- Tüketir: mevcut `sovereignty_campaigns` tablosu.
- Üretir: `sovereigntyActiveCampaigns(limit: Int, systemId: Int)`. Görev 20'nin
  Sovereignty sekmesi bunu kullanıyor.

- [ ] **Adım 1: Şemaya argümanı ekle**

`backend/src/schemas/Sovereignty.graphql:204` satırını şununla değiştir:

```graphql
  sovereigntyActiveCampaigns(limit: Int, systemId: Int): [SovereigntyCampaign!]!
```

- [ ] **Adım 2: Resolver'ı filtrele**

`backend/src/resolvers/sovereignty/queries.ts:291` civarındaki resolver'ı
şununla değiştir:

```ts
  sovereigntyActiveCampaigns: async (_, { limit, systemId }) => {
    const campaigns = await prisma.sovereigntyCampaign.findMany({
      where: {
        end_time: null,
        ...(systemId ? { solar_system_id: systemId } : {}),
      },
      orderBy: { start_time: 'desc' },
      take: limit ?? 100,
    });
    return enrichCampaigns(campaigns);
  },
```

`sovereignty_campaigns` tablosundaki `solar_system_id, start_time` indeksi bu
sorguyu zaten karşılıyor; yeni indeks gerekmiyor.

- [ ] **Adım 3: Codegen ve derle**

```bash
cd backend && yarn codegen && yarn build
```

Beklenen: ikisi de hatasız.

- [ ] **Adım 4: Doğrula**

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ sovereigntyActiveCampaigns(systemId: 30000240) { campaignId eventType } }"}' | jq
```

Beklenen: dizi döner (o sistemde aktif kampanya yoksa boş), `errors` yok.
Argümansız çağrının davranışının değişmediğini de doğrula:

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ sovereigntyActiveCampaigns(limit: 3) { campaignId } }"}' | jq
```

- [ ] **Adım 5: Commit**

```bash
git add backend/src/schemas/Sovereignty.graphql backend/src/resolvers/sovereignty backend/src/generated-schema.graphql backend/src/generated-types.ts
git commit -m "feat(graphql): filter sovereigntyActiveCampaigns by system

Optional systemId argument for the solar system Sovereignty tab. The existing
(solar_system_id, start_time) index already covers it."
```

---

## Faz C — Frontend

### Görev 15: GraphQL dokümanları ve codegen

**Dosyalar:**
- Oluştur: `frontend/src/graphql/SolarSystem.graphql`,
  `SolarSystemStats.graphql`, `SystemKillsHistory.graphql`,
  `SolarSystemAdjacent.graphql`, `SolarSystemOrbitalBodies.graphql`,
  `SolarSystemStations.graphql`, `SolarSystemSovereignty.graphql`
- Değiştir: `frontend/src/graphql/SolarSystems.graphql`

**Arayüzler:**
- Tüketir: Görev 9–14'ün şeması (`backend/src/generated-schema.graphql`).
- Üretir: `frontend/src/generated/graphql.ts` içinde `useSolarSystemQuery`,
  `useSolarSystemStatsQuery`, `useSystemKillsHistoryQuery`,
  `useSolarSystemAdjacentQuery`, `useSolarSystemOrbitalBodiesQuery`,
  `useSolarSystemStationsQuery`, `useSolarSystemSovereigntyQuery`. Görev 16–21
  bunları çağırıyor.

- [ ] **Adım 1: Detay sorgusunu kendi dosyasına taşı (P8)**

`frontend/src/graphql/SolarSystems.graphql` içindeki `query SolarSystem($id: Int!)`
bloğunu **tamamen sil**. Dosyada yalnızca `query SolarSystems(...)` kalsın.

Sonra `frontend/src/graphql/SolarSystem.graphql` dosyasını oluştur:

```graphql
query SolarSystem($id: Int!) {
  solarSystem(id: $id) {
    id
    name
    securityStatus
    security_class
    star_id
    position {
      x
      y
      z
    }
    constellation {
      id
      name
      region {
        id
        name
      }
    }
    latestKills {
      ship_kills
      pod_kills
      npc_kills
      timestamp
    }
    star {
      id
      name
      spectralClass
      temperature
      radius
      type {
        id
        name
      }
    }
    counts {
      stargates
      planets
      moons
      asteroidBelts
      stations
      sovereigntyStructures
    }
  }
}
```

- [ ] **Adım 2: Kalan altı dokümanı yaz**

`frontend/src/graphql/SolarSystemStats.graphql`:

```graphql
query SolarSystemStats($systemId: Int!) {
  solarSystemStats(systemId: $systemId) {
    systemId
    totalKills
    totalIskDestroyed
    kills24h
    kills7d
    iskDestroyed7d
    lastKillTime
    busiestHourUtc
  }
}
```

`frontend/src/graphql/SystemKillsHistory.graphql`:

```graphql
query SystemKillsHistory($filter: SystemKillsFilter!) {
  systemKillsHistory(filter: $filter) {
    id
    ship_kills
    pod_kills
    npc_kills
    timestamp
  }
}
```

`frontend/src/graphql/SolarSystemAdjacent.graphql`:

```graphql
query SolarSystemAdjacent($id: Int!) {
  solarSystem(id: $id) {
    id
    stargates {
      id
      name
      destination {
        destinationSystemId
        system {
          id
          name
          securityStatus
          constellation {
            id
            name
            region {
              id
              name
            }
          }
          latestKills {
            ship_kills
            pod_kills
            npc_kills
          }
        }
      }
    }
  }
}
```

Bu, plandaki en derin sorgu: `solarSystem → stargates → destination → system →
constellation → region → name`, yani 7 seviye. Görev 10'un 12 sınırının altında.

`frontend/src/graphql/SolarSystemOrbitalBodies.graphql`:

```graphql
query SolarSystemOrbitalBodies($id: Int!) {
  solarSystem(id: $id) {
    id
    planets {
      id
      name
      orbitIndex
      typeId
      type {
        id
        name
      }
      moons {
        id
        name
        orbitIndex
      }
      asteroidBelts {
        id
        name
        orbitIndex
      }
    }
  }
}
```

`frontend/src/graphql/SolarSystemStations.graphql`:

```graphql
query SolarSystemStations($id: Int!) {
  solarSystem(id: $id) {
    id
    stations {
      id
      name
      typeId
      type {
        id
        name
      }
      ownerCorporationId
      ownerCorporation {
        id
        name
        ticker
      }
      services
      reprocessingEfficiency
      reprocessingStationsTake
      officeRentalCost
      maxDockableShipVolume
    }
  }
}
```

`frontend/src/graphql/SolarSystemSovereignty.graphql`:

```graphql
query SolarSystemSovereignty($systemId: Int!) {
  sovereigntyStructures(systemId: $systemId, limit: 50) {
    structureId
    solarSystemId
    allianceId
    allianceName
    allianceTicker
    structureTypeId
    structureTypeName
    occupancyLevel
    vulnerableStartTime
    vulnerableEndTime
    lastSeen
  }
  sovereigntyActiveCampaigns(systemId: $systemId, limit: 25) {
    campaignId
    eventType
    solarSystemId
    solarSystemName
    defenderId
    defenderName
    defenderTicker
    defenderScore
    attackersScore
    startTime
  }
}
```

- [ ] **Adım 3: Codegen**

```bash
cd frontend && yarn codegen
```

Beklenen: hatasız. Frontend codegen'i `../backend/src/generated-schema.graphql`
okuyor, yani Görev 14'ün backend codegen'i çalışmış olmalı. "Unknown field
`counts`" gibi bir hata alırsan önce `cd backend && yarn codegen` çalıştır.

- [ ] **Adım 4: Hook'ların üretildiğini doğrula**

```bash
cd frontend && grep -c "useSolarSystemStatsQuery\|useSolarSystemAdjacentQuery\|useSolarSystemOrbitalBodiesQuery\|useSolarSystemStationsQuery\|useSolarSystemSovereigntyQuery\|useSystemKillsHistoryQuery" src/generated/graphql.ts
```

Beklenen: 0'dan büyük bir sayı (her hook birden çok kez geçiyor).

- [ ] **Adım 5: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

Beklenen: `page.tsx` hâlâ eski `useSolarSystemQuery` şeklini kullanıyor ama alan
adları değişmediği için derleme **geçmeli**. Geçmezse detay sorgusundan bir alan
düşürülmüş demektir; Adım 1'deki seçim setini kontrol et.

- [ ] **Adım 6: Commit**

```bash
git add frontend/src/graphql frontend/src/generated/graphql.ts
git commit -m "feat(graphql): add the solar system detail documents

Moves the SolarSystem detail query out of SolarSystems.graphql into its own
file, matching every other entity in the repo, and adds one document per tab.

Adjacency is queried through stargates { destination { system } } — there is no
separate adjacentSystems field to drift out of sync with it."
```

---

### Görev 16: `page.tsx` kabuğa iniyor

**Dosyalar:**
- Değiştir: `frontend/src/app/solar-systems/[id]/page.tsx`
- Oluştur: `frontend/src/components/SolarSystemDetail/tabs.ts`

**Arayüzler:**
- Tüketir: Görev 15'in `useSolarSystemQuery`'si.
- Üretir: `SolarSystemTab` tipi ve `SOLAR_SYSTEM_TABS` dizisi; sayfa kabuğu,
  `handleTabChange` / `handlePageChange` / `handlePageSizeChange` callback'leri
  ve altı sekmelik çubuk. Görev 17–21 sekme içeriklerini bu kabuğa takıyor.

Bu görev **P5**'i (her render'da `router.push`), **P6**'yı (sekme değişimi
sayfalamayı sıfırlamıyor) ve **R5**'i (altı sekme dar ekranda taşıyor)
çözüyor.

- [ ] **Adım 1: Sekme tanımlarını ayrı bir dosyaya al**

`frontend/src/components/SolarSystemDetail/tabs.ts`:

```ts
export type SolarSystemTab =
  | "overview"
  | "adjacent"
  | "orbital-bodies"
  | "structures"
  | "sovereignty"
  | "killmails";

export const SOLAR_SYSTEM_TABS: SolarSystemTab[] = [
  "overview",
  "adjacent",
  "orbital-bodies",
  "structures",
  "sovereignty",
  "killmails",
];

export const TAB_LABELS: Record<SolarSystemTab, string> = {
  overview: "Overview",
  adjacent: "Adjacent",
  "orbital-bodies": "Orbital Bodies",
  structures: "Structures",
  sovereignty: "Sovereignty",
  killmails: "Killmails",
};

export function isSolarSystemTab(value: string | null): value is SolarSystemTab {
  return value !== null && (SOLAR_SYSTEM_TABS as string[]).includes(value);
}
```

- [ ] **Adım 2: URL senkronizasyon `useEffect`'ini sil, callback'lere taşı**

`page.tsx` içindeki şu bloğu **tamamen sil**:

```ts
  // URL sync for pagination and tab
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (activeTab === "killmails") {
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());
    }
    router.push(`/solar-systems/${id}?${params.toString()}`, { scroll: false });
  }, [currentPage, pageSize, activeTab, id, router]);
```

Bu effect mount anında da koşulsuz `router.push` çağırıyordu — kullanıcı hiçbir
şeye dokunmadan gereksiz bir history kaydı ekleniyordu.

Yerine şunları koy:

```ts
  const syncUrl = useCallback(
    (tab: SolarSystemTab, page: number, size: number) => {
      const params = new URLSearchParams();
      params.set("tab", tab);
      if (tab === "killmails") {
        params.set("page", page.toString());
        params.set("pageSize", size.toString());
      }
      // replace, not push: switching tabs must not fill the back button with
      // intermediate states.
      router.replace(`/solar-systems/${id}?${params.toString()}`, {
        scroll: false,
      });
    },
    [id, router],
  );

  const handleTabChange = useCallback(
    (tab: SolarSystemTab) => {
      setActiveTab(tab);
      // P6: leaving the killmails tab on page 7 and coming back must not keep
      // page=7 in state or in the URL.
      setCurrentPage(1);
      syncUrl(tab, 1, pageSize);
    },
    [pageSize, syncUrl],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      syncUrl(activeTab, page, pageSize);
    },
    [activeTab, pageSize, syncUrl],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
      syncUrl(activeTab, 1, size);
    },
    [activeTab, syncUrl],
  );
```

Mevcut `handleNext` / `handlePrev` / `handleFirst` / `handleLast`
callback'lerini `handlePageChange` üzerinden yeniden yaz:

```ts
  const handleNext = useCallback(
    () => pageInfo?.hasNextPage && handlePageChange(currentPage + 1),
    [pageInfo?.hasNextPage, currentPage, handlePageChange],
  );
  const handlePrev = useCallback(
    () => pageInfo?.hasPreviousPage && handlePageChange(currentPage - 1),
    [pageInfo?.hasPreviousPage, currentPage, handlePageChange],
  );
  const handleFirst = useCallback(() => handlePageChange(1), [handlePageChange]);
  const handleLast = useCallback(
    () => totalPages > 0 && handlePageChange(totalPages),
    [totalPages, handlePageChange],
  );
```

`react` import'undan `useEffect`'i çıkar. Bitmiş dosyada hiç `useEffect`
kalmamalı.

- [ ] **Adım 3: Sekme state'ini yeni tipe geçir**

`type TabType = "attributes" | "killmails";` satırını sil. Onun yerine:

```ts
import {
  isSolarSystemTab,
  SOLAR_SYSTEM_TABS,
  SolarSystemTab,
  TAB_LABELS,
} from "@/components/SolarSystemDetail/tabs";
```

ve state başlatmasını değiştir:

```ts
  const tabParam = searchParams.get("tab");
  const tabFromUrl: SolarSystemTab = isSolarSystemTab(tabParam)
    ? tabParam
    : "overview";

  const [activeTab, setActiveTab] = useState<SolarSystemTab>(tabFromUrl);
```

Varsayılan sekme artık `overview` — **P2**, en boş sekmenin varsayılan olması.

- [ ] **Adım 4: Sekme çubuğunu altı sekmeye ve kaydırılabilir hale getir**

`tabs` dizisini kuran satırları sil ve `<nav>` bloğunu şununla değiştir:

```tsx
          <nav className="flex gap-4 overflow-x-auto">
            {SOLAR_SYSTEM_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                  activeTab === tab
                    ? "border-cyan-500 text-cyan-500"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                {TAB_LABELS[tab]}
                {tabCount(tab) !== null && (
                  <span className="ml-1.5 text-xs text-gray-500">
                    ({tabCount(tab)})
                  </span>
                )}
              </button>
            ))}
          </nav>
```

`overflow-x-auto` ve `whitespace-nowrap` birlikte R5'i çözüyor: mevcut
`flex gap-4` altı sekmede dar ekranda taşıyordu.

Sayaç yardımcısını `system` tanımlandıktan sonra ekle:

```tsx
  const counts = system.counts;
  const tabCount = (tab: SolarSystemTab): number | null => {
    switch (tab) {
      case "adjacent":
        // stargates, not resolved destinations: the row count is correct as
        // soon as step 2 has run.
        return counts.stargates;
      case "orbital-bodies":
        return counts.planets;
      case "structures":
        return counts.stations;
      case "sovereignty":
        return counts.sovereigntyStructures;
      default:
        return null;
    }
  };
```

- [ ] **Adım 5: Eski sekme içeriklerini geçici olarak yer tutucuya bağla**

`{activeTab === "attributes" && (...)}` ve `{activeTab === "killmails" && (...)}`
bloklarının **tamamını** sil ve yerine şunu koy:

```tsx
        <div className="mt-8">
          {activeTab === "overview" && <div>Overview</div>}
          {activeTab === "adjacent" && <div>Adjacent</div>}
          {activeTab === "orbital-bodies" && <div>Orbital Bodies</div>}
          {activeTab === "structures" && <div>Structures</div>}
          {activeTab === "sovereignty" && <div>Sovereignty</div>}
          {activeTab === "killmails" && <div>Killmails</div>}
        </div>
```

Bunlar Görev 17–21'de gerçek bileşenlerle değiştirilecek. Killmails sorgularını
ve dört `useTopLast7Days*` hook'unu şimdilik **dosyada bırak**; Görev 21 onları
`KillmailsTab`'a taşıyacak.

- [ ] **Adım 6: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

Beklenen: ikisi de hatasız. Kullanılmayan import uyarısı alırsan (`KillmailsTable`,
`Paginator`, `Top*Card` gibi) o import'ları **silme** — Görev 21'e kadar
duracaklar; gerekiyorsa geçici olarak yer tutucu bloklarda referans ver.

- [ ] **Adım 7: Tarayıcıda doğrula**

`yarn dev` ile aç: `http://localhost:3000/solar-systems/30000240`

Kontrol listesi:
- Altı sekme görünüyor, ilki `Overview` ve seçili.
- `Adjacent (4)`, `Orbital Bodies (7)`, `Structures (0)` sayaçları doğru.
- Sayfa yüklendiğinde tarayıcının **geri** düğmesi bir önceki sayfaya
  dönüyor — araya `?tab=overview` kaydı **girmiyor** (P5).
- Sekmeler arasında gezinip geri düğmesine bastığında sekme geçmişi birikmiyor
  (`replace` kullanıldığı için).
- Pencereyi 375px genişliğe daralt: sekme çubuğu yatay kayıyor, satır kırmıyor.

- [ ] **Adım 8: Commit**

```bash
git add frontend/src/app/solar-systems frontend/src/components/SolarSystemDetail
git commit -m "refactor(solar-system): reduce the detail page to a shell

Six tabs, defaulting to Overview instead of the near-empty Attributes tab, with
a horizontally scrollable tab bar — flex gap-4 overflowed at six.

Deletes the URL-sync effect. It depended on router, whose reference stability is
not guaranteed, and called router.push unconditionally on mount, so simply
opening the page added a history entry. State changes and router.replace now
happen together in one callback, and changing tabs resets pagination to page 1."
```

---

### Görev 17: Overview sekmesi

**Dosyalar:**
- Oluştur: `frontend/src/components/SolarSystemDetail/SystemStatsStrip.tsx`,
  `StarCard.tsx`, `SystemTechnicalDetails.tsx`, `OverviewTab.tsx`
- Oluştur: `frontend/src/components/SystemActivityChart/SystemActivityChart.tsx`
- Değiştir: `frontend/src/app/solar-systems/[id]/page.tsx`

**Arayüzler:**
- Tüketir: Görev 15'in `useSolarSystemStatsQuery` ve `useSystemKillsHistoryQuery`
  hook'ları; Görev 16'nın kabuğu.
- Üretir: `<SystemStatsStrip systemId={number} />`,
  `<OverviewTab system={SolarSystemQuery["solarSystem"]} />`.

- [ ] **Adım 1: İstatistik şeridini yaz**

`frontend/src/components/SolarSystemDetail/SystemStatsStrip.tsx`:

```tsx
"use client";

import { useSolarSystemStatsQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";

interface SystemStatsStripProps {
  systemId: number;
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border bg-white/5 border-white/10">
      <div className="text-xs tracking-wide text-gray-400 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function SkeletonBox() {
  return (
    <div className="p-4 border bg-white/5 border-white/10">
      <div className="w-24 h-3 bg-white/10 animate-pulse" />
      <div className="w-16 h-6 mt-2 bg-white/10 animate-pulse" />
    </div>
  );
}

export default function SystemStatsStrip({ systemId }: SystemStatsStripProps) {
  const { data, loading } = useSolarSystemStatsQuery({ variables: { systemId } });

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 mt-6 lg:grid-cols-4">
        <SkeletonBox />
        <SkeletonBox />
        <SkeletonBox />
        <SkeletonBox />
      </div>
    );
  }

  const stats = data?.solarSystemStats;

  // A system with no killmails shows zeroes, not an empty state.
  return (
    <div className="grid grid-cols-2 gap-4 mt-6 lg:grid-cols-4">
      <Box label="Total Kills" value={(stats?.totalKills ?? 0).toLocaleString()} />
      <Box label="ISK Destroyed" value={formatISK(stats?.totalIskDestroyed)} />
      <Box label="Kills (24h)" value={(stats?.kills24h ?? 0).toLocaleString()} />
      <Box
        label="Busiest Hour"
        value={
          stats?.busiestHourUtc === null || stats?.busiestHourUtc === undefined
            ? "—"
            : `${String(stats.busiestHourUtc).padStart(2, "0")}:00 UTC`
        }
      />
    </div>
  );
}
```

- [ ] **Adım 2: Yıldız kartını yaz**

`frontend/src/components/SolarSystemDetail/StarCard.tsx`:

```tsx
"use client";

export interface StarSummary {
  id: number;
  name?: string | null;
  spectralClass?: string | null;
  temperature?: number | null;
  radius?: number | null;
  type?: { id: number; name: string } | null;
}

interface StarCardProps {
  star?: StarSummary | null;
  starId?: number | null;
}

export default function StarCard({ star, starId }: StarCardProps) {
  // Step 3 has not run yet, or the system has no star row: fall back to the raw
  // identifier rather than hiding the card.
  if (!star || !star.name) {
    if (!starId && !star) return null;
    return (
      <div className="p-6 border bg-white/5 border-white/10">
        <div className="text-xs tracking-wide text-gray-400 uppercase">Star</div>
        <div className="mt-2 italic text-gray-500">
          Star {star?.id ?? starId}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <div className="text-xs tracking-wide text-gray-400 uppercase">Star</div>
      <div className="mt-2 text-lg font-semibold text-gray-100">{star.name}</div>
      <dl className="grid grid-cols-2 gap-2 mt-4 text-sm">
        {star.type?.name && (
          <>
            <dt className="text-gray-400">Type</dt>
            <dd className="text-gray-200">{star.type.name}</dd>
          </>
        )}
        {star.spectralClass && (
          <>
            <dt className="text-gray-400">Spectral class</dt>
            <dd className="text-gray-200">{star.spectralClass}</dd>
          </>
        )}
        {star.temperature != null && (
          <>
            <dt className="text-gray-400">Temperature</dt>
            <dd className="text-gray-200">{star.temperature.toLocaleString()} K</dd>
          </>
        )}
        {star.radius != null && (
          <>
            <dt className="text-gray-400">Radius</dt>
            <dd className="text-gray-200">
              {(star.radius / 1000).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{" "}
              km
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
```

- [ ] **Adım 3: Aktivite grafiğini yaz**

`frontend/src/components/SystemActivityChart/SystemActivityChart.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Snapshot {
  timestamp: string;
  ship_kills: number;
  pod_kills: number;
  npc_kills: number;
}

interface SystemActivityChartProps {
  snapshots: Snapshot[];
  loading?: boolean;
  range: "24h" | "7d";
  onRangeChange: (range: "24h" | "7d") => void;
}

function formatHour(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export default function SystemActivityChart({
  snapshots,
  loading = false,
  range,
  onRangeChange,
}: SystemActivityChartProps) {
  const option = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: {
        data: ["Ship kills", "Pod kills", "NPC kills"],
        textStyle: { color: "#9ca3af" },
      },
      grid: { left: 48, right: 16, top: 40, bottom: 40 },
      xAxis: {
        type: "category",
        data: sorted.map((s) => formatHour(s.timestamp)),
        axisLabel: { color: "#9ca3af" },
      },
      yAxis: { type: "value", axisLabel: { color: "#9ca3af" } },
      series: [
        { name: "Ship kills", type: "line", smooth: true, data: sorted.map((s) => s.ship_kills) },
        { name: "Pod kills", type: "line", smooth: true, data: sorted.map((s) => s.pod_kills) },
        { name: "NPC kills", type: "line", smooth: true, data: sorted.map((s) => s.npc_kills) },
      ],
    };
  }, [snapshots]);

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
          Kill activity
        </h3>
        <div className="flex gap-2">
          {(["24h", "7d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1 text-xs font-semibold border cursor-pointer ${
                range === r
                  ? "border-cyan-500 text-cyan-500"
                  : "border-white/10 text-gray-400 hover:text-gray-200"
              }`}
            >
              {r === "24h" ? "24 Hours" : "7 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[320px] mt-4 bg-white/5 animate-pulse" />
      ) : snapshots.length === 0 ? (
        // An axis with no series reads as broken, so say nothing was recorded.
        <div className="h-[320px] mt-4 flex items-center justify-center text-gray-500">
          No kill activity recorded in this window
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 320, marginTop: 16 }} />
      )}
    </div>
  );
}
```

`echarts-for-react`'in `next/dynamic` ile `ssr: false` olarak yüklenmesi
`AllianceGrowthChart`'ın kalıbı; ECharts sunucuda render edilemiyor.

- [ ] **Adım 4: Teknik detayları yaz**

`frontend/src/components/SolarSystemDetail/SystemTechnicalDetails.tsx`:

```tsx
"use client";

const METRES_PER_AU = 149_597_870_700;

interface SystemTechnicalDetailsProps {
  systemId: number;
  starId?: number | null;
  securityClass?: string | null;
  securityStatus?: number | null;
  position?: { x: number; y: number; z: number } | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-mono text-gray-200 break-all">{value}</dd>
    </>
  );
}

export default function SystemTechnicalDetails({
  systemId,
  starId,
  securityClass,
  securityStatus,
  position,
}: SystemTechnicalDetailsProps) {
  return (
    <details className="p-6 border bg-white/5 border-white/10">
      <summary className="text-sm font-semibold tracking-wide text-gray-300 uppercase cursor-pointer">
        Technical details
      </summary>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 mt-4 text-sm">
        <Row label="System ID" value={String(systemId)} />
        <Row label="Star ID" value={starId != null ? String(starId) : "—"} />
        <Row label="Security class" value={securityClass ?? "—"} />
        <Row
          label="Security status"
          value={securityStatus != null ? securityStatus.toFixed(10) : "—"}
        />
        {position && (
          <>
            <Row
              label="Position (m)"
              value={`x ${position.x.toExponential(4)}  y ${position.y.toExponential(4)}  z ${position.z.toExponential(4)}`}
            />
            <Row
              label="Position (AU)"
              value={`x ${(position.x / METRES_PER_AU).toFixed(2)}  y ${(position.y / METRES_PER_AU).toFixed(2)}  z ${(position.z / METRES_PER_AU).toFixed(2)}`}
            />
          </>
        )}
      </dl>
    </details>
  );
}
```

`security_class` Thera'da null olduğu için `—` yolu gerçek bir durum, savunma
kodu değil.

- [ ] **Adım 5: Overview sekmesini birleştir**

`frontend/src/components/SolarSystemDetail/OverviewTab.tsx`:

```tsx
"use client";

import SystemActivityChart from "@/components/SystemActivityChart/SystemActivityChart";
import { useSystemKillsHistoryQuery } from "@/generated/graphql";
import { useState } from "react";
import StarCard, { StarSummary } from "./StarCard";
import SystemTechnicalDetails from "./SystemTechnicalDetails";

interface OverviewTabProps {
  systemId: number;
  starId?: number | null;
  securityClass?: string | null;
  securityStatus?: number | null;
  position?: { x: number; y: number; z: number } | null;
  star?: StarSummary | null;
}

export default function OverviewTab({
  systemId,
  starId,
  securityClass,
  securityStatus,
  position,
  star,
}: OverviewTabProps) {
  const [range, setRange] = useState<"24h" | "7d">("24h");

  const { data, loading, error } = useSystemKillsHistoryQuery({
    variables: { filter: { system_id: systemId, hours: range === "24h" ? 24 : 168 } },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <StarCard star={star} starId={starId} />
      </div>

      <div className="lg:col-span-2">
        {error ? (
          // A failing tab query takes down only that tab.
          <div className="p-6 border bg-white/5 border-white/10 text-red-400">
            Could not load kill activity: {error.message}
          </div>
        ) : (
          <SystemActivityChart
            snapshots={data?.systemKillsHistory ?? []}
            loading={loading}
            range={range}
            onRangeChange={setRange}
          />
        )}
      </div>

      <div className="lg:col-span-3">
        <SystemTechnicalDetails
          systemId={systemId}
          starId={starId}
          securityClass={securityClass}
          securityStatus={securityStatus}
          position={position}
        />
      </div>
    </div>
  );
}
```

- [ ] **Adım 6: Kabuğa bağla**

`page.tsx` içinde import'lara ekle:

```tsx
import OverviewTab from "@/components/SolarSystemDetail/OverviewTab";
import SystemStatsStrip from "@/components/SolarSystemDetail/SystemStatsStrip";
```

İstatistik şeridini sekme çubuğunun **üstüne**, header'ın hemen altına koy:

```tsx
        <SystemStatsStrip systemId={parseInt(id)} />
```

ve Overview yer tutucusunu değiştir:

```tsx
          {activeTab === "overview" && (
            <OverviewTab
              systemId={parseInt(id)}
              starId={system.star_id}
              securityClass={system.security_class}
              securityStatus={system.securityStatus}
              position={system.position}
              star={system.star}
            />
          )}
```

- [ ] **Adım 7: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

Beklenen: ikisi de hatasız.

- [ ] **Adım 8: Tarayıcıda doğrula**

`http://localhost:3000/solar-systems/30000240`

- İstatistik şeridi dört kutu, sekme çubuğunun üstünde, **her sekmede** görünür.
- Yıldız kartı `4-HWWF - Star`, `M2 V`, `2.971 K` gösteriyor.
- Grafikte 24h / 7d düğmeleri çalışıyor.
- Technical details katlanmış; açınca `H3`, sistem ID'si ve hem metre hem AU
  koordinatları var.

Sonra `http://localhost:3000/solar-systems/31000005` (Thera):
- `Security class` satırı `—` gösteriyor, hata vermiyor.
- Hiç killmail yoksa şerit sıfır gösteriyor, boş durum metni değil.
- Grafik "No kill activity recorded in this window" diyor.

- [ ] **Adım 9: Commit**

```bash
git add frontend/src/components frontend/src/app/solar-systems
git commit -m "feat(solar-system): add the Overview tab

Replaces the Attributes tab as the landing tab. Attributes showed two raw ESI
identifiers, coordinates printed as -1.2345e+17 metres, and a location card
duplicating links already in the breadcrumb and header.

Overview shows the star as content rather than an ID, an hourly kill activity
chart with a 24h/7d toggle, and folds the raw identifiers into a collapsed
Technical details block with the coordinates also converted to AU.

The statistics strip sits above the tab bar: it summarises the system, not a tab."
```

---

### Görev 18: Orbital Bodies sekmesi

**Dosyalar:**
- Oluştur: `frontend/src/components/SolarSystemDetail/OrbitalBodiesTab.tsx`
- Değiştir: `frontend/src/app/solar-systems/[id]/page.tsx`

**Arayüzler:**
- Tüketir: Görev 15'in `useSolarSystemOrbitalBodiesQuery`'si.
- Üretir: `<OrbitalBodiesTab systemId={number} />`.

- [ ] **Adım 1: Bileşeni yaz**

`frontend/src/components/SolarSystemDetail/OrbitalBodiesTab.tsx`:

```tsx
"use client";

import { useSolarSystemOrbitalBodiesQuery } from "@/generated/graphql";
import { Loader } from "@/components/Loader/Loader";

interface OrbitalBodiesTabProps {
  systemId: number;
}

/**
 * Step 3 fills in names; until it has, a row still has correct topology and is
 * shown by its ID rather than hidden.
 */
function BodyLabel({ name, id, kind }: { name?: string | null; id: number; kind: string }) {
  if (name) return <span className="text-gray-200">{name}</span>;
  return (
    <span className="italic text-gray-500">
      {kind} {id}
    </span>
  );
}

export default function OrbitalBodiesTab({ systemId }: OrbitalBodiesTabProps) {
  const { data, loading, error } = useSolarSystemOrbitalBodiesQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading orbital bodies..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load orbital bodies: {error.message}
      </div>
    );
  }

  const planets = data?.solarSystem?.planets ?? [];

  if (planets.length === 0) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-gray-400">
        This system has no planets.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {planets.map((planet) => {
        const moons = planet.moons ?? [];
        const belts = planet.asteroidBelts ?? [];
        const hasSatellites = moons.length > 0 || belts.length > 0;

        return (
          <details
            key={planet.id}
            className="border bg-white/5 border-white/10"
            // A planet with nothing under it must not look like a broken toggle.
            open={false}
          >
            <summary
              className={`flex items-center justify-between gap-4 px-6 py-4 ${
                hasSatellites ? "cursor-pointer" : "cursor-default list-none"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="w-8 text-xs text-gray-500">
                  {planet.orbitIndex ?? "—"}
                </span>
                <BodyLabel name={planet.name} id={planet.id} kind="Planet" />
                {planet.type?.name && (
                  <span className="px-2 py-0.5 text-xs text-cyan-400 bg-cyan-400/10 border border-cyan-400/20">
                    {planet.type.name}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {moons.length} moons · {belts.length} belts
              </span>
            </summary>

            {hasSatellites && (
              <div className="grid gap-6 px-6 pt-2 pb-6 md:grid-cols-2 border-t border-white/10">
                <div>
                  <h4 className="mt-4 mb-2 text-xs tracking-wide text-gray-400 uppercase">
                    Moons
                  </h4>
                  {moons.length === 0 ? (
                    <p className="text-sm text-gray-500">No moons.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {moons.map((moon) => (
                        <li key={moon.id} className="flex gap-3">
                          <span className="w-6 text-xs text-gray-600">
                            {moon.orbitIndex ?? "—"}
                          </span>
                          <BodyLabel name={moon.name} id={moon.id} kind="Moon" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="mt-4 mb-2 text-xs tracking-wide text-gray-400 uppercase">
                    Asteroid belts
                  </h4>
                  {belts.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No asteroid belts around this planet.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {belts.map((belt) => (
                        <li key={belt.id} className="flex gap-3">
                          <span className="w-6 text-xs text-gray-600">
                            {belt.orbitIndex ?? "—"}
                          </span>
                          <BodyLabel name={belt.name} id={belt.id} kind="Asteroid belt" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
```

- [ ] **Adım 2: Kabuğa bağla**

`page.tsx` import'larına:

```tsx
import OrbitalBodiesTab from "@/components/SolarSystemDetail/OrbitalBodiesTab";
```

ve yer tutucuyu değiştir:

```tsx
          {activeTab === "orbital-bodies" && (
            <OrbitalBodiesTab systemId={parseInt(id)} />
          )}
```

- [ ] **Adım 3: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

- [ ] **Adım 4: Üç sistemde doğrula**

- `30000240` (4-HWWF): yedi gezegen, `orbitIndex` 1–7 sırayla. IV. gezegen
  açıldığında 11 ay + 1 belt; VII. gezegende 23 ay + 6 belt.
- `30000142` (Jita): sekiz gezegen; her gezegenin belt bölümü "No asteroid belts
  around this planet." diyor — Jita'da hiç belt yok ve bu normal.
- `31000005` (Thera): 14 gezegen, hiçbirinde ay ya da belt yok; satırlar
  katlanamıyor ve `0 moons · 0 belts` yazıyor.

- [ ] **Adım 5: Commit**

```bash
git add frontend/src/components/SolarSystemDetail/OrbitalBodiesTab.tsx frontend/src/app/solar-systems
git commit -m "feat(solar-system): add the Orbital Bodies tab

Planets in orbital order, each collapsible into its moons and asteroid belts.
Rows whose name has not been resolved yet render as 'Moon 40015369' in italics
rather than disappearing: the topology is right, only the label is missing.

A planet with no satellites renders as a plain row rather than an empty toggle —
Thera's fourteen planets have neither."
```

---

### Görev 19: Structures sekmesi

**Dosyalar:**
- Oluştur: `frontend/src/components/SolarSystemDetail/StructuresTab.tsx`
- Değiştir: `frontend/src/app/solar-systems/[id]/page.tsx`

**Arayüzler:**
- Tüketir: Görev 15'in `useSolarSystemStationsQuery`'si.
- Üretir: `<StructuresTab systemId={number} />`.

- [ ] **Adım 1: Bileşeni yaz**

`frontend/src/components/SolarSystemDetail/StructuresTab.tsx`:

```tsx
"use client";

import { Loader } from "@/components/Loader/Loader";
import { useSolarSystemStationsQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";

interface StructuresTabProps {
  systemId: number;
}

export default function StructuresTab({ systemId }: StructuresTabProps) {
  const { data, loading, error } = useSolarSystemStationsQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading structures..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load structures: {error.message}
      </div>
    );
  }

  const stations = data?.solarSystem?.stations ?? [];

  if (stations.length === 0) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-gray-400">
        This system has no NPC stations.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border bg-white/5 border-white/10">
      <table className="w-full text-sm">
        <thead className="text-xs tracking-wide text-gray-400 uppercase border-b border-white/10">
          <tr>
            <th className="px-4 py-3 text-left">Station</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Owner</th>
            <th className="px-4 py-3 text-right">Reprocessing</th>
            <th className="px-4 py-3 text-right">Station take</th>
            <th className="px-4 py-3 text-right">Office rent</th>
            <th className="px-4 py-3 text-left">Services</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => (
            <tr key={station.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3">
                {station.name ? (
                  <span className="text-gray-200">{station.name}</span>
                ) : (
                  <span className="italic text-gray-500">Station {station.id}</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400">{station.type?.name ?? "—"}</td>
              <td className="px-4 py-3">
                {station.ownerCorporation ? (
                  <Link
                    href={`/corporations/${station.ownerCorporation.id}`}
                    className="text-cyan-400 hover:underline"
                  >
                    {station.ownerCorporation.name}
                  </Link>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.reprocessingEfficiency != null
                  ? `${(station.reprocessingEfficiency * 100).toFixed(0)}%`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.reprocessingStationsTake != null
                  ? `${(station.reprocessingStationsTake * 100).toFixed(0)}%`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.officeRentalCost != null
                  ? formatISK(station.officeRentalCost)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {station.services.map((service) => (
                    <span
                      key={service}
                      className="px-1.5 py-0.5 text-xs text-gray-400 border border-white/10"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Reprocessing verimliliği ile istasyon payı yan yana duruyor: tek başına
verimlilik yarım bilgi, çünkü istasyonun aldığı pay istasyondan istasyona
değişiyor.

Tablo `overflow-x-auto` içinde — yedi kolon dar ekranda taşıyor ve sayfa
gövdesinin yatay kaymaması gerek.

- [ ] **Adım 2: Kabuğa bağla**

```tsx
import StructuresTab from "@/components/SolarSystemDetail/StructuresTab";
```

```tsx
          {activeTab === "structures" && <StructuresTab systemId={parseInt(id)} />}
```

- [ ] **Adım 3: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

- [ ] **Adım 4: Üç sistemde doğrula**

- `30000142` (Jita): 18 istasyon; `Jita IV - Moon 6 - Ytiri Storage` satırında
  reprocessing `50%`, station take `5%`, office rent `6.51M`, 12 servis çipi.
- `31000005` (Thera): **dört istasyon** — sekme dolu. Wormhole sistemlerinin
  istasyonsuz olduğu varsayımı yanlış ve bu sistem onu gösteriyor.
- `30000240` (4-HWWF): "This system has no NPC stations." — `stations` anahtarı
  ESI yanıtında hiç yok ve bu normal bir durum, hata değil.

- [ ] **Adım 5: Commit**

```bash
git add frontend/src/components/SolarSystemDetail/StructuresTab.tsx frontend/src/app/solar-systems
git commit -m "feat(solar-system): add the Structures tab

NPC stations only; Upwell structures are not exposed per system by public ESI
and are out of scope. Shows the station's reprocessing take next to its
efficiency — the efficiency figure alone is only half the picture.

Thera has four stations and no stargates, so an empty Structures tab is a
property of the system, not of whether it is wormhole space."
```

---

### Görev 20: Adjacent ve Sovereignty sekmeleri

**Dosyalar:**
- Oluştur: `frontend/src/components/SolarSystemDetail/AdjacentSystemsTab.tsx`,
  `SovereigntyTab.tsx`
- Değiştir: `frontend/src/app/solar-systems/[id]/page.tsx`

**Arayüzler:**
- Tüketir: Görev 15'in `useSolarSystemAdjacentQuery` ve
  `useSolarSystemSovereigntyQuery` hook'ları.
- Üretir: `<AdjacentSystemsTab systemId={number} />`,
  `<SovereigntyTab systemId={number} />`.

- [ ] **Adım 1: Adjacent sekmesini yaz**

`frontend/src/components/SolarSystemDetail/AdjacentSystemsTab.tsx`:

```tsx
"use client";

import { Loader } from "@/components/Loader/Loader";
import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import { useSolarSystemAdjacentQuery } from "@/generated/graphql";
import Link from "next/link";

interface AdjacentSystemsTabProps {
  systemId: number;
}

export default function AdjacentSystemsTab({ systemId }: AdjacentSystemsTabProps) {
  const { data, loading, error } = useSolarSystemAdjacentQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading adjacent systems..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load adjacent systems: {error.message}
      </div>
    );
  }

  const stargates = data?.solarSystem?.stargates ?? [];

  if (stargates.length === 0) {
    // Normal for wormhole space: Thera has no stargates at all.
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-gray-400">
        This system has no stargates.
      </div>
    );
  }

  // Gates whose destination has not been resolved yet — step 3 has not run, or
  // the target system is not in the database — are dropped here rather than in
  // the resolver, so `stargates` stays a faithful view of the table.
  const neighbours = stargates.filter((gate) => gate.destination?.system);

  if (neighbours.length === 0) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-gray-400">
        This system has {stargates.length} stargates, but their destinations have
        not been resolved yet. Run <code>yarn queue:stargates</code> and{" "}
        <code>yarn worker:stargates</code>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border bg-white/5 border-white/10">
      <table className="w-full text-sm">
        <thead className="text-xs tracking-wide text-gray-400 uppercase border-b border-white/10">
          <tr>
            <th className="px-4 py-3 text-left">System</th>
            <th className="px-4 py-3 text-left">Security</th>
            <th className="px-4 py-3 text-left">Constellation</th>
            <th className="px-4 py-3 text-left">Region</th>
            <th className="px-4 py-3 text-right">Ship kills</th>
            <th className="px-4 py-3 text-right">Pod kills</th>
          </tr>
        </thead>
        <tbody>
          {neighbours.map((gate) => {
            const system = gate.destination!.system!;
            return (
              <tr key={gate.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/solar-systems/${system.id}`}
                    className="text-cyan-400 hover:underline"
                  >
                    {system.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <SecurityBadge securityStatus={system.securityStatus} />
                </td>
                <td className="px-4 py-3">
                  {system.constellation ? (
                    <Link
                      href={`/constellations/${system.constellation.id}`}
                      className="text-gray-300 hover:underline"
                    >
                      {system.constellation.name}
                    </Link>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {system.constellation?.region ? (
                    <Link
                      href={`/regions/${system.constellation.region.id}`}
                      className="text-gray-300 hover:underline"
                    >
                      {system.constellation.region.name}
                    </Link>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {system.latestKills?.ship_kills ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {system.latestKills?.pod_kills ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`SecurityBadge` (`components/SecurityStatus/SecurityStatus.tsx`)
`securityStatus: number | null | undefined` ve opsiyonel `showLabel` alıyor —
`page.tsx`'teki mevcut kullanımla aynı.

- [ ] **Adım 2: Sovereignty sekmesini yaz**

`frontend/src/components/SolarSystemDetail/SovereigntyTab.tsx`:

```tsx
"use client";

import { Loader } from "@/components/Loader/Loader";
import { useSolarSystemSovereigntyQuery } from "@/generated/graphql";
import { formatKillmailDateTime } from "@/utils/date";
import Link from "next/link";

interface SovereigntyTabProps {
  systemId: number;
}

export default function SovereigntyTab({ systemId }: SovereigntyTabProps) {
  const { data, loading, error } = useSolarSystemSovereigntyQuery({
    variables: { systemId },
  });

  if (loading) return <Loader size="md" text="Loading sovereignty..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load sovereignty: {error.message}
      </div>
    );
  }

  const structures = data?.sovereigntyStructures ?? [];
  const campaigns = data?.sovereigntyActiveCampaigns ?? [];

  if (structures.length === 0 && campaigns.length === 0) {
    // The tab stays visible even when empty — it was explicitly requested.
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-gray-400">
        This system is not held under sovereignty.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {structures.length > 0 && (
        <div className="overflow-x-auto border bg-white/5 border-white/10">
          <table className="w-full text-sm">
            <thead className="text-xs tracking-wide text-gray-400 uppercase border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left">Structure</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-right">ADM</th>
                <th className="px-4 py-3 text-left">Vulnerable from</th>
                <th className="px-4 py-3 text-left">Vulnerable to</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((structure) => (
                <tr
                  key={structure.structureId}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3 text-gray-200">
                    {structure.structureTypeName ?? `Type ${structure.structureTypeId}`}
                  </td>
                  <td className="px-4 py-3">
                    {structure.allianceId ? (
                      <Link
                        href={`/alliances/${structure.allianceId}`}
                        className="text-cyan-400 hover:underline"
                      >
                        {structure.allianceName ?? structure.allianceId}
                        {structure.allianceTicker && (
                          <span className="ml-1 text-gray-500">
                            [{structure.allianceTicker}]
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {structure.occupancyLevel != null
                      ? structure.occupancyLevel.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {structure.vulnerableStartTime
                      ? formatKillmailDateTime(structure.vulnerableStartTime)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {structure.vulnerableEndTime
                      ? formatKillmailDateTime(structure.vulnerableEndTime)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="p-6 border bg-white/5 border-white/10">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-gray-300 uppercase">
            Active campaigns
          </h3>
          <ul className="space-y-3">
            {campaigns.map((campaign) => (
              <li
                key={campaign.campaignId}
                className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0"
              >
                <span className="text-gray-200">{campaign.eventType}</span>
                <span className="text-sm text-gray-400">
                  Defender:{" "}
                  {campaign.defenderId ? (
                    <Link
                      href={`/alliances/${campaign.defenderId}`}
                      className="text-cyan-400 hover:underline"
                    >
                      {campaign.defenderName ?? campaign.defenderId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-sm text-gray-400">
                  {campaign.defenderScore ?? 0} vs {campaign.attackersScore ?? 0}
                </span>
                <span className="text-sm text-gray-500">
                  {campaign.startTime ? formatKillmailDateTime(campaign.startTime) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Adım 3: Kabuğa bağla**

```tsx
import AdjacentSystemsTab from "@/components/SolarSystemDetail/AdjacentSystemsTab";
import SovereigntyTab from "@/components/SolarSystemDetail/SovereigntyTab";
```

```tsx
          {activeTab === "adjacent" && <AdjacentSystemsTab systemId={parseInt(id)} />}
          {activeTab === "sovereignty" && <SovereigntyTab systemId={parseInt(id)} />}
```

- [ ] **Adım 4: Header'a sovereignty çipini ekle**

`page.tsx` içinde header bloğunda, constellation / region linklerinin yanına:

```tsx
        {system.counts.sovereigntyStructures > 0 && (
          <span className="px-2 py-0.5 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20">
            SOVEREIGNTY
          </span>
        )}
```

Çip yalnızca sov tutulan sistemlerde çıkıyor; sekme ise her zaman görünür
kalıyor.

- [ ] **Adım 5: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

- [ ] **Adım 6: Doğrula**

Adjacent:
- `30000240` (4-HWWF): dört komşu sistem, her satırda security rozeti,
  constellation ve region linkleri.
- `31000005` (Thera): "This system has no stargates."
- Bir komşu sistem adına tıkla — o sistemin detay sayfasına gitmeli.

Sovereignty:
- Sov tutulan bir null-sec sisteminde yapı satırı, ADM ve vulnerability
  penceresi görünüyor; header'da `SOVEREIGNTY` çipi çıkıyor.
- `30000142` (Jita): "This system is not held under sovereignty." ve header'da
  çip **yok**.

- [ ] **Adım 7: Commit**

```bash
git add frontend/src/components/SolarSystemDetail frontend/src/app/solar-systems
git commit -m "feat(solar-system): add the Adjacent and Sovereignty tabs

Adjacent reads stargates { destination { system } } and drops gates whose
destination is unresolved, so the filtering lives in the tab and the stargates
field stays a faithful view of the table. Where every gate is unresolved the tab
says so and names the two commands that fix it.

Sovereignty surfaces sovereigntyStructures and sovereigntyActiveCampaigns, both
of which were fully implemented server-side and never queried. The tab stays
visible when empty; only the header chip is conditional."
```

---

### Görev 21: Killmails sekmesi ve `TopEntitySidebar`

**Dosyalar:**
- Oluştur: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`
- Oluştur: `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`
- Değiştir: `frontend/src/app/solar-systems/[id]/page.tsx`,
  `frontend/src/app/killmails/page.tsx`,
  `frontend/src/app/alliances/[id]/page.tsx`,
  `frontend/src/app/corporations/[id]/page.tsx`

**Arayüzler:**
- Tüketir: mevcut `useTopLast7Days*` hook'ları ve `Top*Card` bileşenleri.
- Üretir: `<TopEntitySidebar filter={{ systemId?, allianceId?, corporationId? }} skip={boolean} />`.

Bu görev **P7**'yi çözüyor: dört kartlık sidebar dört sayfada kopyalanmış.

- [ ] **Adım 1: Sidebar'ı çıkar**

`frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`:

```tsx
"use client";

import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";

export interface TopEntityFilter {
  systemId?: number;
  constellationId?: number;
  regionId?: number;
  allianceId?: number;
  corporationId?: number;
  limit?: number;
}

interface TopEntitySidebarProps {
  filter: TopEntityFilter;
  skip?: boolean;
  /** Cards to render, in order. Defaults to all four. */
  cards?: Array<"characters" | "corporations" | "alliances" | "ships">;
}

const ROLLING_SUBTITLE = (
  <>
    Last 7 days{" "}
    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
      ROLLING
    </span>
  </>
);

export default function TopEntitySidebar({
  filter,
  skip = false,
  cards = ["characters", "corporations", "alliances", "ships"],
}: TopEntitySidebarProps) {
  const variables = { filter: { limit: filter.limit ?? 10, ...filter } };

  const { data: pilots, loading: pilotsLoading } = useTopLast7DaysPilotsQuery({
    variables,
    skip: skip || !cards.includes("characters"),
  });
  const { data: corporations, loading: corporationsLoading } =
    useTopLast7DaysCorporationsQuery({
      variables,
      skip: skip || !cards.includes("corporations"),
    });
  const { data: alliances, loading: alliancesLoading } = useTopLast7DaysAlliancesQuery({
    variables,
    skip: skip || !cards.includes("alliances"),
  });
  const { data: ships, loading: shipsLoading } = useTopLast7DaysShipsQuery({
    variables,
    skip: skip || !cards.includes("ships"),
  });

  return (
    <div className="space-y-6">
      {cards.includes("characters") && (
        <TopCharacterCard
          title="Top Characters"
          subtitle={ROLLING_SUBTITLE}
          characters={
            pilots?.topLast7DaysPilots?.map((pilot) => ({
              id: pilot.character?.id || 0,
              name: pilot.character?.name || "Unknown",
              killCount: pilot.killCount,
              securityStatus: pilot.character?.securityStatus,
              corporation: pilot.character?.corporation
                ? { id: pilot.character.corporation.id, name: pilot.character.corporation.name }
                : null,
              alliance: pilot.character?.alliance
                ? { id: pilot.character.alliance.id, name: pilot.character.alliance.name }
                : null,
            })) || []
          }
          loading={pilotsLoading}
          emptyText="No character activity in the last 7 days"
          variant="detail"
        />
      )}

      {cards.includes("corporations") && (
        <TopCorporationCard
          title="Top Corporations"
          subtitle={ROLLING_SUBTITLE}
          corporations={
            corporations?.topLast7DaysCorporations?.map((corp) => ({
              id: corp.corporation?.id || 0,
              name: corp.corporation?.name || "Unknown",
              ticker: corp.corporation?.ticker,
              killCount: corp.killCount,
            })) || []
          }
          loading={corporationsLoading}
          emptyText="No corporation activity in the last 7 days"
          variant="detail"
        />
      )}

      {cards.includes("alliances") && (
        <TopAllianceCard
          title="Top Alliances"
          subtitle={ROLLING_SUBTITLE}
          alliances={
            alliances?.topLast7DaysAlliances?.map((alliance) => ({
              id: alliance.alliance?.id || 0,
              name: alliance.alliance?.name || "Unknown",
              ticker: alliance.alliance?.ticker,
              killCount: alliance.killCount,
            })) || []
          }
          loading={alliancesLoading}
          emptyText="No alliance activity in the last 7 days"
          variant="detail"
        />
      )}

      {cards.includes("ships") && (
        <TopShipsCard
          title="Top Ships"
          subtitle={ROLLING_SUBTITLE}
          ships={
            ships?.topLast7DaysShips?.map((ship) => ({
              id: ship.shipType?.id || 0,
              name: ship.shipType?.name || "Unknown",
              killCount: ship.killCount,
              dogmaAttributes: ship.shipType?.dogmaAttributes,
            })) || []
          }
          loading={shipsLoading}
          emptyText="No ship activity in the last 7 days"
          variant="detail"
        />
      )}
    </div>
  );
}
```

`cards` prop'u R6 için: dört sayfadaki kullanımlar neredeyse aynı ama tam olarak
aynı değil. Bir sayfa dört kartın hepsini istemiyorsa bileşeni çatallamak yerine
bu prop kullanılır.

- [ ] **Adım 2: Killmails sekmesini çıkar**

`frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`:

```tsx
"use client";

import KillmailsTable from "@/components/KillmailsTable";
import Paginator from "@/components/Paginator/Paginator";
import TopEntitySidebar from "@/components/TopEntitySidebar/TopEntitySidebar";
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
} from "@/generated/graphql";
import { useMemo } from "react";

interface KillmailsTabProps {
  systemId: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function KillmailsTab({
  systemId,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: KillmailsTabProps) {
  // No `skip` needed: the component only mounts while its tab is active.
  const { data: killmailsData, loading: killmailsLoading } = useKillmailsQuery({
    variables: {
      filter: {
        systemId,
        page: currentPage,
        limit: pageSize,
        orderBy: KillmailOrderBy.TimeDesc,
      },
    },
  });

  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: { filter: { systemId } },
  });

  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    dateCountsData?.killmailsDateCounts.forEach((dc) => {
      map.set(dc.date, dc.count);
    });
    return map;
  }, [dateCountsData]);

  const pageInfo = killmailsData?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <div className="lg:col-span-3">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Killmails</h2>
          {pageInfo?.totalCount !== undefined && (
            <p className="mt-1 text-sm text-gray-400">
              Total: {pageInfo.totalCount.toLocaleString()} killmails
            </p>
          )}
        </div>

        <KillmailsTable
          killmails={killmails}
          loading={killmailsLoading}
          dateCountsMap={dateCountsMap}
          variant="detail"
        />

        {killmails.length > 0 && (
          <div className="mt-6">
            <Paginator
              hasNextPage={pageInfo?.hasNextPage ?? false}
              hasPrevPage={pageInfo?.hasPreviousPage ?? false}
              onNext={() => pageInfo?.hasNextPage && onPageChange(currentPage + 1)}
              onPrev={() => pageInfo?.hasPreviousPage && onPageChange(currentPage - 1)}
              onFirst={() => onPageChange(1)}
              onLast={() => totalPages > 0 && onPageChange(totalPages)}
              loading={killmailsLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>

      <div className="space-y-6 lg:col-span-1 lg:mt-9">
        <TopEntitySidebar filter={{ systemId }} />
      </div>
    </div>
  );
}
```

Sayfalama artık kendi state'ini tutmuyor: `onPageChange` / `onPageSizeChange`
kabuğa gidiyor, kabuk da URL'yi aynı callback içinde güncelliyor (Görev 16).
Eski kod `Paginator`'ın `onPageSizeChange`'inde `setPageSize` + `setCurrentPage`
çağırıyordu ve URL senkronu ayrı bir effect'e kalıyordu.

- [ ] **Adım 3: `page.tsx`'i temizle**

Dört `useTopLast7Days*` hook'unu, `useKillmailsQuery`'yi,
`useKillmailsDateCountsQuery`'yi, `killmails` / `dateCountsMap` /
`pageInfo` / `totalPages` memo'larını ve `KillmailsTable`, `Paginator`,
`Top*Card` import'larını **sil**. Yer tutucuyu değiştir:

```tsx
          {activeTab === "killmails" && (
            <KillmailsTab
              systemId={parseInt(id)}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
```

`handleNext` / `handlePrev` / `handleFirst` / `handleLast` artık
`KillmailsTab`'ın içinde tanımlanıyor; `page.tsx`'ten sil.

- [ ] **Adım 4: Satır sayısını doğrula**

```bash
cd frontend && wc -l src/app/solar-systems/\[id\]/page.tsx
```

Beklenen: 200'ün altında. Başlangıç 572 satırdı.

- [ ] **Adım 5: Diğer üç sayfayı `TopEntitySidebar`'a geçir**

`killmails`, `alliances/[id]` ve `corporations/[id]` sayfalarındaki dört kartlık
blokları **teker teker** `<TopEntitySidebar filter={...} />` ile değiştir. Her
sayfadan sonra ayrı ayrı doğrula — bu üç sayfa bu iş kapsamında değil ve
regresyon riski onlarda.

Her sayfa için filter:
- `killmails`: sayfanın mevcut filtresinden ne geçiyorsa (çoğunlukla filtresiz)
- `alliances/[id]`: `{ allianceId: parseInt(id) }`
- `corporations/[id]`: `{ corporationId: parseInt(id) }`

Mevcut mapping'i **birebir** karşılaştır. Bir sayfa dört karttan azını
gösteriyorsa `cards` prop'unu kullan, bileşeni değiştirme.

- [ ] **Adım 6: Lint ve derle**

```bash
cd frontend && yarn lint && yarn build
```

- [ ] **Adım 7: Dört sayfayı da doğrula**

- `/solar-systems/30000142?tab=killmails`: tablo, sayfalama ve dört kart eskisi
  gibi.
- 7. sayfaya git, `Overview` sekmesine geç, `Killmails`'e dön: **1. sayfadasın**
  ve URL'de `page=7` yok (P6).
- `/killmails`, `/alliances/<id>`, `/corporations/<id>`: sidebar'lar
  değişiklikten önceki halleriyle aynı görünüyor.

- [ ] **Adım 8: Commit**

```bash
git add frontend/src/components frontend/src/app
git commit -m "refactor: extract TopEntitySidebar and the Killmails tab

The four-card 'top entities in the last 7 days' sidebar was copied across four
pages with its mapping logic rewritten each time. One component now owns the
queries and the mapping; a cards prop covers the places that show fewer than
four.

The solar system detail page drops from 572 lines to a shell."
```

---

## Faz D — Tam ingest ve son doğrulama

### Görev 22: Evren genelinde backfill ve kabul kontrolleri

**Dosyalar:**
- Değişiklik yok. Bu görev kod değil, çalıştırma ve doğrulama.

**Arayüzler:**
- Tüketir: Görev 1–21'in tamamı.
- Üretir: Doldurulmuş `stargates`, `stars`, `planets`, `moons`,
  `asteroid_belts`, `stations` tabloları ve kabul kanıtları.

Bu noktaya kadar yalnızca üç test sistemi işlendi. Şimdi hattın tamamı ~8 bin
sistem için çalıştırılıyor.

- [ ] **Adım 1: Adım 1 + 2 — kök tarama ve topoloji**

Bir terminalde:

```bash
cd backend && yarn worker:solar-systems
```

Başka bir terminalde:

```bash
cd backend && yarn queue:solar-systems
```

Beklenen: ~8.000 mesaj kuyruğa girer; worker ~13 dakikada bitirir ve
tamamlanma özetini basar. `Skipped` sayacı **0** olmalı — varlık kontrolü
kaldırıldı.

- [ ] **Adım 2: Topolojinin yazıldığını doğrula**

```sql
SELECT 'systems' t, COUNT(*) FROM solar_systems
UNION ALL SELECT 'stargates', COUNT(*) FROM stargates
UNION ALL SELECT 'stars', COUNT(*) FROM stars
UNION ALL SELECT 'planets', COUNT(*) FROM planets
UNION ALL SELECT 'moons', COUNT(*) FROM moons
UNION ALL SELECT 'asteroid_belts', COUNT(*) FROM asteroid_belts
UNION ALL SELECT 'stations', COUNT(*) FROM stations;
```

Bu, kümelerin gerçek büyüklüğünün ilk kez öğrenildiği yer. Sayıları not al:
Adım 4'ün ne kadar süreceğini bunlar belirliyor (satır sayısı × 100 ms).

`security_class` ve `star_id`'nin de dolduğunu doğrula:

```sql
SELECT COUNT(*) FILTER (WHERE star_id IS NULL) AS no_star,
       COUNT(*) FILTER (WHERE security_class IS NULL) AS no_sec_class
FROM solar_systems;
```

`no_sec_class` sıfırdan büyük olacak ve bu **doğru** — wormhole sistemlerinde
`security_class` yok (Thera dahil). `no_star` da küçük bir sayı olabilir.

- [ ] **Adım 3: Ebeveyn bağı bütünlüğü**

```sql
SELECT COUNT(*) FROM moons WHERE planet_id IS NULL;
SELECT COUNT(*) FROM asteroid_belts WHERE planet_id IS NULL;
```

Beklenen: ikisi de **0**. Kolonlar `NOT NULL` olduğu için aslında imkânsız; bu
sorgu migration'ın gerçekten `NOT NULL` uyguladığının kontrolü.

```sql
SELECT COUNT(*) FROM moons m
LEFT JOIN planets p ON p.id = m.planet_id
WHERE p.id IS NULL;
```

Beklenen: **0** — öksüz ay yok.

- [ ] **Adım 4: Adım 3 — altı zenginleştirme çiftini sırayla çalıştır**

Her çift için: worker'ı bir terminalde başlat, kuyruk scriptini diğerinde
çalıştır, worker'ın tamamlanma özetini bas**masını bekle**, sonra sıradakine
geç. Sıra önemli — stargate'ler önce, aylar ve belt'ler en sonda.

```bash
cd backend
yarn queue:stargates      # ardından: yarn worker:stargates
yarn queue:stars          # ardından: yarn worker:stars
yarn queue:stations       # ardından: yarn worker:stations
yarn queue:planets        # ardından: yarn worker:planets
yarn queue:moons          # ardından: yarn worker:moons
yarn queue:asteroid-belts # ardından: yarn worker:asteroid-belts
```

Kesinti olursa kaldığın yerden devam et: kuyruk scriptleri `WHERE name IS NULL`
ile çalıştığı için yeniden çalıştırmak yalnızca eksikleri kuyruğa alır.

Bu adım saatler sürebilir. Sayfa isimsiz kayıtlarla çalışacak şekilde
tasarlandığı için ingest bitmeden de kullanılabilir.

- [ ] **Adım 5: Tamlık kontrolü**

```sql
SELECT 'stargates' t, COUNT(*) FROM stargates WHERE name IS NULL
UNION ALL SELECT 'stars', COUNT(*) FROM stars WHERE name IS NULL
UNION ALL SELECT 'planets', COUNT(*) FROM planets WHERE name IS NULL
UNION ALL SELECT 'moons', COUNT(*) FROM moons WHERE name IS NULL
UNION ALL SELECT 'asteroid_belts', COUNT(*) FROM asteroid_belts WHERE name IS NULL
UNION ALL SELECT 'stations', COUNT(*) FROM stations WHERE name IS NULL;
```

Beklenen: hepsi **0**. Sıfır olmayan satırlar ya 404 veren ölü ID'ler ya da
yarım kalmış bir worker demek; ilgili kuyruğu tekrar çalıştırıp sayının düşüp
düşmediğine bakarak ikisi ayırt edilir. Düşmüyorsa ölü ID'dir; worker log'unda
`not found (404)` satırı vardır.

- [ ] **Adım 6: Adjacency tamlığı ve simetrisi**

```sql
SELECT COUNT(*) FROM stargates WHERE destination_system_id IS NULL;
```

Beklenen: **0**. Bu alan yalnızca `worker-stargates` ile doluyor ve Adjacent
sekmesinin tek kaynağı.

```sql
SELECT a.solar_system_id AS from_system, a.destination_system_id AS to_system
FROM stargates a
WHERE NOT EXISTS (
  SELECT 1 FROM stargates b
  WHERE b.solar_system_id = a.destination_system_id
    AND b.destination_system_id = a.solar_system_id
)
LIMIT 20;
```

Beklenen: **hiç satır yok**. A sistemi B'yi komşu gösteriyorsa B de A'yı
göstermeli; tek yönlü bir kenar eksik ya da hatalı stargate ingest'i demektir.

- [ ] **Adım 7: İstatistik sorgusunun indeksi kullandığını doğrula**

```sql
EXPLAIN ANALYZE
SELECT COUNT(*), SUM(total_value)
FROM killmails
WHERE solar_system_id = 30000142
  AND killmail_time >= NOW() - INTERVAL '7 days';
```

Beklenen: planda `solar_system_id, killmail_time` bileşik indeksi. `Seq Scan`
görürsen Görev 1'in migration'ı üretimde uygulanmamıştır.

- [ ] **Adım 8: Dört sistemde uçtan uca kabul**

Her biri için altı sekmeyi de aç:

| Sistem | Beklenen |
|---|---|
| `30000142` Jita | Yüksek hacim; Structures 18 istasyon; Orbital Bodies'te hiç belt yok; Sovereignty boş; istatistik şeridi büyük sayılar |
| Sov tutulan bir null-sec sistemi | Sovereignty'de yapı + ADM + timer, aktif kampanya varsa listeleniyor; header'da `SOVEREIGNTY` çipi |
| `31000005` Thera | Adjacent "no stargates"; Structures **dört istasyon**; Orbital Bodies 14 gezegen, hiç ay/belt yok; Technical details'te security class `—` |
| Hiç killmail'i olmayan bir sistem | İstatistik şeridi sıfır gösteriyor (boş durum değil); grafik "No kill activity recorded in this window" |

- [ ] **Adım 9: Son derleme**

```bash
yarn workspace backend build
yarn workspace frontend lint
yarn workspace frontend build
```

Beklenen: üçü de hatasız.

```bash
cd backend && yarn codegen && cd ../frontend && yarn codegen && git status --short
```

Beklenen: codegen **beklenmedik diff üretmemeli**. `generated-schema.graphql`
ya da `generated/graphql.ts` değişiyorsa bir görevde codegen çalıştırılmayı
unutulmuş demektir; o diff'i commit'le.

- [ ] **Adım 10: `ecosystem.config.js`'in değişmediğini doğrula**

```bash
git diff main --stat -- ecosystem.config.js
```

Beklenen: **boş çıktı**. Bu hattın cron'u yok; repodaki diğer evren ve referans
ingest'leri (`queue:regions`, `queue:constellations`, `queue:types`,
`queue:categories`, `queue:dogma-*`) gibi elle çalıştırılıyor. `cron_restart`
taşıyan her mevcut girdi değişken veriye ait ve gök cisimleri sabit.

- [ ] **Adım 11: Commit (varsa)**

Bu görev normalde kod değiştirmez. Adım 9 codegen diff'i ürettiyse:

```bash
git add backend/src/generated-schema.graphql backend/src/generated-types.ts frontend/src/generated/graphql.ts
git commit -m "chore: refresh generated GraphQL artefacts"
```

---

## Self-Review Notları

Plan yazıldıktan sonra spec'e karşı yapılan kontrolün sonuçları.

**Spec kapsamı.** Spec'in her bölümünün karşılığı var: §7.2 → Görev 1; §7.3
Adım 1–2 → Görev 2; Adım 3 → Görev 3–8; Adım 4 → Görev 22 Adım 10; §7.4 →
Görev 9–14; §7.5 → Görev 16–21; §7.6 (P5/P6/P7/P8) → Görev 16 ve 21 ve Görev
15 Adım 1; §7.7 → Görev 15; §9 → her sekme görevindeki boş/hata durumu adımları;
§10 → Görev 22.

**Spec'te olup planda bilinçli olarak farklı olan iki şey:**

1. Altı worker ortak bir `celestial-worker.ts` kullanıyor (yukarıdaki "Spec'ten
   Sapan Tek Karar" bölümü).
2. Spec §7.4 `Star`'ın `solarSystem` alanına sahip olduğunu söylemiyordu ama
   diğer beş tipte olduğu için tutarlılık adına eklendi.

**Spec'te olup planın açıkça dışında bıraktığı:** yok.

**Planın spec'e eklediği ve spec'e geri yazılması gereken bir madde:** Görev 10
(GraphQL sorgu derinliği sınırı). Spec bunu "uygulamanın ilk adımında kontrol
edilecek" diye bırakmıştı; kontrol yapıldı ve repoda hiçbir sınır **yok**,
dolayısıyla plan `graphql-depth-limit` eklemeyi zorunlu bir görev haline
getirdi.

---

## Çalıştırma

**Plan tamamlandı ve `docs/superpowers/plans/2026-08-27-solar-systems-detail-improvements.md`
dosyasına kaydedildi. İki çalıştırma seçeneği var:**

**1. Subagent-Driven (önerilen)** — Her görev için taze bir subagent
gönderilir, görevler arasında inceleme yapılır, iterasyon hızlıdır.
`superpowers:subagent-driven-development` kullanılır.

**2. Inline Execution** — Görevler bu oturumda, kontrol noktalarıyla toplu
olarak yürütülür. `superpowers:executing-plans` kullanılır.

**Hangisi?**
