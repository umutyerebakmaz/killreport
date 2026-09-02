# Most Valuable Carousels + `killmail_filters` Tamiri (Tasarım)

**Tarih:** 2026-09-02
**Dal:** `feature/most-valuable-carousels`
**Durum:** Tasarım — kullanıcı incelemesi bekleniyor

---

## 1. Kapsam

Killmails sayfasındaki (`frontend/src/app/killmails/page.tsx`) "Most Valuable Ships" ve
"Most Valuable Structures" şeritlerini ele almakla başladık. Mevcut kodu ve veritabanını
incelerken şeritlerden bağımsız, daha ağır bir arıza çıktı: `killmail_filters`
tablosundaki `region_id` ve `constellation_id` kolonları beş aydır boş yazılıyor. Bu
yüzden iş ikiye ayrıldı.

|          | İş                                                          | Bağımlılık |
| -------- | ----------------------------------------------------------- | ---------- |
| **İş 1** | `killmail_filters` tamiri ve zenginleştirmesi               | —          |
| **İş 2** | Sekmeli "Most Valuable" carousel'ı, bağımsız bileşen olarak | İş 1       |
| **İş 3** | `worker-redisq-stream` üzerinde iki küçük düzeltme          | —          |

İş 1 tek başına ana killmail listesinin region/constellation filtrelerini onarır; İş 2
onun üstüne oturur. İş 3, İş 1 için zaten dokunulacak olan ingest yolunda yapılan iki
ufak düzeltmedir (§6). Plan aşamasında bu sırayla uygulanacaklar.

---

## 2. Teşhis

Bütün sayılar 2026-09-02'de yerel veritabanında doğrulandı. Canlı ingest çalıştığı için
toplamlar ölçümler arasında birkaç yüz satır büyüdü; oranlar değişmiyor.

### 2.1 `killmail_filters`'ta region/constellation boş — %85

`killmail_filters`'ın 44.493 satırının **37.781'inde (%85)** `region_id` ve
`constellation_id` NULL. Aylara göre:

| ay      | satır  | NULL region |
| ------- | ------ | ----------- |
| 2026-04 | 18     | 18          |
| 2026-05 | 199    | 199         |
| 2026-06 | 534    | 534         |
| 2026-07 | 11.234 | 11.234      |
| 2026-08 | 23.739 | 23.739      |
| 2026-09 | 2.053  | 2.053       |

2026-04'ten beri dolu tek satır yok.

**Kök neden.** Tablo `killmail_filters_mv` adlı bir materialized view olarak doğdu
(`prisma/migrations/20260215010000_add_killmail_filters_materialized_view/`); orada iki
alan join'den hesaplanıyordu:

```sql
LEFT JOIN solar_systems ss ON k.solar_system_id = ss.system_id
LEFT JOIN constellations c ON ss.constellation_id = c.constellation_id
```

2026-02-26'da view gerçek tabloya çevrildi
(`20260226000000_convert_killmail_filters_mv_to_table/`) ve tazeleme, her killmail
kaydedilirken çalışan `insertKillmailFilter()`'a taşındı
(`backend/src/services/killmail-filters-realtime.ts`). Taşıma yarım kaldı: yeni SQL bu
iki alanı join'den değil **çağırandan** bekliyor —

```ts
// killmail-filters-realtime.ts:53-54
${data.constellation_id || null}::int as constellation_id,
${data.region_id || null}::int as region_id,
```

— ve `KillmailFilterData` arayüzünde ikisi de opsiyonel (`:25-26`). Dört çağıranın
**hiçbiri** bunları göndermiyor:

- `backend/src/workers/worker-redisq-stream.ts:698`
- `backend/src/workers/worker-killmails.ts:248`
- `backend/src/workers/worker-zkillboard-sync.ts:275`
- `backend/src/workers/worker-esi-corporation-killmails.ts:319`

Sonuç her zaman NULL. Aynı SQL `security_status`'ü doğru yapıyor, çünkü onu
`LEFT JOIN solar_systems`'ten alıyor (`:100`) — join zaten orada, bir adım ötesine
uzatılmamış.

**Etkisi.** Ana killmail listesinin region ve constellation filtreleri
`filtersMaterialized` üzerinden bu kolonları sorguluyor
(`backend/src/resolvers/killmail/filters-materialized.ts:113-125`), dolayısıyla son beş
ayın verisinde sessizce boş dönüyorlar. Ölçüm — The Forge (10000002), son 7 gün:

| kaynak                                           | sonuç   |
| ------------------------------------------------ | ------- |
| `killmail_filters.region_id` (filtrenin gördüğü) | **0**   |
| join ile hesaplanan gerçek                       | **519** |

