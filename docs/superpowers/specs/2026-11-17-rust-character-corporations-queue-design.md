# Rust `queue:character-corporations` ve onaylı Node yayını

Kısa tasarım. #315'teki ikinci grubun ilk yarısı; `scan:entities` ayrı bir
PR'da, bu PR'ın getirdiği Node yardımcısını kullanarak gelir.

## Amaç ve neden

`backend/docs/ops/daily.md`'de haftalık sıranın 4. adımı
(`yarn queue:character-corporations`) Rust komutlarının arasında tek başına
Node olarak duruyor. Kullanıcı bunu Rust'a taşımak istiyor; seri boyunca
anlaşılan kural "taşırken düzelt, düzeltmeyi TypeScript tarafına da uygula".

## Bugün

`backend/src/queues/queue-character-corporations.ts`:

- `characters.corporation_id` ∪ `character_corporation_history.corporation_id`
  kümesinden `corporations`'ta olmayanları tek bir anti-join ile buluyor
  (`UNION` + `NOT EXISTS`, `ORDER BY`). Bu kısım doğru, değişmiyor.
- Her ID için `esi_corporation_info_queue`'ya
  `{ entityId, queuedAt, source: 'queue-character-corporations' }` basıyor,
  `persistent: true`, öncelik yok.
- **Kusur:** `sendToQueue` publisher confirm beklemeden dönüyor, script ardından
  `process.exit(0)` yapıyor. Broker'ın henüz almadığı mesajlar kaybolabilir,
  "queued successfully" yazısı bunu garanti etmiyor. Node tarafında hiçbir
  script confirm kullanmıyor (`rabbitmq.ts`'te `createConfirmChannel` yok).

## Hedefler

1. **Rust `queue-character-corporations` crate'i**
   (`backend-rs/queues/queue-character-corporations/`), `queue-corporations`
   ile aynı yapı: `lib.rs`'te `QUEUE_NAME`, `SOURCE` ve ID sorgusu, `main.rs`'te
   bağlan → `declare_worker_queue` → `mq::publish_entities` (confirm'li) →
   kapat. Aynı SQL, aynı mesaj, aynı `source`, aynı log satırları.
   `yarn queue:character-corporations:rs` script'i.
2. **Node'a onaylı yayın yardımcısı** (`backend/src/services/rabbitmq.ts`):
   Rust'taki `publish_entities`'in karşılığı. Confirm channel üzerinde her ID
   için bir `EntityMessage` basar, `waitForConfirms()` ile bekler, onaylanan
   sayıyı döner; nack hata olur. `queue-character-corporations.ts` bunu
   kullanır ve `process.exit`'ten önce onayları bekler.
3. **Dokümanlar:** `daily.md`'de 4. adım ve "Detect and Update Missing
   Corporations" `:rs`'ye geçer, "Node only" cümlesi yalnızca `scan:entities`'i
   anar. `enrichment.md` ve `character-corporation-history.md`'de komut adı
   geçen yerler aynı şekilde güncellenir.

## Hedef olmayanlar

- systemd timer'ı (`killreport-queue-character-corporations.service`) Node'u
  çalıştırmaya devam eder.
- Diğer Node queue script'leri yeni yardımcıya taşınmaz. `scan:entities`
  sonraki PR'da kullanır; kalanlar kendi işleri.
- Node script silinmez; seri boyunca ikisi yan yana durdu.
- SQL değişmez.

## Yaklaşımlar

1. **`queue-corporations`'ı kopyala, sorguyu değiştir.** (Seçilen) Mevcut
   `mq` API'si yeterli; tek kuyruk, tek yayıncı, desen birebir. Komut satırı
   ID argümanı yok, çünkü Node'da da yok.
2. **`queue-corporations`'a bir `--missing-from-characters` bayrağı ekle.** Bir
   crate az olur, ama bir binary iki ayrı işi yapar ve her script'in bir
   karşılığı olması kuralını bozar.
3. **Node'u hiç düzeltme, yalnızca Rust'a geç.** Daha az iş, ama timer Node'u
   çalıştırdığı için gerçek kusur sunucuda kalır ve anlaşılan kurala aykırı.

## Kararlarım (düzeltilebilir)

- **Liste boşsa** Node gibi `✅ no missing corporations to queue!` yazıp RabbitMQ'ya
  hiç bağlanmadan çıkar.
- **Batch log'u** Node'un metniyle (`queued batch i/n (k corporations)`),
  `queue-corporations`'taki gibi `debug` seviyesinde.
- **Node yardımcısı** kendi confirm channel'ını paylaşılan bağlantı üzerinde
  açar; `getRabbitMQChannel()`'ın döndürdüğü düz kanal değişmez, API sunucusu
  etkilenmez.
- **Testler:** Rust'ta `#[sqlx::test]` ile sorgu testi (karakterde, geçmişte ve
  ikisinde birden olan ID; `corporations`'ta olan ID düşer; sıra). Node'da
  yardımcı için sahte kanallı bir vitest (onay sayısı, nack'te hata).

## Kurucuya kalanlar

- Node yardımcısının adı ve imzası (`priority` parametresi `scan:entities` için
  gerekli olacak, şimdiden alınabilir).
- Kanalın kapatılma sırası ve hata yolundaki çıkış kodu, Node'un bugünkü
  davranışı korunarak.
