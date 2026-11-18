# Rust `scan:entities` ve dört anti-join

Kısa tasarım. #315'in son parçası: `backend/docs/ops/daily.md`'de Node'a özel
kalan tek komut `scan:entities`. Seri boyunca geçerli kural aynı: "taşırken
düzelt, düzeltmeyi TypeScript tarafına da uygula".

## Amaç ve neden

Kullanıcı `daily.md`'nin baştan sona Rust komutlarıyla çalışmasını istiyor.
`scan:entities`, killmail'lerde geçen ama veritabanında henüz olmayan
karakter, corporation, alliance ve type ID'lerini bulup dört info worker'ın
kuyruğuna atıyor.

## Bugün

`backend/src/workers/scan-killmail-entities.ts`:

- Bütün killmail'leri `victim`, `attackers` ve `items` ile birlikte 100'erli
  gruplar halinde belleğe çekiyor (2026-11-19 itibarıyla 193.324 killmail,
  1.166.767 attacker, 3.106.074 item). Ardından `characters`,
  `corporations`, `alliances` ve `types` tablolarının bütün ID'lerini de
  yükleyip farkı JavaScript'te alıyor. CLAUDE.md'nin "fetch everything and
  filter in JavaScript" yasağının ta kendisi.
- **Kusur 1:** `findMany` `skip`/`take` ile sayfalıyor ama `orderBy` yok.
  PostgreSQL sırayı garanti etmediği için sayfalar arasında killmail
  atlanabilir ya da iki kez okunabilir.
- **Kusur 2:** `sendToQueue` publisher confirm beklemiyor ve dönüş değerine
  (backpressure) bakmıyor. Bütün mesajlar bir anda buffer'a yığılıyor, script
  de `$disconnect` ile bitiyor. Broker'ın henüz almadığı mesajlar
  kaybolabilir.
- Hiç çağrılmayan `isNPCCharacter` ve `isNPCCorporation` fonksiyonları var.
- Mesajlar: `{ entityId, queuedAt, source: 'killmail_scan' }`,
  `persistent: true`, `priority: 5`.

ID kaynakları:

| Kuyruk                       | Kaynak sütunlar                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `esi_character_info_queue`   | `victims.character_id`, `attackers.character_id`                                                            |
| `esi_corporation_info_queue` | `victims.corporation_id`, `attackers.corporation_id`                                                        |
| `esi_alliance_info_queue`    | `victims.alliance_id`, `attackers.alliance_id`                                                              |
| `esi_type_info_queue`        | `victims.ship_type_id`, `attackers.ship_type_id`, `attackers.weapon_type_id`, `killmail_items.item_type_id` |

2026-11-19 ölçümü: eksik 140 karakter, 1 corporation, 1 alliance, 0 type.
Dört anti-join'in en yavaşı (types) ~1,5 s.

## Hedefler

1. **Dört Rust queue crate'i** (`backend-rs/queues/`), her biri
   `queue-character-corporations` ile aynı yapıda: `lib.rs`'te `QUEUE_NAME`,
   `SOURCE` ve tek bir anti-join, `main.rs`'te havuz → sorgu → havuzu kapat →
   bağlan → `declare_worker_queue` → `mq::publish_entities` (confirm'li,
   `Some(5)`) → kapat.
   - `queue-killmail-characters` → `esi_character_info_queue`
   - `queue-killmail-corporations` → `esi_corporation_info_queue`
   - `queue-killmail-alliances` → `esi_alliance_info_queue`
   - `queue-killmail-types` → `esi_type_info_queue`

   Her biri için `backend/package.json`'da `queue:killmail-<domain>:rs`
   script'i, ve tek satırlık zincir:

   ```text
   "scan:entities:rs": "yarn queue:killmail-characters:rs && yarn queue:killmail-corporations:rs && yarn queue:killmail-alliances:rs && yarn queue:killmail-types:rs"
   ```

2. **SQL**, her domain için `queue-character-corporations`'taki biçim:
   kaynak sütunların `UNION`'ı, `IS NOT NULL`, hedef tabloya `NOT EXISTS`,
   `ORDER BY`. Örnek (characters):

   ```sql
   SELECT ids.id
   FROM (
     SELECT character_id AS id FROM victims WHERE character_id IS NOT NULL
     UNION
     SELECT character_id FROM attackers WHERE character_id IS NOT NULL
   ) ids
   WHERE NOT EXISTS (SELECT 1 FROM characters c WHERE c.id = ids.id)
   ORDER BY ids.id
   ```

