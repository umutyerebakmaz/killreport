# Rust `character-corporation-history` worker'ı ve queue script'i

#315'teki port serisinin bir adımı. Kullanıcı sırayı değiştirdi: `scan:entities`
bunun arkasına kaldı.

## Amaç ve neden

Employment History zincirinin iki ucu hâlâ Node:

| Node                                   | Rust (yeni)                               | Kuyruk                                    |
| -------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `queue:character-corporation-history`  | `queue:character-corporation-history:rs`  | `esi_character_corporation_history_queue` |
| `worker:character-corporation-history` | `worker:character-corporation-history:rs` | aynı kuyruğu tüketir                      |

Seri boyunca anlaşılan kural: **taşırken düzelt, düzeltmeyi TypeScript tarafına
da uygula.**

## Bugün

**Queue script** (`backend/src/queues/queue-character-corporation-history.ts`):
argüman varsa yalnızca o karakter ID'leri, yoksa geçmişi hiç çekilmemiş ya da
`MAX(fetched_at)` değeri 6 günden eski olan bütün karakterler
(`queue-character-corporation-history.ts:39-50`). Mesaj
`{ entityId, queuedAt, source: 'queue-character-corporation-history' }`,
`persistent`, öncelik yok.

**Worker** (`backend/src/workers/worker-character-corporation-history.ts`),
mesaj başına:

1. `GET /characters/{id}/corporationhistory/` (`character.service.ts:65-72`).
   Kayıt: `{ corporation_id, record_id, start_date, is_deleted? }`.
2. `saveCorporationHistory`
   (`character-corporation-history-writer.ts:20-58`): `unnest` ile tek ifade.
   Gelen kayıtları upsert eder, karakterin gelmeyen satırlarına da aynı
   `fetched_at` damgasını basar. Damga UTC metin olarak `timestamp(3)`'e gider.
3. `findMissingCorporationIds`: kayıtlardaki farklı corp ID'lerinden
   `corporations`'ta olmayanlar.
4. Her eksik corp için `esi_corporation_info_queue`'ya
   `{ entityId, queuedAt, source: 'worker-character-corporation-history' }`,
   `persistent`, öncelik yok.
5. Ack. Satır:
   `  ✅ [n] character {id}: {r} records, {m} corporations queued`.

Prefetch info worker kuralıyla: `max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`.

## Kusurlar (taşırken düzeltilecek)

1. **Worker: ack, corp mesajlarının onayından önce.** `sendToQueue` confirm'siz;
   worker 4. ile 5. adım arasında ölürse ya da broker mesajı almadan bağlantı
   koparsa karakter ack'lenmiş, corp mesajları kaybolmuş olur. Bir dahaki
   `fetched_at` 6 gün sonra geldiği için kayıp ancak haftalık
   `queue:character-corporations` taramasıyla telafi edilir.
2. **Queue script: confirm yok, ardından `process.exit`.**
   `queue-character-corporations`'ta düzelttiğimiz kusurun aynısı.

## Hedefler

1. **Rust `queue-character-corporation-history`**
   (`backend-rs/queues/queue-character-corporation-history/`):
   `queue-characters`'ın yapısı. `parse_ids` ile komut satırı ID'leri, yoksa
   Node'daki stale sorgusu birebir. `mq::publish_entities` ile confirm'li
   yayın. Log satırları Node'la aynı metin; batch satırı `debug`, yalnızca 100'den
   fazla ID'de (Node'daki gibi). Başarı satırındaki worker ipucu `:rs` komutunu
   anar.
2. **Rust `worker-character-corporation-history`**
   (`backend-rs/workers/worker-character-corporation-history/`): `runner::Worker`.
   - `QUEUE_NAME = "esi_character_corporation_history_queue"`,
     `OUTPUT_QUEUE = Some("esi_corporation_info_queue")`,
     `ENTITY = "character"`, `WAITING_FOR = "characters"`,
     `STARTED = "🏢 character corporation history worker started"`,
     `CONSUMER_TAG = "worker-character-corporation-history-rs"`.
   - `handle`: ESI'den geçmiş (`/characters/{id}/corporationhistory/`, Node'daki
     gibi sonda `/`), Node'daki ifadenin birebir aynısıyla kayıt, eksik corp'ları
     bulma, `ctx.publisher().publish(...)` ile öncelik vermeden yayın. Ack'i
     runner, yayın onaylandıktan sonra yapar; kusur 1 Rust'ta böylece kapanır.
   - Detail: `" character {id}: {r} records, {m} corporations queued"`.
   - Özet: `📊 final: {processed} processed ({errors} errors)`, Node'un metni.
3. **`runner`'a yeni sonuç: `Outcome::Saved { queued: u64 }`.** Anlamı: "veritabanına
   yazdım, ayrıca şu kadar mesaj yayınladım". `success_line` her zaman `✅` basar,
   `queued` 0 olsa bile. Toplamda `queued` sayacına eklenir. `Queued(0)` için
   `⚠️` kuralı ve diğer worker'lar değişmez. Kullanıcının seçimi (1a).
