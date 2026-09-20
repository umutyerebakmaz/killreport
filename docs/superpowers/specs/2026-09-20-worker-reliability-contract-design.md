# Worker güvenilirlik sözleşmesi — tasarım

**Issue:** #172
**Tarih:** 2026-09-20
**Durum:** inceleme bekliyor

Her RabbitMQ kuyruğunu tek bir güvenilirlik sözleşmesine bağlamak: gerçek bir
dead letter hedefi, sınırlı yeniden deneme, ve ~25 kopya yerine tek bir
paylaşılan hata yolu. Ayrıca bir başarısızlığın **görülebilir** olması, çünkü
bugün olmuyor.

---

## 1. Bugünkü durum, ölçülmüş

Hepsi 2026-09-20'de `backend/src` üzerinde sayıldı.

|                                                       | sayı                               |
| ----------------------------------------------------- | ---------------------------------- |
| kullanılan farklı kuyruk adı                          | 24                                 |
| `ALL_QUEUES`'te beyan edilen (`services/rabbitmq.ts`) | 19                                 |
| `ensureAllQueuesExist()` dışında beyan edilen         | 6                                  |
| sınırsız requeue — `nack(msg, false, true)`           | 17 (15 dosya)                      |
| sessiz discard — `nack(msg, false, false)`            | 4                                  |
| dead letter hedefi                                    | 1 (`esi_topology_dlq`)             |
| publisher confirm                                     | 0                                  |
| `src/workers/` altındaki dosya                        | 42, bunların 25'i kuyruk tüketiyor |

Tek beyan noktasının dışında kalan altı ad:

```
esi_corporation_killmails_queue
esi_user_killmails_queue
esi_dogma_attribute_info_queue
esi_dogma_effect_info_queue
esi_type_dogma_queue
esi_type_price_queue
```

**İki liste var, tek liste değil.** `services/rabbitmq.ts` kuyruk adlarını iki
ayrı yerde elle sayıyor: `ALL_QUEUES` (19 ad, `ensureAllQueuesExist()` bunu
beyan ediyor) ve `getAllQueueStats()` içindeki kendi `queues` dizisi (20 ad,
izleme bunu okuyor). Aradaki tek fark `esi_type_price_queue`: izleniyor ama
beyan edilmiyor. Yani bir kuyruk bugün üç durumdan birinde olabiliyor — beyan
edilip izlenen, izlenip beyan edilmeyen, ya da hiçbiri. Dilim 2 iki listeyi tek
kaynağa indiriyor; aksi hâlde beyan açığı kapansa bile izleme açığı kalır ve
`/workers` sayfası var olmayan bir tamlık iddia eder.

### Neyin eksikliği var

**Bir mesaj başarısız olduğunda gidecek yeri yok.** 24 kuyruk var, dead letter
hedefi bir tane — ve o da yalnızca altı topology worker'ının elle publish
ettiği `esi_topology_dlq`. Kalan kuyruklarda başarısızlık iki biçimde bitiyor:
17 yol mesajı sonsuza kadar yeniden deniyor, ki bu `services/rate-limiter.ts`
içindeki 50 req/sn ESI tavanına karşı süresiz bütçe yakabilir; 4 yol mesajı
sessizce çöpe atıyor, ki `queues/topology-messages.ts:136-138` bunun neden
yanlış olduğunu zaten yazmış — zincir tasarımında satır henüz yok, dolayısıyla
atılan mesaj hiç yaratılmayan bir gök cismi demek.

**"Bir şey başarısız oldu mu" sorusunun cevabı yok.** `esi_topology_dlq` bugün
boş, ama bu "hiçbir şey başarısız olmadı" anlamına **gelmiyor**: yalnızca altı
topology worker'ının hiçbir mesajdan vazgeçmediğini söylüyor. Diğer kuyruklarda
başarısızlık yapısal olarak görünmez, çünkü gidecek yer yok. Elimizde bir
zehirli mesaj oranı ölçümü yok, ve **ölçememek eksikliğin kendisi.**

**Beş kuyruk tek beyan noktasının dışında beyan ediliyor.** Ayrışan beyan
argümanları #135'te üç worker'ı düşüren `406 PRECONDITION_FAILED`'in tam
mekanizması; `CLAUDE.md`'nin _Declaring a queue_ bölümü bunu kayda geçirmiş.

**Dürüstlük notu.** Bu tasarımın gerekçesi "şu anda production'da yanan bir
yangın" değil. Yerel broker'da `esi_user_killmails_queue` 465 mesaj ve 0
tüketiciyle duruyordu, ama production'da `worker-user-killmails` PM2 altında
koşuyor (`ecosystem.config.js:163`), ve production kuyruk derinlikleri
ölçülmedi. Gerekçe şu: PM2 bir worker'ı ayakta tutamaz hâle gelirse kuyruk tam
olarak aynı sessizlikle büyür ve bunu söyleyecek hiçbir şey yok.

