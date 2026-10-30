# Tracker — tasarım

Tarih: 2026-10-30 · Dal: `feat/tracker`

## Amaç ve neden

Giriş yapmış kullanıcının kişisel bir kısayol listesi. Kullanıcı killreport'u
açtığında ilgilendiği karakter, corporation ve alliance'ların killmail'lerine
aramadan, tek tıkla ulaşmak istiyor. Bugün bunun tek yolu her seferinde arayıp
profili bulmak.

"Takip" burada **kısayol** demek: bildirim, uyarı, e-posta yok. Listedeki bir
kayda tıklamak o profili killmails sekmesiyle açar; profil sayfaları zaten
varsayılan olarak `?tab=killmails` ile açılıyor
(`frontend/src/app/characters/[id]/page.tsx:54`), yani hedef sayfalar hazır.

## Hedefler

1. Kullanıcı karakter, corporation ve alliance'ları listesine ekleyip
   çıkarabilir.
2. Kullanıcının **kendi** corporation'ı ve varsa alliance'ı listede otomatik
   olarak bulunur; çıkarılamaz.
3. Liste header'daki bir **TRACKER** menüsünden açılır; bir kayda tıklamak
   profili killmails sekmesiyle açar.
4. Kullanıcının kendi killmail'lerine avatar menüsünden bir link götürür.
5. Ekleme/çıkarma **her ekranda kullanılabilecek** iki ortak parça üzerine
   kurulur; bu sürümde profil sayfaları ve killmail detayı kullanır.

## Hedef olmayanlar

- Bildirim, uyarı, "yeni kill geldi" işareti.
- Menünün içinden arayarak ekleme.
- Gemi ve gemi tipi takibi. Veri modeli buna kapı bırakır (bkz. _Veri
  modeli_), ama bu sürümde arayüzde ya da API'de yer almaz.
- Listeyi başkalarıyla paylaşmak, herkese açık listeler.
- Ayrı bir `/tracker` yönetim sayfası. Menüdeki "tümünü yönet" linki ileride
  böyle bir sayfaya bağlanabilir; bu sürümde yok.
- Mevcut resolver'ları servise taşımak (CLAUDE.md: ayrı iş).

## Anti-hedefler

- Ücretli/premium her türlü sınır ya da katman (CLAUDE.md: monetizasyon yok).
- Attackers satırlarının her birine buton eklemek: 200 attacker'lı bir
  killmail'de sayfa butondan geçilmez olur. Killmail detayında ekleme tek bir
  pencereden yapılır.
- Sayfa açıldığında düzeni değiştirmek: killmail detayına yalnızca bir buton
  eklenir, pencere ancak tıklanınca açılır.

## Kullanıcının verdiği kararlar

### TRACKER menüsü (header)

- Header'da, ENTITIES gibi ayrı bir açılır menü: **TRACKER**. Yalnızca giriş
  yapmış kullanıcıya görünür.
- Kayıtlar türe göre gruplu: **CORPORATIONS**, **ALLIANCES**, **CHARACTERS**.
  Her satırda EVE görseli ve isim.
- Kullanıcının kendi corp'u ve alliance'ı ilgili grubun en üstünde, kilit
  işaretiyle durur; ✕ yoktur.
- Elle eklenen bir satırın üstüne gelince sağda ✕ çıkar; tek tıkla listeden
  çıkarır.
- Bir satıra tıklamak `/{characters|corporations|alliances}/{id}?tab=killmails`
  açar ve menüyü kapatır.
- Liste boşsa (otomatik kayıtlar dışında): profil sayfalarındaki TRACK
  butonuyla eklenebileceğini söyleyen kısa bir not.
- Listede 5 kayıt da olabilir 50 de: menü uzun listede kendi içinde kaydırılır.

### Avatar menüsü

- Portrenin altına kullanıcının kendi killmail'lerine giden bir link eklenir:
  `/characters/{kendi id}?tab=killmails`. Kullanıcının kendisi TRACKER
  listesinde yer almaz.

### Ortak parça 1 — Track butonu

Tek bir karakter, corporation ya da alliance için ekle/çıkar düğmesi.

- Takipte değilse **＋ TRACK**.
- Takipteyse **✓ TRACKING**; üstüne gelince **✕ UNTRACK** olur, tıklayınca
  çıkarır.
- Kullanıcının kendi corp'u/alliance'ı için buton yerine "otomatik takipte"
  anlamında pasif bir etiket.
- Giriş yapılmamışsa hiç görünmez.

Kullanıldığı yerler: karakter, corporation ve alliance profil sayfalarında
ismin altında; Track penceresinin her satırında.

### Ortak parça 2 — Track penceresi

