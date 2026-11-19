# Rust `prices` queue script'i ve worker'ı

#315'teki port serisinin bir adımı: 2. tablodaki `queue:prices` ve 1. tablodaki
`worker:prices`.

## Amaç ve neden

Jita fiyat zincirinin iki ucu hâlâ Node:

| Node            | Rust (yeni)        | Kuyruk                 |
| --------------- | ------------------ | ---------------------- |
| `queue:prices`  | `queue:prices:rs`  | `esi_type_price_queue` |
| `worker:prices` | `worker:prices:rs` | aynı kuyruğu tüketir   |

Seri boyunca anlaşılan kural: **taşırken düzelt, düzeltmeyi TypeScript tarafına
da uygula.** `market_prices.sell`, killmail değerinin tek kaynağı
(`backend/src/helpers/calculate-killmail-values.ts:89`, `:227`); bu yüzden
buradaki kusurlar doğrudan killmail ISK değerlerine yansıyor.

## Bugün

**Queue script** (`backend/src/queues/queue-prices.ts`): iki ayrı sorgu,
`SELECT DISTINCT item_type_id FROM killmail_items` ve
`SELECT DISTINCT ship_type_id FROM victims` (`:19-28`). Sonuçlar JS'te
birleştirilip sıralanıyor, her ID için
`{ entityId, queuedAt, source: 'queue-prices' }` mesajı `persistent` olarak
gönderiliyor, öncelik yok. Ardından confirm beklenmeden `channel.close()` ve
`process.exit(0)` çağrılıyor. Script, systemd timer'ıyla her gün 06:00 UTC'de
çalışıyor (`deploy/systemd/killreport-queue-prices.timer`).

**Worker** (`backend/src/workers/worker-prices.ts`), her mesaj için:

1. `marketPrice.findUnique`, yalnızca log'a "created" mı "updated" mı yazılacağını
   seçmek için (`:69-71`).
2. `MarketService.getJitaPrice` (`market.service.ts:39-70`):
   `GET /latest/markets/10000002/orders/?type_id={id}`. Bütün The Forge
   bölgesinin emirlerinden en yüksek buy, en düşük sell,
   `average = (buy + sell) / 2` ve `volume = Σ volume_remain` hesaplanıyor.
3. `MarketService.savePrice` (`:76-99`): `type_id` üzerinden upsert.
4. Ack.

Prefetch sabit olarak 10 (`worker-prices.ts:16`).

## Kusurlar (taşırken düzeltilecek)

1. **Sadece ilk sayfa okunuyor.** ESI bu endpoint'i 1000 emirlik sayfalara
   bölüyor ve `X-Pages` başlığını okuyan yok. Emri çok olan type'larda fiyat
   eksik bir listeden hesaplanıyor.
2. **Bölge geneli fiyat.** Minimum sell The Forge'daki herhangi bir istasyondan
   gelebiliyor; uzak bir istasyondaki tek bir ucuz emir killmail değerini aşağı
   çekiyor. Kodda adı "Jita price" geçiyor.
3. **Emir yoksa 0 yazılıyor.** Boş emir listesi `buy = sell = 0` olarak
   kaydediliyor ve bilinen son fiyatın üzerine yazıyor. O type'ı içeren
   killmail'ler bundan sonra 0 ISK sayılıyor.
4. **ESI hataları yutuluyor.** `getJitaPrice`, 420/429 dışındaki bütün
   hatalarda `null` dönüyor (`:65-68`). Worker bunu "no market orders" diye
   loglayıp mesajı ack'liyor; 5xx ya da ağ hatası tekrar denenmiyor ve
   `handleWorkerError`'a hiç ulaşmıyor.
5. **DB hataları yutuluyor.** `savePrice` hatayı loglayıp dönüyor (`:96-98`).
   Worker satırı "saved" diye sayıyor.
