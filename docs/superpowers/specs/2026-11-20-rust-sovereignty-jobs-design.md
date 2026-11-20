# Rust sovereignty işleri: campaigns, map, structures

#315'teki port serisinin bir adımı: 3. tablodaki üç sovereignty satırı.

## Amaç ve neden

| Node                    | Rust (yeni)                | Yazdığı tablolar                                 | Alert |
| ----------------------- | -------------------------- | ------------------------------------------------ | ----- |
| `worker:sov:campaigns`  | `worker:sov:campaigns:rs`  | `sovereignty_campaigns`, `campaign_participants` | var   |
| `worker:sov:map`        | `worker:sov:map:rs`        | `sovereignty_map_current`, `territory_changes`   | var   |
| `worker:sov:structures` | `worker:sov:structures:rs` | `sovereignty_structures`                         | yok   |

Üçünün de kuyruğu yok: ESI'den bir liste çeker, veritabanıyla karşılaştırır,
yazar ve çıkar. Seri boyunca anlaşılan kural "taşırken düzelt, düzeltmeyi
TypeScript tarafına da uygula". Aşağıdaki _Kusurlar_ bölümündeki düzeltmeler
iki tarafa da girer.

`worker:sov:snapshot` ve `worker:sov:correlate` bu işin kapsamında değil, bir
sonraki adım. correlate da `SOVEREIGNTY_ALERT` yayınladığı için alert kodu,
onun da kullanabileceği şekilde ortak bir kütüphane crate'ine konur (kullanıcı
kararı, aşağıda _Yaklaşımlar_).

## Bugün

Üç iş de systemd timer'ıyla çalışır (`deploy/systemd/killreport-worker-sov-*.timer`):
campaigns 5 dakikada bir, map 30 dakikada bir, structures her saatin :15 ve
:45'inde. ESI istekleri `esiClient.get` ile, varsayılan
`X-Compatibility-Date: 2020-01-01` ile gider
(`backend/src/services/sovereignty/sovereignty.service.ts`).

### campaigns (`backend/src/workers/worker-sovereignty-campaigns.ts`)

1. `GET /sovereignty/campaigns`.
2. `isBaseline` = `sovereignty_campaigns` tablosu boş mu. Feed'deki ID'lerden
   tabloda olanlar `existingIds`.
3. Her kampanya için tek tek upsert. Yeni kayıt: bütün alanlar. Var olan:
   `defender_id`, iki skor, `end_time = NULL`, `outcome = NULL` (yeniden
   açılan kampanya). `constellation_id`, `solar_system_id`, `structure_id`,
   `event_type` ve `start_time` güncellenmez.
4. Her katılımcı için tek tek upsert, `(campaign_id, alliance_id)` üzerinden,
   yalnızca `score` güncellenir. ESI alanı göndermezse liste boş sayılır.
5. Baseline değilse, `existingIds`'de olmayan her kampanya için
   `campaign_started` alert'i, çalışma başına en çok 25 (`MAX_ALERTS`).
6. Feed boşsa uyarı loglanır ve bitirme adımı atlanır. Değilse: `end_time`'ı
   NULL olup feed'de olmayan her kampanyaya `end_time = now` ve
   `inferOutcome` ile bir `outcome` yazılır, her biri için `campaign_ended`
   alert'i. Satırlar tek tek, her biri kendi `try/catch`'inde; biri hata verirse
   diğerleri devam eder.
7. `inferOutcome(d, a)`: ikisi de null → `abandoned`; `max(d ?? 0, a ?? 0) < 0.05`
   → `abandoned`; `d >= a` → `defender_won`; yoksa `attacker_won`.

### map (`backend/src/workers/worker-sovereignty-map.ts`)

1. `GET /sovereignty/map`, sistem başına `{system_id, alliance_id?,
corporation_id?, faction_id?}`.
2. `sovereignty_map_current`'in tamamı belleğe okunur. Tablo boşsa
   `isInitialPopulation`.
3. Üç sahiplik alanından en az biri dolu olan sistemler "sahipli" sayılır.
4. Sahipli her sistem için: önceki sahiple aynıysa atlanır; değilse upsert
   listesine girer ve (ilk doldurma değilse) bir `territory_changes` satırı
   üretilir. `changeType(prev, next)` yalnızca `alliance_id`'ye bakar: null →
   dolu `captured`, dolu → null `lost`, iki farklı dolu `transferred`, geri
   kalan her şey `faction_change`.
5. Tabloda olup artık sahipli olmayan her sistem silme listesine girer ve
   bir `lost` satırı üretir (`new_* = NULL`).