Kendisine verilen bir kişi/grup listesini gösteren pencere. Listenin nereden
geldiğini bilmez; çağıran ekran verir. Bugün killmail detayı verir, yarın bir
leaderboard ya da sistem sayfası kendi listesiyle aynı pencereyi açabilir.

- Girdi: karakter, corporation ve alliance kayıtları; her biri için isteğe
  bağlı bir bölüm adı (örn. VICTIM / ATTACKERS) ve rol etiketi (örn. "final
  blow", "top damage").
- Üç sekme: CHARACTERS (n), CORPORATIONS (n), ALLIANCES (n). Aynı corp ya da
  alliance bir sekmede bir kez görünür.
- Her satırda Track butonu. Pencere açık kalır; kullanıcı art arda birkaç
  kayıt ekleyebilir. ✕ ya da dışarı tıklama kapatır.
- İsme tıklamak profile gider.

### Killmail detayı

- Sayfanın üstteki eylem satırının (zKillboard / ESI Verified / Share)
  sağında **TRACK** butonu. Tıklayınca Track penceresi açılır.
- Pencereye victim (karakter, corp, alliance) ve tüm attacker'lar verilir;
  victim üstte VICTIM bölümünde, attacker'lar ATTACKERS bölümünde. Final blow
  ve top damage rol etiketiyle işaretlenir.
- NPC attacker'lar (karakteri olmayanlar) karakter sekmesine girmez; corp'ları
  varsa corp sekmesine girer.

### Kendi karakterin _(benim kararım)_

Kullanıcı kendi karakterini takip edemez; kendi killmail'leri avatar
menüsündeki linkte. Kendi profil sayfasında Track butonu hiç görünmez; Track
penceresinde kendi satırı (victim ya da attacker olduğunda) butonsuz listelenir.
`track` kendi karakter ID'sini reddeder.

### Dokunmatik ekranlar _(benim kararım)_

Hover olmayan cihazlarda (`(hover: none)`): TRACKER menüsündeki ✕ her elle
eklenen satırda sürekli görünür; ✓ TRACKING'e dokunmak doğrudan çıkarır. Mobil
çekmecedeki TRACKER bölümü de aynı kuralla çalışır.

## Veri modeli

Yeni tablo `tracked_entities`, model `TrackedEntity`
(`backend/prisma/schema/trackedEntity.prisma`):

| Kolon         | Tip                          | Not                                         |
| ------------- | ---------------------------- | ------------------------------------------- |
| `id`          | `Int` autoincrement          |                                             |
| `user_id`     | `Int` → `users.id`           | `onDelete: Cascade`                         |
| `entity_type` | enum `TrackedEntityType`     | `CHARACTER`, `CORPORATION`, `ALLIANCE`      |
| `entity_id`   | `Int`                        | EVE ID; yabancı anahtar yok (aşağıya bakın) |
| `created_at`  | `DateTime` `@default(now())` |                                             |

- Benzersizlik: `@@unique([user_id, entity_type, entity_id])`. Aynı kaydı iki
  kez eklemek hata değil, sessizce etkisizdir.
- `entity_id` üzerinde yabancı anahtar yok: tek kolon üç ayrı tabloyu
  gösteriyor ve ileride gemi tipleri de eklenecek. İsim ve görsel okunurken
  mevcut DataLoader'lardan çözülür; veritabanında henüz olmayan bir ID
  eklenemez (aşağıda _Doğrulama_).
- Gemi/gemi tipi eklemek ileride enum'a bir değer eklemek demek; tablo
  değişmez.
- **Otomatik kayıtlar tabloda tutulmaz.** Her okumada kullanıcının
  karakterinin güncel `corporation_id` / `alliance_id` değerinden hesaplanır
  (`characters` tablosu, `backend/prisma/schema/character.prisma:4-5`).
  Kullanıcı corp değiştirince liste kendiliğinden güncellenir. Kullanıcı kendi
  corp'unu ayrıca elle de eklemişse liste onu bir kez, otomatik olarak gösterir.
- **Kendi karakteri henüz `characters` tablosunda yoksa** _(benim kararım)_:
  login yalnızca `users` satırını yazar
  (`backend/src/handlers/auth-callback.handler.ts:85`), karakteri yazmaz. Bu
  durumda otomatik kayıtlar boş döner, hata değildir. Login sırasında karakter
  `characters` tablosunda yoksa ID'si `esi_character_info_queue`'ya konur
  (mevcut enrichment yolu, `worker:info:characters`); worker işleyince otomatik
  kayıtlar ve avatar linkindeki profil kendiliğinden dolar. Kuyruğa yazmak
  login'i asla düşürmez: hata loglanır, akış sürer.

Migration CLAUDE.md'deki _Database migrations_ yordamıyla yazılır: `migrate
diff`, beş elle yönetilen tablonun `DROP`'ları silinir, `migrate deploy`.
`prisma migrate dev` kullanılmaz.

## API

Yeni şema dosyası `backend/src/schemas/Tracker.graphql`, `extend type Query` /
`extend type Mutation`:

- `myTracker: Tracker!` — giriş yoksa `UNAUTHENTICATED` hatası.
  `Tracker` üç liste döner: `characters`, `corporations`, `alliances`. Her
  kayıt mevcut `Character` / `Corporation` / `Alliance` tipini ve bir
  `automatic: Boolean!` alanını taşır. Gruplar içinde sıralama: otomatik
  olan önce, sonra isme göre.
- `track(type: TrackedEntityType!, id: Int!): Boolean!`
- `untrack(type: TrackedEntityType!, id: Int!): Boolean!` — otomatik bir
  kayıt için etkisizdir (tabloda yoktur).

Katmanlar CLAUDE.md'nin _Separation of concerns_ bölümüne göre: resolver'lar
`backend/src/resolvers/tracker/` altında yalnızca orkestrasyon yapar; okuma
ve yazma yeni bir servis olan `backend/src/services/tracker/tracker.service.ts`
içinde, düz `async function` biçiminde. İlişkiler DataLoader'la çözülür.

Kimlik `context.user.characterId` üzerinden `users` satırına gider
(`backend/src/resolvers/auth/queries.ts:12-19` ile aynı yol).

### Doğrulama

- `track`, verilen ID'nin ilgili tabloda (`characters`, `corporations`,
  `alliances`) bulunduğunu kontrol eder; yoksa hata döner. Killmail ve profil
  sayfalarından gelen ID'ler zaten veritabanındadır.
- Kişi başına üst sınır: **200 elle eklenmiş kayıt** _(benim kararım)_. Aşılırsa anlaşılır bir
  hata mesajı. Bu bir kötüye kullanım sınırıdır; ücretli bir katman değildir
  ve öyle sunulmaz.

### Önbellek

`myTracker` kullanıcıya özeldir ve her `track`/`untrack` sonrası değişir.
Redis'te önbelleğe alınmaz ve paylaşılan response cache'e girmemelidir;
`backend/src/config/cache.ts`'teki `'Query.me': 0` gibi `'Query.myTracker': 0`
ile dışarıda tutulur. Bir okuma birkaç hafif sorgudan ibarettir.

## Ön yüz

- `frontend/src/graphql/Tracker.graphql`: `MyTracker` sorgusu, `Track` ve
  `Untrack` mutasyonları; ardından frontend codegen.
- Track butonu ve Track penceresi `frontend/src/components/` altında, sunumsal
  bileşenler. Takip durumu `MyTracker` sorgusunun Apollo önbelleğinden okunur;
  `track`/`untrack` sonrası `MyTracker` yenilenir, böylece menü, profil butonu
  ve pencere aynı anda güncellenir.
- TRACKER menüsü statik `NAV` listesine (`components/Header/navItems.ts`)
  girmez, çünkü içeriği kullanıcıya göre değişir. Header'da ayrı bir bileşen
  olarak, avatarın yanında durur ve görünümünü ENTITIES menüsünden
  (`NavPopover`) alır.
- Mobilde TRACKER, `MobileNav` çekmecesinde ayrı bir bölüm olarak görünür
  _(benim kararım)_.
- Görsel dil mevcut sınıflarla: `buttons.css`, `IconBadge`, `nav-item` hover
  çizgisi. Focus ring yok.

## Kurucuya bırakılanlar

- Bileşen ve dosya adları; pencerenin hangi Headless UI parçasıyla yazıldığı.
- Menüdeki kaydırma yüksekliği ve satır yoğunluğu.
- Track penceresinde sekmelerin varsayılan seçimi.
- `MyTracker`'ın ne zaman yenileneceği: `refetchQueries` ya da önbellek
  güncellemesi.

## Doğrulama (kabul)

- Backend: servis ve resolver spec'leri; sınır, tekrar ekleme, otomatik kaydı
  çıkarma denemesi, giriş yokken hata. Migration öncesi/sonrası beş elle
  yönetilen tablonun satır sayıları.
- Ön yüz: bileşen spec'leri, `lint`, `build`.
- Veri: `myTracker`, `track`, `untrack` için backend'e doğrudan GraphQL
  sorgusu.
- Görsel kontrol kullanıcıda: TRACKER menüsü, avatar linki, profil butonları,
  killmail penceresi.
