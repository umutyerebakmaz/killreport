# Rust `worker:killmail-detail` ve ortak killmail yazıcısı

Tarih: 2026-11-28 · İlgili: #315 §1 (`worker:killmail-detail`)

## Amaç ve neden

`worker:killmail-detail`'i Rust'a taşımak. #349'dan beri user ve corporation
killmail sync'inin ikinci aşaması bu worker'dır: `queue-killmail-refs`,
`killmail_refs`'te bekleyen satırları `esi_killmail_detail_queue`'ya koyar, bu
worker detayı ESI'dan çeker ve yazar. Taşınınca sync hattı baştan sona Rust olur.

Seri boyunca olduğu gibi "düzelterek taşıyoruz, TypeScript tarafında da": yazıcıda
bulunan hatalar hem Rust'ta hem Node `saveKillmail`'de düzeltilir.

## Bugün nasıl çalışıyor

- Mesaj: `{killmailId, killmailHash, announce}`
  (`backend/src/services/killmail-detail-message.ts:17`). `announce` publisher'ın
  kararıdır; `killmail_refs` her zaman `false` gönderir
  (`backend-rs/queues/queue-killmail-refs/src/lib.rs:27`).
- Worker (`backend/src/workers/worker-killmail-detail.ts`): prefetch sabit 10,
  public `/killmails/{id}/{hash}/` çağrısı, sonra `saveKillmail`. Hatalar
  `handleWorkerError`'a gider.
- Yazıcı (`backend/src/services/killmail-writer.ts`): attacker yoksa reddeder,
  `findUnique` ile varlık kontrolü yapar, değeri hesaplar, bir transaction'da
  killmail + victim + attacker'lar + stats + item'ları yazar, **transaction'dan
  sonra** `killmail_filters`'ı yazar, `publish` açıksa Redis `NEW_KILLMAIL` ve
  `discord_webhook_queue` yayınlar. P2002'yi "zaten var" sayar.
- Yazıcıyı ayrıca Node `worker-redisq-stream.ts` ve `fetch-single-killmail.ts`
  kullanır.

## Hedefler

1. Rust `worker-killmail-detail`, Node worker'ın yerine geçebilecek durumda:
   aynı kuyruk, aynı mesaj, aynı satırlar.
2. Yazma mantığı tek bir Rust lib crate'inde (`crates/killmail-writer`), böylece
   Rust redisq ikinci bir kopya yazmadan aynısını kullanır.
3. Aşağıdaki üç düzeltme hem Rust'ta hem Node yazıcısında.

## Düzeltmeler (Rust ve Node)

1. **`killmail_filters` aynı transaction'a girer.** Bugün commit ile filter insert'ü
   arasında bir hata olursa (`insertKillmailFilter` hatayı loglayıp yutuyor,
   `killmail-filters-realtime.ts:165`) killmail filtre satırı olmadan kalır. Sonraki
   her yazıcı onu "zaten var" diye atladığı için de bu kalıcı olur;
   `repair:killmail-derived` tam bu boşluk için var. Insert transaction'ın içine
   alınır ve hatası yutulmaz. `insertKillmailFilter`'ın `client` parametresi zaten
   var, Node yazıcısı ona `tx`'i verir. Yutma bloğu kaldırılır; repair script'i
   zaten satırı geri okuyarak kontrol ediyor, onun davranışı değişmez.
2. **Stats'teki hata yutma kaldırılır** (`kill-stats-realtime.ts:101`). Postgres'te
   hata veren statement transaction'ı abort eder, commit yine düşer; yutmak hatayı
   yanlış yerde ve yanlış mesajla ("periodic worker düzeltir"; böyle bir worker
   yok) gösteriyor. Hata yukarı çıkar.
3. **Varlık kontrolü transaction'ın ilk adımı olur.** `findUnique` → `create` →
   P2002 yerine `INSERT INTO killmails … ON CONFLICT (killmail_id) DO NOTHING
RETURNING killmail_id`. Satır dönmezse sonuç "zaten var" olur, transaction
   rollback edilir ve başka bir şey yazılmaz. İki kaynak aynı killmail'i aynı anda
   yazarsa hakemi tek bir statement olur. Değer hesabı (salt okuma)
   transaction'dan önce yapılır.

## Yaklaşımlar

- **A — yazıcı ayrı lib crate'te (seçilen).** `crates/killmail-writer`, worker
  ince kalır. Rust redisq aynı crate'i kullanacak; `crates/killmail-value` de bu
  yüzden ayrı yazılmıştı.
- **B — yazıcı worker crate'inin içinde.** Bugün daha az dosya demek, ama redisq
  taşınırken ya kopyalanır ya da o zaman çıkarılır. Reddedildi.
- **C — Rust worker Node yazıcısını çağırır.** Süreç sınırı yüzünden anlamsız.
  Reddedildi.

## Tasarım

### `crates/killmail-writer`

- ESI detail'in serde tipleri: `KillmailDetail`, `Victim`, `Attacker`, `Item`,
  `Position`. ESI'nın göndermediği alanlar `Option` olur.
