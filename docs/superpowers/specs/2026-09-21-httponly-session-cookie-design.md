# Oturum httpOnly çerezde, refresh token tarayıcıdan çıksın — tasarım

**Tarih:** 2026-09-21
**Durum:** inceleme bekliyor
**İlgili:** #238 (kuyruk mesajı kimlik bilgisi taşımasın), #239 (corporation sync tetikleyicisi)

EVE SSO refresh token'ı bugün tarayıcıda `localStorage`'da duruyor ve oraya bir
yönlendirmenin URL'i üzerinden gidiyor. Bu spec onu tarayıcıdan tamamen
çıkarıyor: yenileme yetkisi `HttpOnly` bir çerezde taşınır, çerezin arkasında
iptal edilebilir bir `sessions` satırı durur, ve kimlik bilgisinin tek nüshası
veritabanında kalır.

---

## 1. Bugünkü durum, ölçülmüş

2026-09-21'de `backend/src` ve `frontend/src` üzerinde okundu.

**Canlı login yolu mutation değil, HTTP handler.** `AuthButton.tsx` `login`
mutation'ıyla SSO URL'ini alıyor, EVE `/auth/callback`'e dönüyor
(`backend/src/server.ts:187-188`), ve `handlers/auth-callback.handler.ts` işi
bitiriyor. `authenticateWithCode` mutation'ını frontend hiç çağırmıyor —
`frontend/src/graphql/Auth.graphql` yalnızca `RefreshToken` tanımlıyor ve
`authenticateWithCode` frontend'de sadece `generated/graphql.ts`'te geçiyor.

**Refresh token bir URL'de yolculuk ediyor.** `auth-callback.handler.ts:67-79`:

```ts
const params = new URLSearchParams({
  token: tokenData.access_token,
  refresh_token: tokenData.refresh_token || '',
  expires_in: tokenData.expires_in.toString(),
  character_name: character.characterName,
  character_id: character.characterId.toString(),
});
res.writeHead(302, { Location: `${frontendUrl}/auth/success?${params}` });
```

Bu URL, frontend'i sunan ne varsa onun access log'una tam hâliyle yazılır ve
tarayıcı geçmişinde kalır. Kimsenin kasıtlı olarak koymadığı iki yer.

**Tarayıcı dört anahtar tutuyor.** `auth/success/page.tsx:28-43`
`eve_access_token`, `eve_refresh_token`, `eve_token_expiry` ve `eve_user`'ı
yazıyor; `lib/apolloClient.ts:29` ve `hooks/useAuth.ts:18` refresh token'ı
`refreshToken(refreshToken: String!)` mutation'ına argüman olarak veriyor
(`backend/src/schemas/Auth.graphql:22`). `app/privacy/page.tsx:193-205` bu dört
anahtarı kullanıcıya listeliyor.

**Oturum, EVE'in token çiftinin kendisi.** `services/eve-sso.ts:63-64` gelen
token'ı EVE'in JWKS'ine karşı doğruluyor; uygulama kendi JWT'sini üretmiyor.
`server.ts:147-153` Bearer'ı bununla çözüyor, `server.ts:216-228` aynı token'ı
subscription'ların `connectionParams`'ından header'a köprülüyor.

**Etki alanı dar, ve bu tasarımın ölçeğini belirliyor.** İstenen scope'lar
(`config/config.ts:94-101`): `publicData`, killmail okuma, corporation killmail
okuma, fitting okuma, **fitting yazma**, madalya okuma. Çalınmış bir token'la ISK
taşınamaz, varlık hareket ettirilemez, kontrat açılamaz. En kötü gerçekçi sonuç,
birinin özel fit'leri görmesi ve fitting listesine çöp yazması.