`idx_kmfilters_region_time`, `idx_kmfilters_region` ve `idx_kmfilters_constellation`
index'leri mevcut; beş aydır boş bir kolonu index'liyorlar.

**Tamamen kurtarılabilir.** Backfill simüle edildi: join zinciri 44.493 satırın hepsini
dolduruyor, geriye tek NULL kalmıyor. NULL `security_status` taşıyan 116 satır da aynı
şekilde düzeliyor — bunlar killmail'i kaydedilirken solar sistemi henüz veritabanında
olmayan ve `ON CONFLICT DO NOTHING` yüzünden bir daha ziyaret edilmeyen satırlar.

### 2.2 `refresh_log` ölü

`refresh_log` (eski adı `materialized_view_refresh_log`,
`20260225120000_add_materialized_view_refresh_tracking/`) duruyor ama kullanılmıyor:
içindeki tek kayıt 2026-07-02 seed'i, `last_incremental_refresh_at` hiç dolmamış ve
`backend/src` içinde tabloyu okuyan veya yazan tek satır yok. Periyodik refresh
mekanizması, view tabloya çevrilirken realtime insert lehine terk edilmiş. Bu spec
tabloya dokunmuyor; sadece "hâlâ periyodik refresh var" varsayımının geçersiz olduğunu
kayda geçiriyor.

### 2.3 Tablonun bütünlüğü sağlam

- `killmails`'te olup `killmail_filters`'ta olmayan satır: **0**
- `killmail_filters`'ta olup `killmails`'te olmayan öksüz satır: **0**
- `victim_ship_type_id` NULL olan satır: **0**
- `victim_ship_type_id`'si `types` tablosunda çözülmeyen satır: **0**

Yani realtime insert yolu, region/constellation dışında doğru çalışıyor.

### 2.4 Tablo carousel'ın iki kritik kolonundan yoksun

| carousel'ın ihtiyacı                             | `killmail_filters`        |
| ------------------------------------------------ | ------------------------- |
| `killmail_time` (7 gün penceresi)                | var, `idx_kmfilters_time` |
| `attacker_count` (solo)                          | var                       |
| `victim_ship_type_id`                            | var                       |
| **`total_value`** (sıralama ölçütü)              | **yok**                   |
| **victim gemisinin `group_id`** (kapsam yordamı) | **yok**                   |

`queries.ts:121`'deki _"total_value not in killmail_filters"_ notu bunun kaydı.
Grup filtresi için `filters-materialized.ts:52-60` her istekte ayrıca bir
`prisma.type.findMany` çalıştırıp grup ID'lerini type ID'lerine açıyor.

### 2.5 Mevcut carousel'ların kusurları

**Ships şeridi client-side filtreliyor.** `page.tsx:118-140` değere göre 50 killmail
çekip structure ve capsule'leri JavaScript'te eleyip `.slice(0, 20)` yapıyor. Bugün
zararsız — son 7 günün en değerli 50 killmail'inde yalnızca 1 structure ve 4 capsule var,
geriye 45 aday kalıyor. Ama gizli bir arıza: büyük savaş haftasında top-50'nin büyük
bölümü structure olur ve şerit sessizce kısalır. CLAUDE.md'nin "fetch everything and
filter in JavaScript" yasağına da giriyor.

**Structures şeridi saldıran tarafı da sayıyor.** `filtersMaterialized`, `victim` /
`attacker` bayrağı verilmediğinde `shipGroupIds`'i **victim OR attacker** olarak uyguluyor
(`filters-materialized.ts:66-79`); carousel bayrak göndermiyor. Mail'de saldıran olarak
bir Keepstar bulunan bir Titan kaybı "Most Valuable Structures" şeridine girebiliyor.

**Tarih filtresi ID listesine inmiyor.** `filtersMaterialized` `startDate`/`endDate`'i hiç
kullanmıyor (`:22-37`); tarih ancak ikinci sorguda `killmails` üzerinde uygulanıyor.
Structures şeridi bugün tüm zamanların structure killmail ID'lerinin tamamını çekip
`ANY($1::int[])`'e basıyor, sonra 7 güne indiriyor.

**İki şerit de ağır dokümanı kullanıyor.** `frontend/src/graphql/Killmails.graphql:52-67`
her killmail'in tüm `attackers` dizisini çekiyor; kart bunu kullanmıyor. Structure
kill'lerinde killmail başına binlerce attacker demek.

**`KillmailCarousel` kaydırma kusurları.** `canScrollRight` `true` başlatılıyor ve mount'ta
hiç hesaplanmıyor (`KillmailCarousel.tsx:32`), dolayısıyla içerik taşmasa bile sağ ok
aktif görünüyor. Kaydırma miktarı 400 px (`:44`), kart adımı ise `w-80` + `gap-4` = 336 px
(`:117`); her tıklamada kartlar kayık kalıyor.