4. **Node worker: ack öncesi onay.** Worker ömür boyu açık tek bir confirm
   channel açar (`getRabbitMQConfirmChannel()`, bağlantı yenilendiğinde o da
   yenilenir). Corp mesajları bu kanaldan, her biri kendi callback'iyle basılır.
   Callback'ler promise'e çevrilip beklenir; karakter mesajı ancak hepsi ack
   aldıktan sonra ack'lenir. Bir nack ya da kanal hatası `handleWorkerError`'a
   düşer. Kullanıcının seçimi (2a). `processCharacter`'ın imzası buna göre
   değişir, spec'i güncellenir.
5. **Node queue script:** `publishEntitiesConfirmed` ile basar, onayları
   bekledikten sonra çıkar.
6. **Dokümanlar:** `character-corporation-history.md`'nin komut tablosu `:rs`
   komutları ve parantez içinde Node adlarıyla güncellenir, `daily.md`'de
   bu zincir geçiyorsa aynı şekilde.

## Hedef olmayanlar

- systemd unit'leri ve timer'lar Node'u çalıştırmaya devam eder.
- SQL değişmez: stale sorgusu, upsert ifadesi, eksik corp sorgusunun anlamı.
- Node script'leri silinmez.
- `scan:entities` ve diğer Node queue script'leri.
- Rust worker'ına Node'un her 50 mesajda bir bastığı `📊 summary` satırı
  eklenmez. Runner'ın kuyruk boşalınca bastığı özet yeterli, diğer Rust
  worker'ları da böyle.

## Anti-hedefler

- Ack'in onaydan önce gelmesi, Rust'ta ya da Node'da.
- Bir corp mesajının nack'lenip karakter mesajının yine de ack'lenmesi.
- `fetched_at`'in yerel saatle yazılması. Damga UTC olmalı, Node'la aynı.

## Yaklaşımlar

**`runner` ve "0 kuyruğa kondu":**

- **(a) `Outcome::Saved { queued }`.** Seçilen. Yeni anlam yeni bir değer
  olarak ifade edilir, mevcut iki worker'a dokunulmaz.
- (b) `Worker` trait'ine `const EMPTY_IS_WARNING` ayarı. Aynı `Queued(0)` değeri
  worker'a göre farklı anlama gelir.
- (c) `Updated`'ı kullanıp sayıyı detail'e yazmak. "Updated" sayacı yanlış şeyi
  sayar, kuyruğa konan toplam kaybolur.

**Node worker'ında onay:**

- **(a) Ömür boyu tek confirm channel, mesaj başına callback.** Seçilen. Her
  mesaj yalnızca kendi onayını bekler.
- (b) Mesaj başına `publishEntitiesConfirmed`. Her karakter için kanal aç-kapat.
- (c) Paylaşılan kanalda `waitForConfirms()`. Prefetch 25'te mesajlar birbirinin
  onayına takılır.

## Kararlarım (düzeltilebilir)

- **ESI'nin `start_date`'i** RFC 3339 metin; Rust'ta `DateTime<Utc>` olarak
  okunup `timestamp(3)`'e UTC naive olarak yazılır. Node'un metin olarak
  göndermesiyle aynı sonucu verir.
- **`is_deleted` alanı ESI'de yoksa `false`**, Node'daki gibi.
- **Eksik corp sorgusu** Rust'ta tek bir `SELECT ... WHERE id = ANY($1)`;
  Node'daki `findMany`'nin eşdeğeri, sırası önemli değil.
- **Boş geçmiş** (ESI `[]` döner) Node'daki gibi işlenir: kayıt yok, yine de
  karakterin satırlarına damga basılır, `0 records, 0 corporations queued`.
- **404** (silinmiş karakter) runner'ın ortak hata yolunda uyarı ve atlama,
  Node'daki `handleWorkerError` gibi.
- **Testler:** Rust'ta `#[sqlx::test]` ile kayıt ifadesi (yeni kayıt, mevcut
  kaydın güncellenmesi, gelmeyen satıra damga, boş geçmiş) ve eksik corp sorgusu;
  queue tarafında stale sorgusu (hiç çekilmemiş, 6 günden eski, yeni çekilmiş).
  `runner`'da `Saved` için `success_line` ve toplam testi. Node'da worker spec'i:
  onay gelmeden ack yok, nack'te ack yok ve `handleWorkerError` çağrılır.
- **`sqlx::query!` makrosu kullanılırsa** `backend-rs/.sqlx` cache'i
  güncellenir; CI `SQLX_OFFLINE=true` ile derliyor.

- **Kapanan confirm channel'da bekleyen onay asılı kalmaz.** Kanal onaylar
  gelmeden kapanırsa bekleyen her mesajın promise'i reddedilmeli, karakter
  mesajı `handleWorkerError`'a düşmeli. amqplib'in kapanışta bekleyen
  callback'leri çağırdığı varsayılmaz, testle doğrulanır.
- **Kayıp yayın kanalı Node'da bir deneme hakkı yer, Rust'ta yemez.** Node'da
  `handleWorkerError` yoluna düşer; Rust'ta `PublisherLost` deneme saymadan
  yeniden teslim edilir. Bilinçli fark, runner'ın mevcut davranışı.

## Kurucuya kalanlar

- Rust ESI kayıt tipinin adı ve modül yerleşimi.
- Node confirm channel'ının yeniden bağlanma döngüsüne nasıl bağlanacağı
  (`characterCorporationHistoryWorker`'daki `while` döngüsü kanalı her turda
  yeniden alıyor).