**Bir şey bugün olmuyor.** EVE SSO şu anda refresh token'ı **döndürmüyor**;
resmî doküman rotasyonun ileride, native uygulamalar için açılacağını söylüyor.
Yani "tarayıcıdaki kopya eskiyip kullanıcıyı düşürüyor" diye bir arıza bugün
yok. Bu spec'in gerekçesi rotasyon değil, kimlik bilgisinin URL'de ve
`localStorage`'da bulunması.

---

## 2. Sınır: Bearer akışına dokunulmuyor

Tarayıcı EVE access token'ını göndermeye devam eder, `server.ts:147-153` onu yine
`verifyToken` ile doğrular, subscription köprüsü aynı kalır, `me` aynı kalır.
Access token `localStorage`'da kalır — ömrü EVE'in verdiği `expires_in` kadar
(bugün 20 dakika), yani dar ve kendiliğinden ölen bir hedef.

Değişen tek mekanizma **yenileme**. Bu sınır kasıtlı: değişikliği tek bir soruna
odaklı tutuyor ve subscription auth'u gibi çalışan bir yeri riske atmıyor.

---

## 3. Çerez

32 bayt kriptografik rastgele değer, base64url. Çerez öznitelikleri:

```
HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

`Max-Age` olmadan çerez oturum çerezi olur ve tarayıcı kapanınca ölür — 30 günlük
kayan bir oturumun tarayıcı tarafı da kaymak zorunda, o yüzden her başarılı
`refreshSession` çerezi aynı değerle ve taze bir `Max-Age` ile yeniden yazar.
Değer değişmez, yalnızca ömrü uzar; yani `token_hash` sabit kalır.

Host-only — `Domain` verilmez. Prod'da çerezi `api.killreport.com` yazar ve
yalnızca ona geri gider; `killreport.com` sayfaları onu hiç görmez. Dev'de
`localhost` — çerezler port ayırmadığı için `:3000` ile `:4000` aynı host sayılır.

`Secure`, `config.app.isProduction` ile koşullu: dev HTTP üzerinde çalışıyor ve
`Secure` bir çerez oraya yazılmaz.

**`SameSite=Lax` her iki ortamda da yeterli, `None` gerekmiyor.** SameSite
origin'e değil kayıtlı alan adına bakıyor: `killreport.com` ile
`api.killreport.com` aynı site; dev'de ikisi de `localhost`. Bu aynı zamanda
CSRF cevabı — çapraz siteden gelen bir POST çerezi taşımaz, ve GraphQL'in
`application/json` POST'u zaten preflight gerektirdiği için CORS'tan da geçemez.

**İmza yerine özet.** Çerezin değeri tabloda `SHA-256` özeti olarak saklanır,
ham hâli yalnızca tarayıcıda durur. Tablo geldiği anda imzanın işi kalmıyor —
yetkiyi veren şey artık satırın kendisi. Özet, veritabanı sızarsa oradaki
değerlerle hiçbir oturumun açılamaması demek; imzalı JWT'de sır sızarsa herkesin
oturumu üretilebilirdi.

---

## 4. `sessions` tablosu

`backend/prisma/schema/session.prisma`, tek model, dosya adı camelCase — mevcut
düzen (`user.prisma`, `solarSystem.prisma`).

```prisma
model Session {
  id           String    @id @default(uuid())
  token_hash   String    @unique
  user_id      Int
  user         User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  created_at   DateTime  @default(now())
  last_seen_at DateTime  @default(now())
  expires_at   DateTime
  user_agent   String?
  ip           String?
  revoked_at   DateTime?

  @@index([user_id])
  @@index([expires_at])
  @@map("sessions")
}
```

`User` modeline karşı taraf eklenir: `sessions Session[]`.

**Ömür: 30 gün, kayan.** Her başarılı kullanımda `expires_at` 30 gün ileri
alınır ve `last_seen_at` güncellenir. Düzenli giren kullanıcı hiç çıkış yapmaz;
bir ay uğramayan düşer. Bugün oturum pratikte sınırsız, yani bu ilk kez bir
sınır koyuyor.

Bir oturum şu üç durumda geçersizdir: satır yok, `revoked_at` dolu, ya da
`expires_at` geçmiş.

### Migration — işin en riskli parçası

`prisma migrate dev` bu repoda **çalıştırılamaz**: `killmail_filters`,
`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` ve
`refresh_log` şemada yok ama veritabanında var, ve Prisma beşini de drop etmeyi
teklif eder. Elle süreç, CLAUDE.md'nin _Database migrations_ bölümündeki
adımlarla birebir:

1. Beş tablonun satır sayılarını `psql` ile kaydet.
2. `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema --script > /tmp/diff.sql`
3. `grep -n "^DROP" /tmp/diff.sql` — o beş tabloya ait her `DROP TABLE` silinir.
4. Kalanı `prisma/migrations/<timestamp>_add_sessions/migration.sql` olarak yaz;
   `grep -n "^[^-]*DROP"` boş dönmeli.
5. `npx prisma migrate deploy && npx prisma generate`
6. Satır sayılarını tekrar al; hiçbiri azalmamalı.

Beklenen DDL tek `CREATE TABLE` ve iki index. Bundan fazlası çıkarsa dur ve sor.

### Süresi geçmiş satırlar

Temizlik için ayrı bir worker ya da cron **yok**. Geçersiz satır zaten kimseyi
içeri almıyor; birikme sorunu olursa `backend/docs/ops/crontab.md`'ye tek satırlık
bir `DELETE` eklenir. Bugün olmayan bir sorun için mekanizma kurmuyoruz.

---

## 5. GraphQL yüzeyi

`backend/src/schemas/Auth.graphql`:

```graphql
type AuthPayload {
  accessToken: String! # EVE access token — Bearer olarak kullanılır
  expiresIn: Int!
  user: User!
}