### 2.6 Değer filtresi neden doğru çalışıyor

`minValue`/`maxValue` hiçbir zaman `killmail_filters`'a sorulmuyor; değer yordamı her
koşulda `killmails` tablosunda değerlendiriliyor. İki yol var
(`queries.ts:83-96` seçiyor):

- **Yol A — yalnızca değer filtresi.** Varlık filtresi yoksa `else` dalına düşülüyor
  (`queries.ts:266`), `killmail_filters`'a hiç dokunulmuyor: düz Prisma
  `findMany` + `where.total_value` + sayfalama + sıralama tek sorguda
  (`:269-329`).
- **Yol B — değer + varlık filtresi birlikte.** `filtersMaterialized` yalnızca "hangi
  killmail'ler" sorusunu cevaplıyor; değer yordamı ikinci sorguda `killmails`'e
  uygulanıyor (`:130-146`) ve `totalCount` da `killmails` üzerinden yeniden sayılıyor
  (`:177-186`).

Doğruluk sorunu yok. Yol B'nin maliyeti, sayfalamadan önce eşleşen ID'lerin tamamının
belleğe alınması. Bugün en kötü ihtimalle ~44 bin integer; ölçek büyüdükçe sorun olur.
**Bu spec Yol B'yi değiştirmiyor** (bkz. §6).

### 2.7 Veri hacmi — carousel kapsamlarını belirleyen sayılar

Son 7 gün, 16.795 killmail:

| kapsam                           | adet   |
| -------------------------------- | ------ |
| structure kaybı                  | **48** |
| capital kaybı                    | **21** |
| capsule                          | 4.676  |
| solo (structure + capsule hariç) | 4.340  |

Capitals şeridi için 20 kart, o haftanın capital kayıplarının neredeyse tamamı demek.
Sakin bir haftada şerit 8 karta düşer. Bu kabul edilen bir davranış (§3).

Ayrıca `killmails`'in 44.227 satırının **6.712'sinde (%15)** `total_value` NULL —
`worker-backfill-values.ts` işini bitirmemiş. Son 7 günde NULL değer yok, dolayısıyla
carousel'lar bundan etkilenmiyor; ama §4.5'teki senkron yükümlülüğünün sebebi bu.

---

### 2.8 `worker-redisq-stream` incelemesi

Canlı ingest yolu baştan sona okundu ve R2Z2 payload'ı canlı olarak çekilip
`KillmailDetail` arayüzüyle karşılaştırıldı.

**Sonuç: ingest yolu sağlam.** 45.035 mail eksiksiz yazılmış, kayıp yok, öksüz satır yok
(§2.3). Aşağıdaki maddeler arıza değil, iyileştirme fırsatı ve kayda geçirilen gözlem.

**R2Z2 payload'ı tam ESI killmail'ini içeriyor ve atılıyor.** Canlı örnek:

```text
top-level: ['killmail_id', 'hash', 'esi', 'zkb', 'uploaded_at', 'sequence_id']
esi:       ['attackers', 'killmail_id', 'killmail_time', 'solar_system_id', 'victim']
victim:    ['alliance_id','character_id','corporation_id','damage_taken',
            'items','position','ship_type_id']
```

Bu, `services/killmail/killmail.service.ts:14-44`'teki `KillmailDetail` arayüzünün
birebir karşılığı. `pollR2Z2` `data.esi`'yi döndürmüyor (`:220-223`; tipi `esi: unknown`,
`:64`) ve `processKillmail` ESI'ya yeniden gidiyor (`:247`). Kod bunu bilinçli yapıyor —
yorumu _"kept for identical downstream shape"_ (`:16`) — ve bu savunulabilir bir tercih.
Kazanç mütevazı: ESI bütçesi 50 req/sn, gerçekleşen hız saatte ~950 mail, yani istek
bütçede görünmüyor. Tek somut etkisi killmail başına işlem süresi.

**Değerler kayıt anında bir kez hesaplanıyor.** `calculateKillmailValues`
`market_prices.sell`'e bakıyor (`helpers/calculate-killmail-values.ts:105`); fiyatlar tip
başına `esi_type_price_queue` üzerinden geliyor (`worker-prices.ts:14`). Fiyatı henüz
çekilmemiş bir tip 0 üretiyor ve değer bir daha güncellenmiyor.

| `killmails.total_value` | adet   | oran |
| ----------------------- | ------ | ---- |
| NULL                    | 6.712  | %15  |
| 0                       | 8.483  | %19  |
| > 0                     | 29.840 | %66  |