6. Yazım sırası: `territory_changes` için `createMany`; değişikliklerin ilk
   25'i için `territory_change` alert'i (`MAX_CHANGE_ALERTS`); 100'lük gruplar
   halinde paralel upsert'ler; `deleteMany`. Hiçbiri transaction içinde değil.

### structures (`backend/src/workers/worker-sovereignty-structures.ts`)

1. `GET /sovereignty/structures`.
2. 50'lik gruplar halinde paralel upsert. Var olan kayıtta `alliance_id`, üç
   zafiyet alanı ve `destroyed_at = NULL` güncellenir; `solar_system_id` ve
   `structure_type_id` güncellenmez.
3. `destroyed_at`'i NULL olup feed'de olmayan her yapıya `destroyed_at = now`
   (`updateMany`). Feed boşsa `notIn: [-1]` ile **hepsi** işaretlenir.

### Alert (`backend/src/services/sovereignty/alert-builder.ts`, `services/pubsub.ts`)

`buildSovereigntyAlert` olayı zenginleştirir: sistem adı, takımyıldız
üzerinden bölge adı, alliance adı ve ticker'ı; dört ayrı Prisma sorgusu.
`allianceId`: `territory_change` için `newOwnerId ?? previousOwnerId`, diğerleri
için `defenderId`. Mesaj kalıpları:

- `campaign_started`: `New sovereignty campaign in {loc}`
- `campaign_ended`: `Campaign in {loc} ended — {outcome ?? 'unresolved'}`
- `territory_change`: `{systemName} sovereignty {changeType ?? 'changed'}` ve
  bölge varsa sonuna ` ({regionName})`

`loc` bölge varsa `{systemName} ({regionName})`, yoksa `systemName`.
`systemName` sistem bulunamazsa `#{systemId}`. Sonuç JSON'u alan sırasıyla:
`type, message, solarSystemId, solarSystemName, regionName, allianceId,
allianceName, allianceTicker, outcome, changeType, timestamp`; `timestamp`
`toISOString()` biçiminde (`2026-11-20T12:00:00.000Z`).

Yayın: `USE_REDIS_PUBSUB=true` ise Yoga'nın Redis event target'ı
`PUBLISH SOVEREIGNTY_ALERT <JSON.stringify(alert)>` yapar; API sunucusu aynı
kanala abone olur. `false` (varsayılan) ise pubsub bellek içidir ve ayrı bir
süreçte çalışan worker'ın yayını hiçbir yere ulaşmaz.

## Kusurlar

İki tarafa da girecek düzeltmeler:

1. **structures: boş feed her yapıyı yok edilmiş sayıyor.** ESI'nin geçici bir
   boş yanıtı bütün `sovereignty_structures` satırlarına `destroyed_at` yazar;
   bir sonraki çalışma hepsini geri açar, arada sayfalar her yapıyı yıkılmış
   gösterir. Düzeltme: campaigns'teki gibi, feed boşsa `warn` ve işaretleme
   atlanır.
2. **map: boş feed her sistemi `lost` olarak kaydediyor.** Aynı geçici yanıt
   `sovereignty_map_current`'ı boşaltır ve sistem başına bir sahte `lost`
   satırını kalıcı olarak `territory_changes`'e yazar. Tablo boşaldığı için
   bir sonraki çalışma `isInitialPopulation` sayılır ve gerçek geri dönüşleri
   de kaydetmez. Düzeltme: feed'de hiç sahipli sistem yoksa `warn`, hiçbir şey
   yazılmaz.
3. **map: yazımlar transaction'sız.** `territory_changes` önce yazılıyor;
   upsert'lerden biri ya da silme hata verirse değişiklik kaydı kalır ama
   `sovereignty_map_current` eski durumda kalır ve bir sonraki çalışma aynı
   değişikliği bir daha kaydeder. Düzeltme: üç yazım tek transaction'da;
   alert'ler commit'ten sonra yayınlanır.
4. **campaigns: alert'ler yazım commit'lenmeden yayınlanıyor ve
   `campaign_ended` sınırsız.** Bir alert, sonra hata veren bir yazımı
   duyurabilir; büyük bir toplu bitişte (ör. downtime sonrası) her kampanya
   için bir alert gider. Düzeltme: alert'ler yazımlardan sonra yayınlanır;
   `MAX_ALERTS = 25` başlayan ve biten alert'lerin toplamına uygulanır (önce
   başlayanlar, sonra bitenler).

Bakılan ve bilerek değiştirilmeyenler:

- **campaigns: feed'den düşen katılımcı silinmiyor.** Silmek, kampanyanın
  geçmiş skorlarını kaybettirir; bir alliance'ın son skoru tarih olarak
  anlamlı. Davranış korunur.
