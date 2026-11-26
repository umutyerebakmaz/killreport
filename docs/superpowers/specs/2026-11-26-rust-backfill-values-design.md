# Rust backfill values: `queue:backfill-values` + `worker:backfill-values`

#315 serisinin bir adımı: 1. tablodaki `worker:backfill-values` ile 2.
tablodaki `queue:backfill-values`, tek PR'da. Kural yine "taşırken düzelt,
düzeltmeyi TypeScript tarafına da uygula". Kısa tasarım 2026-11-22'de
önerildi, 2026-11-26'da onaylandı.

## Bugün

**Kuyruk** — `backend/src/queues/queue-backfill-values.ts`, elle çalıştırılır
(`deploy/systemd/killreport-queue-backfill-values.service`, timer'ı yok).
Bayraklar: `--limit=N`, `--capsules-only`, `--id=K`. Koşula uyan killmail'leri
sayar, sonra `killmail_time DESC` sırasıyla 500'lük sayfalar halinde okur ve
her biri için `backfill_killmail_values_queue`'ya
`{killmailId, queuedAt, source: "queue-backfill-values"}` gönderir.

**Worker** — `backend/src/workers/worker-backfill-values.ts`, systemd'de üç
kopya (`killreport-worker-backfill-values@{1,2,3}`), prefetch 10. Her mesaj
için:

1. Killmail'i victim'ın `ship_type_id`'si ve item'larıyla okur. Killmail ya da
   victim yoksa atlar, ack'ler.
2. Değeri `calculateKillmailValues` ile hesaplar
   (`backend/src/helpers/calculate-killmail-values.ts`).
3. Üç değer de 0 ise (fiyat verisi yok) yazmaz, atlar.
4. `killmails.total_value / destroyed_value / dropped_value` günceller, sonra
   ayrı bir ifadeyle `killmail_filters.total_value`'yu.

ESI'ye gitmez. Hata yolu `handleWorkerError`.

**Formül** (`calculate-killmail-values.ts`): fiyat `market_prices.sell`.
Victim'ın gemisi her zaman destroyed sayılır; victim gemisinin grubu
`CAPSULE_GROUP_IDS` içindeyse (grup 29) fiyatı sabit 10 ISK. Item'larda
kategori adı `blueprint` ve `singleton = 2` (BPC) ise 0,01 ISK, değilse
piyasa fiyatı; fiyatı olmayan 0. `destroyed += fiyat × quantity_destroyed`,
`dropped += fiyat × quantity_dropped`, toplam ikisinin toplamı. Üçü de
`Math.round(x × 100) / 100` ile iki haneye yuvarlanır. Kolonlar
`DOUBLE PRECISION`. Aynı formülü killmail kaydederken `killmail-writer.ts`
de kullanır.

## Kusurlar

1. **Offset sayfalama kayıyor.** `skip: batchNumber × 500`, `killmail_time
DESC` (`queue-backfill-values.ts:116-121`). Kuyruk çalışırken redisq yeni
   killmail ekler; yeni satırlar listenin başına girer, her sonraki sayfa
   geriye kayar. Sonuç: bazı killmail'ler iki kez kuyruğa girer, listenin
   sonundakiler hiç girmez. `killmail_time` eşitliklerinde sıra da belirsiz.
2. **`--capsules-only` Genolution pod'u kaçırıyor.** Filtre `ship_type_id =
670` (`:20`, `:29`), formül ise grup 29'a bakıyor. Grup 29'daki diğer
   tipler (Genolution varyantı) formülde kapsül sayılıyor ama bu bayrakla
   kuyruğa hiç girmiyor.
3. **Publisher confirm yok.** `channel.sendToQueue` dönüşü beklenmeden süreç
   kanalı kapatıp çıkıyor (`:133`, `:169-171`). "successfully queued"
   broker'ın mesajları aldığı anlamına gelmiyor.
4. **İki yazma, transaction yok.** `killmails` güncellenip `killmail_filters`
   güncellenmeden çökerse kopya bayat kalır
   (`worker-backfill-values.ts:170-183`).
5. **Boşta log gürültüsü.** Kuyruk boşken her 5 saniyede bir "✅ queue
   completed!" bloğu basılıyor (`:56-76`), çünkü koşul yalnızca "5 saniyedir
   mesaj yok" diyor. Rust'ta `runner`'ın boş kuyruk özeti bunu zaten doğru
   yapıyor; Node'a dokunulmaz (bkz. Kapsam dışı).

Ayrıca: `backend/docs/workers/backfill-values-guide.md` ve
`capsule-value-calculation.md` artık var olmayan `--mode=null|zero|all`
bayrağını anlatıyor.

## Tasarım

### Formül: yeni lib crate `crates/killmail-value`

Formül saf bir fonksiyon ve bir okuma olarak ikiye bölünür:

- **Saf hesap:** girdi victim'ın gemi tipi, item listesi (`item_type_id`,
  `quantity_destroyed`, `quantity_dropped`, `singleton`) ve tip başına fiyat /
  grup / blueprint bilgisi; çıktı `{total, destroyed, dropped}` (`f64`).
  Veritabanına dokunmaz, unit test'le sınanır.
- **Okuma:** verilen tip kümesi için `market_prices.sell`, `types.group_id`
  ve kategori adının `blueprint` olup olmadığını tek SQL'de getirir
  (`types → item_groups → categories` join'i). Node'daki dört ayrı sorgunun
  yerine bir sorgu; sonuç aynı.

Davranış Node'la birebir: kapsül grubu 29 (Node'daki `CAPSULE_GROUP_IDS`'in
karşılığı bir sabit), BPC 0,01, kapsül 10, fiyatı ya da tipi olmayan 0,
yuvarlama `(x × 100).round() / 100`. Değerler negatif olamadığı için Rust'ın
`round`'u (sıfırdan uzağa) ile `Math.round` (yukarı) aynı sonucu verir.
Hesap sırası (önce gemi, sonra item sırasıyla toplama) Node'daki gibi tutulur,
`f64` toplamı bit düzeyinde aynı çıksın diye.

Crate'i Rust `redisq` portu da kullanacak; o yüzden worker'ın içine değil
kendi crate'ine konur.

### Mesaj

Biçim değişmez: `{"killmailId":…, "queuedAt":"…Z", "source":"…"}`. Node ve
Rust kuyrukları, Node ve Rust worker'ları birbirinin yerine geçebilir.

`runner` bugün yalnızca `entityId` okur (`crates/runner/src/message.rs`),
`mq` yalnızca `entityId` yazar (`crates/mq/src/message.rs`). İkisi de
`killmailId`'yi tanır hale gelir: `runner` tarafında alan adı, `mq` tarafında
killmail mesajı için bir yayın yolu. Bunların biçimi builder'a kalır; şart,
mevcut info worker'ların ve kuyruklarının davranışının değişmemesi ve
mesajın alan sırasının Node'unkiyle aynı olması.

### Kuyruk: `queues/queue-backfill-values`

Script `queue:backfill-values:rs`. Aynı üç bayrak, aynı anlam:

- `--id=K` — yalnızca o killmail (yoksa "not found", çıkış 0).
- `--capsules-only` — victim gemisinin `types.group_id`'si 29 olan
  killmail'ler (kusur 2'nin düzeltmesi).
- `--limit=N` — en fazla N killmail.

Okuma **keyset sayfalama** ile: `killmail_id DESC`, 500'lük sayfalar,
`WHERE killmail_id < son_görülen` (kusur 1). Yeni eklenen killmail'lerin
id'si büyük olduğu için sayfaların arasına giremez; script başladığı andaki
kümeyi bir kez ve tek kez kuyruğa koyar. Sıra yine "yeniler önce", ama
zamana değil id'ye göre.

Her sayfa **publisher confirm** ile gönderilir ve onaylanmadan sonraki sayfaya
geçilmez (kusur 3). Bellekte bir seferde bir sayfa durur.

Loglar Node'unkiyle aynı içerikte: başlık, bulunan sayı, limit, kuyruk adı,
sayfa ilerlemesi (`queued batch b (n/total - p%)`), sonda toplam.

### Worker: `workers/worker-backfill-values`

`runner` üzerinde, script `worker:backfill-values:rs`. `ENTITY = "killmail"`.
Mesaj başına:

1. Killmail, victim ve item'lar okunur. Killmail ya da victim yoksa
   `Unchanged` ("not found" / "no victim"), ack.
2. `killmail-value` ile hesaplanır.
3. Üçü de 0 ise yazılmaz, `Unchanged` ("zero values"). Bugünkü davranış:
   fiyat verisi gelmemişse önceki değer silinmez.
4. **Tek transaction'da** `killmails` üç kolon + `updated_at`, ve
   `killmail_filters.total_value` (kusur 4). Prisma'nın `@updatedAt`'i ham
   SQL'de kendiliğinden yazılmaz; `now` UTC olarak uygulamadan bağlanır.
   Sonuç `Updated`.

Node'daki "güncellendi mi" doğrulaması (`updated.total_value !==
values.totalValue`) taşınmaz: aynı transaction'daki `UPDATE ... WHERE
killmail_id = $1` etkilenen satır sayısı 1 değilse hata, bu yeterli.

Prefetch `runner`'ın tek kuralı (`max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`).
Worker ESI'ye gitmese de kural tektir; eşzamanlılığı pool (10 bağlantı)
sınırlar. Tek süreç yeterli olmalı; kaç kopya çalışacağı kapsam dışı.

Başarı satırı, killmail id ve üç değerle: `KM 133900250: total=…,
destroyed=…, dropped=…`.

### Node tarafı

Aynı düzeltmeler TypeScript'e:

- Kuyruk: keyset sayfalama (`killmail_id DESC`, `killmail_id < son`), kapsül
  filtresi `CAPSULE_GROUP_IDS` üzerinden, yayın
  `publishEntitiesConfirmed`'ın killmail mesajı için karşılığıyla
  (`backend/src/queues/publish-entities.ts`) — onay beklenir.
- Worker: iki güncelleme `prismaWorker.$transaction` içinde.
- Formül (`calculate-killmail-values.ts`) değişmez.

### Dokümanlar

`backfill-values-guide.md` ve `capsule-value-calculation.md` gerçekteki üç
bayrağa göre düzeltilir, Rust script'leri eklenir. #315'te iki satır
işaretlenir.

### Testler

- `killmail-value`: unit test'ler Node spec'indeki
  (`calculate-killmail-values.spec.ts`) durumların karşılığı — boş item,
  fiyatsız tip, kapsül (670 ve grup 29'daki diğer tip), BPC / BPO, destroyed /
  dropped ayrımı, yuvarlama. Aynı girdilerde Node ile aynı sayıların çıktığı,
  sabit beklenen değerlerle sınanır. Okuma için bir `#[sqlx::test]`.
- Kuyruk, `#[sqlx::test]`: keyset sırası ve sayfa sınırı, `--limit`, `--id`
  (var / yok), `--capsules-only`'nin grup 29'daki iki tipi de alıp başka
  gemiyi almaması.
- Worker, `#[sqlx::test]`: iki tablonun da güncellenmesi, `killmail_filters`
  satırı yokken de başarı, sıfır değerde dokunulmaması, killmail / victim
  yokken `Unchanged`.
- Node: kuyruk ve worker için mevcut spec düzenine uyan testler (keyset,
  kapsül filtresi, transaction).

## Kapsam dışı

- `killmail-writer.ts` (kaydederken değer hesabı) — redisq portunun işi.
- Worker kopya sayısı ve systemd unit'lerinin Rust'a geçirilmesi.
- Node worker'ının boşta log gürültüsü (kusur 5). Rust'a geçince unit'le
  birlikte gidecek.
- Sıfır değerli killmail'lerin (fiyat verisi olmayan) ayrıca temizlenmesi.

## Builder'a kalan

SQL'in tam metni, `runner` / `mq`'daki killmail mesajı desteğinin biçimi,
fonksiyon bölünmesi, fixture seçimi.
