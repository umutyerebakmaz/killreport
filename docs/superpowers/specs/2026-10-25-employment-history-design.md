# Karakter Employment History sekmesi — tasarım

**Tarih:** 2026-10-25
**Durum:** onaylandı (2026-10-25)
**İlgili:** karakter detay sayfası (`frontend/src/app/characters/[id]/page.tsx`)

Karakter detay sayfasına dördüncü bir sekme ekleniyor: **Employment History**.
Karakterin bugüne kadar bulunduğu corporation'ları, oyun içindeki Employment
History ekranındaki biçimle, en yeniden en eskiye listeliyor.

Bu ilk sürüm bilerek sade: sekme yalnızca veritabanında olanı okuyor, veriyi
queue + worker yazıyor, tazeleme haftalık zamanlanmış işe kalıyor. Sekme
açıldığında anında tazeleme ve görsel zenginleştirme sonraki adımlar (bkz. §8).

---

## 1. Bugünkü durum

2026-10-25'te okundu.

- Karakterlerin corporation geçmişi hiçbir yerde tutulmuyor; kodda
  `corporationhistory` ya da `employment` geçen bir şey yok.
- Karakter sayfasında üç sekme var: `bio`, `killmails`, `statistics`
  (`page.tsx:32-36`, `TabType`, `TAB_IDS`, `TAB_LABELS`). Aktif sekme `?tab=`
  URL parametresiyle senkron; klavye gezinmesi `useTabList` ile.
- Veritabanında 120.415 karakter, 29.713 corporation var.
- `queue-characters` hem PM2'de aylık (`ecosystem.config.js:223-240`) hem
  `backend/docs/ops/crontab.md`'de haftalık zamanlanmış.

### ESI endpoint'i

`GET /characters/{character_id}/corporationhistory/` — public, auth gerekmiyor.
Yanıt bir dizi; her eleman:

| Alan             | Tip       | Not                                                                    |
| ---------------- | --------- | ---------------------------------------------------------------------- |
| `corporation_id` | int64     | zorunlu                                                                |
| `record_id`      | int64     | zorunlu; tüm oyun genelinde artan sayaç, kayıtları kesin sıralar       |
| `start_date`     | date-time | zorunlu                                                                |
| `is_deleted`     | boolean   | yalnızca corporation kapatıldıysa `true` gelir, aksi halde alan yoktur |

Bitiş tarihi gelmiyor: bir kaydın bitişi, bir sonraki (daha yeni) kaydın
`start_date`'i. En yeni kayıt karakterin bugünkü corporation'ı. NPC
corporation'lar (ör. başlangıç akademisi `1000171`) da listede yer alıyor.
ESI yanıtı 24 saat önbellekliyor (`expires` − `last-modified` = 1 gün).

Örnek (karakter 95465499):

```json
[
  {
    "corporation_id": 98221968,
    "record_id": 66722751,
    "start_date": "2026-06-05T14:57:00Z"
  },
  {
    "corporation_id": 109299958,
    "record_id": 37530077,
    "start_date": "2015-03-24T11:44:00Z"
  },
  {
    "corporation_id": 1000171,
    "record_id": 37530055,
    "start_date": "2015-03-24T11:37:00Z"
  }
]
```

Kapatılmış corporation'lar için de `GET /corporations/{id}/` 200 dönüyor
(ör. `1024623120` → `CORPFREE`), yani adları mevcut corporation info worker'ı
ile çözülebiliyor.

---

## 2. Hedefler, hedef olmayanlar

**Hedef**

- Her karakter sayfasında, veritabanındaki tüm karakterler için geçmişin hazır
  olması.
- Oyundaki görünümün birebir metin karşılığı (§6).
- Yerleşik ingest kalıbına uymak: bir queue, bir worker, worker'ın sahibi olduğu
  tek tablo.

**Hedef değil (bu sürümde)**

- Sekme açıldığında veriyi o anda tazelemek (mutation, polling, subscription).
  Bilerek sonraya bırakıldı; §8.
