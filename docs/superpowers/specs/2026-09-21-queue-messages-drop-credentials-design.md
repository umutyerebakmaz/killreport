# Kuyruk mesajı kimlik bilgisi taşımasın — tasarım

**Tarih:** 2026-09-21
**Durum:** inceleme bekliyor

Killmail sync kuyruklarının mesajı bugün kullanıcının EVE SSO access ve refresh
token'ını düz metin olarak taşıyor. Mesaj yalnızca `userId` taşısın; token'ı
worker, kullanacağı anda veritabanından okusun.

Bu bir sızıntı raporu değil. Bugünkü akış çalışıyor — düzeltilen şey, çalışırken
kimlik bilgisini gereksiz bir yere, gereksiz uzunlukta ve çoğaltarak yazıyor
olması.

---

## 1. Bugünkü durum, ölçülmüş

Hepsi 2026-09-21'de `backend/src` üzerinde sayıldı. Satır atıfları #237 (`bc323bf2`)
birleştikten sonraki `main`'e göre: bu iş onun doğrudan devamı ve aynı
dosyaya dokunuyor.

İki kuyruk aynı mesaj şeklini paylaşıyor (`services/user-killmail-cron.ts:8-17`,
`queues/queue-corporation-esi-killmails.ts:7-18`):

```ts
{
  userId, characterId, characterName,
  /* corp kuyruğunda ayrıca: corporationId, corporationName, */
  accessToken, refreshToken, expiresAt,
  queuedAt, lastKillmailId?
}
```

Beş publish noktası, dört dosya:

| Nereden                                     | Kuyruk                            | Satır     |
| ------------------------------------------- | --------------------------------- | --------- |
| `services/user-killmail-cron.ts`            | `esi_user_killmails_queue`        | `150-151` |
| `queues/queue-user-esi-killmails.ts`        | `esi_user_killmails_queue`        | `114-115` |
| `resolvers/auth/mutations.ts` (login)       | `esi_user_killmails_queue`        | `91-92`   |
| `queues/queue-corporation-esi-killmails.ts` | `esi_corporation_killmails_queue` | `143-144` |
| `resolvers/auth/mutations.ts` (login)       | `esi_corporation_killmails_queue` | `147-148` |

Beşi de `persistent: true` ile yayınlıyor. Yani broker mesajı diske yazıyor.

Token veritabanında zaten var: `users.access_token`, `users.refresh_token`,
`users.expires_at` (`prisma/schema/user.prisma`). Worker token'ı yenilediğinde
yenisini de oraya yazıyor (`workers/worker-esi-user-killmails.ts:122-131`,
`workers/worker-esi-corporation-killmails.ts:122-131`). **Veritabanı bugün de
tek doğru kaynak; mesajdaki kopya yalnızca eskimiş bir tekrar.**

### Üç sonuç

**a. Diskte kalıcı, çoğaltılmış kimlik bilgisi.** Broker'ın mesaj deposunu
okuyabilen ya da management UI'da "Get message" diyebilen herkes refresh
token'ı düz metin görür. #237'de sayılan 207 kopyalık birikme, aynı kullanıcının
refresh token'ının diskte 207 kopyası demekti.

**b. Parking kuyruğu bunu süresiz saklıyor.** `workers/worker-error.ts:118-131`
beşinci denemeden sonra `msg.content`'i olduğu gibi, yine `persistent: true` ile
`killreport.parking`'e yayınlıyor. O kuyruğu hiçbir şey tüketmiyor;
`workers/doctor-topology.ts:94-105` yalnızca derinliğini okuyor. Oraya düşen bir
mesaj, içindeki refresh token'la birlikte, biri elle silene kadar durur.

**c. Eskime, sessizce kullanıcıyı atıyor.** EVE SSO refresh token'ı döndürüyor.
Worker yenilediğinde yeniyi veritabanına yazıyor, ama kuyrukta bekleyen diğer
kopyalar hâlâ eski snapshot'ı taşıyor. O kopya işlendiğinde `refreshAccessToken`
başarısız oluyor ve worker kullanıcıyı "requires re-login" diyip ack'leyip
atıyor (`workers/worker-esi-user-killmails.ts:154-158`). #237'nin çözdüğü
çoğaltma sorununun ikinci yüzü tam olarak buydu; #237 kopya sayısını sınırladı,
kopyanın kendisinin neden zararlı olduğunu değil.

