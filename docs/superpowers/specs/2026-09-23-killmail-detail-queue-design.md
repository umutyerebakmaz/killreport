# Çeken kaynaklar killmail'i kuyruğa koysun — tasarım

**Tarih:** 2026-09-23
**Durum:** inceleme bekliyor
**İlgili:** #244 (ikinci yarı), #248 (tek yazıcı, birinci yarı),
`docs/superpowers/specs/2026-09-22-killmail-writer-design.md`

#248 killmail'i yazan tek bir yer bıraktı: `services/killmail-writer.ts`. Bu spec
onu **besleyen** yolu değiştiriyor. Bugün bir sync mesajı bir kullanıcıyı
adlandırıyor ve worker o tek mesajın içinde 2.500 killmail'e kadar işi uçtan uca
yapıyor. Bundan sonra killmail'i **bulmak** ile **yazmak** iki aşama olacak:
liste aşaması id+hash yayınlar, tek bir detay worker'ı tüketir.

RedisQ bu borunun dışında kalıyor; gerekçesi bölüm 6'da.

---

## 1. Bugünkü durum, ölçülmüş

2026-09-23'te, #248 merge edildikten sonra okundu.

Bir mesaj = bir kullanıcı = sınırsıza yakın iş:

| Yol                                | Mesaj başına üst sınır                     |
| ---------------------------------- | ------------------------------------------ |
| `worker-esi-user-killmails`        | 50 sayfa × 50 = 2.500 killmail             |
| `worker-esi-corporation-killmails` | 50 sayfa × 50 = 2.500 killmail             |
| `worker-zkillboard-sync`           | `MAX_PAGES = 100` × 200 = 20.000 killmail  |
| `sync-character-killmails`         | elle verilen sayfa sayısı, `999` ≈ 200.000 |

Bunun dört sonucu var ve hiçbiri görünür değil:

**Yeniden başlayabilirlik yok.** Worker 2.400'üncü killmail'de ölürse mesaj
yeniden teslim edilir ve baştan başlar. Zaten yazılmış olanlar yazıcının varlık
kontrolüne takılıp atlanır — ama liste çağrıları ve `killmail.findUnique`
turları tekrarlanır.

**Retry granülaritesi yok.** Tek bir killmail'de geçici bir 500, 2.500'lük
mesajın tamamını `handleWorkerError`'a düşürür; beş deneme, sonra parking.
Kalan 2.499 killmail o mesajla birlikte bekler.

**Backlog görünmez.** `workerStatus` bu mesaj için "1" der. Arkasındaki 2.500
ESI çağrısı hiçbir sayıda görünmez; #237'nin back-pressure kontrolü de bu tek
mesaja bakarak karar verir.

