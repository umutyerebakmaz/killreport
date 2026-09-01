# Universe Topology Ingest — Kuyruk Zinciri Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** `worker-solar-systems`'in altı tabloya birden yazan tek transaction'ını
dağıtmak; her gök cismi tipini kendi kuyruğu, kendi worker'ı ve kendi tablosunun
tek sahibi hâline getirmek, bu arada iki veri bütünlüğü boşluğunu kapatmak.

**Mimari:** Sistem worker'ı yalnızca `solar_systems` satırını yazar ve elindeki
ID'leri dört kuyruğa basar. `worker-planets` zincirin ortasında durur: önce
`planets` satırını yazar, sonra ay ve kuşak mesajlarını basar, en son ESI ile
zenginleştirir. Ay ve kuşak mesajları ancak gezegen satırı yazıldıktan sonra
doğduğu için `planet_id` FK'sının sırası yapısal olarak garanti edilir. Yaprak
worker'lar tek yazımda kalır. Kaybolan mesaj `esi_topology_dlq`'ya düşer.

**Teknoloji:** TypeScript, `tsx`, amqplib (RabbitMQ), Prisma + PostgreSQL,
`esiRateLimiter`, `prismaWorker` (worker Prisma client'ı, 2 bağlantı).

**Spec:** [`../specs/2026-09-01-universe-topology-queue-chain-design.md`](../specs/2026-09-01-universe-topology-queue-chain-design.md)

## Global Constraints

Aşağıdakiler her görev için geçerlidir, görev metinlerinde tekrar edilmez.

- **Test koşucusu yok.** Repoda ne backend ne frontend'de test dosyası veya test
  runner var. Bu planda TDD adımı yerine her görevin sonunda somut bir doğrulama
  komutu vardır: `yarn workspace backend build` (`tsc --noEmit`), `psql` sorgusu,
  `workerStatus` GraphQL sorgusu veya worker'ın gerçek çalıştırılması. Test dosyası
  aramayın, yazmayın.
- **Veritabanı asla sıfırlanmaz.** `prisma migrate reset` ve `prisma migrate dev`
  (ve onun takma adı `yarn prisma:migrate`) yasak. Migration prosedürü CLAUDE.md'de
  yazılı: `prisma migrate diff` ile üret, çıktıdaki her `DROP TABLE`'ı elle sil,
  `migrate deploy` ile uygula. Beş tablo (`killmail_filters`,
  `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`,
  `refresh_log`) `prisma/schema/` altında yok ve drift görünür — onların
  `DROP`'ları çıktıdan silinmelidir.
- **Yarn, asla npm.**
- **Her `assertQueue` çağrısı `arguments: { 'x-max-priority': 10 }` taşır.**
  Eksikse `406 PRECONDITION_FAILED` alınır ve worker anında çıkar.
- **Her ESI çağrısı `esiRateLimiter` üzerinden gider.** Pratikte bu,
  `UniverseService` (`backend/src/services/universe/universe.service.ts`)
  kullanmak demektir; ham `axios` çağrısı yeni kodda yer almaz.
- **Prisma client seçimi:** worker ve queue script'lerinde `@services/prisma-worker`,
  resolver'larda `@services/prisma`. Bu plan resolver'a dokunmuyor, dolayısıyla her
  yerde `prismaWorker`.
- **Prisma alan adları snake_case, model adları singular PascalCase.** Model `id`
  alanı veritabanında `planet_id` / `moon_id` / `asteroid_belt_id` /
  `stargate_id` / `station_id` / `star_id` olarak `@map`'lidir; ham SQL ve `psql`
  mapped adı kullanmak zorunda.
- **`.env` düzenlenmez.** Gereken değişiklik kullanıcıya söylenir.
- **Commit mesajları İngilizce, Claude attribution yok.**
- **GraphQL şeması değişmiyor**, dolayısıyla hiçbir görevde codegen gerekmez.

## Dosya yapısı

**Yeni:**

| Dosya | Sorumluluk |
|---|---|
| `backend/src/queues/topology-messages.ts` | Mesaj tipleri, kuyruk adları, publish/parse yardımcıları, yeniden deneme + DLQ mantığı. Zincirdeki yedi worker ve altı onarım scripti bunu paylaşır. |
| `backend/src/workers/doctor-topology.ts` | Bütünlük raporu: öksüz cross-pipeline referanslar, `name IS NULL` sayıları, DLQ derinliği. |
| `backend/prisma/migrations/<ts>_universe_topology_integrity/migration.sql` | Bileşik FK'ler, `UNIQUE`, indeks değiş tokuşu. |
| `backend/docs/workers/universe-topology-chain.md` | Yeni akışın dokümantasyonu. |

**Değişen:**

| Dosya | Değişiklik |
|---|---|
| `backend/src/services/rabbitmq.ts:14-36` | `ALL_QUEUES` + yedi kuyruk |
| `backend/src/services/rabbitmq.ts` (`getAllQueueStats` içindeki ikinci liste) | Aynı yedi kuyruk — `workerStatus`'un okuduğu liste burası |
| `backend/src/workers/worker-solar-systems.ts` | Transaction silinir; tek upsert + dört publish |
| `backend/src/workers/worker-planets.ts` | Zincir düğümü: yaz → publish → zenginleştir |
| `backend/src/workers/worker-{moons,asteroid-belts}.ts` | JSON mesaj, `upsert`, DLQ deseni |
| `backend/src/workers/worker-{stars,stargates,stations}.ts` | JSON mesaj, `upsert`, DLQ deseni |
| `backend/src/queues/queue-{stars,planets,moons,asteroid-belts,stargates,stations}.ts` | Onarım aracı; JSON mesaj basar |
| `backend/prisma/schema/{planet,moon,asteroidBelt,stargate,station,solarSystem}.prisma` | Bileşik FK, `UNIQUE`, indeksler, ilişki adları |
| `backend/package.json` | `doctor:topology` script'i |

**Değişmeyen:** `backend/src/queues/queue-solar-systems.ts` (kök tarama, düz `Int`
mesaj), GraphQL şeması, resolver'lar, `dataloaders.ts`, frontend.

## Görev sırası ve bağımlılıklar

```text
Görev 1 (mesaj sözleşmesi + kuyruk kaydı)
   ├──> Görev 2 (migration öncesi veri kontrolü)  ──> Görev 3 (şema + migration)
   └──> Görev 4 (worker-solar-systems)
           └──> Görev 5 (worker-planets, zincir düğümü)
                   ├──> Görev 6 (worker-moons, worker-asteroid-belts)
                   └──> Görev 7 (worker-stars, -stargates, -stations)
                           └──> Görev 8 (onarım queue script'leri)
                                   └──> Görev 9 (doctor:topology)
                                           └──> Görev 10 (uçtan uca tur + doküman)
```

Görev 3, Görev 2 sıfır dönmeden başlamaz. Görev 7'deki `stargates` FK yeniden
deneme davranışı Görev 3'ün migration'ına bağlıdır; Görev 3 tamamlanmadan Görev 7
çalıştırılarak doğrulanamaz (kod yazılabilir).

---

### Görev 1: Mesaj sözleşmesi, kuyruk kaydı ve DLQ yardımcıları

**Dosyalar:**
- Oluştur: `backend/src/queues/topology-messages.ts`
- Değiştir: `backend/src/services/rabbitmq.ts:14-36` (`ALL_QUEUES`) ve
  `getAllQueueStats()` içindeki ikinci kuyruk listesi

**Arayüzler:**
- Kullanır: yok (ilk görev).
- Üretir: `TOPOLOGY_QUEUES`, `Envelope`, `StarMessage`, `StargateMessage`,
  `StationMessage`, `PlanetMessage`, `MoonMessage`, `AsteroidBeltMessage`,
  `envelope(source)`, `publishTopology(channel, queue, payload)`,
  `parseTopologyMessage<T>(msg)`, `assertTopologyQueue(channel, queue)`,
  `handleWorkerError(...)`. Görev 4-9'un tamamı bu isimleri kullanır.

> **Not (spec boşluğu, kasıtlı olarak dolduruldu):** Spec yalnızca `ALL_QUEUES`'dan
> söz ediyor. `workerStatus` sorgusunun okuduğu liste aslında `getAllQueueStats()`
> fonksiyonunun içindeki ikinci, ayrı kodlanmış dizidir. Yedi kuyruk her iki
> listeye de eklenmezse `ensureAllQueuesExist()` kuyrukları açar ama `workerStatus`
> yine raporlamaz — spec'in "derinlikleri raporlar" hedefi karşılanmaz.

- [ ] **Adım 1: `topology-messages.ts` dosyasını oluştur**

```ts
/**
 * Universe Topology Message Contracts
 *
 * The celestial chain (solar system -> planet -> moon / asteroid belt, plus the
 * star, stargate and station leaves) carries JSON messages rather than the plain
 * integers the old enrichment queues used. The reason is structural: a leaf
 * worker now creates its own row, so it needs the parent IDs that only the
 * system response holds.
 *
 * `esi_solar_systems_queue` is deliberately NOT in here. It is a root scan fed by
 * queue-solar-systems.ts and stays a plain integer.
 */

import type amqp from 'amqplib';

export const TOPOLOGY_QUEUES = {
  stars: 'esi_stars_queue',
  stargates: 'esi_stargates_queue',
  stations: 'esi_stations_queue',
  planets: 'esi_planets_queue',
  moons: 'esi_moons_queue',
  asteroidBelts: 'esi_asteroid_belts_queue',
  dlq: 'esi_topology_dlq',
} as const;

export type TopologyQueueName = (typeof TOPOLOGY_QUEUES)[keyof typeof TOPOLOGY_QUEUES];

/** A message is dead-lettered rather than retried once attempts exceeds this. */
export const MAX_ATTEMPTS = 5;

export interface Envelope {
  queuedAt: string; // ISO 8601
  source: string; // 'worker-solar-systems' | 'queue-planets' | ...
  attempts?: number; // absent means 0
}

export interface StarMessage extends Envelope {
  starId: number;
  solarSystemId: number;
}

export interface StargateMessage extends Envelope {
  stargateId: number;
  solarSystemId: number;
}

export interface StationMessage extends Envelope {
  stationId: number;
  solarSystemId: number;
}

export interface PlanetMessage extends Envelope {
  planetId: number;
  solarSystemId: number;
  orbitIndex: number;
  /** Carried for the chain only. Never written to a table. */
  moonIds: number[];
  /** Carried for the chain only. Never written to a table. */
  asteroidBeltIds: number[];
}

export interface MoonMessage extends Envelope {
  moonId: number;
  solarSystemId: number;
  planetId: number;
  orbitIndex: number;
}

export interface AsteroidBeltMessage extends Envelope {
  beltId: number;
  solarSystemId: number;
  planetId: number;
  orbitIndex: number;
}

export type TopologyMessage =
  | StarMessage
  | StargateMessage
  | StationMessage
  | PlanetMessage
  | MoonMessage
  | AsteroidBeltMessage;

export function envelope(source: string): Envelope {
  return { queuedAt: new Date().toISOString(), source };
}

/**
 * x-max-priority is mandatory: server.ts's ensureAllQueuesExist() declares every
 * queue with it, and omitting it fails with 406 PRECONDITION_FAILED.
 */
export async function assertTopologyQueue(
  channel: amqp.Channel,
  queueName: string
): Promise<void> {
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: { 'x-max-priority': 10 },
  });
}

export function publishTopology(
  channel: amqp.Channel,
  queueName: string,
  payload: TopologyMessage
): void {
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

/** Returns null for malformed content; the caller acks and counts an error. */
export function parseTopologyMessage<T extends Envelope>(
  msg: amqp.ConsumeMessage
): T | null {
  try {
    const parsed = JSON.parse(msg.content.toString());
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Prisma throws P2003 when a foreign key constraint fails. */
export function isForeignKeyViolation(error: any): boolean {
  return error?.code === 'P2003';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The shared failure path for every topology worker.
 *
 * The old workers called nack(msg, false, false) on an unexpected error, which
 * discards the message outright. That was survivable while worker-solar-systems
 * had already written a skeleton row. In the chain design the row does not exist
 * yet, so a discarded message is a celestial object that never gets created.
 *
 * Returns nothing; it always settles the message (ack or nack) itself.
 */
export async function handleWorkerError(
  channel: amqp.Channel,
  msg: amqp.ConsumeMessage,
  payload: TopologyMessage,
  queueName: string,
  error: any,
  logger: { warn: (m: string) => void; error: (m: string, e?: any) => void }
): Promise<void> {
  // 420: ESI error limited. Keep the existing behaviour - wait a minute, requeue
  // untouched, do not burn an attempt.
  if (error?.response?.status === 420) {
    logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
    await sleep(60000);
    channel.nack(msg, false, true);
    return;
  }

  const attempts = (payload.attempts ?? 0) + 1;

  if (attempts > MAX_ATTEMPTS) {
    logger.error(
      `☠️  ${queueName}: giving up after ${MAX_ATTEMPTS} attempts, dead-lettering`,
      error?.message
    );
    // The DLQ is written by an explicit publish, NOT x-dead-letter-exchange.
    // Changing a queue's arguments would collide with the x-max-priority: 10
    // declaration ensureAllQueuesExist() already made and produce the
    // 406 PRECONDITION_FAILED that took down three workers in PR #135.
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.dlq);
    publishTopology(channel, TOPOLOGY_QUEUES.dlq, {
      ...payload,
      attempts,
      source: `${payload.source} -> ${queueName}`,
    });
    channel.ack(msg);
    return;
  }

  if (isForeignKeyViolation(error)) {
    logger.warn(
      `↩️  ${queueName}: parent row not written yet (P2003), retry ${attempts}/${MAX_ATTEMPTS}`
    );
  } else {
    logger.error(
      `❌ ${queueName}: retry ${attempts}/${MAX_ATTEMPTS} - ${error?.message}`,
      error?.message
    );
  }

  // Republish rather than nack(requeue): requeueing cannot carry the incremented
  // attempts counter, so the message would retry forever.
  await assertTopologyQueue(channel, queueName);
  publishTopology(channel, queueName, { ...payload, attempts });
  channel.ack(msg);
}
```

- [ ] **Adım 2: `ALL_QUEUES`'a yedi kuyruğu ekle**

`backend/src/services/rabbitmq.ts` içinde `ALL_QUEUES` dizisinde
`'esi_solar_systems_queue',` satırının hemen ardına:

```ts
  'esi_stars_queue',
  'esi_planets_queue',
  'esi_moons_queue',
  'esi_asteroid_belts_queue',
  'esi_stargates_queue',
  'esi_stations_queue',
  'esi_topology_dlq',
```

- [ ] **Adım 3: `getAllQueueStats()` içindeki listeye aynı yedi kuyruğu ekle**

Aynı dosyada, `getAllQueueStats()` fonksiyonunun gövdesindeki `const queues = [`
dizisinde de `'esi_solar_systems_queue',` satırının ardına birebir aynı yedi satır
eklenir. Bu, `workerStatus` sorgusunun okuduğu listedir; `ALL_QUEUES`'a eklemek
tek başına yeterli değildir.

- [ ] **Adım 4: Derlemenin geçtiğini doğrula**

```bash
yarn workspace backend build
```

Beklenen: hata yok. (`topology-messages.ts` henüz hiçbir yerden import edilmiyor;
`tsc --noEmit` yine de dosyayı tip kontrolünden geçirir.)

- [ ] **Adım 5: Kuyrukların açıldığını doğrula**

Backend'i çalıştır ve `workerStatus` sorgusunu at:

```bash
yarn dev:backend   # başka bir terminalde
```

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ workerStatus { queues { name messageCount consumerCount } } }"}' \
  | grep -o 'esi_topology_dlq'
