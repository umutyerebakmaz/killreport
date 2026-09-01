# Universe Topology Ingest — Kuyruk Zinciri Tasarımı

- **Tarih:** 2026-09-01
- **Durum:** Tasarım onayı bekliyor
- **İlgili çalışma:** PR #135 (`solar-system-improvements`, 46d731c) ile gelen universe topology ingest'i

## Özet

`worker-solar-systems` bugün tek bir ESI cevabından altı farklı tabloya yazıyor ve
bunu tek bir büyük transaction içinde yapıyor. Bu tasarım o sorumluluğu dağıtıyor:
sistem worker'ı yalnızca `solar_systems` satırını yazar, elindeki bütün ID'leri
ilgili kuyruklara basar, her gök cismi tipi kendi tablosunun tek sahibi olur ve
eksik verisini kendi ESI çağrısıyla tamamlar.

Aynı çalışmada, bugün hiçbir kısıtla korunmayan iki veri bütünlüğü boşluğu
kapatılıyor ve DataLoader sorgularının gerçek `WHERE` + `ORDER BY` şekillerine
uyan bileşik indeksler kuruluyor.

## Motivasyon

Mevcut tasarımın somut sorunları:

1. **Sahiplik ihlali.** `backend/src/workers/worker-solar-systems.ts:66-140` altı
   yabancı tabloya yazıyor: `stars`, `stargates`, `stations`, `planets`, `moons`,
   `asteroid_belts`. Repoda bunu yapan başka worker yok; CLAUDE.md'nin "her worker
   self-contained" ilkesini ihlal eden tek yer burası.
2. **Büyük transaction.** 73 aylı bir sistem yaklaşık 90 upsert demek. Prisma'nın 5
   saniyelik varsayılanı yetmediği için `timeout: 30000` konulmuş — tasarımın
   kendi ağırlığını kabul ettiği yer.
3. **Yapay throughput tavanı.** Aynı dosyada `prefetch(1)` ve elle 100 ms uyku var;
   saniyede 10 sistem, seri. Sebebi doğrudan yukarıdaki transaction.
4. **Rate limiter atlanıyor.** Bu worker ham `axios` çağırıyor, `esiRateLimiter`
   kullanmıyor. CLAUDE.md her ESI çağrısının rate limiter'a sarılmasını şart koşuyor.
5. **Genişletilemezlik.** Yeni bir gök cismi tipi eklemek, mevcut transaction'ı
   açıp düzenlemeyi gerektiriyor. Desenin vaadi ise "bir queue + bir worker ekle,
   gerisine dokunma".
6. **Kuyruklar kayıtsız.** `backend/src/services/rabbitmq.ts:14-36` içindeki
   `ALL_QUEUES` altı gök cismi kuyruğunun hiçbirini içermiyor. Sonuç:
   `ensureAllQueuesExist()` onları oluşturmuyor ve `workerStatus` sorgusu kuyruk
   derinliklerini raporlamıyor.

## Kapsam dışı

- GraphQL şeması ve resolver'lar değişmiyor; frontend değişmiyor.
- Universe verisi için zamanlama (PM2 / crontab) kurulmuyor. Statik veri elle
  çalıştırılmaya devam eder.
- Gök cismi adına göre arama ve onun gerektireceği `pg_trgm` altyapısı ayrı iş.
- `topology-fields.ts` içindeki Adjacent sekmesinin ne sayacağı ayrı karar.

## Tasarım

### Akış

```text
queue:solar-systems  (ESI liste ucu, filtresiz kök tarama — değişmiyor)
        |  esi_solar_systems_queue            mesaj: düz Int
worker-solar-systems
        |  yazar: solar_systems  (tek satır, tek tablo)
        +--> esi_stars_queue           { starId, solarSystemId }
        +--> esi_stargates_queue       { stargateId, solarSystemId }
        +--> esi_stations_queue        { stationId, solarSystemId }
        +--> esi_planets_queue         { planetId, solarSystemId, orbitIndex,
                                         moonIds[], asteroidBeltIds[] }
                |
        worker-planets
                |  yazar: planets
                +--> esi_moons_queue           { moonId, solarSystemId, planetId, orbitIndex }
                +--> esi_asteroid_belts_queue  { beltId, solarSystemId, planetId, orbitIndex }
                        |
                worker-moons / worker-asteroid-belts
                        yazar: moons / asteroid_belts
```

