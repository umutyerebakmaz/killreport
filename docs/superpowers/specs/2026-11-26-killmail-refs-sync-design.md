# Kullanıcı ve kurum killmail sync'i: `killmail_refs` tamponu ve Rust portu

#315 serisinin bir adımı: 1. tablodaki `worker:user-killmails` ve
`worker:corporation-killmails`. Kural yine "taşırken düzelt, düzeltmeyi
TypeScript tarafına da uygula". Bu sefer düzeltme küçük değil: killmail
referansları RabbitMQ yerine veritabanında tutulacak.

## Amaç

Giriş yapmış bir kullanıcının ESI'de gördüğümüz her killmail'i sonunda
kaydedilmiş olsun. Bir mesaj park'a düşse, bir worker çökse, redisq bir kill'i
kaçırsa ya da RabbitMQ sıfırlansa bile. Bugün bu killmail'ler sessizce
kayboluyor ve kaybolduklarını gösteren hiçbir şey yok.

## Bugün

**Zamanlama.** API sunucusu 10 dakikada bir (`killmail-sync-cron.ts`), son
sync'i 15 dakikadan eski kullanıcıları seçip `esi_user_killmails_queue` ve
`esi_corporation_killmails_queue`'ya `{userId, fullSync?, queuedAt}` gönderir
(priority 3). Hiç sync olmamış kullanıcı `fullSync: true` alır.

**Worker'lar** (`worker-esi-user-killmails.ts`,
`worker-esi-corporation-killmails.ts`), mesaj başına:

1. `loadUserCredentials` (`services/user-credentials.ts`): access token'ın
   süresi 5 dakikadan az kaldıysa SSO'dan yeniler, yeni token'ları
   `users`'a yazar.
2. İmleç: `killmail_filters`'taki en büyük killmail ID'si
   (`services/killmail-cursor.ts`); `fullSync`'te yok.
3. ESI `/characters/{id}/killmails/recent/` ya da
   `/corporations/{id}/killmails/recent/`, en fazla 50 sayfa, imleç ID'si
   görülünce durur.
4. `publishKillmailDetails`: veritabanında olmayanları
   `esi_killmail_detail_queue`'ya `{killmailId, killmailHash, announce: true}`,
   priority 5 ile gönderir.
5. `last_killmail_sync_at` / `last_corp_killmail_sync_at` damgası, ack.

Kurum worker'ı 403'ü (Director/CEO değil) damga yazıp ack'leyerek kapatır
(`settleForbidden`). `worker:killmail-detail` mesajı alır, ESI'den killmail'i
çekip `saveKillmail` ile yazar; beş denemeden sonra park'a atar
(`worker-error.ts`, `MAX_ATTEMPTS = 5`).

**ESI** (OpenAPI, 2026-11-26): iki endpoint de 90 gün geriye gider, `X-Pages`
ve `ETag` döner, 300 saniye önbelleklenir. Rate-limit grupları
`char-killmail` ve `corp-killmail`: **15 dakikada 30 token**; biz bucket'ı
karakter ID'siyle anahtarlıyoruz. Sayfa başına kayıt sayısı tanımda yok:
zKillboard ve Shrike 1000 varsayıyor, bizim kod 50. Bu tasarım sayfa boyutuna
bağlı değil.

## Kusurlar

1. **Kaçan killmail bir daha istenmiyor.** İmleç `killmail_filters`'ın
   MAX'ı ve o tabloyu redisq de dolduruyor. Detay mesajı park'a düşen ya da
   redisq'in kaçırdığı, MAX'ın altında kalan bir killmail ESI listesinde
   durduğu halde bir daha kuyruğa girmiyor. `killmail-cursor.ts` bunu
   kendisi söylüyor: "It does not heal itself."
2. **Bekleyen işin kaydı yok.** Kayıt RabbitMQ'daki mesaj. Ack'lenince ya da
   park'a düşünce iz kalmaz; kuyruk sıfırlanırsa (`reset-rabbitmq.sh`) her
   şey gider. CLAUDE.md: "RabbitMQ is a conveyor belt, not a store."