Son 7 günde **50 structure kaybının 21'i (%42) sıfır değerli.** Örnek: Amarr Control
Tower Small (type 20060) — 18 sıfır değerli kayıp, oysa güncel `sell` fiyatı
126.700.000 ISK. Payload'daki `zkb.totalValue` bu boşluğu taşımıyor ama kullanılmıyor.
Bu, İş 2'nin sıralama ölçütünü doğrudan etkiler; kapsam dışı bırakılma gerekçesi §7'de.

**`victims.faction_id` hep null.** `worker-redisq-stream.ts:632` koşulsuz `faction_id:
null` yazıyor; kolon var, `KillmailDetail.victim.faction_id` var (`:22`), ESI gönderiyor.
45.035 victim satırının 0'ı dolu.

**Döngü hızı yeterli.** Worker seri çalışıyor (`:126-133`), ölçülen hız saatte ~950 mail.
2026-09-02 ölçümü: 17:00'de 21,8 saat olan ortalama gecikme dört saatte 10,7 dakikaya
inmiş. 08-31 ve 09-01'de hiç satır yok — gecikme darboğaz değil, worker'ın kapalı kaldığı
sürenin birikmesi; açılınca kendiliğinden kapanıyor. PM2 altında sürekli çalışırken böyle
bir birikim oluşmaz. Bu yüzden seri döngü ve satır içi enrichment bu spec'te ele
alınmıyor (§7).

**Redis önbelleği ingest yolunda yok, olmasına da gerek yok.**
`plugins/response-cache.plugin.ts` yalnızca `src/server.ts` tarafından import ediliyor;
API sürecinde yaşar, worker süreçlerine hiç uğramaz. `src/workers/` altındaki hiçbir dosya
Redis'i import etmiyor. Killmail çekiminde önbellek zaten işe yaramaz — her killmail ID +
hash ömründe bir kez çekilir, ikinci istek yoktur. Tekrar eden şey entity'lerdir ve orada
`enrichMissingEntities` doğru olanı yapıyor: önce `findMany` ile veritabanında hangi
ID'lerin bulunduğuna bakıp yalnızca eksikleri çekiyor (`:337-380`). Önbellek görevini
veritabanı görüyor.

---

## 3. Kararlar

Tasarım görüşmesinde netleşenler:

1. **Dört kapsam:** Ships, Structures, Capitals, Solo.
2. **Ships capital'ları içerir.** Ships = structure ve capsule dışında her şey. Capitals
   onun bir alt kümesi; şeritler arası örtüşme kabul ediliyor, çünkü Ships şeridi
   "haftanın en büyük kaybı" olarak okunmalı.
3. **Sabit 7 gün, 20 kart** — dört kapsam için de aynı pencere.
4. **Capitals 7 günde kalır**, kısa şerit normal karşılanır.
5. **Sekmeli tek şerit** — dört ayrı şerit değil, tek gövde üstünde dört sekme.
6. **`killmail_filters`'a hem `victim_ship_group_id` hem `total_value` eklenir.**
7. **Yol B bu işe dahil değil** (§7).
8. **Carousel bağımsız bir bileşendir.** Veri çekmesiyle birlikte kendi dizininde durur;
   `page.tsx` yalnızca onu yerleştirir.
9. **`worker-redisq-stream`'e yalnızca iki düzeltme girer** (§6): `data.esi`'nin
   kullanılması ve `victims.faction_id`. Bunlar, İş 1 için zaten aynı dosyaya
   dokunulacağı için birlikte yapılır.
10. **Değer meselesine (§2.8) bu işte dokunulmaz.** Gerekçe §7.

---

## 4. İş 1 — `killmail_filters` tamiri ve zenginleştirmesi

### 4.1 Kök nedeni düzelt

`backend/src/services/killmail-filters-realtime.ts`:

- `KillmailFilterData` arayüzünden `constellation_id` ve `region_id` çıkarılır. Dört
  çağıranın hiçbiri bunları göndermediği için çağıran taraflarda değişiklik gerekmez.
- SQL'deki `${data.constellation_id || null}` / `${data.region_id || null}` ifadeleri
  join'den türetilen değerlerle değiştirilir. Join zinciri `security_status`'ün bugünkü
  deseninin devamı:

```sql
FROM data_row d
LEFT JOIN solar_systems  ss ON ss.system_id       = d.solar_system_id
LEFT JOIN constellations c  ON c.constellation_id = ss.constellation_id
LEFT JOIN types          t  ON t.id               = d.victim_ship_type_id
LEFT JOIN killmails      k  ON k.killmail_id      = d.killmail_id
```

