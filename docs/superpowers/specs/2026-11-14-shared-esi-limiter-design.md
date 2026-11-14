# Merkezi ESI limiter — tasarım

**Tarih:** 2026-11-14
**Durum:** onaylandı ve uygulandı (2026-11-14)
**Değiştirdiği karar:** `2026-10-28-esi-rate-limiter-design.md` §3 "Process'ler
arasında ortak state (Redis)" hedef olmayanı ve §4.5 "Birden çok process".

---

## 1. Neden

Bugün her süreç (`server.ts`, `worker-redisq-stream`, her Node worker'ı, her
Rust worker'ı, her queue script'i) limiter'ın kendi kopyasını taşıyor. Kurallar
doğru, ama her süreç onları **yalnız başına** uyguluyor. 2026-10-28 spec'i
bunun sorun olmadığını, ESI'nin yanıt header'ları bütün süreçlerin ortak
harcamasını gösterdiği için her sürecin diğerlerini dolaylı olarak gördüğünü
varsaymıştı (§4.5, "Bu bir çıkarım"). Bu varsayım üç yerde tutmuyor:

1. **En yoğun route'lar token header'ı göndermiyor.** `characters/{id}`,
   `corporationhistory`, `corporations/{id}`, `alliances/*`, `universe/*` eski
   error-limit sisteminde (2026-10-28 §2.2). Bu yanıtlar yalnızca kalan hata
   hakkını bildiriyor. Bir süreç diğerinin kaç istek attığını göremiyor,
   ancak hata oluşunca fark ediyor.
2. **Header'sız 429 süreç başına öğreniliyor.** `corporationhistory`'nin
   arkasındaki derin limiter IP başına ~17-20 req/s'de 429 dönüyor
   (`rate-limiter.ts:15-16`). Üç süreç bu eşiği ayrı ayrı, kendi 429'larıyla
   keşfediyor ve her biri 50 req/s'den yeniden başlıyor.
3. **Fren yayılmıyor.** Bir süreç 420 alıp durunca diğerleri istek atmaya
   devam ediyor. O sırada oluşan her hata, bütün route'lar için ortak olan
   dakikada 100 hatalık hakdan düşüyor. Bu limiti aşmak ESI'de ban sebebi
   (2026-10-28 §2.2).

**İstenen:** Uygulamadaki **her** ESI isteği tek bir ortak fren ve hız
bütçesinden geçer. Canlı akış ve kullanıcı istekleri bütçe daraldığında
toplu işlerin önüne geçer.

---

## 2. Hedefler, hedef olmayanlar, anti-hedefler

### Hedefler