6. **`types`'ta olmayan type.** `market_prices.type_id`, `types.id`'ye
   foreign key (`backend/prisma/schema/marketPrice.prisma:5`). Killmail'lerde
   geçen ama `types`'ta henüz olmayan bir type'ın upsert'i patlıyor, 5. kusur
   yüzünden de bu görünmüyor.
7. **Queue script: confirm yok, ardından `process.exit`.**
   `queue-character-corporations`'ta düzelttiğimiz kusurun aynısı.
8. **Prefetch, seri boyunca uygulanan kuraldan sapıyor** (sabit 10).
9. **İki ayrı `DISTINCT` sorgusu ve JS'te birleştirme**, ve 1. adımdaki
   gereksiz `findUnique`.

## Kullanıcı kararları

- **Emir yoksa eski fiyat korunur.** Jita 4-4'te o type için hiç emir yoksa
  satıra dokunulmaz. Hiç fiyatı olmayan bir type 0 sayılmaya devam eder. Buy ve
  sell tarafının ayrı ayrı korunması (seçenek C) reddedildi; sonucu aşağıda,
  _Bilinen sonuç_ başlığında.
- **Fiyat kaynağı sadece Jita 4-4:** `location_id = 60003760`, hem buy hem sell
  için. Range'li buy emirleri başka istasyonda verildiyse sayılmaz.
- **Fiyat, min sell / max buy değil, hacme göre %5'lik dilim** (Fuzzwork ve
  Janice'in yöntemi). Min sell tek bir emre bağlı: Jita'da piyasanın çok altına
  konmuş 1 adetlik bir emir, o type'ı içeren bütün killmail'lerin değerini
  belirliyordu. CCP'nin `/markets/prices/` ortalaması da düşünüldü, ama Jita
  fiyatı değil ve kuyruk yapısına uymuyor.
- **Yaklaşım: kuyruk ve worker çifti**, serinin kalıbıyla aynı.

## Yaklaşımlar

1. **Kuyruk ve worker çifti (seçilen).** İki crate, aynı kuyruk, aynı mesaj.
   Node ile Rust birbirinin yerine geçebilir, geri dönüş tek komut. Her type için
   bir ESI çağrısı gider; hızı paylaşılan limiter belirler, iş günde bir kez
   çalışır.
2. **Bütün bölgeyi tarayan tek bir iş.** `/markets/10000002/orders/` filtresiz,
   birkaç yüz sayfa; Jita emirleri bellekte gruplanır, toplu upsert edilir.
   Çağrı sayısı çok daha az. Reddedildi: "bir kuyruk, bir worker" kalıbından
   çıkıyor, Node karşılığıyla yan yana çalışamıyor ve piyasadaki bütün type'ları
   yazdığı için 6. kusuru geri getiriyor. Fiyatlar ileride daha sık güncellenmek
   istenirse yeniden konuşulabilir.

## Hedefler

### 1. Rust `queue-prices` (`backend-rs/queues/queue-prices/`)

`queue-killmail-types` yapısında: `lib.rs`'te `QUEUE_NAME`, `SOURCE` ve ID
sorgusu, `main.rs`'te bağlan, declare, `mq::publish_entities` (confirm'li),
kapat.

- `QUEUE_NAME = "esi_type_price_queue"`, `SOURCE = "queue-prices"`, öncelik
  yok (`None`), Node'la aynı.
- Sorgu (Node'la aynı SQL):

  ```sql
  SELECT ids.id
  FROM (
    SELECT item_type_id AS id FROM killmail_items
    UNION
    SELECT ship_type_id FROM victims
  ) ids
  WHERE EXISTS (SELECT 1 FROM types t WHERE t.id = ids.id)
  ORDER BY ids.id
  ```

  `EXISTS`, 6. kusuru kaynağında çözüyor: `types`'ta olmayan bir type
  kuyruğa girmez, `scan:entities` onu eklediğinde ertesi günün çalışmasında
  fiyatını alır.

- Liste boşsa RabbitMQ'ya dokunmadan başarıyla çıkar (`queue-killmail-types`
  gibi).