---

## 2. Tasarımı şekillendiren kısıt

`x-dead-letter-exchange`'i mevcut `assertQueue` çağrılarına eklemek
**mümkün değil.** Kuyruk argümanları beyan denkliğine (declaration equivalence)
giriyor, dolayısıyla mevcut kalıcı bir kuyruğun argümanlarını değiştirmek
`ensureAllQueuesExist()`'in daha önce yaptığı `x-max-priority: 10` beyanıyla
çarpışır ve 406 verir. `queues/topology-messages.ts:167-172` bunu zaten yazmış.

Araç bunun yerine bir **RabbitMQ poliçesi**. Poliçeler desene göre sunucu
tarafında uygulanıyor, beyan denklik kontrolüne girmiyor, ve hâlihazırda var
olan kuyruklara DLX takıyor — yeniden beyan yok, kuyruk silme yok, kesinti yok,
mesaj kaybı yok. Prod'daki RabbitMQ droplet üzerinde `apt`'tan kurulu ve
`rabbitmqctl` ile yönetiliyor (`docs/deployment/deployment-checklist.md:74`),
yani `set_policy` erişimi var.

### Reddedilen alternatifler

- **Quorum queue + `x-delivery-limit`.** Sınırlı yeniden teslimi yerel olarak
  verir ve wait kuyruğuna gerek bırakmaz. Reddedildi: klasikten quorum'a geçiş
  her kuyruğun silinip yeniden yaratılmasını gerektirir, ve quorum kuyruklar
  `x-max-priority` desteklemez. Öncelik gerçekten kullanımda —
  `resolvers/auth/mutations.ts:109` yeni girişte 8, `:172` 7,
  `queues/queue-missing-groups.ts:75` 5, `services/user-killmail-cron.ts:155`
  arka plan senkronunda 3 — yani vazgeçmek gerekirdi.
- **Payload zarfındaki `attempts` sayacını genelleştirmek.** Çalışır, ama düz
  tamsayı taşıyan her kuyruğun mesaj formatı ve her publisher'ı değişirdi.
  `x-death` aynı sayacı wire format'a dokunmadan veriyor.
- **Veritabanını kuyruk olarak kullanmak** (`SELECT ... FOR UPDATE SKIP
LOCKED`). Başarısız iş satırlarını bedavaya verirdi, ama her worker 22
  bağlantılık tavana karşı bir Postgres bağlantısı tutardı — ki o tavan zaten
  `@services/prisma` (5) ile `@services/prisma-worker` (2) ayrımını dayatıyor.
- **Olduğu gibi bırakıp loglara güvenmek.** Statüko. 17 sınırsız requeue yolu,
  tek bir zehirli mesajın ESI bütçesini süresiz yiyebileceği ve bakılacak tek
  şeyin log hacmi olduğu anlamına geliyor.

---

## 3. Dilim 1 — Görünürlük

En ucuz dilim, ve diğer üçünün etkisini ölçülebilir kılan şey.

`workerStatus` her kuyruk için bir alan kazanıyor:

- `health: QueueHealth!` — iki değerli bir enum, saf bir fonksiyondan
  (`backend/src/services/queue-health.ts`, testli):

| değer     | koşul                                     | anlamı                                            |
| --------- | ----------------------------------------- | ------------------------------------------------- |
| `STALLED` | `messageCount > 0 && consumerCount === 0` | Mesaj var, tüketici yok. Sessizce büyüyen kuyruk. |
| `OK`      | diğer                                     | —                                                 |

**Parking derinliği kuyruk başına bir alan DEĞİL, ve bu bilerek.**
`killreport.parking` tek bir kuyruk; bir mesajın hangi kuyruktan geldiği ancak
`x-death` başlığından okunur, ve derinlik sorgusu başlık getirmez. Köken başına
sayı isteseydik ya köken başına ayrı bir parking kuyruğu açmak (24 kuyruk daha)
ya da mesajları tek tek çekip geri koymak gerekirdi; ikisi de bir gösterge
uğruna fazla.

Bunun yerine `killreport.parking` **kendi satırı olarak** listede görünüyor —
`getAllQueueStats()` beyan edilen her kuyruğu zaten okuduğu için bedava. Dolu
bir parking satırı "bir şey pes etti" demek; hangi kuyruktan geldiğini ops
dokümanındaki inceleme yordamı `x-death`'ten okuyor. `killreport.wait` de aynı
şekilde görünür, ve tüketicisi olmadığı için `STALLED` kuralından muaf
tutulmalı: o kuyruğun işi mesaj tutmak.