- **campaigns: satır başına `try/catch`.** Rust'ta bitiş işaretlemesi tek bir
  `UPDATE` ifadesidir; ya hepsi ya hiçbiri. Satır satır hata ayırmaya gerek
  kalmaz. Node tarafında bu kısım değişmez (düzeltme değil, yalnızca yapı).
- **map: `changeType` faction değişimini alliance'tan ayırmıyor.** Alliance'ın
  aynı kalıp yalnızca corporation'ın değiştiği durum da `faction_change`
  diye kaydediliyor. Etiket yanlış ama mevcut satırların anlamını
  değiştirmek analitik tarafında ayrı bir iş; kapsam dışı.
- **Alert'in `USE_REDIS_PUBSUB=false` iken kaybolması.** Node'da da öyle; Rust
  aynı bayrağa uyar (aşağıda).

## Yaklaşımlar

Alert kodunun nerede yaşayacağı:

- **A) Yeni `sov` kütüphane crate'i (seçilen).** `backend-rs/crates/sov`:
  olay tipi, alert'in zenginleştirilmesi ve yayını. campaigns, map ve sonra
  correlate onu kullanır. #315'teki "paylaşılan kod yalnızca `esi`, `db`,
  `mq`, `runner`" kuralına bir kütüphane ekler; tek kopya kalır.
- **B) `db` crate'inde bir modül.** Kural bozulmaz ama `db` sovereignty ve
  Redis bilgisi edinir; `db` şu an yalnızca havuz ayarıdır.
- **C) Her worker'da kopya.** Kural aynen korunur; correlate ile kod üç yerde
  olur ve mesaj kalıpları ayrışabilir.

Kullanıcı A'yı seçti. #315'teki kural cümlesi `sov`'u da sayacak şekilde
güncellenir.

## Tasarım

### `backend-rs/crates/sov` (yeni kütüphane)

- `AlertEvent` enum'u: `CampaignStarted { system_id, defender_id: Option<i32> }`,
  `CampaignEnded { system_id, defender_id, outcome: Option<String> }`,
  `TerritoryChange { system_id, previous_owner_id, new_owner_id,
change_type: Option<String> }`.
- `SovereigntyAlert` struct'ı, `serde::Serialize`, `#[serde(rename_all =
"camelCase")]`, alanlar Node'daki sırayla. `timestamp` alanı `String`,
  `%Y-%m-%dT%H:%M:%S%.3fZ` biçiminde.
- `build_alert(pool, event, now) -> sqlx::Result<SovereigntyAlert>`: tek SQL,
  `solar_systems` → `constellations` → `regions` LEFT JOIN, alliance için ayrı
  bir LEFT JOIN (`alliances`, `id` sütunu `alliance_id` değil; mapping
  `database` agent'ıyla doğrulanır). Mesajı üreten kısım saf bir fonksiyon
  (`alert_message(event, system_name, region_name)`), birim testli.
- `AlertPublisher`: `USE_REDIS_PUBSUB` `"true"` ise `REDIS_URL`'e (varsayılan
  `esi::DEFAULT_REDIS_URL`) bağlanır ve `PUBLISH SOVEREIGNTY_ALERT <json>`
  yapar; değilse hiçbir şey yapmaz ve bunu bir kez `info!` ile söyler. Yayın
  hatası `error!` loglanır ama çalışmayı başarısız saymaz: veri zaten
  commit'lenmiştir, alert en iyi çaba ile gider. (Node'da Yoga'nın event
  target'ı `publish`'i beklemeden çağırıyor; hata yakalanmamış bir promise
  reddi olur. Node tarafı bu iş kapsamında değişmez.)
- Bağımlılıklar: `redis`, `serde`, `serde_json`, `sqlx`, `chrono`, `tracing`
  (hepsi workspace'te var).

### Üç worker crate'i

`backend-rs/workers/worker-sovereignty-{campaigns,map,structures}`, Node
dosyalarıyla aynı adlar. `worker-system-activity` gibi tek seferlik iş:
`runner::init`, `DATABASE_URL`, `RateLimiter::from_env()`,
`EsiClient::new(limiter)`, `db::worker_pool`, `esi.get(...)` (varsayılan
uyumluluk tarihi, Node ile aynı). Hata: `error!` ve `exit(1)`. Node'daki log
satırları aynı sırayla ve aynı emojilerle; düzeltmelerin eklediği uyarılar
iki tarafta aynı metinle.

Her crate'te `lib.rs` saf kısmı ve SQL'i, `main.rs` akışı taşır:

**campaigns**

- `infer_outcome(d: Option<f64>, a: Option<f64>) -> &'static str`.
- Tek transaction: (1) `isBaseline` ve `existingIds` sorgusu, (2) bütün
  kampanyalar tek `INSERT … SELECT * FROM UNNEST(…) ON CONFLICT (campaign_id)
DO UPDATE` ile, güncellenen sütunlar Node'dakiyle aynı, (3) katılımcılar
  tek UNNEST upsert ile, (4) feed boş değilse bitenler `SELECT … FOR UPDATE`
  ile okunur, outcome Rust'ta hesaplanır, tek UNNEST `UPDATE` ile yazılır.
  `updated_at` her yazımda `now()` (Prisma `@updatedAt`'in yaptığı).
- Commit'ten sonra alert'ler: başlayanlar, sonra bitenler, toplam 25.

**map**

- Saf: `owner_of`, `is_owned`, `change_type`, ve `diff(existing, fetched) ->
MapDiff { upserts, deletes, changes }`; Node'daki kurallar ve sıra.
- Sahipli sistem yoksa `warn` ve çıkış (düzeltme 2).
- Tek transaction: `territory_changes` UNNEST insert (`detected_at` varsayılan),
  `sovereignty_map_current` UNNEST upsert (`last_updated = now()`), `DELETE …
WHERE solar_system_id = ANY($1)`.
- Commit'ten sonra ilk 25 değişiklik için alert.

**structures**

- Feed boşsa `warn` ve çıkış (düzeltme 1).
- Tek transaction: UNNEST upsert (`last_seen = now()`, `destroyed_at = NULL`),
  ardından `UPDATE … SET destroyed_at = now() WHERE destroyed_at IS NULL AND
structure_id <> ALL($1::bigint[])`.

### Node tarafı

- `worker-sovereignty-structures.ts`: boş feed koruması.
- `worker-sovereignty-map.ts`: sahipli sistem yoksa koruma; üç yazım
  `prismaWorker.$transaction` içinde; alert'ler commit'ten sonra. Satır
  başına upsert'ler transaction içinde tek bağlantıda sırayla çalışır ve
  Prisma'nın 5 saniyelik varsayılan zaman aşımına ilk doldurmada (binlerce
  sistem) takılır. Bu yüzden upsert, Rust'taki gibi tek bir `$executeRaw`
  UNNEST ifadesine çevrilir (benim kararım; Rust ile eşlik).