Alınan kolonlar: `ss.constellation_id`, `c.region_id`, `ss.security_status`,
`ss.security_class`, `t.group_id`, `k.total_value`.

`insertKillmailFilter` transaction commit ettikten sonra çağrıldığı için
(`worker-redisq-stream.ts:698`, transaction `:695`'te kapanıyor) `killmails` satırı ve
`total_value` o anda görünürdür.

### 4.2 İki yeni kolon

| kolon                  | tip                | kaynak                  | bayatlama riski                                 |
| ---------------------- | ------------------ | ----------------------- | ----------------------------------------------- |
| `victim_ship_group_id` | `INT`              | `types.group_id`        | yok — bir type'ın grubu değişmez                |
| `total_value`          | `DOUBLE PRECISION` | `killmails.total_value` | var — ikinci yazarı `worker-backfill-values.ts` |

`total_value`'nun bakım borcu açıkça kabul ediliyor (§4.5). Tablo `security_status`'ü
zaten aynı sınıfta denormalize ediyor ve onu hiçbir şey güncellemiyor; `total_value` bu
riski yeni getirmiyor, görünür kılıyor.

### 4.3 `ON CONFLICT` davranışı

`DO NOTHING` yerine, yalnızca türetilmiş kolonları ve yalnızca eksikse dolduran hedefli
bir `DO UPDATE`:

```sql
ON CONFLICT (killmail_id) DO UPDATE SET
  constellation_id     = EXCLUDED.constellation_id,
  region_id            = EXCLUDED.region_id,
  security_status      = EXCLUDED.security_status,
  security_class       = EXCLUDED.security_class,
  victim_ship_group_id = EXCLUDED.victim_ship_group_id,
  total_value          = EXCLUDED.total_value
WHERE killmail_filters.region_id       IS NULL
   OR killmail_filters.security_status IS NULL
   OR killmail_filters.total_value     IS NULL
```

Attacker dizilerine, victim kimliklerine ve `killmail_time`'a dokunmuyor. Sistem verisi
geç gelen satırlar (bugün 116 tane) yeniden işlendiklerinde kendilerini onarır.

### 4.4 Migration

`killmail_filters`, CLAUDE.md'de sayılan beş korumasız tablodan biri — `prisma/schema/`
altında modeli yok ve olmayacak. Migration elle yazılır, `prisma migrate deploy` ile
uygulanır. `prisma migrate dev` **kullanılmaz**.

```sql
ALTER TABLE killmail_filters
  ADD COLUMN victim_ship_group_id INT,
  ADD COLUMN total_value          DOUBLE PRECISION;

-- Konum ve güvenlik. Tüm satırlarda çalışır (idempotent); NULL olan
-- 37.781 region/constellation ve 116 security_status satırını doldurur.
UPDATE killmail_filters f
SET constellation_id = ss.constellation_id,
    region_id        = c.region_id,
    security_status  = ss.security_status,
    security_class   = ss.security_class
FROM solar_systems ss
LEFT JOIN constellations c ON c.constellation_id = ss.constellation_id
WHERE ss.system_id = f.solar_system_id;

UPDATE killmail_filters f
SET victim_ship_group_id = t.group_id
FROM types t
WHERE t.id = f.victim_ship_type_id;

UPDATE killmail_filters f
SET total_value = k.total_value
FROM killmails k
WHERE k.killmail_id = f.killmail_id;

CREATE INDEX idx_kmfilters_victim_group_time
  ON killmail_filters(victim_ship_group_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_time_value
  ON killmail_filters(killmail_time DESC, total_value DESC);
```

Migration'da tek bir `DROP` veya `DELETE` yoktur; yalnızca `ADD COLUMN`, `UPDATE` ve
`CREATE INDEX` vardır. Satır sayısı değişmez.

### 4.5 Backfill worker senkronu

`backend/src/workers/worker-backfill-values.ts:154-160` killmail'in değerini
güncelledikten sonra `killmail_filters.total_value`'yu da güncellemek zorundadır.
`prismaWorker.$executeRaw` ile tek satırlık bir `UPDATE`, aynı `killmail_id` üzerinde.
Bu, `total_value` denormalizasyonunun bedeli ve kalıcı bir yükümlülüktür.

---

## 5. İş 2 — Sekmeli "Most Valuable" carousel'ı

### 5.1 Backend

Yeni şema dosyası `backend/src/schemas/MostValuable.graphql`:

```graphql
enum MostValuableScope {
  SHIPS
  STRUCTURES
  CAPITALS
  SOLO
}

extend type Query {
  "Top killmails by ISK value in a trailing window. Victim side only."
  mostValuableKillmails(
    scope: MostValuableScope!
    days: Int = 7
    limit: Int = 20
  ): [Killmail!]!
}
```

Grup ID'leri `backend/src/config/ship-groups.ts` altında tanımlanır (structure, capsule,
capital kümeleri). Frontend'deki `frontend/src/utils/shipGroups.ts` yerinde kalır;
`KillmailFilters` bileşeni onu kullanmaya devam eder.

