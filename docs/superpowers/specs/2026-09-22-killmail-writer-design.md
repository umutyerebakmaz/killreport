# Killmail'i tek bir yazıcı kaydetsin — tasarım

**Tarih:** 2026-09-22
**Durum:** onaylandı (2026-09-23)
**İlgili:** #244 (bu spec), #245 (user sync'in eksik derived write'ları, #246'da
kapandı), #243 (corporation sync zamanlaması)

Bugün yedi dosya killmail yazıyor, her biri kendi transaction'ıyla, ve yaptıkları
iş birbirinden ayrışmış durumda. Bu spec kaydetme işini tek bir modüle alıyor:
`services/killmail-writer.ts`. Kaynaklar killmail'i bulmaya devam eder, ama onu
veritabanına yazan tek bir yer olur.

Kuyruk topolojisine dokunmuyor. Killmail başına detay kuyruğu — #244'ün ikinci
yarısı — kendi spec'ini alacak; gerekçesi bölüm 8'de.

---

## 1. Bugünkü durum, ölçülmüş

2026-09-22'de `backend/src/workers` üzerinde okundu.

| Yazıcı                                    | değer | transaction | agregat | filtre | pubsub | zenginleştirme |
| ----------------------------------------- | ----- | ----------- | ------- | ------ | ------ | -------------- |
| `worker-redisq-stream.ts:704`             | ✓     | ✓           | ✓       | ✓      | ✓      | ✓ (dışarıda)   |
| `worker-esi-corporation-killmails.ts:320` | ✓     | ✓           | ✓       | ✓      | ✓      | ·              |
| `worker-esi-user-killmails.ts:284`        | ✓     | ✓           | ✓       | ✓      | ✓      | ·              |
| `worker-zkillboard-sync.ts:220`           | ✓     | ✓           | ✓       | ✓      | **·**  | ·              |
| `fetch-single-killmail.ts:63`             | ✓     | ✓           | ✓       | ✓      | **·**  | ·              |
| `sync-character-killmails.ts:98`          | ✓     | **kısmi**   | **·**   | **·**  | ✓      | ·              |
| `worker-killmails.ts:193`                 | —     | —           | —       | —      | —      | —              |

Son satır **ölü kod**: `zkillboard_character_queue`'yu tüketiyor ama
`package.json`'da script'i, `ecosystem.config.js`'te girdisi yok ve hiçbir yerden
import edilmiyor. Aynı kuyruğun gerçek tüketicisi `worker-zkillboard-sync.ts`.
Sadece üç doküman ona link veriyor.

`sync-character-killmails.ts:98` "kısmi" çünkü attacker satırı hiç yazmıyor —
yazdığı killmail, derived write'lardan bağımsız olarak da eksik.

**Ayrışma sessiz kalıyor.** `killmail.create` unique key'e takıldığı için bir
killmail'e **ilk ulaşan** yazıcı kazanıyor; diğer yollar onu duplicate diye
atlıyor. Yani eksik adımı olan bir yazıcı bir killmail'i önce yazdığında, o adım
artık hiç kimse tarafından tamamlanmıyor. #245 tam olarak buydu: agregat ve
filtre çağrısı olmayan user sync, killmail'i yazıyor ve killmail leaderboard'a
hiç girmiyordu.

**Ölçülen bedel.** Üretimde 2026-09-22 itibarıyla `killmail_filters` satırı
olmayan **3.847 killmail** vardı; geliştirme veritabanında 102. Bunlar
leaderboard'da hiç sayılmamış killmail'ler. #246 sızıntıyı kapattı ve onarım
script'ini getirdi, ama kopyalar durduğu sürece bir sonraki ayrışma aynı şekilde
oluşur.

**Bir de tersi var:** `worker-zkillboard-sync` ve `fetch-single-killmail`
`NEW_KILLMAIL` yayınlamıyor. Yani zKillboard toplu sync'inden gelen killmail
veritabanına giriyor ama canlı akışta hiç belirmiyor. Aynı sınıf bir eksiklik —
ama bölüm 5'te göreceğin gibi, düzeltmesi düşündüğün kadar basit değil.

---