`frontend/src/app/workers/page.tsx` bunları satır düzeyinde gösteriyor.
Yeni makine yok: `backend/src/schemas/Worker.graphql:13`'te 5 saniyede bir
yayan `workerStatusUpdates` subscription'ı zaten var, sayfa canlı.
`resolvers/worker/queries.ts:46` bugün `workerRunning = consumerCount > 0`
hesaplayıp hiçbir şey söylemiyor; bu dilim onu konuşturuyor.

**Neden yeni bir PM2 süreci değil:** log'a yazan periyodik bir kontrol, kimsenin
bakmadığı bir alanın yanına kimsenin bakmadığı bir log satırı koyar. Sayfa
zaten var ve zaten canlı.

---

## 4. Dilim 2 — Beyan açığı

Altı ad `services/rabbitmq.ts`'deki `ALL_QUEUES`'e giriyor, ve
`getAllQueueStats()` kendi kopya dizisini bırakıp `ALL_QUEUES`'i okuyor — tek
liste, iki tüketici. Kendi publisher'ında ya da worker'ında duran `assertQueue`
çağrıları siliniyor; `ensureAllQueuesExist()` yine tek beyan noktası oluyor.

`publishToQueue()` (`services/rabbitmq.ts:133`) da bir beyan noktası:
`assertQueue(queueName, { durable: true })` çağırıyor, **`x-max-priority`
olmadan**. Bugün patlamamasının tek sebebi `ensureAllQueuesExist()`'in sunucu
açılışında aynı kuyruğu önce doğru argümanlarla beyan etmiş olması; sıranın
değiştiği gün 406 verir. Bu çağrı da kalkıyor.

Topoloji değişmiyor, argüman değişmiyor, dolayısıyla 406 riski yok. Bu dilim
kendi başına çıkabilir ve canlı bir tehlikeyi kapatır.

---

## 5. Dilim 3 — DLX ve poliçe

### Topoloji

```
esi_type_info_queue
   │  nack(msg, false, false)          ← worker "bu deneme başarısız" diyor
   ▼
killreport.dlx (direct)                 routing key = köken kuyruk adı
   ▼
killreport.wait                         x-message-ttl: 30000
   │                                    x-dead-letter-exchange: killreport.retry
   ▼  (TTL dolar)
killreport.retry (direct)               aynı routing key
   ▼
esi_type_info_queue                     ← kökene döner, deneme sayısı artmış

N denemeden sonra → killreport.parking  (elle incele, elle oynat)
```

Her iki yeni kuyruk da `x-max-priority: 10` ile beyan ediliyor —
`ensureAllQueuesExist()` üzerinden, diğerleri gibi. `killreport.wait`'in
tüketicisi yok; mesajları TTL tutuyor.

### Poliçe

```bash
rabbitmqctl set_policy killreport-dlx "^(esi_|zkillboard_|backfill_|alliance_)" \
  '{"dead-letter-exchange":"killreport.dlx"}' --apply-to queues
```

Desen mevcut 24 adın hepsini kapsamalı; spec'in uygulama planı deseni
`ALL_QUEUES`'e karşı doğrulamayı bir görev olarak taşıyacak.

### Gecikmenin biçimi

**Sabit 30 saniye, üstel değil.** Üstel backoff adım başına ayrı bir wait
kuyruğu ister (ya da mesaj başına TTL, ki o da kuyruk içi sıralamayı bozar).
`MAX_ATTEMPTS = 5` ile en kötü hâl 2,5 dakika, ve tek wait kuyruğu
`CLAUDE.md`'nin "tekdüzelik yerel optimumu yener" kuralına uyuyor.

Bugünkü davranışa göre bu zaten bir iyileşme: `handleWorkerError` şu an
**gecikmesiz** yeniden publish ediyor, yani bir P2003 (üst satır henüz
yazılmamış) `MAX_ATTEMPTS` kadar meşgul döngü demek.

### Ops dokümanı

Yeni `backend/docs/ops/rabbitmq.md`: poliçe komutu, parking kuyruğunu inceleme
ve oynatma yordamı, ve dağıtım sırası — **önce poliçe, sonra worker restart.**
Ters sıra aradaki başarısızlıkları yere düşürür.

---

## 6. Dilim 4 — Paylaşılan hata yolu

`backend/src/workers/worker-error.ts`, `queues/topology-messages.ts:139-197`'den
genelleştirilmiş: kuyruktan bağımsız, deneme sayısını payload yerine
`x-death[0].count`'tan okuyor.

```ts
export async function handleWorkerError(
  channel: amqp.Channel,
  msg: amqp.ConsumeMessage,
  queueName: string,
  error: unknown,
  logger: WorkerLogger,
): Promise<void>;
```

- **420 dalı aynen kalıyor:** 60 sn bekle, dokunmadan requeue, deneme yakma.
  Error-limited olmak bir mesaj kusuru değil.