- Son satır: `now run the worker: yarn worker:prices:rs`.

### 2. Rust `worker-prices` (`backend-rs/workers/worker-prices/`)

`worker-info-types` yapısında: `runner::Worker` implementasyonu,
`QUEUE_NAME = "esi_type_price_queue"`, `CONSUMER_TAG = "worker-prices-rs"`.
Prefetch runner'ın ortak kuralından gelir. 8. kusur Rust'ta kendiliğinden
yok.

Mesaj başına:

1. `GET /markets/10000002/orders/?type_id={id}`, **bütün sayfalar**. Path,
   diğer Rust worker'larının biçimiyle yazılır (`/latest` öneki yok).
2. Saf bir fonksiyon (`jita_price(&[Order]) -> Option<Price>`):
   - `location_id == 60003760` olmayan emirler atılır.
   - Geriye emir kalmazsa `None`.
   - Kalırsa: `sell` ve `buy` **hacme göre %5'lik dilimle** hesaplanır
     (aşağıda). Bir tarafta emir yoksa o taraf 0. `average = (buy + sell) / 2`
     ve `volume = Σ volume_remain` (bütün Jita emirleri), Node'daki gibi.
   - **%5'lik dilim, sell için:** emirler fiyata göre artan sırada; hedef =
     Jita sell emirlerinin toplam `volume_remain`'inin %5'i (`f64`, yuvarlama
     yok). En ucuzdan başlanıp toplanır, hedefi aşan son emirden yalnız eksik
     kalan kadar sayılır. Fiyat `Σ(price × alınan) / Σ alınan`. Buy için aynısı,
     fiyata göre azalan sırada. Örnek: sell 1 × 1 ISK, 100 × 10, 99 × 11 →
     hedef 10 → `(1·1 + 9·10) / 10 = 9.1`. Tek bir emir varsa sonuç onun
     fiyatıdır.
3. `None` ise satıra dokunulmaz ve mesaj ack'lenir. Sonuç runner'a yeni bir
   outcome olarak döner (aşağıda).
4. `Some` ise upsert:

   ```sql
   INSERT INTO market_prices (type_id, buy, sell, average, volume, updated_at)
   VALUES ($1, $2, $3, $4, $5, now())
   ON CONFLICT (type_id) DO UPDATE SET
     buy = EXCLUDED.buy, sell = EXCLUDED.sell,
     average = EXCLUDED.average, volume = EXCLUDED.volume,
     updated_at = now()
   RETURNING (xmax = 0) AS "inserted!"
   ```

   `updated_at` insert'te de yazılır, çünkü `@updatedAt` Prisma'nın ve
   veritabanında default'u yok. `created_at` veritabanı default'u.
   `xmax = 0` → `Outcome::Created`, değilse `Outcome::Updated`.

5. ESI ve DB hataları `handle`'dan `Err` olarak döner; runner'ın ortak hata
   yolu (404, 420 backoff, deneme sayısı) Node'daki `handleWorkerError` gibi
   işler. 4. ve 5. kusur Rust'ta kendiliğinden yok.

Log satırı detayı: ` buy=… sell=…`; emir yoksa ` (no Jita orders)`.

### 3. Paylaşılan crate'lerde gereken iki değişiklik

- **`esi::EsiClient::get_paged`, query string'li path kabul etmiyor**
  (`backend-rs/crates/esi/src/client.rs:131-147`): `?page=1` ekliyor. Path'te
  zaten `?` varsa `&page=N` eklemeli. Limiter bucket'ı bundan etkilenmez:
  `route_template` query string'i zaten atıyor
  (`backend-rs/crates/esi/src/route.rs:18-19`), yani her type ayrı bir route
  olmaz.