3. **Cron, token'ı süresi dolmak üzere olan kullanıcıyı hiç seçmiyor.**
   `usersDue` `expires_at > şimdi + 5 dk` istiyor; worker ise token'ı ancak
   süresine 5 dakikadan az kalınca yeniliyor. İkisi hiç kesişmez: worker
   token'ı asla yenilemez, `expires_at` (≈20 dk) dolunca kullanıcı seçilmez
   olur. Sonuç: siteye girmeyen kullanıcının sync'i en geç 20 dakikada
   durur, bir dahaki girişine kadar. Yerel veritabanında iki kullanıcının
   ikisinin de access token'ı dolmuş, son sync'leri 1 günden eski (yerel
   ortam, kanıt değil; kod okumasıyla tutarlı).
4. **Token yenileme yarışı.** Üç yer bağımsız yeniler: API'nin
   `resolvers/auth/mutations.ts:44`'ü ve iki worker. Cron aynı kullanıcı için
   iki işi aynı anda gönderir. Kaybeden, diğerinin geçersizleştirdiği
   refresh token'ı yazabilir.
5. **Ölü token ile geçici hata ayrılmıyor.** Her hata `refresh-failed`, ack,
   atla. `invalid_grant` (kullanıcı izni geri aldı) her turda sonsuza kadar
   yeniden denenir; geçici bir SSO hatası ise o turu sessizce düşürür.
6. **Kurum 403'ü her 15 dakikada tekrarlanıyor.** Damga yalnızca 15 dakika
   erteliyor; yetkisi olmayan kullanıcı için ESI'ye kalıcı 403 trafiği ve
   NPC kurumları da dahil.
7. **Kurum listesi boş gelince damga yazılmıyor**
   (`worker-esi-corporation-killmails.ts`, `if (killmailList.length === 0)
return;`): o kurum her turda yeniden kuyruğa girer.
8. **Kendi hız sınırı.** Kullanıcı worker'ı her kullanıcıdan sonra 10 saniye
   uyuyor; kural limiter'ı tek yetkili sayar.
9. **Onaysız yayın.** `publishKillmailDetails` publisher confirm beklemiyor.
10. **50 sayfa tavanı bütçeyi aşar.** Limiter başarılı her isteği 2 token
    sayar (`backend-rs/crates/esi/src/limiter.rs`, `SUCCESS_TOKEN_COST`):
    karakter ve grup başına 15 dakikada 15 sayfa.
11. **Kurum sync'i hiç çalışmamış.** `users.corporation_id`'yi hiçbir kod
    yazmıyor (`handlers/auth-callback.handler.ts` yalnızca isim ve token'ları
    yazar); cron `corporation_id IS NOT NULL` istediği için kurum işine hiçbir
    kullanıcı seçilmiyor.

## Referanslar

- **zKillboard** (`cron/1.characters.nolock.php`,
  `1.char-iteration.nolock.php`, `classes/Killmail.php`): bulunan her
  `(id, hash)` `crestmails` koleksiyonuna `processed: false` yazılır, detayı
  ayrı bir süreç çeker. Yeni refresh token eski değere eşleşen satıra yazılır.
  `invalid_grant` token'ı siler.
- **Shrike** (`internal/workers/authed_killmails.go`, `tokens.go`,
  `internal/sso/sso.go`): her çalıştırmada bütün sayfalar gezilir (`X-Pages`),
  imleç yok, yalnızca kayıtlı olmayanlar kuyruğa girer. Yenileme
  `WHERE refresh_token = <eski>` ile yazılır; `invalid_grant` token'ı kapatır;
  kurum 403'ü izni yerel olarak geri alır; NPC kurumları atlanır. Kuyruğu
  (River) PostgreSQL üzerindedir.

## Yaklaşımlar