## 2. Kapsam

**İçeride:**

- `backend/src/services/killmail-writer.ts` — killmail kaydetmenin tek yeri.
- Canlı altı yolun onu çağıracak şekilde uyarlanması.
- `worker-killmails.ts`'in silinmesi ve ona link veren üç dokümanın düzeltilmesi.

**Dışarıda, gerekçeleriyle:**

- **Killmail başına detay kuyruğu.** Kendi spec'i (bölüm 8).
- **Zenginleştirmenin yayılması.** `enrichMissingEntities` RedisQ'da kalıyor —
  bölüm 3.2.
- **`sync-character-killmails`'in attacker'sız killmail'lerinin onarımı.** Ayrı
  iş; bölüm 6.

---

## 3. Tasarım

### 3.1 Modül ve imza

```ts
// backend/src/services/killmail-writer.ts
export async function saveKillmail(
  detail: KillmailDetail,
  hash: string,
): Promise<boolean>;
```

Dönüş `true` = yeni yazıldı, `false` = zaten vardı. Bu şekil
`worker-redisq-stream.ts:672`'deki `saveKillmail`'den geliyor: bugün altı yoldan
en eksiksizi o ve aylardır üretimde canlı akışı besliyor. Yeni bir soyutlama
icat etmiyoruz, çalışan olanı yukarı çekiyoruz.

`false` dönüşü, çağıranların bugün `P2002` istisnası yakalayarak yaptığı işin
yerine geçiyor: "zaten vardı" bir hata değil, bir sonuç.

### 3.2 Yazıcının sahiplendiği adımlar

RedisQ'daki sırayla:

1. **Varlık kontrolü** — `killmail.findUnique`; varsa `false` döner, hiçbir iş
   yapılmaz.
2. **`calculateKillmailValues`** — `total_value`, `destroyed_value`,
   `dropped_value`.
3. **Transaction:** `killmail` → `victim` → `attacker` → **günlük agregatlar
   (`updateDailyAggregatesRealtime`)** → `killmail_item`.
4. **`insertKillmailFilter`** — transaction'dan sonra.
5. **`pubsub.publish('NEW_KILLMAIL')`** — bölüm 5'teki karara tabi.
6. `true` döner.

**Sahiplenmedikleri**, ve bunlar bilinçli:

- **Varlık zenginleştirme.** `enrichMissingEntities` RedisQ'nun polling
  döngüsünde kalır. Gerekçe kodun içinde yazılı: `worker-redisq-stream.ts:54`'te
  `REDISQ_ENABLE_ENRICHMENT` bayrağı var ve yorumu _"to prevent connection pool
  exhaustion"_. Tek bir yolda bile havuzu zorladığı için kapatılabilir yapılmış;
  20.000 killmail'lik bir zKillboard backfill'inde aynı işi 2 bağlantılık worker
  havuzuyla koşturmak yeni bir arıza sınıfı açar. Zenginleştirme zaten kaynağın
  ihtiyacı: canlı akış yeni varlıklarla karşılaşır, backfill karşılaşmaz ve
  `yarn scan:entities` onu topluca yapar.
- **ESI'den veri çekmek.** Yazıcı elindeki `KillmailDetail` ile çalışır; onu
  nereden bulduğu kaynağın işi.
- **Kuyruğa mesaj atmak.**
- **Çağıranın kendi defteri** — `last_killmail_id`, `last_corp_killmail_sync_at`
  gibi alanlar kaynağa ait, yazıcı onları bilmez.

### 3.3 Eşleme ve hata anlamı

Agregat ve filtre girdileri `services/killmail-derived.ts`'teki
`toAggregateInput` / `toFilterInput` üzerinden kurulur — #246'da bu iş için
yazıldılar, RedisQ'daki satır içi eşleme onlarla değiştirilir.

`insertKillmailFilter` **await edilir**. Bugün RedisQ'da ve #246 öncesi corp
worker'da `await`siz çağrılıyordu; servis hatasını kendi içinde loglayıp yuttuğu
için oradaki `.catch` zaten hiç çalışamayan ölü koddu. Await, filtre satırının
`NEW_KILLMAIL` yayınından önce var olmasını da garanti eder.