---

## 2. Yeni mesaj şekli

İki kuyruk için **tek ve aynı** şekil:

```ts
interface KillmailSyncMessage {
  userId: number;
  fullSync?: boolean; // --full: artımlı sync'i kapat
  queuedAt: string;
}
```

Çıkanlar ve nedenleri:

- `accessToken`, `refreshToken`, `expiresAt` — bu işin tamamı. Worker bunları
  veritabanından okuyacak.
- `lastKillmailId` — zaten `users.last_killmail_id` / `users.last_corp_killmail_id`
  sütunundan geliyordu. Mesajda olmasının tek sebebi `--full` bayrağının onu
  **atlayarak** tam sync'i zorlamasıydı (`queues/queue-user-esi-killmails.ts:118-121`).
  Bu örtük kodlama açık bir `fullSync` alanına dönüşüyor; worker `lastKillmailId`'yi
  kendisi okuyor.
- `characterId`, `characterName`, `corporationId`, `corporationName` — yalnızca
  log satırları için taşınıyordu. Worker kullanıcı satırını zaten okuyacak;
  corporation adı `corporations` tablosundan geliyor, tıpkı publisher'ın bugün
  yaptığı gibi (`resolvers/auth/mutations.ts:129-136`).

`queuedAt` kalıyor: gizli değil, gecikme ölçmek için işe yarıyor.

İki kuyruğun mesajının birebir aynı şekle inmesi kendi başına bir kazanç: bugün
iki ayrı `interface` dört dosyada elle tekrarlanıyor, yeni şekil tek bir yerde
tanımlanıp beş publish noktası ve iki worker tarafından paylaşılacak.

---

## 3. Ortak kimlik bilgisi servisi

Bugün token yenileme bloğu iki worker'da birebir aynı, ~35 satır olarak
duruyor (`worker-esi-user-killmails.ts:118-158`,
`worker-esi-corporation-killmails.ts:106-147`). Mesajdan okumayı bırakınca ikisi
de aynı yeni işi yapacak, yani blok üçüncü kez kopyalanmak yerine tek yere
çıkıyor.

**Yeri:** `backend/src/services/user-credentials.ts`, düz `async function`
olarak. Emsal: `services/kill-stats-realtime.ts` ve `services/market/market.service.ts`
zaten `prisma-worker` kullanan servisler — worker tarafında çalışan bir servis bu
projede yeni bir şey değil. CLAUDE.md'nin "yeni okuma yolu düz fonksiyon
biçiminde bir servis alır" kuralı da bunu söylüyor.

**Arayüz:**

```ts
type UserCredentials =
  | { ok: true; user: UserSyncRow; accessToken: string }
  | { ok: false; reason: 'not-found' | 'no-refresh-token' | 'refresh-failed' };

export async function loadUserCredentials(
  userId: number,
): Promise<UserCredentials>;
```

Atmak yerine sonuç döndürüyor, çünkü çağıran üç durumda da aynı şeyi yapacak:
logla, ack'le, geç. Bunlar yeniden denenecek hatalar değil — kullanıcı yeniden
SSO'dan geçene kadar hiçbir deneme başarılı olmaz. `handleWorkerError`'ın retry
yoluna sokmak, #234'ün kurduğu sözleşmeye göre yanlış olur.

İçi, bugün worker'da olanın aynısı: kullanıcıyı oku → `expires_at` beş dakikadan
yakınsa `refreshAccessToken` ile yenile → yeniyi `prismaWorker.user.update` ile
yaz → geçerli access token'ı döndür.

Karar kısmı saf bir fonksiyon olarak ayrılıyor, #237'de `skipReason` için
yapıldığı gibi:

```ts
export function needsRefresh(expiresAt: Date, now: Date): boolean;
```

---

## 4. Değişen dosyalar