- **A — referanslar veritabanında (kullanıcı seçti).** Sync'ler bulduklarını
  `killmail_refs`'e yazar, ayrı bir yayıncı bekleyenleri kuyruğa koyar.
  Kusur 1 ve 2'yi kökünden kapatır; zKillboard ve Shrike'ın yaptığı bu.
  Maliyeti: bir tablo, bir migration, bir timer'lı yayıncı.
- B — yalnızca RabbitMQ'yu sağlamlaştırmak (onaylı yayın, park'tan geri
  besleme). Kayıt hâlâ kuyrukta; sıfırlama ve sorgulama sorunu kalır.
- C — imleci "tamamı kayıtlı ilk sayfada dur" yapmak + günlük tam sync.
  Boşlukların çoğunu kapatır ama park'a düşenin kaydı yine yok.

## Tasarım

### Tablo `killmail_refs`

| Kolon            | Tip                          | Not                                            |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| `killmail_id`    | `integer` PK                 |                                                |
| `killmail_hash`  | `text NOT NULL`              |                                                |
| `source`         | `text NOT NULL`              | `'character'` ya da `'corporation'`, ilk bulan |
| `discovered_at`  | `timestamp(3) NOT NULL`      | UTC, uygulamadan bağlanır                      |
| `queued_count`   | `integer NOT NULL DEFAULT 0` | kaç kez detay kuyruğuna kondu                  |
| `last_queued_at` | `timestamp(3)`               | UTC; NULL = hiç kuyruğa konmadı                |

Prisma modeli olarak eklenir (`KillmailRef`, `@@map("killmail_refs")`);
migration `backend/prisma/CLAUDE.md`'deki prosedürle, `database` agent'ıyla.
`killmails`'e foreign key yok: referans, killmail'den önce vardır.

**Bekleyen** = `killmail_refs`'te olup `killmails`'te olmayan. Ayrı bir
"işlendi" kolonu yok; durum her zaman bir anti-join'dir, kendini onarır.
Satırlar silinmez (küçük: kullanıcı başına en fazla 90 günlük liste).

`ON CONFLICT (killmail_id) DO NOTHING`: aynı killmail'i kullanıcı ve kurum
sync'i ya da iki tur bulursa ilk kayıt kalır.

### Sync worker'ları (Node ve Rust, aynı davranış)

Mesaj biçimi değişmez (`{userId, fullSync?, queuedAt}`). `fullSync: true`
yalnızca durma kuralını kapatır (aşağıda 4).

1. Kullanıcıyı ve token'ı oku. Token yoksa (`refresh_token IS NULL`) ack,
   atla.
2. Gerekirse yenile (aşağıda **Token**). Ölüyse ack, atla. Geçici hatada
   fırlat: ortak hata yolu tekrar dener.
3. Kurum işinde kurum ID'si **`characters` tablosundan** okunur
   (`characters.corporation_id`, `id = users.character_id`; kullanıcı seçti,
   kusur 11). `worker:info:characters` bu tabloyu güncel tutar, kurum
   değişikliği kendiliğinden yansır. Karakter `characters`'ta yoksa ya da
   kurum NPC ise (`1_000_000 ≤ id < 2_000_000`) damga + ack, atla.
   `users.corporation_id` artık okunmaz (silinmez).
4. Sayfa 1'den başlayarak gez. Dur:
   - 404 ya da boş liste ya da `page ≥ X-Pages`;
   - **bütün referansları `killmail_refs`'te zaten olan bir sayfa**
     (`fullSync` değilse). Güvenli, çünkü o sayfanın altındakiler daha önce
     görülüp kaydedildi; boşlukları kapatmak yayıncının işi. İlk sync'te
     `killmail_refs` boş olduğu için baştan sona gezilir.
   - Tavan **14 sayfa** (bütçe 15 başarılı sayfa / 15 dk, bir pay). Tavana
     ulaşılırsa uyarı logu; daha derin geçmiş okunmaz (kabul).
     Her sayfanın referansları gezinirken yazılır (5), böylece "tamamı
     kayıtlı mı" bir sonraki sayfa için doğru cevaplanır.
