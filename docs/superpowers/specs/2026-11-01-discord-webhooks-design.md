# Discord webhook bildirimleri — tasarım

Tarih: 2026-11-01 · Dal: `feat/discord-webhooks`

## Amaç ve neden

Oyuncu oyundayken açık olan şey Discord. Kullanıcı, corp'unun **kill'lerinin
ve loss'larının** corp'un ortak Discord kanalına düşmesini, herkesin anında
görmesini istiyor. Bugün bunun için killreport'u açıp bakmak gerekiyor.

Bu, insanları siteye geri getiren ilk "site seni çağırır" özelliği: her mesaj
killreport'taki killmail sayfasına link verir.

Bot yazmıyoruz. Discord'un **webhook** özelliği yeterli: kanal yöneticisi
Discord'da _Integrations → Webhooks_ altından bir URL üretir, killreport'a
yapıştırır, biz o URL'ye JSON embed POST ederiz. Bot hesabı, OAuth, sunucu
daveti yok.

## Hedefler

1. Giriş yapmış **herhangi bir** kullanıcı, herhangi bir karakter, corporation
   veya alliance için bir Discord webhook bağlayabilir. Üyelik şartı yok —
   killmail verisi zaten herkese açık.
2. O entity'nin dahil olduğu her **yeni** killmail kanala bir embed olarak
   düşer:
   - entity kurban tarafındaysa **loss** (kırmızı),
   - saldıranlar arasındaysa **kill** (yeşil).
3. Filtre yok: kapsüller dahil her kill ve her loss gider.
4. Webhook kaydedilirken kanala bir **test mesajı** gider; kurulumun çalıştığı
   hemen görülür.
5. Kaydedilen URL bir daha tam gösterilmez; arayüz "bağlı" durumunu ve
   webhook'un Discord'daki adını gösterir. Tek tıkla kaldırılır.
6. Discord'da silinmiş bir webhook otomatik devre dışı kalır ve arayüzde
   "bağlantı koptu" olarak görünür.

## Hedef olmayanlar

- Discord bot'u, slash komutları, Discord içinden etkileşim.
- Filtreler: ISK eşiği, yalnızca kill / yalnızca loss, gemi sınıfı.
- Tarayıcı bildirimleri, e-posta, Slack ve diğer platformlar.
- Geçmiş killmail'leri kanala dökmek.
- Ayrı bir webhook yönetim sayfası.
- Tracker'ın "automatic" ref'lerini tabloya taşımak, mevcut resolver'ları
  servise taşımak (CLAUDE.md: ayrı iş).

## Anti-hedefler

Teknik olarak çalışsa bile başarısızlık sayılacak durumlar:

- **Toplu backfill kanalı doldurursa.** Biri 20.000 eski killmail yüklediğinde
  Discord'a tek mesaj gitmemeli.
- **Discord killmail yazmayı yavaşlatır veya bozarsa.** Discord'un düşmesi,
  yavaşlaması ya da 429 vermesi killmail kaydını, leaderboard'ları veya
  `NEW_KILLMAIL` aboneliğini hiçbir şekilde etkilememeli.
- **Webhook URL'si sızarsa.** URL bir şifredir: bilen herkes kanala yazabilir.
  GraphQL yanıtında, log'da, hata mesajında, kuyruk mesajında ya da
  `killreport.parking`'de tam haliyle görünmemeli.
- **Aynı killmail aynı kanala iki kez giderse** — corp içi kill, ya da aynı
  URL'ye bağlı iki entity.
- **Ölü bir webhook'a sonsuza dek istek atılırsa.**

## Mevcut durum (kod)