**Publisher'lar (5 nokta, 4 dosya).** Hepsi yeni şekli yayınlar. `select`
listelerinden `access_token` ve `refresh_token` çıkar — publisher'ın artık
token'a ihtiyacı yok. `where` koşulları **kalır**: süresi dolmuş ya da refresh
token'ı olmayan bir kullanıcıyı kuyruğa koymanın anlamı yok; bu bir filtre,
yetki kontrolü değil. Yetkinin tek doğrulandığı yer worker olur.

`resolvers/auth/mutations.ts:129-136`'daki corporation adı sorgusu silinir:
publish için artık gerekmiyor.

**Worker'lar (2 dosya).** Mesajdan token okuma, `expiresAt` kontrolü ve yenileme
bloğu gider; yerine tek satır `loadUserCredentials(message.userId)` gelir.
`lastKillmailId`, `characterName`, `corporationId` artık dönen kullanıcı
satırından okunur. Corp worker'da `user.corporation_id` null ise loglayıp ack'ler
— bugün publisher'ın filtrelediği durumun worker'daki karşılığı.

**Yeni:** `services/user-credentials.ts`, `services/user-credentials.spec.ts`.

Kuyruk adları, `ALL_QUEUES`, retry topolojisi, prefetch, rate limit, `--force` /
`--full` bayraklarının kullanıcıya görünen davranışı — hiçbiri değişmiyor.

---

## 5. Neden veritabanı, başka bir yer değil

**Mesajı şifrelemek.** Anahtar yönetimi getirir, parking'deki mesaj hâlâ
şifrelenmiş bir kimlik bilgisi olarak durur, ve eskime sorununa hiç dokunmaz.
Zaten elde olan doğru kaynağın üstüne ikinci bir mekanizma koymak.

**Kısa ömürlü token koymak.** Mesaj kuyrukta beklerken access token'ın ömrü
geçiyor; işe yaraması için refresh token'ın da mesajda olması gerekiyor — yani
bugünkü durum.

**Mesajı imzalayıp token'ı ayrı bir yerden çekmek.** "Ayrı yer" zaten
veritabanı. İmza, olmayan bir sorunu çözer.

**Hiçbir şey yapmamak.** Üç sonucun üçü de kalır; özellikle (c) sessizce
kullanıcıyı sync dışına atmaya devam eder.

---

## 6. Test

Vitest, `backend/src/services/user-credentials.spec.ts`:

- `needsRefresh` — saf fonksiyon, sınır durumlarıyla: beş dakikadan uzak, tam
  beş dakika, geçmiş. Mock yok. #237 ile gelen `services/queue-health.spec.ts`'teki `skipReason` biçimi.
- `loadUserCredentials` — `prismaWorker` ve `eve-sso` mock'lanarak dört yol:
  kullanıcı yok, refresh token yok, token geçerli (yenileme çağrılmamalı),
  token süresi dolmuş (yenilenmeli, yeni değer veritabanına yazılmalı).
  `services/eve-sso.spec.ts` bu mock biçiminin emsali.

Worker'lar için yeni test yazılmıyor; ikisinin de bugün spec'i yok ve bu
değişiklik onları kapsam olarak büyütmüyor.

Ek olarak, mesajın gerçekten daraldığını doğrulayan bir test: yeni şeklin
`JSON.stringify` çıktısında `token` geçmediğini iddia eden tek satırlık bir
kontrol. Regresyonun geri sızması tam olarak bu yoldan olur.

---

## 7. Yayına alma sırası ve temizlik

**Sıra önemli ve tek yönlü:** önce worker'lar, sonra publisher'lar.

Yeni worker eski mesajı da işleyebilir — eski mesajda `userId` zaten var, fazla
alanları görmezden gelir. Tersi doğru değil: eski worker yeni mesajı alırsa
`accessToken` bulamaz ve kullanıcıyı ack'leyip atar
(`worker-esi-user-killmails.ts:102-108`). `pm2 reload all` sıralama üzerinde
kontrol vermez, yani bu an gerçekten yaşanabilir. Character tarafında bedeli
yok: atlanan senkronizasyon `services/user-killmail-cron.ts`'in on dakikalık
tick'iyle kendini onarıyor. Corporation kuyruğunun eşdeğer bir cron'u yok —
atlanan bir corporation senkronizasyonu kullanıcının bir sonraki girişini ya
da elle çalıştırılan `yarn queue:corporation-killmails`'i bekler.