5. Bulunanları sayfa sayfa `killmail_refs`'e yaz (`UNNEST`,
   `ON CONFLICT DO NOTHING`), `source` ve `discovered_at = now` ile.
6. Damga (`last_killmail_sync_at` / `last_corp_killmail_sync_at = now`),
   liste boş olsa da (kusur 7).
7. Ack. Worker detay kuyruğuna **hiçbir şey göndermez**.

Sayfa yazımları ve damga ayrı ifadelerdir: yarıda çökme yazılan
referansları kaybettirmez, damga yazılmadığı için kullanıcı bir sonraki turda
yeniden seçilir.

**403:**

- Kurum: kullanıcıya `corp_killmails_denied_at = now` yazılır (yeni kolon,
  `timestamp(3)`, NULL), ack. Cron bu kullanıcıyı kurum işine seçmez. Kullanıcı
  yeniden giriş yaptığında (`handlers/auth-callback.handler.ts`) NULL'a
  çekilir: rol kazandıysa yeniden dener.
- Karakter: log + damga + ack (scope eksik; yeniden giriş düzeltir).

10 saniyelik uyku kalkar; hız limiter'ın ve karakter bucket'ının işi.
`killmail-cursor.ts` ve `publishKillmailDetails`'in bu iki worker'daki
kullanımı kalkar.

### Token

Cron aynı kullanıcı için iki işi aynı anda gönderdiği için yarış neredeyse
her turda olur. Karşılaştırmalı yazma tek başına yetmez: kaybeden, eskimiş
refresh token'la `invalid_grant` alıp kazananın yazmasından önce token'ı
silebilir. Bu yüzden:

- **Kilit:** yenileme bir transaction içinde, kullanıcı satırı
  `SELECT … FOR UPDATE` ile kilitliyken yapılır: oku → hâlâ yenilemek
  gerekiyor mu? → gerekiyorsa SSO'ya git → yaz → commit. İkinci süreç kilidi
  bekler, sonra taze token'ı okur ve yenilemez. Kilit yalnızca yenileme
  gerektiğinde alınır; geçerli token'ı okumak kilitsizdir. Kilit süresi SSO
  isteğinin süresi kadardır (zaman aşımı 10 s).
- **Yazma** yine `WHERE id = $1 AND refresh_token = $eski` ile yapılır
  (kilidi kullanmayan eski bir süreç için ikinci emniyet).
- **Ölü token:** SSO `invalid_grant` döndürürse, aynı kilit altında
  `refresh_token = NULL`. Cron `refresh_token IS NOT NULL` ile zaten
  filtreler; kullanıcı yeniden giriş yapınca yeni token yazılır. Diğer her
  hata (ağ, 5xx, timeout) geçicidir.
- Node'da `user-credentials.ts` (API'nin `refreshSession`'ı,
  `resolvers/auth/mutations.ts:44`, aynı fonksiyonu kullandığı için o da
  kapsanır), Rust'ta aynı SQL.

### Cron (`killmail-sync-cron.ts`)

- `expires_at > şimdi + 5 dk` koşulu kalkar (kusur 3). Seçim:
  `refresh_token IS NOT NULL` + bayat damga. Kurum işi için ek olarak
  `corp_killmails_denied_at IS NULL`; `corporation_id` koşulu kalkar (kurum
  worker'da `characters`'tan okunur). Token'ı worker yeniler.
- Aralık ve 15 dakika değişmez.

### Yayıncı: `queue:killmail-refs`

Node `backend/src/queues/queue-killmail-refs.ts` ve Rust
`backend-rs/queues/queue-killmail-refs` (`queue:killmail-refs:rs`), aynı SQL.
systemd timer'ı **5 dakikada bir** Node sürümünü çalıştırır (diğer timer'lar
gibi; Rust'a geçiş unit'le birlikte ayrı iş). `systemd-units.guard.spec.ts`
envanterine eklenir.

0. `esi_killmail_detail_queue`'nun consumer'ı yoksa tur atlanır (cron'daki
   `skipReason` gibi): detay worker'ı kapalıyken referanslar boşa harcanmaz.