type Session {
  id: ID!
  createdAt: String!
  lastSeenAt: String!
  expiresAt: String!
  userAgent: String
  ip: String
  current: Boolean!
}

extend type Query {
  mySessions: [Session!]!
}

extend type Mutation {
  refreshSession: AuthPayload!
  logout: Boolean!
  revokeSession(id: ID!): Boolean!
}
```

Kalkanlar: `AuthPayload.refreshToken` alanı, `refreshToken(refreshToken: String!)`
mutation'ı, ve `authenticateWithCode` mutation'ı.

- **`refreshSession`** — argüman almaz. Çerezi okur, oturumu doğrular,
  `last_seen_at` ve `expires_at`'i kaydırır, çerezi taze `Max-Age` ile yeniden
  yazar, kullanıcının EVE token'ını gerekirse tazeler ve taze access token'ı
  döner. Çerez yoksa ya da oturum geçersizse `UNAUTHENTICATED` hatası verir.
- **`logout`** — oturumu `revoked_at` ile kapatır ve çerezi siler.
- **`revokeSession(id)`** — yalnızca çağıran kullanıcının kendi oturumunu
  kapatabilir; başkasının id'si `false` döner, bulunamadı gibi davranır.
- **`mySessions`** — cihaz listesi. `current`, isteği taşıyan çerezin oturumunu
  işaretler.

### EVE token'ını tazeleme

`refreshSession`'ın içi yeniden yazılmaz: #238'de gelen
`services/user-credentials.ts` zaten "kullanıcıyı oku, beş dakikalık tamponun
içindeyse yenile, yenisini yaz, geçerli access token'ı dön" işini yapıyor. Tek
fark, o servisin `prisma-worker` istemcisini kullanması — resolver tarafı
`prisma` kullanmak zorunda (havuz sınırı, CLAUDE.md _Two Prisma clients_).

Çözüm, servisi istemciden bağımsız hâle getirmek: `loadUserCredentials(userId,
client)` imzası alır, worker'lar `prismaWorker`'ı, resolver `prisma`'yı geçer.
İki çağıran da bugünkü davranışı korur; ikinci bir kopya çıkmaz.

---

## 6. Çerezi okumak ve yazmak

Yoga 5.21.2 kullanılıyor ve projede çerez eklentisi yok. Yeni bağımlılık
eklemiyoruz; iki yerde ihtiyaç var ve ikisi de küçük:

- **Yazma, callback'te** — düz Node `http`. `res.writeHead(302, { 'Set-Cookie':
..., Location: ... })`. Eklenti gerekmez.
- **Okuma ve yazma, GraphQL'de** — context'e `request.headers.get('cookie')`'den
  ayrıştırılmış değer konur; çerez yazması gereken alanlar — `refreshSession`
  ömrü kaydırmak için, `logout` silmek için — context'teki bir toplayıcıya yazar,
  bir Yoga `onResponse` eklentisi bunu `Set-Cookie` olarak basar.

Ayrıştırma ve serileştirme `backend/src/services/session-cookie.ts` içinde saf
fonksiyonlar olarak durur: `parseCookieHeader`, `serializeSessionCookie`,
`clearSessionCookie`. Saf oldukları için mock'suz test edilirler — emsal
`services/queue-health.ts`, ki #237'de tam bu sebeple oraya taşınmıştı.

---

## 7. Callback

`handlers/auth-callback.handler.ts` bugünkü upsert'ünü korur, sonra:

1. 32 bayt rastgele üretir, özetini `sessions`'a yazar (`user_agent` ve `ip`
   istek başlıklarından).
2. Çerezi `Set-Cookie` ile yazar.
3. **Query string olmadan** `${frontendUrl}/auth/success` adresine yönlendirir.

Token'ın log'a ve geçmişe düşmesi burada biter.

`ip` için `x-forwarded-for`'un ilk değeri kullanılır — `server.ts:136-140` aynı
şeyi analytics için zaten yapıyor.

---

## 8. Frontend

- **`app/auth/success/page.tsx`** — URL'den okumayı bırakır. `refreshSession`
  çağırır, dönen access token'ı ve kullanıcıyı `localStorage`'a yazar, ana
  sayfaya yönlendirir. Hata hâlinde bugünkü hata ekranı korunur.
- **`lib/apolloClient.ts`** — `refreshAccessToken` argümansız `refreshSession`
  çağırır; `eve_refresh_token` okuması ve yazması silinir. `HttpLink`'in
  `credentials` ayarı `'same-origin'`den **`'include'`** olur (satır 92) —
  bu olmadan çerez çapraz origin'de hiç gitmez.
- **`hooks/useAuth.ts`** — aynı sadeleşme; `logout` artık `logout` mutation'ını
  çağırıp sonra `localStorage`'ı temizler.
- **`app/privacy/page.tsx:193-205`** — `eve_refresh_token` satırı kalkar, kalan
  üç anahtarın açıklaması güncellenir. Kullanıcıya ne sakladığımızı anlatan yer
  burası; yanlış kalması kabul edilemez.
- **`graphql/Auth.graphql`** — `RefreshToken` dokümanı `RefreshSession` olur,
  `MySessions`, `Logout` ve `RevokeSession` eklenir. Backend codegen'i **önce**
  çalışır, sonra frontend codegen'i.

Cihaz listesi ekranı bu spec'e **dahil değil**: `mySessions` ve `revokeSession`
API'si kurulur, onları gösteren arayüz ayrı bir iş. Sebebi, görsel işin kendi
tasarım turunu hak etmesi.

---

## 9. CORS — bunu bozabilecek tek yer

`server.ts:60-88`'de dev tarafı `origin: '*'` ile `credentials: true`
kullanıyor. Bu kombinasyon çerezle **geçersiz**: tarayıcı `Access-Control-Allow-Origin:
*` gördüğünde kimlik bilgisi taşıyan isteği reddeder. Dev de prod gibi açık bir
listeye geçer; liste `http://localhost:3000` ve `FRONTEND_URL`'i içerir, gelen
`Origin` listeyle eşleşirse aynen yansıtılır.