```

Beklenen: `esi_topology_dlq` çıktıda görünür. Yedi kuyruğun hepsi listelenmelidir.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/queues/topology-messages.ts backend/src/services/rabbitmq.ts
git commit -m "feat(topology): add celestial queue message contracts and register the queues"
```

---

### Görev 2: Migration öncesi zorunlu veri kontrolü

**Dosyalar:** hiçbiri (yalnızca doğrulama; çıktı Görev 3'ün girdisi).

**Arayüzler:**
- Kullanır: yok.
- Üretir: üç sayımın sıfır olduğu kanıtı ve altı tablonun satır sayısı taban
  çizgisi. Görev 3 bunlara dayanır.

> **Bu planın bilinen tek koşullu adımı.** Üç sorgudan biri sıfır dönmezse Görev 3
> başlamaz; durumu kullanıcıya bildirip düzeltmenin yönünü sorun. Spec bunu
> kasten kestirmiyor, çünkü doğru düzeltme veriye bakmadan bilinemez.

- [ ] **Adım 1: Bağlantı dizesini oku ve satır sayılarını kaydet**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT
  (SELECT COUNT(*) FROM solar_systems)   AS solar_systems,
  (SELECT COUNT(*) FROM stars)           AS stars,
  (SELECT COUNT(*) FROM planets)         AS planets,
  (SELECT COUNT(*) FROM moons)           AS moons,
  (SELECT COUNT(*) FROM asteroid_belts)  AS asteroid_belts,
  (SELECT COUNT(*) FROM stargates)       AS stargates,
  (SELECT COUNT(*) FROM stations)        AS stations;"
```

Çıktıyı olduğu gibi not edin. Görev 3'ün son adımı bu tabloyla karşılaştırılacak.

- [ ] **Adım 2: CLAUDE.md'nin beş korumasız tablosunun sayımını da kaydet**

```bash
psql "$DB" -c "SELECT
  (SELECT COUNT(*) FROM killmail_filters)        AS killmail_filters,
  (SELECT COUNT(*) FROM character_kill_stats)    AS character_kill_stats,
  (SELECT COUNT(*) FROM corporation_kill_stats)  AS corporation_kill_stats,
  (SELECT COUNT(*) FROM alliance_kill_stats)     AS alliance_kill_stats,
  (SELECT COUNT(*) FROM refresh_log)             AS refresh_log;"
```

Bu tablolar `prisma/schema/` altında olmadığı için `migrate diff` onları drift
sayıp `DROP TABLE` üretecek. Sayımlar, migration sonrası hiçbirinin
kaybolmadığını kanıtlamak için.

- [ ] **Adım 3: Üç bütünlük sorgusunu çalıştır**

```bash
psql "$DB" -c "
SELECT 'moon_system_mismatch' AS check, COUNT(*) FROM moons m
  JOIN planets p ON p.planet_id = m.planet_id
 WHERE m.solar_system_id <> p.solar_system_id
UNION ALL
SELECT 'belt_system_mismatch', COUNT(*) FROM asteroid_belts b
  JOIN planets p ON p.planet_id = b.planet_id
 WHERE b.solar_system_id <> p.solar_system_id
UNION ALL
SELECT 'dangling_stargate_destination', COUNT(*) FROM stargates s
  LEFT JOIN solar_systems ss ON ss.system_id = s.destination_system_id
 WHERE s.destination_system_id IS NOT NULL AND ss.system_id IS NULL;"
```

Beklenen: üç satırın `count` değeri de **0**.

> Not: spec bu sorguları `ss.id` ile yazmıştı. `SolarSystem.id` veritabanında
> `system_id` olarak `@map`'lidir, dolayısıyla ham SQL'de `ss.system_id`
> kullanılmalıdır — `ss.id` `column "id" does not exist` hatası verir. Yukarıdaki
> sürüm düzeltilmiştir.

- [ ] **Adım 4: Öksüz gezegen referansı olmadığını doğrula**

Bileşik FK, `moons.planet_id`'nin `planets`'ta karşılığı olmasını da zorunlu kılar.
Mevcut tekil FK bunu zaten garanti ediyor olmalı, ama migration'ı durdurmadan önce
teyit edilir:

```bash
psql "$DB" -c "
SELECT 'orphan_moon_planet' AS check, COUNT(*) FROM moons m
  LEFT JOIN planets p ON p.planet_id = m.planet_id WHERE p.planet_id IS NULL
UNION ALL
SELECT 'orphan_belt_planet', COUNT(*) FROM asteroid_belts b
  LEFT JOIN planets p ON p.planet_id = b.planet_id WHERE p.planet_id IS NULL;"
```

Beklenen: iki satır da **0**.

- [ ] **Adım 5: Kapı kararı**

Bütün sayımlar sıfırsa Görev 3'e geçin. Değilse **durun**: bulguları
(hangi kontrol, kaç satır, örnek 10 satır) kullanıcıya raporlayın ve düzeltmenin
yönünü sorun. Kendi başınıza `UPDATE` veya `DELETE` çalıştırmayın.

---

### Görev 3: Şema bütünlüğü ve indeksler — tek migration

**Dosyalar:**
- Değiştir: `backend/prisma/schema/planet.prisma`
- Değiştir: `backend/prisma/schema/moon.prisma`
- Değiştir: `backend/prisma/schema/asteroidBelt.prisma`
- Değiştir: `backend/prisma/schema/stargate.prisma`
- Değiştir: `backend/prisma/schema/station.prisma`
- Değiştir: `backend/prisma/schema/solarSystem.prisma`
- Oluştur: `backend/prisma/migrations/<UTC timestamp>_universe_topology_integrity/migration.sql`

**Arayüzler:**
- Kullanır: Görev 2'nin sıfır sonuçları ve satır sayısı taban çizgisi.
- Üretir: `planets` üzerinde `UNIQUE (planet_id, solar_system_id)`; `moons` ve
  `asteroid_belts` üzerinde bileşik FK; `stargates.destination_system_id`
  üzerinde `ON DELETE SET NULL` FK; yenilenmiş indeksler. Görev 7'nin `stargates`
  yeniden deneme yolu bu FK'ye dayanır.

- [ ] **Adım 1: `planet.prisma` — bileşik `UNIQUE` ve indeks değişimi**

`@@index([solar_system_id])` satırını silin, yerine:

```prisma
  /// Bileşik FK'nin hedefi: moons ve asteroid_belts (planet_id, solar_system_id)
  /// ikilisiyle buraya bağlanır. Aynı zamanda indeks olarak da hizmet eder.
  @@unique([id, solar_system_id])
  /// planetsBySystem: WHERE solar_system_id IN (...) ORDER BY orbit_index, id.
  /// counts sayımı da bu indeksin soldan önekiyle karşılanır.
  @@index([solar_system_id, orbit_index, id])
```

- [ ] **Adım 2: `moon.prisma` — bileşik FK ve indeks değişimi**

`planet` ilişkisini ve `@@index([planet_id])` satırını değiştirin:

```prisma
  solar_system SolarSystem @relation(fields: [solar_system_id], references: [id], onDelete: Cascade)
  /// Bileşik: bir ayın sistemi, gezegeninin sistemiyle aynı olmak zorunda.
  /// Tekil planet_id FK'si bunu zorlamıyordu.
  planet       Planet      @relation(fields: [planet_id, solar_system_id],
                                     references: [id, solar_system_id],
                                     onDelete: Cascade)

  /// counts sayımı; aşağıdaki bileşiğin soldan öneki değil, korunur.
  @@index([solar_system_id])
  /// moonsByPlanet: WHERE planet_id IN (...) ORDER BY orbit_index, id.
  @@index([planet_id, orbit_index, id])
```

- [ ] **Adım 3: `asteroidBelt.prisma` — birebir aynısı**

```prisma
  solar_system SolarSystem @relation(fields: [solar_system_id], references: [id], onDelete: Cascade)
  planet       Planet      @relation(fields: [planet_id, solar_system_id],
                                     references: [id, solar_system_id],
                                     onDelete: Cascade)

  @@index([solar_system_id])
  @@index([planet_id, orbit_index, id])
```

- [ ] **Adım 4: `stargate.prisma` — hedef FK'si ve indeks değişimi**

`stargates` ile `solar_systems` arasında artık **iki** ilişki olacağı için ikisine
de ad verilmesi zorunludur; adsız bırakılırsa `prisma validate` belirsizlik
hatası verir.

```prisma
  solar_system       SolarSystem  @relation("StargateSystem",
                                            fields: [solar_system_id],
                                            references: [id], onDelete: Cascade)
  /// ON DELETE SET NULL, Cascade değil: bir sistem silindiğinde ona bakan BAŞKA
  /// sistemlerdeki geçitler silinmemeli, yalnızca hedefleri boşalmalı.
  destination_system SolarSystem? @relation("StargateDestination",
                                            fields: [destination_system_id],
                                            references: [id], onDelete: SetNull)

  /// stargatesBySystem: WHERE solar_system_id IN (...) ORDER BY id.
  @@index([solar_system_id, id])
  /// Bugün hiçbir sorgu buradan filtrelemiyor, ama yeni SET NULL FK'si gerekli
  /// kılıyor: indekssiz bir sistem silme bu tabloda tam tarama yapar.
  @@index([destination_system_id])
```

- [ ] **Adım 5: `solarSystem.prisma` — karşı ilişkiler**

`stargates Stargate[]` satırını, adlandırılmış iki ilişkiyle değiştirin:

```prisma
  stargates             Stargate[] @relation("StargateSystem")
  inbound_stargates     Stargate[] @relation("StargateDestination")
```

- [ ] **Adım 6: `station.prisma` — indeks değişimi**

`@@index([solar_system_id])` yerine:

```prisma
  /// stationsBySystem: WHERE solar_system_id IN (...) ORDER BY id. Sayım da aynı
  /// indeksten karşılanır.
  @@index([solar_system_id, id])
```

`stars` modeline dokunulmaz: `solar_system_id` zaten `@unique` ve `starBySystem`
onu kullanıyor.

- [ ] **Adım 7: Şemayı doğrula**

```bash
cd backend && npx prisma validate
```

Beklenen: `The schema at prisma/schema is valid 🚀`.

Hata alırsanız en olası iki sebep: (a) `Stargate` ile `SolarSystem` arasındaki iki
ilişkiden birine ad verilmemiş; (b) `Moon.solar_system_id` aynı anda hem
`SolarSystem` hem `Planet` ilişkisinin alanı olduğu için referential action
uyarısı. (b) PostgreSQL'de geçerlidir; ad çakışması değilse mesajın istediği
`@relation` adını ekleyin, ilişkinin şeklini değiştirmeyin.

- [ ] **Adım 8: DDL'i üret**

```bash
cd backend
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/diff.sql
grep -n "^DROP" /tmp/diff.sql
```

Beklenen `grep` çıktısı: `killmail_filters`, `character_kill_stats`,
`corporation_kill_stats`, `alliance_kill_stats`, `refresh_log` için
`DROP TABLE` satırları — bunlar Görev 2 Adım 2'de sayımı alınan, şemada kasten
bulunmayan tablolardır ve **silinecektir**.

- [ ] **Adım 9: Migration dosyasını yaz**

```bash
cd backend
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_universe_topology_integrity
```

`/tmp/diff.sql` içeriğini bu dizindeki `migration.sql`'e kopyalayın ve **beş
tabloya ait her `DROP TABLE` satırını elle silin.** Kalması gereken içerik:

```sql
-- Composite target for the moon / asteroid belt foreign keys
CREATE UNIQUE INDEX "planets_planet_id_solar_system_id_key"
  ON "planets"("planet_id", "solar_system_id");

-- Moons: a moon's system must match its planet's system
ALTER TABLE "moons" DROP CONSTRAINT "moons_planet_id_fkey";
ALTER TABLE "moons" ADD CONSTRAINT "moons_planet_id_solar_system_id_fkey"
  FOREIGN KEY ("planet_id", "solar_system_id")
  REFERENCES "planets"("planet_id", "solar_system_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Asteroid belts: identical rule
ALTER TABLE "asteroid_belts" DROP CONSTRAINT "asteroid_belts_planet_id_fkey";
ALTER TABLE "asteroid_belts" ADD CONSTRAINT "asteroid_belts_planet_id_solar_system_id_fkey"
  FOREIGN KEY ("planet_id", "solar_system_id")
  REFERENCES "planets"("planet_id", "solar_system_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Stargate destinations: SET NULL, so deleting a system does not delete the
-- gates in other systems that point at it.
ALTER TABLE "stargates" ADD CONSTRAINT "stargates_destination_system_id_fkey"
  FOREIGN KEY ("destination_system_id") REFERENCES "solar_systems"("system_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index swap: single-column indexes replaced by composites that cover both the
-- filter and the sort of the DataLoader queries.
DROP INDEX "planets_solar_system_id_idx";
CREATE INDEX "planets_solar_system_id_orbit_index_planet_id_idx"
  ON "planets"("solar_system_id", "orbit_index", "planet_id");

DROP INDEX "moons_planet_id_idx";
CREATE INDEX "moons_planet_id_orbit_index_moon_id_idx"
  ON "moons"("planet_id", "orbit_index", "moon_id");

DROP INDEX "asteroid_belts_planet_id_idx";
CREATE INDEX "asteroid_belts_planet_id_orbit_index_asteroid_belt_id_idx"
  ON "asteroid_belts"("planet_id", "orbit_index", "asteroid_belt_id");

DROP INDEX "stations_solar_system_id_idx";
CREATE INDEX "stations_solar_system_id_station_id_idx"
  ON "stations"("solar_system_id", "station_id");

DROP INDEX "stargates_solar_system_id_idx";
CREATE INDEX "stargates_solar_system_id_stargate_id_idx"
  ON "stargates"("solar_system_id", "stargate_id");
```

`DROP INDEX` ve `DROP CONSTRAINT` satırları kalır — bunlar veri kaybetmez.
Silinecek olan yalnızca `DROP TABLE`'lardır. Üretilen adlar Prisma sürümüne göre
değişebilir; `/tmp/diff.sql`'in verdiği adları kullanın, yukarıdakiler beklenen
şekli gösterir.

- [ ] **Adım 10: Hiçbir çalıştırılabilir `DROP TABLE` kalmadığını doğrula**

```bash
cd backend
grep -n "DROP TABLE" prisma/migrations/*_universe_topology_integrity/migration.sql
```

Beklenen: **boş çıktı.**

- [ ] **Adım 11: Uygula**

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` bekleyen migration'ları uygular ve hiçbir şey düşürmez.
`migrate dev` çalıştırmayın.

- [ ] **Adım 12: Satır sayılarını yeniden karşılaştır**

Görev 2 Adım 1 ve Adım 2'deki iki sorguyu tekrar çalıştırın. **Hiçbir sayı
düşmemiş olmalı.** Düştüyse durun ve kullanıcıya bildirin.

- [ ] **Adım 13: Derleme**

```bash
yarn workspace backend build
```

Beklenen: hata yok. (`prisma generate` sonrası `Stargate` tipine
`destination_system` alanı eklendi; mevcut kod bunu kullanmıyor, kırılma
beklenmiyor.)

- [ ] **Adım 14: Commit**

```bash
git add backend/prisma/schema backend/prisma/migrations
git commit -m "feat(topology): enforce moon/belt system consistency and index for the real queries"
```

---

### Görev 4: `worker-solar-systems` — tek tablo, dört publish

**Dosyalar:**
- Değiştir: `backend/src/workers/worker-solar-systems.ts` (tam yeniden yazım)

**Arayüzler:**
- Kullanır: Görev 1'den `TOPOLOGY_QUEUES`, `envelope`, `publishTopology`,
  `assertTopologyQueue`; mevcut `SolarSystemService.getSystemInfo(systemId)`
  (`backend/src/services/solar-system/solar-system.service.ts:26`, zaten
  `esiRateLimiter` üzerinden gidiyor).
- Üretir: `esi_stars_queue`, `esi_stargates_queue`, `esi_stations_queue` ve
  `esi_planets_queue` üzerinde Görev 1'de tanımlı mesajlar. Görev 5 ve 7 bunları
  tüketir.

Bu worker'ın tükettiği `esi_solar_systems_queue` mesajı **düz `Int` olarak kalır**;
kök tarama script'i `queue-solar-systems.ts` değişmez.

- [ ] **Adım 1: Dosyayı tamamen değiştir**

`backend/src/workers/worker-solar-systems.ts` yeni içeriği:

```ts
/**
 * Solar System Worker
 *
 * Writes exactly one table - solar_systems - and publishes the celestial IDs the
 * same ESI response already contains onto their own queues.
 *
 * This is a root scanner: it never skips a message. The "already in the
 * database?" filter belongs to the repair queues, exactly as queue-alliances
 * (unfiltered) and queue-alliance-corporation-characters (filtered) are split.
 *
 * The planet message carries moonIds and asteroidBeltIds because the
 * planet -> moon / belt nesting exists ONLY in this response: neither
 * /universe/moons/{id}/ nor /universe/asteroid_belts/{id}/ returns planet_id. If
 * the chain does not carry it, it is unrecoverable.
 *
 * Usage: yarn worker:solar-systems
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { SolarSystemService } from '@services/solar-system/solar-system.service';
import {
  TOPOLOGY_QUEUES,
  assertTopologyQueue,
  envelope,
  publishTopology,
} from '../queues/topology-messages';
import type amqp from 'amqplib';

const QUEUE_NAME = 'esi_solar_systems_queue';
const SOURCE = 'worker-solar-systems';
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. The old prefetch(1) plus a manual 100ms sleep existed only
// because of the six-table transaction this worker no longer runs.
const PREFETCH_COUNT = 25;

interface EsiPlanet {
  planet_id: number;
  moons?: number[];
  asteroid_belts?: number[];
}

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function processSolarSystem(
  channel: amqp.Channel,
  systemId: number
): Promise<void> {
  const data = await SolarSystemService.getSystemInfo(systemId);

  // Every one of these keys can be absent from the response, not merely empty:
  // 4-HWWF has no `stations`, Thera has no `stargates` and no `security_class`,
  // and Jita has planets with no `asteroid_belts`.
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

  // One row, one table, no transaction. Every other table in the topology has a
  // single writer of its own now.
  await prismaWorker.solarSystem.upsert({
    where: { id: systemId },
    update: systemRow,
    create: { id: systemId, ...systemRow },
  });

  if (starId !== null) {
    publishTopology(channel, TOPOLOGY_QUEUES.stars, {
      ...envelope(SOURCE),
      starId,
      solarSystemId: systemId,
    });
  }

  for (const stargateId of stargateIds) {
    publishTopology(channel, TOPOLOGY_QUEUES.stargates, {
      ...envelope(SOURCE),
      stargateId,
      solarSystemId: systemId,
    });
  }

  for (const stationId of stationIds) {
    publishTopology(channel, TOPOLOGY_QUEUES.stations, {
      ...envelope(SOURCE),
      stationId,
      solarSystemId: systemId,
    });
  }

  for (let p = 0; p < planets.length; p++) {
    const planet = planets[p];
    publishTopology(channel, TOPOLOGY_QUEUES.planets, {
      ...envelope(SOURCE),
      planetId: planet.planet_id,
      solarSystemId: systemId,
      orbitIndex: p + 1,
      moonIds: planet.moons ?? [],
      asteroidBeltIds: planet.asteroid_belts ?? [],
    });
  }

  const moonCount = planets.reduce((n, p) => n + (p.moons?.length ?? 0), 0);
  const beltCount = planets.reduce((n, p) => n + (p.asteroid_belts?.length ?? 0), 0);
  logger.debug(
    `✅ Solar system ${systemId} - ${data.name} ` +
      `(${stargateIds.length} gates, ${stationIds.length} stations, ` +
      `${planets.length} planets -> ${moonCount} moons, ${beltCount} belts queued)`
  );
}

async function startWorker() {
  logger.info('🚀 Solar System Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await assertTopologyQueue(channel, QUEUE_NAME);
    // Declare the downstream queues too, so a fresh environment does not lose
    // the first publish of a run.
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.stars);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.stargates);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.stations);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.planets);

    channel.prefetch(PREFETCH_COUNT);

    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    logger.info(`📊 Queue status: ${queueInfo.messageCount} messages waiting\n`);

    let processed = 0;
    let errors = 0;
    let lastMessageTime = Date.now();
    const startTime = Date.now();

    // With PREFETCH_COUNT > 1, checkQueue() races the in-flight messages, so
    // completion is detected by the queue going quiet instead.
    emptyCheckInterval = setInterval(() => {
      if (Date.now() - lastMessageTime > 5000 && processed + errors > 0) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info('\n' + '='.repeat(60));
        logger.info('🎉 ALL TASKS COMPLETED!');
        logger.info(`✅ Processed: ${processed}   ❌ Errors: ${errors}   ⏱️  ${duration}s`);
        logger.info('='.repeat(60));
        logger.info('\n💡 The system queue is empty, but the chain is not done ');
        logger.info('   until stars, stargates, stations, planets, moons and ');
        logger.info('   asteroid belts are all empty too.\n');
        processed = 0;
        errors = 0;
      }
    }, 5000);

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;
        lastMessageTime = Date.now();

        const systemId = parseInt(msg.content.toString());

        if (isNaN(systemId)) {
          logger.error('❌ Invalid solar system ID:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        try {
          await processSolarSystem(channel, systemId);
          processed++;
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID. Ack it: requeueing would loop forever and there is no
            // row to write without a name.
            logger.warn(`⚠️  Solar system ${systemId} not found (404)`);
            channel.ack(msg);
          } else if (error.response?.status === 420) {
            logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
            await sleep(60000);
            channel.nack(msg, false, true); // requeue
          } else {
            // The root scan is re-runnable and its message is a bare integer
            // with no attempts counter, so requeue rather than dead-letter.
            logger.error(`❌ Error processing solar system ${systemId}:`, error.message);
            channel.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );

    process.on('SIGINT', async () => {
      logger.warn('\n🛑 Shutting down worker...');
      if (emptyCheckInterval) clearInterval(emptyCheckInterval);
      await channel.close();
      await prismaWorker.$disconnect();
      logger.info('✅ Worker stopped gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Failed to start solar system worker:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

startWorker();
```

- [ ] **Adım 2: Silinen kodun gerçekten silindiğini doğrula**

```bash
cd backend
grep -n '\$transaction\|timeout: 30000\|prefetch(1)\|RATE_LIMIT_DELAY\|from .axios.' \
  src/workers/worker-solar-systems.ts
```

Beklenen: **boş çıktı.** Spec'in doğrulama listesindeki maddedir.

- [ ] **Adım 3: Derleme**

```bash
yarn workspace backend build
```

Beklenen: hata yok.

- [ ] **Adım 4: Tek sistemle canlı doğrulama**

Jita (30000142) tek başına kuyruğa basılıp worker çalıştırılır:

```bash
cd backend
node -e "
const amqp = require('amqplib');
(async () => {
  const c = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await c.createChannel();
  await ch.assertQueue('esi_solar_systems_queue', { durable: true, arguments: { 'x-max-priority': 10 } });
  ch.sendToQueue('esi_solar_systems_queue', Buffer.from('30000142'), { persistent: true });
  await ch.close(); await c.close();
})();
"
yarn worker:solar-systems   # birkaç saniye sonra CTRL+C
```

Ardından dört kuyruğun dolduğu kontrol edilir:

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ workerStatus { queues { name messageCount } } }"}'
```

Beklenen: `esi_stars_queue` 1, `esi_planets_queue` 8 (Jita'nın gezegen sayısı),
`esi_stargates_queue` ve `esi_stations_queue` sıfırdan büyük. `solar_systems`
satırı güncellenmiş, `planets` / `moons` tablolarına **bu worker tarafından hiçbir
şey yazılmamış** olmalı.

- [ ] **Adım 5: Commit**

```bash
git add backend/src/workers/worker-solar-systems.ts
git commit -m "refactor(topology): reduce the solar system worker to one table and four publishes"
```

---

### Görev 5: `worker-planets` — zincirin ortası

**Dosyalar:**
- Değiştir: `backend/src/workers/worker-planets.ts`

**Arayüzler:**
- Kullanır: Görev 1'den `PlanetMessage`, `parseTopologyMessage`,
  `publishTopology`, `assertTopologyQueue`, `envelope`, `handleWorkerError`,
  `TOPOLOGY_QUEUES`; `UniverseService.getPlanet(id)`.
- Üretir: `esi_moons_queue` ve `esi_asteroid_belts_queue` üzerinde `MoonMessage` /
  `AsteroidBeltMessage`. Görev 6 bunları tüketir.

**Sıra kritik ve keyfi değil:** önce satır yazılır, sonra çocuklar publish edilir,
**en son** ESI çağrılır. Böylece ESI adımı patlasa bile satır ve zincir ayakta
kalır; eksik kalan yalnızca isimdir ve onarım script'i onu `name IS NULL` ile
bulur.

- [ ] **Adım 1: Import bloğunu değiştir**

`worker-planets.ts` başındaki import'lara ekleyin:

```ts
import {
  TOPOLOGY_QUEUES,
  assertTopologyQueue,
  envelope,
  handleWorkerError,
  parseTopologyMessage,
  publishTopology,
  type PlanetMessage,
} from '../queues/topology-messages';
```

- [ ] **Adım 2: Dosya başlığındaki yorumu güncelle**

Mevcut başlık "orbit_index is NOT written here" diyor; artık yazılıyor. Yerine:

```ts
/**
 * Planet Worker
 *
 * The middle node of the celestial chain. It is the only writer of the planets
 * table.
 *
 * Order matters and is not arbitrary:
 *   1. upsert the row from the message alone (id, solar_system_id, orbit_index
 *      are all authoritative there),
 *   2. publish the moon and asteroid belt messages,
 *   3. enrich from /universe/planets/{id}/.
 *
 * A failed ESI call therefore costs a name, not the row and not the chain. The
 * repair script finds what is missing with WHERE name IS NULL.
 *
 * Moons and belts chain through here rather than being fanned out by the system
 * worker because their planet_id is NOT NULL with a foreign key to planets, and
 * RabbitMQ guarantees no ordering across queues.
 *
 * Usage: yarn worker:planets
 */
```

- [ ] **Adım 3: Kuyruk bildirimlerini ekle**

`channel.prefetch(PREFETCH_COUNT);` satırından önce, mevcut `assertQueue`
çağrısını `assertTopologyQueue` ile değiştirin ve iki alt kuyruğu ekleyin:

```ts
    await assertTopologyQueue(channel, QUEUE_NAME);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.moons);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.asteroidBelts);
```

- [ ] **Adım 4: `consume` gövdesini değiştir**

Mevcut `const id = parseInt(...)` ile `catch` bloğunun sonu arasındaki her şeyin
yerine:

```ts
        const payload = parseTopologyMessage<PlanetMessage>(msg);

        if (!payload || typeof payload.planetId !== 'number') {
          logger.error('❌ Invalid planet message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { planetId, solarSystemId, orbitIndex, moonIds, asteroidBeltIds } = payload;

        try {
          // 1. Write the row from the message. Everything here is authoritative:
          //    orbit_index encodes the ordering of the planets[] array and has no
          //    equivalent field in the by-ID response.
          await prismaWorker.planet.upsert({
            where: { id: planetId },
            update: { solar_system_id: solarSystemId, orbit_index: orbitIndex },
            create: {
              id: planetId,
              solar_system_id: solarSystemId,
              orbit_index: orbitIndex,
            },
          });

          // 2. Publish the children. The planet row now exists, so their
          //    (planet_id, solar_system_id) foreign key can be satisfied.
          for (let m = 0; m < (moonIds ?? []).length; m++) {
            publishTopology(channel, TOPOLOGY_QUEUES.moons, {
              ...envelope(SOURCE),
              moonId: moonIds[m],
              solarSystemId,
              planetId,
              orbitIndex: m + 1,
            });
          }

          for (let b = 0; b < (asteroidBeltIds ?? []).length; b++) {
            publishTopology(channel, TOPOLOGY_QUEUES.asteroidBelts, {
              ...envelope(SOURCE),
              beltId: asteroidBeltIds[b],
              solarSystemId,
              planetId,
              orbitIndex: b + 1,
            });
          }

          // 3. Enrich. Anything that fails from here on costs a name only.
          const data = await UniverseService.getPlanet(planetId);

          await prismaWorker.planet.update({
            where: { id: planetId },
            data: {
              name: data.name ?? null,
              type_id: data.type_id ?? null,
              position_x: data.position?.x ?? null,
              position_y: data.position?.y ?? null,
              position_z: data.position?.z ?? null,
            },
          });

          processed++;
          logger.debug(
            `✅ Planet ${planetId} - ${data.name ?? '(unnamed)'} ` +
              `(${moonIds?.length ?? 0} moons, ${asteroidBeltIds?.length ?? 0} belts queued)`
          );
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at the ESI step. The row and the chain already exist, so
            // ack: the row keeps its NULL name and shows up in the repair scan.
            logger.warn(`⚠️  Planet ${planetId} not found (404)`);
            channel.ack(msg);
          } else {
            await handleWorkerError(channel, msg, payload, QUEUE_NAME, error, logger);
          }
        }
```

- [ ] **Adım 5: `SOURCE` sabitini ekle**

`PREFETCH_COUNT` tanımının yanına:

```ts
const SOURCE = 'worker-planets';
```

- [ ] **Adım 6: Derleme**

```bash
yarn workspace backend build
```

Beklenen: hata yok.

- [ ] **Adım 7: Zinciri canlı doğrula**

Görev 4 Adım 4'ün bıraktığı `esi_planets_queue` mesajlarıyla:

```bash
cd backend && yarn worker:planets   # kuyruk boşalınca CTRL+C
```

Ardından:

```bash
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT planet_id, name, orbit_index FROM planets
               WHERE solar_system_id = 30000142 ORDER BY orbit_index;"
```

Beklenen: Jita'nın gezegenleri `orbit_index` 1..8 ile, isimleri dolu.
`esi_moons_queue` ve `esi_asteroid_belts_queue` dolmuş olmalı.

- [ ] **Adım 8: Commit**

```bash
git add backend/src/workers/worker-planets.ts
git commit -m "feat(topology): make the planet worker the chain node that owns its row"
```

---

### Görev 6: Zincir yaprakları — `worker-moons` ve `worker-asteroid-belts`

**Dosyalar:**
- Değiştir: `backend/src/workers/worker-moons.ts`
- Değiştir: `backend/src/workers/worker-asteroid-belts.ts`

**Arayüzler:**
- Kullanır: Görev 1'den `MoonMessage`, `AsteroidBeltMessage`,
  `parseTopologyMessage`, `assertTopologyQueue`, `handleWorkerError`;
  Görev 5'in bastığı mesajlar; Görev 3'ün bileşik FK'si.
- Üretir: `moons` ve `asteroid_belts` satırları. Hiçbir kuyruğa yazmaz.

İki dosya mekanik olarak aynıdır; aşağıdaki iki farkla: model adı
(`prismaWorker.moon` / `prismaWorker.asteroidBelt`), mesaj alanı (`moonId` /
`beltId`) ve servis metodu (`getMoon` / `getAsteroidBelt`).

- [ ] **Adım 1: `worker-moons.ts` import'larını değiştir**

```ts
import {
  assertTopologyQueue,
  handleWorkerError,
  parseTopologyMessage,
  type MoonMessage,
} from '../queues/topology-messages';
```

- [ ] **Adım 2: `worker-moons.ts` dosya başlığındaki yorumu güncelle**

Mevcut not "the moon-to-planet link ... is written in step 2; nothing here can
recover it" diyor. Artık bağ mesajda geliyor:

```ts
/**
 * Moon Worker
 *
 * Sole writer of the moons table.
 *
 * The response contains no planet_id; the moon-to-planet link travels in the
 * queue message, put there by worker-planets, which read it out of the
 * /universe/systems/{id}/ nesting. Nothing else can recover it.
 *
 * Single write: nothing depends on a moon row, and a second write would be pure
 * cost on the largest table in the topology. A lost message is covered by the
 * DLQ and by re-running the root scan.
 *
 * Usage: yarn worker:moons
 */
```

- [ ] **Adım 3: `worker-moons.ts` `assertQueue` çağrısını değiştir**

Mevcut `await channel.assertQueue(QUEUE_NAME, { durable: true, arguments: ... });`
bloğunun yerine:

```ts
    await assertTopologyQueue(channel, QUEUE_NAME);
```

- [ ] **Adım 4: `worker-moons.ts` `consume` gövdesini değiştir**

`const id = parseInt(...)` ile `catch` bloğunun sonu arasındaki her şeyin yerine:

```ts
        const payload = parseTopologyMessage<MoonMessage>(msg);

        if (!payload || typeof payload.moonId !== 'number') {
          logger.error('❌ Invalid moon message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { moonId, solarSystemId, planetId, orbitIndex } = payload;

        try {
          const data = await UniverseService.getMoon(moonId);

          // upsert, not update: this worker creates the row now. The planet row
          // is guaranteed to exist because this message was published by
          // worker-planets after it wrote that row.
          const row = {
            solar_system_id: solarSystemId,
            planet_id: planetId,
            orbit_index: orbitIndex,
            name: data.name ?? null,
            position_x: data.position?.x ?? null,
            position_y: data.position?.y ?? null,
            position_z: data.position?.z ?? null,
          };

          await prismaWorker.moon.upsert({
            where: { id: moonId },
            update: row,
            create: { id: moonId, ...row },
          });

          processed++;
          logger.debug(`✅ Moon ${moonId} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at ESI. The topology facts are still authoritative, so
            // write the row without a name rather than losing the moon entirely.
            logger.warn(`⚠️  Moon ${moonId} not found (404), writing row without a name`);
            try {
              await prismaWorker.moon.upsert({
                where: { id: moonId },
                update: { solar_system_id: solarSystemId, planet_id: planetId, orbit_index: orbitIndex },
                create: {
                  id: moonId,
                  solar_system_id: solarSystemId,
                  planet_id: planetId,
                  orbit_index: orbitIndex,
                },
              });
              channel.ack(msg);
            } catch (writeError: any) {
              await handleWorkerError(channel, msg, payload, QUEUE_NAME, writeError, logger);
            }
          } else {
            await handleWorkerError(channel, msg, payload, QUEUE_NAME, error, logger);
          }
        }
```

- [ ] **Adım 5: `worker-asteroid-belts.ts` için 1-4'ü tekrarla**

Aynı değişiklikler, şu ikamelerle: `MoonMessage` → `AsteroidBeltMessage`,
`payload.moonId` → `payload.beltId`, `const { moonId, ... }` →
`const { beltId, ... }`, `UniverseService.getMoon` →
`UniverseService.getAsteroidBelt`, `prismaWorker.moon` →
`prismaWorker.asteroidBelt`, log metinlerinde `Moon` → `Asteroid belt`.
Kuşak yanıtında `type_id` yok; `row` nesnesi ay ile birebir aynı alanları taşır.

- [ ] **Adım 6: Derleme**

```bash
yarn workspace backend build
```

Beklenen: hata yok.

- [ ] **Adım 7: Canlı doğrulama**

Görev 5'in doldurduğu kuyruklarla:

```bash
cd backend && yarn worker:moons             # boşalınca CTRL+C
cd backend && yarn worker:asteroid-belts    # boşalınca CTRL+C
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "
SELECT m.moon_id, m.name, m.orbit_index, m.planet_id
  FROM moons m WHERE m.solar_system_id = 30000142
 ORDER BY m.planet_id, m.orbit_index LIMIT 10;"
```

Beklenen: satırlar dolu, `name` NULL değil, `planet_id` gerçek bir gezegeni
gösteriyor.

Bileşik FK'nin gerçekten koruduğunu da doğrulayın — bu yazımın **başarısız
olması** beklenir:

```bash
psql "$DB" -c "
UPDATE moons SET solar_system_id = 30000144
 WHERE moon_id = (SELECT moon_id FROM moons WHERE solar_system_id = 30000142 LIMIT 1);"
```

Beklenen: `ERROR: insert or update on table "moons" violates foreign key
constraint "moons_planet_id_solar_system_id_fkey"`. Hata almazsanız Görev 3'ün
migration'ı uygulanmamıştır.

- [ ] **Adım 8: Commit**

```bash
git add backend/src/workers/worker-moons.ts backend/src/workers/worker-asteroid-belts.ts
git commit -m "feat(topology): make moon and asteroid belt workers the sole writers of their rows"
```

---

### Görev 7: Sistem yaprakları — `worker-stars`, `worker-stargates`, `worker-stations`

**Dosyalar:**
- Değiştir: `backend/src/workers/worker-stars.ts`
- Değiştir: `backend/src/workers/worker-stargates.ts`
- Değiştir: `backend/src/workers/worker-stations.ts`

**Arayüzler:**
- Kullanır: Görev 1'den `StarMessage`, `StargateMessage`, `StationMessage`,
  `parseTopologyMessage`, `assertTopologyQueue`, `handleWorkerError`;
  Görev 4'ün bastığı mesajlar; Görev 3'ün `destination_system_id` FK'si.
- Üretir: `stars`, `stargates`, `stations` satırları. Hiçbir kuyruğa yazmaz.

Üçü de Görev 6'daki desenin aynısıdır. Tek yapısal fark `worker-stargates`'tedir:
`destination_system_id` artık FK'lidir ve hedef sistem satırı henüz yazılmamışsa
Prisma `P2003` fırlatır. `handleWorkerError` bunu yeniden denenebilir sayar, bu
yüzden ek kod gerekmez — ama davranış bilinerek bırakılmıştır.

- [ ] **Adım 1: `worker-stars.ts`'i dönüştür**

Görev 6 Adım 1-4'ün aynısı, şu içerikle:

```ts
        const payload = parseTopologyMessage<StarMessage>(msg);

        if (!payload || typeof payload.starId !== 'number') {
          logger.error('❌ Invalid star message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { starId, solarSystemId } = payload;

        try {
          const data = await UniverseService.getStar(starId);

          const row = {
            solar_system_id: solarSystemId,
            name: data.name ?? null,
            type_id: data.type_id ?? null,
            spectral_class: data.spectral_class ?? null,
            temperature: data.temperature ?? null,
            radius: data.radius ?? null,
            age: data.age ?? null,
            luminosity: data.luminosity ?? null,
          };

          await prismaWorker.star.upsert({
            where: { id: starId },
            update: row,
            create: { id: starId, ...row },
          });

          processed++;
          logger.debug(`✅ Star ${starId} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            logger.warn(`⚠️  Star ${starId} not found (404), writing row without a name`);
            try {
              await prismaWorker.star.upsert({
                where: { id: starId },
                update: { solar_system_id: solarSystemId },
                create: { id: starId, solar_system_id: solarSystemId },
              });
              channel.ack(msg);
            } catch (writeError: any) {
              await handleWorkerError(channel, msg, payload, QUEUE_NAME, writeError, logger);
            }
          } else {
            await handleWorkerError(channel, msg, payload, QUEUE_NAME, error, logger);
          }
        }
```

`stars.solar_system_id` `UNIQUE`'tir; aynı sisteme ikinci bir yıldız yazma
denemesi `P2002` verir ve `handleWorkerError` onu beş denemeden sonra DLQ'ya atar.
Bu doğru davranıştır: ESI'nin bir sisteme iki yıldız bildirmesi gerçek bir veri
hatasıdır ve görünür olmalıdır.

- [ ] **Adım 2: `worker-stargates.ts`'i dönüştür**

Aynı desen, `StargateMessage` ve `payload.stargateId` ile. `row`:

```ts
          const row = {
            solar_system_id: solarSystemId,
            name: data.name ?? null,
            destination_system_id: data.destination?.system_id ?? null,
            destination_stargate_id: data.destination?.stargate_id ?? null,
            type_id: data.type_id ?? null,
            position_x: data.position?.x ?? null,
            position_y: data.position?.y ?? null,
            position_z: data.position?.z ?? null,
          };
```

Dosya başlığına şu notu ekleyin:

```ts
/**
 * destination_system_id now has a foreign key (ON DELETE SET NULL). If this
 * worker runs concurrently with worker-solar-systems, the destination system row
 * may not exist yet and Prisma throws P2003; handleWorkerError treats that as
 * retryable and republishes with an incremented attempts counter. Running the
 * system queue to completion first avoids it entirely.
 *
 * destination_stargate_id deliberately has NO foreign key: the destination gate
 * row is created by this same worker, so it would produce a frequently triggered
 * ordering dependency inside a single queue.
 */
```

- [ ] **Adım 3: `worker-stations.ts`'i dönüştür**

Aynı desen, `StationMessage` ve `payload.stationId` ile. `row`:

```ts
          const row = {
            solar_system_id: solarSystemId,
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
          };
```

404 yolunda `create` gövdesi `{ id: stationId, solar_system_id: solarSystemId,
services: [] }` olmalıdır — `services` `String[]` ve varsayılanı yok.

- [ ] **Adım 4: Derleme**

```bash
yarn workspace backend build
```

Beklenen: hata yok.

- [ ] **Adım 5: Canlı doğrulama**

```bash
cd backend
yarn worker:stars       # CTRL+C
yarn worker:stargates   # CTRL+C
yarn worker:stations    # CTRL+C
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "
SELECT (SELECT COUNT(*) FROM stars     WHERE solar_system_id = 30000142) AS stars,
       (SELECT COUNT(*) FROM stargates WHERE solar_system_id = 30000142) AS gates,
       (SELECT COUNT(*) FROM stations  WHERE solar_system_id = 30000142) AS stations,
       (SELECT COUNT(*) FROM stargates WHERE solar_system_id = 30000142
                                         AND destination_system_id IS NOT NULL) AS resolved;"
```

Beklenen: `stars` = 1, `gates` > 0, `resolved` = `gates` (Jita'nın komşu
sistemleri veritabanında zaten var).

- [ ] **Adım 6: Commit**

```bash
git add backend/src/workers/worker-stars.ts backend/src/workers/worker-stargates.ts \
        backend/src/workers/worker-stations.ts
git commit -m "feat(topology): make star, stargate and station workers the sole writers of their rows"
```

---

### Görev 8: Onarım queue script'leri

**Dosyalar:**
- Değiştir: `backend/src/queues/queue-stars.ts`
- Değiştir: `backend/src/queues/queue-planets.ts`
- Değiştir: `backend/src/queues/queue-moons.ts`
- Değiştir: `backend/src/queues/queue-asteroid-belts.ts`
- Değiştir: `backend/src/queues/queue-stargates.ts`
- Değiştir: `backend/src/queues/queue-stations.ts`

**Arayüzler:**
- Kullanır: Görev 1'in mesaj tipleri ve `assertTopologyQueue` / `publishTopology`.
- Üretir: aynı worker'ların anladığı JSON mesajlar. Yeni bir tip üretmez.

Bu script'ler artık normal akışın parçası değil; `WHERE name IS NULL` ile eksik
kalanları bulan onarım araçlarıdır. Silinmezler, çünkü ESI'nin geçici bir hatası
sonrası tek kurtarma yolu bunlardır.

- [ ] **Adım 1: `queue-stars.ts`'i dönüştür**

`findMany` çağrısı `solar_system_id`'yi de seçmeli ve mesaj JSON olmalı:

```ts
import {
  TOPOLOGY_QUEUES,
  assertTopologyQueue,
  envelope,
  publishTopology,
} from './topology-messages';

const QUEUE_NAME = TOPOLOGY_QUEUES.stars;
const SOURCE = 'queue-stars';
```

```ts
    // Repair tool, not part of the normal flow: the chain creates these rows.
    // A star row with no name means its ESI enrichment failed at some point.
    const rows = await prismaWorker.star.findMany({
      where: { name: null },
      select: { id: true, solar_system_id: true },
      orderBy: { id: 'asc' },
    });
```

```ts
    const channel = await getRabbitMQChannel();
    await assertTopologyQueue(channel, QUEUE_NAME);

    for (const row of rows) {
      publishTopology(channel, QUEUE_NAME, {
        ...envelope(SOURCE),
        starId: row.id,
        solarSystemId: row.solar_system_id,
      });
    }
```

- [ ] **Adım 2: `queue-stargates.ts` ve `queue-stations.ts`'i dönüştür**

Birebir aynı şekil; alan adları `stargateId` / `stationId`, model
`prismaWorker.stargate` / `prismaWorker.station`, `SOURCE` sırasıyla
`'queue-stargates'` / `'queue-stations'`.

- [ ] **Adım 3: `queue-moons.ts` ve `queue-asteroid-belts.ts`'i dönüştür**

Bunlar `planet_id` ve `orbit_index`'i de taşımalıdır — ikisi de veritabanında
zaten kayıtlı:

```ts
    const rows = await prismaWorker.moon.findMany({
      where: { name: null },
      select: { id: true, solar_system_id: true, planet_id: true, orbit_index: true },
      orderBy: { id: 'asc' },
    });
```

```ts
    for (const row of rows) {
      publishTopology(channel, QUEUE_NAME, {
        ...envelope(SOURCE),
        moonId: row.id,
        solarSystemId: row.solar_system_id,
        planetId: row.planet_id,
        // orbit_index is nullable in the schema but always written by the chain;
        // 0 marks a row that predates it and is worth spotting in the logs.
        orbitIndex: row.orbit_index ?? 0,
      });
    }
```

Kuşak için aynısı, `beltId` ve `prismaWorker.asteroidBelt` ile.

- [ ] **Adım 4: `queue-planets.ts`'i dönüştür**

Gezegen mesajı `moonIds` ve `asteroidBeltIds` taşımak zorunda. İkisi de
veritabanından okunur — ESI'ye dönmeye gerek yok, çünkü `moons.planet_id` ve
`asteroid_belts.planet_id` zaten kayıtlı:

```ts
    const rows = await prismaWorker.planet.findMany({
      where: { name: null },
      select: { id: true, solar_system_id: true, orbit_index: true },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      logger.info('Nothing to do: every planet row already has a name.');
      await prismaWorker.$disconnect();
      process.exit(0);
    }

    const planetIds = rows.map((r) => r.id);

    // Batch + Map instead of a query per planet.
    const moons = await prismaWorker.moon.findMany({
      where: { planet_id: { in: planetIds } },
      select: { id: true, planet_id: true },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });
    const belts = await prismaWorker.asteroidBelt.findMany({
      where: { planet_id: { in: planetIds } },
      select: { id: true, planet_id: true },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });

    const moonsByPlanet = new Map<number, number[]>();
    for (const m of moons) {
      const list = moonsByPlanet.get(m.planet_id) ?? [];
      list.push(m.id);
      moonsByPlanet.set(m.planet_id, list);
    }

    const beltsByPlanet = new Map<number, number[]>();
    for (const b of belts) {
      const list = beltsByPlanet.get(b.planet_id) ?? [];
      list.push(b.id);
      beltsByPlanet.set(b.planet_id, list);
    }
```

```ts
    for (const row of rows) {
      publishTopology(channel, QUEUE_NAME, {
        ...envelope(SOURCE),
        planetId: row.id,
        solarSystemId: row.solar_system_id,
        orbitIndex: row.orbit_index ?? 0,
        moonIds: moonsByPlanet.get(row.id) ?? [],
        asteroidBeltIds: beltsByPlanet.get(row.id) ?? [],
      });
    }
```

- [ ] **Adım 5: Derleme**

```bash
yarn workspace backend build
```

Beklenen: hata yok.

- [ ] **Adım 6: Onarımın gerçekten çalıştığını doğrula**

Jita'nın bir gezegeninin adını kasten silip onarımı çalıştırın:

```bash
DB=$(grep -m1 '^DATABASE_URL' backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "UPDATE planets SET name = NULL WHERE planet_id =
  (SELECT planet_id FROM planets WHERE solar_system_id = 30000142 ORDER BY orbit_index LIMIT 1);"
cd backend && yarn queue:planets && yarn worker:planets   # CTRL+C
psql "$DB" -c "SELECT planet_id, name FROM planets WHERE solar_system_id = 30000142
               ORDER BY orbit_index LIMIT 1;"
```

Beklenen: `name` yeniden dolu.

- [ ] **Adım 7: Commit**

```bash
git add backend/src/queues/queue-stars.ts backend/src/queues/queue-planets.ts \
        backend/src/queues/queue-moons.ts backend/src/queues/queue-asteroid-belts.ts \
        backend/src/queues/queue-stargates.ts backend/src/queues/queue-stations.ts
git commit -m "refactor(topology): turn the celestial queue scripts into repair tools"
```

---

### Görev 9: `doctor:topology` bütünlük raporu

**Dosyalar:**
- Oluştur: `backend/src/workers/doctor-topology.ts`
- Değiştir: `backend/package.json` (script kaydı)

**Arayüzler:**
- Kullanır: `prismaWorker`, `getQueueStats` (`@services/rabbitmq`),
  `TOPOLOGY_QUEUES`.
- Üretir: konsol raporu. Başka hiçbir şey buna bağlı değil.

Cross-pipeline alanlara FK konmadığı için (`type_id`, `owner_corporation_id`,
`race_id` başka pipeline'ların doldurduğu tablolara işaret eder) bütünlük burada
raporlanır. `psql` gerektirmez; kullanıcı tek komutla çalıştırabilir.

- [ ] **Adım 1: Script'i oluştur**

```ts
/**
 * Topology Doctor
 *
 * Reports the integrity gaps the schema deliberately does not enforce.
 *
 * Foreign keys are only created between tables the same pipeline fills. type_id,
 * owner_corporation_id and race_id point at tables the type, corporation and race
 * pipelines own; a foreign key there would lock two ingests together and
 * reintroduce exactly the coupling this design removed. They are reported
 * instead.
 *
 * Read-only. It never writes and never queues anything.
 *
 * Usage: yarn doctor:topology
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getQueueStats } from '@services/rabbitmq';
import { TOPOLOGY_QUEUES } from '../queues/topology-messages';

interface CheckRow {
  check: string;
  count: bigint;
}

async function doctorTopology() {
  logger.info('🩺 Topology doctor\n');

  // Orphaned cross-pipeline references. ::BIGINT comes back as a JavaScript
  // BigInt, so it is converted with Number() before being printed or serialised.
  const orphans = await prismaWorker.$queryRaw<CheckRow[]>`
    -- Only four of the six celestial tables carry type_id: moons and
    -- asteroid_belts have no such column.
    SELECT 'planets.type_id'              AS check, COUNT(*)::BIGINT AS count
      FROM planets p LEFT JOIN types t ON t.id = p.type_id
     WHERE p.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stars.type_id', COUNT(*)::BIGINT FROM stars s
      LEFT JOIN types t ON t.id = s.type_id
     WHERE s.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stargates.type_id', COUNT(*)::BIGINT FROM stargates g
      LEFT JOIN types t ON t.id = g.type_id
     WHERE g.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stations.type_id', COUNT(*)::BIGINT FROM stations st
      LEFT JOIN types t ON t.id = st.type_id
     WHERE st.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stations.owner_corporation_id', COUNT(*)::BIGINT FROM stations st
      LEFT JOIN corporations c ON c.id = st.owner_corporation_id
     WHERE st.owner_corporation_id IS NOT NULL AND c.id IS NULL
    UNION ALL
    SELECT 'stations.race_id', COUNT(*)::BIGINT FROM stations st
      LEFT JOIN races r ON r.id = st.race_id
     WHERE st.race_id IS NOT NULL AND r.id IS NULL
    UNION ALL
    SELECT 'stargates.unresolved_destination', COUNT(*)::BIGINT FROM stargates g
     WHERE g.destination_system_id IS NULL
  `;

  logger.info('Cross-pipeline references:');
  for (const row of orphans) {
    const n = Number(row.count);
    logger.info(`  ${n === 0 ? '✅' : '⚠️ '} ${row.check}: ${n}`);
  }

  // Rows the chain created but ESI enrichment never named. Each maps to a repair
  // script: yarn queue:<domain>.
  const [stars, planets, moons, belts, stargates, stations] = await Promise.all([
    prismaWorker.star.count({ where: { name: null } }),
    prismaWorker.planet.count({ where: { name: null } }),
    prismaWorker.moon.count({ where: { name: null } }),
    prismaWorker.asteroidBelt.count({ where: { name: null } }),
    prismaWorker.stargate.count({ where: { name: null } }),
    prismaWorker.station.count({ where: { name: null } }),
  ]);

  logger.info('\nRows with no name (run yarn queue:<domain> to repair):');
  logger.info(`  stars: ${stars}          -> yarn queue:stars`);
  logger.info(`  planets: ${planets}        -> yarn queue:planets`);
  logger.info(`  moons: ${moons}          -> yarn queue:moons`);
  logger.info(`  asteroid_belts: ${belts} -> yarn queue:asteroid-belts`);
  logger.info(`  stargates: ${stargates}      -> yarn queue:stargates`);
  logger.info(`  stations: ${stations}       -> yarn queue:stations`);

  // A DLQ nobody looks at is silent data loss, which is why it is in this report.
  const dlq = await getQueueStats(TOPOLOGY_QUEUES.dlq);
  logger.info(
    `\nDead letter queue (${TOPOLOGY_QUEUES.dlq}): ` +
      `${dlq.exists ? `${dlq.messageCount} messages` : 'not declared yet'}`
  );
  if (dlq.messageCount > 0) {
    logger.warn('⚠️  Messages gave up after 5 attempts. Inspect them before re-running the scan.');
  }

  await prismaWorker.$disconnect();
  process.exit(0);
}

doctorTopology().catch(async (error) => {
  logger.error('Topology doctor failed', { error });
  await prismaWorker.$disconnect();
  process.exit(1);
});
```

- [ ] **Adım 2: Tablo ve kolon adlarını doğrula**

Bu sorgudaki iki ayrıntı repoda doğrulanmıştır, değiştirmeyin:

- `types`, `corporations` ve `races` modellerinde birincil anahtar `@map`'li
  **değildir** — kolon gerçekten `id`. Universe topoloji tablolarının aksine
  (`planets.planet_id`, `moons.moon_id`, ...) burada `t.id` / `c.id` / `r.id`
  doğru yazımdır.
- `moons` ve `asteroid_belts` tablolarında `type_id` kolonu **yoktur**; spec bu
  ikisini de `type_id` taşıyan tablolar arasında sayıyor, kod öyle değil. Ay ve
  kuşak için `type_id` kontrolü eklemeyin, sorgu hata verir.

İsterseniz teyit edin:

```bash
DB=$(grep -m1 '^DATABASE_URL' backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "\d types" | head -5
psql "$DB" -c "\d moons" | head -12
```

- [ ] **Adım 3: `package.json`'a script'i ekle**

`"worker:asteroid-belts"` satırının ardına:

```json
    "doctor:topology": "tsx src/workers/doctor-topology.ts",
```

- [ ] **Adım 4: Derleme ve çalıştırma**

```bash
yarn workspace backend build
cd backend && yarn doctor:topology
```

Beklenen: rapor hatasız basılır; her satırda bir sayı görünür.

- [ ] **Adım 5: Commit**

```bash
git add backend/src/workers/doctor-topology.ts backend/package.json
git commit -m "feat(topology): add a doctor script for the integrity the schema cannot enforce"
```

---

### Görev 10: Uçtan uca tur ve dokümantasyon

**Dosyalar:**
- Oluştur: `backend/docs/workers/universe-topology-chain.md`
- Değiştir: `backend/docs/ops/` altındaki ilgili operasyon dokümanı (aşağıda)

**Arayüzler:**
- Kullanır: Görev 1-9'un tamamı.
- Üretir: doküman. Kod üretmez.

- [ ] **Adım 1: Kuyrukların boş olduğunu doğrula**

Mesaj formatı düz `Int`'ten JSON'a geçtiği için geriye dönük uyumluluk yok: eski
bir düz integer mesaj `solar_system_id` taşımıyor ve `parseTopologyMessage` onu
`null` döndürüp ack'liyor. Tam tur öncesi altı kuyruğun boş olması gerekir.

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ workerStatus { queues { name messageCount } } }"}'
```

Beklenen: `esi_stars_queue`, `esi_planets_queue`, `esi_moons_queue`,
`esi_asteroid_belts_queue`, `esi_stargates_queue`, `esi_stations_queue` için
`messageCount` = 0.

- [ ] **Adım 2: Tam turu çalıştır**

```bash
cd backend
yarn queue:solar-systems
# Sıra önemli: sistem kuyruğunun bitmesi stargate FK'sinin hiç tetiklenmemesini
# sağlar. Yedi worker ayrı terminallerde çalışabilir.
yarn worker:solar-systems
yarn worker:planets
yarn worker:stars
yarn worker:stations
yarn worker:moons
yarn worker:asteroid-belts
yarn worker:stargates
```

- [ ] **Adım 3: Satır sayılarını ve `counts` tutarlılığını doğrula**

```bash
DB=$(grep -m1 '^DATABASE_URL' backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT
  (SELECT COUNT(*) FROM solar_systems)  AS solar_systems,
  (SELECT COUNT(*) FROM stars)          AS stars,
  (SELECT COUNT(*) FROM planets)        AS planets,
  (SELECT COUNT(*) FROM moons)          AS moons,
  (SELECT COUNT(*) FROM asteroid_belts) AS asteroid_belts,
  (SELECT COUNT(*) FROM stargates)      AS stargates,
  (SELECT COUNT(*) FROM stations)       AS stations;"
```

Beklenen: her sayı Görev 2 Adım 1'deki taban çizgisine **eşit veya ondan büyük**.

`counts` alanının doğruluğu GraphQL üzerinden:

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ solarSystem(id: 30000142) { name counts { stargates planets moons asteroidBelts stations } } }"}'
```

Beklenen: sayılar yukarıdaki `psql` sonuçlarıyla (sistem bazında) tutarlı.

- [ ] **Adım 4: `doctor:topology` çıktısını al**

```bash
cd backend && yarn doctor:topology
```

Beklenen: DLQ boş; `name IS NULL` sayıları sıfır ya da makul derecede küçük
(ESI'de gerçekten ölü ID'ler). Sıfırdan büyükse ilgili `yarn queue:<domain>`
çalıştırılır.

- [ ] **Adım 5: Worker dokümanını yaz**

`backend/docs/workers/universe-topology-chain.md` dosyası şunları içermeli:

- Akış diyagramı (spec'in "Akış" bölümündeki `text` bloğu).
- Sahiplik tablosu: hangi worker hangi tablonun tek sahibi.
- Mesaj sözleşmeleri ve `esi_solar_systems_queue`'nun neden düz `Int` kaldığı.
- Hata tablosu: 404 / 420 / P2003 / diğer / `attempts > 5` → DLQ.
- DLQ'nun neden `x-dead-letter-exchange` ile değil elle publish ile kurulduğu
  (`406 PRECONDITION_FAILED`).
- Onarım script'leri ve `yarn doctor:topology`.
- Markdown link kuralı: bu dosyadan `backend/src/workers/x.ts`'e giden yol
  `../../src/workers/x.ts`'tir. Baştaki `/` GitHub'da 404 verir.

Linkleri commit öncesi doğrulayın:

```bash
grep -rn --include='*.md' -oE '\]\([^)#][^)]*\)' backend/docs/workers/universe-topology-chain.md
```

- [ ] **Adım 6: Operasyon dokümanındaki "bitti" tanımını güncelle**

Zincir yüzünden kök taramanın bitmesi artık "sistem kuyruğu boşaldı" demek değil,
"yedi kuyruk birden boşaldı" demek. `backend/docs/ops/` altında universe ingest'i
anlatan dokümanı bulun ve bu tanımı düzeltin:

```bash
grep -rln 'solar-system\|solar_system\|universe' backend/docs/ops/
```

- [ ] **Adım 7: Commit**

```bash
git add backend/docs
git commit -m "docs(topology): document the celestial queue chain and its repair tools"
```

---

## Self-Review — plan yazıldıktan sonra yapılan kontrol

**Spec kapsamı.** Spec'in her bölümü bir göreve bağlandı: Akış ve mesaj
sözleşmeleri → Görev 1, 4, 5; Sahiplik → Görev 4-7; Yazma sırası → Görev 5;
Onarım script'leri → Görev 8; Veri bütünlüğü (Yeni 1, 2, 3) → Görev 3 ve 9;
İndeksler → Görev 3; Hata ve yeniden deneme + DLQ → Görev 1 (`handleWorkerError`)
ve Görev 6, 7; Kuyruk kaydı → Görev 1; Geçiş planı → Görev 2, 3, 10 Adım 1;
Doğrulama → Görev 4 Adım 2, Görev 10.

**Spec'ten ve dokümantasyondan sapılan beş nokta, gerekçeleriyle:**

1. **`getAllQueueStats()` içindeki ikinci kuyruk listesi.** Spec yalnızca
   `ALL_QUEUES`'dan söz ediyor; `workerStatus`'un okuduğu liste ayrı kodlanmış.
   Görev 1 Adım 3 olarak eklendi, yoksa spec'in raporlama hedefi tutmuyordu.
2. **Geçiş planındaki SQL'de `ss.id` → `ss.system_id`.** `SolarSystem.id`
   veritabanında `system_id`'ye `@map`'li; spec'in yazdığı hâli
   `column "id" does not exist` verirdi.
3. **`Stargate` ↔ `SolarSystem` ilişki adları.** İkinci FK, iki model arasında iki
   ilişki yaratıyor; Prisma ikisinin de adlandırılmasını şart koşuyor. Spec'in DDL'i
   doğru ama Prisma şema tarafını göstermiyordu. Görev 3 Adım 4-5.
4. **`workerStatus` sorgusunun şekli.** CLAUDE.md `workerStatus { queueName
   messageCount consumerCount }` yazıyor; gerçek şemada alanlar `WorkerStatus.queues`
   altındaki `QueueStatus` tipinde ve ad alanı `name`
   (`backend/src/schemas/Worker.graphql`). Doğru şekil
   `workerStatus { queues { name messageCount consumerCount } }`. Görev 1
   uygulanırken tespit edildi, planın tamamında düzeltildi.
5. **`moons` ve `asteroid_belts` tablolarında `type_id` yok.** Spec cross-pipeline
   alanları sayarken bu ikisini de `type_id` taşıyanlar arasında gösteriyor;
   `prisma/schema/moon.prisma` ve `asteroidBelt.prisma` böyle bir kolon
   tanımlamıyor. `doctor:topology` sorgusundan çıkarıldı, yoksa script hata verirdi
   (Görev 9). Ayrıca `types` / `corporations` / `races` birincil anahtarları
   `@map`'li değil, kolon adı gerçekten `id`.

**Yer tutucu taraması.** Planda "TBD", "uygun hata yönetimi ekle", "Görev N'e
benzer" türü ifade yok; her kod adımı gerçek kod içeriyor, yaprak worker'ların
tekrarlı kısımları açık ikame listesiyle verildi.

**Tip tutarlılığı.** `TOPOLOGY_QUEUES`, `envelope`, `publishTopology`,
`parseTopologyMessage`, `assertTopologyQueue`, `handleWorkerError`, `MAX_ATTEMPTS`
adları Görev 1'de tanımlandığı hâliyle Görev 4-9'da kullanıldı. Mesaj alan adları
(`starId`, `stargateId`, `stationId`, `planetId`, `moonId`, `beltId`,
`solarSystemId`, `orbitIndex`, `moonIds`, `asteroidBeltIds`) spec'teki
sözleşmeyle birebir aynı.

**Bilinen koşullu adım.** Görev 2 bir kapıdır. Üç sorgudan biri sıfır dönmezse
plan orada durur ve düzeltmenin yönü kullanıcıyla kararlaştırılır.