Servis `backend/src/services/killmail/most-valuable.service.ts` — tek tabloda tek sorgu,
join yok:

```sql
SELECT killmail_id, killmail_time, solar_system_id, total_value, attacker_count
FROM killmail_filters
WHERE killmail_time >= $1
  AND total_value IS NOT NULL
  AND <scope yordamı>
ORDER BY total_value DESC
LIMIT $2
```

| scope        | yordam                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| `SHIPS`      | `victim_ship_group_id NOT IN (structure ∪ capsule)`                        |
| `STRUCTURES` | `victim_ship_group_id IN (structure)`                                      |
| `CAPITALS`   | `victim_ship_group_id IN (capital)`                                        |
| `SOLO`       | `attacker_count = 1 AND victim_ship_group_id NOT IN (structure ∪ capsule)` |

`victim_ship_group_id` tanımı gereği kurban tarafını gösterdiği için §2.5'teki "victim OR
attacker" arızası bu yolda oluşamaz. `killmail_time` doğrudan indexli kolonda
filtrelendiği için tarih de ID listesine inmiş olur.

Servisin döndürdüğü satırlar GraphQL `Killmail` tipine şu biçimde eşlenir:

```ts
{ id: String(killmail_id), killmailTime: ..., totalValue: ...,
  solarSystemId: ..., attackerCount: ... }
```

Bu yeterlidir: `solarSystem` alan çözücüsü yalnızca `parent.solarSystemId`'ye,
`victim` ve `finalBlow` yalnızca `parent.id`'ye bakar
(`backend/src/resolvers/killmail/fields.ts:38-46`) ve gerisini DataLoader'lar halleder.
`killmails` tablosuna join gerekmez.

`limit` `Math.min(limit ?? 20, 50)` ile sınırlanır. Cache anahtarı
`killmails:mostvaluable:${scope}:${days}:${limit}`, TTL 300 sn
(`CACHE_TTL.KILLMAIL_LIST`); pencere kayan olduğu için sabit tarih anahtarı yoktur ve her
parametre anahtarda yer alır. `MostValuableKillmails`, `backend/src/config/cache.ts`
içindeki `PUBLIC_CACHE_QUERIES` listesine eklenir.

Resolver `backend/src/resolvers/killmail/queries.ts` içine `mostValuableKillmails` olarak
girer ve servise delege eder; `killmailQueries` zaten `resolvers/index.ts`'te yayılı
olduğu için yeni bağlantı gerekmez.

### 5.2 Frontend veri katmanı

Yeni doküman `frontend/src/graphql/MostValuableKillmails.graphql`. `KillmailCardData`'nın
gerçekten kullandığı alanlar istenir: `id`, `killmailTime`, `totalValue`,
`victim { character corporation alliance shipType { id name group { name }
dogmaAttributes(ids: [422, 1692]) } damageTaken }`, `solarSystem { ... }`,
`finalBlow { ... }`. **`attackers` dizisi istenmez.**

### 5.3 Carousel bileşeni — bağımsız

Yeni bileşen `frontend/src/components/MostValuableCarousel/MostValuableCarousel.tsx`.
Kendi kendine yeter: sekme durumunu, kaydırmayı **ve veri çekmesini** kendi içinde tutar,
dışarıdan prop almaz. `page.tsx`'te geriye tek bir satır kalır:

```tsx
<MostValuableCarousel />
```

Mevcut `KillmailCarousel` kaldırılır; sunum mantığı (kart şeridi, oklar, boş durum) yeni
bileşene taşınır. İkisi de yalnızca killmails sayfasında kullanıldığı için
(`KillmailCard` dışarıda kalır, o korunur) serbestçe yeniden şekillendirilebilir.

Yerleşim: tek `Card` gövdesi, başlık "Most Valuable · Last 7 Days", altında dört sekme
(Ships / Structures / Capitals / Solo), sağda kaydırma okları, altında kart şeridi.

- **Yalnızca aktif sekme sorgu atar.** Açılışta dört değil bir istek gider; ziyaret edilen
  sekmelerin verisi Apollo cache'inde kalır.
- `canScrollLeft` / `canScrollRight` mount'ta ve `ResizeObserver` ile hesaplanır; başlangıç
  değeri varsayılmaz.
- Kaydırma kart adımına (`w-80` + `gap-4` = 336 px) hizalanır, şeride `scroll-snap`
  eklenir.