- `save(pool, &detail, hash) -> Result<Saved>`, `Saved = Written | AlreadyStored`.
  Adımlar:
  1. Attacker listesi boşsa hata ("refusing to write it", Node ile aynı).
  2. `killmail-value` ile değer: önce `type_info`, sonra `compute`.
  3. Tek transaction:
     - killmail claim'i (düzeltme 3)
     - victim
     - attacker'lar (tek `UNNEST` insert)
     - item'lar (`item_type_id` null olanlar atlanır ve sayısı warn ile
       loglanır; tek `UNNEST` insert)
     - üç stats tablosu (benzersiz ID başına `+1`, Node ile aynı
       `ON CONFLICT DO UPDATE`)
     - `killmail_filters` (Node ile aynı SQL ve aynı join'ler)
- Kolon eşlemesi Node yazıcısıyla birebir aynıdır: `|| null` ile 0'ı null'a
  çeviren alanlar (victim `character_id`, `alliance_id`; attacker ID'leri,
  `quantity_*`) Rust'ta da 0 → NULL olur.
- `kill_date`, `killmail_time`'ın UTC tarihidir. Zaman UTC olarak bağlanır.
- Stats için Node her ID'ye ayrı statement gönderiyor. Rust tablo başına tek bir
  `UNNEST` + `ON CONFLICT DO UPDATE` kullanır (ID'ler önceden tekilleştirildiği
  için aynı statement'ta çakışma olmaz). Sonuç aynı, round-trip daha az.

### `workers/worker-killmail-detail`

- `runner` üzerinde, `QUEUE_NAME = "esi_killmail_detail_queue"`.
- `EntityQueueMessage`'a `fullSync`'in yanına iki opsiyonel alan eklenir:
  `killmailHash` (`Option<String>`) ve `announce` (varsayılan `false`). Worker
  `handle_message` override ile bunları okur. Hash yoksa mesaj hatalıdır ve paylaşılan
  hata yoluna gider.
- ESI çağrısı `esi` crate'inin client'ı üzerinden yapılır (`/killmails/{id}/{hash}/`).
  404/420/429, deneme sayısı ve park etme `mq::handle_worker_error`'da kalır.
  Attacker'ı olmayan killmail de oraya düşer ve beş denemeden sonra park edilir.
- Sonuç: `Written` → `Outcome::Saved { queued }`, `AlreadyStored` →
  `Outcome::Unchanged`.
- **`announce = true` ise, commit'ten sonra:**
  - Redis'e `PUBLISH NEW_KILLMAIL {"killmailId":…}`. Format, graphql-yoga redis
    event target'ının beklediği `PUBLISH <topic> <JSON>`'dur; publisher `sov`'daki
    `AlertPublisher` deseniyle kurulur (`USE_REDIS_PUBSUB=true` değilse sessiz
    kalır). Bu publisher, kanal adı parametre olarak alınacak şekilde
    genelleştirilir. Nerede duracağı builder'a kalır; `sov`'a bağımlılık yerine
    küçük ortak bir yer tercih edilir.
  - `discord_webhook_queue`'ya `{"killmailId":…}`, onaylı publish ile.
  - Bu adımların hatası loglanır ve mesaj yine ack edilir: veri yazılmıştır,
    duyuru bir kayıt değil bir nezakettir. Yeniden denemek zaten işe yaramaz,
    ikinci denemede sonuç "zaten var" olur.
- Prefetch: sabit 10 yerine runner'ın ortak kuralı
  (`max(ESI_PREFETCH, ceil(ESI_MAX_RPS/2))`, varsayılan 25). Worker pool'u 10'dur;
  fazla mesajlar connection bekler. Bu, ESI hızını limiter'ın belirlemesi
  hedefiyle uyumludur.
- Script: `worker:killmail-detail:rs` (diğer `:rs` script'leriyle aynı biçimde).

### Node tarafı

- `killmail-writer.ts`: düzeltme 1 ve 3 (claim insert, filter `tx` ile).
- `kill-stats-realtime.ts` ve `killmail-filters-realtime.ts`: yutma blokları
  kaldırılır (düzeltme 1, 2). `updateDailyAggregatesBatch` zaten throw ediyor.
- Spec'ler güncellenir: claim'in "zaten var" yolu, filter'ın tx içinde yazılması,
  stats hatasının yukarı çıkması.

### Dokümanlar

- `backend/docs/esi/esi-user-killmail-sync.md`: Rust worker ve script.
- #315: merge'den sonra `worker:killmail-detail` satırı işaretlenir.

## Hedef olmayanlar

- Rust redisq ve `fetch:killmail` taşınmaz; Node yazıcısını kullanmaya devam
  ederler (düzeltmeler onlara da gelir).
- `repair:killmail-derived` değişmez.
- systemd unit'i Rust'a geçirilmez (ayrı, küçük PR'lar).
- `killmail_refs` publisher'ı ve mesaj biçimi değişmez.

## Anti-hedefler

- Rust ile Node'un aynı killmail için farklı satır yazması: kolon eşlemesi,
  değerler ve stats/filters sonuçları birebir aynı olmalı.
- Bir killmail'in stats ya da filter satırı olmadan commit edilebilmesi.

## Builder'a kalanlar

- Genelleştirilmiş Redis publisher'ın yeri ve adı.
- Testlerin biçimi. Saf eşleme fonksiyonları için birim testleri, SQL için mevcut
  crate'lerdeki gibi `sqlx` testleri.