Gerçek hatalar **fırlatılır**. Çağıran bir worker ise `handleWorkerError` onları
paylaşılan yola taşır; elle koşulan bir script ise kendi çıkışını verir. Yazıcı
hata yutmaz — tek istisnası, 1. adımla yarışan eşzamanlı bir yazıcıdan gelen
`P2002`, ki o da `false`'a çevrilir.

---

## 4. Çağıranların uyarlanması

| Yol                                | Ne kaybeder                             | Ne kazanır                              |
| ---------------------------------- | --------------------------------------- | --------------------------------------- |
| `worker-redisq-stream`             | kendi `saveKillmail`'i (modüle taşınır) | mapper'lar, await'lenen filtre yazımı   |
| `worker-esi-corporation-killmails` | ~120 satır transaction                  | varlık ön-kontrolü                      |
| `worker-esi-user-killmails`        | ~120 satır transaction                  | varlık ön-kontrolü                      |
| `worker-zkillboard-sync`           | ~120 satır transaction                  | `NEW_KILLMAIL` (bölüm 5)                |
| `fetch-single-killmail`            | ~60 satır transaction                   | agregat + filtre + pubsub               |
| `sync-character-killmails`         | kendi kısmi yazımı                      | **attacker satırları**, agregat, filtre |
| `worker-killmails`                 | dosya silinir                           | —                                       |

`sync-character-killmails`'in kazandığı şey dikkate değer: bugünkü asıl kusuru
attacker yazmaması ve bu, yazıcıyı çağırır çağırmaz düzeliyor.

Çeken kaynaklarda bir sıralama iyileştirmesi de mümkün hâle geliyor: varlık
kontrolü artık yazıcının ilk adımı olduğu için, çağıran **detay çağrısından
önce** "bu killmail bende var mı" diye sorabilir. Bugün sıra tersi ve zaten
kayıtlı killmail için ESI detayı boşuna çekiliyor. Bu spec bunu zorunlu
kılmıyor, ama yolu açıyor.

---

## 5. Karar bekleyen: toplu sync ve `NEW_KILLMAIL`

Yazıcı pubsub'ı sahiplenince `worker-zkillboard-sync` de yayın yapmaya başlar.
Sonucu ölçülebilir: `frontend/src/app/killmails/page.tsx:158` gelen olayı
`setNewKillmails` ile listenin başına ekliyor. 20.000 killmail'lik bir backfill,
açık olan her sayfaya 20.000 tarihî killmail'i "yeni" diye dökerdi.

Yani bugünkü yayınlamama hâli muhtemelen bir ihmal, ama sonucu kazara doğru.

Üç seçenek:

1. **Yazıcı bir seçenek alır** — `saveKillmail(detail, hash, { publish = true })`,
   toplu yollar `false` geçer. Açık ve okunur; bedeli, "tek yazıcı"nın bir
   davranış anahtarı taşıması.
2. **Yazıcı killmail'in yaşına bakar** — yalnızca `killmail_time` son N saat
   içindeyse yayınlar. Anahtar yok, kural değişmez: "dünyaya yalnızca gerçekten
   yeni olanı duyur". Gerçekten yeni bir killmail her zaman tazedir, backfill
   tanımı gereği eski. Bedeli: eşik bir sihirli sayı ve uzun bir kesintiden
   sonra dönen canlı akış yayın yapmaz.
3. **Yayın çağıranda kalır** — yazıcı hiç yayınlamaz. En küçük değişiklik, ama
   "kaydedildi ama duyurulmadı" ayrışması aynen sürer.

**Karar (2026-09-23, inceleme): seçenek 1.** İmza
`saveKillmail(detail, hash, { publish = true })` olur; `worker-zkillboard-sync`
ve `--full` sync'ler `false` geçer, geri kalan her yol varsayılanı kullanır.
Seçenek 2 zarifti ama eşiği altı ay sonra kimse hatırlamaz ve uzun bir kesinti
sonrası canlı akışın sessizleşmesi gerçek bir arıza olurdu. Seçenek 1'de karar
çağıranda, kodda görünür, ve varsayılanı doğru taraf.