- **Tracker** (#298): `backend/src/services/tracker/tracker.service.ts`.
  Kullanıcının kendi corp'u ve alliance'ı `tracked_entities`'de bir satır
  **değil**; `getTrackerRefs` (`tracker.service.ts:50`) onları her istekte
  karakterden "automatic" olarak hesaplıyor. Asıl kullanım (kendi corp'un) bu
  tabloda yok — bu yüzden webhook `tracked_entities` satırına bağlanamaz.
- **Tek yazma noktası:** `saveKillmail` (`backend/src/services/killmail-writer.ts:28`).
  `publish` bayrağı (`killmail-writer.ts:19`) "yeni killmail" politikasını
  zaten taşıyor: `worker-redisq-stream` ve `fetch-single-killmail` varsayılan
  `true`, `worker-killmail-detail` mesajdaki `announce` alanını geçiriyor
  (`worker-killmail-detail.ts:39`), backfill'ler `false`. `true` iken
  `NEW_KILLMAIL` yayınlanıyor (`killmail-writer.ts:138`).
- **Kuyruklar:** `backend/src/services/queue-names.ts` → `ALL_QUEUES` tek liste;
  her kuyruk `x-max-priority: 10` ile ve `RETRY_TOPOLOGY` ile bildiriliyor.
- **Ortak hata yolu:** `backend/src/workers/worker-error.ts`
  (`handleWorkerError`, `MAX_ATTEMPTS = 5`, ardından parking).
- **Frontend:** ayrı Tracker sayfası yok. Header'da `TrackerMenu`,
  profil başlıklarında `TrackButton`
  (`frontend/src/components/Tracker/`, örn.
  `frontend/src/app/corporations/[id]/page.tsx:380`).

## Tasarım

### Veri modeli

Yeni model `DiscordWebhook` → tablo `discord_webhooks`
(`backend/prisma/schema/discordWebhook.prisma`):

| Alan           | Tür                 | Not                                                                                      |
| -------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `id`           | Int, autoincrement  |                                                                                          |
| `user_id`      | Int → `users.id`    | `onDelete: Cascade`                                                                      |
| `entity_type`  | `TrackedEntityType` | mevcut enum yeniden kullanılır                                                           |
| `entity_id`    | Int                 |                                                                                          |
| `url`          | String              | normalize tam URL, index — hiçbir yere geri dönmez                                       |
| `name`         | String?             | Discord'un döndürdüğü webhook adı, arayüzde gösterilir                                   |
| `disabled_at`  | DateTime?           | 404/401/403 alındığında doldurulur                                                       |
| `active_since` | DateTime            | kaydedilince ve her yeniden kaydedilişte `now()`; bundan önceki killmail'ler gönderilmez |
| `created_at`   | DateTime            |                                                                                          |

- `@@unique([user_id, entity_type, entity_id])` — bir kullanıcının bir entity
  için tek webhook'u olur; yeniden kaydetmek URL'yi değiştirir ve
  `disabled_at`'i temizler, `active_since`'i `now()` yapar (kopmuş bir webhook yeniden bağlanınca aradaki kill'ler kanala dökülmez).
- `@@index([entity_type, entity_id])` — worker'ın eşleştirme sorgusu için.
- `@@index([url])` — aynı URL'deki bütün satırları devre dışı bırakmak için.
- Kullanıcı başına üst sınır: **10 webhook** (benim kararım).

Migration CLAUDE.md'deki diff-and-deploy yöntemiyle yazılır; `database`
agent'ına verilir.

### Akış

```text
saveKillmail(publish: true)
   └─ NEW_KILLMAIL publish (değişmez)
   └─ discord_webhook_queue  ← { killmailId }
          └─ worker-discord-webhook
                 1. killmail'in kurban + saldırgan char/corp/alliance ID'leri
                 2. eşleşen, disabled olmayan webhook'lar (tek sorgu)
                 3. URL bazında tekilleştir; her URL için kill mi loss mu?
                 4. her URL'ye bir POST
```

- Kuyruğa yazma **yalnızca** `publish` `true` iken ve yazma başarılıysa
  yapılır. Böylece zKillboard backfill'leri hiçbir şey göndermez.
- **`publish` tek başına yetmez.** ESI kullanıcı ve corporation sync'leri full
  sync'te de (ilk giriş, `last_*_killmail_sync_at` null) 50 sayfaya, yani
  2.500 eski killmail'e kadar `announce: true` ile yayınlıyor
  (`worker-esi-user-killmails.ts:211`,
  `worker-esi-corporation-killmails.ts:279`). Bu, anti-hedef 1'deki taşmanın
  başka bir kaynağı. Bir killmail bir webhook'a ancak **iki kuralın ikisinden
  de** geçerse gönderilir:
  1. **Webhook aktif olduktan sonra olmuş olmalı:**
     `killmail_time >= active_since`. Kanal, bağlandığı andan sonrasını görür;
     geçmişini görmez. Bu kural webhook başına uygulanır.
  2. **Bir saatten eski olmamalı:** `killmail_time >= now() - 60 dakika`.
     Bu güvenlik ağıdır. Eski bir webhook'u, kesintiden sonra geç gelen
     killmail'lere karşı korur: örneğin RedisQ worker'ı bir gün düştü, ertesi
     gün ESI sync o günün kill'lerini getirdi. Bunlar 1. kuraldan geçer ama
     kanala bir günlük kill'i bir anda dökmemeliler. Normal akışta RedisQ
     birkaç dakika içinde getirdiği için bu kural devreye girmez. Killmail
     bütün webhook'lar için bu kuraldan kalıyorsa, worker hiçbir sorgu
     yapmadan ack'ler.

  `announce` politikasını ve `NEW_KILLMAIL`'in davranışını değiştirmek ayrı
  bir PR'dır; bu PR ona dokunmaz.

- Kuyruk mesajı yalnızca `killmailId` taşır — URL asla kuyruğa girmez
  (anti-hedef 3).
- Kuyruğa yazma hatası killmail yazımını **düşürmez**: log'lanır ve yutulur
  (anti-hedef 2). Webhook'u olmayan killmail'ler için de mesaj atılır;
  eşleştirme worker'da yapılır, writer ucuz kalır (benim kararım).
- Kuyruk adı `discord_webhook_queue`, worker `worker-discord-webhook.ts`,
  script `worker:discord-webhook`. `ALL_QUEUES`'a eklenir. Bir kuyruk, bir
  worker — mevcut kalıp.

### Kill mi loss mu, tekilleştirme

Bir webhook'un entity'si kurbanın char/corp/alliance'ıysa o webhook için
mesaj **loss**, değilse saldırganlardan birininkiyse **kill**. Hem kurbanda hem
saldırganda bulunuyorsa (corp içi kill) **loss** sayılır (benim kararım: kanal
için kayıp daha önemli bilgi).

**Her şey URL'ye göre anahtarlanır, satıra göre değil.** Kaydederken URL
normalize edilir: `discordapp.com` → `discord.com`, sorgu dizesi ve sondaki
`/` atılır. Tabloya normalize hali yazılır ve `url` üzerinde index olur.
Böylece aynı webhook iki farklı biçimde yapıştırılsa da tek URL sayılır.

- Aynı URL birden fazla eşleşen satırda çıkarsa (aynı kanala bağlı iki entity
  ya da iki kullanıcı) **tek** POST yapılır. Loss önceliklidir.
- Footer, o URL'de eşleşen entity adlarının hepsini virgülle listeler.
- 404/401/403 o URL'yi taşıyan **bütün** satırları devre dışı bırakır.

Worker bir mesajı yeniden denerken daha önce başarıyla gönderilmiş URL'lere
tekrar göndermemeli. Her başarılı gönderimden sonra Redis'e
`discord:sent:{killmailId}:{sha256(url) ilk 16 hex}` (TTL 24 saat) yazılır,
göndermeden önce bakılır. Anahtarda URL'nin kendisi yok (anti-hedef 3).
Redis 6.0'dır: `GETDEL` vb. yok, `SET ... NX EX` yeterli.

### Discord mesajı

Tek embed:

- **Başlık:** `{Gemi tipi} — {Kurban adı}`; link: killreport killmail sayfası.
- **Renk:** kill yeşil, loss kırmızı.
- **Thumbnail:** kurbanın gemisi (EVE image server, `images.evetech.net`).
- **Alanlar:** kurban corp / alliance, final blow (karakter + gemi), ISK
  değeri, sistem + güvenlik seviyesi + bölge, saldırgan sayısı.
- **Timestamp:** `killmail_time`.
- **Footer:** "KillReport · {entity adı} için" — hangi webhook'tan geldiği
  belli olsun.

**Eksik isimler:** ESI sync'ten gelen killmail'lerde karakter/corp/alliance
adı henüz veritabanında olmayabilir (`worker-killmail-detail` enrichment
yapmaz). Worker yalnızca veritabanından okur; eksik ad yerine "Unknown"
yazar. Embed'deki killmail linki tam bilgiyi taşır. Worker ESI'a gitmez
(benim kararım: yeni bir ESI bağımlılığı ve rate-limit bütçesi getirmemek
için).

Kesin görünüm builder'a kalır; Discord embed limitleri (alan başına 1024
karakter, toplam 6000) aşılmamalı. Frontend'in public URL'si config'den
okunur; yoksa builder hangi env değişkeninin gerektiğini söyler, `.env`'i
kullanıcı düzenler.

### Discord'a gönderim ve hatalar

- Gönderim `fetch` ile `POST {url}?wait=false`. Bu çağrı ESI değildir;
  `esiClient` kullanılmaz.
- **204 / 200:** başarı.
  Her URL'nin sonucu worker'ın içinde, URL başına ayrı ayrı sınıflanır. Bir
  URL'nin hatası diğerlerini etkilemez:

- **404, 401 veya 403:** webhook silinmiş, geçersiz ya da yetkisiz →
  o URL'deki bütün satırlarda `disabled_at = now()`, uyarı log'u, o URL
  bitti sayılır. Bir daha denenmez (anti-hedef 5).
- **400:** Discord embed'i reddetti. Bu bizim hatamız, tekrar denemek
  düzeltmez. Hata log'u (killmail ID ve Discord'un yanıt gövdesi, URL değil),
  o URL bitti sayılır, webhook devre dışı kalmaz.
- **429:** Discord `retry_after` döndürür. Worker bu süreyi bekler ve aynı
  isteği tekrarlar. Toplam bekleme 60 sn'yi aşarsa o URL "geçici hata" sayılır.
- **5xx, ağ hatası, timeout:** o URL "geçici hata" sayılır.

Bütün URL'ler denendikten sonra en az bir "geçici hata" varsa worker **tek**
bir hata fırlatır → `handleWorkerError` → retry topolojisi, 5 denemeden sonra
parking. Yeniden denemede Redis işareti başarılı URL'leri atlar.

**`handleWorkerError` metin eşleşmesine düşmemek için:** bu hata
`DiscordDeliveryError` sınıfındandır ve mesajında HTTP durum kodu **yer
almaz** (örn. `discord delivery incomplete for killmail 123: 2 webhook(s)
pending`). `worker-error.ts` mesajın ilk satırında 404/420/429 arıyor. Durum
kodu taşıyan bir mesaj 429'da sonsuz requeue'ya, 404'te ise bütün URL'ler için
sessiz bir ack'e yol açar. Durum kodları yalnızca log'a, webhook `id`'siyle
birlikte yazılır.

- **Hata mesajlarında URL yok.** Log ve fırlatılan hata yalnızca webhook
  `id`'sini taşır; URL'nin token kısmı hiçbir yere yazılmaz.
- Discord'un webhook başına limiti saniyede birkaç istek. `PREFETCH_COUNT`
  küçük tutulur (öneri: 5); yoğun bir filo savaşında 429 yolu bunu karşılar.

### GraphQL

`backend/src/schemas/DiscordWebhook.graphql`:

```graphql
type DiscordWebhook {
  entityType: TrackedEntityType!
  entityId: Int!
  name: String
  disabled: Boolean!
  createdAt: String!
}

extend type Query {
  myDiscordWebhooks: [DiscordWebhook!]!
}

extend type Mutation {
  setDiscordWebhook(
    type: TrackedEntityType!
    id: Int!
    url: String!
  ): DiscordWebhook!
  removeDiscordWebhook(type: TrackedEntityType!, id: Int!): Boolean!
}
```

- Tip URL alanı **içermez** (anti-hedef 3).
- Hepsi giriş ister; aksi halde Tracker'daki gibi hata.
- `setDiscordWebhook`:
  1. URL `https://discord.com/api/webhooks/{id}/{token}` biçiminde mi
     (`discordapp.com` da kabul) — değilse hata.
  2. Entity var mı — `tracker.service.ts`'teki `entityExists` ile aynı kontrol.
  3. 10 limiti.
  4. `GET {url}` ile webhook'un adını al; 404/401 ise "webhook bulunamadı".
  5. Test mesajı POST et: "KillReport bu kanala {entity adı} kill ve
     loss'larını gönderecek."
  6. Upsert, `disabled_at = null`, `active_since = now()`.

  Bu, resolver'ın bir dış HTTP çağrısı yaptığı tek yer; ESI değil, Discord.
  Mantık `backend/src/services/discord-webhook/` altındaki servis
  fonksiyonlarındadır, resolver yalnızca çağırır. Webhook'u gönderen fonksiyon
  worker ile paylaşılır.

- Per-user veri: cache yok, tıpkı Tracker gibi.

### Frontend

- `frontend/src/graphql/DiscordWebhook.graphql` — sorgu ve iki mutation.
- `frontend/src/components/DiscordWebhook/DiscordWebhookButton.tsx`: profil
  başlığında `TrackButton`'ın yanında (karakter, corporation, alliance profil
  sayfaları). Yalnızca giriş yapmışken görünür. **Kendi corp'un da dahil** —
  `TrackButton`'ın aksine "self/automatic" durumunda gizlenmez, asıl kullanım
  bu.