- Logo, alliance, istatistik gibi zenginleştirmeler.
- Veritabanında olmayan karakterler için geçmiş getirmek.
- Veritabanına yeni giren karakterlerin geçmişini hemen çekmek. Bir sonraki
  haftalık çalışmaya kadar (en fazla bir hafta) boş durumda kalmaları kabul
  edildi; `worker-info-characters` bu değişikliğin kapsamında değil.

**Kaçınılacak**

- Resolver'dan ya da resolver'ların kullandığı bir servisten ESI çağırmak
  (CLAUDE.md:551).
- `prisma migrate dev` ile migration üretmek (CLAUDE.md, _Database migrations_).

---

## 3. Veri modeli

Yeni Prisma modeli, `backend/prisma/schema/characterCorporationHistory.prisma`:

```prisma
model CharacterCorporationHistory {
  record_id      BigInt   @id
  character_id   Int
  corporation_id Int
  start_date     DateTime
  is_deleted     Boolean  @default(false)
  fetched_at     DateTime

  @@index([character_id])
  @@map("character_corporation_history")
}
```

- `record_id` birincil anahtar: oyun genelinde benzersiz.
- `fetched_at`: worker bu karakterin geçmişini en son ne zaman çektiyse.
  Worker her çekişte karakterin **tüm** satırlarında günceller; böylece
  "karakterin geçmişi en son ne zaman çekildi" = `MAX(fetched_at)` ve ayrı bir
  takip tablosuna gerek kalmıyor. Her karakterin en az bir kaydı olduğundan
  satır yokluğu "hiç çekilmedi" demek.
- `characters` ile foreign key yok: diğer ESI tablolarındaki gevşek ilişkiyle
  aynı, worker'lar arası sıralama bağımlılığı yaratmıyor.

Migration CLAUDE.md'deki diff-and-deploy prosedürüyle elle yazılıyor; beş
yönetilmeyen tablonun `DROP` satırları silinip satır sayıları önce ve sonra
kontrol ediliyor.

---

## 4. Yazma yolu: queue + worker

### Kuyruk

`esi_character_corporation_history_queue`, `queue-names.ts`'teki `ALL_QUEUES`
listesine ("ESI info workers" grubunun yanına) ekleniyor; böylece
`ensureAllQueuesExist()` onu `x-max-priority: 10` ile tanımlıyor ve retry
topolojisine giriyor. Mesaj biçimi diğer entity kuyruklarıyla aynı:
`{ entityId, queuedAt, source }`.

### Queue script'i — `backend/src/queues/queue-character-corporation-history.ts`

Enrichment türünde (CLAUDE.md, _The ingest pattern_), `prismaWorker` ile:

- Argümanla verilen karakter ID'lerini kuyruğa atar (`queue-characters.ts` ile
  aynı kullanım).
- Argüman yoksa: `characters` tablosunda olup geçmişi **hiç çekilmemiş** ya da
  `MAX(fetched_at)` değeri **6 günden eski** olan karakterleri atar. Eşik
  bilerek haftalık aralıktan kısa: tam 7 gün olsaydı, bir önceki çalışma
  başladıktan sonra çekilen karakterler 7 günden biraz genç kalıp atlanır,
  yani fiilen iki haftada bir yenilenirdi.

İlk doldurma için ayrı bir komut yok: ilk çalıştırmada herkes "hiç çekilmemiş"
olduğu için 120.415 karakterin tamamı kuyruğa girer. 50 req/s tavanın tamamı
bu worker'a kalırsa ≈ 40 dk; ESI bütçesi aynı anda çalışan worker'larla
paylaşıldığından gerçekte daha uzun. `PREFETCH_COUNT` buna göre seçilir.

`package.json` script'i: `queue:character-corporation-history`.

### Worker — `backend/src/workers/worker-character-corporation-history.ts`

`worker-info-characters.ts` kalıbında, kendi içinde bağımsız:

1. `CharacterService`'e eklenecek `getCorporationHistory(characterId)` ile ESI'yi
   `esiRateLimiter` üzerinden çağırır.
2. Tek bir transaction'da her kaydı `record_id` üzerinden upsert eder,
   `is_deleted` için `?? false`, ve karakterin tüm satırlarında `fetched_at`'i
   şimdiki zamana çeker.