- Yükleme durumu, ortalanmış spinner yerine sabit yükseklikli iskelet kartlarla verilir;
  sekme değişiminde yükseklik zıplamaz.
- Sekmeler `role="tablist"` / `role="tab"` ile işaretlenir; oklardaki mevcut `aria-label`
  korunur.
- Boş kapsam için mevcut `emptyText` deseni korunur (Capitals'ın kısa/boş kalabileceği
  §3 madde 4 gereği).

### 5.4 `page.tsx` temizliği

`frontend/src/app/killmails/page.tsx`'te silinecekler:

- `structuresData` ve `allShipsData` `useKillmailsQuery` çağrıları (`:104-124`)
- client-side filtreleme `useMemo`'su (`:127-140`)
- `sevenDaysAgo` / `today` hesapları, artık backend'in işi (`:96-102`)
- `STRUCTURE_GROUPS` / `CAPSULE_GROUPS` importu (`:25`) — sayfanın başka yerinde
  kullanılmıyorsa
- İki `KillmailCarousel` kullanımı ve sarmalayan `div` (`:408-425`) tek satırlık
  `<MostValuableCarousel />` ile değişir
- `KillmailCarousel` importu

Bu temizlikten sonra `page.tsx` yalnızca kendi işini yapar: filtreler, canlı besleme,
tablo ve sayfalama.

---

## 6. İş 3 — `worker-redisq-stream` düzeltmeleri

İş 1 zaten bu dosyaya dokunuyor (`insertKillmailFilter` çağrısı). İki küçük düzeltme
birlikte yapılır. Başka hiçbir şeye dokunulmaz.

### 6.1 `data.esi`'yi kullan, ESI'ya yeniden gitme

`pollR2Z2` dönüşüne `esi` alanı eklenir ve `processKillmail`, `KillmailService
.getKillmailDetail(killID, zkb.hash)` çağrısı yerine onu kullanır. Payload'ın şekli
`KillmailDetail` ile birebir aynı (§2.8), dolayısıyla aşağı akışta hiçbir şey değişmez.

Güvenlik ağı: `data.esi` beklenmedik biçimde eksikse (`victim` veya `attackers` yoksa)
eski yola, yani ESI'dan çekmeye düşülür. Böylece R2Z2 payload'ı değişirse ingest durmaz.

### 6.2 `victims.faction_id`'yi yaz

`saveKillmail`'deki koşulsuz `faction_id: null` (`:632`),
`victim.faction_id ?? null` ile değiştirilir.

### 6.3 Kapsam dışı bırakılanlar

`zkb`'nin diğer alanları (`npc`, `solo`, `points`, `awox`, `labels`), seri döngünün
pipeline'a çevrilmesi ve satır içi enrichment'ın kuyruklara taşınması **bu işe dahil
değildir.** Gerekçe §7.

---

## 7. Kapsam dışı

Bilerek dışarıda bırakılanlar:

1. **Yol B'nin sınırsız ID listesi deseni.** `filtersMaterialized` eşleşen killmail
   ID'lerinin tamamını döndürüp sayfalamayı ikinci sorguya bırakıyor. `total_value` ve
   `victim_ship_group_id` tabloya girdikten sonra `LIMIT`/`OFFSET`/`ORDER BY`/tarih tek
   sorguda yapılabilir hale gelir — ama bu ana killmail listesinin kalbidir
   (`queries.ts:83-260`, elle sayılan `$N` parametreleriyle) ve kendi spec'ini hak eder.
   İş 1 onu engellemez, kolonları hazırlayarak kolaylaştırır.
2. **`filtersMaterialized`'ın "victim OR attacker" davranışı.** Ana listenin
   `shipGroupIds` filtresi için doğru olabilir; carousel bu yoldan çıktığı için burada
   sorun değil. Ayrı olarak değerlendirilmeli.
3. **Beş korumasız tabloyu `prisma/schema/`'ya eklemek.** CLAUDE.md bunu ayrı bir iş
   olarak işaretliyor.
4. **`refresh_log` tablosunun kaldırılması.** Ölü ama zararsız; silmek ayrı bir karar.
5. **`worker-backfill-values` çalıştırıp 6.712 NULL değeri tamamlamak.** Operasyonel bir
   iş, kod değişikliği değil.
6. **`total_value` boşluğu (§2.8).** Son 7 günün structure kayıplarının %42'si sıfır
   değerli ve İş 2 tam olarak bu kolona göre sıralıyor. Yine de dışarıda bırakılıyor:
   bu bir ingest arızası değil, `market_prices` kapsamının konusu; düzeltmesi hem yeni
   kayıtları (`zkb.totalValue`'nun yazılması veya eksik tip fiyatlarının kuyruğa
   atılması) hem de geçmişteki 8.483 sıfır kaydı ilgilendiriyor ve kendi doğrulamasını
   gerektiriyor. **Bilinen sonuç:** Most Valuable Structures şeridinin sıralaması eksik
   olacaktır.