3. **Node `scan-killmail-entities.ts` düzeltilir:** aynı dört SQL
   `$queryRaw` ile çalışır, her kuyruk `publishEntitiesConfirmed(queue,
'killmail_scan', ids, { priority: 5 })` ile yayınlanır. Bellekteki tarama,
   tablo dökümleri ve kullanılmayan iki `isNPC*` fonksiyonu silinir. Komut adı
   (`scan:entities`) ve dosya yeri değişmez.

4. **Dokümanlar:** `daily.md`'de "One command is still Node only" cümlesi ve
   "Scenario 2"deki not kalkar, komut `scan:entities:rs` olur, worker
   tablosuna dört komut eklenir. `enrichment.md`, `worker-documentation.md`,
   kök `CLAUDE.md` ve `README.md`'de komutun geçtiği yerler `:rs`'yi anar ve
   "walks killmails" anlatımı anti-join'e göre düzeltilir.

## Hedef olmayanlar

- **NPC filtresi yok.** Bugünkü gibi her ID kuyruğa girer. Veriler bunu
  destekliyor: killmail'lerdeki 18 NPC karakterin hepsi `characters`'ta, 180
  NPC corporation `corporations`'ta; ESI hepsini çözüyor, killmail sayfaları
  isimlerini kullanıyor.
- systemd timer'ı yok; `scan:entities`'in bugün de timer'ı yok.
- Node script silinmez, dört parçaya bölünmez. Seri boyunca ikisi yan yana
  durdu; Rust zinciri Node script'inin karşılığıdır.
- `scan-killmail-entities.ts` `workers/`'tan `queues/`'a taşınmaz.
- 404 dönen (silinmiş) karakterlerin her çalıştırmada yeniden kuyruğa girmesi
  bu PR'ın işi değil. Bugünkü sayı 140, maliyeti ihmal edilebilir.

## Yaklaşımlar

1. **Dört crate ve bir zincir.** (Seçilen) Rust tarafındaki her queue
   programı tek kuyruğa yazıyor, `queue:alliance-chain:rs` zincirin emsali.
   Parçalar tek tek de çalışabilir. Bedeli dört küçük crate.
2. **Tek crate (`queue-killmail-entities`), dört kuyruk.** Node'un birebir
   karşılığı, daha az dosya; ama tek kuyruk kuralından sapıyor.
3. **Yalnızca Node'u düzelt.** Daha az iş, ama `daily.md` tam Rust olmaz;
   istenen bu değil.

## Kararlarım (düzeltilebilir)

- **Liste boşsa** her Rust parçası `queue-character-corporations` gibi
  `✅ no missing <domain> to queue!` yazıp RabbitMQ'ya bağlanmadan başarıyla
  çıkar, böylece `&&` zinciri sürer. Node script'i boş kuyruğu atlayıp
  sıradakine geçer.
- **Bir parça hata verirse** zincir durur (`&&`). Her parça bağımsız ve
  idempotent olduğu için yeniden çalıştırmak güvenli.
- **`source`** dört Rust parçasında da Node'unkiyle aynı: `killmail_scan`.
- **Öncelik** `5` kalır, Node'daki gibi.
- **Log satırları** `queue-character-corporations`'ın kalıbında: `found N
missing <domain>`, batch'ler `debug`, sonda `✅ all N missing <domain> queued
successfully!` ve çalıştırılacak worker'ın adı.
- **Backpressure:** Rust'ta `publish_entities` her `basic_publish`'i await
  ediyor, buffer yığılmıyor. Node'da `publishEntitiesConfirmed` hâlâ
  `sendToQueue`'nun dönüşüne bakmıyor; bugünkü hacim (en fazla birkaç yüz
  mesaj) için sorun değil, bu PR'da değiştirilmez.
- **Testler:** her Rust crate için `#[sqlx::test]` ile sorgu testi: her kaynak
  sütundan gelen ID kuyruğa girer, NULL girmez, hedef tabloda olan düşer,
  tekrar eden ID bir kez çıkar, sıra artan. Node için mevcut
  `publish-entities.spec.ts` yayını kapsıyor; script'in kendisine test
  eklenmez (diğer queue script'lerinde de yok).

## Kurucuya kalanlar

- Test fixture'larının (`victims`, `attackers`, `killmail_items`,
  `killmails`) hangi zorunlu sütunlarla kurulacağı.
- Node script'inde dört sorgunun sırayla mı `Promise.all` ile mi çalışacağı.
