# ESI istemcisi ve header'a bakan rate limiter — tasarım

**Tarih:** 2026-10-28
**Durum:** uygulandı (`feat/esi-rate-limiter` dalı)
**İlgili:** #292 (employment history backfill'indeki 429'lar),
`backend/src/services/rate-limiter.ts`, `backend/src/workers/worker-error.ts`

Backend'in ESI'ye giden bütün istekleri tek bir istemciden (`esiClient`)
geçiyor. Limiter da bu istemcinin içine taşınıyor. Sabit bir "saniyede N
istek" tavanı yerine ESI'nin her yanıtta döndüğü header'lara bakıyor:
yavaşlaması ve durması gerektiğini kendisi anlıyor.

Amaç: bir sonraki backfill elle `ESI_MAX_RPS=15` verilmeden bitsin, ve 429
aldıktan sonra arka arkaya yeni 429'lar gelmesin.

---

## 1. Bugünkü durum

2026-10-28'de okundu.

### İstemci yok, 23 dosya ESI'yi kendisi çağırıyor

- ESI'ye giden dosyalar: 17 servis, 3 worker (`worker-bloodlines.ts`,
  `worker-constellations.ts`, `worker-regions.ts`) ve 3 resolver mutation'ı
  (`resolvers/{region,alliance,constellation}/mutations.ts`). 19'u kendi
  `ESI_BASE_URL` sabitini tanımlıyor, 4'ü URL'yi satır içinde yazıyor
  (3 resolver ve `worker-bloodlines.ts:25`).
- İki farklı HTTP kütüphanesi kullanılıyor: 39 yerde `axios.get`, 5 yerde
  `fetch` (`character.service.ts:83,174`, `corporation.service.ts:52,154`,
  `killmail.service.ts:75`, yani `getKillmailDetail`).
  `fetch` kullanan yerler status'u yalnızca hata mesajının metnine yazıyor.
  `worker-error.ts:44-61`'deki `messageHead` fallback'i bunun için var.
- Bu dosyalardan 6'sı limiter'dan hiç geçmiyor: yukarıdaki 3 worker ve 3
  resolver.
- `esiRateLimiter.execute` 37 yerde çağrılıyor, ve her biri bir _istek_
  değil bir _fonksiyon_ sarıyor. Örneğin `TypeService.getTypeIds`
  (`type.service.ts:14-48`) birkaç bin isteklik bir döngünün tamamını tek bir
  `execute` içine almış, limiter bunu tek istek sayıyor.
- ESI isteklerinde `User-Agent` yok. `X-Compatibility-Date` de yok.

### 429 / 420 gelince ne oluyor

- Limiter (`rate-limiter.ts`) yanıtlara hiç bakmıyor. Tek yaptığı istekleri
  `ESI_MAX_RPS` hızında (varsayılan 50, `config.ts:40`) dağıtmak.
- 429 ya da 420 alan mesajı `handleWorkerError` (`worker-error.ts:150-158`)
  60 saniye uyutup requeue ediyor. Bu yalnızca _o mesajı_ durduruyor. Limiter
  aynı hızda dağıtmaya devam ediyor, prefetch 8 ise sekiz mesaj ayrı ayrı
  429 yiyor.
- Servislerin içinde de kendi kafalarına göre beklemeler ve retry'lar var:
  `character.service.ts:74,77,168` (2 sn / 500 ms / 5 sn) ve
  `corporation.service.ts:135,148` (500 ms / 5 sn, `includes('429')`).
- `x-esi-error-limit-remain` yalnızca iki worker'da okunuyor
  (`worker-constellations.ts:34`, `worker-regions.ts:34`), o da 2 saniye
  uyumak için.
- `config.ts:37` ve CLAUDE.md "ESI's own ceiling is 150 req/sec" diyor. Bu
  bilgi yanlış (bkz. §2).

---

## 2. ESI'nin gerçek kuralları