`allowedHeaders` değişmez — çerez bir header izni gerektirmiyor.

---

## 10. Test

`backend/src/services/session-cookie.spec.ts` — saf fonksiyonlar, mock yok:
ayrıştırma (birden çok çerez, boşluk, eksik başlık), serileştirme (prod'da
`Secure` var, dev'de yok; `HttpOnly`, `SameSite=Lax`, `Path`, `Max-Age`), ve
temizleme çerezinin geçmiş tarihli olması.

`backend/src/services/session.spec.ts` — oturum yaşam döngüsü kararları saf
fonksiyon olarak: `sessionState(row, now)` → `valid` | `expired` | `revoked` |
`missing`, ve `slidExpiry(now)`. Emsal #237'deki `skipReason`.

Veritabanına ve çereze dokunan kısımlar (`refreshSession`, `logout`,
`revokeSession`) `prisma` mock'lanarak test edilir; emsal
`services/user-credentials.spec.ts`.

`loadUserCredentials`'ın istemci parametresi alması mevcut testlerini bozmamalı
— o dosyanın testleri de yeni imzaya göre güncellenir.

---

## 11. Geçiş

Deploy anında herkesin `localStorage`'ında eski anahtarlar var ve
`refreshToken(refreshToken:)` mutation'ı kalkmış oluyor. Geriye dönük uyumluluk
katmanı **yazılmıyor**: kullanıcı bir kez yeniden giriş yapar, ve uygulamaya
zaten yetki verdiği için bu genellikle tek tık ve sessiz geçer. Bir shim, tam da
kaldırmaya çalıştığımız yolu bir süre daha açık tutardı.

`auth/success` sayfası, URL'de eski parametrelerle gelirse onları görmezden
gelir — eski bir sekmeden dönen kullanıcı hata almaz, `refreshSession`'a düşer.

---

## 12. Kapsam dışı

- **Cihaz listesi arayüzü.** API kuruluyor, ekran ayrı iş.
- **Veritabanındaki token'ların şifrelenmesi.** `users.access_token` ve
  `users.refresh_token` düz metin kalır; bu spec nüsha sayısını azaltıyor,
  saklama biçimini değiştirmiyor.
- **Mevcut EVE token'larının iptali.** Sızıntı varsayımı gerektirir; yapılmıyor.
- **Access token'ı bellekte tutmak.** Değerlendirildi ve seçilmedi: her sayfa
  yüklemesinde bir tazeleme turu ve yeni bir "oturum belirleniyor" durumu
  getiriyor, kazancı ise 20 dakikalık bir token.
- **#239, corporation sync tetikleyicisi.** Bu spec `authenticateWithCode`'u
  silerken içindeki iki kuyruk publish'i de gidiyor — ikisi de zaten hiç
  çalışmıyordu. Tetikleyicinin cron'a eklenmesi #239'un işi.

---

## 13. Kabul kriterleri

1. `grep -rn "eve_refresh_token" frontend/src` boş döner.
2. Callback'in yönlendirdiği URL query string içermez.
3. `AuthPayload`'da `refreshToken` alanı yoktur; şema ve generated dosyalar
   codegen ile tutarlıdır.
4. Çerez `HttpOnly`, `SameSite=Lax` ve 30 günlük `Max-Age` taşır, prod'da
   `Secure` ekler; `refreshSession` `Max-Age`'i kaydırır.
5. `sessions` tablosu oluşmuştur ve migration'da hiçbir `DROP` yoktur; beş
   korunan tablonun satır sayıları değişmemiştir.
6. `mySessions` çağıran kullanıcının oturumlarını döner, `revokeSession`
   başkasının oturumunu kapatamaz.
7. `yarn test`, `yarn workspace backend build`, `yarn workspace frontend lint`,
   `yarn workspace frontend build`, `prettier --check` temiz.