---

## 6. Yan bulgu: attacker'sız killmail'ler

`sync-character-killmails` bugüne kadar attacker satırı olmayan killmail yazmış
olabilir. Bunlar yazıcıya geçişle **ileriye dönük** düzelir, ama zaten yazılmış
olanlar düzelmez: #246'nın onarım script'i böyle bir killmail'i onarmayı reddeder
(boş attacker dizisiyle filtre satırı yazmak "onarıldı" gibi görünüp yanlış
olurdu).

Ölçüm sorgusu:

```sql
SELECT COUNT(*) FROM killmails k
LEFT JOIN attackers a ON a.killmail_id = k.killmail_id
WHERE a.killmail_id IS NULL;
```

Geliştirme veritabanında sonuç 0'dı. Üretimde sıfırdan büyükse, o killmail'lerin
ESI'den yeniden çekilmesi gerekir — bu spec'in değil, kendi işinin konusu.

---

## 7. Doğrulama

**Testler.** `killmail-writer.ts` mock'lanmış bir Prisma istemcisiyle test
edilebilir; bugünkü altı çağrı yerinin hiçbiri test edilebilir değil, çünkü
hepsi consumer callback'lerinin içinde. Kapsanacaklar:

- zaten var olan killmail için `false` döner ve hiçbir yazma yapılmaz
- transaction içinde agregatların çağrıldığı, filtre satırının sonrasında
  yazıldığı
- eşzamanlı bir yazıcıdan gelen `P2002`'nin `false`'a çevrildiği, başka her
  hatanın fırlatıldığı
- bölüm 5'teki karara göre yayın davranışı

**Veri.** Geçiş sonrası, #246'daki ölçümün aynısı: `killmail_filters` satırı
olmayan killmail sayısı ve agregat toplamının ham veriyle karşılaştırması. İkisi
de geçiş öncesi ve sonrası kaydedilir.

**Tam set.** `yarn test`, `yarn workspace backend build`, `npx prettier --check .`.
GraphQL şeması değişmediği için codegen yok; frontend'e dokunulmuyor.

---

## 8. Neden detay kuyruğu bu spec'te değil

#244 iki değişiklik içeriyor ve ikincisi birincisini gerektiriyor, tersi değil.
Tek yazıcı olmadan detay kuyruğu kurulursa yeni worker da kendi kayıt mantığını
taşır ve ayrışma kapanmaz. Tek yazıcı ise tek başına anlamlı: üretimdeki 3.847'yi
üreten sebebi kapatır, kuyruk topolojisine dokunmaz, tek PR'a sığar.

Detay kuyruğunun kendi spec'inde cevaplanacak sorular — burada karara
bağlanmıyor: mesaj `{id, hash}` mı taşır yoksa elindeki detayı mı; RedisQ bu
boruya girer mi (elinde tam payload var, `worker-redisq-stream.ts:217`);
yayıncı veritabanında olanı eleyerek mi kuyruğa koyar.

---

## 9. İncelemede kapanan kararlar

2026-09-23'te üçü de karara bağlandı; spec onaylandı.

1. **Yayın:** `publish` seçeneği, varsayılanı `true`. Gerekçesi bölüm 5'te.
2. **Ölü worker:** `worker-killmails.ts` bu iş içinde silinir, ayrı bir temizlik
   PR'ı beklemez. Zaten aynı kuyruğun hiç başlamayan ikinci tüketicisi; geçiş
   sırasında onu uyarlamak ya da atlamak, olmayan bir şey için karar vermek
   olurdu. Ona link veren üç doküman aynı değişiklikte düzelir.
3. **Varlık ön-kontrolü:** kapsam dışı, yolu açık. Yazıcı `false` döndüğü için
   çağıranlar istedikleri anda detay çağrısından önce sorabilir hâle geliyor,
   ama her çağıranın sorgu sırasını bu geçişte değiştirmek diff'i ikiye katlar
   ve iki değişiklik birbirini gizler. Boşa giden detay çağrıları asıl olarak
   `--full` sync'lerde görünüyor; detay kuyruğu spec'inin doğal konusu.