Kaynaklar 2026-10-28'de okundu:
[rate limiting](https://developers.eveonline.com/docs/services/esi/rate-limiting/),
[best practices](https://developers.eveonline.com/docs/services/esi/best-practices/),
`https://esi.evetech.net/meta/openapi.json`.

ESI'de birbirinden ayrı iki limit sistemi var.

### 2.1 Route grubu başına token bucket (yeni sistem)

- OpenAPI'deki 197 operasyonun 135'inde `x-rate-limit` var: bir `group`,
  `max-tokens` ve `window-size` değeri.
- Bir bucket bir _grup_ ve _kimlik_ çiftine ait. Kimlik doğrulanmamış
  isteklerde kimlik kaynak IP. Token'lı isteklerde
  `<applicationID>:<characterID>`.
- Pencere kayan pencere: harcanan token, pencere süresi dolunca kovaya geri
  dönüyor.
- Token maliyeti yanıt koduna göre: 2xx → 2, 3xx → 1, 4xx → 5 (429 hariç),
  5xx → 0.
- Yanıt header'ları: `X-Ratelimit-Group`, `X-Ratelimit-Limit` (`150/15m`
  biçiminde), `X-Ratelimit-Remaining`, `X-Ratelimit-Used`. 429 yanıtında
  `Retry-After` (saniye).
- CCP'nin tavsiyesi: limitin dibinde çalışma, `Remaining` sıfıra yaklaşınca
  yavaşla, istekleri zamana yay.

Bizim kullandığımız gruplu route'lar:

| Route                                     | Grup            | Limit        | Pratikte                        |
| ----------------------------------------- | --------------- | ------------ | ------------------------------- |
| `/killmails/{id}/{hash}`                  | `killmail`      | 3600 / 15 dk | ~2 başarılı istek/sn, IP başına |
| `/characters/{id}/killmails/recent`       | `char-killmail` | 30 / 15 dk   | karakter başına                 |
| `/corporations/{id}/killmails/recent`     | `corp-killmail` | 30 / 15 dk   | karakter başına                 |
| `/sovereignty/{map,campaigns,structures}` | `sovereignty`   | 600 / 15 dk  |                                 |
| `/status`                                 | `status`        | 600 / 15 dk  |                                 |

Killmail detail worker'ı bugünkü 50 req/s'lik tavanla `killmail` bucket'ını
yaklaşık 36 saniyede bitirir.

### 2.2 Error limit (eski sistem)

- Yeni sisteme geçmemiş route'larda dakikada en fazla 100 hatalı yanıta
  (2xx/3xx dışı) izin var. Aşılınca **bütün** ESI route'ları, yeni sistemdekiler
  dahil, 420 döner.
- Header'lar `X-ESI-Error-Limit-Remain` ve `X-ESI-Error-Limit-Reset`
  (pencerenin sıfırlanmasına kalan saniye). Bu header'lar §2.1'deki
  header'larla aynı yanıtta gelmiyor.
- Bu limiti görmezden gelmek ban sebebi.

Bizim yoğun kullandığımız route'ların çoğu bu sistemde: `characters/{id}`,
`characters/{id}/corporationhistory`, `corporations/{id}`, `alliances/*`,
`universe/*`, `markets/prices`.

### 2.3 Header'sız 429

Doküman bazı route'larda "deeper EVE Server limiter" bulunduğunu ve bunun
rate limit header'ları olmadan 429 dönebildiğini söylüyor. #292'de
`corporationhistory` tam olarak bunu yaptı: yaklaşık 20 req/s'nin üstünde
429 geldi, `Retry-After` yoktu. Bu limiterin eşiği yayımlanmış değil.

### 2.4 İstek header'ları

- `User-Agent`: "should". Uygulama adı ve sürümü, ayrıca iletişim bilgisi
  öneriliyor.
- `X-Compatibility-Date`: OpenAPI'de `required: true` ve tek izin verilen
  değer `2020-01-01`. Bugün göndermiyoruz ve istekler çalışıyor.

---

## 3. Hedefler, hedef olmayanlar

### Hedefler

1. Backend'in ESI'ye giden her isteği tek bir `esiClient` üzerinden gider. Bu
   kural bir test ile korunur (§7).
2. Limiter her isteği tek tek sayar, fonksiyon değil.
3. Limiter §2'deki üç sinyali okur ve bunlara göre yavaşlar ya da durur:
   grup bucket'ı, error limit, header'sız 429.
4. 429 ve 420 artık mesaj başına uyumaz. Fren process genelinde çalışır.
5. Her istekte `User-Agent` ve `X-Compatibility-Date` gönderilir.
6. Servislerdeki kendi kafasına göre beklemeler ve retry'lar kaldırılır
   (§1'deki satırlar).
7. Dokümandaki "150 req/sec" bilgisi düzeltilir.

### Hedef olmayanlar

- ETag / `If-None-Match` ile 304 kullanımı ve `Expires`'a uyma. Doküman bunu
  istiyor, ama bu ayrı bir iş.
- Resolver mutation'larındaki ESI listelemesini queue script'ine taşımak.
  CLAUDE.md'ye aykırı olan bu durum ayrı bir PR'da düzelecek. Bu PR yalnızca
  çağrıları `esiClient`'a taşıyor.
- `latest/` path'lerini temizlemek (9 yer).
- zKillboard (`services/zkillboard.ts`) ve EVE SSO (`services/eve-sso.ts`).
  Farklı servisler, farklı limitler.
- Process'ler arasında ortak state (Redis). Gerekçesi §4.4'te.

### Anti-hedefler

- Limiter yavaşlıyor diye hata _sayılmamalı_. 429 ya da 420 alan mesaj
  attempt harcamadan geri dönmeli, aksi halde mesajlar sebepsiz yere
  parking'e düşer.
- Yavaşlayan bir worker sessiz kalmamalı. Her duraklama, sebebi ve süresiyle
  birlikte, bir kez loglanmalı (her istek için değil).
- Bir pause hiçbir zaman sonsuz olmamalı. Header'dan gelen süre bir üst
  sınırla kesilir.

---

## 4. Tasarım

### 4.1 `esiClient` — `backend/src/services/esi-client.ts`

- Tek bir axios instance. `baseURL: 'https://esi.evetech.net'`.
- Sabit header'lar:
  - `User-Agent: KillReport/<sürüm> (+https://github.com/umutyerebakmaz/killreport)`.
    `<sürüm>` `backend/package.json`'dan okunur.
  - `X-Compatibility-Date: 2020-01-01`.
- Dışa açılan yüzey yalnızca `get`. Bugün `backend/src`'de ESI'ye giden
  hiçbir `POST` yok, `/universe/names` yalnızca yorumlarda geçiyor. Yanıt
  axios biçiminde kalır (`data`,
  `status`, `headers`), böylece çağıranlar `response.data` okumaya devam
  eder. Token'lı çağrılar `Authorization` header'ını isteğin kendi
  seçeneklerinde verir.
- Her istek, gönderilmeden önce limiter'dan izin alır. Yanıt geldiğinde
  (başarılı ya da hatalı) header'lar limiter'a bildirilir. Bu iki kanca
  istemcinin içindedir, çağıran hiçbirini görmez.
- Hatalar axios hatası olarak kalır, `response.status` dolu gelir.
  `worker-error.ts`'deki status kontrolü (`throttleStatus`, `isNotFound`)
  ESI için mesaj metnine bakmadan çalışır.

### 4.2 Limiter — `backend/src/services/rate-limiter.ts`

Dosya yerinde kalıyor, içi değişiyor. Dört parçadan oluşuyor:

**a) Taban hız.** Bugünkü dağıtım döngüsü kalıyor: en fazla `ESI_MAX_RPS`
istek/sn, aynı anda en fazla `maxConcurrent` istek. Bu artık yalnızca son
emniyet tavanı.

**b) Process geneli fren.** Tek bir `pausedUntil` zaman damgası. Bu süre
dolana kadar hiçbir istek dağıtılmaz. Şu durumlarda kurulur:

| Sinyal                                   | Fren süresi                            |
| ---------------------------------------- | -------------------------------------- |
| 420                                      | `X-ESI-Error-Limit-Reset`, yoksa 60 sn |
| `X-ESI-Error-Limit-Remain` < 20          | `X-ESI-Error-Limit-Reset`              |
| Header'sız 429 (`X-Ratelimit-Group` yok) | `Retry-After`, yoksa 60 sn             |

Fren süreleri üstte 15 dakika ile kesilir. Fren kurulurken, o andaki
`pausedUntil` daha geç ise daha geç olan kalır.

**c) Uyarlanan hız (header'sız 429 için).** Eşiği bilinmeyen derin limiter'a
karşı. Her header'sız 429'da o anki hız yarıya iner (en az 1 istek/sn).
Yarılama en fazla 10 saniyede bir yapılır ve fren sürerken hiç yapılmaz.
Tırmanış istekler yeniden başlayınca başlar: son yarılama ile fren bitişinden
hangisi geçse ondan sayılır. Ardından her 10 saniyede 1 istek/sn artarak
`ESI_MAX_RPS`'e kadar geri çıkar. (Bu klasik AIMD yöntemi: hata gelince hızı çarpanla düşür,
hata gelmezse yavaş yavaş artır.) #292'de elle bulduğumuz 15 req/s'yi
limiter'ın kendisinin bulmasını sağlayan parça bu.