- **`runner::Outcome`'a "satıra dokunulmadı" varyantı**
  (`backend-rs/crates/runner/src/lib.rs:25-36`): bugünkü dört varyant
  (`Created`, `Updated`, `Queued`, `Saved`) bu durumu anlatmıyor. Yeni varyant
  `Totals`'ta kendi sayacını alır ve son özet satırında görünür, örneğin
  `📊 final: N processed (c created, u updated, s unchanged, e errors)`. Adı ve
  özet satırının tam biçimi uygulayana kalmış. Mevcut worker'ların özet satırı
  bu sayaç sıfırken değişmemeli.

### 4. Node düzeltmeleri

- **`queue-prices.ts`:** 1. hedefteki tek SQL, gönderim
  `publishEntitiesConfirmed` ile (`backend/src/queues/publish-entities.ts:20`),
  `process.exit` confirm'lerden sonra.
- **`MarketService.getJitaPrice`:** bütün sayfaları okur (`X-Pages`;
  `esiClient.get` axios cevabını döndürdüğü için başlık oradan okunur),
  Jita 4-4'e süzer, emir yoksa `null` döner. Hatalar artık yutulmaz,
  `EsiThrottledError` dahil hepsi yukarı fırlatılır. Hesap, Rust'taki saf
  fonksiyonun aynısı olarak ayrı, test edilebilir bir fonksiyona çıkar.
- **`MarketService.savePrice`:** hatayı yutmaz.
- **`worker-prices.ts`:** `findUnique` kalkar. `null` → "no Jita orders",
  satıra dokunmadan ack. Prefetch `worker-info-types.ts:17` kuralıyla. Log
  "created"/"updated" yerine "saved" der, çünkü Prisma'nın upsert'i bu ayrımı
  vermiyor.

### 5. Script'ler ve dokümanlar

- `backend/package.json`: `queue:prices:rs` ve `worker:prices:rs`, diğer `:rs`
  satırlarının biçiminde.
- Fiyat zincirinin kullanıcıya yönelik açıklaması
  (`backend/docs/workers/` altında, uygulayan yerini bulur) Rust komutlarını,
  Jita 4-4 kuralını ve "emir yoksa dokunma" kuralını anlatır.
- Merge'den sonra #315'te iki satır işaretlenir.

## Testler

- Rust `jita_price`: başka istasyondaki emirler atılır; sadece buy, sadece
  sell, ikisi birden, hiç Jita emri yok.
- Rust `#[sqlx::test]`: queue sorgusu (UNION tekilleştirir, `types`'ta olmayan
  elenir, sıralı); upsert insert'te `Created`, ikinci çağrıda `Updated` ve
  değerleri yazar.
- `get_paged`: path'te query varken `&page=N`.
- Node: saf fiyat fonksiyonu için aynı vakalar; `getJitaPrice` birden fazla
  sayfayı okur ve hata fırlatır.

## Kapsam dışı

- systemd unit'leri Node script'lerini çalıştırmaya devam eder. Rust'a geçiş
  ayrı bir adım.
- Node dosyalarının silinmesi.
- `average` alanının tanımı. Hiçbir okuyucusu yok, Node formülü korunuyor.
- `backend/src/resolvers/worker/helpers.ts:47`'deki kuyruk → worker adı
  eşlemesi. Diğer `:rs` worker'ları da orada yok; ayrı bir iş.

## Uygulayanın kararları (reviewer'dan sonra)

- ESI bu route'ta bir type için 404 dönerse, ortak hata yolu bunu "not found,
  skipping" hatası olarak sayar, "unchanged" olarak değil. Sadece sayaçlar
  etkilenir, veri etkilenmez; ayrı bir işlem yapılmaz.

## Bilinen sonuç

Buy ve sell ayrı korunmadığı için, Jita 4-4'te bir type'ın **sadece buy
emirleri** varsa `sell = 0` yazılır ve o type'ı içeren killmail'ler 0 ISK
sayılır. Bugün bölge genelinde aynı şey oluyor. Jita'ya süzmek bu durumun
sıklığını artırabilir, çünkü bölgede sell emri olan bir type'ın Jita'da olmayabilir.