**Sıra hâlâ ters.** `worker-esi-user-killmails`, `worker-esi-corporation-killmails`
ve `worker-zkillboard-sync` her killmail için önce ESI detayını çekiyor, sonra
yazıcının varlık kontrolüne takılıyor. #248 sonrası `sync-character-killmails`
bunu doğru yapan tek yol — detaydan önce soruyor (PR #248'in düzeltme turu).

---

## 2. Kapsam

**İçeride:**

- `esi_killmail_detail_queue` ve tek tüketicisi `worker-killmail-detail`.
- Dört çeken kaynağın liste aşamasına dönüşmesi: user sync, corporation sync,
  zKillboard sync, `sync-character-killmails`.
- Artımlı sync imlecinin veritabanından türetilmesi.
- `publish` kararının kuyruk üzerinden taşınması.

**Dışarıda:**

- **RedisQ.** Bölüm 6.
- **`fetch-single-killmail`.** Tek killmail'i elle çeken script; kuyruktan
  geçmesi ona gecikme ve dolaylılıktan başka bir şey katmaz.
- **Yazıcının kendisi.** #248'de yerleşti, dokunulmuyor.
- **`last_killmail_id` / `last_corp_killmail_id` kolonlarının silinmesi.**
  Bölüm 4'te anlamlarını yitiriyorlar ama kaldırılmaları migration ister; ayrı
  iş.

---

## 3. Tasarım

### 3.1 İki aşama

```text
cron / elle koşulan script
      │  (bugünkü mesaj: { userId })
      ▼
liste aşaması  ─ ESI veya zKillboard liste ucu
      │         ─ veritabanında olanları eler
      │  { killmailId, killmailHash, announce }
      ▼
esi_killmail_detail_queue
      ▼
worker-killmail-detail ─ public /killmails/{id}/{hash}/ ─ saveKillmail()
```

Liste aşaması bugünkü worker'ların kendisidir; mesajları ve kuyrukları aynen
kalır. Değişen, iç döngülerinin **detay çekip yazmak** yerine **yayınlamak**
olması.

### 3.2 Kuyruk ve mesaj

```ts
// services/queue-names.ts
'esi_killmail_detail_queue';

// mesaj
interface KillmailDetailMessage {
  killmailId: number;
  killmailHash: string;
  /** NEW_KILLMAIL yayınlansın mı; toplu backfill false geçer. */
  announce: boolean;
}
```

Mesaj kimlik bilgisi taşımaz ve taşımasına gerek yoktur:
`/killmails/{id}/{hash}/` public bir uçtur. Token gerektiren tek adım liste
çağrısıdır ve o liste aşamasında kalır — #238'in yönü budur.

`announce` bayrağı kuyruktan geçmek zorunda, çünkü kararı veren yayıncı, çağrıyı
yapan worker. Politika taşımak kimlik taşımak değildir; #238'in yasakladığı
ikincisi.

Kuyruk `ensureAllQueuesExist()` üzerinden, her kuyruk gibi
`arguments: { 'x-max-priority': 10 }` ile tanımlanır.

### 3.3 Detay worker'ı

`workers/worker-killmail-detail.ts`, tek `QUEUE_NAME` sabiti, `PREFETCH_COUNT`
ve `esiRateLimiter` ile — mevcut worker ailesinin birinci grubu gibi. Gövdesi
kısa:

```ts
const detail = await KillmailService.getKillmailDetail(
  message.killmailId,
  message.killmailHash,
);
await saveKillmail(detail, message.killmailHash, {
  publish: message.announce,
});
```

Hata yolu paylaşılan `handleWorkerError`: 404 atla, 420/429 bekle ve requeue,
beşinci denemede parking. Yazıcının attacker'sız killmail reddi de buraya düşer
ve beş denemeden sonra parking'e gider — doğru davranış, çünkü o killmail'in
yeniden çekilmesi gerekiyor ve parking onu görünür kılıyor.

Kaynaktan bağımsızdır: hangi worker'ın yayınladığını bilmez, bilmesine gerek
yoktur.

### 3.4 Yayıncı tarafında eleme

Liste aşaması, veritabanında olan id'leri kuyruğa **koymaz**:

```ts
const known = await prismaWorker.killmail.findMany({
  where: { killmail_id: { in: ids } },
  select: { killmail_id: true },
});
```

Tek sorgu, sayfa başına. CLAUDE.md'nin "enrichment" kalıbı budur: kaynak
veritabanından okur, çözülmüş olanları eler, yalnızca eksik olanı kuyruğa koyar.
Bugünkü "önce detayı çek, sonra duplicate'e takıl" sırasını tersine çevirir ve
`--full` sync'lerdeki boşa ESI çağrılarını bitirir.

---

## 4. İmleç veritabanından türetilir

Bugün worker, killmail'lerin hepsini yazdıktan sonra `last_killmail_id`'yi
ilerletiyor. Yayınlamak ile yazmak ayrılınca bu defter havada kalır: yayıncı
imleci ilerletirse "sync'lendi" artık "kuyruğa kondu" demek olur, ve detay
mesajı kalıcı olarak düşerse imleç onun üzerinden geçmiş olur — o killmail bir
daha hiç denenmez.

Bunun yerine artımlı sync'in başlangıcı veritabanından okunur:

```sql
SELECT MAX(killmail_id) FROM killmail_filters
WHERE attacker_character_ids @> ARRAY[$1]::int[] OR victim_character_id = $1;
```

**Ölçüldü (2026-09-23, 108.890 killmail):** 4.8 ms, `idx_kmfilters_attacker_chars`
GIN indeksi ve `idx_kmfilters_victim_char` üzerinden bitmap index scan. Tick
başına kullanıcı başına bir kez çalışır.

Böylece "sync'lendi" yeniden "yazıldı" anlamına gelir: düşen bir detay mesajı bir
sonraki turda yeniden listelenir ve yeniden denenir. Kendi kendini onaran bir
imleç, tutulan bir defterden daha az yalan söyler.

Korporasyon tarafı aynı sorguyu `attacker_corporation_ids` üzerinden kullanır.

**Bağımlılık:** imleç `killmail_filters`'tan okunduğu için o tablonun eksiksiz
olması gerekir. #246'nın onarımı (`yarn repair:killmail-derived`) üretimde henüz
koşulmadı; 2026-09-22 itibarıyla 3.847 killmail'in filtre satırı yoktu. Eksik
satır imleci olduğundan **düşük** gösterir, yani fazladan liste sayfası çekilir —
veri kaybı değil, boşa iş. Yine de bu işin üretime çıkışından önce onarımın
koşulmuş olması gerekiyor.

`last_killmail_id` ve `last_corp_killmail_id` kolonları bu noktadan sonra
yazılmaz. Silinmeleri migration ister ve bu spec'in kapsamı dışında; değerleri
tarihî kayıt olarak kalır.

`last_killmail_sync_at` / `last_corp_killmail_sync_at` **kalır** — onlar imleç
değil, "bu kullanıcı en son ne zaman ele alındı" bilgisidir ve
`killmail-sync-cron`'un 15 dakikalık penceresi ona bakar (#243).

---

## 5. Geçiş sırası

Dört kaynak aynı anda geçmez; kuyruk ve worker önce ayağa kalkar, kaynaklar
teker teker bağlanır:

1. Kuyruk, mesaj tipi ve `worker-killmail-detail` — kimse yayınlamıyorken bile
   çalışır durumda, PM2 girdisiyle.
2. `sync-character-killmails` — elle koşulan, en düşük riskli, `announce: false`.
3. `worker-zkillboard-sync` — toplu, `announce: false`.
4. `worker-esi-corporation-killmails`, sonra `worker-esi-user-killmails` —
   canlı yollar, `announce: true`.

Her adım kendi başına çalışır durumda bırakır; bir kaynak geçmezse diğerleri
etkilenmez.

---

## 6. RedisQ neden dışarıda

R2Z2 paketi ESI killmail'inin tamamını zkb bloğuyla birlikte gönderiyor
(`worker-redisq-stream.ts:217`) ve worker `isUsableEsiKillmail` ile şeklini
doğrulayıp doğrudan kullanıyor. Onu id+hash kuyruğundan geçirmek, elindeki
veriyi atıp ESI'ye ikinci kez gitmek olurdu — saniyede ~10 killmail'lik canlı
akışın tamamı için, bugün hiç yapılmayan bir çağrı. Üstüne canlı `NEW_KILLMAIL`
yayınına bir kuyruk turu gecikme binerdi.

Mesajın detayın kendisini taşıması da düşünüldü; mesaj boyutu item listeleriyle
birlikte killmail başına birkaç KB'ye çıkıyor ve kazancı yalnızca tekdüzelik.

RedisQ `saveKillmail`'i doğrudan çağırmaya devam eder. İki giriş şekli olur —
biri kuyruktan, biri doğrudan — ama **yazan yer hâlâ tek**, ki #244'ün asıl
derdi oydu.

---

## 7. Doğrulama

**Testler.** `worker-killmail-detail`'in mesaj işleme yolu, mevcut worker
spec'leri gibi mock'lanmış bağımlılıklarla: `announce`'un yazıcıya geçtiği, 404
ve 420'nin paylaşılan yola gittiği, attacker'sız killmail'in parking'e düştüğü.
Yayıncı tarafında eleme saf bir fonksiyona çıkarılıp doğrudan test edilir.

**Ölçüm.** Geçiş öncesi ve sonrası, aynı karakter için `yarn sync:character`:
ESI çağrı sayısı (bugün zaten kayıtlı killmail başına bir tane, sonra sıfır),
kuyruk derinliğinin gerçek işi göstermesi, ve `killmails` sayısının aynı kalması.

**Tam set.** `yarn test`, `yarn workspace backend build`, `prettier --check .`.
GraphQL şeması değişmiyor. `workerStatus` sorgusu yeni kuyruğu kendiliğinden
listeler çünkü `ALL_QUEUES`'tan okur.

---

## 8. İnceleme için açık sorular

1. Detay worker'ının `PREFETCH_COUNT`'u kaç olsun? Öneri 10 — `esiRateLimiter`
   gerçek tavanı zaten tutuyor, ve bu worker'ın yazma yolu tek killmail'lik
   küçük bir transaction (`worker-regions`'ın `prefetch(1)` gerekçesi burada
   yok).
2. Toplu backfill'in mesajları canlı sync'lerle aynı kuyruğu paylaşıyor.
   Öncelik alanıyla ayırmak (backfill 1, canlı 5) yeter mi, yoksa 200.000
   mesajlık bir backfill canlı akışı bekletir mi? Alternatif ayrı bir kuyruk,
   ama o da "bir domain bir kuyruk" kuralından sapma olur.
3. `last_killmail_id` kolonları yazılmaz hâle geliyor. Şimdilik kalsınlar mı,
   yoksa bu işin sonunda bir migration ile kaldırılsınlar mı?