**d) Grup bucket'ları.** `X-Ratelimit-Group` içeren her yanıttan o grubun
son durumu kaydedilir: `limit`, `window`, `remaining`. Bir isteğin grubu,
istek gönderilmeden önce bilinmek zorunda. Bunun için limiter path şablonunu
grupla eşler. Şablon, sayısal segmentlerin `{id}` ile, killmail hash'inin de
`{hash}` ile değiştirilmesiyle elde edilir. Eşleme ilk yanıttan öğrenilir.
Kimlik doğrulanmış isteklerde bucket karakter başına tutulduğu için anahtar
`grup + token'daki karakter` olur. Bunu limiter, isteğin `Authorization`
header'ından ayırt etmeyi değil, çağıranın verdiği bir `bucketKey`'i
kullanır. (Uygulama ayrıntısı builder'a kalıyor, ama kural bu: farklı
karakterlerin bucket'ı birbirini yavaşlatmaz.)

- `remaining` limitin %20'sinin altına inince o grup için istekler, kalan
  token'lar pencere boyunca yetecek şekilde aralıklandırılır: iki istek
  arasındaki en az süre `window / limit × 2`, yani bucket'ın dolum hızı.
  (İlk taslaktaki `window / (remaining / 2)` formülü, token azaldıkça aralığı
  büyütüyordu ve bir grubu 15 dakikaya kadar durdurabilirdi; bu yüzden
  bırakıldı.)
- `remaining` bir 2xx'in maliyetinin (2) altındaysa istek hiç
  gönderilmez. Limiter bucket'ın dolmasını bekler, yani 429'u almayı
  beklemez. Bu, sayfa sayfa giden çağrılar için gerekli:
  `CharacterService.getCharacterKillmails` ve
  `CorporationService.getCorporationKillmails`, `killmails/recent`'i 50
  sayfaya kadar geziyor. Bucket ise 15 dakikada 30 token, yani yaklaşık 15
  başarılı istek. k'ıncı sayfada 429 alınsaydı 1..k-1 sayfalar boşa gider,
  mesaj baştan başlardı. Önceden beklemekle döngü yalnızca yavaşlar,
  ilerlemeyi kaybetmez. (ESI token'ların ne zaman döneceğini söylemiyor;
  bekleme süresi `window / limit × 2` ile tahmin edilir ve yeni yanıtla
  düzeltilir.)
- Gruplu 429 (`X-Ratelimit-Group` var): yalnızca o grup `Retry-After`
  süresince durur, diğer gruplar ve gruplu olmayan route'lar devam eder.

### 4.3 Throttled istek ne olur

- `esiClient` 429 ya da 420 alınca isteği kendisi tekrar _denemez_. Hatayı
  çağırana iletir, limiter'a da freni kurdurur.
- `handleWorkerError` (`worker-error.ts:150-158`) böyle bir hatada artık 60
  saniye uyumaz. Mesajı hemen, attempt harcamadan requeue eder. Mesaj geri
  geldiğinde limiter freninde bekler.
- Bunun bir istisnası var. zKillboard'un kendi 429'u `esiClient`'tan
  gelmiyor ve fren onu yavaşlatmıyor. `worker-zkillboard-sync.ts` de
  `handleWorkerError` kullanıyor. Bu yüzden 60 saniyelik uyku, `esiClient`'tan
  _gelmeyen_ throttle hataları için kalıyor. Ayırt etmek için `esiClient`
  hatayı işaretler (bir alan ya da bir hata sınıfı, builder'ın seçimi).
  Böylece ESI dışındaki 429'lar kendi başlarına bir hot loop'a girmez.
- Hataları tek tek yutan liste döngüleri throttle hatasını yutmaz, yukarı
  fırlatır. Örneğin `TypeService.getTypeIds` (`type.service.ts:28-45`) her
  grubun hatasını loglayıp devam ediyor. Bu döngü throttle hatasını da
  yutarsa, liste sessizce eksik döner. Throttle hatası çağıranı durdurur;
  liste bir sonraki çalıştırmada eksiksiz alınır. Hangi döngülerin bu
  durumda olduğunu taşıma sırasında builder belirler. Ölçüt: `catch` içinde
  `continue` eden ve ESI çağıran her döngü.

### 4.4 Çağırana göre bekleme süresi

`esiClient` yalnızca queue worker'larından çağrılmıyor:

| Çağıran                                                                                                                                                                                      | Davranış                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Queue worker'ları (`handleWorkerError` kullananlar)                                                                                                                                          | Fren süresince bekler.                                                                                      |
| API sunucusu (`resolvers/*/mutations.ts`)                                                                                                                                                    | En fazla 10 sn bekler. Daha uzun bir fren varsa hemen throttle hatası döner, GraphQL hata olarak iletir.    |
| Canlı akış (`worker-redisq-stream.ts:306` ve enrichment çağrıları)                                                                                                                           | En fazla 10 sn bekler, sonra throttle hatası. Akış o killmail'i bugünkü hata yolundan işler.                |
| Cron'la çalışan, `handleWorkerError` kullanmayan worker'lar (`worker-sovereignty-*`, `worker-factions`, `worker-races`, `worker-bloodlines`, `worker-system-activity`, `worker-*-snapshots`) | Fren süresince bekler. Bir sonraki cron tetiklemesi PM2'nin restart'ı; çakışma olmaz, süreç yeniden başlar. |

Bunun için `esiClient` bir `maxWaitMs` seçeneği alır. Varsayılan sınırsızdır,
API sunucusu ve canlı akış 10.000 verir. Fren, `maxWaitMs`'i aşacaksa istek
hiç gönderilmeden throttle hatası döner. `maxWaitMs` yalnızca yeni gelen
istekleri değil, fren kurulduğunda kuyrukta zaten bekleyen çağıranları da
sınırlar: onlar da süre dolunca throttle hatası alır. Bu hata da §4.3'teki işaretli hata
türünden olur.

### 4.5 Birden çok process

Limiter process başına çalışıyor, ama ESI'nin bucket'ları ve error limit'i
IP başına tutuluyor. Bu sorun değil: her yanıttaki `X-Ratelimit-Remaining`
ve `X-ESI-Error-Limit-Remain`, o IP'deki **bütün process'lerin ortak
harcamasını** gösteriyor. Dolayısıyla her process, diğerlerinin ne harcadığını
bir sonraki yanıtta görüyor. Redis'te ortak state'e gerek yok.

Header'sız 429'da ise her process kendi hızını ayrı ayrı yarıya indirir. Bu
da toplam hızı düşürür, ki istenen budur.

Bu bir çıkarım, doküman açıkça yazmıyor. §7'deki gerçek çalıştırmada iki
worker aynı anda çalıştırılarak kontrol edilir.

---

## 5. Taşıma

Hepsi aynı PR'da (uniformity, kullanıcının kararı):

- 17 servis, 3 worker ve 3 resolver `esiClient`'a taşınır. Her dosyadaki
  `ESI_BASE_URL` sabiti silinir.
- 5 `fetch` çağrısı axios'a geçer. Çağıranın sonucu değişmez: 404'ün "sayfa
  bitti" anlamı korunur. `killmail.service.ts:75` (`getKillmailDetail`) en
  yoğun kullanılan route, canlı akış da bunu kullanıyor.
- 37 `esiRateLimiter.execute` sarmalayıcısı kaldırılır. Bu zorunlu: dış
  sarmalayıcı bir slot tutarken içerideki `esiClient` isteği de slot
  isterse, `maxConcurrent` dolduğunda bütün istekler birbirini bekler
  (deadlock).
- §1'deki kendi kafasına göre beklemeler ve retry'lar silinir:
  `character.service.ts:74,77,168`, `corporation.service.ts:135-150`,
  `worker-constellations.ts:34-40`, `worker-regions.ts:34-40`.
- `config.ts:37-40`: `ESI_MAX_RPS` varsayılanı 50'de kalır, ama anlamı
  değişir: artık uyarlanan hızın çıkabileceği tavan bu. Yorum buna göre
  düzeltilir, "150 req/sec" bilgisi kalkar. `ESI_PREFETCH` aynı kalır.
  (Kullanıcının kararı, 2026-10-28: varsayılanı 15'e indirmek, uyarlanan
  hızı 15'in altına hapsederdi.)
- `worker-error.ts`'deki mesaj metni fallback'i silinmiyor: zKillboard hâlâ
  `fetch` kullanıyor.

---

## 6. Dokümanlar

- CLAUDE.md, "Rate limiting" bölümü: "ESI allows 150 req/sec" bilgisi
  kalkar. Yerine §2'nin özeti (iki sistem, header'lar) ve yeni kural gelir:
  "ESI'ye her istek `esiClient` üzerinden gider." "Every worker copies the
  same error handling" paragrafı da yeni davranışa göre güncellenir.
- `rate-limiter.ts:2-8`'deki başlık yorumu da aynı "150 requests per
  second" bilgisini içeriyor, o da düzeltilir.
- `backend/docs/` altında 50 req/sec'e ve `esiRateLimiter.execute`'a
  değinen dosyalar: `ops/universe-topology-run.md`,
  `workers/alliance-corporation.md`, `redis-cache/redisq-stream.md`,
  `esi/esi-user-killmails-queue.md`, `workers/type-enrichment-workers.md`,
  `workers/character-corporation-history.md`,
  `workers/alliance-corporation-character-enrichment.md`,
  `workers/worker-documentation.md`.
- Dokümanlar İngilizce kalır.

---

## 7. Doğrulama

**Birim testleri** (`rate-limiter.spec.ts` genişler, `esi-client.spec.ts`
yeni). Fake timer ve mock yanıtlarla:

- 420 → `Reset` süresi kadar hiçbir istek dağıtılmaz.
- `Error-Limit-Remain` 19 → fren kurulur, 20 → kurulmaz.
- Header'sız 429 → hız yarıya iner, 10 sn'lik adımlarla geri çıkar.
- Gruplu 429 → yalnızca o grup durur, başka bir grup devam eder.
- `remaining` %20'nin altında → istekler arası süre formüle uyar.
- Fren süresi 15 dakikayla kesilir.
- `esiClient` her istekte `User-Agent` ve `X-Compatibility-Date` gönderir.
- `handleWorkerError`: `esiClient`'tan gelen 429 uyumadan requeue edilir,
  ESI dışından gelen 429 60 sn uyur. İkisi de attempt harcamaz.

**Koruma testi:** `backend/src` altında, spec ve generated dosyalar dışında,
`esi.evetech.net` yalnızca `esi-client.ts`'de geçer. Yorumlar da buna
dahil. `worker-bloodlines.ts:4`'teki yorum taşıma sırasında düzeltilir.

Ayrıca: `maxWaitMs` aşılınca istek gönderilmeden throttle hatası dönüyor;
`remaining` < 2 iken gruplu istek gönderilmiyor, bekleniyor; `getTypeIds`
benzeri bir döngü throttle hatasını yutmuyor.

**Gerçek çalıştırma:** `ESI_MAX_RPS` verilmeden, birkaç bin mesajlık bir
`esi_character_corporation_history_queue` çalıştırması. Ölçülecekler: kaç
429 geldi, ardışık 429 dizisi oldu mu, limiter 50'den başlayıp hangi hıza
oturdu (beklenen: #292'deki ~15-20 req/s civarı). §4.5 için
aynı anda ikinci bir ESI worker'ı çalıştırılır.

Bunun yanında CLAUDE.md'deki tablo: logic değiştiği için `test` ve `build`.

---

## 8. Sonraya kalanlar

- ETag / 304 ve `Expires`.
- Resolver'lardaki ESI listelemesini queue script'lerine taşımak.
- `latest/` path'leri.
- Grup eşlemesini OpenAPI'deki `x-rate-limit`'ten önceden yüklemek. Bu PR
  eşlemeyi ilk yanıttan öğreniyor, yani her grubun ilk isteği korumasız
  gidiyor. Tek istek olduğu için sorun değil.

---

## 9. Benim kararlarım (kontrol için)

- `User-Agent`'taki sürüm `backend/package.json`'dan okunur.
- `X-Compatibility-Date: 2020-01-01` sabit gönderilir.
- Error-limit eşiği 20. Bugün iki worker'ın kullandığı değer bu.
- Fren üst sınırı 15 dakika, en uzun bucket penceresi.
- AIMD'nin parametreleri: hız yarıya iner (en fazla 10 sn'de bir, fren
  sürerken hiç); tırmanış istekler yeniden başlayınca, yani son yarılama ve
  fren bitişinden hangisi geçse ondan başlar ve her 10 sn'de +1 req/sn artar.
- Gruplu yavaşlama aralığı `window / limit × 2` (§4.2d).
- `maxWaitMs`, fren kurulduğunda kuyrukta bekleyenleri de sınırlar (§4.4).
- Gruplu yavaşlama eşiği %20.
- `esiClient` 429'u kendisi tekrar denemez, mesaj requeue edilir.
- Limiter `rate-limiter.ts`'de kalır, yeni dosya yalnızca `esi-client.ts`.
- Gruplu route'larda `remaining` < 2 iken istek gönderilmez, bucket
  beklenir (§4.2d). Sayfa sayfa giden killmail çağrıları ilerlemeyi
  kaybetmesin diye.
- API sunucusu ve canlı akış frende en fazla 10 sn bekler, sonra throttle
  hatası alır; worker'lar fren boyunca bekler (§4.4).
- Hataları yutan liste döngüleri throttle hatasını yutmaz (§4.3).