1. Fren (420, düşük error limit, header'sız 429) bir süreçte kurulduğunda
   bütün süreçler için kurulur.
2. `ESI_MAX_RPS` süreç başına değil, uygulamanın **toplamı** için tavandır.
   Varsayılan 50 kalır (benim kararım). Bugün hiçbir `.env`'de ya da
   `ecosystem.config.js`'te ayarlı değil, yani her süreç 50 kullanıyor ve
   10 süreçle teorik toplam 500. Ortak tavanda bu 50'ye iner. Pratikte
   gerçek sınır zaten daha düşük: derin limiter ~17-20 req/s'de 429 dönüyor
   ve AIMD oraya oturuyor. Örnek ölçek: 56.589 corporation'lık bir
   `queue:corporations` 50 req/s'de yaklaşık 19 dakika sürer.
3. Header'sız 429'daki hız düşüşü (AIMD) ortak tutulur: bir kez öğrenilir,
   herkese uygulanır, ortak olarak geri tırmanır.
4. Route grubu bucket'ları ve öğrenilen route → grup eşlemesi ortak tutulur.
5. Canlı akış ve kullanıcı istekleri bütçeye dahildir, ama önceliklidir (§4.3).
6. Node ve Rust aynı kuralı çalıştırır. Kural tek bir yerde yazılır.

### Hedef olmayanlar

- ETag / 304 ve `Expires` (2026-10-28 §8'de bekliyor).
- zKillboard ve EVE SSO limitleri. Farklı servisler.
- Resolver mutation'larındaki ESI listelemesini queue script'ine taşımak.
- Redis Cluster ya da birden çok Redis örneği.
- Queue script'lerini ya da başka worker'ları Rust'a taşımak.

### Anti-hedefler

- **Redis'in çökmesi ESI çağrılarını durdurmamalı.** Bu, worker'ların
  birbirinden bağımsız çalışması hedefinin (CLAUDE.md "self-contained at
  runtime") limiter'daki karşılığı.
- Limiter yavaşladı diye mesaj attempt harcamamalı. Bugünkü davranış
  (`EsiThrottledError` → attempt harcamadan requeue) aynen kalır.
- Canlı istek, toplu işlerin bekleyen kuyruğunun arkasında beklememeli.
- Node ve Rust farklı davranmamalı.

---

## 3. Yaklaşımlar

| Yol                                               | Nasıl                                                                                                                                                     | Artısı                                                      | Eksisi                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **A. Redis'te ortak durum, Lua script (seçilen)** | Ortak durum Redis anahtarlarında. Token alma ve header okuma, Redis'in atomik çalıştırdığı Lua script'leriyle. Node ve Rust aynı script dosyasını yükler. | Kural tek yerde. Yeni süreç yok. Redis zaten her yerde var. | Her ESI isteğinden önce bir Redis çağrısı (yerelde < 1 ms).                               |
| B. Ayrı limiter servisi                           | Küçük bir Rust süreci kuralları belleğinde tutar, herkes ona sorar.                                                                                       | Mantık tek dilde.                                           | PM2'de yeni süreç. Yeniden başlarsa öğrenilen durum kaybolur. Yerel dönüş yine yazılmalı. |
| C. ESI proxy                                      | Bütün ESI istekleri tek bir proxy'den geçer.                                                                                                              | Node ve Rust'ta limiter kodu kalkar.                        | Proxy çökerse canlı akış dahil her şey durur. İzolasyon hedefine ters.                    |

**Neden A:** Kullanıcı seçti. Redis'e ulaşılamazsa yerel limiter'a dönüş
(§4.6) izolasyonu korur. Lua, Redis'te birden çok adımı bölünmeden
yapmanın yerleşik yoludur: `MULTI`/`WATCH` çakışmada baştan dener ve
tam yoğun anda tekrar denemeye boğulur, basit `INCR` sayacı da taban,
fren ve sürekli dolan kova kurallarını ifade edemez.

---

## 4. Tasarım

### 4.1 Ne Redis'e, ne süreçte kalır

**Redis'e taşınır (ortak):**

| Durum                                                                                                     | Bugün nerede              |
| --------------------------------------------------------------------------------------------------------- | ------------------------- |
| Fren: `pausedUntil`, `pauseStatus`, `pauseKind`                                                           | `rate-limiter.ts:156-158` |
| AIMD: `rateBase`, `loweredAt`                                                                             | `:161-162`                |
| Ortak token kovası (bugün yok, `requestCount`/`windowStart`'ın yerini alır)                               | `:145-146`                |
| Route template → grup eşlemesi                                                                            | `groups`, `:165`          |
| Grup bucket'ları: `limit`, `windowMs`, `remaining`, `updatedAt`, `sentAt`, `nextAllowedAt`, `pausedUntil` | `buckets`, `:166`         |

**Süreçte kalır (yerel):**

- Bekleyen çağıranlar ve uyuma (bugünkü `queue`, `parked`).
- `maxWaitMs` reddi ve `EsiThrottledError` üretimi.
- Süreç başına eşzamanlı istek tavanı (`maxConcurrent`, `inFlight`). Bu bir
  ESI kuralı değil, sürecin kendi soket sınırı.
- Log satırları. "Fren kuruldu" logunu freni **kuran** süreç basar.
- Redis'e ulaşılamazken kullanılan yerel limiter (§4.6).

### 4.2 Lua script'leri

İki script, tek dosyada ya da tek klasörde, Node ve Rust'ın ikisinin de
okuduğu bir yerde. Konum builder'ın kararı. Şart: **tek kopya**. Node dosyayı
çalışma zamanında okur, Rust `include_str!` ile derlemeye gömer. İkisi de
`EVALSHA` kullanır, `NOSCRIPT` gelirse `EVAL` ile yeniden yükler.

**Zaman Redis'ten gelir.** Script'ler `redis.call('TIME')` kullanır. Süreçlerin
saatleri birbirinden kayabilir, Redis'in saati tektir.

**`acquire(class, template, bucketKey, maxRps)`** → `{ granted }` ya da
`{ waitMs, reason }`:

1. Fren kuruluysa → `waitMs = pausedUntil - now`, `reason = brake`.
2. Route'un grubu biliniyorsa ve bucket'ı hazır değilse
   (`max(pausedUntil, nextAllowedAt) > now`) → `waitMs`, `reason = group`.
3. Ortak kovayı doldur: son dolumdan bu yana `currentRate × geçen süre` kadar
   token, en fazla kova kapasitesi kadar.
4. Sınıfa göre kontrol (§4.3). Yetmiyorsa → bir token'ın dolma süresi kadar
   `waitMs`, `reason = rate`.
5. Token düş. Grup bucket'ı varsa `sentAt = now` ve `respace`.
   → `granted`.

**`observe(template, bucketKey, status, group, limit, remaining, errorRemain,
errorReset, retryAfter)`** → `{ paused?: {ms, status, kind}, groupPaused?:
{key, ms} }`:

`rate-limiter.ts`'teki `observe`, `observeGroup`, `pause`, `lowerRate` ve
`respace`'in aynısı, aynı sabitlerle (`ERROR_LIMIT_FLOOR = 20`,
`DEFAULT_PAUSE_MS = 60 s`, `DEEP_LIMIT_PAUSE_MS = 15 s`, `RATE_DECREASE =
0.75`, `MAX_PAUSE_MS = 15 dk`, `RATE_CLIMB_INTERVAL_MS = 10 s`,
`LOW_TOKEN_SHARE = 0.2`, `SUCCESS_TOKEN_COST = 2`). Header'ların parse'ı
(`seconds`, `parseLimit`, boş değerin "değer yok" sayılması) Lua'ya değil,
çağıran tarafa kalır; script sayıları alır. Dönen değer, freni ya da grup
duraklamasını **yeni kuran** sürecin log basması için.

`currentRate` formülü değişmez: `min(maxRps, rateBase + floor((now -
max(loweredAt, pausedUntil)) / 10 s))`.

**Hız düşüşü bütün route'lara uygulanır** (benim kararım). Header'sız bir 429
`corporationhistory`'den gelse bile ortak hız, `universe/*`, `alliances/*`,
kullanıcı istekleri ve redisq dahil herkes için düşer. Bugün de süreç içinde
böyle (`lowerRate`, `rateBase` tek). Derin limiter'ın route başına mı IP
başına mı olduğu yayımlanmış değil; tek route'a özel bir hız, yanlış
tahminde 429 dizisine yol açar. Canlı trafik bu düşüşten de önceliğini
korur: taban (§4.3) düşmüş hızın içinde de canlıya ayrılır.

### 4.3 Öncelik: taban

Kullanıcının kararı: canlı akış ve kullanıcı istekleri bütçeye dahil, ama
öncelikli. %20'lik sabit ayırma reddedildi: canlı trafik sessizken bütçenin
beşte biri boşa gider.

Kural: ortak kova sürekli `currentRate` hızında dolar.

- **Toplu (`bulk`)** istek yalnızca kovada `FLOOR`'un üstünde token varken
  alır: `tokens - 1 >= FLOOR`.
- **Canlı (`live`)** istek kovanın dibine kadar alır: `tokens >= 1`.

`FLOOR = 5` (benim kararım). Toplu işler tabanın üstündeki her token'ı
alır, yani toplam hızdan canlı trafiğin kullandığı kadar eksiğini alırlar.
Kalıcı olarak boş duran pay yok, yalnızca 5 token'lık tampon. Kova kapasitesi
`max(FLOOR + 1, currentRate)`: bir saniyelik patlamaya izin verir (benim
kararım).

**Sınıf kimin?** Bugün `setEsiMaxWait(10_000)` çağıran iki süreç tam olarak
canlı olanlar: `server.ts:308` (kullanıcı istekleri) ve
`worker-redisq-stream.ts:115` (canlı akış). Bu iki yer sınıfı da `live` olarak
ayarlar; varsayılan `bulk`. Rust worker'ları her zaman `bulk`. Ayar süreç
başına, çağrı başına değil (benim kararım: 27 çağıran dosyaya dokunmamak için).

**Fren için kural değişmez:** fren kuruluyken canlı istekler de durur. Canlı
olanlar en fazla 10 sn bekler (bugünkü `maxWaitMs`), toplu olanlar freni
sonuna kadar bekler.

### 4.4 Redis anahtarları

Hepsi `esi-limiter:` önekiyle, küçük harfle:

- `esi-limiter:global` (hash): kova, fren, AIMD.
- `esi-limiter:groups` (hash): template → grup.
- `esi-limiter:bucket:<grup>:<bucketKey>` (hash): grup bucket'ı.

İki kısıt bu öneki zorunlu kılıyor:

- `response-cache.plugin.ts:119` `*<Typename>:<id>*` desenli `KEYS` ile siler.
  Typename büyük harfle başladığı ve Redis `KEYS` büyük-küçük harfe duyarlı
  olduğu için küçük harfli `esi-limiter:` anahtarlarına dokunmaz. Testle
  korunur (§6).
- Grup bucket anahtarlarına TTL konur (`windowMs` + 1 dk), böylece kullanılmayan
  karakter bucket'ları (`char-killmail:<karakter>`) birikmez. `global` ve
  `groups` TTL'siz.

İki checkout farklı `REDIS_URL` veritabanı kullanıyorsa (CLAUDE.md) iki ayrı
bütçe olur. Aynı IP'den çıktıkları için bu yerelde kabul edilir; bilinçli bir
sınır olarak dokümana yazılır.

### 4.5 İstek akışı

```text
esiClient.get(path)
  → limiter.acquire(route, { maxWaitMs })
       loop:
         r = EVALSHA acquire(class, template, bucketKey, maxRps)
         granted        → dön
         waitMs > maxWaitMs kalan süre → EsiThrottledError
         değilse        → min(waitMs, üst sınır) + küçük jitter uyu, tekrar dene
  → fetch
  → limiter.observe(route, status, headers)
       header'ları parse et → EVALSHA observe(...)
       yeni fren / grup duraklaması döndüyse log
  → limiter.release()
```

Bekleyen bir çağıran, Redis'i `waitMs` dolunca yeniden sorar. Uyku `waitMs`'ten
uzun olmaz, böylece başka bir sürecin kurduğu fren en geç bir uyku sonra
görülür. Uyku üst sınırı ve jitter (aynı anda uyanan çağıranların Redis'e
birlikte yüklenmemesi için) builder'ın kararı; makul başlangıç 1 sn ve
0-50 ms.

Süreç içi sıra korunur: aynı süreçte bekleyenler bugünkü gibi sırayla Redis'e
gider, gruplu bekleyen bugünkü `parked` mantığıyla diğer route'ları tıkamaz.

### 4.6 Redis'e ulaşılamazsa

- Script çağrısı kısa bir zaman aşımıyla yapılır (200 ms, benim kararım).
  Hata ya da zaman aşımı → o istek **bugünkü yerel limiter**'dan geçer.
- Süreç "yerel mod"a geçer, bunu bir kez `warn` olarak loglar, 10 sn'de bir
  Redis'i yeniden dener. Bağlantı dönünce bir kez loglar ve ortak moda döner.
- Redis yavaş ama 200 ms içinde cevap veriyorsa süreç yerel moda geçmez; her süreç
  aynı anda tek bir store çağrısı gönderir (çağrı başına 150 ms ile yaklaşık
  6 req/s).
- Yerel modda tavan bugünkü gibi süreç başına `ESI_MAX_RPS`.
- Yerel limiter kodu silinmez; bugünkü `RateLimiter` sınıfı ve Rust
  `limiter.rs` dönüş yolu olarak kalır.

### 4.7 Node ve Rust

- **Node:** `rate-limiter.ts` ortak limiter'ı sarar, yerel limiter dönüş yolu
  olur. `esi-client.ts`'in `acquire / observe / release` arayüzü değişmez,
  yani 27 çağıran dosyaya dokunulmaz. Redis bağlantısı: mevcut `ioredis`
  istemcisi ya da ayrı bir bağlantı; builder seçer, ama limiter'ın cache
  işlemleriyle aynı bağlantıyı paylaşması bir yavaş `KEYS` taramasının
  limiter'ı bekletmesi demek, bu yüzden ayrı bağlantı önerilir.
- **Rust:** `crates/esi` aynı şekilde. `redis` crate'i (tokio, async)
  workspace bağımlılığı olur; bugün `backend-rs`'te Redis'e dair hiçbir şey
  yok. `RateLimiter::from_env` `REDIS_URL`'i `DATABASE_URL` ile aynı yerden
  okur: runner `dotenvy::dotenv()` ile çalışma klasöründeki `.env`'i yükler
  (`crates/runner/src/run.rs:35`) ve `yarn ...:rs` script'leri `backend/`'den
  çalışır, yani `backend/.env`. `REDIS_URL` yoksa varsayılan Node'unkiyle
  aynıdır, `redis://localhost:6379` (`backend/src/config/config.ts:17`);
  böylece iki taraf her durumda aynı veritabanına düşer. Bu eşitlik bir
  testle korunur. Worker'ların koduna dokunulmaz.
- `setEsiMaxWait` yanında sınıfı ayarlayan bir ayar (adı builder'ın),
  `server.ts` ve `worker-redisq-stream.ts`'te `live`.

---

## 5. Taşınacak dokümanlar

- `CLAUDE.md` "Rate limiting": "it is per **process**" cümlesi ve
  `ESI_MAX_RPS` açıklaması ortak tavana göre yeniden yazılır; Redis'e
  ulaşılamazsa yerel moda dönüldüğü eklenir.
- `rate-limiter.ts` ve `limiter.rs` dosya başı yorumlarındaki "per PROCESS"
  paragrafı.
- `2026-10-28-esi-rate-limiter-design.md` §4.5'e tarihli bir not: bu spec'e
  bağlantı.

---

## 6. Doğrulama

**Script testleri, gerçek Redis'e karşı.** CI'da bugün Redis servisi yok
(`.github/workflows/ci.yml:101` yalnızca postgres), eklenir. Aynı senaryo
tablosu Node'da (vitest) ve Rust'ta (`cargo test`) çalışır, böylece iki taraf
aynı sonuçları üretir:

- Bir istemcinin kurduğu 420 freni ikinci istemcinin `acquire`'ını bekletir.
- Header'sız 429 ortak hızı dörtte bir düşürür, 10 sn'lik adımlarla ortak
  geri çıkar; 10 sn içindeki ikinci 429 ikinci kez düşürmez.
- `Error-Limit-Remain` 19 → fren, 20 → fren yok.
- Gruplu 429 yalnızca o grubu durdurur.
- Kovada `FLOOR` token kaldığında `bulk` bekler, `live` alır.
- `FLOOR`'un üstünde token varken ikisi de alır; canlı trafik yokken `bulk`
  toplam hıza ulaşır.
- İki istemci aynı anda yüklenince toplam verilen token, `currentRate ×
süre + kapasite`'yi aşmaz.
- Fren 15 dakikayla kesilir.
- Redis kapalıyken `acquire` yerel limiter'dan geçer ve hata fırlatmaz;
  Redis dönünce ortak moda döner.
- `esi-limiter:` anahtarları `*Killmail:123*` gibi bir invalidate deseniyle
  silinmez.

Mevcut `rate-limiter.spec.ts` ve Rust limiter testleri yerel limiter için
olduğu gibi kalır.

**Gerçek çalıştırma.** Bir Node ve bir Rust ESI worker'ı aynı anda, birkaç
bin mesajlık `esi_character_corporation_history_queue` ile (2026-10-28 §7'deki
koşunun tekrarı). Ölçülecekler: iki sürecin **toplam** hızının tek bir değere
oturması (beklenen ~17-20 req/s, iki katı değil), 429 sayısı, ardışık 429
dizisi. Aynı anda bir kullanıcı ya da redisq isteğinin beklemeden geçtiği.

**Tam set.** Logic değiştiği için `yarn test`, `yarn workspace backend build`,
`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `prettier
--check`.

---

## 7. Benim kararlarım (kontrol için)

- `ESI_MAX_RPS` varsayılanı toplam tavan olarak 50 kalır (§2).
- Header'sız 429'daki hız düşüşü route başına değil, bütün route'lara (§4.2).
- Rust `REDIS_URL`'i `backend/.env`'den okur, varsayılanı Node'unkiyle aynı (§4.7).
- `FLOOR = 5`, kova kapasitesi `max(FLOOR + 1, currentRate)`.
- Sınıf süreç başına, `setEsiMaxWait` çağıran iki yer `live`.
- Zaman Redis'in `TIME`'ından.
- Redis zaman aşımı 200 ms, yerel moddan çıkış denemesi 10 sn'de bir.
- Grup bucket anahtarlarına `windowMs + 1 dk` TTL.
- Limiter için ayrı Redis bağlantısı önerisi.
- Header parse'ı çağıranda, Lua yalnızca sayılarla çalışır.

## 8. Builder'a kalanlar

- Lua dosyasının konumu (tek kopya şartıyla).
- Bekleme döngüsünün uyku üst sınırı ve jitter'ı.
- Sınıf ayarının adı ve şekli.
- Redis bağlantısının kurulumu (ayrı bağlantı önerisiyle).

---

## 9. Sonuçlar (2026-11-14)

Gerçek iki süreçli çalıştırma, yerel RabbitMQ / PostgreSQL / Redis ile.

**Yöntem.** `yarn queue:character-corporation-history` (125.649 mesaj) ve
`yarn queue:corporations` (56.653 mesaj) ile iki kuyruk dolduruldu. Rust
tüketici (`worker-info-corporations`, release exe) 21:21:59'da, Node tüketici
(`worker-character-corporation-history`, prefetch 25) 21:22:23'te başlatıldı;
ikisi de ~4 dk 20 sn birlikte çalıştı, sonra PID ile durduruldu. ESI'ye yalnızca
bu iki worker üzerinden gidildi. Kuyruklarda mesaj artığı bırakıldı, hiçbir şey
silinmedi. Rust worker'ı çalışma sırasında "final" özetini iki kez bastı (5 sn'lik
sessizlik özeti fren sırasında tetikleniyor); hız pencereleri mesaj satırlarını
saydığı için hızlar etkilenmedi. İstek hızı = log'daki başarılı mesaj satırlarının saniye başına
sayısı. Redis'te `esi-limiter:global` anahtarı istekler akmaya başlayınca
göründü: iki süreç de ortak yoldaydı. Hiçbir süreç "Redis unreachable" satırı
basmadı, yerel moda düşülmedi.

**Hız (başarılı mesaj / sn).**

| Pencere (Node saati) | Node | Rust | Toplam | Not                           |
| -------------------- | ---- | ---- | ------ | ----------------------------- |
| Rust tek başına      | -    | ~50  | ~50    | `ESI_MAX_RPS` tavanı          |
| 21:22:25-21:22:42    | 25,2 | 25,0 | 50,2   | iki süreç, ilk fren öncesi    |
| 21:23:13-21:23:40    | 14,3 | 14,0 | 28,3   | AIMD düşüyor (27 req/s)       |
| 21:24:12-21:25:42    | 8,5  | 10,6 | 19,1   | oturmuş kısım (90 sn)         |
| 21:26:00-21:26:30    | 3,0  | 4,4  | 7,5    | 15 sn'lik fren dahil (hız 13) |

**Sonuç.** İki süreç ayrı tavanlar yerine tek bütçeyi böldü: birleşik hız
~50 req/s'de (iki katı olan ~100 değil) başladı ve 429'larla birlikte
`37 -> 27 -> 21 -> 15 -> 18 -> 13 req/s` olarak indi. Oturmuş 90 sn'lik
pencerede toplam 19,1 req/s, yani beklenen ~17-20 aralığında. Toplam her
pencerede iki sürecin toplamı olarak tek bir değere oturdu; süreçlerden biri
ötekinden bağımsız hızlanmadı.

**429.** Altı derin limit (`deep-limit`) freni, hepsini Node süreci kurdu ve
logladı (21:22:42, :57; 21:23:40, :56; 21:25:42, :58). 22 mesaj throttle ile
kuyruğa geri döndü, hiçbiri kaybolmadı ya da hata olarak sayılmadı. Rust
tarafında log'da 429 ya da fren satırı yok, 0 hata; Rust kendi kurmadığı freni
loglamadığı için bu bir çıkarım, doğrudan gözlem değil. Yine de Node'un kurduğu
freni bekledi (Rust hız satırları fren aralıklarında durdu). Ardışık 429: üç çift, her çiftte
15 sn'lik fren bittikten sonraki ilk istek yine 429 aldı (en uzun dizi 2,
üçlü yok). Hız her çiftte bir kez daha düştü.

**Dikkat.** Derin limit ~50 req/s'de hemen aştı; AIMD ~13-18 req/s'ye inmeden
önce altı 429 yedi. Bunun nedeni başlangıç hızının `ESI_MAX_RPS` olması, yani
yeni bir davranış değil (2026-10-28 §7 ile aynı). Beklentiyle çelişen bir
bulgu yok.