### Neden hiyerarşik, neden düz fan-out değil

`Moon.planet_id` ve `AsteroidBelt.planet_id` NOT NULL ve `planets` tablosuna
foreign key. Kuyruklar arası sıra garantisi olmadığı için altı kuyruğu birden
beslemek, ay mesajının gezegen mesajından önce işlenmesi durumunda FK ihlali
üretir. Bunu çözmenin alternatifi `planet_id` alanlarını nullable yapmaktı; şemayı
zayıflatıp bağı "sonra doldururuz" durumuna bıraktığı için reddedildi.

Zincirde ay ve kuşak mesajları ancak gezegen satırı yazıldıktan sonra doğar, yani
sıra yapısal olarak garanti ve ek kontrol koduna gerek yok.

### Mesaj sözleşmeleri

Repodaki 28 queue script'inin 19'u zaten JSON mesaj kullanıyor ve ortak zarf
`{ entityId, queuedAt, source }`. Aynı deseni koruyup yükü genişletiyoruz; ek
olarak yeniden deneme sayacı `attempts` taşınıyor.

```ts
// Ortak zarf
interface Envelope {
  queuedAt: string;   // ISO 8601
  source: string;     // 'worker-solar-systems' | 'queue-planets' | ...
  attempts?: number;  // yok sayılırsa 0
}

// esi_solar_systems_queue — DEĞİŞMİYOR, düz Int
// 30000142

interface StarMessage     extends Envelope { starId: number;     solarSystemId: number }
interface StargateMessage extends Envelope { stargateId: number; solarSystemId: number }
interface StationMessage  extends Envelope { stationId: number;  solarSystemId: number }

interface PlanetMessage extends Envelope {
  planetId: number;
  solarSystemId: number;
  orbitIndex: number;
  moonIds: number[];
  asteroidBeltIds: number[];
}

interface MoonMessage extends Envelope {
  moonId: number; solarSystemId: number; planetId: number; orbitIndex: number;
}

interface AsteroidBeltMessage extends Envelope {
  beltId: number; solarSystemId: number; planetId: number; orbitIndex: number;
}
```

`moonIds` ve `asteroidBeltIds` yalnızca gezegen mesajında taşınır ve yalnızca
`worker-planets` tarafından tüketilir; hiçbir tabloya yazılmaz. En kalabalık
sistemde bile mesaj birkaç KB.

### Sahiplik

| Worker | Yazdığı tablo | Bastığı kuyruklar |
|---|---|---|
| `worker-solar-systems` | `solar_systems` | stars, stargates, stations, planets |
| `worker-stars` | `stars` | — |
| `worker-stargates` | `stargates` | — |
| `worker-stations` | `stations` | — |
| `worker-planets` | `planets` | moons, asteroid_belts |
| `worker-moons` | `moons` | — |
| `worker-asteroid-belts` | `asteroid_belts` | — |

Her satırın tek yazarı olduğu için, mevcut koddaki
*"NOTE: none of the child upserts touch `name`"* uyarısı gereksizleşiyor: bir
worker'ın başka bir adımın alanını ezmesi yapısal olarak imkânsız hale geliyor.

`worker-solar-systems` üzerindeki değişiklikler:

- Altı tabloya yazan `$transaction` bloğu ve `timeout: 30000` silinir; yerine tek
  `solarSystem.upsert` gelir.
- `prefetch(1)` ve elle 100 ms uyku kalkar; diğer worker'lar gibi `prefetch(25)`
  kullanılır.
- Ham `axios` yerine `esiRateLimiter` üzerinden çağrı yapılır.

### Yazma sırası ve zincir dayanıklılığı

**Zincir düğümleri önce yazar, sonra zenginleştirir.** `worker-planets` sırası:

1. Mesajdaki verilerle `planets` satırını `upsert` et (`id`, `solar_system_id`,
   `orbit_index` — hepsi zaten otoriter).