- Tıklayınca bir dialog (`TrackDialog` ile aynı yapı, Headless UI React):
  - bağlı değilse: URL alanı + "Bağla" + Discord'da webhook'un nasıl
    oluşturulacağını anlatan bir cümle;
  - bağlıysa: webhook adı, "bağlı" ya da "bağlantı koptu" durumu, URL'yi
    değiştirmek için alan, "Kaldır".
- Buton durumu: bağlı değil / bağlı / koptu. Rozet stili mevcut grey
  `IconBadge` kuralına uyar; renk kodlaması yok.
- Arayüz metni İngilizce (site İngilizce).

## Kısıtlar

- Webhook URL'si hiçbir yanıta, log'a, kuyruk mesajına girmez.
- `saveKillmail`'in davranışı ve süresi yalnızca bir kuyruk publish'i kadar
  değişir; yazma işleminin transaction'ı değişmez.
- Workers `@services/prisma-worker`, resolver/servis `@services/prisma`.
- Yeni kuyruk `x-max-priority: 10` ile, `ALL_QUEUES` üzerinden bildirilir.
- `prisma migrate dev` yok; diff-and-deploy, beş unmanaged tablonun row
  count'u önce ve sonra kontrol edilir.
- Generated dosyalar elle değiştirilmez; codegen backend → frontend.
- PM2 tanımı `ecosystem.config.js`'e eklenir (diğer sürekli worker'lar gibi,
  `cron_restart` yok). Deploy edilmiş bir droplet şu an yok; sadece tanım.