- Üç Node worker'ı da şu an import edildiği anda çalışıp `process.exit`
  yapıyor ve hiçbir şey export etmiyor. Test edilebilmeleri için mantık
  export edilir ve çalıştırma `worker-character-corporation-history.ts`'deki
  gibi `require.main === module` korumasının arkasına alınır.
- `worker-sovereignty-campaigns.ts`: alert'ler toplanır ve yazımlardan sonra
  yayınlanır; 25 sınırı ikisinin toplamına.

### `backend/package.json`

`worker:sov:campaigns:rs`, `worker:sov:map:rs`, `worker:sov:structures:rs`;
diğer `:rs` script'leri gibi `cargo run --release --manifest-path
../backend-rs/Cargo.toml -p worker-sovereignty-…`.

## Testler

- `sov`: mesaj kalıpları (üç tip, bölge var/yok, sistem bulunamadı,
  outcome/changeType null); JSON'un alan adları ve sırası
  `alert-builder.ts`'deki `SovereigntyAlertData` tipi ve dönen nesneyle aynı
  (`alert-builder.spec.ts` sırayı denetlemiyor, kaynak o değil); timestamp
  biçimi.
  `#[sqlx::test]` ile `build_alert`: sistem → bölge zinciri, alliance yok.
- campaigns: `infer_outcome` tablosu; `#[sqlx::test]` ile upsert (yeniden
  açılan kampanyada `end_time` ve `outcome` temizlenir), boş feed'de bitiş
  atlanır, baseline'da başlayan alert'i yok, alert toplam sınırı.
- map: `change_type` ve `diff` birim testleri (değişmeyen sistem atlanır,
  ilk doldurmada değişiklik yok, sahipliğini kaybeden sistem `lost`);
  `#[sqlx::test]` ile sahipli sistem yokken hiçbir şey yazılmaz.
- structures: `#[sqlx::test]` ile boş feed hiçbir satırı işaretlemez, tekrar
  görülen yapının `destroyed_at`'i temizlenir.
- Node: üç düzeltme için vitest. Bu worker'ların henüz testi yok; export
  edilen mantık Prisma, ESI ve pubsub mock'lanarak test edilir.

## Kapsam dışı

- `worker:sov:snapshot` ve `worker:sov:correlate` (sonraki adım; `sov`
  crate'ini kullanacaklar).
- Node dosyalarının silinmesi, systemd unit'leri ve timer'ları.
- `changeType`'ın corporation/faction ayrımı (yukarıda).
- #315'teki "Runs" sütununun PM2'den systemd'ye güncellenmesi.
