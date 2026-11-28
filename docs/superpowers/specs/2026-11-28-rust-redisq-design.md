# Rust `worker:redisq`

Tarih: 2026-11-28 · İlgili: #315 (`worker:redisq`)

## Amaç ve neden

`worker:redisq`'i (`backend/src/workers/worker-redisq-stream.ts`) Rust'a taşımak.
Bu worker zKillboard R2Z2 akışından gelen her killmail'i canlı olarak yazar ve
duyurur: sitenin canlı listesi ve Discord bildirimleri buradan beslenir.
Taşınınca killmail yazan iki canlı yol da (detail ve redisq) aynı Rust yazıcısını
(`crates/killmail-writer`, #351) kullanır.

Seri boyunca olduğu gibi "düzelterek taşıyoruz, TypeScript tarafında da".

## Bugün nasıl çalışıyor

- Başlangıçta `https://r2z2.zkillboard.com/ephemeral/sequence.json`'dan güncel sıra
  numarasını alır, sonra `/{sequence}.json`'u sırayla okur
  (`worker-redisq-stream.ts:198`, `:253`). 200 → killmail, sıra ilerler, 100 ms
  bekler; 404 → henüz yok, 6 sn bekler ve aynı numarayı dener; 403/429 → 5 sn
  bekler, ilerlemez. R2Z2 sınırı IP başına 15 istek/sn.
- Payload ESI killmail'ini içerir; şekli bozuksa (`isUsableEsiKillmail`, `:226`)
  `/killmails/{id}/{hash}/`'den çeker. Hash `zkb.hash ?? hash`.
- `REDISQ_ENABLE_ENRICHMENT !== 'false'` ise kayıttan **önce** killmail'de geçen
  eksik alliance, corporation, character ve tipleri (victim, attacker'lar,
  attacker silahları, item'lar) ESI'dan çekip doğrudan yazar (`:359`), 10'arlı
  paralel gruplarla, bu sırayla. Amaç: killmail canlı listede isimleri eksik
  ("Unknown") görünmesin. Bir entity çekilemezse loglanır, killmail yine yazılır.
- `saveKillmail(killmail, hash)` yazar ve yeni ise duyurur: Redis `NEW_KILLMAIL`
  ve `discord_webhook_queue`.
- ESI `live` öncelikte, en fazla 10 sn bekleme ile (`:116`).
- İşleme hatası loglanır ve yutulur, sıra yine ilerlemiştir (`:350`): killmail
  kaybolur.
- Sıra numarası yalnızca bellektedir: yeniden başlatmada güncel sıradan başlar,
  aradaki killmail'ler kaybolur.
- Kuyruk tüketmez; `resolvers/worker/helpers.ts:84` onu `STANDALONE_WORKERS`
  içinde process adıyla izler.

## Hedefler

1. Rust `worker-redisq`, Node worker'ın yerine geçebilecek durumda: aynı akış, aynı
   bekleme süreleri, aynı satırlar, aynı duyurular, kayıttan önce enrichment.
2. Hiçbir killmail kaybolmaz: ne yeniden başlatmada ne de bir yazma hatasında.
3. Dört entity tablosunun yazma mantığı tek yerde: info worker'lar ve redisq aynı
   kodu çağırır.

## Hedef dışı

- systemd unit'ini Rust binary'sine çevirmek (CI binary'leri işinin parçası).
- Node redisq'teki enrichment kopyasını Node info servislerine bağlamak.
- `killmail_filters` self-heal sorusu (#351'den açık).

## Tasarım

### 1. Kaldığı yer: `stream_cursors` tablosu

Yeni tablo, Prisma modeli `StreamCursor` ile:

```sql
CREATE TABLE stream_cursors (
  stream     TEXT PRIMARY KEY,      -- 'r2z2'
  sequence   BIGINT NOT NULL,       -- sıradaki okunacak numara
  updated_at TIMESTAMP(3) NOT NULL  -- UTC
);
```

Migration `backend/prisma/CLAUDE.md`'deki diff-and-deploy yöntemiyle yazılır.

- Başlangıçta satır varsa oradan, yoksa `sequence.json`'dan başlar (satırı yazar).
- Sıra numarası **bir killmail sonuçlandıktan sonra** ilerler ve yazılır.
  Sonuçlanmak: kaydedildi, zaten vardı, ya da `killmail_refs`'e düştü (§3).
- Her killmail'den sonra tek bir `UPDATE`; akış saniyede birkaç killmail, yükü
  önemsiz.

### 2. 404 ve kayıp dosyalar

404'te `sequence.json` okunur:

- Baş (head) ≤ bizim numara: yeni killmail yok, 6 sn bekle, aynı numarayı dene
  (bugünkü gibi).
- Baş > bizim numara: dosya ya numarada boşluk, ya R2Z2 artık tutmuyor, ya da
  henüz her yerde okunur hâle gelmemiş (R2Z2 statik dosya sunuyor, baş dosyadan
  önce ilerleyebilir). Atlanmış bir numara hiçbir iz bırakmaz (ID yok, refs'e
  yazılamaz), bu yüzden hemen atlanmaz: aynı numara 6 sn arayla **3 kez** 404
  verir ve baş her seferinde ileride kalırsa atlanır (uyarı loglanır), 100 ms
  sonra devam.
- Art arda 10 numara bu yolla atlandıysa kayıtlı numara R2Z2'nin tuttuğu
  aralığın dışında kalmıştır: başa atlanır (uyarı loglanır). Böylece günlerce
  eski bir numara binlerce istekle tek tek yürümez. Arada bir 200 sayacı
  sıfırlar. (Benim kararım; R2Z2'nin ne kadar süre tuttuğu belgede yazmıyor, bu
  kural iki durumda da doğru davranır.)

403/429 bugünkü gibi: 5 sn bekler, ilerlemez. Ağ/5xx hataları da bugünkü gibi:
ilerlemez, her hatadan sonra 100 ms, art arda her 5. hatada 5 sn bekler
(`worker-redisq-stream.ts:146-165`).

200 dönüp gövdesi okunamıyorsa (JSON değil ya da şekli farklı):
`killmail_id` ve hash çıkarılabiliyorsa §3'teki gibi `killmail_refs`'e düşer;
çıkarılamıyorsa hata loglanır ve numara atlanır. Bugün Node bu durumda aynı
numarada sonsuza dek takılıyor; akışın durması bir killmail'den daha pahalı.

### 3. Bir killmail yazılamazsa: `killmail_refs`

- Payload bozuk ve ESI'dan çekmek de başarısız (ESI hatası, 10 sn'yi aşan
  bekleme), ya da `save` hata verdi → killmail `killmail_refs`'e yazılır:
  `killmail_refs::record(pool, &[Ref{id, hash}], "redisq", now)`. Sıra ilerler.
  Detail hattı (`queue:killmail-refs` → `worker:killmail-detail`) onu tekrar
  dener. O yoldan yazılan killmail duyurulmaz (refs her zaman `announce: false`
  gönderir); gecikmiş bir killmail'in canlı listeye düşmemesi doğru.
- `record` da başarısız olursa (veritabanı erişilemiyor) sıra **ilerlemez**: 5 sn
  bekleyip aynı numarayı baştan işler. Killmail ancak bir yere yazıldığında
  geride bırakılır.

### 4. Enrichment: kayıttan önce, ortak kodla

Yeni lib crate `backend-rs/crates/entity-info`. Dört info worker'ın bugünkü
modülleri buraya taşınır, testleri ve fixture'larıyla:

- `character` (`CharacterInfo`, `title_fields`, `upsert_character`,
  `CHARACTER_COMPATIBILITY_DATE`), `corporation`, `alliance`, `type_info`.
- Her modüle ESI çağrısını da içeren bir fonksiyon eklenir:
  `fetch_and_upsert_<entity>(pool, esi, id) -> anyhow::Result<bool>`
  (bool: yeni satır mı). Info worker'ların `handle`'ı bunu çağırır; ESI yolu
  (trailing slash, compatibility date) da tek yerde kalır.

Info worker'ların davranışı değişmez; yalnızca kodları crate'ten gelir.

Redisq'te akış:

1. Killmail'deki ID'ler toplanır: Node'un topladıklarının aynısı (victim
   character/corp/alliance/ship; attacker character/corp/alliance/ship/weapon;
   item tipleri), tekilleştirilmiş, null/0 hariç.
2. Veritabanında olmayanlar dört `SELECT id … WHERE id = ANY($1)` ile bulunur.
3. Eksikler Node sırasıyla (alliance → corporation → character → type), her
   grupta en fazla 10 paralel, `fetch_and_upsert_*` ile yazılır.
4. Çekilemeyen bir entity (ESI hatası, 404, bekleme sınırı) loglanır ve ID'si
   kendi info kuyruğuna (`esi_<entity>_info_queue`) yollanır; yayın da
   başarısız olursa yalnızca loglanır (`scan:entities` yine yakalar). Killmail
   yine yazılır.
5. `REDISQ_ENABLE_ENRICHMENT=false` ise 1–4 atlanır.

### 5. Yazma ve duyuru

`killmail_writer::save(pool, &detail, hash, now)`. `Saved::Written` ise
detail worker'daki gibi: `NEW_KILLMAIL {"killmailId": N}` ve
`discord_webhook_queue`'ya `mq::publish_killmails` (kaynak `"worker-redisq"`).
Duyuru hataları loglanır ve yutulur. `AlreadyStored` duyurulmaz.

`RedisPubSub` (#351) bağlantıyı sonsuza dek önbelleğe alıyor, kopunca bir daha
bağlanmıyor. Uzun süre açık kalan bir akış için `redis::aio::ConnectionManager`'a
geçirilir (otomatik yeniden bağlanma). Sovereignty ve detail de bundan
faydalanır; davranışları değişmez.

### 6. ESI önceliği

Bugün her Rust isteği `Priority::Bulk` ile sınırsız bekler
(`crates/esi/src/shared_limiter.rs:381`, `client.rs:206`). `EsiClient`'a
`live(self, max_wait: Duration) -> Self` eklenir: o istemciden giden her istek
`Priority::Live` ile ve en fazla `max_wait` bekleyerek slot alır. Limiter'ın
`acquire`'ı önceliği parametre olarak alır; diğer tüm worker'lar `Bulk` ve
sınırsız beklemede kalır. Redisq `live(Duration::from_secs(10))` kullanır.

### 7. Binary ve çalışma

- `backend-rs/workers/worker-redisq/` (lib + main, testler lib'e erişir). Kuyruk
  tüketmediği için `runner::run` değil; `runner::init`, `db::worker_pool`,
  ESI istemcisi, `mq::connect` (yalnızca yayın için) ve `RedisPubSub`'ı kendisi
  kurar. RabbitMQ koparsa yayın kanalı yeniden kurulur; akış durmaz.
- SIGINT/SIGTERM: elindeki killmail'i bitirir, sırayı yazar, çıkar.
- R2Z2 istekleri `reqwest` ile, Node'daki `User-Agent` ile; ESI limiter'ından
  geçmez (ESI değil).
- `backend/package.json`: `worker:redisq:rs`.
- Worker durumu: `checkWorkerProcess` (`resolvers/worker/helpers.ts`) bugün
  yalnızca `node` process'lerinde `workers/worker-redisq` ya da
  `worker-redisq.ts` arıyor; Rust binary'si (`target/release/worker-redisq`)
  görünmez ve `workerStatus` redisq'i kapalı gösterir. Kontrol, Rust
  binary'sini de (`target/*/worker-redisq`) tanıyacak şekilde genişletilir,
  spec testiyle. Diğer standalone kontroller değişmez.
- Log satırları Node'unkine benzer: kaynak (payload/ESI), kaydedildi/atlandı,
  enrichment sayıları, refs'e düşenler.

### 8. Node tarafı

Node redisq de aynı düzeltmeleri alır, böylece ikisi arasında geçiş yapmak sırayı
kaybettirmez:

- `stream_cursors` satırını okur/yazar (§1, §2 aynı kurallarla).
- Yazılamayan killmail'i `killmail_refs`'e `source = 'redisq'` ile yazar, yazamazsa
  ilerlemez (§3).
- Kullanılmayan `emptyCheckInterval` kaldırılır.

İkisi aynı anda çalıştırılmaz (aynı satırı yazarlar); bu bugün de iki Node
redisq için geçerli.

## Testler

- `entity-info`: taşınan testler aynen geçer; `fetch_and_upsert_*` için wiremock
  ESI ile birer test.
- `esi`: `live` istemci `Priority::Live` ister ve `max_wait`'i aşan beklemede
  `EsiThrottled` döner; varsayılan istemci `Bulk` kalır.
- `pubsub`: Redis koptuktan sonra yayın yeniden bağlanır (ignored, gerçek Redis).
- `worker-redisq` (wiremock R2Z2 + ESI, `#[sqlx::test]` fixture'ları):
  satır yoksa `sequence.json`'dan başlar; satır varsa oradan; 200'de yazar ve
  sırayı ilerletir; 404 + baş gerideyse bekler; 404 + baş ilerideyse ilk iki
  denemede beklemeye devam eder, üçüncüde bir atlar; 10 atlamada başa geçer;
  okunamayan 200 gövdesi ID varsa refs'e düşer, yoksa atlanır; bozuk ESI
  kopyası ESI'a düşer; ESI de başarısızsa
  `killmail_refs`'e yazar ve ilerler; refs yazılamazsa ilerlemez; eksik
  entity'ler kayıttan önce yazılır; çekilemeyen entity info kuyruğuna gider;
  enrichment kapalıyken ESI'a gidilmez; `AlreadyStored` duyurulmaz.
- Node: `stream_cursors` ve refs düşüşü için spec testleri.

## Builder'a kalanlar

- Modül ve fonksiyon adları, log metinleri.
- `stream_cursors` erişimi için küçük bir fonksiyon seti
  (`load`/`save`) nerede durur: `worker-redisq` lib'i yeterli.