2. Ay ve kuşak mesajlarını kuyruklarına bas.
3. `/universe/planets/{id}/` çağır; `name`, `type_id`, `position_*` alanlarını
   güncelle.

Böylece ESI adımı başarısız olsa bile satır ve zincir ayakta kalır; eksik kalan
yalnızca isim olur ve onarım scripti onu `name IS NULL` ile bulur. Bu, eski
tasarımın dayanıklılık özelliğini cross-table transaction olmadan geri kazandırır.

Yaprak worker'lar (`stars`, `stargates`, `stations`, `moons`, `asteroid_belts`)
tek yazımda kalır: onlara bağlı hiçbir şey yoktur ve iki yazım en büyük tabloda
(`moons`) gereksiz maliyet olurdu. Kayıpları DLQ ve kök taramanın yeniden
çalıştırılması karşılar.

### Onarım scriptleri

Mevcut `queue:stars`, `queue:planets`, `queue:moons`, `queue:asteroid-belts`,
`queue:stargates`, `queue:stations` scriptleri silinmiyor. Normal akışın parçası
olmaktan çıkıp onarım aracına dönüşüyorlar: `WHERE name IS NULL` ile eksik
satırları bulup aynı JSON sözleşmesiyle yeniden kuyruğa basıyorlar. Gezegen
onarımında `moonIds` / `asteroidBeltIds` veritabanından okunabiliyor, çünkü
`moons.planet_id` ve `asteroid_belts.planet_id` zaten kayıtlı; ESI'ye dönmeye
gerek yok.

## Veri bütünlüğü

### Kural

**Foreign key yalnızca aynı pipeline'ın doldurduğu tablolar arasında kurulur.**
Başka bir pipeline'ın yazdığı tabloya FK koymak iki ingest'i birbirine kilitler ve
bu tasarımda kaldırılan bağımlılığın aynısını şema katmanında geri getirir.
Cross-pipeline alanlar FK yerine düzenli bütünlük kontrolüyle korunur.

### Korunan FK'ler

`stars`, `planets`, `moons`, `asteroid_belts`, `stargates`, `stations` →
`solar_systems`, hepsi `ON DELETE CASCADE`. `stars.solar_system_id` `UNIQUE`
kalır (sistem başına tek yıldız).

### Yeni 1 — ay/kuşak ile gezegen arasındaki sistem tutarlılığı

Bugün `moons` hem `solar_system_id` hem `planet_id` taşıyor ve hiçbir kısıt
ikisinin uyuşmasını zorlamıyor: bir ay A sisteminde görünüp B sistemindeki bir
gezegene bağlı olabilir. Denormalize kolon korunmalı, çünkü
`backend/src/resolvers/solar-system/topology-fields.ts:48-49` sistem başına ay ve
kuşak sayısını doğrudan oradan sayıyor. Bu yüzden tutarsızlığı bileşik FK ile
imkânsız kılıyoruz.

Prisma tarafı:

```prisma
model Planet {
  // ...
  @@unique([id, solar_system_id])
}

model Moon {
  // ...
  planet Planet @relation(fields: [planet_id, solar_system_id],
                          references: [id, solar_system_id],
                          onDelete: Cascade)
}
```

`prisma validate` ile doğrulandı. Üretilen DDL:

```sql
CREATE UNIQUE INDEX "planets_planet_id_solar_system_id_key"
  ON "planets"("planet_id", "solar_system_id");

ALTER TABLE "moons" DROP CONSTRAINT "moons_planet_id_fkey";
ALTER TABLE "moons" ADD CONSTRAINT "moons_planet_id_solar_system_id_fkey"
  FOREIGN KEY ("planet_id", "solar_system_id")
  REFERENCES "planets"("planet_id", "solar_system_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

`asteroid_belts` için birebir aynısı uygulanır.

### Yeni 2 — geçit hedefleri

`stargates.destination_system_id` bugün FK'sız düz `Int?`. FK ekleniyor, ama
`ON DELETE SET NULL` ile: bir sistem silindiğinde ona bakan *başka* sistemlerdeki
geçitler silinmemeli, yalnızca hedefleri boşalmalı.

Sıra kısıtı doğal işletim düzeniyle çözülür — `worker-solar-systems` kuyruğunu
bitirdiğinde bütün sistem satırları mevcuttur, `worker-stargates` ondan sonra
başlatılırsa FK hiç tetiklenmez. Eşzamanlı çalıştırılırsa FK ihlali yeniden
denenebilir hata sayılır ve mesaj requeue edilir; hedef sistem geldiğinde geçer.

`destination_stargate_id`'ye FK **konmuyor**: hedef geçit satırını da aynı worker
yarattığı için kuyruğun kendi içinde sık tetiklenen bir sıra bağımlılığı doğardı.

### Yeni 3 — cross-pipeline alanlar

`stations.owner_corporation_id`, `stations.race_id` ve `planets` / `moons` /
`stars` / `stargates` / `stations` üzerindeki `type_id` alanları başka
pipeline'ların doldurduğu tablolara işaret ediyor. Kural gereği FK konmuyor.
Yerine `yarn doctor:topology` scripti bu referansları sorgulayıp raporluyor:

- öksüz `type_id`, öksüz `owner_corporation_id`, öksüz `race_id`
- hedefi çözülememiş geçitler
- `name IS NULL` kalan satır sayıları, tablo bazında
- `esi_topology_dlq` derinliği

### Yazma güvenliği

- Tablo başına tek yazar.
- Her yazım PK üzerinden `upsert`; PostgreSQL'de `ON CONFLICT DO UPDATE`'e
  derlenir, atomiktir. Aynı mesajın iki kez işlenmesi ya da kök taramanın yeniden
  çalıştırılması güvenlidir.
- `CHECK` kısıtı eklenmiyor. `orbit_index > 0` cazip olsa da Prisma `CHECK`'i
  modellemiyor; elle SQL ile eklenirse `prisma migrate diff` onu drift sayar ve
  CLAUDE.md'de anlatılan "beş tablo" tuzağının aynısı üretilir. Kural worker
  içinde doğrulanır, ihlal loglanır.

## İndeksler

İlke: her indeks gerçekten çalışan bir sorguyu karşılasın. Bu pipeline yazma
ağırlıklı olduğu için kullanılmayan indeks doğrudan ingest maliyetidir. Plan
büyük ölçüde bir değiş tokuş: mevcut tekil indeksler, aynı sorguyu daha iyi
karşılayan bileşiklerle değiştiriliyor. Tek net ekleme, bileşik FK'nın zorunlu
kıldığı `planets` üzerindeki `UNIQUE (id, solar_system_id)` — o da hem `moons`
hem `asteroid_belts` FK'sına birden hizmet ediyor.

Dayandığı sorgular: `backend/src/services/dataloaders.ts:1022-1100` (loader'lar) ve
`backend/src/resolvers/solar-system/topology-fields.ts:41-52` (`counts`, her sistem
detay sayfasında altı tabloda `WHERE solar_system_id = X`).

| Tablo | Kaldırılan | Eklenen | Gerekçe |
|---|---|---|---|
| `planets` | `(solar_system_id)` | `(solar_system_id, orbit_index, id)` | `planetsBySystem`: `WHERE solar_system_id IN (...) ORDER BY orbit_index, id`. Sıralama indeksten gelir; `counts` sayımı soldan önekle karşılanır. |
| `planets` | — | `UNIQUE (id, solar_system_id)` | Bileşik FK'nın hedefi; aynı zamanda indeks. |
| `moons` | `(planet_id)` | `(planet_id, orbit_index, id)` | `moonsByPlanet`'ın filtre + sıralamasının tamamı. Eski indeks bunun soldan öneki. |
| `moons` | — | `(solar_system_id)` korunuyor | `counts` sayımı; yeni bileşiğin öneki değil. |
| `asteroid_belts` | `(planet_id)` | `(planet_id, orbit_index, id)` | `moons` ile aynı. `(solar_system_id)` korunuyor. |
| `stations` | `(solar_system_id)` | `(solar_system_id, id)` | `stationsBySystem` `ORDER BY id`; sayım da aynı indeksten. |
| `stargates` | `(solar_system_id)` | `(solar_system_id, id)` | `stargatesBySystem` `ORDER BY id`. |
| `stargates` | — | `(destination_system_id)` korunuyor | Bugün hiçbir sorgu filtrelemiyor, ama yeni `ON DELETE SET NULL` FK'sı gerekli kılıyor: indekssiz silme bu tabloda tam tarama yapar. |
| `stars` | — | değişiklik yok | `solar_system_id` zaten `UNIQUE`; `starBySystem` onu kullanıyor. |

**İsim indeksi eklenmiyor.** İki aday kullanım da bugün gerçek değil: onarım
scriptlerinin `WHERE name IS NULL` taraması elle ve seyrek çalışıyor (tam tarama
katlanılabilir, üstelik doğru araç olan kısmi indeksi Prisma modellemiyor), ve
uygulamada gök cismi adına göre arama yok. Tetikleyici net: kullanıcıya istasyon
veya gezegen adı araması açılırsa, doğru çözüm `@@index([name])` değil `pg_trgm` +
GIN olur ve kendi migration'ı olarak ayrı planlanmalıdır.

## Hata ve yeniden deneme

Bugünkü worker'lar beklenmeyen hatada `channel.nack(msg, false, false)` çağırıyor;
bu mesajı tamamen atar. Mevcut tasarımda katlanılabilir çünkü iskelet satırı
veritabanında duruyor. Yeni tasarımda satır henüz yok, dolayısıyla atılan mesaj
hiç var olmamış bir gök cismi demek. Bu bölüm o boşluğu kapatıyor.

| Durum | Davranış |
|---|---|
| **404** | ID ESI'de ölü. Satırı mesajdaki verilerle yaz (`name: null`), `ack` et. Gezegense çocuklarını yine de bas. |
| **420 / error-limit** | 60 s bekle, `nack(requeue)`. Mevcut davranış korunuyor. |
| **FK ihlali** (Prisma `P2003`) | Yeniden denenebilir: ebeveyn satırı henüz gelmemiştir. `attempts` artırılıp yeniden publish edilir. |
| **Diğer** (5xx, timeout, beklenmeyen) | `attempts` artırılıp yeniden publish edilir. |
| **`attempts` > 5** | Mesaj `esi_topology_dlq` kuyruğuna publish edilip `ack` edilir. Asla sessizce atılmaz. |

`attempts` mesaj zarfında taşınır ve requeue yerine yeniden publish ederek artırılır.

**DLQ, RabbitMQ'nun `x-dead-letter-exchange`'i ile değil, worker'dan elle publish
edilerek kuruluyor.** Sebep somut: queue argümanlarını değiştirmek,
`ensureAllQueuesExist()`'in `x-max-priority: 10` ile açtığı mevcut kuyruklarla
çakışır ve CLAUDE.md'de kayıtlı `406 PRECONDITION_FAILED` hatasını üretir — o hata
PR #135'te üç worker'ı başlatılamaz hâle getirmişti.

## Kuyruk kaydı

`ALL_QUEUES` listesine yedi kuyruk eklenir:

```text
esi_stars_queue
esi_planets_queue
esi_moons_queue
esi_asteroid_belts_queue
esi_stargates_queue
esi_stations_queue
esi_topology_dlq
```

Böylece `ensureAllQueuesExist()` hepsini doğru argümanlarla açılışta oluşturur ve
`workerStatus` sorgusu derinliklerini raporlar.

## Geçiş planı

1. **Migration öncesi zorunlu kontroller.** Bileşik FK, mevcut veride tutarsızlık
   varsa uygulanamaz:

   ```sql
   -- ayın sistemi, gezegeninin sistemiyle uyuşmuyor mu?
   SELECT COUNT(*) FROM moons m
     JOIN planets p ON p.planet_id = m.planet_id
    WHERE m.solar_system_id <> p.solar_system_id;   -- 0 olmalı

   -- aynısı asteroid_belts için
   SELECT COUNT(*) FROM asteroid_belts b
     JOIN planets p ON p.planet_id = b.planet_id
    WHERE b.solar_system_id <> p.solar_system_id;   -- 0 olmalı

   -- hedefi var olmayan bir sisteme işaret eden geçit
   SELECT COUNT(*) FROM stargates s
     LEFT JOIN solar_systems ss ON ss.id = s.destination_system_id
    WHERE s.destination_system_id IS NOT NULL AND ss.id IS NULL;  -- 0 olmalı
   ```

   Sıfır değilse migration öncesi bir düzeltme adımı gerekir. Düzeltmenin yönü
   veriye bakılarak belirlenir; bu spec onu şimdiden kestirmiyor.

2. **Şema migration'ı.** Veri bütünlüğü ve indeks değişikliklerinin tamamı tek
   migration. CLAUDE.md prosedürü zorunlu: satır sayımlarını kaydet,
   `prisma migrate diff` ile üret, çıktıdaki her `DROP TABLE`'ı elle sil,
   `migrate deploy` ile uygula, `prisma generate` çalıştır, satır sayımlarını
   yeniden karşılaştır. `prisma migrate dev` yasak.

3. **Kuyrukları boşalt.** Mesaj formatı düz `Int`'ten JSON'a geçiyor ve geriye
   dönük uyumluluk mümkün değil (düz integer `solar_system_id` taşımıyor). Deploy
   öncesi altı kuyruğun `messageCount = 0` olduğu doğrulanır — `workerStatus`
   sorgusu veya `checkQueue`.

4. **Mevcut veri yeniden çekilmez.** Üretimdeki topoloji satırları yerinde kalır;
   bütün yazımlar PK üzerinden `upsert` olduğu için yeni worker'larla uyumlu. Kök
   taramanın yeniden çalıştırılması isteğe bağlı ve güvenli.

## Doğrulama

- `yarn workspace backend build` — GraphQL şeması değişmediği için codegen gerekmiyor.
- Local PostgreSQL üzerinde tam bir tur: `queue:solar-systems` → altı worker →
  satır sayıları ve `counts` alanının tutarlılığı.
- `yarn doctor:topology` çıktısı: öksüz referanslar, `name IS NULL` kalanlar,
  DLQ derinliği.
- Silinen kod doğrulaması: `worker-solar-systems` içinde `$transaction` ve
  `timeout: 30000` kalmamalı.
- `workerStatus` sorgusunun yedi yeni kuyruğu raporladığı doğrulanmalı.

## Riskler ve açık konular

- **Migration öncesi kontroller sıfır dönmezse** geçiş durur ve düzeltme ayrı
  karar gerektirir. Bu, planın bilinen tek koşullu adımı.
- **Zincir gecikmesi.** Ay ve kuşak satırları bir hop sonra doğar. Statik veri için
  önemsiz, ama kök taramanın "bitti" anlamı artık "sistem kuyruğu boşaldı" değil,
  "altı kuyruk birden boşaldı" olur. Operasyon dokümanı buna göre güncellenmeli.
- **DLQ biriktiği fark edilmezse** kayıp sessiz kalır. `doctor:topology` çıktısına
  DLQ derinliği bu yüzden dahil edildi.

## Etkilenen dosyalar

| Dosya | Değişiklik |
|---|---|
| `backend/src/workers/worker-solar-systems.ts` | Transaction silinir, tek upsert + dört kuyruğa publish |
| `backend/src/workers/worker-planets.ts` | Satır yazımı + iki kuyruğa publish + zenginleştirme |
| `backend/src/workers/worker-{stars,moons,asteroid-belts,stargates,stations}.ts` | JSON mesaj, `update` yerine `upsert`, yeni hata/DLQ deseni |
| `backend/src/queues/queue-{stars,planets,moons,asteroid-belts,stargates,stations}.ts` | Onarım aracına dönüşür, JSON mesaj basar |
| `backend/src/services/rabbitmq.ts` | `ALL_QUEUES` + yedi kuyruk |
| `backend/prisma/schema/{planet,moon,asteroidBelt,stargate,station}.prisma` | Bileşik FK, `UNIQUE`, indeks değişiklikleri |
| `backend/prisma/migrations/<yeni>/migration.sql` | Elle denetlenmiş migration |
| `backend/src/scripts` veya `backend/src/workers/doctor-topology.ts` | Yeni bütünlük kontrol scripti |
| `backend/package.json` | `doctor:topology` script'i |
| `backend/docs/workers/` | Yeni akışın dokümantasyonu |