## Builder'a kalanlar

- Embed'in tam alan sırası ve metinleri.
- Worker'ın eşleştirme sorgusunun şekli (Prisma `findMany` ya da `$queryRaw`).
- Dialog'un düzeni ve kopyası.
- Discord çağrısı için timeout değeri.

## Benim kararlarım (kullanıcı onayına açık)

1. Webhook `tracked_entities`'den bağımsız ayrı bir tabloda; takip etmeden de
   webhook kurulabilir.
2. Kullanıcı başına 10 webhook.
3. Ayar profil başlığında, `TrackButton`'ın yanında — ayrı Tracker sayfası yok.
4. Corp içi kill **loss** olarak gider.
5. Kuyruğa her yeni killmail için mesaj atılır; eşleştirme worker'da.
6. Yeniden denemede tekrar göndermeyi önlemek için Redis işareti (24 saat),
   URL hash'iyle anahtarlı.
7. Bir saatlik yaş sınırı, kullanıcının kararı olan "webhook aktif olduktan
   sonra" kuralının yanında güvenlik ağı olarak duruyor; ikisi birlikte
   uygulanıyor (kullanıcıyla kararlaştırıldı). Süre olarak 60 dakika benim
   kararım. `announce` politikası bu PR'da değişmez.
8. 403 de 404/401 gibi webhook'u devre dışı bırakır; 400 bırakmaz.
9. Eksik isimler "Unknown" olarak gösterilir; worker ESI'a gitmez.
10. URL normalize edilir; aynı URL'deki her şey tek mesaj, tek footer, birlikte
    devre dışı.

## Ayrıca fark edilen (bu PR'ın dışında)

ESI kullanıcı/corporation full sync'i 2.500'e kadar eski killmail'i
`announce: true` ile yayınlıyor. Bu, `NEW_KILLMAIL` aboneliğine de "yeni"
olarak gidiyor ve `frontend/src/app/killmails/page.tsx:158`'deki canlı listeyi
dolduruyor; `killmail-writer.ts:11`'deki yorumun anlattığı sorunun aynısı.
Kendi PR'ını hak ediyor.