**Temizlik, yayına aldıktan sonra.** İki sync kuyruğu purge edilir:

```bash
rabbitmqctl purge_queue esi_user_killmails_queue
rabbitmqctl purge_queue esi_corporation_killmails_queue
```

Bu iki kuyrukta duran her mesaj zaten bir "şu kullanıcıyı senkronize et"
isteği; kaybedilen tek şey bu istek, cron on dakika içinde yenisini
yayınlıyor. `package.json`'daki `rabbitmq:purge` bu iş için kullanılmaz — o
**bütün** kuyrukları boşaltıyor.

**`killreport.parking` bu purge'e dahil değil.** O kuyruk uygulamadaki her
worker'ın paylaştığı ortak terminal kuyruk — `worker-error.ts`'teki
`MAX_ATTEMPTS` denemesinden sonra her worker oraya publish ediyor, mesajın
kökeni `x-death` header'ında taşınıyor, ve `doctor-topology.ts` nonzero bir
derinliği insan incelemesi gerektiren bir şey olarak raporluyor
(`backend/src/workers/doctor-topology.ts:94-108`). Körlemesine purge etmek ay,
yıldız, asteroid kuşağı ve diğer bütün worker'ların kalıcı olarak başarısız
mesajlarının kanıtını da siler. `backend/docs/ops/rabbitmq.md` parked
mesajları nasıl okuyacağını ve `x-first-death-queue` header'ıyla kökenini nasıl
teşhis edeceğini zaten anlatıyor; yalnızca bu iki sync kuyruğundan geldiği
doğrulanan mesajlar kaldırılmalı. Derinliğin tamamının zaten sync
mesajlarından ibaret olduğu biliniyorsa, purge etmek sorun değil.

Purge, veri kaybı değil ama geri alınamaz bir adım: PR birleştikten ve worker'lar
yeni sürümle ayağa kalktıktan sonra, elle çalıştırılır. Adım
`backend/docs/ops/rabbitmq.md`'ye yazılır.

---

## 8. Kapsam dışı

**`AuthPayload` tarayıcıya EVE refresh token'ı dönüyor**
(`resolvers/auth/mutations.ts:177`, `:219`; `schemas/Auth.graphql:22`, `:46`). Aynı
kimlik bilgisinin ikinci bir kopyası, ama ayrı bir katmanda: `services/eve-sso.ts:63-64`
gelen token'ı EVE'in JWKS'ine karşı doğruluyor, yani uygulama kendi JWT'sini
üretmiyor ve tarayıcının oturumu doğrudan EVE'in token çifti. Oradaki refresh
token'ı kaldırmak, oturum yenileme mekanizmasının yeniden tasarımı demek —
httpOnly çerez ya da uygulamanın kendi oturum token'ı, `server.ts:147-153`'teki
doğrulama yolu ve `server.ts:216-228`'deki subscription köprüsü dahil. Kendi
spec'ini ve kendi dalını alacak.

**Veritabanındaki token'ları şifrelemek.** `users.access_token` ve
`users.refresh_token` bugün düz metin. Ayrı bir iş; bu spec kopya sayısını
azaltıyor, saklama biçimini değiştirmiyor.

**Mevcut refresh token'ları iptal etmek.** Sızıntı varsayımıyla hareket etmeyi
gerektirir ve her kullanıcıyı yeniden login'e zorlar. Bu spec bunu yapmıyor.

---

## 9. Kabul kriterleri

1. `grep -rn "accessToken\|refreshToken" backend/src/queues backend/src/workers backend/src/services/user-killmail-cron.ts` yalnızca
   `user-credentials.ts` üzerinden geçen kullanımları gösterir; publish edilen
   hiçbir mesaj gövdesinde token alanı kalmaz.
2. İki kuyruk da aynı `KillmailSyncMessage` şeklini kullanır, tek yerde tanımlı.
3. Token yenileme mantığı tek bir dosyada; iki worker'da kopyası kalmaz.
4. `yarn test`, `yarn workspace backend build`, `prettier --check` temiz.
5. `backend/docs/ops/rabbitmq.md` purge adımını ve yayına alma sırasını içerir.