3. Geçmişteki corporation ID'lerinden `corporations` tablosunda olmayanları
   `esi_corporation_info_queue`'ya atar, ki adları çözülsün. (Bir worker'ın
   başka bir kuyruğa yayın yapması topoloji zincirinde zaten var.)
4. Hata yönetimi `handleWorkerError` ile (420/429 bekle, 404 ack, diğerleri
   retry → park).

ESI'nin 404 döndüğü (silinmiş) karakterler hiç satır almaz ve her hafta
yeniden kuyruğa girer; bu kabul edilen bir maliyet, küçük bir koruma eklemek
uygulayıcının kararı.

ESI'den artık gelmeyen eski satırlar silinmiyor; ESI geçmişi yalnızca
büyüdüğünden bu durum beklenmiyor.

`package.json` script'i: `worker:character-corporation-history`. PM2'de
sürekli çalışan bir worker süreci olarak `ecosystem.config.js`'e,
izleme için `resolvers/worker/helpers.ts`'teki `QUEUE_WORKER_MAP`'e
ekleniyor.

### Zamanlama

Haftalık, PM2 `cron_restart` ile (`ecosystem.config.js`, diğer zamanlanmış
queue script'lerinin yanına) ve `backend/docs/ops/pm2.md`'de belgelenerek.
6 günlük eşik sayesinde her karakter her haftalık çalışmada yenileniyor.

---

## 5. Okuma yolu: servis + GraphQL

### Servis — `backend/src/services/character/character-corporation-history.service.ts`

CLAUDE.md'nin tarif ettiği ikinci tür okuma servisi, düz `async function`
biçiminde: `redis.get` → sorgu → `redis.setex`.

- Anahtar: `character:corporation-history:{characterId}`.
- TTL: 7200 sn ("rarely changing"). Veri haftada bir yenileniyor; worker'ın
  yazdıktan sonra önbelleği silmesi bu sürümde gerekmiyor.
- Sıralama: `start_date DESC, record_id DESC`.
- Her kayıt için bitiş tarihini (bir önceki satırın, yani bir sonraki
  kaydın `start_date`'i; en yeni kayıt için `null`) serviste hesaplıyor.
- `record_id` BigInt → JSON'a girmeden önce `Number()` (CLAUDE.md, BigInt
  notu). int64 olsa da bugünkü değerler (~6,7·10⁷) güvenli tamsayı aralığında.

### GraphQL — `backend/src/schemas/CharacterCorporationHistory.graphql`

```graphql
type CharacterCorporationHistory {
  recordId: Float!
  corporationId: Int!
  corporation: Corporation
  startDate: String!
  endDate: String
  isDeleted: Boolean!
}

extend type Query {
  characterCorporationHistory(
    characterId: Int!
  ): [CharacterCorporationHistory!]!
}
```

- Type adı Prisma modeliyle aynı ve tek bir satırı (bir corp dönemini)
  temsil ediyor, `Character` ve `KillmailItem` gibi; liste olduğu `[...]`'dan
  anlaşılıyor.
- Ayrı üst seviye sorgu: sekme aktif değilken hiç çalışmıyor (`skip`).
- `corporation` alan resolver'ı mevcut `corporation` DataLoader'ını kullanıyor;
  corporation henüz veritabanında yoksa `null`.
- Resolver'lar `backend/src/resolvers/character/` altında, servise
  delege ediyor; `resolvers/index.ts`'e bağlanıyor.
- Geçmişi hiç çekilmemiş karakter için boş dizi döner.

---

## 6. Frontend

`TabType`'a `'employment'` ekleniyor, `TAB_LABELS` değeri
`Employment History`, `TAB_IDS`'de `statistics`'ten sonra. Sekme, diğerleri
gibi `?tab=employment` ile URL'ye yazılıyor.

Doküman `frontend/src/graphql/CharacterCorporationHistory.graphql`; sorgu
`skip: activeTab !== 'employment'`. Liste ayrı bir sunum bileşeninde, `frontend/src/components/EmploymentHistoryList`,
ve veri sayfadan prop olarak geliyor.

**Adlandırma:** backend tarafı (tablo, kuyruk, worker, servis, GraphQL type ve
sorgusu) ESI endpoint'inin adını izliyor: `CharacterCorporationHistory`,
`/characters/{id}/corporationhistory/`. "Employment History" oyun arayüzünün
adı ve yalnızca kullanıcının gördüğü yerde kullanılıyor: sekme başlığı ve
onu gösteren bileşen.

Her satır, oyun içindeki gibi:

```text
Clown Swords. 2026.01.17 18:18 to this day (280 Days)
Kenshin. 2022.09.18 09:56 to 2026.01.17 18:13 (1217 Days)
CORPFREE (Closed) 2007.04.30 17:47 to 2007.05.15 18:38 (15 Days)
```

- NPC corporation'lar dahil ESI'nin döndürdüğü her kayıt bir satır; hiçbir
  satır gizlenmiyor. Yukarıdaki örnek kısaltılmış: Kenshin ile Clown Swords
  arasındaki 5 dakikalık boşluk, listede kendi satırıyla görünecek kısa bir
  NPC corp dönemi.
- Corporation adı `/corporations/{id}`'ye link. Adın sonundaki nokta
  (`Clown Swords.`, `Kenshin.`) ayraç değil, corporation adının kendisi.
- `isDeleted` ise adın ardından `(Closed)`.
- Tarihler `YYYY.MM.DD HH:mm`, UTC (EVE saati), normal ağırlıkta. İlk sürümde
  oyundaki gibi kalındı; corporation adları gri link olunca satırda en çok
  tarihler öne çıktı, bu yüzden 2026-10-25'te kalınlık kaldırıldı.
- Bitiş yoksa `to this day`.
- Süre: tam gün, aşağı yuvarlanmış; bitiş yoksa şimdiki zamana göre.
- Corporation adı henüz yoksa ad yerine corporation ID gösterilir.
- Liste boşsa (geçmiş henüz çekilmemiş) kısa bir boş durum metni.

Tarih biçimi ve gün hesabı `utils/` altında saf fonksiyonlar, birim testli.

---

## 7. Doğrulama

- Worker ve queue script'i elle: tek bir karakter ID'siyle
  `yarn queue:character-corporation-history 95465499`, worker'ı çalıştır,
  tabloda üç satır ve doğru `fetched_at`.
- Doğrudan GraphQL sorgusu: `characterCorporationHistory(characterId: 95465499)`
  doğru sırada, doğru `endDate`'lerle.
- Migration öncesi/sonrası beş yönetilmeyen tablonun satır sayıları.
- CLAUDE.md'deki tam set (migration + servis + worker değişikliği "serious").
- Görsel kontrol kullanıcıda.

---

## 8. Sonraya kalanlar

- **Sekme açılınca tazeleme.** Konuşulan yön: sekme açılınca bir mutation
  karakteri yüksek öncelikle kuyruğa atar, sayfa yeni veri gelene kadar kısa
  aralıklarla sorar (üst sınırlı). Bu, sorgunun response cache dışında
  tutulmasını ve servis önbelleğinin worker tarafından silinmesini gerektirir.
  İlk sürümün hiçbir parçasını bozmadan eklenebilir.
- Görsel zenginleştirme: corporation logosu, alliance, ticker.

---

## 9. Benim kararlarım (kontrol için)

Konuşmada açıkça kararlaştırılmayan, benim seçtiğim noktalar:

- Tablo ve kuyruk adları; birincil anahtar olarak `record_id`.
- `fetched_at`'in her satırda tutulması (ayrı takip tablosu yerine).
- Haftalık zamanlamanın PM2 `cron_restart` ile yapılması.
- Eksik corporation'ların worker tarafından `esi_corporation_info_queue`'ya
  atılması; ad yokken ID gösterilmesi.
- Servis önbelleği TTL'i 7200 sn.
- Haftalık işin eşiği 6 gün.
- Gün sayısının aşağı yuvarlanması, tarihlerin UTC gösterilmesi.