7. **Seri döngü ve satır içi enrichment (§2.8).** Ölçülen hız saatte ~950 mail ve worker
   birikimi kendiliğinden eritiyor; bugünkü hacimde darboğaz değil. Enrichment'ı
   `esi_*_info_queue` kuyruklarına taşımak ingest sırasını değiştiren mimari bir karar
   (killmail, entity'lerinden önce kaydedilir) ve kendi spec'ini hak ediyor.
8. **`zkb`'nin `npc` / `solo` / `points` / `labels` alanlarının saklanması.** `killmails`
   tablosuna kolon eklemeyi gerektirir. En somut kazanç `npc`'nin sorgu anında tüm
   attacker satırlarını yüklemesini (`resolvers/killmail/fields.ts:85-104`) ortadan
   kaldırmak olurdu; bugün bir sorun bildirilmedi, ayrı ele alınır.

---

## 8. Riskler

| risk                                                      | değerlendirme                                                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Backfill `UPDATE`'i veri kaybettirir                      | Migration'da `DROP`/`DELETE` yok; yalnızca NULL kolonlar dolduruluyor. Satır sayıları öncesi/sonrası karşılaştırılacak. |
| `total_value` bayatlar                                    | `worker-backfill-values`'a senkron `UPDATE` eklenir (§4.5). Ayrıca §4.3'teki `DO UPDATE` NULL kalanları onarır.         |
| `DO UPDATE` iyi veriyi ezer                               | `WHERE` koşulu yalnızca ilgili kolon NULL'ken tetikler; attacker dizilerine hiç dokunmaz.                               |
| Capitals şeridi boş görünür                               | Bilinen ve kabul edilen davranış (§3 madde 4). `emptyText` mevcut.                                                      |
| `KillmailFilterData` arayüz değişikliği çağıranları kırar | İki alan da opsiyonel ve dört çağıranın hiçbiri göndermiyor; `tsc --noEmit` bunu doğrular.                              |
| Frontend'den `attackers` kaldırılması bir yeri kırar      | `KillmailCardData` `attackers` içermiyor; `Killmails.graphql` tabloya ait ve dokunulmuyor.                              |
| `data.esi` kullanımı ingest'i bozar                       | Payload canlı doğrulandı ve `KillmailDetail` ile birebir; ayrıca eksik/bozuk payload'da eski ESI yoluna düşülür (§6.1). |
| Structures şeridi eksik sıralar                           | Bilinen ve kabul edilen sonuç (§7 madde 6), ölçülmüş hâliyle kayıtta.                                                   |

---

## 9. Doğrulama

Test koşucusu yok; doğrulama komut çıktısı okuyarak yapılır.

**Migration (CLAUDE.md yordamı):**

1. Öncesinde satır sayıları kaydedilir: `killmail_filters` ve diğer dört korumasız tablo.
2. `npx prisma migrate deploy`, ardından `npx prisma generate`.
3. Sonrasında aynı sayımlar tekrarlanır — hiçbiri azalmamalı.
4. NULL sayımları 0'a inmeli:
   `region_id`, `constellation_id`, `security_status`, `victim_ship_group_id`.
5. `total_value` NULL sayısı `killmails`'teki NULL sayısına eşit olmalı (bugün 6.712).
6. The Forge kontrolü: son 7 gün `region_id = 10000002` sayımı 0 değil, join ile
   hesaplanan gerçek değere eşit olmalı.

**Kod:**

```bash
yarn workspace backend build      # tsc --noEmit
yarn workspace backend codegen    # önce bu
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
```

**Veri:** backend'e doğrudan GraphQL sorgusu ile dört scope tek tek denenir; dönen
killmail'lerin victim gemi grubu beklenen kümede olmalı, `SOLO` için `attackerCount = 1`.

**İş 3:** worker bir süre çalıştırılır ve yeni yazılan killmail'lerde kontrol edilir —
`victims.faction_id` artık ESI'nın gönderdiği durumlarda dolu olmalı, ve yeni satırlarda
`killmail_filters.region_id` / `constellation_id` / `victim_ship_group_id` NULL
olmamalı. Log'da killmail başına yalnızca enrichment kaynaklı ESI istekleri görünmeli;
killmail detayı için ESI'ya gidilmemeli.

**Görsel:** sayfanın görünümü kullanıcıya aittir; tarayıcı sürülmez.