- **`x-esi-error-limit-remain < 20` backoff'u** her worker'ın kopyaladığı hâliyle
  buraya taşınıyor.
- **404 uyar ve atla** davranışı da öyle.
- Pes ederken mesaj `killreport.parking`'e publish edilip ack'leniyor; köken
  kuyruk `x-death` başlığından geri okunabiliyor.

25 tüketici worker'ın hepsi buna geçiyor ve kopyalanmış `try`/`catch` gövdeleri
siliniyor. `nack(msg, false, true)` 420 dalının dışında hiç kalmıyor.
`esi_topology_dlq` ve payload'daki `attempts` alanı emekli oluyor; topology
worker'ları kendi özel yolunu kaybedip ortak yola giriyor.

**Tek PR, büyük diff.** `CLAUDE.md`: yarım göç edilmiş bir kod tabanı ikisinden
de kötü.

---

## 7. Bilerek kapsam dışı

**Publisher confirms.** `createConfirmChannel` ve `waitForConfirms` bugün sıfır
kez geçiyor, ve #172 bunu bir PR olarak istiyor. Bu tasarım almıyor:
`CLAUDE.md`'nin kendi doktrini RabbitMQ'yu konveyör bandı sayıyor, bekleyen işin
kalıcı kaydı veritabanı. Enrichment kuyruk scriptleri tasarım gereği idempotent
ve devam ettirilebilir — broker yeniden başlarsa bedeli, elle çalıştırılan bir
scripti bir kez daha çalıştırmak. Yüksek değerli işlerin yanına iliştirilmiş
düşük değerli bir madde; #172 kapanırken kendi issue'suna not edilecek.

**Kuyruk başına eşik ayarı.** `STALLED` bugün `messageCount > 0` ile tetikleniyor,
yani meşgul bir kuyruk anlık olarak uyarı verebilir. Eşiği ayarlamak, gerçek
veriyi gördükten sonra yapılacak iş.

---

## 8. Kabul kriterleri

- [ ] `ALL_QUEUES` 24 adın hepsini kapsıyor ve `getAllQueueStats()` onu okuyor;
      `ensureAllQueuesExist()` dışında `assertQueue` çağrısı kalmıyor
- [ ] `killreport-dlx` poliçesi mevcut her kuyruğa DLX takıyor; hiçbir kuyruk
      silinmiyor, hiçbir mesaj kaybolmuyor
- [ ] `killreport.wait` ve `killreport.parking` `x-max-priority: 10` ile beyan
      ediliyor
- [ ] `src/workers/` altındaki her tüketici worker başarısızlığı paylaşılan
      `handleWorkerError`'dan geçiriyor; 420 dalı dışında `nack(msg, false, true)`
      kalmıyor
- [ ] `MAX_ATTEMPTS` kez başarısız olan mesaj `killreport.parking`'e düşüyor ve
      köken kuyruğu `x-death` başlığından okunabiliyor
- [ ] HTTP 420 hâlâ 60 sn bekleyip deneme yakmadan requeue ediyor
- [ ] `workerStatus` kuyruk başına `health` döndürüyor ve `killreport.parking`
      listede kendi satırı olarak görünüyor
- [ ] `queue-health.ts` saf ve testli; `STALLED`, `OK` ve `killreport.wait`
      muafiyeti kapsanıyor
- [ ] `/workers` sayfası `STALLED` satırlarını ve dolu bir parking satırını
      görsel olarak ayırıyor
- [ ] `esi_topology_dlq` ve `topology-messages.ts`'deki elle publish DLQ yolu
      kaldırılıyor
- [ ] `backend/docs/ops/rabbitmq.md` poliçeyi, parking yordamını ve dağıtım
      sırasını yazıyor
- [ ] `backend codegen` → `frontend codegen` → `yarn test` → `backend build` →
      `frontend lint` + `build` → `prettier --check`; lint sayısı `main` ile
      karşılaştırılıyor

---

## 9. Dilimlerin sırası

1. **Görünürlük** — en ucuz, ve diğerlerinin etkisini ölçülebilir kılıyor.
2. **Beyan açığı** — birkaç satır, canlı bir 406 tehlikesini kapatıyor.
3. **DLX + poliçe + ops dokümanı** — altyapı, davranış değişikliği yok.
4. **Paylaşılan hata yolu ve 25 worker'ın göçü** — asıl kazanç.

#172 sırayı 3 → 4 → 1 diye öneriyordu. Değiştirildi çünkü 1 hem en ucuz hem de
3 ile 4'ün işe yarayıp yaramadığını gösterecek tek şey; onsuz göç edilmiş 25
worker'ın bir şeyi düzeltip düzeltmediğini söyleyemeyiz.