1. Bekleyen ve sırası gelmiş referansları seç: `killmails`'te yok ve
   - `last_queued_at IS NULL`, ya da
   - `queued_count < 5` ve `last_queued_at < now − 1 saat`, ya da
   - `queued_count ≥ 5` ve `last_queued_at < now − 24 saat`.
     `killmail_id DESC`, en fazla 5000.
2. `esi_killmail_detail_queue`'ya onaylı yayınla:
   `{killmailId, killmailHash, announce: false}`, priority 5. Bu yoldan
   gelenler tanımı gereği canlı akışın kaçırdığı ya da eski kill'lerdir;
   yeni bir kullanıcının 90 günlük geçmişi canlı akışa "yeni" diye düşmez
   (benim kararım; bugünkü `announce: true`'dan farklı; Shrike da bunları
   canlı değil backfill sayar).
3. Onaydan sonra seçilenlere `queued_count + 1`, `last_queued_at = now`.

İlk 5 tur saatte bir, sonra günde bir; hiçbir referans bırakılmaz.
Kalıcı olarak yazılamayanlar görünürdür (`queued_count ≥ 5` ve
`killmails`'te yok).

### Rust

- `crates/esi`: token'lı GET (`Authorization: Bearer`, hata mesajında
  gizli), karakter bucket key'i ve `X-Pages`'ı döndüren sayfa okuma. Mevcut
  çağrılar değişmez.
- Yeni lib crate `crates/sso`: refresh isteği (`EVE_CLIENT_ID`,
  `EVE_CLIENT_SECRET`, Basic auth), `invalid_grant` ayrımı, karşılaştırmalı
  yazma ve ölü token işareti.
- `workers/worker-user-killmails`, `workers/worker-corporation-killmails`
  (`runner` üzerinde; `runner`'ın mesajı `userId`'yi de okur),
  `queues/queue-killmail-refs`. Script'ler `:rs`.

### Kapsam dışı

- `worker:killmail-detail` (killmail yazıcısı, redisq ile birlikte gider).
- `publishKillmailDetails`'in diğer kullanıcıları (`worker-zkillboard-sync.ts`,
  `sync-character-killmails.ts`): sonra aynı tabloya geçebilir.
- Token yenilemenin tek bir işe toplanması (Shrike'ın `TokenRefreshWorker`'ı),
  ETag/koşullu istek, aktiviteye göre aralık.
- `users.last_killmail_id` / `last_corp_killmail_id` kolonlarının silinmesi
  (kullanılmıyorlar; silmek veri kaybı, ayrı karar).
- systemd unit'lerinin Rust'a geçmesi.

### Testler

- Rust `#[sqlx::test]` + wiremock: sayfalama (404, boş, `X-Pages`, 14 sayfa
  tavanı, tamamı kayıtlı sayfada durma, `fullSync`'te durmama), refs yazımı ve
  çakışma, boş listede damga, kurum ID'sinin `characters`'tan okunması
  (karakter yok / NPC kurumu → atla), kurum 403 → `corp_killmails_denied_at`,
  token: kilit altında iki eşzamanlı yenilemeden yalnızca birinin SSO'ya
  gitmesi, `invalid_grant` → NULL, geçici hata fırlatır.
- Yayıncı: consumer yokken tur atlanır; bekleyen seçimi (kayıtlı olan, 1 saat
  / 24 saat dolmamış olan seçilmez, `queued_count ≥ 5` günde bir), her zaman
  `announce: false`, onaydan sonra sayaç.
- Node: aynı durumlar vitest ile; cron seçiminin `expires_at`'e ve
  `users.corporation_id`'ye bakmaması, `corp_killmails_denied_at`'li
  kullanıcının kurum işine seçilmemesi, login'de NULL'a çekilmesi.

## Builder'a kalan

SQL'in tam metni, crate'lerin iç bölünmesi, `runner`'da `userId` desteğinin
biçimi, log satırları, fixture'lar.
